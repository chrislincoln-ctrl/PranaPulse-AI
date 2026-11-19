import { UNIT_CONVERSIONS } from '../config/physicsConstants.js';

/**
 * Validates that a quantitative physical input is finite and non-negative.
 *
 * @param value - Input value to validate.
 * @param label - Field identifier included in thrown error diagnostics.
 * @returns Validated finite non-negative number.
 * @throws {RangeError} When value is NaN, infinite, or negative.
 */
export function assertFiniteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`);
  }
  return value;
}

/**
 * Validates that a physical geometric or rate parameter is finite and strictly positive.
 *
 * @param value - Input value to validate.
 * @param label - Field identifier included in thrown error diagnostics.
 * @returns Validated strictly positive number.
 * @throws {RangeError} When value is non-finite or less than or equal to zero.
 */
export function assertPositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
  return value;
}

/**
 * Rounds a floating-point domain metric cleanly to one decimal place.
 *
 * @param value - Raw computed scalar.
 * @returns Scalar rounded to 0.1 resolution.
 */
export function roundOne(value: number): number {
  return (
    Math.round(value * UNIT_CONVERSIONS.DECIMAL_ROUND_TEN) / UNIT_CONVERSIONS.DECIMAL_ROUND_TEN
  );
}
