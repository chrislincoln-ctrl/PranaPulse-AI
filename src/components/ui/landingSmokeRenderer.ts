import type { RefObject } from 'react';
import { INTRO_DURATION } from './globeClock.js';
import type { SmokeRuntimeState } from './landingSmokeObservers.js';
import {
  cubicBezierSection,
  evalSmokeIntroMultiplier,
  measureHeroTextRect,
  SECTION_EASE_MS,
  SMOKE_COLOR_DARK,
  SMOKE_COLOR_LIGHT,
  SMOKE_MAX_ALPHA,
  SMOKE_WARM_DARK,
  SMOKE_WARM_LIGHT,
  TEXT_ALPHA_CAP,
  TEXT_FEATHER_PX,
} from './landingSmokeShader.js';
import { FULLSCREEN_QUAD_VERTS, type GlFullscreenCore } from './webglSmokeCore.js';

/** Mutable shared transition state passed from React refs into the WebGL controller. */
export interface LandingSmokeSharedRefs {
  readonly heroTextRef: RefObject<HTMLDivElement | null>;
  readonly targetIntensityRef: RefObject<number>;
  readonly fromIntensityRef: RefObject<number>;
  readonly currentIntensityRef: RefObject<number>;
  readonly transitionStartRef: RefObject<number>;
  readonly textRectRef: RefObject<[number, number, number, number, number]>;
  readonly triggerRedrawRef: RefObject<(() => void) | null>;
}

/** Uniform location handles for the landing page smog shader. */
export interface LandingSmokeUniforms {
  readonly res: WebGLUniformLocation | null;
  readonly viewport: WebGLUniformLocation | null;
  readonly time: WebGLUniformLocation | null;
  readonly intro: WebGLUniformLocation | null;
  readonly sectionIntensity: WebGLUniformLocation | null;
  readonly maxAlpha: WebGLUniformLocation | null;
  readonly textCap: WebGLUniformLocation | null;
  readonly color: WebGLUniformLocation | null;
  readonly warmColor: WebGLUniformLocation | null;
  readonly warmMix: WebGLUniformLocation | null;
  readonly textRect: WebGLUniformLocation | null;
  readonly hasTextRect: WebGLUniformLocation | null;
  readonly feather: WebGLUniformLocation | null;
}

/** Compiled landing smog GPU handles + queried uniform locations. */
export interface LandingSmokePipeline extends GlFullscreenCore {
  readonly uniforms: LandingSmokeUniforms;
}

const DPR_CAP = 1.5;
const RES_SCALE_HIGH = 0.5;
const RES_SCALE_MID = 0.35;
const RES_SCALE_LOW = 0.25;
export const LANDING_RESOLUTION_STEPS = [RES_SCALE_HIGH, RES_SCALE_MID, RES_SCALE_LOW] as const;
const MS_PER_SEC = 1000;
const DARK_WARM_MIX = 0.36;
const LIGHT_WARM_MIX = 0.52;
const RECT_BOTTOM_IDX = 3;
const RECT_FLAG_IDX = 4;

/** Looks up all WebGL uniform locations used by the landing smog fragment shader. */
export function queryLandingSmokeUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): LandingSmokeUniforms {
  return {
    res: gl.getUniformLocation(program, 'u_res'),
    viewport: gl.getUniformLocation(program, 'u_viewport'),
    time: gl.getUniformLocation(program, 'u_time'),
    intro: gl.getUniformLocation(program, 'u_intro'),
    sectionIntensity: gl.getUniformLocation(program, 'u_sectionIntensity'),
    maxAlpha: gl.getUniformLocation(program, 'u_maxAlpha'),
    textCap: gl.getUniformLocation(program, 'u_textCap'),
    color: gl.getUniformLocation(program, 'u_color'),
    warmColor: gl.getUniformLocation(program, 'u_warmColor'),
    warmMix: gl.getUniformLocation(program, 'u_warmMix'),
    textRect: gl.getUniformLocation(program, 'u_textRect'),
    hasTextRect: gl.getUniformLocation(program, 'u_hasTextRect'),
    feather: gl.getUniformLocation(program, 'u_feather'),
  };
}

