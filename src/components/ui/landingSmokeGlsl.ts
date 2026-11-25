/** Clip-space passthrough vertex shader for the landing page WebGL smoke backdrop. */
export const LANDING_SMOKE_VERTEX_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** 3-layer domain-warped ridged FBM fragment shader with orb swirl and text readability clear-zone. */
export const LANDING_SMOKE_FRAGMENT_SRC = `
precision mediump float;

uniform vec2 u_res;
uniform vec2 u_viewport;
uniform float u_time;
uniform float u_intro;
uniform float u_sectionIntensity;
uniform float u_maxAlpha;
uniform float u_textCap;
uniform vec3 u_color;
uniform vec3 u_warmColor;
uniform float u_warmMix;
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

  vec2 orbCenter = vec2(0.75 * aspect, 0.50);
  vec2 toOrb = p - orbCenter;
  float orbDist = length(toOrb);
  float t = u_time + 3.4;
  float swirlPulse = 0.30 + 0.06 * sin(t * 0.55);
  float swirlStrength = exp(-pow((orbDist - 0.27) / 0.24, 2.0)) * swirlPulse;
  vec2 tangent = vec2(-toOrb.y, toOrb.x) / max(orbDist, 0.08);
  vec2 pSwirl = p + tangent * swirlStrength;

  vec2 adv1 = vec2(0.165, 0.115) * t;
  vec2 adv2 = vec2(0.245, 0.165) * t;
  vec2 adv3 = vec2(0.335, 0.220) * t;

  float curlPhase = t * 0.18;
  vec2 curlDriftA = vec2(cos(curlPhase) * 0.24, sin(curlPhase * 0.85) * 0.22);
  vec2 curlDriftB = vec2(-sin(curlPhase * 0.72) * 0.28, cos(curlPhase * 0.9) * 0.24);

  vec2 baseP = pSwirl * 1.40;
  vec2 q = vec2(
    fbm5(baseP - adv1 + curlDriftA + vec2(0.4, 1.1)),
    fbm5(baseP - adv1 * 0.84 - curlDriftB + vec2(4.7, 2.3))
  );
  vec2 r = vec2(
    fbm5(baseP + 2.55 * q - adv2 + curlDriftB + vec2(1.8, 7.4)),
    fbm5(baseP + 2.55 * q - adv2 * 0.88 + curlDriftA + vec2(8.1, 3.2))
  );

  float primary = ridgedFbm6(baseP + 2.35 * r - adv2 * 0.76);
  float secondary = ridgedFbm5(pSwirl * 2.45 + 1.85 * r.yx - adv3 + vec2(3.1, 6.2));
  float wisps = ridgedFbm5(pSwirl * 3.35 - 1.35 * q - adv3 * 1.18 + vec2(9.4, 1.7));

  float body = smoothstep(0.26, 0.88, primary);
  float filament = pow(smoothstep(0.32, 0.88, secondary), 1.35);
  float edgeGlow = pow(smoothstep(0.40, 0.92, wisps), 1.55);

  float smoke = body * 0.68 + filament * 0.70 + edgeGlow * 0.48;
  smoke *= smoothstep(0.15, 0.58, primary * 0.68 + secondary * 0.40);

  float leftMask = smoothstep(0.92, 0.04, uv.x);
  float rightMask = smoothstep(0.18, 0.98, uv.x) * 0.82;
  float bottomMask = smoothstep(0.84, 0.02, uv.y);
  float topLeftCurl = smoothstep(0.58, 0.0, uv.x) * smoothstep(0.46, 0.96, uv.y);
  float topRightCurl = smoothstep(0.36, 0.98, uv.x) * smoothstep(0.44, 0.96, uv.y) * 0.84;
  float orbApproach = exp(-pow((orbDist - 0.32) / 0.26, 2.0)) * smoothstep(0.16, 0.64, uv.x);
  float orbCoreCarve = smoothstep(0.11, 0.23, orbDist);

  float spatial = max(
    max(max(leftMask * 0.98, rightMask), bottomMask * 0.96),
    max(max(topLeftCurl * 0.94, topRightCurl), max(orbApproach * 0.88, 0.72))
  );
  spatial *= mix(0.26, 1.0, orbCoreCarve);

  float reachEdge = mix(0.28, 1.24, smoothstep(0.05, 0.82, u_intro));
  float introReach = smoothstep(reachEdge + 0.28, reachEdge - 0.28, uv.x * 0.85 + uv.y * 0.12);
  float density = clamp(smoke * spatial * mix(0.68, 1.0, introReach) * 1.62, 0.0, 1.0);

  float rawAlpha = clamp(density * u_sectionIntensity * u_intro * u_maxAlpha, 0.0, u_maxAlpha);

  vec2 cssPx = vec2(uv.x, 1.0 - uv.y) * u_viewport;
  vec2 rectCenter = 0.5 * (u_textRect.xy + u_textRect.zw);
  vec2 rectHalf = max(0.5 * (u_textRect.zw - u_textRect.xy), vec2(1.0));
  vec2 normPos = (cssPx - rectCenter) / (rectHalf * 0.92 + vec2(u_feather * 0.28));
  float radial = length(normPos);
  float edgeNoise = (q.x - 0.5) * 0.28 + (q.y - 0.5) * 0.18;
  float organicDist = radial + smoothstep(0.75, 1.4, radial) * edgeNoise;
  float textWeight = u_hasTextRect * (1.0 - smoothstep(0.75, 1.85, organicDist));

  float capRatio = clamp(u_textCap / max(u_maxAlpha, 0.001), 0.0, 1.0);
  float finalAlpha = rawAlpha * mix(1.0, capRatio, textWeight);

  vec3 tintedColor = mix(u_color, u_warmColor, u_warmMix * smoothstep(0.22, 0.86, filament));
  gl_FragColor = vec4(tintedColor * finalAlpha, finalAlpha);
}
`;
