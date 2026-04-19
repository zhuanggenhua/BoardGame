/**
 * SummonHybridEffect — 混合召唤特效（WebGL Shader + Canvas 2D 粒子）
 *
 * 参考游戏王 Master Duel / 炉石传说 / LoR 的召唤特效设计：
 * 底层：WebGL Shader 渲染光柱主体（FBM 噪声纹理 + 暗角遮罩 + 冲击波环 + 颜色梯度）
 * 上层：Canvas 2D 粒子引擎渲染能量粒子（聚拢 → 上升 → 爆发 → 飘散）
 *
 * 三段式动画节奏（Anticipation → Impact → Follow-through）：
 * - 蓄力期(0–0.12)：粒子从四周向原点聚拢，核心光球渐亮
 * - 爆发期(0.12–0.35)：光柱冲天，粒子向外喷射 + 沿柱体上升，冲击波环扩散
 * - 持续期(0.35–0.65)：光柱呼吸脉冲，粒子持续上升，宽度微动
 * - 消散期(0.65–1.0)：光柱收缩，粒子四散飘落，余烬渐隐
 *
 * @example
 * ```tsx
 * <div className="relative" style={{ minHeight: 320 }}>
 *   <SummonHybridEffect active intensity="strong" color="gold" />
 * </div>
 * ```
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SummonShaderEffect } from './SummonShaderEffect';
import type { SummonIntensity, SummonColorTheme, SummonColorSet } from './SummonEffect';
import {
  type Particle,
  createParticle,
  updateParticles,
  drawParticles,
  type ParticlePreset,
} from './canvasParticleEngine';

// ============================================================================
// Props
// ============================================================================

export interface SummonHybridEffectProps {
  active: boolean;
  intensity?: SummonIntensity;
  color?: SummonColorTheme;
  customColors?: SummonColorSet;
  /** 光柱原点 Y 位置（0~1，相对于容器高度从顶部算起，默认 0.78） */
  originY?: number;
  /** 爆发瞬间回调（progress ≈ 0.12，光柱冲天时触发，用于落地震动/音效） */
  onImpact?: () => void;
  onComplete?: () => void;
  className?: string;
}

// ============================================================================
// 颜色预设（RGB 三元组，供粒子使用）
// ============================================================================

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

// ============================================================================
// 粒子预设：俯视角径向扩散（棋盘层特效规范）
// ============================================================================

