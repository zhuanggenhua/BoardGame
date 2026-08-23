import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import { createInitialSystemState } from '../../pipeline';
import { OnlineAiCircuitBreaker, type OnlineAiCircuitAdmission } from '../onlineAiCircuitBreaker';
import {
    AuthoritativeBatchCoordinator,
    type AuthoritativeBatchCoordinatorHooks,
    type AuthoritativeBatchCoordinatorMatch,
} from '../authoritativeBatchCoordinator';
import type { StoredMatchState } from '../storage';

type TestCore = {
    count: number;
};

type TestExecuteArgs = Omit<
    Parameters<AuthoritativeBatchCoordinator<AuthoritativeBatchCoordinatorMatch>['execute']>[0],
    'emitBatchRejected' | 'emitBatchConfirmed'
>;

function createState(count: number): MatchState<TestCore> {
    return {
        core: { count },
        sys: createInitialSystemState(['0', '1'], []),
    };
}

function createMatch(stateID = 1): AuthoritativeBatchCoordinatorMatch {
    return {
        matchID: 'match-batch',
        gameId: 'test-game',
        engineConfig: { gameId: 'test-game' },
        state: createState(0) as MatchState<unknown>,
        stateID,
        randomSeed: 'seed-1',
        getRandomCursor: () => 7,
        lastCommandFailureReason: null,
    };
}

function createAdmission(overrides?: Partial<OnlineAiCircuitAdmission>): OnlineAiCircuitAdmission {
    const breaker = new OnlineAiCircuitBreaker();
    return {
        allowed: true,
        snapshot: breaker.getSnapshot('match-batch', '1'),
        ...overrides,
    };
}

function createHarness(options?: {
    seatControllerType?: 'human' | 'local-ai' | 'remote-ai';
    admission?: OnlineAiCircuitAdmission;
}) {
    const executed: string[] = [];
    const persistedRollback: StoredMatchState[] = [];
    const broadcasts: string[] = [];
    const confirmed: unknown[] = [];
    const rejected: unknown[] = [];
    const traces: Array<{ stage: string; payload: Record<string, unknown> }> = [];
    const recordedCircuit: unknown[] = [];
    const randomRestores: number[] = [];
    const emitBatchRejected = vi.fn((matchId, batchId, reason) => {
        rejected.push({ matchId, batchId, reason });
    });
    const emitBatchConfirmed = vi.fn((matchId, batchId, authoritativeState) => {
        confirmed.push({ matchId, batchId, authoritativeState });
    });

    const hooks: AuthoritativeBatchCoordinatorHooks<AuthoritativeBatchCoordinatorMatch> = {
        executeCommand: vi.fn(async ({ match, command }) => {
            executed.push(command.type);
            if (command.type === 'FAIL') {
                match.lastCommandFailureReason = 'domain_rejected';
                return false;
            }
            match.stateID += 1;
            match.state = createState(match.stateID) as MatchState<unknown>;
            match.getRandomCursor = () => 11;
            return true;
        }),
        restoreRandomCursor: vi.fn((match, randomCursor) => {
            randomRestores.push(randomCursor);
            match.getRandomCursor = () => randomCursor;
        }),
        persistRollbackState: vi.fn(async (_match, storedState) => {
            persistedRollback.push(storedState);
        }),
        broadcastState: vi.fn((match) => {
            broadcasts.push(match.matchID);
        }),
        buildAuthoritativeState: vi.fn((match) => ({
            stateID: match.stateID,
        })),
        resolveSeatControllerType: vi.fn(() => options?.seatControllerType ?? 'human'),
        admitOnlineAiCircuitCommand: vi.fn(() => options?.admission ?? createAdmission()),
        recordOnlineAiCircuitFailure: vi.fn(async (args) => {
            recordedCircuit.push(args);
        }),
        emitTrace: vi.fn((stage, payload) => {
            traces.push({ stage, payload });
        }),
    };
    const coordinator = new AuthoritativeBatchCoordinator({ hooks });

    return {
        coordinator,
        execute: (args: TestExecuteArgs) => coordinator.execute({
            ...args,
            emitBatchRejected,
            emitBatchConfirmed,
        }),
        hooks,
        executed,
        persistedRollback,
        broadcasts,
        confirmed,
        rejected,
        traces,
        recordedCircuit,
        randomRestores,
    };
}

