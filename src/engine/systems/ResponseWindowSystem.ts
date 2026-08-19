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
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from './InteractionSystem';
import { getActiveResolutionFrame, syncActiveResolutionWithInteraction, syncActiveResolutionWithResponseWindow } from './resolutionStack';

// ============================================================================
// 响应窗口系统配置
// ============================================================================

export interface ResponseWindowSystemConfig {
    /** 检测玩家是否有可响应内容的函数（由游戏实现注入） */
    hasRespondableContent?: (
        state: unknown,
        playerId: PlayerId,
        windowType: ResponseWindowType,
        sourceId?: string,
        context?: {
            matchState: MatchState<unknown>;
            window: NonNullable<ResponseWindowState['current']>;
        },
    ) => boolean;

    /**
     * 构建响应窗口语义指纹（用于去重与冷却）。
     * 默认使用 windowType + sourceId + responderQueue。
     */
    buildWindowFingerprint?: (window: ResponseWindowState['current']) => string;

    /**
     * 语义冷却窗口（单位：事件时间戳间隔；时间戳缺失时使用内部序号）。
     * 在冷却期内收到语义等价 OPENED 事件将被忽略。
     * 默认 0（不启用冷却）。
     */
    reopenDedupeCooldownMs?: number;

    /**
     * 响应窗口期间允许执行的额外游戏命令（白名单模式）
     * 引擎自动包含 RESPONSE_PASS + SYS_INTERACTION_* + SYS_ 前缀系统命令，无需重复列出
     * 
     * 注意：如果同时配置了 allowedCommandCategories，则两者取并集
     */
    allowedCommands?: string[];

    /**
     * 响应窗口期间允许执行的命令分类（推荐）
     * 
     * 使用分类系统可以避免遗漏命令，提高可维护性。
     * 游戏层需要提供 getCommandCategory 函数来查询命令分类。
     * 
     * 示例：
     * ```typescript
     * allowedCommandCategories: ['tactical', 'ui_interaction', 'state_management']
     * ```
     */
    allowedCommandCategories?: string[];

    /**
     * 获取命令分类的函数（配合 allowedCommandCategories 使用）
     * 
     * @param commandType 命令类型
     * @returns 命令分类，如果命令未分类则返回 undefined
     */
    getCommandCategory?: (commandType: string) => string | undefined;

    /** 不受"当前响应者"约束的命令（如 USE_TOKEN 由自身 responderId 校验） */
    responderExemptCommands?: string[];

    /**
     * 针对特定窗口的额外放行规则。
     * 用于像“同队直接干预骰面”这类不进入 responderQueue、但仍需在响应窗口内合法执行的命令。
     */
    allowNonResponderCommand?: (args: {
        state: MatchState<unknown>;
        command: { type: string; playerId: PlayerId; payload?: unknown };
        currentWindow: NonNullable<ResponseWindowState['current']>;
        currentResponderId?: PlayerId;
    }) => boolean;

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
     * 适用于“响应者可执行一次响应或让过，所有人连续让过才终止”的顺序响应窗口。
     */
    loopUntilAllPass?: boolean;

    /**
     * 交互锁定配置：在响应窗口内发起多步交互时锁定推进
     * payload 约定：requestEvent.payload.interaction.{id, playerId}
     * 解锁方式：状态驱动——检测 sys.interaction.current 被清空后自动解锁
     */
    interactionLock?: {
        /** 锁定事件类型 */
        requestEvent: string;
    };

    /**
     * 交互失败/能力无效反馈事件。
     *
     * 当响应窗口内的锁定交互被解决但本批事件包含这些失败反馈时，
     * 窗口只解锁，不直接推进到下一个响应者，除非当前响应者已无可响应内容。
     * 具体事件类型由游戏 adapter 声明，系统层不识别游戏事件前缀。
     */
    interactionFailureEventTypes?: string[];
}

// ============================================================================
// 响应窗口命令类型
// ============================================================================

export const RESPONSE_WINDOW_COMMANDS = {
    FORCE_CLOSE: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE',
    PASS: 'RESPONSE_PASS',
} as const;

// ============================================================================
// 响应窗口事件类型
// ============================================================================

