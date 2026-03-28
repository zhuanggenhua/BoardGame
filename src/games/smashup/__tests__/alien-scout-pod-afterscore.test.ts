import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { fireTriggers } from '../domain/ongoingEffects';
import { makeBase, makeMatchState, makeMinion, makeState } from './helpers';

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

describe('外星侦察兵 afterScoring', () => {
    it('alien_scout_pod 会创建返回手牌交互', () => {
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout_pod', '1', 3),
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

        expect(result.matchState?.sys.interaction?.current?.data.sourceId).toBe('alien_scout_return');
    });

    it('alien_scout 基础版也会创建返回手牌交互', () => {
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

        expect(result.matchState?.sys.interaction?.current?.data.sourceId).toBe('alien_scout_return');
    });

    it('同时存在基础版和 POD 版时会创建两个独立交互', () => {
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('scout2', 'alien_scout_pod', '1', 3),
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

        expect(result.matchState?.sys.interaction?.current?.data.sourceId).toBe('alien_scout_return');
        expect(result.matchState?.sys.interaction?.queue).toHaveLength(1);
        expect(result.matchState?.sys.interaction?.queue?.[0]?.data?.sourceId).toBe('alien_scout_return');
    });

    it('交互解决时若侦察兵已离场，则不会重复返回', () => {
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
            now: 101,
        });

        const interaction = result.matchState!.sys.interaction!.current!;
        const returnOption = interaction.data.options.find((entry: any) => entry.value?.returnIt === true);
        const handler = getInteractionHandler('alien_scout_return');

        expect(interaction.data.sourceId).toBe('alien_scout_return');
        expect(returnOption).toBeDefined();
        expect(handler).toBeDefined();

        const staleCore = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
            players: {
                '0': core.players['0'],
                '1': {
                    ...core.players['1'],
                    discard: [
                        ...core.players['1'].discard,
                        { uid: 'scout1', defId: 'alien_scout', type: 'minion', owner: '1' },
                    ],
                },
            },
        });

        const resolved = handler!(
            makeMatchState(staleCore),
            '1',
            returnOption.value,
            interaction.data,
            dummyRandom,
            102,
        );

        expect(resolved?.events ?? []).toHaveLength(0);
    });
});
