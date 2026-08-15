import type { MatchState, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent } from './types';
import { advanceSmashUpReactionSession, SUSPEND_SMASHUP_REACTION_DOMAIN_EVENTS } from './reactionSession';
import type { AdvanceSmashUpReactionOptions } from './reactionSession';

export function maybeResolveReactionQueue(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
    options?: AdvanceSmashUpReactionOptions,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    return advanceSmashUpReactionSession(state, random, now, options);
}

export function maybeResolveReactionQueueSuspendingDomainEvents(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    return advanceSmashUpReactionSession(state, random, now, SUSPEND_SMASHUP_REACTION_DOMAIN_EVENTS);
}
