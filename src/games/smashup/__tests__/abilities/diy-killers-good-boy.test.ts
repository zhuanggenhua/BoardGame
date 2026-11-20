import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { SU_COMMANDS } from '../../domain/types';
import { getSimpleChoicePrompt, makeCard, makeMatchState, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('他是个好孩子弃牌堆回收', () => {
    it('多个随从时仅列己方弃牌堆随从，选一张回手并保留其他牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('good-boy', 'diy_killers_good_boy', 'action', '0')],
                    discard: [
                        makeCard('one', 'diy_killers_jason', 'minion', '0'),
                        makeCard('two', 'wizard_neophyte', 'minion', '0'),
                        makeCard('action', 'diy_killers_origin_story', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', { discard: [makeCard('enemy', 'ninja_acolyte', 'minion', '1')] }),
            },
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'good-boy' } });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_good_boy');
        expect(prompt.targetType).toBe('discard');
        expect(prompt.options.map(option => option.value?.cardUid).sort()).toEqual(['one', 'two']);
        const selected = respondToPromptOption(played.finalState, option => option.value?.cardUid === 'two', '回收指定随从');
        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['two']);
        expect(selected.finalState.core.players['0'].discard.map(card => card.uid).sort()).toEqual(['action', 'good-boy', 'one']);
        expect(selected.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['enemy']);
        expect(selected.finalState.core.players['0'].actionLimit).toBe(2);
        expect(selected.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('没有可回收随从时仍执行独立的额外行动部分', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('good-boy', 'diy_killers_good_boy', 'action', '0')] }),
                '1': makePlayer('1'),
            },
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'good-boy' } });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].actionLimit).toBe(2);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toContain('good-boy');
        expect(played.finalState.sys.interaction?.current).toBeUndefined();
    });
});
