import { describe, expect, it, vi } from 'vitest';
import type { OnlineAiCircuitSnapshot } from '../onlineAiCircuitBreaker';
import {
    AuthoritativeCommandStaleRejectionCoordinator,
    type AuthoritativeCommandStaleRejectionHooks,
    type AuthoritativeCommandStaleRejectionMatch,
} from '../authoritativeCommandStaleRejectionCoordinator';

const createMatch = (): AuthoritativeCommandStaleRejectionMatch => ({
    matchID: 'match-stale',
    gameId: 'test-game',
    engineConfig: { gameId: 'test-game' },
    lastCommandFailureReason: null,
});

const createSnapshot = (): OnlineAiCircuitSnapshot => ({
    tripped: false,
    failureCount: 1,
    failureBudget: 6,
    windowStartedAt: 1_000,
    windowExpiresAt: 31_000,
    recentFailures: [],
    recoveryCount: 0,
});

function createHarness() {
    const recordedCircuit: unknown[] = [];
    const emitted: unknown[] = [];
    const hooks: AuthoritativeCommandStaleRejectionHooks<AuthoritativeCommandStaleRejectionMatch> = {
        recordOnlineAiCircuitFailure: vi.fn(async (args) => {
            recordedCircuit.push(args);
            return createSnapshot();
        }),
        emitPlayerError: vi.fn((match, playerId, reason) => {
            emitted.push({ matchID: match.matchID, playerId, reason });
        }),
    };

    return {
        coordinator: new AuthoritativeCommandStaleRejectionCoordinator({ hooks }),
        hooks,
        recordedCircuit,
        emitted,
    };
}

const baseArgs = (match = createMatch()) => ({
    match,
    playerId: '1',
    commandType: 'PLAY_CARD',
    commandPayload: { cardUid: 'c1' },
    seatControllerType: 'local-ai' as const,
    expectedStateID: 6,
    stateIdBefore: 7,
    progressMarker: 'marker-before',
    onlineAiCircuitSource: 'watchdog' as const,
    onlineAiAttemptKey: 'attempt-1',
    clientTransport: { stateID: 6, stateAgeMs: 250 },
});

describe('AuthoritativeCommandStaleRejectionCoordinator', () => {
    it('expectedStateID 未提供或等于当前权威 stateID 时不拒绝也不写失败状态', async () => {
        const match = createMatch();
        const harness = createHarness();

        await expect(harness.coordinator.rejectIfStale({
            ...baseArgs(match),
            expectedStateID: undefined,
        })).resolves.toEqual({ rejected: false });
        await expect(harness.coordinator.rejectIfStale({
            ...baseArgs(match),
            expectedStateID: 7,
        })).resolves.toEqual({ rejected: false });

        expect(match.lastCommandFailureReason).toBeNull();
        expect(harness.recordedCircuit).toHaveLength(0);
        expect(harness.emitted).toHaveLength(0);
    });

    it('AI 命令 stateID 过期时记录 circuit failure、写失败原因并通知玩家', async () => {
        const match = createMatch();
        const harness = createHarness();

        const result = await harness.coordinator.rejectIfStale(baseArgs(match));

        expect(result).toEqual({ rejected: true });
        expect(match.lastCommandFailureReason).toBe('stale_state');
        expect(harness.recordedCircuit).toHaveLength(1);
        expect(harness.recordedCircuit[0]).toMatchObject({
            match,
            playerId: '1',
            source: 'watchdog',
            commandType: 'PLAY_CARD',
            commandPayload: { cardUid: 'c1' },
            reason: 'stale_state',
            expectedStateID: 6,
            stateID: 7,
            progressMarker: 'marker-before',
            onlineAiAttemptKey: 'attempt-1',
            clientTransport: { stateID: 6, stateAgeMs: 250 },
        });
        expect(harness.emitted).toEqual([{ matchID: 'match-stale', playerId: '1', reason: 'stale_state' }]);
    });

    it('真人命令 stateID 过期时只写失败原因并通知玩家，不记录 AI circuit', async () => {
        const match = createMatch();
        const harness = createHarness();

        const result = await harness.coordinator.rejectIfStale({
            ...baseArgs(match),
            seatControllerType: 'human',
        });

        expect(result).toEqual({ rejected: true });
        expect(match.lastCommandFailureReason).toBe('stale_state');
        expect(harness.recordedCircuit).toHaveLength(0);
        expect(harness.emitted).toEqual([{ matchID: 'match-stale', playerId: '1', reason: 'stale_state' }]);
    });
});
