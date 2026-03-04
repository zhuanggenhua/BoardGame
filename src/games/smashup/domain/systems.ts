/**
 * 大杀四方 - 专用事件处理系统
 * 
 * 处理领域事件到系统状态的映射：
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续领域事件
 * - 对交互解决产生的事件应用保护过滤和触发链（与 execute() 后处理对齐）
 */

import type { GameEvent, RandomFn } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, SmashUpEvent } from './types';
import { getInteractionHandler } from './abilityInteractionHandlers';
import {
    processDestroyMoveCycle,
    processAffectTriggers,
    filterProtectedReturnEvents,
    filterProtectedDeckBottomEvents,
} from './reducer';
import { interceptEvent } from './ongoingEffects';

// ============================================================================
// SmashUp 事件处理系统
// ============================================================================

/**
 * 创建 SmashUp 事件处理系统
 * 
 * 职责：
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续事件
 */
export function createSmashUpEventSystem(): EngineSystem<SmashUpCore> {
    return {
        id: 'smashup-event-system',
        name: '大杀四方事件处理',
        priority: 50, // 在 InteractionSystem(20) 之后执行

        afterEvents: ({ state, events, random }): HookResult<SmashUpCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];

            for (const event of events) {
                // 监听 SYS_INTERACTION_RESOLVED → 从 sourceId 查找处理函数 → 生成后续事件
                if (event.type === INTERACTION_EVENTS.RESOLVED) {
                    const payload = event.payload as {
                        interactionId: string;
                        playerId: string;
                        optionId: string | null;
                        value: unknown;
                        sourceId?: string;
                        interactionData?: Record<string, unknown>;
                    };
                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;

                    if (payload.sourceId) {
                        const handler = getInteractionHandler(payload.sourceId);
                        if (handler) {
                            const result = handler(
                                newState,
                                payload.playerId,
                                payload.value,
                                payload.interactionData,
                                random,
                                eventTimestamp
                            );
                            
                            if (result) {
                                newState = result.state;
                                // 【关键修复】交互处理函数返回的事件必须经过拦截器过滤
                                // 原因：pipeline.reduceEventsToCore 只处理 execute() 返回的事件，
                                // 而 SmashUpEventSystem.afterEvents 返回的事件走的是系统事件路径，
                                // 不会自动经过 domain.interceptEvent。
                                // 必须在这里手动调用拦截器，确保 tooth_and_claw 等保护机制生效。
                                let rawEvents = result.events as SmashUpEvent[];
                                const interceptedEvents: SmashUpEvent[] = [];
                                for (const evt of rawEvents) {
                                    const interceptResult = interceptEvent(newState.core, evt);
                                    if (interceptResult === null) {
                                        // 事件被吞噬，跳过
                                        continue;
                                    } else if (interceptResult === undefined) {
                                        // 无拦截器匹配，保持原事件
                                        interceptedEvents.push(evt);
                                    } else {
                                        // 事件被替换（如 MINION_RETURNED → ONGOING_DETACHED）
                                        const batch = Array.isArray(interceptResult) ? interceptResult : [interceptResult];
                                        interceptedEvents.push(...batch as SmashUpEvent[]);
                                    }
                                }
                                nextEvents.push(...interceptedEvents);

                                // 补发延迟的 BASE_CLEARED/BASE_REPLACED 事件
                                // afterScoring 基地能力创建交互时，清除事件被延迟到交互解决后发出，
                                // 确保 targetType: 'minion' 的场上点选交互能看到随从
                                const ctx = payload.interactionData?.continuationContext as Record<string, unknown> | undefined;
                                const deferred = ctx?._deferredPostScoringEvents as { type: string; payload: unknown; timestamp: number }[] | undefined;
                                if (deferred && deferred.length > 0) {
                                    // 【关键修复】无论是否有后续交互，都立即设置 flowHalted=true
                                    // 防止 FlowSystem.afterEvents 在交互解决后重新进入 onPhaseExit('scoreBases')
                                    // 导致同一个基地被重复计分（因为 BASE_CLEARED 还没有从 scoringEligibleBaseIndices 中移除基地）
                                    newState.sys.flowHalted = true;
                                    
                                    // 仅在没有后续交互时补发（链式交互需要等最后一个解决后再清除）
                                    if (!newState.sys.interaction?.current && (!newState.sys.interaction?.queue || newState.sys.interaction.queue.length === 0)) {
                                        for (const d of deferred) {
                                            nextEvents.push({ type: d.type, payload: d.payload, timestamp: d.timestamp } as GameEvent);
                                        }
                                    } else {
                                        // 还有后续交互：把 deferred events 传递到下一个交互的 continuationContext
                                        const nextInteraction = newState.sys.interaction.current ?? newState.sys.interaction.queue?.[0];
                                        if (nextInteraction?.data) {
                                            const nextData = nextInteraction.data as Record<string, unknown>;
                                            const nextCtx = (nextData.continuationContext ?? {}) as Record<string, unknown>;
                                            nextCtx._deferredPostScoringEvents = deferred;
                                            nextData.continuationContext = nextCtx;
                                        }
                                    }
                                }
                            }
                        }
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
