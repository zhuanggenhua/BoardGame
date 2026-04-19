/**
 * DiceThrone 技能重选防护测试
 *
 * 测试目标：验证"攻击发起后不能重新选择技能"的规则（官方规则 §3.6）
 *
 * 背景：此验证逻辑曾在 POD 提交中被误删，导致玩家可以在攻击发起后重新选择技能。
 * 此测试确保该验证逻辑正常工作，并防止未来回归。
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import {
    testSystems,
    fixedRandom,
    createNoResponseSetup,
    assertState,
    cmd,
    createQueuedRandom,
} from './test-utils';

const createRunner = (random = fixedRandom) =>
    new GameTestRunner({
        domain: DiceThroneDomain,
        systems: testSystems,
        playerIds: ['0', '1'],
        random,
        setup: createNoResponseSetup(),
        assertFn: assertState,
        silent: true,
    });

describe('技能重选防护（attack_already_initiated）', () => {
    it('攻击发起后不能重新选择技能', () => {
        // 使用队列随机数确保掷出 5 个拳头（触发 fist-technique-5）
        // 骰子面值 1 = 拳头面
        const diceValues = [1, 1, 1, 1, 1]; // 5 个拳头面
        const random = createQueuedRandom(diceValues);
        const runner = createRunner(random);

        // 1. 进入进攻掷骰阶段并选择技能
        const result = runner.run({
            name: '攻击发起后不能重新选择技能',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),      // 掷骰
                cmd('CONFIRM_ROLL', '0'),   // 确认掷骰
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }), // 选择拳法技能
            ],
        });

        // 验证：攻击已发起
        expect(result.finalState.core.pendingAttack).toBeDefined();
        expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-5');

        // 2. 尝试重新选择技能（应该被拒绝）
        const runner2 = createRunner(random);
        const reselect = runner2.run({
            name: '尝试重新选择技能',
            setup: () => result.finalState,
            commands: [
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }), // 尝试重新选择
            ],
        });

        // 验证：应该被拒绝，错误码为 attack_already_initiated
        expect(reselect.actualErrors).toHaveLength(1);
        expect(reselect.actualErrors[0].error).toBe('attack_already_initiated');
        // 验证：攻击未改变（仍然是原来的技能）
        expect(reselect.finalState.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-5');
    });
});
