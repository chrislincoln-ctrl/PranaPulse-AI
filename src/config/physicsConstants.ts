/**
 * Peer-reviewed atmospheric physics constants, CPCB NAQI & US-EPA 2024 breakpoints,
 * pulmonary minute ventilation rates, and indoor CONTAM mass-balance parameters.
 */

export interface BreakpointRow {
  readonly cLow: number;
  readonly cHigh: number;
  readonly iLow: number;
  readonly iHigh: number;
}

export const UNIT_CONVERSIONS = {
  HOURS_PER_DAY: 24,
  MINUTES_PER_HOUR: 60,
  SECONDS_PER_HOUR: 3_600,
  METERS_PER_KM: 1_000,
  KMH_TO_MS: 3.6,
  UG_PER_MG: 1_000,
  DECIMAL_ROUND_TEN: 10,
  DECIMAL_ROUND_HUNDRED: 100,
} as const;

export const WHO_2021_LIMITS = {
  PM25_ANNUAL_UG_M3: 5,
  PM25_24H_UG_M3: 15,
  PM10_24H_UG_M3: 45,
  NO2_24H_UG_M3: 25,
} as const;

export const BERKELEY_EARTH = {
  PM25_UG_M3_PER_CIGARETTE: 22,
} as const;

export const INVERSION_THRESHOLDS = {
  SHALLOW_PBL_METERS: 400,
  CRITICAL_PBL_METERS: 250,
  HIGH_VENTILATION_M2_S: 6_000,
  CRITICAL_VENTILATION_M2_S: 1_500,
  MODERATE_VENTILATION_M2_S: 3_200,
  STAGNANT_WIND_KMH: 5,
  HIGH_RH_HYGROSCOPIC_PCT: 75,
  SAFE_PM25_WINDOW_RATIO: 0.85,
  TOP_WINDOW_COUNT: 3,
} as const;

export const STATION_CROSS_CHECK = {
  DISAGREEMENT_DELTA_AQI: 50,
  MAX_AQI_SCALE: 500,
} as const;

/** CPCB National Air Quality Index (India, 2014). CO is measured in mg/m^3. */
export const CPCB_BREAKPOINTS: Readonly<
  Record<'pm25' | 'pm10' | 'no2' | 'o3' | 'so2' | 'co', readonly BreakpointRow[]>
> = {
  pm25: [
    { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
    { cLow: 30, cHigh: 60, iLow: 51, iHigh: 100 },
    { cLow: 60, cHigh: 90, iLow: 101, iHigh: 200 },
    { cLow: 90, cHigh: 120, iLow: 201, iHigh: 300 },
    { cLow: 120, cHigh: 250, iLow: 301, iHigh: 400 },
    { cLow: 250, cHigh: 500, iLow: 401, iHigh: 500 },
  ],
  pm10: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 100, cHigh: 250, iLow: 101, iHigh: 200 },
    { cLow: 250, cHigh: 350, iLow: 201, iHigh: 300 },
    { cLow: 350, cHigh: 430, iLow: 301, iHigh: 400 },
    { cLow: 430, cHigh: 600, iLow: 401, iHigh: 500 },
  ],
  no2: [
    { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
    { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100 },
    { cLow: 80, cHigh: 180, iLow: 101, iHigh: 200 },
    { cLow: 180, cHigh: 280, iLow: 201, iHigh: 300 },
    { cLow: 280, cHigh: 400, iLow: 301, iHigh: 400 },
    { cLow: 400, cHigh: 600, iLow: 401, iHigh: 500 },
  ],
  o3: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 100, cHigh: 168, iLow: 101, iHigh: 200 },
    { cLow: 168, cHigh: 208, iLow: 201, iHigh: 300 },
    { cLow: 208, cHigh: 748, iLow: 301, iHigh: 400 },
    { cLow: 748, cHigh: 1_000, iLow: 401, iHigh: 500 },
  ],
  so2: [
    { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
    { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100 },
    { cLow: 80, cHigh: 380, iLow: 101, iHigh: 200 },
    { cLow: 380, cHigh: 800, iLow: 201, iHigh: 300 },
    { cLow: 800, cHigh: 1_600, iLow: 301, iHigh: 400 },
    { cLow: 1_600, cHigh: 2_100, iLow: 401, iHigh: 500 },
  ],
  co: [
    { cLow: 0, cHigh: 1, iLow: 0, iHigh: 50 },
    { cLow: 1, cHigh: 2, iLow: 51, iHigh: 100 },
    { cLow: 2, cHigh: 10, iLow: 101, iHigh: 200 },
    { cLow: 10, cHigh: 17, iLow: 201, iHigh: 300 },
    { cLow: 17, cHigh: 34, iLow: 301, iHigh: 400 },
    { cLow: 34, cHigh: 50, iLow: 401, iHigh: 500 },
  ],
} as const;

