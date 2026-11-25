import type { RefObject } from 'react';
import { getIsDarkMode } from './globeClock.js';
import { measureHeroTextRect } from './landingSmokeShader.js';

/** Runtime mutable state tracked across landing smoke animation frames. */
export interface SmokeRuntimeState {
  disposed: boolean;
  rafId: number | null;
  resStepIdx: number;
  isDark: boolean;
  reducedMotion: boolean;
  readonly devIntroT: number | null;
  introStartMs: number | null;
  elapsedDriftSec: number;
  lastFrameMs: number;
  frameCount: number;
  frameTimeSum: number;
}

/** Control callbacks wired between the WebGL frame engine and DOM/media observers. */
export interface SmokeLoopCallbacks {
  readonly redrawIfStatic: () => void;
  readonly stopLoop: () => void;
  readonly startLoopIfAllowed: () => void;
  readonly resize: () => void;
}

/** Shared refs for text bounding measurements inside DOM observer callbacks. */
export interface SmokeTextMeasureRefs {
  readonly heroTextRef: RefObject<HTMLDivElement | null>;
  readonly textRectRef: RefObject<[number, number, number, number, number]>;
}

function attachHeroResizeObserver(
  refs: SmokeTextMeasureRefs,
  redrawIfStatic: () => void,
): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined' || !refs.heroTextRef.current) {
    return null;
  }
  const ro = new ResizeObserver(() => {
    refs.textRectRef.current = measureHeroTextRect(refs.heroTextRef.current);
    redrawIfStatic();
  });
  ro.observe(refs.heroTextRef.current);
  return ro;
}

function attachThemeAndMotionWatchers(
  state: SmokeRuntimeState,
  callbacks: SmokeLoopCallbacks,
  onThemeChange: (isDark: boolean) => void,
): () => void {
  const modeObserver = new MutationObserver(() => {
    const nextDark = getIsDarkMode();
    if (nextDark !== state.isDark) {
      state.isDark = nextDark;
      onThemeChange(nextDark);
      callbacks.redrawIfStatic();
    }
  });
  modeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mode'],
  });
  const motionMq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const handleMotionChange = (): void => {
    state.reducedMotion = motionMq ? motionMq.matches : false;
    callbacks.startLoopIfAllowed();
  };
  motionMq?.addEventListener('change', handleMotionChange);
  return () => {
    modeObserver.disconnect();
    motionMq?.removeEventListener('change', handleMotionChange);
  };
}

/** Attaches theme, reduced-motion, resize, visibility, and WebGL context-loss observers. */
export function attachSmokeDomObservers(params: {
  readonly canvas: HTMLCanvasElement;
  readonly state: SmokeRuntimeState;
  readonly refs: SmokeTextMeasureRefs;
  readonly callbacks: SmokeLoopCallbacks;
  readonly onThemeChange: (isDark: boolean) => void;
  readonly onWebglLost: () => void;
}): () => void {
  const { canvas, state, refs, callbacks, onThemeChange, onWebglLost } = params;
  const detachThemeAndMotion = attachThemeAndMotionWatchers(state, callbacks, onThemeChange);
  const handleResize = (): void => {
    callbacks.resize();
    callbacks.redrawIfStatic();
  };
  window.addEventListener('resize', handleResize, { passive: true });
  const ro = attachHeroResizeObserver(refs, callbacks.redrawIfStatic);
  const handleVisibility = (): void => {
    if (document.hidden) {
      callbacks.stopLoop();
    } else {
      callbacks.startLoopIfAllowed();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  const handleContextLost = (e: Event): void => {
    e.preventDefault();
    callbacks.stopLoop();
    onWebglLost();
  };
  canvas.addEventListener('webglcontextlost', handleContextLost);

  return () => {
    detachThemeAndMotion();
    window.removeEventListener('resize', handleResize);
    ro?.disconnect();
    document.removeEventListener('visibilitychange', handleVisibility);
    canvas.removeEventListener('webglcontextlost', handleContextLost);
  };
}
