/** Public static asset path for the atmospheric skyline orb artwork. */
export const ORB_IMAGE_SRC = '/winter-smog-orb-v2.webp';
/** Duration in seconds for the initial hero orb opening choreography. */
export const INTRO_DURATION = 3.8;
/** Responsive bokeh particle counts around the orb rim. */
export const PARTICLE_COUNT = { desktop: 36, mobile: 20 } as const;

/** Lifecycle animation state of the landing page atmospheric orb. */
export type OrbState = 'intro' | 'resting' | 'frozen' | 'reduced';

/** Immutable geometric and timing parameters for one floating bokeh particle. */
export interface ParticleSpec {
  readonly id: number;
  readonly xPct: number;
  readonly yPct: number;
  readonly sizePx: number;
  readonly colorIndex: 0 | 1 | 2;
  readonly fadeStart: number;
  readonly risePx: number;
  readonly swayPx: number;
  readonly driftDur: number;
  readonly driftDelay: number;
  readonly twinkleDur: number;
  readonly twinkleDelay: number;
}

/** Dark-mode particle color palette (emerald, cyan, amber). */
export const DARK_PARTICLE_COLORS = ['#34d399', '#22d3ee', '#fbbf24'] as const;
/** Light-mode particle color palette for high contrast on pale paper. */
export const LIGHT_PARTICLE_COLORS = ['#059669', '#0891b2', '#d97706'] as const;

const BEZEL_INITIAL_INNER_SCALE = 0.855;
const BEZIER_ITERATIONS = 12;
const BEZIER_THREE = 3;
const HALF = 0.5;
const MAIN_EASE_X1 = 0.16;
const MAIN_EASE_X2 = 0.3;
const GROWTH_EXP = 1.9;
const SCALE_DUR_SEC = 2.4;
const SCALE_START = 0.45;
const SCALE_DELTA = 0.55;
const OPACITY_START = 0.85;
const OPACITY_DELTA = 0.15;
const HAZE_DUR_SEC = 1.8;
const RIM_START_SEC = 0.8;
const BEZEL_DUR_SEC = 0.8;
const IMG_FILL_DELTA = 0.05;
const RIPPLE_START_SEC = 3.0;
const RIPPLE_SCALE_DELTA = 0.18;
const RIPPLE_FADE_IN_SEC = 0.06;
const RIPPLE_FADE_EXP = 1.15;
const RIPPLE_MAX_OPACITY = 0.9;
const FIXED_FOUR = 4;
const FIXED_THREE = 3;
const RNG_SEED = 20261121;
const LCG_MULT = 1664525;
const LCG_INC = 1013904223;
const UINT32_MOD = 4294967296;
const ORB_LAYER_RATIO = 1.9;
const CENTER_PCT = 50;
const ANGLE_JITTER = 0.36;
const INNER_SLOT_MOD = 7;
const INNER_R_BASE = 0.65;
const INNER_R_SPAN = 0.35;
const OUTER_R_BASE = 1.05;
const OUTER_R_SPAN = 0.52;
const SIZE_BASE_PX = 2.2;
const SIZE_SPAN_PX = 2.8;
const COLOR_MOD = 3;
const FADE_BASE_SEC = 0.4;
const FADE_SPREAD_SEC = 0.78;
const FADE_JITTER_SEC = 0.07;
const SPEED_BASE = 6;
const DRIFT_BASE_SEC = 6;
const DRIFT_SPAN_SEC = 3;
const SWAY_BASE_PX = 5;
const TWINKLE_SPAN_SEC = 2.6;

let heroIntroPlayed = false;
let heroIntroStartMs: number | null = null;
const introStartListeners = new Set<(startMs: number) => void>();

/** Returns whether the landing orb intro sequence has already completed in this session. */
export function hasPlayedHeroIntro(): boolean {
  return heroIntroPlayed;
}

