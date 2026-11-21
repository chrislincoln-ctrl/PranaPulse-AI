/* eslint-disable */
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  INTRO_DURATION as ORB_INTRO_DURATION,
  getDevIntroTime,
  hasPlayedHeroIntro,
  subscribeHeroIntroStart,
} from "@/components/ui/globe";

// Tunable constants
export const SMOKE_MAX_ALPHA = { dark: 0.4, light: 0.1 } as const;
export const TEXT_ALPHA_CAP = { dark: 0.08, light: 0.03 } as const;
export const SMOKE_INTENSITY_BY_SECTION = [1.0, 0.2, 0.2, 0.2] as const;
export const INTRO_DURATION = ORB_INTRO_DURATION;

const SMOKE_COLOR_DARK: readonly [number, number, number] = [205 / 255, 215 / 255, 220 / 255];
const SMOKE_COLOR_LIGHT: readonly [number, number, number] = [70 / 255, 80 / 255, 90 / 255];
const TEXT_FEATHER_PX = 60;
const SECTION_EASE_MS = 1400;
const DPR_CAP = 1.5;
const RESOLUTION_STEPS = [0.5, 0.35, 0.25] as const;
const ADAPTIVE_FRAME_WINDOW = 30;
const ADAPTIVE_THRESHOLD_MS = 20;

const INTRO_KNOTS: readonly (readonly [number, number])[] = [
  [0.0, 0.05],
  [0.8, 0.35],
  [1.6, 0.6],
  [2.4, 0.8],
  [3.5, 1.0],
];

