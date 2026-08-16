import type { GameTransportClient } from '../engine/transport/client';
import type { MatchState } from '../engine/types';
import type { AiResolution } from '../engine/ai';
import type { AiSeatController } from '../engine/ai';
import type {
    ForceEndTurnStalledAiReason,
    ForceEndTurnStalledAiResolution,
    OnlineAiRecoveryEngineConfig,
} from '../engine/transport/onlineAiRecovery';
import {
    buildAiProgressMarker,
    resolveForceEndTurnFollowUpAfterConfirmation,
    resolveOnlineAiCurrentPlayerId,
} from '../engine/transport/onlineAiRecovery';

export {
    applyAiAutoRecoveryRejection,
    buildAiProgressMarker,
    resolveManualForceEndAiPhase,
    resolveCurrentPlayerId,
    resolveForceAdvancePhaseAfterRecovery,
    resolveForceEndTurnRecoveryStep,
    resolveForceEndTurnFollowUpAfterConfirmation,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    shouldSilentlyRetryOnlineAiBatchRejection,
    type AiAutoRecoveryAttemptTracker,
    type ForceEndTurnStalledAiResolution,
    type ForceSkippableHiddenAiInteraction,
} from '../engine/transport/onlineAiRecovery';

export type OnlineAiAutoRecoveryCompletionNotice = {
    tone: 'info' | 'warning';
    title: string;
    message: string;
};

export function resolveOnlineAiAutoRecoveryCompletionNotice(args: {
    candidateReason: ForceEndTurnStalledAiReason;
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): OnlineAiAutoRecoveryCompletionNotice | null {
    const { candidateReason, authoritativeState, seatControllers, engineConfig } = args;

    if (candidateReason === 'active-turn') {
        return {
            tone: 'warning',
            title: 'AI 强制结束回合',
            message: 'AI 已强制结束回合。',
        };
    }

    if (
        candidateReason !== 'hidden-interaction'
        && candidateReason !== 'visible-interaction'
        && candidateReason !== 'response-window'
        && candidateReason !== 'response-loop'
    ) {
        return null;
    }

    const currentPlayerId = resolveOnlineAiCurrentPlayerId(authoritativeState, {
        engineConfig,
    });
    if (currentPlayerId && seatControllers[currentPlayerId]?.type === 'human') {
        return null;
    }

    return {
        tone: 'info',
        title: 'AI 响应超时',
        message: 'AI 已自动跳过。',
    };
}

function buildAiBatchId(playerId: string, attemptKey: string): string {
    const normalizedAttemptKey = attemptKey.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120);
    return `ai-${playerId}-${normalizedAttemptKey}`;
}

type OnlineAiResolutionClient = Pick<GameTransportClient, 'sendBatch' | 'sendCommand' | 'subscribeStateUpdate' | 'latestState' | 'updateLatestState' | 'resync'> & {
    subscribeError?: (listener: (error: string) => void) => () => void;
};

type OnlineAiAuthoritativeState = MatchState<unknown> | null;

type SubmitOnlineAiResolutionArgs = {
    client: OnlineAiResolutionClient;
    resolution: AiResolution;
    lastAiAttemptKeyRef: { current: string | null };
    scheduleRetry: () => void;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    onWillResync?: (reason: string) => void;
    onConfirmed?: (authoritativeState: OnlineAiAuthoritativeState) => void;
    onRejected?: (reason: string) => void;
};

type SubmitOnlineAiResolutionSequenceArgs = {
    client: OnlineAiResolutionClient;
    initialResolution: AiResolution;
    lastAiAttemptKeyRef: { current: string | null };
    scheduleRetry: () => void;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    resolveNextResolution: (args: {
        authoritativeState: OnlineAiAuthoritativeState;
        confirmedResolution: AiResolution;
        stepIndex: number;
    }) => AiResolution | null;
    maxSteps?: number;
    onStepConfirmed?: (args: {
        authoritativeState: OnlineAiAuthoritativeState;
        confirmedResolution: AiResolution;
        stepIndex: number;
    }) => void;
    onCompleted?: (authoritativeState: OnlineAiAuthoritativeState) => void;
    onRejected?: (reason: string, context: {
        failedResolution: AiResolution;
        stepIndex: number;
    }) => void;
};

type SubmitForceEndTurnRecoverySequenceArgs = {
    client: OnlineAiResolutionClient;
    candidate: ForceEndTurnStalledAiResolution;
    lastAiAttemptKeyRef: { current: string | null };
    scheduleRetry: () => void;
    seatControllers: Record<string, AiSeatController>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
    followUpSteps?: number;
    onCompleted?: (authoritativeState: OnlineAiAuthoritativeState) => void;
    onRejected?: (reason: string, context: {
        failedResolution: AiResolution;
        stepIndex: number;
    }) => void;
};

const SINGLE_COMMAND_CONFIRM_TIMEOUT_MS = 4000;

type FinalizeOnlineAiResolutionConfirmationArgs = {
    lastAiAttemptKeyRef: { current: string | null };
    resolutionAttemptKey: string;
    scheduleRetry: () => void;
};

export function finalizeOnlineAiResolutionConfirmation(
    args: FinalizeOnlineAiResolutionConfirmationArgs,
): boolean {
    const {
        lastAiAttemptKeyRef,
        resolutionAttemptKey,
        scheduleRetry,
    } = args;

    if (
        lastAiAttemptKeyRef.current !== null
        && lastAiAttemptKeyRef.current !== resolutionAttemptKey
    ) {
        return false;
    }

    lastAiAttemptKeyRef.current = null;
    scheduleRetry();
    return true;
}

