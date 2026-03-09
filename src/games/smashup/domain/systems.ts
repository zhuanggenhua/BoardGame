/**
 * 大杀四方 - 专用事件处理系统
 * 
 * 处理领域事件到系统状态的映射：
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续领域事件
 * - 对交互解决产生的事件应用保护过滤和触发链（与 execute() 后处理对齐）
 */

import type { GameEvent, RandomFn } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { INTERACTION_EVENTS, resolveInteraction } from '../../../engine/systems/InteractionSystem';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import type { SmashUpCore, SmashUpEvent, MinionPlayedEvent, PendingPostScoringAction } from './types';
import { getInteractionHandler } from './abilityInteractionHandlers';
import {
    processDestroyMoveCycle,
    processAffectTriggers,
    filterProtectedReturnEvents,
    filterProtectedDeckBottomEvents,
} from './reducer';
import { buildValidatedMoveEvents } from './abilityHelpers';
import { interceptEvent } from './ongoingEffects';
import { triggerExtendedBaseAbility } from './baseAbilities';
import type { BaseClearedEvent, BaseReplacedEvent } from './events';
import { SU_EVENT_TYPES } from './events';

// ============================================================================
// SmashUp 事件处理系统
// ============================================================================

function buildPendingPostScoringActionEvents(
    state: { core: SmashUpCore },
    actions: PendingPostScoringAction[],
    timestamp: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (const action of actions) {
        if (action.kind === 'playMinionOnReplacementBase') {
            const player = state.core.players[action.playerId];
            const cardStillInDeck = player?.deck.some(card =>
                card.uid === action.cardUid
                && card.defId === action.defId
                && card.type === 'minion',
            );
            if (!player || !cardStillInDeck) {
                continue;
            }
            events.push({
                type: SU_EVENT_TYPES.MINION_PLAYED,
                payload: {
                    playerId: action.playerId,
                    cardUid: action.cardUid,
                    defId: action.defId,
                    baseIndex: action.baseIndex,
                    baseDefId: action.targetBaseDefId,
                    power: action.power,
                    fromDeck: true,
                    consumesNormalLimit: false,
                },
                timestamp,
            } as MinionPlayedEvent);
            continue;
        }

        events.push(...buildValidatedMoveEvents(state as any, {
            minionUid: action.minionUid,
            minionDefId: action.minionDefId,
            fromBaseIndex: action.fromBaseIndex,
            toBaseIndex: action.toBaseIndex,
            reason: action.reason,
            now: timestamp,
        }));
    }
    return events;
}

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
                // 监听 RESPONSE_WINDOW_CLOSED → 补发 afterScoring 延迟事件
                if (event.type === RESPONSE_WINDOW_EVENTS.CLOSED) {
                    const payload = event.payload as {
                        windowId: string;
                        allPassed: boolean;
                    };
                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;

                    // 检查是否是 afterScoring 响应窗口关闭
                    // 如果是，需要补发 BASE_CLEARED 和 BASE_REPLACED 事件
                    if (newState.sys.afterScoringInitialPowers) {
                        const { baseIndex: scoredBaseIndex } = newState.sys.afterScoringInitialPowers as any;
                        const currentBase = newState.core.bases[scoredBaseIndex];
                        
                        console.log('[SmashUpEventSystem] afterScoring 响应窗口关闭，补发 BASE_CLEARED:', {
                            baseIndex: scoredBaseIndex,
                            baseExists: !!currentBase,
                        });
                        
                        if (currentBase) {
                            // 发出 BASE_CLEARED 事件
                            const clearEvt: BaseClearedEvent = {
                                type: SU_EVENT_TYPES.BASE_CLEARED,
                                payload: { baseIndex: scoredBaseIndex, baseDefId: currentBase.defId },
                                timestamp: eventTimestamp,
                            };
                            nextEvents.push(clearEvt);
                            
                            // 替换基地
                            if (newState.core.baseDeck.length > 0) {
                                const newBaseDefId = newState.core.baseDeck[0];
                                const replaceEvt: BaseReplacedEvent = {
                                    type: SU_EVENT_TYPES.BASE_REPLACED,
                                    payload: {
                                        baseIndex: scoredBaseIndex,
                                        oldBaseDefId: currentBase.defId,
                                        newBaseDefId,
                                    },
                                    timestamp: eventTimestamp,
                                };
                                nextEvents.push(replaceEvt);
                                
                                // 触发新基地的 onBaseRevealed 扩展时机（如绵羊神社：每位玩家可移动一个随从到此）
                                const revealCtx = {
                                    state: newState.core,
                                    matchState: newState,
                                    baseIndex: scoredBaseIndex,
                                    baseDefId: newBaseDefId,
                                    playerId: newState.core.turnOrder[newState.core.currentPlayerIndex],
                                    now: eventTimestamp,
                                };
                                const revealResult = triggerExtendedBaseAbility(newBaseDefId, 'onBaseRevealed', revealCtx);
                                nextEvents.push(...revealResult.events);
                                if (revealResult.matchState) newState = revealResult.matchState;
                            }
                            
                            console.log('[SmashUpEventSystem] 补发 BASE_CLEARED 和 BASE_REPLACED 事件完成');
                        }
                        
                        // ⚠️ 不在这里清理 afterScoringInitialPowers
                        // 原因：onPhaseExit 重新进入时需要检查力量变化，如果变化则重新计分
                        // afterScoringInitialPowers 会在 onPhaseExit 的重新计分逻辑之后清除
                    }
                }

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
                                // 【关键修复】检查交互处理器是否创建了新交互
                                // 如果没有创建新交互（如返回 ABILITY_FEEDBACK），则解决当前交互
                                const hadInteractionBefore = !!newState.sys.interaction?.current;
                                const hasInteractionAfter = !!result.state.sys.interaction?.current || (result.state.sys.interaction?.queue?.length ?? 0) > (newState.sys.interaction?.queue?.length ?? 0);
                                
                                newState = result.state;
                                
                                // 如果 handler 没有创建新交互，则解决当前交互
                                if (hadInteractionBefore && !hasInteractionAfter) {
                                    newState = resolveInteraction(newState);
                                }
                                
                                // 【关键修复】交互处理函数返回的事件必须经过拦截器过滤
                                // 原因：pipeline.reduceEventsToCore 只处理 execute() 返回的事件，
                                // 而 SmashUpEventSystem.afterEvents 返回的事件走的是系统事件路径，
                                // 不会自动经过 domain.interceptEvent。
                                // 必须在这里手动调用拦截器，确保 tooth_and_claw 等保护机制生效。
                                const rawEvents = result.events as SmashUpEvent[];
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
                                console.log('[SmashUpEventSystem] 检查延迟事件:', {
                                    interactionId: payload.interactionId,
                                    sourceId: payload.sourceId,
                                    hasDeferredEvents: !!deferred,
                                    deferredEventsCount: deferred?.length || 0,
                                    hasCurrentInteraction: !!newState.sys.interaction?.current,
                                    queueLength: newState.sys.interaction?.queue?.length || 0,
                                });
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
                                        const pendingActions = newState.core.pendingPostScoringActions ?? [];
                                        if (pendingActions.length > 0) {
                                            nextEvents.push(...buildPendingPostScoringActionEvents(newState, pendingActions, eventTimestamp));
                                            newState = {
                                                ...newState,
                                                core: {
                                                    ...newState.core,
                                                    pendingPostScoringActions: undefined,
                                                },
                                            };
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
