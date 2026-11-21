import { randomBytes, randomUUID } from 'node:crypto';
import type { ServerEnv } from '../env.js';
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
const MAX_IN_MEMORY_CHECKINS = 200;
const PROFILES_TABLE = 'family_member_profiles';
const CHECKINS_TABLE = 'companion_checkins';

const memoryProfiles = new Map<string, StoredMemberProfile>();
const memoryCheckins: CheckinLogInput[] = [];

function findInMemoryByOwnerKey(
  userId: string | null,
  memberKey: string,
): StoredMemberProfile | undefined {
  for (const profile of memoryProfiles.values()) {
    if (profile.userId === userId && profile.memberKey === memberKey) {
      return profile;
    }
  }
  return undefined;
}

/** Upserts a family member profile in Supabase (when configured) or the in-memory fallback store. */
export async function upsertMemberProfile(
  input: MemberProfileUpsertInput,
  env: ServerEnv,
): Promise<StoredMemberProfile> {
  const existing = findInMemoryByOwnerKey(input.userId ?? null, input.member.id);
  const next = buildProfileFromUpsert(input, existing, randomUUID());
  memoryProfiles.set(next.id, next);

  const db = createAdminSupabaseClient(env);
  if (!db) {
    return next;
  }
  try {
    const res = await db
      .from(PROFILES_TABLE)
      .upsert(toDbMemberPayload(next), { onConflict: 'id' })
      .select()
      .maybeSingle();
    const row = res.data as DbMemberRow | null;
    if (row) {
      const synced = toStoredMemberProfile(row);
      memoryProfiles.set(synced.id, synced);
      return synced;
    }
  } catch {
    // Fall back silently to memory store when migration is pending.
  }
  return next;
}

/** Generates a 1-tap Telegram pairing link code for a family member and persists it. */
export async function createTelegramLinkCode(
  input: MemberProfileUpsertInput,
  env: ServerEnv,
): Promise<{ readonly profile: StoredMemberProfile; readonly linkCode: string }> {
  const base = await upsertMemberProfile(input, env);
  const linkCode = randomBytes(LINK_CODE_BYTES).toString('hex');
  const updated: StoredMemberProfile = {
    ...base,
    telegramLinkCode: linkCode,
    updatedAt: new Date().toISOString(),
  };
  memoryProfiles.set(updated.id, updated);

  const db = createAdminSupabaseClient(env);
  if (db) {
    try {
      await db
        .from(PROFILES_TABLE)
        .update({ telegram_link_code: linkCode, updated_at: updated.updatedAt })
        .eq('id', updated.id);
    } catch {
      // Keep memory code active even if Supabase is temporarily unreachable.
    }
  }
  return { profile: updated, linkCode };
}

async function findProfileByLinkCode(
  cleanCode: string,
  env: ServerEnv,
): Promise<StoredMemberProfile | null> {
  for (const profile of memoryProfiles.values()) {
    if (profile.telegramLinkCode?.toLowerCase() === cleanCode) {
      return profile;
    }
  }
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return null;
  }
  try {
    const res = await db
      .from(PROFILES_TABLE)
      .select('*')
      .eq('telegram_link_code', cleanCode)
      .maybeSingle();
    const row = res.data as DbMemberRow | null;
    return row ? toStoredMemberProfile(row) : null;
  } catch {
    return null;
  }
}

/** Redeems a `/start <linkCode>` Telegram deep link and binds `telegramChatId` to that member. */
export async function redeemTelegramLinkCode(
  linkCode: string,
  telegramChatId: string,
  env: ServerEnv,
): Promise<StoredMemberProfile | null> {
  const cleanCode = linkCode.trim().toLowerCase();
  const matched = cleanCode.length > 0 ? await findProfileByLinkCode(cleanCode, env) : null;
  if (!matched) {
    return null;
  }
  const linked: StoredMemberProfile = {
    ...matched,
    telegramChatId,
    telegramLinkCode: null,
    telegramOptIn: true,
    updatedAt: new Date().toISOString(),
  };
  memoryProfiles.set(linked.id, linked);
  const db = createAdminSupabaseClient(env);
  if (db) {
    try {
      await db.from(PROFILES_TABLE).update(toDbMemberPayload(linked)).eq('id', linked.id);
    } catch {
      // Memory binding already succeeded.
    }
  }
  return linked;
}

/** Finds a linked family member profile by Telegram chat ID. */
export async function findMemberByTelegramChatId(
  telegramChatId: string,
  env: ServerEnv,
): Promise<StoredMemberProfile | null> {
  for (const profile of memoryProfiles.values()) {
    if (profile.telegramChatId === telegramChatId) {
      return profile;
    }
  }
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return null;
  }
  try {
    const res = await db
      .from(PROFILES_TABLE)
      .select('*')
      .eq('telegram_chat_id', telegramChatId)
      .maybeSingle();
    const row = res.data as DbMemberRow | null;
    if (row) {
      const loaded = toStoredMemberProfile(row);
      memoryProfiles.set(loaded.id, loaded);
      return loaded;
    }
  } catch {
    return null;
  }
  return null;
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
  const db = createAdminSupabaseClient(env);
  if (db) {
    try {
      await db.from(PROFILES_TABLE).update(toDbMemberPayload(updated)).eq('id', profileId);
    } catch {
      // Retain in-memory update.
    }
  }
  return updated;
}

/** Records an inbound or outbound companion check-in message for history and auditing. */
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

/** Marks the timestamp when a member last received an automated daily Telegram brief. */
export async function markDailyBriefSent(profileId: string, env: ServerEnv): Promise<void> {
  const nowIso = new Date().toISOString();
  const existing = memoryProfiles.get(profileId);
  if (existing) {
    memoryProfiles.set(profileId, { ...existing, lastBriefSentAt: nowIso });
  }
  const db = createAdminSupabaseClient(env);
  if (db) {
    try {
      await db.from(PROFILES_TABLE).update({ last_brief_sent_at: nowIso }).eq('id', profileId);
    } catch {
      // Ignore DB update hiccup.
    }
  }
}

/** Clears the in-memory companion store for isolated automated tests. */
export function clearCompanionStore(): void {
  memoryProfiles.clear();
  memoryCheckins.length = 0;
}
