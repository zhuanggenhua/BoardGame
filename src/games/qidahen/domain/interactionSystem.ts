import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
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
import type { QidahenCore } from './types';
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

const resolveQidahenInteractionEvent = (
    state: MatchState<QidahenCore>,
    event: GameEvent,
    random: RandomFn,
): QidahenCore | null | undefined => {
    const context: QidahenInteractionResolutionContext = {
        state,
        payload: readQidahenResolvedPayload(event),
        event,
        random,
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

        afterEvents: ({ state, events, random }): HookResult<QidahenCore> | void => {
            let nextState = state;
            let shouldClearRuntimeInteractionCurrent = false;

            for (const event of events) {
                if (
                    event.type === 'PENDING_ACTION_RESOLVED'
                    || event.type === 'POST_BATTLE_DECISION_RESOLVED'
                ) {
                    shouldClearRuntimeInteractionCurrent = true;
                }
                if (event.type !== INTERACTION_EVENTS.RESOLVED) {
                    continue;
                }
                const resolvedCore = resolveQidahenInteractionEvent(nextState, event, random);
                if (resolvedCore !== undefined && resolvedCore != null) {
                    nextState = {
                        ...nextState,
                        core: resolvedCore,
                    };
                }
            }

            const stateReadyForSync = shouldClearRuntimeInteractionCurrent
                ? clearQidahenRuntimeInteractionCurrent(nextState)
                : nextState;
            const syncedState = syncQidahenRuntimeInteractionState(stateReadyForSync);
            if (syncedState === state) {
                return;
            }
            return { state: syncedState };
        },
    };
}