export const RESPONSE_WINDOW_EVENTS = {
    OPENED: 'RESPONSE_WINDOW_OPENED',
    CLOSED: 'RESPONSE_WINDOW_CLOSED',
    RESPONDER_CHANGED: 'RESPONSE_WINDOW_RESPONDER_CHANGED',
    /** 内部事件：延迟解锁检查（当本轮有 INTERACTION_RESOLVED 时，推迟到下一轮再检查） */
    _CHECK_UNLOCK: 'SYS_RESPONSE_WINDOW_CHECK_UNLOCK',
} as const;

// ============================================================================
// 响应窗口辅助函数
// ============================================================================

export const buildResponseWindowFingerprint = (
    window: ResponseWindowState['current'],
    options?: { includeSourceId?: boolean },
): string => {
    if (!window) return '';
    const includeSourceId = options?.includeSourceId !== false;
    const sourcePart = includeSourceId ? (window.sourceId ?? '') : '';
    return [
        window.windowType ?? '',
        sourcePart,
        ...(Array.isArray(window.responderQueue) ? window.responderQueue : []),
    ].join('|');
};

function resolveDecisionEpochValue(state: MatchState<unknown>): number {
    return typeof state.sys?.decisionEpoch === 'number' ? state.sys.decisionEpoch : 0;
}

function bumpDecisionEpoch<TCore>(state: MatchState<TCore>): MatchState<TCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            decisionEpoch: resolveDecisionEpochValue(state as MatchState<unknown>) + 1,
        },
    };
}

function buildResponseWindowDecisionSignature(window: ResponseWindowState['current']): string {
    if (!window) return '';
    return [
        window.windowType ?? '',
        window.sourceId ?? '',
        ...(Array.isArray(window.responderQueue) ? window.responderQueue : []),
        window.currentResponderIndex ?? '',
        window.pendingInteractionId ?? '',
        window.requiredInteractionId ?? '',
    ].join('|');
}

function writeResponseWindowCurrent<TCore>(
    state: MatchState<TCore>,
    current: ResponseWindowState['current'],
): MatchState<TCore> {
    const decisionChanged = buildResponseWindowDecisionSignature(state.sys.responseWindow?.current)
        !== buildResponseWindowDecisionSignature(current);
    const nextState: MatchState<TCore> = {
        ...state,
        sys: {
            ...state.sys,
            responseWindow: {
                current,
            },
        },
    };
    return decisionChanged ? bumpDecisionEpoch(nextState) : nextState;
}

/**
 * 创建响应窗口（多响应者队列）
 */
export function createResponseWindow(
    id: string,
    responderQueue: PlayerId[],
    windowType: ResponseWindowType,
    sourceId?: string,
    options?: {
        resolutionFrameId?: string;
        requiredInteractionId?: string;
    },
): ResponseWindowState['current'] {
    if (responderQueue.length === 0) return undefined;
    
    return {
        id,
        windowType,
        sourceId,
        responderQueue,
        currentResponderIndex: 0,
        passedPlayers: [],
        ...(options?.resolutionFrameId ? { resolutionFrameId: options.resolutionFrameId } : {}),
        ...(options?.requiredInteractionId ? { requiredInteractionId: options.requiredInteractionId } : {}),
    };
}

