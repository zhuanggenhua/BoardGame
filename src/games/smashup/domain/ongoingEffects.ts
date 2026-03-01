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

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, MinionOnBase } from './types';
import { getBaseDef } from '../data/cards';

// ============================================================================
// 类型定义
// ============================================================================

/** 保护类型 */
export type ProtectionType =
    | 'destroy'       // 不可被消灭
    | 'move'          // 不可被移动
    | 'affect'        // 不受对手卡牌影响（广义保护）
    | 'action';       // 不受对手行动卡影响

/** 基地能力压制检查函数：返回 true 表示该基地能力被压制 */
export type BaseAbilitySuppressionChecker = (state: SmashUpCore, baseIndex: number) => boolean;

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

/**
 * 事件拦截器：替代效果（Replacement Effects）
 *
 * 返回值语义与引擎 interceptEvent 一致：
 * - undefined → 不拦截（继续检查下一个拦截器）
 * - SmashUpEvent / SmashUpEvent[] → 替换
 * - null → 吞噬
 */
export type EventInterceptor = (
    state: SmashUpCore,
    event: SmashUpEvent
) => SmashUpEvent | SmashUpEvent[] | null | undefined;

/** 触发时机 */
export type TriggerTiming =
    | 'onMinionPlayed'     // 随从入场时
    | 'onMinionDestroyed'  // 随从被消灭时
    | 'onMinionMoved'      // 随从被移动时
    | 'onMinionAffected'   // 随从被对手效果影响时（聚合时机：消灭/移动/力量修改/附着/控制权变更）
    | 'onMinionDiscardedFromBase' // 基地结算时随从被弃置（非消灭）
    | 'onTurnEnd'          // 回合结束时
    | 'onTurnStart'        // 回合开始时
    | 'beforeScoring'      // 基地计分前
    | 'afterScoring';      // 基地计分后

/** 影响类型（仅 onMinionAffected 时有值） */
export type AffectType = 'destroy' | 'move' | 'power_change' | 'attach_action';

/** 触发上下文 */
export interface TriggerContext {
    state: SmashUpCore;
    /** 完整的 match 状态，用于调用 queueInteraction（触发器需要创建交互时使用） */
    matchState?: MatchState<SmashUpCore>;
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
    /** 触发事件原因（用于二次分流，如拦截后恢复消灭） */
    reason?: string;
    /** 影响类型（仅 onMinionAffected 时有值） */
    affectType?: AffectType;
    /** 基地计分排名（仅 afterScoring 时有值） */
    rankings?: { playerId: PlayerId; power: number; vp: number }[];
    random: RandomFn;
    now: number;
}

/** 触发回调函数返回值 */
export interface TriggerResult {
    events: SmashUpEvent[];
    /** 如果触发器需要创建交互（如玩家选择），返回更新后的 matchState */
    matchState?: MatchState<SmashUpCore>;
}

/** 触发回调函数：返回产生的事件（和可选的 matchState） */
export type TriggerCallback = (ctx: TriggerContext) => SmashUpEvent[] | TriggerResult;

// ============================================================================
// 拦截器注册条目
// ============================================================================

