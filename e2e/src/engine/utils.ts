/**
 * 引擎通用工具函数
 */

import type { MatchState } from './types';

export const resolveCommandTimestamp = (command?: { timestamp?: number }): number =>
    typeof command?.timestamp === 'number' ? command.timestamp : 0;

export const resolveEventTimestamp = (event?: { timestamp?: number }): number =>
    typeof event?.timestamp === 'number' ? event.timestamp : 0;

export const resolveNextCommandTimestamp = <TCore>(state: MatchState<TCore>): number => {
    const entries = state.sys?.log?.entries ?? [];
    const last = entries[entries.length - 1];
    const lastTimestamp = typeof last?.timestamp === 'number' ? last.timestamp : -1;
    return lastTimestamp + 1;
};
