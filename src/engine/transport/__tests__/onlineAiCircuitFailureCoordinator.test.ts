import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import { OnlineAiCircuitBreaker } from '../onlineAiCircuitBreaker';
import {
    OnlineAiCircuitFailureCoordinator,
    type OnlineAiCircuitFailureCoordinatorHooks,
    type OnlineAiCircuitFailureMatch,
} from '../onlineAiCircuitFailureCoordinator';

const createState = (): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 4,
        eventStream: { nextId: 1, entries: [] },
    },
}) as unknown as MatchState<unknown>;

const createMatch = (): OnlineAiCircuitFailureMatch => ({
    matchID: 'match-circuit',
    gameId: 'test-game',
    state: createState(),
    stateID: 8,
    engineConfig: { gameId: 'test-game' },
    commandQueue: [
        {
            playerID: '1',
            commandType: 'QUEUED_COMMAND',
            stateIDAtEnqueue: 7,
            payload: { cardUid: 'queued-card' },
        },
    ],
    lastCommandFailureReason: null,
});

const createHooks = (): OnlineAiCircuitFailureCoordinatorHooks<OnlineAiCircuitFailureMatch> => ({
    reportRecoveryFeedback: vi.fn(async () => {}),
    emitPlayerError: vi.fn(),
});

describe('OnlineAiCircuitFailureCoordinator', () => {
    it('recordFailure 熔断后只上报一次 circuit 反馈并保留诊断快照', async () => {
        const match = createMatch();
        const circuitBreaker = new OnlineAiCircuitBreaker({
            failureBudget: 1,
            now: () => 1_000,
        });
        const hooks = createHooks();
        const coordinator = new OnlineAiCircuitFailureCoordinator({
            circuitBreaker,
            hooks,
        });

        const snapshot = await coordinator.recordFailure({
            match,
            playerId: '1',
            source: 'watchdog',
            commandType: 'PLAY_CARD',
            commandPayload: { cardUid: 'missing-card' },
            reason: 'command_failed',
            expectedStateID: 7,
            stateID: 8,
            progressMarker: 'marker-before',
            onlineAiAttemptKey: 'attempt-1',
            clientTransport: { stateID: 7, stateAgeMs: 250 },
        });
        await coordinator.recordFailure({
            match,
            playerId: '1',
            source: 'watchdog',
            commandType: 'PLAY_CARD',
            reason: 'command_failed',
            stateID: 8,
        });

        expect(snapshot.tripped).toBe(true);
        expect(hooks.reportRecoveryFeedback).toHaveBeenCalledTimes(1);
        expect(hooks.reportRecoveryFeedback).toHaveBeenCalledWith(expect.objectContaining({
            incidentKind: 'circuit-breaker-tripped',
            severity: 'high',
            status: 'open',
            reason: 'command_failed',
            trackerKey: 'circuit-breaker:1:1000',
            progressMarker: 'marker-before',
        }));

        const report = vi.mocked(hooks.reportRecoveryFeedback).mock.calls[0]?.[0];
        const parsedSnapshot = JSON.parse(report?.stateSnapshot ?? '{}') as {
            command?: { payload?: { cardUid?: string } };
            clientTransport?: { stateID?: number };
            queue?: { length?: number };
        };
        expect(parsedSnapshot.command?.payload?.cardUid).toBe('missing-card');
        expect(parsedSnapshot.clientTransport?.stateID).toBe(7);
        expect(parsedSnapshot.queue?.length).toBe(1);
    });

    it('rejectCommand 写回失败原因并通过 server hook 通知玩家', () => {
        const match = createMatch();
        const circuitBreaker = new OnlineAiCircuitBreaker();
        const hooks = createHooks();
        const coordinator = new OnlineAiCircuitFailureCoordinator({
            circuitBreaker,
            hooks,
        });

        const result = coordinator.rejectCommand({
            match,
            playerId: '1',
            reason: 'stale-epoch',
            commandType: 'PLAY_CARD',
            expectedStateID: 7,
            snapshot: circuitBreaker.getSnapshot('match-circuit', '1'),
        });

        expect(result).toBe(false);
        expect(match.lastCommandFailureReason).toBe('stale_state');
        expect(hooks.emitPlayerError).toHaveBeenCalledWith(match, '1', 'stale_state');
    });
});