interface ProtectionEntry {
    /** 提供保护的 ongoing 卡牌或随从 defId */
    sourceDefId: string;
    protectionType: ProtectionType;
    checker: ProtectionChecker;
    /** 消耗型保护：触发后需要消灭来源卡牌（如 trickster_hideout） */
    consumable?: boolean;
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

interface InterceptorEntry {
    sourceDefId: string;
    interceptor: EventInterceptor;
}

// ============================================================================
// 注册表
// ============================================================================

const protectionRegistry: ProtectionEntry[] = [];
const restrictionRegistry: RestrictionEntry[] = [];
const triggerRegistry: TriggerEntry[] = [];
const interceptorRegistry: InterceptorEntry[] = [];
const baseAbilitySuppressionRegistry: { sourceDefId: string; checker: BaseAbilitySuppressionChecker }[] = [];

/** 注册保护拦截器 */
export function registerProtection(
    sourceDefId: string,
    protectionType: ProtectionType,
    checker: ProtectionChecker,
    options?: { consumable?: boolean }
): void {
    // 去重保护：同一 sourceDefId + protectionType 只注册一次（防止 HMR 重复注册）
    if (protectionRegistry.some(e => e.sourceDefId === sourceDefId && e.protectionType === protectionType)) return;
    protectionRegistry.push({ sourceDefId, protectionType, checker, consumable: options?.consumable });
}

/** 注册限制拦截器 */
export function registerRestriction(
    sourceDefId: string,
    restrictionType: RestrictionType,
    checker: RestrictionChecker
): void {
    // 去重保护：同一 sourceDefId + restrictionType 只注册一次（防止 HMR 重复注册）
    if (restrictionRegistry.some(e => e.sourceDefId === sourceDefId && e.restrictionType === restrictionType)) return;
    restrictionRegistry.push({ sourceDefId, restrictionType, checker });
}

/** 注册触发拦截器 */
export function registerTrigger(
    sourceDefId: string,
    timing: TriggerTiming,
    callback: TriggerCallback
): void {
    // 去重保护：同一 sourceDefId + timing 只注册一次（防止 HMR 重复注册）
    if (triggerRegistry.some(e => e.sourceDefId === sourceDefId && e.timing === timing)) return;
    triggerRegistry.push({ sourceDefId, timing, callback });
}

/** 注册事件拦截器（替代效果） */
export function registerInterceptor(
    sourceDefId: string,
    interceptor: EventInterceptor
): void {
    // 去重保护：同一 sourceDefId 只注册一次（防止 HMR 重复注册）
    if (interceptorRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    interceptorRegistry.push({ sourceDefId, interceptor });
}

/** 注册基地能力压制（如 alien_jammed_signal：所有玩家无视此基地能力） */
export function registerBaseAbilitySuppression(
    sourceDefId: string,
    checker: BaseAbilitySuppressionChecker
): void {
    // 去重保护：同一 sourceDefId 只注册一次（防止 HMR 重复注册）
    if (baseAbilitySuppressionRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    baseAbilitySuppressionRegistry.push({ sourceDefId, checker });
}

/** 清空所有注册表（测试用） */
export function clearOngoingEffectRegistry(): void {
    protectionRegistry.length = 0;
    restrictionRegistry.length = 0;
    triggerRegistry.length = 0;
    interceptorRegistry.length = 0;
    baseAbilitySuppressionRegistry.length = 0;
}

/** 获取注册表大小（调试用） */
export function getOngoingEffectRegistrySize(): {
    protection: number;
    restriction: number;
    trigger: number;
    interceptor: number;
} {
    return {
        protection: protectionRegistry.length,
        restriction: restrictionRegistry.length,
        trigger: triggerRegistry.length,
        interceptor: interceptorRegistry.length,
    };
}

/** 获取所有已注册的 sourceDefId（用于能力行为审计） */
export function getRegisteredOngoingEffectIds(): {
    protectionIds: Set<string>;
    restrictionIds: Set<string>;
    triggerIds: Map<string, TriggerTiming[]>;
    interceptorIds: Set<string>;
    baseAbilitySuppressionIds: Set<string>;
} {
    const protectionIds = new Set(protectionRegistry.map(e => e.sourceDefId));
    const restrictionIds = new Set(restrictionRegistry.map(e => e.sourceDefId));
    const interceptorIds = new Set(interceptorRegistry.map(e => e.sourceDefId));
    const baseAbilitySuppressionIds = new Set(baseAbilitySuppressionRegistry.map(e => e.sourceDefId));

    // trigger 需要保留 timing 信息，用于更精确的审计
    const triggerIds = new Map<string, TriggerTiming[]>();
    for (const entry of triggerRegistry) {
        const existing = triggerIds.get(entry.sourceDefId) ?? [];
        existing.push(entry.timing);
        triggerIds.set(entry.sourceDefId, existing);
    }

    return { protectionIds, restrictionIds, triggerIds, interceptorIds, baseAbilitySuppressionIds };
}


// ============================================================================
// 查询 API
// ============================================================================

/**
 * 检查基地能力是否被压制
 *
 * 遍历所有基地能力压制注册器，只要有一个返回 true 就表示被压制。
 * 用于 alien_jammed_signal 等"无视基地能力"效果。
 */
export function isBaseAbilitySuppressed(
    state: SmashUpCore,
    baseIndex: number
): boolean {
    if (baseAbilitySuppressionRegistry.length === 0) return false;
    for (const entry of baseAbilitySuppressionRegistry) {
        if (!isSourceActiveOnBase(state, entry.sourceDefId, baseIndex)) continue;
        if (entry.checker(state, baseIndex)) return true;
    }
    return false;
}

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
 * 检查随从是否受到非消耗型保护（用于目标选择过滤）
 *
 * 消耗型保护（如 tooth_and_claw）不应在目标选择阶段过滤，
 * 而应在事件产生后通过 filterProtectedDestroyEvents 消耗处理。
 */
export function isMinionProtectedNonConsumable(
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
        if (entry.consumable) continue; // 跳过消耗型保护
        if (!isSourceActive(state, entry.sourceDefId)) continue;
        if (entry.checker(ctx)) return true;
    }
    return false;
}

/**
 * 查找消耗型保护来源卡牌
 *
 * 当 isMinionProtected 返回 true 且保护来源是消耗型（如 trickster_hideout），
 * 返回需要消灭的 ongoing 卡牌信息，供调用方发射 ONGOING_DETACHED 事件。
 * 非消耗型保护返回 undefined。
 */
export function getConsumableProtectionSource(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType
): { uid: string; defId: string; ownerId: string } | undefined {
    if (protectionRegistry.length === 0) return undefined;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType,
    };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (!entry.consumable) continue;
        if (!isSourceActive(state, entry.sourceDefId)) continue;
        if (!entry.checker(ctx)) continue;
        // 找到消耗型保护来源，查找具体的 ongoing 卡牌实例
        const base = state.bases[targetBaseIndex];
        if (!base) continue;
        // 先检查随从附着
        const attached = targetMinion.attachedActions.find(a => a.defId === entry.sourceDefId);
        if (attached) return { uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId };
        // 再检查基地 ongoing
        const ongoing = base.ongoingActions.find(o => o.defId === entry.sourceDefId);
        if (ongoing) return { uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId };
    }
    return undefined;
}