const VERTEX_SHADER_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// 3-layer domain-warped ridged FBM wisp smoke with bright filament edges,
// dark valleys, spatial envelope, orb swirl, and soft-feathered text contrast cap.
const FRAGMENT_SHADER_SRC = `
precision mediump float;

uniform vec2 u_res;
uniform vec2 u_viewport;
uniform float u_time;
uniform float u_intro;
uniform float u_sectionIntensity;
uniform float u_maxAlpha;
uniform float u_textCap;
uniform vec3 u_color;
uniform vec4 u_textRect;
uniform float u_hasTextRect;
uniform float u_feather;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.53);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT = mat2(0.80, -0.60, 0.60, 0.80);

float fbm5(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = ROT * p * 2.03 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

float ridgedFbm6(vec2 p) {
  float v = 0.0;
  float a = 0.56;
  float weight = 1.0;
  for (int i = 0; i < 6; i++) {
    float n = noise(p);
    float ridge = 1.0 - abs(n * 2.0 - 1.0);
    ridge = ridge * ridge;
    ridge *= weight;
    weight = clamp(ridge * 1.85, 0.15, 1.0);
    v += ridge * a;
    p = ROT * p * 2.08 + vec2(11.3, 23.9);
    a *= 0.50;
  }
  return v;
}

float ridgedFbm5(vec2 p) {
  float v = 0.0;
  float a = 0.54;
  for (int i = 0; i < 5; i++) {
    float n = noise(p);
    float ridge = 1.0 - abs(n * 2.0 - 1.0);
    v += (ridge * ridge) * a;
    p = ROT * p * 2.12 + vec2(5.7, 19.3);
    a *= 0.49;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(u_res, vec2(1.0));
  float aspect = u_viewport.x / max(u_viewport.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Subtle tangential curl around the hero orb at (0.75, 0.50)
  vec2 orbCenter = vec2(0.75 * aspect, 0.50);
  vec2 toOrb = p - orbCenter;
  float orbDist = length(toOrb);
  float swirlStrength = exp(-pow((orbDist - 0.26) / 0.24, 2.0)) * 0.28;
  vec2 tangent = vec2(-toOrb.y, toOrb.x) / max(orbDist, 0.08);
  vec2 pSwirl = p + tangent * swirlStrength;

  // Slow endless advection upward (+y) and to the right (+x)
  float t = u_time + 3.4;
  vec2 adv1 = vec2(0.068, 0.048) * t;
  vec2 adv2 = vec2(0.095, 0.065) * t;
  vec2 adv3 = vec2(0.13, 0.088) * t;

  // Layer 1: broad domain-warped curling plumes
  vec2 baseP = pSwirl * 1.45;
  vec2 q = vec2(
    fbm5(baseP - adv1 + vec2(0.4, 1.1)),
    fbm5(baseP - adv1 * 0.82 + vec2(4.7, 2.3))
  );
  vec2 r = vec2(
    fbm5(baseP + 2.35 * q - adv2 + vec2(1.8, 7.4)),
    fbm5(baseP + 2.35 * q - adv2 * 0.9 + vec2(8.1, 3.2))
  );

  float primary = ridgedFbm6(baseP + 2.15 * r - adv2 * 0.72);

  // Layer 2: finer luminous silk filaments
  float secondary = ridgedFbm5(pSwirl * 2.55 + 1.65 * r.yx - adv3 + vec2(3.1, 6.2));

  // Layer 3: gossamer curls wrapping toward the orb
  float wisps = ridgedFbm5(pSwirl * 3.4 - 1.2 * q - adv3 * 1.15 + vec2(9.4, 1.7));

  // Raise contrast and carve out dark valleys so it never reads as flat fog
  float body = smoothstep(0.42, 0.98, primary);
  float filament = pow(smoothstep(0.46, 0.96, secondary), 1.65);
  float edgeGlow = pow(smoothstep(0.54, 0.98, wisps), 2.1);

  float smoke = body * 0.62 + filament * 0.56 + edgeGlow * 0.34;
  smoke *= smoothstep(0.24, 0.68, primary * 0.7 + secondary * 0.35);

  // Spatial mask: denser on left, bottom-left, top-left band, and curling toward/around the orb;
  // fades toward the far right and preserves open dark pockets in upper-center.
  float leftMask = smoothstep(0.84, 0.04, uv.x);
  float bottomMask = smoothstep(0.76, 0.02, uv.y);
  float topLeftCurl = smoothstep(0.48, 0.0, uv.x) * smoothstep(0.55, 0.96, uv.y);
  float orbApproach = exp(-pow((orbDist - 0.31) / 0.25, 2.0)) * smoothstep(0.22, 0.62, uv.x);
  float orbCoreCarve = smoothstep(0.11, 0.23, orbDist);

  float spatial = max(
    max(leftMask * 0.95, bottomMask * 0.92),
    max(topLeftCurl * 0.88, orbApproach * 0.78)
  );
  // Gently fade far right edge so canvas never terminates abruptly
  spatial *= smoothstep(1.04, 0.80, uv.x);
  // Keep orb interior clean while plumes curl right up to its rim
  spatial *= mix(0.25, 1.0, orbCoreCarve);

  // Organic intro reach: wisps emerge cleanly on the left/bottom by 0.8s and curl across toward the orb
  float reachEdge = mix(0.28, 1.24, smoothstep(0.05, 0.82, u_intro));
  float introReach = smoothstep(reachEdge + 0.28, reachEdge - 0.28, uv.x * 0.85 + uv.y * 0.12);
  float density = clamp(smoke * spatial * mix(0.62, 1.0, introReach) * 1.48, 0.0, 1.0);

  // Final alpha = density * sectionIntensity * intro * MAX_ALPHA
  float rawAlpha = clamp(density * u_sectionIntensity * u_intro * u_maxAlpha, 0.0, u_maxAlpha);

  // Apply TEXT_ALPHA_CAP over the hero text bounding rect with a 60px soft feather
  vec2 cssPx = vec2(uv.x, 1.0 - uv.y) * u_viewport;
  vec2 rectCenter = 0.5 * (u_textRect.xy + u_textRect.zw);
  vec2 rectHalf = max(0.5 * (u_textRect.zw - u_textRect.xy), vec2(1.0));
  vec2 dBox = abs(cssPx - rectCenter) - rectHalf;
  float distOutside = length(max(dBox, vec2(0.0)));
  float textWeight = u_hasTextRect * (1.0 - smoothstep(0.0, u_feather, distOutside));

  float cappedAlpha = min(rawAlpha, u_textCap);
  float finalAlpha = mix(rawAlpha, cappedAlpha, textWeight);

  // Premultiplied alpha output for standard normal alpha blending
  gl_FragColor = vec4(u_color * finalAlpha, finalAlpha);
}
`;