function cloneResponseWindowCurrent(
    currentWindow: ResponseWindowState['current'],
): ResponseWindowState['current'] {
    if (!currentWindow) {
        return undefined;
    }

    return {
        ...currentWindow,
        responderQueue: [...currentWindow.responderQueue],
        passedPlayers: [...currentWindow.passedPlayers],
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

    if (!window.resolutionFrameId) {
        const activeFrameId = getActiveResolutionFrame(state)?.id;
        if (activeFrameId) {
            window = {
                ...window,
                resolutionFrameId: activeFrameId,
            };
        }
    }

    return syncActiveResolutionWithResponseWindow(writeResponseWindowCurrent(state, window));
}

/**
 * 关闭响应窗口
 */
export function closeResponseWindow<TCore>(
    state: MatchState<TCore>
): MatchState<TCore> {
    const nextState = syncActiveResolutionWithResponseWindow(writeResponseWindowCurrent(state, undefined));
    return syncActiveResolutionWithInteraction(nextState);
}

function isSemanticallyEquivalentWindow(
    left: ResponseWindowState['current'],
    right: ResponseWindowState['current'],
): boolean {
    if (!left || !right) return false;
    return buildResponseWindowFingerprint(left) === buildResponseWindowFingerprint(right);
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
        if (loopUntilAllPass) {
            if (window.actionTakenThisRound) {
                // 本轮有人执行了动作，重新开始新一轮，重置 consecutivePassRounds
                return {
                    ...window,
                    currentResponderIndex: 0,
                    passedPlayers: [],
                    actionTakenThisRound: false,
                    consecutivePassRounds: 0,
                };
            } else {
                // 一轮所有人都 pass，关闭窗口
                // 注意：loopUntilAllPass 的目的是允许玩家在有人出牌后继续响应，
                // 但如果所有人都 pass 了一轮，说明没有人想出牌，应该立即关闭窗口
                return undefined;
            }
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
        // 保留传入窗口的 passedPlayers（包含 advanceToNextResponder 的更新）
        let passedPlayers = scanWindow.passedPlayers;

        while (index < scanWindow.responderQueue.length) {
            const playerId = scanWindow.responderQueue[index];
            const hasContent = hasRespondableContent(
                state.core as unknown,
                playerId,
                scanWindow.windowType,
                scanWindow.sourceId,
                {
                    matchState: state as MatchState<unknown>,
                    window: scanWindow,
                },
            );

            if (hasContent) {
                // 即使 index === originalIndex，也要返回更新后的窗口（保留 passedPlayers 更新）
                return {
                    ...scanWindow,
                    currentResponderIndex: index,
                    passedPlayers,
                };
            }
            // 只有在跳过玩家时才追加到 passedPlayers
            passedPlayers = [...passedPlayers, playerId];
            index += 1;
        }

        return undefined;
    };

    const nextWindow = findNextRespondable(window);
    if (nextWindow) {
        return nextWindow;
    }

    // 没有找到可响应玩家 - 说明从当前位置到队列末尾，所有玩家都没有可响应内容

    // 【关键修复】如果当前是从队首开始扫描（currentResponderIndex === 0），
    // 且没有找到任何可响应玩家，说明所有玩家都没有可响应内容，应该立即关闭窗口
    // 注意：这里不检查 loopUntilAllPass，因为即使需要循环，如果所有玩家都没有可响应内容，
    // 循环也没有意义，应该立即关闭
    if (window.currentResponderIndex === 0) {
        return undefined;
    }

    // loopUntilAllPass：若本轮有人出过牌，即使尾部玩家都被自动 skip，
    // 也需要重开新一轮，从队首继续检查可响应者。
    // 【修复】重新开始一轮时，也要跳过没有可响应内容的玩家
    if (loopUntilAllPass) {
        if (window.actionTakenThisRound) {
            const restartedWindow: CurrentWindow = {
                ...window,
                currentResponderIndex: 0,
                passedPlayers: [],
                actionTakenThisRound: false,
                consecutivePassRounds: 0, // 重置计数器
            };
            // 【修复】调用 findNextRespondable 跳过没有可响应内容的玩家
            return findNextRespondable(restartedWindow);
        } else {
            // 本轮所有人都 pass，关闭窗口
            // 注意：这里不需要 consecutivePassRounds 计数器，因为如果所有人都 pass 了一轮，
            // 说明没有人想出牌，应该立即关闭窗口
            return undefined;
        }
    }

    return undefined;
}

// ============================================================================
// 创建响应窗口系统
// ============================================================================

export function createResponseWindowSystem<TCore>(
    config: ResponseWindowSystemConfig = {}
): EngineSystem<TCore> {
    const { hasRespondableContent, getCommandCategory } = config;
    const buildWindowFingerprint = config.buildWindowFingerprint ?? buildResponseWindowFingerprint;
    const reopenDedupeCooldownMs = Math.max(0, config.reopenDedupeCooldownMs ?? 0);
    let lastClosedFingerprint: string | null = null;
    let lastClosedAt = 0;

    // 合并引擎级 + 游戏级允许命令
    const gameAllowedCommands = config.allowedCommands ?? [];
    const allAllowedCommands = new Set([
        ...ENGINE_ALLOWED_COMMANDS,
        ...gameAllowedCommands,
    ]);
    
    // 允许的命令分类
    const allowedCategories = new Set(config.allowedCommandCategories ?? []);
    
    const responderExempt = new Set(config.responderExemptCommands ?? []);
    const allowNonResponderCommand = config.allowNonResponderCommand;
    const windowTypeConstraints = config.commandWindowTypeConstraints ?? {};
    const advanceEvents = config.responseAdvanceEvents ?? [];
    const interactionLock = config.interactionLock;
    const loopUntilAllPass = config.loopUntilAllPass ?? false;
    const interactionFailureEventTypes = new Set(config.interactionFailureEventTypes ?? []);
    const hasInteractionFailureEvent = (eventsToCheck: GameEvent[]): boolean =>
        eventsToCheck.some(event => interactionFailureEventTypes.has(event.type));

    /** 判断命令是否为 SYS_ 前缀系统命令（始终放行） */
    const isSysCommand = (type: string) => type.startsWith('SYS_');
    
    /** 判断命令是否被允许（白名单 + 分类系统） */
    const isCommandAllowed = (commandType: string): boolean => {
        // 1. 检查白名单
        if (allAllowedCommands.has(commandType)) {
            return true;
        }
        
        // 2. 检查分类系统
        if (allowedCategories.size > 0 && getCommandCategory) {
            const category = getCommandCategory(commandType);
            if (category && allowedCategories.has(category)) {
                return true;
            }
        }
        
        return false;
    };

    return {
        id: SYSTEM_IDS.RESPONSE_WINDOW,
        name: '响应窗口系统',
        priority: 15, // 优先级 15（在 FlowSystem(10) 之后、InteractionSystem(20) 之前执行，确保能阻塞 autoContinue）

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

            if (command.type === INTERACTION_COMMANDS.FORCE_UNLOCK) {
                const cmdTimestamp = resolveCommandTimestamp(command);
                const newState = closeResponseWindow(state);
                const events: GameEvent[] = [{
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: currentWindow.id,
                        allPassed: false,
                        forced: true,
                        forceUnlock: true,
                        previousResponderId: currentResponderId ?? null,
                    },
                    timestamp: cmdTimestamp,
                }];
                return { halt: false, state: newState, events };
            }

            if (command.type === RESPONSE_WINDOW_COMMANDS.FORCE_CLOSE) {
                const cmdTimestamp = resolveCommandTimestamp(command);
                const newState = closeResponseWindow(state);
                const events: GameEvent[] = [{
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: currentWindow.id,
                        allPassed: false,
                        forced: true,
                        previousResponderId: currentResponderId ?? null,
                    },
                    timestamp: cmdTimestamp,
                }];
                return { halt: true, state: newState, events };
            }

            // 处理 RESPONSE_PASS 命令
            if (command.type === RESPONSE_WINDOW_COMMANDS.PASS) {
                if (currentWindow.pendingInteractionId || currentWindow.requiredInteractionId) {
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
                const _advResult = advanceToNextResponder(currentWindow, targetPlayerId, loopUntilAllPass);
                const nextWindow = skipToNextRespondableResponder(
                    state,
                    _advResult,
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
                if (
                    currentWindow.requiredInteractionId
                    && command.type === INTERACTION_COMMANDS.CANCEL
                ) {
                    return { halt: true, error: '强制展示交互不可取消' };
                }
                return;
            }

            // 游戏侧可以为当前活跃交互声明额外合法命令。
            // 例如 DiceThrone 的临时奖励骰确认属于骰主自己的阻塞交互，
            // 不应被响应窗口的“当前响应者”轮次误挡。
            if (allowNonResponderCommand?.({
                state: state as MatchState<unknown>,
                command,
                currentWindow,
                currentResponderId,
            })) {
                return;
            }

            // 检查命令是否被允许（白名单 + 分类系统）
            if (isCommandAllowed(command.type)) {
                // 窗口类型约束检查
                const constraints = windowTypeConstraints[command.type];
                if (constraints && !constraints.includes(currentWindow.windowType)) {
                    return { halt: true, error: '等待响应窗口关闭' };
                }
                // 非豁免命令需检查是否为当前响应者
                if (!responderExempt.has(command.type)) {
                    if (command.playerId !== currentResponderId) {
                        if (allowNonResponderCommand?.({
                            state: state as MatchState<unknown>,
                            command,
                            currentWindow,
                            currentResponderId,
                        })) {
                            return;
                        }
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
            let recentClosedWindow: ResponseWindowState['current'] | undefined;
            let sawNonResponseWindowEventSinceClose = false;
            let dedupeFallbackClock = 0;
            
            // 检查本轮事件中是否有 INTERACTION_EVENTS.RESOLVED
            // 如果有，说明本轮可能有更高优先级的游戏层系统
            // 会创建新的 interaction，此时不应立即解锁响应窗口，等下一轮再检查
            const hasInteractionResolved = events.some(e => e.type === INTERACTION_EVENTS.RESOLVED);
            const completedInteractionIds = new Set(
                events
                    .filter(e => e.type === INTERACTION_EVENTS.CONFIRMED)
                    .map(e => {
                        const interactionId = (e.payload as { interactionId?: unknown } | undefined)?.interactionId;
                        return typeof interactionId === 'string' ? interactionId : undefined;
                    })
                    .filter((interactionId): interactionId is string => interactionId !== undefined),
            );

            // 前瞻检查：同一批事件中是否包含交互锁定请求事件（如 INTERACTION_REQUESTED）
            // 用于 responseAdvanceEvents 推进时判断——如果同批事件中有交互请求，
            // 应走锁定分支而非直接推进，避免因事件顺序（CARD_PLAYED 先于 INTERACTION_REQUESTED）
            // 导致窗口在交互创建前就被关闭
            const hasInteractionLockRequest = interactionLock
                ? events.some(e => e.type === interactionLock.requestEvent)
                : false;
            
            for (const event of events) {
                const eventTimestamp = resolveEventTimestamp(event);
                const dedupeClock = eventTimestamp > 0 ? eventTimestamp : (dedupeFallbackClock += 1);
                const isResponseWindowControlEvent =
                    event.type === RESPONSE_WINDOW_EVENTS.OPENED
                    || event.type === RESPONSE_WINDOW_EVENTS.CLOSED
                    || event.type === RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED
                    || event.type === RESPONSE_WINDOW_EVENTS._CHECK_UNLOCK;
                if (recentClosedWindow && !isResponseWindowControlEvent) {
                    sawNonResponseWindowEventSinceClose = true;
                }

                // 处理响应窗口打开事件
                if (event.type === RESPONSE_WINDOW_EVENTS.OPENED) {
                    const payload = event.payload as {
                        windowId: string;
                        responderQueue: PlayerId[];
                        windowType: ResponseWindowType;
                        sourceId?: string;
                        resolutionFrameId?: string;
                        requiredInteractionId?: string;
                    };
                    
                    const window = createResponseWindow(
                        payload.windowId,
                        payload.responderQueue,
                        payload.windowType,
                        payload.sourceId,
                        {
                            resolutionFrameId: payload.resolutionFrameId,
                            requiredInteractionId: payload.requiredInteractionId,
                        },
                    );
                    
                    if (window) {
                        const fingerprint = buildWindowFingerprint(window);
                        const currentWindow = newState.sys.responseWindow?.current;
                        if (currentWindow && isSemanticallyEquivalentWindow(currentWindow, window)) {
                            continue;
                        }
                        if (
                            recentClosedWindow
                            && !sawNonResponseWindowEventSinceClose
                            && isSemanticallyEquivalentWindow(recentClosedWindow, window)
                        ) {
                            continue;
                        }
                        if (reopenDedupeCooldownMs > 0
                            && lastClosedFingerprint
                            && lastClosedFingerprint === fingerprint
                            && (dedupeClock - lastClosedAt) <= reopenDedupeCooldownMs
                        ) {
                            continue;
                        }
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

                if (event.type === INTERACTION_EVENTS.RESOLVED) {
                    const interactionId = (event.payload as { interactionId?: unknown }).interactionId;
                    const currentWindow = newState.sys.responseWindow?.current;
                    if (
                        currentWindow
                        && typeof interactionId === 'string'
                        && currentWindow.requiredInteractionId === interactionId
                    ) {
                        const closedWindowId = currentWindow.id;
                        newState = closeResponseWindow(newState);
                        additionalEvents.push({
                            type: RESPONSE_WINDOW_EVENTS.CLOSED,
                            payload: {
                                windowId: closedWindowId,
                                allPassed: false,
                                requiredInteractionResolved: true,
                            },
                            timestamp: eventTimestamp,
                        });
                    }
                }
                
                // 处理响应窗口关闭事件
                if (event.type === RESPONSE_WINDOW_EVENTS.CLOSED) {
                    const closingWindow = newState.sys.responseWindow?.current;
                    if (closingWindow) {
                        lastClosedFingerprint = buildWindowFingerprint(closingWindow);
                        lastClosedAt = dedupeClock;
                    }
                    recentClosedWindow = newState.sys.responseWindow?.current;
                    sawNonResponseWindowEventSinceClose = false;
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
                            const lockedWindow = loopUntilAllPass
                                ? {
                                    ...currentWindow,
                                    pendingInteractionId: interactionPayload.interaction.id,
                                    actionTakenThisRound: true,
                                    consecutivePassRounds: 0,
                                }
                                : {
                                    ...currentWindow,
                                    pendingInteractionId: interactionPayload.interaction.id,
                                };
                            newState = writeResponseWindowCurrent(newState, lockedWindow);
                        }
                    }
                }
                
                // 交互锁定（状态驱动）：检测 sys.interaction.current 被清空后自动解锁并推进
                // 同时处理两种情况：
                // 1. 显式 interactionLock 配置（通过 requestEvent 锁定）
                // 2. 通用交互阻塞（responseAdvanceEvents 检测到 interaction 存在时自动设置 pendingInteractionId）
                //
                // 注意：当本轮事件包含 INTERACTION_EVENTS.RESOLVED 时，不立即解锁，而是发出
                // _CHECK_UNLOCK 内部事件，驱动下一轮 afterEvents 再检查。
                // 原因：ResponseWindowSystem 可能先于游戏层系统执行，
                // 后续游戏层系统可能在同一轮 afterEvents 中创建新的 interaction（如多步交互的第二步）。
                // 等到下一轮时，若 sys.interaction.current 仍为 null，才真正解锁推进。
                {
                    const currentWindow = newState.sys.responseWindow?.current;
                    const lockedInteractionWasConfirmed = currentWindow?.pendingInteractionId !== undefined
                        && completedInteractionIds.has(currentWindow.pendingInteractionId);
                    if (
                        currentWindow
                        && currentWindow.pendingInteractionId
                        && (lockedInteractionWasConfirmed || !newState.sys.interaction.current)
                    ) {
                        // 【修复】检查本轮事件中是否有 ABILITY_FEEDBACK（交互失败）
                        // 交互失败时，解锁但不推进，当前响应者继续响应
                        const hasAbilityFeedback = hasInteractionFailureEvent(events);
                        
                        if (hasAbilityFeedback) {
                            // 交互失败：先解锁。如果当前响应者已无可响应内容，则自动推进/关闭，避免循环卡死。
                            const unlockedWindow = { ...currentWindow, pendingInteractionId: undefined };
                            const currentResponderId = getCurrentResponderId(unlockedWindow);
                            const canStillRespond = currentResponderId && hasRespondableContent
                                ? hasRespondableContent(
                                    newState.core as unknown,
                                    currentResponderId,
                                    unlockedWindow.windowType,
                                    unlockedWindow.sourceId,
                                    {
                                        matchState: newState as MatchState<unknown>,
                                        window: unlockedWindow,
                                    },
                                )
                                : true;

                            if (!canStillRespond && currentResponderId) {
                                const nextWindow = skipToNextRespondableResponder(
                                    newState,
                                    advanceToNextResponder(unlockedWindow, currentResponderId, loopUntilAllPass),
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
                                            allPassed: true,
                                        },
                                        timestamp: eventTimestamp,
                                    });
                                }
                            } else {
                                newState = writeResponseWindowCurrent(newState, unlockedWindow);
                            }
                        } else if (hasInteractionLockRequest) {
                            // 同批事件中有交互锁定请求（如 INTERACTION_REQUESTED），但更高优先级的系统
                            // 尚未执行，sys.interaction.current 还是空的。
                            // 此时不能解锁，等下一轮 afterEvents 再检查。
                            // 不做任何操作，等待交互被创建
                        } else if (hasInteractionResolved) {
                            // 本轮有 RESOLVED，推迟到下一轮检查（发出内部驱动事件）
                            additionalEvents.push({
                                type: RESPONSE_WINDOW_EVENTS._CHECK_UNLOCK,
                                payload: {},
                                timestamp: eventTimestamp,
                            });
                        } else {
                            // 正常推进到下一个响应者
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
                
                // _CHECK_UNLOCK：下一轮检查是否可以解锁（由上面的延迟逻辑触发）
                if (event.type === RESPONSE_WINDOW_EVENTS._CHECK_UNLOCK) {
                    const currentWindow = newState.sys.responseWindow?.current;
                    if (currentWindow && currentWindow.pendingInteractionId && !newState.sys.interaction.current) {
                        // 【修复】检查本轮事件中是否有 ABILITY_FEEDBACK（交互失败）
                        const hasAbilityFeedback = hasInteractionFailureEvent(events);
                        
                        if (hasAbilityFeedback) {
                            // 交互失败：先解锁。如果当前响应者已无可响应内容，则自动推进/关闭，避免循环卡死。
                            const unlockedWindow = { ...currentWindow, pendingInteractionId: undefined };
                            const currentResponderId = getCurrentResponderId(unlockedWindow);
                            const canStillRespond = currentResponderId && hasRespondableContent
                                ? hasRespondableContent(
                                    newState.core as unknown,
                                    currentResponderId,
                                    unlockedWindow.windowType,
                                    unlockedWindow.sourceId,
                                    {
                                        matchState: newState as MatchState<unknown>,
                                        window: unlockedWindow,
                                    },
                                )
                                : true;

                            if (!canStillRespond && currentResponderId) {
                                const nextWindow = skipToNextRespondableResponder(
                                    newState,
                                    advanceToNextResponder(unlockedWindow, currentResponderId, loopUntilAllPass),
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
                                            allPassed: true,
                                        },
                                        timestamp: eventTimestamp,
                                    });
                                }
                            } else {
                                newState = writeResponseWindowCurrent(newState, unlockedWindow);
                            }
                        } else {
                            // 正常推进到下一个响应者
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
                    // 窗口类型约束（先检查，避免对不匹配的窗口类型误触发锁定）
                    if (adv.windowTypes && !adv.windowTypes.includes(currentWindow.windowType)) continue;
                    const cardPayload = event.payload as { playerId: PlayerId };
                    const currentResponderId = getCurrentResponderId(currentWindow);
                    // 只有当前响应者的事件才推进
                    if (cardPayload.playerId !== currentResponderId) break;
                    
                    // 前瞻：同批事件中有交互锁定请求（如 INTERACTION_REQUESTED），
                    // 但 InteractionSystem（优先级更高）尚未执行，sys.interaction.current 还是空的。
                    // 此时不能推进窗口，等后续 interactionLock 分支处理锁定。
                    if (hasInteractionLockRequest) {
                        break;
                    }
                    // 有当前响应者自己的活跃交互时暂不推进；其它玩家的待处理交互不能锁住响应窗口。
                    if (
                        newState.sys.interaction?.current
                        && newState.sys.interaction.current.playerId === currentResponderId
                    ) {
                        const interactionId = newState.sys.interaction.current.id;
                        const markedForLock = loopUntilAllPass
                            ? { ...currentWindow, pendingInteractionId: interactionId, actionTakenThisRound: true, consecutivePassRounds: 0 }
                            : { ...currentWindow, pendingInteractionId: interactionId };
                        newState = writeResponseWindowCurrent(newState, markedForLock);
                        break;
                    }
                    
                    // 标记本轮有人执行了动作（用于 loopUntilAllPass 循环判定），并重置 consecutivePassRounds
                    const markedWindow = loopUntilAllPass
                        ? { ...currentWindow, actionTakenThisRound: true, consecutivePassRounds: 0 }
                        : currentWindow;
                    
                    const _advAdvance = advanceToNextResponder(markedWindow, currentResponderId, loopUntilAllPass);
                    const nextWindow = skipToNextRespondableResponder(
                        newState,
                        _advAdvance,
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
            
            newState = syncActiveResolutionWithResponseWindow(newState);

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
                    current: cloneResponseWindowCurrent(currentWindow),
                },
            };
        },
    };
}
