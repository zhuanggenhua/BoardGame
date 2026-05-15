import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    respondToPrompt,
    expectNoPrompt,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Werewolves abilities', () => {
    it('werewolf_let_the_dog_out 预算跨多次选择递减并支持连续消灭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('w1', 'werewolf_howler', '0', 4, { powerModifier: 0 }),
                    makeMinion('e1', 'enemy_a', '1', 1, { powerModifier: 0 }),
                    makeMinion('e2', 'enemy_b', '1', 3, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt1 = getSimpleChoicePrompt(playResult.finalState, 'werewolf_let_the_dog_out_targets');
        const target1 = getPromptOption(prompt1, option => option.value?.minionUid === 'e1', 'first target');
        const step1 = respondToPrompt(playResult.finalState, target1.id);
        expect(step1.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const prompt2 = getSimpleChoicePrompt(step1.finalState, 'werewolf_let_the_dog_out_targets');
        const target2 = getPromptOption(prompt2, option => option.value?.minionUid === 'e2', 'second target');
        const step2 = respondToPrompt(step1.finalState, target2.id);

        expect(step2.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expectNoPrompt(step2.finalState);
    });

    it('werewolf_let_the_dog_out 预算允许时支持第三次连续选择并消灭剩余目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('w1', 'werewolf_howler', '0', 4, { powerModifier: 0 }),
                    makeMinion('e1', 'enemy_a', '1', 1, { powerModifier: 0 }),
                    makeMinion('e2', 'enemy_b', '1', 1, { powerModifier: 0 }),
                    makeMinion('e3', 'enemy_c', '1', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt1 = getSimpleChoicePrompt(playResult.finalState, 'werewolf_let_the_dog_out_targets');
        const target1 = getPromptOption(prompt1, option => option.value?.minionUid === 'e1', 'first target');
        const step1 = respondToPrompt(playResult.finalState, target1.id);
        expect(step1.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const prompt2 = getSimpleChoicePrompt(step1.finalState, 'werewolf_let_the_dog_out_targets');
        const target2 = getPromptOption(prompt2, option => option.value?.minionUid === 'e2', 'second target');
        const step2 = respondToPrompt(step1.finalState, target2.id);
        expect(step2.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const prompt3 = getSimpleChoicePrompt(step2.finalState, 'werewolf_let_the_dog_out_targets');
        const target3 = getPromptOption(prompt3, option => option.value?.minionUid === 'e3', 'third target');
        const step3 = respondToPrompt(step2.finalState, target3.id);

        expect(step3.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(1);
        expectNoPrompt(step3.finalState);
        expect(step3.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['w1']);
    });

    it('werewolf_let_the_dog_out 第一次消灭后按剩余预算过滤目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('w1', 'werewolf_howler', '0', 4, { powerModifier: 0 }),
                    makeMinion('e1', 'enemy_a', '1', 2, { powerModifier: 0 }),
                    makeMinion('e2', 'enemy_b', '1', 3, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        const prompt1 = getSimpleChoicePrompt(playResult.finalState, 'werewolf_let_the_dog_out_targets');
        const firstTarget = getPromptOption(prompt1, option => option.value?.minionUid === 'e1', 'first target');

        const step1 = respondToPrompt(playResult.finalState, firstTarget.id);

        expectNoPrompt(step1.finalState);
    });
});
