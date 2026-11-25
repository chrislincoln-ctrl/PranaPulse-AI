import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { FamilyMemberInput, FamilyRole } from '../../src/domain/types.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';

export const ROLE_DISPLAY_NAMES: Readonly<Record<FamilyRole, string>> = {
  child: 'Child / school student',
  'senior-respiratory': 'Senior / COPD / asthma',
  commuter: 'Adult outdoor commuter',
  caregiver: 'Home caregiver',
};

const MIN_NAME_LEN = 3;
const MIN_FUZZY_LEN = 4;
const MAX_MEMBER_LABEL_LEN = 40;
const DEFAULT_NEW_OUTDOOR_HRS = 2;

export const RENAME_MEMBER_RE =
  /(?:rename\s+(?:me|my\s+profile|this\s+member)\s+to|(?:change|set|update)\s+my\s+name\s+to)\s+([A-Za-z][A-Za-z0-9\s()'-]{1,40}?)(?=[.,!?]|$|\s+(?:and|with|who)\b)/i;

const ADD_MEMBER_PRIMARY_RE =
  /\b(?:add|create|register|include)\s+(?:a\s+)?(?:new\s+)?(?:family\s+)?member(?:\s+(?:named|called))?[,:\s-]+([A-Za-z][A-Za-z0-9\s()'-]{1,36}?)(?=[.,!?]|\s+(?:who|he|she|they|is|has|wears|takes|uses|leaves|returns|with|as|aged|for|and)\b|$)/i;
const ADD_MEMBER_ALT_RE =
  /\badd\s+([A-Za-z][A-Za-z'-]{1,28})\s+(?:as\s+(?:a\s+)?(?:new\s+)?(?:family\s+)?member|to\s+(?:the\s+|my\s+|our\s+)?(?:family|roster|household))\b/i;
const REMOVE_MEMBER_RE =
  /\b(?:remove|delete)\s+(?:(?:family\s+)?member\s+)?([A-Za-z0-9#][A-Za-z0-9\s#'-]{1,28}?)(?=[.,!?]|\s+from\b|$)/i;

const MEMBER_NUM_RE = /\bmember\s*#?\s*(\d+)\b/i;

function phoneticKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ee|ea/g, 'i')
    .replace(/aa/g, 'a')
    .replace(/oo/g, 'u')
    .replace(/ph/g, 'f')
    .replace(/(.)\1+/g, '$1');
}

function advanceMismatch(a: string, b: string, i: number, j: number): readonly [number, number] {
  if (a.length > b.length) {
    return [i + 1, j];
  }
  return b.length > a.length ? [i, j + 1] : [i + 1, j + 1];
}

function isOneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) {
    return false;
  }
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else {
      edits += 1;
      if (edits > 1) {
        return false;
      }
      [i, j] = advanceMismatch(a, b, i, j);
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function wordMatchesFirstName(word: string, firstName: string): boolean {
  if (firstName.length < MIN_NAME_LEN) {
    return false;
  }
  if (word === firstName) {
    return true;
  }
  const wp = phoneticKey(word);
  const fp = phoneticKey(firstName);
  if (wp.length >= MIN_NAME_LEN && wp === fp) {
    return true;
  }
  return (
    word.length >= MIN_FUZZY_LEN && firstName.length >= MIN_FUZZY_LEN && isOneEditApart(wp, fp)
  );
}

/**
 * Identifies a household member mentioned in Telegram text (e.g. "Hi I am Mira",
 * "This is Rohan", "Member 2") using phonetic + 1-edit fuzzy matching so the active user sticks.
 */
export function detectMemberSwitchIntent(
  message: string,
  members: readonly FamilyMemberInput[],
): FamilyMemberInput | null {
  const withoutRename = message.replace(RENAME_MEMBER_RE, '');
  const numMatch = MEMBER_NUM_RE.exec(withoutRename);
  if (numMatch?.[1]) {
    const picked = members[Number.parseInt(numMatch[1], VALIDATION_BOUNDS.DECIMAL_BASE) - 1];
    if (picked) {
      return picked;
    }
  }
  const words = withoutRename
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= MIN_NAME_LEN);
  for (const member of members) {
    const first = member.label.split(/[\s(]/)[0]?.trim().toLowerCase() ?? '';
    if (words.some((w) => wordMatchesFirstName(w, first))) {
      return member;
    }
  }
  return null;
}

/** Extracts a short display first name from labels like "Meera (Senior)". */
export function memberShortName(label: string): string {
  const head = label.split(/[\s(]/)[0]?.trim();
  return head && head.length > 0 ? head : label;
}

function buildOptionalMemberPatch(patch: ProfileHabitPatch): Partial<FamilyMemberInput> {
  return {
    ...(patch.leaveHomeTime !== undefined ? { leaveHomeTime: patch.leaveHomeTime } : {}),
    ...(patch.returnHomeTime !== undefined ? { returnHomeTime: patch.returnHomeTime } : {}),
    ...(patch.commuteMode !== undefined ? { commuteMode: patch.commuteMode } : {}),
    ...(patch.healthNotes !== undefined ? { healthNotes: patch.healthNotes } : {}),
    ...(patch.dailyHabitsNote !== undefined ? { dailyHabitsNote: patch.dailyHabitsNote } : {}),
    ...(patch.archetype !== undefined ? { archetype: patch.archetype } : {}),
  };
}

/** Applies all defined member-level patch fields onto a FamilyMemberInput without clobbering existing fields. */
export function applyMemberHabitPatch(
  member: FamilyMemberInput,
  patch: ProfileHabitPatch,
): FamilyMemberInput {
  return {
    ...member,
    label: patch.label ?? member.label,
    role: patch.role ?? member.role,
    dailyOutdoorHours: patch.dailyOutdoorHours ?? member.dailyOutdoorHours,
    mask: patch.mask ?? member.mask,
    ...buildOptionalMemberPatch(patch),
  };
}

function summarizeIdentityNotes(
  patch: ProfileHabitPatch,
  updatedCity: string | null,
  roleDisplayNames: Readonly<Record<FamilyRole, string>>,
): string[] {
  const items: readonly (string | false)[] = [
    updatedCity ? `City: ${updatedCity}` : false,
    patch.label ? `Name -> ${patch.label}` : false,
    patch.role ? `Vulnerability -> ${roleDisplayNames[patch.role]}` : false,
    patch.dailyOutdoorHours !== undefined
      ? `Outdoor ${String(patch.dailyOutdoorHours)} hrs/day`
      : false,
  ];
  return items.filter((v): v is string => typeof v === 'string');
}

function summarizeRoutineNotes(patch: ProfileHabitPatch): string[] {
  const items: readonly (string | false)[] = [
    patch.leaveHomeTime ? `Leave ${patch.leaveHomeTime}` : false,
    patch.returnHomeTime ? `Return ${patch.returnHomeTime}` : false,
    patch.commuteMode ? `Mode ${patch.commuteMode}` : false,
    patch.mask ? `Mask ${patch.mask}` : false,
  ];
  return items.filter((v): v is string => typeof v === 'string');
}

/** Formats human-readable member profile and schedule change labels for Telegram sync footers. */
export function summarizeMemberPatchNotes(
  patch: ProfileHabitPatch,
  updatedCity: string | null,
  roleDisplayNames: Readonly<Record<FamilyRole, string>>,
): string[] {
  return [
    ...summarizeIdentityNotes(patch, updatedCity, roleDisplayNames),
    ...summarizeRoutineNotes(patch),
  ];
}

/** Extracts a requested new family member name from natural phrases like "Add a new member, Chris". */
export function extractAddMemberName(message: string): string | undefined {
  const raw = ADD_MEMBER_PRIMARY_RE.exec(message)?.[1] ?? ADD_MEMBER_ALT_RE.exec(message)?.[1];
  const clean = raw ? sanitizeUserText(raw.trim(), MAX_MEMBER_LABEL_LEN) : '';
  return clean.length >= 2 ? clean : undefined;
}

/** Resolves an existing family member targeted by a "remove/delete <name>" request. */
export function extractRemoveMemberIntent(
  message: string,
  members: readonly FamilyMemberInput[],
): FamilyMemberInput | null {
  const target = REMOVE_MEMBER_RE.exec(message)?.[1];
  return target ? detectMemberSwitchIntent(target, members) : null;
}

/** Builds a new household member with a collision-free ID and all attributes extracted from chat. */
export function createNewFamilyMember(
  name: string,
  patch: ProfileHabitPatch,
  members: readonly FamilyMemberInput[],
): FamilyMemberInput {
  let maxId = members.length;
  for (const m of members) {
    const num = Number.parseInt(m.id.replace(/\D/g, ''), VALIDATION_BOUNDS.DECIMAL_BASE);
    if (Number.isFinite(num) && num > maxId) {
      maxId = num;
    }
  }
  const base: FamilyMemberInput = {
    id: `m${String(maxId + 1)}`,
    label: sanitizeUserText(name, MAX_MEMBER_LABEL_LEN),
    role: patch.role ?? 'commuter',
    mask: patch.mask ?? 'n95-ffp2',
    dailyOutdoorHours: patch.dailyOutdoorHours ?? DEFAULT_NEW_OUTDOOR_HRS,
  };
  return applyMemberHabitPatch(base, { ...patch, label: base.label });
}

function findMemberById(
  members: readonly FamilyMemberInput[],
  id: string | undefined,
): FamilyMemberInput | null {
  return id ? (members.find((m) => m.id === id) ?? null) : null;
}

function resolveSwitchedMember(
  promptText: string,
  members: readonly FamilyMemberInput[],
  aiSwitchId: string | undefined,
  blocked: boolean,
): FamilyMemberInput | null {
  if (blocked) {
    return null;
  }
  return detectMemberSwitchIntent(promptText, members) ?? findMemberById(members, aiSwitchId);
}

/** Resolves add-member, remove-member, or sticky active-member switching from hybrid AI + regex output. */
export function resolveRosterMembershipIntent(params: {
  readonly promptText: string;
  readonly members: readonly FamilyMemberInput[];
  readonly activeMember: FamilyMemberInput;
  readonly aiAddName?: string | undefined;
  readonly aiRemoveId?: string | undefined;
  readonly aiSwitchId?: string | undefined;
}): {
  readonly addMemberName?: string | undefined;
  readonly removeMember: FamilyMemberInput | null;
  readonly targetMember: FamilyMemberInput;
  readonly memberSwitched: boolean;
} {
  const { promptText, members, activeMember } = params;
  const addMemberName = params.aiAddName ?? extractAddMemberName(promptText);
  const removeMember = addMemberName
    ? null
    : (findMemberById(members, params.aiRemoveId) ??
      extractRemoveMemberIntent(promptText, members));
  const switched = resolveSwitchedMember(
    promptText,
    members,
    params.aiSwitchId,
    Boolean(addMemberName ?? removeMember),
  );
  return {
    ...(addMemberName ? { addMemberName } : {}),
    removeMember,
    targetMember: switched ?? activeMember,
    memberSwitched: Boolean(switched && switched.id !== activeMember.id),
  };
}
