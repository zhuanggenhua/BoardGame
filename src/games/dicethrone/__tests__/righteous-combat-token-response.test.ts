/**
 * 正义战法（Righteous Combat）奖励骰时机测试
 *
 * 验证场景：正义战法的奖励骰必须在确认最终骰面后结算为攻击加伤，再进入防御结算。
 * 这样改骰窗口不会提前写入伤害，确认后的加伤仍会被同一轮防御一起处理。
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

describe('正义战法奖励骰时机', () => {
    /**
     * 场景：选择正义战法 → preDefense 先执行 rollDie(diceCount:2)
     * → 防御方投掷防御骰 → damage(5 + bonus) 触发 TOKEN_RESPONSE_REQUESTED
     * → BONUS_DICE_REROLL_REQUESTED (displayOnly) → halt → 跳过重掷 → main2
     *
     * 随机数队列（共 10 个）：
     * [1,1,1,3,3] → 进攻骰: 3 sword + 2 helm → 触发正义冲击
     * [1,5]       → rollDie 2 骰: sword(+2伤害) + heart(治疗2)
     * [6,6,6]     → 防御骰: 3 pray（holy-defense: 0防御，+3CP）
     */
    it('防御方有守护 Token 时，奖励骰先于防御结算并参与最终伤害', () => {
        const random = createQueuedRandom([1, 1, 1, 3, 3, 1, 5, 6, 6, 6]);
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
                cmd('ADVANCE_PHASE', '0'),           // offensiveRoll → preDefense rollDie，当前骰区暂停
                cmd('RESPONSE_PASS', '0'),           // 奖励骰改骰响应窗口让过
                cmd('SKIP_BONUS_DICE_REROLL', '0'),  // 确认当前奖励骰结果 → defensiveRoll
                cmd('ROLL_DICE', '1'),               // 防御方投掷防御骰
                cmd('CONFIRM_ROLL', '1'),             // 确认防御骰面
                cmd('ADVANCE_PHASE', '1'),           // defensiveRoll exit → resolveAttack
                // damage(5) → 防御方有守护 Token → TOKEN_RESPONSE_REQUESTED → halt
                cmd('SKIP_TOKEN_RESPONSE', '1'),     // 防御方跳过守护 Token
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

        // 奖励骰出现不等于攻击加伤已经落地；确认后才进入攻击加伤和防御链。
        const allEvents = result.steps.flatMap(s => s.events);
        expect(allEvents).toContain('TOKEN_RESPONSE_REQUESTED');
        expect(allEvents).toContain('BONUS_DIE_ROLLED');
        expect(allEvents).toContain('BONUS_DAMAGE_ADDED');
        expect(allEvents.indexOf('BONUS_DIE_ROLLED')).toBeLessThan(allEvents.indexOf('ATTACK_DEFENSE_RESOLVED'));
        expect(allEvents.indexOf('BONUS_DAMAGE_ADDED')).toBeGreaterThan(allEvents.indexOf('BONUS_DICE_REROLL_REQUESTED'));
        expect(allEvents.indexOf('BONUS_DAMAGE_ADDED')).toBeLessThan(allEvents.indexOf('ATTACK_DEFENSE_RESOLVED'));
        expect(allEvents).toContain('BONUS_DICE_REROLL_REQUESTED');
        expect(allEvents).toContain('DAMAGE_DEALT');

        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 对照组：防御方无 Token → 无 TOKEN_RESPONSE_REQUESTED → 确认后的 rollDie 加伤仍先于防御结算
     *
     * 随机数队列（共 10 个）：
     * [1,1,1,3,3] → 进攻骰: 3 sword + 2 helm
     * [3,6]       → rollDie 2 骰: helm(+1伤害) + pray(+1CP)
     * [6,6,6]     → 防御骰: 3 pray（0 防御）
     */
    it('防御方无 Token 时，奖励骰先于防御结算执行（对照组）', () => {
        const random = createQueuedRandom([1, 1, 1, 3, 3, 3, 6, 6, 6, 6]);
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
                cmd('ADVANCE_PHASE', '0'),           // offensiveRoll → preDefense rollDie，当前骰区暂停
                cmd('RESPONSE_PASS', '0'),           // 奖励骰改骰响应窗口让过
                cmd('SKIP_BONUS_DICE_REROLL', '0'),  // 确认当前奖励骰结果 → defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),           // defensiveRoll exit → resolveAttack
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
        expect(allEvents).toContain('BONUS_DAMAGE_ADDED');
        expect(allEvents.indexOf('BONUS_DIE_ROLLED')).toBeLessThan(allEvents.indexOf('ATTACK_DEFENSE_RESOLVED'));
        expect(allEvents.indexOf('BONUS_DAMAGE_ADDED')).toBeGreaterThan(allEvents.indexOf('BONUS_DICE_REROLL_REQUESTED'));
        expect(allEvents.indexOf('BONUS_DAMAGE_ADDED')).toBeLessThan(allEvents.indexOf('ATTACK_DEFENSE_RESOLVED'));
        expect(allEvents).toContain('BONUS_DICE_REROLL_REQUESTED');

        expect(result.assertionErrors).toEqual([]);
    });
});
