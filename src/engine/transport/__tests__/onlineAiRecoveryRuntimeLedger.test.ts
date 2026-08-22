import { describe, expect, it } from 'vitest';
import { OnlineAiRecoveryRuntimeLedger } from '../onlineAiRecoveryRuntimeLedger';
import type { OnlineAiRecoveryTracker } from '../onlineAiWatchdogTracker';

function createTracker(key: string): OnlineAiRecoveryTracker {
    return {
        key,
        firstSeenAt: 10,
        autoSubmittedAt: null,
        lastReportedFailureReason: null,
        failureCount: 0,
    };
}

describe('OnlineAiRecoveryRuntimeLedger', () => {
    it('clearMatch 清理单场恢复 tracker、in-flight、重复尝试和 overlay 冷却', () => {
        const ledger = new OnlineAiRecoveryRuntimeLedger();
        ledger.setTracker('match-a', createTracker('tracker-a'));
        ledger.setTracker('match-b', createTracker('tracker-b'));
        ledger.beginInFlight('match-a');
        ledger.beginInFlight('match-b');
        const repeatedKeyA = ledger.buildRepeatedAttemptKey('match-a', 'tracker-a');
        const repeatedKeyB = ledger.buildRepeatedAttemptKey('match-b', 'tracker-b');
        ledger.recordRepeatedAttempt('match-a', 'tracker-a', 100);
        ledger.recordRepeatedAttempt('match-b', 'tracker-b', 100);
        ledger.markOverlayResyncRequested({
            matchId: 'match-a',
            playerId: '1',
            blockedKey: 'stale-overlay',
            progressMarker: 'marker-a',
            now: 100,
        });
        ledger.markOverlayResyncRequested({
            matchId: 'match-b',
            playerId: '1',
            blockedKey: 'stale-overlay',
            progressMarker: 'marker-b',
            now: 100,
        });

        ledger.clearMatch('match-a');

        expect(ledger.hasTracker('match-a')).toBe(false);
        expect(ledger.hasTracker('match-b')).toBe(true);
        expect(ledger.isInFlight('match-a')).toBe(false);
        expect(ledger.isInFlight('match-b')).toBe(true);
        expect(ledger.getRepeatedAttempt(repeatedKeyA)).toBeUndefined();
        expect(ledger.getRepeatedAttempt(repeatedKeyB)?.count).toBe(1);
        expect(ledger.getOverlayResyncCooldownEntries()).toEqual([
            ['match-b:1:stale-overlay:marker-b', 1_600],
        ]);
    });

    it('recordRepeatedAttempt 递增次数并保留 reported 状态', () => {
        const ledger = new OnlineAiRecoveryRuntimeLedger();
        const repeatedKey = ledger.buildRepeatedAttemptKey('match-a', 'tracker-a');

        expect(ledger.recordRepeatedAttempt('match-a', 'tracker-a', 100)).toEqual({
            count: 1,
            lastAttemptAt: 100,
            reported: false,
        });
        expect(ledger.recordRepeatedAttempt('match-a', 'tracker-a', 200)).toEqual({
            count: 2,
            lastAttemptAt: 200,
            reported: false,
        });
        expect(ledger.markRepeatedAttemptReported(repeatedKey, ledger.getRepeatedAttempt(repeatedKey), 3, 300)).toEqual({
            count: 2,
            lastAttemptAt: 300,
            reported: true,
        });
        expect(ledger.recordRepeatedAttempt('match-a', 'tracker-a', 400)).toEqual({
            count: 3,
            lastAttemptAt: 400,
            reported: true,
        });
    });

    it('markRepeatedAttemptReported 在缺少已有尝试时使用 fallback 次数', () => {
        const ledger = new OnlineAiRecoveryRuntimeLedger();

        expect(ledger.markRepeatedAttemptReported('match-a:tracker-missing', undefined, 3, 500)).toEqual({
            count: 3,
            lastAttemptAt: 500,
            reported: true,
        });
    });

    it('overlay resync 冷却只拦截同一 match、player、blockedKey 和 progressMarker', () => {
        const ledger = new OnlineAiRecoveryRuntimeLedger(1_500);

        expect(ledger.markOverlayResyncRequested({
            matchId: 'match-a',
            playerId: '1',
            blockedKey: 'blocked-a',
            progressMarker: 'marker-a',
            now: 1_000,
        })).toBe(true);
        expect(ledger.markOverlayResyncRequested({
            matchId: 'match-a',
            playerId: '1',
            blockedKey: 'blocked-a',
            progressMarker: 'marker-a',
            now: 2_000,
        })).toBe(false);
        expect(ledger.markOverlayResyncRequested({
            matchId: 'match-a',
            playerId: '1',
            blockedKey: 'blocked-a',
            progressMarker: 'marker-b',
            now: 2_000,
        })).toBe(true);
        expect(ledger.markOverlayResyncRequested({
            matchId: 'match-a',
            playerId: '1',
            blockedKey: 'blocked-b',
            progressMarker: 'marker-a',
            now: 2_000,
        })).toBe(true);
        expect(ledger.markOverlayResyncRequested({
            matchId: 'match-a',
            playerId: '1',
            blockedKey: 'blocked-a',
            progressMarker: 'marker-a',
            now: 2_600,
        })).toBe(true);

        expect(ledger.getOverlayResyncCooldownEntries()).toEqual([
            ['match-a:1:blocked-a:marker-a', 4_100],
            ['match-a:1:blocked-a:marker-b', 3_500],
            ['match-a:1:blocked-b:marker-a', 3_500],
        ]);
    });

    it('hasRecentOverlayResync 按 player 和 progressMarker 判断最近刷新', () => {
        const ledger = new OnlineAiRecoveryRuntimeLedger(1_500);
        ledger.markOverlayResyncRequested({
            matchId: 'match-a',
            playerId: '1',
            blockedKey: 'blocked-a',
            progressMarker: 'marker-a',
            now: 1_000,
        });

        expect(ledger.hasRecentOverlayResync({
            matchId: 'match-a',
            playerId: '1',
            progressMarker: 'marker-a',
            now: 2_000,
        })).toBe(true);
        expect(ledger.hasRecentOverlayResync({
            matchId: 'match-a',
            playerId: '2',
            progressMarker: 'marker-a',
            now: 2_000,
        })).toBe(false);
        expect(ledger.hasRecentOverlayResync({
            matchId: 'match-a',
            playerId: '1',
            progressMarker: 'marker-a',
            now: 2_500,
        })).toBe(false);
    });

    it('beginInFlight 和 finishInFlight 只管理恢复运行时占用', () => {
        const ledger = new OnlineAiRecoveryRuntimeLedger();

        ledger.beginInFlight('match-a');
        expect(ledger.isInFlight('match-a')).toBe(true);

        ledger.finishInFlight('match-a');
        expect(ledger.isInFlight('match-a')).toBe(false);
    });
});
