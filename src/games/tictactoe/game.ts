/**
 * 井字棋游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import { createGameAdapter, createDefaultSystems, UNDO_COMMANDS } from '../../engine';
import { TicTacToeDomain } from './domain';
import type { TicTacToeCore } from './domain';

// 创建系统集合
const systems = createDefaultSystems<TicTacToeCore>();

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
