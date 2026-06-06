export type OnlineAiWatchdogStepBookkeepingDecision =
    | {
        kind: 'attempt-hard-cancel';
    }
    | {
        kind: 'fail';
        reason: 'no_progress' | 'loop_detected' | 'private_overlay_stale' | 'private_overlay_missing' | 'missing_visible_state';
    }
    | {
        kind: 'advance';
    };

export function resolveOnlineAiWatchdogStepBookkeeping(args: {
    stepKeyBefore: string;
    nextStepKey: string;
    seenStepKeys: ReadonlySet<string>;
    attemptedInteractionRespond: boolean;
    interactionFingerprintBeforeStep: string | null;
    interactionFingerprintAfterStep: string | null;
    interactionRecoveryFingerprintAfterStep: string | null;
    currentCandidateFingerprintHint?: string | null;
    actionRecoveryApplied: boolean;
    actionRecoveryOutcome: string;
    blockedFailureReason: 'private_overlay_stale' | 'private_overlay_missing' | 'missing_visible_state' | null;
}): OnlineAiWatchdogStepBookkeepingDecision {
    if (args.nextStepKey === args.stepKeyBefore) {
        const shouldAttemptHardCancel = args.attemptedInteractionRespond
            && Boolean(args.interactionFingerprintBeforeStep)
            && args.interactionFingerprintAfterStep === args.interactionFingerprintBeforeStep
            && args.interactionRecoveryFingerprintAfterStep === (args.currentCandidateFingerprintHint ?? null);
        if (shouldAttemptHardCancel) {
            return { kind: 'attempt-hard-cancel' };
        }

        const noProgressReason = !args.actionRecoveryApplied
            && args.actionRecoveryOutcome === 'blocked'
            && args.blockedFailureReason
            ? args.blockedFailureReason
            : 'no_progress';
        return {
            kind: 'fail',
            reason: noProgressReason,
        };
    }

    if (args.seenStepKeys.has(args.nextStepKey)) {
        return {
            kind: 'fail',
            reason: 'loop_detected',
        };
    }

    return { kind: 'advance' };
}
