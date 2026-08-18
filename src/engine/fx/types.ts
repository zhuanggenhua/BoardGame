/**
 * 引擎级 FX 系统 — 类型定义
 *
 * 设计参考：
 * - UE Gameplay Cue（cue 标签 → 渲染器映射）
 * - Unity EffectManager 模式（ScriptableObject 注册表 + 上下文注入）
 *
 * 核心理念：事件解耦 + 注册表 + 参数上下文 + 生命周期管理
 */

import type React from 'react';

// ============================================================================
// Cue 标识
// ============================================================================

/**
 * FX Cue 标识符 — 点分层级命名
 *
 * 命名约定：`fx.<domain>.<detail>`
 * - `fx.summon`            — 召唤光柱
 * - `fx.charge.vortex`    — 充能旋涡
 * - `fx.combat.shockwave` — 攻击气浪
 * - `fx.combat.damage`    — 受伤闪光
 *
 * 支持通配符匹配：`fx.combat.*` 可匹配所有 combat 子类（低优先级）
 */
export type FxCue = string;

// ============================================================================
// 上下文与参数
// ============================================================================

/** 特效坐标空间 */
export type FxSpace = 'cell' | 'board' | 'table' | 'screen' | 'ui';

/** 特效质量档：full 保留完整表现，reduced 保留主体表现但降低移动端重绘成本 */
export type FxQuality = 'full' | 'reduced';

/** 特效影响区域，用于声明预算和后续统一调度 */
export type FxAreaPolicy = 'cell' | 'path' | 'area' | 'screen';

/** 特效预估成本，用于注册表和调度层做并发/降级决策 */
export type FxEstimatedCost = 'low' | 'medium' | 'high';

/** 特效性能预算：声明 DPR、影响区域、成本和默认质量档 */
export interface FxPerformanceBudget {
  /** 默认质量档，运行时可通过 ctx/params 覆盖 */
  quality?: FxQuality;
  /** full 档 DPR 上限 */
  maxDpr?: number;
  /** reduced 档 DPR 上限 */
  reducedMaxDpr?: number;
  /** 影响区域：格子、路径、局部区域或整屏 */
  areaPolicy?: FxAreaPolicy;
  /** 预估成本，用于限制高成本特效并发 */
  estimatedCost?: FxEstimatedCost;
  /** 高成本特效拥挤时是否允许自动降级，而不是直接丢弃 */
  allowAutoReduce?: boolean;
  /** 同时活跃多少个高成本特效后自动降级 */
  reduceWhenHighCostActiveAt?: number;
  /** 同时活跃多少个高成本特效后拒绝新的高成本特效；0 表示不拒绝 */
  dropWhenHighCostActiveAt?: number;
}

/** 棋盘格坐标 */
export interface FxCellCoord {
  row: number;
  col: number;
}

/** FX surface 标识。一个 surface 是一个可测量的本地坐标空间，例如棋盘、牌桌或 UI 层。 */
export type FxSurfaceId = string;

/** FX surface 类型，用于声明坐标语义，不用于渲染分支猜测。 */
export type FxSurfaceKind = 'board' | 'table' | 'screen' | 'ui';

/** FX anchor 类型，用于说明锚点代表的现实对象。 */
export type FxAnchorKind =
  | 'entity'
  | 'card'
  | 'base'
  | 'token'
  | 'attachment-slot'
  | 'zone'
  | 'player'
  | 'ui';

/** FX anchor 播放模式：一次性快照或显式跟随。 */
export type FxAnchorMode = 'spawn-snapshot' | 'tracking';

/** 对一个可见对象锚点的稳定引用。 */
export interface FxAnchorRef {
  surfaceId: FxSurfaceId;
  anchorId: string;
  anchorKind?: FxAnchorKind;
  entityRef?: string;
}

/** 百分比盒子，坐标相对所属 FX surface。 */
export interface FxSurfaceBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** FX 生成时冻结的锚点快照。 */
export interface FxAnchorSnapshot {
  surfaceId: FxSurfaceId;
  anchorId: string;
  anchorKind: FxAnchorKind;
  entityRef?: string;
  box: FxSurfaceBox;
  center: { xPct: number; yPct: number };
  size: { widthPct: number; heightPct: number };
  capturedAt: number;
  mode: FxAnchorMode;
}

/** 锚点注册信息，由游戏 Board / table UI 提供。 */
export interface FxAnchorRegistration extends FxAnchorRef {
  anchorKind: FxAnchorKind;
}

/**
 * FX 通用上下文 — 所有特效共享的定位与元信息
 *
 * 每种特效必须的信息放在此处，特效独有的参数放在 FxParams 中。
 */
