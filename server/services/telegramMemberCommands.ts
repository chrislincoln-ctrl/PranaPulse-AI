import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { FamilyRole, MemberRoutineArchetype } from '../../src/domain/types.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { ServerEnv } from '../env.js';
import { verifyCustomOption } from './customOptionVerifier.js';
import {
  getActiveMember,
  updateWorkspaceFromTelegram,
  type SyncedWorkspaceRecord,
} from './householdWorkspaceStore.js';
import { detectMemberSwitchIntent } from './memberMatcher.js';
import { extractSiteControlPatch, ROLE_DISPLAY_NAMES } from './naturalSiteControlExtractor.js';
import {
  buildFamilyRosterCard,
  buildScheduleCard,
  buildWhoAreYouCard,
  prefixActiveUser,
  type TelegramReplyPayload,
} from './telegramCardBuilders.js';
import { buildTelegramMenuForMember } from './telegramClient.js';

export const ROLE_ALIASES: Readonly<Record<string, FamilyRole>> = {
  child: 'child',
  school: 'child',
  senior: 'senior-respiratory',
  'senior-respiratory': 'senior-respiratory',
  elder: 'senior-respiratory',
  commuter: 'commuter',
  office: 'commuter',
  college: 'commuter',
  caregiver: 'caregiver',
  home: 'caregiver',
};

/** Switches the sticky active family member via button tap or `/member` command. */
export async function handleMemberSwitch(
  arg: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const clean = arg.trim().toLowerCase();
  const numIdx = Number.parseInt(clean, VALIDATION_BOUNDS.DECIMAL_BASE) - 1;
  const target =
    ws.payload.members.find((m) => m.id.toLowerCase() === clean) ??
    ws.payload.members[numIdx] ??
    detectMemberSwitchIntent(arg, ws.payload.members) ??
    ws.payload.members.find((m) => m.label.toLowerCase().includes(clean));
  if (!target) {
    return buildWhoAreYouCard(ws);
  }
  const updated = await updateWorkspaceFromTelegram(ws, { activeMemberId: target.id }, env);
  const card = await buildScheduleCard(updated, env);
  const banner = `Switched active user to ${target.label} (synced). All messages & website edits now apply to ${target.label} until you tap "Change User".`;
  return { ...card, text: `${banner}\n\n${card.text}` };
}

async function resolveRoleInput(
  query: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<{
  readonly role?: FamilyRole | undefined;
  readonly archetype?: MemberRoutineArchetype | undefined;
  readonly error?: string | undefined;
}> {
  const sitePatch = extractSiteControlPatch(query);
  const direct = sitePatch.memberPatch.role ?? ROLE_ALIASES[query.toLowerCase()];
  if (direct) {
    return { role: direct, archetype: sitePatch.memberPatch.archetype };
  }
  const verified = await verifyCustomOption(
    { category: 'role', customText: query, language: ws.payload.language },
    env,
  );
  if (!verified.isValid) {
    return { error: verified.explanation };
  }
  return { role: verified.mappedValue as FamilyRole };
}

/** Updates the active family member's vulnerability profile via `/role <text>` and syncs to website. */
export async function handleRoleCommand(
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const active = getActiveMember(ws);
  const query = sanitizeUserText(rest, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  if (!query) {
    return {
      text: prefixActiveUser(
        ws,
        `Current vulnerability profile: ${ROLE_DISPLAY_NAMES[active.role]}.\nSend e.g. /role college student, /role senior, /role child, or /role homemaker.`,
      ),
      buttons: buildTelegramMenuForMember(active.label),
    };
  }
  const resolved = await resolveRoleInput(query, ws, env);
  if (!resolved.role) {
    return {
      text: prefixActiveUser(ws, resolved.error ?? 'Could not match vulnerability profile.'),
      buttons: buildTelegramMenuForMember(active.label),
    };
  }
  const nextRole = resolved.role;
  const members = ws.payload.members.map((m) =>
    m.id === active.id
      ? {
          ...m,
          role: nextRole,
          ...(resolved.archetype ? { archetype: resolved.archetype } : {}),
          dailyHabitsNote: query,
        }
      : m,
  );
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, members } },
    env,
  );
  const card = await buildFamilyRosterCard(updated, env);
  return {
    ...card,
    text: `${card.text}\n\nSynced (${active.label}): Vulnerability -> ${ROLE_DISPLAY_NAMES[nextRole]}.`,
  };
}
