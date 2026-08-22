import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import { createInitialSystemState } from '../../pipeline';
import { OnlineAiCircuitBreaker, type OnlineAiCircuitAdmission } from '../onlineAiCircuitBreaker';
import {
    AuthoritativeQueuedCommandStaleRejectionCoordinator,
    type AuthoritativeQueuedCommandStaleRejectionHooks,
    type AuthoritativeQueuedCommandStaleRejectionMatch,
} from '../authoritativeQueuedCommandStaleRejectionCoordinator';

function createMatch(stateID = 2): AuthoritativeQueuedCommandStaleRejectionMatch {
    return {
        matchID: 'match-queued-stale',
        gameId: 'test-game',
        engineConfig: { gameId: 'test-game' },
        state: {
            core: {},
            sys: createInitialSystemState(['0', '1'], []),
        } as MatchState<unknown>,
        stateID,
    };
}

function createAdmission(overrides?: Partial<OnlineAiCircuitAdmission>): OnlineAiCircuitAdmission {
    const breaker = new OnlineAiCircuitBreaker();
    return {
        allowed: true,
        snapshot: breaker.getSnapshot('match-queued-stale', '1'),
        ...overrides,
    };
}

function createHarness(options?: {
    seatControllerType?: 'human' | 'local-ai' | 'remote-ai';
    admission?: OnlineAiCircuitAdmission;
}) {
    const recordedCircuit: unknown[] = [];
    const hooks: AuthoritativeQueuedCommandStaleRejectionHooks<AuthoritativeQueuedCommandStaleRejectionMatch> = {
        resolveSeatControllerType: vi.fn(() => options?.seatControllerType ?? 'human'),
        admitOnlineAiCircuitCommand: vi.fn(() => options?.admission ?? createAdmission()),
        recordOnlineAiCircuitFailure: vi.fn(async (args) => {
            recordedCircuit.push(args);
        }),
    };
    return {
        coordinator: new AuthoritativeQueuedCommandStaleRejectionCoordinator({ hooks }),
        hooks,
        recordedCircuit,
    };
}

describe('AuthoritativeQueuedCommandStaleRejectionCoordinator', () => {
    it('真人排队命令过期时只丢弃，不记录 AI circuit failure', async () => {
        const match = createMatch();
        const harness = createHarness({ seatControllerType: 'human' });

        await harness.coordinator.reject({
            match,
            command: {
                commandType: 'MOVE',
                payload: { step: 1 },
                playerID: '0',
                stateIDAtEnqueue: 1,
            },
        });

        expect(harness.hooks.admitOnlineAiCircuitCommand).not.toHaveBeenCalled();
        expect(harness.recordedCircuit).toHaveLength(0);
    });

    it('AI 排队命令过期且 circuit 允许时记录 stale failure', async () => {
        const match = createMatch(3);
        const harness = createHarness({ seatControllerType: 'local-ai' });

        await harness.coordinator.reject({
            match,
            command: {
                commandType: 'AI_MOVE',
                payload: { cardUid: 'old-card' },
                playerID: '1',
                stateIDAtEnqueue: 1,
                options: {
                    expectedStateID: 2,
                    onlineAiAttemptKey: 'attempt-queued',
                },
            },
        });

        expect(harness.hooks.admitOnlineAiCircuitCommand).toHaveBeenCalledWith({
            matchId: 'match-queued-stale',
            playerId: '1',
            source: 'client',
            expectedStateID: 2,
            stateID: 3,
        });
        expect(harness.recordedCircuit).toHaveLength(1);
        expect(harness.recordedCircuit[0]).toMatchObject({
            match,
            playerId: '1',
            source: 'client',
            commandType: 'AI_MOVE',
            commandPayload: { cardUid: 'old-card' },
            reason: 'stale_state',
            expectedStateID: 2,
            stateID: 3,
            onlineAiAttemptKey: 'attempt-queued',
        });
    });

    it('AI 排队命令过期但 circuit 已拒绝时不重复记录 failure', async () => {
        const match = createMatch();
        const harness = createHarness({
            seatControllerType: 'local-ai',
            admission: createAdmission({ allowed: false, reason: 'stale-epoch' }),
        });

        await harness.coordinator.reject({
            match,
            command: {
                commandType: 'AI_MOVE',
                payload: {},
                playerID: '1',
                stateIDAtEnqueue: 1,
            },
        });

        expect(harness.hooks.admitOnlineAiCircuitCommand).toHaveBeenCalled();
        expect(harness.recordedCircuit).toHaveLength(0);
    });

    it('watchdog 入队命令过期时沿用 watchdog circuit source', async () => {
        const match = createMatch();
        const harness = createHarness({ seatControllerType: 'remote-ai' });

        await harness.coordinator.reject({
            match,
            command: {
                commandType: 'WATCHDOG_MOVE',
                payload: {},
                playerID: '1',
                stateIDAtEnqueue: 1,
                options: {
                    feedbackSource: 'online-ai-watchdog',
                },
            },
        });

        expect(harness.hooks.admitOnlineAiCircuitCommand).toHaveBeenCalledWith(expect.objectContaining({
            source: 'watchdog',
            expectedStateID: 1,
        }));
        expect(harness.recordedCircuit[0]).toMatchObject({
            source: 'watchdog',
            expectedStateID: 1,
        });
    });
});
