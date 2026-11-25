import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { loadServerEnv } from '../../server/env.js';
import { clearCompanionStore } from '../../server/services/familyCompanionStore.js';
import { resolveTelegramFeedback } from '../../server/services/telegramFeedback.js';
import { clearTelemetryCaches } from '../../server/services/telemetryClients.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { invokeExpress } from '../helpers/invokeExpress.js';

interface RecordedTelegramCall {
  readonly method: string;
  readonly body: Record<string, unknown>;
}

function getRequestUrl(urlArg: RequestInfo | URL): string {
  if (typeof urlArg === 'string') {
    return urlArg;
  }
  return urlArg instanceof URL ? urlArg.href : urlArg.url;
}

function mockTelegramAndTelemetry(opts?: { readonly failEdit?: boolean }) {
  const times = Array.from(
    { length: 24 },
    (_, hr) => `2026-11-25T${String(hr).padStart(2, '0')}:00`,
  );
  const hourly = (value: number) => Array.from({ length: 24 }, () => value);
  const calls: RecordedTelegramCall[] = [];
  let nextMessageId = 7000;

  vi.spyOn(globalThis, 'fetch').mockImplementation((urlArg, init) => {
    const url = getRequestUrl(urlArg);
    if (url.includes('api.telegram.org')) {
      const method = url.split('/').at(-1) ?? '';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      calls.push({ method, body });
      if (method === 'editMessageText' && opts?.failEdit) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: false, description: 'Bad Request' }), { status: 400 }),
        );
      }
      if (method === 'sendMessage') {
        nextMessageId += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: { message_id: nextMessageId } }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }
    if (url.includes('air-quality-api.open-meteo.com')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            hourly: {
              time: times,
              pm2_5: hourly(118),
              pm10: hourly(186),
              nitrogen_dioxide: hourly(42),
              ozone: hourly(31),
              sulphur_dioxide: hourly(11),
              carbon_monoxide: hourly(980),
            },
          }),
          { status: 200 },
        ),
      );
    }
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            hourly: {
              time: times,
              boundary_layer_height: hourly(260),
              wind_speed_10m: hourly(7),
              relative_humidity_2m: hourly(70),
            },
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ address: { suburb: 'Salt Lake', city: 'Kolkata' } }), {
        status: 200,
      }),
    );
  });

  return calls;
}

