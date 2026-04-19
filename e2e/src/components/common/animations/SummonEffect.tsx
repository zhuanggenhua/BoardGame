/**
 * SummonEffect — 通用召唤/降临特效（Canvas 2D）
 *
 * 参考游戏王 Master Duel 召唤特效设计：
 * 多阶段动画 — 蓄力聚光 → 光柱爆发冲天 → 脉冲呼吸 → 收缩消散
 * 光柱底部最亮（白色核心），向上渐变为主题色，顶部自然消散。
 * 宽度有脉冲呼吸，底部有能量环扩散，粒子沿柱体上升。
 *
 * 全 Canvas 2D 渲染，零 DOM 动画，性能友好。
 * 无溢出方案：Canvas 铺满父级（absolute inset-0），所有绘制基于 canvas 尺寸，
 * 无需父级 overflow: visible。
 *
 * @example
 * ```tsx
 * <div className="relative" style={{ minHeight: 320 }}>
 *   <SummonEffect active intensity="strong" color="gold" />
 * </div>
 * ```
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  type Particle,
  type ParticlePreset,
  createParticle,
  updateParticles,
  drawParticles,
} from './canvasParticleEngine';

export type SummonIntensity = 'normal' | 'strong';
export type SummonColorTheme = 'blue' | 'gold' | 'custom';

export interface SummonEffectProps {
  active: boolean;
  intensity?: SummonIntensity;
  color?: SummonColorTheme;
  customColors?: SummonColorSet;
  /** 光柱原点 Y 位置（0~1，相对于 canvas 高度，默认 0.78） */
  originY?: number;
  onComplete?: () => void;
  className?: string;
}

export interface SummonColorSet {
  main: [number, number, number];
  sub: [number, number, number];
  bright: [number, number, number];
}

/** 预设颜色（RGB 三元组） */
const COLOR_PRESETS: Record<'blue' | 'gold', SummonColorSet> = {
  blue: {
    main: [147, 197, 253],
    sub: [59, 130, 246],
    bright: [220, 240, 255],
  },
  gold: {
    main: [251, 191, 36],
    sub: [245, 158, 11],
    bright: [255, 240, 200],
  },
};

function resolveColors(color: SummonColorTheme, custom?: SummonColorSet): SummonColorSet {
  if (color === 'custom' && custom) return custom;
  return COLOR_PRESETS[color === 'custom' ? 'blue' : color];
}

