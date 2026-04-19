/**
 * 井字棋确定性状态变更
 */

import type { RandomFn, MatchState } from '../../../engine/types';
import type {
    TicTacToeCore,
    TicTacToeCommand,
    TicTacToeEvent,
    CellOccupiedEvent,
    PlayerSwitchedEvent,
    GameOverEvent,
} from './types';
import { checkWinner, checkDraw } from './rules';

// ============================================================================
// 命令执行 -> 产生事件
// ============================================================================

export function execute(
    state: MatchState<TicTacToeCore>,
    command: TicTacToeCommand,
    _random: RandomFn
): TicTacToeEvent[] {
    const core = state.core;
    const events: TicTacToeEvent[] = [];
    const now = typeof command.timestamp === 'number' ? command.timestamp : 0;

    switch (command.type) {
        case 'CLICK_CELL': {
            const { cellId } = command.payload;
            const { playerId } = command;

            // 1. 格子被占用事件
            const cellOccupied: CellOccupiedEvent = {
                type: 'CELL_OCCUPIED',
                payload: { cellId, playerId },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(cellOccupied);

            // 模拟应用事件后的状态（用于判断胜负）
            const newCells = [...core.cells];
            newCells[cellId] = playerId;

            // 2. 检查游戏结束
            const winner = checkWinner(newCells);
            if (winner) {
                const gameOver: GameOverEvent = {
                    type: 'GAME_OVER',
                    payload: { winner },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(gameOver);
            } else if (checkDraw(newCells)) {
                const gameOver: GameOverEvent = {
                    type: 'GAME_OVER',
                    payload: { draw: true },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(gameOver);
            } else {
                // 3. 切换玩家事件
                const nextPlayer = core.playerIds.find(id => id !== playerId) ?? playerId;
                const playerSwitched: PlayerSwitchedEvent = {
                    type: 'PLAYER_SWITCHED',
                    payload: { previousPlayer: playerId, nextPlayer },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(playerSwitched);
            }
            break;
        }
    }

    return events;
}

// ============================================================================
// 事件应用 -> 更新状态（确定性 Reducer）
// ============================================================================

export function reduce(
    state: TicTacToeCore,
    event: TicTacToeEvent
): TicTacToeCore {
    switch (event.type) {
        case 'CELL_OCCUPIED': {
            const { cellId, playerId } = event.payload;
            const newCells = [...state.cells];
            newCells[cellId] = playerId;
            return { ...state, cells: newCells };
        }

        case 'PLAYER_SWITCHED': {
            const { nextPlayer } = event.payload;
            return { ...state, currentPlayer: nextPlayer };
        }

        case 'GAME_OVER': {
            // 写入游戏结果，供 isGameOver 读取
            return { ...state, gameResult: event.payload };
        }

        default:
            return state;
    }
}
