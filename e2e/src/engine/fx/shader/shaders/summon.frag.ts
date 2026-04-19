/**
 * Summon Fragment Shader — 召唤光柱特效 + 全屏暗角遮罩
 *
 * 视觉层级（总计 3 snoise/pixel）：
 * 1. 全屏暗角遮罩 (radial vignette, 0 snoise)
 * 2. 光柱主体 (trapezoid + fbm3 内部纹理, 3 snoise)
 * 3. 光柱边缘辉光 (soft edge, 0 snoise)
 * 4. 原点核心光球 (exp, 0 snoise)
 * 5. 冲击波环 (distance field, 0 snoise)
 * 6. 颜色梯度映射（5 阶渐变）
 * 7. 四阶段动画：蓄力(0–0.12) → 爆发(0.12–0.35) → 持续(0.35–0.65) → 消散(0.65–1.0)
 *
 * Alpha 合成策略：
 * 暗角遮罩输出 (black, dimAlpha)，光柱输出 (color, pillarAlpha)，
 * 使用 "1 - (1-a)(1-b)" 公式单 pass 合成。
 *
 * 自动注入 uniform（由 ShaderCanvas 提供）：
 * - uTime       (float)
 * - uResolution (vec2)
 * - uProgress   (float)
 *
 * 自定义 uniform：
 * - uDuration        (float) — 总时长（秒）
 * - uBaseColor       (vec3)  — 主色调（归一化 0-1）
 * - uSubColor        (vec3)  — 副色调
 * - uBrightColor     (vec3)  — 高光色
 * - uGlowColor       (vec3)  — 核心辉光色
 * - uOriginY         (float) — 光柱原点 Y（UV 空间，0=底 1=顶）
 * - uIntensity       (float) — 整体强度系数
 * - uDimStrength     (float) — 暗角遮罩强度（0=无 1=全黑）
 * - uPillarWidth     (float) — 光柱底部半宽（UV 空间）
 */

import { NOISE_GLSL } from '../glsl/noise.glsl';

