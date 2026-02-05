/**
 * 事件流系统
 * 
 * 记录可消费的事件序列，用于动画/音效等实时触发。
 * 与 LogSystem 解耦，避免日志重建导致的重复触发。
 */

import type { EventStreamEntry, EventStreamState, GameEvent, MatchState } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// 事件流系统配置
// ============================================================================

export interface EventStreamSystemConfig {
    /** 最大事件条目数 */
    maxEntries?: number;
}

// ============================================================================
// 创建事件流系统
// ============================================================================

export function createEventStreamSystem<TCore>(
    config: EventStreamSystemConfig = {}
): EngineSystem<TCore> {
    const { maxEntries = 200 } = config;

    return {
        id: SYSTEM_IDS.EVENT_STREAM,
        name: '事件流系统',
        priority: 5,

        setup: (): Partial<{ eventStream: EventStreamState }> => ({
            eventStream: {
                entries: [],
                maxEntries,
                nextId: 1,
            },
        }),

        afterEvents: ({ state, events }): HookResult<TCore> | void => {
            if (!events || events.length === 0) return;

            const currentStream = state.sys.eventStream ?? {
                entries: [],
                maxEntries,
                nextId: 1,
            };
            const normalizedMaxEntries = Number.isFinite(currentStream.maxEntries)
                ? currentStream.maxEntries
                : maxEntries;

            let nextId = currentStream.nextId ?? 1;
            const entries = [...currentStream.entries];

            for (const event of events as GameEvent[]) {
                entries.push({ id: nextId, event });
                nextId += 1;
            }

            while (entries.length > normalizedMaxEntries) {
                entries.shift();
            }

            return {
                state: {
                    ...state,
                    sys: {
                        ...state.sys,
                        eventStream: {
                            entries,
                            maxEntries: normalizedMaxEntries,
                            nextId,
                        },
                    },
                },
            };
        },
    };
}

// ============================================================================
// 查询辅助函数
// ============================================================================

export function getEventStreamEntries<TCore>(state: MatchState<TCore>): EventStreamEntry[] {
    return state.sys.eventStream?.entries ?? [];
}
