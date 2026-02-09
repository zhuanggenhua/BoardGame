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

/** 升腾粒子预设 */
const RISE_PRESET: ParticlePreset = {
  count: 1,
  speed: { min: 1, max: 3 },
  size: { min: 2, max: 5 },
  life: { min: 0.4, max: 0.8 },
  gravity: -0.5,
  shapes: ['circle'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'top',
  glow: true,
  glowScale: 3,
  drag: 0.98,
  additive: true,
  turbulence: 0.6,
  turbulenceFreq: 2,
  pulse: 0.2,
  pulseFreq: 5,
};

/** 缓动函数 */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
function easeInQuad(t: number): number {
  return t * t;
}

/** 绘制光柱（底部白亮 → 主题色 → 顶部消散，带柔和边缘） */
function drawPillar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  width: number, height: number,
  c: SummonColorSet,
  intensity: number,
) {
  const [mr, mg, mb] = c.main;
  const [sr, sg, sb] = c.sub;
  const halfW = width / 2;
  const top = cy - height;

  // 主体渐变（从底部白亮到顶部透明）
  const grad = ctx.createLinearGradient(cx, cy, cx, top);
  grad.addColorStop(0, `rgba(255,255,255,${0.95 * intensity})`);
  grad.addColorStop(0.08, `rgba(${mr},${mg},${mb},${0.85 * intensity})`);
  grad.addColorStop(0.35, `rgba(${sr},${sg},${sb},${0.5 * intensity})`);
  grad.addColorStop(0.7, `rgba(${sr},${sg},${sb},${0.15 * intensity})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  // 柱体形状：底部宽，顶部略窄（梯形）
  const topW = halfW * 0.6;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy);
  ctx.lineTo(cx - topW, top);
  ctx.lineTo(cx + topW, top);
  ctx.lineTo(cx + halfW, cy);
  ctx.closePath();
  ctx.fill();

  // 柔和边缘辉光
  const edgeGrad = ctx.createLinearGradient(cx, cy, cx, top);
  edgeGrad.addColorStop(0, `rgba(${mr},${mg},${mb},${0.3 * intensity})`);
  edgeGrad.addColorStop(0.5, `rgba(${sr},${sg},${sb},${0.1 * intensity})`);
  edgeGrad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = edgeGrad;
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 1.4, cy);
  ctx.lineTo(cx - topW * 1.3, top);
  ctx.lineTo(cx + topW * 1.3, top);
  ctx.lineTo(cx + halfW * 1.4, cy);
  ctx.closePath();
  ctx.fill();
}

export const SummonEffect: React.FC<SummonEffectProps> = ({
  active,
  intensity = 'normal',
  color = 'blue',
  customColors,
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
    const parentRect = parent.getBoundingClientRect();
    // Canvas 铺满父级，无溢出
    const cw = parentRect.width;
    const ch = parentRect.height;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const c = resolveColors(color, customColors);
    const [mr, mg, mb] = c.main;
    const [sr, sg, sb] = c.sub;
    const [br, bg, bb] = c.bright;

    // 原点：底部居中偏上（留出底部空间给冲击波环）
    const cx = cw / 2;
    const cy = ch * 0.78;

    // 光柱参数 — 基于 canvas 尺寸
    const pillarBaseWidth = isStrong ? cw * 0.08 : cw * 0.06;
    const pillarMaxHeight = ch * 0.7;
    const totalDuration = isStrong ? 1.4 : 1.1;

    // 阶段时间点
    const CHARGE_END = 0.12;
    const BURST_END = 0.35;
    const SUSTAIN_END = 0.65;

    // 粒子池
    const particles: Particle[] = [];
    const particleColors: [number, number, number][] = [
      c.main, c.sub, c.bright, [255, 255, 255],
    ];

    // 冲击波环
    const rings: { t0: number; dur: number; maxR: number }[] = [];
    let ringsSpawned = false;

    // 冲击波环最大半径 — 限制在 canvas 可视范围内
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
      // 阶段 1：蓄力（0 ~ CHARGE_END）— 底部能量聚集
      // ================================================================
      if (t < CHARGE_END) {
        const ct = t / CHARGE_END;
        const chargeR = pillarBaseWidth * (1 + ct * 3);
        const chargeAlpha = ct * 0.6;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, chargeR);
        grad.addColorStop(0, `rgba(255,255,255,${chargeAlpha})`);
        grad.addColorStop(0.4, `rgba(${mr},${mg},${mb},${chargeAlpha * 0.5})`);
        grad.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, chargeR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ================================================================
      // 阶段 2：爆发（CHARGE_END ~ BURST_END）— 光柱快速冲出
      // ================================================================
      if (t >= CHARGE_END && t < BURST_END) {
        const bt = (t - CHARGE_END) / (BURST_END - CHARGE_END);
        const eased = easeOutExpo(bt);
        const overshoot = eased > 0.8 ? 1 + (1 - eased) * 0.15 : eased;
        const pillarH = pillarMaxHeight * overshoot;
        const pillarW = pillarBaseWidth * (0.5 + eased * 0.5);

        drawPillar(ctx, cx, cy, pillarW, pillarH, c, eased);

        // 底部白闪
        const flashAlpha = (1 - bt) * 0.9;
        const flashR = pillarBaseWidth * (2 + bt * 4);
        const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashR);
        flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
        flashGrad.addColorStop(0.3, `rgba(${br},${bg},${bb},${flashAlpha * 0.4})`);
        flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, flashR, 0, Math.PI * 2);
        ctx.fill();

        // 生成冲击波环
        if (!ringsSpawned && bt > 0.3) {
          ringsSpawned = true;
          rings.push(
            { t0: elapsed, dur: isStrong ? 0.5 : 0.4, maxR: ringMaxR * 0.7 },
            { t0: elapsed + 0.08, dur: isStrong ? 0.7 : 0.55, maxR: ringMaxR },
          );
        }
      }

      // ================================================================
      // 阶段 3：持续（BURST_END ~ SUSTAIN_END）— 光柱保持 + 脉冲呼吸
      // ================================================================
      if (t >= BURST_END && t < SUSTAIN_END) {
        const breathe = 1 + Math.sin(elapsed * 12) * 0.08;
        const pillarW = pillarBaseWidth * breathe;
        const pillarH = pillarMaxHeight;

        drawPillar(ctx, cx, cy, pillarW, pillarH, c, 1);

        // 生成升腾粒子
        if (Math.random() < (isStrong ? 0.7 : 0.4)) {
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
      }

      // ================================================================
      // 阶段 4：消散（SUSTAIN_END ~ 1.0）— 光柱从底部收缩 + 淡出
      // ================================================================
      if (t >= SUSTAIN_END) {
        const ft = (t - SUSTAIN_END) / (1 - SUSTAIN_END);
        const fadeEased = easeInQuad(ft);
        const pillarH = pillarMaxHeight * (1 - fadeEased);
        const pillarW = pillarBaseWidth * (1 - fadeEased * 0.5);
        const alpha = 1 - fadeEased;

        if (pillarH > 2) {
          ctx.globalAlpha = alpha;
          drawPillar(ctx, cx, cy - pillarMaxHeight * fadeEased * 0.3, pillarW, pillarH, c, 1);
          ctx.globalAlpha = 1;
        }
      }

      // ================================================================
      // 冲击波环（跨阶段）
      // ================================================================
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

      // ================================================================
      // 粒子更新与绘制（跨阶段）
      // ================================================================
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
  }, [color, customColors, isStrong]);

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