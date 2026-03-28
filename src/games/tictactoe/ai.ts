import type { MatchState, PlayerId } from '../../engine/types';
import { createAiLegalActionId } from '../../engine/ai';
import type { AiDecisionContext, AiLegalAction, GameAiRuntime, LocalAiPolicy } from '../../engine/ai';
import type { TicTacToeCore } from './domain/types';
import { WIN_POSITIONS } from './domain/rules';

type TicTacToeState = MatchState<TicTacToeCore>;

const CENTER_CELL = 4;
const CORNER_CELLS = [0, 2, 6, 8];

const createClickCellAction = (cellId: number): AiLegalAction => ({
    actionId: createAiLegalActionId('click-cell', cellId),
    kind: 'click-cell',
    label: `落子 ${cellId}`,
    commands: [{
        type: 'CLICK_CELL',
        payload: { cellId },
    }],
    metadata: { cellId },
});

const getAvailableCells = (state: TicTacToeState): number[] => {
    return state.core.cells
        .map((cell, index) => (cell === null ? index : null))
        .filter((cellId): cellId is number => cellId !== null);
};

const buildBoardAfterMove = (
    cells: TicTacToeCore['cells'],
    cellId: number,
    playerId: PlayerId,
): TicTacToeCore['cells'] => {
    const nextCells = [...cells];
    nextCells[cellId] = playerId;
    return nextCells;
};

const isWinningBoard = (cells: TicTacToeCore['cells'], playerId: PlayerId): boolean => {
    return WIN_POSITIONS.some(([a, b, c]) => {
        return cells[a] === playerId && cells[b] === playerId && cells[c] === playerId;
    });
};

const findWinningCell = (
    state: TicTacToeState,
    playerId: PlayerId,
): number | null => {
    for (const cellId of getAvailableCells(state)) {
        const nextCells = buildBoardAfterMove(state.core.cells, cellId, playerId);
        if (isWinningBoard(nextCells, playerId)) {
            return cellId;
        }
    }
    return null;
};

export function buildTicTacToeAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as TicTacToeState;
    if (state.core.gameResult) return [];
    if (state.core.currentPlayer !== args.playerId) return [];

    return getAvailableCells(state).map((cellId) => createClickCellAction(cellId));
}

const baselineLocalPolicy: LocalAiPolicy = {
    id: 'baseline',
    decide(context: AiDecisionContext) {
        const state = context.visibleState as TicTacToeState;
        const playerId = context.playerId;
        const opponentId = state.core.playerIds.find((id) => id !== playerId);

        const winningCell = findWinningCell(state, playerId);
        if (winningCell !== null) {
            return { actionId: createAiLegalActionId('click-cell', winningCell) };
        }

        if (opponentId) {
            const blockingCell = findWinningCell(state, opponentId);
            if (blockingCell !== null) {
                return { actionId: createAiLegalActionId('click-cell', blockingCell) };
            }
        }

        if (state.core.cells[CENTER_CELL] === null) {
            return { actionId: createAiLegalActionId('click-cell', CENTER_CELL) };
        }

        const openCorner = CORNER_CELLS.find((cellId) => state.core.cells[cellId] === null);
        if (openCorner !== undefined) {
            return { actionId: createAiLegalActionId('click-cell', openCorner) };
        }

        return context.legalActions[0]
            ? { actionId: context.legalActions[0].actionId }
            : null;
    },
};

export const ticTacToeAiRuntime: GameAiRuntime = {
    gameId: 'tictactoe',
    buildLegalActions: buildTicTacToeAiLegalActions,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
