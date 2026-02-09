/**
 * 大杀四方 - 能力注册表
 *
 * 以 defId + AbilityTag 为键的函数注册表。
 * 每个派系独立注册能力执行函数，在游戏初始化时调用。
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, AbilityTag, PromptConfig } from './types';

// ============================================================================
// 能力执行上下文与结果
// ============================================================================

/** 能力执行上下文 */
export interface AbilityContext {
    state: SmashUpCore;
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
    /** 需要 Prompt 时返回 prompt 配置 */
    prompt?: PromptConfig;
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
