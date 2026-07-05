import {
    buildPaymentState,
    computeQidahenSelectedPaymentValue,
    getActionChoiceById,
    getQidahenSelectedActionCost,
    getQidahenSelectedActionPaymentProgress,
} from './factionActionWindow';
import { getCurrentFactionId } from './factionTurnAccessors';
import { getQidahenDirectActionIdForHandCard } from './handCardIdentity';
import { getQidahenExplicitRegionSelectionSemantics } from './regionFocusSemantics';
import { buildGrantPardonSelectionFromRegionSemantics } from './selectionBuilders';
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
    const grantPardonSelection = actionId === 'grant-pardon'
        ? buildGrantPardonSelectionFromRegionSemantics(
            state,
            getQidahenExplicitRegionSelectionSemantics(state, state.selectedRegionId),
        )
        : null;
    const nextState: QidahenCore = {
        ...state,
        selectedActionId: actionId,
        confirmedActionId: actionId,
        selectedPaymentCardIds: grantPardonSelection ? [] : selectedPaymentCardIds,
        selectedHandActionCardId: sourceCard?.id ?? null,
        grantPardonSelection,
        turnPhase: grantPardonSelection ? 'grant-pardon-choice' : state.turnPhase,
        payment: state.payment,
    };
    if (grantPardonSelection) {
        return dependencies.updateTurnLabel({
            ...nextState,
            payment: buildPaymentState(actionId, 0),
        });
    }
    return dependencies.updateTurnLabel({
        ...nextState,
        payment: buildPaymentState(
            actionId,
            computeQidahenSelectedPaymentValue(state.handCards, selectedPaymentCardIds),
            getQidahenSelectedActionCost(nextState, actionId),
            getQidahenSelectedActionPaymentProgress(nextState, actionId),
        ),
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
