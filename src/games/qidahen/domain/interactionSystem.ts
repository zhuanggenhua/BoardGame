import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID } from './interactionSources';
import { isQidahenBattleCasualtyOrderValid } from './pendingTargetChoicePayload';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import {
    readQidahenResolvedPayload,
    type QidahenInteractionResolutionContext,
} from './interactionResolutionPayload';
import {
    resolveQidahenPendingBattleInteractionEvent,
} from './pendingBattleInteractionEventHandlers';
import {
    resolveQidahenTurnActionInteractionEvent,
} from './turnActionInteractionEventHandlers';
import type { QidahenBattleRolls, QidahenCore, QidahenPendingTargetAction, QidahenPublicBattleReport } from './types';
import { buildPublicBattleReport, QIDAHEN_BATTLE_ROLLED, type QidahenBattleRolledEvent } from './battleVisualEvent';
import { recordQidahenChronologyStatistics } from './chronologyStatistics';
import {
    clearQidahenRuntimeInteractionCurrent,
    syncQidahenRuntimeInteractionState,
} from './runtimeInteractions';

type QidahenInteractionEventResolver = (
    context: QidahenInteractionResolutionContext,
) => QidahenCore | null | undefined;

const QIDAHEN_INTERACTION_EVENT_RESOLVERS: readonly QidahenInteractionEventResolver[] = [
    resolveQidahenTurnActionInteractionEvent,
    resolveQidahenPendingBattleInteractionEvent,
];

function retainBattleReport(core: QidahenCore, report: QidahenPublicBattleReport): QidahenCore {
    if (core.pendingTargetAction) return { ...core, pendingTargetAction: { ...core.pendingTargetAction, battleReport: report } };
    if (core.postBattleSelection) return { ...core, postBattleSelection: { ...core.postBattleSelection, battleReport: report } };
    if (core.lastSeasonSummary) return { ...core, lastSeasonSummary: { ...core.lastSeasonSummary, battleReport: report } };
    return core;
}

const resolveQidahenInteractionEvent = (
    state: MatchState<QidahenCore>,
    event: GameEvent,
    random: RandomFn,
    onBattleRolled: NonNullable<QidahenInteractionResolutionContext['onBattleRolled']>,
): QidahenCore | null | undefined => {
    const context: QidahenInteractionResolutionContext = {
        state,
        payload: readQidahenResolvedPayload(event),
        event,
        random,
        onBattleRolled,
    };
    for (const resolver of QIDAHEN_INTERACTION_EVENT_RESOLVERS) {
        const resolvedCore = resolver(context);
        if (resolvedCore !== undefined) {
            return resolvedCore;
        }
    }
    return undefined;
};

export function createQidahenInteractionSystem(): EngineSystem<QidahenCore> {
    return {
        id: 'qidahen-interaction-bridge',
        name: '七大恨交互桥接',
        priority: 22,

        beforeCommand: ({ state, command }) => {
            if (command.type !== INTERACTION_COMMANDS.RESPOND) return;
            const current = state.sys.interaction?.current;
            const data = current?.data as { sourceId?: string } | undefined;
            if (data?.sourceId !== QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID) return;
            const payload = command.payload as { mergedValue?: unknown };
            if (!isQidahenBattleCasualtyOrderValid(payload.mergedValue)) {
                return { halt: true, error: 'invalidCasualtyPriority' };
            }
        },

        afterEvents: ({ state, events, random }): HookResult<QidahenCore> | void => {
            let nextState = state;
            let shouldClearRuntimeInteractionCurrent = false;
            const visualEvents: QidahenBattleRolledEvent[] = [];

            for (const event of events) {
                if (event.type === 'PENDING_ACTION_RESOLVED') {
                    const report = (event.payload as { battleVisualReport?: QidahenPublicBattleReport }).battleVisualReport;
                    if (report && !nextState.core.feignedRetreatSelection) {
                        visualEvents.push({ type: QIDAHEN_BATTLE_ROLLED, timestamp: event.timestamp, payload: { report } });
                        nextState = { ...nextState, core: retainBattleReport(nextState.core, report) };
                    }
                }
                if (
                    event.type === 'PENDING_ACTION_RESOLVED'
                    || event.type === 'TACTIC_CARD_PLAYED'
                    || event.type === 'POST_BATTLE_DECISION_RESOLVED'
                    || event.type === 'WUZHEN_CHAOHA_RESOLVED'
                ) {
                    shouldClearRuntimeInteractionCurrent = true;
                }
                if (event.type !== INTERACTION_EVENTS.RESOLVED) {
                    continue;
                }
                let rolled: { pending: QidahenPendingTargetAction; rolls: QidahenBattleRolls } | undefined;
                let resolvedCore = resolveQidahenInteractionEvent(nextState, event, random, (pending, rolls) => { rolled = { pending, rolls }; });
                if (resolvedCore !== undefined && resolvedCore != null) {
                    if (rolled) {
                        const { pending, rolls } = rolled;
                        const interactionId = (event.payload as { interactionId?: string } | undefined)?.interactionId ?? '';
                        const report = buildPublicBattleReport(nextState.core, pending, rolls,
                            `${state.sys.matchId ?? ''}:${state.sys.revision ?? 0}:${interactionId}:${pending.battleMode ?? 'field'}`);
                        visualEvents.push({ type: QIDAHEN_BATTLE_ROLLED, timestamp: event.timestamp, payload: { report } });
                        resolvedCore = retainBattleReport(resolvedCore, report);
                    }
                    nextState = {
                        ...nextState,
                        core: recordQidahenChronologyStatistics(nextState.core, resolvedCore),
                    };
                }
            }

            const stateReadyForSync = shouldClearRuntimeInteractionCurrent
                ? clearQidahenRuntimeInteractionCurrent(nextState)
                : nextState;
            const syncedState = syncQidahenRuntimeInteractionState(stateReadyForSync);
            if (syncedState === state && visualEvents.length === 0) {
                return;
            }
            return { state: syncedState, ...(visualEvents.length ? { events: visualEvents } : {}) };
        },
    };
}