/** 上升粒子预设 — 沿光柱上升 + 径向微扩散 */
const RISE_PRESET: ParticlePreset = {
  count: 1,
  speed: { min: 1.5, max: 4 },
  size: { min: 2.5, max: 7 },
  life: { min: 0.3, max: 0.8 },
  gravity: 0,
  shapes: ['circle'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none',
  glow: true,
  glowScale: 3.5,
  drag: 0.97,
  additive: true,
  turbulence: 0.8,
  turbulenceFreq: 3,
  pulse: 0.3,
  pulseFreq: 6,
};

/** 爆发粒子预设 — 径向喷射 */
const BURST_PRESET: ParticlePreset = {
  count: 1,
  speed: { min: 3, max: 8 },
  size: { min: 2.5, max: 6 },
  life: { min: 0.3, max: 0.7 },
  gravity: 0,
  shapes: ['circle'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none',
  glow: true,
  glowScale: 3,
  drag: 0.93,
  additive: true,
  turbulence: 0.4,
  turbulenceFreq: 2,
};

/** 余烬粒子预设 — 缓慢飘散 */
const EMBER_PRESET: ParticlePreset = {
  count: 1,
  speed: { min: 0.5, max: 2 },
  size: { min: 2, max: 5 },
  life: { min: 0.5, max: 1.2 },
  gravity: 0,
  shapes: ['circle'],
  rotate: false,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none',
  glow: true,
  glowScale: 2.5,
  drag: 0.96,
  additive: true,
  turbulence: 1.2,
  turbulenceFreq: 1.5,
  pulse: 0.4,
  pulseFreq: 3,
};

// ============================================================================
// 缓动辅助
// ============================================================================

function smoothstep(edge0: number, edge1: number, x: number): number {
  const v = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return v * v * (3 - 2 * v);
}

// ============================================================================
// 粒子层组件（Canvas 2D）
// ============================================================================

interface ParticleLayerProps {
  active: boolean;
  intensity: SummonIntensity;
  colors: SummonColorSet;
  originY: number;
  totalDuration: number;
  onImpact: () => void;
  onAllParticlesDone: () => void;
}

/**
 * 粒子层组件 — 使用 function 声明确保 Vite HMR 正确识别组件边界
 */
function ParticleLayer({ active, intensity, colors, originY, totalDuration, onImpact, onAllParticlesDone }: ParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const onDoneRef = useRef(onAllParticlesDone);
  const onImpactRef = useRef(onImpact);
  useEffect(() => { 
    onDoneRef.current = onAllParticlesDone; 
    onImpactRef.current = onImpact; 
  }, [onAllParticlesDone, onImpact]);

  const isStrong = intensity === 'strong';

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // 使用 offsetWidth/offsetHeight（不受 transform scale 影响）
    const cw = parent.offsetWidth;
    const ch = parent.offsetHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = cw / 2;
    const cy = ch * originY;

    // 粒子颜色池
    const particleColors: [number, number, number][] = [
      colors.main, colors.sub, colors.bright, [255, 255, 255],
    ];

    // 三类粒子池
    const riseParticles: Particle[] = [];
    const burstParticles: Particle[] = [];
    const emberParticles: Particle[] = [];

    // 光柱参数（与 shader 同步）
    const pillarBaseWidth = isStrong ? cw * 0.08 : cw * 0.06;
    const pillarMaxHeight = (1 - originY) * ch * 0.88;

    let startTime = 0;
    let lastTime = 0;
    let shaderDone = false;
    /** 爆发瞬间是否已触发 onImpact（只触发一次） */
    let impactFired = false;

    const loop = (now: number) => {
      if (!startTime) { startTime = now; lastTime = now; }
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(1, elapsed / totalDuration);

      ctx.clearRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'lighter';

      // 光柱高度曲线（与 shader 同步）
      const growT = Math.max(0, Math.min(1, (t - 0.12) / 0.23));
      const pillarGrow = 1 - Math.pow(2, -10 * growT);
      const shrinkT = Math.max(0, Math.min(1, (t - 0.65) / 0.35));
      const pillarShrink = 1 - shrinkT * shrinkT;
      const pillarH = pillarMaxHeight * pillarGrow * pillarShrink;

      // 爆发瞬间触发落地冲击回调（光柱开始冲天时）
      if (!impactFired && t >= 0.12) {
        impactFired = true;
        onImpactRef.current();
      }

      const breathePhase = smoothstep(0.35, 0.40, t) * (1 - smoothstep(0.60, 0.70, t));
      const breathe = 1 + 0.08 * Math.sin(elapsed * 12) * breathePhase;
      const pillarW = pillarBaseWidth * breathe;

      // 每帧最大生成数（控制粒子密度，作为 Shader 的点缀而非主体）
      const maxPerFrame = isStrong ? 2 : 1;

      // ================================================================
      // 阶段 1：蓄力期(0–0.12) — 粒子从四周向原点聚拢
      // ================================================================
      const gatherRate = smoothstep(0, 0.03, t) * (1 - smoothstep(0.10, 0.12, t));
      for (let i = 0; i < maxPerFrame; i++) {
        if (gatherRate > 0 && Math.random() < gatherRate * (isStrong ? 0.5 : 0.35)) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 100;
          const px = cx + Math.cos(angle) * dist;
          const py = cy + Math.sin(angle) * dist;
          const toCenter = Math.atan2(cy - py, cx - px);
          const spd = 3 + Math.random() * 4;
          const rgb = particleColors[Math.floor(Math.random() * particleColors.length)];
          riseParticles.push(createParticle({
            x: px, y: py,
            vx: Math.cos(toCenter) * spd,
            vy: Math.sin(toCenter) * spd,
            size: 2.5 + Math.random() * 4,
            maxLife: 0.25 + Math.random() * 0.25,
            rgb,
          }));
        }
      }

      // ================================================================
      // 阶段 2：爆发期(0.12–0.35) — 径向喷射 + 沿柱体上升
      // ================================================================
      const burstRate = smoothstep(0.12, 0.15, t) * (1 - smoothstep(0.30, 0.35, t));
      // 径向爆发粒子
      for (let i = 0; i < maxPerFrame; i++) {
        if (burstRate > 0 && Math.random() < burstRate * (isStrong ? 0.5 : 0.35)) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 5 + Math.random() * 8;
          const rgb = particleColors[Math.floor(Math.random() * particleColors.length)];
          burstParticles.push(createParticle({
            x: cx + (Math.random() - 0.5) * 14,
            y: cy + (Math.random() - 0.5) * 14,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            size: 2.5 + Math.random() * (isStrong ? 6 : 4),
            maxLife: 0.3 + Math.random() * 0.5,
            rgb,
          }));
        }
      }
      // 沿柱体上升粒子
      const riseRate = smoothstep(0.14, 0.20, t) * (1 - smoothstep(0.60, 0.68, t));
      for (let i = 0; i < maxPerFrame; i++) {
        if (riseRate > 0 && pillarH > 5 && Math.random() < riseRate * (isStrong ? 0.5 : 0.35)) {
          const px = cx + (Math.random() - 0.5) * pillarW * 1.0;
          const py = cy - Math.random() * pillarH * 0.6;
          const rgb = particleColors[Math.floor(Math.random() * particleColors.length)];
          riseParticles.push(createParticle({
            x: px, y: py,
            vx: (Math.random() - 0.5) * 2,
            vy: -(2 + Math.random() * 4),
            size: 2.5 + Math.random() * (isStrong ? 6 : 4),
            maxLife: 0.4 + Math.random() * 0.6,
            rgb,
          }));
        }
      }

      // ================================================================
      // 阶段 3：持续期(0.35–0.65) — 持续上升粒子
      // ================================================================
      const sustainRate = smoothstep(0.35, 0.40, t) * (1 - smoothstep(0.58, 0.65, t));
      for (let i = 0; i < maxPerFrame; i++) {
        if (sustainRate > 0 && pillarH > 5 && Math.random() < sustainRate * (isStrong ? 0.4 : 0.25)) {
          const px = cx + (Math.random() - 0.5) * pillarW * 0.8;
          const py = cy - Math.random() * pillarH * 0.5;
          const rgb = particleColors[Math.floor(Math.random() * particleColors.length)];
          riseParticles.push(createParticle({
            x: px, y: py,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(1.5 + Math.random() * 3),
            size: 2 + Math.random() * 4,
            maxLife: 0.35 + Math.random() * 0.5,
            rgb,
          }));
        }
      }

      // ================================================================
      // 阶段 4：消散期(0.65–1.0) — 余烬四散飘落
      // ================================================================
      const emberRate = smoothstep(0.65, 0.70, t) * (1 - smoothstep(0.88, 0.95, t));
      for (let i = 0; i < maxPerFrame; i++) {
        if (emberRate > 0 && Math.random() < emberRate * (isStrong ? 0.4 : 0.25)) {
          const px = cx + (Math.random() - 0.5) * pillarW * 2;
          const py = cy - Math.random() * pillarH * 0.4;
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.8 + Math.random() * 2.5;
          const rgb = particleColors[Math.floor(Math.random() * particleColors.length)];
          emberParticles.push(createParticle({
            x: px, y: py,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            size: 2 + Math.random() * 4,
            maxLife: 0.5 + Math.random() * 1.0,
            rgb,
          }));
        }
      }

      // 更新 & 绘制所有粒子
      updateParticles(riseParticles, dt, RISE_PRESET);
      updateParticles(burstParticles, dt, BURST_PRESET);
      updateParticles(emberParticles, dt, EMBER_PRESET);

      drawParticles(ctx, riseParticles, RISE_PRESET, cw, ch);
      drawParticles(ctx, burstParticles, BURST_PRESET, cw, ch);
      drawParticles(ctx, emberParticles, EMBER_PRESET, cw, ch);

      ctx.globalCompositeOperation = 'source-over';

      // 结束判定：shader 完成 + 所有粒子消散
      if (t >= 1 && !shaderDone) {
        shaderDone = true;
      }
      const totalParticles = riseParticles.length + burstParticles.length + emberParticles.length;
      if (shaderDone && totalParticles === 0) {
        onDoneRef.current();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [colors, isStrong, originY, totalDuration]);

  useEffect(() => {
    if (!active) return;
    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, render]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
}

// ============================================================================
// CSS 暗角遮罩层（从 shader 中提取，避免全屏像素计算）
// ============================================================================

/**
 * 纯 CSS 实现的径向暗角遮罩，替代 shader 中的 vignette 计算。
 * 使用 radial-gradient 模拟"原点附近亮、边缘暗"的聚光灯效果。
 * opacity 动画曲线与 shader 原始 dimUp/dimDown 一致：
 * - 淡入：0 → 0.25 进度
 * - 保持：0.25 → 0.65 进度
 * - 淡出：0.65 → 1.0 进度
 */
interface DimmingOverlayProps {
  active: boolean;
  dimStrength: number;
  totalDuration: number;
}

function DimmingOverlay({ active, dimStrength, totalDuration }: DimmingOverlayProps) {
  const [opacity, setOpacity] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 动画重置需同步清零避免闪烁
    if (!active) { setOpacity(0); return; }

    let startTime = 0;
    const loop = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(1, elapsed / totalDuration);

      // 与 shader 原始 dimUp/dimDown 曲线一致
      const dimUp = smoothstep(0, 0.25, t);
      const dimDown = 1 - smoothstep(0.65, 1.0, t);
      setOpacity(dimUp * dimDown * dimStrength);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, dimStrength, totalDuration]);

  if (!active) return null;

  // 全屏遮罩：渐变中心固定在视口中央偏下（50% 55%），与地图中心大致对齐
  // 不使用 originY（那是 FX 容器内的相对坐标，受 transform scale 影响）
  const overlay = (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 50,
        opacity,
        background: `radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.92) 100%)`,
      }}
    />
  );

  // 通过 Portal 渲染到 body，脱离 MapContainer 的 transform 上下文
  return createPortal(overlay, document.body);
}

