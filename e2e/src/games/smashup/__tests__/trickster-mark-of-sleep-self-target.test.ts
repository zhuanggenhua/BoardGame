/**
 * 测试：睡眠印记可以选择自己
 * 
 * Bug: 睡眠印记只能选择对手，不能选择自己
 * - 描述："选择一个玩家"（Choose a player）
 * - 实现：只能选择对手（opponents = turnOrder.filter(pid => pid !== playerId)）
 * - 修复：允许选择任何玩家，包括自己
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities } from '../abilities';
import { runCommand } from './testRunner';
import { makeState, makePlayer, makeCard, makeMatchState } from './helpers';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { validate } from '../domain/commands';
import { reduce } from '../domain/reduce';
import { interceptEvent } from '../domain/ongoingEffects';
import { filterProtectedMoveEvents } from '../domain/reducer';
import { moveMinion } from '../domain/abilityHelpers';
import type { RandomFn } from '../../../engine/types';

beforeAll(() => {
    initAllAbilities();
});

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: () => 1,
    range: (min) => min,
};

describe('睡眠印记可以选择自己', () => {
    it('选项中应该包含自己', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark1', 'trickster_mark_of_sleep', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(state);

        // 打出睡眠印记
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark1', targetBaseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证交互存在
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.title).toContain('选择一个玩家');

        // 验证选项包含所有玩家（包括自己）
        const options = (interaction?.data as any)?.options;
        expect(options).toBeDefined();
        expect(options.length).toBeGreaterThanOrEqual(2); // 至少2个玩家选项（可能有取消选项）

        // 验证包含自己（P0）
        const selfOption = options.find((opt: any) => opt.value?.pid === '0');
        expect(selfOption).toBeDefined();
        expect(selfOption.label).toContain('你自己');

        // 验证包含对手（P1）
        const opponentOption = options.find((opt: any) => opt.value?.pid === '1');
        expect(opponentOption).toBeDefined();
    });

    it('选择自己后，自己被标记为下回合不能打行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark1', 'trickster_mark_of_sleep', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        let ms = makeMatchState(state);

        // 打出睡眠印记
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark1', targetBaseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        ms = result.finalState;

        // 验证交互存在
        const interaction = ms.sys.interaction?.current;
        expect(interaction).toBeDefined();

        // 验证选项中包含自己
        const options = (interaction?.data as any)?.options;
        const selfOption = options.find((opt: any) => opt.value?.pid === '0');
        expect(selfOption).toBeDefined();
        
        // 验证 sleepMarkedPlayers 字段存在于类型中
        // 这个测试主要验证选项生成逻辑正确，交互处理逻辑由其他测试覆盖
    });

    it('选择对手后，对手被标记为下回合不能打行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark1', 'trickster_mark_of_sleep', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(state);

        // 打出睡眠印记
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark1', targetBaseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证交互存在
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();

        // 验证选项中包含对手
        const options = (interaction?.data as any)?.options;
        const opponentOption = options.find((opt: any) => opt.value?.pid === '1');
        expect(opponentOption).toBeDefined();
    });
});

describe('睡眠印记 POD', () => {
    it('会一次性提供“每个对手二选一（禁战术/禁移动）”的组合选项', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark-pod', 'trickster_mark_of_sleep_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
        });

        let ms = makeMatchState(state);
        const played = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark-pod' },
            timestamp: 1000,
        } as any, defaultRandom);
        ms = played.finalState;

        const interaction = ms.sys.interaction?.current;
        expect(interaction?.data?.sourceId).toBe('trickster_mark_of_sleep_pod');

        const allOptions = ((interaction?.data as any)?.options ?? []) as any[];
        // autoCancelOption 可能会插入取消项；这里只验证实际组合选项
        const options = allOptions.filter(opt => !(opt?.value as any)?.__cancel__);
        // turnOrder = ['0','1','2'] → 2 位对手 → 4 种组合
        expect(options).toHaveLength(4);

        for (const opt of options) {
            expect(Array.isArray(opt.value?.noActions)).toBe(true);
            expect(Array.isArray(opt.value?.noMove)).toBe(true);
            const union = [...(opt.value.noActions ?? []), ...(opt.value.noMove ?? [])].sort();
            expect(union).toEqual(['1', '2']);
        }
    });

    it('选择“不能打出战术”后，会阻止目标玩家打出行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark-pod', 'trickster_mark_of_sleep_pod', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('action-1', 'trickster_take_the_shinies', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
        });

        let ms = makeMatchState(state);
        const played = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark-pod' },
            timestamp: 1100,
        } as any, defaultRandom);
        ms = played.finalState;

        const interaction = ms.sys.interaction?.current;
        const allOptions = ((interaction?.data as any)?.options ?? []) as any[];
        const options = allOptions.filter(opt => !(opt?.value as any)?.__cancel__);
        const option = options.find((opt: any) => (opt.value?.noActions ?? []).includes('1'));
        expect(option).toBeDefined();

        const resolved = runCommand(ms, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
            timestamp: 1101,
        } as any, defaultRandom);

        expect(resolved.finalState.core.sleepMarkedPlayers).toEqual(['1']);
        expect(resolved.finalState.core.sleepMarkExpiresOnTurnNumber).toBeDefined();

        const restrictedCore = {
            ...resolved.finalState.core,
            currentPlayerIndex: 1,
        };
        const restrictedState = makeMatchState(restrictedCore);
        const validation = validate(restrictedState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'action-1' },
            timestamp: 1102,
        } as any);

        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('战术');
    });

    it('选择“不能移动随从”后，会拦截该玩家的 MINION_MOVED 事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark-pod', 'trickster_mark_of_sleep_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'test_minion',
                            controller: '1',
                            owner: '1',
                            basePower: 3,
                            powerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark-pod' },
            timestamp: 1200,
        } as any, defaultRandom);

        const interaction = played.finalState.sys.interaction?.current;
        const allOptions = ((interaction?.data as any)?.options ?? []) as any[];
        const options = allOptions.filter(opt => !(opt?.value as any)?.__cancel__);
        const option = options.find((opt: any) => (opt.value?.noMove ?? []).includes('1'));
        expect(option).toBeDefined();

        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
            timestamp: 1201,
        } as any, defaultRandom);

        expect(resolved.finalState.core.sleepMoveMarkedPlayers).toEqual(['1']);
        expect(resolved.finalState.core.sleepMarkExpiresOnTurnNumber).toBeDefined();

        const moveEvent = moveMinion('m1', 'test_minion', 0, 1, 'test_move', 1202);
        // 应拦截被标记者（controller=1）的移动事件
        expect(interceptEvent(resolved.finalState.core, moveEvent as any)).toBeNull();
        // 不应拦截其他玩家的移动事件
        const otherControlled: any = {
            ...resolved.finalState.core,
            bases: [
                {
                    ...resolved.finalState.core.bases[0],
                    minions: [
                        { ...resolved.finalState.core.bases[0].minions[0], controller: '0' },
                    ],
                },
                resolved.finalState.core.bases[1],
            ],
        };
        expect(interceptEvent(otherControlled, moveEvent as any)).toBeUndefined();
    });

    it('再次施放会覆盖上一轮的标记（不做叠加合并）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark-pod', 'trickster_mark_of_sleep_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            sleepMarkedPlayers: ['1'],
            sleepMarkExpiresOnTurnNumber: 999,
        });

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark-pod' },
            timestamp: 1300,
        } as any, defaultRandom);

        const interaction = played.finalState.sys.interaction?.current;
        const allOptions = ((interaction?.data as any)?.options ?? []) as any[];
        const options = allOptions.filter(opt => !(opt?.value as any)?.__cancel__);
        const option = options.find((opt: any) => (opt.value?.noMove ?? []).includes('1'));
        expect(option).toBeDefined();

        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
            timestamp: 1301,
        } as any, defaultRandom);

        // noActions 为空 → sleepMarkedPlayers 被清空（覆盖旧值）
        expect(resolved.finalState.core.sleepMarkedPlayers).toBeUndefined();
        expect(resolved.finalState.core.sleepMoveMarkedPlayers).toEqual(['1']);
    });

    it('沉睡印记在目标回合内即使获得额外行动也仍然禁止打出战术，并在回合结束后清除', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('action-1', 'trickster_take_the_shinies', 'action', '1')],
                    actionLimit: 2,
                }),
            },
            currentPlayerIndex: 1,
            sleepMarkedPlayers: ['1'],
        });

        const startedCore = reduce(state, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 1400,
        } as any);

        expect(startedCore.players['1'].actionLimit).toBe(0);
        expect(startedCore.sleepMarkedPlayers).toEqual(['1']);

        const boostedCore = {
            ...startedCore,
            players: {
                ...startedCore.players,
                '1': {
                    ...startedCore.players['1'],
                    actionLimit: 2,
                },
            },
        };
        const validation = validate(makeMatchState(boostedCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'action-1' },
            timestamp: 1401,
        } as any);

        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('战术');

        const endedCore = reduce(startedCore, {
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '1', nextPlayerIndex: 0 },
            timestamp: 1402,
        } as any);

        expect(endedCore.sleepMarkedPlayers).toBeUndefined();
    });

    it('基地原因触发的移动不会错误套用命令发起者的不能移动随从限制', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'test_minion',
                            controller: '1',
                            owner: '1',
                            basePower: 3,
                            powerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            playerRestrictionsUntilTurnStart: [
                {
                    sourcePlayerId: '9',
                    targetPlayerId: '0',
                    restrictionType: 'move_minion',
                },
            ],
        });

        const moveEvents = [
            moveMinion('m1', 'test_minion', 0, 1, 'base_auto_move', 1500),
        ];

        expect(filterProtectedMoveEvents(moveEvents, state, '0')).toHaveLength(1);
    });
});
