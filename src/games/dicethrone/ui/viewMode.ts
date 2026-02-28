/**
 * 视角与自动观战计算工具
 * - 防御阶段仅在存在 pendingAttack 时强制切到防守方
 */
import type { PlayerId } from '../../../engine/types';
import type { PendingAttack, TurnPhase } from '../domain/types';

export type ViewMode = 'self' | 'opponent';

export interface ViewModeParams {
    currentPhase: TurnPhase;
    pendingAttack: PendingAttack | null;
    activePlayerId: PlayerId;
    rootPlayerId: PlayerId;
    manualViewMode: ViewMode;
}

export interface ViewModeResult {
    rollerId: PlayerId;
    shouldAutoObserve: boolean;
    viewMode: ViewMode;
    isSelfView: boolean;
}

export const computeViewModeState = (params: ViewModeParams): ViewModeResult => {
    const { currentPhase, pendingAttack, activePlayerId, rootPlayerId, manualViewMode } = params;
    const rollerId = currentPhase === 'defensiveRoll'
        ? (pendingAttack?.defenderId ?? activePlayerId)
        : activePlayerId;
    const shouldAutoObserve = currentPhase === 'defensiveRoll' && Boolean(pendingAttack) && rootPlayerId !== rollerId;
    const viewMode = shouldAutoObserve ? 'opponent' : manualViewMode;
    const isSelfView = viewMode === 'self';

    return {
        rollerId,
        shouldAutoObserve,
        viewMode,
        isSelfView,
    };
};
