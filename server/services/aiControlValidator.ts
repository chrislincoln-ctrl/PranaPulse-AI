import { Type, type Schema } from '@google/genai';
import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type {
  BuildingTightness,
  CommuteModeId,
  CookingFuelType,
  FamilyRole,
  MaskTypeId,
  MemberRoutineArchetype,
} from '../../src/domain/types.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { PlanRequestPayload, SupportedLanguage } from '../../src/validators/schemas.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { normalizeClockTime } from './habitExtractor.js';
import type { SyncedWorkspaceRecord } from './householdWorkspaceStore.js';

export interface AiParsedSiteControls {
  readonly switchToMemberId?: string | undefined;
  readonly addMemberName?: string | undefined;
  readonly removeMemberId?: string | undefined;
  readonly memberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly cityQuery?: string | undefined;
}

const HALF_HOUR_STEP = 2;
const MAX_LABEL_LEN = 40;
const MAX_NOTE_LEN = 140;
const MERIDIEM_GROUP_IDX = 3;
const FLEX_CLOCK_RE = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;

const ROLES = new Set<FamilyRole>(['child', 'senior-respiratory', 'commuter', 'caregiver']);
const ARCHETYPES = new Set<MemberRoutineArchetype>([
  'school-student',
  'office-commuter',
  'senior-homebound',
  'outdoor-active',
  'home-caregiver',
]);
const MASKS = new Set<MaskTypeId>(['none', 'cloth', 'surgical', 'n95-ffp2']);
const MODES = new Set<CommuteModeId>([
  'metro',
  'electric-bus',
  'ev-car',
  'petrol-car',
  'two-wheeler',
  'cycling',
  'walking',
]);
const TIGHTNESS = new Set<BuildingTightness>(['leaky', 'standard', 'weather-sealed']);
const FUELS = new Set<CookingFuelType>([
  'induction',
  'lpg-vented',
  'lpg-unvented',
  'solid-biomass',
]);
const LANGS = new Set<SupportedLanguage>(['en', 'hi', 'ta']);

export const AI_CONTROL_GEMINI_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    switchToMemberId: { type: Type.STRING, nullable: true },
    addMemberName: { type: Type.STRING, nullable: true },
    removeMemberId: { type: Type.STRING, nullable: true },
    cityQuery: { type: Type.STRING, nullable: true },
    label: { type: Type.STRING, nullable: true },
    role: { type: Type.STRING, nullable: true },
    archetype: { type: Type.STRING, nullable: true },
    mask: { type: Type.STRING, nullable: true },
    dailyOutdoorHours: { type: Type.NUMBER, nullable: true },
    leaveHomeTime: { type: Type.STRING, nullable: true },
    returnHomeTime: { type: Type.STRING, nullable: true },
    commuteMode: { type: Type.STRING, nullable: true },
    healthNotes: { type: Type.STRING, nullable: true },
    areaM2: { type: Type.NUMBER, nullable: true },
    cadrM3Hr: { type: Type.NUMBER, nullable: true },
    tightness: { type: Type.STRING, nullable: true },
    cookingFuel: { type: Type.STRING, nullable: true },
    commuteDistanceKm: { type: Type.NUMBER, nullable: true },
    householdsParticipating: { type: Type.NUMBER, nullable: true },
    transitShiftShare: { type: Type.NUMBER, nullable: true },
    haltLeafBurning: { type: Type.BOOLEAN, nullable: true },
    language: { type: Type.STRING, nullable: true },
  },
};

function pickEnum<T extends string>(val: unknown, allowed: ReadonlySet<T>): T | undefined {
  if (typeof val !== 'string') {
    return undefined;
  }
  const clean = val.trim().toLowerCase() as T;
  return allowed.has(clean) ? clean : undefined;
}

function pickInt(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return undefined;
  }
  return Math.max(min, Math.min(max, Math.round(val)));
}

function pickOutdoorHours(val: unknown): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    return undefined;
  }
  const snapped = Math.round(val * HALF_HOUR_STEP) / HALF_HOUR_STEP;
  return Math.max(0, Math.min(VALIDATION_BOUNDS.MAX_DAILY_HOURS, snapped));
}

function pickClockTime(val: unknown): string | undefined {
  if (typeof val !== 'string') {
    return undefined;
  }
  const m = FLEX_CLOCK_RE.exec(val.trim());
  return m ? normalizeClockTime(m[1], m[2], m[MERIDIEM_GROUP_IDX]) : undefined;
}

function pickTransitShare(val: unknown): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    return undefined;
  }
  const normalized = val > 1 ? Math.min(100, val) / 100 : val;
  return Math.round(normalized * 100) / 100;
}

function pickSafeText(val: unknown, maxLen: number): string | undefined {
  if (typeof val !== 'string') {
    return undefined;
  }
  const clean = sanitizeUserText(val, maxLen);
  return clean.length > 0 ? clean : undefined;
}

