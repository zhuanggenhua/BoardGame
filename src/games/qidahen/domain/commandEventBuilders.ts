import type { MatchState, RandomFn } from '../../../engine/types';
import { QIDAHEN_COMMANDS } from './commands';
import { createQidahenStructuredBattleRolls } from './battleRollMath';
import {
    isQidahenFeignedRetreatCardPlayable,
} from './feignedRetreatSelection';
import {
    getActionChoiceById,
    getQidahenHandCardPaymentValue,
} from './factionActionWindow';
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
    PlayBattleResponseEventCardCommand,
    PreviewActionConfirmedEvent,
    PreviewActionCancelledEvent,
    QidahenCommand,
    QidahenCore,
    QidahenEvent,
    RegionSelectedEvent,
    SelectGaoDiDispatchCardCommand,
    SelectHandLimitDiscardCardCommand,
    SelectPaymentCardCommand,
    PlayTacticCardCommand,
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
    const paymentCardIds: string[] = [];
    let paymentValue = 0;
    for (const card of state.handCards.filter((card) => card.faction === currentFactionId && card.status !== 'disabled')) {
        if (paymentValue >= action.cost) {
            break;
        }
        paymentCardIds.push(card.id);
        paymentValue += getQidahenHandCardPaymentValue(card);
    }
    return paymentCardIds;
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

