import type { FamilyMemberInput } from '../../src/domain/types.js';
import type { PlanRequestPayload } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { handleCompanionCheckin } from './familyCompanionAgent.js';
import { recordCompanionCheckin } from './familyCompanionStore.js';
import {
  enrichDerivedOutdoorHours,
  hasHabitPatch,
  shouldPersistLocationMention,
} from './habitExtractor.js';
import {
  getActiveMember,
  updateWorkspaceFromTelegram,
  type SyncedWorkspaceRecord,
} from './householdWorkspaceStore.js';
import { applyMemberHabitPatch } from './memberMatcher.js';
import { resolveFullSiteControls } from './telegramAiControlParser.js';
import { prefixActiveUser, type TelegramReplyPayload } from './telegramCardBuilders.js';
import { buildTelegramMenuForMember } from './telegramClient.js';
import { applyRosterMutation, formatTelegramSyncFooter } from './telegramRosterMutation.js';

type CheckinResult = Awaited<ReturnType<typeof handleCompanionCheckin>>;
type LocationUpdate = { readonly city: string; readonly lat: number; readonly lon: number } | null;

function buildUpdatedPayload(params: {
  readonly base: PlanRequestPayload;
  readonly members: readonly FamilyMemberInput[];
  readonly memberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly locationUpdate: LocationUpdate;
  readonly rosterMutated: boolean;
}): PlanRequestPayload {
  const { base, members, memberPatch, householdPatch, locationUpdate, rosterMutated } = params;
  return {
    ...base,
    ...householdPatch,
    ...(!rosterMutated && memberPatch.mask ? { mask: memberPatch.mask } : {}),
    ...(!rosterMutated && memberPatch.commuteMode ? { commuteMode: memberPatch.commuteMode } : {}),
    ...(locationUpdate ?? {}),
    members: [...members],
  };
}

async function logTelegramCheckin(savedId: string, params: PersistFreeformInput): Promise<void> {
  await recordCompanionCheckin(
    {
      memberProfileId: savedId,
      channel: 'telegram',
      direction: 'inbound',
      messageText: params.promptText,
      detectedCity: params.result.resolvedCity,
      detectedLat: params.result.resolvedLat,
      detectedLon: params.result.resolvedLon,
      extractedHabitNote:
        params.combinedMemberPatch.dailyHabitsNote ?? params.combinedMemberPatch.healthNotes,
      aqiSnapshot: params.result.aqi,
    },
    params.env,
  );
}

function resolveLocationUpdate(params: {
  readonly currentCity: string;
  readonly promptText: string;
  readonly gpsLat: number | undefined;
  readonly aiCityUpdate: LocationUpdate;
  readonly result: CheckinResult;
}): LocationUpdate {
  if (params.gpsLat !== undefined) {
    return {
      city: params.result.resolvedCity,
      lat: params.result.resolvedLat,
      lon: params.result.resolvedLon,
    };
  }
  if (params.aiCityUpdate) {
    return params.aiCityUpdate;
  }
  const shouldPersist =
    shouldPersistLocationMention(params.promptText) &&
    params.result.resolvedCity !== params.currentCity;
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
  readonly addMemberName?: string | undefined;
  readonly removeMember: FamilyMemberInput | null;
  readonly combinedMemberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly aiCityUpdate: LocationUpdate;
  readonly promptText: string;
  readonly gpsLat: number | undefined;
  readonly result: CheckinResult;
  readonly env: ServerEnv;
}

interface PersistFreeformOutcome {
  readonly saved: SyncedWorkspaceRecord;
  readonly locationChanged: boolean;
  readonly rosterTag?: string | undefined;
  readonly rosterWarning?: string | undefined;
  readonly isRemove: boolean;
}

