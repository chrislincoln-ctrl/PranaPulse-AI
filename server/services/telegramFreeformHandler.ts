import type { FamilyMemberInput } from '../../src/domain/types.js';
import type { PlanRequestPayload } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { handleCompanionCheckin } from './familyCompanionAgent.js';
import { recordCompanionCheckin } from './familyCompanionStore.js';
import { hasHabitPatch, shouldPersistLocationMention } from './habitExtractor.js';
import {
  getActiveMember,
  updateWorkspaceFromTelegram,
  type SyncedWorkspaceRecord,
} from './householdWorkspaceStore.js';
import {
  applyMemberHabitPatch,
  ROLE_DISPLAY_NAMES,
  summarizeMemberPatchNotes,
} from './memberMatcher.js';
import { summarizeHouseholdChanges } from './naturalSiteControlExtractor.js';
import { resolveFullSiteControls } from './telegramAiControlParser.js';
import { prefixActiveUser, type TelegramReplyPayload } from './telegramCardBuilders.js';
import { buildTelegramMenuForMember } from './telegramClient.js';

type CheckinResult = Awaited<ReturnType<typeof handleCompanionCheckin>>;

function formatSyncFooter(params: {
  readonly memberLabel: string;
  readonly memberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly updatedCity: string | null;
}): string {
  const notes = [
    ...summarizeMemberPatchNotes(params.memberPatch, params.updatedCity, ROLE_DISPLAY_NAMES),
    ...summarizeHouseholdChanges(params.householdPatch),
  ];
  if (notes.length === 0) {
    return hasHabitPatch(params.memberPatch) ? `\n\nSynced to website: ${params.memberLabel}` : '';
  }
  return `\n\nSynced to website (${params.memberLabel}): ${notes.join(' | ')}`;
}

function buildUpdatedPayload(params: {
  readonly base: PlanRequestPayload;
  readonly targetId: string;
  readonly memberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly locationUpdate: {
    readonly city: string;
    readonly lat: number;
    readonly lon: number;
  } | null;
}): PlanRequestPayload {
  const { base, targetId, memberPatch, householdPatch, locationUpdate } = params;
  const members = hasHabitPatch(memberPatch)
    ? base.members.map((m) =>
        m.id === targetId ? applyMemberHabitPatch(m, memberPatch as Record<string, unknown>) : m,
      )
    : base.members;
  return {
    ...base,
    ...householdPatch,
    ...(memberPatch.mask ? { mask: memberPatch.mask } : {}),
    ...(memberPatch.commuteMode ? { commuteMode: memberPatch.commuteMode } : {}),
    ...(locationUpdate ?? {}),
    members,
  };
}

async function logTelegramCheckin(params: {
  readonly savedId: string;
  readonly promptText: string;
  readonly memberPatch: ProfileHabitPatch;
  readonly result: CheckinResult;
  readonly env: ServerEnv;
}): Promise<void> {
  await recordCompanionCheckin(
    {
      memberProfileId: params.savedId,
      channel: 'telegram',
      direction: 'inbound',
      messageText: params.promptText,
      detectedCity: params.result.resolvedCity,
      detectedLat: params.result.resolvedLat,
      detectedLon: params.result.resolvedLon,
      extractedHabitNote: params.memberPatch.dailyHabitsNote ?? params.memberPatch.healthNotes,
      aqiSnapshot: params.result.aqi,
    },
    params.env,
  );
}

type LocationUpdate = { readonly city: string; readonly lat: number; readonly lon: number } | null;

function resolveLocationUpdate(params: {
  readonly currentCity: string;
  readonly promptText: string;
  readonly gpsLat: number | undefined;
  readonly aiCityUpdate: LocationUpdate;
  readonly result: CheckinResult;
}): LocationUpdate {
  if (params.aiCityUpdate) {
    return params.aiCityUpdate;
  }
  const shouldPersist =
    params.gpsLat !== undefined ||
    (shouldPersistLocationMention(params.promptText) &&
      params.result.resolvedCity !== params.currentCity);
  return shouldPersist
    ? {
        city: params.result.resolvedCity,
        lat: params.result.resolvedLat,
        lon: params.result.resolvedLon,
      }
    : null;
}

interface PersistFreeformInput {
  readonly workspace: SyncedWorkspaceRecord;
  readonly targetMember: FamilyMemberInput;
  readonly memberSwitched: boolean;
  readonly combinedMemberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly aiCityUpdate: LocationUpdate;
  readonly promptText: string;
  readonly gpsLat: number | undefined;
  readonly result: CheckinResult;
  readonly env: ServerEnv;
}

