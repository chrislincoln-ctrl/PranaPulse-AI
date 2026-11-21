import { GoogleGenAI } from '@google/genai';
import { SECURITY_LIMITS, VALIDATION_BOUNDS } from '../../src/config/constants.js';
import { FAMILY_RISK_WEIGHTS } from '../../src/config/physicsConstants.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { computePlanPhysics } from '../../src/domain/localBaseline.js';
import {
  buildPerMemberSchedules,
  resolveMemberArchetype,
} from '../../src/domain/memberScheduleBuilder.js';
import type {
  CommuteOptionEvaluation,
  FamilyMemberInput,
  MemberDailySchedule,
} from '../../src/domain/types.js';
import type { PlanRequestPayload, SupportedLanguage } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { withTimeout } from './cacheAndLimiter.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { extractHabitUpdates, extractLocationMention, hasHabitPatch } from './habitExtractor.js';
import { reverseGeocodeCoords } from './reverseGeocoder.js';
import {
  getUrbanTelemetryBundle,
  searchUrbanLocations,
  type TelemetryBundle,
} from './telemetryClients.js';

export interface CompanionCheckinInput {
  readonly member: FamilyMemberInput;
  readonly message: string;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly gpsLat?: number | undefined;
  readonly gpsLon?: number | undefined;
  readonly language: SupportedLanguage;
  readonly areaM2?: number | undefined;
  readonly cadrM3Hr?: number | undefined;
  readonly channel: 'web' | 'telegram';
}

export interface CompanionCheckinResult {
  readonly reply: string;
  readonly resolvedCity: string;
  readonly resolvedLat: number;
  readonly resolvedLon: number;
  readonly aqi: number;
  readonly cpcbCategory: string;
  readonly pm25UgM3: number;
  readonly pblMeters: number;
  readonly windKmh: number;
  readonly rhPercent: number;
  readonly openWindowsNow: boolean;
  readonly habitPatch: ProfileHabitPatch;
  readonly updatedSchedule: MemberDailySchedule;
  readonly aiEnhanced: boolean;
}

const HIGH_AQI = FAMILY_RISK_WEIGHTS.HIGH_RISK_CPCB_THRESHOLD;
const MODERATE_AQI = 120;

const ZERO_COMMUTE: CommuteOptionEvaluation = {
  mode: 'metro',
  mask: 'n95-ffp2',
  durationMinutes: 0,
  personalInhaledUg: 0,
  cigaretteEquiv: 0,
  communityCo2Grams: 0,
  communityPm25Mg: 0,
  isParetoOptimal: true,
  paradoxWarning: false,
};

function mergeMemberWithPatch(
  member: FamilyMemberInput,
  patch: ProfileHabitPatch,
): FamilyMemberInput {
  return { ...member, ...patch };
}

async function resolveCheckinLocation(
  input: CompanionCheckinInput,
): Promise<{ readonly city: string; readonly lat: number; readonly lon: number }> {
  if (typeof input.gpsLat === 'number' && typeof input.gpsLon === 'number') {
    const rev = await reverseGeocodeCoords(input.gpsLat, input.gpsLon);
    return { city: rev ?? `${input.city} (GPS)`, lat: input.gpsLat, lon: input.gpsLon };
  }
  const mentioned = extractLocationMention(input.message);
  if (mentioned) {
    const [top] = await searchUrbanLocations(mentioned);
    if (top) {
      return { city: top.name, lat: top.lat, lon: top.lon };
    }
  }
  return { city: input.city, lat: input.lat, lon: input.lon };
}

/** Builds a grounded single-member PlanRequestPayload and computes their schedule. */
export function buildMemberScheduleSnapshot(params: {
  readonly member: FamilyMemberInput;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly telemetry: TelemetryBundle;
  readonly areaM2?: number | undefined;
  readonly cadrM3Hr?: number | undefined;
}): MemberDailySchedule {
  const req: PlanRequestPayload = {
    ...DEFAULT_WORKSPACE_INPUT,
    city: params.city,
    lat: params.lat,
    lon: params.lon,
    language: params.language,
    areaM2: params.areaM2 ?? DEFAULT_WORKSPACE_INPUT.areaM2,
    cadrM3Hr: params.cadrM3Hr ?? DEFAULT_WORKSPACE_INPUT.cadrM3Hr,
    commuteMode: params.member.commuteMode ?? DEFAULT_WORKSPACE_INPUT.commuteMode,
    mask: params.member.mask,
    members: [params.member],
  };
  const physics = computePlanPhysics(req, params.telemetry);
  const [schedule] = buildPerMemberSchedules({
    request: req,
    aqi: params.telemetry.assessment,
    effectiveAqi: physics.effectiveAqi,
    inversion: params.telemetry.inversion,
    indoor: physics.indoor,
    bestCommute: physics.commuteOptions[0] ?? ZERO_COMMUTE,
    corridor: physics.corridor,
    rwa: physics.rwa,
  });
  return (
    schedule ?? {
      memberId: params.member.id,
      memberLabel: params.member.label,
      archetype: resolveMemberArchetype(params.member),
      summaryHeadline: `${params.member.label} | ${params.city}`,
      dailyRoutine: [],
      shareBriefText: `${params.member.label} | ${params.city}`,
    }
  );
}

