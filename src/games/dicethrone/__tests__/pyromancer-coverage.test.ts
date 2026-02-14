/**
 * 炎术士 (Pyromancer) GTR 技能运行时覆盖测试
 *
 * 通过 GameTestRunner 走完整管线验证技能效果：
 * 1. fireball-3 — 3 火 → 4 伤害 + 1 火焰精通（可防御）
 * 2. soul-burn — 2 焚魂 → +2 FM(preDefense) + 焚魂数×1 伤害(withDamage)（可防御）
 * 3. meteor — 4 陨石 → 不可防御：眩晕 + +2 FM + FM 伤害 + 2 全体伤害
 * 4. ultimate-inferno — 5 陨石 → 终极：击倒 + 燃烧 + 3 FM + 12 伤害 + 2 全体伤害
 *
 * 注意：
 * - 炎术士骰面：1,2,3→fire  4→magma  5→fiery_soul  6→meteor
 * - FIRE_MASTERY 无 activeUse → 不触发 TOKEN_RESPONSE_REQUESTED
 * - magma-armor 基于防御投掷骰面计算效果（fire面=伤害，fiery_soul面=FM），不额外投骰
 * - 多数纯 buff 技能使用 custom action（target: 'self'，categories 全为 resource/token）→ 跳过防御
 * - soul-burn 拆分为 FM(preDefense) + 伤害(withDamage)，伤害从 pendingAttack.attackDiceFaceCounts 读取骰面
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import {
    testSystems,
    createQueuedRandom,
    assertState,
    cmd,
} from './test-utils';
import type { DiceThroneCore } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';

// ============================================================================
// 自定义 Setup：双方炎术士，移除响应卡避免干扰
// ============================================================================

function createPyromancerSetup() {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const core = DiceThroneDomain.setup(playerIds, random);
        const sys = createInitialSystemState(playerIds, testSystems, undefined);
        let state: MatchState<DiceThroneCore> = { sys, core };

        const cfg = { domain: DiceThroneDomain, systems: testSystems };
        const setupCmds = [
            { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'pyromancer' } },
            { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'pyromancer' } },
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

describe('炎术士 GTR 技能覆盖', () => {
    // ========================================================================
    // fireball-3 — 火球术（3 火 → 4 伤害 + 1 FM，可防御）
    // ========================================================================
    describe('火球术 (fireball)', () => {
        it('3 火造成 4 伤害 + 获得 1 火焰精通（经过防御阶段）', () => {
            // 进攻骰: [1,1,1,4,5] → 3 fire + 1 magma + 1 fiery_soul
            // 防御骰: [6,6,6,6,6] → 5 meteor（magma-armor 读取防御骰面：无 fire/fiery_soul → 无效果）
            // 流程：offensiveRoll exit → preDefense: +1 FM → isDefendable=true → defensiveRoll
            //   → magma-armor 读取防御骰面 → 无效果
            //   → 4 伤害 → main2
            const random = createQueuedRandom([1, 1, 1, 4, 5, 6, 6, 6, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPyromancerSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '火球术 3火=4伤害+1FM',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fireball-3' }),
                    cmd('ADVANCE_PHASE', '0'),       // → defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),       // defensiveRoll exit → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.FIRE_MASTERY]: 1 } },
                        '1': { hp: 46 }, // 50 - 4 = 46
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // soul-burn — 焚魂（2 焚魂 → FM获取(preDefense) + 焚魂数×1 伤害(withDamage)）
    // 修复：拆分为两个 effect，FM 在 preDefense 结算，伤害在 withDamage 结算
    // 伤害 target='opponent' → playerAbilityHasDamage=true → 进入防御阶段
    // ========================================================================
    describe('焚魂 (soul-burn)', () => {
        it('2 焚魂获得 2 FM + 造成焚魂数伤害（经过防御阶段）', () => {
            // 进攻骰: [5,5,1,4,6] → 2 fiery_soul + 1 fire + 1 magma + 1 meteor
            // soul-burn-fm: +2 FM (preDefense)
            // soul-burn-damage: 按骰面上 fiery_soul 数量造成伤害 = 2 (withDamage)
            // 防御骰: [6,6,6,6,6] → 5 meteor（magma-armor 读取防御骰面：无 fire/fiery_soul → 无效果）
            // 流程：offensiveRoll exit → preDefense: +2 FM → isDefendable=true → defensiveRoll
            //   → magma-armor 读取防御骰面 → 2 伤害 → main2
            const random = createQueuedRandom([5, 5, 1, 4, 6, 6, 6, 6, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPyromancerSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '焚魂 2焚魂=2FM+2伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'soul-burn' }),
                    cmd('ADVANCE_PHASE', '0'),       // → defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),       // defensiveRoll exit → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.FIRE_MASTERY]: 2 } },
                        '1': { hp: 48 }, // 50 - 2 = 48
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // meteor — 陨石（4 陨石 → 不可防御：眩晕 + +2 FM + FM 伤害 + 2 全体伤害）
    // ========================================================================
    describe('陨石 (meteor)', () => {
        it('4 陨石造成不可防御伤害 + 眩晕 + 全体 2 伤害', () => {
            // 进攻骰: [6,6,6,6,1] → 4 meteor + 1 fire
            // 效果顺序：
            //   preDefense: inflictStatus(stun, 1) → 对手眩晕
            //   withDamage: meteor-resolve → +2 FM → FM(2) 伤害
            //   withDamage: damage(2, target: 'all') → 双方各 2 伤害
            // 不可防御 → 跳过防御 → main2
            const random = createQueuedRandom([6, 6, 6, 6, 1]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPyromancerSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '陨石 4陨石=眩晕+FM伤害+全体2',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'meteor' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            hp: 48,  // 50 - 2(全体伤害) = 48
                            tokens: { [TOKEN_IDS.FIRE_MASTERY]: 2 },
                        },
                        '1': {
                            hp: 46,  // 50 - 2(FM伤害) - 2(全体伤害) = 46
                            statusEffects: { [STATUS_IDS.STUN]: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // ultimate-inferno — 终极烈焰（5 陨石 → 终极：击倒+燃烧+3FM+12伤害+2全体）
    // ========================================================================
    describe('终极烈焰 (ultimate-inferno)', () => {
        it('5 陨石造成 12+2 伤害 + 击倒 + 燃烧 + 3 FM', () => {
            // 进攻骰: [6,6,6,6,6] → 5 meteor → ultimate
            // 效果顺序：
            //   preDefense: inflictStatus(knockdown, 1) + inflictStatus(burn, 1) + grantToken(FM, 3)
            //   withDamage: damage(12) + damage(2, target: 'all')
            // ultimate → 跳过防御 → main2
            const random = createQueuedRandom([6, 6, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createPyromancerSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '终极烈焰 5陨石=12+2伤害+击倒+燃烧+3FM',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'ultimate-inferno' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            hp: 48,  // 50 - 2(全体伤害) = 48
                            tokens: { [TOKEN_IDS.FIRE_MASTERY]: 3 },
                        },
                        '1': {
                            hp: 36,  // 50 - 12 - 2(全体伤害) = 36
                            statusEffects: {
                                [STATUS_IDS.KNOCKDOWN]: 1,
                                [STATUS_IDS.BURN]: 1,
                            },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
