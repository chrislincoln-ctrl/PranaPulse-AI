import type { CookingFuelType, IndoorClearanceSummary } from '../domain/types.js';
import {
  INDOOR_GUIDANCE_COPY,
  type IndoorGuidanceCopyVars,
  type LocalizedPlantCard,
} from '../i18n/indoorGuidanceCopy.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import { INDOOR_MASS_BALANCE } from './physicsConstants.js';

export type DynamicPlantRecommendation = LocalizedPlantCard;

export interface DynamicIndoorGuidance {
  readonly infiltrationAch: number;
  readonly cookingEmissionUgHr: number;
  readonly envelopeCadrSurcharge: number;
  readonly fuelCadrSurcharge: number;
  readonly effectiveTargetCadr: number;
  readonly cadrDelta: number;
  readonly crBoxesNeeded: number;
  readonly diySpecSummary: string;
  readonly diyActionChecklist: readonly string[];
  readonly physicsAlerts: readonly string[];
  readonly winterPlants: readonly DynamicPlantRecommendation[];
}

const FUEL_CADR_SURCHARGE: Readonly<Record<CookingFuelType, number>> = {
  induction: 0,
  'lpg-vented': 35,
  'lpg-unvented': 95,
  'solid-biomass': 220,
};

/**
 * Resolves live, physics-coupled Corsi-Rosenthal DIY specs, envelope/combustion verification
 * alerts, and window-sealing/cooking-fuel matched winter plant recommendations in EN / HI / TA.
 */
export function resolveDynamicIndoorGuidance(
  input: PlanRequestPayload,
  indoor: IndoorClearanceSummary,
  t: LocaleDictionary,
): DynamicIndoorGuidance {
  const pack = INDOOR_GUIDANCE_COPY[input.language];
  const infiltrationAch = INDOOR_MASS_BALANCE.INFILTRATION_ACH[input.tightness];
  const minAch = INDOOR_MASS_BALANCE.INFILTRATION_ACH['weather-sealed'];
  const cookingEmissionUgHr = INDOOR_MASS_BALANCE.COOKING_SOURCE_UG_HR[input.cookingFuel];

  const envelopeCadrSurcharge = Math.round(indoor.roomVolumeM3 * (infiltrationAch - minAch));
  const fuelCadrSurcharge = FUEL_CADR_SURCHARGE[input.cookingFuel];
  const effectiveTargetCadr = indoor.requiredCadr48Ach + envelopeCadrSurcharge + fuelCadrSurcharge;
  const cadrDelta = input.cadrM3Hr - effectiveTargetCadr;
  const deficit = Math.max(0, effectiveTargetCadr - input.cadrM3Hr);
  const basisCadr = deficit > 0 ? deficit : effectiveTargetCadr;
  const crBoxesNeeded = Math.max(
    1,
    Math.ceil(basisCadr / INDOOR_MASS_BALANCE.DIY_CORSI_ROSENTHAL_CADR_M3_HR),
  );

  const vars: IndoorGuidanceCopyVars = {
    input,
    indoor,
    sealAch: infiltrationAch,
    fuelUg: cookingEmissionUgHr,
    envelopeSurcharge: envelopeCadrSurcharge,
    fuelSurcharge: fuelCadrSurcharge,
    effectiveTargetCadr,
    crBoxesNeeded,
    tightnessLabel: t.tightnessOptions[input.tightness],
    fuelLabel: t.fuelOptions[input.cookingFuel],
  };

  return {
    infiltrationAch,
    cookingEmissionUgHr,
    envelopeCadrSurcharge,
    fuelCadrSurcharge,
    effectiveTargetCadr,
    cadrDelta,
    crBoxesNeeded,
    diySpecSummary: pack.diySummary(vars),
    diyActionChecklist: [
      pack.diySealStep(input.tightness, envelopeCadrSurcharge),
      pack.diyFuelStep(input.cookingFuel, vars.fuelLabel, fuelCadrSurcharge),
    ],
    physicsAlerts: [pack.sealAlert(vars), pack.fuelAlert(vars), ...t.mythAlertBullets],
    winterPlants: [
      pack.sealPlants[input.tightness],
      pack.fuelPlants[input.cookingFuel],
      ...pack.secondaryPlants,
    ],
  };
}
