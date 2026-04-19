/**
 * Vortex Fragment Shader — 星系级旋涡特效
 *
 * 视觉层级（由底到顶，总计 6 snoise/pixel）：
 * 1. 背景星场 (hash only, 0 snoise)
 * 2. 主螺旋 5臂 + fbm3 (3 snoise)
 * 3. 副螺旋 3臂 + fbm3 (3 snoise)
 * 4. 尘埃暗带 (hash, 0 snoise)
 * 5. 核心辉光 (exp, 0 snoise)
 * 6. 6阶颜色梯度：dark → base → accent → bright → glow → white
 * 7. 动画：淡入 → 从大到小蓄力吸入 → 淡出
 *
 * 自动注入 uniform（由 ShaderCanvas 提供）：
 * - uTime       (float)
 * - uResolution (vec2)
 * - uProgress   (float)
 *
 * 自定义 uniform：
 * - uDuration        (float) — 总时长（秒）
 * - uDarkColor       (vec3)  — 最深底色（归一化 0-1）
 * - uBaseColor       (vec3)  — 主色调
 * - uAccentColor     (vec3)  — 副色调
 * - uBrightColor     (vec3)  — 高光色
 * - uGlowColor       (vec3)  — 辉光色
 * - uSpiralTightness (float) — 螺旋紧密度（推荐 4.0 ~ 6.0）
 * - uRotationSpeed   (float) — 旋转速度（弧度/秒，推荐 1.0 ~ 2.0）
 * - uIntensity       (float) — 整体强度系数（0.8=normal, 1.2=strong）
 * - uScale           (float) — 旋涡缩放系数（默认 1.0，>1 放大，<1 缩小）
 */

import { NOISE_GLSL } from '../glsl/noise.glsl';

