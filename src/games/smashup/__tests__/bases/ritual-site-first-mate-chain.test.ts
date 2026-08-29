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
    getPromptOptions,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getPromptSourceId,
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

function openNextFirstMatePrompt(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    state: MatchState<SmashUpCore>,
): { state: MatchState<SmashUpCore>; prompt: any } {
    const currentPrompt = getSimpleChoicePrompt(state);
    if (getPromptSourceId(currentPrompt) === 'smashup_reaction_choose') {
        const firstMateTrigger = getReactionPromptOptionBySourceDefId(
            state,
            currentPrompt,
            'pirate_first_mate',
        );
        state = resolveCurrentOption(runner, firstMateTrigger.id, currentPrompt.playerId);
    }
    return {
        state,
        prompt: getSimpleChoicePrompt(state, 'pirate_first_mate_choose_base'),
    };
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
            core.baseDeck = ['base_the_factory'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        let { state, prompt: firstMatePrompt } = openNextFirstMatePrompt(runner, runner.getState());
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

    it('仪式场所先结算后，多个大副不会在链路中途丢失后续移动交互', () => {
        const runner = createRunner((core) => {
            core.bases = [
                makeBase('base_ritual_site', [
                    makeMinion('mate1', 'pirate_first_mate', '0', 2),
                    makeMinion('mate2', 'pirate_first_mate', '0', 2),
                    makeMinion('ally1', 'alien_invader', '0', 14),
                    makeMinion('enemy1', 'robot_zapbot', '1', 4),
                ]),
                makeBase('base_secret_garden'),
                makeBase('base_tar_pits'),
                makeBase('base_the_factory'),
            ];
            core.baseDeck = ['base_central_brain'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        let { state, prompt: firstPrompt } = openNextFirstMatePrompt(runner, runner.getState());
        const firstMove = getPromptOption(
            firstPrompt,
            (option: any) => option.value?.baseDefId === 'base_secret_garden',
            'first mate target base option #1',
        );
        state = resolveCurrentOption(runner, firstMove.id);

        const openedSecond = openNextFirstMatePrompt(runner, state);
        state = openedSecond.state;
        const secondPrompt = openedSecond.prompt;
        expect(secondPrompt).toBeDefined();
        const secondMove = getPromptOption(
            secondPrompt,
            (option: any) => option.value?.baseDefId === 'base_tar_pits',
            'first mate target base option #2',
        );
        state = resolveCurrentOption(runner, secondMove.id);

        expectNoPrompt(state);
        expect(state.core.bases[1].minions.map(minion => minion.uid)).toContain('mate1');
        expect(state.core.bases[2].minions.map(minion => minion.uid)).toContain('mate2');
        expect(state.core.players['0'].deck.some(card => card.uid === 'mate1')).toBe(false);
        expect(state.core.players['0'].deck.some(card => card.uid === 'mate2')).toBe(false);
    });

    it('仪式场所先结算后，统一反应入口会同时暴露两张大副，而不是只剩其中一张', () => {
        const runner = createRunner((core) => {
            core.bases = [
                makeBase('base_ritual_site', [
                    makeMinion('mate1', 'pirate_first_mate', '0', 2),
                    makeMinion('mate2', 'pirate_first_mate', '0', 2),
                    makeMinion('ally1', 'alien_invader', '0', 14),
                    makeMinion('enemy1', 'robot_zapbot', '1', 4),
                ]),
                makeBase('base_secret_garden'),
                makeBase('base_tar_pits'),
                makeBase('base_the_factory'),
            ];
            core.baseDeck = ['base_central_brain'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        const state = runner.getState();
        const reactionPrompt = getReactionPrompt(state);
        const queueById = new Map((state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
        const firstMateOptions = getPromptOptions(reactionPrompt).filter((option: any) => {
            return queueById.get(option.value?.triggerId)?.sourceDefId === 'pirate_first_mate';
        });

        expect(firstMateOptions).toHaveLength(2);
    });
});
