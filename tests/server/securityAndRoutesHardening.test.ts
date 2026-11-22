import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { loadServerEnv } from '../../server/env.js';
import { clearCompanionStore } from '../../server/services/familyCompanionStore.js';
import { clearTelemetryCaches } from '../../server/services/telemetryClients.js';
import { applyRosterMutation } from '../../server/services/telegramRosterMutation.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { invokeExpress } from '../helpers/invokeExpress.js';

function toUrlString(urlArg: RequestInfo | URL): string {
  if (typeof urlArg === 'string') {
    return urlArg;
  }
  return urlArg instanceof URL ? urlArg.href : urlArg.url;
}

function stubSafeUpstreamFetch() {
  const times = Array.from(
    { length: 24 },
    (_, hr) => `2026-11-22T${String(hr).padStart(2, '0')}:00`,
  );
  const arr = (v: number) => Array.from({ length: 24 }, () => v);
  vi.spyOn(globalThis, 'fetch').mockImplementation((urlArg) => {
    const url = toUrlString(urlArg);
    if (url.includes('api.telegram.org')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }
    if (url.includes('air-quality-api.open-meteo.com')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            hourly: {
              time: times,
              pm2_5: arr(92),
              pm10: arr(150),
              nitrogen_dioxide: arr(44),
              ozone: arr(35),
              sulphur_dioxide: arr(12),
              carbon_monoxide: arr(900),
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
              boundary_layer_height: arr(280),
              wind_speed_10m: arr(8),
              relative_humidity_2m: arr(72),
            },
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
  });
}

describe('API route Zod security boundaries, Telegram command suite & roster invariants', () => {
  afterEach(() => {
    clearCompanionStore();
    clearTelemetryCaches();
    vi.restoreAllMocks();
  });

  it('enforces strict Zod validation on /api/verify-custom, /api/corridor-plan, and /api/locate', async () => {
    stubSafeUpstreamFetch();
    const app = createApp(loadServerEnv({ NODE_ENV: 'test' }));

    const badVerify = await invokeExpress(app, {
      method: 'POST',
      url: '/api/verify-custom',
      body: { category: 'invalid-category', customText: 'college student' },
    });
    expect(badVerify.status).toBe(400);

    const okVerify = await invokeExpress(app, {
      method: 'POST',
      url: '/api/verify-custom',
      body: { category: 'role', customText: 'college student', language: 'en' },
    });
    expect(okVerify.status).toBe(200);
    expect((okVerify.body as { isValid: boolean }).isValid).toBe(true);

    const badMode = await invokeExpress(app, {
      method: 'POST',
      url: '/api/corridor-plan',
      body: {
        city: 'Kolkata',
        fromArea: 'Salt Lake',
        toArea: 'Park Street',
        commuteMode: 'helicopter',
      },
    });
    expect(badMode.status).toBe(400);

    const okCorridor = await invokeExpress(app, {
      method: 'POST',
      url: '/api/corridor-plan',
      body: {
        city: 'Kolkata',
        fromArea: 'Salt Lake',
        toArea: 'Park Street',
        commuteMode: 'metro',
      },
    });
    expect(okCorridor.status).toBe(200);
    expect(
      (okCorridor.body as { estimatedDistanceKm: number }).estimatedDistanceKm,
    ).toBeGreaterThan(0);

    const badLocate = await invokeExpress(app, {
      method: 'GET',
      url: '/api/locate?lat=999&lon=-999',
    });
    expect(badLocate.status).toBe(500);
  });

  it('rejects forged Telegram webhook/cron secrets and exercises full Telegram command suite', async () => {
    stubSafeUpstreamFetch();
    const env = loadServerEnv({
      NODE_ENV: 'test',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_BOT_USERNAME: 'PranaPulseBot',
      TELEGRAM_WEBHOOK_SECRET: 'hard-secret',
      CRON_SECRET: 'cron-secret-key',
    });
    const app = createApp(env);

    const badHook = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
      body: { message: { chat: { id: 9001 }, text: '/air' } },
    });
    expect(badHook.status).toBe(403);

    const badCron = await invokeExpress(app, {
      method: 'GET',
      url: '/api/telegram/daily-brief',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(badCron.status).toBe(401);

    const linkRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/companion/telegram-link',
      body: {
        workspaceKey: 'wcmd001',
        payload: { ...DEFAULT_WORKSPACE_INPUT, city: 'Kolkata', lat: 22.57, lon: 88.36 },
      },
    });
    const { linkCode } = linkRes.body as { linkCode: string };
    const headers = { 'x-telegram-bot-api-secret-token': 'hard-secret' };
    const sendCmd = (text: string) =>
      invokeExpress(app, {
        method: 'POST',
        url: '/api/telegram/webhook',
        headers,
        body: { message: { chat: { id: 9001 }, text } },
      });

    await sendCmd(`/start ${linkCode}`);
    for (const [cmd, expected] of [
      ['/air', 'Live Air'],
      ['/schedule', 'Aarav'],
      ['/family', 'Family Care Roster'],
      ['/windows', 'Indoor & Windows'],
      ['/commute', 'Commute & Route'],
      ['/gear', 'Masks & Purifiers'],
      ['/rwa', 'RWA Notice'],
      ['/controls', 'Telegram Operating Hub'],
      ['/switch', 'Who is chatting'],
      ['/cadr 400', '400'],
      ['/fuel induction', 'induction'],
      ['/distance 12', '12 km'],
      ['/route Salt Lake to Park Street', 'Corridor Plan'],
      ['/addmember Priya | child', 'Priya'],
    ] as const) {
      const res = await sendCmd(cmd);
      expect(res.status).toBe(200);
      expect((res.body as { replyText: string }).replyText).toContain(expected);
    }

    const okCron = await invokeExpress(app, {
      method: 'GET',
      url: '/api/telegram/daily-brief',
      headers: { authorization: 'Bearer cron-secret-key' },
    });
    expect(okCron.status).toBe(200);
    expect((okCron.body as { sentCount: number }).sentCount).toBe(1);
  });

  it('enforces max 6 and min 1 family member roster bounds cleanly', () => {
    const sixMembers = Array.from({ length: 6 }, (_, i) => ({
      id: `m${String(i + 1)}`,
      label: `Member ${String(i + 1)}`,
      role: 'commuter' as const,
      mask: 'n95-ffp2' as const,
      dailyOutdoorHours: 2,
    }));
    const addAtLimit = applyRosterMutation({
      baseMembers: sixMembers,
      targetId: 'm1',
      addMemberName: 'Seventh',
      removeMember: null,
      memberPatch: {},
    });
    expect(addAtLimit.changed).toBe(false);
    expect(addAtLimit.warning).toContain('maximum 6');

    const oneMember = [sixMembers[0]!];
    const removeLast = applyRosterMutation({
      baseMembers: oneMember,
      targetId: 'm1',
      removeMember: oneMember[0]!,
      memberPatch: {},
    });
    expect(removeLast.changed).toBe(false);
    expect(removeLast.warning).toContain('At least 1');
  });
});
