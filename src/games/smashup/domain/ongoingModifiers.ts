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
import { getBaseDef, getCardDef } from '../data/cards';

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

/** 临界点修正上下文 */
export interface BreakpointModifierContext {
    /** 当前游戏状态 */
    state: SmashUpCore;
    /** 基地索引 */
    baseIndex: number;
    /** 基地 */
    base: BaseInPlay;
    /** 原始临界点值 */
    originalBreakpoint: number;
}

/** 临界点修正函数：返回增减值（正数=提高临界点，负数=降低） */
export type BreakpointModifierFn = (ctx: BreakpointModifierContext) => number;

/** 临界点修正来源 */
interface BreakpointModifierEntry {
    sourceDefId: string;
    modifier: BreakpointModifierFn;
}

// ============================================================================
// 注册表
// ============================================================================

/** 持续力量修正注册表 */
const modifierRegistry: ModifierEntry[] = [];

/** 持续临界点修正注册表 */
const breakpointModifierRegistry: BreakpointModifierEntry[] = [];

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
    // 去重保护：同一 sourceDefId 只注册一次（防止 HMR 重复注册）
    if (modifierRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    modifierRegistry.push({ sourceDefId, modifier });
}

// ============================================================================
// 声明式 ongoing 力量修正 API（通用，自动按实例数叠加）
// ============================================================================

/** ongoing 卡附着位置 */
type OngoingLocation = 'base' | 'minion';

/** ongoing 卡生效目标 */
type OngoingTarget =
    | 'allMinions'       // 基地上所有随从
    | 'opponentMinions'  // 基地上非 owner 的随从
    | 'ownerMinions'     // 基地上 owner 的随从
    | 'self'             // 被附着的随从自身
    | 'firstOwnerMinion'; // owner 在此基地的第一个随从（用于"总力量+N"效果）

/**
 * 声明式注册 ongoing 力量修正（通用，自动按实例数叠加）
 *
 * 适用于"基地/随从上有 N 张该 ongoing 卡 → 每张给目标 +delta 力量"的标准模式。
 * 计算层自动 filter 实例数并乘以 delta，无需手写查询逻辑。
 *
 * @param defId ongoing 行动卡的 defId
 * @param location 卡附着在基地上还是随从上
 * @param target 修正生效的目标随从范围
 * @param delta 每张卡的力量修正值（正=加，负=减）
 * @param condition 额外生效条件（可选，返回 false 时该张卡不生效）
 */
export function registerOngoingPowerModifier(
    defId: string,
    location: OngoingLocation,
    target: OngoingTarget,
    delta: number,
    condition?: (ctx: PowerModifierContext) => boolean,
): void {
    registerPowerModifier(defId, (ctx: PowerModifierContext) => {
        if (location === 'minion') {
            // 附着在随从上：只对被附着的随从生效
            const count = ctx.minion.attachedActions.filter(a => a.defId === defId).length;
            if (count === 0) return 0;
            if (condition && !condition(ctx)) return 0;
            return count * delta;
        }

        // 附着在基地上
        const cards = ctx.base.ongoingActions.filter(a => a.defId === defId);
        if (cards.length === 0) return 0;

        switch (target) {
            case 'opponentMinions': {
                // 统计 owner 不是当前随从控制者的张数
                const count = cards.filter(a => a.ownerId !== ctx.minion.controller).length;
                if (count === 0) return 0;
                if (condition && !condition(ctx)) return 0;
                return count * delta;
            }
            case 'ownerMinions': {
                // 统计 owner 是当前随从控制者的张数
                const count = cards.filter(a => a.ownerId === ctx.minion.controller).length;
                if (count === 0) return 0;
                if (condition && !condition(ctx)) return 0;
                return count * delta;
            }
            case 'firstOwnerMinion': {
                // 只给 owner 在此基地的第一个随从加成（用于"总力量+N"效果）
                const count = cards.filter(a => a.ownerId === ctx.minion.controller).length;
                if (count === 0) return 0;
                const firstMinion = ctx.base.minions.find(m => m.controller === ctx.minion.controller);
                if (!firstMinion || firstMinion.uid !== ctx.minion.uid) return 0;
                if (condition && !condition(ctx)) return 0;
                return count * delta;
            }
            case 'allMinions': {
                if (condition && !condition(ctx)) return 0;
                return cards.length * delta;
            }
            case 'self':
            default:
                return 0; // 'self' 对基地 ongoing 无意义
        }
    });
}