function buildRoleGuidance(member: FamilyMemberInput, effectiveAqi: number): string {
  const archetype = resolveMemberArchetype(member);
  const isHigh = effectiveAqi >= HIGH_AQI;
  if (archetype === 'senior-homebound' || member.role === 'senior-respiratory') {
    return isHigh
      ? 'Senior respiratory alert: stay indoors with HEPA running, keep reliever inhaler close, and avoid outdoor walks.'
      : 'Keep any outing brief during midday solar breakup and wear a fitted N95 if air feels hazy.';
  }
  if (archetype === 'school-student' || member.role === 'child') {
    return isHigh
      ? 'Keep recess/sports indoors and wear a fitted N95/FFP2 on the school commute.'
      : 'Wear your mask during transit and wash hands/face upon returning home.';
  }
  return effectiveAqi >= MODERATE_AQI
    ? 'Wear a fitted N95/FFP2 outdoors, prefer metro/closed transit, and avoid idling traffic junctions.'
    : 'Conditions are moderate right now; normal masked travel is safe.';
}

function buildDeterministicReply(
  member: FamilyMemberInput,
  city: string,
  telemetry: TelemetryBundle,
  habitPatch: ProfileHabitPatch,
): string {
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const cur = telemetry.hourlySeries[0];
  const win = telemetry.inversion.openWindowsNow
    ? 'Mixing is favorable right now for a short 20-min cross-ventilation.'
    : 'Keep windows sealed until the afternoon solar breakup lifts the inversion.';
  const updated = hasHabitPatch(habitPatch)
    ? ` Updated ${member.label}'s daily schedule with your latest routine details.`
    : '';
  return (
    `${member.label} (${city}): Live CPCB NAQI ${String(aqi)} (${telemetry.assessment.cpcbCategory}), ` +
    `PM2.5 ${String(Math.round(telemetry.currentPollutants.pm25UgM3))} ug/m3, PBL ${String(telemetry.inversion.currentPblMeters)}m, ` +
    `wind ${String(Math.round(cur?.windKmh ?? 0))} km/h, humidity ${String(Math.round(cur?.rhPercent ?? 0))}%. ` +
    `${buildRoleGuidance(member, aqi)} ${win}${updated}`
  );
}

async function tryGeminiCompanionReply(
  baseReply: string,
  input: CompanionCheckinInput,
  city: string,
  env: ServerEnv,
): Promise<string | null> {
  if (!env.GEMINI_API_KEY) {
    return null;
  }
  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const prompt = [
      `Member: ${input.member.label} (${resolveMemberArchetype(input.member)}, mask=${input.member.mask})`,
      `Health: ${input.member.healthNotes ?? 'none'}; Habits: ${input.member.dailyHabitsNote ?? 'none'}`,
      `Verified telemetry (${city}): ${baseReply}`,
      `Message: "${input.message}"`,
      `Reply concisely (<90 words) in "${input.language}" using ONLY these verified numbers.`,
    ].join('\n');
    const response = await withTimeout(
      ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: prompt,
        config: { temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE },
      }),
      SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
    );
    const text = response.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Shared channel-agnostic Family Companion Brain powering in-app chat and Telegram. */
export async function handleCompanionCheckin(
  input: CompanionCheckinInput,
  env: ServerEnv,
): Promise<CompanionCheckinResult> {
  const loc = await resolveCheckinLocation(input);
  const habitPatch = extractHabitUpdates(input.message);
  const mergedMember = mergeMemberWithPatch(input.member, habitPatch);
  const telemetry = await getUrbanTelemetryBundle({
    lat: loc.lat,
    lon: loc.lon,
    cityLabel: loc.city,
    env,
  });
  const updatedSchedule = buildMemberScheduleSnapshot({
    member: mergedMember,
    city: loc.city,
    lat: loc.lat,
    lon: loc.lon,
    language: input.language,
    telemetry,
    areaM2: input.areaM2,
    cadrM3Hr: input.cadrM3Hr,
  });
  const deterministic = buildDeterministicReply(mergedMember, loc.city, telemetry, habitPatch);
  const aiText = await tryGeminiCompanionReply(deterministic, input, loc.city, env);
  const cur = telemetry.hourlySeries[0];

  return {
    reply: aiText ?? deterministic,
    resolvedCity: loc.city,
    resolvedLat: loc.lat,
    resolvedLon: loc.lon,
    aqi: telemetry.stationCrossCheck.effectiveSafetyAqi,
    cpcbCategory: telemetry.assessment.cpcbCategory,
    pm25UgM3: Math.round(telemetry.currentPollutants.pm25UgM3),
    pblMeters: telemetry.inversion.currentPblMeters,
    windKmh: Math.round(cur?.windKmh ?? 0),
    rhPercent: Math.round(cur?.rhPercent ?? 0),
    openWindowsNow: telemetry.inversion.openWindowsNow,
    habitPatch,
    updatedSchedule,
    aiEnhanced: Boolean(aiText),
  };
}
