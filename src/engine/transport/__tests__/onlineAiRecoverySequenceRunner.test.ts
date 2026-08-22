import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import { INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import type { GameEngineConfig } from '../engineConfig';
import {
    buildAiProgressMarker,
    type ForceEndTurnStalledAiResolution,
} from '../onlineAiRecovery';
import {
    OnlineAiRecoverySequenceRunner,
    type OnlineAiRecoverySequenceMatch,
    type OnlineAiRecoverySequenceRunnerHooks,
} from '../onlineAiRecoverySequenceRunner';
import { buildOnlineAiRecoveryTrackerSnapshot } from '../onlineAiWatchdogSequenceFingerprinting';
import type {
    OnlineAiLegalActionRecoveryResult,
} from '../onlineAiWatchdogSequenceHelpers';
import type { OnlineAiWatchdogSeatController } from '../onlineAiWatchdogSeatControllers';
import type { OnlineAiRecoveryTracker } from '../onlineAiWatchdogTracker';

type TestMatch = OnlineAiRecoverySequenceMatch;

const seatControllers: Record<string, OnlineAiWatchdogSeatController> = {
    '0': { type: 'human' },
    '1': { type: 'local-ai' },
};

function createState(overrides: {
    phase?: string;
    eventStreamNextId?: number;
    interaction?: MatchState<unknown>['sys']['interaction'];
} = {}): MatchState<unknown> {
    return {
        core: { currentPlayerId: '1' },
        sys: {
            phase: overrides.phase ?? 'main',
            turnNumber: 1,
            eventStream: { nextId: overrides.eventStreamNextId ?? 1, entries: [] },
            ...(overrides.interaction ? { interaction: overrides.interaction } : {}),
        },
    } as MatchState<unknown>;
}

function createMatch(overrides: Partial<TestMatch> = {}): TestMatch {
    return {
        matchID: 'match-sequence-runner',
        gameId: 'test-game',
        engineConfig: {
            gameId: 'test-game',
        } as GameEngineConfig,
        state: createState(),
        stateID: 1,
        unloaded: false,
        ...overrides,
    };
}

function createCandidate(
    overrides: Partial<ForceEndTurnStalledAiResolution> = {},
): ForceEndTurnStalledAiResolution {
    return {
        playerId: '1',
        reason: 'active-turn',
        resolution: {
            playerId: '1',
            attemptKey: 'attempt-active-turn',
            source: 'local-ai',
            action: {
                actionId: 'force-end-turn:1',
                kind: 'force-end-turn',
                label: '强制结束 AI 回合',
                commands: [],
            },
        },
        ...overrides,
    } as ForceEndTurnStalledAiResolution;
}

function createTracker(match: TestMatch, candidate: ForceEndTurnStalledAiResolution): OnlineAiRecoveryTracker {
    const snapshot = buildOnlineAiRecoveryTrackerSnapshot({
        state: match.state,
        candidate,
        engineConfig: match.engineConfig,
        gameId: match.gameId,
    });
    return {
        key: snapshot.trackerKey,
        firstSeenAt: 1_000,
        autoSubmittedAt: 1_500,
        lastReportedFailureReason: null,
        failureCount: 0,
    };
}

function advanceState(match: TestMatch, phase: string): void {
    match.state = createState({
        phase,
        eventStreamNextId: ((match.state.sys?.eventStream?.nextId as number | undefined) ?? 1) + 1,
    });
    match.stateID += 1;
}

function createHarness(options: {
    match: TestMatch;
    candidate: ForceEndTurnStalledAiResolution;
    recoverWithLegalAction: OnlineAiRecoverySequenceRunnerHooks<TestMatch>['tryRecoverWithLegalAction'];
    onExecuteRecoveryCommand?: OnlineAiRecoverySequenceRunnerHooks<TestMatch>['executeRecoveryCommand'];
}) {
    let liveCandidate: ForceEndTurnStalledAiResolution | null = options.candidate;
    const roomRuntime = {
        isExecuting: vi.fn(() => false),
        tryBeginExecution: vi.fn(() => true),
        finishExecution: vi.fn(),
        drainCommandQueueIfLoaded: vi.fn(async () => undefined),
    };
    const hooks: OnlineAiRecoverySequenceRunnerHooks<TestMatch> = {
        createRoomRuntime: vi.fn(() => roomRuntime),
        resolveRecoveryCandidate: vi.fn(async () => liveCandidate),
        tryRecoverWithLegalAction: options.recoverWithLegalAction,
        executeRecoveryCommand: options.onExecuteRecoveryCommand ?? vi.fn(async ({ match }) => {
            advanceState(match, 'forced');
            liveCandidate = null;
            return true;
        }),
        getLastCommandFailureReason: vi.fn(() => null),
        clearRecoveryProgress: vi.fn(),
        clearTracker: vi.fn(),
        setTracker: vi.fn(),
        recordRepeatedAttempt: vi.fn(() => ({ count: 1, lastAttemptAt: 2_000, reported: false })),
        clearStateBaselines: vi.fn(),
        persistState: vi.fn(async () => undefined),
        broadcastState: vi.fn(),
        resolvePrivateOverlay: vi.fn((match) => match.state),
        handleRecoveryFailure: vi.fn(async () => undefined),
        reportRecoverySuccessFeedback: vi.fn(async () => undefined),
        logExecutionTrace: vi.fn(),
        logLegacyResponseWindowMirrorCleared: vi.fn(),
        logRecoveredStalledAi: vi.fn(),
    };
    const runner = new OnlineAiRecoverySequenceRunner({
        maxAdvanceSteps: 4,
        maxStepsPerSlice: 4,
        hooks,
    });

    return {
        runner,
        hooks,
        roomRuntime,
        clearLiveCandidate: () => {
            liveCandidate = null;
        },
    };
}

describe('OnlineAiRecoverySequenceRunner', () => {
    it('合法动作恢复成功时清理 tracker 并通过成功反馈 hook 上报', async () => {
        const match = createMatch();
        const candidate = createCandidate();
        const tracker = createTracker(match, candidate);
        const progressMarkerBeforeRecovery = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        let clearLiveCandidate: () => void = () => {};
        const legalActionResult: OnlineAiLegalActionRecoveryResult = {
            applied: true,
            resolved: true,
            blockedReason: null,
            executedCommandTypes: ['END_PHASE'],
            outcome: 'applied',
            reportedAction: {
                candidateReason: 'active-turn',
                playerId: '1',
                actionKind: 'end-phase',
                actionId: 'legal-end-phase',
            },
        };
        const harness = createHarness({
            match,
            candidate,
            recoverWithLegalAction: vi.fn(async ({ match }) => {
                advanceState(match, 'after-legal-action');
                clearLiveCandidate();
                return legalActionResult;
            }),
        });
        clearLiveCandidate = harness.clearLiveCandidate;

        await harness.runner.run({
            match,
            tracker,
            candidate,
            progressMarkerBeforeRecovery,
            seatControllers,
        });

        expect(harness.hooks.clearTracker).toHaveBeenCalledWith(match.matchID);
        expect(harness.hooks.reportRecoverySuccessFeedback).toHaveBeenCalledWith(expect.objectContaining({
            match,
            candidate,
            metadata: expect.objectContaining({
                incidentKind: 'legal-action-recovered',
                reason: 'active-turn:legal-action:end-phase:legal-end-phase',
            }),
        }));
        expect(harness.roomRuntime.drainCommandQueueIfLoaded).toHaveBeenCalledTimes(1);
        expect(harness.roomRuntime.finishExecution).toHaveBeenCalledTimes(1);
    });

    it('合法动作不可用时通过唯一强制命令 hook 收口，不在 runner 内执行第二套命令', async () => {
        const interactionState = {
            current: {
                id: 'interaction-1',
                kind: 'simple-choice',
                playerId: '1',
                data: { sourceId: 'source-1', options: [] },
            },
            isBlocked: true,
        } as MatchState<unknown>['sys']['interaction'];
        const match = createMatch({ state: createState({ interaction: interactionState }) });
        const candidate = createCandidate({
            reason: 'visible-interaction',
            fingerprintHint: 'source-1',
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
        });
        const tracker = createTracker(match, candidate);
        const progressMarkerBeforeRecovery = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        let clearLiveCandidate: () => void = () => {};
        const executeRecoveryCommand = vi.fn(async ({ match }) => {
            advanceState(match, 'after-forced-command');
            clearLiveCandidate();
            return true;
        });
        const harness = createHarness({
            match,
            candidate,
            recoverWithLegalAction: vi.fn(async (): Promise<OnlineAiLegalActionRecoveryResult> => ({
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
                reportedAction: null,
            })),
            onExecuteRecoveryCommand: executeRecoveryCommand,
        });
        clearLiveCandidate = harness.clearLiveCandidate;

        await harness.runner.run({
            match,
            tracker,
            candidate,
            progressMarkerBeforeRecovery,
            seatControllers,
        });

        expect(executeRecoveryCommand).toHaveBeenCalledWith(expect.objectContaining({
            match,
            playerId: '1',
            commandType: INTERACTION_COMMANDS.CANCEL,
            commandPayload: { interactionId: 'interaction-1' },
        }));
        expect(harness.hooks.reportRecoverySuccessFeedback).toHaveBeenCalledWith(expect.objectContaining({
            metadata: expect.objectContaining({
                incidentKind: 'force-end-turn-success',
            }),
        }));
        expect(harness.hooks.handleRecoveryFailure).not.toHaveBeenCalled();
    });
});
