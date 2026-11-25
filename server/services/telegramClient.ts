import { timingSafeEqual } from 'node:crypto';
import { memberShortName } from './memberMatcher.js';
import { postTelegramApi, postTelegramApiJson } from './telegramApiTransport.js';

export interface TelegramInlineButton {
  readonly text: string;
  readonly callback_data?: string | undefined;
  readonly url?: string | undefined;
}

export interface TelegramReplyKeyboardButton {
  readonly text: string;
  readonly request_location?: boolean | undefined;
}

export interface EditTelegramMessageParams {
  readonly token: string | undefined;
  readonly chatId: string | number;
  readonly messageId: number;
  readonly text: string;
  readonly inlineButtons?: readonly (readonly TelegramInlineButton[])[] | undefined;
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
    { text: 'Change User', callback_data: 'cmd:switchuser' },
    { text: 'Live Air', callback_data: 'cmd:air' },
  ],
  [
    { text: 'My Schedule', callback_data: 'cmd:schedule' },
    { text: 'Family Roster', callback_data: 'cmd:family' },
  ],
  [
    { text: 'Indoor & Windows', callback_data: 'cmd:windows' },
    { text: 'Commute', callback_data: 'cmd:commute' },
  ],
  [
    { text: 'Masks & Gear', callback_data: 'cmd:gear' },
    { text: 'RWA Notice', callback_data: 'cmd:rwa' },
  ],
  [{ text: 'Controls & GPS', callback_data: 'cmd:controls' }],
];

/** Builds the persistent inline menu showing "Change User (<Name>)" right below every reply. */
export function buildTelegramMenuForMember(
  memberLabel: string,
): readonly (readonly TelegramInlineButton[])[] {
  const shortName = memberShortName(memberLabel);
  return [
    [
      { text: `Change User (${shortName})`, callback_data: 'cmd:switchuser' },
      { text: 'Live Air', callback_data: 'cmd:air' },
    ],
    ...DEFAULT_TELEGRAM_BUTTONS.slice(1),
  ];
}

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

function buildTextMessagePayload(
  chatId: string | number,
  text: string,
  inlineButtons?: readonly (readonly TelegramInlineButton[])[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    chat_id: String(chatId),
    text: text.slice(0, MAX_TELEGRAM_TEXT_LEN),
    disable_web_page_preview: true,
  };
  if (inlineButtons && inlineButtons.length > 0) {
    payload.reply_markup = { inline_keyboard: inlineButtons };
  }
  return payload;
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
  return await postTelegramApi(
    token,
    'sendMessage',
    buildTextMessagePayload(chatId, text, inlineButtons),
  );
}

/** Sends a Telegram message and returns its `message_id` for in-place editing when available. */
export async function sendTelegramMessageWithId(
  token: string | undefined,
  chatId: string | number,
  text: string,
  inlineButtons?: readonly (readonly TelegramInlineButton[])[],
): Promise<number | null> {
  if (!token) {
    return null;
  }
  const res = await postTelegramApiJson(
    token,
    'sendMessage',
    buildTextMessagePayload(chatId, text, inlineButtons),
  );
  return res.ok ? res.messageId : null;
}

/** Edits an existing Telegram message in-place (turning an instant progress bubble into the live card). */
export async function editTelegramMessage(params: EditTelegramMessageParams): Promise<boolean> {
  if (!params.token) {
    return false;
  }
  return await postTelegramApi(params.token, 'editMessageText', {
    ...buildTextMessagePayload(params.chatId, params.text, params.inlineButtons),
    message_id: params.messageId,
  });
}

/** Deletes a temporary Telegram progress message when replaced by a Reply Keyboard prompt. */
export async function deleteTelegramMessage(
  token: string | undefined,
  chatId: string | number,
  messageId: number,
): Promise<boolean> {
  if (!token) {
    return false;
  }
  return await postTelegramApi(token, 'deleteMessage', {
    chat_id: String(chatId),
    message_id: messageId,
  });
}

/** Triggers Telegram's native "typing..." indicator immediately on webhook receipt. */
export async function sendTelegramChatAction(
  token: string | undefined,
  chatId: string | number,
  action = 'typing',
): Promise<boolean> {
  if (!token) {
    return false;
  }
  return await postTelegramApi(token, 'sendChatAction', {
    chat_id: String(chatId),
    action,
  });
}

/** Sends a persistent bottom Reply Keyboard so button taps immediately show right-side user bubbles. */
export async function sendTelegramReplyKeyboard(
  token: string | undefined,
  chatId: string | number,
  text: string,
  keyboard: readonly (readonly TelegramReplyKeyboardButton[])[],
): Promise<boolean> {
  if (!token) {
    return false;
  }
  return await postTelegramApi(token, 'sendMessage', {
    chat_id: String(chatId),
    text: text.slice(0, MAX_TELEGRAM_TEXT_LEN),
    disable_web_page_preview: true,
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      is_persistent: true,
      input_field_placeholder: 'Tap a quick button or type any update...',
    },
  });
}

/** Sends a native 1-tap Telegram GPS location request keyboard for mobile live-location updates. */
export async function sendTelegramLocationPrompt(
  token: string | undefined,
  chatId: string | number,
  text: string,
  keyboard?: readonly (readonly TelegramReplyKeyboardButton[])[],
): Promise<boolean> {
  const rows = keyboard ?? [[{ text: 'Share Live GPS', request_location: true }]];
  return await sendTelegramReplyKeyboard(token, chatId, text, rows);
}

/** Acknowledges an inline button press with an optional top toast and clears the button spinner. */
export async function answerTelegramCallbackQuery(
  token: string | undefined,
  callbackQueryId: string,
  text?: string,
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text) {
    payload.text = text;
  }
  return await postTelegramApi(token, 'answerCallbackQuery', payload);
}
