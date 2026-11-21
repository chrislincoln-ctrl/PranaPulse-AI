import { randomBytes } from 'node:crypto';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import type { PlanRequestPayload } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { DEFAULT_BRIEF_TIME_LOCAL } from './companionDbMapper.js';
import { reverseGeocodeCoords } from './reverseGeocoder.js';
import {
  clearMemoryChatConflict,
  findMemoryWorkspaceByChat,
  findMemoryWorkspaceByCode,
  lookupWorkspaceByKey,
  persistWorkspaceRecord,
  queryDbWorkspace,
} from './workspacePersistence.js';
import {
  decodeWorkspaceLinkCode,
  encodeWorkspaceLinkCode,
  sanitizeWorkspaceKey,
  workspaceKeyToUuid,
  type DecodedLinkCode,
  type SyncedWorkspaceRecord,
} from './workspaceSyncCodec.js';

export { getActiveMember, type SyncedWorkspaceRecord } from './workspaceSyncCodec.js';
export {
  checkCompanionDbHealth,
  checkCompanionDbReady,
  clearHouseholdWorkspaceStore,
  listOptedInWorkspaces,
  markWorkspaceBriefSent,
} from './workspacePersistence.js';

export interface WebWorkspaceSyncInput {
  readonly workspaceKey?: string | undefined;
  readonly payload: PlanRequestPayload;
  readonly activeMemberId?: string | undefined;
  readonly userId?: string | undefined;
}

export interface TelegramWorkspacePatch {
  readonly payload?: PlanRequestPayload | undefined;
  readonly activeMemberId?: string | undefined;
  readonly telegramOptIn?: boolean | undefined;
}

const RANDOM_KEY_BYTES = 6;

const DEFAULT_META = {
  telegramChatId: null,
  telegramLinkCode: null,
  telegramOptIn: true,
  briefTimeLocal: DEFAULT_BRIEF_TIME_LOCAL,
  lastBriefSentAt: null,
} as const;

function preserveTelegramMeta(existing: SyncedWorkspaceRecord | null) {
  if (!existing) {
    return DEFAULT_META;
  }
  return {
    telegramChatId: existing.telegramChatId,
    telegramLinkCode: existing.telegramLinkCode,
    telegramOptIn: existing.telegramOptIn,
    briefTimeLocal: existing.briefTimeLocal,
    lastBriefSentAt: existing.lastBriefSentAt,
  };
}

/** Fetches the latest synced workspace by key (reading Supabase DB first so Telegram edits surface immediately). */
export async function getWorkspaceByKey(
  rawKey: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  const workspaceKey = sanitizeWorkspaceKey(rawKey, '');
  if (!workspaceKey) {
    return null;
  }
  return await lookupWorkspaceByKey(workspaceKey, env);
}

function resolveActiveMemberId(
  input: WebWorkspaceSyncInput,
  existing: SyncedWorkspaceRecord | null,
): string {
  return input.activeMemberId ?? existing?.activeMemberId ?? input.payload.members[0]?.id ?? 'm1';
}

