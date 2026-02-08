/**
 * 大杀四方 - 专用系统扩展
 * 
 * 处理领域事件到系统状态的映射：
 * 1. PROMPT_CONTINUATION(set) → 创建引擎层 Prompt
 * 2. SYS_PROMPT_RESOLVED → 调用继续函数生成后续领域事件
 */

import type { GameEvent, PromptOption as EnginePromptOption } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { PROMPT_EVENTS, queuePrompt, createPrompt } from '../../../engine/systems/PromptSystem';
import type { SmashUpCore, PromptContinuationEvent } from './types';
import { SU_EVENTS } from './types';
import { resolvePromptContinuation } from './promptContinuation';
import { clearPromptContinuation } from './abilityHelpers';

// ============================================================================
// SmashUp 事件处理系统
// ============================================================================

/**
 * 创建 SmashUp Prompt 桥接系统
 * 
 * 职责：
 * - 监听 PROMPT_CONTINUATION(set) 事件，将 prompt 配置转发到引擎层 PromptSystem
 * - 监听 SYS_PROMPT_RESOLVED 事件，调用继续函数生成后续领域事件
 */
export function createSmashUpPromptBridge(): EngineSystem<SmashUpCore> {
    return {
        id: 'smashup-prompt-bridge',
        name: '大杀四方 Prompt 桥接',
        priority: 50, // 在 PromptSystem(20) 之后执行

        afterEvents: ({ state, events, random }): HookResult<SmashUpCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];

            for (const event of events) {
                // 1. 监听 PROMPT_CONTINUATION(set) → 创建引擎层 Prompt
                if (event.type === SU_EVENTS.PROMPT_CONTINUATION) {
                    const payload = (event as PromptContinuationEvent).payload;
                    if (payload.action === 'set' && payload.continuation) {
                        const cont = payload.continuation;
                        // 从 continuation.data 中提取 prompt 配置
                        const promptConfig = cont.data?.promptConfig as {
                            title: string;
                            options: EnginePromptOption[];
                        } | undefined;

                        if (promptConfig) {
                            const prompt = createPrompt(
                                `su-${cont.abilityId}-${Date.now()}`,
                                cont.playerId,
                                promptConfig.title,
                                promptConfig.options,
                                cont.abilityId, // sourceId
                            );
                            newState = queuePrompt(newState, prompt);
                        }
                    }
                }

                // 2. 监听 SYS_PROMPT_RESOLVED → 调用继续函数
                if (event.type === PROMPT_EVENTS.RESOLVED) {
                    const payload = event.payload as {
                        promptId: string;
                        playerId: string;
                        optionId: string;
                        value: unknown;
                        sourceId?: string;
                    };

                    const continuation = newState.core.pendingPromptContinuation;
                    if (continuation && payload.sourceId === continuation.abilityId) {
                        const continueFn = resolvePromptContinuation(continuation.abilityId);
                        if (continueFn) {
                            const continuationEvents = continueFn({
                                state: newState.core,
                                playerId: continuation.playerId,
                                selectedValue: payload.value,
                                data: continuation.data,
                                random,
                                now: Date.now(),
                            });
                            nextEvents.push(...continuationEvents);
                        }
                        // 清除继续上下文
                        nextEvents.push(clearPromptContinuation(Date.now()));
                    }
                }
            }

            if (newState !== state || nextEvents.length > 0) {
                return {
                    state: newState,
                    events: nextEvents.length > 0 ? nextEvents : undefined,
                };
            }
        },
    };
}