function resolveSmokeTiming(state: SmokeRuntimeState, nowMs: number): readonly [number, number] {
  if (state.devIntroT !== null) {
    return [state.devIntroT, evalSmokeIntroMultiplier(state.devIntroT)];
  }
  if (state.reducedMotion) {
    return [INTRO_DURATION, 1.0];
  }
  if (state.introStartMs === -1) {
    return [INTRO_DURATION + state.elapsedDriftSec, 1.0];
  }
  if (state.introStartMs === null) {
    return [0, evalSmokeIntroMultiplier(0)];
  }
  const sinceStart = Math.max(0, (nowMs - state.introStartMs) / MS_PER_SEC);
  return [sinceStart, evalSmokeIntroMultiplier(sinceStart)];
}

function resolveEasedIntensity(
  state: SmokeRuntimeState,
  refs: LandingSmokeSharedRefs,
  nowMs: number,
): number {
  let intensity = refs.targetIntensityRef.current;
  if (!state.reducedMotion && state.devIntroT === null && refs.transitionStartRef.current > 0) {
    const dtTrans = nowMs - refs.transitionStartRef.current;
    if (dtTrans < SECTION_EASE_MS) {
      const p = cubicBezierSection(dtTrans / SECTION_EASE_MS);
      intensity =
        refs.fromIntensityRef.current +
        (refs.targetIntensityRef.current - refs.fromIntensityRef.current) * p;
    } else {
      refs.transitionStartRef.current = 0;
      refs.fromIntensityRef.current = refs.targetIntensityRef.current;
    }
  }
  refs.currentIntensityRef.current = intensity;
  return intensity;
}

/** Uploads uniforms and draws one frame of the landing page smog shader. */
export function drawLandingSmokeFrame(
  pipe: LandingSmokePipeline,
  canvas: HTMLCanvasElement,
  state: SmokeRuntimeState,
  refs: LandingSmokeSharedRefs,
): void {
  const { gl, uniforms } = pipe;
  if (state.disposed || gl.isContextLost()) {
    return;
  }
  const nowMs = performance.now();
  const [timeSec, introMult] = resolveSmokeTiming(state, nowMs);
  const intensity = resolveEasedIntensity(state, refs, nowMs);
  const color = state.isDark ? SMOKE_COLOR_DARK : SMOKE_COLOR_LIGHT;
  const warmColor = state.isDark ? SMOKE_WARM_DARK : SMOKE_WARM_LIGHT;
  const rect = refs.textRectRef.current;

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uniforms.res, canvas.width, canvas.height);
  gl.uniform2f(uniforms.viewport, window.innerWidth, window.innerHeight);
  gl.uniform1f(uniforms.time, timeSec);
  gl.uniform1f(uniforms.intro, introMult);
  gl.uniform1f(uniforms.sectionIntensity, intensity);
  gl.uniform1f(uniforms.maxAlpha, state.isDark ? SMOKE_MAX_ALPHA.dark : SMOKE_MAX_ALPHA.light);
  gl.uniform1f(uniforms.textCap, state.isDark ? TEXT_ALPHA_CAP.dark : TEXT_ALPHA_CAP.light);
  gl.uniform3f(uniforms.color, color[0], color[1], color[2]);
  gl.uniform3f(uniforms.warmColor, warmColor[0], warmColor[1], warmColor[2]);
  gl.uniform1f(uniforms.warmMix, state.isDark ? DARK_WARM_MIX : LIGHT_WARM_MIX);
  gl.uniform4f(uniforms.textRect, rect[0], rect[1], rect[2], rect[RECT_BOTTOM_IDX]);
  gl.uniform1f(uniforms.hasTextRect, rect[RECT_FLAG_IDX]);
  gl.uniform1f(uniforms.feather, TEXT_FEATHER_PX);
  gl.drawArrays(gl.TRIANGLES, 0, FULLSCREEN_QUAD_VERTS);
}

/** Resizes the landing smoke canvas buffer for current DPR and adaptive resolution tier. */
export function resizeLandingSmokeCanvas(
  pipe: LandingSmokePipeline,
  canvas: HTMLCanvasElement,
  state: SmokeRuntimeState,
  refs: LandingSmokeSharedRefs,
): void {
  if (state.disposed) {
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  const scale = LANDING_RESOLUTION_STEPS[state.resStepIdx] ?? RES_SCALE_HIGH;
  const w = Math.max(1, Math.round(window.innerWidth * dpr * scale));
  const h = Math.max(1, Math.round(window.innerHeight * dpr * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  pipe.gl.viewport(0, 0, w, h);
  refs.textRectRef.current = measureHeroTextRect(refs.heroTextRef.current);
}
