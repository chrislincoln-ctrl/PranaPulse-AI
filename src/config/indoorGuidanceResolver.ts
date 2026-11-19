import { INDOOR_MASS_BALANCE } from './physicsConstants.js';
import type {
  BuildingTightness,
  CookingFuelType,
  IndoorClearanceSummary,
} from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface DynamicPlantRecommendation {
  readonly id: string;
  readonly title: string;
  readonly badge: string;
  readonly text: string;
  readonly imageUrl: string;
  readonly imageAlt: string;
  readonly isPrimaryMatch: boolean;
}

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

const SEAL_PLANT_BY_TIGHTNESS: Readonly<Record<BuildingTightness, DynamicPlantRecommendation>> = {
  leaky: {
    id: 'seal-leaky-plant',
    title: 'Tulsi (Holy Basil) & Rubber Plant',
    badge: 'Matched to Leaky Windows (1.20 ACH Sill Dust Trap)',
    text: 'Place directly along leaky windowsills; broad waxy leaves intercept coarse outdoor PM10 and settled smog dust entering window gaps (wipe leaves with a damp cloth every 48h).',
    imageUrl: '/plants/tulsi-rubber.jpg',
    imageAlt: 'Tulsi (Holy Basil) windowsill plant',
    isPrimaryMatch: true,
  },
  standard: {
    id: 'seal-standard-plant',
    title: 'Areca Palm (Dypsis lutescens) & Boston Fern',
    badge: 'Matched to Standard Windows (0.55 ACH Airway Humidity)',
    text: 'Natural winter transpiration maintains 40–50% indoor relative humidity so respiratory airways stay hydrated against 0.55 ACH infiltrating dry smog.',
    imageUrl: '/plants/areca-palm.jpg',
    imageAlt: 'Areca Palm indoor plant',
    isPrimaryMatch: true,
  },
  'weather-sealed': {
    id: 'seal-weather-plant',
    title: 'Snake Plant (Sansevieria) & ZZ Plant',
    badge: 'Matched to Weather-Sealed Envelope (0.25 ACH Nighttime O2)',
    text: 'Weather-sealed rooms (0.25 ACH) trap overnight human CO2; CAM photosynthesis absorbs CO2 and releases oxygen at night while windows remain tightly shut.',
    imageUrl: '/plants/snake-plant.jpg',
    imageAlt: 'Snake Plant (Sansevieria trifasciata)',
    isPrimaryMatch: true,
  },
};

const FUEL_PLANT_BY_FUEL: Readonly<Record<CookingFuelType, DynamicPlantRecommendation>> = {
  'solid-biomass': {
    id: 'fuel-biomass-plant',
    title: 'Peace Lily (Spathiphyllum) & Bamboo Palm',
    badge: 'Matched to Solid Biomass / Wood (9,500 ug/h VOC Scrubber)',
    text: 'Highest stomatal absorption of biomass combustion benzene, formaldehyde, trichloroethylene, and smoke VOCs near kitchen pass-throughs.',
    imageUrl: '/plants/peace-lily.jpg',
    imageAlt: 'Peace Lily indoor plant',
    isPrimaryMatch: true,
  },
  'lpg-unvented': {
    id: 'fuel-lpg-unvented-plant',
    title: 'Spider Plant (Chlorophytum) & Peace Lily',
    badge: 'Matched to Unvented LPG (1,900 ug/h NO2 & Aldehyde Uptake)',
    text: 'Absorbs unvented gas-burner formaldehydes, NO2 co-pollutants, benzene, and xylene in low winter sunlight.',
    imageUrl: '/plants/spider-plant.jpg',
    imageAlt: 'Spider Plant indoor foliage',
    isPrimaryMatch: true,
  },
  'lpg-vented': {
    id: 'fuel-lpg-vented-plant',
    title: 'Golden Pothos (Money Plant) & Spider Plant',
    badge: 'Matched to Vented LPG (650 ug/h Frying Aldehyde Buffer)',
    text: 'Hardy kitchen-counter bio-buffers that capture residual frying aldehydes and trace gas combustion VOCs escaping the chimney hood.',
    imageUrl: '/plants/golden-pothos.jpg',
    imageAlt: 'Golden Pothos (Money Plant)',
    isPrimaryMatch: true,
  },
  induction: {
    id: 'fuel-induction-plant',
    title: 'Areca Palm & Dwarf Date Palm',
    badge: 'Matched to Induction / Electric (150 ug/h Bio-Comfort)',
    text: 'With zero combustion NO2/CO from induction cooking, deploy palm foliage in living and sleeping zones to humidify dry winter air and trap settled lint.',
    imageUrl: '/plants/areca-palm.jpg',
    imageAlt: 'Areca Palm indoor humidifier plant',
    isPrimaryMatch: true,
  },
};

