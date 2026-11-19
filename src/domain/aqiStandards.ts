import {
  BERKELEY_EARTH,
  CPCB_BREAKPOINTS,
  STATION_CROSS_CHECK,
  UNIT_CONVERSIONS,
  US_EPA_PM_BREAKPOINTS,
  WHO_2021_LIMITS,
  type BreakpointRow,
} from '../config/physicsConstants.js';
import { assertFiniteNonNegative, roundOne } from './mathHelpers.js';
import type {
  AqiAssessment,
  CpcbCategory,
  PollutantKey,
  PollutantReadingInput,
  StationCrossCheckResult,
  UsEpaCategory,
} from './types.js';

const CPCB_CATEGORY_LIMITS: readonly { maxAqi: number; category: CpcbCategory }[] = [
  { maxAqi: 50, category: 'good' },
  { maxAqi: 100, category: 'satisfactory' },
  { maxAqi: 200, category: 'moderate' },
  { maxAqi: 300, category: 'poor' },
  { maxAqi: 400, category: 'very-poor' },
];

const US_CATEGORY_LIMITS: readonly { maxAqi: number; category: UsEpaCategory }[] = [
  { maxAqi: 50, category: 'good' },
  { maxAqi: 100, category: 'moderate' },
  { maxAqi: 150, category: 'usg' },
  { maxAqi: 200, category: 'unhealthy' },
  { maxAqi: 300, category: 'very-unhealthy' },
];

export { assertFiniteNonNegative } from './mathHelpers.js';

/**
 * Computes piecewise linear sub-index interpolation against a regulatory breakpoint table.
 * Clamps inputs cleanly at the table ceiling so extreme smog episodes remain well-behaved.
 *
 * @param concentration - Ambient pollutant concentration matching the table unit.
 * @param table - Ordered contiguous regulatory breakpoint rows.
 * @returns Rounded integer AQI sub-index between 0 and table max index.
 */
export function interpolateBreakpoint(
  concentration: number,
  table: readonly BreakpointRow[],
): number {
  const safeVal = assertFiniteNonNegative(concentration, 'concentration');
  if (table.length === 0) {
    throw new RangeError('Breakpoint table cannot be empty.');
  }

  for (const row of table) {
    if (safeVal <= row.cHigh) {
      const spanC = row.cHigh - row.cLow;
      const spanI = row.iHigh - row.iLow;
      const ratio = spanC > 0 ? (safeVal - row.cLow) / spanC : 0;
      return Math.round(row.iLow + ratio * spanI);
    }
  }

  const ceilingRow = table[table.length - 1];
  return ceilingRow ? ceilingRow.iHigh : STATION_CROSS_CHECK.MAX_AQI_SCALE;
}

/**
 * Maps an India CPCB NAQI integer value into its six statutory categories.
 *
 * @param naqi - Calculated CPCB NAQI index.
 * @returns Statutory CPCB category label.
 */
export function classifyCpcbCategory(naqi: number): CpcbCategory {
  const safeVal = assertFiniteNonNegative(naqi, 'naqi');
  for (const entry of CPCB_CATEGORY_LIMITS) {
    if (safeVal <= entry.maxAqi) {
      return entry.category;
    }
  }
  return 'severe';
}

/**
 * Maps a US-EPA AQI integer value into its six health-action categories.
 *
 * @param aqi - US-EPA AQI value.
 * @returns US-EPA category slug.
 */
export function classifyUsEpaCategory(aqi: number): UsEpaCategory {
  const safeVal = assertFiniteNonNegative(aqi, 'aqi');
  for (const entry of US_CATEGORY_LIMITS) {
    if (safeVal <= entry.maxAqi) {
      return entry.category;
    }
  }
  return 'hazardous';
}

export interface PollutantSubIndexInfo {
  readonly subIndex: number;
  readonly category: CpcbCategory;
}

/**
 * Computes individual CPCB NAQI sub-indices and statutory severity categories for all six ambient pollutants.
 */
