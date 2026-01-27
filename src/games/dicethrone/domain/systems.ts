/**
 * DiceThrone 专用系统扩展
 * 处理领域事件到系统状态的映射
 */

import type { GameEvent, PromptOption } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { PROMPT_EVENTS, queuePrompt, createPrompt } from '../../../engine/systems/PromptSystem';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    ChoiceRequestedEvent,
    ChoiceResolvedEvent,
} from './types';

// ============================================================================
// DiceThrone 事件处理系统
// ============================================================================

/**
 * 创建 DiceThrone 事件处理系统
 * 负责将领域事件转换为系统状态更新（如 Prompt）
 */
export function createDiceThroneEventSystem(): EngineSystem<DiceThroneCore> {
    return {
        id: 'dicethrone-events',
        name: 'DiceThrone 事件处理',
        priority: 50, // 在 PromptSystem 之后执行

        afterEvents: ({ state, events }): HookResult<DiceThroneCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];

            // 检查是否需要自动推进阶段
            const hasTokenResponseClosed = events.some(e => e.type === 'TOKEN_RESPONSE_CLOSED');
            const hasInteractionCompleted = events.some(e => e.type === 'INTERACTION_COMPLETED');
            const hasInteractionCancelled = events.some(e => e.type === 'INTERACTION_CANCELLED');

            console.log('[DiceThroneEventSystem] afterEvents:', {
                eventTypes: events.map(e => e.type),
                hasTokenResponseClosed,
                hasInteractionCompleted,
                hasInteractionCancelled,
                currentPhase: state.core.turnPhase,
            });

            for (const event of events) {
                const dtEvent = event as DiceThroneEvent;
                
                // 处理 CHOICE_REQUESTED 事件 -> 创建 Prompt
                if (dtEvent.type === 'CHOICE_REQUESTED') {
                    const payload = (dtEvent as ChoiceRequestedEvent).payload;
                    
                    // 将 DiceThrone 的选择选项转换为 PromptOption
                    const promptOptions: PromptOption<{
                        statusId?: string;
                        tokenId?: string;
                        value: number;
                        customId?: string;
                        labelKey?: string;
                    }>[] = payload.options.map((opt, index) => {
                        const label = opt.labelKey
                            ?? (opt.tokenId ? `tokens.${opt.tokenId}.name`
                                : opt.statusId ? `statusEffects.${opt.statusId}.name`
                                    : `choices.option-${index}`);
                        return {
                            id: `option-${index}`,
                            label,
                            value: opt,
                        };
                    });
                    
                    const prompt = createPrompt(
                        `choice-${payload.sourceAbilityId}-${Date.now()}`,
                        payload.playerId,
                        payload.titleKey,
                        promptOptions,
                        payload.sourceAbilityId
                    );
                    
                    newState = queuePrompt(newState, prompt);
                }

                // 处理 Prompt 响应 -> 生成 CHOICE_RESOLVED 领域事件
                const resolvedEvent = handlePromptResolved(event);
                if (resolvedEvent) {
                    nextEvents.push(resolvedEvent);
                    // 注意：选择完成后的阶段推进现在由 FlowSystem 统一处理
                    // 用户/测试需要在选择完成后调用 ADVANCE_PHASE 继续流程
                }
            }

            // 处理 TOKEN_RESPONSE_CLOSED 和交互完成事件的自动推进
            if (hasTokenResponseClosed || hasInteractionCompleted || hasInteractionCancelled) {
                const core = state.core;
                
                // 检查是否有阻塞条件
                const hasActivePrompt = newState.sys.prompt?.current !== undefined;
                const hasActiveResponseWindow = newState.sys.responseWindow?.current !== undefined;
                const hasPendingInteraction = core.pendingInteraction !== undefined;
                const hasPendingDamage = core.pendingDamage !== undefined;
                
                console.log('[DiceThroneEventSystem] Checking auto-continue conditions:', {
                    hasActivePrompt,
                    hasActiveResponseWindow,
                    hasPendingInteraction,
                    hasPendingDamage,
                });
                
                // 只有在没有其他阻塞条件时才自动推进阶段
                if (!hasActivePrompt && !hasActiveResponseWindow && !hasPendingInteraction && !hasPendingDamage) {
                    console.log('[DiceThroneEventSystem] Auto-advancing phase from:', core.turnPhase);
                    
                    // 生成 PHASE_CHANGED 事件来推进阶段
                    const followupEvents = buildAutoContinueEvents(core, random);
                    if (followupEvents.length > 0) {
                        nextEvents.push(...followupEvents);
                    }
                } else {
                    console.log('[DiceThroneEventSystem] Auto-continue blocked');
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

/**
 * 构建自动继续事件（当 Token 响应关闭或交互完成后）
 */
function buildAutoContinueEvents(
    core: DiceThroneCore,
    random: RandomFn
): DiceThroneEvent[] {
    const followups: DiceThroneEvent[] = [];
    
    // 在 defensiveRoll 阶段，如果攻击已经结算，则推进到 main2
    if (core.turnPhase === 'defensiveRoll' && !core.pendingAttack) {
        const phaseEvent: PhaseChangedEvent = {
            type: 'PHASE_CHANGED',
            payload: {
                from: core.turnPhase,
                to: 'main2',
                activePlayerId: core.activePlayerId,
            },
            sourceCommandType: 'AUTO_CONTINUE',
            timestamp: now(),
        };
        followups.push(phaseEvent);
        return followups;
    }
    
    // 在 offensiveRoll 阶段，如果攻击已经结算且不可防御，则推进到 main2
    if (core.turnPhase === 'offensiveRoll' && !core.pendingAttack) {
        const phaseEvent: PhaseChangedEvent = {
            type: 'PHASE_CHANGED',
            payload: {
                from: core.turnPhase,
                to: 'main2',
                activePlayerId: core.activePlayerId,
            },
            sourceCommandType: 'AUTO_CONTINUE',
            timestamp: now(),
        };
        followups.push(phaseEvent);
        return followups;
    }
    
    return followups;
}

/**
 * 处理 Prompt 响应事件，生成领域事件
 * 在 pipeline 层通过 domain.execute 处理 RESOLVE_CHOICE 命令时调用
 */
export function handlePromptResolved(
    event: GameEvent
): ChoiceResolvedEvent | null {
    if (event.type !== PROMPT_EVENTS.RESOLVED) return null;
    
    const payload = event.payload as {
        promptId: string;
        playerId: string;
        optionId: string;
        value: { statusId?: string; tokenId?: string; value: number; customId?: string };
        sourceId?: string;
    };
    
    return {
        type: 'CHOICE_RESOLVED',
        payload: {
            playerId: payload.playerId,
            statusId: payload.value.statusId,
            tokenId: payload.value.tokenId,
            value: payload.value.value,
            customId: payload.value.customId,
            sourceAbilityId: payload.sourceId,
        },
        sourceCommandType: 'RESOLVE_CHOICE',
        timestamp: Date.now(),
    };
}
