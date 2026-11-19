import {
  CACHE_TTL_MS,
  CITY_PRESETS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import { quantizeCoord } from '../../src/validators/schemas.js';
import { BoundedTtlCache, fetchJsonWithTimeout } from './cacheAndLimiter.js';

export interface GeocodedLocation {
  readonly name: string;
  readonly region: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lon: number;
}

interface OpenMeteoGeocodeResponse {
  readonly results?: readonly {
    readonly name?: string;
    readonly admin1?: string;
    readonly country_code?: string;
    readonly latitude?: number;
    readonly longitude?: number;
  }[];
}

const geocodeCache = new BoundedTtlCache<readonly GeocodedLocation[]>(CACHE_TTL_MS.GEOCODING_MS);

/**
 * Queries Open-Meteo Geocoding with India-prioritized ranking and 1-hour spatial caching.
 * Falls back cleanly to curated metro presets when offline.
 *
 * @param rawQuery - Sanitized user search query.
 * @returns Ranked matching urban locations with 2-decimal quantized coordinates.
 */
export async function searchUrbanLocations(rawQuery: string): Promise<readonly GeocodedLocation[]> {
  const key = rawQuery.trim().toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const url = `${UPSTREAM_ENDPOINTS.OPEN_METEO_GEOCODING}?name=${encodeURIComponent(key)}&count=${String(VALIDATION_BOUNDS.GEOCODE_FETCH_COUNT)}&language=en&format=json`;
    const data = await fetchJsonWithTimeout<OpenMeteoGeocodeResponse>(url);
    const parsed: GeocodedLocation[] = (data.results ?? [])
      .filter((item) => typeof item.name === 'string' && typeof item.latitude === 'number')
      .map((item) => ({
        name: item.name ?? 'Unknown',
        region: item.admin1 ?? item.country_code ?? '',
        countryCode: item.country_code ?? '',
        lat: quantizeCoord(item.latitude ?? 0),
        lon: quantizeCoord(item.longitude ?? 0),
      }))
      .sort((a, b) => Number(b.countryCode === 'IN') - Number(a.countryCode === 'IN'))
      .slice(0, VALIDATION_BOUNDS.GEOCODE_RETURN_LIMIT);

    if (parsed.length > 0) {
      geocodeCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // Degrade silently to offline preset matching below.
  }

  return CITY_PRESETS.filter(
    (preset) =>
      preset.name.toLowerCase().includes(key) || preset.region.toLowerCase().includes(key),
  ).map((preset) => ({
    name: preset.name,
    region: preset.region,
    countryCode: preset.countryCode,
    lat: preset.lat,
    lon: preset.lon,
  }));
}

/** Clears cached geocoding lookups for isolated tests. */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}
