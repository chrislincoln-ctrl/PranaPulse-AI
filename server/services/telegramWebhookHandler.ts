import type { ServerEnv } from '../env.js';
import { buildMemberScheduleSnapshot, handleCompanionCheckin } from './familyCompanionAgent.js';
import {
  findMemberByTelegramChatId,
  recordCompanionCheckin,
  redeemTelegramLinkCode,
  storedProfileToFamilyMember,
  updateMemberHabitsByProfileId,
  type StoredMemberProfile,
} from './familyCompanionStore.js';
import { hasHabitPatch } from './habitExtractor.js';
import {
  answerTelegramCallbackQuery,
  DEFAULT_TELEGRAM_BUTTONS,
  sendTelegramMessage,
  type TelegramWebhookUpdate,
} from './telegramClient.js';
import { getUrbanTelemetryBundle } from './telemetryClients.js';

const START_COMMAND_RE = /^\/start(?:\s+([A-Za-z0-9_-]+))?/i;

/** Builds a fresh localized Telegram daily brief string for a stored member profile. */
export async function buildLiveScheduleBrief(
  profile: StoredMemberProfile,
  env: ServerEnv,
): Promise<string> {
  const telemetry = await getUrbanTelemetryBundle({
    lat: profile.lat,
    lon: profile.lon,
    cityLabel: profile.city,
    env,
  });
  const schedule = buildMemberScheduleSnapshot({
    member: storedProfileToFamilyMember(profile),
    city: profile.city,
    lat: profile.lat,
    lon: profile.lon,
    language: profile.language,
    telemetry,
  });
  return schedule.shareBriefText;
}

function resolveTelegramPromptText(rawText: string): string {
  const lower = rawText.trim().toLowerCase();
  if (lower === '/air' || lower === 'air') {
    return 'How is the air and weather right now?';
  }
  if (lower === 'windows') {
    return 'Is it safe to open windows right now?';
  }
  return rawText.trim() || 'I shared my current GPS location. How is the air and weather here?';
}

async function handleStartCommand(
  chatId: string,
  code: string | undefined,
  env: ServerEnv,
): Promise<string> {
  if (!code) {
    return 'Welcome to PranaPulse AI. Open Family Routine in the web app and tap "Connect Telegram" next to your name to link your daily schedule.';
  }
  const linked = await redeemTelegramLinkCode(code, chatId, env);
  if (!linked) {
    return 'This pairing link is expired or unrecognized. Generate a fresh "Connect Telegram" link from the PranaPulse Family Routine tab.';
  }
  const brief = await buildLiveScheduleBrief(linked, env);
  return `Linked to ${linked.label} (${linked.city})! You will receive personalized morning briefs and can message or drop a GPS pin anytime.\n\n${brief}`;
}

async function handleLinkedTelegramMessage(params: {
  readonly profile: StoredMemberProfile;
  readonly text: string;
  readonly gpsLat?: number | undefined;
  readonly gpsLon?: number | undefined;
  readonly env: ServerEnv;
}): Promise<string> {
  const lower = params.text.trim().toLowerCase();
  if (lower === '/schedule' || lower === 'schedule') {
    return await buildLiveScheduleBrief(params.profile, params.env);
  }
  const promptText = resolveTelegramPromptText(params.text);
  const result = await handleCompanionCheckin(
    {
      member: storedProfileToFamilyMember(params.profile),
      message: promptText,
      city: params.profile.city,
      lat: params.profile.lat,
      lon: params.profile.lon,
      gpsLat: params.gpsLat,
      gpsLon: params.gpsLon,
      language: params.profile.language,
      channel: 'telegram',
    },
    params.env,
  );
  if (hasHabitPatch(result.habitPatch)) {
    await updateMemberHabitsByProfileId(params.profile.id, result.habitPatch, params.env);
  }
  await recordCompanionCheckin(
    {
      memberProfileId: params.profile.id,
      channel: 'telegram',
      direction: 'inbound',
      messageText: promptText,
      detectedCity: result.resolvedCity,
      detectedLat: result.resolvedLat,
      detectedLon: result.resolvedLon,
      extractedHabitNote: result.habitPatch.dailyHabitsNote ?? result.habitPatch.healthNotes,
      aqiSnapshot: result.aqi,
    },
    params.env,
  );
  return result.reply;
}

function readRawChatId(update: TelegramWebhookUpdate): number | string | undefined {
  const msg = update.callback_query ? update.callback_query.message : update.message;
  return msg?.chat?.id;
}

function readUpdateText(update: TelegramWebhookUpdate): string {
  const raw = update.callback_query?.data ?? update.message?.text ?? '';
  return raw.trim();
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

/** Processes a single Telegram webhook update (start linking, GPS pin, button callback, or chat). */
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
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, reply, DEFAULT_TELEGRAM_BUTTONS);
    return { handled: 'start', replyText: reply };
  }
  const profile = await findMemberByTelegramChatId(ctx.chatId, env);
  if (!profile) {
    const reply =
      'Your Telegram account is not linked yet. Open PranaPulse Family Routine and tap "Connect Telegram" next to your name.';
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, reply);
    return { handled: 'unlinked', replyText: reply };
  }
  const reply = await handleLinkedTelegramMessage({
    profile,
    text: ctx.text,
    gpsLat: ctx.gpsLat,
    gpsLon: ctx.gpsLon,
    env,
  });
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, reply, DEFAULT_TELEGRAM_BUTTONS);
  return { handled: 'message', replyText: reply };
}