describe('Telegram instant feedback UX & persistent quick-reply keyboard', () => {
  afterEach(() => {
    clearCompanionStore();
    clearTelemetryCaches();
    vi.restoreAllMocks();
  });

  it('resolves descriptive toasts and progress messages for callbacks, reply buttons, GPS pins, and prototype keys', () => {
    const cbAir = resolveTelegramFeedback({ rawText: 'cmd:air', isCallback: true, hasGps: false });
    expect(cbAir.toast).toBe('Live Air requested...');
    expect(cbAir.progressText).toContain('You selected: Live Air');
    expect(cbAir.progressText).toContain('CPCB NAQI');

    const kbAir = resolveTelegramFeedback({
      rawText: 'Live Air',
      isCallback: false,
      hasGps: false,
    });
    expect(kbAir.progressText).not.toContain('You selected:');
    expect(kbAir.progressText).toContain('CPCB NAQI');

    const gpsPin = resolveTelegramFeedback({ rawText: '', isCallback: false, hasGps: true });
    expect(gpsPin.progressText).toContain('GPS pin received');

    const memberSwitch = resolveTelegramFeedback({
      rawText: 'member:m2',
      isCallback: true,
      hasGps: false,
    });
    expect(memberSwitch.toast).toContain('Switching active member');
    expect(memberSwitch.progressText).toContain('Switch Active User');

    // Defensive check against Object.prototype keys
    const protoKey = resolveTelegramFeedback({
      rawText: 'toString',
      isCallback: false,
      hasGps: false,
    });
    expect(protoKey.progressText).toContain('Got your message');
  });

  it('clears any bottom Reply Keyboard on /start and updates inline callback progress bubbles in-place', async () => {
    const calls = mockTelegramAndTelemetry();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'ux-bot-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'ux-secret',
    });
    const app = createApp(env);
    const headers = { 'x-telegram-bot-api-secret-token': 'ux-secret' };

    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: {
        workspaceKey: 'wuxtest01',
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

    // 1. /start sends an editable plain progress bubble (no bottom Reply Keyboard) and edits in-place into member picker
    const startRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: { message: { chat: { id: 4401 }, text: `/start ${linkCode}` } },
    });
    expect(startRes.status).toBe(200);
    expect(calls.some((c) => c.method === 'sendChatAction' && c.body.action === 'typing')).toBe(
      true,
    );
    const startProgress = calls.find((c) => c.method === 'sendMessage');
    expect(startProgress?.body.reply_markup).toBeUndefined();
    expect(
      calls.some((c) =>
        Boolean((c.body.reply_markup as { keyboard?: unknown } | undefined)?.keyboard),
      ),
    ).toBe(false);
    expect(calls.at(-1)?.method).toBe('editMessageText');
    expect(JSON.stringify(calls.at(-1)?.body.reply_markup)).toContain('member:m3');

    // 2. Inline callback ("cmd:air") triggers toast + typing + editable progress bubble -> edited in-place
    calls.length = 0;
    const cbRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: {
        callback_query: { id: 'cb-air-1', data: 'cmd:air', message: { chat: { id: 4401 } } },
      },
    });
    expect(cbRes.status).toBe(200);
    expect(
      calls.some(
        (c) =>
          c.method === 'answerCallbackQuery' &&
          c.body.callback_query_id === 'cb-air-1' &&
          c.body.text === 'Live Air requested...',
      ),
    ).toBe(true);
    expect(calls.some((c) => c.method === 'sendChatAction' && c.body.action === 'typing')).toBe(
      true,
    );

    const progressSend = calls.find((c) => c.method === 'sendMessage');
    expect(progressSend?.body.text).toContain('You selected: Live Air');
    expect(progressSend?.body.reply_markup).toBeUndefined();
    expect(calls.filter((c) => c.method === 'sendMessage')).toHaveLength(1);

    const editCall = calls.at(-1);
    expect(editCall?.method).toBe('editMessageText');
    expect(editCall?.body.message_id).toBe(7002);
    expect(editCall?.body.text).toContain('Live Air & Dashboard: Shimultala, Kolkata');
    expect(JSON.stringify(editCall?.body.reply_markup)).toContain('Change User (Rohan)');

    // 3. Plain-text quick command labels still route cleanly and edit their progress bubble in-place
    const replyButtonExpectations: readonly (readonly [string, string])[] = [
      ['Live Air', 'Live Air & Dashboard'],
      ['My Schedule', 'PranaPulse Daily Air Brief'],
      ['Family Roster', 'Family Care Roster'],
      ['Indoor & Windows', 'Indoor & Windows'],
      ['Commute', 'Commute & Route'],
      ['Masks & Gear', 'Masks & Purifiers'],
      ['RWA Notice', 'RWA Notice'],
      ['Controls & GPS', 'Telegram Operating Hub'],
      ['Change User', 'Who is chatting'],
    ];
    for (const [label, expectedFragment] of replyButtonExpectations) {
      calls.length = 0;
      const res = await invokeExpress(app, {
        method: 'POST',
        url: '/api/telegram/webhook',
        headers,
        body: { message: { chat: { id: 4401 }, text: label } },
      });
      expect(res.status).toBe(200);
      expect((res.body as { handled: string; replyText: string }).handled).toBe('command');
      expect((res.body as { replyText: string }).replyText).toContain(expectedFragment);
      expect(calls.some((c) => c.method === 'sendChatAction' && c.body.action === 'typing')).toBe(
        true,
      );
      expect(calls.filter((c) => c.method === 'sendMessage')).toHaveLength(1);
      expect(calls.at(-1)?.method).toBe('editMessageText');
    }

    // 4. gps:ask deletes temporary progress bubble and sends ONLY a single one-time GPS location button
    calls.length = 0;
    const gpsAskRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: {
        callback_query: { id: 'cb-gps', data: 'gps:ask', message: { chat: { id: 4401 } } },
      },
    });
    expect(gpsAskRes.status).toBe(200);
    expect(calls.some((c) => c.method === 'deleteMessage')).toBe(true);
    const gpsPromptCall = calls.at(-1);
    expect(gpsPromptCall?.method).toBe('sendMessage');
    expect(gpsPromptCall?.body.reply_markup).toEqual({
      keyboard: [[{ text: 'Share My Live GPS Location', request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
  });

  it('falls back cleanly to sendMessage if Telegram rejects editMessageText', async () => {
    const calls = mockTelegramAndTelemetry({ failEdit: true });
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'ux-bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'fallback-secret',
    });
    const app = createApp(env);

    const res = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'fallback-secret' },
      body: {
        callback_query: { id: 'cb-fb', data: 'cmd:air', message: { chat: { id: 4402 } } },
      },
    });
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.method === 'editMessageText')).toBe(true);
    const sendMessages = calls.filter((c) => c.method === 'sendMessage');
    expect(sendMessages).toHaveLength(2);
    expect(sendMessages[0]?.body.text).toContain('You selected: Live Air');
    expect(sendMessages[1]?.body.text).toContain('Live Air & Dashboard');
  });

  it('extracts leave/return times and derived outdoor hours in one shot when adding a new family member', async () => {
    mockTelegramAndTelemetry();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'ux-bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'add-timing-secret',
    });
    const app = createApp(env);
    const headers = { 'x-telegram-bot-api-secret-token': 'add-timing-secret' };

    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: {
        workspaceKey: 'waddtime01',
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
      headers,
      body: { message: { chat: { id: 4499 }, text: `/start ${linkCode}` } },
    });

    // Exact multi-sentence prompt from user screenshot (> 150 chars, "leaves home at around 10 am and returns home at 12 pm")
    const addChris = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: {
        message: {
          chat: { id: 4499 },
          text: "I want to add a new family member called Chris. His vulnerability profile is that he's a college student. He wears an N95 mask. He leaves home at around 10 am and returns home at 12 pm",
        },
      },
    });
    expect(addChris.status).toBe(200);
    const chrisReply = (addChris.body as { replyText: string }).replyText;
    expect(chrisReply).toContain('Added member: Chris');
    expect(chrisReply).toContain('Leave 10:00');
    expect(chrisReply).toContain('Return 12:00');
    expect(chrisReply).toContain('Outdoor 2 hrs/day');

    // Second new member with no am/pm ("leaves home at 8 and returns back at 4" -> 08:00 to 16:00, 8 hrs)
    const addMaya = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: {
        message: {
          chat: { id: 4499 },
          text: "Add a new member named Maya, she's a school student, surgical mask, leaves home at 8 and returns back at 4",
        },
      },
    });
    expect(addMaya.status).toBe(200);
    const mayaReply = (addMaya.body as { replyText: string }).replyText;
    expect(mayaReply).toContain('Added member: Maya');
    expect(mayaReply).toContain('Leave 08:00');
    expect(mayaReply).toContain('Return 16:00');
    expect(mayaReply).toContain('Outdoor 8 hrs/day');

    const syncRes = await invokeExpress(app, {
      method: 'GET',
      url: '/api/companion/workspace-sync?workspaceKey=waddtime01',
    });
    const members = (syncRes.body as { payload: typeof DEFAULT_WORKSPACE_INPUT }).payload.members;
    const chris = members.find((m) => m.label === 'Chris');
    expect(chris).toMatchObject({
      role: 'commuter',
      mask: 'n95-ffp2',
      leaveHomeTime: '10:00',
      returnHomeTime: '12:00',
      dailyOutdoorHours: 2,
    });
    const maya = members.find((m) => m.label === 'Maya');
    expect(maya).toMatchObject({
      role: 'child',
      mask: 'surgical',
      leaveHomeTime: '08:00',
      returnHomeTime: '16:00',
      dailyOutdoorHours: 8,
    });
  });
});
