/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from 'react';

// Tunable constants
export const ORB_IMAGE_SRC = '/winter-smog-orb-v2.webp';
export const INTRO_DURATION = 3.8;
export const PARTICLE_COUNT = { desktop: 36, mobile: 20 } as const;

const PARALLAX_MAX_PX = 10;
const BEZEL_INITIAL_INNER_SCALE = 0.855; // ~9% black glass bezel per side

// Module-level once-per-page-load intro flag + shared start coordinator for SmokeCanvas
let heroIntroPlayed = false;
let heroIntroStartMs: number | null = null;
const introStartListeners = new Set<(startMs: number) => void>();

export function hasPlayedHeroIntro(): boolean {
  return heroIntroPlayed;
}

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

function broadcastHeroIntroStart(startMs: number): void {
  heroIntroStartMs = startMs;
  introStartListeners.forEach((fn) => {
    fn(startMs);
  });
}

// Dev-only ?introT=<seconds> helper (gated with import.meta.env.DEV)
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
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Exact cubic-bezier solver for smooth organic curves
function solveCubicBezier(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 12; i++) {
    const mt = 1 - t;
    const bx = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
    if (bx < x) {
      lo = t;
    } else {
      hi = t;
    }
    t = 0.5 * (lo + hi);
  }
  const mt = 1 - t;
  return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
}

function easeOutMain(x: number): number {
  return solveCubicBezier(x, 0.16, 1.0, 0.3, 1.0);
}

