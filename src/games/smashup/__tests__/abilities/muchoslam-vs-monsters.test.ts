import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getFirstPrompt, getPromptOptions, invokeRegisteredAbilityContract, makeBase, makeCard, makeMatchState, makePlayer, makeState, respondToPromptOption, respondToPromptOptions } from '../helpers';

const random = { random: () => 0, d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => [...items].reverse() };

describe('Muchoslam 大战怪物', () => {
    beforeEach(() => { resetAbilityInit(); initAllAbilities(); });

    it('玩家从已选的可附着行动中选择回手，其他牌与整个牌库一起洗牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'luchadors_yellow_demon', 'minion', '0'), makeCard('deck-b', 'luchadors_capa_roja', 'minion', '0')],
                    discard: [
                        makeCard('quick', 'luchadors_quick_set_up', 'action', '0'),
                        makeCard('smart', 'luchadors_smart_set_up', 'action', '0'),
                        makeCard('standard', 'musketeers_biding_time', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        });
        const result = invokeRegisteredAbilityContract('luchadors_senor_muchoslam_vs_the_monsters', 'onPlay', {
            state: core, matchState: makeMatchState(core), playerId: '0', cardUid: 'source', defId: 'luchadors_senor_muchoslam_vs_the_monsters', baseIndex: 0, random, now: 1,
        });
        const firstOptions = getPromptOptions(getFirstPrompt(result.matchState!));
        const selectedIds = firstOptions.filter(option => ['quick', 'smart', 'standard'].includes(option.value?.cardUid)).map(option => option.id);
        const selected = respondToPromptOptions(result.matchState!, selectedIds, '0', random);
        expect(selected.success, selected.error).toBe(true);
        const rawRecoverOptions = getPromptOptions(getFirstPrompt(selected.finalState));
        const recoverOptions = rawRecoverOptions.map(option => option.value?.cardUid);
        expect(recoverOptions).toEqual(expect.arrayContaining(['quick', 'smart']));
        expect(recoverOptions).not.toContain('standard');
        expect(rawRecoverOptions.find(option => option.value?.cardUid === 'smart')?.value?.defId).toBe('luchadors_smart_set_up');
        const recovered = respondToPromptOption(selected.finalState, option => option.value?.cardUid === 'smart', '选择回手行动', '0', random);
        expect(recovered.success, recovered.error).toBe(true);
        expect(recovered.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['smart']);
        expect(recovered.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['standard', 'quick', 'deck-b', 'deck-a']);
    });

    it('只选择普通行动时不回手，但仍将所选牌与整副牌库洗在一起', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'luchadors_yellow_demon', 'minion', '0')],
                    discard: [makeCard('standard', 'musketeers_biding_time', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        });
        const result = invokeRegisteredAbilityContract('luchadors_senor_muchoslam_vs_the_monsters', 'onPlay', {
            state: core, matchState: makeMatchState(core), playerId: '0', cardUid: 'source', defId: 'luchadors_senor_muchoslam_vs_the_monsters', baseIndex: 0, random, now: 1,
        });
        const selectedIds = getPromptOptions(getFirstPrompt(result.matchState!)).filter(option => option.value?.cardUid === 'standard').map(option => option.id);
        const selected = respondToPromptOptions(result.matchState!, selectedIds, '0', random);
        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.players['0'].hand).toEqual([]);
        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['standard', 'deck-a']);
        expect(selected.finalState.sys.interaction?.current).toBeUndefined();
    });
});
