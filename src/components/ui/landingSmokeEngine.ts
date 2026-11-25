import {
  getDevIntroTime,
  getIsDarkMode,
  getPrefersReducedMotion,
  hasPlayedHeroIntro,
  subscribeHeroIntroStart,
} from './globeClock.js';
import {
  attachSmokeDomObservers,
  type SmokeLoopCallbacks,
  type SmokeRuntimeState,
} from './landingSmokeObservers.js';
import {
  drawLandingSmokeFrame,
  LANDING_RESOLUTION_STEPS,
  queryLandingSmokeUniforms,
  resizeLandingSmokeCanvas,
  type LandingSmokePipeline,
  type LandingSmokeSharedRefs,
} from './landingSmokeRenderer.js';
import { LANDING_SMOKE_FRAGMENT_SRC, LANDING_SMOKE_VERTEX_SRC } from './landingSmokeShader.js';
import { createFullscreenSmokeProgram, disposeFullscreenSmokeProgram } from './webglSmokeCore.js';

export type { LandingSmokeSharedRefs };

const ADAPTIVE_FRAME_WINDOW = 30;
const ADAPTIVE_THRESHOLD_MS = 20;
const MS_PER_SEC = 1000;
const FALLBACK_START_MS = 1550;

function createInitialLoopState(): SmokeRuntimeState {
  return {
    disposed: false,
    rafId: null,
    resStepIdx: 0,
    isDark: getIsDarkMode(),
    reducedMotion: getPrefersReducedMotion(),
    devIntroT: getDevIntroTime(),
    introStartMs: hasPlayedHeroIntro() ? -1 : null,
    elapsedDriftSec: 0,
    lastFrameMs: performance.now(),
    frameCount: 0,
    frameTimeSum: 0,
  };
}

function stepAdaptiveQuality(
  state: SmokeRuntimeState,
  dtMs: number,
  renderCostMs: number,
  onStepDown: () => void,
): void {
  state.frameCount += 1;
  state.frameTimeSum += Math.max(dtMs, renderCostMs);
  if (state.frameCount < ADAPTIVE_FRAME_WINDOW) {
    return;
  }
  const avgMs = state.frameTimeSum / state.frameCount;
  state.frameCount = 0;
  state.frameTimeSum = 0;
  if (avgMs > ADAPTIVE_THRESHOLD_MS && state.resStepIdx < LANDING_RESOLUTION_STEPS.length - 1) {
    state.resStepIdx += 1;
    onStepDown();
  }
}

function isStaticSmokeMode(state: SmokeRuntimeState): boolean {
  return state.devIntroT !== null || state.reducedMotion;
}

function createLoopCallbacks(
  pipe: LandingSmokePipeline,
  canvas: HTMLCanvasElement,
  state: SmokeRuntimeState,
  refs: LandingSmokeSharedRefs,
): SmokeLoopCallbacks {
  const stopLoop = (): void => {
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  };
  const resize = (): void => {
    resizeLandingSmokeCanvas(pipe, canvas, state, refs);
  };
  const redrawIfStatic = (): void => {
    if (!state.disposed && isStaticSmokeMode(state)) {
      drawLandingSmokeFrame(pipe, canvas, state, refs);
    }
  };
  const tick = (nowMs: number): void => {
    if (state.disposed || document.hidden || isStaticSmokeMode(state)) {
      state.rafId = null;
      return;
    }
    const dtMs = Math.min(nowMs - state.lastFrameMs, 100);
    state.lastFrameMs = nowMs;
    state.elapsedDriftSec += dtMs / MS_PER_SEC;
    const t0 = performance.now();
    drawLandingSmokeFrame(pipe, canvas, state, refs);
    stepAdaptiveQuality(state, dtMs, performance.now() - t0, resize);
    state.rafId = requestAnimationFrame(tick);
  };
  const startLoopIfAllowed = (): void => {
    if (state.disposed || document.hidden) {
      stopLoop();
      return;
    }
    if (isStaticSmokeMode(state)) {
      stopLoop();
      drawLandingSmokeFrame(pipe, canvas, state, refs);
      return;
    }
    if (state.rafId === null) {
      state.lastFrameMs = performance.now();
      state.rafId = requestAnimationFrame(tick);
    }
  };
  return { redrawIfStatic, stopLoop, startLoopIfAllowed, resize };
}

function subscribeIntroClock(state: SmokeRuntimeState, redrawIfStatic: () => void): () => void {
  const unsubscribe = subscribeHeroIntroStart((startMs) => {
    if (!state.disposed) {
      state.introStartMs = startMs;
      redrawIfStatic();
    }
  });
  const fallbackTimer =
    state.introStartMs === null && !isStaticSmokeMode(state)
      ? window.setTimeout(() => {
          state.introStartMs ??= performance.now();
        }, FALLBACK_START_MS)
      : null;
  return () => {
    unsubscribe();
    if (fallbackTimer !== null) {
      window.clearTimeout(fallbackTimer);
    }
  };
}

/** Boots the landing page WebGL smog engine, observers, and rAF loop; returns cleanup or null on fallback. */
export function startLandingSmokeEngine(params: {
  readonly canvas: HTMLCanvasElement;
  readonly refs: LandingSmokeSharedRefs;
  readonly onThemeChange: (isDark: boolean) => void;
  readonly onWebglLost: () => void;
}): (() => void) | null {
  const { canvas, refs, onThemeChange, onWebglLost } = params;
  const core = createFullscreenSmokeProgram(
    canvas,
    LANDING_SMOKE_VERTEX_SRC,
    LANDING_SMOKE_FRAGMENT_SRC,
  );
  if (!core) {
    return null;
  }
  const pipe: LandingSmokePipeline = {
    ...core,
    uniforms: queryLandingSmokeUniforms(core.gl, core.program),
  };
  const state = createInitialLoopState();
  const callbacks = createLoopCallbacks(pipe, canvas, state, refs);
  refs.triggerRedrawRef.current = callbacks.redrawIfStatic;

  const detachIntro = subscribeIntroClock(state, callbacks.redrawIfStatic);
  const detachObservers = attachSmokeDomObservers({
    canvas,
    state,
    refs,
    callbacks,
    onThemeChange,
    onWebglLost,
  });

  callbacks.resize();
  drawLandingSmokeFrame(pipe, canvas, state, refs);
  callbacks.startLoopIfAllowed();

  return () => {
    state.disposed = true;
    refs.triggerRedrawRef.current = null;
    callbacks.stopLoop();
    detachIntro();
    detachObservers();
    disposeFullscreenSmokeProgram(pipe);
  };
}
