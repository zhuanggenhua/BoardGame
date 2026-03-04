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
// 伤害计算辅助
// ============================================================================

import type { DiceThroneCore, PendingAttack } from './types';
import { getPlayerAbilityBaseDamage } from './abilityLookup';

/**
 * 获取 pendingAttack 的预期总伤害（baseDamage + bonusDamage）
 * 统一查询入口，解决 pendingAttack.damage 经常为 undefined 的问题：
 * - 优先使用 pendingAttack.damage（如果 reducer 已通过 pendingDamageBonus 设置）
 * - 否则从技能定义获取基础伤害（getPlayerAbilityBaseDamage）
 * - 最后加上 bonusDamage（被动卡/攻击修正）
 *
 * @param fallbackWhenNoAbility 无技能时的默认值（默认 0，某些场景需要 1 表示"攻击仍被视为成功"）
 */
export function getPendingAttackExpectedDamage(
    state: DiceThroneCore,
    pendingAttack: PendingAttack,
    fallbackWhenNoAbility: number = 0
): number {
    const { sourceAbilityId, attackerId, bonusDamage } = pendingAttack;

    // 基础伤害：优先 reducer 已设置的值，否则从技能定义查询
    let baseDamage: number;
    if (pendingAttack.damage != null) {
        baseDamage = pendingAttack.damage;
    } else if (sourceAbilityId) {
        baseDamage = getPlayerAbilityBaseDamage(state, attackerId, sourceAbilityId);
    } else {
        baseDamage = fallbackWhenNoAbility;
    }

    return baseDamage + (bonusDamage ?? 0);
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

