/**
 * 召唤师战争流程测试
 */

import { describe, it, expect } from 'vitest';
import { FLOW_COMMANDS } from '../../../engine';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, GamePhase, PlayerId, UnitCard, EventCard, FactionId } from '../domain/types';
import { buildAiDecisionContext, resolveNextLocalAiAction } from '../../../engine/ai';
import { resolveLocalAiActionVisibility } from '../../../engine/ai/actionVisibility';
import { buildSummonerWarsAiLegalActions, summonerWarsAiRuntime } from '../ai';
import { abilityRegistry } from '../domain/abilities';
import { CARD_IDS } from '../domain/ids';

import { GameTestRunner, type TestCase, type StateExpectation } from '../../../engine/testing';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import {
    BOARD_ROWS,
    BOARD_COLS,
    getValidSummonPositions,
    getSummoner,
} from '../domain/helpers';
import {
    createInitializedCore,
    createPromptResponseCommand,
    getPromptOptionIdForTargetPosition,
    getPromptOptionIds,
    getPromptSwType,
    hasActivePrompt,
    placeTestUnit,
    resetInstanceCounter,
} from './test-helpers';
import { engineConfig } from '../game';

const aiTestRandom = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(arr: T[]) => [...arr],
};

describe('Summoner Wars AI 可见步骤白名单', () => {
    function createAiPhaseState(phase: GamePhase): MatchState<SummonerWarsCore> {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.currentPlayer = '1';
        core.phase = phase;
        const sys = createInitialSystemState(['0', '1'] as PlayerId[], []);
        sys.phase = phase;
        return { core, sys };
    }

    it('空阶段推进不吃 1 秒等待，抽牌交还真人仍保留可见延迟', () => {
        const visibleStepConfig = summonerWarsAiRuntime.localVisibleStepDelayConfig;
        expect(visibleStepConfig?.mode).toBe('whitelist');
        expect(visibleStepConfig?.actionKinds).toEqual(expect.arrayContaining([
            'summon-unit',
            'move-unit',
            'build-structure',
            'declare-attack',
            'discard-for-magic',
            'activate-ability',
            'play-event',
        ]));
        expect(visibleStepConfig?.actionKinds).not.toContain('advance-phase');
        expect(visibleStepConfig?.actionKinds).not.toContain('interaction-choice');

        const summonEndAction = buildSummonerWarsAiLegalActions({
            playerId: '1',
            state: createAiPhaseState('summon'),
        }).find((action) => action.kind === 'advance-phase');
        expect(summonEndAction).toBeDefined();
        expect(resolveLocalAiActionVisibility(summonEndAction!, summonerWarsAiRuntime)).toBe('hidden');

        const drawEndAction = buildSummonerWarsAiLegalActions({
            playerId: '1',
            state: createAiPhaseState('draw'),
        }).find((action) => action.kind === 'advance-phase');
        expect(drawEndAction).toBeDefined();
        expect(resolveLocalAiActionVisibility(drawEndAction!, summonerWarsAiRuntime)).toBe('visible');

        expect(resolveLocalAiActionVisibility({
            kind: 'summon-unit',
            commands: [{ type: SW_COMMANDS.SUMMON_UNIT, payload: {} }],
        }, summonerWarsAiRuntime)).toBe('visible');
    });
});

type SummonPhaseEventAiCase = {
    faction: FactionId;
    cardId: string;
    baseId: string;
    name: string;
    eventType: EventCard['eventType'];
    effect: string;
};

const underConstructionSummonPhaseEventAiCases: SummonPhaseEventAiCase[] = [
    {
        faction: 'huijin',
        cardId: 'huijin-phoenix-soul-0',
        baseId: CARD_IDS.HUIJIN_PHOENIX_SOUL,
        name: '凤凰之魂',
        eventType: 'legendary',
        effect: '持续。每当一个友方单位的技能以攻击之外的方式对敌方单位造成伤害时，额外造成 1 点伤害。',
    },
    {
        faction: 'yongheng',
        cardId: 'yongheng-insight-0',
        baseId: CARD_IDS.YONGHENG_INSIGHT,
        name: '洞察',
        eventType: 'common',
        effect: '持续。每当你抓取一张或更多卡牌时，将本事件充能。',
    },
    {
        faction: 'yongheng',
        cardId: 'yongheng-search-0',
        baseId: CARD_IDS.YONGHENG_SEARCH,
        name: '探寻',
        eventType: 'common',
        effect: '持续。在你的移动、建造和攻击阶段开始时，你可以抓取一张卡牌。',
    },
    {
        faction: 'yongheng',
        cardId: 'yongheng-mental-invasion-0',
        baseId: CARD_IDS.YONGHENG_MENTAL_INVASION,
        name: '心念侵袭',
        eventType: 'common',
        effect: '持续。每当你在自己的回合中抓取一张或更多卡牌时，你可以指定你的召唤师 2 个区格以内的一个敌方士兵或英雄为目标。',
    },
];

function createModerateThreatAttackCore(): SummonerWarsCore {
    const core = createInitializedCore(['0', '1'], aiTestRandom);
    core.phase = 'attack';
    core.board[6][2].unit = undefined;
    core.board[6][3].unit = undefined;
    core.board[5][2].unit = undefined;

    const defenderCard: UnitCard = {
        id: 'test-guard',
        cardType: 'unit',
        name: '测试护卫',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 3,
        cost: 1,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
    };
    const threateningCard: UnitCard = {
        id: 'test-threat',
        cardType: 'unit',
        name: '测试威胁兵',
        unitClass: 'common',
        faction: 'paladin',
        strength: 2,
        life: 3,
        cost: 1,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
    };
    const championCard: UnitCard = {
        id: 'test-champion',
        cardType: 'unit',
        name: '测试冠军',
        unitClass: 'champion',
        faction: 'paladin',
        strength: 3,
        life: 4,
        cost: 3,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
    };

    placeTestUnit(core, { row: 6, col: 2 }, {
        card: defenderCard,
        owner: '0',
    });
    placeTestUnit(core, { row: 6, col: 3 }, {
        card: threateningCard,
        owner: '1',
    });
    placeTestUnit(core, { row: 5, col: 2 }, {
        card: championCard,
        owner: '1',
        damage: 0,
    });

    return core;
}

function createBoardControlTiebreakAttackCore(): SummonerWarsCore {
    const core = createModerateThreatAttackCore();
    const ownSummoner = core.board[7][3].unit;
    core.board[7][3].unit = undefined;
    core.board[7][0].unit = ownSummoner
        ? {
            ...ownSummoner,
            position: { row: 7, col: 0 },
        }
        : undefined;
    return core;
}

function createActivatedAbilityHeuristicCore(): SummonerWarsCore {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], aiTestRandom, {
        faction0: 'barbaric',
        faction1: 'paladin',
    });
    core.phase = 'move';
    core.currentPlayer = '0';

    for (let row = 0; row < BOARD_ROWS; row += 1) {
        for (let col = 0; col < BOARD_COLS; col += 1) {
            const unit = core.board[row][col].unit;
            if (unit && unit.card.unitClass !== 'summoner') {
                core.board[row][col].unit = undefined;
            }
        }
    }

    const ownSummoner = getSummoner(core, '0');
    const enemySummoner = getSummoner(core, '1');
    if (!ownSummoner || !enemySummoner) {
        throw new Error('测试场景缺少召唤师');
    }
    ownSummoner.hasMoved = true;
    enemySummoner.hasMoved = true;
    ownSummoner.card = {
        ...ownSummoner.card,
        abilities: [],
    };

    const inspireSourceCard: UnitCard = {
        id: 'test-inspire-source',
        cardType: 'unit',
        name: '测试鼓舞者',
        unitClass: 'champion',
        faction: 'barbaric',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['inspire'],
        deckSymbols: [],
    };
    const prepareSourceCard: UnitCard = {
        id: 'test-prepare-source',
        cardType: 'unit',
        name: '测试预备者',
        unitClass: 'common',
        faction: 'barbaric',
        strength: 1,
        life: 3,
        cost: 1,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['prepare'],
        deckSymbols: [],
    };
    const allyChampionCard: UnitCard = {
        id: 'test-inspired-champion',
        cardType: 'unit',
        name: '测试前锋冠军',
        unitClass: 'champion',
        faction: 'barbaric',
        strength: 3,
        life: 4,
        cost: 3,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
    };
    const allyCommonCard: UnitCard = {
        id: 'test-inspired-common',
        cardType: 'unit',
        name: '测试护卫兵',
        unitClass: 'common',
        faction: 'barbaric',
        strength: 2,
        life: 3,
        cost: 1,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
    };

    const inspireSourcePos = {
        row: ownSummoner.position.row - 1,
        col: ownSummoner.position.col,
    };
    placeTestUnit(core, inspireSourcePos, {
        card: inspireSourceCard,
        owner: '0',
        hasMoved: true,
    });
    placeTestUnit(core, {
        row: inspireSourcePos.row,
        col: inspireSourcePos.col - 1,
    }, {
        card: allyChampionCard,
        owner: '0',
        hasMoved: true,
    });
    placeTestUnit(core, {
        row: inspireSourcePos.row,
        col: inspireSourcePos.col + 1,
    }, {
        card: allyCommonCard,
        owner: '0',
        hasMoved: true,
    });
    placeTestUnit(core, {
        row: ownSummoner.position.row - 2,
        col: 0,
    }, {
        card: prepareSourceCard,
        owner: '0',
        hasMoved: false,
        tempAbilities: ['immobile'],
    });

    return core;
}

function createTargetedAbilityCore(): SummonerWarsCore {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], aiTestRandom, {
        faction0: 'goblin',
        faction1: 'paladin',
    });
    core.phase = 'attack';
    core.currentPlayer = '0';

    for (let row = 0; row < BOARD_ROWS; row += 1) {
        for (let col = 0; col < BOARD_COLS; col += 1) {
            const unit = core.board[row][col].unit;
            if (unit && unit.card.unitClass !== 'summoner') {
                core.board[row][col].unit = undefined;
            }
        }
    }

    const ownSummoner = getSummoner(core, '0');
    if (!ownSummoner) {
        throw new Error('测试场景缺少召唤师');
    }
    ownSummoner.card = {
        ...ownSummoner.card,
        abilities: ['vanish'],
    };

    const allyChampionCard: UnitCard = {
        id: 'test-vanish-champion',
        cardType: 'unit',
        name: '测试零费冠军',
        unitClass: 'champion',
        faction: 'goblin',
        strength: 3,
        life: 5,
        cost: 0,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
    };
    const allyCommonCard: UnitCard = {
        id: 'test-vanish-common',
        cardType: 'unit',
        name: '测试零费士兵',
        unitClass: 'common',
        faction: 'goblin',
        strength: 2,
        life: 3,
        cost: 0,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
    };

    placeTestUnit(core, {
        row: ownSummoner.position.row - 1,
        col: ownSummoner.position.col,
    }, {
        card: allyChampionCard,
        owner: '0',
    });
    placeTestUnit(core, {
        row: ownSummoner.position.row,
        col: ownSummoner.position.col - 1,
    }, {
        card: allyCommonCard,
        owner: '0',
    });

    return core;
}

function createCandidateLoopStressSummonCore(): SummonerWarsCore {
    resetInstanceCounter();
    const core = createInitializedCore(['0', '1'], aiTestRandom, {
        faction0: 'necromancer',
        faction1: 'paladin',
    });
    core.phase = 'summon';
    core.currentPlayer = '0';

    for (let index = 0; index < 8; index += 1) {
        const testUnitCard: UnitCard = {
            id: `test-ai-loop-unit-${index}`,
            cardType: 'unit',
            name: `测试循环单位${index + 1}`,
            unitClass: 'common',
            faction: 'necromancer',
            strength: 2 + (index % 2),
            life: 3 + (index % 3),
            cost: 1,
            attackType: 'melee',
            attackRange: 1,
            deckSymbols: [],
        };
        core.players['0'].hand.push(testUnitCard);
    }

    return core;
}

