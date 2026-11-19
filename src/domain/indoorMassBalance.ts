import { INDOOR_MASS_BALANCE, UNIT_CONVERSIONS } from '../config/physicsConstants.js';
import { assertFiniteNonNegative, assertPositive, roundOne } from './mathHelpers.js';
import type {
  CookingFuelType,
  HourlyIndoorPoint,
  IndoorClearanceSummary,
  IndoorSimulationInput,
} from './types.js';

const INDOOR_MYTH_WARNINGS: readonly string[] = [
  'Avoid ozone-generating ionizers or "UV-ozone purifiers": ozone reacts indoors into ultrafine secondary aerosols and irritates airways (PMC7749091).',
  'Houseplants alone cannot clear severe winter PM2.5 smog inside rooms; prioritize MERV-13 DIY box fans or true HEPA filtration.',
];

/**
 * Computes indoor airspace volume (m^3) from floor area and ceiling height.
 *
 * @param areaM2 - Room floor area in square meters.
 * @param ceilingHeightM - Room ceiling height in meters (defaults to 2.9 m).
 * @returns Room air volume in cubic meters.
 */
export function calculateRoomVolume(
  areaM2: number,
  ceilingHeightM: number = INDOOR_MASS_BALANCE.DEFAULT_ROOM_HEIGHT_M,
): number {
  const validArea = assertPositive(areaM2, 'areaM2');
  const validHeight = assertPositive(ceilingHeightM, 'ceilingHeightM');
  return roundOne(validArea * validHeight);
}

/**
 * Calculates required purifier Clean Air Delivery Rate (CADR m^3/hr) for target air changes.
 *
 * @param roomVolumeM3 - Enclosed room volume (m^3).
 * @param targetAch - Desired air changes per hour (default 4.8 ACH).
 * @returns Required CADR in cubic meters per hour.
 */
export function calculateRequiredCadr(
  roomVolumeM3: number,
  targetAch: number = INDOOR_MASS_BALANCE.TARGET_ACH_FOR_SIZING,
): number {
  const validVol = assertPositive(roomVolumeM3, 'roomVolumeM3');
  const validAch = assertPositive(targetAch, 'targetAch');
  return Math.round(validVol * validAch);
}

/**
 * Computes first-order single-compartment purification time to reach target reduction efficiency.
 *
 * @param roomVolumeM3 - Room volume (m^3).
 * @param cadrM3Hr - Purifier CADR (m^3/hr).
 * @param targetEfficiency - Target fractional removal within (0, 1), default 0.90.
 * @returns Estimated purge duration in minutes.
 */
export function calculatePurgeMinutes(
  roomVolumeM3: number,
  cadrM3Hr: number,
  targetEfficiency: number = INDOOR_MASS_BALANCE.CLEAR_90_PCT_EFFICIENCY,
): number {
  const validVol = assertPositive(roomVolumeM3, 'roomVolumeM3');
  const validCadr = assertPositive(cadrM3Hr, 'cadrM3Hr');
  if (!Number.isFinite(targetEfficiency) || targetEfficiency <= 0 || targetEfficiency >= 1) {
    throw new RangeError('targetEfficiency must lie strictly inside (0, 1).');
  }
  const hours = (-Math.log(1 - targetEfficiency) * validVol) / validCadr;
  return Math.max(1, Math.round(hours * UNIT_CONVERSIONS.MINUTES_PER_HOUR));
}

function stepMassBalanceHour(params: {
  prevIndoor: number;
  outdoorPm25: number;
  infiltrationAch: number;
  cadrAch: number;
  indoorSourceUgHr: number;
  roomVolumeM3: number;
}): number {
  const kTotal = params.infiltrationAch + INDOOR_MASS_BALANCE.DEPOSITION_RATE_HR + params.cadrAch;
  const infiltrationInput =
    params.infiltrationAch * INDOOR_MASS_BALANCE.PENETRATION_FACTOR * params.outdoorPm25;
  const sourceConcentrationRate = params.indoorSourceUgHr / params.roomVolumeM3;
  const steadyState = (infiltrationInput + sourceConcentrationRate) / kTotal;
  const decay = Math.exp(-kTotal);
  return roundOne(params.prevIndoor * decay + steadyState * (1 - decay));
}

function getCookingSource(fuel: CookingFuelType, hourOfDay: number): number {
  if (!INDOOR_MASS_BALANCE.COOKING_PEAK_HOURS.has(hourOfDay)) {
    return 0;
  }
  return INDOOR_MASS_BALANCE.COOKING_SOURCE_UG_HR[fuel];
}

