import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveMemberArchetype } from '../../src/domain/memberScheduleBuilder.js';
import type {
  CommuteModeId,
  FamilyMemberInput,
  FamilyRole,
  MaskTypeId,
  MemberRoutineArchetype,
} from '../../src/domain/types.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';

export const DEFAULT_BRIEF_TIME_LOCAL = '06:30';

export interface StoredMemberProfile {
  readonly id: string;
  readonly userId: string | null;
  readonly memberKey: string;
  readonly label: string;
  readonly role: FamilyRole;
  readonly mask: MaskTypeId;
  readonly dailyOutdoorHours: number;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly archetype: MemberRoutineArchetype;
  readonly leaveHomeTime: string | null;
  readonly returnHomeTime: string | null;
  readonly commuteMode: CommuteModeId | null;
  readonly healthNotes: string | null;
  readonly dailyHabitsNote: string | null;
  readonly telegramChatId: string | null;
  readonly telegramLinkCode: string | null;
  readonly telegramOptIn: boolean;
  readonly briefTimeLocal: string;
  readonly lastBriefSentAt: string | null;
  readonly updatedAt: string;
}

export interface MemberProfileUpsertInput {
  readonly member: FamilyMemberInput;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly userId?: string | undefined;
}

export interface ProfileHabitPatch {
  readonly leaveHomeTime?: string | undefined;
  readonly returnHomeTime?: string | undefined;
  readonly commuteMode?: CommuteModeId | undefined;
  readonly healthNotes?: string | undefined;
  readonly dailyHabitsNote?: string | undefined;
  readonly archetype?: MemberRoutineArchetype | undefined;
  readonly city?: string | undefined;
  readonly lat?: number | undefined;
  readonly lon?: number | undefined;
}

export interface CheckinLogInput {
  readonly memberProfileId: string;
  readonly channel: 'web' | 'telegram';
  readonly direction: 'inbound' | 'outbound';
  readonly messageText: string;
  readonly detectedCity?: string | undefined;
  readonly detectedLat?: number | undefined;
  readonly detectedLon?: number | undefined;
  readonly extractedHabitNote?: string | undefined;
  readonly aqiSnapshot?: number | undefined;
}

export interface DbMemberRow {
  readonly id: string;
  readonly user_id: string | null;
  readonly member_key: string;
  readonly label: string;
  readonly role: FamilyRole;
  readonly mask: MaskTypeId;
  readonly daily_outdoor_hours: number;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly archetype: MemberRoutineArchetype;
  readonly leave_home_time: string | null;
  readonly return_home_time: string | null;
  readonly commute_mode: CommuteModeId | null;
  readonly health_notes: string | null;
  readonly daily_habits_note: string | null;
  readonly telegram_chat_id: string | null;
  readonly telegram_link_code: string | null;
  readonly telegram_opt_in: boolean;
  readonly brief_time_local: string;
  readonly last_brief_sent_at: string | null;
  readonly updated_at: string;
}

/** Creates an isolated server-side Supabase client when service-role credentials are present. */
export function createAdminSupabaseClient(env: ServerEnv): SupabaseClient | null {
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Maps a Postgres `family_member_profiles` row into a domain `StoredMemberProfile`. */
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

/** Maps a `StoredMemberProfile` to a Postgres column dictionary for upsert/insert. */
export function toDbMemberPayload(profile: StoredMemberProfile): DbMemberRow {
  return {
    id: profile.id,
    user_id: profile.userId,
    member_key: profile.memberKey,
    label: profile.label,
    role: profile.role,
    mask: profile.mask,
    daily_outdoor_hours: profile.dailyOutdoorHours,
    city: profile.city,
    lat: profile.lat,
    lon: profile.lon,
    language: profile.language,
    archetype: profile.archetype,
    leave_home_time: profile.leaveHomeTime,
    return_home_time: profile.returnHomeTime,
    commute_mode: profile.commuteMode,
    health_notes: profile.healthNotes,
    daily_habits_note: profile.dailyHabitsNote,
    telegram_chat_id: profile.telegramChatId,
    telegram_link_code: profile.telegramLinkCode,
    telegram_opt_in: profile.telegramOptIn,
    brief_time_local: profile.briefTimeLocal,
    last_brief_sent_at: profile.lastBriefSentAt,
    updated_at: profile.updatedAt,
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

function pickStr(a: string | undefined, b: string | null | undefined): string | null {
  return a ?? b ?? null;
}

function buildHabitFields(m: FamilyMemberInput, existing: StoredMemberProfile | undefined) {
  return {
    archetype: resolveMemberArchetype(m),
    leaveHomeTime: pickStr(m.leaveHomeTime, existing?.leaveHomeTime),
    returnHomeTime: pickStr(m.returnHomeTime, existing?.returnHomeTime),
    commuteMode: m.commuteMode ?? existing?.commuteMode ?? null,
    healthNotes: pickStr(m.healthNotes, existing?.healthNotes),
    dailyHabitsNote: pickStr(m.dailyHabitsNote, existing?.dailyHabitsNote),
  };
}

function buildTelegramFields(m: FamilyMemberInput, existing: StoredMemberProfile | undefined) {
  const optIn = m.telegramDailyBrief ?? (existing ? existing.telegramOptIn : true);
  const briefTime =
    m.briefTimeLocal ?? (existing ? existing.briefTimeLocal : DEFAULT_BRIEF_TIME_LOCAL);
  return {
    telegramChatId: existing ? existing.telegramChatId : null,
    telegramLinkCode: existing ? existing.telegramLinkCode : null,
    telegramOptIn: optIn,
    briefTimeLocal: briefTime,
    lastBriefSentAt: existing ? existing.lastBriefSentAt : null,
  };
}

/** Constructs an updated in-memory profile record from an upsert request. */
export function buildProfileFromUpsert(
  input: MemberProfileUpsertInput,
  existing: StoredMemberProfile | undefined,
  newId: string,
): StoredMemberProfile {
  const m = input.member;
  return {
    id: existing?.id ?? newId,
    userId: pickStr(input.userId, existing?.userId),
    memberKey: m.id,
    label: m.label,
    role: m.role,
    mask: m.mask,
    dailyOutdoorHours: m.dailyOutdoorHours,
    city: input.city,
    lat: input.lat,
    lon: input.lon,
    language: input.language,
    ...buildHabitFields(m, existing),
    ...buildTelegramFields(m, existing),
    updatedAt: new Date().toISOString(),
  };
}

/** Merges partial habit updates cleanly onto an existing stored profile. */
export function applyHabitPatchToProfile(
  profile: StoredMemberProfile,
  patch: ProfileHabitPatch,
): StoredMemberProfile {
  const next: Record<string, unknown> = { ...profile, updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next as unknown as StoredMemberProfile;
}

/** Maps a check-in record into a Postgres insert payload. */
export function toDbCheckinPayload(entry: CheckinLogInput): Record<string, unknown> {
  return {
    member_profile_id: entry.memberProfileId,
    channel: entry.channel,
    direction: entry.direction,
    message_text: entry.messageText,
    detected_city: entry.detectedCity ?? null,
    detected_lat: entry.detectedLat ?? null,
    detected_lon: entry.detectedLon ?? null,
    extracted_habit_note: entry.extractedHabitNote ?? null,
    aqi_snapshot: entry.aqiSnapshot ?? null,
  };
}
