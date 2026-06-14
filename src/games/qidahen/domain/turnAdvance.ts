import { getQidahenDriveTigerConsentSelectionForCore } from './interactionSelectionAccessors';
import {
    syncQidahenCurrentCoreSelections,
} from './coreDerivedState';
import {
    isFactionActionTurnComplete,
} from './factionActionWindow';
import { buildQidahenActionWindowEntryState } from './actionWindowEntryState';
import { getCurrentFactionId } from './factionTurnAccessors';
import { filterFactionOrderForScenario, getActiveFactionTurnOrder } from './factionTurnOrder';
import { getPreferredActionWindowSelectedRegionIdForFaction } from './regionSelectionPreferences';
import { getQidahenScenarioPreset } from './scenarioPresets';
import {
    getQidahenCurrentWheelDispatchSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
} from './dispatchSelectionBuilders';
import {
    getQidahenCurrentDiplomacySelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './selectionBuilders';
import { updateQidahenTurnLabel } from './turnLabelState';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenWheelDispatchSelection,
} from './types';

interface QidahenTurnAdvanceDependencies {
    syncCurrentCoreSelections: (
        state: QidahenCore,
    ) => QidahenCore;
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
    getCurrentWheelDispatchSelectionForCore: (
        state: QidahenCore,
    ) => QidahenWheelDispatchSelection | null;
}

const beginHandLimitDiscardIfNeeded = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    timestamp: number,
    dependencies: Pick<QidahenTurnAdvanceDependencies, 'updateTurnLabel'>,
): QidahenCore => {
    const faction = state.factions[factionId];
    const handLimit = Math.max(0, faction.handLimit);
    const excessCards = Math.max(0, faction.handCount - handLimit);
    if (excessCards <= 0) {
        return state;
    }

    const candidateCardIds = state.handCards
        .filter((card) => card.faction === factionId && card.status !== 'disabled')
        .map((card) => card.id);
    if (candidateCardIds.length < excessCards) {
        const removedCardIds = new Set(candidateCardIds);
        return {
            ...state,
            factions: {
                ...state.factions,
                [factionId]: {
                    ...faction,
                    handCount: handLimit,
                    discardPileCount: Math.max(0, faction.discardPileCount ?? 0) + excessCards,
                },
            },
            handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
            actionLog: [
                {
                    id: `log-hand-limit-${timestamp}`,
                    faction: factionId,
                    text: `${faction.name} 手牌超过上限 ${handLimit}，实体手牌不足以选择，自动弃掉 ${excessCards} 张牌。`,
                },
                ...state.actionLog,
            ].slice(0, 6),
        };
    }

    return dependencies.updateTurnLabel({
        ...state,
        turnPhase: 'hand-limit-discard',
        handLimitDiscardSelection: {
            factionId,
            factionName: faction.name,
            handLimit,
            handCount: faction.handCount,
            requiredDiscardCount: excessCards,
            candidateCardIds,
            selectedCardIds: [],
        },
        actionLog: [
            {
                id: `log-hand-limit-${timestamp}`,
                faction: factionId,
                text: `${faction.name} 手牌超过上限 ${handLimit}，需要选择弃掉 ${excessCards} 张牌。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
};

export function advanceQidahenTurnIfReady(
    state: QidahenCore,
    timestamp: number,
    dependencies: QidahenTurnAdvanceDependencies = {
        syncCurrentCoreSelections: syncQidahenCurrentCoreSelections,
        updateTurnLabel: updateQidahenTurnLabel,
        getCurrentWheelDispatchSelectionForCore: getQidahenCurrentWheelDispatchSelectionForCore,
    },
): QidahenCore {
    const nextState = dependencies.syncCurrentCoreSelections(state);
    const internalDispatchSelection = getQidahenInternalDispatchSelectionForCore(nextState);
    const recruitSelection = getQidahenRecruitSelectionForCore(nextState);
    const maShiTradeSelection = getQidahenMaShiTradeSelectionForCore(nextState);
    const khanEdictSelection = getQidahenKhanEdictSelectionForCore(nextState);
    const diplomacySelection = getQidahenCurrentDiplomacySelectionForCore(nextState);
    const wheelDispatchSelection = dependencies.getCurrentWheelDispatchSelectionForCore(nextState);
    const driveTigerConsentSelection = getQidahenDriveTigerConsentSelectionForCore(nextState);
    if (
        nextState.pendingTargetAction
        || nextState.postBattleSelection
        || recruitSelection
        || maShiTradeSelection
        || khanEdictSelection
        || diplomacySelection
        || nextState.turnPhase === 'season-resolution'
        || nextState.handLimitDiscardSelection
        || nextState.gaoDiDispatchSelection
        || internalDispatchSelection
        || driveTigerConsentSelection
        || wheelDispatchSelection
        || !nextState.wheelActionUsed
        || !isFactionActionTurnComplete(nextState)
    ) {
        return dependencies.updateTurnLabel(nextState);
    }

    const scenarioOpeningFactionOrder = filterFactionOrderForScenario(
        nextState.scenarioId,
        getQidahenScenarioPreset(nextState.scenarioId).factionOrder,
    );
    const factionTurnOrder = getActiveFactionTurnOrder(
        nextState,
        scenarioOpeningFactionOrder,
    );
    const currentFactionId = getCurrentFactionId(nextState);
    const isImmediatePostNewYear = nextState.actionWheelPosition === 'wheel-new-year' && nextState.currentYearIndex > 0;
    const currentIndex = Math.max(0, factionTurnOrder.indexOf(currentFactionId));
    const nextFactionId = isImmediatePostNewYear
        ? factionTurnOrder[0]
        : factionTurnOrder[(currentIndex + 1) % factionTurnOrder.length];
    const wrapped = isImmediatePostNewYear || currentIndex === factionTurnOrder.length - 1;
    const roundNumber = wrapped ? nextState.roundNumber + 1 : nextState.roundNumber;
    const actionWindowEntryState = buildQidahenActionWindowEntryState(nextFactionId, {
        selectedRegionId: getPreferredActionWindowSelectedRegionIdForFaction(nextState, nextFactionId),
        selectedWheelMoveId: 'move-1-free',
    });
    const advancedState: QidahenCore = {
        ...nextState,
        currentPlayer: nextState.factions[nextFactionId].playerId,
        roundNumber,
        ...actionWindowEntryState,
        actionLog: [
            {
                id: `log-turn-${timestamp}`,
                faction: nextFactionId,
                text: `轮到 ${nextState.factions[nextFactionId].name} 行动。`,
            },
            ...nextState.actionLog,
        ].slice(0, 6),
    };
    return dependencies.updateTurnLabel(
        beginHandLimitDiscardIfNeeded(advancedState, nextFactionId, timestamp, dependencies),
    );
}
