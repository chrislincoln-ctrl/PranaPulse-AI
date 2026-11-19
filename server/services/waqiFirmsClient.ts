import {
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import { quantizeCoord } from '../../src/utils/inputSanitizer.js';
import { fetchJsonWithTimeout } from './cacheAndLimiter.js';
import { COARSE_ACCURACY_METERS, reverseGeocodeCoords } from './reverseGeocoder.js';

export { fetchFirePlume, type FirePlumeSummary } from './firmsClient.js';

export interface AutoLocatedCity {
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly precision?: 'gps' | 'ip';
}

export interface VercelEdgeGeo {
  readonly city?: string | undefined;
  readonly region?: string | undefined;
  readonly lat?: number | undefined;
  readonly lon?: number | undefined;
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

const GEOJS_BASE = 'https://get.geojs.io/v1/ip/geo';
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i;

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

function buildCityRegionLabel(city?: string, region?: string): string | undefined {
  if (city && region && city.toLowerCase() !== region.toLowerCase()) {
    return `${city}, ${region}`;
  }
  return city ?? region;
}

function resolveVercelEdgeLocation(geo?: VercelEdgeGeo): AutoLocatedCity | null {
  if (
    !geo ||
    typeof geo.lat !== 'number' ||
    typeof geo.lon !== 'number' ||
    !Number.isFinite(geo.lat) ||
    !Number.isFinite(geo.lon)
  ) {
    return null;
  }
  return {
    city: cleanStationCityName(buildCityRegionLabel(geo.city, geo.region)),
    lat: quantizeCoord(geo.lat),
    lon: quantizeCoord(geo.lon),
    precision: 'ip',
  };
}

function buildGeoJsEndpoint(clientIp?: string): string {
  const cleaned = clientIp?.trim() ?? '';
  if (cleaned.length > 0 && !PRIVATE_IP_RE.test(cleaned)) {
    return `${GEOJS_BASE}/${encodeURIComponent(cleaned)}.json`;
  }
  return `${GEOJS_BASE}.json`;
}

async function locateViaGeoJs(clientIp?: string): Promise<AutoLocatedCity | null> {
  try {
    const geo = await fetchJsonWithTimeout<GeoJsResponse>(
      buildGeoJsEndpoint(clientIp),
      SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
    );
    const lat = Number(geo.latitude);
    const lon = Number(geo.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return {
      city: cleanStationCityName(buildCityRegionLabel(geo.city, geo.region)),
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

function readHeaderText(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

/** Extracts forwarded client IP and Vercel Edge Geo headers cleanly from an Express request. */
export function extractRequestGeoContext(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string,
): {
  readonly clientIp?: string | undefined;
  readonly vercelGeo?: VercelEdgeGeo | undefined;
} {
  const forwarded = headers['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : remoteAddress;
  const lat = Number(headers['x-vercel-ip-latitude']);
  const lon = Number(headers['x-vercel-ip-longitude']);
  const vercelGeo =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? {
          city: readHeaderText(headers, 'x-vercel-ip-city'),
          region: readHeaderText(headers, 'x-vercel-ip-country-region'),
          lat,
          lon,
        }
      : undefined;
  return { clientIp, vercelGeo };
}

async function resolveGpsCoordsLocation(
  lat: number,
  lon: number,
  accuracy: number | undefined,
  token: string | undefined,
): Promise<AutoLocatedCity> {
  const locality = await reverseGeocodeCoords(lat, lon, accuracy);
  const city =
    locality ?? cleanStationCityName((await fetchWaqiStation(lat, lon, token)).name ?? undefined);
  const isCoarse = typeof accuracy === 'number' && accuracy > COARSE_ACCURACY_METERS;
  return {
    city,
    lat: quantizeCoord(lat),
    lon: quantizeCoord(lon),
    precision: isCoarse ? 'ip' : 'gps',
  };
}

/**
 * Resolves user location by reverse-geocoding browser GPS coordinates using accuracy-aware zoom
 * (Nominatim + BigDataCloud), or falling back to Vercel Edge / client-IP geolocation when GPS is unavailable.
 */
export async function resolveAutoLocation(params: {
  readonly lat?: number | undefined;
  readonly lon?: number | undefined;
  readonly accuracy?: number | undefined;
  readonly clientIp?: string | undefined;
  readonly vercelGeo?: VercelEdgeGeo | undefined;
  readonly token: string | undefined;
}): Promise<AutoLocatedCity | null> {
  if (typeof params.lat === 'number' && typeof params.lon === 'number') {
    return await resolveGpsCoordsLocation(params.lat, params.lon, params.accuracy, params.token);
  }
  return (
    resolveVercelEdgeLocation(params.vercelGeo) ??
    (await locateViaGeoJs(params.clientIp)) ??
    (await locateViaWaqiHere(params.token))
  );
}
