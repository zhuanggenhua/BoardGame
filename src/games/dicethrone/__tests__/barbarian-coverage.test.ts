/**
 * 狂战士 (Barbarian) GTR 技能运行时覆盖测试
 *
 * 通过 GameTestRunner 走完整管线验证技能效果：
 * 1. slap — 3/5 剑变体伤害
 * 2. all-out-strike — 不可防御攻击
 * 3. powerful-strike — 小顺 9 伤害
 * 4. steadfast — 治疗变体
 * 5. violent-assault — 不可防御 + 眩晕
 * 6. reckless-strike — 终极技能（5个力量面 15 伤害 + 自伤 4）
 * 7. suppress — 自定义投骰伤害
 *
 * 注意：
 * - 狂战士骰面：1,2,3→sword  4,5→heart  6→strength
 * - 狂战士防御技能 thick-skin：按心数×2 治疗（攻击结算期间 HP 可临时超上限）
 * - 变体技能需要用变体 ID（如 'slap-3'）而非父 ID（'slap'）来选择
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { STATUS_IDS } from '../domain/ids';
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
// 自定义 Setup：玩家0=狂战士，玩家1=狂战士（移除响应卡避免干扰）
// ============================================================================

function createBarbarianSetup() {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const core = DiceThroneDomain.setup(playerIds, random);
        const sys = createInitialSystemState(playerIds, testSystems, undefined);
        let state: MatchState<DiceThroneCore> = { sys, core };

        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        const setupCmds = [
            { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'barbarian' } },
            { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'barbarian' } },
            { type: 'PLAYER_READY', playerId: '1', payload: {} },
            { type: 'HOST_START_GAME', playerId: '0', payload: {} },
        ];

        for (const c of setupCmds) {
            const result = executePipeline(
                pipelineConfig, state,
                { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() },
                random, playerIds,
            );
            if (result.success) state = result.state as MatchState<DiceThroneCore>;
        }

        // 移除响应卡避免触发响应窗口
        for (const pid of playerIds) {
            const player = state.core.players[pid];
            if (!player) continue;
            const nonResp = player.hand.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
            const resp = player.hand.filter(c => c.timing === 'instant' || c.timing === 'roll');
            const deckNonResp = player.deck.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
            const deckResp = player.deck.filter(c => c.timing === 'instant' || c.timing === 'roll');
            player.deck = [...deckNonResp, ...resp, ...deckResp];
            player.hand = nonResp;
            while (player.hand.length < 4 && player.deck.length > 0) {
                const card = player.deck.shift();
                if (card) player.hand.push(card);
            }
        }

        return state;
    };
}


describe('狂战士 GTR 技能覆盖', () => {
    // ========================================================================
    // slap — 巴掌（变体技能，需用变体 ID 选择）
    // ========================================================================
    describe('巴掌 (slap)', () => {
        it('3 剑造成 4 伤害', () => {
            // 进攻骰: [1,1,1,4,5] → 3 sword
            // 防御骰: [6,6,6] → 0 heart（thick-skin 治疗 0）
            const random = createQueuedRandom([1, 1, 1, 4, 5, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '巴掌 3剑=4伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),      // main1 → offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'slap-3' }),
                    cmd('ADVANCE_PHASE', '0'),       // offensiveRoll → defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),       // defensiveRoll → main2
                ],
                expect: { turnPhase: 'main2', players: { '1': { hp: 46 } } },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('5 剑造成 8 伤害', () => {
            // 进攻骰: [1,1,1,1,1] → 5 sword
            // 防御骰: [6,6,6] → 0 heart
            const random = createQueuedRandom([1, 1, 1, 1, 1, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '巴掌 5剑=8伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: { turnPhase: 'main2', players: { '1': { hp: 42 } } },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // all-out-strike — 全力一击（不可防御，跳过防御阶段）
    // ========================================================================
    describe('全力一击 (all-out-strike)', () => {
        it('2 剑 + 2 力量造成 4 不可防御伤害', () => {
            // 进攻骰: [1,1,6,6,4] → 2 sword + 2 strength + 1 heart
            const random = createQueuedRandom([1, 1, 6, 6, 4]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '全力一击 不可防御4伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'all-out-strike' }),
                    cmd('ADVANCE_PHASE', '0'),       // 不可防御 → 直接到 main2
                ],
                expect: { turnPhase: 'main2', players: { '1': { hp: 46 } } },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // powerful-strike — 强力打击（小顺，可防御）
    // thick-skin 防御：心数×2 治疗（攻击结算期间 HP 可超上限）
    // ========================================================================
    describe('强力打击 (powerful-strike)', () => {
        it('小顺造成 9 伤害（防御方 thick-skin 治疗后净伤害）', () => {
            // 进攻骰: [1,2,3,4,5] → 小顺
            // 防御骰: [6,6,6] → 0 heart（thick-skin 治疗 0）
            const random = createQueuedRandom([1, 2, 3, 4, 5, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '强力打击 小顺=9伤害（0心防御）',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'powerful-strike' }),
                    cmd('ADVANCE_PHASE', '0'),       // → defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),       // → main2
                ],
                // 防御骰 0 心 → thick-skin 治疗 0 → HP: 50 - 9 = 41
                expect: { turnPhase: 'main2', players: { '1': { hp: 41 } } },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // steadfast — 坚韧（offensive 类型但效果是纯治疗，无伤害 → 跳过防御阶段）
    // ========================================================================
    describe('坚韧 (steadfast)', () => {
        it('3 心治疗 4 点（满血时不超上限）', () => {
            // 进攻骰: [4,4,4,1,6] → 3 heart
            const random = createQueuedRandom([4, 4, 4, 1, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '坚韧 3心=治疗4',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'steadfast-3' }),
                    // 纯治疗技能无伤害效果，跳过防御直接到 main2
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: { turnPhase: 'main2', players: { '0': { hp: 50 } } },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // violent-assault — 暴力突袭（不可防御 + 眩晕）
    // ========================================================================
    describe('暴力突袭 (violent-assault)', () => {
        it('4 力量造成 5 不可防御伤害 + 眩晕', () => {
            // 进攻骰: [6,6,6,6,1] → 4 strength + 1 sword
            const random = createQueuedRandom([6, 6, 6, 6, 1]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '暴力突袭 4力量=5伤害+眩晕',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'violent-assault' }),
                    cmd('ADVANCE_PHASE', '0'),       // 不可防御 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': { hp: 45, statusEffects: { [STATUS_IDS.DAZE]: 1 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // reckless-strike — 鲁莽一击（终极技能，大顺子触发，不可防御）
    // ========================================================================
    describe('鲁莽一击 (reckless-strike)', () => {
        it('大顺子 [2,3,4,5,6] 造成 15 伤害 + 自伤 4（0心防御）', () => {
            // 大顺子: [2,3,4,5,6] → sword(2), sword(3), heart(4), heart(5), strength(6)
            // 防御骰: [6,6,6] → 0 heart（thick-skin 治疗 0）
            const random = createQueuedRandom([2, 3, 4, 5, 6, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '鲁莽一击 大顺子=15伤害+自伤4',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'reckless-strike' }),
                    // 终极技能不可防御，直接到 main2
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { hp: 46 },  // 50 - 4 自伤
                        '1': { hp: 35 },  // 50 - 15
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // suppress — 压制（自定义投骰伤害）
    // 注意：suppress 的 bonus die 机制会产生 halt，需要额外推进
    // 此处仅验证技能触发和选择，完整结算流程由 barbarian-behavior.test.ts 覆盖
    // ========================================================================
    describe('压制 (suppress)', () => {
        it('2 剑 + 2 力量可触发压制（与全力一击共享触发条件）', () => {
            // 进攻骰: [1,1,6,6,4] → 2 sword + 2 strength + 1 heart
            const random = createQueuedRandom([1, 1, 6, 6, 4]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            // 验证 suppress 可被选择（与 all-out-strike 共享触发条件）
            const result = runner.run({
                name: '压制可触发',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'suppress' }),
                    // suppress 选择成功即验证触发条件正确
                    // 完整结算（bonus die + halt）由 barbarian-behavior.test.ts 单元测试覆盖
                ],
                expect: { turnPhase: 'offensiveRoll' },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