/**
 * 检查操作是否被限制
 *
 * 两层检查：
 * 1. 基地定义上的 restrictions（数据驱动，自动解析）
 * 2. ongoing 效果注册表（行动卡/随从的拦截器）
 */
export function isOperationRestricted(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
    restrictionType: RestrictionType,
    extra?: Record<string, unknown>
): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;

    // 1. 基地定义上的限制规则（数据驱动）
    const baseDef = getBaseDef(base.defId);
    if (baseDef?.restrictions) {
        for (const r of baseDef.restrictions) {
            if (r.type !== restrictionType) continue;
            // 无条件限制
            if (!r.condition) return true;
            // 条件限制：maxPower（力量 <= maxPower 的随从被禁止）
            if (r.condition.maxPower !== undefined && restrictionType === 'play_minion') {
                const basePower = extra?.basePower as number | undefined;
                if (basePower !== undefined && basePower <= r.condition.maxPower) return true;
            }
            // 条件限制：extraPlayMinionPowerMax（额外出牌时力量 > limit 的随从被禁止）
            if (r.condition.extraPlayMinionPowerMax !== undefined && restrictionType === 'play_minion') {
                const basePower = extra?.basePower as number | undefined;
                const minionsPlayed = state.players[playerId]?.minionsPlayed ?? 0;
                // 仅在使用额外出牌机会时生效（已打出 >= 1 个随从）
                if (minionsPlayed >= 1 && basePower !== undefined && basePower > r.condition.extraPlayMinionPowerMax) {
                    return true;
                }
            }
            // 条件限制：minionPlayLimitPerTurn（每回合每位玩家在此基地打出随从上限）
            if (r.condition.minionPlayLimitPerTurn !== undefined && restrictionType === 'play_minion') {
                const player = state.players[playerId];
                const playedAtBase = player?.minionsPlayedPerBase?.[baseIndex] ?? 0;
                if (playedAtBase >= r.condition.minionPlayLimitPerTurn) {
                    return true;
                }
            }
        }
    }

    // 2. ongoing 效果注册表（行动卡/随从的拦截器）
    if (restrictionRegistry.length > 0) {
        const ctx: RestrictionCheckContext = {
            state,
            baseIndex,
            playerId,
            restrictionType,
            extra,
        };
        for (const entry of restrictionRegistry) {
            if (entry.restrictionType !== restrictionType) continue;
            if (!isSourceActiveOnBase(state, entry.sourceDefId, baseIndex)) continue;
            if (entry.checker(ctx)) return true;
        }
    }

    return false;
}

/**
 * 执行事件拦截：遍历注册的拦截器，第一个返回非 undefined 的结果生效
 *
 * 返回值：
 * - undefined → 无拦截器匹配
 * - SmashUpEvent / SmashUpEvent[] → 替换
 * - null → 吞噬
 */
