/**
 * 井字棋流程测试
 * 
 * 运行方式: npx tsx src/games/tictactoe/__tests__/flow.test.ts
 */

import { TicTacToeDomain } from '../domain';
import type { TicTacToeCore } from '../domain/types';
import { GameTestRunner, type TestCase, type StateExpectation } from '../../../engine/testing';

// ============================================================================
// 井字棋专用断言
// ============================================================================

interface TicTacToeExpectation extends StateExpectation {
    /** 预期的棋盘状态 */
    cells?: (string | null)[];
    /** 预期的当前玩家 */
    currentPlayer?: string;
    /** 预期的获胜者 */
    winner?: string;
    /** 预期平局 */
    draw?: boolean;
}

function assertTicTacToe(state: TicTacToeCore, expect: TicTacToeExpectation): string[] {
    const errors: string[] = [];

    if (expect.cells) {
        const cellsMatch = JSON.stringify(state.cells) === JSON.stringify(expect.cells);
        if (!cellsMatch) {
            errors.push(`棋盘状态不匹配:\n  预期: ${JSON.stringify(expect.cells)}\n  实际: ${JSON.stringify(state.cells)}`);
        }
    }

    if (expect.currentPlayer !== undefined) {
        if (state.currentPlayer !== expect.currentPlayer) {
            errors.push(`当前玩家不匹配: 预期 ${expect.currentPlayer}, 实际 ${state.currentPlayer}`);
        }
    }

    if (expect.winner !== undefined) {
        if (state.gameResult?.winner !== expect.winner) {
            errors.push(`获胜者不匹配: 预期 ${expect.winner}, 实际 ${state.gameResult?.winner}`);
        }
    }

    if (expect.draw !== undefined) {
        if (state.gameResult?.draw !== expect.draw) {
            errors.push(`平局状态不匹配: 预期 ${expect.draw}, 实际 ${state.gameResult?.draw}`);
        }
    }

    return errors;
}

// ============================================================================
// 棋盘可视化
// ============================================================================

function printBoard(cells: (string | null)[]) {
    console.log('\n  棋盘状态:');
    console.log('  ┌───┬───┬───┐');
    for (let row = 0; row < 3; row++) {
        const rowCells = cells.slice(row * 3, row * 3 + 3).map((c, i) => {
            const idx = row * 3 + i;
            if (c === '0') return ' X ';
            if (c === '1') return ' O ';
            return ` ${idx} `;
        });
        console.log(`  │${rowCells.join('│')}│`);
        if (row < 2) console.log('  ├───┼───┼───┤');
    }
    console.log('  └───┴───┴───┘');
}

// ============================================================================
// 测试用例
// ============================================================================

const testCases: TestCase<TicTacToeExpectation>[] = [
    {
        name: '正常流程 - 玩家0对角线获胜',
        commands: [
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 0 } },
            { type: 'CLICK_CELL', playerId: '1', payload: { cellId: 1 } },
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 4 } },
            { type: 'CLICK_CELL', playerId: '1', payload: { cellId: 2 } },
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 8 } },
        ],
        expect: {
            winner: '0',
            cells: ['0', '1', '1', null, '0', null, null, null, '0'],
        },
    },
    {
        name: '正常流程 - 平局',
        commands: [
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 0 } },
            { type: 'CLICK_CELL', playerId: '1', payload: { cellId: 4 } },
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 2 } },
            { type: 'CLICK_CELL', playerId: '1', payload: { cellId: 1 } },
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 7 } },
            { type: 'CLICK_CELL', playerId: '1', payload: { cellId: 3 } },
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 5 } },
            { type: 'CLICK_CELL', playerId: '1', payload: { cellId: 8 } },
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 6 } },
        ],
        expect: {
            draw: true,
            cells: ['0', '1', '0', '1', '1', '0', '0', '0', '1'],
        },
    },
    {
        name: '错误测试 - 玩家抢先下棋',
        commands: [
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 0 } },
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 1 } },
        ],
        expect: {
            errorAtStep: { step: 2, error: 'notYourTurn' },
            cells: ['0', null, null, null, null, null, null, null, null],
        },
    },
    {
        name: '错误测试 - 格子已被占用',
        commands: [
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 0 } },
            { type: 'CLICK_CELL', playerId: '1', payload: { cellId: 0 } },
        ],
        expect: {
            errorAtStep: { step: 2, error: 'cellOccupied' },
        },
    },
    {
        name: '错误测试 - 无效格子索引',
        commands: [
            { type: 'CLICK_CELL', playerId: '0', payload: { cellId: 9 } },
        ],
        expect: {
            errorAtStep: { step: 1, error: 'invalidCell' },
        },
    },
];

// ============================================================================
// 运行测试
// ============================================================================

const runner = new GameTestRunner({
    domain: TicTacToeDomain,
    playerIds: ['0', '1'],
    assertFn: assertTicTacToe,
    visualizeFn: (state) => printBoard(state.cells),
});

console.log('\n🎮 井字棋流程测试');
console.log('使用 Domain Core 直接运行，无需 UI 和 boardgame.io\n');

runner.runAll(testCases);
