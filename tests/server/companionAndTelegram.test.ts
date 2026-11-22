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
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
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

    // 3. Pair via /start <linkCode> — asks who is chatting and presents 1-tap member buttons
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
    expect((startWebhook.body as { replyText: string }).replyText).toContain('Who is chatting');
    expect((startWebhook.body as { replyText: string }).replyText).toContain('Aarav');
    expect((startWebhook.body as { replyText: string }).replyText).toContain('Meera');

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
    expect((cbWebhook.body as { replyText: string }).replyText).toContain(
      'PranaPulse Daily Air Brief',
    );

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

  it('syncs Kolkata GPS to Telegram, recovers coords on cold start, and syncs Telegram edits back to website', async () => {
    mockCompanionUpstreamFetch();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'sync-secret',
    });
    const app = createApp(env);
    const kolkataPayload = {
      ...DEFAULT_WORKSPACE_INPUT,
      city: 'Shimultala, Kolkata',
      lat: 22.57,
      lon: 88.36,
    };

    // 1. Website creates 1-click Telegram link with live Kolkata GPS workspace
    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: { workspaceKey: 'wkolkata01', payload: kolkataPayload, activeMemberId: 'm1' },
    });
    expect(linkRes.status).toBe(200);
    const { linkCode } = linkRes.body as { linkCode: string };
    expect(linkCode).toContain('wkolkata01');
    expect(linkCode).toContain('2257_8836');

    // 2. Simulate serverless cold start before /start — decoded coords still resolve to Kolkata, NOT New Delhi
    clearCompanionStore();
    const coldStartRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sync-secret' },
      body: { message: { chat: { id: 7744 }, text: `/start ${linkCode}` } },
    });
    expect(coldStartRes.status).toBe(200);
    expect((coldStartRes.body as { replyText: string }).replyText).toContain('Kolkata');
    expect((coldStartRes.body as { replyText: string }).replyText).not.toContain('New Delhi');

    // 3. User updates Member 1 timings in Telegram natural language
    const timeMsg = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sync-secret' },
      body: {
        message: {
          chat: { id: 7744 },
          text: 'I will be leaving home at 10:20 and will be returning home at 11:41 pm',
        },
      },
    });
    expect(timeMsg.status).toBe(200);
    expect((timeMsg.body as { replyText: string }).replyText).toContain('Leave 10:20');
    expect((timeMsg.body as { replyText: string }).replyText).toContain('Return 23:41');

    // 4. User operates full-site controls via Telegram (/room, /rwa, mask callback)
    const roomRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sync-secret' },
      body: { message: { chat: { id: 7744 }, text: '/room 35' } },
    });
    expect(roomRes.status).toBe(200);
    expect((roomRes.body as { replyText: string }).replyText).toContain('35 m2');

    const rwaRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sync-secret' },
      body: { message: { chat: { id: 7744 }, text: '/rwa 240 65' } },
    });
    expect(rwaRes.status).toBe(200);
    expect((rwaRes.body as { replyText: string }).replyText).toContain('240');

    // 5. Website polls GET /api/companion/workspace-sync and receives Member 1's 10:20 / 23:41 + room + RWA!
    const syncGet = await invokeExpress(app, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=wkolkata01',
    });
    expect(syncGet.status).toBe(200);
    const syncBody = syncGet.body as {
      found: boolean;
      changed: boolean;
      telegramLinked: boolean;
      lastModifiedBy: string;
      payload: typeof DEFAULT_WORKSPACE_INPUT;
    };
    expect(syncBody.found).toBe(true);
    expect(syncBody.changed).toBe(true);
    expect(syncBody.telegramLinked).toBe(true);
    expect(syncBody.lastModifiedBy).toBe('telegram');
    expect(syncBody.payload.city).toContain('Kolkata');
    expect(syncBody.payload.members[0]?.leaveHomeTime).toBe('10:20');
    expect(syncBody.payload.members[0]?.returnHomeTime).toBe('23:41');
    expect(syncBody.payload.areaM2).toBe(35);
    expect(syncBody.payload.householdsParticipating).toBe(240);
  });

  it('keeps active family user sticky across messages, shows Change User button, and updates vulnerability profile & full site via natural language', async () => {
    const telegramCalls = mockCompanionUpstreamFetch();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'sticky-secret',
    });
    const app = createApp(env);
    const kolkataPayload = {
      ...DEFAULT_WORKSPACE_INPUT,
      city: 'Shimultala, Kolkata',
      lat: 22.57,
      lon: 88.36,
    };

    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: { workspaceKey: 'wsticky01', payload: kolkataPayload, activeMemberId: 'm1' },
    });
    const { linkCode } = linkRes.body as { linkCode: string };

    // 1. /start asks who is chatting with clickable family member buttons
    const startRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sticky-secret' },
      body: { message: { chat: { id: 5511 }, text: `/start ${linkCode}` } },
    });
    expect(startRes.status).toBe(200);
    expect((startRes.body as { replyText: string }).replyText).toContain('Who is chatting');
    const startKb = JSON.stringify(telegramCalls.at(-1)?.body.reply_markup);
    expect(startKb).toContain('member:m1');
    expect(startKb).toContain('member:m2');
    expect(startKb).toContain('member:m3');

    // 2. Mira introduces herself and says "I'm a college student" -> switches permanently to Meera (m2) and updates role
    const miraIntro = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sticky-secret' },
      body: {
        message: {
          chat: { id: 5511 },
          text: "Hi I am Mira and I'm a college student, change my profile on the website",
        },
      },
    });
    expect(miraIntro.status).toBe(200);
    const introReply = (miraIntro.body as { replyText: string }).replyText;
    expect(introReply).toContain('[Active User: Meera (Senior)');
    expect(introReply).toContain('Adult outdoor commuter');
    expect(JSON.stringify(telegramCalls.at(-1)?.body.reply_markup)).toContain(
      'Change User (Meera)',
    );

    // 3. Follow-up message WITHOUT mentioning any name stays on Meera (m2) — NEVER reverts to Aarav (m1)
    const miraFollowup = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sticky-secret' },
      body: {
        message: {
          chat: { id: 5511 },
          text: 'I will be leaving home at 10:20 and returning home at 11:41 pm',
        },
      },
    });
    expect(miraFollowup.status).toBe(200);
    const followupReply = (miraFollowup.body as { replyText: string }).replyText;
    expect(followupReply).toContain('[Active User: Meera (Senior)');
    expect(followupReply).toContain('Leave 10:20');
    expect(followupReply).toContain('Return 23:41');
    expect(JSON.stringify(telegramCalls.at(-1)?.body.reply_markup)).toContain(
      'Change User (Meera)',
    );

    // 4. Tap "Change User" -> shows member picker -> tap Member 3 (Rohan)
    const switchPrompt = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sticky-secret' },
      body: {
        callback_query: { id: 'cb-sw', data: 'cmd:switchuser', message: { chat: { id: 5511 } } },
      },
    });
    expect((switchPrompt.body as { replyText: string }).replyText).toContain('Who is chatting');

    const pickRohan = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sticky-secret' },
      body: {
        callback_query: { id: 'cb-m3', data: 'member:m3', message: { chat: { id: 5511 } } },
      },
    });
    expect((pickRohan.body as { replyText: string }).replyText).toContain(
      '[Active User: Rohan (Commuter)',
    );
    expect(JSON.stringify(telegramCalls.at(-1)?.body.reply_markup)).toContain(
      'Change User (Rohan)',
    );

    // 5. Rohan sends full-site natural controls without repeating his name
    const rohanControls = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'sticky-secret' },
      body: {
        message: {
          chat: { id: 5511 },
          text: 'Room is 32 sqm, purifier cadr 450, induction stove, 220 participating homes, outdoor hours 4',
        },
      },
    });
    expect(rohanControls.status).toBe(200);
    expect((rohanControls.body as { replyText: string }).replyText).toContain(
      '[Active User: Rohan (Commuter)',
    );

    // 6. Verify ALL website controls synced cleanly to GET /api/companion/workspace-sync
    const syncGet = await invokeExpress(app, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=wsticky01',
    });
    const syncBody = syncGet.body as {
      activeMemberId: string;
      payload: typeof DEFAULT_WORKSPACE_INPUT;
    };
    expect(syncBody.activeMemberId).toBe('m3');
    // Aarav (m1) remained untouched!
    expect(syncBody.payload.members[0]?.leaveHomeTime).toBe('07:30');
    // Meera (m2) got college-student vulnerability profile + sticky timings!
    expect(syncBody.payload.members[1]?.role).toBe('commuter');
    expect(syncBody.payload.members[1]?.leaveHomeTime).toBe('10:20');
    expect(syncBody.payload.members[1]?.returnHomeTime).toBe('23:41');
    // Rohan (m3) got outdoor hours + full-site indoor & RWA controls!
    expect(syncBody.payload.members[2]?.dailyOutdoorHours).toBe(4);
    expect(syncBody.payload.areaM2).toBe(32);
    expect(syncBody.payload.cadrM3Hr).toBe(450);
    expect(syncBody.payload.cookingFuel).toBe('induction');
    expect(syncBody.payload.householdsParticipating).toBe(220);
  });

  it('handles multi-intent natural messages (mask + RWA homes + transit shift + outdoor hours) via deterministic + Groq/Gemini AI JSON parser', async () => {
    mockCompanionUpstreamFetch();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'multi-secret',
    });
    const app = createApp(env);

    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: {
        workspaceKey: 'wmulti01',
        payload: {
          ...DEFAULT_WORKSPACE_INPUT,
          city: 'Shimultala, Kolkata',
          lat: 22.57,
          lon: 88.36,
        },
        activeMemberId: 'm1',
      },
    });
    const { linkCode } = linkRes.body as { linkCode: string };
    await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'multi-secret' },
      body: { message: { chat: { id: 6622 }, text: `/start ${linkCode}` } },
    });

    // 1. Exact user message from screenshot: surgical mask + participating homes approx 200 + shared transit shift around 60%
    const rwaMulti = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'multi-secret' },
      body: {
        message: {
          chat: { id: 6622 },
          text: 'I will be using a surgical mask today and the participating homes in my neighborhood are approx 200 and the shared transit shift, around 60%',
        },
      },
    });
    expect(rwaMulti.status).toBe(200);
    const rwaReply = (rwaMulti.body as { replyText: string }).replyText;
    expect(rwaReply).toContain('Mask surgical');
    expect(rwaReply).toContain('RWA 200 homes');
    expect(rwaReply).toContain('Transit 60%');

    // 2. Exact user multi-intent message: N95 + college student + metro + 10 hours approx outside
    const memberMulti = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'multi-secret' },
      body: {
        message: {
          chat: { id: 6622 },
          text: 'I will be using an N95 mask, I am a college student, I will be taking metro and also I will be staying 10 hours approx. outside',
        },
      },
    });
    expect(memberMulti.status).toBe(200);
    const multiReply = (memberMulti.body as { replyText: string }).replyText;
    expect(multiReply).toContain('Mask n95-ffp2');
    expect(multiReply).toContain('Adult outdoor commuter');
    expect(multiReply).toContain('Mode metro');
    expect(multiReply).toContain('Outdoor 10 hrs/day');

    // 3. Verify all multi-intent edits persisted to workspace-sync
    const sync1 = await invokeExpress(app, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=wmulti01',
    });
    const p1 = (sync1.body as { payload: typeof DEFAULT_WORKSPACE_INPUT }).payload;
    expect(p1.householdsParticipating).toBe(200);
    expect(p1.transitShiftShare).toBe(0.6);
    expect(p1.mask).toBe('n95-ffp2');
    expect(p1.commuteMode).toBe('metro');
    expect(p1.members[0]?.role).toBe('commuter');
    expect(p1.members[0]?.dailyOutdoorHours).toBe(10);

    // 4. Verify AI JSON parser (Groq JSON mode mocked) handles completely paraphrased multi-intent commands
    const baseFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((urlArg, init) => {
      const url = resolveFetchUrl(urlArg);
      if (url.includes('api.groq.com')) {
        const bodyObj =
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as { response_format?: unknown })
            : {};
        if (bodyObj.response_format) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        dailyOutdoorHours: 7,
                        householdsParticipating: 320,
                        transitShiftShare: 75,
                        areaM2: 40,
                        haltLeafBurning: false,
                      }),
                    },
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'Hi Aarav! Got all your updates synced safely.' } }],
            }),
            { status: 200 },
          ),
        );
      }
      return baseFetch(urlArg, init);
    });

    const aiEnv = loadServerEnv({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'test-groq-key',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'multi-secret',
    });
    const aiApp = createApp(aiEnv);
    const aiMsg = await invokeExpress(aiApp, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'multi-secret' },
      body: {
        message: {
          chat: { id: 6622 },
          text: 'Will be outdoors seven hours daily, roughly three hundred twenty neighbors joining, three-quarters shifting transit, forty square meter hall, leaf burning resumed',
        },
      },
    });
    expect(aiMsg.status).toBe(200);
    const aiSync = await invokeExpress(aiApp, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=wmulti01',
    });
    const p2 = (aiSync.body as { payload: typeof DEFAULT_WORKSPACE_INPUT }).payload;
    expect(p2.members[0]?.dailyOutdoorHours).toBe(7);
    expect(p2.householdsParticipating).toBe(320);
    expect(p2.transitShiftShare).toBe(0.75);
    expect(p2.areaM2).toBe(40);
    expect(p2.haltLeafBurning).toBe(false);
  });

  it('adds a new family member with all attributes without overwriting active user, and supports removing members via Telegram', async () => {
    mockCompanionUpstreamFetch();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'roster-secret',
    });
    const app = createApp(env);

    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: {
        workspaceKey: 'wroster01',
        payload: {
          ...DEFAULT_WORKSPACE_INPUT,
          city: 'Shimultala, Kolkata',
          lat: 22.57,
          lon: 88.36,
        },
        activeMemberId: 'm3',
      },
    });
    const { linkCode } = linkRes.body as { linkCode: string };
    await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'roster-secret' },
      body: { message: { chat: { id: 5511 }, text: `/start ${linkCode}` } },
    });

    const addRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'roster-secret' },
      body: {
        message: {
          chat: { id: 5511 },
          text: "Add a new member, Chris. He's a college-going student. He wears an N95 mask. The outdoor ass he stays is a 6 and he takes a metro to commute",
        },
      },
    });
    expect(addRes.status).toBe(200);
    const addReply = (addRes.body as { replyText: string }).replyText;
    expect(addReply).toContain('Added member: Chris');
    expect(addReply).toContain('Outdoor 6 hrs/day');
    expect(addReply).toContain('Mode metro');
    expect(addReply).toContain('Mask n95-ffp2');

    const afterAdd = await invokeExpress(app, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=wroster01',
    });
    const payloadAdded = (afterAdd.body as { payload: typeof DEFAULT_WORKSPACE_INPUT }).payload;
    expect(payloadAdded.members).toHaveLength(4);
    expect(payloadAdded.members[2]?.label).toBe('Rohan (Commuter)');
    expect(payloadAdded.members[2]?.dailyOutdoorHours).toBe(
      DEFAULT_WORKSPACE_INPUT.members[2]?.dailyOutdoorHours,
    );
    const chris = payloadAdded.members[3];
    expect(chris?.label).toBe('Chris');
    expect(chris?.role).toBe('commuter');
    expect(chris?.mask).toBe('n95-ffp2');
    expect(chris?.dailyOutdoorHours).toBe(6);
    expect(chris?.commuteMode).toBe('metro');

    const removeRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'roster-secret' },
      body: { message: { chat: { id: 5511 }, text: 'Remove Chris from the family roster' } },
    });
    expect(removeRes.status).toBe(200);
    expect((removeRes.body as { replyText: string }).replyText).toContain('Removed member: Chris');

    const afterRemove = await invokeExpress(app, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=wroster01',
    });
    expect(afterRemove.status).toBe(200);
    const payloadRemoved = (afterRemove.body as { payload: typeof DEFAULT_WORKSPACE_INPUT })
      .payload;
    expect(payloadRemoved.members).toHaveLength(3);
    expect(payloadRemoved.members.some((m) => m.label === 'Chris')).toBe(false);

    const windowRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'roster-secret' },
      body: {
        message: {
          chat: { id: 5511 },
          text: 'Okay today I would be leaving home at 10 am and will come back home at 7 pm',
        },
      },
    });
    expect(windowRes.status).toBe(200);
    const winReply = (windowRes.body as { replyText: string }).replyText;
    expect(winReply).toContain('Leave 10:00');
    expect(winReply).toContain('Return 19:00');
    expect(winReply).toContain('Outdoor 9 hrs/day');

    const afterWin = await invokeExpress(app, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=wroster01',
    });
    const pWin = (afterWin.body as { payload: typeof DEFAULT_WORKSPACE_INPUT }).payload;
    expect(pWin.members[2]?.leaveHomeTime).toBe('10:00');
    expect(pWin.members[2]?.returnHomeTime).toBe('19:00');
    expect(pWin.members[2]?.dailyOutdoorHours).toBe(9);
  });
});