const SUMMON_MAIN = /* glsl */ `

// ---- Varying ----
varying vec2 vUv;

// ---- Built-in uniform (ShaderCanvas) ----
uniform float uTime;
uniform vec2  uResolution;
uniform float uProgress;

// ---- Custom uniform ----
uniform float uDuration;
uniform vec3  uBaseColor;
uniform vec3  uSubColor;
uniform vec3  uBrightColor;
uniform vec3  uGlowColor;
uniform float uOriginY;
uniform float uIntensity;
uniform float uDimStrength;
uniform float uPillarWidth;

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  float t = uProgress;

  // ---- 原点 & 坐标 ----
  vec2 origin = vec2(0.5, uOriginY);
  vec2 delta = uv - origin;
  delta.x *= aspect;
  float dist = length(delta);

  // ================================================================
  //  动画曲线（连续函数，无 if/else 分支）
  // ================================================================

  // 淡入 / 淡出
  float fadeIn  = smoothstep(0.0, 0.12, t);
  float fadeOut = 1.0 - smoothstep(0.8, 1.0, t);

  // 光柱高度：爆发期快速生长，消散期二次衰减收缩
  float growT = clamp((t - 0.12) / 0.23, 0.0, 1.0);
  float pillarGrow = 1.0 - exp2(-10.0 * growT);            // easeOutExpo
  float shrinkT = clamp((t - 0.65) / 0.35, 0.0, 1.0);
  float pillarShrink = 1.0 - shrinkT * shrinkT;             // easeInQuad
  float maxHeight = (1.0 - uOriginY) * 0.88;
  float pillarH = maxHeight * pillarGrow * pillarShrink;

  // 宽度呼吸（仅持续阶段）
  float breathePhase = smoothstep(0.35, 0.40, t) * (1.0 - smoothstep(0.60, 0.70, t));
  float breathe = 1.0 + 0.08 * sin(uTime * 12.0) * breathePhase;
  float baseW = uPillarWidth * breathe;

  // ================================================================
  //  ① 全屏暗角遮罩（radial vignette）
  // ================================================================
  float dimUp   = smoothstep(0.0,  0.25, t);
  float dimDown = 1.0 - smoothstep(0.65, 1.0, t);
  float dimAnim = dimUp * dimDown;
  // 原点附近较亮（聚光灯），边缘更暗
  float vignette = smoothstep(0.05, 0.55, dist);
  float dimAlpha = dimAnim * uDimStrength * mix(0.3, 1.0, vignette);

  // ================================================================
  //  ② 光柱主体（梯形 + fbm3 有机噪声）— 3 snoise
  // ================================================================
  float heightAbove = delta.y;
  float heightT = pillarH > 0.001
    ? clamp(heightAbove / pillarH, 0.0, 1.0)
    : 0.0;

  // 梯形宽度：底部 baseW → 顶部 55%
  float widthAtH = mix(baseW, baseW * 0.55, heightT);
  float distFromAxis = abs(delta.x);

  // 柔和边缘遮罩
  float pillarMask = 1.0 - smoothstep(widthAtH * 0.6, widthAtH, distFromAxis);
  pillarMask *= step(0.0, heightAbove);                     // 仅原点上方
  pillarMask *= 1.0 - smoothstep(pillarH * 0.82, pillarH, heightAbove); // 顶部渐隐
  pillarMask *= step(0.001, pillarH);                       // 高度=0 时无光柱

  // 内部有机噪声（向上流动）
  vec2 nc = vec2(delta.x * 5.5, heightAbove * 4.5 - uTime * 2.8);
  float noiseVal = fbm3(nc);
  float pillarDetail = 0.55 + 0.45 * noiseVal;

  // 纵向梯度：底部最亮 → 顶部指数衰减
  float vertGrad = exp(-heightT * 2.2);

  float pillar = pillarMask * pillarDetail * vertGrad;

  // ================================================================
  //  ③ 光柱边缘辉光（更宽更柔的外层，无额外 snoise）
  // ================================================================
  float edgeW = widthAtH * 1.6;
  float edgeMask = 1.0 - smoothstep(widthAtH * 0.7, edgeW, distFromAxis);
  edgeMask *= step(0.0, heightAbove);
  edgeMask *= 1.0 - smoothstep(pillarH * 0.65, pillarH * 1.05, heightAbove);
  edgeMask *= step(0.001, pillarH);
  float edgeGlow = edgeMask * vertGrad * 0.18;

  // ================================================================
  //  ④ 原点核心光球（蓄力 + 爆发白闪）
  // ================================================================
  float coreVis  = smoothstep(0.0, 0.12, t);
  float coreFade = 1.0 - smoothstep(0.70, 1.0, t);

  // 爆发白闪（0.12–0.35 区间内衰减）
  float burstT = clamp((t - 0.12) / 0.23, 0.0, 1.0);
  float flashMask = step(0.12, t) * (1.0 - step(0.35, t));
  float flash = (1.0 - burstT) * flashMask;

  float coreR = 0.025 + coreVis * 0.035 + flash * 0.08;
  float coreGlow = exp(-dist * dist / (coreR * coreR * 2.0))
                 * (coreVis * coreFade * 0.65 + flash * 0.85);
  float diskGlow = exp(-dist * 5.0) * coreVis * coreFade * 0.12;

  // ================================================================
  //  ⑤ 冲击波环（爆发阶段双环 distance field）
  // ================================================================
  float ringSpawn = 0.19;
  float r1T = clamp((t - ringSpawn)        / 0.22, 0.0, 1.0);
  float r2T = clamp((t - ringSpawn - 0.04) / 0.30, 0.0, 1.0);

  float ringMax = 0.22;
  float r1R = ringMax * 0.7 * (1.0 - exp2(-10.0 * r1T));
  float r2R = ringMax *       (1.0 - exp2(-10.0 * r2T));

  float rw = 0.006;
  float ring1 = smoothstep(rw, 0.0, abs(dist - r1R))
              * (1.0 - r1T) * 0.45 * step(0.001, r1T);
  float ring2 = smoothstep(rw, 0.0, abs(dist - r2R))
              * (1.0 - r2T) * 0.30 * step(0.001, r2T);
  float rings = ring1 + ring2;

  // ================================================================
  //  ⑥ 合成亮度 + 5 阶颜色梯度映射
  // ================================================================
  float totalBright = (pillar + edgeGlow + coreGlow + diskGlow + rings)
                    * uIntensity * fadeIn * fadeOut;
  totalBright = clamp(totalBright, 0.0, 1.0);

  vec3 col = vec3(0.0);
  col = mix(col, uBaseColor * 0.4,  smoothstep(0.03, 0.12, totalBright));
  col = mix(col, uBaseColor,        smoothstep(0.12, 0.25, totalBright));
  col = mix(col, uSubColor,         smoothstep(0.25, 0.45, totalBright));
  col = mix(col, uBrightColor,      smoothstep(0.45, 0.70, totalBright));
  col = mix(col, uGlowColor,        smoothstep(0.70, 0.88, totalBright));
  // 仅极亮核心才混入白色，且限制混合比例为 50%，保留主色调
  col = mix(col, vec3(1.0),         smoothstep(0.92, 1.0, totalBright) * 0.5);

  // ================================================================
  //  ⑦ 暗角 + 光柱 alpha 单 pass 合成
  //
  //  combinedAlpha = 1 - (1-dim)(1-pillar)
  //  combinedRGB   = pillarColor * pillarAlpha / combinedAlpha
  //
  //  最终混合结果：
  //  pixel = rgb * alpha + background * (1-alpha)
  //        = pillarColor * pillarAlpha + bg * (1-dim)(1-pillar)
  // ================================================================
  float pillarAlpha = totalBright;
  float combinedAlpha = 1.0 - (1.0 - dimAlpha) * (1.0 - pillarAlpha);
  vec3 finalColor = col * pillarAlpha / max(combinedAlpha, 0.001);

  gl_FragColor = vec4(finalColor, combinedAlpha);
}
`;

/**
 * 完整的召唤光柱 Fragment Shader 源码
 * （Simplex Noise + FBM + Summon Main）
 */
export const SUMMON_FRAG =
  'precision mediump float;\n' +
  NOISE_GLSL + '\n' +
  SUMMON_MAIN;
