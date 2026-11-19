import { BERKELEY_EARTH, COMMUTE_PHYSICS, UNIT_CONVERSIONS } from '../config/physicsConstants.js';
import { assertFiniteNonNegative, roundOne } from './mathHelpers.js';
import type { CommuteModeId, CommuteOptionEvaluation, MaskTypeId } from './types.js';

export interface EvaluateCommuteParams {
  readonly mode: CommuteModeId;
  readonly mask: MaskTypeId;
  readonly distanceKm: number;
  readonly ambientPm25UgM3: number;
}

const ALL_MODES: readonly CommuteModeId[] = [
  'metro',
  'electric-bus',
  'ev-car',
  'petrol-car',
  'two-wheeler',
  'cycling',
  'walking',
];

function isDominatedByOther(
  candidate: CommuteOptionEvaluation,
  peer: CommuteOptionEvaluation,
): boolean {
  const strictlyWorseInSome =
    peer.personalInhaledUg < candidate.personalInhaledUg ||
    peer.communityCo2Grams < candidate.communityCo2Grams ||
    peer.communityPm25Mg < candidate.communityPm25Mg;
  const noWorseInAll =
    peer.personalInhaledUg <= candidate.personalInhaledUg &&
    peer.communityCo2Grams <= candidate.communityCo2Grams &&
    peer.communityPm25Mg <= candidate.communityPm25Mg;
  return noWorseInAll && strictlyWorseInSome;
}

/**
 * Evaluates a single trip's pulmonary PM2.5 inhaled lung dose alongside its community
 * tailpipe CO2e and primary PM2.5 exhaust footprint, exposing active-commute smog paradoxes.
 *
 * @param params - Commute mode, mask filtration tier, one-way/daily distance (km), and ambient PM2.5.
 * @returns Quantified lung dose, cigarette-day equivalent, emissions, and paradox warning.
 */
export function evaluateCommuteOption(params: EvaluateCommuteParams): CommuteOptionEvaluation {
  const safeDistance = assertFiniteNonNegative(params.distanceKm, 'distanceKm');
  const safePm25 = assertFiniteNonNegative(params.ambientPm25UgM3, 'ambientPm25UgM3');
  const spec = COMMUTE_PHYSICS.MODES[params.mode];
  const maskEfficiency = COMMUTE_PHYSICS.MASK_FILTRATION[params.mask];

  const durationHours = safeDistance / spec.speedKmh;
  const microEnvPm25 = safePm25 * spec.exposureMultiplier;
  const personalInhaledUg = roundOne(
    microEnvPm25 * durationHours * spec.ventilationM3Hr * (1 - maskEfficiency),
  );
  const dailyEquivalentBackground = personalInhaledUg / COMMUTE_PHYSICS.DAILY_BASELINE_BREATHING_M3;
  const cigaretteEquiv = roundOne(
    dailyEquivalentBackground / BERKELEY_EARTH.PM25_UG_M3_PER_CIGARETTE,
  );

  const paradoxWarning =
    spec.isActiveOutdoors &&
    params.mask === 'none' &&
    safePm25 >= COMMUTE_PHYSICS.SEVERE_PARADOX_PM25_THRESHOLD;

  return {
    mode: params.mode,
    mask: params.mask,
    durationMinutes: Math.round(durationHours * UNIT_CONVERSIONS.MINUTES_PER_HOUR),
    personalInhaledUg,
    cigaretteEquiv,
    communityCo2Grams: Math.round(spec.co2GPerKm * safeDistance),
    communityPm25Mg: roundOne(spec.tailpipePmMgPerKm * safeDistance),
    isParetoOptimal: false,
    paradoxWarning,
  };
}

/**
 * Evaluates all urban commute modes and identifies the Pareto-optimal non-dominated frontier
 * balancing personal inhaled dose against neighborhood tailpipe pollution.
 *
 * @param distanceKm - Commute distance in kilometers.
 * @param ambientPm25UgM3 - Ambient urban PM2.5 concentration (ug/m^3).
 * @param mask - Active mask filtration type worn outdoors/in transit.
 * @returns Ranked commute options sorted by lowest inhaled pulmonary dose first.
 */
export function rankCommutePareto(
  distanceKm: number,
  ambientPm25UgM3: number,
  mask: MaskTypeId,
): readonly CommuteOptionEvaluation[] {
  const evaluated = ALL_MODES.map((mode) =>
    evaluateCommuteOption({ mode, mask, distanceKm, ambientPm25UgM3 }),
  );

  const withPareto = evaluated.map((candidate) => {
    const dominated = evaluated.some((peer) => isDominatedByOther(candidate, peer));
    return {
      ...candidate,
      isParetoOptimal: !dominated,
    };
  });

  return withPareto.sort((a, b) => a.personalInhaledUg - b.personalInhaledUg);
}
