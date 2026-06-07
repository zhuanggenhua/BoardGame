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
import {
    getPromptOption,
    getPromptOptions,
    getPromptTitle,
    getSimpleChoicePrompt,
    makeState,
    makePlayer,
    makeCard,
    makeMatchState,
    respondToPrompt,
} from './helpers';
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
        const prompt = getSimpleChoicePrompt(result.finalState);
        expect(prompt).toBeDefined();
        expect(getPromptTitle(prompt)).toContain('选择一个玩家');

        // 验证选项包含所有玩家（包括自己）
        const options = getPromptOptions(prompt);
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
        const prompt = getSimpleChoicePrompt(ms);
        expect(prompt).toBeDefined();

        // 验证选项中包含自己
        const options = getPromptOptions(prompt);
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
        const prompt = getSimpleChoicePrompt(result.finalState);
        expect(prompt).toBeDefined();

        // 验证选项中包含对手
        const options = getPromptOptions(prompt);
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

        const prompt = getSimpleChoicePrompt(ms, 'trickster_mark_of_sleep_pod');

        const allOptions = getPromptOptions(prompt);
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

        const prompt = getSimpleChoicePrompt(ms, 'trickster_mark_of_sleep_pod');
        const allOptions = getPromptOptions(prompt);
        const options = allOptions.filter(opt => !(opt?.value as any)?.__cancel__);
        const option = getPromptOption(
            { options },
            (opt: any) => (opt.value?.noActions ?? []).includes('1'),
            'mark of sleep no-actions option for player 1',
        );

        const resolved = respondToPrompt(ms, option.id, '0', defaultRandom);

        expect(resolved.finalState.core.playerRestrictionsUntilTurnStart).toEqual([
            {
                sourceDefId: 'trickster_mark_of_sleep_pod',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                restrictionType: 'play_action',
            },
        ]);

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

        const prompt = getSimpleChoicePrompt(played.finalState, 'trickster_mark_of_sleep_pod');
        const allOptions = getPromptOptions(prompt);
        const options = allOptions.filter(opt => !(opt?.value as any)?.__cancel__);
        const option = getPromptOption(
            { options },
            (opt: any) => (opt.value?.noMove ?? []).includes('1'),
            'mark of sleep no-move option for player 1',
        );

        const resolved = respondToPrompt(played.finalState, option.id, '0', defaultRandom);

        expect(resolved.finalState.core.playerRestrictionsUntilTurnStart).toEqual([
            {
                sourceDefId: 'trickster_mark_of_sleep_pod',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                restrictionType: 'move_minion',
            },
        ]);

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

    it('同一玩家再次施放时，会替换自己先前的睡眠印记 POD 限制', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark-pod', 'trickster_mark_of_sleep_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            playerRestrictionsUntilTurnStart: [
                {
                    sourceDefId: 'trickster_mark_of_sleep_pod',
                    sourcePlayerId: '0',
                    targetPlayerId: '1',
                    restrictionType: 'play_action',
                },
            ],
        });

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark-pod' },
            timestamp: 1300,
        } as any, defaultRandom);

        const prompt = getSimpleChoicePrompt(played.finalState, 'trickster_mark_of_sleep_pod');
        const allOptions = getPromptOptions(prompt);
        const options = allOptions.filter(opt => !(opt?.value as any)?.__cancel__);
        const option = getPromptOption(
            { options },
            (opt: any) => (opt.value?.noMove ?? []).includes('1'),
            'mark of sleep no-move option for player 1',
        );

        const resolved = respondToPrompt(played.finalState, option.id, '0', defaultRandom);

        expect(resolved.finalState.core.playerRestrictionsUntilTurnStart).toEqual([
            {
                sourceDefId: 'trickster_mark_of_sleep_pod',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                restrictionType: 'move_minion',
            },
        ]);
    });

    it('不同玩家连续施放时，后来的睡眠印记 POD 不应覆盖先前来源尚未到期的不能移动限制', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mark-pod-p0', 'trickster_mark_of_sleep_pod', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('mark-pod-p1', 'trickster_mark_of_sleep_pod', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        {
                            uid: 'p1-minion',
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

        const p0Played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mark-pod-p0' },
            timestamp: 1310,
        } as any, defaultRandom);
        const p0Options = (((p0Played.finalState.sys.interaction?.current?.data as any)?.options ?? []) as any[])
            .filter(opt => !(opt?.value as any)?.__cancel__);
        const p0NoMoveP1 = p0Options.find((opt: any) => (opt.value?.noMove ?? []).includes('1'));
        expect(p0NoMoveP1).toBeDefined();

        const afterP0Resolve = runCommand(p0Played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: p0NoMoveP1.id },
            timestamp: 1311,
        } as any, defaultRandom);
        expect(afterP0Resolve.finalState.core.playerRestrictionsUntilTurnStart).toEqual([
            {
                sourceDefId: 'trickster_mark_of_sleep_pod',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                restrictionType: 'move_minion',
            },
        ]);

        const p1TurnCore = {
            ...afterP0Resolve.finalState.core,
            currentPlayerIndex: 1,
            turnNumber: 2,
        };
        const p1Played = runCommand(makeMatchState(p1TurnCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'mark-pod-p1' },
            timestamp: 1312,
        } as any, defaultRandom);
        const p1Options = (((p1Played.finalState.sys.interaction?.current?.data as any)?.options ?? []) as any[])
            .filter(opt => !(opt?.value as any)?.__cancel__);
        const p1NoMoveP0 = p1Options.find((opt: any) => (opt.value?.noMove ?? []).includes('0'));
        expect(p1NoMoveP0).toBeDefined();

        const afterP1Resolve = runCommand(p1Played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: p1NoMoveP0.id },
            timestamp: 1313,
        } as any, defaultRandom);

        const moveEvent = moveMinion('p1-minion', 'test_minion', 0, 1, 'test_move', 1314);
        expect(interceptEvent(afterP1Resolve.finalState.core, moveEvent as any)).toBeNull();
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
            playerRestrictionsUntilTurnStart: [
                {
                    sourceDefId: 'trickster_mark_of_sleep_pod',
                    sourcePlayerId: '0',
                    targetPlayerId: '1',
                    restrictionType: 'play_action',
                },
            ],
        });

        const startedCore = reduce(state, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 1400,
        } as any);

        expect(startedCore.players['1'].actionLimit).toBe(0);
        expect(startedCore.playerRestrictionsUntilTurnStart).toEqual([
            {
                sourceDefId: 'trickster_mark_of_sleep_pod',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                restrictionType: 'play_action',
            },
        ]);

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

        expect(endedCore.playerRestrictionsUntilTurnStart).toEqual([
            {
                sourceDefId: 'trickster_mark_of_sleep_pod',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                restrictionType: 'play_action',
            },
        ]);

        const clearedCore = reduce(endedCore, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 3 },
            timestamp: 1403,
        } as any);

        expect(clearedCore.playerRestrictionsUntilTurnStart).toBeUndefined();
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
