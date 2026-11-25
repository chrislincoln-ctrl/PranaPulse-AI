import {
  createFullscreenSmokeProgram,
  disposeFullscreenSmokeProgram,
  FULLSCREEN_QUAD_VERTS,
  type GlFullscreenCore,
} from './webglSmokeCore.js';

export const CONSOLE_SMOKE_VERTEX = `attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

export const CONSOLE_SMOKE_FRAGMENT = `
precision mediump float;
uniform vec2 u_res, u_viewport;
uniform float u_time, u_maxAlpha, u_warmMix;
uniform vec3 u_color, u_warmTint;
float hash21(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.53); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 ROT = mat2(0.80, -0.60, 0.60, 0.80);
float fbm4(vec2 p) {
  float v = 0.0, a = 0.52;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = ROT * p * 2.04 + vec2(17.1, 31.7); a *= 0.50; }
  return v;
}
float ridgedFbm5(vec2 p) {
  float v = 0.0, a = 0.55, w = 1.0;
  for (int i = 0; i < 5; i++) {
    float ridge = 1.0 - abs(noise(p) * 2.0 - 1.0);
    ridge = ridge * ridge * w; w = clamp(ridge * 1.85, 0.16, 1.0);
    v += ridge * a; p = ROT * p * 2.09 + vec2(11.3, 23.9); a *= 0.50;
  }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / max(u_res, vec2(1.0));
  float aspect = u_viewport.x / max(u_viewport.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time + 5.2;
  vec2 adv1 = vec2(0.105, 0.082) * t;
  vec2 adv2 = vec2(-0.125, 0.115) * t;
  vec2 adv3 = vec2(0.165, 0.145) * t;
  float curlPhase = t * 0.14;
  vec2 driftA = vec2(cos(curlPhase) * 0.22, sin(curlPhase * 0.82) * 0.20);
  vec2 driftB = vec2(-sin(curlPhase * 0.74) * 0.26, cos(curlPhase * 0.88) * 0.22);
  vec2 baseP = p * 1.32;
  vec2 q = vec2(fbm4(baseP - adv1 + driftA + vec2(0.5, 1.3)), fbm4(baseP - adv1 * 0.86 - driftB + vec2(4.9, 2.1)));
  vec2 r = vec2(fbm4(baseP + 2.35 * q + adv2 + driftB + vec2(1.9, 7.2)), fbm4(baseP + 2.35 * q - adv2 * 0.82 + driftA + vec2(8.3, 3.1)));
  float primary = ridgedFbm5(baseP + 2.15 * r - adv1 * 0.72);
  float secondary = ridgedFbm5(p * 2.25 + 1.65 * r.yx - adv3 + vec2(3.4, 5.8));
  float wisps = ridgedFbm5(p * 3.15 - 1.25 * q + adv2 * 1.12 + vec2(9.1, 1.9));
  float body = smoothstep(0.24, 0.88, primary);
  float filament = pow(smoothstep(0.30, 0.88, secondary), 1.32);
  float edgeGlow = pow(smoothstep(0.38, 0.92, wisps), 1.55);
  float smoke = (body * 0.68 + filament * 0.70 + edgeGlow * 0.48) * smoothstep(0.14, 0.56, primary * 0.68 + secondary * 0.42);
  float leftWing = smoothstep(0.48, 0.0, uv.x);
  float rightWing = smoothstep(0.52, 1.0, uv.x);
  float bottomPlume = smoothstep(0.62, 0.0, uv.y);
  float topPlume = smoothstep(0.42, 1.0, uv.y) * 0.86;
  float centerCorridor = exp(-pow((uv.x - 0.46) / 0.24, 2.0)) * 0.88;
  float spatial = max(max(leftWing, rightWing), max(max(bottomPlume * 0.94, topPlume), max(centerCorridor, 0.80)));
  float alpha = clamp(clamp(smoke * spatial * 1.58, 0.0, 1.0) * u_maxAlpha, 0.0, u_maxAlpha);
  vec3 tinted = mix(u_color, u_warmTint, u_warmMix * smoothstep(0.20, 0.84, filament));
  gl_FragColor = vec4(tinted * alpha, alpha);
}
`;

export interface ConsoleSmokePalette {
  readonly baseRgb: readonly [number, number, number];
  readonly warmRgb: readonly [number, number, number];
  readonly warmMix: number;
  readonly maxAlpha: number;
}

export interface GlSmokePipeline extends GlFullscreenCore {
  readonly uniforms: {
    readonly res: WebGLUniformLocation | null;
    readonly viewport: WebGLUniformLocation | null;
    readonly time: WebGLUniformLocation | null;
    readonly maxAlpha: WebGLUniformLocation | null;
    readonly color: WebGLUniformLocation | null;
    readonly warmTint: WebGLUniformLocation | null;
    readonly warmMix: WebGLUniformLocation | null;
  };
}

const RGB_DIV = 255;
const HEX_BASE = 16;
const HEX_G_START = 2;
const HEX_B_START = 4;
const HEX_B_END = 6;
const AQI_MODERATE = 100;
const AQI_POOR = 220;
const DARK_ALPHA_BASE = 0.44;
const DARK_ALPHA_SEVERE = 0.5;
const LIGHT_ALPHA_BASE = 0.54;
const LIGHT_ALPHA_MOD = 0.6;
const LIGHT_ALPHA_SEVERE = 0.66;
const WARM_LOW = 0.24;
const WARM_MED = 0.52;
const WARM_HIGH = 0.72;

function hexToRgb(hex: string): readonly [number, number, number] {
  const r = Number.parseInt(hex.slice(0, HEX_G_START), HEX_BASE) / RGB_DIV;
  const g = Number.parseInt(hex.slice(HEX_G_START, HEX_B_START), HEX_BASE) / RGB_DIV;
  const b = Number.parseInt(hex.slice(HEX_B_START, HEX_B_END), HEX_BASE) / RGB_DIV;
  return [r, g, b];
}

function makePalette(
  baseHex: string,
  warmHex: string,
  warmMix: number,
  maxAlpha: number,
): ConsoleSmokePalette {
  return { baseRgb: hexToRgb(baseHex), warmRgb: hexToRgb(warmHex), warmMix, maxAlpha };
}

const PALETTE_LIGHT_LOW = makePalette('263646', '4a6b5d', WARM_LOW, LIGHT_ALPHA_BASE);
const PALETTE_LIGHT_MOD = makePalette('223040', '9a5218', WARM_MED, LIGHT_ALPHA_MOD);
const PALETTE_LIGHT_SEVERE = makePalette('1c2836', 'b45309', WARM_HIGH, LIGHT_ALPHA_SEVERE);
const PALETTE_DARK_SEVERE = makePalette('ccd4da', 'ecb672', WARM_HIGH, DARK_ALPHA_SEVERE);
const PALETTE_DARK_MOD = makePalette('c6d4de', 'e4bc80', WARM_MED, DARK_ALPHA_BASE);
const PALETTE_DARK_GOOD = makePalette('bcd6e2', '8eccd4', WARM_LOW, DARK_ALPHA_BASE);

/** Resolves AQI-reactive atmospheric smog palette tailored for dark and light workbench modes. */
export function resolveConsoleSmokePalette(aqi: number, isDark: boolean): ConsoleSmokePalette {
  if (!isDark) {
    if (aqi >= AQI_POOR) {
      return PALETTE_LIGHT_SEVERE;
    }
    return aqi >= AQI_MODERATE ? PALETTE_LIGHT_MOD : PALETTE_LIGHT_LOW;
  }
  if (aqi >= AQI_POOR) {
    return PALETTE_DARK_SEVERE;
  }
  return aqi >= AQI_MODERATE ? PALETTE_DARK_MOD : PALETTE_DARK_GOOD;
}

function buildUniformMap(gl: WebGLRenderingContext, program: WebGLProgram) {
  return {
    res: gl.getUniformLocation(program, 'u_res'),
    viewport: gl.getUniformLocation(program, 'u_viewport'),
    time: gl.getUniformLocation(program, 'u_time'),
    maxAlpha: gl.getUniformLocation(program, 'u_maxAlpha'),
    color: gl.getUniformLocation(program, 'u_color'),
    warmTint: gl.getUniformLocation(program, 'u_warmTint'),
    warmMix: gl.getUniformLocation(program, 'u_warmMix'),
  };
}

/** Compiles and links the fullscreen console smog WebGL pipeline, or returns null on fallback. */
export function initConsoleSmokePipeline(canvas: HTMLCanvasElement): GlSmokePipeline | null {
  const core = createFullscreenSmokeProgram(canvas, CONSOLE_SMOKE_VERTEX, CONSOLE_SMOKE_FRAGMENT);
  if (!core) {
    return null;
  }
  return { ...core, uniforms: buildUniformMap(core.gl, core.program) };
}

/** Releases all GPU resources associated with a console smog WebGL pipeline. */
export function disposeConsoleSmokePipeline(pipe: GlSmokePipeline): void {
  disposeFullscreenSmokeProgram(pipe);
}

/** Renders one billowing smog frame onto the fullscreen canvas. */
export function drawConsoleSmokeFrame(params: {
  readonly pipe: GlSmokePipeline;
  readonly canvas: HTMLCanvasElement;
  readonly elapsedSec: number;
  readonly aqi: number;
  readonly isDark: boolean;
}): void {
  const { pipe, canvas, elapsedSec, aqi, isDark } = params;
  const { gl, uniforms } = pipe;
  if (gl.isContextLost()) {
    return;
  }
  const pal = resolveConsoleSmokePalette(aqi, isDark);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uniforms.res, canvas.width, canvas.height);
  gl.uniform2f(uniforms.viewport, window.innerWidth, window.innerHeight);
  gl.uniform1f(uniforms.time, elapsedSec);
  gl.uniform1f(uniforms.maxAlpha, pal.maxAlpha);
  gl.uniform3f(uniforms.color, pal.baseRgb[0], pal.baseRgb[1], pal.baseRgb[2]);
  gl.uniform3f(uniforms.warmTint, pal.warmRgb[0], pal.warmRgb[1], pal.warmRgb[2]);
  gl.uniform1f(uniforms.warmMix, pal.warmMix);
  gl.drawArrays(gl.TRIANGLES, 0, FULLSCREEN_QUAD_VERTS);
}
