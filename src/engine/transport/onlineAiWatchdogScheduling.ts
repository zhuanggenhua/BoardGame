import {
    resolveOnlineAiRecoveryTracker,
    shouldRunOnlineAiRecoveryNow,
    type OnlineAiRecoveryTracker,
} from './onlineAiWatchdogTracker';

export type OnlineAiWatchdogSchedulingDecision =
    | {
        kind: 'clear-tracker';
    }
    | {
        kind: 'skip';
        trackerToStore?: OnlineAiRecoveryTracker;
    }
    | {
        kind: 'launch-recovery';
        tracker: OnlineAiRecoveryTracker;
        trackerToStore?: OnlineAiRecoveryTracker;
    };

export function resolveOnlineAiWatchdogSchedulingDecision(args: {
    now: number;
    hasAiSeat: boolean;
    hasCandidate: boolean;
    trackerKey?: string;
    recoveryTimeoutMs?: number;
    suppressRecovery?: boolean;
    currentTracker?: OnlineAiRecoveryTracker;
}): OnlineAiWatchdogSchedulingDecision {
    if (!args.hasAiSeat || !args.hasCandidate) {
        return { kind: 'clear-tracker' };
    }

    if (!args.trackerKey) {
        return { kind: 'skip' };
    }

    if (args.suppressRecovery) {
        return { kind: 'skip' };
    }

    const trackerResolution = resolveOnlineAiRecoveryTracker({
        currentTracker: args.currentTracker,
        trackerKey: args.trackerKey,
        now: args.now,
    });
    const trackerToStore = trackerResolution.isNewTracker ? trackerResolution.tracker : undefined;
    const recoveryTimeoutMs = args.recoveryTimeoutMs ?? 0;

    if (trackerResolution.isNewTracker && recoveryTimeoutMs > 0) {
        return {
            kind: 'skip',
            trackerToStore,
        };
    }

    if (!shouldRunOnlineAiRecoveryNow({
        tracker: trackerResolution.tracker,
        now: args.now,
        recoveryTimeoutMs,
    })) {
        return {
            kind: 'skip',
            trackerToStore,
        };
    }

    return {
        kind: 'launch-recovery',
        tracker: trackerResolution.tracker,
        trackerToStore,
    };
}
