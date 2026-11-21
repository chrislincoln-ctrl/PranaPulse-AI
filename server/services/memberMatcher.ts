import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { FamilyMemberInput, FamilyRole } from '../../src/domain/types.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';

const MIN_NAME_LEN = 3;
const MIN_FUZZY_LEN = 4;

export const RENAME_MEMBER_RE =
  /(?:rename\s+(?:me|my\s+profile|this\s+member)\s+to|(?:change|set|update)\s+my\s+name\s+to)\s+([A-Za-z][A-Za-z0-9\s()'-]{1,40}?)(?=[.,!?]|$|\s+(?:and|with|who)\b)/i;

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

const MEMBER_PATCH_KEYS: readonly (keyof FamilyMemberInput)[] = [
  'label',
  'role',
  'dailyOutdoorHours',
  'leaveHomeTime',
  'returnHomeTime',
  'commuteMode',
  'mask',
  'healthNotes',
  'dailyHabitsNote',
  'archetype',
];

/** Applies all defined member-level patch fields onto a FamilyMemberInput without clobbering existing fields. */
export function applyMemberHabitPatch(
  member: FamilyMemberInput,
  patch: Partial<Record<string, unknown>>,
): FamilyMemberInput {
  const next: Record<string, unknown> = { ...member };
  for (const key of MEMBER_PATCH_KEYS) {
    const val = patch[key];
    if (val !== undefined) {
      next[key] = val;
    }
  }
  return next as unknown as FamilyMemberInput;
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
