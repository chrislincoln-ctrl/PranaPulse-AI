import {
  BERKELEY_EARTH,
  COMMUTE_PHYSICS,
  FAMILY_RISK_WEIGHTS,
  UNIT_CONVERSIONS,
} from '../config/physicsConstants.js';
import { assertFiniteNonNegative, roundOne } from './mathHelpers.js';
import type { FamilyMemberAdvisory, FamilyMemberInput, RwaCollectiveImpact } from './types.js';

export interface RwaScenarioInput {
  readonly householdsParticipating: number;
  readonly avgCommuteDistanceKm: number;
  readonly transitShiftShare: number;
  readonly haltLeafBurning: boolean;
}

const MODERATE_RISK_LIMIT = 100;

function classifyOutdoorStatus(
  weightedNaqi: number,
): 'go' | 'caution-masked' | 'limit-short' | 'stay-indoors' {
  if (weightedNaqi >= FAMILY_RISK_WEIGHTS.SEVERE_CPCB_THRESHOLD) {
    return 'stay-indoors';
  }
  if (weightedNaqi >= FAMILY_RISK_WEIGHTS.HIGH_RISK_CPCB_THRESHOLD) {
    return 'limit-short';
  }
  if (weightedNaqi > MODERATE_RISK_LIMIT) {
    return 'caution-masked';
  }
  return 'go';
}

/**
 * Estimates individualized daily PM2.5 inhaled exposure and outdoor posture for a household
 * member according to respiratory sensitivity, outdoor duration, and mask filtration.
 *
 * @param member - Household member role, mask tier, and daily outdoor duration.
 * @param ambientPm25UgM3 - Local ambient PM2.5 concentration (ug/m^3).
 * @param effectiveCpcbNaqi - Effective safety CPCB NAQI after station cross-check.
 * @returns Personal exposure ug/day, cigarette equivalent, and protective posture status.
 */
export function evaluateFamilyMember(
  member: FamilyMemberInput,
  ambientPm25UgM3: number,
  effectiveCpcbNaqi: number,
): FamilyMemberAdvisory {
  const safeOutdoorHours = Math.min(
    UNIT_CONVERSIONS.HOURS_PER_DAY,
    assertFiniteNonNegative(member.dailyOutdoorHours, 'dailyOutdoorHours'),
  );
  const safePm25 = assertFiniteNonNegative(ambientPm25UgM3, 'ambientPm25UgM3');
  const safeNaqi = assertFiniteNonNegative(effectiveCpcbNaqi, 'effectiveCpcbNaqi');

  const sensitivity = FAMILY_RISK_WEIGHTS.SENSITIVITY_FACTOR[member.role];
  const maskEfficiency = COMMUTE_PHYSICS.MASK_FILTRATION[member.mask];
  const hourlyRestVentilation = COMMUTE_PHYSICS.MODES.metro.ventilationM3Hr;

  const estimatedDailyInhaledUg = roundOne(
    safePm25 * safeOutdoorHours * hourlyRestVentilation * sensitivity * (1 - maskEfficiency),
  );
  const backgroundEquiv = estimatedDailyInhaledUg / COMMUTE_PHYSICS.DAILY_BASELINE_BREATHING_M3;
  const cigaretteEquiv = roundOne(backgroundEquiv / BERKELEY_EARTH.PM25_UG_M3_PER_CIGARETTE);

  return {
    id: member.id,
    label: member.label,
    role: member.role,
    estimatedDailyInhaledUg,
    cigaretteEquiv,
    outdoorStatus: classifyOutdoorStatus(safeNaqi * sensitivity),
  };
}

/**
 * Models collective neighborhood / RWA impact when participating households shift short commutes
 * to low-emission transit and stop winter evening waste or biomass open burning.
 *
 * @param scenario - RWA neighborhood participation parameters.
 * @returns Collective daily & annual CO2e (kg) and PM2.5 (g) avoided.
 */
export function simulateRwaCollectiveImpact(scenario: RwaScenarioInput): RwaCollectiveImpact {
  const households = Math.round(
    assertFiniteNonNegative(scenario.householdsParticipating, 'householdsParticipating'),
  );
  const commuteKm = assertFiniteNonNegative(scenario.avgCommuteDistanceKm, 'avgCommuteDistanceKm');
  const shiftShare = Math.min(
    1,
    assertFiniteNonNegative(scenario.transitShiftShare, 'transitShiftShare'),
  );

  const petrolSpec = COMMUTE_PHYSICS.MODES['petrol-car'];
  const metroSpec = COMMUTE_PHYSICS.MODES.metro;
  const commutersShifted = households * shiftShare;

  const co2SavedPerKmG = petrolSpec.co2GPerKm - metroSpec.co2GPerKm;
  const pmSavedPerKmMg = petrolSpec.tailpipePmMgPerKm - metroSpec.tailpipePmMgPerKm;

  const transitCo2G = commutersShifted * commuteKm * co2SavedPerKmG;
  const stoveCo2G =
    households * FAMILY_RISK_WEIGHTS.STOVE_SWITCH_CO2_G_PER_DAY_PER_HOME * shiftShare;
  const dailyCo2SavedKg = roundOne((transitCo2G + stoveCo2G) / FAMILY_RISK_WEIGHTS.GRAMS_PER_KG);

  const transitPmG = (commutersShifted * commuteKm * pmSavedPerKmMg) / UNIT_CONVERSIONS.UG_PER_MG;
  const burningPmG = scenario.haltLeafBurning
    ? households * FAMILY_RISK_WEIGHTS.LEAF_BURNING_AVOIDED_PM25_G_PER_DAY_PER_HOME
    : 0;

  return {
    householdsParticipating: households,
    dailyCo2SavedKg,
    dailyPm25AvoidedG: roundOne(transitPmG + burningPmG),
    annualCo2SavedKg: Math.round(dailyCo2SavedKg * FAMILY_RISK_WEIGHTS.ANNUAL_WORKING_DAYS),
  };
}
