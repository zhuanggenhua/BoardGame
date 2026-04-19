/**
 * UI 引擎框架 - Hook 契约类型定义
 *
 * 定义底层 Hook 的返回值类型契约，供完全自定义 UI 时使用。
 */

import type { DragOffset } from './types';

// ============================================================================
// useGameBoard
// ============================================================================

/**
 * useGameBoard hook 返回值
 * 提供游戏 Board 基础状态管理
 * @template G 游戏状态类型
 */
export interface UseGameBoardReturn<G> {
    /** 游戏状态 */
    G: G;
    /** 是否是当前玩家回合 */
    isMyTurn: boolean;
    /** 当前阶段 ID */
    currentPhase: string;
    /** 是否可以进行交互 */
    canInteract: boolean;
    /** 当前玩家 ID */
    playerID: string | null;
}

// ============================================================================
// useHandArea
// ============================================================================

/**
 * useHandArea hook 返回值
 * 提供手牌区交互逻辑
 * @template TCard 卡牌类型
 */
export interface UseHandAreaReturn<TCard> {
    /** 可见的卡牌列表（处理动画状态后） */
    visibleCards: TCard[];
    /** 正在拖拽的卡牌 ID */
    draggingCardId: string | null;
    /** 拖拽偏移量 */
    dragOffset: DragOffset;
    /** 开始拖拽 */
    handleDragStart: (cardId: string, startPos: DragOffset) => void;
    /** 拖拽中 */
    handleDrag: (cardId: string, offset: DragOffset) => void;
    /** 结束拖拽 */
    handleDragEnd: (cardId: string) => void;
    /** 是否显示打出提示（向上拖拽超过阈值） */
    showPlayHint: boolean;
    /** 是否显示售卖提示（拖拽到弃牌区） */
    showSellHint: boolean;
}

// ============================================================================
// useResourceTray
// ============================================================================

/**
 * useResourceTray hook 返回值
 * 提供资源托盘交互逻辑
 * @template TItem 资源项类型
 */
export interface UseResourceTrayReturn<TItem> {
    /** 资源项列表 */
    items: TItem[];
    /** 选中的资源项 ID */
    selectedItemId: string | number | null;
    /** 点击资源项 */
    handleItemClick: (itemId: string | number) => void;
    /** 切换资源项状态（如锁定/解锁） */
    handleItemToggle: (itemId: string | number) => void;
}

// ============================================================================
// useDragCard
// ============================================================================

/**
 * useDragCard hook 配置
 */
export interface UseDragCardConfig {
    /** 打出卡牌的拖拽阈值（向上拖拽距离） */
    playThreshold?: number;
    /** 售卖区域元素 ref */
    sellZoneRef?: React.RefObject<HTMLElement | null>;
    /** 是否可交互（不可交互时触发 denied 音效） */
    canInteract?: boolean;
    /** 打出卡牌回调 */
    onPlay?: (cardId: string) => void;
    /** 售卖卡牌回调 */
    onSell?: (cardId: string) => void;
    /** 拖拽取消回调（未达到阈值） */
    onCancel?: (cardId: string) => void;
}

/**
 * useDragCard hook 返回值
 * 提供单张卡牌的拖拽逻辑
 */
export interface UseDragCardReturn {
    /** 是否正在拖拽 */
    isDragging: boolean;
    /** 拖拽偏移量 */
    offset: DragOffset;
    /** 绑定到可拖拽元素的事件处理器 */
    dragHandlers: {
        onPointerDown: (e: React.PointerEvent) => void;
        onPointerMove: (e: React.PointerEvent) => void;
        onPointerUp: (e: React.PointerEvent) => void;
        onPointerCancel: (e: React.PointerEvent) => void;
    };
    /** 是否在打出区域内 */
    isInPlayZone: boolean;
    /** 是否在售卖区域内 */
    isInSellZone: boolean;
}

// ============================================================================
// useSpotlight
// ============================================================================

/**
 * useSpotlight hook 配置
 */
export interface UseSpotlightConfig {
    /** 自动关闭延迟 (ms)，不传则手动关闭 */
    autoCloseDelay?: number;
    /** 关闭回调 */
    onClose?: () => void;
}

/**
 * useSpotlight hook 返回值
 * 提供特写展示的状态管理
 */
export interface UseSpotlightReturn {
    /** 是否正在显示 */
    isVisible: boolean;
    /** 是否正在淡出 */
    isExiting: boolean;
    /** 显示特写 */
    show: () => void;
    /** 关闭特写 */
    close: () => void;
}
