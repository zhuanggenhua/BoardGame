/**
 * 井字棋游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState } from '../../engine/types';
import {
    createActionLogSystem,
    createInteractionSystem,
    createSimpleChoiceSystem,
    createMultistepChoiceSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
} from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { TicTacToeDomain } from './domain';

// ============================================================================
// ActionLog 共享白名单 + 格式化
// ============================================================================

const ACTION_ALLOWLIST = ['CLICK_CELL'] as const;

const TT_NS = 'game-tictactoe';

const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
): ActionLogSegment => ({
    type: 'i18n' as const,
    ns: TT_NS,
    key,
    ...(params ? { params } : {}),
});

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
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

    return {
        id: `${command.type}-${command.playerId}-${timestamp}`,
        timestamp,
        actorId: command.playerId,
        kind: command.type,
        segments: [i18nSeg('actionLog.cellClicked', { row, col })],
    };
}

// 创建系统集合
const systems = [
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatTicTacToeActionEntry,
    }),
    createUndoSystem({
        snapshotCommandAllowlist: ACTION_ALLOWLIST,
    }),
    createInteractionSystem(),
    createSimpleChoiceSystem(),
    createMultistepChoiceSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createTutorialSystem(),
];

// 适配器配置
const adapterConfig = {
    domain: TicTacToeDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [
        'CLICK_CELL',
    ],
};

// 引擎配置
export const engineConfig = createGameEngine(adapterConfig);

export default engineConfig;
export type { TicTacToeCore as TicTacToeState } from './domain';
