import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { loadServerEnv, type ServerEnv } from '../../server/env.js';
import { planCityCorridor } from '../../server/services/corridorPlanner.js';
import { verifyCustomOption } from '../../server/services/customOptionVerifier.js';
import { fetchFirePlume } from '../../server/services/firmsClient.js';
import { requestGroqCustomVerifyText } from '../../server/services/groqCustomVerifier.js';
import {
  clearHouseholdWorkspaceStore,
  syncWorkspaceFromWeb,
} from '../../server/services/householdWorkspaceStore.js';
import { routeTelegramCommand } from '../../server/services/telegramCommandRouter.js';
import { runDailyBriefFanout } from '../../server/services/telegramDailyBrief.js';
import {
  handleMemberSwitch,
  handleRoleCommand,
} from '../../server/services/telegramMemberCommands.js';
import {
  handleAddMemberCommand,
  handleCityCommand,
  handleFuelCommand,
  handleMaskUpdate,
  handleRoomOrCadr,
  handleRwaCommand,
} from '../../server/services/telegramWorkspaceCommands.js';
import {
  extractRequestGeoContext,
  fetchWaqiStation,
  resolveAutoLocation,
} from '../../server/services/waqiFirmsClient.js';

const BASE_ENV: ServerEnv = loadServerEnv({ NODE_ENV: 'test' });

