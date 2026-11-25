import { solveCubicBezier } from './globeClock.js';
import { LANDING_SMOKE_FRAGMENT_SRC, LANDING_SMOKE_VERTEX_SRC } from './landingSmokeGlsl.js';

export { LANDING_SMOKE_FRAGMENT_SRC, LANDING_SMOKE_VERTEX_SRC };

const DARK_MAX_ALPHA = 0.44;
const LIGHT_MAX_ALPHA = 0.56;
const DARK_TEXT_CAP = 0.14;
const LIGHT_TEXT_CAP = 0.24;
const SEC_INTENSITY_MID = 0.72;
const SEC_INTENSITY_END = 0.68;

/** Maximum alpha ceilings for landing page WebGL smog in dark and light themes. */
export const SMOKE_MAX_ALPHA = { dark: DARK_MAX_ALPHA, light: LIGHT_MAX_ALPHA } as const;
/** Alpha caps inside the organic hero-text readability clear-zone. */
export const TEXT_ALPHA_CAP = { dark: DARK_TEXT_CAP, light: LIGHT_TEXT_CAP } as const;
/** Per-section smog intensity multipliers across the 4 landing sections. */
export const SMOKE_INTENSITY_BY_SECTION = [
  1.0,
  SEC_INTENSITY_MID,
  SEC_INTENSITY_MID,
  SEC_INTENSITY_END,
] as const;

const RGB_DIV = 255;
const DARK_BASE_R = 205;
const DARK_BASE_G = 215;
const DARK_BASE_B = 220;
const DARK_WARM_R = 235;
const DARK_WARM_G = 178;
const DARK_WARM_B = 108;
const LIGHT_BASE_R = 34;
const LIGHT_BASE_G = 48;
const LIGHT_BASE_B = 62;
const LIGHT_WARM_R = 146;
const LIGHT_WARM_G = 82;
const LIGHT_WARM_B = 24;

export const SMOKE_COLOR_DARK: readonly [number, number, number] = [
  DARK_BASE_R / RGB_DIV,
  DARK_BASE_G / RGB_DIV,
  DARK_BASE_B / RGB_DIV,
];
export const SMOKE_WARM_DARK: readonly [number, number, number] = [
  DARK_WARM_R / RGB_DIV,
  DARK_WARM_G / RGB_DIV,
  DARK_WARM_B / RGB_DIV,
];
export const SMOKE_COLOR_LIGHT: readonly [number, number, number] = [
  LIGHT_BASE_R / RGB_DIV,
  LIGHT_BASE_G / RGB_DIV,
  LIGHT_BASE_B / RGB_DIV,
];
export const SMOKE_WARM_LIGHT: readonly [number, number, number] = [
  LIGHT_WARM_R / RGB_DIV,
  LIGHT_WARM_G / RGB_DIV,
  LIGHT_WARM_B / RGB_DIV,
];

export const TEXT_FEATHER_PX = 44;
export const SECTION_EASE_MS = 1400;

const KNOT_V0 = 0.05;
const KNOT_T1 = 0.8;
const KNOT_V1 = 0.35;
const KNOT_T2 = 1.6;
const KNOT_V2 = 0.6;
const KNOT_T3 = 2.4;
const KNOT_V3 = 0.8;
const KNOT_T4 = 3.5;
const SECTION_BEZIER_X1 = 0.23;
const SECTION_BEZIER_X2 = 0.32;
const SECTION_BEZIER: readonly [number, number, number, number] = [
  SECTION_BEZIER_X1,
  1.0,
  SECTION_BEZIER_X2,
  1.0,
];

const INTRO_KNOTS: readonly (readonly [number, number])[] = [
  [0, KNOT_V0],
  [KNOT_T1, KNOT_V1],
  [KNOT_T2, KNOT_V2],
  [KNOT_T3, KNOT_V3],
  [KNOT_T4, 1.0],
];

/** Evaluates piecewise-linear landing smoke density ramp across the 3.5s intro timeline. */
export function evalSmokeIntroMultiplier(tSec: number): number {
  if (tSec <= 0) {
    return KNOT_V0;
  }
  if (tSec >= KNOT_T4) {
    return 1.0;
  }
  const idx = INTRO_KNOTS.findIndex((knot, i) => {
    const next = INTRO_KNOTS[i + 1];
    return next !== undefined && tSec >= knot[0] && tSec <= next[0];
  });
  const a = INTRO_KNOTS[idx];
  const b = INTRO_KNOTS[idx + 1];
  if (!a || !b) {
    return 1.0;
  }
  return a[1] + (b[1] - a[1]) * ((tSec - a[0]) / (b[0] - a[0]));
}

/** Eases landing smoke section transitions with `cubic-bezier(0.23, 1, 0.32, 1)`. */
export function cubicBezierSection(x: number): number {
  return solveCubicBezier(x, SECTION_BEZIER);
}

interface BoundsAcc {
  minL: number;
  minT: number;
  maxR: number;
  maxB: number;
}

function expandBounds(acc: BoundsAcc, rect: DOMRect): void {
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  acc.minL = Math.min(acc.minL, rect.left);
  acc.minT = Math.min(acc.minT, rect.top);
  acc.maxR = Math.max(acc.maxR, rect.right);
  acc.maxB = Math.max(acc.maxB, rect.bottom);
}

function collectTextNodeBounds(el: Element, range: Range | null, acc: BoundsAcc): void {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    return;
  }
  if ((el.tagName === 'P' || el.tagName === 'H1') && range) {
    try {
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects());
      if (rects.length > 0) {
        rects.forEach((tr) => {
          expandBounds(acc, tr);
        });
        return;
      }
    } catch {
      // Fall through to element bounding box when Range selection is unavailable.
    }
  }
  expandBounds(acc, r);
}

function isRectOffscreen(rect: DOMRect): boolean {
  return (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.bottom < -TEXT_FEATHER_PX ||
    rect.top > window.innerHeight + TEXT_FEATHER_PX
  );
}

/** Measures the visible hero text bounding box in CSS pixels for the shader readability clear-zone. */
export function measureHeroTextRect(
  container: HTMLElement | null,
): [number, number, number, number, number] {
  if (!container || typeof document === 'undefined') {
    return [0, 0, 0, 0, 0];
  }
  const cRect = container.getBoundingClientRect();
  if (isRectOffscreen(cRect)) {
    return [0, 0, 0, 0, 0];
  }
  const acc: BoundsAcc = {
    minL: Number.POSITIVE_INFINITY,
    minT: Number.POSITIVE_INFINITY,
    maxR: Number.NEGATIVE_INFINITY,
    maxB: Number.NEGATIVE_INFINITY,
  };
  const range = typeof document.createRange === 'function' ? document.createRange() : null;
  container.querySelectorAll('h1, p, button, span').forEach((node) => {
    collectTextNodeBounds(node, range, acc);
  });
  return Number.isFinite(acc.minL)
    ? [acc.minL, acc.minT, acc.maxR, acc.maxB, 1]
    : [cRect.left, cRect.top, cRect.right, cRect.bottom, 1];
}