/** Marks the landing orb intro sequence as completed for subsequent mounts. */
export function markHeroIntroPlayed(): void {
  heroIntroPlayed = true;
}

/** Subscribes to the shared hero intro start timestamp coordinator used by SmokeCanvas. */
export function subscribeHeroIntroStart(listener: (startMs: number) => void): () => void {
  if (heroIntroPlayed) {
    listener(-1);
  } else if (heroIntroStartMs !== null) {
    listener(heroIntroStartMs);
  }
  introStartListeners.add(listener);
  return () => {
    introStartListeners.delete(listener);
  };
}

/** Broadcasts the shared hero intro start timestamp (or -1 when resting/reduced). */
export function broadcastHeroIntroStart(startMs: number): void {
  heroIntroStartMs = startMs;
  introStartListeners.forEach((fn) => {
    fn(startMs);
  });
}

/** Reads optional dev-only `?introT=<seconds>` query override for frame inspection. */
export function getDevIntroTime(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = new URLSearchParams(window.location.search).get('introT');
    if (raw === null || raw.trim() === '') {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep01(v: number): number {
  const c = clamp01(v);
  return c * c * (BEZIER_THREE - 2 * c);
}

/** Solves a 1D CSS cubic-bezier curve `cubic-bezier(x1, y1, x2, y2)` via binary search. */
export function solveCubicBezier(
  x: number,
  coords: readonly [number, number, number, number],
): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const [x1, y1, x2, y2] = coords;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < BEZIER_ITERATIONS; i += 1) {
    const mt = 1 - t;
    const bx = BEZIER_THREE * mt * mt * t * x1 + BEZIER_THREE * mt * t * t * x2 + t * t * t;
    if (bx < x) {
      lo = t;
    } else {
      hi = t;
    }
    t = HALF * (lo + hi);
  }
  const mt = 1 - t;
  return BEZIER_THREE * mt * mt * t * y1 + BEZIER_THREE * mt * t * t * y2 + t * t * t;
}

function easeOutMain(x: number): number {
  return solveCubicBezier(x, [MAIN_EASE_X1, 1, MAIN_EASE_X2, 1]);
}

function easeOutGrowth(x: number): number {
  return 1 - Math.pow(1 - clamp01(x), GROWTH_EXP);
}

/** Detects whether the active document theme is dark mode. */
export function getIsDarkMode(): boolean {
  return typeof document === 'undefined' ? true : document.documentElement.dataset.mode !== 'light';
}

/** Detects whether the user requested reduced motion via OS/browser preferences. */
export function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Detects whether the current viewport falls within the mobile breakpoint (`<= 639px`). */
export function getIsMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(max-width: 639px)').matches;
}

function computeRippleState(t: number): readonly [number, number] {
  if (t < RIPPLE_START_SEC || t > INTRO_DURATION) {
    return [1, 0];
  }
  const rp = clamp01((t - RIPPLE_START_SEC) / (INTRO_DURATION - RIPPLE_START_SEC));
  const scale = 1 + RIPPLE_SCALE_DELTA * easeOutMain(rp);
  const fadeIn = clamp01((t - RIPPLE_START_SEC) / RIPPLE_FADE_IN_SEC);
  const fadeOut = Math.pow(1 - rp, RIPPLE_FADE_EXP);
  return [scale, RIPPLE_MAX_OPACITY * fadeIn * fadeOut];
}

