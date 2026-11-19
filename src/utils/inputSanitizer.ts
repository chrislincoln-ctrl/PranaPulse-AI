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
