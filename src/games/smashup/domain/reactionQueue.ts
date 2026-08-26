import type { MatchState, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent } from './types';
import { SU_EVENTS } from './types';
import { advanceSmashUpReactionSession } from './reactionSession';
import type { AdvanceSmashUpReactionOptions } from './reactionSession';
import { applyTriggerQueueFactEvent } from './triggerQueueFacts';

function materializeTriggerQueueFacts(
    state: MatchState<SmashUpCore>,
    events: readonly SmashUpEvent[],
    options?: AdvanceSmashUpReactionOptions,
): MatchState<SmashUpCore> {
    if (options?.materializeDomainEvents === false) return state;

    let core = state.core;
    for (const event of events) {
        if (event.type === SU_EVENTS.TRIGGER_QUEUED || event.type === SU_EVENTS.TRIGGER_CONSUMED) {
            core = applyTriggerQueueFactEvent(core, event);
        }
    }
    return core === state.core ? state : { ...state, core };
}

export function maybeResolveReactionQueue(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
    options?: AdvanceSmashUpReactionOptions,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    const result = advanceSmashUpReactionSession(state, random, now, options);
    if (!result) return undefined;
    return {
        ...result,
        state: materializeTriggerQueueFacts(result.state, result.events, options),
    };
}
