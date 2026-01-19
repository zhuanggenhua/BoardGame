import type { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

// 1. Define State (G)
export interface TicTacToeState {
    cells: (string | null)[];
}

// 2. Define Moves
export const TicTacToe: Game<TicTacToeState> = {
    setup: () => ({ cells: Array(9).fill(null) }),

    turn: {
        minMoves: 1,
        maxMoves: 1,
    },

    moves: {
        clickCell: ({ G, playerID }, id: number) => {
            if (G.cells[id] !== null) {
                return INVALID_MOVE;
            }
            G.cells[id] = playerID;
        },
    },

    endIf: ({ G, ctx }) => {
        if (IsVictory(G.cells)) {
            return { winner: ctx.currentPlayer };
        }
        if (IsDraw(G.cells)) {
            return { draw: true };
        }
    },
};

// Helper functions (Pure Logic)
function IsVictory(cells: (string | null)[]) {
    const positions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let pos of positions) {
        const symbol = cells[pos[0]];
        let winner = symbol;
        for (let i of pos) {
            if (cells[i] !== symbol) {
                winner = null;
                break;
            }
        }
        if (winner != null) return true;
    }
    return false;
}

function IsDraw(cells: (string | null)[]) {
    return cells.filter(c => c === null).length === 0;
}
