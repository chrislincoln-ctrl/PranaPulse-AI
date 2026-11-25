import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveMemberArchetype } from '../../src/domain/memberScheduleBuilder.js';
import type { FamilyMemberInput } from '../../src/domain/types.js';
import type { ServerEnv } from '../env.js';
import type {
  CheckinLogInput,
  DbMemberRow,
  MemberProfileUpsertInput,
  ProfileHabitPatch,
  StoredMemberProfile,
} from './companionDbTypes.js';

export type {
  CheckinLogInput,
  DbMemberRow,
  MemberProfileUpsertInput,
  ProfileHabitPatch,
  StoredMemberProfile,
};

export const DEFAULT_BRIEF_TIME_LOCAL = '06:30';

export function createAdminSupabaseClient(env: ServerEnv): SupabaseClient | null {
  return env.VITE_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}

export function toStoredMemberProfile(row: DbMemberRow): StoredMemberProfile {
  return {
    id: row.id,
    userId: row.user_id,
    memberKey: row.member_key,
    label: row.label,
    role: row.role,
    mask: row.mask,
    dailyOutdoorHours: row.daily_outdoor_hours,
    city: row.city,
    lat: row.lat,
    lon: row.lon,
    language: row.language,
    archetype: row.archetype,
    leaveHomeTime: row.leave_home_time,
    returnHomeTime: row.return_home_time,
    commuteMode: row.commute_mode,
    healthNotes: row.health_notes,
    dailyHabitsNote: row.daily_habits_note,
    telegramChatId: row.telegram_chat_id,
    telegramLinkCode: row.telegram_link_code,
    telegramOptIn: row.telegram_opt_in,
    briefTimeLocal: row.brief_time_local || DEFAULT_BRIEF_TIME_LOCAL,
    lastBriefSentAt: row.last_brief_sent_at,
    updatedAt: row.updated_at,
  };
}

export function toDbMemberPayload(p: StoredMemberProfile): DbMemberRow {
  return {
    id: p.id,
    user_id: p.userId,
    member_key: p.memberKey,
    label: p.label,
    role: p.role,
    mask: p.mask,
    daily_outdoor_hours: p.dailyOutdoorHours,
    city: p.city,
    lat: p.lat,
    lon: p.lon,
    language: p.language,
    archetype: p.archetype,
    leave_home_time: p.leaveHomeTime,
    return_home_time: p.returnHomeTime,
    commute_mode: p.commuteMode,
    health_notes: p.healthNotes,
    daily_habits_note: p.dailyHabitsNote,
    telegram_chat_id: p.telegramChatId,
    telegram_link_code: p.telegramLinkCode,
    telegram_opt_in: p.telegramOptIn,
    brief_time_local: p.briefTimeLocal,
    last_brief_sent_at: p.lastBriefSentAt,
    updated_at: p.updatedAt,
  };
}

/** Converts a stored member profile back into a `FamilyMemberInput` for physics & scheduling. */
export function storedProfileToFamilyMember(p: StoredMemberProfile): FamilyMemberInput {
  return {
    id: p.memberKey,
    label: p.label,
    role: p.role,
    mask: p.mask,
    dailyOutdoorHours: p.dailyOutdoorHours,
    archetype: p.archetype,
    ...(p.leaveHomeTime ? { leaveHomeTime: p.leaveHomeTime } : {}),
    ...(p.returnHomeTime ? { returnHomeTime: p.returnHomeTime } : {}),
    ...(p.commuteMode ? { commuteMode: p.commuteMode } : {}),
    ...(p.healthNotes ? { healthNotes: p.healthNotes } : {}),
    ...(p.dailyHabitsNote ? { dailyHabitsNote: p.dailyHabitsNote } : {}),
    telegramDailyBrief: p.telegramOptIn,
    briefTimeLocal: p.briefTimeLocal,
  };
}

const pickStr = (a?: string, b?: string | null): string | null => a ?? b ?? null;

