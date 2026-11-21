/**
 * Deterministic client/server shared physics snapshot builders so interactive UI controls update at
 * 60 FPS and backend routes share one single source of truth for atmospheric & exposure physics.
 */

import { CITY_PRESETS, VALIDATION_BOUNDS } from '../config/constants.js';
import { DEFAULT_WORKSPACE_INPUT } from '../config/uiConstants.js';
import { evaluatePollutantStandards, evaluateStationCrossCheck } from './aqiStandards.js';
import { findLowestExposureCorridor } from './cleanCorridorRouter.js';
import { evaluateFamilyMember, simulateRwaCollectiveImpact } from './communityImpact.js';
import { rankCommutePareto } from './commutePareto.js';
import { buildDeterministicFallbackPlan } from './fallbackPlanBuilder.js';
import { simulateIndoor24h } from './indoorMassBalance.js';
import { analyzeInversionSchedule } from './inversionModel.js';
import type {
  AqiAssessment,
  CommuteOptionEvaluation,
  CorridorRouteComparison,
  FamilyMemberAdvisory,
  HourlyAtmosPoint,
  IndoorClearanceSummary,
  InversionAnalysis,
  PollutantReadingInput,
  RwaCollectiveImpact,
  StationCrossCheckResult,
} from './types.js';
import type { AiPlanOutput, PlanRequestPayload } from '../validators/schemas.js';

export interface FirePlumeInfo {
  readonly hotspots500km: number;
  readonly isSeasonalBaseline: boolean;
  readonly summary: string;
}

export interface TelemetrySnapshot {
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly isSimulatedFallback: boolean;
  readonly currentPollutants: PollutantReadingInput;
  readonly assessment: AqiAssessment;
  readonly stationCrossCheck: StationCrossCheckResult;
  readonly stationName: string | null;
  readonly inversion: InversionAnalysis;
  readonly firePlume: FirePlumeInfo;
  readonly hourlySeries: readonly HourlyAtmosPoint[];
}

export interface PlanBundleResponse {
  readonly telemetry: TelemetrySnapshot;
  readonly indoor: IndoorClearanceSummary;
  readonly commuteOptions: readonly CommuteOptionEvaluation[];
  readonly corridor: CorridorRouteComparison;
  readonly rwa: RwaCollectiveImpact;
  readonly memberAdvisories: readonly FamilyMemberAdvisory[];
  readonly aiPlan: AiPlanOutput;
  readonly aiMeta: {
    readonly isFallback: boolean;
    readonly modelUsed: string;
    readonly cached: boolean;
  };
}

export interface ComputedPlanPhysics {
  readonly effectiveAqi: number;
  readonly indoor: IndoorClearanceSummary;
  readonly commuteOptions: readonly CommuteOptionEvaluation[];
  readonly corridor: CorridorRouteComparison;
  readonly rwa: RwaCollectiveImpact;
  readonly memberAdvisories: readonly FamilyMemberAdvisory[];
}

const NOON_FACTOR = 0.55;
const EVENING_FACTOR = 1.15;
const PM10_RATIO = 1.4;
const NO2_RATIO = 0.32;
const O3_RATIO = 0.25;
const SO2_RATIO = 0.1;
const CO_BASE_UG = 1400;
const NOON_START = 12;
const NOON_END = 15;
export const SEASONAL_DEFAULTS = {
  PBL_LOW: 240,
  PBL_HIGH: 1180,
  WIND_LOW: 4,
  WIND_HIGH: 17,
  RH_LOW: 52,
  RH_HIGH: 79,
} as const;
const DEFAULT_FIRES = 6;
const PRESET_PM25_DEFAULT = 148;
const MORNING_HOUR_IDX = 8;

function resolvePresetPm25(lat: number, lon: number): number {
  const nearest = CITY_PRESETS.find((c) => Math.hypot(c.lat - lat, c.lon - lon) < 1);
  return nearest?.fallbackPm25 ?? PRESET_PM25_DEFAULT;
}

/**
 * Generates a realistic diurnal winter-smog fallback series for offline or degraded upstream states.
 */
export function buildSeasonalHourlySeries(basePm25: number): readonly HourlyAtmosPoint[] {
  return Array.from({ length: VALIDATION_BOUNDS.FORECAST_HOURS_SLICE }, (_, hour) => {
    const isBreakup = hour >= NOON_START && hour <= NOON_END;
    const factor = isBreakup ? NOON_FACTOR : EVENING_FACTOR;
    return {
      hourIso: `T${String(hour).padStart(2, '0')}:00`,
      hourOfDay: hour,
      pm25UgM3: Math.round(basePm25 * factor),
      pblMeters: isBreakup ? SEASONAL_DEFAULTS.PBL_HIGH : SEASONAL_DEFAULTS.PBL_LOW,
      windKmh: isBreakup ? SEASONAL_DEFAULTS.WIND_HIGH : SEASONAL_DEFAULTS.WIND_LOW,
      rhPercent: isBreakup ? SEASONAL_DEFAULTS.RH_LOW : SEASONAL_DEFAULTS.RH_HIGH,
    };
  });
}

/**
 * Computes indoor clearance, Pareto commute ranking, clean-corridor Dijkstra pathing,
 * RWA collective impact, and per-member family advisories for any household + telemetry pair.
 */
