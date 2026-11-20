import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { buildSmashUpAiLegalActions } from '../../ai';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { SU_COMMANDS } from '../../domain/types';
import { getPromptPlayerId, getSimpleChoicePrompt, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('躲藏在洗衣间与移动保护', () => {
    it('第三位玩家打出杀人狂时，由被附着随从的控制者决定是否逃离', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('action-owner-hand', 'ninja_shinobi', 'minion', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('host-owner-hand', 'ninja_shinobi', 'minion', '1')] }),
                '2': makePlayer('2', { hand: [makeCard('third-killer', 'diy_killers_jason', 'minion', '2')] }),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 2,
            bases: [
                makeBase('base_a', [makeMinion('host-third', 'ninja_acolyte', '1', 2, {
                    attachedActions: [{ uid: 'laundry-third', defId: 'diy_killers_laundry_room', ownerId: '0' }],
                })]),
                makeBase('base_b', []),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '2', payload: { cardUid: 'third-killer', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_laundry_room_escape');
        expect(getPromptPlayerId(prompt)).toBe('1');
        expect(prompt.options.some(option => option.value?.cardUid === 'host-owner-hand')).toBe(true);
        expect(prompt.options.some(option => option.value?.cardUid === 'action-owner-hand')).toBe(false);
    });

    it('随从不能移动时不应提供弃牌并移动的逃离选项', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('jason', 'diy_killers_jason', 'minion', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('hand', 'ninja_acolyte', 'minion', '1')] }),
            },
            bases: [
                makeBase({
                    minions: [makeMinion('host', 'ninja_acolyte', '1', 2, {
                        attachedActions: [{ uid: 'laundry', defId: 'diy_killers_laundry_room', ownerId: '0' }],
                    })],
                    ongoingActions: [{ uid: 'entangled', defId: 'killer_plant_entangled', ownerId: '1' }],
                }),
                makeBase('base_b', []),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'jason', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_laundry_room_destroy');
        expect(prompt.options.some(option => option.value?.mode === 'destroy')).toBe(true);
        expect(played.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['hand']);
        const actions = buildSmashUpAiLegalActions({ playerId: '0', state: played.finalState });
        const destroyAction = actions.find(action => (action.metadata?.optionValue as { mode?: string } | undefined)?.mode === 'destroy');
        expect(destroyAction).toBeDefined();
        expect(buildSmashUpAiLegalActions({ playerId: '1', state: played.finalState })).toEqual([]);
        const destroyed = runCommand(played.finalState, { ...destroyAction!.commands[0], playerId: '0' } as any);
        expect(destroyed.success, destroyed.error).toBe(true);
        expect(destroyed.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['hand']);
        expect(destroyed.finalState.core.players['1'].discard.some(card => card.uid === 'host')).toBe(true);
        expect(destroyed.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('记录可移动时宿主控制者弃牌并移动宿主的现行路径', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('jason', 'diy_killers_jason', 'minion', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('hand', 'ninja_shinobi', 'minion', '1')] }),
            },
            bases: [
                makeBase('base_a', [makeMinion('host', 'ninja_acolyte', '1', 2, {
                    attachedActions: [{ uid: 'laundry', defId: 'diy_killers_laundry_room', ownerId: '0' }],
                })]),
                makeBase('base_the_mothership', []),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'jason', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_laundry_room_escape');
        expect(prompt.options.find(option => option.value?.cardUid === 'hand')).toBeDefined();
        const cardAction = buildSmashUpAiLegalActions({ playerId: '1', state: played.finalState })
            .find(action => (action.metadata?.optionValue as { cardUid?: string } | undefined)?.cardUid === 'hand');
        expect(cardAction).toBeDefined();
        const selected = runCommand(played.finalState, { ...cardAction!.commands[0], playerId: '1' } as any);
        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['hand']);
        getSimpleChoicePrompt(selected.finalState, 'diy_killers_laundry_room_escape_base');
        const declined = respondToPromptOption(selected.finalState, option => option.value?.skip === true, '不逃离', '1');
        expect(declined.success, declined.error).toBe(true);
        expect(declined.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['hand']);
        expect(getSimpleChoicePrompt(declined.finalState, 'diy_killers_laundry_room_destroy')).toBeDefined();
        const baseAction = buildSmashUpAiLegalActions({ playerId: '1', state: selected.finalState })
            .find(action => (action.metadata?.optionValue as { baseIndex?: number } | undefined)?.baseIndex === 1);
        expect(baseAction).toBeDefined();
        const escaped = runCommand(selected.finalState, { ...baseAction!.commands[0], playerId: '1' } as any);
        expect(escaped.success, escaped.error).toBe(true);
        expect(escaped.finalState.core.players['1'].hand).toHaveLength(0);
        expect(escaped.finalState.core.players['1'].discard.some(card => card.uid === 'hand')).toBe(true);
        expect(escaped.finalState.core.bases[1].minions.some(minion => minion.uid === 'host')).toBe(true);
        expect(escaped.finalState.sys.interaction?.current).toBeUndefined();
    });
});