/** 升腾粒子预设（俯视角：径向扩散） */
const RISE_PRESET: ParticlePreset = {
  count: 1,
  speed: { min: 1, max: 3 },
  size: { min: 2, max: 5 },
  life: { min: 0.4, max: 0.8 },
  gravity: 0, // 俯视角无重力
  shapes: ['circle'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none', // 径向扩散
  glow: true,
  glowScale: 3,
  drag: 0.98,
  additive: true,
  turbulence: 0.6,
  turbulenceFreq: 2,
  pulse: 0.2,
  pulseFreq: 5,
};

/** 缓动 / 辅助函数 */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
function smoothstep(edge0: number, edge1: number, x: number): number {
  const v = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return v * v * (3 - 2 * v);
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * 亮度 → 颜色映射（完全对齐 shader 的 6 阶 smoothstep mix）
 *
 * shader 中：
 *   base  = c.sub (blue-500),  sub   = c.main (blue-300),
 *   bright = c.bright,         glow  = [240,248,255]
 */
function mapBrightToRGB(bright: number, c: SummonColorSet): [number, number, number] {
  const [mr, mg, mb] = c.main;   // shader uSubColor
  const [sr, sg, sb] = c.sub;    // shader uBaseColor
  const [br, bg, bb] = c.bright; // shader uBrightColor
  let r = 0, g = 0, b = 0;
  const mix = (a: number, v: number, t: number) => a + (v - a) * t;
  // ① 暗基色
  const m1 = smoothstep(0.03, 0.15, bright);
  r = mix(r, sr * 0.4, m1); g = mix(g, sg * 0.4, m1); b = mix(b, sb * 0.4, m1);
  // ② 基色
  const m2 = smoothstep(0.12, 0.25, bright);
  r = mix(r, sr, m2); g = mix(g, sg, m2); b = mix(b, sb, m2);
  // ③ 副色（较亮）
  const m3 = smoothstep(0.25, 0.45, bright);
  r = mix(r, mr, m3); g = mix(g, mg, m3); b = mix(b, mb, m3);
  // ④ 高光色
  const m4 = smoothstep(0.45, 0.65, bright);
  r = mix(r, br, m4); g = mix(g, bg, m4); b = mix(b, bb, m4);
  // ⑤ 辉光（接近白）
  const m5 = smoothstep(0.65, 0.82, bright);
  r = mix(r, 240, m5); g = mix(g, 248, m5); b = mix(b, 255, m5);
  // ⑥ 纯白
  const m6 = smoothstep(0.82, 0.98, bright);
  r = mix(r, 255, m6); g = mix(g, 255, m6); b = mix(b, 255, m6);
  return [r, g, b];
}

/**
 * 生成光柱纵向渐变（对齐 shader 的指数衰减 + 6 阶颜色映射）
 * N 个停靠点产生平滑连续的渐变，无可见色带分段。
 */
function makePillarGradient(
  ctx: CanvasRenderingContext2D,
  cy: number, top: number,
  cx: number,
  c: SummonColorSet,
  alpha: number,
): CanvasGradient {
  const grad = ctx.createLinearGradient(cx, cy, cx, top);
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const ratio = i / N; // 0=底部  1=顶部
    // 指数衰减亮度（对齐 shader vertGrad = exp(-heightT * 2.2)）
    const bright = Math.exp(-ratio * 2.2);
    // 顶部渐隐（对齐 shader 1-smoothstep(0.82, 1.0, heightT)）
    const topFade = 1 - smoothstep(0.82, 1.0, ratio);
    const a = bright * topFade * alpha;
    const [r, g, b] = mapBrightToRGB(bright, c);
    grad.addColorStop(ratio, `rgba(${r | 0},${g | 0},${b | 0},${a})`);
  }
  return grad;
}

/** 绘制光柱（简洁梯形 + 平滑渐变 + 柔边辉光） */
function drawPillar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  width: number, height: number,
  c: SummonColorSet,
  intensity: number,
  _time: number,
) {
  const halfW = width / 2;
  const top = cy - height;
  if (height < 2) return;

  const TAPER = 0.55; // 顶部宽度 = 底部 55%

  // --- 1. 外层柔光（宽 1.4x，低透明度） ---
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 1.4, cy);
  ctx.lineTo(cx - halfW * TAPER * 1.2, top);
  ctx.lineTo(cx + halfW * TAPER * 1.2, top);
  ctx.lineTo(cx + halfW * 1.4, cy);
  ctx.closePath();
  ctx.fillStyle = makePillarGradient(ctx, cy, top, cx, c, intensity * 0.2);
  ctx.fill();

  // --- 2. 主体光柱 ---
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy);
  ctx.lineTo(cx - halfW * TAPER, top);
  ctx.lineTo(cx + halfW * TAPER, top);
  ctx.lineTo(cx + halfW, cy);
  ctx.closePath();
  ctx.fillStyle = makePillarGradient(ctx, cy, top, cx, c, intensity);
  ctx.fill();
}

