import type { MatchState } from '../types';

/** 本地与联网提交共同消费完整快照的随机恢复信号，消费后不再阻塞 Flow。 */
export function consumeRestoredRandomCursor<TCore>(state: MatchState<TCore>, restore: (cursor: number) => void) {
    const value = state.sys.undo.restoredRandomCursor;
    const restoredCursor = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    if (restoredCursor === null) return { state, restoredCursor };
    restore(restoredCursor);
    return { state: { ...state, sys: { ...state.sys, undo: { ...state.sys.undo, restoredRandomCursor: undefined } } }, restoredCursor };
}
