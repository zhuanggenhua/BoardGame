/**
 * 圣骑士 (Paladin) GTR 技能运行时覆盖测试
 *
 * 通过 GameTestRunner 走完整管线验证技能效果：
 * 1. blessing-of-might — 不可防御 3 伤害 + 暴击 + 精准（preDefense 授予，offensiveRollEnd 门控过滤无弹窗）
 * 2. holy-strike-small — 小顺 5 伤害 + 治疗 1（可防御，BONUS_DICE_REROLL 流程）
 * 3. vengeance — 获得神罚 + 2 CP（无伤害，跳过防御）
 * 4. unyielding-faith — 终极：不可防御 10 伤害 + 治疗 5 + 神圣祝福
 *
 * 注意：
 * - 圣骑士骰面：1,2→sword  3,4→helm  5→heart  6→pray
 * - holy-defense 生成 displayOnly 的 BONUS_DICE_REROLL_REQUESTED
 *   SKIP_BONUS_DICE_REROLL 必须由 settlement.attackerId（防御方）发出
 * - grantToken 效果在 preDefense 时机执行
 *   不可防御攻击的 offensiveRollEnd Token 使用阶段会被门控过滤：
 *   暴击门控（伤害≥5）+ 精准门控（攻击已不可防御时无意义）
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS } from '../domain/ids';
import { INITIAL_CP } from '../domain/types';
import {
    testSystems,
    createQueuedRandom,
    assertState,
    cmd,
} from './test-utils';
import type { DiceThroneCore } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { BLESSING_OF_MIGHT_2 } from '../heroes/paladin/abilities';

// ============================================================================
// 自定义 Setup：双方圣骑士，移除响应卡避免干扰
// ============================================================================

function createPaladinSetup() {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const core = DiceThroneDomain.setup(playerIds, random);
        const sys = createInitialSystemState(playerIds, testSystems, undefined);
        let state: MatchState<DiceThroneCore> = { sys, core };

        const cfg = { domain: DiceThroneDomain, systems: testSystems };
        const setupCmds = [
            { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'paladin' } },
            { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'paladin' } },
            { type: 'PLAYER_READY', playerId: '1', payload: {} },
            { type: 'HOST_START_GAME', playerId: '0', payload: {} },
        ];

        for (const c of setupCmds) {
            const r = executePipeline(cfg, state,
                { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() },
                random, playerIds);
            if (r.success) state = r.state as MatchState<DiceThroneCore>;
        }

        // 移除响应卡避免触发响应窗口
        for (const pid of playerIds) {
            const p = state.core.players[pid];
            if (!p) continue;
            const nonResp = p.hand.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
            const resp = p.hand.filter(c => c.timing === 'instant' || c.timing === 'roll');
            const deckNonResp = p.deck.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
            const deckResp = p.deck.filter(c => c.timing === 'instant' || c.timing === 'roll');
            p.deck = [...deckNonResp, ...resp, ...deckResp];
            p.hand = nonResp;
            while (p.hand.length < 4 && p.deck.length > 0) {
                const card = p.deck.shift();
                if (card) p.hand.push(card);
            }
        }

        return state;
    };
}

describe('圣骑士 GTR 技能覆盖', () => {
    // ========================================================================
    // blessing-of-might — 力量祝福（不可防御 3 伤害 + 暴击 + 精准）
    // ========================================================================
    describe('力量祝福 (blessing-of-might)', () => {
        it('3 剑 + 1 祈祷造成 3 不可防御伤害 + 获得暴击和精准', () => {
            // 进攻骰: [1,1,1,6,3] → 3 sword + 1 pray + 1 helm
            // 流程：preDefense 授予 CRIT+ACCURACY → 不可防御
            //   → offensiveRoll exit → 暴击门控(3<5)过滤 + 精准门控(已不可防御)过滤
            //   → offensiveRollEndTokens 为空 → 直接结算 → 3 伤害 → main2
            const random = createQueuedRandom([1, 1, 1, 6, 3]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPaladinSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '力量祝福 3剑1祈祷=3不可防御伤害+暴击+精准',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'blessing-of-might' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → 不可防御+门控过滤 → 直接结算 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.CRIT]: 1, [TOKEN_IDS.ACCURACY]: 1 } },
                        '1': { hp: 47 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // holy-strike-small — 神圣冲击（小顺 5 伤害 + 治疗 1，可防御）
    // ========================================================================
    describe('神圣冲击 (holy-strike)', () => {
        it('小顺造成 5 伤害 + 治疗 1（防御骰全祈祷=0防御）', () => {
            // 进攻骰: [1,2,3,4,5] → 小顺
            // 防御骰: [6,6,6] → 3 pray（holy-defense: 0剑0盔0心3祈祷 → +3CP，0防御）
            // 流程：defensiveRoll exit → resolveAttack → holy-defense 投 3 骰
            //   → BONUS_DICE_REROLL_REQUESTED (displayOnly) → halt
            //   → SKIP_BONUS_DICE_REROLL '1'（防御方=settlement.attackerId）
            //   → auto-continue → main2
            const random = createQueuedRandom([1, 2, 3, 4, 5, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPaladinSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '神圣冲击 小顺=5伤害+治疗1',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'holy-strike-small' }),
                    cmd('ADVANCE_PHASE', '0'),       // → defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),       // defensiveRoll exit → halt (BONUS_DICE_REROLL)
                    cmd('SKIP_BONUS_DICE_REROLL', '1'), // 防御方跳过 → auto-continue → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { hp: 51 }, // 50 + 1 = 51（未超上限 60）
                        '1': { hp: 45 }, // 50 - 5 = 45
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // vengeance — 复仇（获得神罚 + 2 CP，无伤害，跳过防御）
    // ========================================================================
    describe('复仇 (vengeance)', () => {
        it('3 盔 + 1 祈祷获得神罚 + 2 CP（无伤害，跳过防御）', () => {
            // 进攻骰: [3,3,3,6,1] → 3 helm + 1 pray + 1 sword
            // 流程：preDefense 授予 RETRIBUTION + 2 CP → 无伤害 → 跳过防御 → main2
            const random = createQueuedRandom([3, 3, 3, 6, 1]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPaladinSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '复仇 3盔1祈祷=神罚+2CP',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            cp: INITIAL_CP + 2,
                            tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                        },
                        '1': { hp: 50 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // unyielding-faith — 坚毅信念（终极：不可防御 10 伤害 + 治疗 5 + 神圣祝福）
    // ========================================================================
    describe('坚毅信念 (unyielding-faith)', () => {
        it('5 祈祷造成 10 不可防御伤害 + 治疗 5 + 获得神圣祝福', () => {
            // 进攻骰: [6,6,6,6,6] → 5 pray → ultimate
            // 流程：preDefense 治疗5+授予 BLESSING_OF_DIVINITY → ultimate 跳过防御
            //   → resolveAttack → 10 伤害 → 无可用 token → 直接结算 → main2
            const random = createQueuedRandom([6, 6, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPaladinSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '坚毅信念 5祈祷=10不可防御伤害+治疗5+神圣祝福',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'unyielding-faith' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            hp: 55, // 50 + 5 = 55（未超上限 60）
                            tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                        },
                        '1': { hp: 40 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // blessing-of-might-2 — 力量祝福 II（升级版，含两个变体）
    // ========================================================================
    describe('力量祝福 II (blessing-of-might-2)', () => {
        /** 升级 setup：将 blessing-of-might 替换为 BLESSING_OF_MIGHT_2 */
        function createPaladinLevel2Setup() {
            return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
                const base = createPaladinSetup()(playerIds, random);
                const idx = base.core.players['0'].abilities.findIndex(a => a.id === 'blessing-of-might');
                if (idx >= 0) base.core.players['0'].abilities[idx] = BLESSING_OF_MIGHT_2 as any;
                base.core.players['0'].abilityLevels['blessing-of-might'] = 2;
                return base;
            };
        }

        it('神力信徒 II: 3剑1祈祷 → 4不可防御伤害 + 暴击 + 精准（无弹窗）', () => {
            // 进攻骰: [1,1,1,6,3] → 3 sword + 1 pray + 1 helm
            // 触发 blessing-of-might-2-main（priority 1）
            // preDefense 授予 CRIT+ACCURACY → 不可防御
            // offensiveRollEnd 门控：暴击(4<5)过滤 + 精准(已不可防御)过滤 → 无弹窗
            const random = createQueuedRandom([1, 1, 1, 6, 3]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPaladinLevel2Setup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '神力信徒II 3剑1祈祷=4不可防御伤害+暴击+精准',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'blessing-of-might-2-main' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → 门控过滤 → 直接结算 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.CRIT]: 1, [TOKEN_IDS.ACCURACY]: 1 } },
                        '1': { hp: 46 },  // 50 - 4 = 46
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('进攻姿态: 2剑1祈祷 → 2不可防御伤害 + 选择暴击或精准', () => {
            // 进攻骰: [1,1,6,3,3] → 2 sword + 1 pray + 2 helm
            // 触发 blessing-of-might-2-stance（priority 0）
            // preDefense 弹出选择：暴击 or 精准
            // 选择暴击（option-0）→ 获得 1 暴击 Token
            const random = createQueuedRandom([1, 1, 6, 3, 3]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPaladinLevel2Setup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '进攻姿态 2剑1祈祷=2不可防御伤害+选择暴击',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'blessing-of-might-2-stance' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → preDefense choice → halt
                    // 选择暴击（option-0 = crit）→ 自动继续 → 不可防御 → 直接结算 → main2
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.CRIT]: 1 } },
                        '1': { hp: 48 },  // 50 - 2 = 48
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