export const SummonEffect: React.FC<SummonEffectProps> = ({
  active,
  intensity = 'normal',
  color = 'blue',
  customColors,
  originY = 0.78,
  onComplete,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isStrong = intensity === 'strong';

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // 使用 offsetWidth/offsetHeight 获取 CSS 布局尺寸（不受父级 transform scale 影响）
    const cw = parent.offsetWidth;
    const ch = parent.offsetHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const c = resolveColors(color, customColors);
    const [mr, mg, mb] = c.main;
    const [sr, sg, sb] = c.sub;
    const [br, bg, bb] = c.bright;

    // 原点：由 originY prop 控制（默认底部居中偏上）
    const cx = cw / 2;
    const cy = ch * originY;

    // 光柱参数 — 基于原点到 canvas 顶部的可用空间
    const pillarBaseWidth = isStrong ? cw * 0.08 : cw * 0.06;
    const pillarMaxHeight = cy * 0.9; // 原点到顶部距离的 90%，确保不超出 canvas
    const totalDuration = isStrong ? 1.4 : 1.1;

    // 粒子池
    const particles: Particle[] = [];
    const particleColors: [number, number, number][] = [
      c.main, c.sub, c.bright, [255, 255, 255],
    ];

    // 冲击波环
    const rings: { t0: number; dur: number; maxR: number }[] = [];
    let ringsSpawned = false;
    const ringMaxR = Math.min(cw, ch) * 0.4;

    let startTime = 0;
    let lastTime = 0;

    const loop = (now: number) => {
      if (!startTime) { startTime = now; lastTime = now; }
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(1, elapsed / totalDuration);

      ctx.clearRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'lighter';

      // ================================================================
      // 连续动画曲线（对齐 shader 方案，无 if/else 分段）
      // ================================================================
      const fadeIn  = smoothstep(0, 0.12, t);
      const fadeOut = 1 - smoothstep(0.8, 1.0, t);

      // 光柱高度：爆发期快速生长 + 消散期二次收缩
      const growT = clamp01((t - 0.12) / 0.23);
      const pillarGrow = 1 - Math.pow(2, -10 * growT);   // easeOutExpo
      const shrinkT = clamp01((t - 0.65) / 0.35);
      const pillarShrink = 1 - shrinkT * shrinkT;         // easeInQuad
      const pillarH = pillarMaxHeight * pillarGrow * pillarShrink;

      // 宽度呼吸（仅持续阶段连续深化）
      const breathePhase = smoothstep(0.35, 0.40, t) * (1 - smoothstep(0.60, 0.70, t));
      const breathe = 1 + 0.08 * Math.sin(elapsed * 12) * breathePhase;
      const pillarW = pillarBaseWidth * breathe;

      // 整体强度
      const intensity = fadeIn * fadeOut;

      // --- 光柱 ---
      if (pillarH > 2) {
        drawPillar(ctx, cx, cy, pillarW, pillarH, c, intensity, elapsed);
      }

      // --- 原点核心光球 + 爆发白闪（连续） ---
      const coreVis  = smoothstep(0, 0.12, t);
      const coreFade = 1 - smoothstep(0.70, 1.0, t);
      const burstT   = clamp01((t - 0.12) / 0.23);
      const flash     = (1 - burstT) * smoothstep(0.12, 0.13, t) * (1 - smoothstep(0.34, 0.35, t));
      const coreR     = pillarBaseWidth * (1 + coreVis * 2 + flash * 4);
      const coreAlpha = coreVis * coreFade * 0.45 + flash * 0.9;

      if (coreAlpha > 0.01) {
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        coreGrad.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
        coreGrad.addColorStop(0.3, `rgba(${br},${bg},${bb},${coreAlpha * 0.4})`);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- 冲击波环（触发一次，持续渲染） ---
      if (!ringsSpawned && t > 0.19) {
        ringsSpawned = true;
        rings.push(
          { t0: elapsed, dur: isStrong ? 0.5 : 0.4, maxR: ringMaxR * 0.7 },
          { t0: elapsed + 0.08, dur: isStrong ? 0.7 : 0.55, maxR: ringMaxR },
        );
      }
      for (const ring of rings) {
        const ringElapsed = elapsed - ring.t0;
        if (ringElapsed < 0 || ringElapsed > ring.dur) continue;
        const rt = ringElapsed / ring.dur;
        const ringR = ring.maxR * easeOutExpo(rt);
        const ringAlpha = (1 - rt) * 0.7;
        ctx.globalAlpha = ringAlpha;
        ctx.strokeStyle = `rgba(${mr},${mg},${mb},0.8)`;
        ctx.lineWidth = isStrong ? 2.5 : 1.8;
        ctx.shadowColor = `rgba(${mr},${mg},${mb},0.5)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // --- 粒子（持续阶段生成，连续曲线控制生成率） ---
      const spawnRate = smoothstep(0.30, 0.38, t) * (1 - smoothstep(0.62, 0.68, t));
      if (spawnRate > 0 && Math.random() < spawnRate * (isStrong ? 0.7 : 0.4)) {
        const px = cx + (Math.random() - 0.5) * pillarW * 0.8;
        const py = cy - Math.random() * pillarH * 0.6;
        const rgb = particleColors[Math.floor(Math.random() * particleColors.length)];
        particles.push(createParticle({
          x: px, y: py,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(1 + Math.random() * 3),
          size: 2 + Math.random() * (isStrong ? 4 : 3),
          maxLife: 0.4 + Math.random() * 0.5,
          rgb,
        }));
      }
      updateParticles(particles, dt, RISE_PRESET);
      drawParticles(ctx, particles, RISE_PRESET, cw, ch);

      ctx.globalCompositeOperation = 'source-over';

      // 结束判定
      if (t >= 1 && particles.length === 0) {
        onCompleteRef.current?.();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [color, customColors, isStrong, originY]);

  useEffect(() => {
    if (!active) return;
    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, render]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  );
};