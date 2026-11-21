import type { FamilyMemberInput, FamilyRole } from '../../src/domain/types.js';
import type { PlanRequestPayload } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { verifyCustomOption } from './customOptionVerifier.js';
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
  detectMemberSwitchIntent,
  summarizeMemberPatchNotes,
} from './memberMatcher.js';
import {
  extractSiteControlPatch,
  ROLE_DISPLAY_NAMES,
  summarizeHouseholdChanges,
} from './naturalSiteControlExtractor.js';
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

async function resolveVerifiedCustomRole(
  candidate: string | undefined,
  workspace: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<FamilyRole | undefined> {
  if (!candidate) {
    return undefined;
  }
  const verified = await verifyCustomOption(
    { category: 'role', customText: candidate, language: workspace.payload.language },
    env,
  );
  return verified.isValid ? (verified.mappedValue as FamilyRole) : undefined;
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

async function persistFreeformChanges(params: {
  readonly workspace: SyncedWorkspaceRecord;
  readonly targetMember: FamilyMemberInput;
  readonly memberSwitched: boolean;
  readonly combinedMemberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly promptText: string;
  readonly gpsLat: number | undefined;
  readonly result: CheckinResult;
  readonly env: ServerEnv;
}): Promise<{ readonly saved: SyncedWorkspaceRecord; readonly locationChanged: boolean }> {
  const { workspace, targetMember, combinedMemberPatch, householdPatch, promptText, result, env } =
    params;
  const locationChanged =
    params.gpsLat !== undefined ||
    (shouldPersistLocationMention(promptText) && result.resolvedCity !== workspace.payload.city);
  const needsSave =
    params.memberSwitched ||
    locationChanged ||
    hasHabitPatch(combinedMemberPatch) ||
    Object.keys(householdPatch).length > 0;
  let saved = workspace;
  if (needsSave) {
    const locationUpdate = locationChanged
      ? { city: result.resolvedCity, lat: result.resolvedLat, lon: result.resolvedLon }
      : null;
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

async function resolveMemberPrePatch(
  promptText: string,
  workspace: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<{
  readonly prePatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
}> {
  const sitePatch = extractSiteControlPatch(promptText);
  const verifiedRole = sitePatch.memberPatch.role
    ? undefined
    : await resolveVerifiedCustomRole(sitePatch.customRoleCandidate, workspace, env);
  return {
    prePatch: { ...sitePatch.memberPatch, ...(verifiedRole ? { role: verifiedRole } : {}) },
    householdPatch: sitePatch.householdPatch,
  };
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
    updatedCity: params.locationChanged ? params.result.resolvedCity : null,
  });
  return {
    text: prefixActiveUser(params.saved, `${switchNote}${params.result.reply}${footer}`),
    buttons: buildTelegramMenuForMember(activeNow.label),
  };
}

/** Handles natural-language Telegram messages with sticky user switching and full-site sync. */
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
  const switched = detectMemberSwitchIntent(promptText, workspace.payload.members);
  const targetMember = switched ?? getActiveMember(workspace);
  const memberSwitched = Boolean(switched && switched.id !== workspace.activeMemberId);
  const { prePatch, householdPatch } = await resolveMemberPrePatch(promptText, workspace, env);
  const { city, lat, lon, language, areaM2, cadrM3Hr } = workspace.payload;
  const result = await handleCompanionCheckin(
    {
      member: applyMemberHabitPatch(targetMember, prePatch as Record<string, unknown>),
      message: promptText,
      city,
      lat,
      lon,
      gpsLat,
      gpsLon,
      language: householdPatch.language ?? language,
      areaM2: householdPatch.areaM2 ?? areaM2,
      cadrM3Hr: householdPatch.cadrM3Hr ?? cadrM3Hr,
      channel: 'telegram',
    },
    env,
  );
  const combinedMemberPatch: ProfileHabitPatch = { ...result.habitPatch, ...prePatch };
  const persisted = await persistFreeformChanges({
    workspace,
    targetMember,
    memberSwitched,
    combinedMemberPatch,
    householdPatch,
    promptText,
    gpsLat,
    result,
    env,
  });
  const replyArgs = { ...persisted, memberSwitched, combinedMemberPatch, householdPatch, result };
  return buildFreeformReplyPayload(replyArgs);
}
