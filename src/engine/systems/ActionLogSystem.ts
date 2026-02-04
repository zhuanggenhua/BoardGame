/**
 * 操作日志系统
 * 
 * 记录玩家可见的“领域行为”，用于 HUD 展示。
 */

import type { ActionLogEntry, ActionLogState, Command, GameEvent, MatchState } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';
import {
    isCommandAllowlisted,
    normalizeCommandAllowlist,
    type CommandAllowlist,
    type NormalizedCommandAllowlist,
} from './commandAllowlist';

// ============================================================================
// ActionLog 系统配置
// ============================================================================

export interface ActionLogSystemConfig {
    /** 最大日志条目数 */
    maxEntries?: number;
    /** 允许记录的命令白名单（与 UndoSystem 共享） */
    commandAllowlist?: CommandAllowlist;
    /** 生成日志条目的格式化函数（由游戏层提供） */
    formatEntry?: (args: {
        command: Command;
        state: MatchState<unknown>;
        events: GameEvent[];
    }) => ActionLogEntry | null;
}

// ============================================================================
// 创建系统
// ============================================================================

export function createActionLogSystem<TCore>(
    config: ActionLogSystemConfig = {}
): EngineSystem<TCore> {
    const { maxEntries = 50, commandAllowlist, formatEntry } = config;
    const normalizedAllowlist = normalizeCommandAllowlist(commandAllowlist);

    return {
        id: SYSTEM_IDS.ACTION_LOG,
        name: '操作日志系统',
        // 高于 Undo(10)，保证撤回快照包含最新日志
        priority: 5,

        setup: (): Partial<{ actionLog: ActionLogState }> => ({
            actionLog: {
                entries: [],
                maxEntries,
            },
        }),

        afterEvents: ({ state, command, events }): HookResult<TCore> | void => {
            if (!shouldRecordCommand(command.type, normalizedAllowlist)) return;
            if (!formatEntry) return;

            const entry = formatEntry({
                command,
                state: state as MatchState<unknown>,
                events,
            });
            if (!entry) return;

            return {
                state: appendEntry(state, entry, maxEntries),
            };
        },
    };
}

// ============================================================================
// 辅助函数
// ============================================================================

function shouldRecordCommand(
    commandType: string,
    allowlist: NormalizedCommandAllowlist
): boolean {
    return isCommandAllowlisted(commandType, allowlist, { fallbackToAllowAll: false });
}

function appendEntry<TCore>(
    state: MatchState<TCore>,
    entry: ActionLogEntry,
    maxEntries: number
): MatchState<TCore> {
    const currentActionLog = state.sys.actionLog ?? { entries: [], maxEntries };
    const existingEntries = Array.isArray(currentActionLog.entries)
        ? currentActionLog.entries
        : [];
    const normalizedMaxEntries = Number.isFinite(currentActionLog.maxEntries)
        ? currentActionLog.maxEntries
        : maxEntries;
    const entries = [...existingEntries, entry];

    while (entries.length > normalizedMaxEntries) {
        entries.shift();
    }

    return {
        ...state,
        sys: {
            ...state.sys,
            actionLog: {
                ...currentActionLog,
                maxEntries: normalizedMaxEntries,
                entries,
            },
        },
    };
}
