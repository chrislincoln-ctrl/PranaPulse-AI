import { memo, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  disposeConsoleSmokePipeline,
  drawConsoleSmokeFrame,
  initConsoleSmokePipeline,
  type GlSmokePipeline,
} from './ui/consoleSmokeShaders.js';

export interface ConsoleSmogBackdropProps {
  readonly aqi: number;
}

const DPR_CAP = 1.5;
const RENDER_SCALE = 0.42;
const MAX_DT_MS = 100;
const MS_PER_SEC = 1000;

function isTestRuntime(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
}

function readIsDark(): boolean {
  return typeof document === 'undefined' || document.documentElement.dataset.mode !== 'light';
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function syncCanvasSize(canvas: HTMLCanvasElement, gl: WebGLRenderingContext): void {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr * RENDER_SCALE));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr * RENDER_SCALE));
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function bindSmokeEvents(
  onRender: () => void,
  onResize: () => void,
  onVisibility: () => void,
): () => void {
  const modeObs = new MutationObserver(onRender);
  modeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    modeObs.disconnect();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

function createRafControl(onStep: (dtSec: number) => void): {
  readonly start: () => void;
  readonly stop: () => void;
} {
  let rafId: number | null = null;
  let lastMs = performance.now();
  const stop = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
  const tick = (nowMs: number): void => {
    if (document.hidden || readReducedMotion()) {
      rafId = null;
      return;
    }
    onStep(Math.min(nowMs - lastMs, MAX_DT_MS) / MS_PER_SEC);
    lastMs = nowMs;
    rafId = requestAnimationFrame(tick);
  };
  const start = (): void => {
    if (!document.hidden && !readReducedMotion() && rafId === null) {
      lastMs = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  };
  return { start, stop };
}

function mountSmokeRunner(
  pipe: GlSmokePipeline,
  canvas: HTMLCanvasElement,
  aqiRef: React.RefObject<number>,
): () => void {
  let elapsedSec = 0;
  const render = (): void => {
    drawConsoleSmokeFrame({ pipe, canvas, elapsedSec, aqi: aqiRef.current, isDark: readIsDark() });
  };
  const resize = (): void => {
    syncCanvasSize(canvas, pipe.gl);
    render();
  };
  const loop = createRafControl((dtSec) => {
    elapsedSec += dtSec;
    render();
  });
  const onVisibility = (): void => {
    if (document.hidden) {
      loop.stop();
    } else {
      loop.start();
    }
  };
  const unbind = bindSmokeEvents(render, resize, onVisibility);
  resize();
  loop.start();
  return () => {
    loop.stop();
    unbind();
    disposeConsoleSmokePipeline(pipe);
  };
}

function useConsoleSmogWebGl(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  aqiRef: React.RefObject<number>,
  onFallback: () => void,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined' || isTestRuntime()) {
      onFallback();
      return undefined;
    }
    const pipe = initConsoleSmokePipeline(canvas);
    if (!pipe) {
      onFallback();
      return undefined;
    }
    return mountSmokeRunner(pipe, canvas, aqiRef);
  }, [aqiRef, canvasRef, onFallback]);
}

function SmogCssFallbackLayer(): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="console-smog-fallback pointer-events-none fixed inset-0 z-0 overflow-hidden print:hidden"
    >
      <div className="console-smog-plume console-smog-plume-left" />
      <div className="console-smog-plume console-smog-plume-right" />
      <div className="console-smog-plume console-smog-plume-center" />
    </div>
  );
}

/** Renders the 3 animated ambient smog plumes layered behind the WebGL smoke canvas and vignette. */
export function AmbientSmogLayers({
  canvasRef,
  zClass = 'z-0',
}: {
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  readonly zClass?: string;
}): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 ${zClass} overflow-hidden print:hidden`}
    >
      <div className="console-smog-plume console-smog-plume-left" />
      <div className="console-smog-plume console-smog-plume-right" />
      <div className="console-smog-plume console-smog-plume-center" />
      <canvas ref={canvasRef} className="relative z-[1] h-full w-full" />
      <div className="console-smog-vignette absolute inset-0 z-[2]" />
    </div>
  );
}

/**
 * Full-viewport atmospheric billowing smog canvas filling wide-screen margins, inter-card gutters,
 * and idle dark regions across all 6 Console Workbench sections with AQI-reactive tinting.
 */
export const ConsoleSmogBackdrop = memo(function ConsoleSmogBackdrop({
  aqi,
}: ConsoleSmogBackdropProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aqiRef = useRef(aqi);
  aqiRef.current = aqi;
  const [useFallback, setUseFallback] = useState(isTestRuntime);
  const triggerFallback = useRef(() => {
    setUseFallback(true);
  });

  useConsoleSmogWebGl(canvasRef, aqiRef, triggerFallback.current);

  if (useFallback) {
    return <SmogCssFallbackLayer />;
  }

  return <AmbientSmogLayers canvasRef={canvasRef} />;
});
