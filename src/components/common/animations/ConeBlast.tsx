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

import React, { useEffect, useRef, useCallback } from 'react';
import {
  type Particle,
  type ParticlePreset,
  createParticle,
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

export const ConeBlast: React.FC<ConeBlastProps> = ({
  start,
  end,
  intensity = 'normal',
  onComplete,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isStrong = intensity === 'strong';

  const render = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 像素坐标
    const sx = (start.xPct / 100) * cw;
    const sy = (start.yPct / 100) * ch;
    const ex = (end.xPct / 100) * cw;
    const ey = (end.yPct / 100) * ch;
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
      (end.xPct - start.xPct) ** 2 + (end.yPct - start.yPct) ** 2,
    );
    const flightDuration = Math.max(0.15, Math.min(0.5, distPct / 180));

    // 头部参数
    const headRadius = isStrong ? 5 : 3.5;
    const glowRadius = isStrong ? 22 : 16;

    // 尾迹粒子池
    const trailParticles: Particle[] = [];
    // 每帧喷射数量
    const spawnPerFrame = isStrong ? 5 : 3;

    // 命中粒子池
    const impactParticles: Particle[] = [];
    const impactPreset: ParticlePreset = {
      ...IMPACT_PRESET,
      count: isStrong ? 24 : 16,
    };

    // 命中阶段
    const hitDuration = 0.3;
    let hitPhase = false;
    let hitTime = 0;
    let impactSpawned = false;

    let startTime = 0;
    let lastTime = 0;

    const loop = (now: number) => {
      if (!startTime) { startTime = now; lastTime = now; }
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      ctx.clearRect(0, 0, cw, ch);

      if (!hitPhase) {
        const t = Math.min(1, elapsed / flightDuration);
        // 缓动：快速启动 → 略减速到达
        const eased = 1 - Math.pow(1 - t, 2.5);

        // 头部位置
        const hx = sx + dx * eased;
        const hy = sy + dy * eased;
        const flown = totalDist * eased;

        // ---- 喷射尾迹粒子 ----
        for (let i = 0; i < spawnPerFrame; i++) {
          // 粒子从头部位置生成，速度方向为反向 + 横向扩散
          const spreadAngle = (Math.random() - 0.5) * (isStrong ? 1.2 : 0.8);
          const backSpeed = 1 + Math.random() * 3;
          const vx = (-dirX * backSpeed + perpX * Math.sin(spreadAngle) * 2) * (0.7 + Math.random() * 0.6);
          const vy = (-dirY * backSpeed + perpY * Math.sin(spreadAngle) * 2) * (0.7 + Math.random() * 0.6);
          const size = (isStrong ? 2 : 1.5) + Math.random() * (isStrong ? 3 : 2);
          const life = 0.12 + Math.random() * 0.25;
          const rgb = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];

          trailParticles.push(createParticle({
            x: hx + (Math.random() - 0.5) * 4,
            y: hy + (Math.random() - 0.5) * 4,
            vx, vy,
            maxLife: life,
            size,
            rgb,
            shape: Math.random() < 0.6 ? 'streak' : 'circle',
            colorEnd: '#1e3a5f',
          }));
        }

        // 更新尾迹粒子
        updateParticles(trailParticles, dt, TRAIL_PRESET);

        ctx.globalCompositeOperation = 'lighter';

        // ---- 柔和锥形渐变（头部后方的扩散光晕） ----
        const coneLen = Math.min(flown, isStrong ? totalDist * 0.4 : totalDist * 0.3);
        if (coneLen > 5) {
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
          grad.addColorStop(0, `rgba(200,230,255,${isStrong ? 0.18 : 0.12})`);
          grad.addColorStop(0.4, `rgba(170,210,255,${isStrong ? 0.08 : 0.05})`);
          grad.addColorStop(1, 'rgba(150,200,255,0)');

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
        glow.addColorStop(0, 'rgba(220,240,255,0.6)');
        glow.addColorStop(0.3, 'rgba(180,215,255,0.2)');
        glow.addColorStop(1, 'rgba(150,195,255,0)');
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
        } else {
          rafRef.current = requestAnimationFrame(loop);
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
          const spawned = spawnParticles(impactPreset, IMPACT_COLORS, ex, ey);
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
        const flashR = (isStrong ? 25 : 18) * (0.3 + hitT * 0.7);
        const flashAlpha = (1 - hitT * hitT) * 0.7;
        const flashGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, flashR);
        flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
        flashGrad.addColorStop(0.4, `rgba(200,230,255,${flashAlpha * 0.3})`);
        flashGrad.addColorStop(1, 'rgba(150,200,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, flashR, 0, Math.PI * 2);
        ctx.fill();

        // 扩散环
        const ringR = (isStrong ? 30 : 22) * (0.3 + hitT * 1.5);
        ctx.globalAlpha = (1 - hitT) * 0.5;
        ctx.strokeStyle = 'rgba(200,230,255,0.6)';
        ctx.lineWidth = isStrong ? 2 : 1.5;
        ctx.beginPath();
        ctx.arc(ex, ey, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        const allDead = trailParticles.length === 0 && impactParticles.length === 0;
        if (hitT >= 1 && allDead) {
          onCompleteRef.current?.();
          return;
        }
        // 即使 hitT >= 1 也继续渲染直到粒子消散
        if (hitT >= 1 && !allDead) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [start, end, isStrong]);

  useEffect(() => {
    render();
    return () => cancelAnimationFrame(rafRef.current);
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
