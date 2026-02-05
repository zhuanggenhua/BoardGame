/**
 * UI 引擎框架 - 统一导出
 *
 * 提供通用的游戏 UI 类型契约和 Hook 契约类型。
 * 骨架组件实现位于 src/components/game/framework/
 */

// 核心类型
export type {
    GameBoardProps,
    PhaseInfo,
    PlayerPanelData,
    HandAreaConfig,
    HandAreaFilterContext,
    ResourceTrayConfig,
    AnimationConfig,
    DragOffset,
    DragState,
    Ctx,
} from './types';

// 角色选择类型
export type {
    CharacterDef,
    CharacterSelectionState,
    CharacterAssets,
    CharacterSelectionCallbacks,
    PlayerColorScheme,
    CharacterSelectionStyleConfig,
} from './CharacterSelection.types';

// Hook 契约类型
export type {
    UseGameBoardReturn,
    UseHandAreaReturn,
    UseResourceTrayReturn,
    UseDragCardConfig,
    UseDragCardReturn,
    UseSpotlightConfig,
    UseSpotlightReturn,
} from './hooks';
