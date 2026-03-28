import type { MatchState } from '../types';
import type { GameEngineConfig } from '../transport/server';
import { applyPlayerViewToState } from './playerView';
import { buildAiDecisionContext, resolveAiActionDecision } from './context';
import {
    getGameAiRuntime,
    getRemoteAiProvider,
    resolveLocalAiPolicy,
    resolveLocalAiPolicyByPreference,
} from './registry';
import type { AiLegalAction, AiSeatController } from './types';

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
    const controllerKey = args.controller.type === 'remote-ai'
        ? `${args.controller.type}:${args.controller.providerId}:${args.controller.fallbackPolicyId ?? ''}`
        : `${args.controller.type}:${args.controller.policyId ?? ''}:${args.controller.fallbackPolicyId ?? ''}`;

    return [
        args.playerId,
        controllerKey,
        stateTurnNumber,
        statePhase,
        args.interactionId ?? '',
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
    const runtime = getGameAiRuntime(args.engineConfig.gameId);
    if (!runtime) return null;

    const decisionBudgetMs = args.decisionBudgetMs ?? 250;
    const rulesVersion = args.rulesVersion ?? null;

    for (const [playerId, seatController] of Object.entries(args.seatControllers)) {
        if (seatController.type === 'human') continue;

        const visibleState = applyPlayerViewToState(args.engineConfig, args.state, playerId);
        const context = buildAiDecisionContext({
            gameId: args.engineConfig.gameId,
            matchId: args.matchId,
            playerId,
            visibleState,
            rulesVersion,
            decisionBudgetMs,
            source: seatController.type === 'remote-ai' ? 'online' : 'local',
        });

        if (context.legalActions.length === 0) continue;

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

            const decision = await policy.decide(context);
            const action = resolveAiActionDecision(context, decision);
            if (!action) continue;

            return {
                playerId,
                action,
                attemptKey,
                source: 'local-ai',
            };
        }

        const remoteResolution = await resolveRemoteAction({
            runtimeGameId: args.engineConfig.gameId,
            seatController,
            context,
        });
        if (!remoteResolution.action) continue;

        return {
            playerId,
            action: remoteResolution.action,
            attemptKey,
            source: remoteResolution.usedFallback ? 'remote-ai-fallback' : 'remote-ai',
        };
    }

    return null;
}

export const resolveNextLocalAiAction = resolveNextAiAction;
