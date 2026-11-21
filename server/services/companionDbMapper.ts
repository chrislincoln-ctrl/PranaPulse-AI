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
  readonly label?: string | undefined;
  readonly role?: FamilyRole | undefined;
  readonly dailyOutdoorHours?: number | undefined;
  readonly leaveHomeTime?: string | undefined;
  readonly returnHomeTime?: string | undefined;
  readonly commuteMode?: CommuteModeId | undefined;
  readonly mask?: MaskTypeId | undefined;
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
