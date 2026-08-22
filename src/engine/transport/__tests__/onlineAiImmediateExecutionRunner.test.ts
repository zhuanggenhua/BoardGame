import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import { INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import type { GameEngineConfig } from '../engineConfig';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import {
    OnlineAiImmediateExecutionRunner,
    type OnlineAiImmediateExecutionMatch,
    type OnlineAiImmediateExecutionRunnerHooks,
} from '../onlineAiImmediateExecutionRunner';
import type { OnlineAiImmediateActionResult } from '../onlineAiExecutor';
import type { OnlineAiLegalActionRecoveryResult } from '../onlineAiWatchdogSequenceHelpers';
import type { OnlineAiWatchdogSeatController } from '../onlineAiWatchdogSeatControllers';

type TestMatch = OnlineAiImmediateExecutionMatch;

function createState(): MatchState<unknown> {
    return {
        core: { currentPlayerId: '1' },
        sys: {
            phase: 'main',
            turnNumber: 1,
            eventStream: { nextId: 1, entries: [] },
        },
    } as MatchState<unknown>;
}

function createMatch(overrides: Partial<TestMatch> = {}): TestMatch {
    return {
        matchID: 'match-immediate-runner',
        gameId: 'test-game',
        state: createState(),
        stateID: 1,
        unloaded: false,
        engineConfig: { gameId: 'test-game' } as GameEngineConfig,
        ...overrides,
    };
}

function createCandidate(): ForceEndTurnStalledAiResolution {
    return {
        playerId: '1',
        reason: 'visible-interaction',
        resolution: {
            playerId: '1',
            attemptKey: 'attempt-visible-interaction',
            source: 'local-ai',
            action: {
                actionId: 'force-cancel-interaction',
                kind: 'force-cancel-interaction',
                label: '取消无解交互',
                commands: [{ type: INTERACTION_COMMANDS.CANCEL, payload: { interactionId: 'interaction-1' } }],
            },
        },
    } as ForceEndTurnStalledAiResolution;
}

function createImmediateMiss(): OnlineAiImmediateActionResult {
    return {
        applied: false,
        playerId: '',
        actionKind: null,
        executedCommandTypes: [],
        decisionMs: 1,
        commandFailureReason: null,
    };
}

function createLegalActionMiss(): OnlineAiLegalActionRecoveryResult {
    return {
        applied: false,
        resolved: false,
        blockedReason: null,
        executedCommandTypes: [],
        outcome: 'no-legal-action',
        reportedAction: null,
    };
}

function createHarness(options?: {
    match?: TestMatch;
    seatControllers?: Record<string, OnlineAiWatchdogSeatController>;
    candidate?: ForceEndTurnStalledAiResolution | null;
}) {
    const match = options?.match ?? createMatch();
    const roomRuntime = {
        isUnloaded: vi.fn(() => false),
        isExecuting: vi.fn(() => false),
        tryBeginExecution: vi.fn(() => true),
        finishExecution: vi.fn(),
        drainCommandQueueIfLoaded: vi.fn(async () => undefined),
    };
    const seatControllers = options?.seatControllers ?? {
        '0': { type: 'human' },
        '1': { type: 'local-ai' },
    } satisfies Record<string, OnlineAiWatchdogSeatController>;
    const hooks: OnlineAiImmediateExecutionRunnerHooks<TestMatch> = {
        createRoomRuntime: vi.fn(() => roomRuntime),
        buildSeatControllers: vi.fn(() => seatControllers),
        isRecoveryInFlight: vi.fn(() => false),
        beginRecoveryInFlight: vi.fn(),
        finishRecoveryInFlight: vi.fn(),
        clearRecoveryProgress: vi.fn(),
        clearCircuitBreakerMatch: vi.fn(),
        clearCircuitBreakerSeat: vi.fn(),
        executeImmediateAction: vi.fn(async () => createImmediateMiss()),
        resolveRecoveryCandidate: vi.fn(async () => options?.candidate ?? null),
        buildRecoveryFingerprint: vi.fn(() => 'fingerprint-1'),
        setTracker: vi.fn(),
        tryRecoverWithLegalAction: vi.fn(async () => createLegalActionMiss()),
        runRecoverySequence: vi.fn(async () => undefined),
        logExecutionTrace: vi.fn(),
    };
    const runner = new OnlineAiImmediateExecutionRunner({
        maxAdvanceSteps: 4,
        maxStepsPerSlice: 2,
        hooks,
    });

    return { runner, hooks, roomRuntime, match, seatControllers };
}

describe('OnlineAiImmediateExecutionRunner', () => {
    it('没有 AI seat 时清理恢复进度和 circuit 状态，不占用房间执行锁', async () => {
        const { runner, hooks, roomRuntime, match } = createHarness({
            seatControllers: { '0': { type: 'human' } },
        });

        await runner.run(match, 'sync');

        expect(hooks.clearRecoveryProgress).toHaveBeenCalledWith(match.matchID);
        expect(hooks.clearCircuitBreakerMatch).toHaveBeenCalledWith(match.matchID);
        expect(roomRuntime.tryBeginExecution).not.toHaveBeenCalled();
        expect(hooks.executeImmediateAction).not.toHaveBeenCalled();
    });

    it('即时 AI miss 后若合法动作不可用且候选有恢复命令，应委托 recovery sequence', async () => {
        const candidate = createCandidate();
        const { runner, hooks, roomRuntime, match, seatControllers } = createHarness({ candidate });

        await runner.run(match, 'command-succeeded');

        expect(hooks.setTracker).toHaveBeenCalledWith(
            match.matchID,
            expect.objectContaining({ key: '1:visible-interaction:fingerprint-1' }),
        );
        expect(hooks.logExecutionTrace).toHaveBeenCalledWith(expect.objectContaining({
            matchId: match.matchID,
            candidateReason: 'visible-interaction',
            outcome: 'fallback:command-succeeded:no-legal-action',
        }));
        expect(hooks.runRecoverySequence).toHaveBeenCalledWith(expect.objectContaining({
            match,
            candidate,
            seatControllers,
            options: { reuseExecutionLock: true },
        }));
        expect(hooks.finishRecoveryInFlight).toHaveBeenCalledWith(match.matchID);
        expect(roomRuntime.drainCommandQueueIfLoaded).toHaveBeenCalledTimes(1);
        expect(roomRuntime.finishExecution).toHaveBeenCalledTimes(1);
    });
});
