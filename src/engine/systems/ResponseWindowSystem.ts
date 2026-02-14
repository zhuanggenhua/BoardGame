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
import { resolveCommandTimestamp, resolveEventTimestamp } from '../utils';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// 响应窗口系统配置
// ============================================================================

export interface ResponseWindowSystemConfig {
    /** 检测玩家是否有可响应内容的函数（由游戏实现注入） */
    hasRespondableContent?: (state: unknown, playerId: PlayerId, windowType: ResponseWindowType, sourceId?: string) => boolean;

    /**
     * 响应窗口期间允许执行的额外游戏命令
     * 引擎自动包含 RESPONSE_PASS + SYS_INTERACTION_* + SYS_ 前缀系统命令，无需重复列出
     */
    allowedCommands?: string[];

    /** 不受"当前响应者"约束的命令（如 USE_TOKEN 由自身 responderId 校验） */
    responderExemptCommands?: string[];

    /** 命令的窗口类型限制：只在指定窗口类型下才允许执行 */
    commandWindowTypeConstraints?: Record<string, ResponseWindowType[]>;

    /**
     * 触发响应者推进的事件类型
     * 当前响应者产生这些事件后，自动推进到下一个响应者
     * payload 需包含 playerId 字段用于匹配当前响应者
     */
    responseAdvanceEvents?: Array<{
        eventType: string;
        /** 仅在特定窗口类型下生效（不填=所有类型） */
        windowTypes?: ResponseWindowType[];
    }>;

    /**
     * 循环响应模式：所有人连续让过才关闭窗口
     * 
     * 启用后，当某个响应者执行了动作（触发 responseAdvanceEvents），
     * 到达队列末尾时不会关闭窗口，而是重新从头开始新一轮循环。
     * 只有一整轮中所有人都 pass（没有人执行动作）时才关闭。
     * 
     * 适用于 Smash Up 的 Me First! 机制：每人可打 1 张特殊牌或让过，
     * 所有人连续让过才终止。
     */
    loopUntilAllPass?: boolean;

