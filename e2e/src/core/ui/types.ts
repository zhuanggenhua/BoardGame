/**
 * UI 引擎框架 - 核心类型定义
 *
 * 定义通用的游戏 UI 类型契约，供骨架组件和游戏皮肤层使用。
 */

import type { ReactNode } from 'react';

// ============================================================================
// 阶段信息
// ============================================================================

/**
 * 通用阶段信息
 */
export interface PhaseInfo {
    /** 阶段唯一标识 */
    id: string;
    /** 阶段显示名称 */
    label: string;
    /** 阶段描述（可选，支持多行） */
    description?: string[];
}

// ============================================================================
// 操作栏（通用按钮区）
// ============================================================================

/**
 * 操作栏按钮定义
 */
export interface ActionBarAction {
    /** 动作唯一标识 */
    id: string;
    /** 按钮文案 */
    label: string;
    /** 作用范围（可用于当前玩家可见规则） */
    scope?: 'current-player' | 'all';
    /** 辅助说明 */
    description?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 样式语义 */
    variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * 操作栏配置
 */
export interface ActionBarConfig {
    /** 动作列表 */
    actions: ActionBarAction[];
    /** 布局方向 */
    layout?: 'row' | 'column';
    /** 对齐方式 */
    align?: 'start' | 'center' | 'end' | 'space-between';
    /** 间距（像素） */
    gap?: number;
}

// ============================================================================
// 阶段提示 HUD
// ============================================================================

/**
 * 阶段 HUD 配置
 */
export interface PhaseHudConfig {
    /** 阶段列表 */
    phases: PhaseInfo[];
    /** 当前阶段（可由运行态覆盖） */
    currentPhaseId?: string;
    /** 状态描述（如“等待操作”） */
    statusText?: string;
    /** 当前玩家显示文案 */
    currentPlayerLabel?: string;
}

// ============================================================================
// 玩家面板
// ============================================================================

/**
 * 通用玩家面板数据
 */
export interface PlayerPanelData {
    /** 玩家 ID */
    playerId: string;
    /** 显示名称 */
    displayName?: string;
    /** 头像 URL */
    avatar?: string;
    /** 资源映射 { health: 50, energy: 3, ... } */
    resources: Record<string, number>;
    /** 状态效果映射 { poison: 2, shield: 1, ... } */
    statusEffects?: Record<string, number>;
}

// ============================================================================
// 手牌区
// ============================================================================

/**
 * 手牌区过滤上下文（系统注入）
 */
export interface HandAreaFilterContext {
    /** 玩家 ID 列表 */
    playerIds: string[];
    /** 当前玩家 ID */
    currentPlayerId: string | null;
    /** 当前玩家索引 */
    currentPlayerIndex: number;
    /** 目标玩家 ID */
    resolvedPlayerId: string | null;
    /** 目标玩家索引 */
    resolvedPlayerIndex: number;
    /** 归属字段（玩家ID） */
    bindEntity?: string;
    /** 区域字段 */
    zoneField?: string;
    /** 区域值 */
    zoneValue?: string;
}

/**
 * 手牌交互模式
 * - drag: 仅拖拽
 * - click: 仅点击选中
 * - both: 点击 + 拖拽
 */
export type HandAreaInteractionMode = 'drag' | 'click' | 'both';

/**
 * 手牌区配置
 * @template TCard 卡牌类型
 */
export interface HandAreaConfig<TCard = unknown> {
    /** 手牌列表 */
    cards: TCard[];
    /** 手牌上限 */
    maxCards?: number;
    /** 是否可拖拽 */
    canDrag?: boolean;
    /** 是否可选中（点击选中/取消选中） */
    canSelect?: boolean;
    /** 手牌交互模式（优先于 canDrag/canSelect） */
    interactionMode?: HandAreaInteractionMode;
    /** 已选中的卡牌ID列表 */
    selectedCardIds?: string[];
    /** 选中状态变化回调 */
    onSelectChange?: (cardId: string, selected: boolean) => void;
    /** 打出卡牌回调（拖拽打出或点击打出） */
    onPlayCard?: (cardId: string) => void;
    /** 售卖/弃置卡牌回调 */
    onSellCard?: (cardId: string) => void;
    /**
     * 点击卡牌回调（通用点击，由游戏层决定行为）
     * 与 onPlayCard/onSelectChange 互补：
     * - onPlayCard: 拖拽打出
     * - onSelectChange: 选中/取消选中
     * - onCardClick: 游戏层自定义点击逻辑（如召唤师战争的阶段感知点击）
     */
    onCardClick?: (cardId: string) => void;
    /** 卡牌渲染函数 */
    renderCard: (card: TCard, index: number, isSelected: boolean) => ReactNode;
    /** 
     * 布局代码（AI生成）
     * 函数签名：(index: number, total: number) => React.CSSProperties
     * 示例："顺序排开" → 生成水平排列代码
     */
    layoutCode?: string;
    /**
     * 选中效果代码（AI生成）
     * 函数签名：(isSelected: boolean) => React.CSSProperties
     * 示例："抬高一点" → 生成 translateY(-20px) 代码
     */
    selectEffectCode?: string;
    /**
     * 排序代码（AI生成）
     * 函数签名：(a: TCard, b: TCard) => number
     * 示例："按点数从小到大" → 生成 a.value - b.value
     */
    sortCode?: string;
    /**
     * 过滤代码（AI生成）
     * 函数签名：(card: TCard, ctx: HandAreaFilterContext) => boolean
     * 示例："只显示红色牌" → 生成 card.color === 'red'
     */
    filterCode?: string;
    /** 过滤上下文（系统注入） */
    filterContext?: HandAreaFilterContext;
}

// ============================================================================
// 资源托盘
// ============================================================================

/**
 * 资源托盘配置（骰子/棋子/token）
 * @template TItem 资源项类型
 */
export interface ResourceTrayConfig<TItem = unknown> {
    /** 资源项列表 */
    items: TItem[];
    /** 是否可交互 */
    canInteract?: boolean;
    /** 点击资源项回调 */
    onItemClick?: (itemId: string | number) => void;
    /** 切换资源项状态回调（如锁定/解锁） */
    onItemToggle?: (itemId: string | number) => void;
    /** 资源项渲染函数 */
    renderItem: (item: TItem, index: number) => ReactNode;
}

// ============================================================================
// 动画配置
// ============================================================================

/**
 * 动画配置
 */
export interface AnimationConfig {
    /** 动画时长 (ms)，默认 300 */
    duration?: number;
    /** 缓动函数，默认 'ease-out' */
    easing?: string;
    /** 延迟 (ms) */
    delay?: number;
}

// ============================================================================
// 拖拽
// ============================================================================

/**
 * 拖拽偏移量
 */
export interface DragOffset {
    x: number;
    y: number;
}

/**
 * 拖拽状态
 */
export interface DragState {
    /** 是否正在拖拽 */
    isDragging: boolean;
    /** 当前拖拽偏移量 */
    offset: DragOffset;
    /** 起始位置 */
    startPos: DragOffset;
}