/**
 * 注册一个临界点修正
 * 
 * @param sourceDefId 提供修正的来源 defId
 * @param modifier 修正函数
 */
export function registerBreakpointModifier(
    sourceDefId: string,
    modifier: BreakpointModifierFn
): void {
    // 去重保护：同一 sourceDefId 只注册一次（防止 HMR 重复注册）
    if (breakpointModifierRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    breakpointModifierRegistry.push({ sourceDefId, modifier });
}

/** 清空所有修正注册表（测试用） */
export function clearPowerModifierRegistry(): void {
    modifierRegistry.length = 0;
    breakpointModifierRegistry.length = 0;
}

/** 获取所有已注册的 sourceDefId（用于能力行为审计） */
export function getRegisteredModifierIds(): {
    powerModifierIds: Set<string>;
    breakpointModifierIds: Set<string>;
} {
    return {
        powerModifierIds: new Set(modifierRegistry.map(e => e.sourceDefId)),
        breakpointModifierIds: new Set(breakpointModifierRegistry.map(e => e.sourceDefId)),
    };
}

// ============================================================================
// 力量计算
// ============================================================================

/** 力量修正明细（单个来源） */
export interface PowerModifierDetail {
    /** 来源随从/卡牌 defId */
    sourceDefId: string;
    /** 显示名称（i18n key，如 cards.xxx.name） */
    sourceName: string;
    /** 修正值 */
    value: number;
}

/**
 * 获取随从的持续力量修正明细列表
 *
 * 与 getOngoingPowerModifier 逻辑一致，但返回每个非零修正的来源信息，
 * 而非仅返回总和。用于 ActionLog breakdown 展示。
 */
export function getOngoingPowerModifierDetails(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): PowerModifierDetail[] {
    if (modifierRegistry.length === 0) return [];

    const base = state.bases[baseIndex];
    if (!base) return [];

    const details: PowerModifierDetail[] = [];
    for (const entry of modifierRegistry) {
        const ctx: PowerModifierContext = { state, minion, baseIndex, base };
        const value = entry.modifier(ctx);
        if (value !== 0) {
            // 通过 getCardDef 获取 i18n 名称，fallback 到 defId
            const cardDef = getCardDef(entry.sourceDefId);
            details.push({
                sourceDefId: entry.sourceDefId,
                sourceName: cardDef?.name ?? entry.sourceDefId,
                value,
            });
        }
    }
    return details;
}

/**
 * 获取随从的完整力量 breakdown
 *
 * 组合基础力量、永久修正、临时修正和持续修正明细。
 * 不修改现有 getEffectivePower 的计算逻辑。
 */
export function getEffectivePowerBreakdown(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): {
    basePower: number;
    powerCounters: number;
    permanentModifier: number;
    tempModifier: number;
    ongoingDetails: PowerModifierDetail[];
    finalPower: number;
} {
    const ongoingDetails = getOngoingPowerModifierDetails(state, minion, baseIndex);
    const ongoingTotal = ongoingDetails.reduce((sum, d) => sum + d.value, 0);
    const counters = minion.powerCounters ?? 0;
    return {
        basePower: minion.basePower,
        powerCounters: counters,
        permanentModifier: minion.powerModifier,
        tempModifier: minion.tempPowerModifier ?? 0,
        ongoingDetails,
        finalPower: Math.max(0, minion.basePower + counters + minion.powerModifier + (minion.tempPowerModifier ?? 0) + ongoingTotal),
    };
}

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
        const ctx: PowerModifierContext = { state, minion, baseIndex, base };
        total += entry.modifier(ctx);
    }
    return total;
}



/**
 * 获取随从的有效力量（含持续修正）
 * 
 * = basePower + powerCounters（力量指示物） + powerModifier（永久修正） + tempPowerModifier（临时，回合结束清零） + ongoingModifier（持续能力）
 */