describe('AuthoritativeBatchCoordinator', () => {
    it('批量命令成功时只发送一次 confirmed，并返回权威状态', async () => {
        const match = createMatch();
        const harness = createHarness();

        const result = await harness.execute({
            match,
            playerId: '0',
            batchId: 'batch-1',
            commands: [{ type: 'A', payload: {} }, { type: 'B', payload: {} }],
            meta: { expectedStateID: 1 },
            tracePrefix: 'test-batch',
        });

        expect(result).toBe(true);
        expect(harness.executed).toEqual(['A', 'B']);
        expect(harness.broadcasts).toEqual(['match-batch']);
        expect(harness.confirmed).toEqual([{
            matchId: 'match-batch',
            batchId: 'batch-1',
            authoritativeState: { stateID: 3 },
        }]);
        expect(harness.rejected).toHaveLength(0);
        expect(harness.traces.map((trace) => trace.stage)).toEqual(['test-batch-confirmed']);
    });

    it('批量内命令失败时回滚并发送真实失败原因', async () => {
        const initialState = createState(0) as MatchState<unknown>;
        const match = createMatch();
        match.state = initialState;
        const harness = createHarness();

        const result = await harness.execute({
            match,
            playerId: '0',
            batchId: 'batch-2',
            commands: [{ type: 'A', payload: {} }, { type: 'FAIL', payload: {} }],
            tracePrefix: 'test-batch',
        });

        expect(result).toBe(false);
        expect(match.state).toBe(initialState);
        expect(match.stateID).toBe(1);
        expect(match.getRandomCursor()).toBe(7);
        expect(harness.randomRestores).toEqual([7]);
        expect(harness.persistedRollback).toEqual([{
            G: initialState,
            _stateID: 1,
            randomSeed: 'seed-1',
            randomCursor: 7,
        }]);
        expect(harness.rejected).toEqual([{
            matchId: 'match-batch',
            batchId: 'batch-2',
            reason: 'domain_rejected',
        }]);
        expect(harness.confirmed).toHaveLength(0);
    });

    it('真人 batch stateID 过期时拒绝 stale_state，不进入命令执行', async () => {
        const match = createMatch(2);
        const harness = createHarness({ seatControllerType: 'human' });

        const result = await harness.execute({
            match,
            playerId: '0',
            batchId: 'batch-stale',
            commands: [{ type: 'A', payload: {} }],
            meta: { expectedStateID: 1 },
            tracePrefix: 'test-batch',
        });

        expect(result).toBe(false);
        expect(harness.executed).toHaveLength(0);
        expect(harness.recordedCircuit).toHaveLength(0);
        expect(harness.rejected).toEqual([{
            matchId: 'match-batch',
            batchId: 'batch-stale',
            reason: 'stale_state',
        }]);
    });

    it('AI batch stateID 过期且 circuit 允许时记录 stale failure 再拒绝', async () => {
        const match = createMatch(2);
        const harness = createHarness({ seatControllerType: 'local-ai' });

        const result = await harness.execute({
            match,
            playerId: '1',
            batchId: 'batch-ai-stale',
            commands: [{ type: 'AI_CMD', payload: { cardUid: 'old-card' } }],
            meta: { expectedStateID: 1, onlineAiAttemptKey: 'attempt-1' },
            tracePrefix: 'test-batch',
        });

        expect(result).toBe(false);
        expect(harness.executed).toHaveLength(0);
        expect(harness.recordedCircuit).toHaveLength(1);
        expect(harness.recordedCircuit[0]).toMatchObject({
            match,
            playerId: '1',
            source: 'client',
            commandType: 'AI_CMD',
            commandPayload: { cardUid: 'old-card' },
            reason: 'stale_state',
            expectedStateID: 1,
            stateID: 2,
            onlineAiAttemptKey: 'attempt-1',
        });
        expect(harness.rejected).toEqual([{
            matchId: 'match-batch',
            batchId: 'batch-ai-stale',
            reason: 'stale_state',
        }]);
    });

    it('AI batch stateID 命中已失效 epoch 时直接拒绝，不重复记录 circuit failure', async () => {
        const match = createMatch(2);
        const harness = createHarness({
            seatControllerType: 'local-ai',
            admission: createAdmission({ allowed: false, reason: 'stale-epoch' }),
        });

        const result = await harness.execute({
            match,
            playerId: '1',
            batchId: 'batch-ai-stale-epoch',
            commands: [{ type: 'AI_CMD', payload: {} }],
            meta: { expectedStateID: 1 },
            tracePrefix: 'test-batch',
        });

        expect(result).toBe(false);
        expect(harness.executed).toHaveLength(0);
        expect(harness.recordedCircuit).toHaveLength(0);
        expect(harness.rejected).toEqual([{
            matchId: 'match-batch',
            batchId: 'batch-ai-stale-epoch',
            reason: 'stale_state',
        }]);
    });
});
