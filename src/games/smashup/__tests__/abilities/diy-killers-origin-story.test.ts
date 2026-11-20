import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { SU_COMMANDS } from '../../domain/types';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('起源故事牌库为空', () => {
    it('抽牌前牌库为空时洗入弃牌并抽取杀人狂', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('origin', 'diy_killers_origin_story', 'action', '0')],
                    deck: [], discard: [makeCard('jason', 'diy_killers_jason', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'origin' } });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'jason')).toBe(true);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'jason')).toBe(false);
        expect(played.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('洗牌后没有杀人狂时保留洗回的牌并执行额外行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('origin', 'diy_killers_origin_story', 'action', '0')],
                    deck: [], discard: [makeCard('action', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'origin' } });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['action']);
        expect(played.finalState.core.players['0'].hand).toHaveLength(0);
        expect(played.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('共用抽牌路径：简易武器洗入弃牌并允许额外打出抽到的附着行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('weapon', 'diy_killers_improvised_weapon', 'action', '0')],
                    deck: [], discard: [makeCard('machete', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5)])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'weapon' } });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'machete')).toBe(true);
        const selected = respondToPromptOption(played.finalState, option => option.value?.cardUid === 'machete', '立即打出大砍刀');
        expect(selected.success, selected.error).toBe(true);
        const attached = respondToPromptOption(selected.finalState, option => option.value?.minionUid === 'host', '选择宿主');
        expect(attached.success, attached.error).toBe(true);
        expect(attached.finalState.core.bases[0].minions[0].attachedActions.some(action => action.uid === 'machete')).toBe(true);
    });
});
