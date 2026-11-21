/**
 * UI-specific bounds, chart geometry coordinates, defaults, and quick-query presets.
 * Keeps React components and hooks free of raw magic numbers.
 */

import type { CorridorNodeId, FamilyMemberInput } from '../domain/types.js';
import type { PlanRequestPayload, SupportedLanguage } from '../validators/schemas.js';

export type WorkbenchTabId = 'dashboard' | 'routine' | 'indoor' | 'commute' | 'gear' | 'community';

export const WORKBENCH_TABS: readonly WorkbenchTabId[] = [
  'dashboard',
  'routine',
  'indoor',
  'commute',
  'gear',
  'community',
] as const;

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'hi', 'ta'] as const;

export const UI_TIMINGS = {
  GEOCODE_DEBOUNCE_MS: 280,
  PLAN_DEBOUNCE_MS: 320,
  GEOLOCATION_TIMEOUT_MS: 5000,
  GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS: 10000,
  GEOLOCATION_MAX_AGE_MS: 60000,
  COPY_RESET_MS: 2500,
  MIN_SEARCH_CHARS: 2,
} as const;

export const SLIDER_LIMITS = {
  ROOM_AREA_MIN: 8,
  ROOM_AREA_MAX: 80,
  ROOM_AREA_STEP: 1,
  CADR_MIN: 0,
  CADR_MAX: 800,
  CADR_STEP: 1,
  COMMUTE_KM_MIN: 1,
  COMMUTE_KM_MAX: 40,
  COMMUTE_KM_STEP: 1,
  HOUSEHOLDS_MIN: 10,
  HOUSEHOLDS_MAX: 1000,
  HOUSEHOLDS_STEP: 1,
  TRANSIT_SHIFT_MIN_PCT: 0,
  TRANSIT_SHIFT_MAX_PCT: 100,
  TRANSIT_SHIFT_STEP_PCT: 1,
  MEMBER_OUTDOOR_MAX_HR: 8,
  MEMBER_OUTDOOR_STEP_HR: 0.5,
} as const;

export const CHART_GEOMETRY = {
  WIDTH: 720,
  HEIGHT: 210,
  PAD_LEFT: 44,
  PAD_RIGHT: 44,
  PAD_TOP: 24,
  PAD_BOTTOM: 28,
  AXIS_LABEL_OFFSET: 7,
  TICK_TEXT_DY: 18,
  MAX_HOURS: 24,
  Y_TICKS: 4,
  MIN_PM25_AXIS: 60,
  MIN_PBL_AXIS: 1200,
  PBL_THRESHOLD_LOW: 400,
  DOT_RADIUS: 3.5,
  STROKE_WIDTH: 2.25,
  THIN_STROKE: 1,
} as const;

export const CHART_GRID_RATIOS: readonly number[] = [0.25, 0.5, 0.75] as const;
export const CHART_HOUR_TICKS: readonly number[] = [0, 6, 12, 18, 23] as const;

export interface CorridorNodeLayout {
  readonly id: CorridorNodeId;
  readonly x: number;
  readonly y: number;
  readonly labelPosition: 'above' | 'below';
}

export const CORRIDOR_GRAPH_BOUNDS = {
  WIDTH: 720,
  HEIGHT: 260,
  NODE_RADIUS: 18,
  STROKE_HIGHLIGHT: 4,
  STROKE_BASE: 2,
  LABEL_ABOVE_DY: -26,
  LABEL_BELOW_DY: 34,
  PILL_WIDTH: 148,
  PILL_HEIGHT: 22,
  PILL_OFFSET_Y: 15,
  PILL_RX: 4,
} as const;

export const CORRIDOR_NODE_POSITIONS: readonly CorridorNodeLayout[] = [
  { id: 'home-sector', x: 85, y: 130, labelPosition: 'above' },
  { id: 'arterial-junction', x: 260, y: 68, labelPosition: 'above' },
  { id: 'ring-flyover', x: 460, y: 68, labelPosition: 'above' },
  { id: 'green-parkway', x: 260, y: 192, labelPosition: 'below' },
  { id: 'metro-concourse', x: 460, y: 192, labelPosition: 'below' },
  { id: 'civic-hub', x: 635, y: 130, labelPosition: 'below' },
] as const;

export const DEFAULT_FAMILY_ROSTER: readonly FamilyMemberInput[] = [
  {
    id: 'm1',
    label: 'Aarav (School)',
    role: 'child',
    mask: 'n95-ffp2',
    dailyOutdoorHours: 1.5,
    archetype: 'school-student',
    leaveHomeTime: '07:30',
    returnHomeTime: '14:30',
    commuteMode: 'electric-bus',
    healthNotes: 'Active child; avoid high-exertion outdoor sports when NAQI > 200',
    dailyHabitsNote: 'Morning school bus pickup and afternoon homework indoors',
    telegramDailyBrief: true,
    briefTimeLocal: '06:30',
  },
  {
    id: 'm2',
    label: 'Meera (Senior)',
    role: 'senior-respiratory',
    mask: 'n95-ffp2',
    dailyOutdoorHours: 0.5,
    archetype: 'senior-homebound',
    leaveHomeTime: '13:30',
    returnHomeTime: '14:00',
    commuteMode: 'walking',
    healthNotes: 'Senior asthma sensitivity; keep reliever inhaler nearby',
    dailyHabitsNote: 'Mostly indoors; brief afternoon balcony check only during solar breakup',
    telegramDailyBrief: true,
    briefTimeLocal: '06:30',
  },
  {
    id: 'm3',
    label: 'Rohan (Commuter)',
    role: 'commuter',
    mask: 'surgical',
    dailyOutdoorHours: 2.0,
    archetype: 'office-commuter',
    leaveHomeTime: '08:45',
    returnHomeTime: '19:00',
    commuteMode: 'metro',
    healthNotes: 'Daily transit commuter; switch to N95 on high-smog evenings',
    dailyHabitsNote: 'Morning metro to office and evening return during inversion buildup',
    telegramDailyBrief: true,
    briefTimeLocal: '06:30',
  },
] as const;

