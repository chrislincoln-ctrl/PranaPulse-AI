import {
  HTTP_STATUS,
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import type { PollutantReadingInput } from '../../src/domain/types.js';
import { fetchJsonWithTimeout } from './cacheAndLimiter.js';
import {
  extractFreshReadings,
  mapLocationSensors,
  type OpenAqLatestItem,
  type OpenAqSensorItem,
  type SensorDescriptor,
} from './openAqNormalizer.js';

export { normalizeOpenAqUnitToUgM3 } from './openAqNormalizer.js';

const OPENAQ_SEARCH_RADIUS_M = 25_000;
const OPENAQ_LOCATION_LIMIT = 5;

interface OpenAqLocationItem {
  readonly id?: number;
  readonly name?: string;
  readonly locality?: string | null;
  readonly isMonitor?: boolean;
  readonly distance?: number | null;
  readonly sensors?: readonly OpenAqSensorItem[];
}

interface CandidateStation {
  readonly id: number;
  readonly name: string;
  readonly isMonitor: boolean;
  readonly distanceMeters: number;
  readonly sensors: ReadonlyMap<number, SensorDescriptor>;
}

/** Normalized fresh ground-sensor readings retrieved from OpenAQ API v3. */
export interface OpenAqStationReading {
  readonly stationId: number;
  readonly stationName: string;
  readonly isMonitor: boolean;
  readonly distanceMeters: number;
  readonly pollutants: Partial<PollutantReadingInput>;
  readonly latestUtc: string;
}

function pickNonEmptyText(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function parseDistanceMeters(rawDist: number | null | undefined): number {
  return typeof rawDist === 'number' && Number.isFinite(rawDist) && rawDist >= 0
    ? rawDist
    : Number.POSITIVE_INFINITY;
}

function toCandidateStation(loc: OpenAqLocationItem): CandidateStation | null {
  if (typeof loc.id !== 'number' || !Number.isFinite(loc.id)) {
    return null;
  }
  const sensors = mapLocationSensors(loc.sensors);
  if (sensors.size === 0) {
    return null;
  }
  const label =
    pickNonEmptyText(loc.name) ?? pickNonEmptyText(loc.locality) ?? 'OpenAQ Ground Station';
  return {
    id: loc.id,
    name: label.slice(0, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN),
    isMonitor: loc.isMonitor === true,
    distanceMeters: parseDistanceMeters(loc.distance),
    sensors,
  };
}

function compareCandidates(a: CandidateStation, b: CandidateStation): number {
  if (a.isMonitor !== b.isMonitor) {
    return a.isMonitor ? -1 : 1;
  }
  return a.distanceMeters - b.distanceMeters;
}

function buildSortedCandidates(
  results: readonly OpenAqLocationItem[] | undefined,
): readonly CandidateStation[] {
  const candidates: CandidateStation[] = [];
  for (const loc of results ?? []) {
    const candidate = toCandidateStation(loc);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  return candidates.sort(compareCandidates);
}

function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(`HTTP ${String(HTTP_STATUS.TOO_MANY_REQUESTS)}`)
  );
}

async function fetchCandidateLatest(
  candidate: CandidateStation,
  headers: Readonly<Record<string, string>>,
  nowMs: number,
): Promise<OpenAqStationReading | null> {
  const url = `${UPSTREAM_ENDPOINTS.OPENAQ_V3_BASE}/locations/${String(candidate.id)}/latest`;
  const payload = await fetchJsonWithTimeout<{ readonly results?: readonly OpenAqLatestItem[] }>(
    url,
    SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
    headers,
  );
  const fresh = extractFreshReadings(payload.results, candidate.sensors, nowMs);
  return fresh
    ? {
        stationId: candidate.id,
        stationName: candidate.name,
        isMonitor: candidate.isMonitor,
        distanceMeters: candidate.distanceMeters,
        pollutants: fresh.pollutants,
        latestUtc: fresh.latestUtc,
      }
    : null;
}

/**
 * Fetches live ground-sensor pollutant readings from OpenAQ API v3 within 25 km,
 * preferring reference-grade monitors (`isMonitor === true`) and fresh readings (<= 3h).
 * Degrades cleanly to `null` on missing key, HTTP 429, timeout, or stale/missing stations.
 */
export async function fetchOpenAqStation(
  lat: number,
  lon: number,
  apiKey: string | undefined,
  nowMs: number = Date.now(),
): Promise<OpenAqStationReading | null> {
  if (!apiKey) {
    return null;
  }
  const headers: Readonly<Record<string, string>> = {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
  const locationsUrl = `${UPSTREAM_ENDPOINTS.OPENAQ_V3_BASE}/locations?coordinates=${String(lat)},${String(lon)}&radius=${String(OPENAQ_SEARCH_RADIUS_M)}&limit=${String(OPENAQ_LOCATION_LIMIT)}`;

  let candidates: readonly CandidateStation[];
  try {
    const locData = await fetchJsonWithTimeout<{
      readonly results?: readonly OpenAqLocationItem[];
    }>(locationsUrl, SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS, headers);
    candidates = buildSortedCandidates(locData.results);
  } catch {
    return null;
  }

  for (const candidate of candidates) {
    try {
      const reading = await fetchCandidateLatest(candidate, headers, nowMs);
      if (reading) {
        return reading;
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        return null;
      }
    }
  }
  return null;
}
