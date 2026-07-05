import {
    hasUpgradableArmament,
    resolveSelectedArmamentIdFromCards,
} from './armamentLowFidelity';
import { getCurrentFactionId } from './factionTurnAccessors';
import {
    buildPaymentState,
    computeQidahenSelectedPaymentValue,
    getQidahenSelectedActionCost,
    getQidahenSelectedActionPaymentProgress,
} from './factionActionWindow';
import { resolveQidahenHandLimitDiscard } from './handLimitDiscard';
import { isSunYuanhuaEnabled } from './characterAbilitySemantics';
import {
    buildQidahenWheelMoveSummary,
    getQidahenWheelMoveById,
} from './wheelMoves';
import { updateQidahenTurnLabel } from './turnLabelState';
import type {
    QidahenCore,
    QidahenEvent,
    QidahenHandCard,
} from './types';

type QidahenWheelMoveSelectedEvent = Extract<
    QidahenEvent,
    { type: 'WHEEL_MOVE_SELECTED' }
>;

type QidahenPaymentCardSelectedEvent = Extract<
    QidahenEvent,
    { type: 'PAYMENT_CARD_SELECTED' }
>;

type QidahenHandLimitDiscardCardSelectedEvent = Extract<
    QidahenEvent,
    { type: 'HAND_LIMIT_DISCARD_CARD_SELECTED' }
>;

type QidahenSunYuanhuaTechCardSelectedEvent = Extract<
    QidahenEvent,
    { type: 'SUN_YUANHUA_TECH_CARD_SELECTED' }
>;

type QidahenGaoDiDispatchCardSelectedEvent = Extract<
    QidahenEvent,
    { type: 'GAO_DI_DISPATCH_CARD_SELECTED' }
>;

type QidahenHandLimitDiscardResolvedEvent = Extract<
    QidahenEvent,
    { type: 'HAND_LIMIT_DISCARD_RESOLVED' }
>;

export type QidahenSelectionInputEvent =
    | QidahenWheelMoveSelectedEvent
    | QidahenPaymentCardSelectedEvent
    | QidahenHandLimitDiscardCardSelectedEvent
    | QidahenSunYuanhuaTechCardSelectedEvent
    | QidahenGaoDiDispatchCardSelectedEvent
    | QidahenHandLimitDiscardResolvedEvent;

interface QidahenSelectionInputStateDependencies {
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
}

const toggleQidahenHandLimitDiscardCard = (
    selection: QidahenCore['handLimitDiscardSelection'],
    cardId: string,
): QidahenCore['handLimitDiscardSelection'] => {
    if (!selection || !selection.candidateCardIds.includes(cardId)) {
        return selection;
    }
    const selected = selection.selectedCardIds.includes(cardId)
        ? selection.selectedCardIds.filter((selectedId) => selectedId !== cardId)
        : selection.selectedCardIds.length >= selection.requiredDiscardCount
            ? selection.selectedCardIds
            : [...selection.selectedCardIds, cardId];
    return {
        ...selection,
        selectedCardIds: selected,
    };
};

const toggleQidahenGaoDiDispatchCard = (
    selection: QidahenCore['gaoDiDispatchSelection'],
    cardId: string,
): QidahenCore['gaoDiDispatchSelection'] => {
    if (!selection || !selection.candidateCardIds.includes(cardId)) {
        return selection;
    }
    return {
        ...selection,
        selectedCardId: selection.selectedCardId === cardId ? null : cardId,
    };
};

const toggleQidahenPaymentCard = (
    state: QidahenCore,
    cardId: string,
): string[] => {
    const currentFactionId = getCurrentFactionId(state);
    const card = state.handCards.find((item) => item.id === cardId);
    if (!card || card.faction !== currentFactionId || card.status === 'disabled') {
        return state.selectedPaymentCardIds;
    }

    if (state.selectedHandActionCardId === cardId) {
        return state.selectedPaymentCardIds;
    }

    if (state.selectedPaymentCardIds.includes(cardId)) {
        return state.selectedPaymentCardIds.filter((selectedId) => selectedId !== cardId);
    }

    if (state.payment.selected >= state.payment.required) {
        return state.selectedPaymentCardIds;
    }

    return [...state.selectedPaymentCardIds, cardId];
};

