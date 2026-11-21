import { createHash } from 'node:crypto';
import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { resolveMemberArchetype } from '../../src/domain/memberScheduleBuilder.js';
import type { FamilyMemberInput } from '../../src/domain/types.js';
import { planRequestSchema, type PlanRequestPayload } from '../../src/validators/schemas.js';
import { DEFAULT_BRIEF_TIME_LOCAL, type DbMemberRow } from './companionDbMapper.js';

export interface SyncedWorkspaceRecord {
  readonly id: string;
  readonly workspaceKey: string;
  readonly userId: string | null;
  readonly activeMemberId: string;
  readonly payload: PlanRequestPayload;
  readonly telegramChatId: string | null;
  readonly telegramLinkCode: string | null;
  readonly telegramOptIn: boolean;
  readonly briefTimeLocal: string;
  readonly lastBriefSentAt: string | null;
  readonly lastModifiedBy: 'web' | 'telegram';
  readonly updatedAt: string;
}

export interface DecodedLinkCode {
  readonly workspaceKey: string | null;
  readonly memberKey: string;
  readonly lat?: number;
  readonly lon?: number;
}

interface StoredWorkspaceBlob {
  readonly v?: number;
  readonly activeMemberId?: string;
  readonly lastModifiedBy?: 'web' | 'telegram';
  readonly payload?: unknown;
}

const WS_KEY_PREFIX = 'ws:';
const MIN_WS_KEY_LEN = 4;
const MAX_WS_KEY_LEN = 20;
const MEMBER_KEY_MAX = 8;
const COORD_SCALE = 100;
const MAX_LAT = 90;
const MAX_LON = 180;
const UUID_P1_END = 8;
const UUID_P2_END = 12;
const UUID_P3_END = 16;
const UUID_P4_END = 20;
const UUID_P5_END = 32;
const LINK_PREFIX = 'p';
const LINK_PARTS_MIN = 5;
const LAT_PART_INDEX = 3;
const LON_PART_INDEX = 4;
const FALLBACK_MEMBER: FamilyMemberInput = {
  id: 'm1',
  label: 'Aarav (School)',
  role: 'child',
  mask: 'n95-ffp2',
  dailyOutdoorHours: 1,
};

/** Normalizes a workspace sync key into a compact, URL- and Telegram-safe alphanumeric identifier. */
export function sanitizeWorkspaceKey(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, MAX_WS_KEY_LEN);
  return cleaned.length >= MIN_WS_KEY_LEN ? cleaned : fallback;
}

