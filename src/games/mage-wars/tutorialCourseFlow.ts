import { createSeededRandom, executePipeline } from '../../engine/pipeline';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { DEFAULT_TUTORIAL_STATE } from '../../engine/types';
import type { MatchState, TutorialAiAction } from '../../engine/types';
import { MAGE_WARS_COMMANDS, type MageWarsCommand, type MageWarsCore } from './domain';
import { engineConfig } from './game';

export type MageWarsCourseGoal = {
    round: number;
    phase: string;
    actor?: string;
};

export function isMageWarsCourseGoal(state: MatchState<MageWarsCore>, goal: MageWarsCourseGoal) {
    return state.core.turnNumber === goal.round && state.sys.phase === goal.phase
        && (!goal.actor || (state.core.phaseActorId ?? state.core.currentPlayerId) === goal.actor);
}

/** Discover the repeated passes from formal transitions, including rounds where a creature was defeated. */
export function buildMageWarsCoursePasses(
    from: MatchState<MageWarsCore>,
    goal: MageWarsCourseGoal,
    plans: Readonly<Record<string, readonly number[]>> = {},
): TutorialAiAction[] {
    let state = { ...from, sys: { ...from.sys, tutorial: DEFAULT_TUTORIAL_STATE } };
    const actions: TutorialAiAction[] = [];
    const random = createSeededRandom(`mage-wars-course-pass-${from.core.turnNumber}`);
    const playerIds = state.core.playerOrder;
    for (let i = 0; i < 45 && !isMageWarsCourseGoal(state, goal); i += 1) {
        if (state.sys.interaction.current || state.sys.responseWindow.current || state.sys.gameover) break;
        const actor = state.core.phaseActorId ?? state.core.currentPlayerId;
        let type: string = FLOW_COMMANDS.ADVANCE_PHASE;
        let playerId = actor;
        let payload: Record<string, unknown> = {};
        if (state.sys.phase === 'planning') {
            const planner = playerIds.find((id) => !state.core.phaseReadyPlayerIds?.includes(id));
            if (planner !== undefined) {
                type = MAGE_WARS_COMMANDS.PLAN_SPELLS;
                playerId = planner;
                payload = { spellCardIds: [...(plans[planner] ?? [])] };
            }
        } else if (state.sys.phase === 'creatureAction' && !state.core.activeCreatureAction) {
            const mage = state.core.players[actor];
            const creature = Object.values(state.core.objects).find((object) =>
                object.ownerId === actor && object.kind === 'creature' && object.actionReady
                && engineConfig.domain.validate(state, {
                    type: MAGE_WARS_COMMANDS.CREATURE_NO_ACTION,
                    playerId: actor,
                    payload: { objectId: object.id },
                }).valid,
            );
            if (mage?.actionReady || creature) {
                type = MAGE_WARS_COMMANDS.CREATURE_NO_ACTION;
                payload = mage?.actionReady ? {} : { objectId: creature!.id };
            }
        }
        const command = { type, playerId, payload } as MageWarsCommand;
        const result = executePipeline(engineConfig, state, command, random, playerIds);
        if (!result.success) throw new Error(`Mage Wars tutorial transition: ${type} failed (${result.error})`);
        actions.push({ commandType: type, playerId, payload });
        state = result.state;
    }
    if (!isMageWarsCourseGoal(state, goal) && !state.sys.interaction.current && !state.sys.gameover) {
        throw new Error(`Mage Wars tutorial transition did not reach ${goal.round}/${goal.phase}/${goal.actor ?? '*'}`);
    }
    return actions;
}