function buildHabitFields(m: FamilyMemberInput, ex: StoredMemberProfile | undefined) {
  return {
    archetype: resolveMemberArchetype(m),
    leaveHomeTime: pickStr(m.leaveHomeTime, ex?.leaveHomeTime),
    returnHomeTime: pickStr(m.returnHomeTime, ex?.returnHomeTime),
    commuteMode: m.commuteMode ?? ex?.commuteMode ?? null,
    healthNotes: pickStr(m.healthNotes, ex?.healthNotes),
    dailyHabitsNote: pickStr(m.dailyHabitsNote, ex?.dailyHabitsNote),
  };
}

const DEFAULT_TG_FIELDS = {
  telegramChatId: null,
  telegramLinkCode: null,
  telegramOptIn: true,
  briefTimeLocal: DEFAULT_BRIEF_TIME_LOCAL,
  lastBriefSentAt: null,
} as const;

function buildTelegramFields(m: FamilyMemberInput, existing: StoredMemberProfile | undefined) {
  const base = existing ?? DEFAULT_TG_FIELDS;
  return {
    telegramChatId: base.telegramChatId,
    telegramLinkCode: base.telegramLinkCode,
    telegramOptIn: m.telegramDailyBrief ?? base.telegramOptIn,
    briefTimeLocal: m.briefTimeLocal ?? base.briefTimeLocal,
    lastBriefSentAt: base.lastBriefSentAt,
  };
}

export function buildProfileFromUpsert(
  input: MemberProfileUpsertInput,
  existing: StoredMemberProfile | undefined,
  newId: string,
): StoredMemberProfile {
  const { member: m, city, lat, lon, language } = input;
  return {
    id: existing?.id ?? newId,
    userId: input.userId ?? existing?.userId ?? null,
    memberKey: m.id,
    label: m.label,
    role: m.role,
    mask: m.mask,
    dailyOutdoorHours: m.dailyOutdoorHours,
    city,
    lat,
    lon,
    language,
    ...buildHabitFields(m, existing),
    ...buildTelegramFields(m, existing),
    updatedAt: new Date().toISOString(),
  };
}

function pickHabitCore(p: StoredMemberProfile, patch: ProfileHabitPatch) {
  return {
    label: patch.label ?? p.label,
    role: patch.role ?? p.role,
    dailyOutdoorHours: patch.dailyOutdoorHours ?? p.dailyOutdoorHours,
    leaveHomeTime: patch.leaveHomeTime ?? p.leaveHomeTime,
    returnHomeTime: patch.returnHomeTime ?? p.returnHomeTime,
    commuteMode: patch.commuteMode ?? p.commuteMode,
    mask: patch.mask ?? p.mask,
  };
}

function pickHabitMeta(p: StoredMemberProfile, patch: ProfileHabitPatch) {
  return {
    healthNotes: patch.healthNotes ?? p.healthNotes,
    dailyHabitsNote: patch.dailyHabitsNote ?? p.dailyHabitsNote,
    archetype: patch.archetype ?? p.archetype,
    city: patch.city ?? p.city,
    lat: patch.lat ?? p.lat,
    lon: patch.lon ?? p.lon,
  };
}

/** Merges defined habit and location patch fields onto an existing stored member profile. */
export function applyHabitPatchToProfile(
  profile: StoredMemberProfile,
  patch: ProfileHabitPatch,
): StoredMemberProfile {
  return {
    ...profile,
    ...pickHabitCore(profile, patch),
    ...pickHabitMeta(profile, patch),
    updatedAt: new Date().toISOString(),
  };
}

export function toDbCheckinPayload(e: CheckinLogInput): Record<string, unknown> {
  return {
    member_profile_id: e.memberProfileId,
    channel: e.channel,
    direction: e.direction,
    message_text: e.messageText,
    detected_city: e.detectedCity ?? null,
    detected_lat: e.detectedLat ?? null,
    detected_lon: e.detectedLon ?? null,
    extracted_habit_note: e.extractedHabitNote ?? null,
    aqi_snapshot: e.aqiSnapshot ?? null,
  };
}
