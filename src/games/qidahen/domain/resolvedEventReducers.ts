import {
    resolveQidahenGaoDiDispatchChoice,
    resolveQidahenInternalDispatchInteractionChoice,
} from './actionWindowDispatch';
import {
    resolveQidahenDiplomacyInteractionChoice,
    resolveQidahenDriveTigerConsentInteractionChoice,
    resolveQidahenKhanEdictInteractionChoice,
    resolveQidahenMaShiTradeInteractionChoice,
    resolveQidahenRecruitInteractionChoice,
} from './actionWindowChoices';
import {
    resolveQidahenPendingActionFromPayload,
    resolveQidahenPostBattleInteractionChoice,
} from './pendingBattleFlow';
import {
    resolveQidahenScenarioChoiceResolvedEvent,
} from './scenarioChoiceState';
import {
    resolveQidahenScenarioVoteCastEvent,
} from './scenarioVoteState';
import {
    resolveQidahenSunYuanhuaTechResolvedEvent,
} from './armamentUpgradeResolution';
import {
    getFactionIdByPlayerId,
} from './factionTurnAccessors';
import {
    resolveQidahenFortificationMaintenanceInteractionChoice,
} from './fortificationMaintenance';
import {
    executeQidahenSelectedAction,
} from './selectedActionExecution';
import type { QidahenCore, QidahenEvent } from './types';

const resolveQidahenTacticCardPlayedEvent = (
    state: QidahenCore,
    event: Extract<QidahenEvent, { type: 'TACTIC_CARD_PLAYED' }>,
): QidahenCore => {
    const pendingTargetAction = state.pendingTargetAction;
    if (!pendingTargetAction) {
        return state;
    }
    const playedCard = state.handCards.find((card) => (
        card.id === event.payload.cardId
        && card.faction === pendingTargetAction.attackerFactionId
        && card.cardKind === 'tactic'
        && card.status !== 'disabled'
    ));
    if (!playedCard) {
        return state;
    }
    const attackerName = state.factions[pendingTargetAction.attackerFactionId]?.name ?? '攻方';
    const targetName = pendingTargetAction.targetRegionName;
    const tacticLine = `${attackerName} 打出战术牌「${playedCard.label}」，用于 ${targetName} 战斗。`;
    return {
        ...state,
        handCards: state.handCards.filter((card) => card.id !== playedCard.id),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${event.timestamp}`,
            title: '战术牌',
            lines: [tacticLine],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${event.timestamp}`,
                text: tacticLine,
                timestamp: event.timestamp,
            },
        ],
    };
};

type QidahenResolvedEventType = QidahenEvent['type'];

interface QidahenResolvedEventReducerSpec<TEventType extends QidahenResolvedEventType = QidahenResolvedEventType> {
    eventTypes: readonly TEventType[];
    reduce: (
        state: QidahenCore,
        event: Extract<QidahenEvent, { type: TEventType }>,
    ) => QidahenCore;
}

const defineResolvedEventReducer = <TEventType extends QidahenResolvedEventType>(
    eventTypes: readonly TEventType[],
    reduce: (
        state: QidahenCore,
        event: Extract<QidahenEvent, { type: TEventType }>,
    ) => QidahenCore,
): QidahenResolvedEventReducerSpec<TEventType> => ({
    eventTypes,
    reduce,
});

const QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE = new Map<
    QidahenResolvedEventType,
    QidahenResolvedEventReducerSpec
>();

const QIDAHEN_RESOLVED_EVENT_REDUCERS = [
    defineResolvedEventReducer(
        ['SCENARIO_VOTE_CAST'],
        resolveQidahenScenarioVoteCastEvent,
    ),
    defineResolvedEventReducer(
        ['SUN_YUANHUA_TECH_RESOLVED'],
        resolveQidahenSunYuanhuaTechResolvedEvent,
    ),
    defineResolvedEventReducer(
        ['GAO_DI_DISPATCH_RESOLVED'],
        (state, event) => resolveQidahenGaoDiDispatchChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            null,
            getFactionIdByPlayerId(
                state,
                event.payload.playerId,
            ),
        ),
    ),
    defineResolvedEventReducer(
        ['INTERNAL_DISPATCH_RESOLVED'],
        (state, event) => resolveQidahenInternalDispatchInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['FORTIFICATION_MAINTENANCE_RESOLVED'],
        (state, event) => resolveQidahenFortificationMaintenanceInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.attritionPriority,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['DRIVE_TIGER_CONSENT_RESOLVED'],
        (state, event) => resolveQidahenDriveTigerConsentInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['RECRUIT_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenRecruitInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['MA_SHI_TRADE_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenMaShiTradeInteractionChoice(
            state,
            event.payload.troopCount,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['KHAN_EDICT_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenKhanEdictInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['DIPLOMACY_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenDiplomacyInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        [
            'SCENARIO_CHARACTER_CHOICE_RESOLVED',
            'SCENARIO_ARMAMENT_CHOICE_RESOLVED',
        ],
        resolveQidahenScenarioChoiceResolvedEvent,
    ),
    defineResolvedEventReducer(
        ['SELECTED_ACTION_EXECUTED'],
        (state, event) => executeQidahenSelectedAction(
            state,
            event.payload.playerId,
            event.payload.actionId,
            event.payload.cardIds,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['TACTIC_CARD_PLAYED'],
        resolveQidahenTacticCardPlayedEvent,
    ),
    defineResolvedEventReducer(
        ['PENDING_ACTION_RESOLVED'],
        (state, event) => resolveQidahenPendingActionFromPayload(
            state,
            event.payload,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['POST_BATTLE_DECISION_RESOLVED'],
        (state, event) => resolveQidahenPostBattleInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
] as const satisfies readonly QidahenResolvedEventReducerSpec[];

for (const reducer of QIDAHEN_RESOLVED_EVENT_REDUCERS) {
    for (const eventType of reducer.eventTypes) {
        QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE.set(eventType, reducer);
    }
}

export const reduceQidahenResolvedEvent = (
    state: QidahenCore,
    event: QidahenEvent,
): QidahenCore | null => {
    const reducer = QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE.get(event.type);
    return reducer
        ? reducer.reduce(state, event as never)
        : null;
};
