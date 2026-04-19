import type { GameTransportClient } from '../engine/transport/client';
import type { MatchState } from '../engine/types';
import type { AiResolution } from '../engine/ai';

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
    type AiAutoRecoveryAttemptTracker,
    type ForceEndTurnStalledAiResolution,
    type ForceSkippableHiddenAiInteraction,
} from '../engine/transport/onlineAiRecovery';

function buildAiBatchId(playerId: string, attemptKey: string): string {
    const normalizedAttemptKey = attemptKey.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120);
    return `ai-${playerId}-${normalizedAttemptKey}`;
}

type SubmitOnlineAiResolutionArgs = {
    client: Pick<GameTransportClient, 'sendBatch' | 'updateLatestState' | 'resync'>;
    resolution: AiResolution;
    lastAiAttemptKeyRef: { current: string | null };
    scheduleRetry: () => void;
    onConfirmed?: (authoritativeState: MatchState<unknown> | unknown) => void;
    onRejected?: (reason: string) => void;
};

type SubmitOnlineAiResolutionSequenceArgs = {
    client: Pick<GameTransportClient, 'sendBatch' | 'updateLatestState' | 'resync'>;
    initialResolution: AiResolution;
    lastAiAttemptKeyRef: { current: string | null };
    scheduleRetry: () => void;
    resolveNextResolution: (args: {
        authoritativeState: MatchState<unknown> | unknown;
        confirmedResolution: AiResolution;
        stepIndex: number;
    }) => AiResolution | null;
    maxSteps?: number;
    onStepConfirmed?: (args: {
        authoritativeState: MatchState<unknown> | unknown;
        confirmedResolution: AiResolution;
        stepIndex: number;
    }) => void;
    onCompleted?: (authoritativeState: MatchState<unknown> | unknown) => void;
    onRejected?: (reason: string, context: {
        failedResolution: AiResolution;
        stepIndex: number;
    }) => void;
};

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
        onConfirmed,
        onRejected,
    } = args;

    lastAiAttemptKeyRef.current = resolution.attemptKey;
    client.sendBatch(
        buildAiBatchId(resolution.playerId, resolution.attemptKey),
        resolution.action.commands.map((command) => ({
            type: command.type,
            payload: command.payload,
        })),
        (authoritativeState) => {
            if (authoritativeState && typeof authoritativeState === 'object') {
                client.updateLatestState(authoritativeState);
            }
            onConfirmed?.(authoritativeState);
        },
        (reason) => {
            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            if (reason !== 'unauthorized') {
                client.resync();
                scheduleRetry();
            }
            onRejected?.(reason);
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
