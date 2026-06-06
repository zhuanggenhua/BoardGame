import type { CancelableAiDelayHandle, LocalAiActionDelayPlan } from '../ai/actionDelay';
import {
    logLocalAiPerfInfo,
    logLocalAiPerfWarn,
} from './localAiDiagnostics';

export type LocalAiSubmissionIdentity = {
    gameId: string;
    seed: string;
    playerId: string;
    source: string;
    actionKind: string;
    commandTypes: string[];
};

function buildLocalAiSubmissionPayload(
    identity: LocalAiSubmissionIdentity,
): Record<string, unknown> {
    return {
        gameId: identity.gameId,
        matchId: `local:${identity.gameId}:${identity.seed}`,
        playerId: identity.playerId,
        source: identity.source,
        actionKind: identity.actionKind,
        commandTypes: identity.commandTypes,
    };
}

export async function waitForLocalAiExecutionDelay(args: {
    identity: LocalAiSubmissionIdentity;
    delayPlan: LocalAiActionDelayPlan;
    startDelay: (delayMs: number) => CancelableAiDelayHandle;
    setPendingDelayHandle: (handle: CancelableAiDelayHandle | null) => void;
    isCancelled: () => boolean;
}): Promise<'continued' | 'cancelled'> {
    if (args.delayPlan.remainingDelayMs <= 0) {
        return 'continued';
    }

    const pendingDelayHandle = args.startDelay(args.delayPlan.remainingDelayMs);
    args.setPendingDelayHandle(pendingDelayHandle);
    const delayResult = await pendingDelayHandle.promise;
    args.setPendingDelayHandle(null);

    if (delayResult.outcome === 'cancelled') {
        logLocalAiPerfWarn('delay-cancelled', {
            ...buildLocalAiSubmissionPayload(args.identity),
            ...args.delayPlan,
            waitedMs: delayResult.waitedMs,
            cancelled: args.isCancelled(),
        });
        return 'cancelled';
    }

    logLocalAiPerfInfo('delay-finished', {
        ...buildLocalAiSubmissionPayload(args.identity),
        ...args.delayPlan,
        waitedMs: delayResult.waitedMs,
    });
    return 'continued';
}

export function logLocalAiSubmitSkipped(args: {
    identity: LocalAiSubmissionIdentity;
    delayPlan: LocalAiActionDelayPlan;
    isCancelled: () => boolean;
}): void {
    logLocalAiPerfWarn('submit-skipped', {
        ...buildLocalAiSubmissionPayload(args.identity),
        cancelled: args.isCancelled(),
        ...args.delayPlan,
    });
}

export function logLocalAiDispatchSummary(args: {
    identity: LocalAiSubmissionIdentity;
    delayPlan: LocalAiActionDelayPlan;
    decisionElapsedMs: number;
    hasAnyCommandEffect: boolean;
    activePhaseElapsedMs: number | null;
    totalElapsedMs: number;
}): void {
    const payload = {
        ...buildLocalAiSubmissionPayload(args.identity),
        decisionElapsedMs: args.decisionElapsedMs,
        hasAnyCommandEffect: args.hasAnyCommandEffect,
        ...args.delayPlan,
        activePhaseElapsedMs: args.activePhaseElapsedMs,
        totalElapsedMs: args.totalElapsedMs,
    };

    logLocalAiPerfInfo('dispatched', payload);
    if (args.totalElapsedMs >= 1200) {
        logLocalAiPerfWarn('slow-step', payload);
    }
}

export function finalizeLocalAiDispatch(args: {
    identity: LocalAiSubmissionIdentity;
    delayPlan: LocalAiActionDelayPlan;
    actionVisibility: 'hidden' | 'visible';
    hasAnyCommandEffect: boolean;
    decisionElapsedMs: number;
    startedAt: number;
    activePhaseStartedAt: number | null;
    onVisibleActionAt?: (timestamp: number) => void;
}): void {
    const completedAt = Date.now();
    if (args.actionVisibility === 'visible' && args.hasAnyCommandEffect) {
        args.onVisibleActionAt?.(completedAt);
    }

    logLocalAiDispatchSummary({
        identity: args.identity,
        delayPlan: args.delayPlan,
        decisionElapsedMs: args.decisionElapsedMs,
        hasAnyCommandEffect: args.hasAnyCommandEffect,
        activePhaseElapsedMs: args.activePhaseStartedAt === null
            ? null
            : completedAt - args.activePhaseStartedAt,
        totalElapsedMs: completedAt - args.startedAt,
    });
}
