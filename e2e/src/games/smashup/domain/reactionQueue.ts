import type { MatchState, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent } from './types';
import { advanceSmashUpReactionSession } from './reactionSession';

export function maybeResolveReactionQueue(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    return advanceSmashUpReactionSession(state, random, now);
}
