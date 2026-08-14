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
import { SLAP_2, STEADFAST_2 } from '../heroes/barbarian/abilities';
import {
    testSystems,
    createQueuedRandom,
    assertState,
    cmd,
} from './test-utils';
import type { DiceThroneCore } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { initHeroState } from '../domain/characters';

// ============================================================================
// 自定义 Setup：镜像对战测试。
// 现行规则禁止双方在 setup 阶段选择同一英雄，因此先用合法选角完成开局，
// 再在测试态把玩家 1 覆盖成狂战士，保留旧覆盖用例要验证的“狂战士打狂战士”语义。
// ============================================================================

function createBarbarianSetup() {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const core = DiceThroneDomain.setup(playerIds, random);
        const sys = createInitialSystemState(playerIds, testSystems, undefined);
        let state: MatchState<DiceThroneCore> = { sys, core };

        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        const setupCmds = [
            { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'barbarian' } },
            { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'monk' } },
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

        // 旧覆盖测试要求镜像对战；在 setup 成功后把玩家 1 覆盖为狂战士。
        state.core.selectedCharacters['1'] = 'barbarian';
        state.core.players['1'] = initHeroState('1', 'barbarian', random);

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
                    cmd('SELECT_ABILITY', '1', { abilityId: 'thick-skin' }),
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
                    cmd('SELECT_ABILITY', '1', { abilityId: 'thick-skin' }),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: { turnPhase: 'main2', players: { '1': { hp: 42 } } },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('巴掌 II 在 4 剑且 4 个相同数字时应改成不可防御并直接收口', () => {
            const random = createQueuedRandom([1, 1, 1, 1, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: (playerIds, setupRandom) => {
                    const state = createBarbarianSetup()(playerIds, setupRandom);
                    state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
                        ability.id === 'slap' ? SLAP_2 : ability
                    ));
                    state.core.players['0'].abilityLevels.slap = 2;
                    return state;
                },
                assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '巴掌 II 4剑4同值=7不可防御伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'slap-2-4' }),
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: { turnPhase: 'main2', players: { '1': { hp: 43 } } },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('巴掌 II 只有 4 剑但不是 4 个相同数字时仍应进入防御阶段', () => {
            const random = createQueuedRandom([1, 1, 2, 3, 6, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: (playerIds, setupRandom) => {
                    const state = createBarbarianSetup()(playerIds, setupRandom);
                    state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
                        ability.id === 'slap' ? SLAP_2 : ability
                    ));
                    state.core.players['0'].abilityLevels.slap = 2;
                    return state;
                },
                assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '巴掌 II 4剑非4同值仍可防御',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'slap-2-4' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'thick-skin' }),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: { turnPhase: 'main2', players: { '1': { hp: 43 } } },
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
                    cmd('SELECT_ABILITY', '1', { abilityId: 'thick-skin' }),
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
                expect: { turnPhase: 'main2', players: { '0': { hp: 54 } } }, // 50 + 4 = 54（未超上限 60）
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('坚韧 II 清状态后应完成攻击收口并进入 main2', () => {
            const random = createQueuedRandom([4, 4, 4, 1, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: (playerIds, setupRandom) => {
                    const state = createBarbarianSetup()(playerIds, setupRandom);
                    const player = state.core.players['0'];
                    player.abilities = player.abilities.map((ability) => (
                        ability.id === 'steadfast' ? STEADFAST_2 : ability
                    ));
                    player.abilityLevels.steadfast = 2;
                    player.statusEffects[STATUS_IDS.POISON] = 1;
                    return state;
                },
                assertFn: assertState, silent: true,
            });

            const result = runner.run({
                name: '坚韧 II 清状态后完成攻击收口',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'steadfast-2-3' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('REMOVE_STATUS', '0', { targetPlayerId: '0', statusId: STATUS_IDS.POISON }),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { hp: 55, statusEffects: { [STATUS_IDS.POISON]: 0 } },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // violent-assault — 暴力突袭（不可防御 + 眩晕）
    // ========================================================================
    describe('暴力突袭 (violent-assault)', () => {
        it('4 力量造成 5 不可防御伤害 + 眩晕，并立即进入额外攻击', () => {
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
                    cmd('ADVANCE_PHASE', '0'),       // 不可防御 → daze 触发额外攻击
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    players: {
                        '1': { hp: 45, statusEffects: { [STATUS_IDS.DAZE]: 0 } },  // daze 已被立即消费
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ========================================================================
    // rage — 狂怒（终极技能，5个力量面触发，眩晕+15伤害）
    // ========================================================================
    describe('狂怒 (rage)', () => {
        it('5个力量面 [6,6,6,6,6] 造成眩晕 + 15 伤害（0心防御）', () => {
            // 5个力量面: [6,6,6,6,6] → 5 strength
            // 防御骰: [6,6,6] → 0 heart（thick-skin 治疗 0）
            // 眩晕立即触发额外攻击 → offensiveRoll
            const random = createQueuedRandom([6, 6, 6, 6, 6, 6, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            const result = runner.run({
                name: '狂怒 5个力量面=眩晕+15伤害→额外攻击',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'rage' }),
                    // 终极技能不可防御，施加眩晕后立即触发额外攻击 → offensiveRoll
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',  // 进入额外攻击阶段
                    players: {
                        '0': { hp: 50 },  // 无自伤
                        '1': { hp: 35, statusEffects: { [STATUS_IDS.DAZE]: 0 } },  // 50 - 15，眩晕已移除
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('5个力量面叠加攻击修正时，应同时结算狂怒本体伤害和修正伤害', () => {
            const random = createQueuedRandom([
                6, 6, 6, 6, 6, // 狂怒
                1, 1, 6, 6, 6, // 再来点：2 个剑面，+2 伤害
            ]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: (playerIds, setupRandom) => {
                    const state = createBarbarianSetup()(playerIds, setupRandom);
                    state.core.players['0'].hand = [state.core.players['0'].deck.find(card => card.id === 'card-more-please')!];
                    state.core.players['0'].deck = state.core.players['0'].deck.filter(card => card.id !== 'card-more-please');
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['1'].hand = [];
                    state.core.players['1'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: '狂怒 + 再来点 = 17 总伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'rage' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-more-please' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    players: {
                        '1': {
                            hp: 33,
                            statusEffects: {
                                [STATUS_IDS.DAZE]: 0,
                                [STATUS_IDS.CONCUSSION]: 1,
                            },
                        },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.lastResolvedAttackDamage).toBe(17);
        });
    });

    // ========================================================================
    // suppress — 压制（自定义投骰伤害）
    // 注意：suppress 的 bonus die 机制会产生 halt，需要额外推进
    // 此处仅验证技能触发和选择，完整结算流程由 barbarian-behavior.test.ts 覆盖
    // ========================================================================
    describe('压制 (suppress)', () => {
        it('3 剑 + 2 力量可触发压制', () => {
            // 进攻骰: [1,1,1,6,6] → 3 sword + 2 strength
            const random = createQueuedRandom([1, 1, 1, 6, 6]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain, systems: testSystems,
                playerIds: ['0', '1'], random,
                setup: createBarbarianSetup(), assertFn: assertState, silent: true,
            });
            // 验证 suppress 可被选择
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
