import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import { getFirstPrompt, getPromptOptions, getPromptSourceId, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption, respondToPromptOptions } from '../helpers';
import { runCommand } from '../testRunner';

describe('相扑手无标签随从的出牌时机', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('打出相扑新人时立即询问是否弃牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('rookie', 'sumo_wrestlers_rookie_sumo', 'minion', '0'),
                    makeCard('fodder', 'sumo_wrestlers_chikara_mizu', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [])],
        }));
        const result = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'rookie', baseIndex: 0 } });
        expect(result.success, result.error).toBe(true);
        expect(getPromptSourceId(getFirstPrompt(result.finalState))).toBe('sumo_wrestlers_rookie_sumo_discard');
    });

    it('打出关胁时立即询问是否移动对手的低力量随从', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('third', 'sumo_wrestlers_third_tier', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('enemy', 'sumo_wrestlers_rookie_sumo', '1', 2)]),
                makeBase('base_b', []),
            ],
        }));
        const result = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'third', baseIndex: 0 } });
        expect(result.success, result.error).toBe(true);
        expect(getFirstPrompt(result.finalState)).toBeDefined();
    });

    it('相扑新人是最后一张手牌时没有可弃牌选择', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('last-rookie', 'sumo_wrestlers_rookie_sumo', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [])],
        }));
        const result = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'last-rookie', baseIndex: 0 } });
        expect(result.success, result.error).toBe(true);
        expect(getFirstPrompt(result.finalState)).toBeUndefined();
        expect(result.finalState.core.players['0'].hand).toHaveLength(0);
    });

    it.each([
        ['sumo_wrestlers_rookie_sumo', 2],
        ['sumo_wrestlers_third_tier', 3],
    ] as const)('场上的 %s 不能在后续回合当作天赋重复发动', (defId, power) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('fodder', 'sumo_wrestlers_chikara_mizu', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('source', defId, '0', power), makeMinion('enemy', 'sumo_wrestlers_rookie_sumo', '1', 2)]),
                makeBase('base_b', []),
            ],
        }));
        const result = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'source', baseIndex: 0 } });
        expect(result.success).toBe(false);
    });

    it('炖肉弃两张牌时可以把两个指示物分给不同的己方随从', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('stew', 'sumo_wrestlers_bulking_stew', 'action', '0'),
                    makeCard('discard-a', 'sumo_wrestlers_chikara_mizu', 'action', '0'),
                    makeCard('discard-b', 'sumo_wrestlers_grasp_the_belt', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('own-a', 'sumo_wrestlers_rookie_sumo', '0', 2),
                makeMinion('own-b', 'sumo_wrestlers_rookie_sumo', '0', 2),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'stew' } });
        expect(played.success, played.error).toBe(true);
        const cards = getPromptOptions(getFirstPrompt(played.finalState))
            .filter(option => ['discard-a', 'discard-b'].includes(option.value?.cardUid))
            .map(option => option.id);
        expect(cards).toHaveLength(2);
        const chosenCards = respondToPromptOptions(played.finalState, cards, '0');
        expect(chosenCards.success, chosenCards.error).toBe(true);
        const first = respondToPromptOption(chosenCards.finalState, option => option.value?.minionUid === 'own-a', '炖肉第一个指示物给随从 A', '0');
        expect(first.success, first.error).toBe(true);
        expect(getFirstPrompt(first.finalState)).toBeDefined();
        const second = respondToPromptOption(first.finalState, option => option.value?.minionUid === 'own-b', '炖肉第二个指示物给随从 B', '0');
        expect(second.success, second.error).toBe(true);
        expect(second.finalState.core.bases[0].minions.map(minion => minion.powerCounters ?? 0)).toEqual([1, 1]);
    });

    it('炖肉连续给同一随从放指示物时，多张手牌只算一次弃牌触发', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('stew-same', 'sumo_wrestlers_bulking_stew', 'action', '0'),
                    makeCard('same-a', 'sumo_wrestlers_chikara_mizu', 'action', '0'),
                    makeCard('same-b', 'sumo_wrestlers_grasp_the_belt', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('top-tier', 'sumo_wrestlers_top_tier', '0', 4),
                makeMinion('target', 'sumo_wrestlers_rookie_sumo', '0', 2),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'stew-same' } });
        const cards = getPromptOptions(getFirstPrompt(played.finalState))
            .filter(option => ['same-a', 'same-b'].includes(option.value?.cardUid)).map(option => option.id);
        const discarded = respondToPromptOptions(played.finalState, cards, '0');
        const first = respondToPromptOption(discarded.finalState, option => option.value?.minionUid === 'target', '炖肉第一个指示物', '0');
        const second = respondToPromptOption(first.finalState, option => option.value?.minionUid === 'target', '炖肉第二个指示物', '0');
        expect(second.success, second.error).toBe(true);
        expect(second.finalState.core.bases[0].minions.map(minion => minion.powerCounters ?? 0)).toEqual([1, 2]);
    });

    it.each([false, true])('斗志奖先抽两张牌，即使没有己方随从（有随从：%s）', (hasMinion) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('prize', 'sumo_wrestlers_fighting_spirit_prize', 'action', '0')],
                    deck: [makeCard('draw-a', 'sumo_wrestlers_chikara_mizu', 'action', '0'), makeCard('draw-b', 'sumo_wrestlers_rookie_sumo', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', hasMinion ? [makeMinion('own', 'sumo_wrestlers_rookie_sumo', '0', 2)] : [])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'prize' } });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        if (hasMinion) expect(getFirstPrompt(played.finalState)).toBeDefined();
        else expect(getFirstPrompt(played.finalState)).toBeUndefined();
    });
});