export const buildQidahenSunYuanhuaTechSelection = (
    state: QidahenCore,
    selectedCardIds: string[] = [],
): QidahenCore['sunYuanhuaTechSelection'] => {
    if (!isSunYuanhuaEnabled(state) || !hasUpgradableArmament(state, 'ming')) {
        return null;
    }
    const candidateCardIds = state.handCards
        .filter((card) => card.faction === 'ming' && card.status !== 'disabled')
        .map((card) => card.id);
    if (candidateCardIds.length < 2) {
        return null;
    }
    const nextSelectedCardIds = selectedCardIds.filter((cardId) => candidateCardIds.includes(cardId)).slice(0, 2);
    return {
        source: 'sun-yuanhua',
        title: '孙元化弃牌科技',
        summary: '袁崇焕在场时，行动前可弃 2 张手牌，推进 1 项科技。',
        requiredCardCount: 2,
        candidateCardIds,
        selectedCardIds: nextSelectedCardIds,
        armamentId: resolveSelectedArmamentIdFromCards(state.handCards, nextSelectedCardIds),
    };
};

const toggleQidahenSunYuanhuaTechCard = (
    selection: QidahenCore['sunYuanhuaTechSelection'],
    handCards: readonly QidahenHandCard[],
    cardId: string,
): QidahenCore['sunYuanhuaTechSelection'] => {
    if (!selection || !selection.candidateCardIds.includes(cardId)) {
        return selection;
    }
    const selectedCardIds = selection.selectedCardIds.includes(cardId)
        ? selection.selectedCardIds.filter((selectedId) => selectedId !== cardId)
        : selection.selectedCardIds.length >= selection.requiredCardCount
            ? selection.selectedCardIds
            : [...selection.selectedCardIds, cardId];
    return {
        ...selection,
        selectedCardIds,
        armamentId: resolveSelectedArmamentIdFromCards(handCards, selectedCardIds),
    };
};

export const reduceQidahenSelectionInputEvent = (
    state: QidahenCore,
    event: QidahenSelectionInputEvent,
    dependencies: QidahenSelectionInputStateDependencies = {
        updateTurnLabel: updateQidahenTurnLabel,
    },
): QidahenCore => {
    switch (event.type) {
        case 'WHEEL_MOVE_SELECTED': {
            const move = getQidahenWheelMoveById(event.payload.moveId);
            if (!move) {
                return state;
            }
            return dependencies.updateTurnLabel({
                ...state,
                selectedWheelMoveId: move.id,
                wheelMoveSummary: buildQidahenWheelMoveSummary(move.id),
            });
        }
        case 'PAYMENT_CARD_SELECTED': {
            const selectedPaymentCardIds = toggleQidahenPaymentCard(state, event.payload.cardId);
            return dependencies.updateTurnLabel({
                ...state,
                selectedPaymentCardIds,
                payment: buildPaymentState(
                    state.confirmedActionId ?? state.selectedActionId,
                    computeQidahenSelectedPaymentValue(state.handCards, selectedPaymentCardIds),
                    getQidahenSelectedActionCost(state, state.confirmedActionId ?? state.selectedActionId),
                    getQidahenSelectedActionPaymentProgress(
                        {
                            ...state,
                            selectedPaymentCardIds,
                        },
                        state.confirmedActionId ?? state.selectedActionId,
                    ),
                ),
            });
        }
        case 'HAND_LIMIT_DISCARD_CARD_SELECTED':
            return dependencies.updateTurnLabel({
                ...state,
                handLimitDiscardSelection: toggleQidahenHandLimitDiscardCard(state.handLimitDiscardSelection, event.payload.cardId),
            });
        case 'SUN_YUANHUA_TECH_CARD_SELECTED':
            return dependencies.updateTurnLabel({
                ...state,
                sunYuanhuaTechSelection: toggleQidahenSunYuanhuaTechCard(state.sunYuanhuaTechSelection, state.handCards, event.payload.cardId),
            });
        case 'GAO_DI_DISPATCH_CARD_SELECTED':
            return dependencies.updateTurnLabel({
                ...state,
                gaoDiDispatchSelection: toggleQidahenGaoDiDispatchCard(state.gaoDiDispatchSelection, event.payload.cardId),
            });
        case 'HAND_LIMIT_DISCARD_RESOLVED':
            return resolveQidahenHandLimitDiscard(state, event.timestamp, dependencies);
    }
};
