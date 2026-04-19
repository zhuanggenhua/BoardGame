/**
 * UI 引擎框架 - 骨架组件 Props 类型
 *
 * 定义各骨架组件的 Props 接口。
 * 骨架组件无默认样式，通过 className 和 render 函数注入样式。
 */

import type { ReactNode } from 'react';
import type {
    PhaseInfo,
    ActionBarAction,
    ActionBarConfig,
    PhaseHudConfig,
    PlayerPanelData,
    HandAreaConfig,
    ResourceTrayConfig,
    AnimationConfig,
} from '../../../core/ui';

// ============================================================================
// 阶段指示器骨架
// ============================================================================

/**
 * 阶段指示器骨架 Props
 */
export interface PhaseIndicatorSkeletonProps {
    /** 阶段列表 */
    phases: PhaseInfo[];
    /** 当前阶段编号 */
    currentPhaseId: string;
    /** 布局方向 */
    orientation?: 'vertical' | 'horizontal';
    /** 容器样式 */
    className?: string;
    /** 阶段项渲染函数 */
    renderPhaseItem?: (phase: PhaseInfo, isActive: boolean, index: number) => ReactNode;
}

// ============================================================================
// 阶段 HUD 骨架
// ============================================================================

/**
 * 阶段 HUD 骨架 Props
 */
export interface PhaseHudSkeletonProps extends PhaseHudConfig {
    /** 布局方向 */
    orientation?: 'vertical' | 'horizontal';
    /** 容器样式 */
    className?: string;
    /** 阶段项渲染函数 */
    renderPhaseItem?: (phase: PhaseInfo, isActive: boolean, index: number) => ReactNode;
    /** 状态文本渲染函数 */
    renderStatus?: (statusText?: string) => ReactNode;
    /** 当前玩家信息渲染函数 */
    renderCurrentPlayer?: (label?: string) => ReactNode;
}

// ============================================================================
// 玩家面板骨架
// ============================================================================

/**
 * 玩家面板骨架 Props
 */
export interface PlayerPanelSkeletonProps {
    /** 玩家数据 */
    player: PlayerPanelData;
    /** 是否是当前回合玩家 */
    isCurrentPlayer?: boolean;
    /** 容器样式 */
    className?: string;
    /** 资源渲染函数 */
    renderResource?: (key: string, value: number) => ReactNode;
    /** 状态效果渲染函数 */
    renderStatusEffect?: (effectId: string, stacks: number) => ReactNode;
    /** 玩家信息渲染函数（头像、名称等） */
    renderPlayerInfo?: (player: PlayerPanelData) => ReactNode;
}

// ============================================================================
// 操作栏骨架
// ============================================================================

/**
 * 操作栏骨架 Props
 */
export interface ActionBarSkeletonProps extends ActionBarConfig {
    /** 容器样式 */
    className?: string;
    /** 动作渲染函数 */
    renderAction?: (action: ActionBarAction, onClick: () => void, index: number) => ReactNode;
    /** 动作点击回调 */
    onAction?: (action: ActionBarAction) => void;
}

// ============================================================================
// 手牌区骨架
// ============================================================================

/**
 * 手牌区骨架 Props
 * @template TCard 卡牌类型
 */
export interface HandAreaSkeletonProps<TCard = unknown> extends HandAreaConfig<TCard> {
    /** 容器样式 */
    className?: string;
    /** 是否启用发牌动画 */
    dealAnimation?: boolean;
    /** 打出卡牌的拖拽阈值（向上拖拽距离，默认 150） */
    dragThreshold?: number;
    /** 卡牌来源位置（用于发牌动画） */
    dealSourceRef?: React.RefObject<HTMLElement | null>;
    /** 售卖/弃牌区域（用于判断拖拽目标） */
    sellZoneRef?: React.RefObject<HTMLElement | null>;
    /** 拖拽状态变化回调 */
    onDragStateChange?: (isDragging: boolean, cardId: string | null) => void;
    /** 打出提示变化回调 */
    onPlayHintChange?: (show: boolean) => void;
    /** 售卖提示变化回调 */
    onSellHintChange?: (show: boolean) => void;
    /** 动画配置 */
    animationConfig?: AnimationConfig;
}

// ============================================================================
// 资源托盘骨架
// ============================================================================

/**
 * 资源托盘骨架 Props
 * @template TItem 资源项类型
 */
export interface ResourceTraySkeletonProps<TItem = unknown> extends ResourceTrayConfig<TItem> {
    /** 容器样式 */
    className?: string;
    /** 布局方式 */
    layout?: 'row' | 'column' | 'grid';
    /** 网格列数（布局为网格时有效） */
    gridColumns?: number;
    /** 动画配置 */
    animationConfig?: AnimationConfig;
}

// ============================================================================
// 聚焦骨架
// ============================================================================

/**
 * 特写骨架 Props
 * 用于中心展示重要内容（骰子结果、卡牌打出、技能激活等）
 */
export interface SpotlightSkeletonProps {
    /** 是否显示 */
    isVisible: boolean;
    /** 关闭回调 */
    onClose: () => void;
    /** 自动关闭延迟（毫秒），不传则手动关闭 */
    autoCloseDelay?: number;
    /** 标题 */
    title?: ReactNode;
    /** 描述/效果文字 */
    description?: ReactNode;
    /** 特写内容 */
    children: ReactNode;
    /** 入场动画配置 */
    enterAnimation?: AnimationConfig;
    /** 出场动画配置 */
    exitAnimation?: AnimationConfig;
    /** 背景遮罩样式 */
    backdropClassName?: string;
    /** 内容容器样式 */
    containerClassName?: string;
    /** 点击背景关闭 */
    closeOnBackdrop?: boolean;
    /** 显示关闭按钮 */
    showCloseButton?: boolean;
    /** 关闭按钮渲染函数 */
    renderCloseButton?: (onClose: () => void) => ReactNode;
    /** 确认按钮延迟显示时间（毫秒），设置后会在 description 下方显示确认按钮 */
    confirmButtonDelay?: number;
    /** 确认按钮渲染函数 */
    renderConfirmButton?: (onClose: () => void) => ReactNode;
}
