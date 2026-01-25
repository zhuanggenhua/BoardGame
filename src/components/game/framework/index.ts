/**
 * UI 引擎框架 - 骨架组件统一导出
 *
 * 提供无样式的骨架组件，游戏通过 render 函数和 className 注入具体样式。
 * 也提供预设渲染函数供 UGC/快速开发使用。
 */

// 骨架组件
export { PhaseIndicatorSkeleton } from './PhaseIndicatorSkeleton';
export { PlayerPanelSkeleton } from './PlayerPanelSkeleton';
export { HandAreaSkeleton } from './HandAreaSkeleton';
export { ResourceTraySkeleton } from './ResourceTraySkeleton';
export { SpotlightSkeleton } from './SpotlightSkeleton';

// Hooks
export {
    useGameBoard,
    useHandArea,
    useResourceTray,
    useDragCard,
} from './hooks';
export type {
    UseGameBoardConfig,
    UseHandAreaConfig,
    UseResourceTrayConfig,
} from './hooks';

// 预设渲染函数
export {
    // PhaseIndicator 预设
    createPhaseItemRender,
    defaultPhaseItemRender,
    // PlayerPanel / ResourceBar 预设
    createResourceBarRender,
    defaultResourceBarRender,
    defaultPlayerPanelClassName,
    // StatusEffect 预设
    createStatusEffectRender,
    defaultStatusEffectRender,
    // Spotlight 预设
    defaultSpotlightBackdrop,
    defaultSpotlightContainer,
} from './presets';
export type {
    PhaseItemPresetOptions,
    ResourceBarPresetOptions,
    StatusEffectPresetOptions,
    SpotlightPresetOptions,
} from './presets';

// 类型导出
export type {
    PhaseIndicatorSkeletonProps,
    PlayerPanelSkeletonProps,
    HandAreaSkeletonProps,
    ResourceTraySkeletonProps,
    SpotlightSkeletonProps,
} from './types';
