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
                                // 交互处理函数返回的事件会由 pipeline 的 postProcessSystemEvents 统一处理
                                // （包括 processDestroyMoveCycle、保护过滤、触发链等）
                                // 这里只需要直接返回事件，避免重复处理导致 onDestroy 等触发器被调用两次
                                const rawEvents = result.events as SmashUpEvent[];
                                nextEvents.push(...rawEvents);

                                // 补发延迟的 BASE_CLEARED/BASE_REPLACED 事件
                                // afterScoring 基地能力创建交互时，清除事件被延迟到交互解决后发出，
                                // 确保 targetType: 'minion' 的场上点选交互能看到随从
                                const ctx = payload.interactionData?.continuationContext as Record<string, unknown> | undefined;
                                const deferred = ctx?._deferredPostScoringEvents as { type: string; payload: unknown; timestamp: number }[] | undefined;
                                if (deferred && deferred.length > 0) {
                                    console.log('[SmashUpEventSystem] 发现延迟事件:', {
                                        count: deferred.length,
                                        types: deferred.map(d => d.type),
                                        hasInteraction: !!newState.sys.interaction?.current,
                                        queueLength: newState.sys.interaction?.queue?.length ?? 0,
                                    });
                                    
                                    // 仅在没有后续交互时补发（链式交互需要等最后一个解决后再清除）
                                    if (!newState.sys.interaction?.current && (!newState.sys.interaction?.queue || newState.sys.interaction.queue.length === 0)) {
                                        console.log('[SmashUpEventSystem] 无后续交互，发射延迟事件并设置 flowHalted=true');
                                        
                                        // 【修复】补发延迟事件前，先设置 flowHalted=true 标志
                                        // 防止 FlowSystem.afterEvents 在 BASE_CLEARED/BASE_REPLACED 后重新进入计分逻辑
                                        // （BASE_CLEARED 会从 scoringEligibleBaseIndices 中移除基地，但如果 FlowSystem
                                        // 在 BASE_CLEARED reduce 前就重新进入 onPhaseExit，会使用旧的 eligible 列表重复计分）
                                        newState.sys.flowHalted = true;
                                        
                                        for (const d of deferred) {
                                            nextEvents.push({ type: d.type, payload: d.payload, timestamp: d.timestamp } as GameEvent);
                                        }
                                    } else {
                                        console.log('[SmashUpEventSystem] 有后续交互，传递延迟事件到下一个交互');
                                        
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
