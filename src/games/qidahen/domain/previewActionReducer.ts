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
    selectedPaymentCardIds: [],
    payment: buildPaymentState(actionId),
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
