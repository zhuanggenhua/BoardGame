import type { MatchState } from '../types';
import type { GameEngineConfig } from '../transport/server';
import { applyPlayerViewToState } from './playerView';
import { buildAiDecisionContext, createAiLegalActionId, resolveAiActionDecision } from './context';
import { isResolvedOnlineAiDecisionView, type ResolvedOnlineAiDecisionView } from './onlineDecisionView';
import {
    getGameAiRuntime,
    getRemoteAiProvider,
    resolveLocalAiPolicy,
    resolveLocalAiPolicyByPreference,
} from './registry';
import { isManualSetupSelectionEnabledForSeat } from './seatControllers';
import type { AiLegalAction, AiResponseWindowSnapshot, AiSeatController } from './types';
import { createScopedLogger } from '../../lib/logger';
import { resolveCurrentDecisionPlayerId } from '../sessionContext';

const DEFAULT_REMOTE_AI_TIMEOUT_MS = 3000;
const FAST_PASS_ACTION_KINDS = new Set(['advance-phase', 'response-pass']);
export const MANUAL_SETUP_SELECTION_ACTION_KINDS = new Set([
    'select-faction',
    'setup-select-faction',
    'setup-select-character',
]);
const aiRunnerLogger = createScopedLogger('AI_RUNNER_PERF');
function emitAiRunnerPerf(stage: string, payload: Record<string, unknown>): void {
    console.log('[AI_RUNNER_PERF]', { stage, ...payload });
}

export interface AiResolution {
    playerId: string;
    action: AiLegalAction;
    attemptKey: string;
    source: 'local-ai' | 'remote-ai' | 'remote-ai-fallback';
}

interface ResolveNextAiActionArgs {
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    matchId: string;
    seatControllers: Record<string, AiSeatController>;
    rulesVersion?: string | null;
    decisionBudgetMs?: number;
    /**
     * 在线房间里，每个 AI seat 都有自己的 transport client 和 playerView。
     * 如果继续基于“当前主玩家”的过滤状态再套一层 playerView，
     * AI 会看不到只对自己可见的交互，导致 simple-choice 永远不响应。
     * 若 seat 的专属视角尚未就绪，resolveNextAiDispatch 会返回 blocked，
     * 而不是回退到错误视角继续决策。
     */
    visibleStateResolver?: (playerId: string) => MatchState<unknown> | ResolvedOnlineAiDecisionView | null | undefined;
}

export interface AiBlockedResolution {
    kind: 'blocked';
    playerId: string;
    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay';
    visibility: 'shared' | 'private-required' | 'unknown';
    blockedKey: string;
    diagnostics: {
        sharedPhase: string | null;
        privatePhase: string | null;
        sharedTurnNumber: number | null;
        privateTurnNumber: number | null;
        sharedCurrentPlayerId: string | null;
        privateCurrentPlayerId: string | null;
        sharedEventStreamNextId: number | null;
        privateEventStreamNextId: number | null;
    } | null;
}

export interface AiIdleResolution {
    kind: 'idle';
    idleReason: 'runtime-unavailable' | 'no-action';
}

export interface AiActionResolution {
    kind: 'action';
    resolution: AiResolution;
}

export type AiDispatchResult = AiActionResolution | AiBlockedResolution | AiIdleResolution;

export function shouldPlayerManuallyResolveSetupSelection(
    engineConfig: GameEngineConfig,
    state: MatchState<unknown>,
    playerId: string,
    seatController: AiSeatController,
    action: AiLegalAction,
): boolean {
    if (!isManualSetupSelectionEnabledForSeat(seatController)) {
        return false;
    }

    const overriddenDecision = engineConfig.onlineAiRecovery?.shouldTreatActionAsManualSetupSelection?.({
        actionKind: action.kind,
        actionId: action.actionId,
        commandTypes: action.commands.map((command) => command.type),
    });
    if (overriddenDecision !== undefined) {
        return overriddenDecision;
    }

    return MANUAL_SETUP_SELECTION_ACTION_KINDS.has(action.kind);
}

function shouldUseRemoteDecision(args: {
    runtime: ReturnType<typeof getGameAiRuntime>;
    context: ReturnType<typeof buildAiDecisionContext>;
    seatController: Extract<AiSeatController, { type: 'remote-ai' }>;
}): boolean {
    const predicate = args.runtime?.shouldUseRemoteDecision;
    if (!predicate) {
        return true;
    }

    try {
        return predicate(args.context, args.seatController);
    } catch {
        return true;
    }
}

