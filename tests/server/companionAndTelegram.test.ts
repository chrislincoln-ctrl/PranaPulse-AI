import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { loadServerEnv } from '../../server/env.js';
import { clearCompanionStore } from '../../server/services/familyCompanionStore.js';
import { clearTelemetryCaches } from '../../server/services/telemetryClients.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { invokeExpress } from '../helpers/invokeExpress.js';

function makeHourly(len: number, val: number): number[] {
  return Array.from({ length: len }, () => val);
}

function resolveFetchUrl(urlArg: string | URL | Request): string {
  if (typeof urlArg === 'string') {
    return urlArg;
  }
  return urlArg instanceof URL ? urlArg.href : urlArg.url;
}

function mockCompanionUpstreamFetch() {
  const times = Array.from(
    { length: 24 },
    (_, hr) => `2026-11-21T${String(hr).padStart(2, '0')}:00`,
  );
  const telegramCalls: { readonly url: string; readonly body: Record<string, unknown> }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation((urlArg, init) => {
    const url = resolveFetchUrl(urlArg);
    if (url.includes('api.telegram.org')) {
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      telegramCalls.push({ url, body });
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }
    if (url.includes('geocoding-api.open-meteo.com')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                name: 'Salt Lake',
                admin1: 'West Bengal',
                country_code: 'IN',
                latitude: 22.58,
                longitude: 88.41,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    }
    if (url.includes('nominatim.openstreetmap.org')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            address: { suburb: 'Park Street', city: 'Kolkata' },
          }),
          { status: 200 },
        ),
      );
    }
    if (url.includes('air-quality-api.open-meteo.com')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            hourly: {
              time: times,
              pm2_5: makeHourly(24, 138),
              pm10: makeHourly(24, 210),
              nitrogen_dioxide: makeHourly(24, 48),
              ozone: makeHourly(24, 34),
              sulphur_dioxide: makeHourly(24, 15),
              carbon_monoxide: makeHourly(24, 1200),
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
              boundary_layer_height: makeHourly(24, 320),
              wind_speed_10m: makeHourly(24, 9),
              relative_humidity_2m: makeHourly(24, 68),
            },
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
  });

  return telegramCalls;
}

