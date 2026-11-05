import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { readQidahenResolvedPayload, type QidahenInteractionResolutionContext } from './interactionResolutionPayload';
import { buildQidahenPendingBattleInteractionEvents } from './pendingBattleInteractionEventHandlers';
import { buildQidahenTurnActionInteractionEvents } from './turnActionInteractionEventHandlers';
import { reduceQidahenEvent } from './reducer';
import type { QidahenCore, QidahenEvent } from './types';
import { clearQidahenRuntimeInteractionCurrent, syncQidahenRuntimeInteractionState } from './runtimeInteractions';

type QidahenInteractionEventBuilder = (context: QidahenInteractionResolutionContext) => QidahenEvent[] | null | undefined;
const BUILDERS: readonly QidahenInteractionEventBuilder[] = [
    buildQidahenTurnActionInteractionEvents, buildQidahenPendingBattleInteractionEvents,
];

export function buildQidahenInteractionEvents(state: MatchState<QidahenCore>, event: GameEvent, random: RandomFn): QidahenEvent[] {
    const context: QidahenInteractionResolutionContext = { state, payload: readQidahenResolvedPayload(event), event, random };
    for (const build of BUILDERS) {
        const facts = build(context);
        if (facts !== undefined && facts !== null) return facts;
    }
    return [];
}

export function createQidahenInteractionSystem(): EngineSystem<QidahenCore> {
    return {
        id: 'qidahen-interaction-bridge', name: '七大恨交互桥接', priority: 22,
        afterEvents: ({ state, events, random }): HookResult<QidahenCore> | void => {
            const facts: QidahenEvent[] = [];
            // A private prefix is only a planning input. The engine commits all
            // emitted facts through the same reducer as ordinary commands.
            let prefix = state.core;
            let shouldClear = false;
            for (const event of events) {
                if (event.type === 'PENDING_ACTION_RESOLVED' || event.type === 'POST_BATTLE_DECISION_RESOLVED'
                    || event.type === 'WUZHEN_CHAOHA_RESOLVED') shouldClear = true;
                if (event.type !== INTERACTION_EVENTS.RESOLVED) continue;
                const emitted = buildQidahenInteractionEvents({ ...state, core: prefix }, event, random);
                for (const fact of emitted) prefix = reduceQidahenEvent(prefix, fact);
                facts.push(...emitted);
            }
            if (facts.length) return { events: facts };
            // Interaction synchronization happens on the following round,
            // after the domain facts have committed; never reopen stale choices.
            const ready = shouldClear ? clearQidahenRuntimeInteractionCurrent(state) : state;
            const synced = syncQidahenRuntimeInteractionState(ready);
            if (synced !== state) return { state: synced };
        },
    };
}
