import type { EventCommitEvidence, MatchState, RandomFn } from '../../../engine/types';
import type { PrepareEventBatchArgs } from '../../../engine/eventBatchPlan';
import { commitEventForPlan } from '../../../engine/eventCommit';
import { discoverSmashUpTimingOpportunities } from './timingOpportunities';
import { interceptEvent } from './ongoingEffects';
import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from './types';

export type SmashUpSettlementPhase = 'prepare' | 'facts';
type CandidateBatch = { events: SmashUpEvent[]; state: MatchState<SmashUpCore> };
type CandidatePreparer = (events: SmashUpEvent[], state: MatchState<SmashUpCore>) => CandidateBatch;
interface EventOccurrence {
    batch: object;
    occurrence: number;
    accepted: boolean;
    settled: boolean;
    factOwner?: object;
}
interface SettlementContext {
    batch: object;
    nextOccurrence: number;
    command?: SmashUpCommand;
    random: RandomFn;
    commit?: PrepareEventBatchArgs<SmashUpCore, SmashUpCommand, SmashUpEvent>['commit'];
    evidence: EventCommitEvidence[];
    phases: SmashUpSettlementPhase[];
    preparers: CandidatePreparer[];
    factFrames: object[];
    immediateStartTurnEvents: Set<SmashUpEvent>;
}
// Runtime execution stages never enter MatchState or a deferred frame payload.
const occurrences = new WeakMap<SmashUpEvent, EventOccurrence>();
const contexts: SettlementContext[] = [];
export const getSmashUpSettlementContext = (): SettlementContext | undefined => contexts.at(-1);
export const getSmashUpSettlementPhase = (): SmashUpSettlementPhase | undefined => contexts.at(-1)?.phases.at(-1);
export function withSmashUpSettlement<T>(context: SettlementContext, run: () => T): T {
    contexts.push(context);
    try {
        return run();
    } finally {
        contexts.pop();
    }
}
export function withSmashUpSettlementPhase<T>(phase: SmashUpSettlementPhase, run: () => T): T {
    const context = contexts.at(-1);
    if (!context) return run();
    context.phases.push(phase);
    try {
        return run();
    } finally {
        context.phases.pop();
    }
}
export function withSmashUpCandidatePreparer<T>(prepare: CandidatePreparer, run: () => T): T {
    const context = contexts.at(-1);
    if (!context) throw new Error('SmashUp settlement context missing');
    context.preparers.push(prepare);
    try {
        return run();
    } finally {
        context.preparers.pop();
    }
}
export function createSmashUpSettlementContext(
    random: RandomFn,
    command?: SmashUpCommand,
    commit?: SettlementContext['commit'],
): SettlementContext {
    return {
        batch: {},
        nextOccurrence: 0,
        random,
        command,
        commit,
        evidence: [],
        phases: [],
        preparers: [],
        factFrames: [],
        immediateStartTurnEvents: new Set(),
    };
}
export function isSmashUpEventSettled(event: SmashUpEvent): boolean {
    const context = contexts.at(-1),
        record = occurrences.get(event),
        current = context?.factFrames.at(-1);
    if (!context || record?.batch !== context.batch) return false;
    return record?.settled === true || Boolean(record?.factOwner && record.factOwner !== current);
}
export function withSmashUpFactBatch<T>(events: SmashUpEvent[], run: () => T): T {
    const context = contexts.at(-1);
    if (!context) throw new Error('SmashUp settlement context missing');
    const frame = {};
    const pending = events.filter((event) => !isSmashUpEventSettled(event));
    context.factFrames.push(frame);
    for (const event of pending) {
        const record = occurrences.get(event);
        if (record) record.factOwner = frame;
    }
    let completed = false;
    try {
        const result = run();
        completed = true;
        return result;
    } finally {
        for (const event of pending) {
            const record = occurrences.get(event);
            if (record) {
                record.factOwner = undefined;
                if (completed) record.settled = true;
            }
        }
        context.factFrames.pop();
    }
}

/** Finish protection/replacement/pause for each candidate before advancing the
 * prefix used to decide the next candidate. Interceptor replacement arrays are
 * prepared for protections/choices, but do not recursively re-run interception. */
export function prepareSmashUpCandidates(events: SmashUpEvent[], state: MatchState<SmashUpCore>): CandidateBatch {
    const context = contexts.at(-1);
    if (!context || getSmashUpSettlementPhase() === 'prepare') return { events, state };
    const output: SmashUpEvent[] = [],
        seen = new Set<SmashUpEvent>();
    let prefix = state.core,
        sys = state.sys;
    const accept = (event: SmashUpEvent) => {
        occurrences.set(event, {
            batch: context.batch,
            occurrence: context.nextOccurrence++,
            accepted: true,
            settled: false,
        });
        output.push(event);
        prefix = applyPostProcessPrefixEvent(prefix, event);
    };
    const plan = (event: SmashUpEvent, intercepted = false, depth = 0): void => {
        if (depth > 64) throw new Error('SmashUp replacement chain exceeded 64 stages');
        if (occurrences.get(event)?.batch === context.batch && occurrences.get(event)?.accepted) {
            output.push(event);
            prefix = applyPostProcessPrefixEvent(prefix, event);
            return;
        }
        const prepare = context.preparers.at(-1);
        if (!prepare) throw new Error('SmashUp candidate preparer missing');
        const prepared = withSmashUpSettlementPhase('prepare', () => prepare([event], { ...state, core: prefix, sys }));
        sys = prepared.state.sys;
        for (const candidate of prepared.events) {
            if (candidate !== event) {
                plan(candidate, intercepted, depth + 1);
                continue;
            }
            if (intercepted) {
                accept(candidate);
                continue;
            }
            const prefixState = { ...state, core: prefix, sys };
            const committed = context.commit
                ? context.commit(prefixState, candidate)
                : commitEventForPlan(
                      { gameId: 'smashup', discoverTimingOpportunities: discoverSmashUpTimingOpportunities },
                      prefixState,
                      candidate,
                      context.command,
                      context.random,
                  );
            context.evidence.push(...committed.evidence);
            for (const committedEvent of committed.events) {
                const decision = interceptEvent(prefix, committedEvent);
                const accepted =
                    decision === undefined
                        ? [committedEvent]
                        : decision === null
                          ? []
                          : Array.isArray(decision)
                            ? decision
                            : [decision];
                for (const result of accepted) {
                    if (result === candidate) accept(result);
                    else plan(result, true, depth + 1);
                }
            }
        }
    };
    for (const original of events) {
        const event = seen.has(original) ? ({ ...original } as SmashUpEvent) : original;
        seen.add(original);
        plan(event);
    }
    return { events: output, state: { ...state, sys } };
}

/** onTurnStart is a separate fact consumer from the ordinary event families. */
export function claimSmashUpImmediateStartTurnEvent(event: SmashUpEvent): boolean {
    const context = contexts.at(-1);
    if (!context) return true;
    if (context.immediateStartTurnEvents.has(event)) return false;
    context.immediateStartTurnEvents.add(event);
    return true;
}
