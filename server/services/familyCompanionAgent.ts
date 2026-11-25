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
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { generateCompanionReply } from './companionLlmClient.js';
import {
  enrichDerivedOutdoorHours,
  extractHabitUpdates,
  extractLocationMention,
} from './habitExtractor.js';
import { applyMemberHabitPatch } from './memberMatcher.js';
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
  return applyMemberHabitPatch(member, patch);
}

async function resolveMentionedPlace(
  mentioned: string,
  baseCity: string,
): Promise<{ readonly city: string; readonly lat: number; readonly lon: number } | null> {
  const parentCity = baseCity.split(',')[0]?.trim() ?? '';
  if (parentCity.length > 0 && !mentioned.toLowerCase().includes(parentCity.toLowerCase())) {
    const scopedMatches = await searchUrbanLocations(`${mentioned} ${parentCity}`);
    const scopedTop = scopedMatches[0];
    if (scopedTop) {
      return { city: scopedTop.name, lat: scopedTop.lat, lon: scopedTop.lon };
    }
  }
  const directMatches = await searchUrbanLocations(mentioned);
  const directTop = directMatches[0];
  return directTop ? { city: directTop.name, lat: directTop.lat, lon: directTop.lon } : null;
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
    const resolved = await resolveMentionedPlace(mentioned, input.city);
    if (resolved) {
      return resolved;
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

/** Shared channel-agnostic Family Companion Brain powering in-app chat and Telegram. */
export async function handleCompanionCheckin(
  input: CompanionCheckinInput,
  env: ServerEnv,
): Promise<CompanionCheckinResult> {
  const loc = await resolveCheckinLocation(input);
  const habitPatch = enrichDerivedOutdoorHours(extractHabitUpdates(input.message), input.member);
  const member = mergeMemberWithPatch(input.member, habitPatch);
  const telemetry = await getUrbanTelemetryBundle({
    lat: loc.lat,
    lon: loc.lon,
    cityLabel: loc.city,
    env,
  });
  const updatedSchedule = buildMemberScheduleSnapshot({ ...input, ...loc, member, telemetry });
  const { reply, aiEnhanced } = await generateCompanionReply(
    {
      member,
      message: input.message,
      language: input.language,
      city: loc.city,
      telemetry,
      habitPatch,
      updatedSchedule,
    },
    env,
  );
  const cur = telemetry.hourlySeries[0];
  return {
    reply,
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
    aiEnhanced,
  };
}