const buildQidahenTacticCardPlayedEvent = (
    command: PlayTacticCardCommand,
    timestamp: number,
): QidahenEvent => ({
    type: 'TACTIC_CARD_PLAYED',
    payload: {
        cardId: command.payload.cardId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenTacticCardPlayedEvents: QidahenCommandEventBuilder = (
    state,
    command,
    random,
    timestamp,
) => {
    const tacticCommand = command as PlayTacticCardCommand;
    const playedEvent = buildQidahenTacticCardPlayedEvent(tacticCommand, timestamp);
    const selection = state.core.feignedRetreatSelection;
    const card = state.core.handCards.find((candidate) => candidate.id === tacticCommand.payload.cardId);
    if (!selection || !card || !isQidahenFeignedRetreatCardPlayable(state.core, card)) {
        return [playedEvent];
    }
    return [
        playedEvent,
        {
            type: 'PENDING_ACTION_RESOLVED',
            payload: {
                ...selection.cavalryPlunderPayload,
                pendingTargetAction: {
                    ...selection.pendingTargetAction,
                },
                attackerCavalryPlunder: false,
                battleRolls: createQidahenStructuredBattleRolls(
                    state.core,
                    selection.pendingTargetAction,
                    random,
                    {
                        defenderSortieBattle: selection.cavalryPlunderPayload.defenderSortieBattle === true,
                        defenderHoldCity: selection.cavalryPlunderPayload.defenderHoldCity === true,
                        defenderCavalryEvasion: selection.cavalryPlunderPayload.defenderCavalryEvasion === true,
                        attackerCavalryPlunder: false,
                    },
                ),
                feignedRetreatResponseResolved: true,
            },
            sourceCommandType: tacticCommand.type,
            timestamp: timestamp + 1,
        },
    ];
};

const buildQidahenBattleResponseEventCardPlayedEvent = (
    command: PlayBattleResponseEventCardCommand,
    timestamp: number,
): QidahenEvent => ({
    type: 'BATTLE_RESPONSE_EVENT_CARD_PLAYED',
    payload: {
        cardId: command.payload.cardId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenPincerAdvanceTroopToggledEvent = (
    command: Extract<QidahenCommand, { type: 'TOGGLE_PINCER_ADVANCE_TROOP' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'PINCER_ADVANCE_TROOP_TOGGLED',
    payload: {
        choiceId: command.payload.choiceId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenPincerAdvanceResolvedEvent = (
    command: Extract<QidahenCommand, { type: 'RESOLVE_PINCER_ADVANCE' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'PINCER_ADVANCE_RESOLVED',
    payload: {
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenPincerAdvanceCancelledEvent = (
    command: Extract<QidahenCommand, { type: 'CANCEL_PINCER_ADVANCE' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'PINCER_ADVANCE_CANCELLED',
    payload: {
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenInfantryCavalryCombinedResolvedEvent = (
    command: Extract<QidahenCommand, { type: 'RESOLVE_INFANTRY_CAVALRY_COMBINED' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'INFANTRY_CAVALRY_COMBINED_RESOLVED',
    payload: {
        mode: command.payload.mode,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenInstigateDefectionResolvedEvent = (
    command: Extract<QidahenCommand, { type: 'RESOLVE_INSTIGATE_DEFECTION' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'INSTIGATE_DEFECTION_RESOLVED',
    payload: {
        choiceId: command.payload.choiceId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenInstigateDefectionCancelledEvent = (
    command: Extract<QidahenCommand, { type: 'CANCEL_INSTIGATE_DEFECTION' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'INSTIGATE_DEFECTION_CANCELLED',
    payload: {
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenWuzhenChaohaArtilleryTechCountSetEvent = (
    command: Extract<QidahenCommand, { type: 'SET_WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT_SET',
    payload: {
        count: command.payload.count,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenWuzhenChaohaResolvedEvent = (
    command: Extract<QidahenCommand, { type: 'RESOLVE_WUZHEN_CHAOHA' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'WUZHEN_CHAOHA_RESOLVED',
    payload: {
        choiceId: command.payload.choiceId,
        playerId: command.playerId,
    },
    sourceCommandType: command.type,
    timestamp,
});

const buildQidahenWuzhenChaohaCancelledEvent = (
    command: Extract<QidahenCommand, { type: 'CANCEL_WUZHEN_CHAOHA' }>,
    timestamp: number,
): QidahenEvent => ({
    type: 'WUZHEN_CHAOHA_CANCELLED',
    payload: {
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
            QIDAHEN_COMMANDS.SELECT_FACTION,
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
            QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE,
            QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            QIDAHEN_COMMANDS.RESOLVE_EVENT_CHARACTER_TARGET,
            QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
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
        commandTypes: [QIDAHEN_COMMANDS.PLAY_TACTIC_CARD],
        buildEvents: buildQidahenTacticCardPlayedEvents,
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD],
        buildEvents: buildSingleCommandEvents<PlayBattleResponseEventCardCommand>(
            buildQidahenBattleResponseEventCardPlayedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.TOGGLE_PINCER_ADVANCE_TROOP],
        buildEvents: buildSingleCommandEvents(
            buildQidahenPincerAdvanceTroopToggledEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE],
        buildEvents: buildSingleCommandEvents(
            buildQidahenPincerAdvanceResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.CANCEL_PINCER_ADVANCE],
        buildEvents: buildSingleCommandEvents(
            buildQidahenPincerAdvanceCancelledEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_INFANTRY_CAVALRY_COMBINED],
        buildEvents: buildSingleCommandEvents(
            buildQidahenInfantryCavalryCombinedResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_INSTIGATE_DEFECTION],
        buildEvents: buildSingleCommandEvents(
            buildQidahenInstigateDefectionResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.CANCEL_INSTIGATE_DEFECTION],
        buildEvents: buildSingleCommandEvents(
            buildQidahenInstigateDefectionCancelledEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.SET_WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT],
        buildEvents: buildSingleCommandEvents(
            buildQidahenWuzhenChaohaArtilleryTechCountSetEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.RESOLVE_WUZHEN_CHAOHA],
        buildEvents: buildSingleCommandEvents(
            buildQidahenWuzhenChaohaResolvedEvent,
        ),
    },
    {
        commandTypes: [QIDAHEN_COMMANDS.CANCEL_WUZHEN_CHAOHA],
        buildEvents: buildSingleCommandEvents(
            buildQidahenWuzhenChaohaCancelledEvent,
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
