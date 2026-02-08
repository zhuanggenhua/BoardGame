/**
 * 大杀四方 - Prompt 继续执行注册表
 *
 * 当能力需要目标选择时：
 * 1. 能力执行器返回 events + prompt 配置
 * 2. execute 生成 PROMPT_CONTINUATION(set) 事件 + 通过 queuePrompt 创建 Prompt
 * 3. 玩家选择后，SYS_PROMPT_RESOLVED 事件触发
 * 4. FlowHooks 读取 pendingPromptContinuation，调用本注册表的继续函数
 * 5. 继续函数生成后续事件，清除 pendingPromptContinuation
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent } from './types';

// ============================================================================
// 继续函数类型
// ============================================================================

/** Prompt 继续执行上下文 */
export interface PromptContinuationCtx {
    state: SmashUpCore;
    playerId: PlayerId;
    /** Prompt 解决后的选择值 */
    selectedValue: unknown;
    /** 存储在 pendingPromptContinuation.data 中的额外上下文 */
    data?: Record<string, unknown>;
    random: RandomFn;
    now: number;
}

/** Prompt 继续执行函数 */
export type PromptContinuationFn = (ctx: PromptContinuationCtx) => SmashUpEvent[];

// ============================================================================
// 注册表
// ============================================================================

const continuationRegistry = new Map<string, PromptContinuationFn>();

/** 注册 Prompt 继续函数 */
export function registerPromptContinuation(
    abilityId: string,
    fn: PromptContinuationFn
): void {
    continuationRegistry.set(abilityId, fn);
}

/** 解析 Prompt 继续函数 */
export function resolvePromptContinuation(
    abilityId: string
): PromptContinuationFn | undefined {
    return continuationRegistry.get(abilityId);
}

/** 清空注册表（测试用） */
export function clearPromptContinuationRegistry(): void {
    continuationRegistry.clear();
}
