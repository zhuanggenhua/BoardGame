/**
 * afterScoring 链式传递与延迟清场合同
 *
 * 这些用例锁的不是单张卡 bug，而是计分后多段交互的系统顺序：
 * - 基地 afterScoring prompt 结算后，应继续传递到后续随从/基地交互
 * - 后续交互未收口前，不应提前清场或换基地
 * - 最后一个链式交互结束后，才允许补发延迟清场/换基地
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    makeBase,
    makeMinion,
} from './helpers';

const PLAYER_IDS: PlayerId[] = ['0', '1'];

function createRunner(
    setupCore: (core: SmashUpCore) => void,
): GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent> {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        setup: (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
            core.factionSelection = undefined;
            core.currentPlayerIndex = 0;
            core.turnOrder = [...PLAYER_IDS];
            sys.phase = 'playCards';
            setupCore(core);
            return { core, sys };
        },
    });
}

function resolveCurrentOption(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    optionId: string,
    playerId = '0',
) {
    const result = runner.resolveInteraction(playerId, { optionId });
    expect(result.success).toBe(true);
    return result.finalState;
}

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('afterScoring 链式传递与延迟清场', () => {
    it('母舰结算后仍会继续弹出侦察兵回手，并延迟到最后清场', () => {
        const runner = createRunner((core) => {
            core.bases = [
                makeBase('base_the_mothership', [
                    makeMinion('scout1', 'alien_scout', '0', 3),
                    makeMinion('weak1', 'alien_invader', '0', 2),
                    makeMinion('strong1', 'robot_warbot', '0', 4, { powerCounters: 12 }),
                    makeMinion('enemy1', 'pirate_king', '1', 5),
                ]),
                makeBase('base_secret_garden'),
            ];
            core.baseDeck = ['base_tar_pits'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        const reactionPrompt = getReactionPrompt(runner.getState());
        const mothershipTrigger = getReactionPromptOptionBySourceDefId(
            runner.getState(),
            reactionPrompt,
            'base_the_mothership',
        );
        resolveCurrentOption(runner, mothershipTrigger.id);

        const mothershipPrompt = getSimpleChoicePrompt(runner.getState(), 'base_the_mothership');
        const weakMinionOption = getPromptOption(
            mothershipPrompt,
            (option: any) => option.value?.minionUid === 'weak1',
            'mothership weak minion option',
        );
        let state = resolveCurrentOption(runner, weakMinionOption.id);

        expect(state.core.players['0'].hand.map(card => card.uid)).toContain('weak1');
        expect(state.core.bases[0].minions.map(minion => minion.uid)).toContain('scout1');

        const scoutPrompt = getSimpleChoicePrompt(state, 'alien_scout_return');
        const returnScoutOption = getPromptOption(
            scoutPrompt,
            (option: any) => option.value?.returnIt === true,
            'alien scout return option',
        );
        state = resolveCurrentOption(runner, returnScoutOption.id);

        expectNoPrompt(state);
        expect(state.core.players['0'].hand.map(card => card.uid)).toEqual(
            expect.arrayContaining(['weak1', 'scout1']),
        );
        expect(state.core.bases[0].minions).toHaveLength(0);
    });

    it('母舰、两个侦察兵和大副会按链式顺序结算，不提前清掉来源基地', () => {
        const runner = createRunner((core) => {
            core.bases = [
                makeBase('base_the_mothership', [
                    makeMinion('scout1', 'alien_scout', '0', 3),
                    makeMinion('scout2', 'alien_scout', '0', 3),
                    makeMinion('mate1', 'pirate_first_mate', '0', 2),
                    makeMinion('weak1', 'alien_invader', '0', 2),
                    makeMinion('strong1', 'robot_warbot', '0', 4, { powerCounters: 7 }),
                    makeMinion('enemy1', 'pirate_king', '1', 5),
                ]),
                makeBase('base_secret_garden'),
                makeBase('base_tar_pits'),
            ];
            core.baseDeck = ['base_factory_436-1337'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        const reactionPrompt = getReactionPrompt(runner.getState());
        const mothershipTrigger = getReactionPromptOptionBySourceDefId(
            runner.getState(),
            reactionPrompt,
            'base_the_mothership',
        );
        resolveCurrentOption(runner, mothershipTrigger.id);

        const mothershipPrompt = getSimpleChoicePrompt(runner.getState(), 'base_the_mothership');
        const weakMinionOption = getPromptOption(
            mothershipPrompt,
            (option: any) => option.value?.minionUid === 'weak1',
            'mothership weak minion option',
        );
        let state = resolveCurrentOption(runner, weakMinionOption.id);
        expect(state.core.bases[0].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['scout1', 'scout2', 'mate1']),
        );

        let scoutPrompt = getSimpleChoicePrompt(state, 'alien_scout_return');
        let scoutOption = getPromptOption(
            scoutPrompt,
            (option: any) => option.value?.returnIt === true,
            'first alien scout return option',
        );
        state = resolveCurrentOption(runner, scoutOption.id);
        expect(state.core.players['0'].hand.map(card => card.uid)).toContain('scout1');
        expect(state.core.bases[0].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['scout2', 'mate1']),
        );

        scoutPrompt = getSimpleChoicePrompt(state, 'alien_scout_return');
        scoutOption = getPromptOption(
            scoutPrompt,
            (option: any) => option.value?.returnIt === false,
            'second alien scout stay option',
        );
        state = resolveCurrentOption(runner, scoutOption.id);
        expect(state.core.bases[0].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['scout2', 'mate1']),
        );

        const firstMatePrompt = getSimpleChoicePrompt(state, 'pirate_first_mate_choose_base');
        const moveMateOption = getPromptOption(
            firstMatePrompt,
            (option: any) => option.value?.baseIndex === 1,
            'first mate destination option',
        );
        state = resolveCurrentOption(runner, moveMateOption.id);

        expectNoPrompt(state);
        expect(state.core.bases[0].minions).toHaveLength(0);
        expect(state.core.bases[1].minions.map(minion => minion.uid)).toEqual(['mate1']);
        expect(state.core.players['0'].hand.map(card => card.uid)).toEqual(
            expect.arrayContaining(['weak1', 'scout1']),
        );
    });

    it('巫师学院结算后仍会继续弹出侦察兵回手', () => {
        const runner = createRunner((core) => {
            core.bases = [
                makeBase('base_wizard_academy', [
                    makeMinion('scout1', 'alien_scout', '0', 3),
                    makeMinion('strong1', 'robot_warbot', '0', 4, { powerCounters: 13 }),
                    makeMinion('enemy1', 'pirate_king', '1', 5),
                ]),
                makeBase('base_secret_garden'),
            ];
            core.baseDeck = ['base_tar_pits', 'base_central_brain', 'base_factory_436-1337'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        const wizardAcademyPrompt = getSimpleChoicePrompt(runner.getState(), 'base_wizard_academy');
        const keepCurrentTopOption = getPromptOption(
            wizardAcademyPrompt,
            (option: any) => option.value?.defId === 'base_tar_pits',
            'wizard academy base deck option',
        );
        let state = resolveCurrentOption(runner, keepCurrentTopOption.id);

        const scoutPrompt = getSimpleChoicePrompt(state, 'alien_scout_return');
        const returnScoutOption = getPromptOption(
            scoutPrompt,
            (option: any) => option.value?.returnIt === true,
            'alien scout return option',
        );
        state = resolveCurrentOption(runner, returnScoutOption.id);

        expectNoPrompt(state);
        expect(state.core.players['0'].hand.map(card => card.uid)).toContain('scout1');
        expect(state.core.bases[0].minions).toHaveLength(0);
        expect(state.core.baseDeck[0]).toBe('base_central_brain');
    });
});
