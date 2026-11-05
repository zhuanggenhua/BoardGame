import type { MatchState, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent } from './types';
import { SU_EVENTS } from './types';
import { advanceSmashUpReactionSession } from './reactionSession';
import type { AdvanceSmashUpReactionOptions } from './reactionSession';
import { applyTriggerQueueFactEvent } from './triggerQueueFacts';
import { resolveInteraction } from '../../../engine/systems/InteractionSystem';

function getInteractionSourceId(interaction: unknown): string | undefined {
    const sourceId = (interaction as { data?: { sourceId?: unknown } } | undefined)?.data?.sourceId;
    return typeof sourceId === 'string' ? sourceId : undefined;
}

function suspendCurrentInteractionForMandatoryReaction(
    state: MatchState<SmashUpCore>,
    options?: AdvanceSmashUpReactionOptions,
): { state: MatchState<SmashUpCore>; suspendedId?: string } {
    const current = state.sys.interaction?.current;
    if (!options?.suspendCurrentInteraction || !current) return { state };
    if (getInteractionSourceId(current) === 'smashup_reaction_choose') return { state };

    const interactionState = state.sys.interaction;
    const suspendedId = current.id;
    return {
        state: {
            ...state,
            sys: {
                ...state.sys,
                interaction: {
                    ...interactionState,
                    current: undefined,
                    queue: [current, ...(interactionState.queue ?? [])],
                },
            },
        },
        suspendedId,
    };
}

function promoteQueuedFollowupAfterConsumedTrigger(
    state: MatchState<SmashUpCore>,
    events: readonly SmashUpEvent[],
): MatchState<SmashUpCore> {
    if (!events.some(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)) return state;
    if (state.sys.interaction?.current) return state;

    const queuedFollowup = state.sys.interaction?.queue?.[0];
    const queuedFollowupSourceId = getInteractionSourceId(queuedFollowup);
    if (!queuedFollowup || !queuedFollowupSourceId || queuedFollowupSourceId === 'smashup_reaction_choose') {
        return state;
    }

    return resolveInteraction(state);
}

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
    const suspended = suspendCurrentInteractionForMandatoryReaction(state, options);
    const result = advanceSmashUpReactionSession(suspended.state, random, now, options);
    if (!result) return undefined;
    let nextState = result.state;
    if (
        suspended.suspendedId
        && !nextState.sys.interaction?.current
        && nextState.sys.interaction?.queue?.[0]?.id === suspended.suspendedId
    ) {
        nextState = resolveInteraction(nextState);
    } else {
        nextState = promoteQueuedFollowupAfterConsumedTrigger(nextState, result.events);
    }
    return {
        ...result,
        state: materializeTriggerQueueFacts(nextState, result.events, options),
    };
}
