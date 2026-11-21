import { UNIT_CONVERSIONS } from '../../src/config/physicsConstants.js';
import type { PollutantKey, PollutantReadingInput } from '../../src/domain/types.js';

const MAX_READING_AGE_MS = 10_800_000; // 3 hours
const MOLAR_VOLUME_25C_L = 24.45; // Ideal gas molar volume at 25 deg C, 1 atm

const GAS_MOLAR_MASS_G_MOL: Readonly<Partial<Record<PollutantKey, number>>> = {
  co: 28.01,
  no2: 46.01,
  o3: 48.0,
  so2: 64.07,
};

const PARAMETER_ALIASES: Readonly<Record<string, PollutantKey>> = {
  pm25: 'pm25',
  'pm2.5': 'pm25',
  pm10: 'pm10',
  no2: 'no2',
  o3: 'o3',
  so2: 'so2',
  co: 'co',
};

const POLLUTANT_FIELDS: Readonly<Record<PollutantKey, keyof PollutantReadingInput>> = {
  pm25: 'pm25UgM3',
  pm10: 'pm10UgM3',
  no2: 'no2UgM3',
  o3: 'o3UgM3',
  so2: 'so2UgM3',
  co: 'coUgM3',
};

export interface OpenAqSensorItem {
  readonly id?: number;
  readonly parameter?: { readonly name?: string; readonly units?: string };
}

export interface OpenAqLatestItem {
  readonly sensorsId?: number;
  readonly sensorId?: number;
  readonly value?: number | null;
  readonly datetime?: { readonly utc?: string };
}

export interface SensorDescriptor {
  readonly parameter: PollutantKey;
  readonly unit: string | undefined;
}

interface ParsedMeasurement {
  readonly parameter: PollutantKey;
  readonly value: number;
  readonly tsMs: number;
  readonly utc: string;
}

export interface FreshReadingSummary {
  readonly pollutants: Partial<PollutantReadingInput>;
  readonly latestUtc: string;
}

function normalizeUnitToken(rawUnit: string | undefined): string {
  if (!rawUnit) {
    return '';
  }
  return rawUnit
    .trim()
    .toLowerCase()
    .replaceAll('\u00b5', 'u')
    .replaceAll('\u03bc', 'u')
    .replaceAll('\u00b3', '3')
    .replace(/\s+/g, '');
}

function convertGasUnitToUgM3(parameter: PollutantKey, value: number, unit: string): number | null {
  const molarMass = GAS_MOLAR_MASS_G_MOL[parameter];
  if (molarMass === undefined) {
    return null;
  }
  if (unit === 'ppb') {
    return (value * molarMass) / MOLAR_VOLUME_25C_L;
  }
  if (unit === 'ppm') {
    return ((value * molarMass) / MOLAR_VOLUME_25C_L) * UNIT_CONVERSIONS.UG_PER_MG;
  }
  return null;
}

/**
 * Converts a finite, non-negative OpenAQ sensor measurement into ug/m^3.
 * Supports ug/m^3, mg/m^3, and ppm/ppb for gaseous pollutants at 25 deg C / 1 atm.
 */
export function normalizeOpenAqUnitToUgM3(
  parameter: PollutantKey,
  value: number,
  rawUnit: string | undefined,
): number | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  const unit = normalizeUnitToken(rawUnit);
  if (unit === 'ug/m3') {
    return value;
  }
  if (unit === 'mg/m3') {
    return value * UNIT_CONVERSIONS.UG_PER_MG;
  }
  return convertGasUnitToUgM3(parameter, value, unit);
}

function parseSensorEntry(sensor: OpenAqSensorItem): readonly [number, SensorDescriptor] | null {
  if (typeof sensor.id !== 'number' || !Number.isFinite(sensor.id)) {
    return null;
  }
  const rawName = sensor.parameter?.name?.trim().toLowerCase() ?? '';
  const paramKey = PARAMETER_ALIASES[rawName];
  if (!paramKey) {
    return null;
  }
  return [sensor.id, { parameter: paramKey, unit: sensor.parameter?.units }];
}

/** Maps OpenAQ sensor IDs from a station metadata response to canonical pollutant descriptors. */
export function mapLocationSensors(
  sensors: readonly OpenAqSensorItem[] | undefined,
): Map<number, SensorDescriptor> {
  const mapped = new Map<number, SensorDescriptor>();
  for (const sensor of sensors ?? []) {
    const entry = parseSensorEntry(sensor);
    if (entry) {
      mapped.set(entry[0], entry[1]);
    }
  }
  return mapped;
}

function parseFreshTimestamp(
  utc: string | undefined,
  nowMs: number,
): { readonly tsMs: number; readonly utc: string } | null {
  if (!utc) {
    return null;
  }
  const tsMs = Date.parse(utc);
  if (!Number.isFinite(tsMs) || nowMs - tsMs > MAX_READING_AGE_MS) {
    return null;
  }
  return { tsMs, utc };
}

function parseFreshMeasurement(
  item: OpenAqLatestItem,
  sensors: ReadonlyMap<number, SensorDescriptor>,
  nowMs: number,
): ParsedMeasurement | null {
  const sensorId = item.sensorsId ?? item.sensorId;
  if (sensorId === undefined || typeof item.value !== 'number') {
    return null;
  }
  const descriptor = sensors.get(sensorId);
  const stamp = parseFreshTimestamp(item.datetime?.utc, nowMs);
  if (!descriptor || !stamp) {
    return null;
  }
  const value = normalizeOpenAqUnitToUgM3(descriptor.parameter, item.value, descriptor.unit);
  return value === null
    ? null
    : { parameter: descriptor.parameter, value, tsMs: stamp.tsMs, utc: stamp.utc };
}

function collectBestByPollutant(
  items: readonly OpenAqLatestItem[],
  sensors: ReadonlyMap<number, SensorDescriptor>,
  nowMs: number,
): Map<PollutantKey, ParsedMeasurement> {
  const best = new Map<PollutantKey, ParsedMeasurement>();
  for (const item of items) {
    const parsed = parseFreshMeasurement(item, sensors, nowMs);
    if (!parsed) {
      continue;
    }
    const prev = best.get(parsed.parameter);
    if (!prev || parsed.tsMs > prev.tsMs) {
      best.set(parsed.parameter, parsed);
    }
  }
  return best;
}

/** Filters `/latest` items to fresh (<= 3h), unit-normalized readings keyed by pollutant field. */
export function extractFreshReadings(
  items: readonly OpenAqLatestItem[] | undefined,
  sensors: ReadonlyMap<number, SensorDescriptor>,
  nowMs: number,
): FreshReadingSummary | null {
  if (!items || items.length === 0) {
    return null;
  }
  const best = collectBestByPollutant(items, sensors, nowMs);
  if (best.size === 0) {
    return null;
  }
  const pollutants: Partial<Record<keyof PollutantReadingInput, number>> = {};
  let newestMs = Number.NEGATIVE_INFINITY;
  let latestUtc = '';
  for (const entry of best.values()) {
    pollutants[POLLUTANT_FIELDS[entry.parameter]] = entry.value;
    if (entry.tsMs > newestMs) {
      newestMs = entry.tsMs;
      latestUtc = entry.utc;
    }
  }
  return { pollutants, latestUtc };
}

