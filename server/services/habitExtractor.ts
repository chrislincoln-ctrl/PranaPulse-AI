import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { CommuteModeId, FamilyMemberInput, MaskTypeId } from '../../src/domain/types.js';
import { deriveOutdoorHoursFromTimes, sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';

const NOON_HOUR = 12;
const HOURS_IN_DAY = 24;
const MAX_MINUTES = 59;
const MAX_EXTRACT_INPUT = 600;
const MAX_EXTRACTED_NOTE = 150;
const MIN_LOCATION_LEN = 3;
const MAX_LOCATION_LEN = 48;
const MERIDIEM_GROUP_IDX = 3;

const LOCATION_PREP_RE =
  /\b(?:near|at|in|around|from|outside(?:\s+at|\s+in|\s+near)?|(?:switch|change|set)\s+(?:my\s+)?(?:city|location)\s+to|moved\s+to)\s+([A-Za-z][A-Za-z0-9\s,-]{2,42}?)(?=(?:[.?!]|$|\s+(?:and|right now|now|today|tonight|tomorrow|thinking|heading|going|walking|leaving|how|is|are|for|with|to)\b))/i;

const PERSIST_CITY_INTENT_RE =
  /\b(?:i am|i'm|im|currently|right now|here in|located in|staying in|living in|switch(?:ed)?\s+(?:city|location)|change(?:d)?\s+(?:city|location)|set\s+(?:city|location)|moved\s+to)\b/i;

const TIME_RANGE_RE =
  /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const LEAVE_TIME_RE =
  /\b(?:leav(?:e|es|ing)|depart(?:s|ing)?|head(?:s|ing)?\s+out|go(?:es|ing)?\s+out|step(?:s|ping)?\s+out|start(?:s|ing)?|school|office|walk)(?:\s+(?:the\s+)?(?:home|house|for\s+(?:school|office|work|college|university|campus)))?\s+(?:(?:at|by|from)\s+(?:around|about|approx\.?|roughly)|around|about|approx\.?|roughly|at|by|from)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const RETURN_TIME_RE =
  /\b(?:return(?:s|ing)?(?:\s+back)?|com(?:e|es|ing)\s+back|get(?:s|ting)?\s+back|reach(?:es|ing)?|arriv(?:e|es|ing)|back|finish(?:es|ing)?|pickup)(?:\s+(?:to\s+)?(?:home|house))?\s+(?:(?:at|by|till|until)\s+(?:around|about|approx\.?|roughly)|around|about|approx\.?|roughly|at|by|till|until)\s+(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*){0,2}(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const HEALTH_CUE_RE =
  /\b(asthma|wheez\w*|inhaler|cough\w*|breathless\w*|copd|bronchitis|allergy|sinus|chest tight\w*)\b/i;

const HABIT_CUE_RE =
  /\b(every day|daily|routine|schedule|terrace|balcony|walk\w*|jog\w*|school|office|tuition|park|gym|market)\b/i;

const MEMBER_NUM_RE = /\bmember\s*(\d+)\b/i;

const LOCATION_STOPWORDS = new Set(
  'home house work school office college university hostel campus class classes tuition hospital clinic shop store mall market cafe restaurant club clubb movie cinema gym room bedroom terrace balcony indoor indoors outdoor outdoors car bus metro the my this that here there today tomorrow tonight morning evening afternoon night am pm january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday'.split(
    ' ',
  ),
);

function applyMeridiem(hour: number, meridiem: string | undefined): number {
  if (meridiem === 'pm' && hour < NOON_HOUR) {
    return hour + NOON_HOUR;
  }
  if (meridiem === 'am' && hour === NOON_HOUR) {
    return 0;
  }
  return hour;
}

function parseValidMinute(minRaw: string | undefined): number | null {
  if (!minRaw) {
    return 0;
  }
  const minute = Number.parseInt(minRaw, VALIDATION_BOUNDS.DECIMAL_BASE);
  return Number.isFinite(minute) && minute >= 0 && minute <= MAX_MINUTES ? minute : null;
}

/** Normalizes 12-hour or 24-hour clock components into strict `"HH:MM"` format. */
export function normalizeClockTime(
  hourRaw: string | undefined,
  minRaw: string | undefined,
  meridiemRaw: string | undefined,
): string | undefined {
  if (!hourRaw) {
    return undefined;
  }
  const rawHour = Number.parseInt(hourRaw, VALIDATION_BOUNDS.DECIMAL_BASE);
  const minute = parseValidMinute(minRaw);
  if (!Number.isFinite(rawHour) || minute === null) {
    return undefined;
  }
  const hour = applyMeridiem(rawHour, meridiemRaw?.toLowerCase());
  if (hour < 0 || hour >= HOURS_IN_DAY) {
    return undefined;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function detectCommuteMode(lower: string): CommuteModeId | undefined {
  if (/\bmetro|subway|train\b/.test(lower)) {
    return 'metro';
  }
  if (/\belectric bus|e-bus|school bus|bus\b/.test(lower)) {
    return 'electric-bus';
  }
  if (/\b(?:ev|electric)\s+car\b/.test(lower)) {
    return 'ev-car';
  }
  if (
    /\b(?:petrol|diesel|cab|taxi|uber|ola|private|ac)\s*car\b|\bby car\b|\bdriving\b/.test(lower)
  ) {
    return 'petrol-car';
  }
  if (/\bscooter|two-wheeler|motorbike|scooty|motorcycle|bike\b/.test(lower)) {
    return 'two-wheeler';
  }
  if (/\bcycl\w*|bicycle\b/.test(lower)) {
    return 'cycling';
  }
  return /\bwalk\w*\b/.test(lower) ? 'walking' : undefined;
}

function detectMaskPreference(lower: string): MaskTypeId | undefined {
  if (!/\bmask|n95|ffp2|kn95\b/.test(lower)) {
    return undefined;
  }
  if (/\bn95|ffp2|kn95\b/.test(lower)) {
    return 'n95-ffp2';
  }
  if (/\bsurgical\b/.test(lower)) {
    return 'surgical';
  }
  if (/\bcloth\b/.test(lower)) {
    return 'cloth';
  }
  return /\bno mask|without mask\b/.test(lower) ? 'none' : undefined;
}

/** Extracts an optional locality or city name mentioned in natural conversation. */
export function extractLocationMention(message: string): string | null {
  const match = LOCATION_PREP_RE.exec(message);
  const candidate = match?.[1]?.trim().replace(/,+$/, '');
  if (!candidate || candidate.length < MIN_LOCATION_LEN) {
    return null;
  }
  const cleaned = sanitizeUserText(candidate, MAX_LOCATION_LEN);
  const firstWord = cleaned.toLowerCase().split(/\s+/)[0] ?? '';
  if (LOCATION_STOPWORDS.has(cleaned.toLowerCase()) || LOCATION_STOPWORDS.has(firstWord)) {
    return null;
  }
  return cleaned;
}

/** Returns true when a user message states their current city/location should be updated permanently. */
export function shouldPersistLocationMention(message: string): boolean {
  return PERSIST_CITY_INTENT_RE.test(message);
}

function findMemberByFirstName(
  words: ReadonlySet<string>,
  members: readonly FamilyMemberInput[],
): string | null {
  for (const m of members) {
    const first = m.label.split(/[\s(]/)[0]?.trim().toLowerCase() ?? '';
    if (first.length >= MIN_LOCATION_LEN && words.has(first)) {
      return m.id;
    }
  }
  return null;
}

/** Detects whether the message explicitly targets a specific household member by number or first name. */
export function detectMentionedMemberId(
  message: string,
  members: readonly FamilyMemberInput[],
): string | null {
  const numMatch = MEMBER_NUM_RE.exec(message);
  if (numMatch?.[1]) {
    const byIdx = members[Number.parseInt(numMatch[1], VALIDATION_BOUNDS.DECIMAL_BASE) - 1];
    if (byIdx) {
      return byIdx.id;
    }
  }
  const words = new Set(
    message
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  return findMemberByFirstName(words, members);
}

function packTimeBounds(
  leave: string | undefined,
  ret: string | undefined,
): { readonly leaveHomeTime?: string; readonly returnHomeTime?: string } {
  return {
    ...(leave ? { leaveHomeTime: leave } : {}),
    ...(ret ? { returnHomeTime: ret } : {}),
  };
}

function parseMatchClock(match: RegExpExecArray | null): string | undefined {
  return match ? normalizeClockTime(match[1], match[2], match[MERIDIEM_GROUP_IDX]) : undefined;
}

function inferReturnClock(
  leave: string | undefined,
  retMatch: RegExpExecArray | null,
): string | undefined {
  if (!retMatch) {
    return undefined;
  }
  const explicitMeridiem = retMatch[MERIDIEM_GROUP_IDX];
  const parsed = normalizeClockTime(retMatch[1], retMatch[2], explicitMeridiem);
  if (!parsed || explicitMeridiem || !leave) {
    return parsed;
  }
  const leaveHr = Number.parseInt(leave.slice(0, 2), VALIDATION_BOUNDS.DECIMAL_BASE);
  const retHr = Number.parseInt(parsed.slice(0, 2), VALIDATION_BOUNDS.DECIMAL_BASE);
  if (retHr > 0 && retHr < NOON_HOUR && retHr < leaveHr) {
    return `${String(retHr + NOON_HOUR).padStart(2, '0')}${parsed.slice(2)}`;
  }
  return parsed;
}

function extractTimeBounds(message: string): {
  readonly leaveHomeTime?: string;
  readonly returnHomeTime?: string;
} {
  const leaveMatch = LEAVE_TIME_RE.exec(message);
  const retMatch = RETURN_TIME_RE.exec(message);
  if (leaveMatch || retMatch) {
    const leave = parseMatchClock(leaveMatch);
    return packTimeBounds(leave, inferReturnClock(leave, retMatch));
  }
  const range = TIME_RANGE_RE.exec(message);
  if (!range) {
    return {};
  }
  const [, h1, m1, mer1, h2, m2, mer2] = range;
  return packTimeBounds(normalizeClockTime(h1, m1, mer1), normalizeClockTime(h2, m2, mer2));
}

function buildHabitNote(
  noteSnippet: string,
  times: { readonly leaveHomeTime?: string; readonly returnHomeTime?: string },
): string | undefined {
  const hasCue =
    HABIT_CUE_RE.test(noteSnippet) || Boolean(times.leaveHomeTime ?? times.returnHomeTime);
  return hasCue ? noteSnippet : undefined;
}

/** Extracts schedule times, commute modes, masks, health cues, and routine updates from natural text. */
export function extractHabitUpdates(message: string): ProfileHabitPatch {
  const fullClean = sanitizeUserText(message, MAX_EXTRACT_INPUT);
  const noteSnippet = fullClean.slice(0, MAX_EXTRACTED_NOTE).trim();
  const lower = fullClean.toLowerCase();
  const times = extractTimeBounds(fullClean);
  const commuteMode = detectCommuteMode(lower);
  const mask = detectMaskPreference(lower);
  const healthNotes = HEALTH_CUE_RE.test(fullClean) ? noteSnippet : undefined;
  const dailyHabitsNote = buildHabitNote(noteSnippet, times);

  return {
    ...times,
    ...(commuteMode ? { commuteMode } : {}),
    ...(mask ? { mask } : {}),
    ...(healthNotes ? { healthNotes } : {}),
    ...(dailyHabitsNote ? { dailyHabitsNote } : {}),
  };
}

/** Checks whether a habit patch contains at least one actionable update field. */
export function hasHabitPatch(patch: ProfileHabitPatch): boolean {
  return Object.values(patch).some((v) => v !== undefined);
}

/** Auto-calculates dailyOutdoorHours from leave/return window when times change and hours were not explicitly given. */
export function enrichDerivedOutdoorHours(
  patch: ProfileHabitPatch,
  existing: Pick<FamilyMemberInput, 'leaveHomeTime' | 'returnHomeTime'> = {},
): ProfileHabitPatch {
  if (patch.dailyOutdoorHours !== undefined) {
    return patch;
  }
  const hasTimeUpdate = Boolean(patch.leaveHomeTime ?? patch.returnHomeTime);
  if (!hasTimeUpdate) {
    return patch;
  }
  const derived = deriveOutdoorHoursFromTimes(
    patch.leaveHomeTime ?? existing.leaveHomeTime,
    patch.returnHomeTime ?? existing.returnHomeTime,
  );
  return derived === undefined ? patch : { ...patch, dailyOutdoorHours: derived };
}
