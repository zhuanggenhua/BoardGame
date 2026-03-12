/**
 * UI 引擎框架 - 骨架组件统一导出
 *
 * 提供无样式的骨架组件，游戏通过 render 函数和 className 注入具体样式。
 * 也提供预设渲染函数供 UGC/快速开发使用。
 */

// 骨架组件
export { PhaseIndicatorSkeleton } from './PhaseIndicatorSkeleton';
export { PhaseHudSkeleton } from './PhaseHudSkeleton';
export { PlayerPanelSkeleton } from './PlayerPanelSkeleton';
export { HandAreaSkeleton } from './HandAreaSkeleton';
export { ActionBarSkeleton } from './ActionBarSkeleton';
export { ResourceTraySkeleton } from './ResourceTraySkeleton';
export { SpotlightSkeleton } from './SpotlightSkeleton';
export { MobileBoardShell } from './MobileBoardShell';
export { CardListOverlay } from './CardListOverlay';
export { CardSpotlightQueue } from './CardSpotlightQueue';
export type { CardSpotlightQueueProps } from './CardSpotlightQueue';
export type { CardListOverlayProps, CardListItem } from './CardListOverlay';
export { CharacterSelectionSkeleton } from './CharacterSelectionSkeleton';
export type { CharacterSelectionSkeletonProps } from './CharacterSelectionSkeleton';
export { TutorialSelectionGate } from './TutorialSelectionGate';
export type { TutorialSelectionGateProps } from './TutorialSelectionGate';
export type { MobileBoardShellProps } from './MobileBoardShell';
export { CriticalImageGate } from './CriticalImageGate';
export type { CriticalImageGateProps } from './CriticalImageGate';
export { InteractionGate } from './InteractionGate';
export type { InteractionGateProps } from './InteractionGate';
export {
    InteractionGuardProvider,
    useInteractionGuard,
    createInteractionGuardController,
    DEFAULT_INTERACTION_GUARD_THROTTLE_MS,
} from './InteractionGuard';

// 棋盘布局组件
export { BoardLayoutEditor } from './BoardLayoutEditor';
export type { BoardLayoutEditorProps } from './BoardLayoutEditor';
export { BoardLayoutRenderer } from './BoardLayoutRenderer';
export type { BoardLayoutRendererProps } from './BoardLayoutRenderer';

// 钩子
export {
    useGameBoard,
    useHandArea,
    useResourceTray,
    useDragCard,
    useAutoSkipPhase,
    useVisualSequenceGate,
    useCardSpotlightQueue,
} from './hooks';
export type {
    UseGameBoardConfig,
    UseHandAreaConfig,
    UseResourceTrayConfig,
    UseAutoSkipPhaseConfig,
    UseVisualSequenceGateReturn,
    SpotlightItem,
    UseCardSpotlightQueueConfig,
    UseCardSpotlightQueueReturn,
} from './hooks';

// 预设渲染函数
export {
    // 阶段指示器预设
    createPhaseItemRender,
    defaultPhaseItemRender,
    // 玩家面板 / 资源条预设
    createResourceBarRender,
    defaultResourceBarRender,
    defaultPlayerPanelClassName,
    // 状态效果预设
    createStatusEffectRender,
    defaultStatusEffectRender,
    // 聚焦预设
    defaultSpotlightBackdrop,
    defaultSpotlightContainer,
} from './presets';
export type {
    PhaseItemPresetOptions,
    ResourceBarPresetOptions,
    StatusEffectPresetOptions,
    SpotlightPresetOptions,
} from './presets';

// 动态增益指示器
export { BoostIndicator } from './widgets/BoostIndicator';
export type { BoostEntry, BoostPosition } from './widgets/BoostIndicator';

// Buff 系统
// (BuffSystem 已有独立导入路径，此处不重复导出)

// 类型导出
export type {
    PhaseIndicatorSkeletonProps,
    PhaseHudSkeletonProps,
    PlayerPanelSkeletonProps,
    HandAreaSkeletonProps,
    ActionBarSkeletonProps,
    ResourceTraySkeletonProps,
    SpotlightSkeletonProps,
} from './types';
