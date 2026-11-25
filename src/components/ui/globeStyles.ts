import type { CSSProperties } from 'react';
import type { ParticleSpec } from './globeClock.js';

/** CSS style object supporting custom `--*` variables without type-unsafe casts. */
export type CssVarStyle = CSSProperties & Record<`--${string}`, string>;

export const WARM_RIM_GRADIENT =
  'conic-gradient(from 0deg, #34d399 0deg, #22c55e 26deg, #f59e0b 68deg, #ef4444 142deg, #ef4444 218deg, #f59e0b 276deg, #f59e0b 314deg, #34d399 342deg, #34d399 360deg)';

export const COOL_RIM_GRADIENT =
  'conic-gradient(from 0deg, #34d399 0deg, var(--color-accent) 44deg, #fbbf24 88deg, #34d399 144deg, #22d3ee 210deg, #22d3ee 270deg, #34d399 322deg, #34d399 360deg)';

export const WARM_HALO_GRADIENT =
  'conic-gradient(from 0deg, rgba(52,211,153,0.68) 0deg, rgba(245,158,11,0.85) 60deg, rgba(239,68,68,0.92) 148deg, rgba(239,68,68,0.92) 212deg, rgba(245,158,11,0.86) 292deg, rgba(52,211,153,0.68) 360deg)';

export const COOL_HALO_GRADIENT =
  'conic-gradient(from 0deg, rgba(52,211,153,0.90) 0deg, var(--color-accent) 48deg, rgba(251,191,36,0.82) 92deg, rgba(52,211,153,0.88) 148deg, rgba(34,211,238,0.94) 225deg, rgba(52,211,153,0.90) 318deg, rgba(52,211,153,0.90) 360deg)';

export const RIPPLE_RING_GRADIENT =
  'conic-gradient(from 15deg, #34d399 0deg, var(--color-accent) 52deg, #fbbf24 96deg, #34d399 156deg, #22d3ee 225deg, #22d3ee 288deg, #34d399 360deg)';

export const THIN_RING_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 4.5px), #000 calc(100% - 3px), #000 100%)';

export const RIPPLE_RING_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 2px), #000 100%)';

export const RIPPLE_AURA_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 3px), #000 100%)';

export const HALO_RING_SOURCE_MASK =
  'radial-gradient(closest-side, transparent 78%, #000 90%, #000 96%, transparent 100%)';

export const BEZEL_SURFACE_STYLE: CSSProperties = {
  background: 'radial-gradient(circle at 30% 24%, #152024 0%, #05090a 56%, #030607 100%)',
  boxShadow:
    'inset 0 1px 2px rgba(255,255,255,0.18), inset 0 -2px 8px rgba(0,0,0,0.92), 0 0 18px rgba(0,0,0,0.45)',
};

export const VIGNETTE_OVERLAY_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 50% 50%, transparent 56%, rgba(5,9,10,0.34) 80%, rgba(0,0,0,0.78) 100%)',
  boxShadow: 'inset 0 0 26px rgba(0,0,0,0.75)',
};

export const GLASS_GLARE_STYLE: CSSProperties = {
  background:
    'radial-gradient(ellipse 68% 46% at 28% 18%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.07) 44%, transparent 72%), radial-gradient(ellipse 42% 24% at 74% 86%, rgba(34,211,238,0.10) 0%, transparent 66%)',
};

const FIXED_THREE = 3;

/** Creates the CSS custom property map for an individual bokeh particle element. */
export function buildParticleCssStyle(
  pt: ParticleSpec,
  color: string,
  devIntroT: number | null,
): CssVarStyle {
  const driftDelay = devIntroT !== null ? pt.driftDelay - devIntroT : pt.driftDelay;
  const twinkleDelay = devIntroT !== null ? pt.twinkleDelay - devIntroT : pt.twinkleDelay;
  return {
    '--p-x': `${pt.xPct.toFixed(2)}%`,
    '--p-y': `${pt.yPct.toFixed(2)}%`,
    '--p-size': `${pt.sizePx.toFixed(2)}px`,
    '--p-color': color,
    '--p-fade-start': pt.fadeStart.toFixed(FIXED_THREE),
    '--p-rise': `${pt.risePx.toFixed(1)}px`,
    '--p-sway': `${pt.swayPx.toFixed(1)}px`,
    '--p-drift-dur': `${pt.driftDur.toFixed(2)}s`,
    '--p-drift-delay': `${driftDelay.toFixed(2)}s`,
    '--p-twinkle-dur': `${pt.twinkleDur.toFixed(2)}s`,
    '--p-twinkle-delay': `${twinkleDelay.toFixed(2)}s`,
  };
}

/** Creates an optional negative animationDelay style when dev frame-freezing is active. */
export function buildFrozenDelayStyle(devIntroT: number | null): CSSProperties | undefined {
  return devIntroT !== null
    ? { animationDelay: `${(-devIntroT).toFixed(FIXED_THREE)}s` }
    : undefined;
}
