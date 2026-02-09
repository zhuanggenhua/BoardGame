/**
 * 响应窗口系统
 * 
 * 允许玩家在特定断点打出响应卡或使用消耗性状态效果。
 * 
 * 核心语义：
 * - 支持多玩家响应队列（包括自己响应自己的效果）
 * - 按顺序轮询响应者，自动跳过无可响应内容的玩家
 * - 所有玩家跳过后自动关闭窗口
 */

import type { MatchState, PlayerId, GameEvent, ResponseWindowState, ResponseWindowType } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// 响应窗口系统配置
// ============================================================================

export interface ResponseWindowSystemConfig {
    /** 检测玩家是否有可响应内容的函数（由游戏实现注入） */
    hasRespondableContent?: (state: unknown, playerId: PlayerId, windowType: ResponseWindowType, sourceId?: string) => boolean;
}

// ============================================================================
// 响应窗口命令类型
// ============================================================================

export const RESPONSE_WINDOW_COMMANDS = {
    PASS: 'RESPONSE_PASS',
} as const;

// ============================================================================
// 响应窗口事件类型
// ============================================================================

export const RESPONSE_WINDOW_EVENTS = {
    OPENED: 'RESPONSE_WINDOW_OPENED',
    CLOSED: 'RESPONSE_WINDOW_CLOSED',
    RESPONDER_CHANGED: 'RESPONSE_WINDOW_RESPONDER_CHANGED',
} as const;

// ============================================================================
// 响应窗口辅助函数
// ============================================================================

/**
 * 创建响应窗口（多响应者队列）
 */
export function createResponseWindow(
    id: string,
    responderQueue: PlayerId[],
    windowType: ResponseWindowType,
    sourceId?: string
): ResponseWindowState['current'] {
    if (responderQueue.length === 0) return undefined;
    
    return {
        id,
        windowType,
        sourceId,
        responderQueue,
        currentResponderIndex: 0,
        passedPlayers: [],
    };
}

/**
 * 获取当前响应者 ID
 */
export function getCurrentResponderId(
    window: ResponseWindowState['current']
): PlayerId | undefined {
    if (!window) return undefined;
    return window.responderQueue[window.currentResponderIndex];
}

/**
 * 打开响应窗口
 */
export function openResponseWindow<TCore>(
    state: MatchState<TCore>,
    window: ResponseWindowState['current']
): MatchState<TCore> {
    if (!window) return state;

    return {
        ...state,
        sys: {
            ...state.sys,
            responseWindow: {
                current: window,
            },
        },
    };
}

/**
 * 关闭响应窗口
 */
export function closeResponseWindow<TCore>(
    state: MatchState<TCore>
): MatchState<TCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            responseWindow: {
                current: undefined,
            },
        },
    };
}

/**
 * 移动到下一个响应者
 * @returns 新窗口状态，如果所有人都已响应则返回 undefined
 */
export function advanceToNextResponder(
    window: ResponseWindowState['current'],
    currentPlayerId: PlayerId
): ResponseWindowState['current'] {
    if (!window) return undefined;
    
    const newPassedPlayers = [...window.passedPlayers, currentPlayerId];
    const nextIndex = window.currentResponderIndex + 1;
    
    // 所有人都已响应
    if (nextIndex >= window.responderQueue.length) {
        return undefined;
    }
    
    return {
        ...window,
        currentResponderIndex: nextIndex,
        passedPlayers: newPassedPlayers,
    };
}

/**
 * 检查是否有活动的响应窗口
 */
export function hasActiveResponseWindow<TCore>(
    state: MatchState<TCore>
): boolean {
    return !!state.sys.responseWindow?.current;
}

/**
 * 获取当前响应窗口的响应者 ID（兼容旧 API）
 */
export function getResponseWindowResponderId<TCore>(
    state: MatchState<TCore>
): PlayerId | undefined {
    return getCurrentResponderId(state.sys.responseWindow?.current);
}

// ============================================================================
// 允许在响应窗口期间执行的命令类型
// ============================================================================

