import {
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import { quantizeCoord } from '../../src/utils/inputSanitizer.js';
import { fetchJsonWithTimeout } from './cacheAndLimiter.js';
import { reverseGeocodeCoords } from './reverseGeocoder.js';

export { fetchFirePlume, type FirePlumeSummary } from './firmsClient.js';

export interface AutoLocatedCity {
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly precision?: 'gps' | 'ip';
}

interface WaqiResponse {
  readonly status?: string;
  readonly data?: {
    readonly aqi?: number | string;
    readonly city?: {
      readonly name?: string;
      readonly geo?: readonly number[];
    };
  };
}

interface GeoJsResponse {
  readonly city?: string;
  readonly region?: string;
  readonly latitude?: string | number;
  readonly longitude?: string | number;
}

const GEOJS_ENDPOINT = 'https://get.geojs.io/v1/ip/geo.json';

function cleanStationCityName(raw: string | undefined): string {
  if (!raw || raw.trim().length === 0) {
    return 'Local Area Monitor';
  }
  const cleaned = raw.replace(/,\s*India$/i, '').trim();
  return (cleaned || 'Local Area Monitor').slice(0, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
}

function parseWaqiPayload(json: WaqiResponse): {
  readonly aqi: number | null;
  readonly name: string | null;
} {
  if (json.status !== 'ok') {
    return { aqi: null, name: null };
  }
  const numeric = Number(json.data?.aqi);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { aqi: null, name: null };
  }
  return { aqi: numeric, name: json.data?.city?.name ?? 'WAQI Station' };
}

/**
 * Fetches optional live WAQI ground monitoring station telemetry near quantized coordinates.
 * Degrades gracefully when no token is configured or the upstream service is unreachable.
 */
export async function fetchWaqiStation(
  lat: number,
  lon: number,
  token: string | undefined,
): Promise<{ readonly aqi: number | null; readonly name: string | null }> {
  if (!token) {
    return { aqi: null, name: null };
  }
  try {
    const url = `${UPSTREAM_ENDPOINTS.WAQI_BASE}/geo:${String(lat)};${String(lon)}/?token=${encodeURIComponent(token)}`;
    const json = await fetchJsonWithTimeout<WaqiResponse>(url, SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS);
    return parseWaqiPayload(json);
  } catch {
    return { aqi: null, name: null };
  }
}

async function locateViaGeoJs(): Promise<AutoLocatedCity | null> {
  try {
    const geo = await fetchJsonWithTimeout<GeoJsResponse>(
      GEOJS_ENDPOINT,
      SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
    );
    const lat = Number(geo.latitude);
    const lon = Number(geo.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    const rawLabel =
      geo.city && geo.region && geo.city.toLowerCase() !== geo.region.toLowerCase()
        ? `${geo.city}, ${geo.region}`
        : (geo.city ?? geo.region);
    return {
      city: cleanStationCityName(rawLabel),
      lat: quantizeCoord(lat),
      lon: quantizeCoord(lon),
      precision: 'ip',
    };
  } catch {
    return null;
  }
}

function extractGeoPair(json: WaqiResponse): readonly [number, number] | null {
  const geo = json.data?.city?.geo;
  if (json.status !== 'ok' || !Array.isArray(geo)) {
    return null;
  }
  const lat = Number(geo[0]);
  const lon = Number(geo[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

function parseWaqiGeoLocation(json: WaqiResponse): AutoLocatedCity | null {
  const pair = extractGeoPair(json);
  if (!pair) {
    return null;
  }
  return {
    city: cleanStationCityName(json.data?.city?.name),
    lat: quantizeCoord(pair[0]),
    lon: quantizeCoord(pair[1]),
    precision: 'ip',
  };
}

async function locateViaWaqiHere(token: string | undefined): Promise<AutoLocatedCity | null> {
  if (!token) {
    return null;
  }
  try {
    const url = `${UPSTREAM_ENDPOINTS.WAQI_BASE}/here/?token=${encodeURIComponent(token)}`;
    const json = await fetchJsonWithTimeout<WaqiResponse>(url, SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS);
    return parseWaqiGeoLocation(json);
  } catch {
    return null;
  }
}

/**
 * Resolves user location by reverse-geocoding browser GPS coordinates to the actual neighborhood
 * first (via Nominatim), or falling back to IP geolocation + WAQI station lookup when browser GPS is unavailable.
 */
export async function resolveAutoLocation(params: {
  readonly lat?: number | undefined;
  readonly lon?: number | undefined;
  readonly token: string | undefined;
}): Promise<AutoLocatedCity | null> {
  if (typeof params.lat === 'number' && typeof params.lon === 'number') {
    const locality = await reverseGeocodeCoords(params.lat, params.lon);
    const city =
      locality ??
      cleanStationCityName(
        (await fetchWaqiStation(params.lat, params.lon, params.token)).name ?? undefined,
      );
    return {
      city,
      lat: quantizeCoord(params.lat),
      lon: quantizeCoord(params.lon),
      precision: 'gps',
    };
  }
  return (await locateViaGeoJs()) ?? (await locateViaWaqiHere(params.token));
}
