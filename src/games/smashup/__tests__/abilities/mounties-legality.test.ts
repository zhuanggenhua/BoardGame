import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getDiscardSpecialOptions } from '../../domain/discardSpecialAbilities';
import { SU_COMMANDS } from '../../domain/types';
import { getFirstPrompt, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from '../helpers';
import { runCommand } from '../testRunner';

describe('骑警行动的目标合法性', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it.each(['0', '1'])('带进来可以附着到控制者为 %s 的随从', (controller) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('bring', 'mounties_bring_em_in', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('target', 'mounties_dudlee', controller, 2)])],
        }));
        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bring', targetBaseIndex: 0, targetMinionUid: 'target' },
        });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.bases[0].minions[0].attachedActions.some(action => action.uid === 'bring')).toBe(true);
    });

    it('嗯？在弃牌堆时不能凭自身能力打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { discard: [makeCard('eh-discard', 'mounties_eh', 'action', '0')], actionsPlayed: 1 }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('own', 'mounties_dudlee', '0', 2)])],
        });
        expect(getDiscardSpecialOptions(core, '0').some(option => option.card.uid === 'eh-discard')).toBe(false);
    });

    it('手牌中的嗯？在打出本回合第一张行动后提供可选响应', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('first-action', 'sumo_wrestlers_performance_prize', 'action', '0'),
                    makeCard('eh-hand', 'mounties_eh', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('own', 'mounties_dudlee', '0', 2)])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'first-action' } });
        expect(played.success, played.error).toBe(true);
        expect(getFirstPrompt(played.finalState)).toBeDefined();
    });
});
