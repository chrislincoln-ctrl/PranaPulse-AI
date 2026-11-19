import {
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';

export interface FirePlumeSummary {
  readonly hotspots500km: number;
  readonly isSeasonalBaseline: boolean;
  readonly summary: string;
}

const NORTH_INDIA_MIN_LAT = 21;
const STUBBLE_SEASON_BASELINE_HOTSPOTS = 42;
const GENERAL_BASELINE_HOTSPOTS = 6;
const WINTER_MONTH_START = 9;
const WINTER_MONTH_END = 1;
const FIRMS_DAY_WINDOW = 2;
const FIRMS_SENSORS = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'] as const;

async function fetchFirmsSensorCount(
  areaBox: string,
  apiKey: string,
  sensor: string,
): Promise<number | null> {
  const url = `${UPSTREAM_ENDPOINTS.NASA_FIRMS_BASE}/${encodeURIComponent(apiKey)}/${sensor}/${areaBox}/${String(FIRMS_DAY_WINDOW)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      return null;
    }
    const text = (await resp.text()).trim();
    const lines = text.length > 0 ? text.split(/\r?\n/) : [];
    const header = lines[0]?.toLowerCase() ?? '';
    if (!header.startsWith('lat')) {
      return null;
    }
    return Math.max(0, lines.length - 1);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryLiveFirmsCsv(
  lat: number,
  lon: number,
  apiKey: string,
  fallback: FirePlumeSummary,
): Promise<FirePlumeSummary> {
  const deg = VALIDATION_BOUNDS.FIRMS_BOX_RADIUS_DEG;
  const west = Math.max(SECURITY_LIMITS.MIN_LONGITUDE, lon - deg);
  const east = Math.min(SECURITY_LIMITS.MAX_LONGITUDE, lon + deg);
  const south = Math.max(SECURITY_LIMITS.MIN_LATITUDE, lat - deg);
  const north = Math.min(SECURITY_LIMITS.MAX_LATITUDE, lat + deg);
  const areaBox = `${String(west)},${String(south)},${String(east)},${String(north)}`;
  let hadValidZero = false;

  for (const sensor of FIRMS_SENSORS) {
    const hotspots = await fetchFirmsSensorCount(areaBox, apiKey, sensor);
    if (hotspots !== null && hotspots > 0) {
      const label = sensor.replace('_NRT', '').replace('_', ' ');
      return {
        hotspots500km: hotspots,
        isSeasonalBaseline: false,
        summary: `Live NASA FIRMS (${label}) detected ${String(hotspots)} thermal anomalies within 500 km (48h).`,
      };
    }
    if (hotspots === 0) {
      hadValidZero = true;
    }
  }

  return hadValidZero
    ? {
        hotspots500km: 0,
        isSeasonalBaseline: false,
        summary: 'Live NASA FIRMS VIIRS/MODIS detected 0 thermal anomalies within 500 km (48h).',
      }
    : fallback;
}

/**
 * Computes seasonal biomass fire baseline or fetches live NASA FIRMS VIIRS/MODIS 48h anomalies
 * within a 500 km atmospheric transport radius when `NASA_FIRMS_MAP_KEY` is provided.
 */
export async function fetchFirePlume(
  lat: number,
  lon: number,
  apiKey: string | undefined,
): Promise<FirePlumeSummary> {
  const month = new Date().getUTCMonth();
  const isWinterStubbleZone =
    lat >= NORTH_INDIA_MIN_LAT && (month >= WINTER_MONTH_START || month <= WINTER_MONTH_END);
  const seasonalCount = isWinterStubbleZone
    ? STUBBLE_SEASON_BASELINE_HOTSPOTS
    : GENERAL_BASELINE_HOTSPOTS;
  const fallback: FirePlumeSummary = {
    hotspots500km: seasonalCount,
    isSeasonalBaseline: true,
    summary: `[Seasonal Baseline Model] ~${String(seasonalCount)} regional biomass plume anomalies estimated within 500 km.`,
  };

  if (!apiKey) {
    return fallback;
  }

  return await queryLiveFirmsCsv(lat, lon, apiKey, fallback);
}

