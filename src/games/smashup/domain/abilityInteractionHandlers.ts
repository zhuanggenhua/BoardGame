/**
 * 大杀四方 - 交互处理函数注册表
 *
 * 当能力需要玩家交互时：
 * 1. 能力执行器直接调用 createSimpleChoice() 创建交互
 * 2. 能力执行器直接调用 queueInteraction() 将交互加入队列
 * 3. 玩家选择后，SYS_INTERACTION_RESOLVED 事件触发
 * 4. SmashUpEventSystem 从 sourceId 查找本注册表的处理函数
 * 5. 处理函数生成后续事件
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import { getBaseDef, getCardDef, getTitanDef } from '../data/cards';
import type { SmashUpCore, SmashUpEvent } from './types';
import { getAbilityRuntimePromptHandler, getRegisteredAbilityRuntimePromptIds } from './abilityRuntime';
import { shouldGenerateSmashUpPodAlias } from './variantBindingRuntime';

// ============================================================================
// 交互处理函数类型
// ============================================================================

/** 交互处理函数 */
export type InteractionHandler = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;

// ============================================================================
// 注册表
// ============================================================================

const interactionHandlers = new Map<string, InteractionHandler>();
const generatedPodInteractionAliasIds = new Set<string>();

type InteractionHandlerRegistration =
    | string
    | {
        sourceId: string;
    };

/** 注册交互处理函数 */
export function registerInteractionHandler(
    source: InteractionHandlerRegistration,
    handler: InteractionHandler
): void {
    const sourceId = typeof source === 'string' ? source : source.sourceId;
    interactionHandlers.set(sourceId, handler);
}

/** 解析交互处理函数 */
export function getInteractionHandler(
    sourceId: string
): InteractionHandler | undefined {
    const registered = interactionHandlers.get(sourceId);
    if (registered) return registered;

    const runtimePromptHandler = getAbilityRuntimePromptHandler(sourceId);
    if (!runtimePromptHandler) return undefined;

    return (
        state: MatchState<SmashUpCore>,
        playerId: PlayerId,
        value: unknown,
        interactionData: Record<string, unknown> | undefined,
        random: RandomFn,
        timestamp: number,
    ) => runtimePromptHandler(state, playerId, value, interactionData, random, timestamp);
}

/** 清空注册表（测试用） */
export function clearInteractionHandlers(): void {
    interactionHandlers.clear();
    generatedPodInteractionAliasIds.clear();
}

/** 获取注册表大小（调试用） */
export function getInteractionHandlersSize(): number {
    return interactionHandlers.size;
}

/** 获取所有已注册的 handler sourceId（用于交互完整性审计） */
export function getRegisteredInteractionHandlerIds(): Set<string> {
    const ids = new Set<string>();
    for (const id of interactionHandlers.keys()) {
        if (shouldHideGeneratedPodInteractionAlias(id)) continue;
        ids.add(id);
    }
    for (const id of getRegisteredAbilityRuntimePromptIds()) {
        ids.add(id);
    }
    return ids;
}

/**
 * 为所有 POD 版本的卡牌批量注册 InteractionHandler 别名。
 *
 * InteractionHandler sourceId 通常与 defId 相同（如 ninja_master）。
 * 此函数遍历注册表，将每个 sourceId 复制给其对应的 _pod 版本。
 * 必须在所有 InteractionHandler 注册完毕后调用。
 */
export function registerPodInteractionAliases(): void {
    const allEntries = Array.from(interactionHandlers.entries());

    for (const [sourceId, handler] of allEntries) {
        if (sourceId.endsWith('_pod') || sourceId.includes('_pod_')) continue;
        if (sourceId.startsWith('titan_')) continue;
        if (!shouldGenerateSmashUpPodAlias('interaction', sourceId)) continue;

        const podSourceId = `${sourceId}_pod`;
        // 如果已存在则不覆盖
        if (interactionHandlers.has(podSourceId)) continue;

        interactionHandlers.set(podSourceId, handler);
        generatedPodInteractionAliasIds.add(podSourceId);
    }
}

function shouldHideGeneratedPodInteractionAlias(sourceId: string): boolean {
    if (!sourceId.endsWith('_pod')) return false;
    if (!generatedPodInteractionAliasIds.has(sourceId)) return false;
    return !getCardDef(sourceId) && !getBaseDef(sourceId) && !getTitanDef(sourceId);
}
