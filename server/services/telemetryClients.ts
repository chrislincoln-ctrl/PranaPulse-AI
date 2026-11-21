import { CACHE_TTL_MS, UPSTREAM_ENDPOINTS, VALIDATION_BOUNDS } from '../../src/config/constants.js';
import { UNIT_CONVERSIONS } from '../../src/config/physicsConstants.js';
import {
  evaluatePollutantStandards,
  evaluateStationCrossCheck,
} from '../../src/domain/aqiStandards.js';
import { analyzeInversionSchedule } from '../../src/domain/inversionModel.js';
import { buildSeasonalHourlySeries, SEASONAL_DEFAULTS } from '../../src/domain/localBaseline.js';
import type { HourlyAtmosPoint, PollutantReadingInput } from '../../src/domain/types.js';
import { quantizeCoord } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { BoundedTtlCache, fetchJsonWithTimeout } from './cacheAndLimiter.js';
import { clearGeocodeCache } from './geocodingClient.js';
import { fetchOpenAqStation, type OpenAqStationReading } from './openAqClient.js';
import { fetchFirePlume, fetchWaqiStation, type FirePlumeSummary } from './waqiFirmsClient.js';

export { searchUrbanLocations, type GeocodedLocation } from './geocodingClient.js';

export interface TelemetryBundle {
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly isSimulatedFallback: boolean;
  readonly currentPollutants: PollutantReadingInput;
  readonly assessment: ReturnType<typeof evaluatePollutantStandards>;
  readonly stationCrossCheck: ReturnType<typeof evaluateStationCrossCheck>;
  readonly stationName: string | null;
  readonly inversion: ReturnType<typeof analyzeInversionSchedule>;
  readonly firePlume: FirePlumeSummary;
  readonly hourlySeries: readonly HourlyAtmosPoint[];
}

interface OpenMeteoAqResponse {
  readonly hourly?: {
    readonly time?: readonly string[];
    readonly pm2_5?: readonly (number | null)[];
    readonly pm10?: readonly (number | null)[];
    readonly nitrogen_dioxide?: readonly (number | null)[];
    readonly ozone?: readonly (number | null)[];
    readonly sulphur_dioxide?: readonly (number | null)[];
    readonly carbon_monoxide?: readonly (number | null)[];
  };
}

interface OpenMeteoWxResponse {
  readonly hourly?: {
    readonly time?: readonly string[];
    readonly boundary_layer_height?: readonly (number | null)[];
    readonly wind_speed_10m?: readonly (number | null)[];
    readonly relative_humidity_2m?: readonly (number | null)[];
  };
}

interface UpstreamTelemetryStreams {
  readonly aqData: OpenMeteoAqResponse | null;
  readonly wxData: OpenMeteoWxResponse | null;
  readonly waqi: { readonly aqi: number | null; readonly name: string | null };
  readonly openAq: OpenAqStationReading | null;
  readonly firePlume: FirePlumeSummary;
}

const DEFAULT_PM25 = 148;
const PM10_TO_PM25_RATIO = 1.4;
const DEFAULT_BASELINE_FIRES = 6;

const telemetryCache = new BoundedTtlCache<TelemetryBundle>(CACHE_TTL_MS.AQI_MS);

function metricAt(
  arr: readonly (number | null)[] | undefined,
  idx: number,
  fallback: number,
): number {
  const val = arr?.[idx];
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : fallback;
}

function extractHourOfDay(isoTime: string | undefined, fallbackIdx: number): number {
  const timePart = isoTime?.split('T')[1];
  const parsed = timePart
    ? Number.parseInt(timePart.slice(0, 2), VALIDATION_BOUNDS.DECIMAL_BASE)
    : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallbackIdx % UNIT_CONVERSIONS.HOURS_PER_DAY;
}