function submitSingleOnlineAiResolution(args: SubmitOnlineAiResolutionArgs): void {
    const {
        client,
        resolution,
        lastAiAttemptKeyRef,
        scheduleRetry,
        engineConfig,
        onWillResync,
        onConfirmed,
        onRejected,
    } = args;

    lastAiAttemptKeyRef.current = resolution.attemptKey;
    if (resolution.action.commands.length === 1) {
        const [command] = resolution.action.commands;
        const markerBefore = client.latestState && typeof client.latestState === 'object'
            ? buildAiProgressMarker(client.latestState as MatchState<unknown>, { engineConfig })
            : null;
        let settled = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe: (() => void) | null = null;
        let unsubscribeError: (() => void) | null = null;

        const cleanup = () => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            unsubscribe?.();
            unsubscribe = null;
            unsubscribeError?.();
            unsubscribeError = null;
        };

        unsubscribeError = client.subscribeError?.((reason) => {
            if (settled || (reason !== 'online_ai_circuit_open' && reason !== 'stale_state')) {
                return;
            }
            settled = true;
            cleanup();
            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            if (reason === 'stale_state') {
                if (onWillResync) {
                    onWillResync(reason);
                } else {
                    client.resync();
                }
            }
            onRejected?.(reason);
        }) ?? null;

        unsubscribe = client.subscribeStateUpdate((nextState) => {
            if (settled || !nextState || typeof nextState !== 'object') {
                return;
            }
            const nextMarker = buildAiProgressMarker(nextState as MatchState<unknown>, { engineConfig });
            if (markerBefore !== null && nextMarker === markerBefore) {
                return;
            }
            settled = true;
            cleanup();
            onConfirmed?.(nextState as MatchState<unknown>);
        });

        timeoutHandle = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            if (onWillResync) {
                onWillResync('command_timeout');
            } else {
                client.resync();
            }
            scheduleRetry();
            onRejected?.('command_timeout');
        }, SINGLE_COMMAND_CONFIRM_TIMEOUT_MS);

        const sent = client.sendCommand(command.type, command.payload, {
            onlineAiAttemptKey: resolution.attemptKey,
        });
        if (sent === false) {
            settled = true;
            cleanup();
            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            onRejected?.('command_not_sent');
        }
        return;
    }

    client.sendBatch(
        buildAiBatchId(resolution.playerId, resolution.attemptKey),
        resolution.action.commands.map((command) => ({
            type: command.type,
            payload: command.payload,
        })),
        (authoritativeState) => {
            // batch:confirmed 返回的是 stripEventStream 裁剪后的权威态，
            // 不能拿来污染 transport patch baseline；后续真正的 state:update/state:patch
            // 会继续把完整权威态同步到 client 内部缓存。
            onConfirmed?.(authoritativeState as MatchState<unknown>);
        },
        (reason) => {
            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            if (reason !== 'unauthorized' && reason !== 'online_ai_circuit_open') {
                if (onWillResync) {
                    onWillResync(reason);
                } else {
                    client.resync();
                }
                scheduleRetry();
            }
            onRejected?.(reason);
        },
        {
            onlineAiAttemptKey: resolution.attemptKey,
        },
    );
}

export function submitOnlineAiResolution(args: SubmitOnlineAiResolutionArgs): void {
    submitSingleOnlineAiResolution(args);
}

/**
 * AI 自动恢复专用：把潜在的“解卡住 → 再推进阶段”拆成服务端确认后的串行步骤，
 * 避免重新把多个命令塞回同一个 batch，导致后一步失效时前一步一起回滚。
 */
export function submitOnlineAiResolutionSequence(args: SubmitOnlineAiResolutionSequenceArgs): void {
    const {
        client,
        initialResolution,
        lastAiAttemptKeyRef,
        scheduleRetry,
        engineConfig,
        resolveNextResolution,
        maxSteps = 8,
        onStepConfirmed,
        onCompleted,
        onRejected,
    } = args;

    const runStep = (resolution: AiResolution, stepIndex: number): void => {
        if (stepIndex >= maxSteps) {
            onCompleted?.(null);
            return;
        }

        submitSingleOnlineAiResolution({
            client,
            resolution,
            lastAiAttemptKeyRef,
            scheduleRetry,
            engineConfig,
            onConfirmed: (authoritativeState) => {
                onStepConfirmed?.({
                    authoritativeState,
                    confirmedResolution: resolution,
                    stepIndex,
                });

                const nextResolution = resolveNextResolution({
                    authoritativeState,
                    confirmedResolution: resolution,
                    stepIndex,
                });
                if (!nextResolution) {
                    onCompleted?.(authoritativeState);
                    return;
                }

                runStep(nextResolution, stepIndex + 1);
            },
            onRejected: (reason) => {
                onRejected?.(reason, {
                    failedResolution: resolution,
                    stepIndex,
                });
            },
        });
    };

    runStep(initialResolution, 0);
}

export function submitForceEndTurnRecoverySequence(args: SubmitForceEndTurnRecoverySequenceArgs): void {
    const {
        client,
        candidate,
        lastAiAttemptKeyRef,
        scheduleRetry,
        seatControllers,
        engineConfig,
        gameId,
        followUpSteps = 16,
        onCompleted,
        onRejected,
    } = args;

    submitOnlineAiResolutionSequence({
        client,
        initialResolution: candidate.resolution,
        lastAiAttemptKeyRef,
        scheduleRetry,
        engineConfig,
        maxSteps: followUpSteps + 1,
        resolveNextResolution: ({ authoritativeState, stepIndex }) => {
            if (stepIndex >= followUpSteps) {
                return null;
            }
            if (stepIndex > 0) {
                return null;
            }
            return resolveForceEndTurnFollowUpAfterConfirmation({
                candidate,
                authoritativeState,
                seatControllers,
                engineConfig,
                gameId,
            });
        },
        onCompleted,
        onRejected,
    });
}
