export const CONSOLE_SMOKE_VERTEX = `attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

export const CONSOLE_SMOKE_FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform vec2 u_viewport;
uniform float u_time;
uniform float u_maxAlpha;
uniform vec3 u_color;
uniform vec3 u_warmTint;
uniform float u_warmMix;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.53);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
const mat2 ROT = mat2(0.80, -0.60, 0.60, 0.80);
float fbm4(vec2 p) {
  float v = 0.0; float a = 0.52;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = ROT * p * 2.04 + vec2(17.1, 31.7); a *= 0.50; }
  return v;
}
float ridgedFbm5(vec2 p) {
  float v = 0.0; float a = 0.55; float w = 1.0;
  for (int i = 0; i < 5; i++) {
    float ridge = 1.0 - abs(noise(p) * 2.0 - 1.0);
    ridge = ridge * ridge * w;
    w = clamp(ridge * 1.85, 0.16, 1.0);
    v += ridge * a;
    p = ROT * p * 2.09 + vec2(11.3, 23.9);
    a *= 0.50;
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
  float body = smoothstep(0.32, 0.92, primary);
  float filament = pow(smoothstep(0.38, 0.92, secondary), 1.4);
  float edgeGlow = pow(smoothstep(0.46, 0.95, wisps), 1.7);
  float smoke = (body * 0.62 + filament * 0.64 + edgeGlow * 0.44) * smoothstep(0.18, 0.62, primary * 0.66 + secondary * 0.40);
  float leftWing = smoothstep(0.48, 0.0, uv.x);
  float rightWing = smoothstep(0.52, 1.0, uv.x);
  float bottomPlume = smoothstep(0.60, 0.0, uv.y);
  float centerCorridor = exp(-pow((uv.x - 0.44) / 0.18, 2.0)) * 0.78;
  float spatial = max(max(leftWing, rightWing), max(bottomPlume * 0.92, max(centerCorridor, 0.58)));
  float alpha = clamp(clamp(smoke * spatial * 1.48, 0.0, 1.0) * u_maxAlpha, 0.0, u_maxAlpha);
  vec3 tinted = mix(u_color, u_warmTint, u_warmMix * smoothstep(0.25, 0.88, filament));
  gl_FragColor = vec4(tinted * alpha, alpha);
}
`;

export interface ConsoleSmokePalette {
  readonly baseRgb: readonly [number, number, number];
  readonly warmRgb: readonly [number, number, number];
  readonly warmMix: number;
  readonly maxAlpha: number;
}

export interface GlSmokePipeline {
  readonly gl: WebGLRenderingContext;
  readonly program: WebGLProgram;
  readonly vs: WebGLShader;
  readonly fs: WebGLShader;
  readonly buffer: WebGLBuffer | null;
  readonly aPos: number;
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
const LIGHT_ALPHA_BASE = 0.14;
const WARM_LOW = 0.18;
const WARM_MED = 0.44;
const WARM_HIGH = 0.66;
const QUAD_VERTS = 6;
const QUAD_POSITIONS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

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

const PALETTE_LIGHT_LOW = makePalette('485460', '94663a', WARM_LOW, LIGHT_ALPHA_BASE);
const PALETTE_LIGHT_MOD = makePalette('485460', '94663a', WARM_MED, LIGHT_ALPHA_BASE);
const PALETTE_DARK_SEVERE = makePalette('ccd4da', 'ecb672', WARM_HIGH, DARK_ALPHA_SEVERE);
const PALETTE_DARK_MOD = makePalette('c6d4de', 'e4bc80', WARM_MED, DARK_ALPHA_BASE);
const PALETTE_DARK_GOOD = makePalette('bcd6e2', '8eccd4', WARM_LOW, DARK_ALPHA_BASE);

/** Resolves AQI-reactive atmospheric smog palette tailored for dark and light workbench modes. */
export function resolveConsoleSmokePalette(aqi: number, isDark: boolean): ConsoleSmokePalette {
  if (!isDark) {
    return aqi >= AQI_MODERATE ? PALETTE_LIGHT_MOD : PALETTE_LIGHT_LOW;
  }
  if (aqi >= AQI_POOR) {
    return PALETTE_DARK_SEVERE;
  }
  return aqi >= AQI_MODERATE ? PALETTE_DARK_MOD : PALETTE_DARK_GOOD;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createGlContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  try {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    return gl && !gl.isContextLost() ? gl : null;
  } catch {
    return null;
  }
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
  const gl = createGlContext(canvas);
  if (!gl) {
    return null;
  }
  const vs = compileShader(gl, gl.VERTEX_SHADER, CONSOLE_SMOKE_VERTEX);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, CONSOLE_SMOKE_FRAGMENT);
  const program = vs && fs ? gl.createProgram() : null;
  if (!vs || !fs || !program) {
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.useProgram(program);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.clearColor(0, 0, 0, 0);
  return { gl, program, vs, fs, buffer, aPos, uniforms: buildUniformMap(gl, program) };
}

/** Releases all GPU resources associated with a console smog WebGL pipeline. */
export function disposeConsoleSmokePipeline(pipe: GlSmokePipeline): void {
  const { gl, aPos, buffer, program, vs, fs } = pipe;
  if (gl.isContextLost()) {
    return;
  }
  gl.disableVertexAttribArray(aPos);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  if (buffer) {
    gl.deleteBuffer(buffer);
  }
  gl.useProgram(null);
  gl.deleteProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
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
  gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTS);
}
