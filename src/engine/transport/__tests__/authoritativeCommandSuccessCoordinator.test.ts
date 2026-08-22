import { describe, expect, it, vi } from 'vitest';
import type { MatchState, RandomFn } from '../../types';
import { createInitialSystemState } from '../../pipeline';
import type { AuthoritativeCommandExecutionSuccess } from '../authoritativeCommandExecutor';
import {
    AuthoritativeCommandSuccessCoordinator,
    type AuthoritativeCommandSuccessCoordinatorHooks,
    type AuthoritativeCommandSuccessMatch,
} from '../authoritativeCommandSuccessCoordinator';
import type { StoredMatchState } from '../storage';

type TestCore = {
    count: number;
};

type TestFeedback = {
    incidentKind: string;
};

const baseRandom: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (array) => [...array],
};

function createState(count: number): MatchState<TestCore> {
    return {
        core: { count },
        sys: createInitialSystemState(['0', '1'], []),
    };
}

function createMatch(state = createState(0) as MatchState<unknown>): AuthoritativeCommandSuccessMatch {
    return {
        matchID: 'match-success',
        gameId: 'test-game',
        engineConfig: {
            gameId: 'test-game',
            eventTelemetry: (event) => ({
                eventType: event.type,
                observed: true,
            }),
        },
        state,
        stateID: 4,
        randomSeed: 'seed-1',
        random: baseRandom,
        getRandomCursor: () => 3,
        lastCommandPlayerId: null,
        lastBroadcastedViews: new Map(),
        unloaded: false,
        metadata: {
            gameName: 'test-game',
            players: {
                '0': { name: 'P0' },
                '1': { name: 'P1' },
            },
            createdAt: 100,
            updatedAt: 100,
        },
        lastCommandFailureReason: 'previous_failure',
    };
}

function createExecution(nextState: MatchState<unknown>, overrides?: Partial<AuthoritativeCommandExecutionSuccess>): AuthoritativeCommandExecutionSuccess {
    return {
        success: true,
        command: {
            type: 'MOVE',
            playerId: '0',
            payload: { step: 1 },
            timestamp: 10,
        },
        result: {
            success: true,
            state: nextState,
            events: [{
                type: 'COUNT_CHANGED',
                payload: { count: 1 },
                timestamp: 11,
            }],
        },
        state: nextState,
        events: [{
            type: 'COUNT_CHANGED',
            payload: { count: 1 },
            timestamp: 11,
        }],
        durationMs: 12,
        ...overrides,
    };
}

function createHarness(options?: {
    feedback?: TestFeedback | null;
}) {
    const persistedStates: StoredMatchState[] = [];
    const reportedFeedback: TestFeedback[] = [];
    const broadcasts: string[] = [];
    const persistedMetadata: string[] = [];
    const clearedCircuit: string[] = [];
    const recordDecisionSample = vi.fn();
    const buildPostTrainingState = vi.fn((match: AuthoritativeCommandSuccessMatch) => match.state);

    const hooks: AuthoritativeCommandSuccessCoordinatorHooks<AuthoritativeCommandSuccessMatch, TestFeedback> = {
        createTrackedRandom: vi.fn(() => ({
            random: baseRandom,
            getCursor: () => 9,
        })),
        persistState: vi.fn(async (_match, storedState) => {
            persistedStates.push(storedState);
        }),
        buildUnsatisfiableInteractionFeedback: vi.fn(async () => options?.feedback ?? null),
        buildPostTrainingState,
        trainingDataCapture: { recordDecisionSample },
        reportOnlineAiRecoveryFeedback: vi.fn(async (payload) => {
            reportedFeedback.push(payload);
        }),
        broadcastState: vi.fn((match) => {
            broadcasts.push(match.matchID);
        }),
        clearOnlineAiCircuitBreaker: vi.fn((matchID) => {
            clearedCircuit.push(matchID);
        }),
        persistMetadata: vi.fn(async (match) => {
            persistedMetadata.push(match.matchID);
        }),
    };
    const onCommandSucceeded = vi.fn();
    const onGameOver = vi.fn();

    return {
        coordinator: new AuthoritativeCommandSuccessCoordinator({
            hooks,
            onCommandSucceeded,
            onGameOver,
        }),
        hooks,
        persistedStates,
        reportedFeedback,
        broadcasts,
        persistedMetadata,
        clearedCircuit,
        recordDecisionSample,
        buildPostTrainingState,
        onCommandSucceeded,
        onGameOver,
    };
}

