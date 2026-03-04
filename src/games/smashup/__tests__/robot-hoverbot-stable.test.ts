/**
 * 盘旋机器人交互稳定性测试
 * 
 * 问题：盘旋机器人 onPlay 能力产生的 MINION_PLAYED 事件没有 sourceCommandType，
 * 导致在 pipeline 步骤 4.5 和步骤 5 都被 postProcessSystemEvents 处理，
 * 创建了两个不同的交互（ID 从 robot_hoverbot_0 变成 robot_hoverbot_<timestamp>），
 * 第二个覆盖第一个，导致交互一闪而过。
 * 
 * 修复：在 postProcessSystemEvents 中使用 matchState.sys._processedMinionPlayed 集合
 * 记录已处理的事件（格式：`${cardUid}@${baseIndex}`），防止重复处理。
 * 
 * 审计维度：D45（Pipeline 多阶段调用去重）、D47（E2E 测试覆盖完整性）
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import type { CardInstance, SmashUpCore } from '../domain/types';
import type { MatchState, SystemState } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { resetRobotHoverbotCounter } from '../abilities/robots';

describe('盘旋机器人交互稳定性', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    // 每个测试前重置计数器
    beforeEach(() => {
        resetRobotHoverbotCounter();
    });

    function createTestState(): MatchState<SmashUpCore> {
        const core: SmashUpCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [{ defId: 'robot_hoverbot', uid: 'hoverbot', type: 'minion', owner: '0' } as CardInstance],
                    deck: [{ defId: 'pirate_first_mate', uid: 'pirate1', type: 'minion', owner: '0' } as CardInstance],
                    discard: [],
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                    minionLimit: 1,
                    actionLimit: 1,
                    vp: 0,
                    factions: ['robots', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                    minionLimit: 1,
                    actionLimit: 1,
                    vp: 0,
                    factions: ['aliens', 'ninjas'] as [string, string],
                },
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            baseDeck: [],
            turnNumber: 1,
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            nextUid: 100,
        };

        // 创建完整的 sys 对象（从 createInitialSystemState 复制）
        const sys: SystemState = {
            schemaVersion: 1,
            phase: 'playCards',
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            eventStream: { entries: [], nextId: 0 },
            undo: { history: [], maxSize: 50 },
            log: { entries: [] },
            actionLog: { entries: [] },
            responseWindow: { current: undefined },
            tutorial: undefined,
            gameover: undefined,
        };

        return { core, sys } as MatchState<SmashUpCore>;
    }

    it('onPlay 能力只创建一次交互（不重复处理）', () => {
        const state = createTestState();

        // 打出盘旋机器人
        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hoverbot', baseIndex: 0 },
            timestamp: Date.now(),
        });

        // 验证：应该只有一个交互（robot_hoverbot_0），不应该有重复的交互
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        const interaction = result.finalState.sys.interaction!.current!;
        
        // 交互 ID 应该是 robot_hoverbot_0（不是 robot_hoverbot_<timestamp>）
        expect(interaction.id).toBe('robot_hoverbot_0');
        
        // 交互应该有两个选项：打出 + 跳过
        const data = interaction.data as any;
        expect(data.options).toHaveLength(2);
        expect(data.options[0].id).toBe('play');
        expect(data.options[1].id).toBe('skip');
        
        // 验证选项包含正确的卡牌信息
        const playOption = data.options[0];
        expect(playOption.value).toMatchObject({
            cardUid: 'pirate1',
            defId: 'pirate_first_mate',
        });
        
        // 验证 displayMode 正确声明为 'card'
        expect(playOption.displayMode).toBe('card');
    });

    it('选择"放回牌库顶"后交互正常关闭', () => {
        const state = createTestState();

        // 打出盘旋机器人
        const result1 = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hoverbot', baseIndex: 0 },
            timestamp: Date.now(),
        });

        expect(result1.finalState.sys.interaction?.current).toBeDefined();

        // 选择"放回牌库顶"
        const result2 = runCommand(result1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: 'robot_hoverbot_0',
                optionId: 'skip',
            },
            timestamp: Date.now(),
        });

        // 验证：交互应该关闭
        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        
        // 验证：牌库顶的卡仍然在牌库中
        expect(result2.finalState.core.players['0'].deck).toHaveLength(1);
        expect(result2.finalState.core.players['0'].deck[0].uid).toBe('pirate1');
    });

    it('选择"打出"后创建基地选择交互', () => {
        const state = createTestState();
        // 添加第二个基地
        state.core.bases.push({
            defId: 'base_the_mothership',
            minions: [],
            ongoingActions: [],
        });

        // 打出盘旋机器人
        const result1 = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hoverbot', baseIndex: 0 },
            timestamp: Date.now(),
        });

        expect(result1.finalState.sys.interaction?.current?.id).toBe('robot_hoverbot_0');

        // 选择"打出"
        const result2 = runCommand(result1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: 'robot_hoverbot_0',
                optionId: 'play',
            },
            timestamp: Date.now(),
        });

        // 验证：应该创建基地选择交互（robot_hoverbot_base_0）
        expect(result2.finalState.sys.interaction?.current).toBeDefined();
        const baseInteraction = result2.finalState.sys.interaction!.current!;
        expect(baseInteraction.id).toMatch(/^robot_hoverbot_base_/);
        
        // 验证：基地选择交互应该有 2 个基地选项
        const data = baseInteraction.data as any;
        expect(data.options).toHaveLength(2);
    });
});
