import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { expectNoPrompt, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('地狱魔盒摧毁触发', () => {
    it('两次独立行动各摧毁一个随从，应各抽一张牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    actionLimit: 2,
                    hand: [makeCard('broadside-1', 'pirate_broadside', 'action', '0'), makeCard('broadside-2', 'pirate_broadside', 'action', '0')],
                    deck: [makeCard('draw-1', 'wizard_neophyte', 'minion', '0'), makeCard('draw-2', 'wizard_neophyte', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                })]),
                makeBase('base_b', [makeMinion('ally-1', 'pirate_buccaneer', '0', 4), makeMinion('enemy-1', 'ninja_acolyte', '1', 2)]),
                makeBase('base_c', [makeMinion('ally-2', 'pirate_buccaneer', '0', 4), makeMinion('enemy-2', 'ninja_acolyte', '1', 2)]),
            ],
        }));
        let current = state;
        for (const [cardUid, baseIndex] of [['broadside-1', 1], ['broadside-2', 2]] as const) {
            const played = runCommand(current, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid } });
            expect(played.success, played.error).toBe(true);
            const base = respondToPromptOption(played.finalState, option => option.value?.baseIndex === baseIndex, '选择被攻击基地');
            expect(base.success, base.error).toBe(true);
            const target = respondToPromptOption(base.finalState, option => option.value?.targetPlayerId === '1', '选择对手');
            expect(target.success, target.error).toBe(true);
            current = target.finalState;
        }
        expect(current.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
    });

    it('魔盒宿主与另一随从同时被摧毁时，魔盒仍见证该次摧毁并只抽一张', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside', 'pirate_broadside', 'action', '0')],
                    deck: [makeCard('draw-1', 'wizard_neophyte', 'minion', '0'), makeCard('draw-2', 'wizard_neophyte', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('host', 'ninja_acolyte', '0', 2, { attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }] }),
                makeMinion('ally', 'ninja_acolyte', '0', 2),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside' } });
        expect(played.success, played.error).toBe(true);
        const base = respondToPromptOption(played.finalState, option => option.value?.baseIndex === 0, '选择基地');
        expect(base.success, base.error).toBe(true);
        const resolved = respondToPromptOption(base.finalState, option => option.value?.targetPlayerId === '0', '选择自己');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
        expectNoPrompt(resolved.finalState);
    });

    it('另一个基地同一次效果摧毁两个随从，只抽一张牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside', 'pirate_broadside', 'action', '0')],
                    deck: [makeCard('draw-1', 'wizard_neophyte', 'minion', '0'), makeCard('draw-2', 'wizard_neophyte', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                })]),
                makeBase('base_b', [
                    makeMinion('ally', 'pirate_buccaneer', '0', 4),
                    makeMinion('enemy-1', 'ninja_acolyte', '1', 2),
                    makeMinion('enemy-2', 'ninja_acolyte', '1', 2),
                ]),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside' } });
        expect(played.success, played.error).toBe(true);
        const base = respondToPromptOption(played.finalState, option => option.value?.baseIndex === 1, '选择被攻击基地');
        expect(base.success, base.error).toBe(true);
        const resolved = respondToPromptOption(base.finalState, option => option.value?.targetPlayerId === '1', '选择对手');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid).sort()).toEqual(['enemy-1', 'enemy-2']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
        expectNoPrompt(resolved.finalState);
        expect(resolved.finalState.core.triggerQueue ?? []).toHaveLength(0);
    });
});

describe('同批摧毁的其他杀人狂装备', () => {
    it.each([
        ['爪子手套', 'diy_killers_clawed_glove', 'powerCounters'],
        ['大砍刀', 'diy_killers_machete', 'tempPowerModifier'],
    ] as const)('%s 对同时被摧毁的两个随从只触发一次', (_name, attachment, field) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('broadside', 'pirate_broadside', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'weapon', defId: attachment, ownerId: '0' }],
                }),
                makeMinion('enemy-1', 'ninja_acolyte', '1', 2),
                makeMinion('enemy-2', 'ninja_acolyte', '1', 2),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside' } });
        expect(played.success, played.error).toBe(true);
        const base = respondToPromptOption(played.finalState, option => option.value?.baseIndex === 0, '选择基地');
        expect(base.success, base.error).toBe(true);
        const resolved = respondToPromptOption(base.finalState, option => option.value?.targetPlayerId === '1', '选择对手');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid).sort()).toEqual(['enemy-1', 'enemy-2']);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.[field]).toBe(1);
    });
});

describe('同批摧毁经过雄蜂防止选择', () => {
    it.each([
        ['两次都不防止', false, 2],
        ['防止其中一次', true, 1],
    ])('%s 时，地狱魔盒仍只抽一张', (_name, preventFirst, expectedDestroyed) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside', 'pirate_broadside', 'action', '0')],
                    deck: [makeCard('draw-1', 'wizard_neophyte', 'minion', '0'), makeCard('draw-2', 'wizard_neophyte', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                })]),
                makeBase('base_b', [
                    makeMinion('ally', 'pirate_buccaneer', '0', 4),
                    makeMinion('enemy-1', 'ninja_acolyte', '1', 2),
                    makeMinion('enemy-2', 'ninja_acolyte', '1', 2),
                ]),
                makeBase('base_c', [makeMinion('drone', 'giant_ant_drone', '1', 3, { powerCounters: 2 })]),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside' } });
        expect(played.success, played.error).toBe(true);
        const base = respondToPromptOption(played.finalState, option => option.value?.baseIndex === 1, '选择被攻击基地');
        expect(base.success, base.error).toBe(true);
        const target = respondToPromptOption(base.finalState, option => option.value?.targetPlayerId === '1', '选择对手');
        expect(target.success, target.error).toBe(true);
        const first = respondToPromptOption(target.finalState, option => preventFirst ? option.value?.droneUid === 'drone' : option.value?.skip, '第一次防止选择', '1');
        expect(first.success, first.error).toBe(true);
        if (!preventFirst) expect(first.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({ minionUid: 'enemy-1', sourcePlayerId: '0', sourceDefId: 'pirate_broadside', sourceControllerId: '0', sourceKind: 'action' }),
        }));
        const second = respondToPromptOption(first.finalState, option => option.value?.skip, '第二次防止选择', '1');
        expect(second.success, second.error).toBe(true);
        expect(second.finalState.core.players['1'].discard.filter(card => card.uid.startsWith('enemy-'))).toHaveLength(expectedDestroyed);
        expect(second.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
        expectNoPrompt(second.finalState);
    });
});