function evalSmokeIntroMultiplier(tSec: number): number {
  if (tSec <= 0) {
    return INTRO_KNOTS[0]![1];
  }
  const last = INTRO_KNOTS[INTRO_KNOTS.length - 1]!;
  if (tSec >= last[0]) {
    return last[1];
  }
  for (let i = 0; i < INTRO_KNOTS.length - 1; i++) {
    const [t0, v0] = INTRO_KNOTS[i]!;
    const [t1, v1] = INTRO_KNOTS[i + 1]!;
    if (tSec >= t0 && tSec <= t1) {
      const u = (tSec - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u;
    }
  }
  return 1.0;
}

// Exact cubic-bezier(0.23, 1, 0.32, 1) matching the orb's section transition
function cubicBezierSection(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const x1 = 0.23;
  const y1 = 1.0;
  const x2 = 0.32;
  const y2 = 1.0;
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

function getIsDarkMode(): boolean {
  if (typeof document === "undefined") {
    return true;
  }
  return document.documentElement.dataset.mode !== "light";
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function measureHeroTextRect(container: HTMLElement | null): [number, number, number, number, number] {
  if (!container || typeof document === "undefined") {
    return [0, 0, 0, 0, 0];
  }
  const containerRect = container.getBoundingClientRect();
  if (
    containerRect.width <= 0 ||
    containerRect.height <= 0 ||
    containerRect.bottom < -TEXT_FEATHER_PX ||
    containerRect.top > window.innerHeight + TEXT_FEATHER_PX
  ) {
    return [0, 0, 0, 0, 0];
  }

  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;

  const range = typeof document.createRange === "function" ? document.createRange() : null;
  const textTargets = container.querySelectorAll("h1, p, button, span");

  textTargets.forEach((node) => {
    const el = node as HTMLElement;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      return;
    }
    if ((el.tagName === "P" || el.tagName === "H1") && range) {
      try {
        range.selectNodeContents(el);
        const rects = range.getClientRects();
        if (rects.length > 0) {
          for (let i = 0; i < rects.length; i++) {
            const tr = rects[i]!;
            if (tr.width > 0 && tr.height > 0) {
              minL = Math.min(minL, tr.left);
              minT = Math.min(minT, tr.top);
              maxR = Math.max(maxR, tr.right);
              maxB = Math.max(maxB, tr.bottom);
            }
          }
          return;
        }
      } catch {
        // fall through to element bounding box
      }
    }
    minL = Math.min(minL, r.left);
    minT = Math.min(minT, r.top);
    maxR = Math.max(maxR, r.right);
    maxB = Math.max(maxB, r.bottom);
  });

  if (!Number.isFinite(minL)) {
    return [containerRect.left, containerRect.top, containerRect.right, containerRect.bottom, 1];
  }
  return [minL, minT, maxR, maxB, 1];
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export interface SmokeCanvasProps {
  readonly activeSection: number;
  readonly scrollProgress: number;
  readonly heroTextRef: RefObject<HTMLDivElement | null>;
}

export function SmokeCanvas({ activeSection, scrollProgress, heroTextRef }: SmokeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [isDarkState, setIsDarkState] = useState<boolean>(getIsDarkMode);

  const activeSectionRef = useRef(activeSection);
  const targetIntensityRef = useRef<number>(SMOKE_INTENSITY_BY_SECTION[activeSection] ?? 1.0);
  const fromIntensityRef = useRef<number>(SMOKE_INTENSITY_BY_SECTION[activeSection] ?? 1.0);
  const currentIntensityRef = useRef<number>(SMOKE_INTENSITY_BY_SECTION[activeSection] ?? 1.0);
  const transitionStartRef = useRef<number>(0);
  const textRectRef = useRef<[number, number, number, number, number]>([0, 0, 0, 0, 0]);
  const triggerRedrawRef = useRef<(() => void) | null>(null);

  // Sync section intensity transitions cleanly when activeSection changes
  useEffect(() => {
    const nextTarget = SMOKE_INTENSITY_BY_SECTION[activeSection] ?? 0.2;
    if (activeSectionRef.current !== activeSection) {
      activeSectionRef.current = activeSection;
      fromIntensityRef.current = currentIntensityRef.current;
      targetIntensityRef.current = nextTarget;
      transitionStartRef.current = typeof performance !== "undefined" ? performance.now() : 0;
      triggerRedrawRef.current?.();
    }
  }, [activeSection]);

  // Update hero text bounding rect on scroll progress changes without adding a scroll listener
  useEffect(() => {
    textRectRef.current = measureHeroTextRect(heroTextRef.current);
    triggerRedrawRef.current?.();
  }, [scrollProgress, activeSection, heroTextRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") {
      return;
    }

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: "low-power",
      });
    } catch {
      gl = null;
    }

    if (!gl || gl.isContextLost()) {
      setWebglFailed(true);
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      setWebglFailed(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setWebglFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setWebglFailed(true);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPos = gl.getAttribLocation(program, "a_pos");
    const uRes = gl.getUniformLocation(program, "u_res");
    const uViewport = gl.getUniformLocation(program, "u_viewport");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uIntro = gl.getUniformLocation(program, "u_intro");
    const uSectionIntensity = gl.getUniformLocation(program, "u_sectionIntensity");
    const uMaxAlpha = gl.getUniformLocation(program, "u_maxAlpha");
    const uTextCap = gl.getUniformLocation(program, "u_textCap");
    const uColor = gl.getUniformLocation(program, "u_color");
    const uTextRect = gl.getUniformLocation(program, "u_textRect");
    const uHasTextRect = gl.getUniformLocation(program, "u_hasTextRect");
    const uFeather = gl.getUniformLocation(program, "u_feather");

    gl.useProgram(program);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);

    let disposed = false;
    let rafId: number | null = null;
    let resStepIdx = 0;
    let isDark = getIsDarkMode();
    let reducedMotion = getPrefersReducedMotion();
    const devIntroT = getDevIntroTime();

    let introStartMs: number | null = hasPlayedHeroIntro() ? -1 : null;
    let elapsedDriftSec = 0;
    let lastFrameMs = performance.now();
    let frameCount = 0;
    let frameTimeSum = 0;

    const resizeCanvas = () => {
      if (disposed || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const scale = RESOLUTION_STEPS[resStepIdx] ?? 0.5;
      const w = Math.max(1, Math.round(window.innerWidth * dpr * scale));
      const h = Math.max(1, Math.round(window.innerHeight * dpr * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      textRectRef.current = measureHeroTextRect(heroTextRef.current);
    };

    const drawFrame = (nowMs: number, isStaticDraw: boolean) => {
      if (disposed || !gl || gl.isContextLost()) return;

      let timeSec = 0;
      let introMult = 1.0;

      if (devIntroT !== null) {
        timeSec = devIntroT;
        introMult = evalSmokeIntroMultiplier(devIntroT);
      } else if (reducedMotion) {
        timeSec = INTRO_DURATION;
        introMult = 1.0;
      } else if (introStartMs === -1) {
        // Already played on initial load; hold resting density with endless drift
        introMult = 1.0;
        timeSec = INTRO_DURATION + elapsedDriftSec;
      } else if (introStartMs === null) {
        // Waiting for WRAPPER mount transition to settle
        introMult = evalSmokeIntroMultiplier(0);
        timeSec = 0;
      } else {
        const sinceStart = Math.max(0, (nowMs - introStartMs) / 1000);
        introMult = evalSmokeIntroMultiplier(sinceStart);
        timeSec = sinceStart;
      }

      // Compute eased section intensity
      let intensity = targetIntensityRef.current;
      if (!reducedMotion && devIntroT === null && transitionStartRef.current > 0) {
        const dtTrans = nowMs - transitionStartRef.current;
        if (dtTrans < SECTION_EASE_MS) {
          const p = cubicBezierSection(dtTrans / SECTION_EASE_MS);
          intensity =
            fromIntensityRef.current + (targetIntensityRef.current - fromIntensityRef.current) * p;
        } else {
          transitionStartRef.current = 0;
          fromIntensityRef.current = targetIntensityRef.current;
        }
      }
      currentIntensityRef.current = intensity;

      const color = isDark ? SMOKE_COLOR_DARK : SMOKE_COLOR_LIGHT;
      const maxAlpha = isDark ? SMOKE_MAX_ALPHA.dark : SMOKE_MAX_ALPHA.light;
      const textCap = isDark ? TEXT_ALPHA_CAP.dark : TEXT_ALPHA_CAP.light;
      const rect = textRectRef.current;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uViewport, window.innerWidth, window.innerHeight);
      gl.uniform1f(uTime, timeSec);
      gl.uniform1f(uIntro, introMult);
      gl.uniform1f(uSectionIntensity, intensity);
      gl.uniform1f(uMaxAlpha, maxAlpha);
      gl.uniform1f(uTextCap, textCap);
      gl.uniform3f(uColor, color[0], color[1], color[2]);
      gl.uniform4f(uTextRect, rect[0], rect[1], rect[2], rect[3]);
      gl.uniform1f(uHasTextRect, rect[4]);
      gl.uniform1f(uFeather, TEXT_FEATHER_PX);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (isStaticDraw) {
        return;
      }
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const tick = (nowMs: number) => {
      if (disposed || document.hidden || devIntroT !== null || reducedMotion) {
        rafId = null;
        return;
      }

      const dtMs = Math.min(nowMs - lastFrameMs, 100);
      lastFrameMs = nowMs;
      elapsedDriftSec += dtMs / 1000;

      const frameStart = performance.now();
      drawFrame(nowMs, false);
      const renderCostMs = performance.now() - frameStart;

      // Adaptive resolution step-down when average frame time exceeds 20ms over 30 frames
      frameCount += 1;
      frameTimeSum += Math.max(dtMs, renderCostMs);
      if (frameCount >= ADAPTIVE_FRAME_WINDOW) {
        const avgMs = frameTimeSum / frameCount;
        frameCount = 0;
        frameTimeSum = 0;
        if (avgMs > ADAPTIVE_THRESHOLD_MS && resStepIdx < RESOLUTION_STEPS.length - 1) {
          resStepIdx += 1;
          resizeCanvas();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    const startLoopIfAllowed = () => {
      if (disposed) return;
      if (devIntroT !== null || reducedMotion) {
        stopLoop();
        drawFrame(performance.now(), true);
        return;
      }
      if (document.hidden) {
        stopLoop();
        return;
      }
      if (rafId === null) {
        lastFrameMs = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    triggerRedrawRef.current = () => {
      if (disposed) return;
      if (devIntroT !== null || reducedMotion) {
        drawFrame(performance.now(), true);
      }
    };

    // Sync with Globe's master intro clock start (with safety fallback)
    const unsubscribeIntro = subscribeHeroIntroStart((startMs) => {
      if (disposed) return;
      introStartMs = startMs;
      if (devIntroT !== null || reducedMotion) {
        drawFrame(performance.now(), true);
      }
    });

    const fallbackStartTimer =
      introStartMs === null && devIntroT === null && !reducedMotion
        ? window.setTimeout(() => {
            if (introStartMs === null) {
              introStartMs = performance.now();
            }
          }, 1550)
        : null;

    // Watch <html data-mode="dark|light">
    const modeObserver = new MutationObserver(() => {
      const nextDark = getIsDarkMode();
      if (nextDark !== isDark) {
        isDark = nextDark;
        setIsDarkState(nextDark);
        if (devIntroT !== null || reducedMotion) {
          drawFrame(performance.now(), true);
        }
      }
    });
    modeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode"],
    });

    // Watch prefers-reduced-motion dynamically
    const motionMq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const handleMotionChange = () => {
      reducedMotion = motionMq ? motionMq.matches : false;
      startLoopIfAllowed();
    };
    motionMq?.addEventListener("change", handleMotionChange);

    // Watch viewport & hero text resize
    const handleResize = () => {
      resizeCanvas();
      if (devIntroT !== null || reducedMotion) {
        drawFrame(performance.now(), true);
      }
    };
    window.addEventListener("resize", handleResize, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && heroTextRef.current) {
      ro = new ResizeObserver(() => {
        textRectRef.current = measureHeroTextRect(heroTextRef.current);
        if (devIntroT !== null || reducedMotion) {
          drawFrame(performance.now(), true);
        }
      });
      ro.observe(heroTextRef.current);
    }

    // Pause rendering when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoopIfAllowed();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Handle WebGL context loss gracefully
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      stopLoop();
      setWebglFailed(true);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    resizeCanvas();
    drawFrame(performance.now(), true);
    startLoopIfAllowed();

    return () => {
      disposed = true;
      triggerRedrawRef.current = null;
      stopLoop();
      unsubscribeIntro();
      if (fallbackStartTimer !== null) {
        window.clearTimeout(fallbackStartTimer);
      }
      modeObserver.disconnect();
      motionMq?.removeEventListener("change", handleMotionChange);
      window.removeEventListener("resize", handleResize);
      ro?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      if (gl && !gl.isContextLost()) {
        gl.disableVertexAttribArray(aPos);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        if (buffer) gl.deleteBuffer(buffer);
        gl.useProgram(null);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      }
    };
  }, [heroTextRef]);

  // Also observe dark/light mode when in CSS fallback mode
  useEffect(() => {
    if (!webglFailed || typeof document === "undefined") {
      return;
    }
    const observer = new MutationObserver(() => {
      setIsDarkState(getIsDarkMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode"],
    });
    return () => {
      observer.disconnect();
    };
  }, [webglFailed]);

  if (webglFailed) {
    const devT = getDevIntroTime();
    const introFactor = devT !== null ? evalSmokeIntroMultiplier(devT) : 1.0;
    const sectionFactor = SMOKE_INTENSITY_BY_SECTION[activeSection] ?? 0.2;
    const maxAlpha = isDarkState ? SMOKE_MAX_ALPHA.dark : SMOKE_MAX_ALPHA.light;
    const textCap = isDarkState ? TEXT_ALPHA_CAP.dark : TEXT_ALPHA_CAP.light;
    const rgb = isDarkState ? "205, 215, 220" : "70, 80, 90";
    const edgeAlpha = Math.min(maxAlpha, maxAlpha * sectionFactor * introFactor);
    const centerAlpha = Math.min(textCap, edgeAlpha * 0.35);

    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1] pointer-events-none overflow-hidden transition-opacity duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ opacity: 1 }}
      >
        <div
          className="smoke-fallback-blob-a absolute -left-[12%] -top-[10%] h-[58vh] w-[46vw] rounded-full blur-[48px]"
          style={{
            background: `radial-gradient(ellipse at 35% 35%, rgba(${rgb}, ${edgeAlpha.toFixed(3)}) 0%, rgba(${rgb}, ${(edgeAlpha * 0.45).toFixed(3)}) 45%, transparent 74%)`,
          }}
        />
        <div
          className="smoke-fallback-blob-b absolute -bottom-[14%] -left-[8%] h-[62vh] w-[58vw] rounded-full blur-[54px]"
          style={{
            background: `radial-gradient(ellipse at 30% 70%, rgba(${rgb}, ${edgeAlpha.toFixed(3)}) 0%, rgba(${rgb}, ${centerAlpha.toFixed(3)}) 52%, transparent 78%)`,
          }}
        />
        <div
          className="smoke-fallback-blob-a absolute right-[6%] top-[18%] h-[56vh] w-[42vw] rounded-full blur-[56px]"
          style={{
            background: `radial-gradient(ellipse at 60% 50%, rgba(${rgb}, ${(edgeAlpha * 0.72).toFixed(3)}) 0%, transparent 72%)`,
          }}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[1] h-full w-full pointer-events-none"
    />
  );
}

export default SmokeCanvas;

