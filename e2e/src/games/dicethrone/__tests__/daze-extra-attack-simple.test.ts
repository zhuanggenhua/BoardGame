/**
 * 晕眩（Daze）额外攻击简化测试
 * 
 * 验证核心规则：
 * 1. 攻击施加眩晕后，立即触发额外攻击
 * 2. 攻击方获得额外攻击机会，再次攻击被眩晕的目标
 * 3. 眩晕在攻击结算后立即移除，不会在 buff 区显示
 * 
 * 正确理解：
 * - Player A 攻击 Player B，施加眩晕给 Player B
 * - 攻击结算后，立即移除 Player B 的眩晕
 * - Player A 获得额外攻击机会，再次攻击 Player B
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import { DiceThroneDomain } from '../domain';
import { STATUS_IDS } from '../domain/ids';
import { testSystems, cmd, type DiceThroneExpectation, createHeroMatchup } from './test-utils';
import type { RandomFn } from '../../../engine/types';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: (sides: number) => sides,
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => arr,
};

describe('晕眩（Daze）额外攻击 - 简化测试', () => {
    it('攻击施加眩晕后立即触发额外攻击', () => {
        const runner = new GameTestRunner<DiceThroneCore, DiceThroneCommand, DiceThroneEvent, DiceThroneExpectation>({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: fixedRandom,
        });

        const result = runner.run({
            name: '眩晕立即触发额外攻击',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                // 给防御方（Player 1）添加眩晕状态（模拟攻击中被施加眩晕）
                core.players['1'].statusEffects[STATUS_IDS.DAZE] = 1;
            }),
            commands: [
                // Player 0 进行攻击
                cmd('ADVANCE_PHASE', '0'), // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'violent-assault' }), // 不可防御攻击
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll → 触发额外攻击 → offensiveRoll
            ],
        });

        expect(result.passed).toBe(true);
        
        // 验证眩晕状态已被移除
        const core = result.finalState.core;
        expect(core.players['1'].statusEffects[STATUS_IDS.DAZE] ?? 0).toBe(0);
        
        // 验证进入了额外攻击的 offensiveRoll 阶段
        expect(result.finalState.sys.phase).toBe('offensiveRoll');
        expect(core.extraAttackInProgress).toBeDefined();
        // ✅ 正确：攻击方（Player 0）获得额外攻击机会
        expect(core.extraAttackInProgress!.attackerId).toBe('0'); // 攻击方继续攻击
        expect(core.extraAttackInProgress!.originalActivePlayerId).toBe('0'); // 原回合玩家
    });
});