/** Persists a full household workspace update from the web console while preserving any active Telegram link. */
export async function syncWorkspaceFromWeb(
  input: WebWorkspaceSyncInput,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord> {
  const workspaceKey = sanitizeWorkspaceKey(
    input.workspaceKey,
    randomBytes(RANDOM_KEY_BYTES).toString('hex'),
  );
  const existing = await getWorkspaceByKey(workspaceKey, env);
  const next: SyncedWorkspaceRecord = {
    id: existing ? existing.id : workspaceKeyToUuid(workspaceKey),
    workspaceKey,
    userId: input.userId ?? existing?.userId ?? null,
    activeMemberId: resolveActiveMemberId(input, existing),
    payload: input.payload,
    ...preserveTelegramMeta(existing),
    lastModifiedBy: 'web',
    updatedAt: new Date().toISOString(),
  };
  return await persistWorkspaceRecord(next, env);
}

/** Syncs the full web household workspace and returns a coordinate-embedded 1-tap Telegram pairing link code. */
export async function createWorkspaceTelegramLink(
  input: WebWorkspaceSyncInput,
  env: ServerEnv,
): Promise<{ readonly workspace: SyncedWorkspaceRecord; readonly linkCode: string }> {
  const synced = await syncWorkspaceFromWeb(input, env);
  const linkCode = encodeWorkspaceLinkCode({
    workspaceKey: synced.workspaceKey,
    memberKey: synced.activeMemberId,
    lat: synced.payload.lat,
    lon: synced.payload.lon,
  });
  const saved = await persistWorkspaceRecord(
    { ...synced, telegramLinkCode: linkCode, updatedAt: new Date().toISOString() },
    env,
  );
  return { workspace: saved, linkCode };
}

async function resolveColdStartCity(decoded: DecodedLinkCode | null): Promise<{
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
}> {
  if (decoded?.lat !== undefined && decoded.lon !== undefined) {
    const rev = await reverseGeocodeCoords(decoded.lat, decoded.lon);
    return {
      city: rev ?? `${String(decoded.lat)}, ${String(decoded.lon)}`,
      lat: decoded.lat,
      lon: decoded.lon,
    };
  }
  return {
    city: DEFAULT_WORKSPACE_INPUT.city,
    lat: DEFAULT_WORKSPACE_INPUT.lat,
    lon: DEFAULT_WORKSPACE_INPUT.lon,
  };
}

async function buildColdStartWorkspace(
  decoded: DecodedLinkCode | null,
  telegramChatId: string,
): Promise<SyncedWorkspaceRecord> {
  const wsKey = sanitizeWorkspaceKey(decoded?.workspaceKey ?? undefined, `tg${telegramChatId}`);
  const loc = await resolveColdStartCity(decoded);
  const memberKey = decoded?.memberKey ?? 'm1';
  const matched = DEFAULT_WORKSPACE_INPUT.members.find((m) => m.id.toLowerCase() === memberKey);
  return {
    id: workspaceKeyToUuid(wsKey),
    workspaceKey: wsKey,
    userId: null,
    activeMemberId: matched?.id ?? 'm1',
    payload: { ...DEFAULT_WORKSPACE_INPUT, ...loc },
    telegramChatId,
    telegramLinkCode: null,
    telegramOptIn: true,
    briefTimeLocal: DEFAULT_BRIEF_TIME_LOCAL,
    lastBriefSentAt: null,
    lastModifiedBy: 'telegram',
    updatedAt: new Date().toISOString(),
  };
}

async function lookupWorkspaceForCode(
  cleanCode: string,
  decoded: DecodedLinkCode | null,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  if (cleanCode) {
    const byCode =
      (await queryDbWorkspace('telegram_link_code', cleanCode, env)) ??
      findMemoryWorkspaceByCode(cleanCode);
    if (byCode) {
      return byCode;
    }
  }
  return decoded?.workspaceKey ? await getWorkspaceByKey(decoded.workspaceKey, env) : null;
}

/** Redeems a `/start <linkCode>` deep link, binding `telegramChatId` and preserving exact GPS coordinates. */
export async function redeemWorkspaceLinkCode(
  linkCode: string,
  telegramChatId: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord> {
  const cleanCode = linkCode.trim().toLowerCase();
  const decoded = decodeWorkspaceLinkCode(cleanCode);
  const matched = await lookupWorkspaceForCode(cleanCode, decoded, env);
  const base = matched ?? (await buildColdStartWorkspace(decoded, telegramChatId));
  const pickedMember = decoded?.memberKey
    ? base.payload.members.find((m) => m.id.toLowerCase() === decoded.memberKey)
    : undefined;
  const linked: SyncedWorkspaceRecord = {
    ...base,
    activeMemberId: pickedMember?.id ?? base.activeMemberId,
    telegramChatId,
    telegramLinkCode: cleanCode || base.telegramLinkCode,
    telegramOptIn: true,
    updatedAt: new Date().toISOString(),
  };
  clearMemoryChatConflict(telegramChatId, linked.workspaceKey);
  return await persistWorkspaceRecord(linked, env, true);
}

/** Loads the latest synced household workspace bound to a Telegram chat ID (always reading DB first). */
export async function findWorkspaceByTelegramChatId(
  telegramChatId: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord | null> {
  return (
    (await queryDbWorkspace('telegram_chat_id', telegramChatId, env)) ??
    findMemoryWorkspaceByChat(telegramChatId)
  );
}

/** Ensures any Telegram user always has a persistent household workspace even if they start in Telegram first. */
export async function ensureWorkspaceForTelegramChatId(
  telegramChatId: string,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord> {
  const existing = await findWorkspaceByTelegramChatId(telegramChatId, env);
  return (
    existing ??
    (await persistWorkspaceRecord(await buildColdStartWorkspace(null, telegramChatId), env, true))
  );
}

/** Applies a Telegram-originated mutation and persists it so the web console syncs live. */
export async function updateWorkspaceFromTelegram(
  workspace: SyncedWorkspaceRecord,
  patch: TelegramWorkspacePatch,
  env: ServerEnv,
): Promise<SyncedWorkspaceRecord> {
  const next: SyncedWorkspaceRecord = {
    ...workspace,
    ...(patch.payload ? { payload: patch.payload } : {}),
    ...(patch.activeMemberId ? { activeMemberId: patch.activeMemberId } : {}),
    ...(patch.telegramOptIn !== undefined ? { telegramOptIn: patch.telegramOptIn } : {}),
    lastModifiedBy: 'telegram',
    updatedAt: new Date().toISOString(),
  };
  return await persistWorkspaceRecord(next, env);
}