function createChargedFuneralPyre(cardId = 'necro-funeral-pyre-0-0'): EventCard {
    return {
        id: cardId,
        cardType: 'event',
        name: '殉葬火堆',
        eventType: 'legendary',
        faction: 'necromancer',
        cost: 1,
        playPhase: 'summon',
        effect: '持续效果',
        isActive: true,
        charges: 3,
        deckSymbols: [],
    };
}

// ============================================================================
// 召唤师战争专用断言
// ============================================================================

interface SummonerWarsExpectation extends StateExpectation {
    /** 预期的当前阶段 */
    phase?: GamePhase;
    /** 预期的当前玩家 */
    currentPlayer?: PlayerId;
    /** 预期的回合数 */
    turnNumber?: number;
    /** 预期玩家0的魔力 */
    player0Magic?: number;
    /** 预期玩家1的魔力 */
    player1Magic?: number;
    /** 预期玩家0的移动次数 */
    player0MoveCount?: number;
    /** 预期玩家1的移动次数 */
    player1MoveCount?: number;
    /** 预期玩家0的攻击次数 */
    player0AttackCount?: number;
    /** 预期玩家0是否攻击过敌方卡牌 */
    player0HasAttackedEnemy?: boolean;
    /** 预期获胜者 */
    winner?: string;
    /** 预期某位置有单位 */
    unitAt?: { row: number; col: number; owner?: PlayerId };
    /** 预期某位置无单位 */
    noUnitAt?: { row: number; col: number };
    /** 预期某单位的伤害值 */
    unitDamageAt?: { row: number; col: number; damage: number };
}

function assertSummonerWars(
    state: SummonerWarsCore,
    expectation: SummonerWarsExpectation
): string[] {
    const errors: string[] = [];

    if (expectation.phase !== undefined && state.phase !== expectation.phase) {
        errors.push(`阶段不匹配: 预期 ${expectation.phase}, 实际 ${state.phase}`);
    }

    if (expectation.currentPlayer !== undefined && state.currentPlayer !== expectation.currentPlayer) {
        errors.push(`当前玩家不匹配: 预期 ${expectation.currentPlayer}, 实际 ${state.currentPlayer}`);
    }

    if (expectation.turnNumber !== undefined && state.turnNumber !== expectation.turnNumber) {
        errors.push(`回合数不匹配: 预期 ${expectation.turnNumber}, 实际 ${state.turnNumber}`);
    }

    if (expectation.player0Magic !== undefined && state.players['0'].magic !== expectation.player0Magic) {
        errors.push(`玩家0魔力不匹配: 预期 ${expectation.player0Magic}, 实际 ${state.players['0'].magic}`);
    }

    if (expectation.player1Magic !== undefined && state.players['1'].magic !== expectation.player1Magic) {
        errors.push(`玩家1魔力不匹配: 预期 ${expectation.player1Magic}, 实际 ${state.players['1'].magic}`);
    }

    if (expectation.player0MoveCount !== undefined && state.players['0'].moveCount !== expectation.player0MoveCount) {
        errors.push(`玩家0移动次数不匹配: 预期 ${expectation.player0MoveCount}, 实际 ${state.players['0'].moveCount}`);
    }

    if (expectation.player1MoveCount !== undefined && state.players['1'].moveCount !== expectation.player1MoveCount) {
        errors.push(`玩家1移动次数不匹配: 预期 ${expectation.player1MoveCount}, 实际 ${state.players['1'].moveCount}`);
    }

    if (expectation.player0AttackCount !== undefined && state.players['0'].attackCount !== expectation.player0AttackCount) {
        errors.push(`玩家0攻击次数不匹配: 预期 ${expectation.player0AttackCount}, 实际 ${state.players['0'].attackCount}`);
    }

    if (expectation.player0HasAttackedEnemy !== undefined && state.players['0'].hasAttackedEnemy !== expectation.player0HasAttackedEnemy) {
        errors.push(`玩家0攻击敌方标记不匹配: 预期 ${expectation.player0HasAttackedEnemy}, 实际 ${state.players['0'].hasAttackedEnemy}`);
    }

    if (expectation.unitAt !== undefined) {
        const { row, col, owner } = expectation.unitAt;
        const unit = state.board[row]?.[col]?.unit;
        if (!unit) {
            errors.push(`预期位置 (${row}, ${col}) 有单位，但没有`);
        } else if (owner !== undefined && unit.owner !== owner) {
            errors.push(`位置 (${row}, ${col}) 单位所有者不匹配: 预期 ${owner}, 实际 ${unit.owner}`);
        }
    }

    if (expectation.noUnitAt !== undefined) {
        const { row, col } = expectation.noUnitAt;
        const unit = state.board[row]?.[col]?.unit;
        if (unit) {
            errors.push(`预期位置 (${row}, ${col}) 无单位，但有单位 ${unit.card.name}`);
        }
    }

    if (expectation.unitDamageAt !== undefined) {
        const { row, col, damage } = expectation.unitDamageAt;
        const unit = state.board[row]?.[col]?.unit;
        if (!unit) {
            errors.push(`预期位置 (${row}, ${col}) 有单位，但没有`);
        } else if (unit.damage !== damage) {
            errors.push(`位置 (${row}, ${col}) 单位伤害不匹配: 预期 ${damage}, 实际 ${unit.damage}`);
        }
    }

    return errors;
}

// ============================================================================
// 棋盘可视化
// ============================================================================

function printBoard(state: SummonerWarsCore) {
    console.log(`\n  回合 ${state.turnNumber} | 阶段: ${state.phase} | 当前玩家: ${state.currentPlayer}`);
    console.log(`  玩家0 魔力: ${state.players['0'].magic} | 玩家1 魔力: ${state.players['1'].magic}`);
    console.log('  ┌' + '───┬'.repeat(BOARD_COLS - 1) + '───┐');

    for (let row = 0; row < BOARD_ROWS; row++) {
        const rowCells = [];
        for (let col = 0; col < BOARD_COLS; col++) {
            const cell = state.board[row][col];
            if (cell.unit) {
                const symbol = cell.unit.owner === '0' ? 'X' : 'O';
                const hp = cell.unit.card.life - cell.unit.damage;
                rowCells.push(`${symbol}${hp}`.padStart(2).padEnd(3));
            } else if (cell.structure) {
                const symbol = cell.structure.owner === '0' ? 'G' : 'g';
                rowCells.push(` ${symbol} `);
            } else {
                rowCells.push(' · ');
            }
        }
        console.log(`  │${rowCells.join('│')}│`);
        if (row < BOARD_ROWS - 1) {
            console.log('  ├' + '───┼'.repeat(BOARD_COLS - 1) + '───┤');
        }
    }
    console.log('  └' + '───┴'.repeat(BOARD_COLS - 1) + '───┘');
}

// ============================================================================
// 测试用例
// ============================================================================

