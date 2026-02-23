/**
 * 正义冲击 (Righteous Combat) Token 响应后 rollDie 执行测试
 *
 * 验证场景：当 damage(5) 触发 TOKEN_RESPONSE_REQUESTED 时，
 * rollDie 效果不会因事件截断而丢失。Token 响应完成后，
 * resolvePostDamageEffects 应重新执行 withDamage（跳过 damage）→ rollDie 正常执行。
 *
 * 圣骑士骰面：1,2→sword  3,4→helm  5→heart  6→pray
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS } from '../domain/ids';
import { INITIAL_HEALTH } from '../domain/types';
import {
    testSystems,
    createQueuedRandom,
    assertState,
    cmd,
    createHeroMatchup,
} from './test-utils';

describe('正义冲击 Token 响应后 rollDie 执行', () => {
    /**
     * 场景：防御方有守护 Token → damage(5) 触发 TOKEN_RESPONSE_REQUESTED
     * → 防御方跳过 Token → damageResolved → resolvePostDamageEffects
     * → withDamage(skipDamage) 重新执行 rollDie(diceCount:2)
     * → BONUS_DICE_REROLL_REQUESTED (displayOnly) → halt → 跳过重掷 → main2
     *
     * 随机数队列（共 10 个）：
     * [1,1,1,3,3] → 进攻骰: 3 sword + 2 helm → 触发正义冲击
     * [6,6,6]     → 防御骰: 3 pray（holy-defense: 0防御，+3CP）
     * [1,5]       → rollDie 2 骰: sword(+2伤害) + heart(治疗2)
     */
    it('防御方有守护 Token 时，Token 响应后 rollDie 仍正常执行', () => {
        const random = createQueuedRandom([1, 1, 1, 3, 3, 6, 6, 6, 1, 5]);
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            // 给防御方 1 个守护 Token，触发 Token 响应窗口
            core.players['1'].tokens[TOKEN_IDS.PROTECT] = 1;
        });

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup,
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '正义冲击 + 守护Token响应 → rollDie 仍执行',
            commands: [
                cmd('ADVANCE_PHASE', '0'),           // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),               // 投掷进攻骰
                cmd('CONFIRM_ROLL', '0'),             // 确认骰面
                cmd('SELECT_ABILITY', '0', { abilityId: 'righteous-combat' }),
                cmd('ADVANCE_PHASE', '0'),           // offensiveRoll → defensiveRoll
                cmd('ROLL_DICE', '1'),               // 防御方投掷防御骰
                cmd('CONFIRM_ROLL', '1'),             // 确认防御骰面
                cmd('ADVANCE_PHASE', '1'),           // defensiveRoll exit → resolveAttack
                // damage(5) → 防御方有守护 Token → TOKEN_RESPONSE_REQUESTED → halt
                cmd('SKIP_TOKEN_RESPONSE', '1'),     // 防御方跳过守护 Token
                // damageResolved → autoContinue → resolvePostDamageEffects
                // → withDamage(skipDamage) → rollDie(2) 执行
                // → BONUS_DICE_REROLL_REQUESTED (displayOnly) → halt
                cmd('SKIP_BONUS_DICE_REROLL', '0'),  // 攻击方跳过重掷
                // autoContinue → pendingAttack=null → main2
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': {
                        // rollDie: sword(+2伤害) + heart(治疗2)，50 + 2 = 52（未超上限 60）
                        hp: 52,
                    },
                    '1': {
                        // 基础伤害 5 + sword 额外伤害 2 = 7
                        // 守护 Token 未使用（跳过了）→ 仍有 1 个
                        hp: INITIAL_HEALTH - 7,
                        tokens: { [TOKEN_IDS.PROTECT]: 1 },
                    },
                },
            },
        });

        // 验证事件流包含关键事件
        const allEvents = result.steps.flatMap(s => s.events);
        expect(allEvents).toContain('TOKEN_RESPONSE_REQUESTED');
        expect(allEvents).toContain('BONUS_DIE_ROLLED');
        expect(allEvents).toContain('BONUS_DICE_REROLL_REQUESTED');
        expect(allEvents).toContain('DAMAGE_DEALT');

        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 对照组：防御方无 Token → 无 TOKEN_RESPONSE_REQUESTED → rollDie 正常执行
     *
     * 随机数队列（共 10 个）：
     * [1,1,1,3,3] → 进攻骰: 3 sword + 2 helm
     * [6,6,6]     → 防御骰: 3 pray（0 防御）
     * [3,6]       → rollDie 2 骰: helm(+1伤害) + pray(+1CP)
     */
    it('防御方无 Token 时，rollDie 正常执行（对照组）', () => {
        const random = createQueuedRandom([1, 1, 1, 3, 3, 6, 6, 6, 3, 6]);
        const setup = createHeroMatchup('paladin', 'paladin');

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup,
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '正义冲击 无Token → rollDie 正常执行',
            commands: [
                cmd('ADVANCE_PHASE', '0'),           // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'righteous-combat' }),
                cmd('ADVANCE_PHASE', '0'),           // offensiveRoll → defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),           // defensiveRoll exit → resolveAttack → rollDie
                // 无 Token → 无 TOKEN_RESPONSE_REQUESTED → rollDie 直接执行
                // → BONUS_DICE_REROLL_REQUESTED (displayOnly) → halt
                cmd('SKIP_BONUS_DICE_REROLL', '0'),  // 跳过重掷 → main2
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { hp: INITIAL_HEALTH },
                    '1': {
                        // 基础伤害 5 + helm 额外伤害 1 = 6
                        hp: INITIAL_HEALTH - 6,
                    },
                },
            },
        });

        const allEvents = result.steps.flatMap(s => s.events);
        // 不应有 TOKEN_RESPONSE_REQUESTED
        expect(allEvents).not.toContain('TOKEN_RESPONSE_REQUESTED');
        // 应有 rollDie 相关事件
        expect(allEvents).toContain('BONUS_DIE_ROLLED');
        expect(allEvents).toContain('BONUS_DICE_REROLL_REQUESTED');

        expect(result.assertionErrors).toEqual([]);
    });
});
