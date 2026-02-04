/**
 * 召唤师战争游戏定义（新引擎架构）
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
import { SummonerWarsDomain } from './domain';

// ============================================================================
// ActionLog 共享白名单 + 格式化
// ============================================================================

// TODO: 定义游戏命令类型
const ACTION_ALLOWLIST = [] as const;

function formatSummonerWarsActionEntry({
    command,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    // TODO: 实现动作日志格式化
    return null;
}

// 创建系统集合
const systems = [
    createLogSystem(),
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatSummonerWarsActionEntry,
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
export const SummonerWars = createGameAdapter({
    domain: SummonerWarsDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [
        // TODO: 添加游戏命令类型
        UNDO_COMMANDS.REQUEST_UNDO,
        UNDO_COMMANDS.APPROVE_UNDO,
        UNDO_COMMANDS.REJECT_UNDO,
        UNDO_COMMANDS.CANCEL_UNDO,
    ],
});

export default SummonerWars;

// 导出类型
export type { SummonerWarsCore as SummonerWarsState } from './domain';
