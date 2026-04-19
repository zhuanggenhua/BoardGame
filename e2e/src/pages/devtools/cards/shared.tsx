/**
 * 特效预览 — 共享组件与 Hook
 *
 * 包含所有预览卡片复用的 UI 组件、性能监济 Hook、触发工具。
 */
/* eslint-disable react-refresh/only-export-components -- devtools shared hooks + components */

import React, { useState, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { getOptimizedImageUrls, getLocalizedAssetPath } from '../../../core/AssetLoader';
import { getSpriteAtlasStyle, CARDS_ATLAS } from '../../../games/summonerwars/ui/cardAtlas';

// ============================================================================
// 性能计数器
// ============================================================================

export interface PerfStats {
  fps: number;
  frameTime: number;
  avgFrameTime: number;
  maxFrameTime: number;
  particles: number;
  isRunning: boolean;
}

/** 轻量级每卡片性能计数器（用 ref 累积，减少 setState 频率） */
export function usePerfCounter(): {
  stats: PerfStats;
  startMeasure: () => () => void;
  stopMeasure: () => void;
  setParticles: (n: number) => void;
} {
  const [stats, setStats] = useState<PerfStats>({
    fps: 0, frameTime: 0, avgFrameTime: 0, maxFrameTime: 0, particles: 0, isRunning: false,
  });
  const rafRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);

  const startMeasure = useCallback(() => {
    // 先停止上一次测量，防止多个 rAF 循环并行
    stopRef.current?.();

    const frameTimes: number[] = [];
    const allFrameTimes: number[] = [];
    let maxFt = 0;
    let lastTime = performance.now();
    let running = true;

    setStats(s => ({ ...s, isRunning: true, avgFrameTime: 0, maxFrameTime: 0 }));

    const tick = () => {
      if (!running) return;
      const now = performance.now();
      const ft = now - lastTime;
      lastTime = now;
      frameTimes.push(ft);
      allFrameTimes.push(ft);
      if (ft > maxFt) maxFt = ft;

      if (frameTimes.length >= 15) {
        const batchAvg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const totalAvg = allFrameTimes.reduce((a, b) => a + b, 0) / allFrameTimes.length;
        setStats(s => ({
          ...s,
          fps: Math.round(1000 / batchAvg),
          frameTime: +batchAvg.toFixed(1),
          avgFrameTime: +totalAvg.toFixed(1),
          maxFrameTime: +maxFt.toFixed(1),
          isRunning: true,
        }));
        frameTimes.length = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const stop = () => {
      if (!running) return; // 防止重复 stop
      running = false;
      cancelAnimationFrame(rafRef.current);
      stopRef.current = null;
      const totalAvg = allFrameTimes.length > 0
        ? allFrameTimes.reduce((a, b) => a + b, 0) / allFrameTimes.length : 0;
      setStats(s => ({
        ...s, isRunning: false,
        avgFrameTime: +totalAvg.toFixed(1),
        maxFrameTime: +maxFt.toFixed(1),
      }));
    };
    stopRef.current = stop;
    return stop;
  }, []);

  const stopMeasure = useCallback(() => {
    stopRef.current?.();
  }, []);

  const setParticles = useCallback((n: number) => {
    setStats(s => ({ ...s, particles: n }));
  }, []);

  return { stats, startMeasure, stopMeasure, setParticles };
}

// ============================================================================
// useEffectTrigger — 通用触发 Hook
// ============================================================================

/**
 * 封装特效预览的通用 active/trigger/reset/perf 逻辑。
 * 卡片只需关注额外状态（color、damage 等）和 renderEffect。
 */
export function useEffectTrigger(perfDurationMs = 1500) {
  const [active, setActive] = useState(false);
  const timerRef = useRef<number>(0);
  const { stats, startMeasure, stopMeasure } = usePerfCounter();

  /** 触发特效：reset → rAF → active + 启动性能测量 */
  const fire = useCallback(() => {
    setActive(false);
    window.clearTimeout(timerRef.current);
    requestAnimationFrame(() => setActive(true));
    const stop = startMeasure();
    timerRef.current = window.setTimeout(stop, perfDurationMs);
  }, [startMeasure, perfDurationMs]);

  /** 手动重置（用于 onComplete 回调） */
  const reset = useCallback(() => {
    setActive(false);
    window.clearTimeout(timerRef.current);
    stopMeasure();
  }, [stopMeasure]);

  return { active, setActive, fire, reset, stats, startMeasure };
}

// ============================================================================
// 通用 UI 组件
// ============================================================================

/** 图标组件类型（Lucide 风格） */
export type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

export const TriggerButton: React.FC<{
  label: string;
  onClick: () => void;
  color?: string;
}> = ({ label, onClick, color = 'bg-indigo-600 hover:bg-indigo-500' }) => (
  <button
    onClick={onClick}
    className={`cursor-pointer px-3 py-1.5 rounded text-xs font-bold text-white transition-[background-color] ${color}`}
  >
    {label}
  </button>
);

export const PerfBar: React.FC<{ stats: PerfStats }> = ({ stats }) => {
  const fpsColor = !stats.isRunning ? 'text-slate-500' : stats.fps >= 55 ? 'text-emerald-400' : stats.fps >= 40 ? 'text-yellow-400' : 'text-red-400';
  const maxColor = stats.maxFrameTime > 33 ? 'text-red-400' : stats.maxFrameTime > 20 ? 'text-yellow-400' : 'text-slate-400';
  const showSecondLine = stats.avgFrameTime > 0 || stats.maxFrameTime > 0;
  return (
    <div className="flex flex-col gap-0.5 text-xs font-mono shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {/* 第一行：FPS + 当前帧时间 + 运行指示 */}
      <div className="flex gap-2.5 items-center whitespace-nowrap">
        <span className={fpsColor}>
          <span className="inline-block w-[3ch] text-right">{stats.fps || '--'}</span>
          <span className="text-[10px] ml-px">FPS</span>
        </span>
        <span className="text-slate-500">
          <span className="inline-block w-[5ch] text-right">{stats.frameTime ? stats.frameTime.toFixed(1) : '--'}</span>
          <span className="text-[10px]">ms</span>
        </span>
        {stats.isRunning && <span className="text-emerald-500 animate-pulse text-[10px]">●</span>}
      </div>
      {/* 第二行：始终渲染占位，无数据时透明 */}
      <div
        className="flex gap-2.5 items-center whitespace-nowrap transition-opacity"
        style={{ opacity: showSecondLine ? 1 : 0 }}
      >
        <span className="text-slate-400" title="全程平均帧时间">
          均<span className="inline-block w-[5ch] text-right">{stats.avgFrameTime.toFixed(1)}</span>
          <span className="text-[10px]">ms</span>
        </span>
        <span className={maxColor} title="全程最高帧时间">
          峰<span className="inline-block w-[5ch] text-right">{stats.maxFrameTime.toFixed(1)}</span>
          <span className="text-[10px]">ms</span>
        </span>
        {stats.particles > 0 && <span className="text-blue-400">{stats.particles}p</span>}
      </div>
    </div>
  );
};

/**
 * 特效预览容器 — 填充父容器的纵向布局。
 * - 工具栏：图标 + 标题 + 描述 + 触发按钮 + 性能指标
 * - 渲染区：flex-1 填满剩余空间（relative 定位容器，overflow-visible）
 */
export const EffectCard: React.FC<{
  title: string;
  icon: IconComponent;
  iconColor?: string;
  desc?: string;
  children: React.ReactNode;
  buttons: React.ReactNode;
  stats?: PerfStats;
  /** @deprecated 不再使用，渲染区自动填满 */
  renderH?: string;
  /** @deprecated */
  previewMinH?: string;
  className?: string;
}> = ({ title, icon: Icon, iconColor = 'text-slate-400', desc, children, buttons, stats, className }) => {
  return (
    <div className={clsx("flex flex-col h-full overflow-visible", className)}>
      {/* 工具栏：图标 + 标题 + 按钮 + 性能指标 */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-700/40">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon size={18} className={clsx("shrink-0", iconColor)} />
          <span className="text-sm font-bold text-slate-100 whitespace-nowrap">{title}</span>
          {desc && <span className="text-[11px] text-slate-500 truncate" title={desc}>{desc}</span>}
          {stats && <div className="ml-auto"><PerfBar stats={stats} /></div>}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">{buttons}</div>
      </div>
      {/* 渲染区：填满剩余空间 */}
      <div className="relative flex-1 overflow-visible">
        {children}
      </div>
    </div>
  );
};

/** 通用卡图精灵（召唤师战争冰霜法师卡） */
export const CardSprite: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  const spriteUrls = getOptimizedImageUrls(getLocalizedAssetPath('summonerwars/hero/Frost/cards', 'zh-CN'));
  const spriteStyle = getSpriteAtlasStyle(0, CARDS_ATLAS);
  return (
    <div
      className={className}
      style={{
        backgroundImage: `url(${spriteUrls.webp})`,
        backgroundRepeat: 'no-repeat',
        ...spriteStyle,
        ...style,
      }}
    />
  );
};

/** 效果开关按钮 */
export const ToggleChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-medium transition-[background-color,color] border ${active
      ? 'bg-indigo-600/60 text-indigo-200 border-indigo-500/60'
      : 'bg-slate-700/40 text-slate-500 border-slate-600/40'
    }`}
  >
    {label}
  </button>
);

/** 预览卡片组件的 Props 类型（所有卡片组件通用） */
export type PreviewCardProps = { useRealCards?: boolean; iconColor?: string };

// ============================================================================
// 自动注册元数据
// ============================================================================

/**
 * 特效条目元数据 — 每个预览卡片组件自描述注册信息。
 *
 * 卡片文件只需导出 `meta: EffectEntryMeta[]`，
 * EffectPreview 页面通过 `import.meta.glob` 自动收集，无需手动维护注册表。
 */
export interface EffectEntryMeta {
  /** 唯一 ID */
  id: string;
  /** 显示名称 */
  label: string;
  /** 图标组件（Lucide 风格） */
  icon: IconComponent;
  /** 预览卡片组件 */
  component: React.FC<PreviewCardProps>;
  /** 所属分组 ID */
  group: string;
  /** 业务用途描述 */
  usageDesc?: string;
}

/**
 * 分组定义 — 描述一个特效分类。
 */
export interface EffectGroupDef {
  id: string;
  label: string;
  icon: IconComponent;
  colorClass: string;
  /** 排序权重，越小越靠前 */
  order: number;
}

/** 预置分组定义（卡片文件通过 group ID 引用） */
export const EFFECT_GROUP_DEFS: EffectGroupDef[] = [
  { id: 'particle', label: '粒子类', icon: Flame, colorClass: 'text-purple-400', order: 0 },
  { id: 'impact', label: '打击类', icon: Swords, colorClass: 'text-rose-400', order: 1 },
  { id: 'projectile', label: '投射类', icon: Send, colorClass: 'text-cyan-400', order: 2 },
  { id: 'gameplay', label: '玩法类', icon: Castle, colorClass: 'text-orange-400', order: 3 },
  { id: 'ui', label: 'UI 类', icon: Sparkles, colorClass: 'text-amber-400', order: 4 },
  { id: 'loading', label: '加载类', icon: Hourglass, colorClass: 'text-emerald-400', order: 5 },
];

// 分组定义需要的图标（在此统一导入，避免每个卡片文件重复导入分组图标）
import { Flame, Swords, Send, Sparkles, Hourglass, Castle } from 'lucide-react';
