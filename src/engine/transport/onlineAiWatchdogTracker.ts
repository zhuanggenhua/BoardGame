import {
    applyAiAutoRecoveryRejection,
    type AiAutoRecoveryAttemptTracker,
} from './onlineAiRecovery';

export type OnlineAiRecoveryTracker = AiAutoRecoveryAttemptTracker & {
    key: string;
    failureCount: number;
};

export function resolveOnlineAiRecoveryTracker(args: {
    currentTracker: OnlineAiRecoveryTracker | undefined;
    trackerKey: string;
    now: number;
}): {
    tracker: OnlineAiRecoveryTracker;
    isNewTracker: boolean;
} {
    if (args.currentTracker && args.currentTracker.key === args.trackerKey) {
        return {
            tracker: args.currentTracker,
            isNewTracker: false,
        };
    }

    return {
        tracker: {
            key: args.trackerKey,
            firstSeenAt: args.now,
            autoSubmittedAt: null,
            lastReportedFailureReason: null,
            failureCount: 0,
        },
        isNewTracker: true,
    };
}

export function shouldRunOnlineAiRecoveryNow(args: {
    tracker: OnlineAiRecoveryTracker;
    now: number;
    recoveryTimeoutMs: number;
}): boolean {
    if (args.tracker.autoSubmittedAt) {
        return false;
    }

    return args.now - args.tracker.firstSeenAt >= args.recoveryTimeoutMs;
}

export function applyOnlineAiRecoveryFailureToTracker(args: {
    tracker: OnlineAiRecoveryTracker;
    reason: string;
    now: number;
}): {
    nextTracker: OnlineAiRecoveryTracker;
    shouldNotify: boolean;
} {
    const rejection = applyAiAutoRecoveryRejection(args.tracker, args.reason, args.now);
    return {
        shouldNotify: rejection.shouldNotify,
        nextTracker: {
            ...rejection.nextTracker,
            key: args.tracker.key,
            failureCount: args.tracker.failureCount + 1,
        },
    };
}
