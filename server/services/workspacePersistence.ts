import type { ServerEnv } from '../env.js';
import { createAdminSupabaseClient, type DbMemberRow } from './companionDbMapper.js';
import {
  deserializeDbRowToWorkspace,
  serializeWorkspaceToDbRow,
  type SyncedWorkspaceRecord,
} from './workspaceSyncCodec.js';

const PROFILES_TABLE = 'family_member_profiles';
const DB_PROBE_TTL_MS = 60_000;

export const memoryWorkspaces = new Map<string, SyncedWorkspaceRecord>();
let dbProbeCache: { readonly ready: boolean; readonly checkedAt: number } | null = null;

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

export async function queryDbWorkspace(
  column: 'id' | 'telegram_chat_id' | 'telegram_link_code',
  value: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return null;
  }
  try {
    const res = await db
      .from(PROFILES_TABLE)
      .select('*')
      .eq(column, value)
      .order('updated_at', { ascending: false })
      .limit(1);
    const row = (Array.isArray(res.data) ? (res.data as DbMemberRow[]) : [])[0];
    return row ? cacheWorkspace(deserializeDbRowToWorkspace(row)) : null;
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
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return ws;
  }
  try {
    if (clearChatConflict && ws.telegramChatId) {
      await db
        .from(PROFILES_TABLE)
        .update({ telegram_chat_id: null })
        .eq('telegram_chat_id', ws.telegramChatId)
        .neq('id', ws.id);
    }
    const res = await db
      .from(PROFILES_TABLE)
      .upsert(serializeWorkspaceToDbRow(ws), { onConflict: 'id' })
      .select()
      .limit(1);
    const row = (Array.isArray(res.data) ? (res.data as DbMemberRow[]) : [])[0];
    return row ? cacheWorkspace(deserializeDbRowToWorkspace(row)) : ws;
  } catch {
    return ws;
  }
}

/** Lists all Telegram-linked household workspaces opted into automated daily morning briefs. */
export async function listOptedInWorkspaces(
  env: ServerEnv,
): Promise<readonly SyncedWorkspaceRecord[]> {
  const db = createAdminSupabaseClient(env);
  if (db) {
    try {
      const res = await db
        .from(PROFILES_TABLE)
        .select('*')
        .eq('telegram_opt_in', true)
        .not('telegram_chat_id', 'is', null);
      if (Array.isArray(res.data)) {
        return (res.data as DbMemberRow[]).map((r) =>
          cacheWorkspace(deserializeDbRowToWorkspace(r)),
        );
      }
    } catch {
      // Fall back to in-memory workspaces.
    }
  }
  return [...memoryWorkspaces.values()].filter((w) => w.telegramOptIn && w.telegramChatId !== null);
}

/** Stamps the last automated daily brief delivery timestamp onto a workspace record. */
export async function markWorkspaceBriefSent(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<void> {
  await persistWorkspaceRecord({ ...ws, lastBriefSentAt: new Date().toISOString() }, env);
}

/** Performs a cached non-destructive check verifying Supabase service-role access to `family_member_profiles`. */
export async function checkCompanionDbReady(env: ServerEnv): Promise<boolean> {
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return false;
  }
  if (dbProbeCache && Date.now() - dbProbeCache.checkedAt < DB_PROBE_TTL_MS) {
    return dbProbeCache.ready;
  }
  try {
    const res = await db.from(PROFILES_TABLE).select('id').limit(1);
    dbProbeCache = { ready: !res.error, checkedAt: Date.now() };
    return dbProbeCache.ready;
  } catch {
    dbProbeCache = { ready: false, checkedAt: Date.now() };
    return false;
  }
}

/** Clears the in-memory household workspace store for isolated automated tests. */
export function clearHouseholdWorkspaceStore(): void {
  memoryWorkspaces.clear();
  dbProbeCache = null;
}
