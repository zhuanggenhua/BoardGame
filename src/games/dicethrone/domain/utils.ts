/**
 * DiceThrone 领域工具函数
 * 共享辅助函数，消除跨文件重复
 */

// ============================================================================
// 状态更新辅助
// ============================================================================

/**
 * 从数组中按 ID 移除元素（结构共享）
 * @returns [被移除的元素, 剩余数组] — 未找到时返回 [undefined, 原数组引用]
 */
export function removeCard<T extends { id: string }>(array: readonly T[], cardId: string): [T | undefined, T[]] {
    const index = array.findIndex(c => c.id === cardId);
    if (index === -1) return [undefined, array as T[]];
    return [array[index], [...array.slice(0, index), ...array.slice(index + 1)]];
}
/**
 * 按事件序列应用 reducer（纯函数，避免重复实现）
 */
export function applyEvents<TState, TEvent>(
    state: TState,
    events: TEvent[],
    reduce: (current: TState, event: TEvent) => TState
): TState {
    return events.reduce((current, event) => reduce(current, event), state);
}

// ============================================================================
// 游戏模式
// ============================================================================

export type GameModeHost = { __BG_GAME_MODE__?: string };

/**
 * 获取当前游戏模式（tutorial / local / undefined）
 */
export const getGameMode = (): string | undefined => (
    typeof globalThis !== 'undefined'
        ? (globalThis as GameModeHost).__BG_GAME_MODE__
        : undefined
);

