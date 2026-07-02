import type { MatchState, RandomFn } from '../../../engine/types';
import { QIDAHEN_COMMANDS } from './commands';
import type {
    QidahenCommand,
    QidahenCore,
    QidahenEvent,
} from './types';
import { getActionChoiceById } from './factionActionWindow';
import { getCurrentFactionId } from './factionTurnAccessors';
import {
    getQidahenDiplomacySelectionFromInteraction,
    getQidahenDriveTigerConsentSelectionFromInteraction,
    getQidahenInternalDispatchSelectionFromInteraction,
    getQidahenWheelDispatchSelectionFromInteraction,
} from './interactionSelectionAccessors';
import { buildQidahenResolvedCommandEvents } from './resolvedCommandEventBuilders';
import type {
    CancelPreviewActionCommand,
    ConfirmPreviewActionCommand,
    ExecuteWheelMoveCommand,
    GaoDiDispatchCardSelectedEvent,
    HandLimitDiscardCardSelectedEvent,
    PaymentCardSelectedEvent,
    PreviewActionConfirmedEvent,
    PreviewActionCancelledEvent,
    QidahenCommand,
    QidahenCore,
    QidahenEvent,
    RegionSelectedEvent,
    SelectGaoDiDispatchCardCommand,
    SelectHandLimitDiscardCardCommand,
    SelectPaymentCardCommand,
    SelectRegionCommand,
    SelectSunYuanhuaTechCardCommand,
    SelectWheelMoveCommand,
    SelectedActionExecutedEvent,
    SunYuanhuaTechCardSelectedEvent,
    WheelMoveSelectedEvent,
} from './types';

type QidahenCommandEventBuilder = (
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
    random: RandomFn,
    timestamp: number,
) => QidahenEvent[] | null;

interface QidahenCommandEventBuilderSpec {
    commandTypes: readonly QidahenCommand['type'][];
    buildEvents: QidahenCommandEventBuilder;
}

type QidahenSelectedActionExecuteCommand =
    | Extract<QidahenCommand, { type: 'EXECUTE_SELECTED_ACTION' }>
    | Extract<QidahenCommand, { type: 'EXECUTE_ACTION' }>;

const getAutoPaymentCardIds = (
    state: QidahenCore,
    actionId: string,
): string[] => {
    const action = getActionChoiceById(actionId);
    if (!action) {
        return [];
    }
    const currentFactionId = getCurrentFactionId(state);
    return state.handCards
        .filter((card) => card.faction === currentFactionId && card.status !== 'disabled')
        .slice(0, action.cost)
        .map((card) => card.id);
};

