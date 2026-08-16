import {
    resolveQidahenPreviewActionCancelledEvent,
    resolveQidahenPreviewActionConfirmedEvent,
} from './previewActionReducer';
import {
    reduceQidahenRegionSelected,
} from './regionSelectionReducer';
import {
    reduceQidahenSelectionInputEvent,
} from './selectionInputState';
import {
    resolveQidahenWheelMoveExecuted,
} from './wheelMoveExecution';
import {
    reduceQidahenDefeatInDetailRegionSelected,
} from './defeatInDetail';
import type {
    QidahenCore,
    QidahenEvent,
} from './types';

type QidahenDirectInputEventType = QidahenEvent['type'];

interface QidahenDirectInputEventReducerSpec<TEventType extends QidahenDirectInputEventType = QidahenDirectInputEventType> {
    eventTypes: readonly TEventType[];
    reduce: (
        state: QidahenCore,
        event: Extract<QidahenEvent, { type: TEventType }>,
    ) => QidahenCore;
}

type QidahenDirectInputEventReducerRuntimeSpec = {
    eventTypes: readonly QidahenDirectInputEventType[];
    reduce: (
        state: QidahenCore,
        event: never,
    ) => QidahenCore;
};

const defineDirectInputEventReducer = <TEventType extends QidahenDirectInputEventType>(
    eventTypes: readonly TEventType[],
    reduce: (
        state: QidahenCore,
        event: Extract<QidahenEvent, { type: TEventType }>,
    ) => QidahenCore,
): QidahenDirectInputEventReducerSpec<TEventType> => ({
    eventTypes,
    reduce,
});

const QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS_BY_EVENT_TYPE = new Map<
    QidahenDirectInputEventType,
    QidahenDirectInputEventReducerRuntimeSpec
>();

const QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS = [
    defineDirectInputEventReducer(
        ['REGION_SELECTED'],
        (state, event) => reduceQidahenDefeatInDetailRegionSelected(
            state,
            event.payload.regionId,
            event.timestamp,
        ) ?? reduceQidahenRegionSelected(
            state,
            event.payload.regionId,
            event.timestamp,
            event.payload.qidahenDiplomacySelection ?? null,
            event.payload.qidahenInternalDispatchSelection ?? null,
            event.payload.qidahenWheelDispatchSelection ?? null,
        ),
    ),
    defineDirectInputEventReducer(
        ['PREVIEW_ACTION_CONFIRMED'],
        resolveQidahenPreviewActionConfirmedEvent,
    ),
    defineDirectInputEventReducer(
        ['PREVIEW_ACTION_CANCELLED'],
        resolveQidahenPreviewActionCancelledEvent,
    ),
    defineDirectInputEventReducer(
        ['WHEEL_MOVE_EXECUTED'],
        (state, event) => resolveQidahenWheelMoveExecuted(
            state,
            event.payload.moveId,
            event.timestamp,
        ),
    ),
    defineDirectInputEventReducer(
        [
            'WHEEL_MOVE_SELECTED',
            'PAYMENT_CARD_SELECTED',
            'HAND_LIMIT_DISCARD_CARD_SELECTED',
            'SUN_YUANHUA_TECH_CARD_SELECTED',
            'GAO_DI_DISPATCH_CARD_SELECTED',
            'HAND_LIMIT_DISCARD_RESOLVED',
        ],
        reduceQidahenSelectionInputEvent,
    ),
] as const satisfies readonly QidahenDirectInputEventReducerRuntimeSpec[];

for (const reducer of QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS) {
    for (const eventType of reducer.eventTypes) {
        QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS_BY_EVENT_TYPE.set(eventType, reducer);
    }
}

export const reduceQidahenDirectInputEvent = (
    state: QidahenCore,
    event: QidahenEvent,
): QidahenCore | null => {
    const reducer = QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS_BY_EVENT_TYPE.get(event.type);
    return reducer
        ? reducer.reduce(state, event as never)
        : null;
};