function refineAiAction(args: {
    runtime: ReturnType<typeof getGameAiRuntime>;
    context: ReturnType<typeof buildAiDecisionContext>;
    proposedAction: AiLegalAction | null;
    source: 'local-policy' | 'local-fallback' | 'remote-ai' | 'remote-ai-fallback';
}): AiLegalAction | null {
    if (!args.proposedAction) return null;
    const refiner = args.runtime?.refineAiAction;
    if (!refiner) {
        return args.proposedAction;
    }

    try {
        const refinedAction = refiner({
            context: args.context,
            proposedAction: args.proposedAction,
            source: args.source,
        });
        return refinedAction === undefined ? args.proposedAction : refinedAction;
    } catch {
        return args.proposedAction;
    }
}

function buildAttemptKey(args: {
    runtime: ReturnType<typeof getGameAiRuntime>;
    state: MatchState<unknown>;
    playerId: string;
    controller: AiSeatController;
    legalActions: AiLegalAction[];
    interactionId?: string | null;
    responderIndex?: number | null;
}): string {
    const phase = typeof args.state.sys?.phase === 'string' ? args.state.sys.phase : '';
    const currentPlayerId = resolveCurrentDecisionPlayerId({
        state: args.state,
        resolveCurrentDecisionPlayerId: args.runtime?.resolveCurrentDecisionPlayerId,
    }) ?? '';
    const legalActionIds = args.legalActions.map((item) => item.actionId).join(',');
    const stateTurnNumber = typeof args.state.sys?.turnNumber === 'number'
        ? args.state.sys.turnNumber
        : '';
    const statePhase = phase;
    const eventStreamNextId = typeof args.state.sys?.eventStream?.nextId === 'number'
        ? args.state.sys.eventStream.nextId
        : '';
    const decisionEpoch = typeof args.state.sys?.decisionEpoch === 'number'
        ? args.state.sys.decisionEpoch
        : 0;
    const currentInteraction = args.state.sys?.interaction?.current as {
        id?: unknown;
        sourceId?: unknown;
        data?: {
            sourceId?: unknown;
            options?: Array<{ id?: unknown; disabled?: unknown }>;
        };
    } | undefined;
    const interactionSourceId = typeof currentInteraction?.sourceId === 'string'
        ? currentInteraction.sourceId
        : typeof currentInteraction?.data?.sourceId === 'string'
            ? currentInteraction.data.sourceId
            : '';
    const interactionOptionSignature = Array.isArray(currentInteraction?.data?.options)
        ? currentInteraction.data.options
            .map((option) => {
                const optionId = typeof option?.id === 'string' ? option.id : '';
                const disabledFlag = option?.disabled === true ? '1' : '0';
                return `${optionId}:${disabledFlag}`;
            })
            .join(',')
        : '';
    const responseWindow = args.state.sys?.responseWindow?.current as {
        id?: unknown;
        sourceId?: unknown;
        windowType?: unknown;
    } | undefined;
    const responseWindowSourceId = typeof responseWindow?.sourceId === 'string'
        ? responseWindow.sourceId
        : '';
    const responseWindowType = typeof responseWindow?.windowType === 'string'
        ? responseWindow.windowType
        : '';
    const controllerKey = args.controller.type === 'remote-ai'
        ? `${args.controller.type}:${args.controller.providerId}:${args.controller.fallbackPolicyId ?? ''}`
        : args.controller.type === 'local-ai'
            ? `${args.controller.type}:${args.controller.policyId ?? ''}:${args.controller.fallbackPolicyId ?? ''}`
            : args.controller.type;

    return [
        args.playerId,
        controllerKey,
        stateTurnNumber,
        statePhase,
        eventStreamNextId,
        decisionEpoch,
        args.interactionId ?? '',
        interactionSourceId,
        interactionOptionSignature,
        responseWindowType,
        responseWindowSourceId,
        args.responderIndex ?? '',
        currentPlayerId,
        legalActionIds,
    ].join('|');
}