describe('Custom verifiers, corridor planner, WAQI/FIRMS geolocation & Telegram commands', () => {
  afterEach(() => {
    clearHouseholdWorkspaceStore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('calls Groq custom verifier cleanly and handles valid JSON, HTTP error, network failure, and unconfigured key', async () => {
    expect(await requestGroqCustomVerifyText('test', BASE_ENV)).toBeNull();

    const envWithGroq: ServerEnv = { ...BASE_ENV, GROQ_API_KEY: 'groq-test-key' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isValid: true,
                    mappedValue: 'solid-biomass',
                    displayLabel: 'Biogas Stove',
                    explanation: 'Biogas maps cleanly.',
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const verified = await verifyCustomOption(
      { category: 'cookingFuel', customText: 'biogas stove', language: 'en' },
      envWithGroq,
    );
    expect(verified.isValid).toBe(true);
    expect(verified.displayLabel).toBe('Biogas Stove');
    // Cached hit
    const cached = await verifyCustomOption(
      { category: 'cookingFuel', customText: 'biogas stove', language: 'en' },
      envWithGroq,
    );
    expect(cached).toEqual(verified);

    // Invalid short text
    const shortRes = await verifyCustomOption(
      { category: 'role', customText: 'a', language: 'en' },
      BASE_ENV,
    );
    expect(shortRes.isValid).toBe(false);

    // HTTP failure and rejected JSON -> falls back deterministically
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('err', { status: 503 })));
    const fallbackRes = await verifyCustomOption(
      { category: 'role', customText: 'asthma patient', language: 'en' },
      envWithGroq,
    );
    expect(fallbackRes.isValid).toBe(true);
    expect(fallbackRes.mappedValue).toBe('senior-respiratory');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')));
    expect(await requestGroqCustomVerifyText('x', envWithGroq)).toBeNull();
  });

  it('plans directional corridors, rejects gibberish/identical endpoints, and builds localized surface/metro fallbacks', async () => {
    const invalid = await planCityCorridor(
      { city: 'Kolkata', fromArea: '12345', toArea: 'pizza', commuteMode: 'metro', language: 'en' },
      BASE_ENV,
    );
    expect(invalid.isValid).toBe(false);

    const same = await planCityCorridor(
      { city: 'Kolkata', fromArea: 'Garia', toArea: 'Garia', commuteMode: 'metro', language: 'en' },
      BASE_ENV,
    );
    expect(same.isValid).toBe(false);

    const kolkataDir = await planCityCorridor(
      {
        city: 'Kolkata',
        fromArea: 'Garia',
        toArea: 'Park Street',
        commuteMode: 'metro',
        language: 'en',
      },
      BASE_ENV,
    );
    expect(kolkataDir.isValid).toBe(true);
    expect(kolkataDir.nodeLabels['home-sector']).toContain('Garia');

    const customCity = await planCityCorridor(
      {
        city: 'Jaipur',
        fromArea: 'Malviya Nagar',
        toArea: 'MI Road',
        commuteMode: 'cycling',
        language: 'hi',
      },
      BASE_ENV,
    );
    expect(customCity.isValid).toBe(true);
    expect(customCity.googleMapsUrl).toContain('google.com/maps/dir');
  });

  it('parses WAQI stations, FIRMS fire plumes, Vercel Edge headers, GeoJS IP fallback, and GPS reverse geocoding', async () => {
    expect(await fetchWaqiStation(28.61, 77.21, undefined)).toEqual({ aqi: null, name: null });
    expect(await fetchFirePlume(28.61, 77.21, undefined)).toMatchObject({
      isSeasonalBaseline: true,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes('waqi') && url.includes('/geo:')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'ok',
                data: { aqi: 210, city: { name: 'Ballygunge, India' } },
              }),
              { status: 200 },
            ),
          );
        }
        if (url.includes('waqi') && url.includes('/here/')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'ok',
                data: { city: { name: 'Salt Lake, India', geo: [22.58, 88.41] } },
              }),
              { status: 200 },
            ),
          );
        }
        if (url.includes('geojs.io')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                city: 'Patna',
                region: 'Bihar',
                latitude: '25.59',
                longitude: '85.14',
              }),
              { status: 200 },
            ),
          );
        }
        if (url.includes('firms.modaps')) {
          const csv = [
            'latitude,longitude,bright_ti4,frp',
            '28.70,77.10,330.2,45.5',
            '28.90,77.30,320.1,30.0',
          ].join('\n');
          return Promise.resolve(new Response(csv, { status: 200 }));
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      }),
    );

    const waqi = await fetchWaqiStation(22.53, 88.36, 'tok');
    expect(waqi).toEqual({ aqi: 210, name: 'Ballygunge, India' });

    const plume = await fetchFirePlume(28.61, 77.21, 'firms-key');
    expect(plume.isSeasonalBaseline).toBe(false);
    expect(plume.hotspots500km).toBe(2);

    const ctx = extractRequestGeoContext(
      {
        'x-forwarded-for': '203.0.113.5, 10.0.0.1',
        'x-vercel-ip-city': 'New%20Delhi',
        'x-vercel-ip-country-region': 'Delhi',
        'x-vercel-ip-latitude': '28.6139',
        'x-vercel-ip-longitude': '77.2090',
      },
      '127.0.0.1',
    );
    expect(ctx.clientIp).toBe('203.0.113.5');
    const edgeLoc = await resolveAutoLocation({ ...ctx, token: 'tok' });
    expect(edgeLoc?.city).toContain('New Delhi');

    const geoJsLoc = await resolveAutoLocation({ clientIp: '203.0.113.5', token: undefined });
    expect(geoJsLoc?.city).toBe('Patna, Bihar');

    const gpsLoc = await resolveAutoLocation({
      lat: 22.53,
      lon: 88.36,
      accuracy: 2500,
      token: 'tok',
    });
    expect(gpsLoc?.precision).toBe('ip');
    expect(gpsLoc?.city).toBe('Ballygunge');
  });

  it('executes Telegram member, role, mask, city, room/cadr, fuel, addmember, rwa, router, and daily brief commands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes('api.telegram.org')) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        }
        if (url.includes('geocoding-api.open-meteo.com')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                results: [
                  {
                    name: 'Pune',
                    admin1: 'Maharashtra',
                    country_code: 'IN',
                    latitude: 18.52,
                    longitude: 73.85,
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(new Response('{}', { status: 500 }));
      }),
    );

    const ws = await syncWorkspaceFromWeb(
      { workspaceKey: 'tgcmd1', payload: DEFAULT_WORKSPACE_INPUT },
      BASE_ENV,
    );
    const linkedWs = { ...ws, telegramChatId: 'chat-42', telegramOptIn: true };

    expect((await handleMemberSwitch('2', linkedWs, BASE_ENV)).text).toContain(
      'Switched active user',
    );
    expect((await handleMemberSwitch('unknown-person-xyz', linkedWs, BASE_ENV)).text).toContain(
      'Who is chatting',
    );
    expect((await handleRoleCommand('', linkedWs, BASE_ENV)).text).toContain(
      'Current vulnerability profile',
    );
    expect((await handleRoleCommand('college student', linkedWs, BASE_ENV)).text).toContain(
      'Synced',
    );
    expect(
      (await handleRoleCommand('flying banana', linkedWs, BASE_ENV)).text.length,
    ).toBeGreaterThan(10);

    expect((await handleMaskUpdate('surgical', linkedWs, BASE_ENV)).text).toContain('surgical');
    expect((await handleMaskUpdate('invalidmask', linkedWs, BASE_ENV)).text.length).toBeGreaterThan(
      10,
    );
    expect((await handleCityCommand('Pune', linkedWs, BASE_ENV)).text).toContain('Pune');
    expect((await handleCityCommand('', linkedWs, BASE_ENV)).text).toContain('Could not find');
    expect((await handleRoomOrCadr('room', '32', linkedWs, BASE_ENV)).text).toContain(
      'Indoor settings updated',
    );
    expect((await handleRoomOrCadr('cadr', '450', linkedWs, BASE_ENV)).text).toContain(
      'Indoor settings updated',
    );
    expect((await handleRoomOrCadr('indoor', '28 380', linkedWs, BASE_ENV)).text).toContain(
      'Indoor settings updated',
    );
    expect((await handleFuelCommand('induction', linkedWs, BASE_ENV)).text).toContain(
      'Indoor settings updated',
    );
    expect((await handleFuelCommand('unknown', linkedWs, BASE_ENV)).text.length).toBeGreaterThan(
      10,
    );
    expect((await handleAddMemberCommand('', linkedWs, BASE_ENV)).text).toContain('Usage:');
    expect(
      (await handleAddMemberCommand('Priya | child | n95', linkedWs, BASE_ENV)).text,
    ).toContain('Added Priya');
    expect((await handleRwaCommand('180 65', linkedWs, BASE_ENV)).text).toContain(
      'RWA simulator updated',
    );

    const routedControls = await routeTelegramCommand('/controls', linkedWs, BASE_ENV);
    expect(routedControls?.text).toContain('PranaPulse Telegram Operating Hub');
    const routedUnknown = await routeTelegramCommand('hello there', linkedWs, BASE_ENV);
    expect(routedUnknown).toBeNull();

    const fanout = await runDailyBriefFanout({
      ...BASE_ENV,
      TELEGRAM_BOT_TOKEN: 'bot-token',
    });
    expect(fanout.sentCount).toBeGreaterThanOrEqual(1);
  });
});
