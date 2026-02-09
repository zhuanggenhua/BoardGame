/**
 * 大杀四方 - 持续效果拦截框架
 *
 * 三种拦截器类型：
 * 1. protection - 保护随从不受特定影响（如不可被消灭、不受对手行动影响）
 * 2. restriction - 限制操作（如禁止打出随从到某基地、禁止打行动卡）
 * 3. trigger - 事件触发回调（如随从入场时消灭、回合结束时抽牌）
 *
 * 拦截器按 defId 注册，运行时根据场上 ongoing 行动卡和随从能力查询。
 * 纯函数设计：查询时传入当前状态，不持有可变状态。
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, MinionOnBase } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/** 保护类型 */
export type ProtectionType =
    | 'destroy'       // 不可被消灭
    | 'move'          // 不可被移动
    | 'affect'        // 不受对手卡牌影响（广义保护）
    | 'action';       // 不受对手行动卡影响

/** 保护检查上下文 */
export interface ProtectionCheckContext {
    state: SmashUpCore;
    /** 被保护的随从 */
    targetMinion: MinionOnBase;
    /** 随从所在基地索引 */
    targetBaseIndex: number;
    /** 发起影响的玩家（攻击者） */
    sourcePlayerId: PlayerId;
    /** 保护类型 */
    protectionType: ProtectionType;
}

/** 保护检查函数：返回 true 表示该随从受保护 */
export type ProtectionChecker = (ctx: ProtectionCheckContext) => boolean;

/** 限制类型 */
export type RestrictionType =
    | 'play_minion'   // 禁止打出随从到某基地
    | 'play_action';  // 禁止打出行动卡到某基地

/** 限制检查上下文 */
export interface RestrictionCheckContext {
    state: SmashUpCore;
    /** 被限制的基地索引 */
    baseIndex: number;
    /** 尝试操作的玩家 */
    playerId: PlayerId;
    /** 限制类型 */
    restrictionType: RestrictionType;
    /** 额外数据（如卡牌 defId、派系等） */
    extra?: Record<string, unknown>;
}

/** 限制检查函数：返回 true 表示操作被限制 */
export type RestrictionChecker = (ctx: RestrictionCheckContext) => boolean;

/** 触发时机 */
export type TriggerTiming =
    | 'onMinionPlayed'     // 随从入场时
    | 'onMinionDestroyed'  // 随从被消灭时
    | 'onTurnEnd'          // 回合结束时
    | 'onTurnStart';       // 回合开始时

/** 触发上下文 */
export interface TriggerContext {
    state: SmashUpCore;
    timing: TriggerTiming;
    /** 触发相关的玩家 */
    playerId: PlayerId;
    /** 触发相关的基地索引 */
    baseIndex?: number;
    /** 触发相关的随从（如入场/被消灭的随从） */
    triggerMinion?: MinionOnBase;
    /** 触发相关的随从 UID */
    triggerMinionUid?: string;
    /** 触发相关的随从 defId */
    triggerMinionDefId?: string;
    random: RandomFn;
    now: number;
}

/** 触发回调函数：返回产生的事件 */
export type TriggerCallback = (ctx: TriggerContext) => SmashUpEvent[];

// ============================================================================
// 拦截器注册条目
// ============================================================================

interface ProtectionEntry {
    /** 提供保护的 ongoing 卡牌或随从 defId */
    sourceDefId: string;
    protectionType: ProtectionType;
    checker: ProtectionChecker;
}

interface RestrictionEntry {
    sourceDefId: string;
    restrictionType: RestrictionType;
    checker: RestrictionChecker;
}

interface TriggerEntry {
    sourceDefId: string;
    timing: TriggerTiming;
    callback: TriggerCallback;
}

// ============================================================================
// 注册表
// ============================================================================

const protectionRegistry: ProtectionEntry[] = [];
const restrictionRegistry: RestrictionEntry[] = [];
const triggerRegistry: TriggerEntry[] = [];

