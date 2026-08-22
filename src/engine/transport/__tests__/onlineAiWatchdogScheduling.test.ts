import { describe, expect, it } from 'vitest';
import { resolveOnlineAiWatchdogSchedulingDecision } from '../onlineAiWatchdogScheduling';
import type { OnlineAiRecoveryTracker } from '../onlineAiWatchdogTracker';

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

describe('resolveOnlineAiWatchdogSchedulingDecision', () => {
    it('没有 AI 座位或候选时要求清理 tracker', () => {
        expect(resolveOnlineAiWatchdogSchedulingDecision({
            now: 2_000,
            hasAiSeat: false,
            hasCandidate: true,
            trackerKey: 'player:reason:fingerprint',
        })).toEqual({ kind: 'clear-tracker' });

        expect(resolveOnlineAiWatchdogSchedulingDecision({
            now: 2_000,
            hasAiSeat: true,
            hasCandidate: false,
            trackerKey: 'player:reason:fingerprint',
        })).toEqual({ kind: 'clear-tracker' });
    });

    it('新 tracker 需要等待 recoveryTimeoutMs 时只存储 tracker，不立即恢复', () => {
        expect(resolveOnlineAiWatchdogSchedulingDecision({
            now: 2_000,
            hasAiSeat: true,
            hasCandidate: true,
            trackerKey: 'player:reason:fingerprint',
            recoveryTimeoutMs: 5_000,
        })).toEqual({
            kind: 'skip',
            trackerToStore: createTracker({ firstSeenAt: 2_000 }),
        });
    });

    it('已有 tracker 超时后触发恢复，已提交过的不重复触发', () => {
        const tracker = createTracker();

        expect(resolveOnlineAiWatchdogSchedulingDecision({
            now: 7_000,
            hasAiSeat: true,
            hasCandidate: true,
            trackerKey: tracker.key,
            recoveryTimeoutMs: 5_000,
            currentTracker: tracker,
        })).toEqual({ kind: 'launch-recovery', tracker });

        expect(resolveOnlineAiWatchdogSchedulingDecision({
            now: 7_000,
            hasAiSeat: true,
            hasCandidate: true,
            trackerKey: tracker.key,
            recoveryTimeoutMs: 5_000,
            currentTracker: createTracker({ autoSubmittedAt: 6_000 }),
        })).toEqual({ kind: 'skip' });
    });

    it('overlay resync 等外部抑制命中时不创建新 tracker', () => {
        expect(resolveOnlineAiWatchdogSchedulingDecision({
            now: 2_000,
            hasAiSeat: true,
            hasCandidate: true,
            trackerKey: 'player:active-turn:fingerprint',
            recoveryTimeoutMs: 0,
            suppressRecovery: true,
        })).toEqual({ kind: 'skip' });
    });
});
