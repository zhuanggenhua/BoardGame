import { getCurrentFactionId } from './factionTurnAccessors';
import { updateQidahenTurnLabel } from './turnLabelState';
import type { QidahenCore, QidahenPaymentState } from './types';

export const QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED = 1;

const WHEEL_DISPATCH_PAYMENT_POSITIONS = new Set([
    'wheel-diplomacy',
    'wheel-hire',
]);

export const isQidahenWheelDispatchPaymentPosition = (positionId: string): boolean => (
    WHEEL_DISPATCH_PAYMENT_POSITIONS.has(positionId)
);

export const buildQidahenWheelDispatchPaymentState = (
    selectedCardCount = 0,
): QidahenPaymentState => {
    const selected = Math.min(selectedCardCount, QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED);
    return {
        required: QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED,
        selected,
        prompt: `需弃 ${QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED} / 已选 ${selected}`,
    };
};

export const isQidahenWheelDispatchPaymentPending = (
    state: Pick<QidahenCore, 'turnPhase' | 'wheelActionUsed' | 'actionWheelPosition' | 'payment'>,
): boolean => (
    state.turnPhase === 'dispatch-targeting'
    && state.wheelActionUsed
    && isQidahenWheelDispatchPaymentPosition(state.actionWheelPosition)
    && state.payment.required > 0
);

export const countQidahenWheelDispatchPayableCards = (state: QidahenCore): number => {
    const currentFactionId = getCurrentFactionId(state);
    return state.handCards.filter((card) => (
        card.faction === currentFactionId
        && card.status !== 'disabled'
    )).length;
};

export const resolveQidahenWheelDispatchPayment = (
    state: QidahenCore,
    timestamp: number,
): QidahenCore => {
    if (!isQidahenWheelDispatchPaymentPending(state)) {
        return state;
    }
    const currentFactionId = getCurrentFactionId(state);
    const selectedCardIds = state.selectedPaymentCardIds.slice(0, QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED);
    if (selectedCardIds.length < QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED) {
        return state;
    }
    const removedCardIds = new Set(selectedCardIds);
    const faction = state.factions[currentFactionId];
    const discardedCardCount = selectedCardIds.length;
    return updateQidahenTurnLabel({
        ...state,
        selectedPaymentCardIds: [],
        payment: {
            required: 0,
            selected: 0,
            prompt: '进攻调度弃牌已完成',
        },
        factions: {
            ...state.factions,
            [currentFactionId]: {
                ...faction,
                handCount: Math.max(0, faction.handCount - discardedCardCount),
                discardPileCount: Math.max(0, faction.discardPileCount ?? 0) + discardedCardCount,
            },
        },
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        actionLog: [
            {
                id: `log-wheel-dispatch-payment-${timestamp}`,
                faction: currentFactionId,
                text: `${faction.name} 已弃 ${discardedCardCount} 张手牌，开始进攻调度。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
};