/** 注册保护拦截器 */
export function registerProtection(
    sourceDefId: string,
    protectionType: ProtectionType,
    checker: ProtectionChecker
): void {
    protectionRegistry.push({ sourceDefId, protectionType, checker });
}

/** 注册限制拦截器 */
export function registerRestriction(
    sourceDefId: string,
    restrictionType: RestrictionType,
    checker: RestrictionChecker
): void {
    restrictionRegistry.push({ sourceDefId, restrictionType, checker });
}

/** 注册触发拦截器 */
export function registerTrigger(
    sourceDefId: string,
    timing: TriggerTiming,
    callback: TriggerCallback
): void {
    triggerRegistry.push({ sourceDefId, timing, callback });
}

/** 清空所有注册表（测试用） */
export function clearOngoingEffectRegistry(): void {
    protectionRegistry.length = 0;
    restrictionRegistry.length = 0;
    triggerRegistry.length = 0;
}

/** 获取注册表大小（调试用） */
export function getOngoingEffectRegistrySize(): {
    protection: number;
    restriction: number;
    trigger: number;
} {
    return {
        protection: protectionRegistry.length,
        restriction: restrictionRegistry.length,
        trigger: triggerRegistry.length,
    };
}


// ============================================================================
// 查询 API
// ============================================================================

/**
 * 检查随从是否受保护
 *
 * 遍历所有保护拦截器，只要有一个返回 true 就表示受保护。
 * 只有当场上存在提供保护的 ongoing 卡牌或随从时，对应拦截器才生效。
 */
export function isMinionProtected(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType
): boolean {
    if (protectionRegistry.length === 0) return false;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType,
    };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        // 检查场上是否有提供保护的来源（ongoing 卡或随从）
        if (!isSourceActive(state, entry.sourceDefId)) continue;
        if (entry.checker(ctx)) return true;
    }
    return false;
}

/**
 * 检查操作是否被限制
 *
 * 遍历所有限制拦截器，只要有一个返回 true 就表示被限制。
 */
export function isOperationRestricted(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
    restrictionType: RestrictionType,
    extra?: Record<string, unknown>
): boolean {
    if (restrictionRegistry.length === 0) return false;

    const ctx: RestrictionCheckContext = {
        state,
        baseIndex,
        playerId,
        restrictionType,
        extra,
    };

    for (const entry of restrictionRegistry) {
        if (entry.restrictionType !== restrictionType) continue;
        if (!isSourceActive(state, entry.sourceDefId)) continue;
        if (entry.checker(ctx)) return true;
    }
    return false;
}

/**
 * 触发指定时机的所有拦截器
 *
 * 返回所有触发器产生的事件。
 */
export function fireTriggers(
    state: SmashUpCore,
    timing: TriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>
): SmashUpEvent[] {
    if (triggerRegistry.length === 0) return [];

    const events: SmashUpEvent[] = [];
    const fullCtx: TriggerContext = { ...ctx, timing };

    for (const entry of triggerRegistry) {
        if (entry.timing !== timing) continue;
        if (!isSourceActive(state, entry.sourceDefId)) continue;
        const result = entry.callback(fullCtx);
        events.push(...result);
    }
    return events;
}

// ============================================================================
// 内部辅助
// ============================================================================

/**
 * 检查拦截器来源是否在场上活跃
 *
 * 来源可以是：
 * 1. 基地上的 ongoing 行动卡（ongoingActions 中的 defId）
 * 2. 基地上的随从（minions 中的 defId，且有 ongoing 能力标签）
 * 3. 随从上附着的 ongoing 行动卡（attachedActions 中的 defId）
 */
function isSourceActive(state: SmashUpCore, sourceDefId: string): boolean {
    for (const base of state.bases) {
        // 检查基地上的 ongoing 行动卡
        if (base.ongoingActions.some(o => o.defId === sourceDefId)) return true;
        // 检查基地上的随从
        if (base.minions.some(m => m.defId === sourceDefId)) return true;
        // 检查随从上附着的行动卡
        for (const m of base.minions) {
            if (m.attachedActions.some(a => a.defId === sourceDefId)) return true;
        }
    }
    return false;
}
