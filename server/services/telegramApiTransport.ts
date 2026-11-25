import { SECURITY_LIMITS, UPSTREAM_ENDPOINTS } from '../../src/config/constants.js';

export interface TelegramApiResult {
  readonly ok: boolean;
  readonly messageId: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractTelegramMessageId(raw: unknown): number | null {
  if (!isRecord(raw)) {
    return null;
  }
  const result = raw.result;
  if (!isRecord(result)) {
    return null;
  }
  const id = result.message_id;
  return typeof id === 'number' && Number.isInteger(id) ? id : null;
}

/** Posts a JSON payload to the Telegram Bot API and parses `ok` + `result.message_id`. */
export async function postTelegramApiJson(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS);

  try {
    const url = `${UPSTREAM_ENDPOINTS.TELEGRAM_API_BASE}/bot${token}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, messageId: null };
    }
    const parsed: unknown = await response.json().catch(() => null);
    if (isRecord(parsed) && parsed.ok === false) {
      return { ok: false, messageId: null };
    }
    return { ok: true, messageId: extractTelegramMessageId(parsed) };
  } catch {
    return { ok: false, messageId: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Posts a JSON payload to the Telegram Bot API and returns whether the call succeeded. */
export async function postTelegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const res = await postTelegramApiJson(token, method, body);
  return res.ok;
}