const buildQidahenSelectedActionExecutedEvent = (
    state: QidahenCore,
    command: QidahenSelectedActionExecuteCommand,
    timestamp: number,
): SelectedActionExecutedEvent => ({
    type: 'SELECTED_ACTION_EXECUTED',
    payload: command.type === 'EXECUTE_SELECTED_ACTION'
        ? {
            actionId: state.confirmedActionId ?? state.selectedActionId,
            cardIds: state.selectedPaymentCardIds,
            playerId: command.playerId,
        }
        : {
            actionId: command.payload.actionId,
            cardIds: getAutoPaymentCardIds(state, command.payload.actionId),
            playerId: command.playerId,
        },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenRegionSelectedEvent = (
    state: MatchState<QidahenCore>,
    command: SelectRegionCommand,
    timestamp: number,
): RegionSelectedEvent => {
    const currentInteraction = state.sys.interaction?.current;
    const driveTigerConsentSelection = getQidahenDriveTigerConsentSelectionFromInteraction(currentInteraction);
    return {
        type: 'REGION_SELECTED',
        payload: {
            regionId: command.payload.regionId,
            playerId: command.playerId,
            qidahenDiplomacySelection: getQidahenDiplomacySelectionFromInteraction(currentInteraction),
            qidahenInternalDispatchSelection: getQidahenInternalDispatchSelectionFromInteraction(currentInteraction),
            qidahenWheelDispatchSelection: getQidahenWheelDispatchSelectionFromInteraction(currentInteraction)
                ?? driveTigerConsentSelection?.dispatchSelection
                ?? null,
        },
        sourceCommandType: command.type,
        timestamp,
    };
};

const buildQidahenPreviewActionConfirmedEvent = (
    command: ConfirmPreviewActionCommand,
    timestamp: number,
): PreviewActionConfirmedEvent => ({
    type: 'PREVIEW_ACTION_CONFIRMED',
    payload: {
        actionId: command.payload.actionId,
        playerId: command.playerId,
        sourceHandCardId: command.payload.sourceHandCardId ?? null,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenPreviewActionCancelledEvent = (
    command: CancelPreviewActionCommand,
    timestamp: number,
): PreviewActionCancelledEvent => ({
    type: 'PREVIEW_ACTION_CANCELLED',
    payload: {
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenWheelMoveSelectedEvent = (
    command: SelectWheelMoveCommand,
    timestamp: number,
): WheelMoveSelectedEvent => ({
    type: 'WHEEL_MOVE_SELECTED',
    payload: {
        moveId: command.payload.moveId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenWheelMoveExecutedEvent = (
    command: ExecuteWheelMoveCommand,
    timestamp: number,
): QidahenEvent => ({
    type: 'WHEEL_MOVE_EXECUTED',
    payload: {
        moveId: command.payload.moveId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenPaymentCardSelectedEvent = (
    command: SelectPaymentCardCommand,
    timestamp: number,
): PaymentCardSelectedEvent => ({
    type: 'PAYMENT_CARD_SELECTED',
    payload: {
        cardId: command.payload.cardId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenHandLimitDiscardCardSelectedEvent = (
    command: SelectHandLimitDiscardCardCommand,
    timestamp: number,
): HandLimitDiscardCardSelectedEvent => ({
    type: 'HAND_LIMIT_DISCARD_CARD_SELECTED',
    payload: {
        cardId: command.payload.cardId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenSunYuanhuaTechCardSelectedEvent = (
    command: SelectSunYuanhuaTechCardCommand,
    timestamp: number,
): SunYuanhuaTechCardSelectedEvent => ({
    type: 'SUN_YUANHUA_TECH_CARD_SELECTED',
    payload: {
        cardId: command.payload.cardId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenGaoDiDispatchCardSelectedEvent = (
    command: SelectGaoDiDispatchCardCommand,
    timestamp: number,
): GaoDiDispatchCardSelectedEvent => ({
    type: 'GAO_DI_DISPATCH_CARD_SELECTED',
    payload: {
        cardId: command.payload.cardId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildSingleCommandEvents = <TCommand>(
    buildEvent: (command: TCommand, timestamp: number) => QidahenEvent,
): QidahenCommandEventBuilder => (
    _state,
    command,
    _random,
    timestamp,
) => [buildEvent(command as TCommand, timestamp)];

const QIDAHEN_COMMAND_EVENT_BUILDERS: readonly QidahenCommandEventBuilderSpec[] = [
    {
        commandTypes: [
            QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD,
            QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE,
            QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
            QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE,
        ],
        buildEvents: buildQidahenResolvedCommandEvents,
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SELECT_REGION],
        buildEvents: (
            state,
            command,
            _random,
            timestamp,
        ) => [buildQidahenRegionSelectedEvent(state, command as SelectRegionCommand, timestamp)],
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
        buildEvents: buildSingleCommandEvents<ConfirmPreviewActionCommand>(
            buildQidahenPreviewActionConfirmedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.CANCEL_PREVIEW_ACTION],
        buildEvents: buildSingleCommandEvents<CancelPreviewActionCommand>(
            buildQidahenPreviewActionCancelledEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE],
        buildEvents: buildSingleCommandEvents<SelectWheelMoveCommand>(
            buildQidahenWheelMoveSelectedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
        buildEvents: buildSingleCommandEvents<ExecuteWheelMoveCommand>(
            buildQidahenWheelMoveExecutedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD],
        buildEvents: buildSingleCommandEvents<SelectPaymentCardCommand>(
            buildQidahenPaymentCardSelectedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD],
        buildEvents: buildSingleCommandEvents<SelectHandLimitDiscardCardCommand>(
            buildQidahenHandLimitDiscardCardSelectedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD],
        buildEvents: buildSingleCommandEvents<SelectSunYuanhuaTechCardCommand>(
            buildQidahenSunYuanhuaTechCardSelectedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD],
        buildEvents: buildSingleCommandEvents<SelectGaoDiDispatchCardCommand>(
            buildQidahenGaoDiDispatchCardSelectedEvent,
        ),
    },
    {
        commandTypes: [
            QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            QIDAHEN_COMMANDS.EXECUTE_ACTION,
        ],
        buildEvents: (state, command, _random, timestamp) => [
            buildQidahenSelectedActionExecutedEvent(
                state.core,
                command as QidahenSelectedActionExecuteCommand,
                timestamp,
            ),
        ],
    },
];

const QIDAHEN_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE = new Map<
    QidahenCommand['type'],
    QidahenCommandEventBuilder
>(
    QIDAHEN_COMMAND_EVENT_BUILDERS.flatMap(({ commandTypes, buildEvents }) => (
        commandTypes.map((commandType) => [commandType, buildEvents] as const)
    )),
);

export function buildQidahenCommandEvents(
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
    random: RandomFn,
    timestamp: number,
): QidahenEvent[] | null {
    return QIDAHEN_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE.get(command.type)?.(
        state,
        command,
        random,
        timestamp,
    ) ?? null;
}