function buildLiveHourlySeries(
  aq: OpenMeteoAqResponse,
  wx: OpenMeteoWxResponse,
): readonly HourlyAtmosPoint[] {
  const times = aq.hourly?.time ?? [];
  const count = Math.min(VALIDATION_BOUNDS.FORECAST_HOURS_SLICE, times.length);
  if (count === 0) {
    return buildSeasonalHourlySeries(DEFAULT_PM25);
  }
  return Array.from({ length: count }, (_, i) => {
    const hourIso = times[i] ?? `T${String(i).padStart(2, '0')}:00`;
    return {
      hourIso,
      hourOfDay: extractHourOfDay(hourIso, i),
      pm25UgM3: metricAt(aq.hourly?.pm2_5, i, DEFAULT_PM25),
      pblMeters: metricAt(wx.hourly?.boundary_layer_height, i, SEASONAL_DEFAULTS.PBL_LOW),
      windKmh: metricAt(wx.hourly?.wind_speed_10m, i, SEASONAL_DEFAULTS.WIND_LOW),
      rhPercent: metricAt(wx.hourly?.relative_humidity_2m, i, SEASONAL_DEFAULTS.RH_HIGH),
    };
  });
}

function extractPollutantSnapshot(
  aqHourly: OpenMeteoAqResponse['hourly'],
  idx: number,
  currentPm25: number,
): PollutantReadingInput {
  return {
    pm25UgM3: currentPm25,
    pm10UgM3: metricAt(aqHourly?.pm10, idx, Math.round(currentPm25 * PM10_TO_PM25_RATIO)),
    no2UgM3: metricAt(aqHourly?.nitrogen_dioxide, idx, SEASONAL_DEFAULTS.WIND_HIGH * 2),
    o3UgM3: metricAt(aqHourly?.ozone, idx, SEASONAL_DEFAULTS.RH_LOW),
    so2UgM3: metricAt(aqHourly?.sulphur_dioxide, idx, SEASONAL_DEFAULTS.WIND_HIGH),
    coUgM3: metricAt(aqHourly?.carbon_monoxide, idx, UNIT_CONVERSIONS.UG_PER_MG),
  };
}

function mergeOpenAqPollutants(
  base: PollutantReadingInput,
  openAq: OpenAqStationReading | null,
): PollutantReadingInput {
  if (!openAq) {
    return base;
  }
  return {
    pm25UgM3: openAq.pollutants.pm25UgM3 ?? base.pm25UgM3,
    pm10UgM3: openAq.pollutants.pm10UgM3 ?? base.pm10UgM3,
    no2UgM3: openAq.pollutants.no2UgM3 ?? base.no2UgM3,
    o3UgM3: openAq.pollutants.o3UgM3 ?? base.o3UgM3,
    so2UgM3: openAq.pollutants.so2UgM3 ?? base.so2UgM3,
    coUgM3: openAq.pollutants.coUgM3 ?? base.coUgM3,
  };
}

function patchCurrentHourPm25(
  series: readonly HourlyAtmosPoint[],
  currentIdx: number,
  openAqPm25: number | undefined,
): readonly HourlyAtmosPoint[] {
  if (openAqPm25 === undefined) {
    return series;
  }
  return series.map((pt, idx) => (idx === currentIdx ? { ...pt, pm25UgM3: openAqPm25 } : pt));
}

async function fetchAllTelemetryStreams(
  lat: number,
  lon: number,
  env: ServerEnv,
): Promise<UpstreamTelemetryStreams> {
  const aqUrl = `${UPSTREAM_ENDPOINTS.OPEN_METEO_AIR_QUALITY}?latitude=${String(lat)}&longitude=${String(lon)}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,us_aqi,european_aqi&timezone=auto&forecast_days=2`;
  const wxUrl = `${UPSTREAM_ENDPOINTS.OPEN_METEO_WEATHER}?latitude=${String(lat)}&longitude=${String(lon)}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,boundary_layer_height,surface_pressure&timezone=auto&forecast_days=2`;

  const [aqSettled, wxSettled, waqiSettled, openAqSettled, firmsSettled] = await Promise.allSettled(
    [
      fetchJsonWithTimeout<OpenMeteoAqResponse>(aqUrl),
      fetchJsonWithTimeout<OpenMeteoWxResponse>(wxUrl),
      fetchWaqiStation(lat, lon, env.WAQI_API_TOKEN),
      fetchOpenAqStation(lat, lon, env.OPENAQ_API_KEY),
      fetchFirePlume(lat, lon, env.NASA_FIRMS_MAP_KEY),
    ],
  );

  return {
    aqData: aqSettled.status === 'fulfilled' ? aqSettled.value : null,
    wxData: wxSettled.status === 'fulfilled' ? wxSettled.value : null,
    waqi: waqiSettled.status === 'fulfilled' ? waqiSettled.value : { aqi: null, name: null },
    openAq: openAqSettled.status === 'fulfilled' ? openAqSettled.value : null,
    firePlume:
      firmsSettled.status === 'fulfilled'
        ? firmsSettled.value
        : {
            hotspots500km: DEFAULT_BASELINE_FIRES,
            isSeasonalBaseline: true,
            summary: '[Seasonal Baseline Model] Regional fire telemetry degraded safely.',
          },
  };
}

