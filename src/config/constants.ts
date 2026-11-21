/**
 * Centralized immutable configuration constants for PranaPulse AI.
 * Eliminates magic numbers across domain physics, server security, and telemetry caches.
 */

/** Service identity metadata. */
export const APP_META = {
  NAME: 'pranapulse-ai',
  DISPLAY_NAME: 'PranaPulse AI',
  VERSION: '1.0.0',
  DEFAULT_GEMINI_MODEL: 'gemini-3.8-flash',
  GEMINI_FALLBACK_MODELS: [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
  ],
  DEFAULT_GROQ_MODEL: 'qwen/qwen3.8-27b',
  GROQ_FALLBACK_MODELS: ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
} as const;

/** HTTP security, rate limiting, and upstream resiliency budgets. */
export const SECURITY_LIMITS = {
  JSON_BODY_LIMIT: '16kb',
  UPSTREAM_TIMEOUT_MS: 6_000,
  GEMINI_REQUEST_TIMEOUT_MS: 8_000,
  TELEMETRY_RATE_LIMIT_PER_MIN: 60,
  AI_RATE_LIMIT_PER_MIN: 10,
  CHAT_RATE_LIMIT_PER_MIN: 30,
  RATE_WINDOW_MS: 60_000,
  MAX_CHAT_QUERY_CHARS: 500,
  COORDINATE_PRECISION_DECIMALS: 2,
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
  DEFAULT_PORT: 8080,
  MIN_PORT: 1,
  MAX_PORT: 65_535,
} as const;

/** Cache TTL budgets (milliseconds). */
export const CACHE_TTL_MS = {
  AQI_MS: 15 * 60 * 1_000,
  PLAN_MS: 30 * 60 * 1_000,
  GEOCODING_MS: 60 * 60 * 1_000,
  FIRMS_MS: 60 * 60 * 1_000,
} as const;

/** Upstream API base URLs (never interpolated with unvalidated input). */
export const UPSTREAM_ENDPOINTS = {
  OPEN_METEO_AIR_QUALITY: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  OPEN_METEO_WEATHER: 'https://api.open-meteo.com/v1/forecast',
  OPEN_METEO_GEOCODING: 'https://geocoding-api.open-meteo.com/v1/search',
  NOMINATIM_REVERSE: 'https://nominatim.openstreetmap.org/reverse',
  WAQI_BASE: 'https://api.waqi.info/feed',
  OPENAQ_V3_BASE: 'https://api.openaq.org/v3',
  NASA_FIRMS_BASE: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
  GROQ_CHAT_COMPLETIONS: 'https://api.groq.com/openai/v1/chat/completions',
  TELEGRAM_API_BASE: 'https://api.telegram.org',
} as const;

/** Standard HTTP status codes used consistently across Express handlers. */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;

/** Default accessible UI touch target minimum size (pixels, WCAG 2.2 AA). */
export const A11Y_CONSTANTS = {
  MIN_TOUCH_TARGET_PX: 44,
  SEVERE_AQI_ALERT_THRESHOLD: 300,
} as const;

/** Input validation, spatial cache, and upstream query boundaries. */
export const VALIDATION_BOUNDS = {
  MIN_CITY_QUERY_LEN: 1,
  MAX_CITY_QUERY_LEN: 80,
  MAX_CACHE_ENTRIES: 250,
  GEOCODE_FETCH_COUNT: 12,
  GEOCODE_RETURN_LIMIT: 8,
  MIN_ROOM_AREA_M2: 4,
  MAX_ROOM_AREA_M2: 500,
  MAX_CADR_M3_HR: 2_500,
  MAX_COMMUTE_KM: 150,
  MIN_FAMILY_MEMBERS: 1,
  MAX_FAMILY_MEMBERS: 6,
  MIN_HOUSEHOLDS: 1,
  MAX_HOUSEHOLDS: 5_000,
  MAX_DAILY_HOURS: 24,
  MIN_ROUTINE_ITEMS: 4,
  MAX_ROUTINE_ITEMS: 6,
  MIN_HACK_ITEMS: 3,
  MAX_HACK_ITEMS: 4,
  MIN_SWAP_ITEMS: 2,
  MAX_SWAP_ITEMS: 4,
  FIRMS_BOX_RADIUS_DEG: 4.5, // ~500 km atmospheric transport radius
  FORECAST_HOURS_SLICE: 24,
  AQI_CONFLICT_DELTA_TOLERANCE: 35,
  GEMINI_TEMPERATURE: 0.2,
  DECIMAL_BASE: 10,
  ASCII_CONTROL_MAX: 0x1f,
  ASCII_DEL: 0x7f,
} as const;

export interface CityPreset {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lon: number;
  readonly fallbackPm25: number;
}

/** Major winter-smog and reference global cities for 1-click preset loading. */
export const CITY_PRESETS: readonly CityPreset[] = [
  {
    id: 'delhi',
    name: 'New Delhi',
    region: 'Delhi NCR',
    countryCode: 'IN',
    lat: 28.61,
    lon: 77.21,
    fallbackPm25: 196,
  },
  {
    id: 'lucknow',
    name: 'Lucknow',
    region: 'Uttar Pradesh',
    countryCode: 'IN',
    lat: 26.85,
    lon: 80.95,
    fallbackPm25: 164,
  },
  {
    id: 'patna',
    name: 'Patna',
    region: 'Bihar',
    countryCode: 'IN',
    lat: 25.59,
    lon: 85.14,
    fallbackPm25: 158,
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    region: 'West Bengal',
    countryCode: 'IN',
    lat: 22.57,
    lon: 88.36,
    fallbackPm25: 132,
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    region: 'Maharashtra',
    countryCode: 'IN',
    lat: 19.08,
    lon: 72.88,
    fallbackPm25: 84,
  },
  {
    id: 'chennai',
    name: 'Chennai',
    region: 'Tamil Nadu',
    countryCode: 'IN',
    lat: 13.08,
    lon: 80.27,
    fallbackPm25: 48,
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    region: 'Karnataka',
    countryCode: 'IN',
    lat: 12.97,
    lon: 77.59,
    fallbackPm25: 42,
  },
  {
    id: 'london',
    name: 'London',
    region: 'United Kingdom',
    countryCode: 'GB',
    lat: 51.51,
    lon: -0.13,
    fallbackPm25: 18,
  },
] as const;