export function evaluatePollutantCategories(
  input: PollutantReadingInput,
): Record<PollutantKey, PollutantSubIndexInfo> {
  const pm25 = interpolateBreakpoint(
    assertFiniteNonNegative(input.pm25UgM3, 'pm25UgM3'),
    CPCB_BREAKPOINTS.pm25,
  );
  const pm10 = interpolateBreakpoint(
    assertFiniteNonNegative(input.pm10UgM3, 'pm10UgM3'),
    CPCB_BREAKPOINTS.pm10,
  );
  const no2 = interpolateBreakpoint(
    assertFiniteNonNegative(input.no2UgM3, 'no2UgM3'),
    CPCB_BREAKPOINTS.no2,
  );
  const o3 = interpolateBreakpoint(
    assertFiniteNonNegative(input.o3UgM3, 'o3UgM3'),
    CPCB_BREAKPOINTS.o3,
  );
  const so2 = interpolateBreakpoint(
    assertFiniteNonNegative(input.so2UgM3, 'so2UgM3'),
    CPCB_BREAKPOINTS.so2,
  );
  const coMg = assertFiniteNonNegative(input.coUgM3, 'coUgM3') / UNIT_CONVERSIONS.UG_PER_MG;
  const co = interpolateBreakpoint(coMg, CPCB_BREAKPOINTS.co);

  return {
    pm25: { subIndex: pm25, category: classifyCpcbCategory(pm25) },
    pm10: { subIndex: pm10, category: classifyCpcbCategory(pm10) },
    no2: { subIndex: no2, category: classifyCpcbCategory(no2) },
    o3: { subIndex: o3, category: classifyCpcbCategory(o3) },
    so2: { subIndex: so2, category: classifyCpcbCategory(so2) },
    co: { subIndex: co, category: classifyCpcbCategory(co) },
  };
}

/**
 * Evaluates ambient pollutant telemetry simultaneously across India CPCB NAQI,
 * US-EPA 2024 AQI, WHO 2021 Guideline multiples, and Berkeley Earth cigarette equivalence.
 *
 * @param input - Hourly ambient pollutant concentrations (ug/m^3; CO converted internally to mg/m^3).
 * @returns Dual regulatory assessment and health risk benchmark translations.
 */
export function evaluatePollutantStandards(input: PollutantReadingInput): AqiAssessment {
  const pm25 = assertFiniteNonNegative(input.pm25UgM3, 'pm25UgM3');
  const pm10 = assertFiniteNonNegative(input.pm10UgM3, 'pm10UgM3');
  const perPollutant = evaluatePollutantCategories(input);
  const cpcbSubs: readonly { key: PollutantKey; aqi: number }[] = (
    ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'] as const
  ).map((key) => ({ key, aqi: perPollutant[key].subIndex }));

  let cpcbNaqi = 0;
  let dominantCpcbPollutant: PollutantKey = 'pm25';
  for (const sub of cpcbSubs) {
    if (sub.aqi > cpcbNaqi) {
      cpcbNaqi = sub.aqi;
      dominantCpcbPollutant = sub.key;
    }
  }

  const usPm25 = interpolateBreakpoint(pm25, US_EPA_PM_BREAKPOINTS.pm25);
  const usPm10 = interpolateBreakpoint(pm10, US_EPA_PM_BREAKPOINTS.pm10);
  const usEpaAqi = Math.max(usPm25, usPm10);

  return {
    cpcbNaqi,
    cpcbCategory: classifyCpcbCategory(cpcbNaqi),
    dominantCpcbPollutant,
    usEpaAqi,
    usEpaCategory: classifyUsEpaCategory(usEpaAqi),
    whoAnnualMultiple: roundOne(pm25 / WHO_2021_LIMITS.PM25_ANNUAL_UG_M3),
    who24hMultiple: roundOne(pm25 / WHO_2021_LIMITS.PM25_24H_UG_M3),
    cigaretteEquivPerDay: roundOne(pm25 / BERKELEY_EARTH.PM25_UG_M3_PER_CIGARETTE),
  };
}

/**
 * Cross-checks gridded atmospheric model AQI against physical monitoring stations.
 * Elevates household protection whenever a local station exceeds model predictions beyond threshold.
 *
 * @param modelAqi - Computed model AQI.
 * @param stationAqi - Optional physical WAQI/CPCB ground-station AQI reading.
 * @returns Precautionary safety AQI and model-station disagreement indicator.
 */
export function evaluateStationCrossCheck(
  modelAqi: number,
  stationAqi: number | null,
): StationCrossCheckResult {
  const safeModel = assertFiniteNonNegative(modelAqi, 'modelAqi');
  if (stationAqi === null || !Number.isFinite(stationAqi) || stationAqi < 0) {
    return {
      stationAvailable: false,
      modelAqi: safeModel,
      stationAqi: null,
      deltaAqi: 0,
      disagreementDetected: false,
      effectiveSafetyAqi: safeModel,
    };
  }

  const deltaAqi = Math.round(Math.abs(stationAqi - safeModel));
  const disagreementDetected = deltaAqi > STATION_CROSS_CHECK.DISAGREEMENT_DELTA_AQI;
  const effectiveSafetyAqi = Math.max(safeModel, stationAqi);

  return {
    stationAvailable: true,
    modelAqi: safeModel,
    stationAqi,
    deltaAqi,
    disagreementDetected,
    effectiveSafetyAqi,
  };
}
