/**
 * 井字棋命令定义与验证
 */

import type { ValidationResult } from '../../../engine/types';
import type { TicTacToeCore, TicTacToeCommand } from './types';

/**
 * 验证命令合法性
 */
export function validate(
    state: TicTacToeCore,
    command: TicTacToeCommand
): ValidationResult {
    switch (command.type) {
        case 'CLICK_CELL':
            return validateClickCell(state, command);
        default:
            return { valid: false, error: 'unknownCommand' };
    }
}

/**
 * 验证点击格子命令
 */
function validateClickCell(
    state: TicTacToeCore,
    command: TicTacToeCommand & { type: 'CLICK_CELL' }
): ValidationResult {
    const { cellId } = command.payload;
    const { playerId } = command;

    // 检查游戏是否已结束
    if (state.gameResult) {
        return { valid: false, error: 'gameOver' };
    }

    // 检查是否轮到该玩家
    if (playerId !== state.currentPlayer) {
        return { valid: false, error: 'notYourTurn' };
    }

    // 检查格子索引有效性
    if (cellId < 0 || cellId >= 9) {
        return { valid: false, error: 'invalidCell' };
    }

    // 检查格子是否已被占用
    if (state.cells[cellId] !== null) {
        return { valid: false, error: 'cellOccupied' };
    }

    return { valid: true };
}
