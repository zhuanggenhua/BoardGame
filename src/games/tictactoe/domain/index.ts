/**
 * 井字棋领域内核
 */

import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import type { TicTacToeCore, TicTacToeCommand, TicTacToeEvent } from './types';
import { validate } from './commands';
import { execute, reduce } from './reducer';

// ============================================================================
// 领域内核定义
// ============================================================================

export const TicTacToeDomain: DomainCore<TicTacToeCore, TicTacToeCommand, TicTacToeEvent> = {
    gameId: 'tictactoe',

    setup: (playerIds: PlayerId[], _random: RandomFn): TicTacToeCore => ({
        cells: Array(9).fill(null),
        currentPlayer: playerIds[0],
        playerIds,
        gameResult: undefined,
    }),

    validate,
    execute,
    reduce,

    isGameOver: (state: TicTacToeCore): GameOverResult | undefined => state.gameResult,
};

// 导出类型
export type { TicTacToeCore, TicTacToeCommand, TicTacToeEvent } from './types';
