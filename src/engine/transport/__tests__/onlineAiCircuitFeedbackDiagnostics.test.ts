import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import type { OnlineAiCircuitSnapshot } from '../onlineAiCircuitBreaker';
import {
    buildOnlineAiCircuitQueueDiagnostic,
    buildOnlineAiCircuitStateSnapshot,
} from '../onlineAiCircuitFeedbackDiagnostics';

const createState = (): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 4,
        eventStream: { nextId: 1, entries: [] },
    },
}) as unknown as MatchState<unknown>;

const createSnapshot = (): OnlineAiCircuitSnapshot => ({
    matchId: 'match-1',
    playerId: '1',
    windowStartedAt: 100,
    windowMs: 30000,
    failureBudget: 3,
    attemptCount: 3,
    failureCount: 3,
    staleStateFailureCount: 1,
    recoveryCount: 0,
    tripped: true,
    trippedAt: 200,
    safeUnblockUsed: false,
    safeUnblockInFlight: false,
    awaitingFreshState: false,
    safeUnblockStateID: null,
    invalidatedExpectedStateID: 8,
    queueLength: 2,
    recentFailures: [{
        commandType: 'TEST_COMMAND',
        reason: 'pipeline_error',
        stateID: 8,
        source: 'watchdog',
        at: 200,
    }],
});

describe('onlineAiCircuitFeedbackDiagnostics', () => {
    it('queue diagnostic 保留前 8 条命令并识别 batch 项', () => {
        const items = buildOnlineAiCircuitQueueDiagnostic([
            { playerID: '1', commandType: 'A', stateIDAtEnqueue: 1, payload: { cardUid: 'a' } },
            { _batch: true },
            { playerID: '1', commandType: 'B', stateIDAtEnqueue: 2, payload: undefined },
            { playerID: '1', commandType: 'C', stateIDAtEnqueue: 3, payload: {} },
            { playerID: '1', commandType: 'D', stateIDAtEnqueue: 4, payload: {} },
            { playerID: '1', commandType: 'E', stateIDAtEnqueue: 5, payload: {} },
            { playerID: '1', commandType: 'F', stateIDAtEnqueue: 6, payload: {} },
            { playerID: '1', commandType: 'G', stateIDAtEnqueue: 7, payload: {} },
            { playerID: '1', commandType: 'H', stateIDAtEnqueue: 8, payload: {} },
        ]);

        expect(items).toHaveLength(8);
        expect(items[0]).toMatchObject({ kind: 'command', playerId: '1', commandType: 'A' });
        expect(items[0]?.payload).toEqual({ cardUid: 'a' });
        expect(items[1]).toEqual({ kind: 'batch', commandCount: 'unknown' });
        expect(items[2]?.payload).toBeNull();
    });

    it('state snapshot 保留 circuit、命令和队列诊断', () => {
        const snapshot = buildOnlineAiCircuitStateSnapshot({
            matchId: 'match-1',
            gameId: 'test-game',
            state: createState(),
            stateID: 8,
            commandQueue: [
                { playerID: '1', commandType: 'A', stateIDAtEnqueue: 7, payload: { cardUid: 'a' } },
            ],
            snapshot: createSnapshot(),
            commandType: 'TEST_COMMAND',
            commandPayload: { cardUid: 'blocked-card' },
            reason: 'pipeline_error',
            onlineAiAttemptKey: 'attempt-1',
            clientTransport: { stateID: 7, stateAgeMs: 100 },
        });

        const parsed = JSON.parse(snapshot) as {
            feedbackSource?: string;
            matchId?: string;
            command?: { type?: string; payload?: { cardUid?: string } };
            circuit?: { tripped?: boolean; failureCount?: number };
            queue?: { length?: number; items?: Array<{ commandType?: string }> };
        };
        expect(parsed.feedbackSource).toBe('online-ai-circuit-breaker');
        expect(parsed.matchId).toBe('match-1');
        expect(parsed.command?.type).toBe('TEST_COMMAND');
        expect(parsed.command?.payload?.cardUid).toBe('blocked-card');
        expect(parsed.circuit?.tripped).toBe(true);
        expect(parsed.circuit?.failureCount).toBe(3);
        expect(parsed.queue?.length).toBe(1);
        expect(parsed.queue?.items?.[0]?.commandType).toBe('A');
    });
});
