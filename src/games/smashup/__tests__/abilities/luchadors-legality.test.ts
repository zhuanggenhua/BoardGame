import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import { getFirstPrompt, getPromptOptions, invokeRegisteredAbilityContract, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

describe('摔角手行动目标合法性', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it.each([
        ['没有附着行动', undefined, undefined, false],
        ['只有其他玩家行动', '1', undefined, false],
        ['有自己的行动', '0', undefined, true],
        ['行动原属对手但由自己控制', '1', '0', true],
        ['行动原属自己但由对手控制', '0', '1', false],
    ] as const)('压制的目标%s', (_label, actionOwner, actionController, expected) => {
        const attachedActions = actionOwner === undefined ? [] : [
            { uid: 'existing', defId: 'luchadors_quick_set_up', ownerId: actionOwner, ...(actionController ? { metadata: { sourceControllerId: actionController } } : {}) },
        ];
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('pin', 'luchadors_pin', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('target', 'ninja_acolyte', '1', 2, { attachedActions })])],
        }));
        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pin', targetBaseIndex: 0, targetMinionUid: 'target' },
        });
        expect(played.success, played.error).toBe(expected);
    });

    it('POD 版压制同样不能打在没有自己行动的随从上', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('pin-pod', 'luchadors_pin_pod', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('target', 'ninja_acolyte', '1', 2)])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'pin-pod', targetBaseIndex: 0, targetMinionUid: 'target' } });
        expect(played.success).toBe(false);
    });

    it.each(['0', '1'])('聪明 Set-Up 宿主控制者为 %s 时，首个随从打到该基地后仍抽牌', (hostController) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('new-minion', 'musketeers_young_musketeer', 'minion', '0')],
                    deck: [makeCard('draw', 'luchadors_tag_team', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('host', 'ninja_acolyte', hostController, 2, {
                attachedActions: [{ uid: 'smart', defId: 'luchadors_smart_set_up', ownerId: '0' }],
            })])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'new-minion', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toContain('draw');
    });

    it('世界冠军同名持续行动的宿主转为己方控制后仍会触发', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('new-minion', 'musketeers_young_musketeer', 'minion', '0')],
                    deck: [makeCard('draw', 'luchadors_tag_team', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('host', 'ninja_acolyte', '0', 2, {
                attachedActions: [{ uid: 'world-smart', defId: 'world_champs_smart_set_up', ownerId: '0' }],
            })])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'new-minion', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toContain('draw');
    });

    it('黄色恶魔可按名字检索 POD 和世界冠军的 Set-Up 行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('yellow', 'luchadors_yellow_demon', 'minion', '0')],
                    deck: [makeCard('pod', 'luchadors_quick_set_up_pod', 'action', '0')],
                    discard: [makeCard('world', 'world_champs_smart_set_up', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'yellow', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const candidates = getPromptOptions(getFirstPrompt(played.finalState)).map(option => option.value?.cardUid);
        expect(candidates).toEqual(expect.arrayContaining(['pod', 'world']));
    });

    it('逆转可选择带其他玩家 Set-Up 的随从，并允许从多个目标中选择', () => {
        const core = makeState({ bases: [makeBase('base_a', [
            makeMinion('first', 'ninja_acolyte', '1', 2, { attachedActions: [{ uid: 'own-setup', defId: 'luchadors_quick_set_up', ownerId: '0' }] }),
            makeMinion('second', 'ninja_acolyte', '1', 2, { attachedActions: [{ uid: 'enemy-setup', defId: 'world_champs_smart_set_up', ownerId: '1' }] }),
        ])] });
        const random = { random: () => 0, d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => [...items] };
        const result = invokeRegisteredAbilityContract('luchadors_reversal', 'special', {
            state: core, matchState: makeMatchState(core), playerId: '0', cardUid: 'reversal', defId: 'luchadors_reversal', baseIndex: 0,
            random, now: 1,
        });
        expect(result.matchState).toBeDefined();
        const candidates = getPromptOptions(getFirstPrompt(result.matchState!)).map(option => option.value?.minionUid);
        expect(candidates).toEqual(expect.arrayContaining(['first', 'second']));
        const selected = respondToPromptOption(result.matchState!, option => option.value?.minionUid === 'second', '选择第二个逆转目标', '0', random);
        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.bases[0].minions.find(minion => minion.uid === 'second')?.controller).toBe('0');
        expect(selected.finalState.core.bases[0].minions.find(minion => minion.uid === 'first')?.controller).toBe('1');
        expect(selected.finalState.core.bases[0].minions.find(minion => minion.uid === 'second')?.attachedActions.map(action => action.uid)).toContain('enemy-setup');
    });

    it('Muchoslam 天赋的额外行动不能用于普通无目标行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('ordinary', 'luchadors_tag_team', 'action', '0')], actionsPlayed: 1, actionLimit: 1 }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('muchoslam', 'luchadors_senor_muchoslam', '0', 5),
                makeMinion('enemy', 'ninja_acolyte', '1', 2),
            ])],
        }));
        const talent = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'muchoslam', baseIndex: 0 } });
        expect(talent.success, talent.error).toBe(true);
        const played = runCommand(talent.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ordinary' } });
        expect(played.success).toBe(false);
    });
});