export function interceptEvent(
    state: SmashUpCore,
    event: SmashUpEvent
): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (interceptorRegistry.length === 0) return undefined;

    for (const entry of interceptorRegistry) {
        if (!isSourceActive(state, entry.sourceDefId)) continue;
        const result = entry.interceptor(state, event);
        if (result !== undefined) return result;
    }
    return undefined;
}

/**
 * 触发指定时机的所有拦截器
 *
 * 返回所有触发器产生的事件和可选的 matchState。
 */
export function fireTriggers(
    state: SmashUpCore,
    timing: TriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>
): TriggerResult {
    if (triggerRegistry.length === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    const fullCtx: TriggerContext = { ...ctx, timing };

    for (const entry of triggerRegistry) {
        if (entry.timing !== timing) continue;
        if (!isSourceActive(state, entry.sourceDefId)) continue;
        const result = entry.callback({ ...fullCtx, matchState });
        const triggerEvents = Array.isArray(result) ? result : result.events;
        if (triggerEvents.length > 0) {
            events.push(...triggerEvents);
        }
        if (!Array.isArray(result) && result.matchState) {
            matchState = result.matchState;
        }
    }
    return { events, matchState };
}

// ============================================================================
// 内部辅助
// ============================================================================

/**
 * 检查拦截器来源是否在场上活跃
 *
 * 来源可以是：
 * 1. 基地本身（base.defId）
 * 2. 基地上的 ongoing 行动卡（ongoingActions 中的 defId）
 * 3. 基地上的随从（minions 中的 defId，且有 ongoing 能力标签）
 * 4. 随从上附着的 ongoing 行动卡（attachedActions 中的 defId）
 */
function isSourceActive(state: SmashUpCore, sourceDefId: string): boolean {
    if (state.pendingAfterScoringSpecials?.some(s => s.sourceDefId === sourceDefId)) {
        return true;
    }
    for (const base of state.bases) {
        // 检查基地本身
        if (base.defId === sourceDefId) return true;
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

/**
 * 检查拦截器来源是否在指定基地上活跃
 * 用于基地自身的限制效果
 */
export function isSourceActiveOnBase(state: SmashUpCore, sourceDefId: string, baseIndex: number): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;
    // 检查基地本身
    if (base.defId === sourceDefId) return true;
    // 检查基地上的 ongoing 行动卡
    if (base.ongoingActions.some(o => o.defId === sourceDefId)) return true;
    // 检查基地上的随从
    if (base.minions.some(m => m.defId === sourceDefId)) return true;
    return false;
}

// ============================================================================
// 基地限制信息查询（UI 层使用）
// ============================================================================

/** 基地限制信息（用于 UI 显示） */
export interface BaseRestrictionInfo {
    /** 限制类型 */
    type: 'blocked_faction' | 'blocked_action';
    /** 显示文本（如派系名称） */
    displayText: string;
    /** 来源卡牌 defId */
    sourceDefId: string;
}

/**
 * 获取基地上的所有限制信息（用于 UI 显示）
 *
 * @param state 当前游戏状态
 * @param baseIndex 基地索引
 * @returns 限制信息数组
 */
export function getBaseRestrictions(state: SmashUpCore, baseIndex: number): BaseRestrictionInfo[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const restrictions: BaseRestrictionInfo[] = [];

    // 检查 Block the Path（封路）
    const blockAction = base.ongoingActions.find(o => o.defId === 'trickster_block_the_path');
    if (blockAction) {
        const blockedFaction = blockAction.metadata?.blockedFaction as string | undefined;
        if (blockedFaction) {
            // 导入 FACTION_DISPLAY_NAMES 会造成循环依赖，所以这里直接使用 factionId
            // UI 层会通过 i18n 或 FACTION_DISPLAY_NAMES 转换显示名称
            restrictions.push({
                type: 'blocked_faction',
                displayText: blockedFaction,
                sourceDefId: 'trickster_block_the_path',
            });
        }
    }

    // 未来可以在这里添加其他限制类型（如 Ornate Dome 禁止打行动卡）
    // const domeAction = base.ongoingActions.find(o => o.defId === 'steampunk_ornate_dome');
    // if (domeAction) {
    //     restrictions.push({
    //         type: 'blocked_action',
    //         displayText: 'action',
    //         sourceDefId: 'steampunk_ornate_dome',
    //     });
    // }

    return restrictions;
}
