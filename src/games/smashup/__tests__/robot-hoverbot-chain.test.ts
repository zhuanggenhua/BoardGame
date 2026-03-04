/**
 * 盘旋机器人链式打出测试
 * 
 * 验证场景：
 * 1. 打出第一个盘旋机器人，牌库顶是第二个盘旋机器人
 * 2. 选择打出第二个盘旋机器人
 * 3. 第二个盘旋机器人触发，应该看到新的牌库顶（不是第二个盘旋机器人）
 * 4. 验证不会出现"无限循环打出同一张卡"的问题
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';

const PLAYER_IDS = ['0', '1'] as const;
const systems = smashUpSystemsForTest;

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {
            '0': { 
                id: '0', 
                vp: 0, 
                hand: [], 
                deck: [], 
                discard: [], 
                minionsPlayed: 0, 
                minionLimit: 1, 
                actionsPlayed: 0, 
                actionLimit: 1, 
                factions: ['robots', 'wizards'] as [string, string], 
                minionsPlayedPerBase: {}, 
                sameNameMinionDefId: null 
            },
            '1': { 
                id: '1', 
                vp: 0, 
                hand: [], 
                deck: [], 
                discard: [], 
                minionsPlayed: 0, 
                minionLimit: 1, 
                actionsPlayed: 0, 
                actionLimit: 1, 
                factions: ['pirates', 'ninjas'] as [string, string], 
                minionsPlayedPerBase: {}, 
                sameNameMinionDefId: null 
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            { defId: 'base_great_library', minions: [], ongoingActions: [] },
        ],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        turnDestroyedMinions: [],
        ...overrides,
    };
}

describe('盘旋机器人链式打出', () => {
    it('应该正确处理连续打出两个盘旋机器人', () => {
        // 设置初始状态：P0 手牌有第一个盘旋机器人，牌库顶是第二个盘旋机器人，第三张是普通随从
        const core = makeState({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [
                        { uid: 'hoverbot-1', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
                    ],
                    deck: [
                        { uid: 'hoverbot-2', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
                        { uid: 'zapbot-1', defId: 'robot_zapbot', type: 'minion', owner: '0' },
                    ],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['robots', 'wizards'] as [string, string],
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['pirates', 'ninjas'] as [string, string],
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
            },
        });

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => ({ core, sys: { ...createInitialSystemState(PLAYER_IDS, systems), phase: 'playCards' } }),
        });

        const result = runner.run({
            name: '连续打出两个盘旋机器人',
            commands: [
                // 1. 打出第一个盘旋机器人
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'hoverbot-1', baseIndex: 0 } },
                // 2. 响应交互：选择打出第二个盘旋机器人
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'play' } },
                // 3. 响应交互：选择打出 zapbot（新的牌库顶）
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'play' } },
            ] as any[],
        });

        // 验证所有命令都成功
        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[1]?.success).toBe(true);
        expect(result.steps[2]?.success).toBe(true);

        // 验证最终状态：三个随从都在场上
        const finalCore = result.finalState.core;
        const base = finalCore.bases[0];
        
        expect(base.minions.length).toBe(3);
        expect(base.minions.find(m => m.uid === 'hoverbot-1')).toBeDefined();
        expect(base.minions.find(m => m.uid === 'hoverbot-2')).toBeDefined();
        expect(base.minions.find(m => m.uid === 'zapbot-1')).toBeDefined();

        // 验证牌库已空
        expect(finalCore.players['0'].deck.length).toBe(0);

        // 验证事件序列
        expect(result.steps[0]?.events).toContain('su:minion_played'); // 第一个盘旋
        expect(result.steps[1]?.events).toContain('su:minion_played'); // 第二个盘旋
        expect(result.steps[2]?.events).toContain('su:minion_played'); // zapbot
    });

    it('第二个盘旋机器人应该看到新的牌库顶（不是自己）', () => {
        // 设置初始状态：P0 手牌有第一个盘旋机器人，牌库顶是第二个盘旋机器人，第三张是 zapbot
        const core = makeState({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [
                        { uid: 'hoverbot-1', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
                    ],
                    deck: [
                        { uid: 'hoverbot-2', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
                        { uid: 'zapbot-1', defId: 'robot_zapbot', type: 'minion', owner: '0' },
                    ],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['robots', 'wizards'] as [string, string],
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['pirates', 'ninjas'] as [string, string],
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
            },
        });

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => ({ core, sys: { ...createInitialSystemState(PLAYER_IDS, systems), phase: 'playCards' } }),
        });

        const result = runner.run({
            name: '第二个盘旋看到新牌库顶',
            commands: [
                // 1. 打出第一个盘旋机器人
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'hoverbot-1', baseIndex: 0 } },
                // 2. 响应交互：选择打出第二个盘旋机器人
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'play' } },
            ] as any[],
        });

        // 验证命令成功
        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[1]?.success).toBe(true);

        // 验证两个盘旋机器人都在场上
        const finalCore = result.finalState.core;
        const base = finalCore.bases[0];
        expect(base.minions.length).toBe(2);
        expect(base.minions.find(m => m.uid === 'hoverbot-1')).toBeDefined();
        expect(base.minions.find(m => m.uid === 'hoverbot-2')).toBeDefined();

        // 验证牌库顶是 zapbot（不是第二个盘旋机器人）
        expect(finalCore.players['0'].deck[0]?.uid).toBe('zapbot-1');
        expect(finalCore.players['0'].deck[0]?.defId).toBe('robot_zapbot');

        // 验证第二个盘旋机器人触发后创建的交互，选项应该引用 zapbot
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.playerId).toBe('0');

        // 检查交互选项（通过 optionsGenerator 生成）
        const options = (interaction?.data as any)?.options;
        expect(options).toBeDefined();
        expect(options.length).toBe(2);

        const playOption = options.find((opt: any) => opt.id === 'play');
        expect(playOption).toBeDefined();
        expect(playOption.value.cardUid).toBe('zapbot-1');
        expect(playOption.value.defId).toBe('robot_zapbot');
    });

    it('应该阻止打出已经不在牌库顶的卡', () => {
        // 这个测试验证交互解决器的校验逻辑
        // 场景：第一个盘旋看到 hoverbot-2，但在响应交互前 hoverbot-2 被移除
        // 预期：交互解决器应该拒绝打出（抛出错误）

        const core = makeState({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [
                        { uid: 'hoverbot-1', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
                    ],
                    deck: [
                        { uid: 'hoverbot-2', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
                        { uid: 'zapbot-1', defId: 'robot_zapbot', type: 'minion', owner: '0' },
                    ],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['robots', 'wizards'] as [string, string],
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['pirates', 'ninjas'] as [string, string],
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
            },
        });

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => ({ core, sys: { ...createInitialSystemState(PLAYER_IDS, systems), phase: 'playCards' } }),
        });

        // 第一步：打出第一个盘旋机器人
        const step1 = runner.run({
            name: '打出第一个盘旋',
            commands: [
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'hoverbot-1', baseIndex: 0 } },
            ] as any[],
        });

        expect(step1.steps[0]?.success).toBe(true);

        // 手动修改状态：移除牌库顶的卡（模拟被其他效果移除）
        const modifiedCore = { ...step1.finalState.core };
        modifiedCore.players = { ...modifiedCore.players };
        modifiedCore.players['0'] = { ...modifiedCore.players['0'] };
        modifiedCore.players['0'].deck = modifiedCore.players['0'].deck.slice(1); // 移除 hoverbot-2

        // 第二步：尝试响应交互（打出已经不在牌库顶的 hoverbot-2）
        const runner2 = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => ({ core: modifiedCore, sys: step1.finalState.sys }),
        });

        // 使用 try-catch 捕获预期的错误
        let caughtError: Error | undefined;
        try {
            runner2.run({
                name: '尝试打出不在牌库顶的卡',
                commands: [
                    { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'play' } },
                ] as any[],
            });
        } catch (error) {
            caughtError = error as Error;
        }

        // 验证确实抛出了错误
        expect(caughtError).toBeDefined();
        expect(caughtError?.message).toContain('不在牌库顶');

        // 验证牌库顶仍然是 zapbot（没有被错误地打出）
        expect(modifiedCore.players['0'].deck[0]?.uid).toBe('zapbot-1');
    });
});
