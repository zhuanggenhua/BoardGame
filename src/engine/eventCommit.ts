import type { GameEvent, EventCommitEvidence, DomainCore, Command, MatchState, RandomFn } from './types';
import { createTimingPoint, commitEventWithTimingOpportunities } from './TimingOpportunity';

export interface NormalizedEventCommit<TEvent extends GameEvent> {
    events: TEvent[];
    evidence: EventCommitEvidence[];
}

export function normalizeEventCommitEvidence(
    evidence: EventCommitEvidence | EventCommitEvidence[] | undefined,
): EventCommitEvidence[] {
    if (!evidence) return [];
    return Array.isArray(evidence) ? evidence : [evidence];
}

export function normalizeEventCommitResult<TEvent extends GameEvent>(
    event: TEvent,
    result: ReturnType<NonNullable<DomainCore<unknown, Command, TEvent>['commitEvent']>>,
): NormalizedEventCommit<TEvent> {
    if (result === undefined) return { events: [event], evidence: [] };
    if (result === null) return { events: [], evidence: [] };
    if (Array.isArray(result)) return { events: result, evidence: [] };
    if ('events' in result) {
        return {
            events: result.events,
            evidence: normalizeEventCommitEvidence(result.evidence),
        };
    }
    return { events: [result], evidence: [] };
}

export function commitEventBeforeReduce<TCore, TCommand extends Command, TEvent extends GameEvent>(
    domain: Pick<DomainCore<TCore, TCommand, TEvent>, 'gameId' | 'commitEvent' | 'discoverTimingOpportunities'>,
    state: MatchState<TCore>,
    event: TEvent,
    command?: TCommand,
    random?: RandomFn,
): NormalizedEventCommit<TEvent> {
    const timing = createTimingPoint<TCommand, TEvent>({
        gameId: domain.gameId,
        position: 'eventCommit',
        factKind: event.type,
        event,
        command,
        parentFrameId: state.sys.resolution?.activeFrameId,
        timestamp: event.timestamp,
    });
    const commitArgs = {
        state,
        event,
        command,
        timing,
        random,
    };

    if (!domain.commitEvent) {
        const result = commitEventWithTimingOpportunities(domain, commitArgs);
        return {
            events: result.events,
            evidence: normalizeEventCommitEvidence(result.evidence),
        };
    }

    return normalizeEventCommitResult(event, domain.commitEvent(commitArgs));
}

/** Resolve synchronous event decisions; replacement arrays are not recursively intercepted. */
export function commitEventForPlan<TCore, TCommand extends Command, TEvent extends GameEvent>(
    domain: Pick<
        DomainCore<TCore, TCommand, TEvent>,
        'gameId' | 'commitEvent' | 'discoverTimingOpportunities' | 'interceptEvent'
    >,
    state: MatchState<TCore>,
    event: TEvent,
    command?: TCommand,
    random?: RandomFn,
): NormalizedEventCommit<TEvent> {
    if (event.type.startsWith('SYS_') && event.type !== 'SYS_PHASE_CHANGED') return { events: [event], evidence: [] };
    const committed = commitEventBeforeReduce(domain, state, event, command, random);
    if (!domain.interceptEvent) return committed;
    const events: TEvent[] = [];
    for (const accepted of committed.events) {
        const result = domain.interceptEvent(state.core, accepted);
        if (result !== null) events.push(...(Array.isArray(result) ? result : [result]));
    }
    return { events, evidence: committed.evidence };
}
