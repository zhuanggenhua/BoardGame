/**
 * Monk 技能完整覆盖测试
 * 补充 flow.test.ts 中缺失的测试用例
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS, STATUS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { DiceThroneCore } from '../domain/types';
import {
    testSystems,
    createQueuedRandom,
    createNoResponseSetup,
    createNoResponseSetupWithEmptyHand,
    assertState,
    cmd,
} from './test-utils';

describe('Monk 技能完整覆盖测试', () => {
    describe('超脱 (transcendence) - Ultimate', () => {
        it('命中后完整效果链：10伤害+击倒+闪避+净化+太极上限+1并补满', () => {
            // 5个莲花: [6,6,6,6,6]
            const diceValues = [6, 6, 6, 6, 6];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '超脱命中后完整效果',
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'transcendence' }),
                    // ultimate 技能不可防御，ADVANCE_PHASE 直接从 offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            tokens: {
                                [TOKEN_IDS.TAIJI]: 6, // 上限+1变成6，并补满
                                [TOKEN_IDS.EVASIVE]: 1,
                                [TOKEN_IDS.PURIFY]: 1,
                            },
                        },
                        '1': {
                            hp: 40, // 50 - 10 = 40
                            statusEffects: {
                                [STATUS_IDS.KNOCKDOWN]: 1,
                            },
                        },
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('禅忘 (zen-forget) - 二选一分支', () => {
        it('触发禅忘获得5太极和闪避Token', () => {
            // 3个太极: [4,4,4,1,1]
            const diceValues = [4, 4, 4, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '禅忘获得5太极和闪避',
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'zen-forget' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit -> preDefense choice -> halt
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }), // 选择闪避
                    // 无伤害技能，autoContinue 后跳过防御直接到 main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            tokens: {
                                [TOKEN_IDS.TAIJI]: 5,
                                [TOKEN_IDS.EVASIVE]: 1,
                            },
                        },
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('触发禅忘获得5太极和净化Token', () => {
            // 3个太极: [4,4,4,1,1]
            const diceValues = [4, 4, 4, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '禅忘获得5太极和净化',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'zen-forget' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit -> preDefense choice -> halt
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-1' }), // 选择净化
                    // 无伤害技能，autoContinue 后跳过防御直接到 main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            tokens: {
                                [TOKEN_IDS.TAIJI]: 5,
                                [TOKEN_IDS.PURIFY]: 1,
                            },
                        },
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('太极连环拳 (taiji-combo) - rollDie 分支', () => {
        it('rollDie=拳头: 基础6伤害+2额外伤害', () => {
            // 进攻骰: [1,1,1,3,4] -> 3拳+1掌
            // rollDie: 1 -> 拳头 (+2伤害)
            // 防御骰: [1,1,1,1]
            const diceValues = [1, 1, 1, 3, 4, 1, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '太极连环拳 rollDie=拳头',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'taiji-combo' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': { hp: 42 }, // 50 - 8 = 42 (6基础 + 2拳头)
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('rollDie=掌: 基础6伤害+3额外伤害', () => {
            // 进攻骰: [1,1,1,3,4] -> 3拳+1掌+1太极
            // 防御骰: [1,1,1,1] -> 4拳 (meditation 反伤 4)
            // rollDie: 3 -> 掌 (+3伤害)
            // 骰子消耗顺序: 进攻(5) + 防御(4) + rollDie(1) = 10
            const diceValues = [1, 1, 1, 3, 4, 1, 1, 1, 1, 3];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '太极连环拳 rollDie=掌',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'taiji-combo' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { hp: 46 }, // 50 - 4 = 46 (meditation 反伤)
                        '1': { hp: 41 }, // 50 - 9 = 41 (6基础 + 3掌)
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('rollDie=太极: 基础6伤害+获得2太极', () => {
            // 进攻骰: [1,1,1,3,4] -> 3拳+1掌+1太极
            // 防御骰: [1,1,1,1] -> 4拳 (meditation 反伤 4)
            // rollDie: 4 -> 太极 (获得2太极)
            // 骰子消耗顺序: 进攻(5) + 防御(4) + rollDie(1) = 10
            // 索引 9 = 4 (太极)
            const diceValues = [1, 1, 1, 3, 4, 1, 1, 1, 1, 4];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '太极连环拳 rollDie=太极',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'taiji-combo' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.TAIJI]: 2 } },
                        '1': { hp: 44 }, // 50 - 6 = 44 (仅基础伤害)
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('rollDie=莲花: 基础6伤害+获得闪避Token', () => {
            // 进攻骰: [1,1,1,3,4] -> 3拳+1掌+1太极
            // 防御骰: [1,1,1,1] -> 4拳 (meditation 反伤 4)
            // rollDie: 6 -> 莲花 (二选一)
            const diceValues = [1, 1, 1, 3, 4, 1, 1, 1, 1, 6];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '太极连环拳 rollDie=莲花选闪避',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),  // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'taiji-combo' }),
                    cmd('ADVANCE_PHASE', '0'),  // offensiveRoll -> defensiveRoll (攻击可防御)
                    cmd('ROLL_DICE', '1'),      // 防御方掷骰
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),  // defensiveRoll 退出，触发攻击结算，rollDie 产生 choice，halt
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }), // 选择闪避
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            hp: 46, // 50 - 4 = 46 (meditation 反伤)
                            tokens: {
                                [TOKEN_IDS.EVASIVE]: 1,
                            },
                        },
                        '1': { hp: 44 }, // 50 - 6 = 44 (仅基础伤害)
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('rollDie=莲花: 基础6伤害+获得净化Token', () => {
            // 进攻骰: [1,1,1,3,4] -> 3拳+1掌+1太极
            // 防御骰: [1,1,1,1] -> 4拳 (meditation 反伤 4)
            // rollDie: 6 -> 莲花 (二选一)
            const diceValues = [1, 1, 1, 3, 4, 1, 1, 1, 1, 6];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '太极连环拳 rollDie=莲花选净化',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),  // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'taiji-combo' }),
                    cmd('ADVANCE_PHASE', '0'),  // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),  // defensiveRoll 退出，触发攻击结算，rollDie 产生 choice，halt
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-1' }), // 选择净化
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            hp: 46,
                            tokens: {
                                [TOKEN_IDS.PURIFY]: 1,
                            },
                        },
                        '1': { hp: 44 },
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('清修 (meditation) - 防御骰组合', () => {
        it('防御骰=3太极+1拳: 获得3太极+对攻击方造成1伤害', () => {
            // 进攻骰: [1,1,1,1,1] -> 5拳
            // 防御骰: [4,4,4,1] -> 3太极+1拳
            const diceValues = [1, 1, 1, 1, 1, 4, 4, 4, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '清修 3太极+1拳',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { hp: 49 }, // 50 - 1 = 49 (清修反伤)
                        '1': { tokens: { [TOKEN_IDS.TAIJI]: 3 } },
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('防御骰=4太极+0拳: 获得4太极+不造成伤害', () => {
            // 防御骰: [4,4,4,4] -> 4太极+0拳
            const diceValues = [1, 1, 1, 1, 1, 4, 4, 4, 4];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '清修 4太极+0拳',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { hp: 50 }, // 不受伤
                        '1': { tokens: { [TOKEN_IDS.TAIJI]: 4 } },
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('防御骰=0太极+4拳: 获得0太极+对攻击方造成4伤害', () => {
            // 防御骰: [1,1,1,1] -> 0太极+4拳
            const diceValues = [1, 1, 1, 1, 1, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '清修 0太极+4拳',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { hp: 46 }, // 50 - 4 = 46 (清修反伤)
                        '1': { tokens: { [TOKEN_IDS.TAIJI]: 0 } },
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ============================================
    // 升级技能测试
    // 注意：升级技能通过卡牌的 replaceAbility 效果实现
    // 这里测试的是基础技能的不同变体，升级卡牌效果在卡牌测试中覆盖
    // ============================================

    describe('基础技能变体覆盖', () => {
        it('拳法: 3拳造成4伤害', () => {
            // 进攻骰: [1,1,1,2,3] -> 3拳
            const diceValues = [1, 1, 1, 2, 3, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '拳法 3拳=4伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-3' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': { hp: 46 }, // 50 - 4 = 46
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('拳法: 4拳造成6伤害', () => {
            // 进攻骰: [1,1,1,1,2] -> 4拳
            const diceValues = [1, 1, 1, 1, 2, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '拳法 4拳=6伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-4' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': { hp: 44 }, // 50 - 6 = 44
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('和谐之力: 小顺子造成5伤害+获得2气', () => {
            // 小顺子: [1,2,3,4,5]
            const diceValues = [1, 2, 3, 4, 5, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '和谐之力 小顺子=5伤害+2气',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'harmony' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.TAIJI]: 2 } },
                        '1': { hp: 45 }, // 50 - 5 = 45
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('定水神拳: 大顺子造成7伤害+闪避+2气', () => {
            // 大顺子: [2,3,4,5,6]
            const diceValues = [2, 3, 4, 5, 6, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '定水神拳 大顺子=7伤害+闪避+2气',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'calm-water' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            tokens: {
                                [TOKEN_IDS.TAIJI]: 2,
                                [TOKEN_IDS.EVASIVE]: 1,
                            },
                        },
                        '1': { hp: 43 }, // 50 - 7 = 43
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('花开见佛: 4莲花造成5伤害+太极上限+1并补满', () => {
            // 4莲花: [6,6,6,6,1]
            // 需要初始太极>=2才能触发花费2太极使攻击不可防御的选择
            // 初始太极=5（满），花费2后剩3，postDamage 上限+1=6 并补满到6
            const diceValues = [6, 6, 6, 6, 1, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);
            
            const setupWithTaiji = (playerIds: PlayerId[], rng: RandomFn): MatchState<DiceThroneCore> => {
                const state = createNoResponseSetup()(playerIds, rng);
                const player = state.core.players['0'];
                if (player) {
                    player.tokens[TOKEN_IDS.TAIJI] = 5;
                }
                return state;
            };
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: setupWithTaiji,
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '花开见佛 4莲花=5伤害+太极上限+1',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'lotus-palm' }),
                    cmd('ADVANCE_PHASE', '0'), // preDefense 选择是否花费太极 → halt
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }), // 选择花费2太极使攻击不可防御
                    // autoContinue 触发 onPhaseExit(offensiveRoll)，isDefendable=false 直接结算
                    // 剩余3太极触发 TOKEN_RESPONSE_REQUESTED（beforeDamageDealt 加伤响应）
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 跳过加伤响应 → 攻击结算 → postDamage 太极上限+1并补满 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            tokens: {
                                // 花费2太极后，命中触发 postDamage 效果：上限+1变成6，然后补满到6
                                [TOKEN_IDS.TAIJI]: 6,
                            },
                        },
                        '1': { hp: 45 }, // 50 - 5 = 45
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('雷霆一击: 3掌投掷3骰造成总和伤害', () => {
            // 3掌: [3,3,3,1,2]
            // 投掷3骰: [4,5,6] = 15伤害
            const diceValues = [3, 3, 3, 1, 2, 1, 1, 1, 1, 4, 5, 6];
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            
            const result = runner.run({
                name: '雷霆一击 3掌=投掷3骰伤害',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'), // 确认 displayOnly 奖励骰结果 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': { hp: 35 }, // 50 - 15 = 35
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });
    });

    // ============================================
    // 端到端完整对局测试
    // ============================================

    describe('端到端完整对局', () => {
        it('单回合完整流程：玩家0超脱攻击后切换到玩家1回合', () => {
            /**
             * 测试设计：验证单回合完整流程
             * - 玩家0使用超脱(10伤害)
             * - 玩家1使用清修防御（4太极，0反伤）
             * - 玩家0回合结束，切换到玩家1回合
             * - 玩家1跳过进攻，回合结束
             * - 验证回合切换正确
             */
            
            const diceValues = [
                // 玩家0进攻: 5莲花
                6, 6, 6, 6, 6,
                // 玩家1进攻: 无效骰面
                2, 2, 2, 2, 2,
            ];
            
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: false, // 开启日志以便调试
            });
            
            // 第一步：玩家0完整回合
            const result1 = runner.run({
                name: '玩家0完整回合',
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'transcendence' }),
                    // ultimate 技能不可防御，直接从 offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep（切换到玩家1）
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '1',
                    turnNumber: 2,
                    players: {
                        '0': { 
                            hp: 50,
                            tokens: {
                                [TOKEN_IDS.TAIJI]: 6, // 超脱命中后太极上限+1并补满
                                [TOKEN_IDS.EVASIVE]: 1,
                                [TOKEN_IDS.PURIFY]: 1,
                            },
                        },
                        '1': { 
                            hp: 40, // 50 - 10 = 40
                            statusEffects: {
                                [STATUS_IDS.KNOCKDOWN]: 1, // 超脱造成击倒
                            },
                        },
                    },
                },
            });
            
            expect(result1.assertionErrors).toEqual([]);
        });

        it('两回合对局：验证第二回合开始（含Token响应流程）', () => {
            /**
             * 测试设计：验证两个完整回合对
             * - 回合1: 玩家0超脱攻击（ultimate，跳过防御）
             * - 回合2: 玩家1跳过（击倒），切换到玩家0
             * - 回合3: 玩家0再次超脱攻击
             * 
             * Token响应流程：
             * - 回合1超脱命中后，玩家0获得6太极
             * - 回合3超脱攻击时，玩家0有太极，触发 beforeDamageDealt 响应窗口
             * - 需要 SKIP_TOKEN_RESPONSE 跳过加伤响应
             */
            
            const diceValues = [
                // 回合1: 玩家0进攻（ultimate 不进入防御）
                6, 6, 6, 6, 6, // 5莲花
                // 回合3: 玩家0进攻（ultimate 不进入防御）
                6, 6, 6, 6, 6, // 5莲花
            ];
            
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: false, // 开启日志
            });
            
            const result = runner.run({
                name: '两回合对局',
                commands: [
                    // === 回合1: 玩家0攻击（ultimate 跳过防御） ===
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'transcendence' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2（跳过防御）
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (切换到玩家1)
                    
                    // === 回合2: 玩家1跳过（击倒） ===
                    cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll (击倒跳到main2)
                    cmd('ADVANCE_PHASE', '1'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '1'), // discard -> upkeep (切换到玩家0)
                    
                    // === 回合3: 玩家0攻击（需要处理Token响应） ===
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'transcendence' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> 直接结算（ultimate 跳过防御）
                    // 玩家0有太极，触发 beforeDamageDealt 响应窗口
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 跳过加伤响应
                ],
                expect: {
                    turnPhase: 'main2',
                    turnNumber: 3,
                    players: {
                        '1': { hp: 30 }, // 50 - 10 - 10 = 30
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('三回合对局：验证回合3-4流程（含Token响应）', () => {
            /**
             * 测试设计：验证三个完整回合对
             * - 回合1: 玩家0超脱攻击（ultimate，跳过防御）
             * - 回合2: 玩家1跳过（击倒）
             * - 回合3: 玩家0再次超脱攻击（含Token响应）
             * - 回合4: 玩家1跳过（击倒）
             * - 回合5: 玩家0再次超脱攻击（含Token响应）
             */
            
            const diceValues = [
                // 回合1: 玩家0进攻（ultimate 不进入防御）
                6, 6, 6, 6, 6, // 5莲花
                // 回合3: 玩家0进攻
                6, 6, 6, 6, 6, // 5莲花
                // 回合5: 玩家0进攻
                6, 6, 6, 6, 6, // 5莲花
            ];
            
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: false, // 开启日志
            });
            
            const result = runner.run({
                name: '三回合对局',
                commands: [
                    // === 回合1: 玩家0攻击（ultimate 跳过防御，无Token响应） ===
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'transcendence' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2（跳过防御）
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (切换到玩家1)
                    
                    // === 回合2: 玩家1跳过（击倒） ===
                    cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll (击倒跳到main2)
                    cmd('ADVANCE_PHASE', '1'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '1'), // discard -> upkeep (切换到玩家0)
                    
                    // === 回合3: 玩家0攻击（有Token响应） ===
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'transcendence' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> 直接结算（ultimate 跳过防御）
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 跳过加伤响应（玩家0有太极）
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (切换到玩家1)
                    
                    // === 回合4: 玩家1跳过（击倒） ===
                    cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll (击倒跳到main2)
                    cmd('ADVANCE_PHASE', '1'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '1'), // discard -> upkeep (切换到玩家0)
                    
                    // === 回合5: 玩家0攻击（有Token响应） ===
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'transcendence' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> 直接结算（ultimate 跳过防御）
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 跳过加伤响应
                ],
                expect: {
                    turnPhase: 'main2',
                    turnNumber: 5,
                    players: {
                        '1': { hp: 20 }, // 50 - 10 - 10 - 10 = 20
                    },
                },
            });
            
            expect(result.assertionErrors).toEqual([]);
        });

        it('多回合对局：双方互相攻击（含Token响应窗口处理）', () => {
            /**
             * 测试设计：
             * - 玩家0使用拳法(8伤害)，玩家1使用拳法(8伤害)
             * - 双方都使用清修防御（4拳=4反伤）
             * - 每回合攻击方受4反伤，防御方受8伤害
             * 
             * Token响应流程：
             * - 清修防御获得的是太极Token，不是直接反伤
             * - 清修的反伤是基于防御骰的拳头数量，与太极无关
             * - 第一回合：双方都没有太极，攻击结算不触发Token响应
             * - 第二回合及以后：双方都有太极（清修获得），触发Token响应
             * 
             * 血量变化（假设双方都跳过Token响应）：
             * - 回合1: 玩家0攻击，玩家1受8伤(50->42)，玩家0受4反伤(50->46)
             * - 回合2: 玩家1攻击，玩家0受8伤(46->38)，玩家1受4反伤(42->38)
             * - 回合3: 玩家0攻击，玩家1受8伤(38->30)，玩家0受4反伤(38->34)
             * - 回合4: 玩家1攻击，玩家0受8伤(34->26)，玩家1受4反伤(30->26)
             * - 回合5: 玩家0攻击，玩家1受8伤(26->18)，玩家0受4反伤(26->22)
             * - 回合6: 玩家1攻击，玩家0受8伤(22->14)，玩家1受4反伤(18->14)
             * - 回合7: 玩家0攻击，玩家1受8伤(14->6)，玩家0受4反伤(14->10)
             * - 回合8: 玩家1攻击，玩家0受8伤(10->2)，玩家1受4反伤(6->2)
             * - 回合9: 玩家0攻击，玩家1受8伤(2->-6)，游戏结束，玩家0获胜
             * 
             * 注意：使用 createNoResponseSetupWithEmptyHand 避免手牌超过 HAND_LIMIT
             */
            
            // 每回合骰子
            const attackRoundDice = [
                // 进攻: 5拳
                1, 1, 1, 1, 1,
                // 防御: 4拳（清修反伤4，获得0太极）
                1, 1, 1, 1,
            ];
            
            // 9回合的骰子
            const diceValues = [
                ...attackRoundDice, // 回合1
                ...attackRoundDice, // 回合2
                ...attackRoundDice, // 回合3
                ...attackRoundDice, // 回合4
                ...attackRoundDice, // 回合5
                ...attackRoundDice, // 回合6
                ...attackRoundDice, // 回合7
                ...attackRoundDice, // 回合8
                ...attackRoundDice, // 回合9
            ];
            
            const random = createQueuedRandom(diceValues);
            
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createNoResponseSetupWithEmptyHand(),
                assertFn: assertState,
                silent: true,
            });
            
            // 玩家0第一回合攻击（无Token响应）
            const player0FirstAttackRound = [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2（无Token响应，因为清修4拳获得0太极）
                cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                cmd('ADVANCE_PHASE', '0'), // discard -> upkeep（切换到玩家1）
            ];
            
            // 玩家1第一回合攻击（无Token响应）
            const player1FirstAttackRound = [
                cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '1'), // offensiveRoll -> defensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'meditation' }),
                cmd('ADVANCE_PHASE', '0'), // defensiveRoll -> main2（无Token响应）
                cmd('ADVANCE_PHASE', '1'), // main2 -> discard
                cmd('ADVANCE_PHASE', '1'), // discard -> upkeep（切换到玩家0）
            ];
            
            // 玩家0后续回合攻击（无Token响应，因为清修4拳获得0太极）
            const player0AttackRound = [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                cmd('ADVANCE_PHASE', '0'), // discard -> upkeep（切换到玩家1）
            ];
            
            // 玩家1后续回合攻击（无Token响应）
            const player1AttackRound = [
                cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '1'), // offensiveRoll -> defensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'meditation' }),
                cmd('ADVANCE_PHASE', '0'), // defensiveRoll -> main2
                cmd('ADVANCE_PHASE', '1'), // main2 -> discard
                cmd('ADVANCE_PHASE', '1'), // discard -> upkeep（切换到玩家0）
            ];
            
            const commands = [
                ...player0FirstAttackRound, // 回合1: 玩家0攻击
                ...player1FirstAttackRound, // 回合2: 玩家1攻击
                ...player0AttackRound,      // 回合3: 玩家0攻击
                ...player1AttackRound,      // 回合4: 玩家1攻击
                ...player0AttackRound,      // 回合5: 玩家0攻击
                ...player1AttackRound,      // 回合6: 玩家1攻击
                ...player0AttackRound,      // 回合7: 玩家0攻击
                ...player1AttackRound,      // 回合8: 玩家1攻击
                // 回合9: 玩家0攻击（最后一击，玩家1死亡）
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2，玩家1死亡
            ];
            
            const result = runner.run({
                name: '多回合对局：双方互攻',
                commands,
                expect: {
                    players: {
                        // 血量计算（使用空手牌 setup，每回合 income 抽 1 张牌）：
                        // 回合1: 玩家0攻击，玩家0受4反伤(50->46)，玩家1受8伤(50->42)
                        // 回合2: 玩家1攻击，玩家1受4反伤(42->38)，玩家0受8伤(46->38)
                        // 回合3: 玩家0攻击，玩家0受4反伤(38->34)，玩家1受8伤(38->30)
                        // 回合4: 玩家1攻击，玩家1受4反伤(30->26)，玩家0受8伤(34->26)
                        // 回合5: 玩家0攻击，玩家0受4反伤(26->22)，玩家1受8伤(26->18)
                        // 回合6: 玩家1攻击，玩家1受4反伤(18->14)，玩家0受8伤(22->14)
                        // 回合7: 玩家0攻击，玩家0受4反伤(14->10)，玩家1受8伤(14->6)
                        // 回合8: 玩家1攻击，玩家1受4反伤(6->2)，玩家0受8伤(10->2)
                        // 回合9: 玩家0攻击，玩家0受4反伤(2->0，实际伤害2)，玩家1受8伤(2->0，实际伤害2)
                        // 
                        // 两个玩家同时死亡，游戏结果为平局
                        '0': { hp: 0 },
                        '1': { hp: 0 },
                    },
                },
            });
            
            // 验证游戏结束（两个玩家同时死亡，应该是平局）
            const gameOver = DiceThroneDomain.isGameOver?.(result.finalState.core);
            expect(gameOver).toBeDefined();
            expect(gameOver?.draw).toBe(true);
            
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
