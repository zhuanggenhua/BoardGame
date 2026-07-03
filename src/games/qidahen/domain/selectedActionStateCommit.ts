import {
    advanceQidahenTurnIfReady,
} from './turnAdvance';
import {
    applyQidahenVictoryStatus,
} from './victoryResolution';
import {
    buildPaymentState,
    hasRemainingFactionAction,
    syncFactionActionWindow,
} from './factionActionWindow';
import { buildQidahenRegionFocusState } from './regionFocusSemantics';
import { hasActiveCharacter } from './characterPresenceAccessors';
import type {
    QidahenCore,
    QidahenFactionId,
} from './types';

interface QidahenSelectedActionStateCommitDependencies {
    applyVictoryStatus: (
        state: QidahenCore,
        options?: { allowHegemony?: boolean },
    ) => QidahenCore;
    advanceTurnIfReady: (
        state: QidahenCore,
        timestamp: number,
    ) => QidahenCore;
}

interface QidahenSelectedActionStateCommitFollowUp {
    actionLogText: string;
    khanEdictSelection: QidahenCore['khanEdictSelection'];
    lastSeasonSummary: QidahenCore['lastSeasonSummary'];
    maShiTradeSelection: QidahenCore['maShiTradeSelection'];
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    recruitSelection: QidahenCore['recruitSelection'];
    selectedRegionId: string;
    turnPhase: QidahenCore['turnPhase'];
    wheelDispatchProgress: QidahenCore['wheelDispatchProgress'];
}

interface QidahenSelectedActionStateCommitInput {
    actionId: string;
    currentFactionId: QidahenFactionId;
    factions: QidahenCore['factions'];
    followUp: QidahenSelectedActionStateCommitFollowUp;
    paidHandCards: QidahenCore['handCards'];
    regions: QidahenCore['regions'];
    spentCardCount: number;
    timestamp: number;
}

export function commitQidahenSelectedActionState(
    state: QidahenCore,
    input: QidahenSelectedActionStateCommitInput,
    dependencies: QidahenSelectedActionStateCommitDependencies = {
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
    },
): QidahenCore {
    const {
        actionId,
        currentFactionId,
        factions,
        followUp,
        paidHandCards,
        regions,
        spentCardCount,
        timestamp,
    } = input;
    const hasHuangtaijiBonus = currentFactionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-huangtaiji');
    const usedBonusFactionAction = state.factionActionUsed && hasRemainingFactionAction(state, currentFactionId);
    const shouldKeepDriveTigerDispatchSelectionOffHost = followUp.turnPhase === 'drive-tiger-consent';
    const executedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: followUp.selectedRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(followUp.selectedRegionId),
        selectedActionId: actionId,
        confirmedActionId: actionId,
        selectedPaymentCardIds: [],
        selectedHandActionCardId: null,
        recruitSelection: followUp.recruitSelection,
        maShiTradeSelection: followUp.maShiTradeSelection,
        khanEdictSelection: followUp.khanEdictSelection,
        diplomacyProgress: null,
        wheelDispatchProgress: shouldKeepDriveTigerDispatchSelectionOffHost ? null : followUp.wheelDispatchProgress,
        postBattleSelection: null,
        turnPhase: followUp.turnPhase,
        factionActionUsed: true,
        bonusFactionActionAvailable: hasHuangtaijiBonus,
        bonusFactionActionUsed: usedBonusFactionAction,
        lastFactionActionId: actionId,
        payment: buildPaymentState(actionId, 0),
        discardPileCount: state.discardPileCount + spentCardCount,
        drawPileCount: state.drawPileCount,
        handCards: paidHandCards,
        regions,
        factions,
        pendingTargetAction: followUp.pendingTargetAction,
        lastSeasonSummary: followUp.lastSeasonSummary ?? state.lastSeasonSummary,
        actionLog: [
            {
                id: `log-${timestamp}`,
                faction: currentFactionId,
                text: followUp.actionLogText,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(executedState, currentFactionId), timestamp);
}