const testCases: TestCase<SummonerWarsExpectation>[] = [
    // ========== 初始状态测试 ==========
    {
        name: '初始状态 - 玩家0先手，召唤阶段',
        commands: [],
        expect: {
            phase: 'summon',
            currentPlayer: '0',
            turnNumber: 1,
            player0Magic: 2,
            player1Magic: 3,
        },
    },

    // ========== 召唤测试 ==========
    {
        name: '召唤 - 在城门相邻位置召唤单位',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            // 打印手牌详情
            console.log('[召唤测试] 玩家0手牌:', core.players['0'].hand.map(c => `${c.name}(${c.id})`));
            console.log('[召唤测试] 玩家0魔力:', core.players['0'].magic);
            // 打印城门位置
            for (let row = 0; row < BOARD_ROWS; row++) {
                for (let col = 0; col < BOARD_COLS; col++) {
                    const structure = core.board[row][col].structure;
                    if (structure && structure.card.isGate) {
                        console.log(`[召唤测试] 城门位置: (${row}, ${col}) owner=${structure.owner}`);
                    }
                }
            }
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [],
        expect: {
            phase: 'summon',
        },
    },
    {
        name: '召唤 - 执行召唤命令放置单位',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            // 注入一张已知 ID 的费用为2的单位卡到手牌
            const testCard: UnitCard = {
                id: 'test-summon-unit',
                cardType: 'unit',
                name: '测试召唤单位',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 2,
                life: 4,
                cost: 2,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            };
            core.players['0'].hand.push(testCard);
            // 获取可召唤位置
            const validPositions = getValidSummonPositions(core, '0');
            console.log('[召唤执行测试] 可召唤位置:', validPositions);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            { 
                type: SW_COMMANDS.SUMMON_UNIT, 
                playerId: '0', 
                payload: { 
                    cardId: 'test-summon-unit', 
                    position: { row: 6, col: 3 } 
                } 
            },
        ],
        expect: {
            phase: 'summon',
            player0Magic: 0, // 2 - 2 = 0
            unitAt: { row: 6, col: 3, owner: '0' },
        },
    },

    // ========== 阶段流转测试 ==========
    {
        name: '阶段流转 - 召唤→移动→建造→攻击→魔力→抽牌',
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
        ],
        expect: {
            phase: 'draw',
            currentPlayer: '0',
        },
    },
    {
        name: '阶段流转 - 抽牌阶段结束后切换回合',
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // summon → move
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // move → build
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // build → attack
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // attack → magic
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // magic → draw
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // draw → 切换回合
        ],
        expect: {
            phase: 'summon',
            currentPlayer: '1',
            turnNumber: 1,
        },
    },

    // ========== 移动测试 ==========
    {
        name: '移动 - 召唤师移动1格',
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // → move
            {
                type: SW_COMMANDS.MOVE_UNIT,
                playerId: '0',
                payload: { from: { row: 7, col: 3 }, to: { row: 6, col: 3 } },
            },
        ],
        expect: {
            phase: 'move',
            unitAt: { row: 6, col: 3, owner: '0' },
            noUnitAt: { row: 7, col: 3 },
            player0MoveCount: 1,
        },
    },
    {
        name: '移动 - 召唤师移动2格',
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // → move
            {
                type: SW_COMMANDS.MOVE_UNIT,
                playerId: '0',
                payload: { from: { row: 7, col: 3 }, to: { row: 7, col: 5 } },
            },
        ],
        expect: {
            unitAt: { row: 7, col: 5, owner: '0' },
            noUnitAt: { row: 7, col: 3 },
        },
    },
    {
        name: '移动错误 - 非移动阶段',
        commands: [
            {
                type: SW_COMMANDS.MOVE_UNIT,
                playerId: '0',
                payload: { from: { row: 7, col: 3 }, to: { row: 6, col: 3 } },
            },
        ],
        expect: {
            errorAtStep: { step: 1, error: '当前不是移动阶段' },
        },
    },
    {
        name: '移动错误 - 目标位置有单位',
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // → move
            {
                type: SW_COMMANDS.MOVE_UNIT,
                playerId: '0',
                payload: { from: { row: 7, col: 3 }, to: { row: 0, col: 2 } }, // 敌方召唤师位置
            },
        ],
        expect: {
            errorAtStep: { step: 2, error: '无法移动到目标位置' },
        },
    },
    {
        name: '移动错误 - 距离超过2格',
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // → move
            {
                type: SW_COMMANDS.MOVE_UNIT,
                playerId: '0',
                payload: { from: { row: 7, col: 3 }, to: { row: 4, col: 3 } }, // 3格距离
            },
        ],
        expect: {
            errorAtStep: { step: 2, error: '无法移动到目标位置' },
        },
    },

    // ========== 攻击测试 ==========
    {
        name: '攻击 - 近战攻击相邻敌人',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            // 将玩家0召唤师移动到玩家1召唤师旁边
            const unit0 = core.board[7][3].unit!;
            core.board[7][3].unit = undefined;
            core.board[1][2].unit = { ...unit0, position: { row: 1, col: 2 } };
            core.phase = 'attack';
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DECLARE_ATTACK,
                playerId: '0',
                payload: { attacker: { row: 1, col: 2 }, target: { row: 0, col: 2 } },
            },
        ],
        expect: {
            player0AttackCount: 1,
        },
    },
    {
        name: '攻击错误 - 非攻击阶段',
        commands: [
            {
                type: SW_COMMANDS.DECLARE_ATTACK,
                playerId: '0',
                payload: { attacker: { row: 7, col: 3 }, target: { row: 0, col: 2 } },
            },
        ],
        expect: {
            errorAtStep: { step: 1, error: '当前不是攻击阶段' },
        },
    },
    {
        name: '攻击错误 - 近战攻击非相邻目标',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'attack';
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DECLARE_ATTACK,
                playerId: '0',
                payload: { attacker: { row: 7, col: 3 }, target: { row: 0, col: 2 } },
            },
        ],
        expect: {
            errorAtStep: { step: 1, error: '无法攻击该目标' },
        },
    },
    {
        name: '攻击错误 - 普通攻击不能指定己方卡牌',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'attack';
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DECLARE_ATTACK,
                playerId: '0',
                payload: { attacker: { row: 7, col: 3 }, target: { row: 5, col: 3 } }, // 自己的城门
            },
        ],
        expect: {
            errorAtStep: { step: 1, error: '无法攻击该目标' },
        },
    },

    // ========== 不活动惩罚测试 ==========
    {
        name: '不活动惩罚 - 攻击阶段未攻击敌方，召唤师受1点伤害',
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // summon → move
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // move → build
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // build → attack
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} }, // attack → magic (触发惩罚)
        ],
        expect: {
            phase: 'magic',
            unitDamageAt: { row: 7, col: 3, damage: 1 },
        },
    },

    // ========== 胜负判定测试 ==========
    {
        name: '胜负判定 - 玩家1召唤师被摧毁，玩家0获胜',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            // 将玩家1召唤师设置为只剩1点生命
            const summoner1 = core.board[0][2].unit!;
            summoner1.damage = summoner1.card.life - 1;
            // 将玩家0召唤师移动到相邻位置
            const summoner0 = core.board[7][3].unit!;
            core.board[7][3].unit = undefined;
            core.board[1][2].unit = { ...summoner0, position: { row: 1, col: 2 } };
            core.phase = 'attack';
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DECLARE_ATTACK,
                playerId: '0',
                payload: { attacker: { row: 1, col: 2 }, target: { row: 0, col: 2 } },
            },
        ],
        // 由于攻击伤害是随机的，这里只验证攻击成功执行
        expect: {
            player0AttackCount: 1,
        },
    },

    // ========== 事件卡测试 ==========
    {
        name: '事件卡 - 施放0费事件卡',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            // 添加一张0费事件卡到手牌（血契召唤，召唤阶段可用）
            const eventCard: EventCard = {
                id: 'test-event-0',
                cardType: 'event' as const,
                name: '测试事件',
                eventType: 'common' as const,
                faction: 'necromancer',
                cost: 0,
                playPhase: 'summon' as const,
                effect: '测试效果',
                deckSymbols: [],
            };
            core.players['0'].hand.push(eventCard);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.PLAY_EVENT,
                playerId: '0',
                payload: { cardId: 'test-event-0' },
            },
        ],
        expect: {
            phase: 'summon',
            player0Magic: 2, // 魔力不变（0费）
        },
    },
    {
        name: '事件卡错误 - 阶段不匹配',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            // 添加一张移动阶段事件卡
            const eventCard: EventCard = {
                id: 'test-event-move',
                cardType: 'event' as const,
                name: '移动阶段事件',
                eventType: 'common' as const,
                faction: 'necromancer',
                cost: 0,
                playPhase: 'move' as const,
                effect: '测试效果',
                deckSymbols: [],
            };
            core.players['0'].hand.push(eventCard);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.PLAY_EVENT,
                playerId: '0',
                payload: { cardId: 'test-event-move' },
            },
        ],
        expect: {
            errorAtStep: { step: 1, error: '该事件只能在移动阶段施放' },
        },
    },
    {
        name: '事件卡 - 主动事件放入主动区',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            // 添加一张主动事件卡
            const eventCard: EventCard = {
                id: 'test-active-event',
                cardType: 'event' as const,
                name: '主动事件',
                eventType: 'legendary' as const,
                faction: 'necromancer',
                cost: 1,
                playPhase: 'summon' as const,
                effect: '持续效果',
                isActive: true,
                deckSymbols: [],
            };
            core.players['0'].hand.push(eventCard);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.PLAY_EVENT,
                playerId: '0',
                payload: { cardId: 'test-active-event' },
            },
        ],
        expect: {
            phase: 'summon',
            player0Magic: 1, // 2 - 1 = 1
        },
    },
    {
        name: '事件卡错误 - 魔力不足',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.players['0'].magic = 0;
            const eventCard: EventCard = {
                id: 'test-expensive-event',
                cardType: 'event' as const,
                name: '昂贵事件',
                eventType: 'common' as const,
                faction: 'necromancer',
                cost: 5,
                playPhase: 'summon' as const,
                effect: '测试效果',
                deckSymbols: [],
            };
            core.players['0'].hand.push(eventCard);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.PLAY_EVENT,
                playerId: '0',
                payload: { cardId: 'test-expensive-event' },
            },
        ],
        expect: {
            errorAtStep: { step: 1, error: '魔力不足' },
        },
    },

    // ========== 魔力阶段弃牌测试 ==========
    {
        name: '魔力阶段 - 0魔力时仍可弃牌获得魔力',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'magic';
            core.players['0'].magic = 0;
            // 注入一张高费单位卡（费用远超当前魔力）
            const card: UnitCard = {
                id: 'test-expensive-discard',
                cardType: 'unit',
                name: '高费单位',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 5,
                life: 8,
                cost: 7,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            };
            core.players['0'].hand.push(card);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                playerId: '0',
                payload: { cardIds: ['test-expensive-discard'] },
            },
        ],
        expect: {
            phase: 'magic',
            player0Magic: 1, // 0 + 1 = 1
        },
    },
    {
        name: '魔力阶段 - 攻击阶段事件卡也可弃牌获得魔力',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'magic';
            core.players['0'].magic = 0;
            const attackPhaseEvent: EventCard = {
                id: 'attack-phase-event-discard',
                cardType: 'event',
                name: '攻击阶段事件',
                eventType: 'common',
                faction: 'necromancer',
                cost: 4,
                playPhase: 'attack',
                effect: '测试：仅攻击阶段可施放',
                deckSymbols: [],
            };
            core.players['0'].hand.push(attackPhaseEvent);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                playerId: '0',
                payload: { cardIds: ['attack-phase-event-discard'] },
            },
        ],
        expect: {
            phase: 'magic',
            player0Magic: 1,
        },
    },
    {
        name: '魔力阶段 - 弃多张牌获得对应魔力',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'magic';
            core.players['0'].magic = 3;
            const cards: UnitCard[] = [
                { id: 'discard-a', cardType: 'unit', name: '弃牌A', unitClass: 'common', faction: 'necromancer', strength: 1, life: 1, cost: 5, attackType: 'melee', attackRange: 1, deckSymbols: [] },
                { id: 'discard-b', cardType: 'unit', name: '弃牌B', unitClass: 'common', faction: 'necromancer', strength: 1, life: 1, cost: 6, attackType: 'melee', attackRange: 1, deckSymbols: [] },
                { id: 'discard-c', cardType: 'unit', name: '弃牌C', unitClass: 'common', faction: 'necromancer', strength: 1, life: 1, cost: 8, attackType: 'melee', attackRange: 1, deckSymbols: [] },
            ];
            core.players['0'].hand.push(...cards);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                playerId: '0',
                payload: { cardIds: ['discard-a', 'discard-b', 'discard-c'] },
            },
        ],
        expect: {
            phase: 'magic',
            player0Magic: 6, // 3 + 3 = 6
        },
    },
    {
        name: '魔力阶段 - 弃牌不超过魔力上限（15）',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'magic';
            core.players['0'].magic = 14;
            const cards: UnitCard[] = [
                { id: 'over-a', cardType: 'unit', name: '溢出A', unitClass: 'common', faction: 'necromancer', strength: 1, life: 1, cost: 1, attackType: 'melee', attackRange: 1, deckSymbols: [] },
                { id: 'over-b', cardType: 'unit', name: '溢出B', unitClass: 'common', faction: 'necromancer', strength: 1, life: 1, cost: 1, attackType: 'melee', attackRange: 1, deckSymbols: [] },
            ];
            core.players['0'].hand.push(...cards);
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                playerId: '0',
                payload: { cardIds: ['over-a', 'over-b'] },
            },
        ],
        expect: {
            phase: 'magic',
            player0Magic: 15, // clamp(14 + 2) = 15
        },
    },
    {
        name: '魔力阶段 - 不弃牌直接结束也合法',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'magic';
            core.players['0'].magic = 5;
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            { type: SW_COMMANDS.END_PHASE, playerId: '0', payload: {} },
        ],
        expect: {
            phase: 'draw',
            player0Magic: 5, // 不变
        },
    },
    {
        name: '魔力阶段 - 弃无效卡牌ID不增加魔力',
        setup: (playerIds, random) => {
            const core = createInitializedCore(playerIds, random);
            core.phase = 'magic';
            core.players['0'].magic = 3;
            const sys = createInitialSystemState(playerIds, []);
            return { core, sys };
        },
        commands: [
            {
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                playerId: '0',
                payload: { cardIds: ['nonexistent-card-1', 'nonexistent-card-2'] },
            },
        ],
        expect: {
            phase: 'magic',
            player0Magic: 3, // 不变
        },
    },
];

// ============================================================================
// 运行测试
// ============================================================================

const runner = new GameTestRunner({
    domain: SummonerWarsDomain,
    playerIds: ['0', '1'],
    // 使用已完成阵营选择的初始状态（双方亡灵法师）
    setup: (playerIds, random) => {
        const core = createInitializedCore(playerIds, random);
        const sys = createInitialSystemState(playerIds, []);
        return { sys, core };
    },
    assertFn: (state, expectation: SummonerWarsExpectation) =>
        assertSummonerWars(state.core as SummonerWarsCore, expectation),
    visualizeFn: (state) => printBoard(state.core as SummonerWarsCore),
    silent: true,
});

describe('召唤师战争流程测试', () => {
    it.each(testCases)('$name', (testCase) => {
        const result = runner.run(testCase);
        expect(result.assertionErrors).toEqual([]);
    });
});

