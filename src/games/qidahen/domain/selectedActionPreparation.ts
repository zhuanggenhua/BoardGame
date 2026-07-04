import {
    resolveSelectedArmamentIdFromCards,
} from './armamentLowFidelity';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { updateQidahenTurnLabel } from './turnLabelState';
import { getActionChoiceById } from './factionActionWindow';
import { getFactionIdByPlayerId } from './factionTurnAccessors';
import { getMarriageSubjugationBlockedReason } from './pendingTargetActionBuilder';
import type {
    QidahenArmamentId,
    QidahenCore,
    QidahenSeasonSummary,
} from './types';

interface QidahenSelectedActionPreparationDependencies {
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
    resolveSelectedArmamentIdFromCards: (
        handCards: QidahenCore['handCards'],
        cardIds: readonly string[],
    ) => QidahenArmamentId | null;
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
}

interface QidahenSelectedActionPreparedState {
    actionLabel: string;
    currentFactionId: ReturnType<typeof getFactionIdByPlayerId>;
    nextFactions: QidahenCore['factions'];
    paidHandCards: QidahenCore['handCards'];
    selectedHandActionCardLabel: string | null;
    selectedSilverPaymentCardLabels: string[];
    selectedArmamentId: QidahenArmamentId | null;
    spentCardCount: number;
}

type QidahenSelectedActionPreparationResult =
    | {
        kind: 'blocked';
        state: QidahenCore;
    }
    | ({
        kind: 'prepared';
    } & QidahenSelectedActionPreparedState);

export function prepareQidahenSelectedAction(
    state: QidahenCore,
    playerId: string,
    actionId: string,
    cardIds: readonly string[],
    timestamp: number,
    dependencies: QidahenSelectedActionPreparationDependencies = {
        updateTurnLabel: updateQidahenTurnLabel,
        resolveSelectedArmamentIdFromCards,
        buildSeasonSummary,
    },
): QidahenSelectedActionPreparationResult {
    const currentFactionId = getFactionIdByPlayerId(state, playerId);
    const currentFactionCardIds = new Set(
        state.handCards
            .filter((card) => card.faction === currentFactionId)
            .map((card) => card.id),
    );
    const spentCardIds = cardIds.filter((cardId) => currentFactionCardIds.has(cardId));
    const selectedCardIds = new Set(spentCardIds);
    const spentCardCount = spentCardIds.length;
    const selectedArmamentId = dependencies.resolveSelectedArmamentIdFromCards(state.handCards, spentCardIds);
    const selectedHandActionCardLabel = actionId === 'upgrade-armament'
        ? state.handCards.find((card) => (
            spentCardIds.includes(card.id)
            && card.cardKind === 'armament'
            && card.armamentId === selectedArmamentId
        ))?.label ?? null
        : null;
    const selectedSilverPaymentCardLabels = state.handCards
        .filter((card) => spentCardIds.includes(card.id) && card.cardKind === 'silver')
        .map((card) => card.label);
    const actionLabel = getActionChoiceById(actionId)?.label ?? actionId;
    const marriageSubjugationBlockedReason = actionId === 'marriage-subjugation'
        ? getMarriageSubjugationBlockedReason(
            state,
            state.regions.find((region) => region.id === state.selectedRegionId),
        )
        : null;

    if (marriageSubjugationBlockedReason) {
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                lastSeasonSummary: dependencies.buildSeasonSummary('联姻诱降', timestamp, [
                    marriageSubjugationBlockedReason,
                ]),
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: currentFactionId,
                        text: `${state.factions[currentFactionId].name} 尝试执行 ${actionLabel}，但 ${marriageSubjugationBlockedReason}`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            }),
        };
    }

    return {
        kind: 'prepared',
        actionLabel,
        currentFactionId,
        nextFactions: {
            ...state.factions,
            [currentFactionId]: {
                ...state.factions[currentFactionId],
                handCount: Math.max(0, state.factions[currentFactionId].handCount - spentCardCount),
                discardPileCount: Math.max(0, state.factions[currentFactionId].discardPileCount ?? 0) + spentCardCount,
            },
        },
        paidHandCards: state.handCards.filter((card) => !selectedCardIds.has(card.id)),
        selectedHandActionCardLabel,
        selectedSilverPaymentCardLabels,
        selectedArmamentId,
        spentCardCount,
    };
}
