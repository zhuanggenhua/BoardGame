import { updateQidahenTurnLabel } from './turnLabelState';
import type { QidahenCore } from './types';

interface QidahenHandLimitDiscardDependencies {
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
}

export const resolveQidahenHandLimitDiscard = (
    state: QidahenCore,
    timestamp: number,
    dependencies: QidahenHandLimitDiscardDependencies = {
        updateTurnLabel: updateQidahenTurnLabel,
    },
): QidahenCore => {
    const selection = state.handLimitDiscardSelection;
    if (!selection || selection.selectedCardIds.length < selection.requiredDiscardCount) {
        return state;
    }
    const selectedCardIds = selection.selectedCardIds.slice(0, selection.requiredDiscardCount);
    const removedCardIds = new Set(selectedCardIds);
    const faction = state.factions[selection.factionId];
    return dependencies.updateTurnLabel({
        ...state,
        turnPhase: 'action-window',
        handLimitDiscardSelection: null,
        factions: {
            ...state.factions,
            [selection.factionId]: {
                ...faction,
                handCount: Math.max(0, faction.handCount - selectedCardIds.length),
                discardPileCount: Math.max(0, faction.discardPileCount ?? 0) + selectedCardIds.length,
            },
        },
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        actionLog: [
            {
                id: `log-hand-limit-resolved-${timestamp}`,
                faction: selection.factionId,
                text: `${selection.factionName} 已按手牌上限弃掉 ${selectedCardIds.length} 张牌。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
};

export const resolveQidahenHandLimitDiscardInteractionChoice = (
    state: QidahenCore,
    selectedCardIds: readonly string[],
    timestamp: number,
    dependencies: QidahenHandLimitDiscardDependencies = {
        updateTurnLabel: updateQidahenTurnLabel,
    },
): QidahenCore => {
    const selection = state.handLimitDiscardSelection;
    if (!selection) {
        return state;
    }
    const seen = new Set<string>();
    const nextSelectedCardIds = selectedCardIds
        .filter((cardId) => {
            if (seen.has(cardId) || !selection.candidateCardIds.includes(cardId)) {
                return false;
            }
            seen.add(cardId);
            return true;
        })
        .slice(0, selection.requiredDiscardCount);

    return resolveQidahenHandLimitDiscard({
        ...state,
        handLimitDiscardSelection: {
            ...selection,
            selectedCardIds: nextSelectedCardIds,
        },
    }, timestamp, dependencies);
};