const SECONDARY_PLANTS: readonly DynamicPlantRecommendation[] = [
  {
    id: 'sec-cam-snake',
    title: 'Snake Plant (Sansevieria) & Aloe Vera',
    badge: 'Supplementary Bedroom CAM O2 Buffer',
    text: 'Releases oxygen overnight via CAM metabolism and traps coarse dust on upright waxy blades when wiped weekly.',
    imageUrl: '/plants/snake-plant.jpg',
    imageAlt: 'Snake Plant bedroom oxygen plant',
    isPrimaryMatch: false,
  },
  {
    id: 'sec-voc-ivy',
    title: 'English Ivy (Hedera helix) & Aglaonema',
    badge: 'Supplementary Hallway Formaldehyde Buffer',
    text: 'Low-light winter foliage that provides ~1% supplementary bio-deposition for indoor volatile organic compounds.',
    imageUrl: '/plants/english-ivy.jpg',
    imageAlt: 'English Ivy low-light indoor plant',
    isPrimaryMatch: false,
  },
];

function resolveDiySealStep(tightness: BuildingTightness, envelopeSurcharge: number): string {
  const table: Readonly<Record<BuildingTightness, string>> = {
    leaky: `Window seal fix (Leaky 1.20 ACH): Apply 3M EPDM foam weather-stripping tape (~INR 250) around window sashes to eliminate +${String(envelopeSurcharge)} m3/h infiltration load.`,
    standard: `Window seal upgrade (Standard 0.55 ACH): Add rubber door sweeps and latch seals (~INR 180) to save +${String(envelopeSurcharge)} m3/h CADR loss.`,
    'weather-sealed':
      'Window seal optimal (Weather-sealed 0.25 ACH): Keep perimeter gaskets closed during nocturnal inversions; open only during afternoon breakup hours.',
  };
  return table[tightness];
}

function resolveDiyFuelStep(cookingFuel: CookingFuelType, fuelSurcharge: number): string {
  const carbonMsg = `Combustion pre-filter (${cookingFuel}): Sandwich 1 activated-carbon mesh sheet (~INR 350) inside the MERV-13 box intake to adsorb cooking NO2, CO precursors, and VOCs (+${String(fuelSurcharge)} m3/h load).`;
  const table: Readonly<Record<CookingFuelType, string>> = {
    'solid-biomass': carbonMsg,
    'lpg-unvented': carbonMsg,
    'lpg-vented':
      'Kitchen exhaust discipline (Vented LPG): Run chimney hood on high during frying + run HEPA/MERV-13 box for 20 min after meals.',
    induction:
      'Zero-combustion advantage (Induction): Standard 4x MERV-13 pleated filters + 50 cm box fan (~INR 2,500) needed without extra carbon NO2 scrubbing.',
  };
  return table[cookingFuel];
}

function buildDiySummaryText(params: {
  readonly input: PlanRequestPayload;
  readonly indoor: IndoorClearanceSummary;
  readonly envelopeSurcharge: number;
  readonly fuelSurcharge: number;
  readonly effectiveTargetCadr: number;
  readonly crBoxesNeeded: number;
}): string {
  const { input, indoor, envelopeSurcharge, fuelSurcharge, effectiveTargetCadr, crBoxesNeeded } =
    params;
  const deficit = Math.max(0, effectiveTargetCadr - input.cadrM3Hr);
  const sealAch = INDOOR_MASS_BALANCE.INFILTRATION_ACH[input.tightness];
  const fuelUg = INDOOR_MASS_BALANCE.COOKING_SOURCE_UG_HR[input.cookingFuel];
  const plural = crBoxesNeeded > 1 ? 's' : '';

  if (deficit > 0) {
    return `For ${String(input.areaM2)} m2 (${String(indoor.roomVolumeM3)} m3) with ${input.tightness} windows (${String(sealAch)} ACH, +${String(envelopeSurcharge)} m3/h) and ${input.cookingFuel} cooking (${String(fuelUg)} ug/h, +${String(fuelSurcharge)} m3/h), effective target is ${String(effectiveTargetCadr)} m3/h CADR (current deficit: ${String(deficit)} m3/h → build ${String(crBoxesNeeded)}x MERV-13 Corsi-Rosenthal box unit${plural}).`;
  }
  return `Your ${String(input.cadrM3Hr)} m3/h CADR meets the ${String(effectiveTargetCadr)} m3/h effective target for ${String(input.areaM2)} m2 (${input.tightness} seal + ${input.cookingFuel} fuel) with a +${String(input.cadrM3Hr - effectiveTargetCadr)} m3/h safety margin.`;
}

