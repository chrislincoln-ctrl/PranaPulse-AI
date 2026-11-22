import type { ServerEnv } from '../env.js';
import { createAdminSupabaseClient, type DbMemberRow } from './companionDbMapper.js';
import { fetchLatestProfileRow } from './profileRowQuery.js';
import {
  listOptedInWorkspacesFromStorage,
  probeStorageBucketReady,
  readWorkspaceFromStorageByChat,
  readWorkspaceFromStorageByCode,
  readWorkspaceFromStorageByKey,
  resetStorageFallbackCache,
  writeWorkspaceToStorage,
} from './workspaceStorageFallback.js';
import {
  deserializeDbRowToWorkspace,
  serializeWorkspaceToDbRow,
  workspaceKeyToUuid,
  type SyncedWorkspaceRecord,
} from './workspaceSyncCodec.js';

export type CompanionStorageBackend = 'postgres' | 'supabase-storage' | 'memory';

export interface CompanionDbHealth {
  readonly ready: boolean;
  readonly backend: CompanionStorageBackend;
}

const PROFILES_TABLE = 'family_member_profiles';
const DB_PROBE_TTL_MS = 60_000;

export const memoryWorkspaces = new Map<string, SyncedWorkspaceRecord>();
let dbProbeCache: { readonly health: CompanionDbHealth; readonly checkedAt: number } | null = null;
let pgMissingUntil = 0;

