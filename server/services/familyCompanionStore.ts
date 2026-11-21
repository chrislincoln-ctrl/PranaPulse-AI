import { randomBytes, randomUUID } from 'node:crypto';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import type { ServerEnv } from '../env.js';
import { clearHouseholdWorkspaceStore } from './householdWorkspaceStore.js';
import {
  applyHabitPatchToProfile,
  buildProfileFromUpsert,
  createAdminSupabaseClient,
  toDbCheckinPayload,
  toDbMemberPayload,
  toStoredMemberProfile,
  type CheckinLogInput,
  type DbMemberRow,
  type MemberProfileUpsertInput,
  type ProfileHabitPatch,
  type StoredMemberProfile,
} from './companionDbMapper.js';

export {
  storedProfileToFamilyMember,
  type CheckinLogInput,
  type MemberProfileUpsertInput,
  type ProfileHabitPatch,
  type StoredMemberProfile,
} from './companionDbMapper.js';

const LINK_CODE_BYTES = 5;
const KEY_PREFIX_MAX = 8;
const MAX_IN_MEMORY_CHECKINS = 200;
const PROFILES_TABLE = 'family_member_profiles';
const CHECKINS_TABLE = 'companion_checkins';

const memoryProfiles = new Map<string, StoredMemberProfile>();
const memoryCheckins: CheckinLogInput[] = [];

function findInMemoryByOwnerKey(
  userId: string | null,
  memberKey: string,
): StoredMemberProfile | undefined {
  return [...memoryProfiles.values()].find((p) => p.userId === userId && p.memberKey === memberKey);
}

function buildFallbackProfileForMemberKey(memberKey?: string): StoredMemberProfile {
  const cleanedKey = memberKey?.toLowerCase().split('_')[0] ?? 'm1';
  const matched = DEFAULT_WORKSPACE_INPUT.members.find((m) => m.id.toLowerCase() === cleanedKey) ??
    DEFAULT_WORKSPACE_INPUT.members[0] ?? {
      id: 'm1',
      label: 'Aarav (School)',
      role: 'child' as const,
      mask: 'n95-ffp2' as const,
      dailyOutdoorHours: 1,
    };
  const { city, lat, lon } = DEFAULT_WORKSPACE_INPUT;
  const profile = buildProfileFromUpsert(
    { member: matched, city, lat, lon, language: 'en' },
    findInMemoryByOwnerKey(null, matched.id),
    randomUUID(),
  );
  memoryProfiles.set(profile.id, profile);
  return profile;
}

function cacheFirstRow(data: unknown): StoredMemberProfile | null {
  const row = (Array.isArray(data) ? (data as DbMemberRow[]) : [])[0];
  if (!row) {
    return null;
  }
  const loaded = toStoredMemberProfile(row);
  memoryProfiles.set(loaded.id, loaded);
  return loaded;
}

async function queryDbProfileByColumn(
  column: 'telegram_link_code' | 'telegram_chat_id',
  value: string,
  env: ServerEnv,
): Promise<StoredMemberProfile | null> {
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
    return cacheFirstRow(res.data);
  } catch {
    return null;
  }
}

async function persistProfileToDb(
  profile: StoredMemberProfile,
  env: ServerEnv,
  clearChatIdConflict = false,
): Promise<StoredMemberProfile> {
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return profile;
  }
  try {
    if (clearChatIdConflict && profile.telegramChatId) {
      await db
        .from(PROFILES_TABLE)
        .update({ telegram_chat_id: null })
        .eq('telegram_chat_id', profile.telegramChatId)
        .neq('id', profile.id);
    }
    const res = await db
      .from(PROFILES_TABLE)
      .upsert(toDbMemberPayload(profile), { onConflict: 'id' })
      .select()
      .limit(1);
    return cacheFirstRow(res.data) ?? profile;
  } catch {
    return profile;
  }
}

/** Upserts a family member profile in Supabase (when configured) or the in-memory fallback store. */
export async function upsertMemberProfile(
  input: MemberProfileUpsertInput,
  env: ServerEnv,
): Promise<StoredMemberProfile> {
  const existing = findInMemoryByOwnerKey(input.userId ?? null, input.member.id);
  const next = buildProfileFromUpsert(input, existing, randomUUID());
  memoryProfiles.set(next.id, next);
  return await persistProfileToDb(next, env);
}

