import type { PlayerId } from '../../../engine/types';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenHandLimitDiscardSelection,
} from './types';

const resolveViewingFactionId = (
    state: QidahenCore,
    viewingPlayerId: PlayerId,
): QidahenFactionId | null => {
    if (state.factionSelection) {
        return null;
    }
    return (
        (Object.entries(state.factions).find(([, faction]) => faction.playerId === viewingPlayerId)?.[0] as QidahenFactionId | undefined)
        ?? null
    );
};

const maskHandLimitDiscardSelection = (
    selection: QidahenHandLimitDiscardSelection | null,
    viewingFactionId: QidahenFactionId | null,
): QidahenHandLimitDiscardSelection | null => {
    if (!selection || !viewingFactionId || selection.factionId !== viewingFactionId) {
        return null;
    }
    return {
        ...selection,
        candidateCardIds: [...selection.candidateCardIds],
        selectedCardIds: [...selection.selectedCardIds],
    };
};

export function playerView(state: QidahenCore, viewingPlayerId: PlayerId): Partial<QidahenCore> {
    const viewingFactionId = resolveViewingFactionId(state, viewingPlayerId);
    const visibleHandCards = viewingFactionId
        ? state.handCards
            .filter((card) => card.faction === viewingFactionId)
            .map((card) => ({ ...card }))
        : [];
    const visibleHandCardIdSet = new Set(visibleHandCards.map((card) => card.id));

    return {
        handCards: visibleHandCards,
        selectedPaymentCardIds: state.selectedPaymentCardIds.filter((cardId) => visibleHandCardIdSet.has(cardId)),
        selectedHandActionCardId: state.selectedHandActionCardId && visibleHandCardIdSet.has(state.selectedHandActionCardId)
            ? state.selectedHandActionCardId
            : null,
        handLimitDiscardSelection: maskHandLimitDiscardSelection(state.handLimitDiscardSelection, viewingFactionId),
    };
}
