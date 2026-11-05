import type { ActionBarAction } from '../../core/ui/types';
import type { PreviewState } from './previewStateModel';

export function resolveMapObjectMonsterSelectionEligibility({
    interactionMode,
    isViewerTurn,
    visualBusy,
    hasPendingDecision,
    isHelpingHandsMonsterTurnController,
}: {
    interactionMode: PreviewState['interactionMode'];
    isViewerTurn: boolean;
    visualBusy: boolean;
    hasPendingDecision: boolean;
    isHelpingHandsMonsterTurnController: boolean;
}) {
    const interactionReady = !visualBusy && !hasPendingDecision;
    return {
        canSelectMonsterMoveMonster: interactionReady
            && isViewerTurn
            && (interactionMode === 'default' || interactionMode === 'monsterMove'),
        canSelectHelpingHandsMonsterMoveMonster: interactionReady
            && isHelpingHandsMonsterTurnController
            && (interactionMode === 'default' || interactionMode === 'helpingHandsTrollMove'),
    };
}

/** Reuses the existing action availability; changing the input surface never grants a new command. */
export function resolveMapObjectInteraction({
    formalActionItems,
    visibleActionItems,
    interactionMode,
    isViewerTurn,
    visualBusy,
    hasPendingDecision,
    isExclusiveMonsterTurn,
    isDeadControlledMonster,
    hasLegalMoveTargets,
    hasInventorySelection = false,
    hasHauntAction = false,
    hasTradeSelection = false,
    hasSicknessExchangeAction = false,
}: {
    formalActionItems: readonly ActionBarAction[];
    visibleActionItems: readonly ActionBarAction[];
    interactionMode: PreviewState['interactionMode'];
    isViewerTurn: boolean;
    visualBusy: boolean;
    hasPendingDecision: boolean;
    isExclusiveMonsterTurn: boolean;
    isDeadControlledMonster: boolean;
    hasLegalMoveTargets: boolean;
    hasInventorySelection?: boolean;
    hasHauntAction?: boolean;
    hasTradeSelection?: boolean;
    hasSicknessExchangeAction?: boolean;
}) {
    const freeMap = isViewerTurn && !visualBusy && !hasPendingDecision
        && ['default', 'move', 'explore'].includes(interactionMode);
    const enabled = (id: string) => formalActionItems.some(action => action.id === id && !action.disabled);
    const canMoveToRoom = freeMap
        && (interactionMode === 'default' || interactionMode === 'move')
        && enabled('move')
        && hasLegalMoveTargets
        && !isExclusiveMonsterTurn;
    return {
        canSelectExplorer: freeMap && hasLegalMoveTargets && !isExclusiveMonsterTurn && !isDeadControlledMonster && enabled('move'),
        canMoveToRoom: canMoveToRoom || (
            freeMap
            && (interactionMode === 'default' || interactionMode === 'move')
            && isDeadControlledMonster
            && !isExclusiveMonsterTurn
            && hasLegalMoveTargets
            && enabled('move')
        ),
        canExplore: freeMap && !isExclusiveMonsterTurn && !isDeadControlledMonster && enabled('explore'),
        dockActions: visibleActionItems.filter(action => (
            action.id !== 'explore'
            && action.id !== 'move'
            && action.id !== 'monsterMove'
            && (action.id !== 'use' || hasInventorySelection || hasHauntAction || isExclusiveMonsterTurn)
            && (action.id !== 'trade' || !action.disabled || hasTradeSelection || hasSicknessExchangeAction)
        )),
    };
}