/** Writes all orb intro timeline values at `tSec` (`0..3.8s`) into CSS custom properties. */
export function applyOrbClock(el: HTMLElement, tSec: number): void {
  const t = Math.max(0, tSec);
  const orbScale = SCALE_START + SCALE_DELTA * easeOutGrowth(t / SCALE_DUR_SEC);
  const orbOpacity = OPACITY_START + OPACITY_DELTA * easeOutMain(clamp01(t));
  const hazeAlpha = 1 - smoothstep01(t / HAZE_DUR_SEC);
  const rimP = smoothstep01(t - RIM_START_SEC);
  const bezelP = easeOutMain(clamp01((t - SCALE_DUR_SEC) / BEZEL_DUR_SEC));
  const innerScale = BEZEL_INITIAL_INNER_SCALE + (1 - BEZEL_INITIAL_INNER_SCALE) * bezelP;
  const imgFillScale = 1 + IMG_FILL_DELTA * bezelP;
  const [rippleScale, rippleOpacity] = computeRippleState(t);

  const vars: readonly (readonly [string, string])[] = [
    ['--orb-scale', orbScale.toFixed(FIXED_FOUR)],
    ['--orb-opacity', orbOpacity.toFixed(FIXED_FOUR)],
    ['--orb-haze', hazeAlpha.toFixed(FIXED_FOUR)],
    ['--orb-warm', (1 - rimP).toFixed(FIXED_FOUR)],
    ['--orb-cool', rimP.toFixed(FIXED_FOUR)],
    ['--orb-inner-scale', innerScale.toFixed(FIXED_FOUR)],
    ['--orb-img-scale', imgFillScale.toFixed(FIXED_FOUR)],
    ['--orb-bezel-lip', (1 - bezelP).toFixed(FIXED_FOUR)],
    ['--orb-ripple-scale', rippleScale.toFixed(FIXED_FOUR)],
    ['--orb-ripple-opacity', rippleOpacity.toFixed(FIXED_FOUR)],
    ['--orb-p-time', Math.min(t, INTRO_DURATION).toFixed(FIXED_THREE)],
  ];
  for (const [name, value] of vars) {
    el.style.setProperty(name, value);
  }
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * LCG_MULT + LCG_INC) >>> 0;
    return state / UINT32_MOD;
  };
}

function toColorIndex(idx: number): 0 | 1 | 2 {
  const rem = idx % COLOR_MOD;
  if (rem === 0) {
    return 0;
  }
  return rem === 1 ? 1 : 2;
}

/** Generates deterministic bokeh particle coordinates and drift timings around the orb aura. */
export function generateParticles(count: number): readonly ParticleSpec[] {
  const rand = createSeededRng(RNG_SEED);
  const orbRadiusPct = (HALF / ORB_LAYER_RATIO) * 100;
  const items: ParticleSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const baseAngle = (i / count) * Math.PI * 2 + (rand() - HALF) * ANGLE_JITTER;
    const rMult =
      i % INNER_SLOT_MOD === 0
        ? INNER_R_BASE + rand() * INNER_R_SPAN
        : OUTER_R_BASE + rand() * OUTER_R_SPAN;
    const driftDur = DRIFT_BASE_SEC + rand() * DRIFT_SPAN_SEC;
    const speedPxPerSec = SPEED_BASE + rand() * SPEED_BASE;
    const twinkleDur = 2 + rand() * TWINKLE_SPAN_SEC;
    items.push({
      id: i,
      xPct: CENTER_PCT + Math.cos(baseAngle) * rMult * orbRadiusPct,
      yPct: CENTER_PCT + Math.sin(baseAngle) * rMult * orbRadiusPct,
      sizePx: SIZE_BASE_PX + rand() * SIZE_SPAN_PX,
      colorIndex: toColorIndex(i),
      fadeStart:
        FADE_BASE_SEC +
        (((i * INNER_SLOT_MOD) % count) / Math.max(1, count - 1)) * FADE_SPREAD_SEC +
        rand() * FADE_JITTER_SEC,
      risePx: -(speedPxPerSec * driftDur),
      swayPx: (rand() > HALF ? 1 : -1) * (SWAY_BASE_PX + rand() * SWAY_BASE_PX),
      driftDur,
      driftDelay: -(rand() * driftDur),
      twinkleDur,
      twinkleDelay: -(rand() * twinkleDur),
    });
  }
  return items;
}
