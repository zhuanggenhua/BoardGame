import { describe, expect, it } from 'vitest';
import {
    applyOnlineAiRecoveryFailureToTracker,
    resolveOnlineAiRecoveryTracker,
    shouldRunOnlineAiRecoveryNow,
    type OnlineAiRecoveryTracker,
} from '../onlineAiWatchdogTracker';

function createTracker(overrides: Partial<OnlineAiRecoveryTracker> = {}): OnlineAiRecoveryTracker {
    return {
        key: 'player:reason:fingerprint',
        firstSeenAt: 1_000,
        autoSubmittedAt: null,
        lastReportedFailureReason: null,
        failureCount: 0,
        ...overrides,
    };
}

describe('onlineAiWatchdogTracker', () => {
    it('resolveOnlineAiRecoveryTracker 复用同 key tracker，key 漂移时创建新 tracker', () => {
        const currentTracker = createTracker({ failureCount: 2 });

        expect(resolveOnlineAiRecoveryTracker({
            currentTracker,
            trackerKey: currentTracker.key,
            now: 2_000,
        })).toEqual({
            tracker: currentTracker,
            isNewTracker: false,
        });

        expect(resolveOnlineAiRecoveryTracker({
            currentTracker,
            trackerKey: 'player:reason:fingerprint-2',
            now: 2_000,
        })).toEqual({
            tracker: createTracker({
                key: 'player:reason:fingerprint-2',
                firstSeenAt: 2_000,
            }),
            isNewTracker: true,
        });
    });

    it('shouldRunOnlineAiRecoveryNow 阻止已提交或未到超时的 tracker 重复触发', () => {
        expect(shouldRunOnlineAiRecoveryNow({
            tracker: createTracker({ firstSeenAt: 1_000 }),
            now: 5_999,
            recoveryTimeoutMs: 5_000,
        })).toBe(false);

        expect(shouldRunOnlineAiRecoveryNow({
            tracker: createTracker({ firstSeenAt: 1_000 }),
            now: 6_000,
            recoveryTimeoutMs: 5_000,
        })).toBe(true);

        expect(shouldRunOnlineAiRecoveryNow({
            tracker: createTracker({ firstSeenAt: 1_000, autoSubmittedAt: 5_000 }),
            now: 6_000,
            recoveryTimeoutMs: 5_000,
        })).toBe(false);
    });

    it('applyOnlineAiRecoveryFailureToTracker 重置提交时间并递增失败次数', () => {
        const result = applyOnlineAiRecoveryFailureToTracker({
            tracker: createTracker({ autoSubmittedAt: 1_500, failureCount: 2 }),
            reason: 'blocker_persisted',
            now: 2_000,
        });

        expect(result).toEqual({
            shouldNotify: true,
            nextTracker: createTracker({
                firstSeenAt: 2_000,
                autoSubmittedAt: null,
                lastReportedFailureReason: 'blocker_persisted',
                failureCount: 3,
            }),
        });
    });
});
