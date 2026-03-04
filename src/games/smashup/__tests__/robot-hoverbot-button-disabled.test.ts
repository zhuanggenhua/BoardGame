/**
 * 测试盘旋机器人交互按钮是否可点击
 * 
 * Bug 报告：用户截图显示"放回牌库顶"按钮无法点击
 * 预期行为：两个按钮都应该可以点击
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities } from '../abilities';
import { runCommand } from './testRunner';
import { makeState, makePlayer, makeCard, makeBase, makeMinion, makeMatchState } from './helpers';
import { SU_COMMANDS } from '../domain/types';
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

describe('盘旋机器人 - 按钮可点击性', () => {
    it('应该创建两个可点击的选项（打出 + 跳过）', () => {
        // 设置：玩家牌库顶是入侵者（力量5）
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hoverbot1', 'robot_hoverbot', 'minion', '0')],
                    deck: [makeCard('invader1', 'alien_invader', 'minion', '0')], // 力量5
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(state);

        // 打出盘旋机器人
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hoverbot1', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证：应该创建交互
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.title).toContain('牌库顶是');
        // 注意：卡牌名称可能是 i18n key（如 'cards.alien_invader.name'）或实际名称
        expect(interaction?.data.title).toMatch(/入侵者|alien_invader/);
        
        // 验证：应该有2个选项
        const options = (interaction?.data as any)?.options;
        expect(options).toBeDefined();
        expect(options.length).toBe(2);
        
        // 验证：第一个选项是"打出"
        expect(options[0].id).toBe('play');
        expect(options[0].label).toContain('打出');
        expect(options[0].disabled).toBeUndefined(); // 不应该被禁用
        
        // 验证：第二个选项是"跳过"
        expect(options[1].id).toBe('skip');
        expect(options[1].label).toBe('放回牌库顶');
        expect(options[1].disabled).toBeUndefined(); // 不应该被禁用
        
        // 验证：sourceId 正确
        expect((interaction?.data as any).sourceId).toBe('robot_hoverbot');
    });
    
    it('牌库顶是行动卡时不应该创建交互', () => {
        // 设置：玩家牌库顶是行动卡
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hoverbot1', 'robot_hoverbot', 'minion', '0')],
                    deck: [makeCard('action1', 'robot_upgrade', 'action', '0')], // 行动卡
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(state);

        // 打出盘旋机器人
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hoverbot1', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证：命令执行成功
        expect(result.success).toBe(true);
        
        // 验证：不应该创建交互（行动卡直接放回牌库顶）
        expect(result.finalState.sys.interaction?.current).toBeUndefined();
        
        // 验证：应该有事件（至少有 MINION_PLAYED 事件）
        expect(result.events.length).toBeGreaterThan(0);
    });

    it('牌库顶卡牌变化后，optionsGenerator 仍然保留原始卡牌选项（continuationContext 模式）', () => {
        // 设置：玩家牌库顶是入侵者
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hoverbot1', 'robot_hoverbot', 'minion', '0')],
                    deck: [makeCard('invader1', 'alien_invader', 'minion', '0')],
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(state);

        // 打出盘旋机器人
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hoverbot1', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();

        // 获取 optionsGenerator
        const optionsGenerator = (interaction?.data as any)?.optionsGenerator;
        expect(optionsGenerator).toBeDefined();

        // 模拟牌库顶卡牌变化（被移除或替换）
        const modifiedState = {
            ...result.finalState,
            core: {
                ...result.finalState.core,
                players: {
                    ...result.finalState.core.players,
                    '0': {
                        ...result.finalState.core.players['0'],
                        deck: [makeCard('other1', 'alien_scout', 'minion', '0')], // 不同的卡
                    },
                },
            },
        };

        // 调用 optionsGenerator 获取刷新后的选项
        const refreshedOptions = optionsGenerator(modifiedState, interaction?.data);

        // 验证：continuationContext 模式会保留原始卡牌信息，所以仍然返回两个选项
        expect(refreshedOptions).toBeDefined();
        expect(refreshedOptions.length).toBe(2);
        expect(refreshedOptions[0].id).toBe('play');
        expect(refreshedOptions[1].id).toBe('skip');
    });
});
