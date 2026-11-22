import { SECURITY_LIMITS, VALIDATION_BOUNDS } from '../config/constants.js';

const CONTROL_CHARS_RE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(VALIDATION_BOUNDS.ASCII_CONTROL_MAX)}${String.fromCharCode(VALIDATION_BOUNDS.ASCII_DEL)}]`,
  'g',
);
const TAG_RE = /<[^>]*>/g;
const INJECTION_RE =
  /\b(ignore previous instructions|ignore all previous|system prompt|developer instructions|override instructions|jailbreak)\b/gi;
const ROUND_FACTOR = Math.pow(
  VALIDATION_BOUNDS.DECIMAL_BASE,
  SECURITY_LIMITS.COORDINATE_PRECISION_DECIMALS,
);
const CLOCK_24H_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = VALIDATION_BOUNDS.MAX_DAILY_HOURS * MINUTES_PER_HOUR;
const HALF_HOUR_STEP = 2;
const MIN_DERIVED_OUTDOOR_HOURS = 0.5;

/**
 * Strips XML/HTML tags, ASCII control characters, and known prompt-injection cues.
 */
export function sanitizeUserText(raw: string, maxLength: number): string {
  const noTags = raw.replace(TAG_RE, ' ').replace(CONTROL_CHARS_RE, ' ');
  const neutralized = noTags.replace(INJECTION_RE, '[filtered]');
  return neutralized.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Rounds coordinates to 2 decimal places (~1.1 km) to protect pinpoint residential privacy.
 */
export function quantizeCoord(value: number): number {
  return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
}

function parseClockMinutes(clock: string | undefined): number | null {
  if (!clock) {
    return null;
  }
  const match = CLOCK_24H_RE.exec(clock.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const hours = Number.parseInt(match[1], VALIDATION_BOUNDS.DECIMAL_BASE);
  const mins = Number.parseInt(match[2], VALIDATION_BOUNDS.DECIMAL_BASE);
  return hours * MINUTES_PER_HOUR + mins;
}

/**
 * Computes approximate daily outdoor hours (rounded to 0.5h) from 24-hour HH:MM leave & return times.
 */
export function deriveOutdoorHoursFromTimes(
  leaveTime: string | undefined,
  returnTime: string | undefined,
): number | undefined {
  const startMin = parseClockMinutes(leaveTime);
  const endMin = parseClockMinutes(returnTime);
  if (startMin === null || endMin === null || startMin === endMin) {
    return undefined;
  }
  const diffMin = endMin > startMin ? endMin - startMin : endMin + MINUTES_PER_DAY - startMin;
  const snapped = Math.round((diffMin / MINUTES_PER_HOUR) * HALF_HOUR_STEP) / HALF_HOUR_STEP;
  return Math.max(MIN_DERIVED_OUTDOOR_HOURS, Math.min(VALIDATION_BOUNDS.MAX_DAILY_HOURS, snapped));
}