function extractSafeIdentityPatch(raw: Record<string, unknown>): ProfileHabitPatch {
  const label = pickSafeText(raw.label, MAX_LABEL_LEN);
  const role = pickEnum(raw.role, ROLES);
  const archetype = pickEnum(raw.archetype, ARCHETYPES);
  const dailyOutdoorHours = pickOutdoorHours(raw.dailyOutdoorHours);
  return {
    ...(label ? { label } : {}),
    ...(role ? { role } : {}),
    ...(archetype ? { archetype } : {}),
    ...(dailyOutdoorHours !== undefined ? { dailyOutdoorHours } : {}),
  };
}

function extractSafeSchedulePatch(raw: Record<string, unknown>): ProfileHabitPatch {
  const mask = pickEnum(raw.mask, MASKS);
  const leaveHomeTime = pickClockTime(raw.leaveHomeTime);
  const returnHomeTime = pickClockTime(raw.returnHomeTime);
  const commuteMode = pickEnum(raw.commuteMode, MODES);
  const healthNotes = pickSafeText(raw.healthNotes, MAX_NOTE_LEN);
  return {
    ...(mask ? { mask } : {}),
    ...(leaveHomeTime ? { leaveHomeTime } : {}),
    ...(returnHomeTime ? { returnHomeTime } : {}),
    ...(commuteMode ? { commuteMode } : {}),
    ...(healthNotes ? { healthNotes } : {}),
  };
}

function extractSafeMemberPatch(raw: Record<string, unknown>): ProfileHabitPatch {
  return { ...extractSafeIdentityPatch(raw), ...extractSafeSchedulePatch(raw) };
}

function extractSafeIndoorHousehold(raw: Record<string, unknown>): Partial<PlanRequestPayload> {
  const areaM2 = pickInt(
    raw.areaM2,
    VALIDATION_BOUNDS.MIN_ROOM_AREA_M2,
    VALIDATION_BOUNDS.MAX_ROOM_AREA_M2,
  );
  const cadrM3Hr = pickInt(raw.cadrM3Hr, 0, VALIDATION_BOUNDS.MAX_CADR_M3_HR);
  const tightness = pickEnum(raw.tightness, TIGHTNESS);
  const cookingFuel = pickEnum(raw.cookingFuel, FUELS);
  return {
    ...(areaM2 !== undefined ? { areaM2 } : {}),
    ...(cadrM3Hr !== undefined ? { cadrM3Hr } : {}),
    ...(tightness ? { tightness } : {}),
    ...(cookingFuel ? { cookingFuel } : {}),
  };
}

function extractSafeCommunityHousehold(raw: Record<string, unknown>): Partial<PlanRequestPayload> {
  const commuteDistanceKm = pickInt(raw.commuteDistanceKm, 1, VALIDATION_BOUNDS.MAX_COMMUTE_KM);
  const householdsParticipating = pickInt(
    raw.householdsParticipating,
    VALIDATION_BOUNDS.MIN_HOUSEHOLDS,
    VALIDATION_BOUNDS.MAX_HOUSEHOLDS,
  );
  const transitShiftShare = pickTransitShare(raw.transitShiftShare);
  const haltLeafBurning =
    typeof raw.haltLeafBurning === 'boolean' ? raw.haltLeafBurning : undefined;
  const language = pickEnum(raw.language, LANGS);
  return {
    ...(commuteDistanceKm !== undefined ? { commuteDistanceKm } : {}),
    ...(householdsParticipating !== undefined ? { householdsParticipating } : {}),
    ...(transitShiftShare !== undefined ? { transitShiftShare } : {}),
    ...(haltLeafBurning !== undefined ? { haltLeafBurning } : {}),
    ...(language ? { language } : {}),
  };
}

function pickRosterId(val: unknown, validIds: ReadonlySet<string>): string | undefined {
  const id = typeof val === 'string' ? val.trim() : '';
  return validIds.has(id) ? id : undefined;
}

/** Validates and clamps AI-extracted site control JSON into strict domain-safe patches. */
export function sanitizeAiControlPayload(
  raw: Record<string, unknown>,
  workspace: SyncedWorkspaceRecord,
): AiParsedSiteControls {
  const validIds = new Set(workspace.payload.members.map((m) => m.id));
  const switchToMemberId = pickRosterId(raw.switchToMemberId, validIds);
  const addMemberName = pickSafeText(raw.addMemberName, MAX_LABEL_LEN);
  const removeMemberId = pickRosterId(raw.removeMemberId, validIds);
  const cityQuery = pickSafeText(raw.cityQuery, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  const memberPatch = extractSafeMemberPatch(raw);
  const householdPatch: Partial<PlanRequestPayload> = {
    ...extractSafeIndoorHousehold(raw),
    ...extractSafeCommunityHousehold(raw),
  };
  return {
    ...(switchToMemberId ? { switchToMemberId } : {}),
    ...(addMemberName ? { addMemberName } : {}),
    ...(removeMemberId ? { removeMemberId } : {}),
    memberPatch,
    householdPatch,
    ...(cityQuery ? { cityQuery } : {}),
  };
}