export function computePlanPhysics(
  input: PlanRequestPayload,
  telemetry: TelemetrySnapshot,
): ComputedPlanPhysics {
  const effectiveAqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const ratio =
    telemetry.assessment.cpcbNaqi > 0 ? effectiveAqi / telemetry.assessment.cpcbNaqi : 1;
  const safetyPm25 = Math.round(telemetry.currentPollutants.pm25UgM3 * Math.max(1, ratio));

  const indoor = simulateIndoor24h({
    roomAreaM2: input.areaM2,
    cadrM3Hr: input.cadrM3Hr,
    tightness: input.tightness,
    cookingFuel: input.cookingFuel,
    openWindowHours: telemetry.inversion.bestWindowHours,
    hourlyOutdoorPm25: telemetry.hourlySeries.map((pt) => pt.pm25UgM3),
  });
  const commuteOptions = rankCommutePareto(input.commuteDistanceKm, safetyPm25, input.mask);
  const corridor = findLowestExposureCorridor('home-sector', 'civic-hub', safetyPm25, {
    commuteMode: input.commuteMode,
    mask: input.mask,
    distanceKm: input.commuteDistanceKm,
  });
  const rwa = simulateRwaCollectiveImpact({
    householdsParticipating: input.householdsParticipating,
    avgCommuteDistanceKm: input.commuteDistanceKm,
    transitShiftShare: input.transitShiftShare,
    haltLeafBurning: input.haltLeafBurning,
  });
  const memberAdvisories = input.members.map((m) =>
    evaluateFamilyMember(m, safetyPm25, effectiveAqi),
  );
  return { effectiveAqi, indoor, commuteOptions, corridor, rwa, memberAdvisories };
}

/**
 * Recomputes bundle outputs synchronously on the client from an existing telemetry snapshot.
 */
export function recomputeBundlePhysics(
  input: PlanRequestPayload,
  telemetry: TelemetrySnapshot,
  existingAi?: { readonly aiPlan: AiPlanOutput; readonly aiMeta: PlanBundleResponse['aiMeta'] },
): PlanBundleResponse {
  const physics = computePlanPhysics(input, telemetry);
  const bestCommute: CommuteOptionEvaluation = physics.commuteOptions[0] ?? {
    mode: input.commuteMode,
    mask: input.mask,
    durationMinutes: 0,
    personalInhaledUg: 0,
    cigaretteEquiv: 0,
    communityCo2Grams: 0,
    communityPm25Mg: 0,
    isParetoOptimal: true,
    paradoxWarning: false,
  };
  const fallbackAiPlan = buildDeterministicFallbackPlan({
    request: input,
    aqi: telemetry.assessment,
    effectiveAqi: physics.effectiveAqi,
    inversion: telemetry.inversion,
    indoor: physics.indoor,
    bestCommute,
    corridor: physics.corridor,
    rwa: physics.rwa,
  });

  const mergedAiPlan: AiPlanOutput = existingAi?.aiPlan
    ? {
        ...existingAi.aiPlan,
        ...(fallbackAiPlan.memberSchedules
          ? { memberSchedules: fallbackAiPlan.memberSchedules }
          : {}),
      }
    : fallbackAiPlan;

  return {
    telemetry,
    indoor: physics.indoor,
    commuteOptions: physics.commuteOptions,
    corridor: physics.corridor,
    rwa: physics.rwa,
    memberAdvisories: physics.memberAdvisories,
    aiPlan: mergedAiPlan,
    aiMeta: existingAi?.aiMeta ?? {
      isFallback: true,
      modelUsed: 'deterministic-physics',
      cached: false,
    },
  };
}

/**
 * Generates an initial winter-smog telemetry snapshot for immediate zero-latency first render.
 */
export function buildInitialWorkspaceBundle(
  input: PlanRequestPayload = DEFAULT_WORKSPACE_INPUT,
): PlanBundleResponse {
  const basePm25 = resolvePresetPm25(input.lat, input.lon);
  const hourlySeries = buildSeasonalHourlySeries(basePm25);
  const pm25UgM3 = hourlySeries[MORNING_HOUR_IDX]?.pm25UgM3 ?? basePm25;
  const currentPollutants: PollutantReadingInput = {
    pm25UgM3,
    pm10UgM3: Math.round(pm25UgM3 * PM10_RATIO),
    no2UgM3: Math.round(pm25UgM3 * NO2_RATIO),
    o3UgM3: Math.round(pm25UgM3 * O3_RATIO),
    so2UgM3: Math.round(pm25UgM3 * SO2_RATIO),
    coUgM3: CO_BASE_UG,
  };
  const assessment = evaluatePollutantStandards(currentPollutants);
  const telemetry: TelemetrySnapshot = {
    city: input.city,
    lat: input.lat,
    lon: input.lon,
    isSimulatedFallback: true,
    currentPollutants,
    assessment,
    stationCrossCheck: evaluateStationCrossCheck(assessment.cpcbNaqi, null),
    stationName: null,
    inversion: analyzeInversionSchedule(hourlySeries, MORNING_HOUR_IDX),
    firePlume: {
      hotspots500km: DEFAULT_FIRES,
      isSeasonalBaseline: true,
      summary: '[Seasonal Baseline Model] Regional fire telemetry estimated.',
    },
    hourlySeries,
  };

  return recomputeBundlePhysics(input, telemetry);
}
