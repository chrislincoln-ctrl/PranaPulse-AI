import {
  APP_META,
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import { fetchJsonWithTimeout } from './cacheAndLimiter.js';

interface NominatimAddress {
  readonly suburb?: string;
  readonly neighbourhood?: string;
  readonly residential?: string;
  readonly city_district?: string;
  readonly village?: string;
  readonly town?: string;
  readonly city?: string;
  readonly municipality?: string;
  readonly state_district?: string;
  readonly state?: string;
}

interface NominatimReverseResponse {
  readonly name?: string;
  readonly address?: NominatimAddress;
}

interface BigDataCloudResponse {
  readonly locality?: string;
  readonly city?: string;
  readonly principalSubdivision?: string;
}

export const COARSE_ACCURACY_METERS = 1_500;
const MODERATE_ACCURACY_METERS = 300;
const REVERSE_ZOOM_CITY = 10;
const REVERSE_ZOOM_TOWN = 12;
const REVERSE_ZOOM_NEIGHBORHOOD = 16;
const USER_AGENT_HEADER = { 'User-Agent': `${APP_META.DISPLAY_NAME}/${APP_META.VERSION}` };
const BIGDATACLOUD_REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const PRECISE_LOCALITY_KEYS: readonly (keyof NominatimAddress)[] = [
  'suburb',
  'neighbourhood',
  'residential',
  'village',
  'town',
];
const TOWN_LOCALITY_KEYS: readonly (keyof NominatimAddress)[] = ['town', 'city_district', 'suburb'];
const CITY_KEYS: readonly (keyof NominatimAddress)[] = [
  'city',
  'municipality',
  'state_district',
  'state',
];

function resolveZoomLevel(accuracyMeters?: number): number {
  if (typeof accuracyMeters !== 'number' || !Number.isFinite(accuracyMeters)) {
    return REVERSE_ZOOM_NEIGHBORHOOD;
  }
  if (accuracyMeters > COARSE_ACCURACY_METERS) {
    return REVERSE_ZOOM_CITY;
  }
  return accuracyMeters > MODERATE_ACCURACY_METERS ? REVERSE_ZOOM_TOWN : REVERSE_ZOOM_NEIGHBORHOOD;
}

function pickAddressField(
  addr: NominatimAddress | undefined,
  keys: readonly (keyof NominatimAddress)[],
): string {
  if (!addr) {
    return '';
  }
  for (const key of keys) {
    const val = addr[key]?.trim();
    if (val) {
      return val;
    }
  }
  return '';
}

function joinLocalityAndCity(locality: string, city: string): string | null {
  if (!city) {
    return locality || null;
  }
  if (!locality || locality.toLowerCase() === city.toLowerCase()) {
    return city;
  }
  return `${locality}, ${city}`;
}

function isCoarseAccuracy(accuracyMeters?: number): boolean {
  return typeof accuracyMeters === 'number' && accuracyMeters > COARSE_ACCURACY_METERS;
}

function formatBoundedLabel(locality: string, city: string, coarse: boolean): string | null {
  const label = coarse && city ? city : joinLocalityAndCity(locality, city);
  const cleaned = label ? sanitizeUserText(label, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) : '';
  return cleaned.length > 0 ? cleaned : null;
}

function formatNominatimLocality(
  data: NominatimReverseResponse,
  accuracyMeters?: number,
): string | null {
  const city = pickAddressField(data.address, CITY_KEYS)
    .replace(/^Greater\s+/i, '')
    .trim();
  const isModerate =
    typeof accuracyMeters === 'number' && accuracyMeters > MODERATE_ACCURACY_METERS;
  const localityKeys = isModerate ? TOWN_LOCALITY_KEYS : PRECISE_LOCALITY_KEYS;
  const locality = pickAddressField(data.address, localityKeys) || (data.name ?? '').trim();
  return formatBoundedLabel(locality, city, isCoarseAccuracy(accuracyMeters));
}

async function reverseGeocodeBigDataCloud(
  lat: number,
  lon: number,
  accuracyMeters?: number,
): Promise<string | null> {
  try {
    const url = `${BIGDATACLOUD_REVERSE}?latitude=${String(lat)}&longitude=${String(lon)}&localityLanguage=en`;
    const json = await fetchJsonWithTimeout<BigDataCloudResponse>(
      url,
      SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
    );
    const city = (json.city ?? json.principalSubdivision ?? '').trim();
    const locality = (json.locality ?? '').trim();
    return formatBoundedLabel(locality, city, isCoarseAccuracy(accuracyMeters));
  } catch {
    return null;
  }
}

/**
 * Resolves GPS coordinates into an accuracy-matched locality/city label via OpenStreetMap
 * Nominatim with automatic BigDataCloud fallback (no API key required).
 */
export async function reverseGeocodeCoords(
  lat: number,
  lon: number,
  accuracyMeters?: number,
): Promise<string | null> {
  const zoom = resolveZoomLevel(accuracyMeters);
  try {
    const url = `${UPSTREAM_ENDPOINTS.NOMINATIM_REVERSE}?format=jsonv2&lat=${String(lat)}&lon=${String(lon)}&zoom=${String(zoom)}&accept-language=en`;
    const json = await fetchJsonWithTimeout<NominatimReverseResponse>(
      url,
      SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
      USER_AGENT_HEADER,
    );
    const formatted = formatNominatimLocality(json, accuracyMeters);
    if (formatted) {
      return formatted;
    }
  } catch {
    // Fall through to BigDataCloud backup when Nominatim rate-limits or times out.
  }
  return await reverseGeocodeBigDataCloud(lat, lon, accuracyMeters);
}