describe('AuthoritativeCommandSuccessCoordinator', () => {
    it('成功命令会按顺序提交状态、记录训练样本、上报反馈并广播', async () => {
        const match = createMatch();
        const nextState = createState(1) as MatchState<unknown>;
        const feedback = { incidentKind: 'unsatisfiable-interaction-auto-skipped' };
        const harness = createHarness({ feedback });

        const result = await harness.coordinator.handleSuccess({
            match,
            playerId: '0',
            commandType: 'MOVE',
            commandPayload: { step: 1 },
            execution: createExecution(nextState),
            seatControllerType: 'human',
            stateIdBefore: 4,
            progressMarkerBeforeCommand: 'marker-before',
            preCommandSeatView: createState(0) as MatchState<unknown>,
        });

        expect(result).toBe(true);
        expect(match.lastCommandFailureReason).toBeNull();
        expect(match.state).toBe(nextState);
        expect(match.stateID).toBe(5);
        expect(match.lastCommandPlayerId).toBe('0');
        expect(harness.persistedStates).toEqual([{
            G: nextState,
            _stateID: 5,
            randomSeed: 'seed-1',
            randomCursor: 3,
        }]);
        expect(harness.onCommandSucceeded).toHaveBeenCalledWith('match-success', 'test-game', 'MOVE');
        expect(harness.recordDecisionSample).toHaveBeenCalledTimes(1);
        expect(harness.reportedFeedback).toEqual([feedback]);
        expect(harness.broadcasts).toEqual(['match-success']);
    });

    it('对局已卸载时只让 commit 更新内存态并返回 false，不继续执行后续副作用', async () => {
        const match = createMatch();
        match.unloaded = true;
        const harness = createHarness();

        const result = await harness.coordinator.handleSuccess({
            match,
            playerId: '0',
            commandType: 'MOVE',
            commandPayload: {},
            execution: createExecution(createState(2) as MatchState<unknown>),
            seatControllerType: 'human',
            stateIdBefore: 4,
            progressMarkerBeforeCommand: 'marker-before',
            preCommandSeatView: createState(0) as MatchState<unknown>,
        });

        expect(result).toBe(false);
        expect(match.stateID).toBe(5);
        expect(harness.persistedStates).toHaveLength(0);
        expect(harness.recordDecisionSample).not.toHaveBeenCalled();
        expect(harness.broadcasts).toHaveLength(0);
    });

    it('首次 gameover 成功命令会更新 metadata、清理 circuit 并触发 gameover 回调', async () => {
        const match = createMatch();
        const nextState = createState(3) as MatchState<unknown>;
        nextState.sys.gameover = { winner: '0' };
        const harness = createHarness();

        const result = await harness.coordinator.handleSuccess({
            match,
            playerId: '0',
            commandType: 'FINAL_ATTACK',
            commandPayload: {},
            execution: createExecution(nextState),
            seatControllerType: 'human',
            stateIdBefore: 4,
            progressMarkerBeforeCommand: 'marker-before',
            preCommandSeatView: createState(0) as MatchState<unknown>,
        });

        expect(result).toBe(true);
        expect(match.metadata.gameover).toEqual({ winner: '0' });
        expect(harness.clearedCircuit).toEqual(['match-success']);
        expect(harness.persistedMetadata).toEqual(['match-success']);
        expect(harness.onGameOver).toHaveBeenCalledWith('match-success', 'test-game', { winner: '0' });
    });
});
