import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { commitEventForPlan } from '../../../engine/eventCommit';
import { SmashUpDomain } from '../domain';
import { planSmashUpCommand } from '../domain/commandPlan';
import { prepareSmashUpEventBatch } from '../domain/eventSettlement';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';

/** Old fixtures inspect sys on their mutable fixture and reduce core separately.
 * Production commands return explicit plans. This adapter consumes those plans;
 * it contains no game rules and is never imported by production code. */
export function planFixtureCommandEvents(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn,
): SmashUpEvent[] {
    // Minimal rule fixtures still supply the framework-owned execution cursor.
    state.sys = { ...createInitialSystemState(state.core.turnOrder ?? ['0', '1'], []), ...state.sys };
    const plan = planSmashUpCommand(state, command, random);
    if (plan.sys) state.sys = plan.sys;
    return plan.events;
}

/** Use the same batch owner as the engine, keeping core reduction in the fixture. */
export function settleFixtureCommandEvents(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn,
): SmashUpEvent[] {
    const events = planFixtureCommandEvents(state, command, random);
    const result = prepareSmashUpEventBatch({
        state,
        command,
        events,
        random,
        commit: (prefix, event) => commitEventForPlan(SmashUpDomain, prefix, event, command, random),
    });
    if (result.sys) state.sys = result.sys;
    return result.events;
}
