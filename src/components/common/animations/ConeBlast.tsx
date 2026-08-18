/**
 * ConeBlast — 远程投射气浪特效（Canvas 2D + 粒子引擎）
 *
 * 模拟弓箭/远程攻击射出时的空气锥形冲击波：
 * - 明亮的头部光球高速从源飞向目标
 * - 身后持续喷射粒子形成自然扩散的锥形尾迹
 * - 柔和的径向渐变锥形气流（非几何线条）
 * - 命中时爆发闪光 + 粒子扩散
 *
 * 基于自研 Canvas 粒子引擎，零 DOM 动画。
 */

import React, { useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { resolveFxDpr, subscribeFxFrame, type FxQuality } from '../../../engine/fx';
import {
  type Particle,
  type ParticlePreset,
  createParticle,
  parseColorToRgb,
  spawnParticles,
  updateParticles,
  drawParticles,
} from './canvasParticleEngine';

export interface ConeBlastProps {
  /** 源点（百分比坐标） */
  start: { xPct: number; yPct: number };
  /** 目标点（百分比坐标） */
  end: { xPct: number; yPct: number };
  /** 强度 */
  intensity?: 'normal' | 'strong';
  /** 低成本模式：保留飞行和命中感，减少移动端最重的全屏粒子绘制 */
  quality?: FxQuality;
  /** 飞行时长倍率；默认 1，供棋盘距离短但需要截运行时过程帧的游戏调长 */
  durationScale?: number;
  /** 明确飞行时长；设置后优先于 durationScale，适合需要让命中回调和投射物到达严格对齐的游戏 */
  durationMs?: number;
  /** 飞行进度曲线；棋盘子弹默认应可配置为 linear，避免接近目标时明显刹车 */
  motionEasing?: 'ease-out' | 'linear';
  /** 语义颜色，复用通用投射物算法，只改变粒子和辉光色 */
  color?: string[];
  /** 保留兼容 */
  showProjectile?: boolean;
  /** 完成回调 */
  onComplete?: () => void;
  className?: string;
}

// ============================================================================
// 尾迹粒子预设（streak 为主，模拟气流丝线）
// ============================================================================

const TRAIL_PRESET: ParticlePreset = {
  count: 1, // 每次 spawn 1 个，由循环控制频率
  speed: { min: 0.5, max: 2 },
  size: { min: 1.5, max: 4 },
  life: { min: 0.15, max: 0.35 },
  gravity: 0,
  shapes: ['streak', 'circle'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none',
  glow: true,
  glowScale: 2.5,
  drag: 0.92,
  additive: true,
  spread: 2,
  streakRatio: 3,
  colorEnd: '#1e3a5f',
};

// 命中爆发预设
const IMPACT_PRESET: ParticlePreset = {
  count: 16,
  speed: { min: 2, max: 5 },
  size: { min: 2, max: 4 },
  life: { min: 0.2, max: 0.5 },
  gravity: 0,
  shapes: ['circle', 'streak'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none',
  glow: true,
  glowScale: 3,
  drag: 0.95,
  additive: true,
  spread: 6,
  streakRatio: 2.5,
  colorEnd: '#0c2340',
};

const TRAIL_COLORS: [number, number, number][] = [
  [180, 220, 255],
  [200, 235, 255],
  [150, 200, 255],
  [220, 240, 255],
];

const IMPACT_COLORS: [number, number, number][] = [
  [200, 230, 255],
  [255, 255, 255],
  [150, 200, 255],
  [180, 215, 255],
];

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

export const ConeBlast: React.FC<ConeBlastProps> = ({
  start,
  end,
  intensity = 'normal',
  quality = 'full',
  durationScale = 1,
  durationMs,
  motionEasing = 'ease-out',
  color,
  onComplete,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const isStrong = intensity === 'strong';
  const isReduced = quality === 'reduced';
  const colorKey = color?.join('|') ?? '';
  const colorValues = useMemo(() => (colorKey ? colorKey.split('|') : []), [colorKey]);
  const trailColors = useMemo<[number, number, number][]>(() => (
    colorValues.length > 0 ? colorValues.map(parseColorToRgb) : TRAIL_COLORS
  ), [colorValues]);
  const impactColors = useMemo<[number, number, number][]>(() => (
    colorValues.length > 0 ? [[255, 255, 255], ...colorValues.map(parseColorToRgb)] : IMPACT_COLORS
  ), [colorValues]);
  const trailColorEnd = colorValues.length > 0 ? colorValues[colorValues.length - 1] : TRAIL_PRESET.colorEnd;
  const glowPrimary = trailColors[0] ?? TRAIL_COLORS[0];
  const glowSecondary = trailColors[1] ?? trailColors[0] ?? TRAIL_COLORS[1];

  // 解构坐标值，避免对象引用变化导致 useCallback 重建
  const { xPct: sx0, yPct: sy0 } = start;
  const { xPct: ex0, yPct: ey0 } = end;

  const render = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = resolveFxDpr({ quality, maxDpr: 1.5, reducedMaxDpr: 1 });
    // 使用 offsetWidth/offsetHeight 获取 CSS 布局尺寸（不受父级 transform scale 影响）
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 像素坐标
    const sx = (sx0 / 100) * cw;
    const sy = (sy0 / 100) * ch;
    const ex = (ex0 / 100) * cw;
    const ey = (ey0 / 100) * ch;
    const dx = ex - sx;
    const dy = ey - sy;
    const totalDist = Math.sqrt(dx * dx + dy * dy);
    if (totalDist < 1) { onCompleteRef.current?.(); return; }

    const dirX = dx / totalDist;
    const dirY = dy / totalDist;
    const perpX = -dirY;
    const perpY = dirX;

    // 飞行时长（距离自适应）
    const distPct = Math.sqrt(
      (ex0 - sx0) ** 2 + (ey0 - sy0) ** 2,
    );
    const flightDuration = durationMs !== undefined
      ? Math.max(0.15, durationMs / 1000)
      : Math.max(0.15, Math.min(0.5, distPct / 180)) * Math.max(0.25, durationScale);

    // 视觉缩放因子：基于飞行像素距离，让特效大小与格子间距成比例
    // 参考基准：totalDist ~250px 时 scale=1（原始设计值），再乘 3 倍放大
    const vScale = Math.min(isReduced ? 2.25 : 3.4, Math.max(0.8, totalDist / 250) * (isReduced ? 1.6 : 2.2));

    // 头部参数（基于 vScale 缩放）
    const headRadius = (isStrong ? 5 : 3.5) * vScale;
    const glowRadius = (isStrong ? 22 : 16) * vScale;

    // 尾迹粒子池
    const trailParticles: Particle[] = [];
    // 每帧喷射数量
    const spawnPerFrame = isReduced ? (isStrong ? 2 : 1) : (isStrong ? 3 : 2);

    // 命中粒子池
    const impactParticles: Particle[] = [];
    const impactPreset: ParticlePreset = {
      ...IMPACT_PRESET,
      count: isReduced ? (isStrong ? 10 : 6) : (isStrong ? 16 : 10),
      speed: { min: IMPACT_PRESET.speed.min * vScale, max: IMPACT_PRESET.speed.max * vScale },
      size: { min: IMPACT_PRESET.size.min * vScale, max: IMPACT_PRESET.size.max * vScale },
      spread: (IMPACT_PRESET.spread ?? 6) * vScale,
      colorEnd: trailColorEnd,
    };

    // 命中阶段
    const hitDuration = isReduced ? 0.18 : 0.24;
    let hitPhase = false;
    let hitTime = 0;
    let impactSpawned = false;

    let startTime = 0;
    let lastTime = 0;
    // subscribeFxFrame may synchronously touch the callback in tests, so keep this mutable handle.
    // eslint-disable-next-line prefer-const
    let unsubscribeFrame: (() => void) | undefined;

    const loop = (now: number) => {
      if (!startTime) { startTime = now; lastTime = now; }
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      ctx.clearRect(0, 0, cw, ch);

      if (!hitPhase) {
        const t = Math.min(1, elapsed / flightDuration);
        const eased = motionEasing === 'linear'
          ? t
          : 1 - Math.pow(1 - t, 2.5);

        // 头部位置
        const hx = sx + dx * eased;
        const hy = sy + dy * eased;
        const flown = totalDist * eased;

        // ---- 喷射尾迹粒子 ----
        for (let i = 0; i < spawnPerFrame; i++) {
          // 粒子从头部位置生成，速度方向为反向 + 横向扩散
          const spreadAngle = (Math.random() - 0.5) * (isStrong ? 1.0 : 0.7);
          const backSpeed = (1 + Math.random() * 3) * vScale;
          const vx = (-dirX * backSpeed + perpX * Math.sin(spreadAngle) * 2 * vScale) * (0.7 + Math.random() * 0.6);
          const vy = (-dirY * backSpeed + perpY * Math.sin(spreadAngle) * 2 * vScale) * (0.7 + Math.random() * 0.6);
          const size = ((isStrong ? 2 : 1.5) + Math.random() * (isStrong ? 3 : 2)) * vScale;
          const life = 0.12 + Math.random() * 0.25;
          const rgb = trailColors[Math.floor(Math.random() * trailColors.length)];

          trailParticles.push(createParticle({
            x: hx + (Math.random() - 0.5) * 4 * vScale,
            y: hy + (Math.random() - 0.5) * 4 * vScale,
            vx, vy,
            maxLife: life,
            size,
            rgb,
            shape: Math.random() < 0.6 ? 'streak' : 'circle',
            colorEnd: trailColorEnd,
          }));
        }

        // 更新尾迹粒子
        updateParticles(trailParticles, dt, TRAIL_PRESET);

        ctx.globalCompositeOperation = 'lighter';

        // ---- 柔和锥形渐变（头部后方的扩散光晕） ----
        const coneLen = Math.min(flown, isStrong ? totalDist * 0.34 : totalDist * 0.26);
        if (!isReduced && coneLen > 5) {
          // 锥形尾部中心
          const tailX = hx - dirX * coneLen;
          const tailY = hy - dirY * coneLen;
          // 锥形中点
          const midX = (hx + tailX) / 2;
          const midY = (hy + tailY) / 2;
          // 锥形宽度（尾部最宽）
          const coneWidth = coneLen * (isStrong ? 0.22 : 0.16);

          // 用椭圆渐变模拟锥形气流
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(Math.atan2(dirY, dirX));

          const grad = ctx.createRadialGradient(
            coneLen * 0.2, 0, 0,  // 偏向头部的中心
            0, 0, coneLen * 0.6,
          );
          grad.addColorStop(0, rgba(glowPrimary, isStrong ? 0.2 : 0.13));
          grad.addColorStop(0.4, rgba(glowSecondary, isStrong ? 0.1 : 0.06));
          grad.addColorStop(1, rgba(glowSecondary, 0));

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, 0, coneLen * 0.55, coneWidth, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ---- 绘制尾迹粒子 ----
        drawParticles(ctx, trailParticles, TRAIL_PRESET, cw, ch);

        // ---- 头部光球 ----
        // 外层辉光
        ctx.globalAlpha = 0.5;
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, glowRadius);
        glow.addColorStop(0, rgba(glowPrimary, 0.72));
        glow.addColorStop(0.3, rgba(glowSecondary, 0.28));
        glow.addColorStop(1, rgba(glowSecondary, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(hx, hy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 核心（沿飞行方向拉伸的椭圆）
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#fff';
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(Math.atan2(dirY, dirX));
        ctx.beginPath();
        ctx.ellipse(0, 0, headRadius * 2, headRadius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        if (t >= 1) {
          hitPhase = true;
          hitTime = now;
          return;
        }
      }

      // ---- 命中阶段 ----
      if (hitPhase) {
        const hitElapsed = (now - hitTime) / 1000;
        const hitT = Math.min(1, hitElapsed / hitDuration);

        // 生成命中爆发粒子（仅一次）
        if (!impactSpawned) {
          impactSpawned = true;
          const spawned = spawnParticles(impactPreset, impactColors, ex, ey);
          impactParticles.push(...spawned);
        }

        // 更新残留尾迹粒子 + 命中粒子
        updateParticles(trailParticles, dt, TRAIL_PRESET);
        updateParticles(impactParticles, dt, impactPreset);

        ctx.globalCompositeOperation = 'lighter';

        // 绘制残留尾迹
        drawParticles(ctx, trailParticles, TRAIL_PRESET, cw, ch);
        // 绘制命中粒子
        drawParticles(ctx, impactParticles, impactPreset, cw, ch);

        // 命中闪光
        const flashR = ((isStrong ? 25 : 18) * (0.3 + hitT * 0.7)) * vScale;
        const flashAlpha = (1 - hitT * hitT) * 0.7;
        const flashGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, flashR);
        flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
        flashGrad.addColorStop(0.4, rgba(glowPrimary, flashAlpha * 0.35));
        flashGrad.addColorStop(1, rgba(glowSecondary, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, flashR, 0, Math.PI * 2);
        ctx.fill();

        // 扩散环
        const ringR = ((isStrong ? 30 : 22) * (0.3 + hitT * 1.5)) * vScale;
        ctx.globalAlpha = (1 - hitT) * 0.5;
        ctx.strokeStyle = rgba(glowPrimary, 0.65);
        ctx.lineWidth = (isStrong ? 2 : 1.5) * vScale;
        ctx.beginPath();
        ctx.arc(ex, ey, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        const allDead = trailParticles.length === 0 && impactParticles.length === 0;
        if (hitT >= 1 && allDead) {
          unsubscribeFrame?.();
          onCompleteRef.current?.();
          return;
        }
      }
    };

    unsubscribeFrame = subscribeFxFrame(({ now }) => loop(now));
    return () => unsubscribeFrame?.();
  }, [sx0, sy0, ex0, ey0, isReduced, isStrong, quality, durationScale, durationMs, motionEasing, trailColors, impactColors, trailColorEnd, glowPrimary, glowSecondary]);

  useEffect(() => {
    const cleanupFrame = render();
    return () => cleanupFrame?.();
  }, [render]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
};
