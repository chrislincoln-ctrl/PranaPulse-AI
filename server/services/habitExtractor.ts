import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { CommuteModeId } from '../../src/domain/types.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';

const NOON_HOUR = 12;
const HOURS_IN_DAY = 24;
const MAX_MINUTES = 59;
const MAX_EXTRACTED_NOTE = 150;
const MIN_LOCATION_LEN = 3;
const MAX_LOCATION_LEN = 48;

const LOCATION_PREP_RE =
  /\b(?:near|at|in|around|from|outside(?:\s+at|\s+in|\s+near)?)\s+([A-Za-z][A-Za-z0-9\s-]{2,42}?)(?=(?:[,.?!]|$|\s+(?:and|right now|now|today|tonight|tomorrow|thinking|heading|going|walking|leaving|how|is|are|for|with|to)\b))/i;

const TIME_RANGE_RE =
  /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const LEAVE_TIME_RE =
  /\b(?:leave|leaving|depart|go out|start|school|office|walk)\s+(?:at|around|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const RETURN_TIME_RE =
  /\b(?:return|back|home|finish|pickup)\s+(?:at|around|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const HEALTH_CUE_RE =
  /\b(asthma|wheez\w*|inhaler|cough\w*|breathless\w*|copd|bronchitis|allergy|sinus|chest tight\w*)\b/i;

const HABIT_CUE_RE =
  /\b(every day|daily|routine|schedule|terrace|balcony|walk\w*|jog\w*|school|office|tuition|park|gym|market)\b/i;

const LOCATION_STOPWORDS = new Set([
  'home',
  'house',
  'work',
  'school',
  'office',
  'the',
  'my',
  'this',
  'that',
  'here',
  'there',
  'today',
  'morning',
  'evening',
  'afternoon',
  'night',
]);

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

function normalizeClockTime(
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
  if (/\bscooter|two-wheeler|motorbike|scooty\b/.test(lower)) {
    return 'two-wheeler';
  }
  if (/\bcycl\w*|bicycle\b/.test(lower)) {
    return 'cycling';
  }
  if (/\bwalk\w*\b/.test(lower)) {
    return 'walking';
  }
  return undefined;
}

/** Extracts an optional locality or city name mentioned in natural conversation. */
export function extractLocationMention(message: string): string | null {
  const match = LOCATION_PREP_RE.exec(message);
  const candidate = match?.[1]?.trim();
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

function extractTimeBounds(message: string): {
  readonly leaveHomeTime?: string;
  readonly returnHomeTime?: string;
} {
  const range = TIME_RANGE_RE.exec(message);
  if (range) {
    const [, h1, m1, mer1, h2, m2, mer2] = range;
    const leave = normalizeClockTime(h1, m1, mer1);
    const ret = normalizeClockTime(h2, m2, mer2);
    return {
      ...(leave ? { leaveHomeTime: leave } : {}),
      ...(ret ? { returnHomeTime: ret } : {}),
    };
  }
  const leaveMatch = LEAVE_TIME_RE.exec(message);
  const retMatch = RETURN_TIME_RE.exec(message);
  const [, lh, lm, lmer] = leaveMatch ?? [];
  const [, rh, rm, rmer] = retMatch ?? [];
  const leave = normalizeClockTime(lh, lm, lmer);
  const ret = normalizeClockTime(rh, rm, rmer);
  return {
    ...(leave ? { leaveHomeTime: leave } : {}),
    ...(ret ? { returnHomeTime: ret } : {}),
  };
}

/** Extracts schedule times, commute modes, health cues, and routine updates from natural text. */
export function extractHabitUpdates(message: string): ProfileHabitPatch {
  const cleanMsg = sanitizeUserText(message, MAX_EXTRACTED_NOTE);
  const lower = cleanMsg.toLowerCase();
  const times = extractTimeBounds(cleanMsg);
  const commuteMode = detectCommuteMode(lower);
  const healthNotes = HEALTH_CUE_RE.test(cleanMsg) ? cleanMsg : undefined;
  const dailyHabitsNote =
    HABIT_CUE_RE.test(cleanMsg) || times.leaveHomeTime || times.returnHomeTime
      ? cleanMsg
      : undefined;

  return {
    ...times,
    ...(commuteMode ? { commuteMode } : {}),
    ...(healthNotes ? { healthNotes } : {}),
    ...(dailyHabitsNote ? { dailyHabitsNote } : {}),
  };
}

/** Checks whether a habit patch contains at least one actionable update field. */
export function hasHabitPatch(patch: ProfileHabitPatch): boolean {
  return Boolean(
    patch.leaveHomeTime ??
    patch.returnHomeTime ??
    patch.commuteMode ??
    patch.healthNotes ??
    patch.dailyHabitsNote ??
    patch.archetype ??
    patch.city,
  );
}
