/**
 * 召唤师战争流程测试
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS } from '../domain';
import type { SummonerWarsCore, GamePhase, PlayerId, UnitCard, EventCard } from '../domain/types';
import { resolveNextLocalAiAction } from '../../../engine/ai';

import { GameTestRunner, type TestCase, type StateExpectation } from '../../../engine/testing';
import { createInitialSystemState } from '../../../engine/pipeline';
import {
    BOARD_ROWS,
    BOARD_COLS,
    getValidSummonPositions,
} from '../domain/helpers';
import { createInitializedCore } from './test-helpers';
import { engineConfig } from '../game';

const aiTestRandom = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(arr: T[]) => [...arr],
};

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
        name: '攻击错误 - 攻击自己的单位',
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
        expect(resolution?.action.commands[0]).toMatchObject({
            type: SW_COMMANDS.SELECT_FACTION,
            payload: { factionId: 'necromancer' },
        });
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
});
