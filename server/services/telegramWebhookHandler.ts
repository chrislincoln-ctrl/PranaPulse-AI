import type { ServerEnv } from '../env.js';
import {
  ensureWorkspaceForTelegramChatId,
  redeemWorkspaceLinkCode,
} from './householdWorkspaceStore.js';
import { buildWhoAreYouCard, type TelegramReplyPayload } from './telegramCardBuilders.js';
import {
  answerTelegramCallbackQuery,
  sendTelegramLocationPrompt,
  sendTelegramMessage,
  type TelegramWebhookUpdate,
} from './telegramClient.js';
import { routeTelegramCommand } from './telegramCommandRouter.js';
import { handleTelegramFreeformMessage } from './telegramFreeformHandler.js';

export { buildLiveScheduleBrief } from './telegramCardBuilders.js';

const START_COMMAND_RE = /^\/start(?:\s+([A-Za-z0-9_-]+))?/i;

async function handleStartCommand(
  chatId: string,
  code: string | undefined,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const linked =
    (code ? await redeemWorkspaceLinkCode(code, chatId, env) : null) ??
    (await ensureWorkspaceForTelegramChatId(chatId, env));
  return buildWhoAreYouCard(linked, 'Connected to PranaPulse AI! Who is chatting right now?');
}

function readRawChatId(update: TelegramWebhookUpdate): number | string | undefined {
  const msg = update.callback_query ? update.callback_query.message : update.message;
  return msg?.chat?.id;
}

function readUpdateText(update: TelegramWebhookUpdate): string {
  return (update.callback_query?.data ?? update.message?.text ?? '').trim();
}

function extractUpdateContext(update: TelegramWebhookUpdate): {
  readonly chatId: string;
  readonly callbackId?: string;
  readonly text: string;
  readonly gpsLat?: number;
  readonly gpsLon?: number;
} | null {
  const rawChatId = readRawChatId(update);
  if (rawChatId === undefined) {
    return null;
  }
  const loc = update.message?.location;
  const callbackId = update.callback_query?.id;
  return {
    chatId: String(rawChatId),
    ...(callbackId ? { callbackId } : {}),
    text: readUpdateText(update),
    ...(loc ? { gpsLat: loc.latitude, gpsLon: loc.longitude } : {}),
  };
}

async function dispatchReply(
  chatId: string,
  reply: TelegramReplyPayload,
  env: ServerEnv,
): Promise<void> {
  if (reply.requestGpsKeyboard) {
    await sendTelegramLocationPrompt(env.TELEGRAM_BOT_TOKEN, chatId, reply.text);
    return;
  }
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, reply.text, reply.buttons);
}

/** Processes a single Telegram webhook update (start linking, GPS pin, button callback, command, or chat). */
export async function processTelegramUpdate(
  update: TelegramWebhookUpdate,
  env: ServerEnv,
): Promise<{ readonly handled: string; readonly replyText?: string }> {
  const ctx = extractUpdateContext(update);
  if (!ctx) {
    return { handled: 'ignored' };
  }
  if (ctx.callbackId) {
    await answerTelegramCallbackQuery(env.TELEGRAM_BOT_TOKEN, ctx.callbackId);
  }
  const startMatch = START_COMMAND_RE.exec(ctx.text);
  if (startMatch) {
    const reply = await handleStartCommand(ctx.chatId, startMatch[1], env);
    await dispatchReply(ctx.chatId, reply, env);
    return { handled: 'start', replyText: reply.text };
  }
  const workspace = await ensureWorkspaceForTelegramChatId(ctx.chatId, env);
  const routed =
    ctx.gpsLat === undefined ? await routeTelegramCommand(ctx.text, workspace, env) : null;
  const reply =
    routed ??
    (await handleTelegramFreeformMessage({
      workspace,
      text: ctx.text,
      gpsLat: ctx.gpsLat,
      gpsLon: ctx.gpsLon,
      env,
    }));
  await dispatchReply(ctx.chatId, reply, env);
  return { handled: routed ? 'command' : 'message', replyText: reply.text };
}
