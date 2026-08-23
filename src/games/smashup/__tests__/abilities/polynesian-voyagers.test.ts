import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';
import { runCommand } from '../testRunner';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('Polynesian Voyagers 自动选择回归', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('火山爆发只有一个己方随从时也先确认，且可以选择不移动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('volcano', 'polynesian_voyagers_volcanic_uprising', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_island_chain', [
                makeMinion('only-own', 'polynesian_voyagers_tiki', '0', 2),
            ])],
            baseDeck: ['base_island_peak'],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'volcano' },
            },
            FIXED_RANDOM,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.BASE_REPLACED)).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        const prompt = getSimpleChoicePrompt(played.finalState, 'polynesian_voyagers_volcanic_uprising');
        expect(prompt.playerId).toBe('0');
        expect(getPromptOptions(prompt).map(option => option.value?.minionUid).filter(Boolean)).toEqual(['only-own']);

        const skipped = respondToPromptOption(
            played.finalState,
            option => option.value?.skip === true,
            '火山爆发选择不移动',
            '0',
            FIXED_RANDOM,
        );

        expect(skipped.success).toBe(true);
        expect(skipped.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['only-own']);
    });

    it('火山爆发只有一个己方随从时按玩家确认移动，不自动提前移动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('volcano', 'polynesian_voyagers_volcanic_uprising', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_island_chain', [
                makeMinion('only-own', 'polynesian_voyagers_tiki', '0', 2),
            ])],
            baseDeck: ['base_island_peak'],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'volcano' },
            },
            FIXED_RANDOM,
        );
        const moved = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'only-own',
            '火山爆发确认唯一己方随从',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.success).toBe(true);
        expect(moved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({ minionUid: 'only-own', fromBaseIndex: 0, toBaseIndex: 1 }),
        }));
        expect(moved.finalState.core.bases[0].minions).toHaveLength(0);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['only-own']);
    });
});
