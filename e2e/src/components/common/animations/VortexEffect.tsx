/**
 * VortexEffect — 旋涡充能特效（Canvas 2D 径向扭曲纹理）
 *
 * 用于单位充能等能量汇聚场景。
 * 多层云雾纹理以不同角速度旋转 + 收缩，叠加产生流体旋涡感。
 * 三阶段动画：旋涡成型并向心吸入 → 中心能量脉冲爆发 → 柔和消散。
 *
 * 技术原理（参考 UE Material Panning / Unity VFX Texture Sheet）：
 * - 预渲染 2-3 张有机云雾纹理到 OffscreenCanvas（随机椭圆叠加生成）
 * - 每帧 drawImage + rotate/scale，不同层以不同角速度旋转
 * - additive 混合使重叠区域自然增亮，形成连续旋臂而非离散粒子
 * - 径向渐变遮罩剪裁出圆形边界，避免方形纹理穿帮
 *
 * @example
 * ```tsx
 * <div className="relative" style={{ minHeight: 120 }}>
 *   <VortexEffect active intensity="normal" />
 * </div>
 * ```
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  type Particle,
  createParticle,
  updateParticles,
  drawParticles,
  type ParticlePreset,
} from './canvasParticleEngine';

// ============================================================================
// 类型
// ============================================================================

export type VortexIntensity = 'normal' | 'strong';
export type VortexColorTheme = 'blue' | 'purple' | 'green' | 'custom';

export interface VortexEffectProps {
  active: boolean;
  intensity?: VortexIntensity;
  /** 颜色主题，默认 blue（与充能球 bg-blue-400 一致） */
  color?: VortexColorTheme;
  customColors?: VortexColorSet;
  onComplete?: () => void;
  className?: string;
}

export interface VortexColorSet {
  main: [number, number, number];
  sub: [number, number, number];
  bright: [number, number, number];
}

// ============================================================================
// 颜色预设
// ============================================================================

const COLOR_PRESETS: Record<'blue' | 'purple' | 'green', VortexColorSet> = {
  blue: {
    main: [96, 165, 250],    // blue-400
    sub: [59, 130, 246],     // blue-500
    bright: [191, 219, 254], // blue-200
  },
  purple: {
    main: [168, 85, 247],
    sub: [124, 58, 237],
    bright: [232, 200, 255],
  },
  green: {
    main: [74, 222, 128],
    sub: [34, 197, 94],
    bright: [200, 255, 220],
  },
};

function resolveColors(color: VortexColorTheme, custom?: VortexColorSet): VortexColorSet {
  if (color === 'custom' && custom) return custom;
  return COLOR_PRESETS[color === 'custom' ? 'blue' : color];
}

// ============================================================================
// 云雾纹理生成（OffscreenCanvas 预渲染）
// ============================================================================

/** 纹理尺寸（正方形） */
const TEX_SIZE = 128;

/**
 * 生成一张有机云雾纹理：随机椭圆叠加 + 径向渐变，
 * 产生不均匀的密度分布，旋转后自然形成旋臂。
 */
function generateCloudTexture(
  rgb: [number, number, number],
  seed: number,
): HTMLCanvasElement | OffscreenCanvas {
  const size = TEX_SIZE;
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : (() => { const c = document.createElement('canvas'); c.width = size; c.height = size; return c; })();
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) return canvas;

  const [r, g, b] = rgb;
  const cx = size / 2;
  const cy = size / 2;

  // 伪随机（确定性，同 seed 同结果）
  let s = seed | 0 || 1;
  const rng = () => { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 2147483647; };

  // 叠加随机椭圆斑块
  const blobCount = 18 + (rng() * 12) | 0;
  for (let i = 0; i < blobCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * size * 0.35;
    const bx = cx + Math.cos(angle) * dist;
    const by = cy + Math.sin(angle) * dist;
    const rx = 8 + rng() * 24;
    const ry = 6 + rng() * 18;
    const rot = rng() * Math.PI;
    const alpha = 0.06 + rng() * 0.12;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 圆形遮罩（径向衰减，避免方形边缘）
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.7, 'rgba(255,255,255,0.8)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
}

