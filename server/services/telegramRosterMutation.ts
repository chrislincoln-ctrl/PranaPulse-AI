import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { FamilyMemberInput } from '../../src/domain/types.js';
import type { PlanRequestPayload } from '../../src/validators/schemas.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { hasHabitPatch } from './habitExtractor.js';
import {
  applyMemberHabitPatch,
  createNewFamilyMember,
  ROLE_DISPLAY_NAMES,
  summarizeMemberPatchNotes,
} from './memberMatcher.js';
import { summarizeHouseholdChanges } from './naturalSiteControlExtractor.js';

export interface RosterMutationOutcome {
  readonly members: readonly FamilyMemberInput[];
  readonly activeId: string;
  readonly changed: boolean;
  readonly tag?: string | undefined;
  readonly warning?: string | undefined;
}

function handleAddMember(
  baseMembers: readonly FamilyMemberInput[],
  targetId: string,
  addMemberName: string,
  memberPatch: ProfileHabitPatch,
): RosterMutationOutcome {
  if (baseMembers.length >= VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS) {
    return {
      members: baseMembers,
      activeId: targetId,
      changed: false,
      warning: `Family roster already has the maximum ${String(VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS)} members. Remove a member before adding ${addMemberName}.`,
    };
  }
  const created = createNewFamilyMember(addMemberName, memberPatch, baseMembers);
  return {
    members: [...baseMembers, created],
    activeId: targetId,
    changed: true,
    tag: `Added member: ${created.label}`,
  };
}

function handleRemoveMember(
  baseMembers: readonly FamilyMemberInput[],
  targetId: string,
  removeMember: FamilyMemberInput,
): RosterMutationOutcome {
  if (baseMembers.length <= VALIDATION_BOUNDS.MIN_FAMILY_MEMBERS) {
    return {
      members: baseMembers,
      activeId: targetId,
      changed: false,
      warning: 'At least 1 family member must remain in the roster.',
    };
  }
  const next = baseMembers.filter((m) => m.id !== removeMember.id);
  const activeId = targetId === removeMember.id ? (next[0]?.id ?? targetId) : targetId;
  return { members: next, activeId, changed: true, tag: `Removed member: ${removeMember.label}` };
}

/** Applies add-member, remove-member, or in-place profile updates onto the household roster. */
export function applyRosterMutation(params: {
  readonly baseMembers: readonly FamilyMemberInput[];
  readonly targetId: string;
  readonly addMemberName?: string | undefined;
  readonly removeMember: FamilyMemberInput | null;
  readonly memberPatch: ProfileHabitPatch;
}): RosterMutationOutcome {
  const { baseMembers, targetId, addMemberName, removeMember, memberPatch } = params;
  if (addMemberName) {
    return handleAddMember(baseMembers, targetId, addMemberName, memberPatch);
  }
  if (removeMember) {
    return handleRemoveMember(baseMembers, targetId, removeMember);
  }
  const members = hasHabitPatch(memberPatch)
    ? baseMembers.map((m) =>
        m.id === targetId ? applyMemberHabitPatch(m, memberPatch as Record<string, unknown>) : m,
      )
    : baseMembers;
  return { members, activeId: targetId, changed: false };
}

function resolveMemberSyncNotes(params: {
  readonly isRemove: boolean;
  readonly memberPatch: ProfileHabitPatch;
  readonly updatedCity: string | null;
}): string[] {
  if (params.isRemove) {
    return params.updatedCity ? [`City: ${params.updatedCity}`] : [];
  }
  return summarizeMemberPatchNotes(params.memberPatch, params.updatedCity, ROLE_DISPLAY_NAMES);
}

/** Formats the Telegram sync confirmation footer for profile edits, member additions, and removals. */
export function formatTelegramSyncFooter(params: {
  readonly memberLabel: string;
  readonly memberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly updatedCity: string | null;
  readonly rosterTag?: string | undefined;
  readonly rosterWarning?: string | undefined;
  readonly isRemove?: boolean | undefined;
}): string {
  const warn = params.rosterWarning ? `\n\nNote: ${params.rosterWarning}` : '';
  const memberNotes = resolveMemberSyncNotes({
    isRemove: Boolean(params.isRemove),
    memberPatch: params.memberPatch,
    updatedCity: params.updatedCity,
  });
  const notes = [...memberNotes, ...summarizeHouseholdChanges(params.householdPatch)];
  const scope = params.rosterTag ?? params.memberLabel;
  if (notes.length === 0) {
    return params.rosterTag || hasHabitPatch(params.memberPatch)
      ? `\n\nSynced to website: ${scope}${warn}`
      : warn;
  }
  return `\n\nSynced to website (${scope}): ${notes.join(' | ')}${warn}`;
}
