import {
    buildPaymentState,
    getActionChoiceById,
} from './factionActionWindow';
import { getCurrentFactionId } from './factionTurnAccessors';
import { getQidahenDirectActionIdForHandCard } from './handCardIdentity';
import { updateQidahenTurnLabel } from './turnLabelState';
import type {
    QidahenCore,
    QidahenEvent,
} from './types';

type QidahenPreviewActionConfirmedEvent = Extract<
    QidahenEvent,
    { type: 'PREVIEW_ACTION_CONFIRMED' }
>;

type QidahenPreviewActionCancelledEvent = Extract<
    QidahenEvent,
    { type: 'PREVIEW_ACTION_CANCELLED' }
>;

interface QidahenPreviewActionConfirmedDependencies {
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
}

const reduceQidahenPreviewActionConfirmed = (
    state: QidahenCore,
    actionId: string,
    sourceHandCardId: string | null | undefined,
    _timestamp: number,
    dependencies: QidahenPreviewActionConfirmedDependencies,
): QidahenCore => {
    const sourceCard = sourceHandCardId
        ? state.handCards.find((card) => (
            card.id === sourceHandCardId
            && card.faction === getCurrentFactionId(state)
            && card.status !== 'disabled'
            && getQidahenDirectActionIdForHandCard(card) === actionId
        ))
        : null;
    const selectedPaymentCardIds = sourceCard ? [sourceCard.id] : [];
    return dependencies.updateTurnLabel({
        ...state,
        selectedActionId: actionId,
        confirmedActionId: actionId,
        selectedPaymentCardIds,
        selectedHandActionCardId: sourceCard?.id ?? null,
        payment: buildPaymentState(actionId, selectedPaymentCardIds.length),
    });
};

const reduceQidahenPreviewActionCancelled = (
    state: QidahenCore,
    dependencies: QidahenPreviewActionConfirmedDependencies,
): QidahenCore => dependencies.updateTurnLabel({
    ...state,
    confirmedActionId: null,
    selectedPaymentCardIds: [],
    selectedHandActionCardId: null,
    payment: buildPaymentState(state.selectedActionId, 0),
});

export const resolveQidahenPreviewActionConfirmedEvent = (
    state: QidahenCore,
    event: QidahenPreviewActionConfirmedEvent,
    dependencies: QidahenPreviewActionConfirmedDependencies = {
        updateTurnLabel: updateQidahenTurnLabel,
    },
): QidahenCore => getActionChoiceById(event.payload.actionId)
    ? reduceQidahenPreviewActionConfirmed(
        state,
        event.payload.actionId,
        event.payload.sourceHandCardId,
        event.timestamp,
        dependencies,
    )
    : {
        ...state,
        actionWheelPosition: event.payload.actionId,
    };

export const resolveQidahenPreviewActionCancelledEvent = (
    state: QidahenCore,
    _event: QidahenPreviewActionCancelledEvent,
    dependencies: QidahenPreviewActionConfirmedDependencies = {
        updateTurnLabel: updateQidahenTurnLabel,
    },
): QidahenCore => reduceQidahenPreviewActionCancelled(
    state,
    dependencies,
);
