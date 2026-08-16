/**
 * MultistepChoiceSystem — multistep-choice 交互的确认处理
 *
 * 确认：收到 SYS_INTERACTION_CONFIRM 时 resolve 交互。
 * 中间步骤（step）纯本地执行，不经过 pipeline。
 * 取消（cancel）由 InteractionSystem 统一处理。
 *
 * 不做额外阻塞：
 * - InteractionSystem 已阻塞 ADVANCE_PHASE
 * - toCommands 生成的命令（MODIFY_DIE 等）需要正常通过 pipeline
 */

import type { GameEvent } from '../types';
import { resolveCommandTimestamp } from '../utils';
import type { EngineSystem, HookResult } from './types';
import {
    INTERACTION_COMMANDS,
    INTERACTION_EVENTS,
    resolveInteraction,
} from './InteractionSystem';

// ============================================================================
// 系统配置
// ============================================================================

export interface MultistepChoiceSystemConfig {
    /** 预留配置（暂无） */
    _placeholder?: never;
}

// ============================================================================
// 创建 MultistepChoiceSystem
// ============================================================================

export function createMultistepChoiceSystem<TCore>(
    _config: MultistepChoiceSystemConfig = {},
): EngineSystem<TCore> {
    return {
        id: 'multistep-choice',
        name: 'MultistepChoice 确认处理',
        priority: 22, // 在 SimpleChoiceSystem(21) 之后

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            const current = state.sys.interaction.current;

            // ---- multistep-choice 确认 ----
            if (command.type === INTERACTION_COMMANDS.CONFIRM) {
                const payloadInteractionId = (command.payload as any)?.interactionId;

                if (!current) {
                    // 交互已被引擎层自动 resolve（如 afterEvents 自动完成），静默跳过
                    return { halt: true };
                }

                // 携带 interactionId 但与当前交互不匹配 → 该 CONFIRM 针对的交互已被 afterEvents 自动 resolve，静默跳过
                if (payloadInteractionId && current.id !== payloadInteractionId) {
                    return { halt: true };
                }

                if (current.kind !== 'multistep-choice') {
                    return { halt: true, error: '没有待确认的多步交互' };
                }
                if (current.playerId !== command.playerId) {
                    return { halt: true, error: '不是你的交互' };
                }
                const data = current.data as {
                    minSteps?: unknown;
                    completedSteps?: unknown;
                    completedDieIds?: unknown;
                    meta?: { dtType?: unknown };
                };
                const minSteps = typeof data.minSteps === 'number' && Number.isFinite(data.minSteps)
                    ? Math.max(0, Math.floor(data.minSteps))
                    : 0;
                const isTrackedDiceInteraction = data.meta?.dtType === 'modifyDie' || data.meta?.dtType === 'selectDie';
                const completedSteps = typeof data.completedSteps === 'number' && Number.isFinite(data.completedSteps)
                    ? Math.max(0, Math.floor(data.completedSteps))
                    : Array.isArray(data.completedDieIds)
                        ? data.completedDieIds.filter((dieId) => typeof dieId === 'number').length
                        : isTrackedDiceInteraction
                            ? 0
                            : null;
                if (minSteps > 0 && completedSteps !== null && completedSteps < minSteps) {
                    return { halt: true, error: '多步交互尚未达到最少步骤数' };
                }
                const ts = resolveCommandTimestamp(command);
                const newState = resolveInteraction(state);
                const event: GameEvent = {
                    type: INTERACTION_EVENTS.CONFIRMED,
                    payload: {
                        interactionId: current.id,
                        playerId: command.playerId,
                        sourceId: (current.data as any)?.sourceId,
                    },
                    timestamp: ts,
                };
                return { halt: false, state: newState, events: [event] };
            }
        },
    };
}
