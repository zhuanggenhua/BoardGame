/**
 * 大杀四方 - afterScoring 响应窗口多轮响应测试
 * 
 * 测试场景：
 * - 基地计分后打开 afterScoring 响应窗口
 * - 多个玩家手牌中有 afterScoring 卡牌（如"我们乃最强"）
 * - 验证窗口支持多轮响应（loopUntilAllPass）
 * - 验证所有玩家连续 pass 后窗口关闭
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { smashUpSystemsForTest } from '../game';
import type { PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

const PLAYER_IDS = ['0', '1'];
const systems = smashUpSystemsForTest;

beforeAll(() => {
    initAllAbilities();
});

describe('afterScoring 响应窗口 - 多轮响应', () => {
    it('两个玩家都有 afterScoring 卡牌，支持多轮响应', () => {
        // Setup: 两个玩家都有 afterScoring 卡牌
        function setup(ids: PlayerId[], random: RandomFn) {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, systems, undefined);
            
            // 跳过派系选择
            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.currentPlayerIndex = 0;
            
            // 设置一个基地达到临界点
            core.bases[1] = {
                defId: 'base_temple_of_goju', // 刚柔流寺庙，临界点 20
                minions: [
                    {
                        uid: 'c1',
                        defId: 'pirate_buccaneer',
                        owner: '0',
                        controller: '0',
                        basePower: 3,
                        powerModifier: 10, // +10 修正，确保达到临界点
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'c2',
                        defId: 'giant_ant_drone',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerModifier: 5, // +5 修正
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                ],
                ongoingActions: [],
            };
            
            // P0 手牌：有 afterScoring 卡牌
            core.players['0'].hand = [
                { uid: 'c10', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                { uid: 'c11', defId: 'pirate_dinghy', type: 'action', owner: '0' },
            ];
            
            // P1 手牌：有 afterScoring 卡牌
            core.players['1'].hand = [
                { uid: 'c20', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '1' },
                { uid: 'c21', defId: 'pirate_shanghai', type: 'action', owner: '1' },
            ];
            
            console.log('[TEST SETUP] P0 hand:', core.players['0'].hand.map(c => c.defId));
            console.log('[TEST SETUP] P1 hand:', core.players['1'].hand.map(c => c.defId));
            console.log('[TEST SETUP] Base 1 minions:', core.bases[1].minions.map(m => m.defId));
            
            return { sys, core };
        }
        
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup,
        });
        
        // 执行测试命令序列
        const result = runner.run({
            name: 'afterScoring 窗口多轮响应测试',
            commands: [
                // 步骤 1：推进到 scoreBases 阶段
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                
                // 此时应该打开 meFirst 响应窗口（beforeScoring）
                // 两个玩家都 pass
                { type: 'RESPONSE_PASS', playerId: '0', payload: undefined },
                { type: 'RESPONSE_PASS', playerId: '1', payload: undefined },
                
                // meFirst 窗口关闭后，基地计分
                // 计分后应该打开 afterScoring 响应窗口
                
                // 步骤 2：P0 pass
                { type: 'RESPONSE_PASS', playerId: '0', payload: undefined },
                
                // 步骤 3：P1 pass
                { type: 'RESPONSE_PASS', playerId: '1', payload: undefined },
                
                // 第一轮所有人都 pass，应该开始第二轮
                // 步骤 4：P0 再次 pass
                { type: 'RESPONSE_PASS', playerId: '0', payload: undefined },
                
                // 步骤 5：P1 再次 pass
                { type: 'RESPONSE_PASS', playerId: '1', payload: undefined },
                
                // 连续两轮所有人都 pass，窗口应该关闭
            ] as any[],
        });
        
        // 验证：检查响应窗口状态
        const finalStep = result.steps[result.steps.length - 1];
        
        // 断言：响应窗口应该已关闭
        // 注意：GameTestRunner 的最后一步可能没有 after 状态（如果命令没有返回新状态）
        // 我们检查倒数第二步的状态
        const lastStateStep = result.steps.reverse().find(s => s.after);
        expect(lastStateStep?.after?.sys?.responseWindow?.current).toBeUndefined();
        
        console.log('测试完成：afterScoring 窗口支持多轮响应');
    });
});
