/**
 * 井字棋领域类型定义
 */

import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';

// ============================================================================
// 游戏状态
// ============================================================================

/**
 * 棋盘格子值
 */
export type CellValue = PlayerId | null;

/**
 * 井字棋核心状态
 */
export interface TicTacToeCore {
    /** 棋盘格子（9格） */
    cells: CellValue[];
    /** 当前玩家 */
    currentPlayer: PlayerId;
    /** 玩家列表 */
    playerIds: PlayerId[];
    /** 游戏结果（用于 isGameOver 读取） */
    gameResult?: GameOverResult;
}

// ============================================================================
// 命令定义
// ============================================================================

/**
 * 点击格子命令
 */
export interface ClickCellCommand extends Command<'CLICK_CELL'> {
    payload: {
        cellId: number;
    };
}

/**
 * 所有井字棋命令
 */
export type TicTacToeCommand = ClickCellCommand;

// ============================================================================
// 事件定义
// ============================================================================

/**
 * 格子被占用事件
 */
export interface CellOccupiedEvent extends GameEvent<'CELL_OCCUPIED'> {
    payload: {
        cellId: number;
        playerId: PlayerId;
    };
}

/**
 * 玩家切换事件
 */
export interface PlayerSwitchedEvent extends GameEvent<'PLAYER_SWITCHED'> {
    payload: {
        previousPlayer: PlayerId;
        nextPlayer: PlayerId;
    };
}

/**
 * 游戏结束事件
 */
export interface GameOverEvent extends GameEvent<'GAME_OVER'> {
    payload: {
        winner?: PlayerId;
        draw?: boolean;
    };
}

/**
 * 所有井字棋事件
 */
export type TicTacToeEvent = CellOccupiedEvent | PlayerSwitchedEvent | GameOverEvent;
