/**
 * Cardia - 交互处理函数注册表
 *
 * 当能力需要玩家交互时：
 * 1. 能力执行器创建交互并返回
 * 2. 交互被包装并加入队列
 * 3. 玩家选择后，SYS_INTERACTION_RESOLVED 事件触发
 * 4. CardiaEventSystem 从 sourceId 查找本注册表的处理函数
 * 5. 处理函数生成后续事件
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type { CardiaCore, CardiaEvent } from './core-types';

// ============================================================================
// 交互处理函数类型
// ============================================================================

/** 交互处理函数 */
export type InteractionHandler = (
    state: MatchState<CardiaCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
) => { 
    state: MatchState<CardiaCore>; 
    events: CardiaEvent[];
    interaction?: any;  // 可选的新交互（用于多步交互）
} | undefined;

// ============================================================================
// 注册表
// ============================================================================

const interactionHandlers = new Map<string, InteractionHandler>();

/** 注册交互处理函数 */
export function registerInteractionHandler(
    sourceId: string,
    handler: InteractionHandler
): void {
    interactionHandlers.set(sourceId, handler);
}

/** 解析交互处理函数 */
export function getInteractionHandler(
    sourceId: string
): InteractionHandler | undefined {
    return interactionHandlers.get(sourceId);
}

/** 清空注册表（测试用） */
export function clearInteractionHandlers(): void {
    interactionHandlers.clear();
}

/** 获取注册表大小（调试用） */
export function getInteractionHandlersSize(): number {
    return interactionHandlers.size;
}

/** 获取所有已注册的 handler sourceId（用于交互完整性审计） */
export function getRegisteredInteractionHandlerIds(): Set<string> {
    return new Set(interactionHandlers.keys());
}
