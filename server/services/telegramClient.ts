import { timingSafeEqual } from 'node:crypto';
import { SECURITY_LIMITS, UPSTREAM_ENDPOINTS } from '../../src/config/constants.js';

export interface TelegramInlineButton {
  readonly text: string;
  readonly callback_data?: string | undefined;
  readonly url?: string | undefined;
}

export interface TelegramLocation {
  readonly latitude: number;
  readonly longitude: number;
}

export interface TelegramMessage {
  readonly message_id?: number;
  readonly chat?: { readonly id: number | string };
  readonly from?: { readonly first_name?: string; readonly username?: string };
  readonly text?: string;
  readonly location?: TelegramLocation;
}

export interface TelegramCallbackQuery {
  readonly id: string;
  readonly data?: string;
  readonly message?: TelegramMessage;
}

export interface TelegramWebhookUpdate {
  readonly update_id?: number;
  readonly message?: TelegramMessage;
  readonly callback_query?: TelegramCallbackQuery;
}

const MAX_TELEGRAM_TEXT_LEN = 3900;

export const DEFAULT_TELEGRAM_BUTTONS: readonly (readonly TelegramInlineButton[])[] = [
  [
    { text: 'Live Air', callback_data: 'cmd:air' },
    { text: 'My Schedule', callback_data: 'cmd:schedule' },
  ],
  [
    { text: 'Family Roster', callback_data: 'cmd:family' },
    { text: 'Indoor & Windows', callback_data: 'cmd:windows' },
  ],
  [
    { text: 'Commute', callback_data: 'cmd:commute' },
    { text: 'Masks & Gear', callback_data: 'cmd:gear' },
  ],
  [
    { text: 'RWA Notice', callback_data: 'cmd:rwa' },
    { text: 'Controls & GPS', callback_data: 'cmd:controls' },
  ],
];

/** Builds a 1-tap Telegram bot deep-link URL that automatically sends `/start <linkCode>`. */
export function buildTelegramDeepLink(botUsername: string, linkCode: string): string {
  const cleanUser = botUsername.replace(/^@+/, '').trim();
  return `https://t.me/${encodeURIComponent(cleanUser)}?start=${encodeURIComponent(linkCode)}`;
}

/**
 * Verifies the `X-Telegram-Bot-Api-Secret-Token` header using constant-time comparison.
 * When no `expectedSecret` is configured on the server, returns `true` for local dev flexibility.
 */
export function verifyTelegramWebhookSecret(
  headerValue: string | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret) {
    return true;
  }
  if (!headerValue) {
    return false;
  }
  const actualBuf = Buffer.from(headerValue, 'utf8');
  const expectedBuf = Buffer.from(expectedSecret, 'utf8');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(actualBuf, expectedBuf);
}

/** Verifies a Bearer secret token header (used by cron workflows for `/api/telegram/daily-brief`). */
export function verifyBearerSecret(
  authorizationHeader: string | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret || !authorizationHeader) {
    return false;
  }
  const expectedHeader = `Bearer ${expectedSecret}`;
  const actualBuf = Buffer.from(authorizationHeader, 'utf8');
  const expectedBuf = Buffer.from(expectedHeader, 'utf8');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(actualBuf, expectedBuf);
}

async function postTelegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> {
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
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Sends a plain-text message (with optional inline keyboard) via Telegram Bot API. */
export async function sendTelegramMessage(
  token: string | undefined,
  chatId: string | number,
  text: string,
  inlineButtons?: readonly (readonly TelegramInlineButton[])[],
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const payload: Record<string, unknown> = {
    chat_id: String(chatId),
    text: text.slice(0, MAX_TELEGRAM_TEXT_LEN),
    disable_web_page_preview: true,
  };
  if (inlineButtons && inlineButtons.length > 0) {
    payload.reply_markup = { inline_keyboard: inlineButtons };
  }
  return await postTelegramApi(token, 'sendMessage', payload);
}

/** Sends a native 1-tap Telegram GPS location request keyboard for mobile live-location updates. */
export async function sendTelegramLocationPrompt(
  token: string | undefined,
  chatId: string | number,
  text: string,
): Promise<boolean> {
  if (!token) {
    return false;
  }
  return await postTelegramApi(token, 'sendMessage', {
    chat_id: String(chatId),
    text: text.slice(0, MAX_TELEGRAM_TEXT_LEN),
    reply_markup: {
      keyboard: [[{ text: 'Share My Live GPS Location', request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** Acknowledges an inline button press so Telegram immediately clears the loading indicator. */
export async function answerTelegramCallbackQuery(
  token: string | undefined,
  callbackQueryId: string,
): Promise<boolean> {
  if (!token) {
    return false;
  }
  return await postTelegramApi(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
  });
}
