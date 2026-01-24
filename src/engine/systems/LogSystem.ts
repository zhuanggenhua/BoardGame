/**
 * 事件日志系统
 * 
 * 统一事件日志格式，支撑回放/审计/调试
 */

import type { Command, GameEvent, LogEntry, LogState, MatchState } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// 日志系统配置
// ============================================================================

export interface LogSystemConfig {
    /** 最大日志条目数 */
    maxEntries?: number;
    /** 是否记录命令 */
    logCommands?: boolean;
    /** 是否记录事件 */
    logEvents?: boolean;
}

// ============================================================================
// 创建日志系统
// ============================================================================

export function createLogSystem<TCore>(
    config: LogSystemConfig = {}
): EngineSystem<TCore> {
    const {
        maxEntries = 1000,
        logCommands = true,
        logEvents = true,
    } = config;

    return {
        id: SYSTEM_IDS.LOG,
        name: '日志系统',
        priority: 5, // 最高优先级，最先记录

        setup: (): Partial<{ log: LogState }> => ({
            log: {
                entries: [],
                maxEntries,
            },
        }),

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            if (!logCommands) return;

            const entry: LogEntry = {
                timestamp: Date.now(),
                type: 'command',
                data: command,
            };

            return { state: appendLogEntry(state, entry, maxEntries) };
        },

        afterEvents: ({ state, events }): HookResult<TCore> | void => {
            if (!logEvents || events.length === 0) return;

            let newState = state;
            for (const event of events) {
                const entry: LogEntry = {
                    timestamp: Date.now(),
                    type: 'event',
                    data: event,
                };
                newState = appendLogEntry(newState, entry, maxEntries);
            }

            return { state: newState };
        },
    };
}

// ============================================================================
// 日志辅助函数
// ============================================================================

function appendLogEntry<TCore>(
    state: MatchState<TCore>,
    entry: LogEntry,
    maxEntries: number
): MatchState<TCore> {
    const entries = [...state.sys.log.entries, entry];
    
    // 限制日志条目数量
    while (entries.length > maxEntries) {
        entries.shift();
    }

    return {
        ...state,
        sys: {
            ...state.sys,
            log: {
                ...state.sys.log,
                entries,
            },
        },
    };
}

// ============================================================================
// 日志查询辅助函数
// ============================================================================

/**
 * 获取所有命令
 */
export function getCommands<TCore>(state: MatchState<TCore>): Command[] {
    return state.sys.log.entries
        .filter((e): e is LogEntry & { data: Command } => e.type === 'command')
        .map(e => e.data);
}

/**
 * 获取所有事件
 */
export function getEvents<TCore>(state: MatchState<TCore>): GameEvent[] {
    return state.sys.log.entries
        .filter((e): e is LogEntry & { data: GameEvent } => e.type === 'event')
        .map(e => e.data);
}

/**
 * 获取指定类型的事件
 */
export function getEventsByType<TCore>(
    state: MatchState<TCore>,
    eventType: string
): GameEvent[] {
    return getEvents(state).filter(e => e.type === eventType);
}

/**
 * 获取最近 N 条日志
 */
export function getRecentLogs<TCore>(
    state: MatchState<TCore>,
    count: number
): LogEntry[] {
    const { entries } = state.sys.log;
    return entries.slice(-count);
}
