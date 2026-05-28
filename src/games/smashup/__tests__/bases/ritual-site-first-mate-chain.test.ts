import { beforeAll, describe, expect, it } from 'vitest';
import { createInitialSystemState } from '../../../../engine/pipeline';
import { GameTestRunner } from '../../../../engine/testing/GameTestRunner';
import type { MatchState, PlayerId, RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SmashUpDomain, smashUpSystemsForTest } from '../../game';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    makeBase,
    makeMinion,
} from '../helpers';

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
    expect(result.success, result.error).toBe(true);
    return result.finalState;
}

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('base_ritual_site + pirate_first_mate afterScoring 链路', () => {
    it('仪式场所先结算后，大副仍会继续弹出移动交互并从牌库回到目标基地', () => {
        const runner = createRunner((core) => {
            core.bases = [
                makeBase('base_ritual_site', [
                    makeMinion('mate1', 'pirate_first_mate', '0', 2),
                    makeMinion('ally1', 'alien_invader', '0', 15),
                    makeMinion('enemy1', 'robot_zapbot', '1', 3),
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
        const ritualSiteTrigger = getReactionPromptOptionBySourceDefId(
            runner.getState(),
            reactionPrompt,
            'base_ritual_site',
        );
        let state = resolveCurrentOption(runner, ritualSiteTrigger.id);

        const firstMatePrompt = getSimpleChoicePrompt(state, 'pirate_first_mate_choose_base');
        expect(firstMatePrompt).toBeDefined();
        const moveOption = getPromptOption(
            firstMatePrompt,
            (option: any) => option.value?.baseDefId === 'base_secret_garden',
            'first mate target base option',
        );
        state = resolveCurrentOption(runner, moveOption.id);

        expectNoPrompt(state);
        expect(state.core.bases[1].minions.map(minion => minion.uid)).toContain('mate1');
        expect(state.core.players['0'].deck.some(card => card.uid === 'mate1')).toBe(false);
    });
});