    /**
     * 交互锁定配置：在响应窗口内发起多步交互时锁定推进
     * payload 约定：requestEvent.payload.interaction.{id, playerId}; resolveEvents.payload.interactionId
     */
    interactionLock?: {
        /** 锁定事件类型 */
        requestEvent: string;
        /** 解锁+推进事件类型 */
        resolveEvents: string[];
    };
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
 * @param loopUntilAllPass 启用循环模式时，到达队列末尾会重新开始（如果本轮有人执行了动作）
 * @returns 新窗口状态，如果所有人都已响应（且不需要循环）则返回 undefined
 */
export function advanceToNextResponder(
    window: ResponseWindowState['current'],
    currentPlayerId: PlayerId,
    loopUntilAllPass?: boolean
): ResponseWindowState['current'] {
    if (!window) return undefined;
    
    const newPassedPlayers = [...window.passedPlayers, currentPlayerId];
    const nextIndex = window.currentResponderIndex + 1;
    
    // 所有人都已响应
    if (nextIndex >= window.responderQueue.length) {
        if (loopUntilAllPass && window.actionTakenThisRound) {
            // 本轮有人执行了动作，重新开始新一轮
            return {
                ...window,
                currentResponderIndex: 0,
                passedPlayers: [],
                actionTakenThisRound: false,
            };
        }
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
// 引擎级始终允许的命令（无需游戏配置）
// ============================================================================

const ENGINE_ALLOWED_COMMANDS = [
    'RESPONSE_PASS',
];

function skipToNextRespondableResponder<TCore>(
    state: MatchState<TCore>,
    window: ResponseWindowState['current'] | undefined,
    hasRespondableContent?: ResponseWindowSystemConfig['hasRespondableContent'],
    loopUntilAllPass?: boolean
): ResponseWindowState['current'] | undefined {
    if (!window || !hasRespondableContent) return window;

    type CurrentWindow = NonNullable<ResponseWindowState['current']>;

    const findNextRespondable = (
        scanWindow: CurrentWindow
    ): ResponseWindowState['current'] | undefined => {
        const originalIndex = scanWindow.currentResponderIndex;
        let index = originalIndex;
        let passedPlayers = scanWindow.passedPlayers;

        while (index < scanWindow.responderQueue.length) {
            const playerId = scanWindow.responderQueue[index];
            if (hasRespondableContent(state.core as unknown, playerId, scanWindow.windowType, scanWindow.sourceId)) {
                if (index === originalIndex && passedPlayers === scanWindow.passedPlayers) {
                    return scanWindow;
                }
                return {
                    ...scanWindow,
                    currentResponderIndex: index,
                    passedPlayers,
                };
            }
            passedPlayers = [...passedPlayers, playerId];
            index += 1;
        }

        return undefined;
    };

    const nextWindow = findNextRespondable(window);
    if (nextWindow) return nextWindow;

    // loopUntilAllPass：若本轮有人出过牌，即使尾部玩家都被自动 skip，
    // 也需要重开新一轮，从队首继续检查可响应者。
    if (loopUntilAllPass && window.actionTakenThisRound) {
        const restartedWindow: CurrentWindow = {
            ...window,
            currentResponderIndex: 0,
            passedPlayers: [],
            actionTakenThisRound: false,
        };
        return findNextRespondable(restartedWindow);
    }

    return undefined;
}

// ============================================================================
// 创建响应窗口系统
// ============================================================================

export function createResponseWindowSystem<TCore>(
    config: ResponseWindowSystemConfig = {}
): EngineSystem<TCore> {
    const { hasRespondableContent } = config;

    // 合并引擎级 + 游戏级允许命令
    const gameAllowedCommands = config.allowedCommands ?? [];
    const allAllowedCommands = new Set([
        ...ENGINE_ALLOWED_COMMANDS,
        ...gameAllowedCommands,
    ]);
    const responderExempt = new Set(config.responderExemptCommands ?? []);
    const windowTypeConstraints = config.commandWindowTypeConstraints ?? {};
    const advanceEvents = config.responseAdvanceEvents ?? [];
    const interactionLock = config.interactionLock;
    const loopUntilAllPass = config.loopUntilAllPass ?? false;

    /** 判断命令是否为 SYS_ 前缀系统命令（始终放行） */
    const isSysCommand = (type: string) => type.startsWith('SYS_');

    return {
        id: SYSTEM_IDS.RESPONSE_WINDOW,
        name: '响应窗口系统',
        priority: 15, // 优先级 15（在 Prompt(20) 之前执行）

        setup: (): Partial<{ responseWindow: ResponseWindowState }> => ({
            responseWindow: {
                current: undefined,
            },
        }),

        beforeCommand: ({ state, command, playerIds }): HookResult<TCore> | void => {
            const currentWindow = state.sys.responseWindow?.current;
            
            // 没有响应窗口，不干预
            if (!currentWindow) {
                return;
            }

            if (!playerIds.includes(command.playerId)) {
                return { halt: true, error: 'player_mismatch' };
            }

            const currentResponderId = getCurrentResponderId(currentWindow);

            // 处理 RESPONSE_PASS 命令
            if (command.type === RESPONSE_WINDOW_COMMANDS.PASS) {
                if (currentWindow.pendingInteractionId) {
                    return { halt: true, error: '交互处理中，无法跳过响应' };
                }
                // 支持代替离线玩家 pass（仅本地/教程允许）
                const payload = command.payload as { forPlayerId?: PlayerId } | undefined;
                const wantsProxyPass = !!payload?.forPlayerId && payload.forPlayerId !== command.playerId;
                if (wantsProxyPass && !command.skipValidation) {
                    console.warn('[ResponseWindow] 代理跳过被拒', {
                        commandPlayerId: command.playerId,
                        forPlayerId: payload?.forPlayerId,
                        currentResponderId,
                        skipValidation: command.skipValidation,
                    });
                    return { halt: true, error: '不能代替他人跳过响应' };
                }
                const targetPlayerId = payload?.forPlayerId ?? command.playerId;
                
                // 验证目标玩家是当前响应者
                if (targetPlayerId !== currentResponderId) {
                    return { halt: true, error: '不是当前响应者' };
                }

                // 移动到下一个响应者
                const nextWindow = skipToNextRespondableResponder(
                    state,
                    advanceToNextResponder(currentWindow, targetPlayerId, loopUntilAllPass),
                    hasRespondableContent,
                    loopUntilAllPass
                );
                const events: GameEvent[] = [];
                const cmdTimestamp = resolveCommandTimestamp(command);
                
                if (nextWindow) {
                    const newState = openResponseWindow(state, nextWindow);
                    events.push({
                        type: RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED,
                        payload: {
                            windowId: currentWindow.id,
                            previousResponderId: currentResponderId,
                            nextResponderId: getCurrentResponderId(nextWindow),
                        },
                        timestamp: cmdTimestamp,
                    });
                    return { halt: false, state: newState, events };
                } else {
                    const newState = closeResponseWindow(state);
                    events.push({
                        type: RESPONSE_WINDOW_EVENTS.CLOSED,
                        payload: {
                            windowId: currentWindow.id,
                            allPassed: true,
                        },
                        timestamp: cmdTimestamp,
                    });
                    return { halt: false, state: newState, events };
                }
            }

            // SYS_ 前缀系统命令始终放行
            if (isSysCommand(command.type)) {
                return;
            }

            // 检查命令是否在允许列表中
            if (allAllowedCommands.has(command.type)) {
                // 窗口类型约束检查
                const constraints = windowTypeConstraints[command.type];
                if (constraints && !constraints.includes(currentWindow.windowType)) {
                    return { halt: true, error: '等待响应窗口关闭' };
                }
                // 非豁免命令需检查是否为当前响应者
                if (!responderExempt.has(command.type)) {
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
                const eventTimestamp = resolveEventTimestamp(event);
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
                        const nextWindow = skipToNextRespondableResponder(newState, window, hasRespondableContent, loopUntilAllPass);
                        if (nextWindow) {
                            newState = openResponseWindow(newState, nextWindow);
                        } else {
                            newState = closeResponseWindow(newState);
                            additionalEvents.push({
                                type: RESPONSE_WINDOW_EVENTS.CLOSED,
                                payload: {
                                    windowId: payload.windowId,
                                    allPassed: true,
                                },
                                timestamp: eventTimestamp,
                            });
                        }
                    }
                }
                
                // 处理响应窗口关闭事件
                if (event.type === RESPONSE_WINDOW_EVENTS.CLOSED) {
                    newState = closeResponseWindow(newState);
                }
                
                // 交互锁定：请求事件锁定响应窗口推进
                if (interactionLock && event.type === interactionLock.requestEvent) {
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
                
                // 交互锁定：解锁事件解除锁定并推进响应者
                if (interactionLock && interactionLock.resolveEvents.includes(event.type)) {
                    const currentWindow = newState.sys.responseWindow?.current;
                    if (currentWindow && currentWindow.pendingInteractionId) {
                        const interactionPayload = event.payload as { interactionId: string };
                        
                        if (interactionPayload.interactionId === currentWindow.pendingInteractionId) {
                            const unlockedWindow = { ...currentWindow, pendingInteractionId: undefined };
                            const currentResponderId = getCurrentResponderId(unlockedWindow);
                            
                            const nextWindow = skipToNextRespondableResponder(
                                newState,
                                advanceToNextResponder(unlockedWindow, currentResponderId!, loopUntilAllPass),
                                hasRespondableContent,
                                loopUntilAllPass
                            );
                            
                            if (nextWindow) {
                                newState = openResponseWindow(newState, nextWindow);
                                additionalEvents.push({
                                    type: RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED,
                                    payload: {
                                        windowId: currentWindow.id,
                                        previousResponderId: currentResponderId,
                                        nextResponderId: getCurrentResponderId(nextWindow),
                                    },
                                    timestamp: eventTimestamp,
                                });
                            } else {
                                newState = closeResponseWindow(newState);
                                additionalEvents.push({
                                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                                    payload: {
                                        windowId: currentWindow.id,
                                        allPassed: false,
                                    },
                                    timestamp: eventTimestamp,
                                });
                            }
                        }
                    }
                }
                
                // 响应者推进：配置的事件触发后推进到下一个响应者
                for (const adv of advanceEvents) {
                    if (event.type !== adv.eventType) continue;
                    const currentWindow = newState.sys.responseWindow?.current;
                    if (!currentWindow || currentWindow.pendingInteractionId) break;
                    // 窗口类型约束
                    if (adv.windowTypes && !adv.windowTypes.includes(currentWindow.windowType)) continue;
                    const cardPayload = event.payload as { playerId: PlayerId };
                    const currentResponderId = getCurrentResponderId(currentWindow);
                    
                    // 只有当前响应者的事件才推进
                    if (cardPayload.playerId !== currentResponderId) break;
                    
                    // 标记本轮有人执行了动作（用于 loopUntilAllPass 循环判定）
                    const markedWindow = loopUntilAllPass
                        ? { ...currentWindow, actionTakenThisRound: true }
                        : currentWindow;
                    
                    const nextWindow = skipToNextRespondableResponder(
                        newState,
                        advanceToNextResponder(markedWindow, currentResponderId, loopUntilAllPass),
                        hasRespondableContent,
                        loopUntilAllPass
                    );
                    
                    if (nextWindow) {
                        newState = openResponseWindow(newState, nextWindow);
                        additionalEvents.push({
                            type: RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED,
                            payload: {
                                windowId: currentWindow.id,
                                previousResponderId: currentResponderId,
                                nextResponderId: getCurrentResponderId(nextWindow),
                            },
                            timestamp: eventTimestamp,
                        });
                    } else {
                        newState = closeResponseWindow(newState);
                        additionalEvents.push({
                            type: RESPONSE_WINDOW_EVENTS.CLOSED,
                            payload: {
                                windowId: currentWindow.id,
                                allPassed: false,
                            },
                            timestamp: eventTimestamp,
                        });
                    }
                    break; // 每个事件最多匹配一个推进规则
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

            return {
                responseWindow: {
                    current: currentWindow,
                },
            };
        },
    };
}