export function getEffectivePower(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): number {
    // 力量最低为 0（规则：睡眠孢子等负面修正不能使力量低于 0）
    return Math.max(0, minion.basePower + (minion.powerCounters ?? 0) + minion.powerModifier + (minion.tempPowerModifier ?? 0) + getOngoingPowerModifier(state, minion, baseIndex));
}

/**
 * 获取 ongoing 卡上的力量指示物贡献（如 vampire_summon_wolves）
 * 
 * 规则：ongoing 卡的力量指示物无需随从即可生效。
 * 只要玩家有至少 1 点力量（无论来源），就有资格参与计分。
 */
export function getOngoingCardPowerContribution(
    base: BaseInPlay,
    playerId: PlayerId
): number {
    let total = 0;
    for (const oa of base.ongoingActions) {
        if (oa.ownerId !== playerId) continue;
        const counters = (oa.metadata?.powerCounters as number) ?? 0;
        if (counters > 0) total += counters;
    }
    return total;
}

/**
 * 获取玩家在基地上的总有效力量（含持续修正 + ongoing 卡力量贡献）
 */
export function getPlayerEffectivePowerOnBase(
    state: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number,
    playerId: PlayerId
): number {
    const minionPower = base.minions
        .filter(m => m.controller === playerId)
        .reduce((sum, m) => sum + getEffectivePower(state, m, baseIndex), 0);
    return minionPower + getOngoingCardPowerContribution(base, playerId);
}

/**
 * 获取基地上的总有效力量（含持续修正 + ongoing 卡力量贡献）
 */
export function getTotalEffectivePowerOnBase(
    state: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number
): number {
    const minionPower = base.minions
        .reduce((sum, m) => sum + getEffectivePower(state, m, baseIndex), 0);
    // 累加所有玩家的 ongoing 卡力量贡献（不限于有随从的玩家）
    // 修复 Bug：只有 ongoing 卡但没有随从的玩家，其力量贡献也应该计入总力量
    let ongoingBonus = 0;
    for (const pid of Object.keys(state.players)) {
        ongoingBonus += getOngoingCardPowerContribution(base, pid);
    }
    return minionPower + ongoingBonus;
}

/**
 * 获取基地的有效临界点（含持续修正 + 临时修正）
 * 
 * = baseDef.breakpoint + 持续修正 + 临时修正（回合结束清零）
 */
export function getEffectiveBreakpoint(
    state: SmashUpCore,
    baseIndex: number
): number {
    const base = state.bases[baseIndex];
    if (!base) return Infinity;
    const baseDef = getBaseDef(base.defId);
    if (!baseDef) return Infinity;

    let total = 0;
    if (breakpointModifierRegistry.length > 0) {
        for (const entry of breakpointModifierRegistry) {
            const ctx: BreakpointModifierContext = {
                state,
                baseIndex,
                base,
                originalBreakpoint: baseDef.breakpoint,
            };
            total += entry.modifier(ctx);
        }
    }

    // 加上临时临界点修正（如 dino_rampage）
    const tempDelta = state.tempBreakpointModifiers?.[baseIndex] ?? 0;
    return Math.max(0, baseDef.breakpoint + total + tempDelta);
}

/**
 * 获取当前计分阶段中 eligible 的基地索引列表（单一查询入口）。
 *
 * 规则（Wiki Phase 3 Step 4）：一旦基地在进入 scoreBases 阶段时达到 breakpoint，
 * 即使 Me First! 响应窗口中力量被降低到 breakpoint 以下，该基地仍然必定计分。
 *
 * - 如果 `core.scoringEligibleBaseIndices` 存在（进入阶段时锁定），直接返回。
 * - 否则实时计算（正常流程不应走到这里，仅作为安全回退）。
 */
export function getScoringEligibleBaseIndices(state: SmashUpCore): number[] {
    if (state.scoringEligibleBaseIndices && state.scoringEligibleBaseIndices.length > 0) {
        return state.scoringEligibleBaseIndices;
    }
    // 回退：实时计算
    const indices: number[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        const baseDef = getBaseDef(base.defId);
        if (!baseDef) continue;
        const totalPower = getTotalEffectivePowerOnBase(state, base, i);
        if (totalPower >= getEffectiveBreakpoint(state, i)) {
            indices.push(i);
        }
    }
    return indices;
}