function isMissingTableError(
  err: { readonly code?: string; readonly message?: string } | null,
): boolean {
  if (!err) {
    return false;
  }
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

export function cacheWorkspace(ws: SyncedWorkspaceRecord): SyncedWorkspaceRecord {
  memoryWorkspaces.set(ws.workspaceKey, ws);
  return ws;
}

export function findMemoryWorkspaceByChat(chatId: string): SyncedWorkspaceRecord | null {
  return [...memoryWorkspaces.values()].find((w) => w.telegramChatId === chatId) ?? null;
}

export function findMemoryWorkspaceByCode(code: string): SyncedWorkspaceRecord | null {
  const lower = code.toLowerCase();
  return (
    [...memoryWorkspaces.values()].find((w) => w.telegramLinkCode?.toLowerCase() === lower) ?? null
  );
}

export function clearMemoryChatConflict(chatId: string, keepKey: string): void {
  for (const prev of memoryWorkspaces.values()) {
    if (prev.telegramChatId === chatId && prev.workspaceKey !== keepKey) {
      memoryWorkspaces.set(prev.workspaceKey, { ...prev, telegramChatId: null });
    }
  }
}

async function queryPostgresWorkspace(
  column: 'id' | 'telegram_chat_id' | 'telegram_link_code',
  value: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  if (Date.now() < pgMissingUntil) {
    return null;
  }
  try {
    const { row, error } = await fetchLatestProfileRow(column, value, env);
    if (isMissingTableError(error)) {
      pgMissingUntil = Date.now() + DB_PROBE_TTL_MS;
      return null;
    }
    return row ? cacheWorkspace(deserializeDbRowToWorkspace(row)) : null;
  } catch {
    return null;
  }
}

async function readStorageWorkspaceByColumn(
  column: 'id' | 'telegram_chat_id' | 'telegram_link_code',
  value: string,
  env: ServerEnv,
  rawKeyHint?: string,
): Promise<SyncedWorkspaceRecord | null> {
  if (column === 'id' && rawKeyHint) {
    return await readWorkspaceFromStorageByKey(rawKeyHint, env);
  }
  if (column === 'telegram_chat_id') {
    return await readWorkspaceFromStorageByChat(value, env);
  }
  return column === 'telegram_link_code' ? await readWorkspaceFromStorageByCode(value, env) : null;
}

/** Looks up a workspace across Postgres (Tier 1) and Supabase Storage (Tier 2). */
export async function queryDbWorkspace(
  column: 'id' | 'telegram_chat_id' | 'telegram_link_code',
  value: string,
  env: ServerEnv,
  rawKeyHint?: string,
): Promise<SyncedWorkspaceRecord | null> {
  const fromPg = await queryPostgresWorkspace(column, value, env);
  if (fromPg) {
    return fromPg;
  }
  const fromStorage = await readStorageWorkspaceByColumn(column, value, env, rawKeyHint);
  return fromStorage ? cacheWorkspace(fromStorage) : null;
}

async function clearPgChatConflict(
  db: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  ws: SyncedWorkspaceRecord,
  shouldClear: boolean,
): Promise<void> {
  if (!shouldClear || !ws.telegramChatId) {
    return;
  }
  await db
    .from(PROFILES_TABLE)
    .update({ telegram_chat_id: null })
    .eq('telegram_chat_id', ws.telegramChatId)
    .neq('id', ws.id);
}

async function tryPersistPostgres(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
  clearChatConflict: boolean,
): Promise<SyncedWorkspaceRecord | null> {
  const db = Date.now() < pgMissingUntil ? null : createAdminSupabaseClient(env);
  if (!db) {
    return null;
  }
  try {
    await clearPgChatConflict(db, ws, clearChatConflict);
    const res = await db
      .from(PROFILES_TABLE)
      .upsert(serializeWorkspaceToDbRow(ws), { onConflict: 'id' })
      .select()
      .limit(1);
    if (res.error) {
      if (isMissingTableError(res.error)) {
        pgMissingUntil = Date.now() + DB_PROBE_TTL_MS;
      }
      return null;
    }
    const row = (Array.isArray(res.data) ? (res.data as DbMemberRow[]) : [])[0];
    return row ? cacheWorkspace(deserializeDbRowToWorkspace(row)) : ws;
  } catch {
    return null;
  }
}

export async function persistWorkspaceRecord(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
  clearChatConflict = false,
): Promise<SyncedWorkspaceRecord> {
  cacheWorkspace(ws);
  const pgSaved = await tryPersistPostgres(ws, env, clearChatConflict);
  if (pgSaved) {
    return pgSaved;
  }
  await writeWorkspaceToStorage(ws, env);
  return ws;
}

export async function lookupWorkspaceByKey(
  workspaceKey: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  const remote = await queryDbWorkspace('id', workspaceKeyToUuid(workspaceKey), env, workspaceKey);
  return remote ?? memoryWorkspaces.get(workspaceKey) ?? null;
}

async function listPostgresOptedIn(
  db: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
): Promise<readonly SyncedWorkspaceRecord[] | null> {
  if (Date.now() < pgMissingUntil) {
    return null;
  }
  try {
    const res = await db
      .from(PROFILES_TABLE)
      .select('*')
      .eq('telegram_opt_in', true)
      .not('telegram_chat_id', 'is', null);
    if (res.error || !Array.isArray(res.data)) {
      return null;
    }
    return (res.data as DbMemberRow[]).map((r) => cacheWorkspace(deserializeDbRowToWorkspace(r)));
  } catch {
    return null;
  }
}

export async function listOptedInWorkspaces(
  env: ServerEnv,
): Promise<readonly SyncedWorkspaceRecord[]> {
  const db = createAdminSupabaseClient(env);
  if (db) {
    const pgRows = await listPostgresOptedIn(db);
    if (pgRows) {
      return pgRows;
    }
    const fromStorage = await listOptedInWorkspacesFromStorage(env);
    if (fromStorage.length > 0) {
      return fromStorage.map(cacheWorkspace);
    }
  }
  return [...memoryWorkspaces.values()].filter((w) => w.telegramOptIn && w.telegramChatId !== null);
}

export async function markWorkspaceBriefSent(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<void> {
  await persistWorkspaceRecord({ ...ws, lastBriefSentAt: new Date().toISOString() }, env);
}

function cacheProbe(health: CompanionDbHealth): CompanionDbHealth {
  dbProbeCache = { health, checkedAt: Date.now() };
  return health;
}

export async function checkCompanionDbHealth(env: ServerEnv): Promise<CompanionDbHealth> {
  if (!createAdminSupabaseClient(env)) {
    return { ready: false, backend: 'memory' };
  }
  if (dbProbeCache && Date.now() - dbProbeCache.checkedAt < DB_PROBE_TTL_MS) {
    return dbProbeCache.health;
  }
  try {
    const { error } = await fetchLatestProfileRow(
      'id',
      '00000000-0000-0000-0000-000000000000',
      env,
    );
    if (!error) {
      return cacheProbe({ ready: true, backend: 'postgres' });
    }
    if (isMissingTableError(error)) {
      pgMissingUntil = Date.now() + DB_PROBE_TTL_MS;
    }
  } catch {
    // Fall through to Storage bucket probe.
  }
  const ok = await probeStorageBucketReady(env);
  return cacheProbe({ ready: ok, backend: ok ? 'supabase-storage' : 'memory' });
}

export const checkCompanionDbReady = async (env: ServerEnv): Promise<boolean> =>
  (await checkCompanionDbHealth(env)).ready;

export function clearHouseholdWorkspaceStore(): void {
  memoryWorkspaces.clear();
  dbProbeCache = null;
  pgMissingUntil = 0;
  resetStorageFallbackCache();
}
