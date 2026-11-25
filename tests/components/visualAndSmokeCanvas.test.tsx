import { act, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleSmogBackdrop } from '../../src/components/ConsoleSmogBackdrop.js';
import {
  disposeConsoleSmokePipeline,
  drawConsoleSmokeFrame,
  initConsoleSmokePipeline,
  resolveConsoleSmokePalette,
} from '../../src/components/ui/consoleSmokeShaders.js';
import Globe from '../../src/components/ui/globe.js';
import {
  applyOrbClock,
  generateParticles,
  solveCubicBezier,
  subscribeHeroIntroStart,
} from '../../src/components/ui/globeClock.js';
import { ScrollGlobe } from '../../src/components/ui/landing-page.js';
import { startLandingSmokeEngine } from '../../src/components/ui/landingSmokeEngine.js';
import {
  cubicBezierSection,
  evalSmokeIntroMultiplier,
  measureHeroTextRect,
} from '../../src/components/ui/landingSmokeShader.js';
import { SmokeCanvas } from '../../src/components/ui/smoke-canvas.js';

function createMockWebGlContext(
  opts: {
    compileOk?: boolean;
    linkOk?: boolean;
    contextLost?: boolean;
  } = {},
) {
  const compileOk = opts.compileOk ?? true;
  const linkOk = opts.linkOk ?? true;
  const contextLost = opts.contextLost ?? false;
  const drawArrays = vi.fn();
  const deleteProgram = vi.fn();
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    COLOR_BUFFER_BIT: 16384,
    TRIANGLES: 4,
    isContextLost: vi.fn(() => contextLost),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => compileOk),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => linkOk),
    deleteProgram,
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    useProgram: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    disableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    viewport: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    drawArrays,
  } as unknown as WebGLRenderingContext;
  return { gl, drawArrays, deleteProgram };
}

