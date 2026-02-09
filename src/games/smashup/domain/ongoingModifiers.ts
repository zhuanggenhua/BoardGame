/**
 * 大杀四方 - 持续力量修正系统
 *
 * 纯计算层：根据场上状态动态计算随从的力量修正。
 * 不修改状态，只在需要计算力量时调用。
 *
 * 设计原则：
 * - 每个持续能力注册一个 PowerModifierFn
 * - 计算时遍历基地上所有随从，对每个随从调用所有相关修正函数
 * - 修正函数接收当前游戏状态和目标随从信息，返回力量增减值
 */

import type { PlayerId } from '../../../engine/types';
import type { SmashUpCore, MinionOnBase, BaseInPlay } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/** 力量修正上下文 */
export interface PowerModifierContext {
    /** 当前游戏状态 */
    state: SmashUpCore;
    /** 被计算的随从 */
    minion: MinionOnBase;
    /** 随从所在基地索引 */
    baseIndex: number;
    /** 随从所在基地 */
    base: BaseInPlay;
}

/** 力量修正函数：返回力量增减值（正数=加，负数=减） */
export type PowerModifierFn = (ctx: PowerModifierContext) => number;

/** 修正来源信息 */
interface ModifierEntry {
    /** 来源随从 defId（提供修正的随从） */
    sourceDefId: string;
    /** 修正函数 */
    modifier: PowerModifierFn;
}

// ============================================================================
// 注册表
// ============================================================================

/** 持续力量修正注册表 */
const modifierRegistry: ModifierEntry[] = [];

/**
 * 注册一个持续力量修正
 * 
 * @param sourceDefId 提供修正的随从 defId（如 'robot_microbot_alpha'）
 * @param modifier 修正函数
 */
export function registerPowerModifier(
    sourceDefId: string,
    modifier: PowerModifierFn
): void {
    modifierRegistry.push({ sourceDefId, modifier });
}

/** 清空注册表（测试用） */
export function clearPowerModifierRegistry(): void {
    modifierRegistry.length = 0;
}

// ============================================================================
// 力量计算
// ============================================================================

/**
 * 计算随从的持续力量修正总和
 * 
 * 遍历所有注册的修正函数，累加结果。
 * 只有当基地上存在提供修正的随从时，对应修正才生效。
 */
export function getOngoingPowerModifier(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): number {
    if (modifierRegistry.length === 0) return 0;

    const base = state.bases[baseIndex];
    if (!base) return 0;

    let total = 0;
    for (const entry of modifierRegistry) {
        // 检查基地上是否有提供修正的随从（可以是任意基地，取决于修正函数自身逻辑）
        const ctx: PowerModifierContext = { state, minion, baseIndex, base };
        total += entry.modifier(ctx);
    }
    return total;
}

/**
 * 获取随从的有效力量（含持续修正）
 * 
 * = basePower + powerModifier（指示物） + ongoingModifier（持续能力）
 */
export function getEffectivePower(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): number {
    return minion.basePower + minion.powerModifier + getOngoingPowerModifier(state, minion, baseIndex);
}

/**
 * 获取玩家在基地上的总有效力量（含持续修正）
 */
export function getPlayerEffectivePowerOnBase(
    state: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number,
    playerId: PlayerId
): number {
    return base.minions
        .filter(m => m.controller === playerId)
        .reduce((sum, m) => sum + getEffectivePower(state, m, baseIndex), 0);
}

/**
 * 获取基地上的总有效力量（含持续修正）
 */
export function getTotalEffectivePowerOnBase(
    state: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number
): number {
    return base.minions
        .reduce((sum, m) => sum + getEffectivePower(state, m, baseIndex), 0);
}
