/**
 * 王权骰铸（DiceThrone）流程测试
 *
 * 重构说明：
 * - 所有共享工具函数（fixedRandom/cmd/createRunner 等）统一从 test-utils 导入
 * - errorAtStep → expectError（按命令类型匹配，不依赖步骤索引）
 * - 手动 ADVANCE_PHASE 序列 → advanceTo() helper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import { CP_MAX, HAND_LIMIT, INITIAL_CP, INITIAL_HEALTH } from '../domain/types';
import { STATUS_IDS, TOKEN_IDS, DICETHRONE_COMMANDS, DICETHRONE_CARD_ATLAS_IDS } from '../domain/ids';
import { resolveEffectsToEvents, type EffectContext } from '../domain/effects';
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import type { AbilityEffect } from '../domain/combat';
import { GameTestRunner, type TestCase } from '../../../engine/testing';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';

import {
    fixedRandom,
    createQueuedRandom,
    cmd,
    testSystems,
    createRunner,
    createInitializedState,
    createSetupWithHand,
    createNoResponseSetup,
    getCardById,
    assertState,
    advanceTo,
    initialDeckSize,
    expectedHandSize,
    expectedDeckAfterDraw4,
    expectedIncomeCp,
    fistAttackAbilityId,
    injectPendingInteraction,
    type DiceThroneExpectation,
    type CommandInput,
} from './test-utils';

// ============================================================================
// flow.test.ts 专用工具（不在 test-utils 中）
// ============================================================================

function createInitializedStateWithCharacters(
    playerIds: PlayerId[],
    random: RandomFn,
    characters: Record<PlayerId, string>
): MatchState<DiceThroneCore> {
    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: testSystems,
    };

    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };

    const commands: CommandInput[] = [
        cmd('SELECT_CHARACTER', '0', { characterId: characters['0'] ?? 'monk' }),
        cmd('SELECT_CHARACTER', '1', { characterId: characters['1'] ?? 'monk' }),
        cmd('PLAYER_READY', '1'),
        cmd('HOST_START_GAME', '0'),
    ];

    for (const input of commands) {
        const command = {
            type: input.type,
            playerId: input.playerId,
            payload: input.payload,
            timestamp: Date.now(),
        } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) {
            state = result.state as MatchState<DiceThroneCore>;
        }
    }

    return state;
}

// ============================================================================
// 测试用例
// ============================================================================

const baseTestCases: TestCase<DiceThroneExpectation>[] = [
    {
        name: '初始设置：体力/CP/手牌数量',
        commands: [],
        expect: {
            turnPhase: 'main1',
            turnNumber: 1,
            activePlayerId: '0',
            players: {
                '0': {
                    hp: INITIAL_HEALTH,
                    cp: INITIAL_CP,
                    handSize: expectedHandSize,
                    deckSize: expectedDeckAfterDraw4,
                },
                '1': {
                    hp: INITIAL_HEALTH,
                    cp: INITIAL_CP,
                    handSize: expectedHandSize,
                    deckSize: expectedDeckAfterDraw4,
                },
            },
        },
    },
    {
        name: '交互未确认不可推进阶段',
        setup: (playerIds, random) => {
            const state = createInitializedState(playerIds, random);
            const pendingInteraction = {
                id: 'test-interaction',
                playerId: '0' as string,
                sourceCardId: 'card-test',
                type: 'modifyDie' as const,
                titleKey: 'interaction.selectDieToChange',
                selectCount: 1,
                selected: [] as string[],
                dieModifyConfig: { mode: 'any' as const },
            };
            injectPendingInteraction(state, pendingInteraction);
            return state;
        },
        commands: [
            { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
        ],
        expect: {
            expectError: { command: 'ADVANCE_PHASE', error: '请先完成当前交互' },
            turnPhase: 'main1',
            pendingInteraction: { type: 'modifyDie', selectCount: 1, playerId: '0', dieModifyMode: 'any' },
        },
    },
    {
        name: '进入防御阶段后掷骰配置正确',
        commands: [
            ...advanceTo('offensiveRoll'),
            cmd('ROLL_DICE', '0'),
            cmd('CONFIRM_ROLL', '0'),
            cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
            cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
        ],
        expect: {
            turnPhase: 'defensiveRoll',
            roll: { count: 0, limit: 1, diceCount: 4, confirmed: false },
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: fistAttackAbilityId,
            },
            availableAbilityIdsIncludes: ['meditation'],
        },
    },
    {
        name: '先手首回合跳过收入阶段（自动推进）',
        commands: [],
        expect: {
            turnPhase: 'main1',
            players: {
                '0': {
                    cp: INITIAL_CP,
                    handSize: expectedHandSize,
                },
            },
        },
    },
    {
        name: '非先手收入阶段获得1CP与1张牌',
        commands: [
            ...advanceTo('discard'),
            cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (换人，自动推进到 main1)
        ],
        expect: {
            turnPhase: 'main1',
            activePlayerId: '1',
            turnNumber: 2,
            players: {
                '1': {
                    cp: expectedIncomeCp,
                    handSize: expectedHandSize + 1,
                    deckSize: expectedDeckAfterDraw4 - 1,
                },
            },
        },
    },
    {
        name: '掷骰次数上限为3',
        commands: [
            ...advanceTo('offensiveRoll'),
            cmd('ROLL_DICE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('ROLL_DICE', '0'), // 超过上限
        ],
        expect: {
            expectError: { command: 'ROLL_DICE', error: 'roll_limit_reached' },
            turnPhase: 'offensiveRoll',
            roll: { count: 3, limit: 3, diceCount: 5, confirmed: false },
        },
    },
    {
        name: '弃牌阶段手牌超限不可推进',
        commands: [
            cmd('DRAW_CARD', '0'),
            cmd('DRAW_CARD', '0'),
            cmd('DRAW_CARD', '0'), // 手牌 7 (>6)
            ...advanceTo('discard'),
            cmd('ADVANCE_PHASE', '0'), // discard -> 应被阻止
        ],
        expect: {
            expectError: { command: 'ADVANCE_PHASE', error: 'cannot_advance_phase' },
            turnPhase: 'discard',
            players: {
                '0': {
                    handSize: HAND_LIMIT + 1,
                },
            },
        },
    },
    {
        name: '升级差价：II -> III 仅支付 CP 差价',
        commands: [
            cmd('DRAW_CARD', '0'), // deep-thought
            cmd('DRAW_CARD', '0'), // deep-thought
            cmd('DRAW_CARD', '0'), // buddha-light
            cmd('DRAW_CARD', '0'), // buddha-light
            cmd('DRAW_CARD', '0'), // palm-strike
            cmd('DRAW_CARD', '0'), // palm-strike
            cmd('DRAW_CARD', '0'), // meditation-3
            cmd('DRAW_CARD', '0'), // meditation-2
            // 先升到 II（花费 2 CP）
            cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
            // 卖一张牌获得 1 CP，用于支付 II->III 差价（3-2=1）
            cmd('SELL_CARD', '0', { cardId: 'card-inner-peace' }),
            // 再升到 III：应只扣 1 CP
            cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-3', targetAbilityId: 'meditation' }),
        ],
        expect: {
            turnPhase: 'main1',
            players: {
                '0': {
                    cp: 0,
                    abilityLevels: { meditation: 3 },
                },
            },
        },
    },
];

// ============================================================================
// 运行测试
// ============================================================================

describe('王权骰铸流程测试', () => {
    describe('基础测试', () => {
        const runner = createRunner(fixedRandom);
        it.each(baseTestCases)('$name', (testCase) => {
            const result = runner.run(testCase);
            expect(result.assertionErrors).toEqual([]);
        });

        it('选角准备后自动进入 main1 阶段（upkeep/income 自动推进）', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const commands = [
                cmd('SELECT_CHARACTER', '0', { characterId: 'monk' }),
                cmd('SELECT_CHARACTER', '1', { characterId: 'monk' }),
                cmd('PLAYER_READY', '1'),
                cmd('HOST_START_GAME', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.core.hostStarted).toBe(true);
            expect(state.sys.phase).toBe('main1');
        });

        it('响应窗口：对手持有任意骰子卡（roll）时应打开 afterRollConfirmed', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: 'afterRollConfirmed 打开 - roll any',
                setup: createSetupWithHand(['card-surprise'], {
                    playerId: '1',
                    cp: 10,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
            expect(result.finalState.sys.responseWindow?.current?.responderQueue).toEqual(['1']);
        });

        it('响应窗口：对手持有任意骰子卡（instant）时应打开 afterRollConfirmed', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: 'afterRollConfirmed 打开 - instant any',
                setup: createSetupWithHand(['card-flick'], {
                    playerId: '1',
                    cp: 10,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
            expect(result.finalState.sys.responseWindow?.current?.responderQueue).toEqual(['1']);
        });

        it('响应窗口：对手仅持有 self 骰子卡时不应打开 afterRollConfirmed', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: 'afterRollConfirmed 不打开 - self only',
                setup: createSetupWithHand(['card-me-too'], {
                    playerId: '1',
                    cp: 10,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        });

        it('掌击后对手仅持有弹一手时不应打开 afterCardPlayed', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'afterCardPlayed 不打开 - dice instant only',
                setup: createSetupWithHand(['card-palm-strike'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [getCardById('card-flick')];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].deck = [];
                        core.players['1'].deck = [];
                    },
                }),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-palm-strike' }),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        });

        it('击倒：可花费 2CP 主动移除', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '击倒花费2CP移除',
                setup: createSetupWithHand([], {
                    cp: 4,
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    },
                }),
                commands: [
                    cmd(DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN, '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { cp: 2, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('火法师防御阶段掷骰数量为5', () => {
            const result = runner.run({
                name: '火法师防御阶段掷骰数量为5',
                setup: (playerIds, random) => createInitializedStateWithCharacters(playerIds, random, {
                    '0': 'monk',
                    '1': 'pyromancer',
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    roll: { count: 0, limit: 1, diceCount: 5, confirmed: false },
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId: fistAttackAbilityId,
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingAttack?.defenseAbilityId).toBe('magma-armor');
        });

        it('掷骰阶段使用当前玩家骰子定义（玩家0）', () => {
            const result = runner.run({
                name: '掷骰阶段骰子定义-玩家0',
                setup: (playerIds, random) => createInitializedStateWithCharacters(playerIds, random, {
                    '0': 'monk',
                    '1': 'pyromancer',
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            const diceDefs = new Set(result.finalState.core.dice.map(die => die.definitionId));
            expect(diceDefs.size).toBe(1);
            expect(diceDefs.has('monk-dice')).toBe(true);
        });

        it('掷骰阶段使用当前玩家骰子定义（玩家1）', () => {
            const result = runner.run({
                name: '掷骰阶段骰子定义-玩家1',
                setup: (playerIds, random) => createInitializedStateWithCharacters(playerIds, random, {
                    '0': 'monk',
                    '1': 'pyromancer',
                }),
                commands: [
                    ...advanceTo('discard'),
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (player1，自动推进到 main1)
                    ...advanceTo('offensiveRoll', '1'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            const diceDefs = new Set(result.finalState.core.dice.map(die => die.definitionId));
            expect(diceDefs.size).toBe(1);
            expect(diceDefs.has('pyromancer-dice')).toBe(true);
        });

        it('击倒：CP 不足时无法移除', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '击倒CP不足无法移除',
                setup: createSetupWithHand([], {
                    cp: 1,
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    },
                }),
                commands: [
                    cmd(DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN, '0'),
                ],
                expect: {
                    expectError: { command: DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN, error: 'not_enough_cp' },
                    turnPhase: 'main1',
                    players: {
                        '0': { cp: 1, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 1 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('击倒：未移除时跳过攻击阶段并移除', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '击倒跳过攻击阶段',
                setup: createSetupWithHand([], {
                    cp: 2,
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'), // main1 -> offensiveRoll (should skip to main2)
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { cp: 2, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('净化：移除击倒并消耗净化', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '净化移除击倒',
                setup: createSetupWithHand([], {
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                        core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;
                    },
                }),
                commands: [
                    cmd('USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.PURIFY]: 0 }, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('净化：无负面状态不可使用 - no_status', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '净化无负面状态 - no_status',
                setup: createSetupWithHand([], {
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 0;
                        core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;
                    },
                }),
                commands: [
                    cmd('USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }),
                ],
                expect: {
                    expectError: { command: 'USE_PURIFY', error: 'no_status' },
                    turnPhase: 'main1',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.PURIFY]: 1 }, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('技能触发', () => {
        // 骰面映射: 1,2=fist, 3=palm, 4,5=taiji, 6=lotus
        it('小顺可用"和谐"', () => {
            // 小顺: 需要4个连续不同的面。骰子值1,3,4,6 → fist,palm,taiji,lotus
            const runner = createRunner(createQueuedRandom([1, 3, 4, 6, 2]));
            const result = runner.run({
                name: '小顺可用和谐',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['harmony'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('大顺可用"定水神拳"', () => {
            // 大顺: 需要5个连续点数 [1,2,3,4,5] 或 [2,3,4,5,6]
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            const result = runner.run({
                name: '大顺可用定水神拳',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['calm-water'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个拳头可用"拳法"', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 3, 4]));
            const result = runner.run({
                name: '3个拳头可用拳法',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['fist-technique-3'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('4个莲花可用"花开见佛"（不可防御）', () => {
            const runner = createRunner(createQueuedRandom([6, 6, 6, 6, 1]));
            const result = runner.run({
                name: '4个莲花可用花开见佛',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['lotus-palm'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个太极可用"禅忘"', () => {
            const runner = createRunner(createQueuedRandom([4, 4, 4, 1, 3]));
            const result = runner.run({
                name: '3个太极可用禅忘',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['zen-forget'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个拳+1个掌可用"太极连环拳"', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 3, 4]));
            const result = runner.run({
                name: '3拳+1掌可用太极连环拳',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['taiji-combo'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个掌可用"雷霆一击"', () => {
            const runner = createRunner(createQueuedRandom([3, 3, 3, 1, 4]));
            const result = runner.run({
                name: '3个掌可用雷霆一击',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['thunder-strike'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('状态效果', () => {
        // 骰面映射: 1,2=fist, 3=palm, 4,5=taiji, 6=lotus
        it('和谐命中后获得太极', () => {
            const diceValues = [1, 3, 4, 6, 2, 1, 1, 1, 1];
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
                name: '和谐命中后获得太极',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'harmony' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { taiji: 2 } },
                        '1': { hp: 45 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('定水神拳命中后获得太极+闪避', () => {
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
                name: '定水神拳命中后获得太极+闪避',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'calm-water' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { taiji: 2, evasive: 1 } },
                        '1': { hp: 43 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('花开见佛命中后太极满值', () => {
            const random = createQueuedRandom([6, 6, 6, 6, 1, 1, 1, 1, 1]);

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
                name: '花开见佛命中后太极满值',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'lotus-palm' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { taiji: 6 } },
                        '1': { hp: 45 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卡牌效果', () => {
        it('打出升级卡时 EventStream 应包含 ABILITY_REPLACED 事件', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'ABILITY_REPLACED 事件应包含升级卡信息',
                setup: createSetupWithHand(['card-meditation-2'], {
                    cp: 2,
                }),
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    players: {
                        '0': { abilityLevels: { meditation: 2 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);

            // 验证 EventStream 包含 ABILITY_REPLACED 事件
            const entries = result.finalState.sys.eventStream?.entries ?? [];
            const abilityReplacedEntry = entries.find(
                (e: { event: { type: string } }) => e.event.type === 'ABILITY_REPLACED'
            );
            expect(abilityReplacedEntry).toBeDefined();
            const payload = abilityReplacedEntry!.event.payload as { cardId: string; playerId: string };
            expect(payload.cardId).toBe('card-meditation-2');
            expect(payload.playerId).toBe('0');
        });

        it('打出内心平静获得2太极', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '内心平静获得2太极',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-inner-peace' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { tokens: { taiji: 2 }, discardSize: 1 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('打出佛光普照获得多种状态并给对手倒地', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '佛光普照多状态',
                setup: createSetupWithHand(['card-buddha-light', 'card-enlightenment'], { cp: 2 }),
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-buddha-light' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: 0,
                            tokens: { taiji: 1, evasive: 1, purify: 1 },
                        },
                        '1': {
                            statusEffects: { knockdown: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('深思获得5太极', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '深思获得5太极',
                setup: createSetupWithHand(['card-deep-thought', 'card-enlightenment'], { cp: 2 }),
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-deep-thought' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: 0,
                            tokens: { taiji: 5 },
                            handSize: 0,
                            discardSize: 2,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('掌击给对手倒地', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '掌击给对手倒地',
                setup: createSetupWithHand(['card-palm-strike']),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-palm-strike' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '1': { statusEffects: { knockdown: 1 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('音效 sfxKey', () => {
        it('AbilityEffect.sfxKey 应传递到事件', () => {
            const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
            const ctx: EffectContext = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-sfx',
                state: core,
                damageDealt: 0,
            };
            const effects: AbilityEffect[] = [
                {
                    description: '测试 sfxKey 传递',
                    sfxKey: 'test_sfx',
                    timing: 'immediate',
                    action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.TAIJI, value: 1 },
                },
            ];

            const events = resolveEffectsToEvents(effects, 'immediate', ctx, { random: fixedRandom });
            const tokenEvent = events.find(e => e.type === 'TOKEN_GRANTED');
            expect(tokenEvent?.sfxKey).toBe('test_sfx');
        });
    });

    describe('自选移除状态交互', () => {
        it('remove-status-self 应生成仅限自身的状态选择交互', () => {
            const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
            const ctx: EffectContext = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-remove-status-self',
                state: core,
                damageDealt: 0,
            };
            const effects: AbilityEffect[] = [
                {
                    description: '移除自身状态',
                    timing: 'immediate',
                    action: { type: 'custom', target: 'self', customActionId: 'remove-status-self' },
                },
            ];

            const events = resolveEffectsToEvents(effects, 'immediate', ctx, { random: fixedRandom });
            const event = events.find(e => e.type === 'INTERACTION_REQUESTED') as any;
            expect(event).toBeDefined();
            // createSelectStatusInteraction 使用标准的 simple-choice 交互类型
            expect(event.payload?.kind).toBe('simple-choice');
            // 验证选项是否正确生成（应该只包含自身的状态）
            expect(event.payload?.data?.options).toBeDefined();
            expect(Array.isArray(event.payload?.data?.options)).toBe(true);
        });
    });

    describe('技能升级', () => {
        it('升级清修到 II 级', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级清修 II',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP - 2,
                            abilityLevels: { meditation: 2 },
                            discardSize: 1,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级拳法到 II 级', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级拳法 II',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-thrust-punch-2', targetAbilityId: 'fist-technique' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP - 2,
                            abilityLevels: { 'fist-technique': 2 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级和谐之力到 II 级', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级和谐 II',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-mahayana-2', targetAbilityId: 'harmony' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP - 1,
                            abilityLevels: { harmony: 2 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级后拳法 II 级伤害提升', () => {
            const diceValues = [1, 1, 2, 3, 4, 1, 1, 1, 1];
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
                name: '升级后拳法 II 级伤害提升',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-thrust-punch-2', targetAbilityId: 'fist-technique' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-2-3' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { abilityLevels: { 'fist-technique': 2 } },
                        '1': { hp: 43 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级后和谐 II 级伤害提升', () => {
            const diceValues = [1, 3, 4, 6, 2, 1, 1, 1, 1];
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
                name: '升级后和谐 II 级伤害提升',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-mahayana-2', targetAbilityId: 'harmony' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'harmony' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            abilityLevels: { harmony: 2 },
                            tokens: { taiji: 3 },
                        },
                        '1': { hp: 44 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('防御阶段', () => {
        it('清修技能在防御阶段可用', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: '清修在防御阶段可用',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    availableAbilityIdsIncludes: ['meditation'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('清修：防御结算=获得太极(按太极骰面数)+造成伤害(按拳骰面数)', () => {
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
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: '清修防御结算获得太极并造成伤害',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // 防御方结束防御阶段
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': { tokens: { taiji: 2 } },
                        '0': { hp: 48 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
        });

        it('防御投掷确认后响应窗口排除防御方（不排除攻击方）', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 1, 1, 1, 1, 1, 1]),
                setup: createNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '防御投掷确认后响应窗口排除防御方',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    activePlayerId: '0',
                    players: {
                        '0': { hp: 46 },
                        '1': { hp: 42 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('防御阶段掉骰上限为1', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: '防御阶段掉骰上限1',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('ROLL_DICE', '1'), // 第二次应失败
                ],
                expect: {
                    expectError: { command: 'ROLL_DICE', error: 'roll_limit_reached' },
                    turnPhase: 'defensiveRoll',
                    roll: { count: 1, limit: 1 },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卖牌与弃牌', () => {
        it('卖牌获得1CP', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '卖牌获得1CP',
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-inner-peace' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: Math.min(INITIAL_CP + 1, CP_MAX),
                            handSize: expectedHandSize - 1,
                            discardSize: 1,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卡牌打出错误提示', () => {
        it('主要阶段卡在投掷阶段无法使用 - wrongPhaseForMain', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '主要阶段卡在投掷阶段无法使用',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-enlightenment' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'wrongPhaseForMain' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('CP不足时无法打出卡牌 - notEnoughCp', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'CP不足时无法打出卡牌',
                setup: createSetupWithHand(['card-buddha-light'], { cp: INITIAL_CP }),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-buddha-light' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'notEnoughCp' },
                    turnPhase: 'main1',
                    players: {
                        '0': { cp: INITIAL_CP },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级卡在投掷阶段无法使用 - wrongPhaseForUpgrade', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级卡在投掷阶段无法使用',
                setup: createSetupWithHand(['card-meditation-2']),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_UPGRADE_CARD', error: 'wrongPhaseForUpgrade' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级卡跳级使用 - upgradeCardSkipLevel', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级卡跳级使用',
                setup: createSetupWithHand(['card-meditation-3']),
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-3', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_UPGRADE_CARD', error: 'upgradeCardSkipLevel' },
                    turnPhase: 'main1',
                    players: {
                        '0': { abilityLevels: { meditation: 1 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('投掷阶段卡在主要阶段无法使用 - wrongPhaseForRoll', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '投掷阶段卡在主要阶段无法使用',
                setup: createSetupWithHand(['card-play-six']),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-play-six' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'wrongPhaseForRoll' },
                    turnPhase: 'main1',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('雷霆万钧 奖励骰重掷', () => {
        const createThunderStrikeSetup = (options: { taiji?: number } = {}) => {
            return createSetupWithHand([], {
                playerId: '0',
                mutate: (core) => {
                    if (options.taiji !== undefined) {
                        core.players['0'].tokens[TOKEN_IDS.TAIJI] = options.taiji;
                    }
                },
            });
        };

        it('有太极时触发重掷交互流程', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '有太极时触发重掷交互',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算
                ],
                expect: {
                    pendingBonusDiceSettlement: {
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                        targetId: '1',
                        rerollCount: 0,
                        diceValues: [2, 3, 4],
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('重掷奖励骰并结算（消耗2太极）', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '重掷奖励骰并结算',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 0 } },
                        '1': { hp: 37 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('无太极时直接结算伤害', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 0 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '无太极时直接结算',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '1': { hp: 41 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('太极不足(1)时直接结算伤害', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 1 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '太极不足(1)时直接结算',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算攻击，太极不足以重掷但可用于加伤，触发 Token 响应窗口
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 攻击方跳过太极加伤 → autoContinue → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 1 } },
                        '1': { hp: 41 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('跳过重掷不消耗太极并使用原骰结算', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '跳过重掷直接结算',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 2 } },
                        '1': { hp: 41 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('超过重掷次数限制', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 6, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 4 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '超过重掷次数限制',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 1 }),
                ],
                expect: {
                    expectError: { command: 'REROLL_BONUS_DIE', error: 'bonus_reroll_limit_reached' },
                    pendingBonusDiceSettlement: {
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('雷霆一击 II 奖励骰重掷', () => {
        const createThunderStrikeSetup = (options: { taiji?: number } = {}) => {
            return createSetupWithHand(['card-storm-assault-2'], {
                playerId: '0',
                mutate: (core) => {
                    if (options.taiji !== undefined) {
                        core.players['0'].tokens[TOKEN_IDS.TAIJI] = options.taiji;
                    }
                },
            });
        };

        it('有太极时触发重掷交互流程', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '有太极时触发重掷交互',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算
                ],
                expect: {
                    pendingBonusDiceSettlement: {
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                        targetId: '1',
                        threshold: 12,
                        rerollCount: 0,
                        diceValues: [2, 3, 4],
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('重掷奖励骰并结算', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => { core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2; },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '重掷奖励骰并结算',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 1 } },
                        '1': {
                            hp: 37,
                            statusEffects: { knockdown: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('无太极时直接结算伤害', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => {
                        const opponent = core.players['1'];
                        if (opponent) {
                            const nonResponseCards = opponent.hand.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
                            const responseCards = opponent.hand.filter(c => c.timing === 'instant' || c.timing === 'roll');
                            opponent.deck = [...opponent.deck, ...responseCards];
                            opponent.hand = nonResponseCards;
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '无太极时直接结算',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '1': {
                            hp: 41,
                            statusEffects: { knockdown: 0 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('总和 >= 12 触发倒地', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 4, 4, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => {
                        const opponent = core.players['1'];
                        if (opponent) {
                            const nonResponseCards = opponent.hand.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
                            const responseCards = opponent.hand.filter(c => c.timing === 'instant' || c.timing === 'roll');
                            opponent.deck = [...opponent.deck, ...responseCards];
                            opponent.hand = nonResponseCards;
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '总和 >= 12 触发倒地',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '1': {
                            hp: 38,
                            statusEffects: { knockdown: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('多次重掷并结算', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => { core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2; },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '多次重掷并结算',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 1 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 0 } },
                        '1': {
                            hp: 37,
                            statusEffects: { knockdown: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卡牌交互（全覆盖）', () => {
        // GameTestRunner 用 stepNum（命令索引+1）作为 timestamp
        // interactionId = `${cardId}-${playCardStep}`

        it('玩得六啊：set 模式修改 1 颗骰子至 6', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            // ADVANCE_PHASE=1, ROLL_DICE=2, PLAY_CARD=3
            const interactionId = `card-play-six-3`;
            const result = runner.run({
                name: '玩得六啊 set',
                setup: createSetupWithHand(['card-play-six'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-play-six' }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 6 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId }),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [6, 2, 3, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('俺也一样：copy 模式修改骰子为另一颗值', () => {
            const runner = createRunner(createQueuedRandom([2, 5, 1, 3, 4]));
            const interactionId = `card-me-too-3`;
            const result = runner.run({
                name: '俺也一样 copy',
                setup: createSetupWithHand(['card-me-too'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-me-too' }),
                    cmd('MODIFY_DIE', '0', { dieId: 1, newValue: 2 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId }),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [2, 2, 1, 3, 4],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('惊不惊喜：any 模式修改任意 1 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            const interactionId = `card-surprise-3`;
            const result = runner.run({
                name: '惊不惊喜 any-1',
                setup: createSetupWithHand(['card-surprise'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-surprise' }),
                    cmd('MODIFY_DIE', '0', { dieId: 2, newValue: 6 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId }),
                ],
                expect: {
                    diceValues: [1, 2, 6, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('意不意外：any 模式修改任意 2 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            const interactionId = `card-unexpected-3`;
            const result = runner.run({
                name: '意不意外 any-2',
                setup: createSetupWithHand(['card-unexpected'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-unexpected' }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 6 }),
                    cmd('MODIFY_DIE', '0', { dieId: 1, newValue: 6 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId }),
                ],
                expect: {
                    diceValues: [6, 6, 3, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('弹一手：adjust 模式增减 1 点', () => {
            const runner = createRunner(createQueuedRandom([2, 2, 2, 2, 2]));
            const interactionId = `card-flick-3`;
            const result = runner.run({
                name: '弹一手 adjust',
                setup: createSetupWithHand(['card-flick'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-flick' }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 3 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId }),
                ],
                expect: {
                    diceValues: [3, 2, 2, 2, 2],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('不愧是我：重掷至多 2 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5, 6, 6]));
            const interactionId = `card-worthy-of-me-3`;
            const result = runner.run({
                name: '不愧是我 reroll-2',
                setup: createSetupWithHand(['card-worthy-of-me'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-worthy-of-me' }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId, selectedDiceIds: [0, 1] }),
                ],
                expect: {
                    diceValues: [6, 6, 3, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('我又行了：重掷至多 5 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 2, 3, 4, 5, 6]));
            const interactionId = `card-i-can-again-3`;
            const result = runner.run({
                name: '我又行了 reroll-5',
                setup: createSetupWithHand(['card-i-can-again'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-i-can-again' }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId, selectedDiceIds: [0, 1, 2, 3, 4] }),
                ],
                expect: {
                    diceValues: [2, 3, 4, 5, 6],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('抬一手：强制对手重掷 1 颗骰子（防御阶段，进攻方响应）', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 2, 2, 2, 2, 6]));
            // PLAY_CARD is step 10: ADVANCE+ROLL+CONFIRM+PASS*2+SELECT+ADVANCE+ROLL+CONFIRM+PLAY_CARD
            const interactionId = `card-give-hand-10`;
            const result = runner.run({
                name: '抬一手 reroll-opponent (防御阶段)',
                setup: createSetupWithHand(['card-give-hand'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [];
                        core.players['1'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-give-hand' }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId, selectedDiceIds: [0] }),
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    diceValues: [6, 2, 2, 2, 1],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('抬一手：强制对手重掷 1 颗骰子（进攻阶段，防御方响应）', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 6]));
            // PLAY_CARD is step 4: ADVANCE+ROLL+CONFIRM+PLAY_CARD
            const interactionId = `card-give-hand-4`;
            const result = runner.run({
                name: '抬一手 reroll-opponent (进攻阶段)',
                setup: createSetupWithHand([], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [getCardById('card-give-hand')];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
                    cmd('CONFIRM_INTERACTION', '1', { interactionId, selectedDiceIds: [0] }),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [6, 1, 1, 1, 1],
                    pendingInteraction: null,
                    players: { '1': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('惊不惊喜：在响应窗口中使用（进攻阶段，防御方响应）', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            // PLAY_CARD is step 4: ADVANCE+ROLL+CONFIRM+PLAY_CARD
            const interactionId = `card-surprise-4`;
            const result = runner.run({
                name: '惊不惊喜 response-window',
                setup: createSetupWithHand([], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [{
                            id: 'card-surprise',
                            name: '惊不惊喜？！',
                            type: 'action',
                            cpCost: 2,
                            timing: 'roll',
                            description: '',
                            previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 18 },
                            playCondition: {
                                requireDiceExists: true,
                                requireHasRolled: true,
                            },
                            effects: [{
                                description: '改变任意1颗骰子的数值',
                                action: { type: 'custom', target: 'select', customActionId: 'modify-die-any-1' },
                                timing: 'immediate',
                            }],
                        }];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('PLAY_CARD', '1', { cardId: 'card-surprise' }),
                    cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 6 }),
                    cmd('CONFIRM_INTERACTION', '1', { interactionId }),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [6, 1, 1, 1, 1],
                    pendingInteraction: null,
                    players: { '1': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('拜拜了您内：移除 1 个状态效果', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '拜拜了您内 remove-status',
                setup: createSetupWithHand(['card-bye-bye'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].statusEffects.knockdown = 1;
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-bye-bye' }),
                    // 新交互系统：使用 SYS_INTERACTION_RESPOND 命令响应交互
                    // payload 应该是 { optionId: string } 格式
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                ],
                expect: {
                    players: {
                        '1': { statusEffects: { knockdown: 0 } },
                        '0': { discardSize: 1 },
                    },
                    // 新交互系统：检查 sys.interaction 而非 pendingInteraction
                    'sys.interaction.current': null,
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('阶段推进防护（状态驱动回归测试）', () => {
        it('main1 阶段 BONUS_DICE_SETTLED 不触发阶段推进', () => {
            // 模拟卡牌效果在 main1 触发奖励骰重掷交互，结算后阶段应停留在 main1
            const random = createQueuedRandom([1, 1, 1, 1, 1]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: (playerIds: PlayerId[], r: RandomFn) => {
                    const state = createInitializedState(playerIds, r);
                    // 注入 pendingBonusDiceSettlement（模拟卡牌效果产生的奖励骰）
                    state.core.pendingBonusDiceSettlement = {
                        id: 'test-bonus-dice-main1',
                        sourceAbilityId: 'test-card-effect',
                        attackerId: '0',
                        targetId: '1',
                        dice: [{ index: 0, value: 3, face: 'fist' }],
                        rerollCostTokenId: TOKEN_IDS.TAIJI,
                        rerollCostAmount: 2,
                        rerollCount: 0,
                        readyToSettle: false,
                    };
                    // 注入 dt:bonus-dice 交互（模拟 DiceThrone event system 创建的交互）
                    state.sys.interaction = {
                        ...state.sys.interaction,
                        current: {
                            id: 'dt-bonus-dice-test-bonus-dice-main1',
                            kind: 'dt:bonus-dice',
                            playerId: '0',
                            data: state.core.pendingBonusDiceSettlement,
                        },
                    };
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'main1 奖励骰结算不推进阶段',
                commands: [
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingBonusDiceSettlement: null,
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('main2 阶段 CHOICE_RESOLVED 不触发阶段推进', () => {
            // 模拟卡牌效果在 main2 触发选择交互，选择解决后阶段应停留在 main2
            const random = fixedRandom;
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand(['card-buddha-light'], {
                    cp: 10,
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'main2 阶段打出卡牌后不自动推进',
                commands: [
                    ...advanceTo('main2'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-buddha-light' }),
                ],
                expect: {
                    turnPhase: 'main2',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('offensiveRoll 阶段打出大吉大利（instant 卡）不触发阶段推进', () => {
            // 场景：玩家在 offensiveRoll 阶段打出"大吉大利"（card-lucky），
            // 卡牌效果生成 BONUS_DICE_REROLL_REQUESTED(displayOnly)，
            // 玩家关闭展示后 SKIP_BONUS_DICE_REROLL → BONUS_DICE_SETTLED，
            // 阶段应停留在 offensiveRoll，不应自动推进
            const random = createQueuedRandom([
                // card-lucky 的 handleLuckyRollHeal 需要 3 次 d(6)
                3, 3, 3,
                1, 1, 1, 1, 1, // 额外随机数缓冲
            ]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand([], {
                    cp: 0,
                    mutate: (core) => {
                        // 手动注入野蛮人的"大吉大利"卡牌到玩家0手牌
                        const luckyCard = BARBARIAN_CARDS.find(c => c.id === 'card-lucky');
                        if (luckyCard) {
                            core.players['0'].hand.push(JSON.parse(JSON.stringify(luckyCard)));
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'offensiveRoll 打出大吉大利不推进阶段',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-lucky' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('flowHalted=true 状态下打出大吉大利不会误触发阶段推进', () => {
            // 场景：攻击结算产生 BONUS_DICE_REROLL_REQUESTED → halt → flowHalted=true
            // 此时玩家打出"大吉大利"（instant 卡），产生新的 displayOnly BONUS_DICE_REROLL_REQUESTED
            // 关闭展示后 BONUS_DICE_SETTLED → resolveInteraction
            // 阶段应停留在 offensiveRoll（因为攻击的 bonus dice 还未处理）
            const random = createQueuedRandom([
                // card-lucky 的 handleLuckyRollHeal 需要 3 次 d(6)
                3, 3, 3,
                1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 额外随机数缓冲
            ]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: (playerIds: PlayerId[], r: RandomFn) => {
                    const state = createInitializedState(playerIds, r);
                    // 模拟攻击结算 halt 后的状态：
                    // 0. 阶段设为 offensiveRoll
                    state.sys.phase = 'offensiveRoll';
                    // 1. flowHalted=true（攻击结算 halt 设置）
                    state.sys.flowHalted = true;
                    // 2. 攻击的 bonus dice interaction 在 current
                    state.sys.interaction = {
                        ...state.sys.interaction,
                        current: {
                            id: 'dt-bonus-dice-attack-thunder',
                            kind: 'dt:bonus-dice',
                            playerId: '0',
                            data: null,
                        },
                    };
                    // 3. 注入攻击的 pendingBonusDiceSettlement
                    state.core.pendingBonusDiceSettlement = {
                        id: 'attack-thunder-bonus',
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                        targetId: '1',
                        dice: [{ index: 0, value: 5, face: 'fist' }, { index: 1, value: 3, face: 'heart' }],
                        rerollCostTokenId: TOKEN_IDS.TAIJI,
                        rerollCostAmount: 1,
                        rerollCount: 0,
                        readyToSettle: false,
                    };
                    // 4. 注入"大吉大利"卡牌到手牌
                    const luckyCard = BARBARIAN_CARDS.find(c => c.id === 'card-lucky');
                    if (luckyCard) {
                        state.core.players['0'].hand.push(JSON.parse(JSON.stringify(luckyCard)));
                    }
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'flowHalted + 大吉大利不误推进',
                commands: [
                    // 打出"大吉大利"（instant 卡，不被 dt:bonus-dice interaction 阻塞）
                    cmd('PLAY_CARD', '0', { cardId: 'card-lucky' }),
                    // 关闭大吉大利的 displayOnly 展示
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    // 阶段应停留在 offensiveRoll（攻击的 bonus dice 还未处理）
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