// Gentle ease-out for orb growth so 0.8s (~0.75x) and 1.6s (~0.93x) match keyframes.jpg
function easeOutGrowth(x: number): number {
  const c = clamp01(x);
  return 1 - Math.pow(1 - c, 1.9);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function getIsDarkMode(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  return document.documentElement.dataset.mode !== 'light';
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getIsMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(max-width: 639px)').matches;
}

// Write all orb intro values at time tSec (0..3.8s) as CSS custom properties
function applyOrbClock(el: HTMLElement, tSec: number): void {
  const t = Math.max(0, tSec);

  // 0.0 -> 2.4s: scale 0.45 -> 1.0 (0.45 @0s, ~0.77 @0.8s, ~0.94 @1.6s, 1.0 @2.4s)
  const scaleP = easeOutGrowth(clamp01(t / 2.4));
  const orbScale = 0.45 + 0.55 * scaleP;

  // 0.0 -> 1.0s: opacity 0.85 -> 1.0
  const opacityP = easeOutMain(clamp01(t / 1.0));
  const orbOpacity = 0.85 + 0.15 * opacityP;

  // 0.0 -> 1.8s: haze clears smoothly (~0.52 remaining @0.8s, ~0.04 @1.6s, 0 @1.8s)
  const hazeLinear = clamp01(t / 1.8);
  const hazeP = hazeLinear * hazeLinear * (3 - 2 * hazeLinear);
  const hazeAlpha = 1 - hazeP;

  // 0.8 -> 1.8s: rim cross-fades warm -> cool smoothly (0% @0.8s, ~82% @1.6s, 100% @1.8s)
  const rimLinear = clamp01((t - 0.8) / 1.0);
  const rimP = rimLinear * rimLinear * (3 - 2 * rimLinear);
  const warmAlpha = 1 - rimP;
  const coolAlpha = rimP;

  // 2.4 -> 3.2s: bezel collapses to ~2px gap, image grows ~5%
  const bezelP = easeOutMain(clamp01((t - 2.4) / 0.8));
  const innerScale = BEZEL_INITIAL_INNER_SCALE + (1 - BEZEL_INITIAL_INNER_SCALE) * bezelP;
  const imgFillScale = 1.0 + 0.05 * bezelP;
  const bezelLipOpacity = 1 - bezelP;

  // 3.0 -> 3.8s: second ring ripples outward (scale 1 -> 1.18, opacity 0.9 -> 0)
  let rippleScale = 1.0;
  let rippleOpacity = 0.0;
  if (t >= 3.0 && t <= INTRO_DURATION) {
    const rp = clamp01((t - 3.0) / (INTRO_DURATION - 3.0));
    rippleScale = 1.0 + 0.18 * easeOutMain(rp);
    const fadeIn = clamp01((t - 3.0) / 0.06);
    const fadeOut = Math.pow(1 - rp, 1.15);
    rippleOpacity = 0.9 * fadeIn * fadeOut;
  }

  el.style.setProperty('--orb-scale', orbScale.toFixed(4));
  el.style.setProperty('--orb-opacity', orbOpacity.toFixed(4));
  el.style.setProperty('--orb-haze', hazeAlpha.toFixed(4));
  el.style.setProperty('--orb-warm', warmAlpha.toFixed(4));
  el.style.setProperty('--orb-cool', coolAlpha.toFixed(4));
  el.style.setProperty('--orb-inner-scale', innerScale.toFixed(4));
  el.style.setProperty('--orb-img-scale', imgFillScale.toFixed(4));
  el.style.setProperty('--orb-bezel-lip', bezelLipOpacity.toFixed(4));
  el.style.setProperty('--orb-ripple-scale', rippleScale.toFixed(4));
  el.style.setProperty('--orb-ripple-opacity', rippleOpacity.toFixed(4));
  el.style.setProperty('--orb-p-time', Math.min(t, INTRO_DURATION).toFixed(3));
}

interface ParticleSpec {
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

const DARK_PARTICLE_COLORS = ['#34d399', '#22d3ee', '#fbbf24'] as const;
const LIGHT_PARTICLE_COLORS = ['#059669', '#0891b2', '#d97706'] as const;

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function generateParticles(count: number): readonly ParticleSpec[] {
  const rand = createSeededRng(20261121);
  const items: ParticleSpec[] = [];
  // Particle layer uses inset: -45%, so layer width = 1.9 * orbDiameter.
  // 1.0x orb radius = (0.5 / 1.9) * 100% = 26.316% from center (50%, 50%).
  const orbRadiusPct = (0.5 / 1.9) * 100;

  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.36;
    // Scatter at 0.6x–1.6x orb radius, richly populating the glowing aura around the rim
    const rMult = i % 7 === 0 ? 0.65 + rand() * 0.35 : 1.05 + rand() * 0.52;
    const xPct = 50 + Math.cos(baseAngle) * rMult * orbRadiusPct;
    const yPct = 50 + Math.sin(baseAngle) * rMult * orbRadiusPct;

    const sizePx = 2.2 + rand() * 2.8; // 2.2–5.0px glowing bokeh motes
    const colorIndex = (i % 3) as 0 | 1 | 2;
    // Staggered fade-in from 0.4s to 1.6s (fade window 0.35s, starts distributed in [0.4, 1.25])
    const fadeStart = 0.4 + (((i * 7) % count) / Math.max(1, count - 1)) * 0.78 + rand() * 0.07;
    // Lively upward drift 6–12 px/s over 6–9s cycle
    const speedPxPerSec = 6 + rand() * 6;
    const driftDur = 6 + rand() * 3;
    const risePx = -(speedPxPerSec * driftDur);
    const swayPx = (rand() > 0.5 ? 1 : -1) * (5 + rand() * 5); // +/-10px max
    const driftDelay = -(rand() * driftDur);
    const twinkleDur = 2 + rand() * 2.6; // 2–4.6s
    const twinkleDelay = -(rand() * twinkleDur);

    items.push({
      id: i,
      xPct,
      yPct,
      sizePx,
      colorIndex,
      fadeStart,
      risePx,
      swayPx,
      driftDur,
      driftDelay,
      twinkleDur,
      twinkleDelay,
    });
  }
  return items;
}

const WARM_RIM_GRADIENT =
  'conic-gradient(from 0deg, #34d399 0deg, #22c55e 26deg, #f59e0b 68deg, #ef4444 142deg, #ef4444 218deg, #f59e0b 276deg, #f59e0b 314deg, #34d399 342deg, #34d399 360deg)';

const COOL_RIM_GRADIENT =
  'conic-gradient(from 0deg, #34d399 0deg, var(--color-accent) 44deg, #fbbf24 88deg, #34d399 144deg, #22d3ee 210deg, #22d3ee 270deg, #34d399 322deg, #34d399 360deg)';

const WARM_HALO_GRADIENT =
  'conic-gradient(from 0deg, rgba(52,211,153,0.68) 0deg, rgba(245,158,11,0.85) 60deg, rgba(239,68,68,0.92) 148deg, rgba(239,68,68,0.92) 212deg, rgba(245,158,11,0.86) 292deg, rgba(52,211,153,0.68) 360deg)';

const COOL_HALO_GRADIENT =
  'conic-gradient(from 0deg, rgba(52,211,153,0.90) 0deg, var(--color-accent) 48deg, rgba(251,191,36,0.82) 92deg, rgba(52,211,153,0.88) 148deg, rgba(34,211,238,0.94) 225deg, rgba(52,211,153,0.90) 318deg, rgba(52,211,153,0.90) 360deg)';

const RIPPLE_RING_GRADIENT =
  'conic-gradient(from 15deg, #34d399 0deg, var(--color-accent) 52deg, #fbbf24 96deg, #34d399 156deg, #22d3ee 225deg, #22d3ee 288deg, #34d399 360deg)';

const THIN_RING_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 4.5px), #000 calc(100% - 3px), #000 100%)';