function computeMean(values: readonly number[]): number {
  const sum = values.reduce((acc, current) => acc + current, 0);
  return values.length > 0 ? roundOne(sum / values.length) : 0;
}

function simulateHourlyTrajectory(
  input: IndoorSimulationInput,
  roomVolumeM3: number,
  validCadr: number,
): readonly HourlyIndoorPoint[] {
  const openSet = new Set(input.openWindowHours);
  const baselineAch = INDOOR_MASS_BALANCE.INFILTRATION_ACH.leaky;
  const mitigatedAchBase = INDOOR_MASS_BALANCE.INFILTRATION_ACH[input.tightness];
  const initialOutdoor = assertFiniteNonNegative(input.hourlyOutdoorPm25[0] ?? 0, 'outdoorPm25');
  let baselineState = initialOutdoor * INDOOR_MASS_BALANCE.PENETRATION_FACTOR;
  let mitigatedState = initialOutdoor * INDOOR_MASS_BALANCE.PENETRATION_FACTOR;

  return input.hourlyOutdoorPm25.map((rawOutdoor, hourIndex) => {
    const outdoorPm25 = assertFiniteNonNegative(rawOutdoor, 'outdoorPm25');
    const hourOfDay = hourIndex % UNIT_CONVERSIONS.HOURS_PER_DAY;
    const isWindowOpen = openSet.has(hourOfDay);

    baselineState = stepMassBalanceHour({
      prevIndoor: baselineState,
      outdoorPm25,
      infiltrationAch: baselineAch,
      cadrAch: 0,
      indoorSourceUgHr: getCookingSource(input.cookingFuel, hourOfDay),
      roomVolumeM3,
    });

    const mitigatedAch = isWindowOpen
      ? mitigatedAchBase + INDOOR_MASS_BALANCE.OPEN_WINDOW_ACH_BOOST
      : mitigatedAchBase;
    mitigatedState = stepMassBalanceHour({
      prevIndoor: mitigatedState,
      outdoorPm25,
      infiltrationAch: mitigatedAch,
      cadrAch: validCadr / roomVolumeM3,
      indoorSourceUgHr: getCookingSource('induction', hourOfDay),
      roomVolumeM3,
    });

    return {
      hourIndex,
      outdoorPm25: roundOne(outdoorPm25),
      indoorBaselinePm25: baselineState,
      indoorMitigatedPm25: mitigatedState,
    };
  });
}

/**
 * Simulates a 24-hour indoor PM2.5 mass balance comparing an unmitigated baseline home
 * against a mitigated home using filtration (CADR), sealed-window discipline, and cleaner cooking.
 *
 * @param input - Room geometry, filtration CADR, building envelope tightness, fuel, and outdoor PM2.5 curve.
 * @returns 24-hour indoor clearance profile, required CADR, purge timing, and percentage exposure cut.
 */
export function simulateIndoor24h(input: IndoorSimulationInput): IndoorClearanceSummary {
  if (input.hourlyOutdoorPm25.length === 0) {
    throw new RangeError('hourlyOutdoorPm25 cannot be empty.');
  }

  const roomVolumeM3 = calculateRoomVolume(input.roomAreaM2, input.ceilingHeightM);
  const validCadr = assertFiniteNonNegative(input.cadrM3Hr, 'cadrM3Hr');
  const requiredCadr48Ach = calculateRequiredCadr(roomVolumeM3);
  const purge90Minutes = calculatePurgeMinutes(roomVolumeM3, Math.max(1, validCadr));
  const hourly = simulateHourlyTrajectory(input, roomVolumeM3, validCadr);

  const dailyMeanOutdoorPm25 = computeMean(hourly.map((point) => point.outdoorPm25));
  const dailyMeanBaselinePm25 = computeMean(hourly.map((point) => point.indoorBaselinePm25));
  const dailyMeanMitigatedPm25 = computeMean(hourly.map((point) => point.indoorMitigatedPm25));
  const rawCut =
    dailyMeanBaselinePm25 > 0
      ? ((dailyMeanBaselinePm25 - dailyMeanMitigatedPm25) / dailyMeanBaselinePm25) * 100
      : 0;

  return {
    roomVolumeM3,
    requiredCadr48Ach,
    achievedAch: roundOne(validCadr / roomVolumeM3),
    purge90Minutes,
    dailyMeanOutdoorPm25,
    dailyMeanBaselinePm25,
    dailyMeanMitigatedPm25,
    exposureReductionPct: Math.max(0, roundOne(rawCut)),
    mythAlerts: INDOOR_MYTH_WARNINGS,
    hourly,
  };
}
