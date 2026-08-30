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
        /** afterEvents 多轮迭代的当前轮次：0 = 命令原始事件轮，>0 = 后续系统派生事件轮 */
        afterEventsRound: number;
    }) => ActionLogEntry | ActionLogEntry[] | null;
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

        afterEvents: ({ state, command, events, afterEventsRound }): HookResult<TCore> | void => {
            // ✅ 移除 afterEventsRound 限制，记录所有轮次的事件
            // 原因：游戏层系统会在后续轮次产生重要事件（如交互解决后追加领域事件）
            // 这些事件也需要被记录到 ActionLog
            if (!shouldRecordCommand(command.type, normalizedAllowlist)) return;
            if (!formatEntry) return;

            const result = formatEntry({
                command,
                state: state as MatchState<unknown>,
                events,
                afterEventsRound: afterEventsRound ?? 0,
            });
            if (!result) return;

            const entries = Array.isArray(result) ? result : [result];
            let nextState = state;
            let touched = false;
            for (const entry of entries) {
                if (!entry) continue;
                nextState = appendEntry(nextState, entry, maxEntries);
                touched = true;
            }

            if (!touched) return;
            return {
                state: nextState,
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

    // 同一命令可能在 afterEvents 的后续轮次再次经过格式化；稳定 id 已经
    // 标识了同一条玩家可见操作，重复写入只会让日志出现成片重复行。
    if (existingEntries.some((existingEntry) => existingEntry?.id === entry.id)) {
        return state;
    }

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
