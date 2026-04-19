/**
 * GLSL 噪声函数库
 *
 * 以 TS 字符串常量导出，在 fragment shader 中拼接使用。
 *
 * 包含：
 * - snoise(vec2) — Simplex 2D 噪声（基于 Stefan Gustavson 算法）
 * - fbm(vec2)    — 分形布朗运动（5 层）
 * - fbm3(vec2)   — 分形布朗运动（3 层，更轻量）
 * - hash21(vec2)  — 2D → 1D 伪随机哈希（星场等）
 * - hash22(vec2)  — 2D → 2D 伪随机哈希
 * - starField(vec2, float, float) — 程序化星场
 * - domainWarp(vec2, float) — FBM 域弯曲
 *
 * 适用于 WebGL 1.0 (mediump float)。
 */
export const NOISE_GLSL = /* glsl */ `
// ---- Simplex 2D Noise (Stefan Gustavson) ----

vec3 mod289_v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289_v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289_v3(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0 - sqrt(3.0)) / 6.0
    0.366025403784439,   // 0.5 * (sqrt(3.0) - 1.0)
   -0.577350269189626,   // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );

  // First corner
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  // Other corners
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  // Permutations
  i = mod289_v2(i);
  vec3 p = permute(permute(
    i.y + vec3(0.0, i1.y, 1.0)) +
    i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(0.5 - vec3(
    dot(x0, x0),
    dot(x12.xy, x12.xy),
    dot(x12.zw, x12.zw)
  ), 0.0);
  m = m * m;
  m = m * m;

  // Gradients
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  // Compute final noise
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

// ---- Fractional Brownian Motion ----

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

float fbm3(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 3; i++) {
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ---- Hash Functions (pseudo-random) ----

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + n));
}

// ---- Star Field ----

/** 程序化星场：网格分区 + 随机偏移亮点 + 闪烁 */
float starField(vec2 uv, float density, float time) {
  vec2 gv = fract(uv * density) - 0.5;
  vec2 id = floor(uv * density);
  vec2 offset = hash22(id) - 0.5;
  float d = length(gv - offset * 0.7);
  float brightness = hash21(id + 100.0);
  float star = smoothstep(0.04, 0.0, d) * step(0.82, brightness);
  // twinkle
  star *= 0.6 + 0.4 * sin(time * (1.5 + brightness * 4.0) + brightness * 6.28);
  return star;
}

// ---- Domain Warping ----

vec2 domainWarp(vec2 p, float strength) {
  float wx = fbm3(p + vec2(0.0, 0.0));
  float wy = fbm3(p + vec2(5.2, 1.3));
  return p + vec2(wx, wy) * strength;
}
`;