export const DEFAULT_WORKSPACE_INPUT: PlanRequestPayload = {
  city: 'New Delhi',
  lat: 28.61,
  lon: 77.21,
  areaM2: 24,
  cadrM3Hr: 250,
  tightness: 'standard',
  cookingFuel: 'lpg-vented',
  commuteDistanceKm: 12,
  commuteMode: 'metro',
  mask: 'n95-ffp2',
  language: 'en',
  householdsParticipating: 120,
  transitShiftShare: 0.5,
  haltLeafBurning: true,
  members: [...DEFAULT_FAMILY_ROSTER],
};

export const POLLUTANT_SAFE_CEILINGS = {
  PM25: 250,
  PM10: 400,
  NO2: 180,
  O3: 180,
  SO2: 120,
  CO: 4000,
  MIN_BAR_PCT: 6,
} as const;

export const RADIAL_GAUGE_GEOMETRY = {
  VIEWBOX_SIZE: 100,
  CENTER: 50,
  OUTER_RADIUS: 41,
  INNER_RADIUS: 30,
  STROKE_OUTER: 7.5,
  STROKE_INNER: 5.5,
  TICK_COUNT: 8,
  TICK_OUTER_R: 23,
  TICK_INNER_R: 19,
  DEG_TO_RAD: Math.PI / 180,
  FULL_CIRCLE_DEG: 360,
  START_ANGLE_DEG: -90,
  CIRCUMFERENCE_OUTER: 257.61,
  CIRCUMFERENCE_INNER: 188.5,
  MAX_AQI_SCALE: 500,
  MAX_ACH_SCALE: 8,
  DEFAULT_SIZE_PX: 68,
  COMPACT_SIZE_PX: 56,
} as const;

export const AQI_SPECTRUM_BANDS = [
  { key: 'good', range: '0-50', tone: 'bg-band-good', border: 'border-band-good' },
  {
    key: 'satisfactory',
    range: '51-100',
    tone: 'bg-band-satisfactory',
    border: 'border-band-satisfactory',
  },
  { key: 'moderate', range: '101-200', tone: 'bg-band-moderate', border: 'border-band-moderate' },
  { key: 'poor', range: '201-300', tone: 'bg-band-poor', border: 'border-band-poor' },
  {
    key: 'very-poor',
    range: '301-400',
    tone: 'bg-band-very-poor',
    border: 'border-band-very-poor',
  },
  { key: 'severe', range: '401+', tone: 'bg-band-severe', border: 'border-band-severe' },
] as const;

export const PRECISION_DISPLAY = {
  PBL_KM_DIVISOR: 1000,
  PERCENT_MULTIPLIER: 100,
  RADIX: 36,
  ID_SLICE_START: 2,
  ID_SLICE_END: 7,
  AQI_CAUTION_THRESHOLD: 101,
  AQI_POOR_THRESHOLD: 201,
  DEFAULT_BASE_HOURS: 24,
} as const;

export type InversionSimulationMode = 'severe' | 'clean';

export const SMOG_SIMULATION_PARAMS = {
  SEVERE_PARTICLE_COUNT: 75,
  CLEAN_PARTICLE_COUNT: 18,
  SEVERE_CEILING_RATIO: 0.38,
  CLEAN_CEILING_RATIO: 0.95,
  MIN_RADIUS: 14,
  MAX_RADIUS_SEVERE: 54,
  MAX_RADIUS_CLEAN: 24,
  BASE_ALPHA_SEVERE: 0.28,
  BASE_ALPHA_CLEAN: 0.08,
  SPEED_MIN: 0.15,
  SPEED_MAX: 0.45,
  BROWNIAN_JITTER: 0.08,
  CANVAS_HEIGHT: 320,
  CANVAS_MOBILE_HEIGHT: 260,
  SEVERE_AQI: 380,
  CLEAN_AQI: 45,
  SEVERE_PBL_METERS: 220,
  CLEAN_PBL_METERS: 1200,
  SEVERE_PM25: 185,
  CLEAN_PM25: 12,
  SEVERE_VISIBILITY_METERS: 350,
  CLEAN_VISIBILITY_METERS: 5000,
  PULSE_BASE: 0.02,
  PULSE_SPAN: 0.03,
  PULSE_AMP: 0.25,
  DECIMAL_PLACES: 3,
  GRADIENT_STOP_MID: 0.5,
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 320,
} as const;