const ALLOWED_COMMANDS_DURING_RESPONSE = [
    'RESPONSE_PASS',      // 跳过响应
    'PLAY_CARD',          // 打出卡牌（响应卡）
    'SYS_PROMPT_RESPOND', // Prompt 响应命令
    'USE_TOKEN',          // Token 响应
    'SKIP_TOKEN_RESPONSE', // 跳过 Token 响应
    // 卡牌交互相关命令
    'MODIFY_DIE',         // 修改骰子数值
    'REROLL_DIE',         // 重掷骰子
    'REMOVE_STATUS',      // 移除状态效果
    'TRANSFER_STATUS',    // 转移状态效果
    'CONFIRM_INTERACTION', // 确认交互
    'CANCEL_INTERACTION', // 取消交互
    // SmashUp 响应命令
    'su:play_action',     // 大杀四方：Me First! 响应打出特殊行动卡
];

// ============================================================================
// 创建响应窗口系统
// ============================================================================

export function createResponseWindowSystem<TCore>(
    _config: ResponseWindowSystemConfig = {}
): EngineSystem<TCore> {
    return {
        id: SYSTEM_IDS.RESPONSE_WINDOW,
        name: '响应窗口系统',
        priority: 15, // 优先级 15（在 Prompt(20) 之前执行）

        setup: (): Partial<{ responseWindow: ResponseWindowState }> => ({
            responseWindow: {
                current: undefined,
            },
        }),

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            const currentWindow = state.sys.responseWindow?.current;
            
            // 没有响应窗口，不干预
            if (!currentWindow) {
                return;
            }

            const currentResponderId = getCurrentResponderId(currentWindow);

            // 处理 RESPONSE_PASS 命令
            if (command.type === RESPONSE_WINDOW_COMMANDS.PASS) {
                if (currentWindow.pendingInteractionId) {
                    return { halt: true, error: '交互处理中，无法跳过响应' };
                }
                // 支持代替离线玩家 pass（跳过）：如果 payload 中有 forPlayerId，则使用它
                const payload = command.payload as { forPlayerId?: PlayerId } | undefined;
                const targetPlayerId = payload?.forPlayerId ?? command.playerId;
                
                // 验证目标玩家是当前响应者
                if (targetPlayerId !== currentResponderId) {
                    return { halt: true, error: '不是当前响应者' };
                }

                // 移动到下一个响应者
                const nextWindow = advanceToNextResponder(currentWindow, targetPlayerId);
                const events: GameEvent[] = [];
                
                if (nextWindow) {
                    // 还有下一个响应者
                    const newState = openResponseWindow(state, nextWindow);
                    events.push({
                        type: RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED,
                        payload: {
                            windowId: currentWindow.id,
                            previousResponderId: currentResponderId,
                            nextResponderId: getCurrentResponderId(nextWindow),
                        },
                        timestamp: Date.now(),
                    });
                    return { halt: false, state: newState, events };
                } else {
                    // 所有人都已跳过，关闭窗口
                    const newState = closeResponseWindow(state);
                    events.push({
                        type: RESPONSE_WINDOW_EVENTS.CLOSED,
                        payload: {
                            windowId: currentWindow.id,
                            allPassed: true,
                        },
                        timestamp: Date.now(),
                    });
                    return { halt: false, state: newState, events };
                }
            }

            // 检查命令是否允许在响应窗口期间执行
            if (ALLOWED_COMMANDS_DURING_RESPONSE.includes(command.type)) {
                // Token 响应依赖 pendingDamage.responderId 校验，不与 response window responder 强绑定
                if (command.type !== 'USE_TOKEN' && command.type !== 'SKIP_TOKEN_RESPONSE') {
                    // 只有当前响应者可以执行这些命令
                    if (command.playerId !== currentResponderId) {
                        return { halt: true, error: '等待对方响应' };
                    }
                }
                // 允许执行
                return;
            }

            // 其他命令被阻塞
            return { halt: true, error: '等待响应窗口关闭' };
        },

        afterEvents: ({ state, events }): HookResult<TCore> | void => {
            let newState = state;
            const additionalEvents: GameEvent[] = [];
            
            for (const event of events) {
                // 处理响应窗口打开事件
                if (event.type === RESPONSE_WINDOW_EVENTS.OPENED) {
                    const payload = event.payload as {
                        windowId: string;
                        responderQueue: PlayerId[];
                        windowType: ResponseWindowType;
                        sourceId?: string;
                    };
                    
                    const window = createResponseWindow(
                        payload.windowId,
                        payload.responderQueue,
                        payload.windowType,
                        payload.sourceId
                    );
                    
                    if (window) {
                        newState = openResponseWindow(newState, window);
                    }
                }
                
                // 处理响应窗口关闭事件
                if (event.type === RESPONSE_WINDOW_EVENTS.CLOSED) {
                    newState = closeResponseWindow(newState);
                }
                
                // 处理交互请求事件：锁定响应窗口，阻止推进
                if (event.type === 'INTERACTION_REQUESTED') {
                    const currentWindow = newState.sys.responseWindow?.current;
                    if (currentWindow) {
                        const interactionPayload = event.payload as { interaction: { id: string; playerId: PlayerId } };
                        const currentResponderId = getCurrentResponderId(currentWindow);
                        
                        // 只有当前响应者的交互才锁定窗口
                        if (interactionPayload.interaction.playerId === currentResponderId) {
                            newState = {
                                ...newState,
                                sys: {
                                    ...newState.sys,
                                    responseWindow: {
                                        current: {
                                            ...currentWindow,
                                            pendingInteractionId: interactionPayload.interaction.id,
                                        },
                                    },
                                },
                            };
                        }
                    }
                }
                
                // 处理交互完成/取消事件：解除锁定并推进响应者
                if (event.type === 'INTERACTION_COMPLETED' || event.type === 'INTERACTION_CANCELLED') {
                    const currentWindow = newState.sys.responseWindow?.current;
                    if (currentWindow && currentWindow.pendingInteractionId) {
                        const interactionPayload = event.payload as { interactionId: string };
                        
                        // 匹配交互 ID 才解锁
                        if (interactionPayload.interactionId === currentWindow.pendingInteractionId) {
                            // 解除交互锁
                            const unlockedWindow = { ...currentWindow, pendingInteractionId: undefined };
                            const currentResponderId = getCurrentResponderId(unlockedWindow);
                            
                            // 推进到下一个响应者
                            const nextWindow = advanceToNextResponder(unlockedWindow, currentResponderId!);
                            
                            if (nextWindow) {
                                newState = openResponseWindow(newState, nextWindow);
                                additionalEvents.push({
                                    type: RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED,
                                    payload: {
                                        windowId: currentWindow.id,
                                        previousResponderId: currentResponderId,
                                        nextResponderId: getCurrentResponderId(nextWindow),
                                    },
                                    timestamp: Date.now(),
                                });
                            } else {
                                // 所有人都已响应，关闭窗口
                                newState = closeResponseWindow(newState);
                                additionalEvents.push({
                                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                                    payload: {
                                        windowId: currentWindow.id,
                                        allPassed: false,
                                    },
                                    timestamp: Date.now(),
                                });
                            }
                        }
                    }
                }
                
                // 处理打牌事件：仅在无交互锁时才推进（普通卡牌/行动卡）
                if (event.type === 'CARD_PLAYED' || event.type === 'su:action_played') {
                    const currentWindow = newState.sys.responseWindow?.current;
                    if (currentWindow && !currentWindow.pendingInteractionId) {
                        const cardPayload = event.payload as { playerId: PlayerId };
                        const currentResponderId = getCurrentResponderId(currentWindow);
                        
                        // 只有当前响应者打牌才推进
                        if (cardPayload.playerId === currentResponderId) {
                            const nextWindow = advanceToNextResponder(currentWindow, currentResponderId);
                            
                            if (nextWindow) {
                                newState = openResponseWindow(newState, nextWindow);
                                additionalEvents.push({
                                    type: RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED,
                                    payload: {
                                        windowId: currentWindow.id,
                                        previousResponderId: currentResponderId,
                                        nextResponderId: getCurrentResponderId(nextWindow),
                                    },
                                    timestamp: Date.now(),
                                });
                            } else {
                                // 所有人都已响应，关闭窗口
                                newState = closeResponseWindow(newState);
                                additionalEvents.push({
                                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                                    payload: {
                                        windowId: currentWindow.id,
                                        allPassed: false, // 有人打牌了
                                    },
                                    timestamp: Date.now(),
                                });
                            }
                        }
                    }
                }
            }
            
            if (newState !== state || additionalEvents.length > 0) {
                return { 
                    state: newState,
                    events: additionalEvents.length > 0 ? additionalEvents : undefined,
                };
            }
        },

        playerView: (state, _playerId): Partial<{ responseWindow: ResponseWindowState }> => {
            const currentWindow = state.sys.responseWindow?.current;

            // 所有玩家都能看到响应窗口状态（用于 UI 显示）
            return {
                responseWindow: {
                    current: currentWindow,
                },
            };
        },
    };
}
