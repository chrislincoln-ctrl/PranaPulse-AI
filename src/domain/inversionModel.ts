import { INVERSION_THRESHOLDS, UNIT_CONVERSIONS } from '../config/physicsConstants.js';
import { assertFiniteNonNegative } from './mathHelpers.js';
import type {
  HourlyAtmosPoint,
  HourlyDispersionPoint,
  InversionAnalysis,
  InversionSeverity,
} from './types.js';

/**
 * Computes atmospheric Ventilation Coefficient (m^2/s) from mixing ceiling depth and surface wind.
 *
 * @param pblMeters - Planetary Boundary Layer height (meters AGL).
 * @param windKmh - Near-surface wind speed at 10 m height (km/h).
 * @returns Rounded Ventilation Coefficient in m^2/s.
 */
export function computeVentilationCoefficient(pblMeters: number, windKmh: number): number {
  const safePbl = assertFiniteNonNegative(pblMeters, 'pblMeters');
  const safeWind = assertFiniteNonNegative(windKmh, 'windKmh');
  const windMs = safeWind / UNIT_CONVERSIONS.KMH_TO_MS;
  return Math.round(safePbl * windMs);
}

/**
 * Classifies winter thermal-inversion trapping intensity from PBL depth and Ventilation Coefficient.
 *
 * @param pblMeters - Planetary Boundary Layer height (m AGL).
 * @param windKmh - Near-surface 10 m wind speed (km/h).
 * @returns Inversion trapping severity tier.
 */
export function classifyInversionSeverity(pblMeters: number, windKmh: number): InversionSeverity {
  const safePbl = assertFiniteNonNegative(pblMeters, 'pblMeters');
  const vc = computeVentilationCoefficient(safePbl, windKmh);

  if (
    safePbl <= INVERSION_THRESHOLDS.CRITICAL_PBL_METERS ||
    vc < INVERSION_THRESHOLDS.CRITICAL_VENTILATION_M2_S
  ) {
    return 'severe-inversion';
  }

  if (
    safePbl <= INVERSION_THRESHOLDS.SHALLOW_PBL_METERS ||
    vc < INVERSION_THRESHOLDS.MODERATE_VENTILATION_M2_S
  ) {
    return 'moderate-trapping';
  }

  return 'neutral';
}

function buildAvoidHourSet(points: readonly HourlyAtmosPoint[]): number[] {
  const worst = [...points]
    .sort((a, b) => b.pm25UgM3 - a.pm25UgM3)
    .slice(0, INVERSION_THRESHOLDS.TOP_WINDOW_COUNT);
  return worst.map((entry) => entry.hourOfDay).sort((a, b) => a - b);
}

function findDailyMinPm25(points: readonly HourlyAtmosPoint[]): number {
  let minVal = Number.POSITIVE_INFINITY;
  for (const point of points) {
    if (point.pm25UgM3 < minVal) {
      minVal = point.pm25UgM3;
    }
  }
  return minVal;
}

function evaluateHourlyDispersion(
  point: HourlyAtmosPoint,
  dailyMinPm25: number,
  bestHourSet: ReadonlySet<number>,
): HourlyDispersionPoint {
  const ventilationM2S = computeVentilationCoefficient(point.pblMeters, point.windKmh);
  const severity = classifyInversionSeverity(point.pblMeters, point.windKmh);
  const pmAcceptable = point.pm25UgM3 <= dailyMinPm25 / INVERSION_THRESHOLDS.SAFE_PM25_WINDOW_RATIO;
  const isSafeWindowHour =
    bestHourSet.has(point.hourOfDay) || (severity === 'neutral' && pmAcceptable);

  return {
    hourIso: point.hourIso,
    hourOfDay: point.hourOfDay,
    ventilationM2S,
    severity,
    isSafeWindowHour,
  };
}

/**
 * Evaluates a 24-hour boundary-layer and smog trajectory to determine whether windows should
 * stay sealed or open during solar-breakup hours, alongside peak trapping avoidance hours.
 *
 * @param points - Ordered hourly atmospheric observations/forecasts.
 * @param currentIndex - Zero-based index representing the user's current hour.
 * @returns Full dispersion profile, window opening decision, and clean vs trapping hour windows.
 */
export function analyzeInversionSchedule(
  points: readonly HourlyAtmosPoint[],
  currentIndex = 0,
): InversionAnalysis {
  const firstPoint = points[0];
  if (!firstPoint) {
    throw new RangeError('Hourly atmospheric series cannot be empty.');
  }

  const clampedIndex = Math.min(Math.max(0, currentIndex), points.length - 1);
  const current = points[clampedIndex] ?? firstPoint;

  const bestSorted = [...points]
    .sort((a, b) => a.pm25UgM3 - b.pm25UgM3 || b.pblMeters - a.pblMeters)
    .slice(0, INVERSION_THRESHOLDS.TOP_WINDOW_COUNT);
  const bestWindowHours = bestSorted.map((entry) => entry.hourOfDay).sort((a, b) => a - b);
  const bestSet = new Set(bestWindowHours);
  const dailyMinPm25 = findDailyMinPm25(points);

  const hourly = points.map((point) => evaluateHourlyDispersion(point, dailyMinPm25, bestSet));
  const currentVentilationM2S = computeVentilationCoefficient(current.pblMeters, current.windKmh);
  const currentSeverity = classifyInversionSeverity(current.pblMeters, current.windKmh);
  const hygroscopicHazeRisk = current.rhPercent >= INVERSION_THRESHOLDS.HIGH_RH_HYGROSCOPIC_PCT;
  const openWindowsNow =
    bestSet.has(current.hourOfDay) ||
    (currentSeverity === 'neutral' &&
      currentVentilationM2S >= INVERSION_THRESHOLDS.HIGH_VENTILATION_M2_S);

  return {
    currentSeverity,
    currentVentilationM2S,
    currentPblMeters: Math.round(current.pblMeters),
    hygroscopicHazeRisk,
    openWindowsNow,
    bestWindowHours,
    avoidOutdoorHours: buildAvoidHourSet(points),
    hourly,
  };
}