// ============================================================================
// 主组件：CSS 暗角 + Shader 光柱（窄条） + Canvas 粒子
// ============================================================================

export const SummonHybridEffect: React.FC<SummonHybridEffectProps> = ({
  active,
  intensity = 'normal',
  color = 'blue',
  customColors,
  originY = 0.78,
  onImpact,
  onComplete,
  className = '',
}) => {
  const onCompleteRef = useRef(onComplete);
  const onImpactRef = useRef(onImpact);
  useEffect(() => { 
    onCompleteRef.current = onComplete; 
    onImpactRef.current = onImpact; 
  }, [onComplete, onImpact]);

  const isStrong = intensity === 'strong';
  const totalDuration = isStrong ? 1.4 : 1.1;
  // 稳定颜色引用，避免每次渲染重建导致 ParticleLayer 的 RAF 被反复清理重启
  const colors = useMemo(() => resolveColors(color, customColors), [color, customColors]);

  // 两层完成状态追踪
  const shaderDoneRef = useRef(false);
  const particlesDoneRef = useRef(false);

  const tryComplete = useCallback(() => {
    if (shaderDoneRef.current && particlesDoneRef.current) {
      onCompleteRef.current?.();
    }
  }, []);

  const handleShaderComplete = useCallback(() => {
    shaderDoneRef.current = true;
    tryComplete();
  }, [tryComplete]);

  const handleParticlesDone = useCallback(() => {
    particlesDoneRef.current = true;
    tryComplete();
  }, [tryComplete]);

  /** 爆发瞬间：触发落地震动 */
  const handleImpact = useCallback(() => {
    onImpactRef.current?.();
  }, []);

  // 重置完成状态（active 变化时）
  useEffect(() => {
    if (active) {
      shaderDoneRef.current = false;
      particlesDoneRef.current = false;
    }
  }, [active]);

  if (!active) return null;

  // Shader 光柱窄条宽度：光柱本身约 8% 容器宽 + 边缘辉光 1.6x + 冲击波环 ~22% 半径
  // 取 50% 容器宽度足以覆盖所有光柱视觉元素，减少 ~50% 像素计算
  const pillarStripWidth = '50%';

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {/* 底层：CSS 暗角遮罩（零 GPU 开销，替代 shader 全屏 vignette） */}
      <DimmingOverlay
        active={active}
        dimStrength={isStrong ? 0.6 : 0.45}
        totalDuration={totalDuration}
      />
      {/* 中层：WebGL Shader 光柱（窄条渲染，dimStrength=0 跳过 vignette） */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: '50%',
          width: pillarStripWidth,
          transform: 'translateX(-50%)',
          zIndex: 1,
        }}
      >
        <SummonShaderEffect
          active={active}
          intensity={intensity}
          color={color}
          customColors={customColors}
          originY={originY}
          dimStrength={0}
          onComplete={handleShaderComplete}
        />
      </div>
      {/* 上层：Canvas 2D 粒子（聚拢/上升/爆发/余烬） */}
      <ParticleLayer
        active={active}
        intensity={intensity}
        colors={colors}
        originY={originY}
        totalDuration={totalDuration}
        onImpact={handleImpact}
        onAllParticlesDone={handleParticlesDone}
      />
    </div>
  );
};
