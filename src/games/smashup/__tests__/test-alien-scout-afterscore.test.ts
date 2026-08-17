/**
 * 验证 alien_scout 的 afterScoring trigger 不依赖 special abilityTag。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { fireTriggers } from '../domain/ongoingEffects';
import {
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeMatchState,
    makeMinion,
    makeState,
    respondToPromptOption,
} from './helpers';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

const dummyRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(arr: T[]) => [...arr],
};

function triggerScoutAfterScoring() {
    const core = makeState({
        bases: [
            makeBase('base_great_library', [
                makeMinion('scout1', 'alien_scout', '1', 3),
                makeMinion('m1', 'wizard_neophyte', '0', 2),
            ]),
        ],
    });

    const result = fireTriggers(core, 'afterScoring', {
        state: core,
        matchState: makeMatchState(core),
        playerId: '0',
        baseIndex: 0,
        rankings: [{ playerId: '0', power: 10, vp: 3 }],
        random: dummyRandom,
        now: 100,
    });

    return { core, result };
}

describe('alien_scout afterScoring trigger', () => {
    it('计分后创建是否回手的 prompt', () => {
        const { result } = triggerScoutAfterScoring();

        const prompt = getSimpleChoicePrompt(result.matchState!, 'alien_scout_return');
        const optionIds = getPromptOptions(prompt).map(option => option.id);

        expect(prompt.targetType ?? prompt.data?.targetType).toBe('field-source-action');
        expect(optionIds).toEqual(expect.arrayContaining(['source-scout1-action', 'no']));
        expect(getPromptOptions(prompt).find(option => option.id === 'source-scout1-action')?.value).toEqual(
            expect.objectContaining({
                fieldInteractionType: 'source-action',
                fieldSourceType: 'minion',
                sourceUid: 'scout1',
                returnIt: true,
            }),
        );
    });

    it('选择回手后侦察兵从基地进入控制者手牌', () => {
        const { result } = triggerScoutAfterScoring();
        getSimpleChoicePrompt(result.matchState!, 'alien_scout_return');

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.returnIt === true,
            'alien scout return option',
            '1',
            dummyRandom,
        );
        const next = resolved.finalState.core;

        expect(next.players['1'].hand.some(card => card.uid === 'scout1' && card.defId === 'alien_scout')).toBe(true);
        expect(next.bases[0].minions.some(minion => minion.uid === 'scout1')).toBe(false);
    });
});