/** Derives a deterministic RFC 4122 UUID from a workspace key so upserts stay idempotent across cold starts. */
export function workspaceKeyToUuid(workspaceKey: string): string {
  const hex = createHash('sha256').update(`pranapulse-ws:${workspaceKey}`).digest('hex');
  const p1 = hex.slice(0, UUID_P1_END);
  const p2 = hex.slice(UUID_P1_END, UUID_P2_END);
  const p3 = `4${hex.slice(UUID_P2_END + 1, UUID_P3_END)}`;
  const p4 = `8${hex.slice(UUID_P3_END + 1, UUID_P4_END)}`;
  const p5 = hex.slice(UUID_P4_END, UUID_P5_END);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function encodeScaledCoord(val: number): string {
  const scaled = Math.round(val * COORD_SCALE);
  return scaled < 0 ? `n${String(Math.abs(scaled))}` : String(scaled);
}

function decodeScaledCoord(token: string | undefined, maxAbs: number): number | undefined {
  if (!token) {
    return undefined;
  }
  const neg = token.startsWith('n');
  const num = Number.parseInt(neg ? token.slice(1) : token, VALIDATION_BOUNDS.DECIMAL_BASE);
  if (!Number.isFinite(num)) {
    return undefined;
  }
  const val = (neg ? -num : num) / COORD_SCALE;
  return Math.abs(val) <= maxAbs ? val : undefined;
}

/** Encodes workspace key, active member key, and GPS coordinates into a <=40-char Telegram `/start` token. */
export function encodeWorkspaceLinkCode(params: {
  readonly workspaceKey: string;
  readonly memberKey: string;
  readonly lat: number;
  readonly lon: number;
}): string {
  const ws = sanitizeWorkspaceKey(params.workspaceKey, 'home1');
  const mk =
    params.memberKey
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .slice(0, MEMBER_KEY_MAX) || 'm1';
  return `${LINK_PREFIX}_${ws}_${mk}_${encodeScaledCoord(params.lat)}_${encodeScaledCoord(params.lon)}`;
}

function parsePrefixedLinkParts(parts: readonly string[]): DecodedLinkCode {
  const wsKey = sanitizeWorkspaceKey(parts[1], '');
  const lat = decodeScaledCoord(parts[LAT_PART_INDEX], MAX_LAT);
  const lon = decodeScaledCoord(parts[LON_PART_INDEX], MAX_LON);
  const memberKey = parts[2] && parts[2].length > 0 ? parts[2] : 'm1';
  return {
    workspaceKey: wsKey.length >= MIN_WS_KEY_LEN ? wsKey : null,
    memberKey,
    ...(lat !== undefined ? { lat } : {}),
    ...(lon !== undefined ? { lon } : {}),
  };
}

/** Decodes a new coordinate-embedded link token (`p_<ws>_<mk>_<lat>_<lon>`) or legacy `<mk>_<hex>` code. */
export function decodeWorkspaceLinkCode(rawCode: string): DecodedLinkCode | null {
  const clean = rawCode.trim().toLowerCase();
  if (!clean) {
    return null;
  }
  const parts = clean.split('_');
  if (parts[0] === LINK_PREFIX && parts.length >= LINK_PARTS_MIN) {
    return parsePrefixedLinkParts(parts);
  }
  const fallbackKey = parts[0] && parts[0].length > 0 ? parts[0] : 'm1';
  return { workspaceKey: null, memberKey: fallbackKey };
}

/** Returns the active family member from a synced workspace record, always guaranteed non-empty. */
export function getActiveMember(ws: SyncedWorkspaceRecord): FamilyMemberInput {
  return (
    ws.payload.members.find((m) => m.id === ws.activeMemberId) ??
    ws.payload.members[0] ??
    DEFAULT_WORKSPACE_INPUT.members[0] ??
    FALLBACK_MEMBER
  );
}

/** Serializes a `SyncedWorkspaceRecord` onto the existing `family_member_profiles` SQL row structure. */
export function serializeWorkspaceToDbRow(ws: SyncedWorkspaceRecord): DbMemberRow {
  const active = getActiveMember(ws);
  const blob: StoredWorkspaceBlob = {
    v: 1,
    activeMemberId: active.id,
    lastModifiedBy: ws.lastModifiedBy,
    payload: ws.payload,
  };
  return {
    id: ws.id,
    user_id: ws.userId,
    member_key: `${WS_KEY_PREFIX}${ws.workspaceKey}`,
    label: active.label,
    role: active.role,
    mask: active.mask,
    daily_outdoor_hours: active.dailyOutdoorHours,
    city: ws.payload.city,
    lat: ws.payload.lat,
    lon: ws.payload.lon,
    language: ws.payload.language,
    archetype: resolveMemberArchetype(active),
    leave_home_time: active.leaveHomeTime ?? null,
    return_home_time: active.returnHomeTime ?? null,
    commute_mode: active.commuteMode ?? ws.payload.commuteMode,
    health_notes: active.healthNotes ?? null,
    daily_habits_note: JSON.stringify(blob),
    telegram_chat_id: ws.telegramChatId,
    telegram_link_code: ws.telegramLinkCode,
    telegram_opt_in: ws.telegramOptIn,
    brief_time_local: ws.briefTimeLocal || DEFAULT_BRIEF_TIME_LOCAL,
    last_brief_sent_at: ws.lastBriefSentAt,
    updated_at: ws.updatedAt,
  };
}

function parseBlob(raw: string | null): StoredWorkspaceBlob | null {
  if (!raw?.startsWith('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredWorkspaceBlob | null;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function buildLegacyFallbackPayload(row: DbMemberRow): PlanRequestPayload {
  const member: FamilyMemberInput = {
    id: row.member_key.startsWith(WS_KEY_PREFIX) ? 'm1' : row.member_key,
    label: row.label,
    role: row.role,
    mask: row.mask,
    dailyOutdoorHours: row.daily_outdoor_hours || 1,
    archetype: row.archetype,
    ...(row.leave_home_time ? { leaveHomeTime: row.leave_home_time } : {}),
    ...(row.return_home_time ? { returnHomeTime: row.return_home_time } : {}),
    ...(row.commute_mode ? { commuteMode: row.commute_mode } : {}),
    ...(row.health_notes ? { healthNotes: row.health_notes } : {}),
    telegramDailyBrief: row.telegram_opt_in,
    briefTimeLocal: row.brief_time_local || DEFAULT_BRIEF_TIME_LOCAL,
  };
  const rest = DEFAULT_WORKSPACE_INPUT.members.filter((m) => m.id !== member.id);
  return {
    ...DEFAULT_WORKSPACE_INPUT,
    city: row.city,
    lat: row.lat,
    lon: row.lon,
    language: row.language,
    members: [member, ...rest],
  };
}

function extractWorkspaceKeyFromRow(row: DbMemberRow): string {
  const raw = row.member_key.startsWith(WS_KEY_PREFIX)
    ? row.member_key.slice(WS_KEY_PREFIX.length)
    : `tg${row.telegram_chat_id ?? row.id.slice(0, UUID_P1_END)}`;
  return sanitizeWorkspaceKey(raw, 'home1');
}

function resolvePayloadFromRow(
  row: DbMemberRow,
  blob: StoredWorkspaceBlob | null,
): PlanRequestPayload {
  const parsed = blob?.payload ? planRequestSchema.safeParse(blob.payload) : null;
  const base = parsed?.success ? parsed.data : buildLegacyFallbackPayload(row);
  return { ...base, city: row.city, lat: row.lat, lon: row.lon, language: row.language };
}

/** Deserializes a `family_member_profiles` SQL row (new anchor or legacy member row) into a workspace. */
export function deserializeDbRowToWorkspace(row: DbMemberRow): SyncedWorkspaceRecord {
  const blob = parseBlob(row.daily_habits_note);
  const payload = resolvePayloadFromRow(row, blob);
  const activeMemberId = blob?.activeMemberId ?? payload.members[0]?.id ?? 'm1';
  return {
    id: row.id,
    workspaceKey: extractWorkspaceKeyFromRow(row),
    userId: row.user_id,
    activeMemberId,
    payload,
    telegramChatId: row.telegram_chat_id,
    telegramLinkCode: row.telegram_link_code,
    telegramOptIn: row.telegram_opt_in,
    briefTimeLocal: row.brief_time_local || DEFAULT_BRIEF_TIME_LOCAL,
    lastBriefSentAt: row.last_brief_sent_at,
    lastModifiedBy: blob?.lastModifiedBy ?? 'web',
    updatedAt: row.updated_at,
  };
}
