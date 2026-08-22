import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import type { AuthoritativeCommandExecutionFailure } from '../authoritativeCommandExecutor';
import {
    AuthoritativeCommandFailureCoordinator,
    type AuthoritativeCommandFailureCoordinatorHooks,
} from '../authoritativeCommandFailureCoordinator';
import type { CommandFailureFeedbackPayload } from '../commandFailureFeedbackPayload';

type TestMatch = {
    matchID: string;
    gameId: string;
    engineConfig: { gameId: string };
    stateID: number;
    connections: Map<string, Set<string>>;
    lastCommandFailureReason: string | null;
};

function createState(): MatchState<unknown> {
    return {
        core: {},
        sys: { phase: 'main', turnNumber: 1 },
    } as MatchState<unknown>;
}

function createMatch(): TestMatch {
    return {
        matchID: 'match-1',
        gameId: 'test-game',
        engineConfig: { gameId: 'test-game' },
        stateID: 7,
        connections: new Map([['1', new Set(['socket-1'])]]),
        lastCommandFailureReason: null,
    };
}

function createFailure(overrides?: Partial<AuthoritativeCommandExecutionFailure>): AuthoritativeCommandExecutionFailure {
    return {
        success: false,
        kind: 'domain-rejected',
        command: { type: 'BAD', playerId: '1', payload: {}, timestamp: 1 },
        failureReason: 'invalid_command',
        error: new Error('invalid_command'),
        durationMs: 1,
        ...overrides,
    };
}

function createHarness(options?: {
    shouldReport?: boolean;
}) {
    const recordedCircuit: unknown[] = [];
    const logged: unknown[] = [];
    const emitted: unknown[] = [];
    const reported: CommandFailureFeedbackPayload[] = [];
    const cancelled: unknown[] = [];

    const hooks: AuthoritativeCommandFailureCoordinatorHooks<TestMatch> = {
        recordOnlineAiCircuitFailure: vi.fn(async (args) => {
            recordedCircuit.push(args);
        }),
        logCommandFailed: vi.fn((payload) => {
            logged.push(payload);
        }),
        emitPlayerError: vi.fn((match, playerId, reason) => {
            emitted.push({ matchID: match.matchID, playerId, reason });
        }),
        shouldReportCommandFailureFeedback: vi.fn(() => options?.shouldReport ?? true),
        buildCommandFailureFeedbackPayload: vi.fn((args) => ({
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            playerId: args.playerId,
            incidentKind: 'command-failed',
            feedbackSource: args.feedbackSource,
            severity: 'medium',
            commandType: args.commandType,
            reason: args.reason,
            incidentKey: 'incident-1',
            progressMarker: args.progressMarker,
            stateSnapshot: JSON.stringify({ commandPayload: args.commandPayload }),
        })),
        reportCommandFailureFeedback: vi.fn(async (payload) => {
            reported.push(payload);
        }),
        cancelInteractionOnError: vi.fn(async (match, playerId) => {
            cancelled.push({ matchID: match.matchID, playerId });
            match.lastCommandFailureReason = null;
        }),
    };

    return {
        coordinator: new AuthoritativeCommandFailureCoordinator({ hooks }),
        hooks,
        recordedCircuit,
        logged,
        emitted,
        reported,
        cancelled,
    };
}

function baseArgs(match = createMatch(), execution = createFailure()) {
    return {
        match,
        playerId: '1',
        requestedCommandType: 'BAD',
        effectiveCommandType: 'BAD',
        effectivePayload: { cardUid: 'c1' },
        execution,
        onlineAiSeatControllerType: 'local-ai' as const,
        onlineAiCircuitSource: 'watchdog' as const,
        expectedStateID: 6,
        onlineAiAttemptKey: 'attempt-1',
        clientTransport: null,
        stateIdBefore: 7,
        progressMarkerBeforeCommand: 'marker-1',
        preCommandSeatView: createState(),
        feedbackSource: 'online-ai-watchdog' as const,
        reportFailureFeedback: true,
    };
}

describe('AuthoritativeCommandFailureCoordinator', () => {
    it('AI 命令失败时记录 circuit、通知玩家并上报命令失败反馈', async () => {
        const match = createMatch();
        const harness = createHarness();

        const result = await harness.coordinator.handleFailure(baseArgs(match));

        expect(result).toBe(false);
        expect(match.lastCommandFailureReason).toBe('invalid_command');
        expect(harness.recordedCircuit).toHaveLength(1);
        expect(harness.recordedCircuit[0]).toMatchObject({
            match,
            playerId: '1',
            source: 'watchdog',
            commandType: 'BAD',
            commandPayload: { cardUid: 'c1' },
            reason: 'invalid_command',
            expectedStateID: 6,
            stateID: 7,
            progressMarker: 'marker-1',
            onlineAiAttemptKey: 'attempt-1',
        });
        expect(harness.emitted).toEqual([{ matchID: 'match-1', playerId: '1', reason: 'invalid_command' }]);
        expect(harness.reported).toHaveLength(1);
        expect(harness.reported[0]).toMatchObject({
            commandType: 'BAD',
            reason: 'invalid_command',
            feedbackSource: 'online-ai-watchdog',
        });
    });

    it('真人领域拒绝只通知玩家，不记录 AI circuit，也可按策略跳过反馈', async () => {
        const match = createMatch();
        const harness = createHarness({ shouldReport: false });

        await harness.coordinator.handleFailure({
            ...baseArgs(match),
            onlineAiSeatControllerType: 'human',
            feedbackSource: 'player-command-failure',
        });

        expect(match.lastCommandFailureReason).toBe('invalid_command');
        expect(harness.recordedCircuit).toHaveLength(0);
        expect(harness.emitted).toEqual([{ matchID: 'match-1', playerId: '1', reason: 'invalid_command' }]);
        expect(harness.reported).toHaveLength(0);
    });

    it('非取消命令的 pipeline 异常会触发 pending interaction 自动取消，并恢复原失败原因', async () => {
        const match = createMatch();
        const harness = createHarness();
        const execution = createFailure({
            kind: 'pipeline-exception',
            failureReason: 'pipeline_error: boom',
            error: new Error('boom'),
        });

        await harness.coordinator.handleFailure(baseArgs(match, execution));

        expect(harness.cancelled).toEqual([{ matchID: 'match-1', playerId: '1' }]);
        expect(match.lastCommandFailureReason).toBe('pipeline_error: boom');
    });
});
