import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { loadServerEnv } from '../../server/env.js';
import { fetchOpenAqStation, normalizeOpenAqUnitToUgM3 } from '../../server/services/openAqClient.js';
import { clearTelemetryCaches } from '../../server/services/telemetryClients.js';
import { invokeExpress } from '../helpers/invokeExpress.js';

function makeHourlyArray(len: number, val: number): number[] {
  return Array.from({ length: len }, () => val);
}

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

describe('OpenAQ API v3 ground-sensor client & hybrid telemetry merge', () => {
  afterEach(() => {
    clearTelemetryCaches();
    vi.restoreAllMocks();
  });

  it('normalizes ug/m3, mg/m3, ppm, and ppb accurately and rejects invalid units or values', () => {
    expect(normalizeOpenAqUnitToUgM3('pm25', 142.5, 'µg/m³')).toBe(142.5);
    expect(normalizeOpenAqUnitToUgM3('pm10', 210, 'μg/m3')).toBe(210);
    expect(normalizeOpenAqUnitToUgM3('co', 2.4, 'mg/m³')).toBe(2_400);

    // 25 deg C / 1 atm molar volume = 24.45 L/mol
    expect(normalizeOpenAqUnitToUgM3('co', 1, 'ppm')).toBeCloseTo((28.01 / 24.45) * 1_000, 2);
    expect(normalizeOpenAqUnitToUgM3('no2', 50, 'ppb')).toBeCloseTo((50 * 46.01) / 24.45, 2);
    expect(normalizeOpenAqUnitToUgM3('o3', 0.06, 'ppm')).toBeCloseTo(
      ((0.06 * 48.0) / 24.45) * 1_000,
      2,
    );
    expect(normalizeOpenAqUnitToUgM3('so2', 10, 'ppb')).toBeCloseTo((10 * 64.07) / 24.45, 2);

    // Reject negative, non-finite, unrecognized units, and ppm/ppb for particulate matter
    expect(normalizeOpenAqUnitToUgM3('pm25', -5, 'µg/m³')).toBeNull();
    expect(normalizeOpenAqUnitToUgM3('pm25', Number.NaN, 'µg/m³')).toBeNull();
    expect(normalizeOpenAqUnitToUgM3('pm25', Number.POSITIVE_INFINITY, 'µg/m³')).toBeNull();
    expect(normalizeOpenAqUnitToUgM3('pm25', 50, 'ppb')).toBeNull();
    expect(normalizeOpenAqUnitToUgM3('pm10', 1, 'ppm')).toBeNull();
    expect(normalizeOpenAqUnitToUgM3('no2', 25, 'particles/cm³')).toBeNull();
    expect(normalizeOpenAqUnitToUgM3('so2', 10, undefined)).toBeNull();
  });

  it('prefers reference-grade monitors (isMonitor === true), sends X-API-Key, and maps latest sensor values', async () => {
    const nowMs = Date.parse('2026-11-21T12:00:00Z');
    const freshUtc = '2026-11-21T11:30:00Z';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = getRequestUrl(input);
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.['X-API-Key']).toBe('oaq-test-key');

      if (url.includes('/v3/locations?')) {
        expect(url).toContain('coordinates=28.61,77.21');
        expect(url).toContain('radius=25000');
        expect(url).toContain('limit=5');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 101,
                  name: 'Neighborhood Low-Cost Node',
                  isMonitor: false,
                  distance: 400,
                  sensors: [{ id: 1001, parameter: { name: 'pm25', units: 'µg/m³' } }],
                },
                {
                  id: 202,
                  name: 'ITO, Delhi - CPCB',
                  isMonitor: true,
                  distance: 2_300,
                  sensors: [
                    { id: 2001, parameter: { name: 'pm25', units: 'µg/m³' } },
                    { id: 2002, parameter: { name: 'no2', units: 'ppb' } },
                    { id: 2003, parameter: { name: 'co', units: 'mg/m³' } },
                  ],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      if (url.includes('/v3/locations/202/latest')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                { sensorsId: 2001, value: 185.4, datetime: { utc: freshUtc } },
                { sensorsId: 2002, value: 40, datetime: { utc: freshUtc } },
                { sensorsId: 2003, value: 1.8, datetime: { utc: freshUtc } },
                { sensorsId: 2001, value: -99, datetime: { utc: '2026-11-21T11:45:00Z' } },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const reading = await fetchOpenAqStation(28.61, 77.21, 'oaq-test-key', nowMs);
    expect(reading).not.toBeNull();
    expect(reading?.stationId).toBe(202);
    expect(reading?.stationName).toBe('ITO, Delhi - CPCB');
    expect(reading?.isMonitor).toBe(true);
    expect(reading?.pollutants.pm25UgM3).toBe(185.4);
    expect(reading?.pollutants.no2UgM3).toBeCloseTo((40 * 46.01) / 24.45, 2);
    expect(reading?.pollutants.coUgM3).toBe(1_800);
    expect(reading?.pollutants.o3UgM3).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects readings older than 3 hours and falls through to the next candidate station', async () => {
    const nowMs = Date.parse('2026-11-21T12:00:00Z');
    const staleUtc = '2026-11-21T08:30:00Z'; // 3.5 hours old
    const freshUtc = '2026-11-21T10:15:00Z'; // 1.75 hours old

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = getRequestUrl(input);
      if (url.includes('/v3/locations?')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 301,
                  name: 'Stale CPCB Station',
                  isMonitor: true,
                  distance: 1_000,
                  sensors: [{ id: 3001, parameter: { name: 'pm25', units: 'µg/m³' } }],
                },
                {
                  id: 302,
                  name: 'Mandir Marg - DPCC',
                  isMonitor: true,
                  distance: 4_500,
                  sensors: [{ id: 3002, parameter: { name: 'pm25', units: 'µg/m³' } }],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/v3/locations/301/latest')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [{ sensorsId: 3001, value: 310, datetime: { utc: staleUtc } }],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/v3/locations/302/latest')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [{ sensorsId: 3002, value: 144, datetime: { utc: freshUtc } }],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    });

    const reading = await fetchOpenAqStation(28.61, 77.21, 'oaq-key', nowMs);
    expect(reading?.stationId).toBe(302);
    expect(reading?.stationName).toBe('Mandir Marg - DPCC');
    expect(reading?.pollutants.pm25UgM3).toBe(144);
  });

  it('merges partial OpenAQ ground truth over Open-Meteo backfill and syncs current hour PM2.5', async () => {
    const freshUtc = new Date(Date.now() - 20 * 60 * 1_000).toISOString();
    const times = Array.from(
      { length: 24 },
      (_, hr) => `2026-11-21T${String(hr).padStart(2, '0')}:00`,
    );
    const currentIdx = Math.min(new Date().getHours(), 23);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = getRequestUrl(input);
      if (url.includes('air-quality-api.open-meteo.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              hourly: {
                time: times,
                pm2_5: makeHourlyArray(24, 80),
                pm10: makeHourlyArray(24, 140),
                nitrogen_dioxide: makeHourlyArray(24, 52),
                ozone: makeHourlyArray(24, 38),
                sulphur_dioxide: makeHourlyArray(24, 18),
                carbon_monoxide: makeHourlyArray(24, 900),
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('api.open-meteo.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              hourly: {
                time: times,
                boundary_layer_height: makeHourlyArray(24, 260),
                wind_speed_10m: makeHourlyArray(24, 5),
                relative_humidity_2m: makeHourlyArray(24, 72),
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('api.openaq.org/v3/locations?')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 501,
                  name: 'RK Puram, Delhi - DPCC',
                  isMonitor: true,
                  distance: 1_800,
                  sensors: [
                    { id: 5001, parameter: { name: 'pm25', units: 'µg/m³' } },
                    { id: 5002, parameter: { name: 'co', units: 'ppm' } },
                  ],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('api.openaq.org/v3/locations/501/latest')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                { sensorsId: 5001, value: 210, datetime: { utc: freshUtc } },
                { sensorsId: 5002, value: 2, datetime: { utc: freshUtc } },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });

    const app = createApp(loadServerEnv({ NODE_ENV: 'test', OPENAQ_API_KEY: 'oaq-live-key' }));
    const res = await invokeExpress(app, {
      url: '/api/telemetry?lat=28.56&lon=77.18&city=RK%20Puram',
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      isSimulatedFallback: boolean;
      stationName: string | null;
      currentPollutants: {
        pm25UgM3: number;
        pm10UgM3: number;
        no2UgM3: number;
        o3UgM3: number;
        so2UgM3: number;
        coUgM3: number;
      };
      assessment: { cpcbNaqi: number };
      hourlySeries: readonly { pm25UgM3: number; pblMeters: number }[];
    };

    // OpenAQ overrides pm25 & co; Open-Meteo backfills pm10, no2, o3, so2
    expect(body.isSimulatedFallback).toBe(false);
    expect(body.currentPollutants.pm25UgM3).toBe(210);
    expect(body.currentPollutants.coUgM3).toBeCloseTo(((2 * 28.01) / 24.45) * 1_000, 1);
    expect(body.currentPollutants.pm10UgM3).toBe(140);
    expect(body.currentPollutants.no2UgM3).toBe(52);
    expect(body.currentPollutants.o3UgM3).toBe(38);
    expect(body.currentPollutants.so2UgM3).toBe(18);

    // Current hour pm25 synced in hourlySeries while other hours & PBL remain Open-Meteo
    expect(body.hourlySeries[currentIdx]?.pm25UgM3).toBe(210);
    expect(body.hourlySeries[currentIdx]?.pblMeters).toBe(260);
    const otherIdx = currentIdx === 0 ? 1 : 0;
    expect(body.hourlySeries[otherIdx]?.pm25UgM3).toBe(80);

    // CPCB NAQI evaluated on merged pm25=210 (Very Poor: > 300) rather than model pm25=80 (< 200)
    expect(body.assessment.cpcbNaqi).toBeGreaterThan(350);

    // WAQI absent -> stationName falls back to OpenAQ station name
    expect(body.stationName).toBe('RK Puram, Delhi - DPCC');

    // Second call hits 15-min telemetryCache without additional OpenAQ fetches
    const callsAfterFirst = fetchSpy.mock.calls.length;
    const cachedRes = await invokeExpress(app, {
      url: '/api/telemetry?lat=28.56&lon=77.18&city=RK%20Puram',
    });
    expect(cachedRes.status).toBe(200);
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it('degrades cleanly to null on missing API key, HTTP 429 rate limit, or timeout', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Missing key: zero network requests
    expect(await fetchOpenAqStation(28.61, 77.21, undefined)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    // HTTP 429 on /locations
    fetchSpy.mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }));
    expect(await fetchOpenAqStation(28.61, 77.21, 'oaq-key')).toBeNull();

    // HTTP 429 on first candidate /latest stops immediately without hammering second candidate
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 701,
                name: 'Station A',
                isMonitor: true,
                distance: 500,
                sensors: [{ id: 7001, parameter: { name: 'pm25', units: 'µg/m³' } }],
              },
              {
                id: 702,
                name: 'Station B',
                isMonitor: true,
                distance: 1_000,
                sensors: [{ id: 7002, parameter: { name: 'pm25', units: 'µg/m³' } }],
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('Rate limited', { status: 429 }));

    const callsBefore = fetchSpy.mock.calls.length;
    expect(await fetchOpenAqStation(28.61, 77.21, 'oaq-key')).toBeNull();
    expect(fetchSpy.mock.calls.length - callsBefore).toBe(2);

    // Timeout / AbortError
    fetchSpy.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    expect(await fetchOpenAqStation(28.61, 77.21, 'oaq-key')).toBeNull();
  });
});