const RIPPLE_RING_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 2px), #000 100%)';

const RIPPLE_AURA_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 3px), #000 100%)';

// Ring mask placed INSIDE the blurred parent so blur feathers outward freely with ZERO hard edge
const HALO_RING_SOURCE_MASK =
  'radial-gradient(closest-side, transparent 78%, #000 90%, #000 96%, transparent 100%)';

const Globe: React.FC = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const [isDark, setIsDark] = useState<boolean>(getIsDarkMode);
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobileViewport);
  const [orbState, setOrbState] = useState<'intro' | 'resting' | 'frozen' | 'reduced'>(() => {
    if (getPrefersReducedMotion()) return 'reduced';
    if (getDevIntroTime() !== null) return 'frozen';
    if (heroIntroPlayed) return 'resting';
    return 'intro';
  });

  const devIntroT = getDevIntroTime();

  const particles = useMemo(
    () => generateParticles(isMobile ? PARTICLE_COUNT.mobile : PARTICLE_COUNT.desktop),
    [isMobile],
  );

  // Watch <html data-mode="dark|light"> via MutationObserver
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncMode = () => {
      setIsDark(getIsDarkMode());
    };
    syncMode();
    const observer = new MutationObserver(syncMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode'],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  // Responsive particle count (36 desktop / 20 mobile)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
    };
  }, []);

  // Master intro clock (0 -> 3.8s), writing CSS custom properties via ref.style.setProperty
  useEffect(() => {
    const orbEl = orbRef.current;
    if (!orbEl || typeof window === 'undefined') return;

    let cancelled = false;
    let rafId: number | null = null;
    let waitTimer: number | null = null;

    const motionMq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const enterReduced = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      applyOrbClock(orbEl, INTRO_DURATION);
      setOrbState('reduced');
      broadcastHeroIntroStart(-1);
    };

    const handleMotionChange = () => {
      if (motionMq?.matches) {
        enterReduced();
      } else if (getDevIntroTime() !== null) {
        applyOrbClock(orbEl, getDevIntroTime()!);
        setOrbState('frozen');
      } else {
        applyOrbClock(orbEl, INTRO_DURATION);
        setOrbState('resting');
      }
    };
    motionMq?.addEventListener('change', handleMotionChange);

    if (motionMq?.matches) {
      enterReduced();
      return () => {
        cancelled = true;
        motionMq.removeEventListener('change', handleMotionChange);
      };
    }

    const frozenT = getDevIntroTime();
    if (frozenT !== null) {
      applyOrbClock(orbEl, frozenT);
      setOrbState('frozen');
      return () => {
        cancelled = true;
        motionMq?.removeEventListener('change', handleMotionChange);
      };
    }

    if (heroIntroPlayed) {
      applyOrbClock(orbEl, INTRO_DURATION);
      setOrbState('resting');
      broadcastHeroIntroStart(-1);
      return () => {
        cancelled = true;
        motionMq?.removeEventListener('change', handleMotionChange);
      };
    }

    // Hold frame 0.0s immediately so the orb never flashes full size before intro starts
    applyOrbClock(orbEl, 0);
    setOrbState('intro');

    const runClock = () => {
      if (cancelled) return;
      const startMs = performance.now();
      broadcastHeroIntroStart(startMs);

      const step = (nowMs: number) => {
        if (cancelled) return;
        const elapsedSec = Math.max(0, (nowMs - startMs) / 1000);
        if (elapsedSec >= INTRO_DURATION) {
          applyOrbClock(orbEl, INTRO_DURATION);
          heroIntroPlayed = true;
          setOrbState('resting');
          rafId = null;
          return;
        }
        applyOrbClock(orbEl, elapsedSec);
        rafId = requestAnimationFrame(step);
      };

      rafId = requestAnimationFrame(step);
    };

    // Wait one rAF to check whether the outer WRAPPER is animating on mount via transition-all
    rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      const wrapper = rootRef.current?.closest('.fixed.z-10') as HTMLElement | null;
      const runningTransformTransitions =
        wrapper && typeof wrapper.getAnimations === 'function'
          ? wrapper.getAnimations().filter((anim) => anim.playState === 'running')
          : [];

      if (runningTransformTransitions.length > 0) {
        let started = false;
        const kickOff = () => {
          if (started || cancelled) return;
          started = true;
          if (waitTimer !== null) {
            window.clearTimeout(waitTimer);
            waitTimer = null;
          }
          runClock();
        };
        Promise.allSettled(runningTransformTransitions.map((a) => a.finished)).then(kickOff);
        waitTimer = window.setTimeout(kickOff, 1480);
      } else {
        runClock();
      }
    });

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (waitTimer !== null) window.clearTimeout(waitTimer);
      motionMq?.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Optional subtle desktop-only mouse parallax on inner element (never touches WRAPPER)
  useEffect(() => {
    const target = parallaxRef.current;
    if (!target || typeof window === 'undefined') return;
    if (getDevIntroTime() !== null || getPrefersReducedMotion()) return;
    if (typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: fine)').matches) {
      return;
    }

    const handleMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const nx = e.clientX / Math.max(1, window.innerWidth) - 0.5;
      const ny = e.clientY / Math.max(1, window.innerHeight) - 0.5;
      const px = Math.max(-PARALLAX_MAX_PX, Math.min(PARALLAX_MAX_PX, -nx * PARALLAX_MAX_PX * 2));
      const py = Math.max(-PARALLAX_MAX_PX, Math.min(PARALLAX_MAX_PX, -ny * PARALLAX_MAX_PX * 2));
      target.style.setProperty('--orb-px', `${px.toFixed(2)}px`);
      target.style.setProperty('--orb-py', `${py.toFixed(2)}px`);
    };

    const handleLeave = () => {
      target.style.setProperty('--orb-px', '0px');
      target.style.setProperty('--orb-py', '0px');
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerleave', handleLeave, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  const palette = isDark ? DARK_PARTICLE_COLORS : LIGHT_PARTICLE_COLORS;
  const haloModeAlpha = isDark ? 1 : 0.92;
  const particleModeAlpha = isDark ? 1 : 0.95;
  const isResting = orbState === 'resting';
  const showIntroRipple = orbState === 'intro' || orbState === 'frozen';

  return (
    <div ref={rootRef} className="flex items-center justify-center h-screen" aria-hidden="true">
      {/* Subtle mouse parallax layer (inner only, never touches WRAPPER transform) */}
      <div
        ref={parallaxRef}
        style={{
          transform: 'translate3d(var(--orb-px, 0px), var(--orb-py, 0px), 0)',
          transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Single gentle vertical float (+/-6px over 6s) */}
        <div
          className="orb-float"
          data-orb-state={orbState}
          style={devIntroT !== null ? { animationDelay: `${(-devIntroT).toFixed(3)}s` } : undefined}
        >
          {/* ORB BOX: stays 260/300px, NO overflow-hidden so halo, ripple & particles stay unclipped */}
          <div
            ref={orbRef}
            data-orb-box="true"
            data-orb-state={orbState}
            className="relative w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] rounded-full"
            style={
              {
                transform: 'scale(var(--orb-scale, 1))',
                opacity: 'var(--orb-opacity, 1)',
                willChange: 'transform, opacity',
                '--orb-halo-mode-alpha': String(haloModeAlpha),
                '--orb-particle-mode-alpha': String(particleModeAlpha),
              } as React.CSSProperties
            }
          >
            {/* Layer 1 (back): Unclipped blurred rotating conic halo glow (warm & cool cross-faded by opacity) */}
            <div
              className="orb-halo-spin pointer-events-none absolute -inset-[26%]"
              style={
                devIntroT !== null ? { animationDelay: `${(-devIntroT).toFixed(3)}s` } : undefined
              }
            >
              {/* Warm halo: blur applied to parent of masked ring so glow feathers softly with zero clip edge */}
              <div
                className="absolute inset-0"
                style={{
                  filter: 'blur(26px)',
                  opacity: 'calc(var(--orb-warm, 0) * var(--orb-halo-mode-alpha, 1) * 0.80)',
                  willChange: 'opacity',
                }}
              >
                <div
                  className="absolute inset-[17%] rounded-full"
                  style={{
                    background: WARM_HALO_GRADIENT,
                    WebkitMaskImage: HALO_RING_SOURCE_MASK,
                    maskImage: HALO_RING_SOURCE_MASK,
                  }}
                />
              </div>

              {/* Cool halo: blur applied to parent of masked ring so glow feathers softly with zero clip edge */}
              <div
                className="absolute inset-0"
                style={{
                  filter: 'blur(26px)',
                  opacity: 'calc(var(--orb-cool, 1) * var(--orb-halo-mode-alpha, 1) * 0.82)',
                  willChange: 'opacity',
                }}
              >
                <div
                  className="absolute inset-[17%] rounded-full"
                  style={{
                    background: COOL_HALO_GRADIENT,
                    WebkitMaskImage: HALO_RING_SOURCE_MASK,
                    maskImage: HALO_RING_SOURCE_MASK,
                  }}
                />
              </div>
            </div>

            {/* Floating particles layer (inset -45%, unclipped, travels and scales with the orb) */}
            <div className="pointer-events-none absolute -inset-[45%]">
              {particles.map((pt) => (
                <span
                  key={pt.id}
                  className="orb-particle"
                  style={
                    {
                      '--p-x': `${pt.xPct.toFixed(2)}%`,
                      '--p-y': `${pt.yPct.toFixed(2)}%`,
                      '--p-size': `${pt.sizePx.toFixed(2)}px`,
                      '--p-color': palette[pt.colorIndex],
                      '--p-fade-start': pt.fadeStart.toFixed(3),
                      '--p-rise': `${pt.risePx.toFixed(1)}px`,
                      '--p-sway': `${pt.swayPx.toFixed(1)}px`,
                      '--p-drift-dur': `${pt.driftDur.toFixed(2)}s`,
                      '--p-drift-delay':
                        devIntroT !== null
                          ? `${(pt.driftDelay - devIntroT).toFixed(2)}s`
                          : `${pt.driftDelay.toFixed(2)}s`,
                      '--p-twinkle-dur': `${pt.twinkleDur.toFixed(2)}s`,
                      '--p-twinkle-delay':
                        devIntroT !== null
                          ? `${(pt.twinkleDelay - devIntroT).toFixed(2)}s`
                          : `${pt.twinkleDelay.toFixed(2)}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            {/* Layer 2: Black glass bezel (near #05090a) with subtle inner highlight */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 30% 24%, #152024 0%, #05090a 56%, #030607 100%)',
                boxShadow:
                  'inset 0 1px 2px rgba(255,255,255,0.18), inset 0 -2px 8px rgba(0,0,0,0.92), 0 0 18px rgba(0,0,0,0.45)',
              }}
            />

            {/* Layer 3: Clipped image circle (expands smoothly via transform to collapse bezel to ~2px gap) */}
            <div
              className="pointer-events-none absolute inset-[2px] overflow-hidden rounded-full"
              style={{
                transform: 'scale(var(--orb-inner-scale, 1))',
                willChange: 'transform',
              }}
            >
              {/* Image fill scale (+5% as bezel collapses) + slow Ken-Burns drift (1.0 -> 1.06, 20s alternate) */}
              <div
                className="h-full w-full"
                style={{
                  transform: 'scale(var(--orb-img-scale, 1.05))',
                  willChange: 'transform',
                }}
              >
                <div
                  className="orb-image-kenburns relative h-full w-full"
                  style={
                    devIntroT !== null
                      ? { animationDelay: `${(-devIntroT).toFixed(3)}s` }
                      : undefined
                  }
                >
                  {/* Crisp base skyline */}
                  <img
                    src={ORB_IMAGE_SRC}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="h-full w-full rounded-full object-cover"
                  />
                  {/* Dim/hazy intro overlay cross-faded strictly by opacity (0.0 -> 1.8s) */}
                  <img
                    src={ORB_IMAGE_SRC}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="absolute inset-0 h-full w-full rounded-full object-cover"
                    style={{
                      filter: 'saturate(0.55) brightness(0.6) blur(2px)',
                      opacity: 'var(--orb-haze, 0)',
                      willChange: 'opacity',
                    }}
                  />
                </div>
              </div>

              {/* Soft inset vignette matching original inset shadow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 50% 50%, transparent 56%, rgba(5,9,10,0.34) 80%, rgba(0,0,0,0.78) 100%)',
                  boxShadow: 'inset 0 0 26px rgba(0,0,0,0.75)',
                }}
              />

              {/* Subtle inner glass bezel lip highlight (fades cleanly as bezel collapses) */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.22)',
                  opacity: 'var(--orb-bezel-lip, 0)',
                }}
              />
            </div>

            {/* Layer 4: Glass glare (soft radial highlight top-left) + thin warm/cool rim light */}
            <div
              className="pointer-events-none absolute inset-[2px] rounded-full"
              style={{
                background:
                  'radial-gradient(ellipse 68% 46% at 28% 18%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.07) 44%, transparent 72%), radial-gradient(ellipse 42% 24% at 74% 86%, rgba(34,211,238,0.10) 0%, transparent 66%)',
              }}
            />

            {/* Soft optical rim bloom (unclipped blur parent) + razor-sharp warm rim */}
            <div
              className="pointer-events-none absolute -inset-[10px]"
              style={{
                filter: 'blur(6px)',
                opacity: 'calc(var(--orb-warm, 0) * var(--orb-halo-mode-alpha, 1) * 0.85)',
                willChange: 'opacity',
              }}
            >
              <div
                className="absolute inset-[8px] rounded-full"
                style={{
                  background: WARM_RIM_GRADIENT,
                  WebkitMaskImage: THIN_RING_MASK,
                  maskImage: THIN_RING_MASK,
                }}
              />
            </div>
            <div
              className="pointer-events-none absolute -inset-[1px] rounded-full"
              style={{
                background: WARM_RIM_GRADIENT,
                WebkitMaskImage: THIN_RING_MASK,
                maskImage: THIN_RING_MASK,
                opacity: 'var(--orb-warm, 0)',
                willChange: 'opacity',
              }}
            />

            {/* Soft optical rim bloom (unclipped blur parent) + razor-sharp cool rim */}
            <div
              className="pointer-events-none absolute -inset-[10px]"
              style={{
                filter: 'blur(7px)',
                opacity: 'calc(var(--orb-cool, 1) * var(--orb-halo-mode-alpha, 1) * 0.88)',
                willChange: 'opacity',
              }}
            >
              <div
                className="absolute inset-[8px] rounded-full"
                style={{
                  background: COOL_RIM_GRADIENT,
                  WebkitMaskImage: THIN_RING_MASK,
                  maskImage: THIN_RING_MASK,
                }}
              />
            </div>
            <div
              className="pointer-events-none absolute -inset-[1px] rounded-full"
              style={{
                background: COOL_RIM_GRADIENT,
                WebkitMaskImage: THIN_RING_MASK,
                maskImage: THIN_RING_MASK,
                opacity: 'var(--orb-cool, 1)',
                willChange: 'opacity',
              }}
            />

            {/* Layer 5 (front): Luminous pulsing halo ripple waves (emerald > cyan > gold, offset <=3%) */}
            {showIntroRipple && (
              <div
                className="pointer-events-none absolute -inset-[3%]"
                style={{
                  transform: 'translate3d(1.8%, -1.6%, 0) scale(var(--orb-ripple-scale, 1))',
                  opacity: 'calc(var(--orb-ripple-opacity, 0) * var(--orb-halo-mode-alpha, 1))',
                  willChange: 'transform, opacity',
                }}
              >
                <div
                  className="absolute -inset-[12px]"
                  style={{ filter: 'blur(10px)', opacity: 0.9 }}
                >
                  <div
                    className="absolute inset-[12px] rounded-full"
                    style={{
                      background: RIPPLE_RING_GRADIENT,
                      WebkitMaskImage: RIPPLE_AURA_MASK,
                      maskImage: RIPPLE_AURA_MASK,
                    }}
                  />
                </div>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: RIPPLE_RING_GRADIENT,
                    WebkitMaskImage: RIPPLE_RING_MASK,
                    maskImage: RIPPLE_RING_MASK,
                  }}
                />
              </div>
            )}

            {isResting && (
              <>
                <div
                  className="orb-ripple-idle pointer-events-none absolute -inset-[3%]"
                  style={{ opacity: 0 }}
                >
                  <div
                    className="absolute -inset-[14px]"
                    style={{
                      filter: 'blur(11px)',
                      opacity: 'calc(0.88 * var(--orb-halo-mode-alpha, 1))',
                    }}
                  >
                    <div
                      className="absolute inset-[14px] rounded-full"
                      style={{
                        background: RIPPLE_RING_GRADIENT,
                        WebkitMaskImage: RIPPLE_AURA_MASK,
                        maskImage: RIPPLE_AURA_MASK,
                      }}
                    />
                  </div>
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: RIPPLE_RING_GRADIENT,
                      WebkitMaskImage: RIPPLE_RING_MASK,
                      maskImage: RIPPLE_RING_MASK,
                      opacity: 'var(--orb-halo-mode-alpha, 1)',
                    }}
                  />
                </div>

                <div
                  className="orb-ripple-idle-b pointer-events-none absolute -inset-[3%]"
                  style={{ opacity: 0 }}
                >
                  <div
                    className="absolute -inset-[14px]"
                    style={{
                      filter: 'blur(12px)',
                      opacity: 'calc(0.75 * var(--orb-halo-mode-alpha, 1))',
                    }}
                  >
                    <div
                      className="absolute inset-[14px] rounded-full"
                      style={{
                        background: RIPPLE_RING_GRADIENT,
                        WebkitMaskImage: RIPPLE_AURA_MASK,
                        maskImage: RIPPLE_AURA_MASK,
                      }}
                    />
                  </div>
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: RIPPLE_RING_GRADIENT,
                      WebkitMaskImage: RIPPLE_RING_MASK,
                      maskImage: RIPPLE_RING_MASK,
                      opacity: 'calc(0.85 * var(--orb-halo-mode-alpha, 1))',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Globe;
