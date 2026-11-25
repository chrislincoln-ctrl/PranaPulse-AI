import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { loadServerEnv } from '../../server/env.js';
import { clearCompanionStore } from '../../server/services/familyCompanionStore.js';
import { extractSiteControlPatch } from '../../server/services/naturalSiteControlExtractor.js';
import {
  clearTelemetryCaches,
  getUrbanTelemetryBundle,
} from '../../server/services/telemetryClients.js';
import { sanitizeWorkspaceKey } from '../../server/services/workspaceSyncCodec.js';
import { invokeExpress } from '../helpers/invokeExpress.js';

function resolveUrl(arg: RequestInfo | URL): string {
  if (typeof arg === 'string') {
    return arg;
  }
  return arg instanceof URL ? arg.href : arg.url;
}

describe('Security hardening regressions (ReDoS, cache isolation, Telegram webhook & path safety)', () => {
  afterEach(() => {
    clearCompanionStore();
    clearTelemetryCaches();
    vi.restoreAllMocks();
  });

  it('prevents quartic regex backtracking on whitespace-heavy Telegram freeform messages', () => {
    const start = performance.now();
    const patch = extractSiteControlPatch(`a${' '.repeat(2500)}!`);
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(100);
    expect(patch.householdPatch.areaM2).toBeUndefined();

    const valid = extractSiteControlPatch('Room area is 34 sqm, CADR 420');
    expect(valid.householdPatch.areaM2).toBe(34);
    expect(valid.householdPatch.cadrM3Hr).toBe(420);
  });

  it('sanitizes both primary and fallback workspace keys against storage path traversal', () => {
    expect(sanitizeWorkspaceKey('../bad', 'tg../../secret')).toBe('tgsecret');
    expect(sanitizeWorkspaceKey('valid_Key-01', 'home1')).toBe('validkey01');
  });

  it('isolates caller cityLabel from shared quantized telemetryCache entries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ hourly: { time: [] } }), { status: 200 }),
    );
    const env = loadServerEnv({ NODE_ENV: 'test' });
    const seeded = await getUrbanTelemetryBundle({
      lat: 22.57,
      lon: 88.36,
      cityLabel: 'Injected Label',
      env,
    });
    expect(seeded.city).toBe('Injected Label');

    const neutral = await getUrbanTelemetryBundle({ lat: 22.57, lon: 88.36, env });
    expect(neutral.city).not.toBe('Injected Label');
    expect(neutral.city).toContain('Sector');
  });

  it('blocks traversal chat IDs, non-private chats, duplicate update_ids, and hides replyText in production', async () => {
    let telegramSendCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((urlArg) => {
      const url = resolveUrl(urlArg);
      if (url.includes('api.telegram.org')) {
        telegramSendCount += 1;
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ hourly: { time: [] } }), { status: 200 }),
      );
    });

    const prodEnv = loadServerEnv({
      NODE_ENV: 'production',
      TELEGRAM_BOT_TOKEN: 'sec-bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'sec-hook',
    });
    const app = createApp(prodEnv);
    const headers = { 'x-telegram-bot-api-secret-token': 'sec-hook' };

    // 1. Traversal chat.id rejected
    const badChat = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: { message: { chat: { id: '../other/bucket', type: 'private' }, text: '/air' } },
    });
    expect(badChat.status).toBe(200);
    expect(badChat.body).toEqual({ ok: true, handled: 'ignored' });

    // 2. Group chat rejected
    const groupChat = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: { message: { chat: { id: -10012345, type: 'supergroup' }, text: '/air' } },
    });
    expect(groupChat.body).toEqual({ ok: true, handled: 'ignored' });

    // 3. Valid private update succeeds in production WITHOUT leaking replyText in HTTP 200
    const first = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: {
        update_id: 990011,
        message: { chat: { id: 8811, type: 'private' }, text: '/controls' },
      },
    });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true, handled: 'command' });
    expect('replyText' in (first.body as Record<string, unknown>)).toBe(false);
    const countAfterFirst = telegramSendCount;
    expect(countAfterFirst).toBeGreaterThan(0);

    // 4. Retried duplicate update_id is deduplicated with zero extra outbound calls
    const dup = await invokeExpress(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers,
      body: {
        update_id: 990011,
        message: { chat: { id: 8811, type: 'private' }, text: '/controls' },
      },
    });
    expect(dup.status).toBe(200);
    expect(dup.body).toEqual({ ok: true, handled: 'duplicate' });
    expect(telegramSendCount).toBe(countAfterFirst);
  });
});
