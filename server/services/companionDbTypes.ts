import type {
  CommuteModeId,
  FamilyMemberInput,
  FamilyRole,
  MaskTypeId,
  MemberRoutineArchetype,
} from '../../src/domain/types.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';

/** Persisted member profile record mirrored across Supabase Postgres and in-memory fallback. */
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

/** Input bundle accepted when creating or updating a member companion profile. */
export interface MemberProfileUpsertInput {
  readonly member: FamilyMemberInput;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly userId?: string | undefined;
}

/** Partial routine, health, and city overrides parsed from chat or Telegram messages. */
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

/** Inbound or outbound companion check-in log entry persisted for history. */
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

/** Raw snake_case Supabase table schema for `family_member_profiles`. */
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
