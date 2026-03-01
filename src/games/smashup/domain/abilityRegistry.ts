/**
 * 大杀四方 - 能力注册表
 *
 * 以 defId + AbilityTag 为键的函数注册表。
 * 每个派系独立注册能力执行函数，在游戏初始化时调用。
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, AbilityTag } from './types';

// ============================================================================
// 能力执行上下文与结果
// ============================================================================

/** 能力执行上下文 */
export interface AbilityContext {
    state: SmashUpCore;
    /** 完整的 match 状态，用于调用 queueInteraction */
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    /** 随从所在基地 / 行动卡目标基地 */
    baseIndex: number;
    /** 行动卡目标随从 */
    targetMinionUid?: string;
    random: RandomFn;
    now: number;
}

/** 能力执行结果 */
export interface AbilityResult {
    events: SmashUpEvent[];
    /** 如果能力修改了 matchState（如创建了 Interaction），返回更新后的 matchState */
    matchState?: MatchState<SmashUpCore>;
}

/** 能力执行函数签名 */
export type AbilityExecutor = (ctx: AbilityContext) => AbilityResult;

// ============================================================================
// 注册表实现
// ============================================================================

/** 内部存储：defId → Map<AbilityTag, AbilityExecutor> */
const registry = new Map<string, Map<AbilityTag, AbilityExecutor>>();

/** 注册一个能力执行函数 */
export function registerAbility(
    defId: string,
    tag: AbilityTag,
    executor: AbilityExecutor
): void {
    let tagMap = registry.get(defId);
    if (!tagMap) {
        tagMap = new Map();
        registry.set(defId, tagMap);
    }
    tagMap.set(tag, executor);
}

/** 按 defId + tag 解析能力执行函数 */
export function resolveAbility(
    defId: string,
    tag: AbilityTag
): AbilityExecutor | undefined {
    return registry.get(defId)?.get(tag);
}

/** 快捷：解析 onPlay 能力 */
export function resolveOnPlay(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'onPlay');
}

/** 快捷：解析 talent 能力 */
export function resolveTalent(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'talent');
}

/** 快捷：解析 special 能力 */
export function resolveSpecial(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'special');
}

/** 快捷：解析 onDestroy 能力 */
export function resolveOnDestroy(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'onDestroy');
}

/** 检查某 defId 是否注册了指定 tag 的能力 */
export function hasAbility(defId: string, tag: AbilityTag): boolean {
    return registry.get(defId)?.has(tag) ?? false;
}

/** 清空注册表（测试用） */
export function clearRegistry(): void {
    registry.clear();
}

/** 获取注册表大小（调试用） */
export function getRegistrySize(): number {
    let count = 0;
    for (const tagMap of registry.values()) {
        count += tagMap.size;
    }
    return count;
}

/**
 * 为所有 POD 版本的卡牌批量注册能力别名。
 *
 * POD 版 defId 格式为“原版defId + _pod”（如 ninja_master_pod）。
 * 此函数遇历已注册表，将初符合原始形式的 defId 的所有 tag 权限复制给对应的 _pod 版本。
 * 这样无需为每个 POD 卡单独编写能力代码，就能让其自动接继基础版的全套游戏逻辑。
 *
 * 必须在所有功能注册完毕后调用此函数。
 */
export function registerPodAbilityAliases(): void {
    const allEntries = Array.from(registry.entries());

    for (const [defId, tagMap] of allEntries) {
        // 跳过已经是 _pod 和非完整 defId 的条目
        if (defId.endsWith('_pod')) continue;

        const podDefId = `${defId}_pod`;
        // 如果 _pod 版本已经有自己的注册，跳过（不覆盖最新定制)
        if (registry.has(podDefId)) continue;

        const podTagMap = new Map<AbilityTag, AbilityExecutor>();
        for (const [tag, executor] of tagMap.entries()) {
            podTagMap.set(tag, executor);
        }
        registry.set(podDefId, podTagMap);
    }
}

/** 获取所有已注册的 defId::tag 键（用于能力行为审计） */
export function getRegisteredAbilityKeys(): Set<string> {
    const keys = new Set<string>();
    for (const [defId, tagMap] of registry.entries()) {
        for (const tag of tagMap.keys()) {
            keys.add(`${defId}::${tag}`);
        }
    }
    return keys;
}
