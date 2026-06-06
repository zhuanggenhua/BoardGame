import type { MatchState } from '../types';
import {
    buildAiProgressMarker,
    type OnlineAiRecoveryEngineConfig,
} from './onlineAiRecovery';

const NON_RECOVERABLE_REJECTED_COMMAND_ERRORS = new Set([
    'unauthorized',
    'match_not_found',
    'not_connected',
    'disconnected',
    'sync_timeout',
]);

export function shouldRecoverFromRejectedCommandError(reason: string): boolean {
    return !NON_RECOVERABLE_REJECTED_COMMAND_ERRORS.has(reason);
}

export function shouldForwardOnlineBatchRejectionToError(
    reason: string,
    shouldSilentlyRetryOnlineAiBatchRejection: (reason: string) => boolean,
): boolean {
    return !shouldSilentlyRetryOnlineAiBatchRejection(reason);
}

export function shouldRetryLocalAiAttemptAfterDispatch(args: {
    cancelled: boolean;
    activeAttemptKey: string | null;
    resolutionAttemptKey: string;
    markerBeforeDispatch: string;
    nextState: MatchState<unknown>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): boolean {
    if (args.cancelled) return false;
    if (args.activeAttemptKey !== null && args.activeAttemptKey !== args.resolutionAttemptKey) return false;
    return buildAiProgressMarker(args.nextState, { engineConfig: args.engineConfig }) === args.markerBeforeDispatch;
}

export function scheduleLocalAiRetryAfterDispatch(args: {
    isCancelled: () => boolean;
    activeAttemptKeyRef: { current: string | null };
    resolutionAttemptKey: string;
    markerBeforeDispatch: string;
    getNextState: () => MatchState<unknown>;
    scheduleRetry: () => void;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    delayMs?: number;
}): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
        if (!shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: args.isCancelled(),
            activeAttemptKey: args.activeAttemptKeyRef.current,
            resolutionAttemptKey: args.resolutionAttemptKey,
            markerBeforeDispatch: args.markerBeforeDispatch,
            nextState: args.getNextState(),
            engineConfig: args.engineConfig,
        })) {
            return;
        }
        args.activeAttemptKeyRef.current = null;
        args.scheduleRetry();
    }, args.delayMs ?? 30);
}

export function tryReserveAiAttemptKey(
    ref: { current: string | null },
    attemptKey: string,
): boolean {
    if (ref.current === attemptKey) {
        return false;
    }
    ref.current = attemptKey;
    return true;
}

export function releaseAiAttemptKeyIfMatches(
    ref: { current: string | null },
    attemptKey: string,
): void {
    if (ref.current === attemptKey) {
        ref.current = null;
    }
}
