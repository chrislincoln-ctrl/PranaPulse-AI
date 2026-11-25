import { quantizeCoord } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { BoundedTtlCache } from './cacheAndLimiter.js';
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
  type TelegramWebhookUpdate,
} from './telegramClient.js';
import { routeTelegramCommand } from './telegramCommandRouter.js';
import { resolveTelegramFeedback } from './telegramFeedback.js';
import { handleTelegramFreeformMessage } from './telegramFreeformHandler.js';

export { buildLiveScheduleBrief } from './telegramCardBuilders.js';

const START_COMMAND_RE = /^\/start(?:\s+([A-Za-z0-9_-]+))?/i;
const VALID_CHAT_ID_RE = /^-?\d{1,20}$/;
const UPDATE_DEDUP_TTL_MS = 300_000;
const MAX_LAT = 90;
const MAX_LON = 180;
const processedUpdateIds = new BoundedTtlCache<true>(UPDATE_DEDUP_TTL_MS);

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

function readPrivateChatId(update: TelegramWebhookUpdate): string | null {
  const chat = (update.callback_query?.message ?? update.message)?.chat;
  if (!chat || (chat.type !== undefined && chat.type !== 'private')) {
    return null;
  }
  const str = String(chat.id).trim();
  return VALID_CHAT_ID_RE.test(str) ? str : null;
}

function readUpdateText(update: TelegramWebhookUpdate): string {
  const raw = update.callback_query ? update.callback_query.data : update.message?.text;
  return typeof raw === 'string' ? raw.trim() : '';
}

function isValidCoord(value: unknown, maxAbs: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= maxAbs;
}

function readQuantizedGps(
  update: TelegramWebhookUpdate,
): { readonly gpsLat: number; readonly gpsLon: number } | null {
  const loc = update.message?.location;
  if (!loc || !isValidCoord(loc.latitude, MAX_LAT) || !isValidCoord(loc.longitude, MAX_LON)) {
    return null;
  }
  return { gpsLat: quantizeCoord(loc.latitude), gpsLon: quantizeCoord(loc.longitude) };
}

interface TelegramUpdateContext {
  readonly chatId: string;
  readonly callbackId?: string;
  readonly text: string;
  readonly gpsLat?: number;
  readonly gpsLon?: number;
}

function extractUpdateContext(update: TelegramWebhookUpdate): TelegramUpdateContext | null {
  const chatId = readPrivateChatId(update);
  if (!chatId) {
    return null;
  }
  const gps = readQuantizedGps(update);
  const rawCallbackId = update.callback_query?.id;
  const callbackId = typeof rawCallbackId === 'string' && rawCallbackId ? rawCallbackId : undefined;
  return {
    chatId,
    ...(callbackId ? { callbackId } : {}),
    text: readUpdateText(update),
    ...(gps ?? {}),
  };
}

function isDuplicateUpdate(update: TelegramWebhookUpdate): boolean {
  const id = update.update_id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    return false;
  }
  const key = String(id);
  if (processedUpdateIds.get(key)) {
    return true;
  }
  processedUpdateIds.set(key, true);
  return false;
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
    await sendTelegramLocationPrompt(token, chatId, reply.text);
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

async function cleanupProgressOnError(
  env: ServerEnv,
  chatId: string,
  progressMsgId: number | null,
): Promise<void> {
  if (progressMsgId !== null) {
    await deleteTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, progressMsgId);
  }
}

/** Processes a single Telegram webhook update (start linking, GPS pin, button callback, command, or chat). */
export async function processTelegramUpdate(
  update: TelegramWebhookUpdate,
  env: ServerEnv,
): Promise<{ readonly handled: string; readonly replyText?: string }> {
  if (isDuplicateUpdate(update)) {
    return { handled: 'duplicate' };
  }
  const ctx = extractUpdateContext(update);
  if (!ctx) {
    return { handled: 'ignored' };
  }
  const startMatch = START_COMMAND_RE.exec(ctx.text);
  if (startMatch) {
    const [, progressMsgId, reply] = await Promise.all([
      sendTelegramChatAction(env.TELEGRAM_BOT_TOKEN, ctx.chatId, 'typing'),
      sendTelegramMessageWithId(
        env.TELEGRAM_BOT_TOKEN,
        ctx.chatId,
        'Connecting to PranaPulse AI...',
      ),
      handleStartCommand(ctx.chatId, startMatch[1], env),
    ]);
    await dispatchReply(ctx.chatId, reply, env, progressMsgId);
    return { handled: 'start', replyText: reply.text };
  }
  const [progressMsgId, workspace] = await Promise.all([
    sendInstantFeedback(ctx, env),
    ensureWorkspaceForTelegramChatId(ctx.chatId, env),
  ]);
  try {
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
  } catch (err) {
    await cleanupProgressOnError(env, ctx.chatId, progressMsgId);
    throw err;
  }
}
