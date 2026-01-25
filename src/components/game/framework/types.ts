/**
 * UI 引擎框架 - 骨架组件 Props 类型
 *
 * 定义各骨架组件的 Props 接口。
 * 骨架组件无默认样式，通过 className 和 render 函数注入样式。
 */

import type { ReactNode } from 'react';
import type {
    PhaseInfo,
    PlayerPanelData,
    HandAreaConfig,
    ResourceTrayConfig,
    AnimationConfig,
} from '../../../core/ui';

// ============================================================================
// PhaseIndicatorSkeleton
// ============================================================================

/**
 * 阶段指示器骨架 Props
 */
export interface PhaseIndicatorSkeletonProps {
    /** 阶段列表 */
    phases: PhaseInfo[];
    /** 当前阶段 ID */
    currentPhaseId: string;
    /** 布局方向 */
    orientation?: 'vertical' | 'horizontal';
    /** 容器样式 */
    className?: string;
    /** 阶段项渲染函数 */
    renderPhaseItem?: (phase: PhaseInfo, isActive: boolean, index: number) => ReactNode;
}

// ============================================================================
// PlayerPanelSkeleton
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
// HandAreaSkeleton
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
// ResourceTraySkeleton
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
    /** 网格列数（layout='grid' 时有效） */
    gridColumns?: number;
    /** 动画配置 */
    animationConfig?: AnimationConfig;
}

// ============================================================================
// SpotlightSkeleton
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
    /** 自动关闭延迟 (ms)，不传则手动关闭 */
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
}