function shouldSaveWorkspace(
  params: PersistFreeformInput,
  rosterChanged: boolean,
  locationChanged: boolean,
): boolean {
  const isRosterCmd = Boolean(params.addMemberName ?? params.removeMember);
  const hasProfileEdit = !isRosterCmd && hasHabitPatch(params.combinedMemberPatch);
  const hasHouseholdEdit = Object.keys(params.householdPatch).length > 0;
  return (
    params.memberSwitched || rosterChanged || locationChanged || hasProfileEdit || hasHouseholdEdit
  );
}

async function persistFreeformChanges(
  params: PersistFreeformInput,
): Promise<PersistFreeformOutcome> {
  const { workspace, targetMember, combinedMemberPatch, householdPatch, promptText, result, env } =
    params;
  const locationUpdate = resolveLocationUpdate({
    currentCity: workspace.payload.city,
    promptText,
    gpsLat: params.gpsLat,
    aiCityUpdate: params.aiCityUpdate,
    result,
  });
  const roster = applyRosterMutation({
    baseMembers: workspace.payload.members,
    targetId: targetMember.id,
    addMemberName: params.addMemberName,
    removeMember: params.removeMember,
    memberPatch: combinedMemberPatch,
  });
  const locationChanged = locationUpdate !== null;
  let saved = workspace;
  if (shouldSaveWorkspace(params, roster.changed, locationChanged)) {
    const nextPayload = buildUpdatedPayload({
      base: workspace.payload,
      members: roster.members,
      memberPatch: combinedMemberPatch,
      householdPatch,
      locationUpdate,
      rosterMutated: Boolean(params.addMemberName ?? params.removeMember),
    });
    saved = await updateWorkspaceFromTelegram(
      workspace,
      { activeMemberId: roster.activeId, payload: nextPayload },
      env,
    );
  }
  await logTelegramCheckin(saved.id, params);
  return {
    saved,
    locationChanged,
    rosterTag: roster.tag,
    rosterWarning: roster.warning,
    isRemove: Boolean(params.removeMember && roster.changed),
  };
}

function buildFreeformReplyPayload(params: {
  readonly saved: SyncedWorkspaceRecord;
  readonly memberSwitched: boolean;
  readonly combinedMemberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly locationChanged: boolean;
  readonly rosterTag?: string | undefined;
  readonly rosterWarning?: string | undefined;
  readonly isRemove: boolean;
  readonly result: CheckinResult;
}): TelegramReplyPayload {
  const activeNow = getActiveMember(params.saved);
  const switchNote = params.memberSwitched
    ? `Switched active user to ${activeNow.label}. Staying on ${activeNow.label} until you tap "Change User".\n`
    : '';
  const footer = formatTelegramSyncFooter({
    memberLabel: activeNow.label,
    memberPatch: params.combinedMemberPatch,
    householdPatch: params.householdPatch,
    updatedCity: params.locationChanged ? params.saved.payload.city : null,
    rosterTag: params.rosterTag,
    rosterWarning: params.rosterWarning,
    isRemove: params.isRemove,
  });
  return {
    text: prefixActiveUser(params.saved, `${switchNote}${params.result.reply}${footer}`),
    buttons: buildTelegramMenuForMember(activeNow.label),
  };
}

/** Handles natural-language Telegram messages with AI multi-intent parsing, add/remove members, and full-site sync. */
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
  const checkinMember = ctrl.addMemberName
    ? ctrl.targetMember
    : applyMemberHabitPatch(ctrl.targetMember, ctrl.prePatch);
  const result = await handleCompanionCheckin(
    {
      member: checkinMember,
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
  const combinedMemberPatch = enrichDerivedOutdoorHours(
    { ...result.habitPatch, ...ctrl.prePatch },
    ctrl.addMemberName ? undefined : ctrl.targetMember,
  );
  const persisted = await persistFreeformChanges({
    ...ctrl,
    workspace,
    combinedMemberPatch,
    promptText,
    gpsLat,
    result,
    env,
  });
  return buildFreeformReplyPayload({ ...persisted, ...ctrl, combinedMemberPatch, result });
}
