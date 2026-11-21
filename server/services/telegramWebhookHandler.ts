import type { FamilyMemberInput } from '../../src/domain/types.js';
import type { ServerEnv } from '../env.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { handleCompanionCheckin } from './familyCompanionAgent.js';
import { recordCompanionCheckin } from './familyCompanionStore.js';
import {
  detectMentionedMemberId,
  hasHabitPatch,
  shouldPersistLocationMention,
} from './habitExtractor.js';
import {
  ensureWorkspaceForTelegramChatId,
  getActiveMember,
  redeemWorkspaceLinkCode,
  updateWorkspaceFromTelegram,
  type SyncedWorkspaceRecord,
} from './householdWorkspaceStore.js';
import { buildLiveScheduleBrief, type TelegramReplyPayload } from './telegramCardBuilders.js';
import {
  answerTelegramCallbackQuery,
  DEFAULT_TELEGRAM_BUTTONS,
  sendTelegramLocationPrompt,
  sendTelegramMessage,
  type TelegramWebhookUpdate,
} from './telegramClient.js';
import { routeTelegramCommand } from './telegramCommandRouter.js';

export { buildLiveScheduleBrief } from './telegramCardBuilders.js';

const START_COMMAND_RE = /^\/start(?:\s+([A-Za-z0-9_-]+))?/i;

function applyPatchToMember(
  member: FamilyMemberInput,
  patch: ProfileHabitPatch,
): FamilyMemberInput {
  return {
    ...member,
    ...(patch.leaveHomeTime ? { leaveHomeTime: patch.leaveHomeTime } : {}),
    ...(patch.returnHomeTime ? { returnHomeTime: patch.returnHomeTime } : {}),
    ...(patch.commuteMode ? { commuteMode: patch.commuteMode } : {}),
    ...(patch.mask ? { mask: patch.mask } : {}),
    ...(patch.healthNotes ? { healthNotes: patch.healthNotes } : {}),
    ...(patch.dailyHabitsNote ? { dailyHabitsNote: patch.dailyHabitsNote } : {}),
    ...(patch.archetype ? { archetype: patch.archetype } : {}),
  };
}

function formatSyncFooter(
  memberLabel: string,
  patch: ProfileHabitPatch,
  updatedCity: string | null,
): string {
  const notes: string[] = [];
  if (updatedCity) {
    notes.push(`City: ${updatedCity}`);
  }
  if (patch.leaveHomeTime) {
    notes.push(`Leave ${patch.leaveHomeTime}`);
  }
  if (patch.returnHomeTime) {
    notes.push(`Return ${patch.returnHomeTime}`);
  }
  if (patch.commuteMode) {
    notes.push(`Mode ${patch.commuteMode}`);
  }
  if (patch.mask) {
    notes.push(`Mask ${patch.mask}`);
  }
  if (notes.length === 0) {
    return hasHabitPatch(patch) ? `\n\nSynced to website: ${memberLabel}` : '';
  }
  return `\n\nSynced to website (${memberLabel}): ${notes.join(' | ')}`;
}

async function handleStartCommand(
  chatId: string,
  code: string | undefined,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const linked =
    (code ? await redeemWorkspaceLinkCode(code, chatId, env) : null) ??
    (await ensureWorkspaceForTelegramChatId(chatId, env));
  const active = getActiveMember(linked);
  const brief = await buildLiveScheduleBrief(linked, env);
  const text = `Linked to ${active.label} (${linked.payload.city})! Everything you update here syncs live with your website — tap any button below or message naturally.\n\n${brief}`;
  return { text, buttons: DEFAULT_TELEGRAM_BUTTONS };
}

async function persistFreeformChanges(params: {
  readonly workspace: SyncedWorkspaceRecord;
  readonly targetMember: FamilyMemberInput;
  readonly promptText: string;
  readonly gpsLat: number | undefined;
  readonly result: Awaited<ReturnType<typeof handleCompanionCheckin>>;
  readonly env: ServerEnv;
}): Promise<boolean> {
  const { workspace, targetMember, promptText, gpsLat, result, env } = params;
  const locationChanged =
    gpsLat !== undefined ||
    (shouldPersistLocationMention(promptText) && result.resolvedCity !== workspace.payload.city);
  const memberChanged = hasHabitPatch(result.habitPatch);
  if (locationChanged || memberChanged) {
    const members = memberChanged
      ? workspace.payload.members.map((m) =>
          m.id === targetMember.id ? applyPatchToMember(m, result.habitPatch) : m,
        )
      : workspace.payload.members;
    const nextPayload = {
      ...workspace.payload,
      ...(locationChanged
        ? { city: result.resolvedCity, lat: result.resolvedLat, lon: result.resolvedLon }
        : {}),
      members,
    };
    await updateWorkspaceFromTelegram(workspace, { payload: nextPayload }, env);
  }
  await recordCompanionCheckin(
    {
      memberProfileId: workspace.id,
      channel: 'telegram',
      direction: 'inbound',
      messageText: promptText,
      detectedCity: result.resolvedCity,
      detectedLat: result.resolvedLat,
      detectedLon: result.resolvedLon,
      extractedHabitNote: result.habitPatch.dailyHabitsNote ?? result.habitPatch.healthNotes,
      aqiSnapshot: result.aqi,
    },
    env,
  );
  return locationChanged;
}

async function handleFreeformMessage(params: {
  readonly workspace: SyncedWorkspaceRecord;
  readonly text: string;
  readonly gpsLat?: number | undefined;
  readonly gpsLon?: number | undefined;
  readonly env: ServerEnv;
}): Promise<TelegramReplyPayload> {
  const { workspace, env, gpsLat, gpsLon } = params;
  const promptText =
    params.text.trim() || 'I shared my current GPS location. How is the air and weather here?';
  const targetId =
    detectMentionedMemberId(promptText, workspace.payload.members) ?? workspace.activeMemberId;
  const targetMember =
    workspace.payload.members.find((m) => m.id === targetId) ?? getActiveMember(workspace);
  const result = await handleCompanionCheckin(
    {
      member: targetMember,
      message: promptText,
      city: workspace.payload.city,
      lat: workspace.payload.lat,
      lon: workspace.payload.lon,
      gpsLat,
      gpsLon,
      language: workspace.payload.language,
      areaM2: workspace.payload.areaM2,
      cadrM3Hr: workspace.payload.cadrM3Hr,
      channel: 'telegram',
    },
    env,
  );
  const locationChanged = await persistFreeformChanges({
    workspace,
    targetMember,
    promptText,
    gpsLat,
    result,
    env,
  });
  const footer = formatSyncFooter(
    targetMember.label,
    result.habitPatch,
    locationChanged ? result.resolvedCity : null,
  );
  return { text: `${result.reply}${footer}`, buttons: DEFAULT_TELEGRAM_BUTTONS };
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
    (await handleFreeformMessage({
      workspace,
      text: ctx.text,
      gpsLat: ctx.gpsLat,
      gpsLon: ctx.gpsLon,
      env,
    }));
  await dispatchReply(ctx.chatId, reply, env);
  return { handled: routed ? 'command' : 'message', replyText: reply.text };
}