/** Updated US-EPA 2024 AQI PM2.5 & PM10 breakpoints. */
export const US_EPA_PM_BREAKPOINTS: Readonly<Record<'pm25' | 'pm10', readonly BreakpointRow[]>> = {
  pm25: [
    { cLow: 0, cHigh: 9, iLow: 0, iHigh: 50 },
    { cLow: 9, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.4, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.4, cHigh: 125.4, iLow: 151, iHigh: 200 },
    { cLow: 125.4, cHigh: 225.4, iLow: 201, iHigh: 300 },
    { cLow: 225.4, cHigh: 325.4, iLow: 301, iHigh: 400 },
    { cLow: 325.4, cHigh: 500.4, iLow: 401, iHigh: 500 },
  ],
  pm10: [
    { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
    { cLow: 54, cHigh: 154, iLow: 51, iHigh: 100 },
    { cLow: 154, cHigh: 254, iLow: 101, iHigh: 150 },
    { cLow: 254, cHigh: 354, iLow: 151, iHigh: 200 },
    { cLow: 354, cHigh: 424, iLow: 201, iHigh: 300 },
    { cLow: 424, cHigh: 504, iLow: 301, iHigh: 400 },
    { cLow: 504, cHigh: 604, iLow: 401, iHigh: 500 },
  ],
} as const;

export const INDOOR_MASS_BALANCE = {
  INFILTRATION_ACH: {
    leaky: 1.2,
    standard: 0.55,
    'weather-sealed': 0.25,
  },
  PENETRATION_FACTOR: 0.78,
  DEPOSITION_RATE_HR: 0.35,
  OPEN_WINDOW_ACH_BOOST: 3.2,
  TARGET_ACH_FOR_SIZING: 4.8,
  CLEAR_90_PCT_EFFICIENCY: 0.9,
  DEFAULT_ROOM_HEIGHT_M: 2.9,
  DIY_CORSI_ROSENTHAL_CADR_M3_HR: 380,
  COOKING_PEAK_HOURS: new Set([7, 8, 19, 20]),
  COOKING_SOURCE_UG_HR: {
    induction: 150,
    'lpg-vented': 650,
    'lpg-unvented': 1_900,
    'solid-biomass': 9_500,
  },
} as const;

export const COMMUTE_PHYSICS = {
  /** Micro-environment exposure multiplier & ventilation rate derived from PMC5679559. */
  MODES: {
    metro: {
      ventilationM3Hr: 0.54,
      exposureMultiplier: 0.45,
      speedKmh: 34,
      co2GPerKm: 28,
      tailpipePmMgPerKm: 0.4,
      isActiveOutdoors: false,
    },
    'electric-bus': {
      ventilationM3Hr: 0.54,
      exposureMultiplier: 0.72,
      speedKmh: 22,
      co2GPerKm: 35,
      tailpipePmMgPerKm: 0.6,
      isActiveOutdoors: false,
    },
    'ev-car': {
      ventilationM3Hr: 0.54,
      exposureMultiplier: 0.55,
      speedKmh: 26,
      co2GPerKm: 62,
      tailpipePmMgPerKm: 1.2,
      isActiveOutdoors: false,
    },
    'petrol-car': {
      ventilationM3Hr: 0.54,
      exposureMultiplier: 0.65,
      speedKmh: 26,
      co2GPerKm: 168,
      tailpipePmMgPerKm: 6.8,
      isActiveOutdoors: false,
    },
    'two-wheeler': {
      ventilationM3Hr: 0.72,
      exposureMultiplier: 1.35,
      speedKmh: 28,
      co2GPerKm: 52,
      tailpipePmMgPerKm: 8.5,
      isActiveOutdoors: true,
    },
    cycling: {
      ventilationM3Hr: 2.4,
      exposureMultiplier: 1.15,
      speedKmh: 16,
      co2GPerKm: 0,
      tailpipePmMgPerKm: 0,
      isActiveOutdoors: true,
    },
    walking: {
      ventilationM3Hr: 1.44,
      exposureMultiplier: 1.1,
      speedKmh: 5,
      co2GPerKm: 0,
      tailpipePmMgPerKm: 0,
      isActiveOutdoors: true,
    },
  },
  MASK_FILTRATION: {
    none: 0,
    cloth: 0.25,
    surgical: 0.5,
    'n95-ffp2': 0.9,
  },
  SEVERE_PARADOX_PM25_THRESHOLD: 90,
  DAILY_BASELINE_BREATHING_M3: 15,
} as const;

export const FAMILY_RISK_WEIGHTS = {
  SENSITIVITY_FACTOR: {
    child: 1.35,
    'senior-respiratory': 1.45,
    commuter: 1.15,
    caregiver: 1.0,
  },
  HIGH_RISK_CPCB_THRESHOLD: 200,
  SEVERE_CPCB_THRESHOLD: 300,
  LEAF_BURNING_AVOIDED_PM25_G_PER_DAY_PER_HOME: 14.5,
  STOVE_SWITCH_CO2_G_PER_DAY_PER_HOME: 820,
  ANNUAL_WORKING_DAYS: 260,
  GRAMS_PER_KG: 1_000,
} as const;

export const CORRIDOR_GRAPH = {
  NODES: [
    'home-sector',
    'arterial-junction',
    'ring-flyover',
    'green-parkway',
    'metro-concourse',
    'civic-hub',
  ],
  EDGES: [
    {
      from: 'home-sector',
      to: 'arterial-junction',
      distanceKm: 2.4,
      pollutionFactor: 1.45,
      minutes: 8,
    },
    {
      from: 'arterial-junction',
      to: 'ring-flyover',
      distanceKm: 3.1,
      pollutionFactor: 1.55,
      minutes: 10,
    },
    { from: 'ring-flyover', to: 'civic-hub', distanceKm: 2.2, pollutionFactor: 1.4, minutes: 7 },
    {
      from: 'home-sector',
      to: 'green-parkway',
      distanceKm: 2.8,
      pollutionFactor: 0.85,
      minutes: 11,
    },
    { from: 'green-parkway', to: 'civic-hub', distanceKm: 5.4, pollutionFactor: 0.82, minutes: 18 },
    {
      from: 'home-sector',
      to: 'metro-concourse',
      distanceKm: 1.4,
      pollutionFactor: 0.9,
      minutes: 6,
    },
    {
      from: 'metro-concourse',
      to: 'civic-hub',
      distanceKm: 7.4,
      pollutionFactor: 0.42,
      minutes: 14,
    },
    {
      from: 'green-parkway',
      to: 'metro-concourse',
      distanceKm: 1.8,
      pollutionFactor: 0.78,
      minutes: 7,
    },
  ],
  DEFAULT_VENTILATION_M3_HR: 0.78,
} as const;
