import type { ServerEnv } from '../env.js';
import {
  ensureWorkspaceForTelegramChatId,
  redeemWorkspaceLinkCode,
} from './householdWorkspaceStore.js';
import { buildWhoAreYouCard, type TelegramReplyPayload } from './telegramCardBuilders.js';
import {
  answerTelegramCallbackQuery,
  deleteTelegramMessage,
  editTelegramMessage,
  sendTelegramChatAction,
  sendTelegramLocationPrompt,
  sendTelegramMessage,
  sendTelegramMessageWithId,
  sendTelegramReplyKeyboard,
  type TelegramWebhookUpdate,
} from './telegramClient.js';
import { routeTelegramCommand } from './telegramCommandRouter.js';
import {
  resolveTelegramFeedback,
  TELEGRAM_DOCK_WELCOME_TEXT,
  TELEGRAM_REPLY_KEYBOARD,
} from './telegramFeedback.js';
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

interface TelegramUpdateContext {
  readonly chatId: string;
  readonly callbackId?: string;
  readonly text: string;
  readonly gpsLat?: number;
  readonly gpsLon?: number;
}

function extractUpdateContext(update: TelegramWebhookUpdate): TelegramUpdateContext | null {
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

async function sendInstantFeedback(
  ctx: TelegramUpdateContext,
  env: ServerEnv,
): Promise<number | null> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const feedback = resolveTelegramFeedback({
    rawText: ctx.text,
    isCallback: Boolean(ctx.callbackId),
    hasGps: ctx.gpsLat !== undefined,
  });
  const callbackAck = ctx.callbackId
    ? answerTelegramCallbackQuery(token, ctx.callbackId, feedback.toast)
    : Promise.resolve(false);
  const [, , progressMsgId] = await Promise.all([
    callbackAck,
    sendTelegramChatAction(token, ctx.chatId, 'typing'),
    sendTelegramMessageWithId(token, ctx.chatId, feedback.progressText),
  ]);
  return progressMsgId;
}

async function dispatchReply(
  chatId: string,
  reply: TelegramReplyPayload,
  env: ServerEnv,
  progressMsgId: number | null,
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (reply.requestGpsKeyboard) {
    if (progressMsgId !== null) {
      await deleteTelegramMessage(token, chatId, progressMsgId);
    }
    await sendTelegramLocationPrompt(token, chatId, reply.text, TELEGRAM_REPLY_KEYBOARD);
    return;
  }
  if (progressMsgId !== null) {
    const edited = await editTelegramMessage({
      token,
      chatId,
      messageId: progressMsgId,
      text: reply.text,
      inlineButtons: reply.buttons,
    });
    if (edited) {
      return;
    }
  }
  await sendTelegramMessage(token, chatId, reply.text, reply.buttons);
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
  const startMatch = START_COMMAND_RE.exec(ctx.text);
  if (startMatch) {
    const [, , reply] = await Promise.all([
      sendTelegramChatAction(env.TELEGRAM_BOT_TOKEN, ctx.chatId, 'typing'),
      sendTelegramReplyKeyboard(
        env.TELEGRAM_BOT_TOKEN,
        ctx.chatId,
        TELEGRAM_DOCK_WELCOME_TEXT,
        TELEGRAM_REPLY_KEYBOARD,
      ),
      handleStartCommand(ctx.chatId, startMatch[1], env),
    ]);
    await dispatchReply(ctx.chatId, reply, env, null);
    return { handled: 'start', replyText: reply.text };
  }
  const [progressMsgId, workspace] = await Promise.all([
    sendInstantFeedback(ctx, env),
    ensureWorkspaceForTelegramChatId(ctx.chatId, env),
  ]);
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
  await dispatchReply(ctx.chatId, reply, env, progressMsgId);
  return { handled: routed ? 'command' : 'message', replyText: reply.text };
}
