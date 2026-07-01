import {
    buildPaymentState,
    getActionChoiceById,
} from './factionActionWindow';
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
    _timestamp: number,
    dependencies: QidahenPreviewActionConfirmedDependencies,
): QidahenCore => dependencies.updateTurnLabel({
    ...state,
    selectedActionId: actionId,
    confirmedActionId: actionId,
    selectedPaymentCardIds: [],
    payment: buildPaymentState(actionId),
});

const reduceQidahenPreviewActionCancelled = (
    state: QidahenCore,
    dependencies: QidahenPreviewActionConfirmedDependencies,
): QidahenCore => dependencies.updateTurnLabel({
    ...state,
    confirmedActionId: null,
    selectedPaymentCardIds: [],
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