async function withTimeout<T>(
    task: Promise<T>,
    timeoutMs: number,
): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return task;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            task,
            new Promise<T>((_resolve, reject) => {
                timer = setTimeout(() => {
                    reject(new Error('remote_ai_timeout'));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

async function resolveRemoteFallbackAction(args: {
    runtimeGameId: string;
    seatController: Extract<AiSeatController, { type: 'remote-ai' }>;
    context: ReturnType<typeof buildAiDecisionContext>;
}): Promise<AiLegalAction | null> {
    const runtime = getGameAiRuntime(args.runtimeGameId);
    const fallbackPolicy = resolveLocalAiPolicyByPreference({
        runtime,
        preferredPolicyId: args.seatController.fallbackPolicyId,
        fallbackPolicyId: runtime?.defaultLocalPolicyId,
    });

    if (fallbackPolicy) {
        const decision = await fallbackPolicy.decide(args.context);
        return resolveAiActionDecision(args.context, decision);
    }

    return args.context.legalActions[0] ?? null;
}

function buildResponsePassFallbackAction(args: {
    playerId: string;
    responseWindow: AiResponseWindowSnapshot;
}): AiLegalAction {
    return {
        actionId: createAiLegalActionId(
            'response-pass',
            args.responseWindow.windowType ?? 'unknown',
            'fallback',
            args.playerId,
        ),
        kind: 'response-pass',
        label: '跳过响应',
        commands: [{ type: 'RESPONSE_PASS', payload: {} }],
        metadata: {
            windowType: args.responseWindow.windowType,
            fallback: true,
        },
    };
}

function resolveResponsePassFallback(context: ReturnType<typeof buildAiDecisionContext>): AiLegalAction | null {
    if (context.interaction) return null;
    const responseWindow = context.responseWindow;
    if (!responseWindow || !Array.isArray(responseWindow.responderQueue)) return null;
    if (responseWindow.pendingInteractionId) return null;
    const responderIndex = typeof responseWindow.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : 0;
    const responderId = responseWindow.responderQueue[responderIndex];
    if (responderId !== context.playerId) {
        return null;
    }
    return buildResponsePassFallbackAction({
        playerId: context.playerId,
        responseWindow,
    });
}

async function resolveRemoteAction(args: {
    runtimeGameId: string;
    seatController: Extract<AiSeatController, { type: 'remote-ai' }>;
    context: ReturnType<typeof buildAiDecisionContext>;
}): Promise<{ action: AiLegalAction | null; usedFallback: boolean }> {
    const provider = getRemoteAiProvider(args.seatController.providerId);
    if (!provider) {
        return {
            action: await resolveRemoteFallbackAction(args),
            usedFallback: true,
        };
    }

    const timeoutMs = args.seatController.timeoutMs
        ?? provider.defaultTimeoutMs
        ?? DEFAULT_REMOTE_AI_TIMEOUT_MS;
    const retryCount = Math.max(
        0,
        args.seatController.retryCount
        ?? provider.defaultRetryCount
        ?? 0,
    );

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        const attemptStartedAt = Date.now();
        try {
            const decision = await withTimeout(
                Promise.resolve(provider.decide(args.context, args.seatController)),
                timeoutMs,
            );
            const action = resolveAiActionDecision(args.context, decision);
            if (action) {
                aiRunnerLogger.info('remote-attempt-succeeded', {
                    runtimeGameId: args.runtimeGameId,
                    providerId: args.seatController.providerId,
                    attempt,
                    retryCount,
                    timeoutMs,
                    elapsedMs: Date.now() - attemptStartedAt,
                    usedFallback: false,
                    actionKind: action.kind,
                    commandTypes: action.commands.map((command) => command.type),
                });
                emitAiRunnerPerf('remote-attempt-succeeded', {
                    runtimeGameId: args.runtimeGameId,
                    providerId: args.seatController.providerId,
                    attempt,
                    retryCount,
                    timeoutMs,
                    elapsedMs: Date.now() - attemptStartedAt,
                    usedFallback: false,
                    actionKind: action.kind,
                    commandTypes: action.commands.map((command) => command.type),
                });
                return { action, usedFallback: false };
            }
            aiRunnerLogger.warn('remote-attempt-empty', {
                runtimeGameId: args.runtimeGameId,
                providerId: args.seatController.providerId,
                attempt,
                retryCount,
                timeoutMs,
                elapsedMs: Date.now() - attemptStartedAt,
            });
            emitAiRunnerPerf('remote-attempt-empty', {
                runtimeGameId: args.runtimeGameId,
                providerId: args.seatController.providerId,
                attempt,
                retryCount,
                timeoutMs,
                elapsedMs: Date.now() - attemptStartedAt,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            aiRunnerLogger.warn('remote-attempt-failed', {
                runtimeGameId: args.runtimeGameId,
                providerId: args.seatController.providerId,
                attempt,
                retryCount,
                timeoutMs,
                elapsedMs: Date.now() - attemptStartedAt,
                reason: message,
            });
            emitAiRunnerPerf('remote-attempt-failed', {
                runtimeGameId: args.runtimeGameId,
                providerId: args.seatController.providerId,
                attempt,
                retryCount,
                timeoutMs,
                elapsedMs: Date.now() - attemptStartedAt,
                reason: message,
            });
        }
    }

    const fallbackAction = await resolveRemoteFallbackAction(args);
    aiRunnerLogger.warn('remote-fallback-used', {
        runtimeGameId: args.runtimeGameId,
        providerId: args.seatController.providerId,
        retryCount,
        timeoutMs,
        actionKind: fallbackAction?.kind ?? null,
        commandTypes: fallbackAction?.commands.map((command) => command.type) ?? [],
    });
    emitAiRunnerPerf('remote-fallback-used', {
        runtimeGameId: args.runtimeGameId,
        providerId: args.seatController.providerId,
        retryCount,
        timeoutMs,
        actionKind: fallbackAction?.kind ?? null,
        commandTypes: fallbackAction?.commands.map((command) => command.type) ?? [],
    });
    return {
        action: fallbackAction,
        usedFallback: true,
    };
}

export async function resolveNextAiAction(
    args: ResolveNextAiActionArgs,
): Promise<AiResolution | null> {
    const result = await resolveNextAiDispatch(args);
    return result.kind === 'action' ? result.resolution : null;
}

export async function resolveNextAiDispatch(
    args: ResolveNextAiActionArgs,
): Promise<AiDispatchResult> {
    const runtime = getGameAiRuntime(args.engineConfig.gameId);
    if (!runtime) {
        return {
            kind: 'idle',
            idleReason: 'runtime-unavailable',
        };
    }

    const decisionBudgetMs = args.decisionBudgetMs ?? 250;
    const rulesVersion = args.rulesVersion ?? null;
    let firstBlocked: AiBlockedResolution | null = null;

    for (const [playerId, seatController] of Object.entries(args.seatControllers)) {
        if (seatController.type === 'human') continue;

        const resolvedVisibleState = args.visibleStateResolver?.(playerId);
        if (resolvedVisibleState === null) {
            if (!firstBlocked) {
                firstBlocked = {
                    kind: 'blocked',
                    playerId,
                    blockedReason: 'missing-visible-state',
                    visibility: 'unknown',
                    blockedKey: `${playerId}:missing-visible-state`,
                    diagnostics: null,
                };
            }
            continue;
        }

        if (isResolvedOnlineAiDecisionView(resolvedVisibleState) && !resolvedVisibleState.canDecide) {
            if (!firstBlocked) {
                const blockedReason = resolvedVisibleState.blockedReason ?? 'missing-visible-state';
                firstBlocked = {
                    kind: 'blocked',
                    playerId,
                    blockedReason,
                    visibility: resolvedVisibleState.visibility,
                    blockedKey: [
                        playerId,
                        resolvedVisibleState.visibility,
                        blockedReason,
                        resolvedVisibleState.diagnostics.sharedTurnNumber ?? 'no-shared-turn',
                        resolvedVisibleState.diagnostics.sharedPhase ?? 'no-shared-phase',
                        resolvedVisibleState.diagnostics.sharedCurrentPlayerId ?? 'no-shared-player',
                        resolvedVisibleState.diagnostics.sharedEventStreamNextId ?? 'no-shared-eventstream',
                        resolvedVisibleState.diagnostics.privateTurnNumber ?? 'no-seat-turn',
                        resolvedVisibleState.diagnostics.privatePhase ?? 'no-seat-phase',
                        resolvedVisibleState.diagnostics.privateCurrentPlayerId ?? 'no-seat-player',
                        resolvedVisibleState.diagnostics.privateEventStreamNextId ?? 'no-seat-eventstream',
                    ].join(':'),
                    diagnostics: resolvedVisibleState.diagnostics,
                };
            }
            continue;
        }

        const visibleState = isResolvedOnlineAiDecisionView(resolvedVisibleState)
            ? resolvedVisibleState.visibleState
            : resolvedVisibleState ?? applyPlayerViewToState(args.engineConfig, args.state, playerId);
        const context = buildAiDecisionContext({
            gameId: args.engineConfig.gameId,
            matchId: args.matchId,
            playerId,
            visibleState,
            rulesVersion,
            decisionBudgetMs,
            source: seatController.type === 'remote-ai' ? 'online' : 'local',
            seatController,
        });
        if (isManualSetupSelectionEnabledForSeat(seatController)) {
            const autoActions = context.legalActions.filter((action) => (
                !shouldPlayerManuallyResolveSetupSelection(
                    args.engineConfig,
                    args.state,
                    playerId,
                    seatController,
                    action,
                )
            ));
            if (autoActions.length !== context.legalActions.length) {
                if (autoActions.length === 0) {
                    continue;
                }
                context.legalActions = autoActions;
            }
        }

        if (context.legalActions.length === 0) {
            const fallbackAction = resolveResponsePassFallback(context);
            if (fallbackAction) {
                const attemptKey = buildAttemptKey({
                    runtime,
                    state: args.state,
                    playerId,
                    controller: seatController,
                    legalActions: [fallbackAction],
                    interactionId: context.interaction?.id ?? null,
                    responderIndex: context.responseWindow?.currentResponderIndex ?? null,
                });
                return {
                    kind: 'action',
                    resolution: {
                        playerId,
                        action: fallbackAction,
                        attemptKey,
                        source: seatController.type === 'remote-ai' ? 'remote-ai-fallback' : 'local-ai',
                    },
                };
            }
            continue;
        }

        // 快速通道：如果只剩一个“阶段推进/响应跳过”动作，直接返回，
        // 不再调用本地/远端策略，避免空决策阶段产生额外等待。
        if (context.legalActions.length === 1) {
            const singleAction = context.legalActions[0];
            if (FAST_PASS_ACTION_KINDS.has(singleAction.kind)) {
                const attemptKey = buildAttemptKey({
                    runtime,
                    state: args.state,
                    playerId,
                    controller: seatController,
                    legalActions: [singleAction],
                    interactionId: context.interaction?.id ?? null,
                    responderIndex: context.responseWindow?.currentResponderIndex ?? null,
                });
                return {
                    kind: 'action',
                    resolution: {
                        playerId,
                        action: singleAction,
                        attemptKey,
                        source: seatController.type === 'remote-ai' ? 'remote-ai-fallback' : 'local-ai',
                    },
                };
            }
        }

        const attemptKey = buildAttemptKey({
            runtime,
            state: args.state,
            playerId,
            controller: seatController,
            legalActions: context.legalActions,
            interactionId: context.interaction?.id ?? null,
            responderIndex: context.responseWindow?.currentResponderIndex ?? null,
        });

        if (seatController.type === 'local-ai') {
            const policy = resolveLocalAiPolicy(runtime, seatController);
            if (!policy) continue;

            let action: AiLegalAction | null = null;
            try {
                const decision = await policy.decide(context);
                action = refineAiAction({
                    runtime,
                    context,
                    proposedAction: resolveAiActionDecision(context, decision),
                    source: 'local-policy',
                });
            } catch {
                action = null;
            }

            if (!action) {
                action = refineAiAction({
                    runtime,
                    context,
                    proposedAction: context.legalActions[0] ?? null,
                    source: 'local-fallback',
                });
            }
            if (!action) continue;

            return {
                kind: 'action',
                resolution: {
                    playerId,
                    action,
                    attemptKey,
                    source: 'local-ai',
                },
            };
        }

        if (!shouldUseRemoteDecision({
            runtime,
            context,
            seatController,
        })) {
            const action = refineAiAction({
                runtime,
                context,
                proposedAction: await resolveRemoteFallbackAction({
                    runtimeGameId: args.engineConfig.gameId,
                    seatController,
                    context,
                }),
                source: 'remote-ai-fallback',
            });
            if (!action) continue;

            return {
                kind: 'action',
                resolution: {
                    playerId,
                    action,
                    attemptKey,
                    source: 'remote-ai-fallback',
                },
            };
        }

        const remoteResolution = await resolveRemoteAction({
            runtimeGameId: args.engineConfig.gameId,
            seatController,
            context,
        });
        const remoteAction = refineAiAction({
            runtime,
            context,
            proposedAction: remoteResolution.action,
            source: remoteResolution.usedFallback ? 'remote-ai-fallback' : 'remote-ai',
        });
        if (!remoteAction) continue;

        return {
            kind: 'action',
            resolution: {
                playerId,
                action: remoteAction,
                attemptKey,
                source: remoteResolution.usedFallback ? 'remote-ai-fallback' : 'remote-ai',
            },
        };
    }

    if (firstBlocked) {
        return firstBlocked;
    }

    return {
        kind: 'idle',
        idleReason: 'no-action',
    };
}

export const resolveNextLocalAiAction = resolveNextAiAction;