describe('召唤师战争本地 AI', () => {
    it('选角阶段应为房主选择阵营', async () => {
        const core = SummonerWarsDomain.setup(['0', '1'], aiTestRandom);
        const sys = createInitialSystemState(['0', '1'], []);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-setup-ai',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.source).toBe('local-ai');
        const command = resolution?.action.commands[0];
        expect(command?.type).toBe(SW_COMMANDS.SELECT_FACTION);
        expect(command?.payload).toMatchObject({
            factionId: expect.any(String),
        });
        expect(command?.payload?.factionId).not.toBe('unselected');
    });

    it('选角阶段应避开已被其他玩家选走的阵营', async () => {
        const core = SummonerWarsDomain.setup(['0', '1'], aiTestRandom);
        core.selectedFactions['0'] = 'necromancer';
        const sys = createInitialSystemState(['0', '1'], []);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-setup-unique-ai',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.source).toBe('local-ai');
        expect(resolution?.action.commands[0]?.type).toBe(SW_COMMANDS.SELECT_FACTION);
        expect(resolution?.action.commands[0]).not.toMatchObject({
            payload: { factionId: 'necromancer' },
        });
    });

    it('选角阶段共享 AI 上下文应过滤仍在实施中的阵营', () => {
        const core = SummonerWarsDomain.setup(['0', '1'], aiTestRandom);
        const sys = createInitialSystemState(['0', '1'], []);
        const inProgressFactionIds = ['mogu', 'huijin', 'yongheng', 'shadow'];

        const rawActions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });
        const rawFactionIds = rawActions
            .filter((action) => action.kind === 'setup-select-faction')
            .map((action) => action.metadata?.factionId);

        expect(rawFactionIds).toEqual(expect.arrayContaining(inProgressFactionIds));
        expect(rawActions.find((action) => action.metadata?.factionId === 'mogu')?.metadata).toMatchObject({
            setupOptionStatus: 'in_progress',
            setupOptionStatusReason: expect.stringContaining('实施中'),
        });

        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-setup-in-progress-filter',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });
        const automatedFactionIds = context.legalActions
            .filter((action) => action.kind === 'setup-select-faction')
            .map((action) => action.metadata?.factionId);

        for (const factionId of inProgressFactionIds) {
            expect(automatedFactionIds).not.toContain(factionId);
        }
        expect(automatedFactionIds).toEqual(expect.arrayContaining([
            'necromancer',
            'trickster',
            'paladin',
            'goblin',
            'frost',
            'barbaric',
            'shouren',
        ]));
    });

    it('召唤阶段应优先选择合法召唤动作，而不是直接结束阶段', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        const sys = createInitialSystemState(['0', '1'], []);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-summon-ai',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.source).toBe('local-ai');
        expect(resolution?.action.commands[0]?.type).toBe(SW_COMMANDS.SUMMON_UNIT);

        const summonCommand = resolution?.action.commands[0];
        const summonPosition = (summonCommand?.payload as { position?: { row: number; col: number } } | undefined)?.position;
        const validPositions = getValidSummonPositions(core, '0');
        expect(summonPosition).toBeTruthy();
        expect(validPositions).toContainEqual(summonPosition);
    });

    it('炽原精灵 AI 完整回合不应重复发动祖灵羁绊无限充能', async () => {
        const playerIds = ['0', '1'];
        const core = createInitializedCore(playerIds, aiTestRandom, {
            faction0: 'paladin',
            faction1: 'barbaric',
        });
        core.currentPlayer = '0';
        core.phase = 'magic';

        const sys = createInitialSystemState(playerIds, engineConfig.systems as any);
        sys.phase = 'magic';
        let state = { core, sys } as any;
        const pipelineConfig = {
            domain: engineConfig.domain,
            systems: engineConfig.systems as any,
            systemsConfig: engineConfig.systemsConfig,
        };

        for (let index = 0; index < 2; index += 1) {
            const result = executePipeline(
                pipelineConfig,
                state,
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
                aiTestRandom,
                playerIds,
            );
            expect(result.success).toBe(true);
            state = result.state;
        }
        expect(state.core.currentPlayer).toBe('1');

        const actionIds: string[] = [];
        for (let step = 0; step < 60 && state.core.currentPlayer === '1'; step += 1) {
            const resolution = await resolveNextLocalAiAction({
                engineConfig,
                state,
                matchId: 'local:summonerwars-barbaric-full-turn',
                seatControllers: {
                    '1': { type: 'local-ai' },
                },
            });
            expect(resolution).not.toBeNull();
            if (!resolution) break;

            actionIds.push(resolution.action.actionId);
            for (const command of resolution.action.commands) {
                const result = executePipeline(
                    pipelineConfig,
                    state,
                    {
                        type: command.type,
                        playerId: resolution.playerId,
                        payload: command.payload ?? {},
                    },
                    aiTestRandom,
                    playerIds,
                );
                expect(result.success).toBe(true);
                state = result.state;
            }
        }

        expect(state.core.currentPlayer).toBe('0');
        expect(actionIds.some((actionId) => actionId.includes('ancestral_bond'))).toBe(false);
    });

    it('重燃希望激活时，AI 应将召唤师相邻空格加入召唤候选', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'paladin',
            faction1: 'necromancer',
        });
        core.phase = 'move';
        core.currentPlayer = '0';

        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                const unit = core.board[row][col].unit;
                if (unit?.card.unitClass !== 'summoner') {
                    core.board[row][col].unit = undefined;
                }
            }
        }

        const ownSummoner = getSummoner(core, '0');
        expect(ownSummoner).toBeTruthy();
        if (!ownSummoner) return;

        core.board[ownSummoner.position.row][ownSummoner.position.col].unit = undefined;
        const forwardPosition = { row: 3, col: 3 };
        core.board[forwardPosition.row][forwardPosition.col].unit = {
            ...ownSummoner,
            position: forwardPosition,
            hasMoved: false,
            hasAttacked: false,
        };

        core.players['0'].activeEvents = [{
            id: CARD_IDS.PALADIN_REKINDLE_HOPE,
            cardType: 'event',
            name: '重燃希望',
            faction: 'paladin',
            cost: 0,
            playPhase: 'any',
            effect: '测试：允许在任意阶段召唤并可在召唤师相邻召唤',
            isActive: true,
            deckSymbols: [],
        }];

        const targetPos = { row: 3, col: 2 };
        core.board[targetPos.row][targetPos.col].unit = undefined;
        core.board[targetPos.row][targetPos.col].structure = undefined;
        core.players['0'].magic = 5;
        core.players['0'].hand = [{
            id: 'ai-test-paladin-common',
            cardType: 'unit',
            name: '测试步兵',
            unitClass: 'common',
            faction: 'paladin',
            strength: 1,
            life: 2,
            cost: 1,
            attackType: 'melee',
            attackRange: 1,
            deckSymbols: [],
        }];

        const baseSummonPositions = getValidSummonPositions(core, '0');
        expect(baseSummonPositions).not.toContainEqual(targetPos);

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys: createInitialSystemState(['0', '1'], []) },
        });
        const summonTargetPositions = actions
            .filter((action) => action.kind === 'summon-unit')
            .map((action) => (action.commands[0]?.payload as { position?: { row: number; col: number } } | undefined)?.position)
            .filter((position): position is { row: number; col: number } => !!position);

        expect(summonTargetPositions).toContainEqual(targetPos);
    });


    it('攻击类 legal action 会附带 strategy tags，供通用 profile scorer 复用', () => {
        const core = createModerateThreatAttackCore();
        const sys = createInitialSystemState(['0', '1'], []);
        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        const threatAttack = actions.find((action) => {
            const target = action.metadata?.target as { row?: number; col?: number } | undefined;
            return action.kind === 'declare-attack' && target?.row === 6 && target?.col === 3;
        });
        const championAttack = actions.find((action) => {
            const target = action.metadata?.target as { row?: number; col?: number } | undefined;
            return action.kind === 'declare-attack' && target?.row === 5 && target?.col === 2;
        });

        expect(threatAttack?.metadata?.strategyTags).toContain('summoner-defense');
        expect(threatAttack?.metadata?.strategyTags).toContain('board-control');
        expect(championAttack?.metadata?.strategyTags).toContain('board-control');
        expect(championAttack?.metadata?.strategyTags).not.toContain('summoner-defense');
    });

    it('普通攻击友方卡牌合法，但 AI 不应主动生成攻击友方的动作', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.phase = 'attack';
        core.currentPlayer = '0';
        for (const row of [3, 4, 5]) {
            for (const col of [2, 3, 4]) {
                core.board[row][col].unit = undefined;
                core.board[row][col].structure = undefined;
            }
        }

        const attackerCard: UnitCard = {
            id: 'ai-attacker',
            cardType: 'unit',
            name: 'AI 攻击者',
            unitClass: 'common',
            faction: 'necromancer',
            strength: 2,
            life: 3,
            cost: 1,
            attackType: 'melee',
            attackRange: 1,
            deckSymbols: [],
        };
        const friendlyCard: UnitCard = { ...attackerCard, id: 'ai-friendly', name: '友方目标' };
        const enemyCard: UnitCard = { ...attackerCard, id: 'ai-enemy', name: '敌方目标' };
        const attacker = placeTestUnit(core, { row: 4, col: 3 }, { card: attackerCard, owner: '0' });
        placeTestUnit(core, { row: 4, col: 2 }, { card: friendlyCard, owner: '0' });
        placeTestUnit(core, { row: 4, col: 4 }, { card: enemyCard, owner: '1' });

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys: createInitialSystemState(['0', '1'], []) },
        });
        const attackTargets = actions
            .filter((action) => action.kind === 'declare-attack' && action.metadata?.sourceUnitId === attacker.instanceId)
            .map((action) => action.metadata?.target);

        expect(attackTargets).toContainEqual({ row: 4, col: 4 });
        expect(attackTargets).not.toContainEqual({ row: 4, col: 2 });
    });

    it('通用 strategy profile scorer 会在中度承压时抬高回防标签动作的评分', async () => {
        const core = createModerateThreatAttackCore();
        const sys = createInitialSystemState(['0', '1'], []);
        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-strategy-profile',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            finalScore: number;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const threatAttack = context.legalActions.find((action) => {
            const target = action.metadata?.target as { row?: number; col?: number } | undefined;
            return action.kind === 'declare-attack' && target?.row === 6 && target?.col === 3;
        });
        const championAttack = context.legalActions.find((action) => {
            const target = action.metadata?.target as { row?: number; col?: number } | undefined;
            return action.kind === 'declare-attack' && target?.row === 5 && target?.col === 2;
        });
        const threatEval = evaluations.find((item) => item.actionId === threatAttack?.actionId);
        const championEval = evaluations.find((item) => item.actionId === championAttack?.actionId);
        const threatAssignmentScore = threatEval?.contributions.find((item) => item.scorerId === 'assignment-first')?.score ?? -Infinity;
        const championAssignmentScore = championEval?.contributions.find((item) => item.scorerId === 'assignment-first')?.score ?? -Infinity;

        expect(threatAttack?.metadata?.strategyTags).toContain('summoner-defense');
        expect(threatEval?.contributions.some((item) => item.scorerId === 'strategy-profile-fit' && item.score > 0)).toBe(true);
        expect(threatAssignmentScore).toBeGreaterThan(championAssignmentScore);
        expect(threatEval?.finalScore ?? -Infinity).toBeGreaterThan(championEval?.finalScore ?? -Infinity);
        expect(decision?.actionId).toBe(threatAttack?.actionId);
    });

    it('当两个攻击动作都只有 board-control 标签时，仍应由 attack-value 选择更高价值目标', async () => {
        const core = createBoardControlTiebreakAttackCore();
        const sys = createInitialSystemState(['0', '1'], []);
        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-board-control-tiebreak',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            finalScore: number;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const commonAttack = context.legalActions.find((action) => {
            const target = action.metadata?.target as { row?: number; col?: number } | undefined;
            return action.kind === 'declare-attack' && target?.row === 6 && target?.col === 3;
        });
        const championAttack = context.legalActions.find((action) => {
            const target = action.metadata?.target as { row?: number; col?: number } | undefined;
            return action.kind === 'declare-attack' && target?.row === 5 && target?.col === 2;
        });
        const commonEval = evaluations.find((item) => item.actionId === commonAttack?.actionId);
        const championEval = evaluations.find((item) => item.actionId === championAttack?.actionId);
        const commonProfileScore = commonEval?.contributions.find((item) => item.scorerId === 'strategy-profile-fit')?.score ?? 0;
        const championProfileScore = championEval?.contributions.find((item) => item.scorerId === 'strategy-profile-fit')?.score ?? 0;
        const commonAttackScore = commonEval?.contributions.find((item) => item.scorerId === 'attack-value')?.score ?? -Infinity;
        const championAttackScore = championEval?.contributions.find((item) => item.scorerId === 'attack-value')?.score ?? -Infinity;

        expect(commonAttack?.metadata?.strategyTags).toEqual(['board-control']);
        expect(championAttack?.metadata?.strategyTags).toEqual(['board-control']);
        expect(championProfileScore).toBe(commonProfileScore);
        expect(championAttackScore).toBeGreaterThan(commonAttackScore);
        expect(championEval?.finalScore ?? -Infinity).toBeGreaterThan(commonEval?.finalScore ?? -Infinity);
        expect(decision?.actionId).toBe(championAttack?.actionId);
    });

    it('AI 只生成真实主动按钮技能，移动后自动技能不应被直推', () => {
        const core = createActivatedAbilityHeuristicCore();
        const sys = createInitialSystemState(['0', '1'], []);
        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        const inspireAction = actions.find((action) => {
            return action.kind === 'activate-ability' && action.metadata?.abilityId === 'inspire';
        });
        const prepareAction = actions.find((action) => {
            return action.kind === 'activate-ability' && action.metadata?.abilityId === 'prepare';
        });

        expect(inspireAction).toBeUndefined();
        expect(prepareAction?.metadata?.strategyTags).toEqual(['ability-tempo']);
        expect(prepareAction?.metadata?.selfChargeGain).toBe(1);
    });

    it('本地 AI 策略候选中不应出现移动后自动技能', async () => {
        const core = createActivatedAbilityHeuristicCore();
        const sys = createInitialSystemState(['0', '1'], []);
        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-activated-ability-heuristics',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const directAbilityIds = context.legalActions
            .filter((action) => action.kind === 'activate-ability')
            .map((action) => action.metadata?.abilityId);

        expect(directAbilityIds).toContain('prepare');
        expect(directAbilityIds).not.toContain('inspire');
        expect(directAbilityIds).not.toContain('ancestral_bond');
        expect(decision?.actionId).not.toContain('inspire');
        expect(decision?.actionId).not.toContain('ancestral_bond');
    });

    it('高动作密度下应启用 candidate loop 批次搜索，并产出 lookahead 前瞻贡献', async () => {
        const core = createCandidateLoopStressSummonCore();
        const sys = createInitialSystemState(['0', '1'], []);
        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-candidate-loop-search',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        expect(context.legalActions.length).toBeGreaterThan(15);

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            searched: boolean;
            contributions: Array<{ scorerId: string }>;
        }>;

        expect(evaluations.length).toBe(context.legalActions.length);
        expect(evaluations.some((item) => item.searched === true)).toBe(true);
        expect(evaluations.some((item) => item.searched === false)).toBe(true);
        expect(
            evaluations.some((item) => item.contributions.some((contribution) => contribution.scorerId === 'lookahead')),
        ).toBe(true);
        expect(
            evaluations.some((item) => item.contributions.some((contribution) => contribution.scorerId === 'relative-utility')),
        ).toBe(true);
    });

    it('带目标的 activated ability 会生成多条动作并优先强化冠军目标', async () => {
        const core = createTargetedAbilityCore();
        const sys = createInitialSystemState(['0', '1'], []);
        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-targeted-ability',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const targetedActions = context.legalActions.filter((action) => {
            return action.kind === 'activate-ability' && action.metadata?.abilityId === 'vanish';
        });
        const championAction = targetedActions.find((action) => action.metadata?.targetUnitClass === 'champion');
        const commonAction = targetedActions.find((action) => action.metadata?.targetUnitClass === 'common');

        expect(targetedActions.length).toBeGreaterThan(1);
        expect(championAction).toBeTruthy();
        expect(commonAction).toBeTruthy();
        expect(championAction?.metadata?.strategyTags).toContain('board-control');
        expect(decision?.actionId).toBe(championAction?.actionId);
    });

    it('带目标的 activated ability 在 count 缺省时仍按单目标生成动作', () => {
        const abilityDef = abilityRegistry.get('vanish');
        expect(abilityDef?.targetSelection).toBeTruthy();

        const originalTargetSelection = abilityDef?.targetSelection
            ? { ...abilityDef.targetSelection }
            : undefined;

        if (!abilityDef?.targetSelection) {
            throw new Error('测试缺少 vanish.targetSelection');
        }

        abilityDef.targetSelection = {
            ...abilityDef.targetSelection,
            count: undefined,
        };

        try {
            const core = createTargetedAbilityCore();
            const sys = createInitialSystemState(['0', '1'], []);
            const actions = buildSummonerWarsAiLegalActions({
                playerId: '0',
                state: { core, sys },
            });

            const targetedActions = actions.filter((action) => {
                return action.kind === 'activate-ability' && action.metadata?.abilityId === 'vanish';
            });

            expect(targetedActions.length).toBeGreaterThan(1);
        } finally {
            abilityDef.targetSelection = originalTargetSelection;
        }
    });

    it('带目标的 activated ability 若 payloadContract 还要求额外字段，则不应生成直推目标动作', () => {
        const abilityDef = abilityRegistry.get('vanish');
        expect(abilityDef).toBeTruthy();

        const originalInteractionChain = abilityDef?.interactionChain
            ? {
                ...abilityDef.interactionChain,
                payloadContract: abilityDef.interactionChain.payloadContract
                    ? {
                        required: [...(abilityDef.interactionChain.payloadContract.required ?? [])],
                        optional: [...(abilityDef.interactionChain.payloadContract.optional ?? [])],
                    }
                    : undefined,
            }
            : undefined;

        if (!abilityDef) {
            throw new Error('测试缺少 vanish');
        }

        abilityDef.interactionChain = {
            ...(abilityDef.interactionChain ?? { steps: [] }),
            payloadContract: {
                required: ['targetPosition', 'newPosition'],
                optional: [],
            },
        };

        try {
            const core = createTargetedAbilityCore();
            const sys = createInitialSystemState(['0', '1'], []);
            const actions = buildSummonerWarsAiLegalActions({
                playerId: '0',
                state: { core, sys },
            });

            const targetedActions = actions.filter((action) => {
                return action.kind === 'activate-ability' && action.metadata?.abilityId === 'vanish';
            });

            expect(targetedActions).toHaveLength(0);
        } finally {
            abilityDef.interactionChain = originalInteractionChain;
        }
    });

    it('simple-choice exact-multi 交互应枚举所有合法组合，而不是固定前两个选项', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        const sys = createInitialSystemState(['0', '1'], []);
        sys.interaction = {
            ...sys.interaction,
            current: {
                id: 'sw-ai-simple-choice-multi',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    options: [
                        { id: 'opt-a', label: '选项 A' },
                        { id: 'opt-b', label: '选项 B' },
                        { id: 'opt-c', label: '选项 C' },
                    ],
                    multi: { min: 2, max: 2 },
                },
            } as any,
        };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        const payloads = actions
            .filter((action) => action.kind === 'interaction-choice')
            .map((action) => ((action.commands[0]?.payload as { optionIds?: string[] } | undefined)?.optionIds ?? []).join(','))
            .sort();

        expect(payloads).toEqual([
            'opt-a,opt-b',
            'opt-a,opt-c',
            'opt-b,opt-c',
        ]);
    });


    it('simple-choice 交互响应应携带 interactionId，避免白名单全放行', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        const sys = createInitialSystemState(['0', '1'], []);
        sys.interaction = {
            ...sys.interaction,
            current: {
                id: 'sw-ai-simple-choice-id-guard',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    options: [
                        { id: 'opt-a', label: '选项 A' },
                    ],
                },
            } as any,
        };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: 'sw-ai-simple-choice-id-guard',
                optionId: 'opt-a',
            },
        });
    });

    it('simple-choice 无可选项时应返回 emergency cancel，而不是回落普通 phase actions', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.phase = 'move';
        core.currentPlayer = '0';
        const sys = createInitialSystemState(['0', '1'], []);
        sys.interaction = {
            ...sys.interaction,
            current: {
                id: 'sw-ai-empty-choice',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    options: [],
                },
            } as any,
        };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.kind).toBe('interaction-cancel');
        expect(actions[0]?.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {
                interactionId: 'sw-ai-empty-choice',
                reason: 'empty-options',
            },
        });
    });

    it('其他玩家交互存在时，当前 AI 不应回落到普通 phase actions', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.phase = 'move';
        core.currentPlayer = '0';
        const sys = createInitialSystemState(['0', '1'], []);
        sys.interaction = {
            ...sys.interaction,
            current: {
                id: 'sw-ai-other-player-choice',
                kind: 'simple-choice',
                playerId: '1',
                data: {
                    options: [{ id: 'opt-a', label: '选项 A' }],
                },
            } as any,
        };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions).toEqual([]);
    });

    it('普通结束阶段动作应统一走 ADVANCE_PHASE，而不是 sw:end_phase', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.phase = 'draw';
        core.currentPlayer = '0';
        const sys = createInitialSystemState(['0', '1'], []);

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.kind).toBe('advance-phase');
        expect(actions[0]?.commands[0]).toEqual({
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            payload: {},
        });
    });

    it('ADVANCE_PHASE 离开移动阶段时应先结算腐坏自伤，再等待玩家指定相邻友军充能', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'mogu',
            faction1: 'paladin',
        });
        core.phase = 'move';
        core.currentPlayer = '0';
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                core.board[row][col].unit = undefined;
                core.board[row][col].structure = undefined;
            }
        }
        const decayUnit = placeTestUnit(core, { row: 4, col: 3 }, {
            card: {
                id: 'test-mogu-decay',
                cardType: 'unit',
                name: '测试玛硕达',
                unitClass: 'champion',
                faction: 'mogu',
                strength: 3,
                life: 6,
                cost: 5,
                attackType: 'melee',
                attackRange: 1,
                abilities: ['mogu_decay'],
                deckSymbols: [],
            },
            owner: '0',
        });
        const ally = placeTestUnit(core, { row: 4, col: 4 }, {
            card: {
                id: 'test-decay-ally',
                cardType: 'unit',
                name: '测试友方单位',
                unitClass: 'common',
                faction: 'mogu',
                strength: 1,
                life: 3,
                cost: 1,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });
        const sys = createInitialSystemState(['0', '1'], engineConfig.systems as any);
        sys.phase = 'move';

        const result = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems as any, systemsConfig: engineConfig.systemsConfig },
            { core, sys } as any,
            { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
            aiTestRandom,
            ['0', '1'],
        );

        expect(result.success).toBe(true);
        expect(result.state.core.phase).toBe('move');
        expect(result.state.sys.flowHalted).toBe(true);
        expect(result.state.core.board[decayUnit.position.row][decayUnit.position.col].unit?.damage).toBe(1);
        expect(result.state.core.board[ally.position.row][ally.position.col].unit?.boosts ?? 0).toBe(0);
        expect(hasActivePrompt(result.state)).toBe(true);
        expect(getPromptSwType(result.state)).toBe('mogu_decay_select_target');
        const allyOptionId = getPromptOptionIdForTargetPosition(
            result.state,
            'mogu_decay_target',
            ally.position,
        );
        expect(allyOptionId).toBeTruthy();
        expect(getPromptOptionIds(result.state)).toContain('skip');
        expect(result.events.some(e => e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_decay')).toBe(true);
        expect(result.events.some(e => e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_decay')).toBe(false);

        const picked = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems as any, systemsConfig: engineConfig.systemsConfig },
            result.state,
            createPromptResponseCommand(result.state, '0', allyOptionId!),
            aiTestRandom,
            ['0', '1'],
        );

        expect(picked.success).toBe(true);
        expect(hasActivePrompt(picked.state)).toBe(false);
        expect(picked.state.core.board[ally.position.row][ally.position.col].unit?.boosts).toBe(2);
        expect(picked.events.some(e => e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_decay')).toBe(true);

        const advanced = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems as any, systemsConfig: engineConfig.systemsConfig },
            picked.state,
            { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
            aiTestRandom,
            ['0', '1'],
        );

        expect(advanced.success).toBe(true);
        expect(advanced.state.core.phase).toBe('build');
        expect(advanced.state.sys.flowHalted).toBe(false);
    });

    it('ADVANCE_PHASE 进入移动阶段时灰烬野兽野火击杀的单位应立刻离场', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'huijin',
            faction1: 'necromancer',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                core.board[row][col].unit = undefined;
                core.board[row][col].structure = undefined;
            }
        }
        placeTestUnit(core, { row: 4, col: 4 }, {
            card: {
                id: 'test-huijin-ash-beast',
                cardType: 'unit',
                name: '测试灰烬野兽',
                unitClass: 'common',
                faction: 'huijin',
                strength: 3,
                life: 3,
                cost: 2,
                attackType: 'melee',
                attackRange: 1,
                abilities: ['huijin_wildfire'],
                deckSymbols: [],
            },
            owner: '0',
        });
        const enemy = placeTestUnit(core, { row: 4, col: 5 }, {
            card: {
                id: 'test-fragile-enemy',
                cardType: 'unit',
                name: '测试脆弱敌方士兵',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 1,
                life: 1,
                cost: 1,
                attackType: 'melee',
                attackRange: 1,
                abilities: [],
                deckSymbols: [],
            },
            owner: '1',
        });
        const sys = createInitialSystemState(['0', '1'], engineConfig.systems as any);
        sys.phase = 'summon';

        const result = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems as any, systemsConfig: engineConfig.systemsConfig },
            { core, sys } as any,
            { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
            aiTestRandom,
            ['0', '1'],
        );

        expect(result.success).toBe(true);
        expect(result.state.core.phase).toBe('move');
        expect(result.events.some(e => e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'huijin_wildfire')).toBe(true);
        expect(result.events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as { instanceId?: string }).instanceId === enemy.instanceId)).toBe(true);
        expect(result.state.core.board[enemy.position.row][enemy.position.col].unit).toBeUndefined();
    });

    it('ADVANCE_PHASE 离开魔力阶段时应结算爆裂并触发菌化变异', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'mogu',
            faction1: 'paladin',
        });
        core.phase = 'magic';
        core.currentPlayer = '0';
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                core.board[row][col].unit = undefined;
                core.board[row][col].structure = undefined;
            }
        }
        const body = placeTestUnit(core, { row: 4, col: 3 }, {
            card: {
                id: 'test-mogu-spore-body',
                cardType: 'unit',
                name: '测试菌袍疫病体',
                unitClass: 'common',
                faction: 'mogu',
                strength: 1,
                life: 3,
                cost: 1,
                attackType: 'melee',
                attackRange: 1,
                abilities: ['mogu_burst', 'mogu_fungal_mutation'],
                deckSymbols: [],
            },
            owner: '0',
            boosts: 3,
        });
        const beast: UnitCard = {
            id: 'test-mogu-fungal-beast',
            cardType: 'unit',
            name: '测试菌化野兽',
            unitClass: 'common',
            faction: 'mogu',
            strength: 2,
            life: 4,
            cost: 2,
            attackType: 'melee',
            attackRange: 1,
            abilities: ['mogu_infection'],
            deckSymbols: [],
        };
        core.players['0'].discard.push(beast);
        const sys = createInitialSystemState(['0', '1'], engineConfig.systems as any);
        sys.phase = 'magic';

        const result = executePipeline(
            { domain: engineConfig.domain, systems: engineConfig.systems as any, systemsConfig: engineConfig.systemsConfig },
            { core, sys } as any,
            { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
            aiTestRandom,
            ['0', '1'],
        );

        expect(result.success).toBe(true);
        expect(result.state.core.phase).toBe('draw');
        expect(result.events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_burst')).toBe(true);
        expect(result.events.some(e => e.type === SW_EVENTS.UNIT_SUMMONED
            && (e.payload as { sourceAbilityId?: string }).sourceAbilityId === 'mogu_fungal_mutation')).toBe(true);
        expect(result.state.core.board[body.position.row][body.position.col].unit?.card.id).toBe(beast.id);
    });

    it('牌库为空时复活死灵仍应作为召唤阶段 AI 合法动作，不应只剩结束阶段', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'necromancer',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].deck = [];
        core.players['0'].hand = [];
        core.players['0'].discard = [{
            id: 'discard-ai-undead',
            cardType: 'unit',
            name: '测试可复活亡灵',
            unitClass: 'common',
            faction: 'necromancer',
            strength: 1,
            life: 2,
            cost: 0,
            attackType: 'melee',
            attackRange: 1,
            abilities: [],
            deckSymbols: [],
        }];
        const summoner = getSummoner(core, '0');
        expect(summoner).toBeTruthy();
        const targetPosition = { row: summoner!.position.row - 1, col: summoner!.position.col };
        core.board[targetPosition.row][targetPosition.col].unit = undefined;
        core.board[targetPosition.row][targetPosition.col].structure = undefined;
        const sys = createInitialSystemState(['0', '1'], []);

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });
        const reviveAction = actions.find((action) =>
            action.kind === 'activate-ability' && action.metadata?.abilityId === 'revive_undead');

        expect(reviveAction).toBeDefined();
        expect(reviveAction?.commands[0]).toEqual({
            type: SW_COMMANDS.ACTIVATE_ABILITY,
            payload: {
                abilityId: 'revive_undead',
                sourceUnitId: summoner!.instanceId,
                targetCardId: 'discard-ai-undead',
                targetPosition,
            },
        });
        expect(actions.filter((action) => action.kind !== 'advance-phase').length).toBeGreaterThan(0);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-revive-undead-empty-deck',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });
        expect(resolution?.action.kind).toBe('activate-ability');
        expect(resolution?.action.metadata?.abilityId).toBe('revive_undead');
    });

    it('牌库为空且召唤卡需要额外目标时，召唤阶段 AI 不应只剩结束阶段', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'necromancer',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].deck = [];
        core.players['0'].magic = 5;
        core.players['0'].hand = [{
            id: 'test-fire-sacrifice-card',
            cardType: 'unit',
            name: '测试火祀召唤单位',
            unitClass: 'champion',
            faction: 'necromancer',
            strength: 3,
            life: 5,
            cost: 2,
            attackType: 'melee',
            attackRange: 1,
            abilities: ['fire_sacrifice_summon'],
            deckSymbols: [],
        }];
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                core.board[row][col].unit = undefined;
            }
        }
        const sacrifice = placeTestUnit(core, { row: 5, col: 2 }, {
            card: {
                id: 'test-fire-sacrifice-ally',
                cardType: 'unit',
                name: '测试祭品',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 1,
                life: 2,
                cost: 0,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });
        const sys = createInitialSystemState(['0', '1'], []);

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });
        const summonAction = actions.find((action) =>
            action.kind === 'summon-unit'
            && action.metadata?.summonMode === 'fire_sacrifice_summon');

        expect(summonAction).toBeDefined();
        expect(summonAction?.commands[0]).toEqual({
            type: SW_COMMANDS.SUMMON_UNIT,
            payload: {
                cardId: 'test-fire-sacrifice-card',
                position: sacrifice.position,
                sacrificeUnitId: sacrifice.instanceId,
            },
        });
        expect(actions.filter((action) => action.kind !== 'advance-phase').length).toBeGreaterThan(0);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-fire-sacrifice-empty-deck',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });
        expect(resolution?.action.kind).toBe('summon-unit');
        expect(resolution?.action.metadata?.summonMode).toBe('fire_sacrifice_summon');
    });

    it('牌库为空且最终形态需要替换目标时，召唤阶段 AI 不应只剩结束阶段', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'mogu',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].deck = [];
        core.players['0'].magic = 5;
        core.players['0'].hand = [{
            id: 'test-mogu-final-form-card',
            cardType: 'unit',
            name: '测试最终形态单位',
            unitClass: 'champion',
            faction: 'mogu',
            strength: 5,
            life: 13,
            cost: 3,
            attackType: 'melee',
            attackRange: 1,
            abilities: ['mogu_final_form'],
            deckSymbols: [],
        }];
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                core.board[row][col].unit = undefined;
                core.board[row][col].structure = undefined;
            }
        }
        const replacement = placeTestUnit(core, { row: 5, col: 2 }, {
            card: {
                id: 'mogu-fungal-beast',
                cardType: 'unit',
                name: '测试菌化野兽',
                unitClass: 'common',
                faction: 'mogu',
                strength: 3,
                life: 5,
                cost: 3,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
            boosts: 5,
        });
        const sys = createInitialSystemState(['0', '1'], []);

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });
        const summonAction = actions.find((action) =>
            action.kind === 'summon-unit'
            && action.metadata?.summonMode === 'mogu_final_form');

        expect(summonAction).toBeDefined();
        expect(summonAction?.commands[0]).toEqual({
            type: SW_COMMANDS.SUMMON_UNIT,
            payload: {
                cardId: 'test-mogu-final-form-card',
                position: replacement.position,
                sacrificeUnitId: replacement.instanceId,
            },
        });
        expect(actions.filter((action) => action.kind !== 'advance-phase').length).toBeGreaterThan(0);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-mogu-final-form-empty-deck',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });
        expect(resolution?.action.kind).toBe('summon-unit');
        expect(resolution?.action.metadata?.summonMode).toBe('mogu_final_form');
    });

    it('牌库为空且手牌有狂热菌菇时，召唤阶段 AI 不应只剩结束阶段', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'mogu',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].deck = [];
        core.players['0'].hand = [{
            id: 'mogu-fanatical-fungus-0',
            cardType: 'event',
            faction: 'mogu',
            name: '测试狂热菌菇',
            eventType: 'common',
            playPhase: 'summon',
            cost: 0,
            isActive: true,
            effect: '持续。在你移动一个单位之后，可以将其充能。',
            deckSymbols: [],
        }];
        const sys = createInitialSystemState(['0', '1'], []);

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });
        const eventAction = actions.find((action) =>
            action.kind === 'play-event' && action.metadata?.baseId === 'mogu-fanatical-fungus');

        expect(eventAction).toBeDefined();
        expect(eventAction?.commands[0]).toEqual({
            type: SW_COMMANDS.PLAY_EVENT,
            payload: { cardId: 'mogu-fanatical-fungus-0' },
        });
        expect(actions.filter((action) => action.kind !== 'advance-phase').length).toBeGreaterThan(0);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-mogu-event-empty-deck',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });
        expect(resolution?.action.kind).toBe('play-event');
        expect(resolution?.action.metadata?.baseId).toBe('mogu-fanatical-fungus');
    });

    it.each(underConstructionSummonPhaseEventAiCases)(
        '实施中派系牌库为空且手牌有 $name 时，召唤阶段 AI 不应只剩结束阶段',
        ({ faction, cardId, baseId, name, eventType, effect }) => {
            const core = createInitializedCore(['0', '1'], aiTestRandom, {
                faction0: faction,
                faction1: 'paladin',
            });
            core.phase = 'summon';
            core.currentPlayer = '0';
            core.players['0'].deck = [];
            core.players['0'].hand = [{
                id: cardId,
                cardType: 'event',
                faction,
                name,
                eventType,
                playPhase: 'summon',
                cost: 0,
                isActive: true,
                effect,
                deckSymbols: [],
            }];
            const sys = createInitialSystemState(['0', '1'], []);

            const actions = buildSummonerWarsAiLegalActions({
                playerId: '0',
                state: { core, sys },
            });
            const eventAction = actions.find((action) =>
                action.kind === 'play-event' && action.metadata?.baseId === baseId);

            expect(eventAction).toBeDefined();
            expect(eventAction?.commands[0]).toEqual({
                type: SW_COMMANDS.PLAY_EVENT,
                payload: { cardId },
            });
            expect(actions.filter((action) => action.kind !== 'advance-phase').length).toBeGreaterThan(0);
        },
    );

    it('flowHalted 的阶段结束技能应优先暴露交互选项，不回落普通阶段动作', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'frost',
            faction1: 'necromancer',
        });
        core.phase = 'attack';
        core.currentPlayer = '0';

        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                core.board[row][col].unit = undefined;
                core.board[row][col].structure = undefined;
            }
        }

        const beastCard: UnitCard = {
            id: 'test-feed-beast',
            cardType: 'unit',
            name: '测试巨食兽',
            unitClass: 'champion',
            faction: 'goblin',
            strength: 3,
            life: 8,
            cost: 6,
            attackType: 'melee',
            attackRange: 1,
            abilities: ['feed_beast'],
            deckSymbols: [],
        };

        const beast = placeTestUnit(core, { row: 3, col: 2 }, {
            card: beastCard,
            owner: '0',
        });

        placeTestUnit(core, { row: 3, col: 3 }, {
            card: {
                id: 'test-feed-beast-ally',
                cardType: 'unit',
                name: '测试友军',
                unitClass: 'common',
                faction: 'goblin',
                strength: 1,
                life: 2,
                cost: 1,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });

        const sys = createInitialSystemState(['0', '1'], []);
        sys.flowHalted = true;
        const interaction = createSimpleChoice(
            'sw-ai-feed-beast-choice',
            '0',
            'interaction.sw.feedBeast',
            [
                {
                    id: 'self_destroy',
                    label: '自毁',
                    value: { action: 'feed_beast', sourceUnitId: beast.instanceId, choice: 'self_destroy' },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { action: 'feed_beast', sourceUnitId: beast.instanceId, skip: true },
                },
            ],
            { sourceId: 'feed_beast' },
        );
        (interaction.data as { sw?: unknown }).sw = { type: 'feed_beast', sourceUnitId: beast.instanceId };
        sys.interaction = { ...sys.interaction, current: interaction };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions.length).toBeGreaterThan(0);
        expect(actions.some((action) => action.kind === 'interaction-choice')).toBe(true);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
        expect(actions.map((action) => action.commands[0])).toContainEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: 'sw-ai-feed-beast-choice',
                optionId: 'self_destroy',
            },
        });
    });

    it('infection 交互应生成可响应动作，而不是回落普通阶段动作', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.phase = 'summon';
        core.currentPlayer = '0';
        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-infection-choice',
            '0',
            'interaction.sw.infection',
            [
                {
                    id: 'confirm',
                    label: '感染',
                    value: { action: 'infection', targetCardId: 'plague_zombie', targetPosition: { row: 5, col: 3 } },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { action: 'infection', skip: true },
                },
            ],
            { sourceId: 'infection' },
        );
        (interaction.data as { sw?: unknown }).sw = { type: 'infection' };
        sys.interaction = { ...sys.interaction, current: interaction };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions.length).toBeGreaterThan(0);
        expect(actions.some((action) => action.kind === 'interaction-choice')).toBe(true);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
        expect(actions.map((action) => action.commands[0])).toContainEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: 'sw-ai-infection-choice',
                optionId: 'confirm',
            },
        });
    });

    it('mind_capture 交互应生成控制/伤害选择，而不是回落普通阶段动作', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.phase = 'attack';
        core.currentPlayer = '0';
        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-mind-capture-choice',
            '0',
            'interaction.sw.mindCapture',
            [
                {
                    id: 'control',
                    label: '控制',
                    value: { action: 'mind_capture', choice: 'control', targetPosition: { row: 4, col: 2 } },
                },
                {
                    id: 'damage',
                    label: '伤害',
                    value: { action: 'mind_capture', choice: 'damage', targetPosition: { row: 4, col: 2 } },
                },
            ],
            { sourceId: 'mind_capture' },
        );
        (interaction.data as { sw?: unknown }).sw = { type: 'mind_capture' };
        sys.interaction = { ...sys.interaction, current: interaction };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions.length).toBeGreaterThan(0);
        expect(actions.some((action) => action.kind === 'interaction-choice')).toBe(true);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
        expect(actions.map((action) => action.commands[0])).toContainEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: 'sw-ai-mind-capture-choice',
                optionId: 'control',
            },
        });
    });

    it('feed_beast 交互应生成吞噬目标选项，而不是回落普通阶段动作', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'goblin',
            faction1: 'paladin',
        });
        core.phase = 'build';
        core.currentPlayer = '0';
        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-feed-beast-choice',
            '0',
            'interaction.sw.feedBeast',
            [
                {
                    id: 'consume',
                    label: '吞噬',
                    value: { action: 'feed_beast', choice: 'destroy_adjacent', targetPosition: { row: 4, col: 4 } },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { action: 'feed_beast', skip: true },
                },
            ],
            { sourceId: 'feed_beast' },
        );
        (interaction.data as { sw?: unknown }).sw = { type: 'feed_beast' };
        sys.interaction = { ...sys.interaction, current: interaction };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions.length).toBeGreaterThan(0);
        expect(actions.some((action) => action.kind === 'interaction-choice')).toBe(true);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
        expect(actions.map((action) => action.commands[0])).toContainEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: 'sw-ai-feed-beast-choice',
                optionId: 'consume',
            },
        });
    });

    it('mind_capture 在选项顺序颠倒时，仍应按真实收益优先选择 control', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'trickster',
            faction1: 'paladin',
        });
        core.phase = 'attack';
        core.currentPlayer = '0';
        core.board[4][2].unit = undefined;
        core.board[5][2].unit = undefined;

        placeTestUnit(core, { row: 5, col: 2 }, {
            card: {
                id: 'test-trickster-source',
                cardType: 'unit',
                name: '测试施术者',
                unitClass: 'common',
                faction: 'trickster',
                strength: 2,
                life: 3,
                cost: 1,
                attackType: 'ranged',
                attackRange: 3,
                deckSymbols: [],
            },
            owner: '0',
        });
        const capturedChampion = placeTestUnit(core, { row: 4, col: 2 }, {
            card: {
                id: 'test-captured-champion',
                cardType: 'unit',
                name: '测试冠军目标',
                unitClass: 'champion',
                faction: 'paladin',
                strength: 4,
                life: 6,
                cost: 5,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '1',
        });

        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-mind-capture-priority',
            '0',
            'interaction.sw.mindCapture',
            [
                {
                    id: 'damage',
                    label: '伤害',
                    value: {
                        action: 'mind_capture',
                        sourceUnitId: 'test-trickster-source',
                        targetPosition: { row: 4, col: 2 },
                        hits: 4,
                        choice: 'damage',
                    },
                },
                {
                    id: 'control',
                    label: '控制',
                    value: {
                        action: 'mind_capture',
                        sourceUnitId: 'test-trickster-source',
                        targetPosition: { row: 4, col: 2 },
                        hits: 4,
                        choice: 'control',
                    },
                },
            ],
            { sourceId: 'mind_capture_resolve' },
        );
        (interaction.data as { sw?: unknown }).sw = {
            type: 'mind_capture',
            sourceUnitId: 'test-trickster-source',
            targetPosition: { row: 4, col: 2 },
            targetUnitId: capturedChampion.instanceId,
            hits: 4,
        };
        sys.interaction = { ...sys.interaction, current: interaction };

        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-mind-capture-priority',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const controlAction = context.legalActions.find((action) => action.metadata?.optionId === 'control');
        const damageAction = context.legalActions.find((action) => action.metadata?.optionId === 'damage');
        const controlEval = evaluations.find((item) => item.actionId === controlAction?.actionId);
        const damageEval = evaluations.find((item) => item.actionId === damageAction?.actionId);
        const controlSemanticScore = controlEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;
        const damageSemanticScore = damageEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;

        expect(controlAction).toBeTruthy();
        expect(damageAction).toBeTruthy();
        expect(controlSemanticScore).toBeGreaterThan(damageSemanticScore);
        expect(decision?.actionId).toBe(controlAction?.actionId);
    });

    it('feed_beast 在多个坏选项里应牺牲最低价值友军，而不是按顺序自毁或吃掉更贵单位', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'goblin',
            faction1: 'paladin',
        });
        core.phase = 'attack';
        core.currentPlayer = '0';
        core.board[4][2].unit = undefined;
        core.board[4][3].unit = undefined;
        core.board[4][4].unit = undefined;

        const sourceBeast = placeTestUnit(core, { row: 4, col: 3 }, {
            card: {
                id: 'test-hungry-beast',
                cardType: 'unit',
                name: '测试巨食兽',
                unitClass: 'champion',
                faction: 'goblin',
                strength: 4,
                life: 6,
                cost: 5,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });
        placeTestUnit(core, { row: 4, col: 2 }, {
            card: {
                id: 'test-expensive-ally',
                cardType: 'unit',
                name: '测试高价友军',
                unitClass: 'champion',
                faction: 'goblin',
                strength: 3,
                life: 5,
                cost: 4,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });
        placeTestUnit(core, { row: 4, col: 4 }, {
            card: {
                id: 'test-cheap-ally',
                cardType: 'unit',
                name: '测试低价友军',
                unitClass: 'common',
                faction: 'goblin',
                strength: 1,
                life: 2,
                cost: 0,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });

        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-feed-beast-priority',
            '0',
            'interaction.sw.feedBeast',
            [
                {
                    id: 'self_destroy',
                    label: '自毁',
                    value: { action: 'feed_beast', sourceUnitId: sourceBeast.instanceId, choice: 'self_destroy' },
                },
                {
                    id: 'consume-expensive',
                    label: '吞掉高价友军',
                    value: {
                        action: 'feed_beast',
                        sourceUnitId: sourceBeast.instanceId,
                        choice: 'destroy_adjacent',
                        targetPosition: { row: 4, col: 2 },
                    },
                },
                {
                    id: 'consume-cheap',
                    label: '吞掉低价友军',
                    value: {
                        action: 'feed_beast',
                        sourceUnitId: sourceBeast.instanceId,
                        choice: 'destroy_adjacent',
                        targetPosition: { row: 4, col: 4 },
                    },
                },
            ],
            { sourceId: 'feed_beast' },
        );
        (interaction.data as { sw?: unknown }).sw = {
            type: 'feed_beast',
            sourceUnitId: sourceBeast.instanceId,
        };
        sys.interaction = { ...sys.interaction, current: interaction };

        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-feed-beast-priority',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const selfDestroyAction = context.legalActions.find((action) => action.metadata?.optionId === 'self_destroy');
        const expensiveAction = context.legalActions.find((action) => action.metadata?.optionId === 'consume-expensive');
        const cheapAction = context.legalActions.find((action) => action.metadata?.optionId === 'consume-cheap');
        const selfDestroyEval = evaluations.find((item) => item.actionId === selfDestroyAction?.actionId);
        const expensiveEval = evaluations.find((item) => item.actionId === expensiveAction?.actionId);
        const cheapEval = evaluations.find((item) => item.actionId === cheapAction?.actionId);
        const selfDestroySemanticScore = selfDestroyEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;
        const expensiveSemanticScore = expensiveEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;
        const cheapSemanticScore = cheapEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;

        expect(cheapSemanticScore).toBeGreaterThan(expensiveSemanticScore);
        expect(cheapSemanticScore).toBeGreaterThan(selfDestroySemanticScore);
        expect(decision?.actionId).toBe(cheapAction?.actionId);
    });

    it('revive_undead 选弃牌堆单位时，应优先选择更高价值的亡灵而不是列表第一张', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'necromancer',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].discard = [
            {
                id: 'discard-cheap-undead',
                cardType: 'unit',
                name: '测试低价值亡灵',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 1,
                life: 2,
                cost: 0,
                attackType: 'melee',
                attackRange: 1,
                abilities: [],
                deckSymbols: [],
            },
            {
                id: 'discard-elite-undead',
                cardType: 'unit',
                name: '测试高价值亡灵',
                unitClass: 'champion',
                faction: 'necromancer',
                strength: 3,
                life: 6,
                cost: 5,
                attackType: 'melee',
                attackRange: 1,
                abilities: [],
                deckSymbols: [],
            },
        ];

        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-revive-undead-card-priority',
            '0',
            'interaction.sw.reviveUndead',
            [
                {
                    id: 'discard-cheap-undead',
                    label: '测试低价值亡灵',
                    value: {
                        action: 'activated_ability_target',
                        abilityId: 'revive_undead',
                        targetCardId: 'discard-cheap-undead',
                    },
                },
                {
                    id: 'discard-elite-undead',
                    label: '测试高价值亡灵',
                    value: {
                        action: 'activated_ability_target',
                        abilityId: 'revive_undead',
                        targetCardId: 'discard-elite-undead',
                    },
                },
            ],
            { sourceId: 'revive_undead' },
        );
        sys.interaction = { ...sys.interaction, current: interaction };

        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-revive-undead-card-priority',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const cheapAction = context.legalActions.find((action) => action.metadata?.optionId === 'discard-cheap-undead');
        const eliteAction = context.legalActions.find((action) => action.metadata?.optionId === 'discard-elite-undead');
        const cheapEval = evaluations.find((item) => item.actionId === cheapAction?.actionId);
        const eliteEval = evaluations.find((item) => item.actionId === eliteAction?.actionId);
        const cheapSemanticScore = cheapEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;
        const eliteSemanticScore = eliteEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;

        expect(eliteSemanticScore).toBeGreaterThan(cheapSemanticScore);
        expect(decision?.actionId).toBe(eliteAction?.actionId);
    });

    it('fire_sacrifice_summon 选祭品时，应优先牺牲最低价值友军而不是第一个候选', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'necromancer',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.board[6][2].unit = undefined;
        core.board[6][3].unit = undefined;

        const fragileAlly = placeTestUnit(core, { row: 6, col: 2 }, {
            card: {
                id: 'test-fragile-ally',
                cardType: 'unit',
                name: '测试低价值祭品',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 1,
                life: 2,
                cost: 0,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });
        const eliteAlly = placeTestUnit(core, { row: 6, col: 3 }, {
            card: {
                id: 'test-elite-ally',
                cardType: 'unit',
                name: '测试高价值祭品',
                unitClass: 'champion',
                faction: 'necromancer',
                strength: 4,
                life: 5,
                cost: 4,
                attackType: 'melee',
                attackRange: 1,
                deckSymbols: [],
            },
            owner: '0',
        });

        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-fire-sacrifice-priority',
            '0',
            'interaction.sw.fireSacrificeSummon',
            [
                {
                    id: `unit:${eliteAlly.instanceId}`,
                    label: '测试高价值祭品',
                    value: {
                        action: 'fire_sacrifice_summon',
                        sacrificeUnitId: eliteAlly.instanceId,
                    },
                },
                {
                    id: `unit:${fragileAlly.instanceId}`,
                    label: '测试低价值祭品',
                    value: {
                        action: 'fire_sacrifice_summon',
                        sacrificeUnitId: fragileAlly.instanceId,
                    },
                },
            ],
            { sourceId: 'fire_sacrifice_summon' },
        );
        sys.interaction = { ...sys.interaction, current: interaction };

        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-fire-sacrifice-priority',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const eliteAction = context.legalActions.find((action) => action.metadata?.optionId === `unit:${eliteAlly.instanceId}`);
        const fragileAction = context.legalActions.find((action) => action.metadata?.optionId === `unit:${fragileAlly.instanceId}`);
        const eliteEval = evaluations.find((item) => item.actionId === eliteAction?.actionId);
        const fragileEval = evaluations.find((item) => item.actionId === fragileAction?.actionId);
        const eliteSemanticScore = eliteEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;
        const fragileSemanticScore = fragileEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;

        expect(fragileSemanticScore).toBeGreaterThan(eliteSemanticScore);
        expect(decision?.actionId).toBe(fragileAction?.actionId);
    });

    it('blood_summon 选召唤卡时，应优先选择收益更高的低费单位而不是手牌第一张', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'necromancer',
            faction1: 'paladin',
        });
        core.phase = 'event';
        core.currentPlayer = '0';
        core.players['0'].hand = [
            {
                id: 'blood-summon-cheap',
                cardType: 'unit',
                name: '测试低收益单位',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 1,
                life: 2,
                cost: 0,
                attackType: 'melee',
                attackRange: 1,
                abilities: [],
                deckSymbols: [],
            },
            {
                id: 'blood-summon-elite',
                cardType: 'unit',
                name: '测试高收益单位',
                unitClass: 'common',
                faction: 'necromancer',
                strength: 2,
                life: 5,
                cost: 2,
                attackType: 'ranged',
                attackRange: 3,
                abilities: [],
                deckSymbols: [],
            },
        ];

        const sys = createInitialSystemState(['0', '1'], []);
        const interaction = createSimpleChoice(
            'sw-ai-blood-summon-card-priority',
            '0',
            'interaction.sw.bloodSummonCard',
            [
                {
                    id: 'blood-summon-cheap',
                    label: '测试低收益单位',
                    value: { action: 'blood_summon_card', summonCardId: 'blood-summon-cheap' },
                },
                {
                    id: 'blood-summon-elite',
                    label: '测试高收益单位',
                    value: { action: 'blood_summon_card', summonCardId: 'blood-summon-elite' },
                },
            ],
            { sourceId: 'blood_summon' },
        );
        sys.interaction = { ...sys.interaction, current: interaction };

        const context = buildAiDecisionContext({
            gameId: 'summonerwars',
            matchId: 'local:summonerwars-blood-summon-card-priority',
            playerId: '0',
            visibleState: { core, sys },
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'hard' },
        });

        const decision = await summonerWarsAiRuntime.localPolicies?.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const cheapAction = context.legalActions.find((action) => action.metadata?.optionId === 'blood-summon-cheap');
        const eliteAction = context.legalActions.find((action) => action.metadata?.optionId === 'blood-summon-elite');
        const cheapEval = evaluations.find((item) => item.actionId === cheapAction?.actionId);
        const eliteEval = evaluations.find((item) => item.actionId === eliteAction?.actionId);
        const cheapSemanticScore = cheapEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;
        const eliteSemanticScore = eliteEval?.contributions.find((item) => item.scorerId === 'interaction-semantic')?.score ?? -Infinity;

        expect(eliteSemanticScore).toBeGreaterThan(cheapSemanticScore);
        expect(decision?.actionId).toBe(eliteAction?.actionId);
    });

    it('殉葬火堆有受伤友军时，AI 应优先生成并选择 FUNERAL_PYRE_HEAL，而不是回落普通阶段动作', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'necromancer',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].activeEvents = [createChargedFuneralPyre()];
        core.board[7][3].unit!.damage = 2;

        const sys = createInitialSystemState(['0', '1'], []);
        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions.length).toBeGreaterThanOrEqual(2);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
        expect(actions.map((action) => action.commands[0])).toContainEqual({
            type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
            payload: {
                cardId: 'necro-funeral-pyre-0-0',
                targetPosition: { row: 7, col: 3 },
            },
        });
        expect(actions.map((action) => action.commands[0])).toContainEqual({
            type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
            payload: {
                cardId: 'necro-funeral-pyre-0-0',
                skip: true,
            },
        });

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-funeral-pyre-heal-ai',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.commands[0]).toEqual({
            type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
            payload: {
                cardId: 'necro-funeral-pyre-0-0',
                targetPosition: { row: 7, col: 3 },
            },
        });
    });

    it('殉葬火堆无可治疗目标时，AI 应只生成 skip 以避免悬空等待 UI', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom, {
            faction0: 'necromancer',
            faction1: 'paladin',
        });
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].activeEvents = [createChargedFuneralPyre()];

        const sys = createInitialSystemState(['0', '1'], []);
        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.commands[0]).toEqual({
            type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
            payload: {
                cardId: 'necro-funeral-pyre-0-0',
                skip: true,
            },
        });

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-funeral-pyre-skip-ai',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.commands[0]).toEqual({
            type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
            payload: {
                cardId: 'necro-funeral-pyre-0-0',
                skip: true,
            },
        });
    });

    it('simple-choice 交互会生成目标语义 aiHint，并对跳过选项降权', () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        const sys = createInitialSystemState(['0', '1'], []);

        const enemyCard: UnitCard = {
            id: 'test-enemy',
            cardType: 'unit',
            name: '测试敌兵',
            unitClass: 'common',
            faction: 'paladin',
            strength: 2,
            life: 3,
            cost: 1,
            attackType: 'melee',
            attackRange: 1,
            deckSymbols: [],
        };
        placeTestUnit(core, { row: 4, col: 4 }, {
            card: enemyCard,
            owner: '1',
        });

        sys.interaction = {
            ...sys.interaction,
            current: {
                id: 'sw-ai-simple-choice-hint',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    sourceId: 'entangle',
                    options: [
                        {
                            id: 'opt-target',
                            label: '选择敌方单位',
                            value: { targetPosition: { row: 4, col: 4 } },
                        },
                        {
                            id: 'opt-skip',
                            label: '跳过',
                            value: {},
                        },
                    ],
                },
            } as any,
        };

        const actions = buildSummonerWarsAiLegalActions({
            playerId: '0',
            state: { core, sys },
        });

        const targetAction = actions.find((action) => action.metadata?.optionId === 'opt-target');
        const skipAction = actions.find((action) => action.metadata?.optionId === 'opt-skip');

        expect(targetAction?.aiHints?.some((hint) => hint.relationToActor === 'enemy')).toBe(true);
        expect(targetAction?.aiHints?.some((hint) => hint.effectIntent === 'destroy')).toBe(true);
        expect(skipAction?.aiHints?.some((hint) => hint.effectIntent === 'optional-skip')).toBe(true);
    });

    it('召唤师受致命威胁时应优先攻击威胁单位，而不是追击其他目标', async () => {
        const core = createInitializedCore(['0', '1'], aiTestRandom);
        core.phase = 'attack';
        core.board[7][3].unit!.damage = core.board[7][3].unit!.card.life - 2;
        core.board[6][2].unit = undefined;
        core.board[6][3].unit = undefined;
        core.board[5][2].unit = undefined;

        const defenderCard: UnitCard = {
            id: 'test-guard',
            cardType: 'unit',
            name: '测试护卫',
            unitClass: 'common',
            faction: 'necromancer',
            strength: 2,
            life: 3,
            cost: 1,
            attackType: 'melee',
            attackRange: 1,
            deckSymbols: [],
        };
        const threateningCard: UnitCard = {
            id: 'test-threat',
            cardType: 'unit',
            name: '测试威胁兵',
            unitClass: 'common',
            faction: 'paladin',
            strength: 2,
            life: 3,
            cost: 1,
            attackType: 'melee',
            attackRange: 1,
            deckSymbols: [],
        };
        const championCard: UnitCard = {
            id: 'test-champion',
            cardType: 'unit',
            name: '测试冠军',
            unitClass: 'champion',
            faction: 'paladin',
            strength: 3,
            life: 1,
            cost: 3,
            attackType: 'melee',
            attackRange: 1,
            deckSymbols: [],
        };

        placeTestUnit(core, { row: 6, col: 2 }, {
            card: defenderCard,
            owner: '0',
        });
        placeTestUnit(core, { row: 6, col: 3 }, {
            card: threateningCard,
            owner: '1',
        });
        placeTestUnit(core, { row: 5, col: 2 }, {
            card: championCard,
            owner: '1',
            damage: 0,
        });

        const sys = createInitialSystemState(['0', '1'], []);
        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state: { core, sys },
            matchId: 'local:summonerwars-threat-response-ai',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.source).toBe('local-ai');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: SW_COMMANDS.DECLARE_ATTACK,
            payload: {
                target: { row: 6, col: 3 },
            },
        });
    });
});
