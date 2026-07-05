import {
    resolveQidahenSelectedArmamentUpgradeExecution,
} from './armamentUpgradeResolution';
import {
    resolveQidahenGrantPardonExecution,
} from './grantPardonExecution';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import {
    resolveQidahenSelectedActionFollowUp,
} from './selectedActionFollowUp';
import {
    prepareQidahenSelectedAction,
} from './selectedActionPreparation';
import {
    resolveQidahenSelectedActionExecutionResolution,
} from './selectedActionExecutionResolution';
import {
    commitQidahenSelectedActionState,
} from './selectedActionStateCommit';
import type {
    QidahenArmamentId,
    QidahenCore,
    QidahenFactionId,
    QidahenSeasonSummary,
} from './types';

type QidahenPreparedSelectedActionResult =
    | {
        kind: 'blocked';
        state: QidahenCore;
    }
    | {
        kind: 'prepared';
        actionLabel: string;
        currentFactionId: QidahenFactionId;
        discardedCardCount: number;
        nextFactions: QidahenCore['factions'];
        paidHandCards: QidahenCore['handCards'];
        selectedEventActionCardDefId: string | null;
        selectedEventActionCardLabel: string | null;
        selectedEventActionCardRemovedFromGame: boolean;
        selectedEventActionCardPersistent: boolean;
        selectedEventActionRulesSummary: string | null;
        selectedHandActionCardLabel: string | null;
        selectedHandActionCardDefId: string | null;
        selectedPaymentResourceLabels: string[];
        selectedArmamentId: QidahenArmamentId | null;
        spentCardCount: number;
    };

interface QidahenSelectedActionExecutionDependencies {
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    resolveGrantPardonExecution: (
        state: QidahenCore,
        factions: QidahenCore['factions'],
        timestamp: number,
    ) => {
        factions: QidahenCore['factions'];
        lastSeasonSummary: QidahenSeasonSummary | null;
        regions: QidahenCore['regions'];
        selectedRegionId: string;
    };
    resolveSelectedArmamentUpgradeExecution: (
        state: QidahenCore,
        factions: QidahenCore['factions'],
        currentFactionId: QidahenFactionId,
        selectedArmamentId: QidahenArmamentId | null,
        selectedHandActionCardLabel: string | null,
        selectedHandActionCardDefId: string | null,
        timestamp: number,
    ) => {
        factions: QidahenCore['factions'];
        lastSeasonSummary: QidahenSeasonSummary | null;
    };
    prepareSelectedAction: (
        state: QidahenCore,
        playerId: string,
        actionId: string,
        cardIds: readonly string[],
        timestamp: number,
    ) => QidahenPreparedSelectedActionResult;
    commitSelectedActionState: (
        state: QidahenCore,
        input: {
            actionId: string;
            currentFactionId: QidahenFactionId;
            discardedCardCount: number;
            factions: QidahenCore['factions'];
            followUp: {
                actionLogText: string;
                lastSeasonSummary: QidahenSeasonSummary | null;
                pendingTargetAction: QidahenCore['pendingTargetAction'];
                selectedRegionId: string;
                turnPhase: QidahenCore['turnPhase'];
                wheelDispatchProgress: QidahenCore['wheelDispatchProgress'];
            };
            paidHandCards: QidahenCore['handCards'];
            regions: QidahenCore['regions'];
            selectedEventActionCardDefId: string | null;
            selectedEventActionCardLabel: string | null;
            selectedEventActionCardPersistent: boolean;
            selectedEventActionRulesSummary: string | null;
            spentCardCount: number;
            timestamp: number;
        },
    ) => QidahenCore;
}

export const executeQidahenSelectedAction = (
    state: QidahenCore,
    playerId: string,
    actionId: string,
    cardIds: readonly string[],
    timestamp: number,
    dependencies: QidahenSelectedActionExecutionDependencies = {
        prepareSelectedAction: prepareQidahenSelectedAction,
        buildSeasonSummary,
        resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,
        resolveSelectedArmamentUpgradeExecution: resolveQidahenSelectedArmamentUpgradeExecution,
        commitSelectedActionState: commitQidahenSelectedActionState,
    },
): QidahenCore => {
    const preparation = dependencies.prepareSelectedAction(
        state,
        playerId,
        actionId,
        cardIds,
        timestamp,
    );
    if (preparation.kind === 'blocked') {
        return preparation.state;
    }
    const {
        actionLabel,
        currentFactionId,
        discardedCardCount,
        nextFactions: preparedFactions,
        paidHandCards,
        selectedEventActionCardDefId,
        selectedEventActionCardLabel,
        selectedEventActionCardRemovedFromGame,
        selectedEventActionCardPersistent,
        selectedEventActionRulesSummary,
        selectedHandActionCardLabel,
        selectedHandActionCardDefId,
        selectedPaymentResourceLabels,
        selectedArmamentId,
        spentCardCount,
    } = preparation;
    const executionResolution = resolveQidahenSelectedActionExecutionResolution(
        state,
        actionId,
        currentFactionId,
        selectedEventActionCardDefId,
        selectedEventActionCardLabel,
        selectedArmamentId,
        selectedHandActionCardLabel,
        selectedHandActionCardDefId,
        preparedFactions,
        selectedEventActionCardPersistent,
        selectedEventActionRulesSummary,
        timestamp,
        dependencies,
    );

    const followUp = resolveQidahenSelectedActionFollowUp(
        state,
        currentFactionId,
        actionId,
        actionLabel,
        selectedEventActionCardDefId,
        selectedEventActionCardLabel,
        selectedEventActionCardRemovedFromGame,
        selectedEventActionRulesSummary,
        discardedCardCount,
        spentCardCount,
        selectedPaymentResourceLabels,
        timestamp,
        executionResolution.selectedRegionId,
        executionResolution.lastSeasonSummary,
        dependencies,
    );
    return dependencies.commitSelectedActionState(state, {
        actionId,
        currentFactionId,
        discardedCardCount,
        factions: executionResolution.factions,
        followUp,
        paidHandCards,
        regions: executionResolution.regions,
        selectedEventActionCardDefId,
        selectedEventActionCardLabel,
        selectedEventActionCardPersistent,
        selectedEventActionRulesSummary,
        spentCardCount,
        timestamp,
    });
};