function buildPhysicsAlerts(
  input: PlanRequestPayload,
  indoor: IndoorClearanceSummary,
  envelopeSurcharge: number,
  t: LocaleDictionary,
): readonly string[] {
  const sealAlerts: Readonly<Record<BuildingTightness, string>> = {
    leaky: `Envelope leakage alert (1.20 ACH — Leaky windows): 78% of outdoor PM2.5 penetrates unsealed gaps continuously, adding +${String(envelopeSurcharge)} m3/h filtration load. Sealing gaps cuts infiltration by 79% (down to 0.25 ACH).`,
    standard: `Moderate window infiltration (0.55 ACH — Standard windows): Frame micro-gaps add +${String(envelopeSurcharge)} m3/h CADR demand during winter inversions; lock window latches and seal balcony thresholds.`,
    'weather-sealed': `Weather-sealed envelope verified (0.25 ACH): Low outdoor infiltration lets your ${String(input.cadrM3Hr)} m3/h purifier hold mitigated indoor PM2.5 at ${String(indoor.dailyMeanMitigatedPm25)} ug/m3 (-${String(indoor.exposureReductionPct)}% 24h cut).`,
  };

  const basePm = String(indoor.dailyMeanBaselinePm25);
  const fuelAlerts: Readonly<Record<CookingFuelType, string>> = {
    'solid-biomass': `Severe indoor combustion alert (9,500 ug/h — Biomass/wood): Unfiltered cooking smoke drives baseline indoor PM2.5 to ${basePm} ug/m3 during 07:00–08:00 & 19:00–20:00 meals. Vent outdoors and transition to induction/LPG.`,
    'lpg-unvented': `Unvented LPG combustion alert (1,900 ug/h PM2.5 + NO2): Gas burners without a chimney spike baseline indoor PM2.5 (${basePm} ug/m3) and emit airway-irritating NO2; use an exhaust fan or induction.`,
    'lpg-vented': `Vented LPG active (650 ug/h residual aerosol): Hood captures primary plume, leaving ${basePm} ug/m3 baseline indoor PM2.5; run purifier on turbo during meal hours.`,
    induction: `Zero-combustion cooking verified (150 ug/h — Induction): Eliminates indoor NO2/CO gas plumes, keeping baseline indoor PM2.5 down at ${basePm} ug/m3.`,
  };

  return [sealAlerts[input.tightness], fuelAlerts[input.cookingFuel], ...t.mythAlertBullets];
}

/**
 * Resolves live, physics-coupled Corsi-Rosenthal DIY specs, envelope/combustion verification
 * alerts, and window-sealing/cooking-fuel matched winter plant recommendations.
 */
export function resolveDynamicIndoorGuidance(
  input: PlanRequestPayload,
  indoor: IndoorClearanceSummary,
  t: LocaleDictionary,
): DynamicIndoorGuidance {
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

  return {
    infiltrationAch,
    cookingEmissionUgHr,
    envelopeCadrSurcharge,
    fuelCadrSurcharge,
    effectiveTargetCadr,
    cadrDelta,
    crBoxesNeeded,
    diySpecSummary: buildDiySummaryText({
      input,
      indoor,
      envelopeSurcharge: envelopeCadrSurcharge,
      fuelSurcharge: fuelCadrSurcharge,
      effectiveTargetCadr,
      crBoxesNeeded,
    }),
    diyActionChecklist: [
      resolveDiySealStep(input.tightness, envelopeCadrSurcharge),
      resolveDiyFuelStep(input.cookingFuel, fuelCadrSurcharge),
    ],
    physicsAlerts: buildPhysicsAlerts(input, indoor, envelopeCadrSurcharge, t),
    winterPlants: [
      SEAL_PLANT_BY_TIGHTNESS[input.tightness],
      FUEL_PLANT_BY_FUEL[input.cookingFuel],
      ...SECONDARY_PLANTS,
    ],
  };
}
