import { useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import {
  DARK_PARTICLE_COLORS,
  generateParticles,
  getDevIntroTime,
  getIsDarkMode,
  getIsMobileViewport,
  getPrefersReducedMotion,
  hasPlayedHeroIntro,
  INTRO_DURATION,
  LIGHT_PARTICLE_COLORS,
  ORB_IMAGE_SRC,
  PARTICLE_COUNT,
  solveCubicBezier,
  subscribeHeroIntroStart,
  type OrbState,
} from './globeClock.js';
import { attachOrbIntroLifecycle } from './globeIntroController.js';
import { buildFrozenDelayStyle, type CssVarStyle } from './globeStyles.js';
import { GlobeRippleWaves } from './globeRippleWaves.js';
import {
  GlobeCoreImage,
  GlobeHaloGlow,
  GlobeParticleField,
  GlobeRimLights,
} from './globeVisualLayers.js';

export {
  getDevIntroTime,
  getIsDarkMode,
  getPrefersReducedMotion,
  hasPlayedHeroIntro,
  INTRO_DURATION,
  ORB_IMAGE_SRC,
  PARTICLE_COUNT,
  solveCubicBezier,
  subscribeHeroIntroStart,
};

const PARALLAX_MAX_PX = 10;
const HALF = 0.5;
const LIGHT_HALO_ALPHA = 0.92;
const LIGHT_PARTICLE_ALPHA = 0.95;

function getInitialOrbState(): OrbState {
  if (getPrefersReducedMotion()) {
    return 'reduced';
  }
  if (getDevIntroTime() !== null) {
    return 'frozen';
  }
  return hasPlayedHeroIntro() ? 'resting' : 'intro';
}

function useDocumentThemeObserver(): boolean {
  const [isDark, setIsDark] = useState<boolean>(getIsDarkMode);
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const syncMode = (): void => {
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
  return isDark;
}

function useMobileParticleBreakpoint(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobileViewport);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia('(max-width: 639px)');
    const update = (): void => {
      setIsMobile(mq.matches);
    };
    update();
    mq.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
    };
  }, []);
  return isMobile;
}

function useOrbIntroClock(
  rootRef: RefObject<HTMLDivElement | null>,
  orbRef: RefObject<HTMLDivElement | null>,
): OrbState {
  const [orbState, setOrbState] = useState<OrbState>(getInitialOrbState);
  useEffect(() => {
    const orbEl = orbRef.current;
    if (!orbEl || typeof window === 'undefined') {
      return undefined;
    }
    return attachOrbIntroLifecycle(orbEl, rootRef, setOrbState);
  }, [orbRef, rootRef]);
  return orbState;
}

function useOrbParallax(parallaxRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const target = parallaxRef.current;
    const unsupported =
      !target ||
      typeof window === 'undefined' ||
      getDevIntroTime() !== null ||
      getPrefersReducedMotion() ||
      (typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: fine)').matches);
    if (unsupported) {
      return undefined;
    }
    const handleMove = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') {
        return;
      }
      const nx = e.clientX / Math.max(1, window.innerWidth) - HALF;
      const ny = e.clientY / Math.max(1, window.innerHeight) - HALF;
      const px = Math.max(-PARALLAX_MAX_PX, Math.min(PARALLAX_MAX_PX, -nx * PARALLAX_MAX_PX * 2));
      const py = Math.max(-PARALLAX_MAX_PX, Math.min(PARALLAX_MAX_PX, -ny * PARALLAX_MAX_PX * 2));
      target.style.setProperty('--orb-px', `${px.toFixed(2)}px`);
      target.style.setProperty('--orb-py', `${py.toFixed(2)}px`);
    };
    const handleLeave = (): void => {
      target.style.setProperty('--orb-px', '0px');
      target.style.setProperty('--orb-py', '0px');
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerleave', handleLeave, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerleave', handleLeave);
    };
  }, [parallaxRef]);
}

function buildOrbBoxStyle(isDark: boolean): CssVarStyle {
  return {
    transform: 'scale(var(--orb-scale, 1))',
    opacity: 'var(--orb-opacity, 1)',
    willChange: 'transform, opacity',
    '--orb-halo-mode-alpha': String(isDark ? 1 : LIGHT_HALO_ALPHA),
    '--orb-particle-mode-alpha': String(isDark ? 1 : LIGHT_PARTICLE_ALPHA),
  };
}

/** Animated atmospheric glass orb with rotating conic halo, bokeh particles, and subtle desktop parallax. */
function Globe(): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const isDark = useDocumentThemeObserver();
  const isMobile = useMobileParticleBreakpoint();
  const orbState = useOrbIntroClock(rootRef, orbRef);
  useOrbParallax(parallaxRef);

  const devIntroT = getDevIntroTime();
  const particles = useMemo(
    () => generateParticles(isMobile ? PARTICLE_COUNT.mobile : PARTICLE_COUNT.desktop),
    [isMobile],
  );
  const palette = isDark ? DARK_PARTICLE_COLORS : LIGHT_PARTICLE_COLORS;

  return (
    <div ref={rootRef} className="flex h-screen items-center justify-center" aria-hidden="true">
      <div
        ref={parallaxRef}
        style={{
          transform: 'translate3d(var(--orb-px, 0px), var(--orb-py, 0px), 0)',
          transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="orb-float"
          data-orb-state={orbState}
          style={buildFrozenDelayStyle(devIntroT)}
        >
          <div
            ref={orbRef}
            data-orb-box="true"
            data-orb-state={orbState}
            className="relative h-[260px] w-[260px] rounded-full sm:h-[300px] sm:w-[300px]"
            style={buildOrbBoxStyle(isDark)}
          >
            <GlobeHaloGlow devIntroT={devIntroT} />
            <GlobeParticleField particles={particles} palette={palette} devIntroT={devIntroT} />
            <GlobeCoreImage devIntroT={devIntroT} />
            <GlobeRimLights />
            <GlobeRippleWaves
              showIntroRipple={orbState === 'intro' || orbState === 'frozen'}
              isResting={orbState === 'resting'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Globe;