/** Generates a 1-tap Telegram pairing link code for a family member and persists it. */
export async function createTelegramLinkCode(
  input: MemberProfileUpsertInput,
  env: ServerEnv,
): Promise<{ readonly profile: StoredMemberProfile; readonly linkCode: string }> {
  const base = await upsertMemberProfile(input, env);
  const safeKey =
    input.member.id
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .slice(0, KEY_PREFIX_MAX) || 'm1';
  const linkCode = `${safeKey}_${randomBytes(LINK_CODE_BYTES).toString('hex')}`;
  const updated: StoredMemberProfile = {
    ...base,
    telegramLinkCode: linkCode,
    updatedAt: new Date().toISOString(),
  };
  memoryProfiles.set(updated.id, updated);
  await persistProfileToDb(updated, env);
  return { profile: updated, linkCode };
}

async function findProfileByLinkCode(
  cleanCode: string,
  env: ServerEnv,
): Promise<StoredMemberProfile> {
  const mem = [...memoryProfiles.values()].find(
    (p) => p.telegramLinkCode?.toLowerCase() === cleanCode,
  );
  return (
    mem ??
    (await queryDbProfileByColumn('telegram_link_code', cleanCode, env)) ??
    buildFallbackProfileForMemberKey(cleanCode)
  );
}

/** Redeems a `/start <linkCode>` Telegram deep link and binds `telegramChatId` to that member. */
export async function redeemTelegramLinkCode(
  linkCode: string,
  telegramChatId: string,
  env: ServerEnv,
): Promise<StoredMemberProfile> {
  const cleanCode = linkCode.trim().toLowerCase();
  const matched =
    cleanCode.length > 0
      ? await findProfileByLinkCode(cleanCode, env)
      : buildFallbackProfileForMemberKey('m1');
  const linked: StoredMemberProfile = {
    ...matched,
    telegramChatId,
    telegramLinkCode: matched.telegramLinkCode ?? (cleanCode || null),
    telegramOptIn: true,
    updatedAt: new Date().toISOString(),
  };
  memoryProfiles.set(linked.id, linked);
  return await persistProfileToDb(linked, env, true);
}

/** Finds a linked family member profile by Telegram chat ID. */
export async function findMemberByTelegramChatId(
  telegramChatId: string,
  env: ServerEnv,
): Promise<StoredMemberProfile | null> {
  const mem = [...memoryProfiles.values()].find((p) => p.telegramChatId === telegramChatId);
  return mem ?? (await queryDbProfileByColumn('telegram_chat_id', telegramChatId, env));
}

/** Lists all Telegram-linked family members opted into automated daily morning briefs. */
export async function listTelegramOptedInMembers(
  env: ServerEnv,
): Promise<readonly StoredMemberProfile[]> {
  const db = createAdminSupabaseClient(env);
  if (db) {
    try {
      const res = await db
        .from(PROFILES_TABLE)
        .select('*')
        .eq('telegram_opt_in', true)
        .not('telegram_chat_id', 'is', null);
      if (Array.isArray(res.data)) {
        return (res.data as DbMemberRow[]).map(toStoredMemberProfile);
      }
    } catch {
      // Fall back to in-memory profiles.
    }
  }
  return [...memoryProfiles.values()].filter((p) => p.telegramOptIn && p.telegramChatId !== null);
}

/** Merges extracted daily habit or schedule changes onto a stored member profile. */
export async function updateMemberHabitsByProfileId(
  profileId: string,
  patch: ProfileHabitPatch,
  env: ServerEnv,
): Promise<StoredMemberProfile | null> {
  const existing = memoryProfiles.get(profileId);
  if (!existing) {
    return null;
  }
  const updated = applyHabitPatchToProfile(existing, patch);
  memoryProfiles.set(profileId, updated);
  return await persistProfileToDb(updated, env);
}

export async function recordCompanionCheckin(
  entry: CheckinLogInput,
  env: ServerEnv,
): Promise<void> {
  memoryCheckins.push(entry);
  if (memoryCheckins.length > MAX_IN_MEMORY_CHECKINS) {
    memoryCheckins.shift();
  }
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return;
  }
  try {
    await db.from(CHECKINS_TABLE).insert(toDbCheckinPayload(entry));
  } catch {
    // Ignore DB persistence hiccups so live replies never fail.
  }
}

export async function markDailyBriefSent(profileId: string, env: ServerEnv): Promise<void> {
  const existing = memoryProfiles.get(profileId);
  if (existing) {
    await persistProfileToDb({ ...existing, lastBriefSentAt: new Date().toISOString() }, env);
  }
}

export function clearCompanionStore(): void {
  memoryProfiles.clear();
  memoryCheckins.length = 0;
  clearHouseholdWorkspaceStore();
}