describe('WebGL smoke pipelines, Globe choreography & ScrollGlobe runtime coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.mode;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: () => null,
    });
  });

  it('resolves all 6 AQI/theme console smoke palettes and exercises WebGL init, draw, dispose, and failure paths', () => {
    expect(resolveConsoleSmokePalette(50, false).maxAlpha).toBeGreaterThan(0.5);
    expect(resolveConsoleSmokePalette(150, false).maxAlpha).toBeGreaterThan(0.55);
    expect(resolveConsoleSmokePalette(300, false).maxAlpha).toBeGreaterThan(0.6);
    expect(resolveConsoleSmokePalette(50, true).maxAlpha).toBeGreaterThan(0.4);
    expect(resolveConsoleSmokePalette(150, true).maxAlpha).toBeGreaterThan(0.4);
    expect(resolveConsoleSmokePalette(300, true).maxAlpha).toBeGreaterThan(0.45);

    const canvas = document.createElement('canvas');
    const mockGl = createMockWebGlContext();
    canvas.getContext = vi.fn(() => mockGl.gl) as unknown as HTMLCanvasElement['getContext'];

    const pipe = initConsoleSmokePipeline(canvas);
    expect(pipe).not.toBeNull();
    if (pipe) {
      drawConsoleSmokeFrame({ pipe, canvas, elapsedSec: 1.5, aqi: 260, isDark: true });
      expect(mockGl.drawArrays).toHaveBeenCalled();
      disposeConsoleSmokePipeline(pipe);
      expect(mockGl.deleteProgram).toHaveBeenCalled();
    }

    // Shader compile failure and link failure cleanly return null
    const badShaderGl = createMockWebGlContext({ compileOk: false });
    canvas.getContext = vi.fn(() => badShaderGl.gl) as unknown as HTMLCanvasElement['getContext'];
    expect(initConsoleSmokePipeline(canvas)).toBeNull();

    const badLinkGl = createMockWebGlContext({ linkOk: false });
    canvas.getContext = vi.fn(() => badLinkGl.gl) as unknown as HTMLCanvasElement['getContext'];
    expect(initConsoleSmokePipeline(canvas)).toBeNull();
  });

  it('runs ConsoleSmogBackdrop and SmokeCanvas live WebGL engines, adaptive ticks, observers, and context loss', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const mockGl = createMockWebGlContext();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: () => mockGl.gl,
    });

    try {
      const { unmount: unmountConsole } = render(<ConsoleSmogBackdrop aqi={240} />);
      act(() => {
        window.dispatchEvent(new Event('resize'));
        document.dispatchEvent(new Event('visibilitychange'));
        document.documentElement.dataset.mode = 'light';
        rafQueue.shift()?.(performance.now() + 30);
      });
      unmountConsole();

      const heroEl = document.createElement('div');
      heroEl.innerHTML = '<h1>PranaPulse</h1><p>Smog telemetry</p>';
      heroEl.getBoundingClientRect = () =>
        ({ left: 10, top: 20, right: 400, bottom: 200, width: 390, height: 180 }) as DOMRect;
      const h1 = heroEl.querySelector('h1');
      if (h1) {
        h1.getBoundingClientRect = () =>
          ({ left: 10, top: 20, right: 200, bottom: 80, width: 190, height: 60 }) as DOMRect;
      }
      const heroRef = createRef<HTMLDivElement>();
      (heroRef as { current: HTMLDivElement | null }).current = heroEl;

      expect(measureHeroTextRect(heroEl)[4]).toBe(1);
      expect(measureHeroTextRect(null)).toEqual([0, 0, 0, 0, 0]);
      expect(evalSmokeIntroMultiplier(-1)).toBeCloseTo(0.05);
      expect(evalSmokeIntroMultiplier(1.2)).toBeGreaterThan(0.35);
      expect(evalSmokeIntroMultiplier(4.0)).toBe(1.0);
      expect(cubicBezierSection(0.5)).toBeGreaterThan(0.5);

      const { container, rerender, unmount } = render(
        <SmokeCanvas activeSection={0} scrollProgress={0.1} heroTextRef={heroRef} />,
      );
      rerender(<SmokeCanvas activeSection={2} scrollProgress={0.5} heroTextRef={heroRef} />);

      // Drive 32 slow frames to exercise adaptive resolution step-down
      let ts = performance.now();
      for (let i = 0; i < 32; i += 1) {
        ts += 45;
        const next = rafQueue.shift();
        next?.(ts);
      }

      await act(async () => {
        window.dispatchEvent(new Event('resize'));
        document.documentElement.dataset.mode = 'dark';
        await Promise.resolve();
      });

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      if (canvas) {
        act(() => {
          canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        });
      }
      unmount();

      // Direct engine fallback check when WebGL fails
      const failCanvas = document.createElement('canvas');
      failCanvas.getContext = () => null;
      expect(
        startLandingSmokeEngine({
          canvas: failCanvas,
          refs: {
            heroTextRef: heroRef,
            targetIntensityRef: { current: 1 },
            fromIntensityRef: { current: 1 },
            currentIntensityRef: { current: 1 },
            transitionStartRef: { current: 0 },
            textRectRef: { current: [0, 0, 0, 0, 0] },
            triggerRedrawRef: { current: null },
          },
          onThemeChange: vi.fn(),
          onWebglLost: vi.fn(),
        }),
      ).toBeNull();
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('exercises Globe clock math, intro lifecycle, parallax events, and ScrollGlobe navigation dots', () => {
    expect(solveCubicBezier(0, [0.16, 1, 0.3, 1])).toBe(0);
    expect(solveCubicBezier(1, [0.16, 1, 0.3, 1])).toBe(1);
    expect(solveCubicBezier(0.5, [0.16, 1, 0.3, 1])).toBeGreaterThan(0.5);
    expect(generateParticles(20)).toHaveLength(20);

    const el = document.createElement('div');
    applyOrbClock(el, 0);
    expect(el.style.getPropertyValue('--orb-scale')).toBe('0.4500');
    applyOrbClock(el, 3.4);
    expect(Number(el.style.getPropertyValue('--orb-ripple-opacity'))).toBeGreaterThan(0);

    const listener = vi.fn();
    const unsub = subscribeHeroIntroStart(listener);
    unsub();

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const { unmount: unmountGlobe } = render(<Globe />);
    act(() => {
      const kickoff = rafCallbacks.shift();
      kickoff?.(performance.now());
      const frame = rafCallbacks.shift();
      frame?.(performance.now() + 5000);
      window.dispatchEvent(new Event('pointerleave'));
    });
    unmountGlobe();

    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { getByLabelText, unmount: unmountScroll } = render(
      <ScrollGlobe
        sections={[
          {
            id: 'hero',
            badge: 'Live',
            title: 'PranaPulse',
            subtitle: 'Air Shield',
            description: 'Hero copy',
            align: 'left',
            highlights: ['OpenAQ'],
            actions: [{ label: 'Start', variant: 'primary', onClick: vi.fn() }],
          },
          {
            id: 'mid',
            badge: 'Physics',
            title: 'CADR',
            description: 'Middle copy',
            align: 'right',
            features: [{ title: 'HEPA', description: '4.8 ACH', tag: 'Verified' }],
          },
        ]}
      />,
    );
    fireEvent.click(getByLabelText(/Go to Physics/i));
    expect(scrollIntoView).toHaveBeenCalled();
    fireEvent.scroll(window);
    unmountScroll();

    // Exercise reduced-motion & pointermove parallax & light-mode rendering
    const listeners: (() => void)[] = [];
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('pointer: fine') || query.includes('reduced-motion'),
          media: query,
          addEventListener: (_: string, fn: () => void) => {
            listeners.push(fn);
          },
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    document.documentElement.dataset.mode = 'light';
    const { unmount: unmountReduced } = render(<Globe />);
    act(() => {
      for (const fn of listeners) {
        fn();
      }
      window.dispatchEvent(new Event('pointermove'));
    });
    unmountReduced();
  });
});
