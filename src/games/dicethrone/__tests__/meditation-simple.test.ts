/**
 * 调试 meditation 测试失败的问题
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { DiceThroneDomain } from '../domain';
import { createQueuedRandom, createNoResponseSetup, testSystems, cmd } from './test-utils';

describe('Meditation Debug', () => {
    it('简单的 meditation 测试', () => {
        const random = createQueuedRandom([
            1, 1, 1, 1, 1, // 进攻方掷骰(5) - 5 个拳头
            4, 4, 1, 1,    // 防御方掷骰(4) - 2太极 + 2拳
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            silent: false, // 开启详细输出
        });

        const result = runner.run({
            name: 'meditation debug',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                cmd('ADVANCE_PHASE', '1'), // 应该推进到 main2，但会创建 Token 响应交互
                cmd('SKIP_TOKEN_RESPONSE', '1'), // 跳过 Token 响应
            ],
        });

        console.log('Final state:', {
            phase: result.finalState.sys.phase,
            pendingAttack: result.finalState.core.pendingAttack,
            defenseAbilityId: result.finalState.core.pendingAttack?.defenseAbilityId,
        });

        expect(result.finalState.sys.phase).toBe('main2');
    });
});