export interface FxContext {
  /** 坐标空间（默认 'cell'） */
  space?: FxSpace;
  /** 目标格坐标（space='cell' 时必填） */
  cell?: FxCellCoord;
  /** 屏幕百分比坐标（space='screen' 时使用） */
  screenPos?: { xPct: number; yPct: number };
  /** 当前事件所属的 surface；board/table/ui 特效应显式声明。 */
  surfaceId?: FxSurfaceId;
  /** 来源锚点快照。一次性 FX 生成后只消费该快照。 */
  sourceSnapshot?: FxAnchorSnapshot;
  /** 目标锚点快照。一次性 FX 生成后只消费该快照。 */
  targetSnapshot?: FxAnchorSnapshot;
  /** 强度 */
  intensity?: 'normal' | 'strong';
  /** 特效质量档；通常由设置或调度层注入 */
  quality?: FxQuality;
  /** 自定义标签（用于过滤/查询） */
  tags?: string[];
}

/**
 * FX 特效独有参数 — 每种 cue 自定义的参数包
 *
 * 基础版使用 Record<string, unknown>，
 * 游戏侧可通过 FxCueMap 泛型获得类型推断（可选增强）。
 */
export type FxParams = Record<string, unknown>;

// ============================================================================
// 事件
// ============================================================================

/**
 * FX 事件 — 推入 FxBus 触发特效的数据载体
 */
export interface FxEvent {
  /** 唯一 ID（由 FxBus 生成） */
  id: string;
  /** Cue 标识 */
  cue: FxCue;
  /** 通用上下文 */
  ctx: FxContext;
  /** 特效独有参数 */
  params?: FxParams;
}

/** 创建 FxEvent 的输入（无 id，由 bus 生成） */
export type FxEventInput = Omit<FxEvent, 'id'>;

// ============================================================================
// 渲染器
// ============================================================================

/** 渲染器接收的 Props */
export interface FxRendererProps {
  /** 当前特效事件 */
  event: FxEvent;
  /** 格坐标 → 百分比定位的转换函数 */
  getCellPosition: (row: number, col: number) => {
    left: number; top: number; width: number; height: number;
  };
  /** 特效播放完成回调 */
  onComplete: () => void;
  /**
   * 冲击瞬间回调（由 FxLayer 注入）
   *
   * 渲染器在"爆发/命中"关键帧调用此函数，
   * FxLayer 会自动播放 timing='on-impact' 的音效和震动。
   * 如果注册时未声明 on-impact 反馈，此回调为空函数。
   */
  onImpact: () => void;
}

/**
 * FX 渲染器 — React 组件，负责将 FxEvent 渲染为视觉效果
 *
 * 与底层动画组件（SummonEffect / VortexEffect 等）的关系：
 * Renderer 是「适配器」，将 FxEvent 的参数映射为底层组件的 props。
 */
export type FxRenderer = React.FC<FxRendererProps>;

// ============================================================================
// 反馈包（Feedback Pack）— 音效 + 震动
// ============================================================================

/**
 * 音效反馈配置
 *
 * - timing: 'immediate' — 事件推入时立即播放
 * - timing: 'on-impact' — 延迟到渲染器触发 onImpact 回调时播放
 * - source: 'key' — 使用固定的音效 key
 * - source: 'params' — 从 event.params.soundKey 读取（由推送方在 push 时注入）
 */
export interface FxSoundConfig {
  /** 音效来源（默认 'key'） */
  source?: 'key' | 'params';
  /** 音效 key（source='key' 时必填，source='params' 时作为 fallback） */
  key?: string;
  /** 播放时机 */
  timing: 'immediate' | 'on-impact';
}

/**
 * 震动反馈配置
 *
 * - timing: 'immediate' — 事件推入时立即触发
 * - timing: 'on-impact' — 延迟到渲染器触发 onImpact 回调时触发
 */
export interface FxShakeConfig {
  /** 震动强度 */
  intensity: 'normal' | 'strong';
  /** 震动类型 */
  type: 'impact' | 'hit';
  /** 播放时机（默认 'on-impact'） */
  timing?: 'immediate' | 'on-impact';
}

/**
 * 反馈包 — 将视觉特效、音效、震动统一声明
 *
 * 设计参考：UE Gameplay Cue（一个 cue 触发完整反馈链）
 */
export interface FeedbackPack {
  /** 音效配置（可选） */
  sound?: FxSoundConfig;
  /** 震动配置（可选） */
  shake?: FxShakeConfig;
}

// ============================================================================
// 注册表选项
// ============================================================================

/** 渲染器注册选项 */
export interface FxRendererOptions {
  /** 渲染层级（数值越大越靠前，默认 0） */
  layer?: number;
  /** 同一 cue 最大并发数（0=不限，默认 0） */
  maxConcurrent?: number;
  /** 防抖间隔（ms，0=不防抖，默认 0） */
  debounceMs?: number;
  /** 安全超时（ms，超时自动移除，默认 5000） */
  timeoutMs?: number;
  /** 性能预算（DPR、区域、成本、默认质量档） */
  budget?: FxPerformanceBudget;
}

/** 注册表中存储的完整条目 */
export interface FxRegistryEntry {
  cue: FxCue;
  renderer: FxRenderer;
  options: Required<Omit<FxRendererOptions, 'budget'>> & { budget: Required<FxPerformanceBudget> };
  /** 反馈包：音效 + 震动（注册时声明，运行时自动触发） */
  feedback?: FeedbackPack;
}
