/**
 * 雷霆万钧技能测试
 * 
 * 测试场景：
 * 1. 触发雷霆万钧技能（3个掌面）
 * 2. 验证投掷3个奖励骰
 * 3. 验证重掷交互显示（有太极标记时）
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { diceThroneSystemsForTest } from '../game';
import { createQueuedRandom } from './test-utils';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import { TOKEN_IDS, DICE_FACE_IDS } from '../domain/ids';

const monkSetupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'monk' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'monk' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createMonkState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, diceThroneSystemsForTest, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: diceThroneSystemsForTest };
    for (const c of monkSetupCommands) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    return state;
}

describe('雷霆万钧技能', () => {
    it('应该投掷3个奖励骰并提供重掷交互（有太极标记时）', () => {
        // 骰子序列：
        // - 进攻掷骰 5 次（前3个会被使用）→ [3,3,3,1,1] = 3 Palm + 2 其他
        // - 奖励骰 3 次 → [4,5,6]
        const queuedRandom = createQueuedRandom([3, 3, 3, 1, 1, 4, 5, 6]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createMonkState(playerIds, random);
                
                // 玩家0有2个太极标记
                state.core.players['0'].tokens = { [TOKEN_IDS.TAIJI]: 2 };
                
                return state;
            },
            silent: true,
        });

        const result = runner.run({
            name: '雷霆万钧技能（有太极标记）',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // main1 → offensiveRoll
                { type: 'ROLL_DICE', playerId: '0', payload: {} }, // 掷骰 → [3,3,3,1,1]
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'thunder-strike' } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // offensiveRoll → defensiveRoll
                { type: 'ROLL_DICE', playerId: '1', payload: {} }, // 防御方掷骰
                { type: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} }, // 跳过防御技能
                { type: 'ADVANCE_PHASE', playerId: '1', payload: {} }, // defensiveRoll → main2（触发攻击结算）
            ],
        });

        console.log('=== 技能激活后的状态 ===');
        console.log('pendingBonusDiceSettlement:', result.finalState.core.pendingBonusDiceSettlement);
        console.log('玩家0太极标记:', result.finalState.core.players['0'].tokens?.[TOKEN_IDS.TAIJI]);
        console.log('步骤日志:', result.steps);

        // 验证命令执行成功
        expect(result.steps[0].success).toBe(true);

        // 验证 pendingBonusDiceSettlement 被设置
        expect(result.finalState.core.pendingBonusDiceSettlement).toBeDefined();
        expect(result.finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(3);
        expect(result.finalState.core.pendingBonusDiceSettlement?.attackerId).toBe('0');
        expect(result.finalState.core.pendingBonusDiceSettlement?.rerollCostTokenId).toBe(TOKEN_IDS.TAIJI);
        expect(result.finalState.core.pendingBonusDiceSettlement?.rerollCostAmount).toBe(2);
        expect(result.finalState.core.pendingBonusDiceSettlement?.maxRerollCount).toBe(1);

        // 验证事件流中有 BONUS_DIE_ROLLED 事件
        const eventStream = result.finalState.sys.eventStream?.entries || [];
        const bonusDieEvents = eventStream.filter(e => e.event.type === 'BONUS_DIE_ROLLED');
        expect(bonusDieEvents).toHaveLength(3); // 应该有3个奖励骰投掷事件

        // 验证事件流中有 BONUS_DICE_REROLL_REQUESTED 事件
        const rerollRequestedEvents = eventStream.filter(e => e.event.type === 'BONUS_DICE_REROLL_REQUESTED');
        expect(rerollRequestedEvents).toHaveLength(1); // 应该有1个重掷请求事件

        console.log('✅ 所有验证通过');
    });

    it('应该直接结算伤害（没有太极标记时）', () => {
        // 骰子序列：
        // - 进攻掷骰 5 次（前3个会被使用）→ [3,3,3,1,1] = 3 Palm + 2 其他
        // - 奖励骰 3 次 → [4,5,6]
        const queuedRandom = createQueuedRandom([3, 3, 3, 1, 1, 4, 5, 6]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createMonkState(playerIds, random);
                
                // 玩家0没有太极标记
                state.core.players['0'].tokens = {};
                
                return state;
            },
            silent: true,
        });

        const result = runner.run({
            name: '雷霆万钧技能（无太极标记）',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // main1 → offensiveRoll
                { type: 'ROLL_DICE', playerId: '0', payload: {} }, // 掷骰 → [3,3,3,1,1]
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'thunder-strike' } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // offensiveRoll → defensiveRoll
                { type: 'ROLL_DICE', playerId: '1', payload: {} }, // 防御方掷骰
                { type: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} }, // 跳过防御技能
                { type: 'ADVANCE_PHASE', playerId: '1', payload: {} }, // defensiveRoll exit → 攻击结算 + displayOnly 结算暂停
                { type: 'SKIP_BONUS_DICE_REROLL', playerId: '0', payload: {} }, // 确认骰子结果 → 推进到 main2
            ],
        });

        console.log('=== 技能激活后的状态（无太极标记）===');
        console.log('pendingBonusDiceSettlement:', result.finalState.core.pendingBonusDiceSettlement);
        console.log('玩家1 HP:', result.finalState.core.players['1'].resources?.hp);
        console.log('步骤日志:', result.steps);

        // 验证命令执行成功
        expect(result.steps[0].success).toBe(true);

        // ADVANCE_PHASE 后 displayOnly settlement 被设置，SKIP_BONUS_DICE_REROLL 后被清除
        // 验证中间状态：ADVANCE_PHASE 步骤应产生 BONUS_DICE_REROLL_REQUESTED
        const advanceStep = result.steps.find(s => s.step === 9);
        expect(advanceStep?.events).toContain('BONUS_DICE_REROLL_REQUESTED');

        // 最终状态：settlement 已被 SKIP_BONUS_DICE_REROLL 清除
        expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();

        // 验证事件流中有 BONUS_DIE_ROLLED 事件
        const eventStream = result.finalState.sys.eventStream?.entries || [];
        const bonusDieEvents = eventStream.filter(e => e.event.type === 'BONUS_DIE_ROLLED');
        expect(bonusDieEvents).toHaveLength(3); // 应该有3个奖励骰投掷事件

        // 验证事件流中有 DAMAGE_DEALT 事件
        const damageEvents = eventStream.filter(e => e.event.type === 'DAMAGE_DEALT');
        expect(damageEvents.length).toBeGreaterThan(0); // 应该有伤害事件

        // 验证玩家1受到伤害
        const initialHp = 50;
        const currentHp = result.finalState.core.players['1'].resources?.hp ?? 0;
        expect(currentHp).toBeLessThan(initialHp); // HP 应该减少

        console.log('✅ 所有验证通过');
    });
});
