/**
 * 远古之物多选功能集成测试
 *
 * 通过真实 PLAY_MINION 命令入口验证：
 * 打出远古之物 -> 选择消灭 -> 两步选择两个己方随从 -> 一次性消灭所选目标。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import {
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondCommand,
} from './helpers';
import { runCommand } from './testRunner';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('远古之物多选集成测试', () => {
    it('通过真实命令链选择并消灭两个己方随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['elder_things', 'aliens'] as [string, string],
                    hand: [makeCard('et-card', 'elder_thing_elder_thing', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_homeworld', [
                    makeMinion('m1', 'alien_invader', '0', 3),
                    makeMinion('m2', 'alien_supreme_overlord', '0', 4),
                    makeMinion('m3', 'alien_scout', '0', 2),
                ]),
            ],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'et-card', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        const modePrompt = getSimpleChoicePrompt(play.finalState, 'elder_thing_elder_thing_choice');
        expect(getPromptSourceId(modePrompt)).toBe('elder_thing_elder_thing_choice');
        const destroyMode = getPromptOption(modePrompt, option => option.id === 'destroy', 'destroy mode option');

        const afterMode = runCommand(play.finalState, respondCommand(destroyMode.id, '0'));
        expect(afterMode.success).toBe(true);

        const firstPrompt = getSimpleChoicePrompt(afterMode.finalState, 'elder_thing_elder_thing_destroy_first');
        expect(getPromptSourceId(firstPrompt)).toBe('elder_thing_elder_thing_destroy_first');
        expect(getPromptOptions(firstPrompt)).toHaveLength(3);
        const firstTarget = getPromptOption(
            firstPrompt,
            option => option.value?.minionUid === 'm1',
            'first destroy target',
        );

        const afterFirst = runCommand(afterMode.finalState, respondCommand(firstTarget.id, '0'));
        expect(afterFirst.success).toBe(true);

        const secondPrompt = getSimpleChoicePrompt(afterFirst.finalState, 'elder_thing_elder_thing_destroy_second');
        expect(getPromptSourceId(secondPrompt)).toBe('elder_thing_elder_thing_destroy_second');
        const secondOptions = getPromptOptions(secondPrompt);
        expect(secondOptions.some(option => option.value?.minionUid === 'm1')).toBe(false);
        const secondTarget = getPromptOption(
            secondPrompt,
            option => option.value?.minionUid === 'm3',
            'second destroy target',
        );

        const afterSecond = runCommand(afterFirst.finalState, respondCommand(secondTarget.id, '0'));
        expect(afterSecond.success).toBe(true);

        const destroyEvents = afterSecond.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents.map(event => (event as any).payload.minionUid)).toEqual(['m1', 'm3']);
        expect(afterSecond.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['m2', 'et-card']);
    });
});
