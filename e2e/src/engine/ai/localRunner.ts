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
import type { AiLegalAction, AiResponseWindowSnapshot, AiSeatController } from './types';

const DEFAULT_REMOTE_AI_TIMEOUT_MS = 3000;

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

function buildAttemptKey(args: {
    state: MatchState<unknown>;
    playerId: string;
    controller: AiSeatController;
    legalActions: AiLegalAction[];
    interactionId?: string | null;
    responderIndex?: number | null;
}): string {
    const legalActionIds = args.legalActions.map((item) => item.actionId).join(',');
    const stateTurnNumber = typeof args.state.sys?.turnNumber === 'number'
        ? args.state.sys.turnNumber
        : '';
    const statePhase = typeof args.state.sys?.phase === 'string'
        ? args.state.sys.phase
        : '';
    const eventStreamNextId = typeof args.state.sys?.eventStream?.nextId === 'number'
        ? args.state.sys.eventStream.nextId
        : '';
    const responseWindow = args.state.sys?.responseWindow?.current as {
        id?: unknown;
        sourceId?: unknown;
        windowType?: unknown;
    } | undefined;
    const responseWindowId = typeof responseWindow?.id === 'string'
        ? responseWindow.id
        : '';
    const responseWindowSourceId = typeof responseWindow?.sourceId === 'string'
        ? responseWindow.sourceId
        : '';
    const responseWindowType = typeof responseWindow?.windowType === 'string'
        ? responseWindow.windowType
        : '';
    const controllerKey = args.controller.type === 'remote-ai'
        ? `${args.controller.type}:${args.controller.providerId}:${args.controller.fallbackPolicyId ?? ''}`
        : `${args.controller.type}:${args.controller.policyId ?? ''}:${args.controller.fallbackPolicyId ?? ''}`;

    return [
        args.playerId,
        controllerKey,
        stateTurnNumber,
        statePhase,
        eventStreamNextId,
        args.interactionId ?? '',
        responseWindowType,
        responseWindowId,
        responseWindowSourceId,
        args.responderIndex ?? '',
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
        try {
            const decision = await withTimeout(
                Promise.resolve(provider.decide(args.context, args.seatController)),
                timeoutMs,
            );
            const action = resolveAiActionDecision(args.context, decision);
            if (action) {
                return { action, usedFallback: false };
            }
        } catch {
            // 远程 provider 出错或超时都走显式 fallback。
        }
    }

    return {
        action: await resolveRemoteFallbackAction(args),
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

        if (context.legalActions.length === 0) {
            const fallbackAction = resolveResponsePassFallback(context);
            if (fallbackAction) {
                const attemptKey = buildAttemptKey({
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

        const attemptKey = buildAttemptKey({
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
                action = resolveAiActionDecision(context, decision);
            } catch {
                action = null;
            }

            if (!action) {
                action = context.legalActions[0] ?? null;
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
            const action = await resolveRemoteFallbackAction({
                runtimeGameId: args.engineConfig.gameId,
                seatController,
                context,
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
        if (!remoteResolution.action) continue;

        return {
            kind: 'action',
            resolution: {
                playerId,
                action: remoteResolution.action,
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