// ============================================================================
// 爆发粒子预设（脉冲阶段散射）
// ============================================================================

const BURST_PRESET: ParticlePreset = {
  count: 1,
  speed: { min: 1.5, max: 4 },
  size: { min: 1.5, max: 4 },
  life: { min: 0.25, max: 0.5 },
  gravity: 0,
  shapes: ['circle'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none',
  glow: true,
  glowScale: 2.5,
  drag: 0.95,
  additive: true,
  turbulence: 0.5,
  turbulenceFreq: 3,
};

// ============================================================================
// 缓动
// ============================================================================

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
function easeInQuad(t: number): number {
  return t * t;
}
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ============================================================================
// 旋涡层配置
// ============================================================================

/** 每层云雾的参数 */
interface VortexLayer {
  texture: HTMLCanvasElement | OffscreenCanvas;
  /** 角速度（弧度/秒），正=逆时针 */
  angularSpeed: number;
  /** 初始缩放 */
  baseScale: number;
  /** 基础透明度 */
  baseAlpha: number;
}

// ============================================================================
// 组件
// ============================================================================

export const VortexEffect: React.FC<VortexEffectProps> = ({
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
    const cw = parent.offsetWidth;
    const ch = parent.offsetHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const c = resolveColors(color, customColors);
    const [mr, mg, mb] = c.main;
    const [, , ] = c.sub;
    const [br, bg, bb] = c.bright;

    const centerX = cw / 2;
    const centerY = ch / 2;
    const maxRadius = Math.min(cw, ch) * 0.38;
    const totalDuration = isStrong ? 1.1 : 0.85;
    const layerCount = isStrong ? 4 : 3;

    // 阶段时间占比
    const GATHER_END = 0.55;
    const PULSE_END = 0.78;

    // 预渲染云雾纹理层（不同 seed → 不同斑纹）
    const layers: VortexLayer[] = [];
    const colorVariants: [number, number, number][] = [c.main, c.sub, c.bright];
    for (let i = 0; i < layerCount; i++) {
      const layerColor = colorVariants[i % colorVariants.length];
      layers.push({
        texture: generateCloudTexture(layerColor, 7919 + i * 1301),
        angularSpeed: (2.5 + i * 1.8) * (i % 2 === 0 ? 1 : -0.7), // 交替方向
        baseScale: 1.0 - i * 0.08,
        baseAlpha: 0.7 - i * 0.1,
      });
    }

    // 爆发粒子池
    const burstParticles: Particle[] = [];
    let burstSpawned = false;
    const burstColors: [number, number, number][] = [c.main, c.sub, c.bright, [255, 255, 255]];

    let startTime = 0;
    let lastTime = 0;

    const loop = (now: number) => {
      if (!startTime) { startTime = now; lastTime = now; }
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(1, elapsed / totalDuration);

      ctx.clearRect(0, 0, cw, ch);

      // ==============================================================
      // 阶段 1：旋涡成型 + 向心吸入（0 ~ GATHER_END）
      // ==============================================================
      if (t < GATHER_END) {
        const gt = t / GATHER_END;
        const eased = easeOutQuad(gt);

        // 整体透明度：淡入
        const masterAlpha = Math.min(1, gt * 2.5);
        // 向心收缩：1.0 → 0.35
        const shrink = 1.0 - eased * 0.65;

        ctx.globalCompositeOperation = 'lighter';

        for (const layer of layers) {
          const angle = elapsed * layer.angularSpeed;
          const scale = layer.baseScale * shrink * (maxRadius * 2 / TEX_SIZE);
          const alpha = layer.baseAlpha * masterAlpha;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(centerX, centerY);
          ctx.rotate(angle);
          ctx.scale(scale, scale);
          ctx.drawImage(
            layer.texture as CanvasImageSource,
            -TEX_SIZE / 2, -TEX_SIZE / 2,
          );
          ctx.restore();
        }

        // 中心辉光
        const coreAlpha = eased * 0.5;
        const coreR = maxRadius * 0.2 * (0.4 + eased * 0.6);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreR);
        coreGrad.addColorStop(0, `rgba(${br},${bg},${bb},${coreAlpha})`);
        coreGrad.addColorStop(0.5, `rgba(${mr},${mg},${mb},${coreAlpha * 0.35})`);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ==============================================================
      // 阶段 2：脉冲爆发（GATHER_END ~ PULSE_END）
      // 旋涡急速收缩 + 白闪 + 环状冲击波 + 散射粒子
      // ==============================================================
      if (t >= GATHER_END && t < PULSE_END) {
        const pt = (t - GATHER_END) / (PULSE_END - GATHER_END);
        const pulseEased = easeOutExpo(pt);

        // 残留旋涡层（急速缩小+淡出）
        const residualAlpha = (1 - pt) * 0.5;
        const residualShrink = 0.35 * (1 - pt * 0.8);
        ctx.globalCompositeOperation = 'lighter';
        for (const layer of layers) {
          const angle = elapsed * layer.angularSpeed;
          const scale = layer.baseScale * residualShrink * (maxRadius * 2 / TEX_SIZE);
          ctx.save();
          ctx.globalAlpha = residualAlpha * layer.baseAlpha;
          ctx.translate(centerX, centerY);
          ctx.rotate(angle);
          ctx.scale(scale, scale);
          ctx.drawImage(layer.texture as CanvasImageSource, -TEX_SIZE / 2, -TEX_SIZE / 2);
          ctx.restore();
        }

        // 白闪
        const flashAlpha = (1 - pt) * 0.9;
        const flashR = maxRadius * 0.15 * (1 + pulseEased * 3);
        ctx.globalAlpha = 1;
        const flashGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, flashR);
        flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
        flashGrad.addColorStop(0.3, `rgba(${br},${bg},${bb},${flashAlpha * 0.5})`);
        flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, flashR, 0, Math.PI * 2);
        ctx.fill();

        // 冲击波环
        const ringR = maxRadius * 0.5 * pulseEased;
        const ringAlpha = (1 - pt) * 0.6;
        ctx.globalAlpha = ringAlpha;
        ctx.strokeStyle = `rgba(${mr},${mg},${mb},0.8)`;
        ctx.lineWidth = isStrong ? 2.5 : 1.8;
        ctx.shadowColor = `rgba(${mr},${mg},${mb},0.5)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 散射粒子（一次性）
        if (!burstSpawned) {
          burstSpawned = true;
          const count = isStrong ? 22 : 14;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3.5;
            const rgb = burstColors[Math.floor(Math.random() * burstColors.length)];
            burstParticles.push(createParticle({
              x: centerX + Math.cos(angle) * 3,
              y: centerY + Math.sin(angle) * 3,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: 1.5 + Math.random() * (isStrong ? 3.5 : 2.5),
              maxLife: 0.25 + Math.random() * 0.35,
              rgb,
            }));
          }
        }
      }

      // ==============================================================
      // 阶段 3：消散（PULSE_END ~ 1.0）
      // 中心余辉淡出
      // ==============================================================
      if (t >= PULSE_END) {
        const ft = (t - PULSE_END) / (1 - PULSE_END);
        const fadeAlpha = (1 - easeInQuad(ft)) * 0.45;
        const fadeR = maxRadius * 0.12;

        if (fadeAlpha > 0.01) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1;
          const fadeGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, fadeR);
          fadeGrad.addColorStop(0, `rgba(${br},${bg},${bb},${fadeAlpha})`);
          fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = fadeGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, fadeR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ==============================================================
      // 散射粒子（全程更新绘制）
      // ==============================================================
      if (burstParticles.length > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        updateParticles(burstParticles, dt, BURST_PRESET);
        drawParticles(ctx, burstParticles, BURST_PRESET, cw, ch);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // 结束判定
      if (t >= 1 && burstParticles.length === 0) {
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
