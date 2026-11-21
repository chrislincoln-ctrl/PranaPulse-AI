import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { computePlanPhysics } from '../../src/domain/localBaseline.js';
import type { ServerEnv } from '../env.js';
import { buildMemberScheduleSnapshot, handleCompanionCheckin } from './familyCompanionAgent.js';
import {
  ensureMemberForTelegramChatId,
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
const DEFAULT_CLEAN_HOUR = 13;

function formatWindowRange(hours: readonly number[]): string {
  if (hours.length === 0) {
    return '13:00 - 15:00';
  }
  const first = hours[0] ?? DEFAULT_CLEAN_HOUR;
  const last = hours[hours.length - 1] ?? first;
  return `${String(first).padStart(2, '0')}:00 - ${String(last).padStart(2, '0')}:59`;
}

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

async function buildLiveAirCard(profile: StoredMemberProfile, env: ServerEnv): Promise<string> {
  const telemetry = await getUrbanTelemetryBundle({
    lat: profile.lat,
    lon: profile.lon,
    cityLabel: profile.city,
    env,
  });
  const cur = telemetry.hourlySeries[0];
  const p = telemetry.currentPollutants;
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  return [
    `Live Air & Weather: ${profile.city} (${profile.label})`,
    `- CPCB NAQI: ${String(aqi)} (${telemetry.assessment.cpcbCategory}) | US-EPA: ${String(telemetry.assessment.usEpaAqi)}`,
    `- PM2.5: ${String(Math.round(p.pm25UgM3))} ug/m3 | PM10: ${String(Math.round(p.pm10UgM3))} ug/m3`,
    `- NO2: ${String(Math.round(p.no2UgM3))} ug/m3 | O3: ${String(Math.round(p.o3UgM3))} ug/m3`,
    `- Boundary Layer (PBL): ${String(telemetry.inversion.currentPblMeters)}m (${telemetry.inversion.currentSeverity})`,
    `- Weather: Wind ${String(Math.round(cur?.windKmh ?? 0))} km/h | Humidity ${String(Math.round(cur?.rhPercent ?? 0))}%`,
    `- Mask Advice: Use ${profile.mask} outdoors (${String(telemetry.assessment.cigaretteEquivPerDay)} cig/day ambient load).`,
  ].join('\n');
}

async function buildWindowSafetyCard(
  profile: StoredMemberProfile,
  env: ServerEnv,
): Promise<string> {
  const telemetry = await getUrbanTelemetryBundle({
    lat: profile.lat,
    lon: profile.lon,
    cityLabel: profile.city,
    env,
  });
  const member = storedProfileToFamilyMember(profile);
  const physics = computePlanPhysics(
    {
      ...DEFAULT_WORKSPACE_INPUT,
      city: profile.city,
      lat: profile.lat,
      lon: profile.lon,
      members: [member],
    },
    telemetry,
  );
  const openNow = telemetry.inversion.openWindowsNow;
  const cleanWin = formatWindowRange(telemetry.inversion.bestWindowHours);
  return [
    `Window & Purifier Check: ${profile.city} (${profile.label})`,
    `- Open Windows Now: ${openNow ? 'YES (Safe for 20-min cross-ventilation)' : 'NO (Keep windows & balcony sealed)'}`,
    `- Mixing Ceiling: ${String(telemetry.inversion.currentPblMeters)}m PBL (${telemetry.inversion.currentSeverity})`,
    `- Safest Airing Window Today: ${cleanWin}`,
    `- Indoor HEPA Target: ${String(physics.indoor.requiredCadr48Ach)} m3/hr CADR (~${String(physics.indoor.purge90Minutes)} min for 90% room purge)`,
    `- Mitigated Indoor PM2.5: ~${String(physics.indoor.dailyMeanMitigatedPm25)} ug/m3 (${String(physics.indoor.exposureReductionPct)}% reduction)`,
  ].join('\n');
}

async function handleStartCommand(
  chatId: string,
  code: string | undefined,
  env: ServerEnv,
): Promise<string> {
  const linked =
    (code ? await redeemTelegramLinkCode(code, chatId, env) : null) ??
    (await ensureMemberForTelegramChatId(chatId, env));
  const brief = await buildLiveScheduleBrief(linked, env);
  return `Linked to ${linked.label} (${linked.city})! You will receive personalized morning briefs and can message or drop a GPS pin anytime.\n\n${brief}`;
}

async function tryHandleTelegramQuickAction(
  lower: string,
  profile: StoredMemberProfile,
  env: ServerEnv,
): Promise<string | null> {
  if (lower === '/schedule' || lower === 'schedule') {
    return await buildLiveScheduleBrief(profile, env);
  }
  if (lower === '/air' || lower === 'air') {
    return await buildLiveAirCard(profile, env);
  }
  if (lower === '/windows' || lower === 'windows') {
    return await buildWindowSafetyCard(profile, env);
  }
  return null;
}

async function handleLinkedTelegramMessage(params: {
  readonly profile: StoredMemberProfile;
  readonly text: string;
  readonly gpsLat?: number | undefined;
  readonly gpsLon?: number | undefined;
  readonly env: ServerEnv;
}): Promise<string> {
  const quickCard = await tryHandleTelegramQuickAction(
    params.text.trim().toLowerCase(),
    params.profile,
    params.env,
  );
  if (quickCard) {
    return quickCard;
  }
  const promptText =
    params.text.trim() || 'I shared my current GPS location. How is the air and weather here?';
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
  const profile = await ensureMemberForTelegramChatId(ctx.chatId, env);
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