function resolveBaseSeries(streams: UpstreamTelemetryStreams): {
  readonly isLive: boolean;
  readonly rawSeries: readonly HourlyAtmosPoint[];
  readonly currentIdx: number;
  readonly currentPm25: number;
} {
  const hasOpenMeteo = streams.aqData !== null && streams.wxData !== null;
  const rawSeries =
    streams.aqData && streams.wxData
      ? buildLiveHourlySeries(streams.aqData, streams.wxData)
      : buildSeasonalHourlySeries(DEFAULT_PM25);
  const currentIdx = Math.min(new Date().getHours(), rawSeries.length - 1);
  const currentPm25 = rawSeries[currentIdx]?.pm25UgM3 ?? DEFAULT_PM25;
  return {
    isLive: hasOpenMeteo || streams.openAq !== null,
    rawSeries,
    currentIdx,
    currentPm25,
  };
}

function assembleTelemetryBundle(
  lat: number,
  lon: number,
  cityLabel: string | undefined,
  streams: UpstreamTelemetryStreams,
): TelemetryBundle {
  const { isLive, rawSeries, currentIdx, currentPm25 } = resolveBaseSeries(streams);
  const modelPollutants = extractPollutantSnapshot(streams.aqData?.hourly, currentIdx, currentPm25);
  const currentPollutants = mergeOpenAqPollutants(modelPollutants, streams.openAq);
  const hourlySeries = patchCurrentHourPm25(
    rawSeries,
    currentIdx,
    streams.openAq?.pollutants.pm25UgM3,
  );
  const assessment = evaluatePollutantStandards(currentPollutants);

  return {
    city: cityLabel ?? `Sector (${String(lat)}, ${String(lon)})`,
    lat,
    lon,
    isSimulatedFallback: !isLive,
    currentPollutants,
    assessment,
    stationCrossCheck: evaluateStationCrossCheck(assessment.cpcbNaqi, streams.waqi.aqi),
    stationName: streams.waqi.name ?? streams.openAq?.stationName ?? null,
    inversion: analyzeInversionSchedule(hourlySeries, currentIdx),
    firePlume: streams.firePlume,
    hourlySeries,
  };
}

/**
 * Fetches live atmospheric pollutants, weather PBL inversion height, optional WAQI station
 * cross-check, and FIRMS fire detections in parallel with 15-minute quantized caching.
 *
 * @param params - Location coordinates, label, and optional external API env tokens.
 * @returns Full verified atmospheric bundle ready for deterministic exposure modeling.
 */
export async function getUrbanTelemetryBundle(params: {
  lat: number;
  lon: number;
  cityLabel?: string | undefined;
  env: ServerEnv;
}): Promise<TelemetryBundle> {
  const lat = quantizeCoord(params.lat);
  const lon = quantizeCoord(params.lon);
  const cacheKey = `${String(lat)}:${String(lon)}`;
  const cached = telemetryCache.get(cacheKey);
  if (cached) {
    return params.cityLabel ? { ...cached, city: params.cityLabel } : cached;
  }

  const streams = await fetchAllTelemetryStreams(lat, lon, params.env);
  const bundle = assembleTelemetryBundle(lat, lon, params.cityLabel, streams);
  telemetryCache.set(cacheKey, bundle);
  return bundle;
}

/** Clears internal telemetry and geocoding caches for deterministic test isolation. */
export function clearTelemetryCaches(): void {
  telemetryCache.clear();
  clearGeocodeCache();
}
