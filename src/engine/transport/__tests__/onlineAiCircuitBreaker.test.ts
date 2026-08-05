import { describe, expect, it } from 'vitest';
import { OnlineAiCircuitBreaker } from '../onlineAiCircuitBreaker';

describe('OnlineAiCircuitBreaker', () => {
    it('按对局和 AI 座位共用失败预算，不因 progress marker 变化换桶', () => {
        const breaker = new OnlineAiCircuitBreaker({ windowMs: 1000, failureBudget: 3 });

        for (const [index, progressMarker] of ['marker-1', 'marker-2', 'marker-3'].entries()) {
            expect(breaker.admit({
                matchId: 'match-1',
                playerId: 'ai-1',
                source: index === 1 ? 'watchdog' : 'client',
                stateID: index + 1,
                expectedStateID: index + 1,
            }).allowed).toBe(true);
            breaker.recordFailure({
                matchId: 'match-1',
                playerId: 'ai-1',
                failure: {
                    commandType: 'PLAY_CARD',
                    reason: '手牌中没有该卡牌',
                    stateID: index + 1,
                    progressMarker,
                    source: index === 1 ? 'watchdog' : 'client',
                },
            });
        }

        const snapshot = breaker.getSnapshot('match-1', 'ai-1');
        expect(snapshot.failureCount).toBe(3);
        expect(snapshot.tripped).toBe(true);
        expect(snapshot.recentFailures.map((failure) => failure.progressMarker)).toEqual([
            'marker-1',
            'marker-2',
            'marker-3',
        ]);
        expect(breaker.admit({
            matchId: 'match-1',
            playerId: 'ai-1',
            source: 'watchdog',
            stateID: 4,
        }).reason).toBe('circuit-open');
    });

    it('同一 stale epoch 只记录一次，后续旧命令不再进入尝试预算', () => {
        const breaker = new OnlineAiCircuitBreaker({ failureBudget: 3 });
        expect(breaker.admit({
            matchId: 'match-2',
            playerId: 'ai-1',
            source: 'client',
            stateID: 4,
            expectedStateID: 3,
        }).allowed).toBe(true);
        breaker.recordFailure({
            matchId: 'match-2',
            playerId: 'ai-1',
            failure: {
                commandType: 'PLAY_CARD',
                reason: 'stale_state',
                stateID: 4,
                expectedStateID: 3,
                source: 'client',
            },
        });

        const repeated = breaker.admit({
            matchId: 'match-2',
            playerId: 'ai-1',
            source: 'client',
            stateID: 4,
            expectedStateID: 3,
        });
        expect(repeated.allowed).toBe(false);
        expect(repeated.reason).toBe('stale-epoch');
        expect(repeated.snapshot.attemptCount).toBe(1);
        expect(repeated.snapshot.failureCount).toBe(1);

        expect(breaker.admit({
            matchId: 'match-2',
            playerId: 'ai-1',
            source: 'client',
            stateID: 5,
            expectedStateID: 5,
        }).allowed).toBe(true);
    });

    it('熔断后最多允许一次安全脱困，并要求脱困后的新状态再放行', () => {
        const breaker = new OnlineAiCircuitBreaker({ failureBudget: 1 });
        expect(breaker.admit({
            matchId: 'match-3',
            playerId: 'ai-1',
            source: 'watchdog',
            stateID: 7,
        }).allowed).toBe(true);
        breaker.recordFailure({
            matchId: 'match-3',
            playerId: 'ai-1',
            failure: {
                commandType: 'ADVANCE_PHASE',
                reason: 'command_failed',
                stateID: 7,
                source: 'watchdog',
            },
        });

        expect(breaker.beginSafeUnblock('match-3', 'ai-1')).toBe(true);
        expect(breaker.beginSafeUnblock('match-3', 'ai-1')).toBe(false);
        expect(breaker.admit({
            matchId: 'match-3',
            playerId: 'ai-1',
            source: 'safe-unblock',
            stateID: 7,
        }).allowed).toBe(true);
        breaker.finishSafeUnblock({
            matchId: 'match-3',
            playerId: 'ai-1',
            success: true,
            stateID: 8,
        });

        const refreshedAdmission = breaker.admit({
            matchId: 'match-3',
            playerId: 'ai-1',
            source: 'watchdog',
            stateID: 9,
            expectedStateID: 9,
        });
        expect(refreshedAdmission.allowed).toBe(true);
        expect(refreshedAdmission.snapshot.tripped).toBe(false);
    });
});