const VORTEX_MAIN = /* glsl */ `

// ---- Varying ----
varying vec2 vUv;

// ---- Built-in uniform (ShaderCanvas) ----
uniform float uTime;
uniform vec2  uResolution;
uniform float uProgress;

// ---- Custom uniform ----
uniform float uDuration;
uniform vec3  uDarkColor;
uniform vec3  uBaseColor;
uniform vec3  uAccentColor;
uniform vec3  uBrightColor;
uniform vec3  uGlowColor;
uniform float uSpiralTightness;
uniform float uRotationSpeed;
uniform float uIntensity;
uniform float uScale;

// ---- Constants ----
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

void main() {
  // ---- 坐标系 ----
  vec2 uv = vUv - 0.5;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;
  uv /= uScale;

  float t = uProgress;

  // ---- 动画：整体吞噬收缩（海洋漩涡） ----
  // 0~0.12    淡入
  // 0.12~0.85 UV 放大 → 旋涡在屏幕上等比缩小
  // 0.8~1.0   柔和淡出
  float fadeIn  = smoothstep(0.0, 0.12, t);
  float fadeOut = 1.0 - smoothstep(0.8, 1.0, t);
  float gatherFactor = smoothstep(0.0, 0.85, t); // 0→满尺寸  1→缩到最小

  // 整体缩放：UV 坐标放大 = 旋涡视觉缩小
  float shrink = 1.0 + gatherFactor * 4.0; // 1× → 5×
  vec2 origUv = uv;                         // 星场用原始坐标
  uv *= shrink;

  float r = length(uv);
  float theta = atan(uv.y, uv.x);

  float radialPull = gatherFactor * 1.5;
  float rotAccel = 1.0 + gatherFactor * 1.5; // 越小转越快
  float maxR = 0.45;

  // ================================================================
  //  ① 背景星场层 — 用原始坐标避免网格闪烁
  // ================================================================
  float stars = starField(origUv, 40.0, uTime) * smoothstep(0.05, 0.25, length(origUv));

  // ================================================================
  //  ② 主螺旋层（5 臂）— 3 snoise
  // ================================================================
  float twist1 = theta + r * uSpiralTightness - uTime * uRotationSpeed * rotAccel;
  float numArms1 = 5.0;

  float spiral1 = 0.5 + 0.5 * sin(twist1 * numArms1);
  spiral1 = pow(spiral1, 1.8);

  // 噪声坐标沿 r 偏移（减速避免抖动）
  vec2 nc1 = vec2(twist1 * numArms1 / TAU, (r + radialPull) * 3.5) + uTime * 0.1;
  float noise1 = fbm3(nc1);

  float density = spiral1 * (0.45 + 0.55 * noise1);

  // 外圈自然淡出（与收缩边界同步）
  density *= mix(1.0, 0.35, smoothstep(0.0, maxR, r));

  // ================================================================
  //  ③ 副螺旋层（3 臂，反向）— 3 snoise
  // ================================================================
  float twist2 = theta - r * uSpiralTightness * 1.2 + uTime * uRotationSpeed * rotAccel * 0.5;
  float numArms2 = 3.0;

  float spiral2 = 0.5 + 0.5 * sin(twist2 * numArms2);
  spiral2 = pow(spiral2, 2.2);

  float noise2 = fbm3(vec2(twist2 * numArms2 / TAU, (r + radialPull * 0.6) * 2.5) - uTime * 0.08);
  density += spiral2 * (0.3 + 0.4 * noise2) * 0.35;

  // ================================================================
  //  ④ 尘埃暗带 (hash only)
  // ================================================================
  float dustAngle = theta + r * uSpiralTightness * 1.05 - uTime * uRotationSpeed * rotAccel * 0.9;
  float dust = 0.5 + 0.5 * sin(dustAngle * numArms1 + 0.5);
  dust = pow(dust, 3.0);
  float dustDetail = hash21(vec2(dustAngle * 2.0, r * 10.0));
  float absorption = 1.0 - dust * (0.6 + 0.4 * dustDetail) * 0.3 * smoothstep(0.04, 0.2, r);
  density *= absorption;

  // ================================================================
  //  ⑤ 核心辉光（无额外增强，随整体缩小）
  // ================================================================
  float coreGlow = exp(-r * 18.0) * 0.6;
  float diskGlow = exp(-r * 8.0)  * 0.2;
  float haloGlow = exp(-r * 3.5)  * 0.06;
  density += coreGlow + diskGlow + haloGlow;

  // ================================================================
  //  ⑥ 径向边界 + 淡入淡出
  // ================================================================
  float boundary = 1.0 - smoothstep(maxR * 0.1, maxR, r);
  density *= boundary * fadeIn * fadeOut;
  // 星场边界用屏幕空间坐标
  float screenR = maxR / shrink;
  float starBound = 1.0 - smoothstep(screenR * 0.1, screenR, length(origUv));
  stars *= starBound * fadeIn * fadeOut;

  // ================================================================
  //  ⑦ 颜色梯度映射ﾈ6 阶）
  // ================================================================
  vec3 col = uDarkColor;
  col = mix(col, uBaseColor * 0.4,  smoothstep(0.02, 0.10, density));
  col = mix(col, uBaseColor,        smoothstep(0.10, 0.25, density));
  col = mix(col, uAccentColor,      smoothstep(0.25, 0.42, density));
  col = mix(col, uBrightColor,      smoothstep(0.42, 0.62, density));
  col = mix(col, uGlowColor,        smoothstep(0.62, 0.80, density));
  col = mix(col, vec3(1.0),         smoothstep(0.80, 0.98, density));

  // 星点叠加
  vec3 starCol = mix(vec3(0.8, 0.85, 1.0), vec3(1.0), stars);
  col += starCol * stars * 0.7;

  // ================================================================
  //  最终输出
  // ================================================================
  float alpha = clamp(
    (density + stars * 0.25) * uIntensity,
    0.0, 1.0
  );

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

/**
 * 完整的旋涡 Fragment Shader 源码
 * （Simplex Noise + FBM + Vortex Main）
 */
export const VORTEX_FRAG =
  'precision mediump float;\n' +
  NOISE_GLSL + '\n' +
  VORTEX_MAIN;
