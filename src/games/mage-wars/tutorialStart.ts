import { createSeededRandom, executeAutomaticSystemFlow, executePipeline, type PipelineConfig } from '../../engine/pipeline';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import type { MatchState, RandomFn } from '../../engine/types';
import { getPresetSpellbookEntriesFromConfig } from './data/configPackage';
import { MAGE_WARS_COMMANDS, type MageWarsCommand, type MageWarsCore, type MageWarsEvent } from './domain';
import { MAGE_IDS, type ArenaZoneId } from './domain/ids';
import { buildMageWarsMageSetupData } from './roomSetup';

export const MAGE_WARS_TUTORIAL_PLAYER = '0';
export const MAGE_WARS_TUTORIAL_OPPONENT = '1';
export const MAGE_WARS_TUTORIAL_WOLF = 'mwobj-0-2819-1';
export const MAGE_WARS_TUTORIAL_UNICORN = 'mwobj-1-2814-1';

export function buildMageWarsTutorialSetupData() {
    const beastmaster = MAGE_IDS.BEASTMASTER_APPRENTICE;
    const priestess = MAGE_IDS.PRIESTESS_APPRENTICE;
    const replaced = new Set([3415, 3420, 3725, 1812, 3423, 3405]);
    const priestessSpellbook = getPresetSpellbookEntriesFromConfig(priestess)
        .filter(({ spellCardId }) => !replaced.has(spellCardId));
    return buildMageWarsMageSetupData([beastmaster, priestess], [
        getPresetSpellbookEntriesFromConfig(beastmaster),
        [...priestessSpellbook, { spellCardId: 1815, count: 1 }],
    ]);
}

export function prepareMageWarsTutorialMatch(
    config: PipelineConfig<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    base: MatchState<MageWarsCore>,
    playerIds: string[],
): MatchState<MageWarsCore> {
    const learner = MAGE_WARS_TUTORIAL_PLAYER;
    const opponent = MAGE_WARS_TUTORIAL_OPPONENT;
    const wolf = MAGE_WARS_TUTORIAL_WOLF;
    const unicorn = MAGE_WARS_TUTORIAL_UNICORN;
    const random = createSeededRandom('mage-wars-tutorial-before-round-five');
    const frontLoadedAttackDice = [4, 6, 1];
    const injuryRoll: RandomFn = { ...random, d: (sides) => sides === 6 ? frontLoadedAttackDice.shift() ?? 1 : 1 };
    let state = executeAutomaticSystemFlow(config, base, random, playerIds, { maxRounds: 10 }).state;
    const actor = () => state.core.phaseActorId ?? state.core.currentPlayerId;
    const run = (type: string, playerId: string, payload: Record<string, unknown>, dice = random) => {
        const result = executePipeline(config, state, { type, playerId, payload } as MageWarsCommand, dice, playerIds);
        if (!result.success) throw new Error(`Mage Wars tutorial setup: ${type} rejected (${result.error})`);
        state = result.state;
    };
    const advance = (playerId = actor()) => run(FLOW_COMMANDS.ADVANCE_PHASE, playerId, {});
    const advanceTo = (phase: string, limit: number) => {
        for (let i = 0; i < limit && state.sys.phase !== phase; i += 1) advance();
        if (state.sys.phase !== phase) throw new Error(`Mage Wars tutorial setup did not reach ${phase}`);
    };
    const plan = (ourCards: number[], opponentCards: number[]) => {
        run(MAGE_WARS_COMMANDS.PLAN_SPELLS, learner, { spellCardIds: ourCards });
        run(MAGE_WARS_COMMANDS.PLAN_SPELLS, opponent, { spellCardIds: opponentCards });
        advanceTo('creatureAction', 8);
    };
    const finishWithoutAction = (playerId: string, objectId?: string) => {
        run(MAGE_WARS_COMMANDS.CREATURE_NO_ACTION, playerId, objectId ? { objectId } : {});
        advance(playerId);
    };

    plan([2819], [2814]);
    run(MAGE_WARS_COMMANDS.CAST_SPELL, learner, { spellCardId: 2819, manaCost: 9, targetZoneId: 'a3' });
    advance(learner);
    run(MAGE_WARS_COMMANDS.CAST_SPELL, opponent, { spellCardId: 2814, manaCost: 13, targetZoneId: 'd1' });
    advance(opponent);
    advanceTo('planning', 5);

    const approach: ArenaZoneId[][] = [['c1', 'b1'], ['a1', 'a2'], ['a3']];
    for (const path of approach) {
        plan([], []);
        if (actor() === learner) finishWithoutAction(learner, wolf);
        for (const toZoneId of path) {
            run(MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT, opponent, { objectId: unicorn, toZoneId });
        }
        if (path[0] === 'a3') {
            run(MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK, opponent, {
                attackerObjectId: unicorn, attackProfileId: 'attack-0', targetObjectId: wolf,
            }, injuryRoll);
        }
        advance(opponent);
        if (state.core.objects[wolf].actionReady) finishWithoutAction(learner, wolf);
        if (actor() === opponent) finishWithoutAction(opponent);
        finishWithoutAction(learner);
        if (state.sys.phase === 'creatureAction') finishWithoutAction(opponent);
        advanceTo('planning', 5);
    }

    plan([3402], []);
    finishWithoutAction(learner);
    finishWithoutAction(opponent);
    if (state.core.turnNumber !== 5 || actor() !== learner || state.core.objects[wolf]?.damage !== 3
        || state.sys.interaction.current || state.sys.responseWindow.current) {
        throw new Error('Mage Wars tutorial setup did not reach the guard decision');
    }
    return { core: state.core, sys: { ...base.sys, phase: state.sys.phase } };
}
