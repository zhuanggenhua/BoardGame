/**
 * 井字棋游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import type { ActionLogEntry, Command, GameEvent, MatchState } from '../../engine/types';
import {
    createActionLogSystem,
    createGameAdapter,
    createLogSystem,
    createPromptSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
    UNDO_COMMANDS,
} from '../../engine';
import { TicTacToeDomain } from './domain';

// ============================================================================
// ActionLog 共享白名单 + 格式化
// ============================================================================

const ACTION_ALLOWLIST = ['CLICK_CELL'] as const;

function formatTicTacToeActionEntry({
    command,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    if (command.type !== 'CLICK_CELL') return null;

    const { cellId } = command.payload as { cellId: number };
    const row = Math.floor(cellId / 3) + 1;
    const col = (cellId % 3) + 1;

    return {
        id: `${command.type}-${command.playerId}-${command.timestamp ?? Date.now()}`,
        timestamp: command.timestamp ?? Date.now(),
        actorId: command.playerId,
        kind: command.type,
        segments: [{ type: 'text', text: `落子：${row},${col}` }],
    };
}

// 创建系统集合
const systems = [
    createLogSystem(),
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatTicTacToeActionEntry,
    }),
    createUndoSystem({
        snapshotCommandAllowlist: ACTION_ALLOWLIST,
    }),
    createPromptSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createTutorialSystem(),
];

// 使用适配器创建 Boardgame.io Game
// 注意：重赛投票已迁移至 socket 层（见 RematchContext），不再通过 move 实现
export const TicTacToe = createGameAdapter({
    domain: TicTacToeDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [
        'CLICK_CELL',
        UNDO_COMMANDS.REQUEST_UNDO,
        UNDO_COMMANDS.APPROVE_UNDO,
        UNDO_COMMANDS.REJECT_UNDO,
        UNDO_COMMANDS.CANCEL_UNDO,
    ],
});

export default TicTacToe;

// 导出类型（兼容旧代码）
export type { TicTacToeCore as TicTacToeState } from './domain';
