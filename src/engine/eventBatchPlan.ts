import type { Command, EventCommitEvidence, GameEvent, MatchState, RandomFn, SystemState } from './types';

export interface CommandPlan<TEvent extends GameEvent> {
    events: TEvent[];
    /** Explicit system-state changes; a planner never publishes a core snapshot. */
    sys?: SystemState;
}

export interface PreparedEventBatch<TEvent extends GameEvent> extends CommandPlan<TEvent> {
    evidence?: EventCommitEvidence[];
}

export interface PrepareEventBatchArgs<TCore, TCommand extends Command, TEvent extends GameEvent> {
    state: MatchState<TCore>;
    events: TEvent[];
    command?: TCommand;
    random: RandomFn;
    /** Make the final synchronous commit/interception decision on a private prefix. */
    commit(state: MatchState<TCore>, event: TEvent): { events: TEvent[]; evidence: EventCommitEvidence[] };
}
