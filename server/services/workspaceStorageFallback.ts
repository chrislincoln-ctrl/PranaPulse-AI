import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerEnv } from '../env.js';
import { createAdminSupabaseClient } from './companionDbMapper.js';
import type { SyncedWorkspaceRecord } from './workspaceSyncCodec.js';

const SYNC_BUCKET = 'pranapulse-sync';
const WS_PREFIX = 'ws';
const CHAT_PREFIX = 'chat';
const CODE_PREFIX = 'code';
const MAX_LIST_ITEMS = 100;
const MAX_LIST_PAGES = 10;
const SAFE_SEGMENT_RE = /^[a-zA-Z0-9_-]{1,80}$/;

let bucketEnsured = false;

function isSafeSegment(value: string): boolean {
  return SAFE_SEGMENT_RE.test(value);
}

function isBucketCreatedOrExisting(err: { readonly message: string } | null): boolean {
  if (!err) {
    return true;
  }
  const msg = err.message.toLowerCase();
  return msg.includes('already exists') || msg.includes('duplicate');
}

async function ensureSyncBucket(db: SupabaseClient): Promise<boolean> {
  if (bucketEnsured) {
    return true;
  }
  try {
    const existing = await db.storage.getBucket(SYNC_BUCKET);
    if (!existing.error) {
      if (existing.data.public) {
        return false;
      }
      bucketEnsured = true;
      return true;
    }
    const created = await db.storage.createBucket(SYNC_BUCKET, { public: false });
    if (isBucketCreatedOrExisting(created.error)) {
      const verified = await db.storage.getBucket(SYNC_BUCKET);
      if (verified.error || !verified.data.public) {
        bucketEnsured = true;
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function uploadJsonObject(
  db: SupabaseClient,
  objectPath: string,
  value: unknown,
): Promise<boolean> {
  try {
    const body = Buffer.from(JSON.stringify(value), 'utf8');
    const res = await db.storage.from(SYNC_BUCKET).upload(objectPath, body, {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '0',
    });
    return !res.error;
  } catch {
    return false;
  }
}

async function downloadJsonObject<T>(db: SupabaseClient, objectPath: string): Promise<T | null> {
  try {
    const res = await db.storage.from(SYNC_BUCKET).download(objectPath);
    if (res.error) {
      return null;
    }
    const text = await res.data.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function clearPreviousStorageChatOwner(
  db: SupabaseClient,
  chatId: string,
  keepWorkspaceKey: string,
): Promise<void> {
  if (!isSafeSegment(chatId)) {
    return;
  }
  const prevPtr = await downloadJsonObject<{ readonly workspaceKey?: string }>(
    db,
    `${CHAT_PREFIX}/${chatId}.json`,
  );
  const oldKey = prevPtr?.workspaceKey;
  if (!oldKey || oldKey === keepWorkspaceKey || !isSafeSegment(oldKey)) {
    return;
  }
  const oldWs = await downloadJsonObject<SyncedWorkspaceRecord>(db, `${WS_PREFIX}/${oldKey}.json`);
  if (oldWs?.telegramChatId === chatId) {
    await uploadJsonObject(db, `${WS_PREFIX}/${oldKey}.json`, {
      ...oldWs,
      telegramChatId: null,
      telegramOptIn: false,
    });
  }
}

async function writePointerObject(
  db: SupabaseClient,
  prefix: string,
  segment: string | null | undefined,
  workspaceKey: string,
): Promise<void> {
  if (segment && isSafeSegment(segment)) {
    await uploadJsonObject(db, `${prefix}/${segment}.json`, { workspaceKey });
  }
}

/** Persists a workspace record and its Telegram chat/link-code pointers to private Supabase Storage. */
export async function writeWorkspaceToStorage(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
  clearChatConflict = false,
): Promise<boolean> {
  const db = createAdminSupabaseClient(env);
  if (!db || !isSafeSegment(ws.workspaceKey) || !(await ensureSyncBucket(db))) {
    return false;
  }
  if (clearChatConflict && ws.telegramChatId) {
    await clearPreviousStorageChatOwner(db, ws.telegramChatId, ws.workspaceKey);
  }
  const ok = await uploadJsonObject(db, `${WS_PREFIX}/${ws.workspaceKey}.json`, ws);
  await writePointerObject(db, CHAT_PREFIX, ws.telegramChatId, ws.workspaceKey);
  await writePointerObject(db, CODE_PREFIX, ws.telegramLinkCode?.toLowerCase(), ws.workspaceKey);
  return ok;
}

/** Reads the latest synced workspace JSON by workspace key from Supabase Storage. */
export async function readWorkspaceFromStorageByKey(
  workspaceKey: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  const db = createAdminSupabaseClient(env);
  if (!db || !isSafeSegment(workspaceKey) || !(await ensureSyncBucket(db))) {
    return null;
  }
  return await downloadJsonObject<SyncedWorkspaceRecord>(db, `${WS_PREFIX}/${workspaceKey}.json`);
}

async function readWorkspaceViaPointer(
  prefix: string,
  segment: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  const db = createAdminSupabaseClient(env);
  if (!db || !isSafeSegment(segment) || !(await ensureSyncBucket(db))) {
    return null;
  }
  const ptr = await downloadJsonObject<{ readonly workspaceKey?: string }>(
    db,
    `${prefix}/${segment}.json`,
  );
  if (!ptr?.workspaceKey || !isSafeSegment(ptr.workspaceKey)) {
    return null;
  }
  return await downloadJsonObject<SyncedWorkspaceRecord>(
    db,
    `${WS_PREFIX}/${ptr.workspaceKey}.json`,
  );
}

/** Resolves a synced workspace by Telegram chat ID via Supabase Storage pointer. */
export async function readWorkspaceFromStorageByChat(
  chatId: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  return await readWorkspaceViaPointer(CHAT_PREFIX, chatId, env);
}

/** Resolves a synced workspace by Telegram `/start` link code via Supabase Storage pointer. */
export async function readWorkspaceFromStorageByCode(
  code: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  return await readWorkspaceViaPointer(CODE_PREFIX, code.toLowerCase(), env);
}

async function listAllWorkspaceFiles(db: SupabaseClient): Promise<readonly string[]> {
  const names: string[] = [];
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const listed = await db.storage.from(SYNC_BUCKET).list(WS_PREFIX, {
      limit: MAX_LIST_ITEMS,
      offset: page * MAX_LIST_ITEMS,
    });
    if (listed.error || !Array.isArray(listed.data)) {
      break;
    }
    for (const item of listed.data) {
      if (item.name.endsWith('.json')) {
        names.push(item.name);
      }
    }
    if (listed.data.length < MAX_LIST_ITEMS) {
      break;
    }
  }
  return names;
}

/** Lists all opted-in Telegram workspaces stored in the private Supabase Storage sync bucket. */
export async function listOptedInWorkspacesFromStorage(
  env: ServerEnv,
): Promise<readonly SyncedWorkspaceRecord[]> {
  const db = createAdminSupabaseClient(env);
  if (!db || !(await ensureSyncBucket(db))) {
    return [];
  }
  try {
    const files = await listAllWorkspaceFiles(db);
    const items = await Promise.all(
      files.map((name) => downloadJsonObject<SyncedWorkspaceRecord>(db, `${WS_PREFIX}/${name}`)),
    );
    return items.filter(
      (ws): ws is SyncedWorkspaceRecord =>
        ws !== null && ws.telegramOptIn && ws.telegramChatId !== null,
    );
  } catch {
    return [];
  }
}

/** Checks whether private Supabase Storage sync bucket is accessible and auto-initialized. */
export async function probeStorageBucketReady(env: ServerEnv): Promise<boolean> {
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return false;
  }
  return await ensureSyncBucket(db);
}

/** Resets cached bucket initialization state for isolated unit tests. */
export function resetStorageFallbackCache(): void {
  bucketEnsured = false;
}