async function persistFreeformChanges(
  params: PersistFreeformInput,
): Promise<{ readonly saved: SyncedWorkspaceRecord; readonly locationChanged: boolean }> {
  const { workspace, targetMember, combinedMemberPatch, householdPatch, promptText, result, env } =
    params;
  const locationUpdate = resolveLocationUpdate({
    currentCity: workspace.payload.city,
    promptText,
    gpsLat: params.gpsLat,
    aiCityUpdate: params.aiCityUpdate,
    result,
  });
  const locationChanged = locationUpdate !== null;
  const needsSave =
    params.memberSwitched ||
    locationChanged ||
    hasHabitPatch(combinedMemberPatch) ||
    Object.keys(householdPatch).length > 0;
  let saved = workspace;
  if (needsSave) {
    const nextPayload = buildUpdatedPayload({
      base: workspace.payload,
      targetId: targetMember.id,
      memberPatch: combinedMemberPatch,
      householdPatch,
      locationUpdate,
    });
    saved = await updateWorkspaceFromTelegram(
      workspace,
      { activeMemberId: targetMember.id, payload: nextPayload },
      env,
    );
  }
  await logTelegramCheckin({
    savedId: saved.id,
    promptText,
    memberPatch: combinedMemberPatch,
    result,
    env,
  });
  return { saved, locationChanged };
}

function buildFreeformReplyPayload(params: {
  readonly saved: SyncedWorkspaceRecord;
  readonly memberSwitched: boolean;
  readonly combinedMemberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly locationChanged: boolean;
  readonly result: CheckinResult;
}): TelegramReplyPayload {
  const activeNow = getActiveMember(params.saved);
  const switchNote = params.memberSwitched
    ? `Switched active user to ${activeNow.label}. Staying on ${activeNow.label} until you tap "Change User".\n`
    : '';
  const footer = formatSyncFooter({
    memberLabel: activeNow.label,
    memberPatch: params.combinedMemberPatch,
    householdPatch: params.householdPatch,
    updatedCity: params.locationChanged ? params.saved.payload.city : null,
  });
  return {
    text: prefixActiveUser(params.saved, `${switchNote}${params.result.reply}${footer}`),
    buttons: buildTelegramMenuForMember(activeNow.label),
  };
}

/** Handles natural-language Telegram messages with AI multi-intent parsing, sticky user switching, and full-site sync. */
export async function handleTelegramFreeformMessage(params: {
  readonly workspace: SyncedWorkspaceRecord;
  readonly text: string;
  readonly gpsLat?: number | undefined;
  readonly gpsLon?: number | undefined;
  readonly env: ServerEnv;
}): Promise<TelegramReplyPayload> {
  const { workspace, env, gpsLat, gpsLon } = params;
  const promptText =
    params.text.trim() || 'I shared my current GPS location. How is the air and weather here?';
  const ctrl = await resolveFullSiteControls(promptText, workspace, env);
  const activeCity = ctrl.aiCityUpdate ?? workspace.payload;
  const result = await handleCompanionCheckin(
    {
      member: applyMemberHabitPatch(ctrl.targetMember, ctrl.prePatch as Record<string, unknown>),
      message: promptText,
      city: activeCity.city,
      lat: activeCity.lat,
      lon: activeCity.lon,
      gpsLat,
      gpsLon,
      language: ctrl.householdPatch.language ?? workspace.payload.language,
      areaM2: ctrl.householdPatch.areaM2 ?? workspace.payload.areaM2,
      cadrM3Hr: ctrl.householdPatch.cadrM3Hr ?? workspace.payload.cadrM3Hr,
      channel: 'telegram',
    },
    env,
  );
  const combinedMemberPatch: ProfileHabitPatch = { ...result.habitPatch, ...ctrl.prePatch };
  const persisted = await persistFreeformChanges({
    workspace,
    targetMember: ctrl.targetMember,
    memberSwitched: ctrl.memberSwitched,
    combinedMemberPatch,
    householdPatch: ctrl.householdPatch,
    aiCityUpdate: ctrl.aiCityUpdate,
    promptText,
    gpsLat,
    result,
    env,
  });
  return buildFreeformReplyPayload({ ...persisted, ...ctrl, combinedMemberPatch, result });
}
