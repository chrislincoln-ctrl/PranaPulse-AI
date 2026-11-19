import {
  APP_META,
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import { fetchJsonWithTimeout } from './cacheAndLimiter.js';

interface NominatimAddress {
  readonly suburb?: string;
  readonly neighbourhood?: string;
  readonly residential?: string;
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

const REVERSE_ZOOM_LOCALITY = 14;
const USER_AGENT_HEADER = { 'User-Agent': `${APP_META.DISPLAY_NAME}/${APP_META.VERSION}` };

const LOCALITY_KEYS: readonly (keyof NominatimAddress)[] = [
  'suburb',
  'neighbourhood',
  'residential',
  'village',
  'town',
];
const CITY_KEYS: readonly (keyof NominatimAddress)[] = [
  'city',
  'municipality',
  'state_district',
  'state',
];

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

function formatNominatimLocality(data: NominatimReverseResponse): string | null {
  const locality = pickAddressField(data.address, LOCALITY_KEYS) || (data.name ?? '').trim();
  const city = pickAddressField(data.address, CITY_KEYS)
    .replace(/^Greater\s+/i, '')
    .trim();
  const label = joinLocalityAndCity(locality, city);
  return label ? label.slice(0, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) : null;
}

/**
 * Resolves exact GPS coordinates into a human-readable neighborhood/city label
 * via free OpenStreetMap Nominatim reverse-geocoding (no API key required).
 */
export async function reverseGeocodeCoords(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `${UPSTREAM_ENDPOINTS.NOMINATIM_REVERSE}?format=jsonv2&lat=${String(lat)}&lon=${String(lon)}&zoom=${String(REVERSE_ZOOM_LOCALITY)}&accept-language=en`;
    const json = await fetchJsonWithTimeout<NominatimReverseResponse>(
      url,
      SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
      USER_AGENT_HEADER,
    );
    return formatNominatimLocality(json);
  } catch {
    return null;
  }
}