describe('Family Companion Chat, Telegram Webhook & Daily Brief Cron', () => {
  afterEach(() => {
    clearCompanionStore();
    clearTelemetryCaches();
    vi.restoreAllMocks();
  });

  it('powers /api/companion/chat with live place lookup, GPS override, and habit learning', async () => {
    mockCompanionUpstreamFetch();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
    });
    const app = createApp(env);

    const health = await invokeExpress(app, { url: '/api/health' });
    expect(health.status).toBe(200);
    expect(
      (health.body as { capabilities: { telegramConfigured: boolean } }).capabilities
        .telegramConfigured,
    ).toBe(true);

    const meera = DEFAULT_WORKSPACE_INPUT.members[1]!;
    const chatRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/chat',
      body: {
        member: meera,
        message: 'I am near Salt Lake right now, mild asthma today, walking 08:00 to 09:00',
        city: 'Kolkata',
        lat: 22.57,
        lon: 88.36,
        language: 'en',
      },
    });

    expect(chatRes.status).toBe(200);
    const body = chatRes.body as {
      resolvedCity: string;
      aqi: number;
      pm25UgM3: number;
      reply: string;
      habitPatch: { leaveHomeTime?: string; returnHomeTime?: string; healthNotes?: string };
      updatedSchedule: { memberId: string; dailyRoutine: readonly unknown[] };
    };
    expect(body.resolvedCity).toBe('Salt Lake');
    expect(body.pm25UgM3).toBe(138);
    expect(body.aqi).toBeGreaterThan(200);
    expect(body.habitPatch.leaveHomeTime).toBe('08:00');
    expect(body.habitPatch.returnHomeTime).toBe('09:00');
    expect(body.habitPatch.healthNotes).toContain('asthma');
    expect(body.reply).toContain('Salt Lake');
    expect(body.updatedSchedule.memberId).toBe(meera.id);
    expect(body.updatedSchedule.dailyRoutine).toHaveLength(4);

    // GPS pin override works cleanly
    const gpsRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/chat',
      body: {
        member: meera,
        message: 'How is the air right here?',
        city: 'Kolkata',
        lat: 22.57,
        lon: 88.36,
        gpsLat: 22.55,
        gpsLon: 88.35,
        language: 'en',
      },
    });
    expect(gpsRes.status).toBe(200);
    expect((gpsRes.body as { resolvedCity: string }).resolvedCity).toContain('Park Street');

    // Invalid payload returns 400
    const bad = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/chat',
      body: { message: '' },
    });
    expect(bad.status).toBe(400);
  });

  it('enforces Telegram webhook secret, links members via /start, handles GPS pins & runs daily cron', async () => {
    const telegramCalls = mockCompanionUpstreamFetch();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'super-secret-webhook',
      CRON_SECRET: 'super-secret-cron',
    });
    const app = createApp(env);

    // 1. Generate 1-tap Telegram link for Aarav
    const aarav = DEFAULT_WORKSPACE_INPUT.members[0]!;
    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: {
        member: aarav,
        city: 'New Delhi',
        lat: 28.61,
        lon: 77.21,
        language: 'en',
      },
    });
    expect(linkRes.status).toBe(200);
    const linkBody = linkRes.body as {
      linkCode: string;
      deepLinkUrl: string;
      telegramConfigured: boolean;
    };
    expect(linkBody.telegramConfigured).toBe(true);
    expect(linkBody.deepLinkUrl).toBe(`https://t.me/PranaPulseBot?start=${linkBody.linkCode}`);

    // 2. Reject invalid webhook secret with 403
    const badWebhook = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' },
      body: { message: { chat: { id: 9911 }, text: '/start' } },
    });
    expect(badWebhook.status).toBe(403);

    // 3. Pair via /start <linkCode>
    const startWebhook = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'super-secret-webhook' },
      body: {
        message: { chat: { id: 9911 }, text: `/start ${linkBody.linkCode}` },
      },
    });
    expect(startWebhook.status).toBe(200);
    expect((startWebhook.body as { handled: string; replyText: string }).handled).toBe('start');
    expect((startWebhook.body as { replyText: string }).replyText).toContain('Linked to Aarav');

    // 4. Native Telegram GPS location pin check-in
    const gpsWebhook = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'super-secret-webhook' },
      body: {
        message: {
          chat: { id: 9911 },
          location: { latitude: 22.55, longitude: 88.35 },
        },
      },
    });
    expect(gpsWebhook.status).toBe(200);
    expect((gpsWebhook.body as { replyText: string }).replyText).toContain('Park Street');

    // 5. Inline button callback ("schedule")
    const cbWebhook = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'super-secret-webhook' },
      body: {
        callback_query: {
          id: 'cb-1',
          data: 'schedule',
          message: { chat: { id: 9911 } },
        },
      },
    });
    expect(cbWebhook.status).toBe(200);
    expect((cbWebhook.body as { replyText: string }).replyText).toContain('PranaPulse Daily Air Brief');

    // 6. Daily brief cron rejects missing/invalid secret
    const unauthCron = await invokeExpress(app, {
      method: 'GET',
      url: '/api/telegram/daily-brief',
    });
    expect(unauthCron.status).toBe(401);

    // 7. Daily brief cron fans out to linked Aarav with valid CRON_SECRET
    const okCron = await invokeExpress(app, {
      method: 'GET',
      url: '/api/telegram/daily-brief',
      headers: { authorization: 'Bearer super-secret-cron' },
    });
    expect(okCron.status).toBe(200);
    expect(okCron.body).toEqual({ ok: true, sentCount: 1, skippedCount: 0 });
    expect(telegramCalls.some((c) => c.url.includes('/sendMessage'))).toBe(true);
    expect(telegramCalls.some((c) => c.url.includes('/answerCallbackQuery'))).toBe(true);
  });
});
