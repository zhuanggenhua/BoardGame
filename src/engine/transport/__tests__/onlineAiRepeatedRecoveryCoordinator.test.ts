import { describe, expect, it, vi } from 'vitest';
import { INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import type { OnlineAiCircuitSnapshot } from '../onlineAiCircuitBreaker';
import {
    OnlineAiRepeatedRecoveryCoordinator,
    type OnlineAiRepeatedRecoveryCoordinatorHooks,
} from '../onlineAiRepeatedRecoveryCoordinator';
import type { OnlineAiRepeatedRecoveryUnblockMatch } from '../onlineAiRepeatedRecoveryUnblockExecutor';

const createState = (overrides: Partial<MatchState<unknown>> = {}): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 1,
        eventStream: { nextId: 1, entries: [] },
        interaction: {
            current: {
                id: 'repeat-choice',
                kind: 'simple-choice',
                playerId: '1',
            },
            queue: [],
            isBlocked: false,
        },
        responseWindow: { current: undefined },
    },
    ...overrides,
}) as unknown as MatchState<unknown>;

const createMatch = (state = createState()): OnlineAiRepeatedRecoveryUnblockMatch => ({
    matchID: 'match-repeat-unblock',
    gameId: 'test-game',
    state,
    stateID: 0,
    unloaded: false,
    executing: false,
    lastCommandFailureReason: null,
    engineConfig: { gameId: 'test-game' },
});

const createCandidate = (reason: ForceEndTurnStalledAiResolution['reason'] = 'visible-interaction'): ForceEndTurnStalledAiResolution => ({
    playerId: '1',
    reason,
    resolution: {
        playerId: '1',
        attemptKey: 'repeat-choice',
        source: 'local-ai',
        action: {
            actionId: 'repeat-choice',
            kind: 'interaction-choice',
            label: '选择',
            commands: [],
        },
    },
});

const createCircuitSnapshot = (overrides: Partial<OnlineAiCircuitSnapshot> = {}): OnlineAiCircuitSnapshot => ({
    matchId: 'match-repeat-unblock',
    playerId: '1',
    windowStartedAt: 0,
    windowMs: 30_000,
    failureBudget: 3,
    attemptCount: 0,
    failureCount: 0,
    staleStateFailureCount: 0,
    recoveryCount: 0,
    tripped: false,
    trippedAt: null,
    safeUnblockUsed: false,
    safeUnblockInFlight: false,
    awaitingFreshState: false,
    safeUnblockStateID: null,
    invalidatedExpectedStateID: null,
    queueLength: 0,
    recentFailures: [],
    ...overrides,
});

const createHooks = (
    match: OnlineAiRepeatedRecoveryUnblockMatch,
    overrides: Partial<OnlineAiRepeatedRecoveryCoordinatorHooks<OnlineAiRepeatedRecoveryUnblockMatch>> = {},
): OnlineAiRepeatedRecoveryCoordinatorHooks<OnlineAiRepeatedRecoveryUnblockMatch> => ({
    getCircuitSnapshot: vi.fn(() => createCircuitSnapshot()),
    beginSafeUnblock: vi.fn(() => true),
    finishSafeUnblock: vi.fn(),
    executeCommand: vi.fn(async ({ commandType }) => {
        match.stateID += 1;
        if (commandType === INTERACTION_COMMANDS.CANCEL) {
            match.state = {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    eventStream: { nextId: 2, entries: [] },
                    interaction: { current: undefined, queue: [], isBlocked: false },
                },
            };
            return true;
        }
        if (commandType === 'ADVANCE_PHASE') {
            match.state = {
                ...match.state,
                core: { activePlayerId: '0' },
                sys: {
                    ...match.state.sys,
                    phase: 'draw',
                    eventStream: { nextId: 3, entries: [] },
                },
            };
            return true;
        }
        return false;
    }),
    markRepeatedAttemptReported: vi.fn(() => ({
        count: 3,
        lastAttemptAt: 10,
        reported: true,
    })),
    clearRecoveryTracker: vi.fn(),
    reportRecoveryFeedback: vi.fn(async () => {}),
    buildRecoveryStateSnapshot: vi.fn(async ({ failureReason }) => `snapshot:${failureReason ?? 'none'}`),
    buildRecoveryActionLog: vi.fn(({ failureReason }) => `action-log:${failureReason ?? 'none'}`),
    drainCommandQueue: vi.fn(async () => {}),
    ...overrides,
});

describe('OnlineAiRepeatedRecoveryCoordinator', () => {
    it('reportSuppressed 标记 repeated attempt 并上报恢复抑制现场', async () => {
        const match = createMatch();
        const hooks = createHooks(match);
        const coordinator = new OnlineAiRepeatedRecoveryCoordinator({
            repeatedAttemptLimit: 3,
            hooks,
            now: () => 1_000,
        });

        await coordinator.reportSuppressed({
            match,
            candidate: createCandidate('active-turn'),
            trackerKey: '1:active-turn:marker',
            progressMarker: 'marker-before',
            repeatedAttemptKey: 'match-repeat-unblock:1:active-turn:marker',
            repeatedAttempt: { count: 3, lastAttemptAt: 500, reported: false },
            suppressionReason: 'no_safe_force_unblock',
        });

        expect(hooks.markRepeatedAttemptReported).toHaveBeenCalledWith(
            'match-repeat-unblock:1:active-turn:marker',
            { count: 3, lastAttemptAt: 500, reported: false },
            3,
        );
        expect(hooks.reportRecoveryFeedback).toHaveBeenCalledWith(expect.objectContaining({
            incidentKind: 'repeated-recovery-suppressed',
            status: 'open',
            severity: 'high',
            reason: 'active-turn:repeat-limit:3/3:no_safe_force_unblock',
            stateSnapshot: 'snapshot:no_safe_force_unblock',
            actionLog: 'action-log:no_safe_force_unblock',
        }));
    });

    it('tryForceUnblock 复用 executor 并把成功解卡作为 feedback 合同上报', async () => {
        const match = createMatch();
        const hooks = createHooks(match);
        const coordinator = new OnlineAiRepeatedRecoveryCoordinator({
            repeatedAttemptLimit: 3,
            hooks,
        });

        const result = await coordinator.tryForceUnblock({
            match,
            candidate: createCandidate('visible-interaction'),
            trackerKey: '1:visible-interaction:marker',
            progressMarker: 'marker-before',
            repeatedAttemptKey: 'match-repeat-unblock:1:visible-interaction:marker',
            repeatedAttempt: { count: 3, lastAttemptAt: 500, reported: false },
            seatControllers: { '1': { type: 'local-ai' } },
        });

        expect(result).toEqual({ handled: true });
        expect(hooks.executeCommand).toHaveBeenCalledWith(expect.objectContaining({
            commandType: INTERACTION_COMMANDS.CANCEL,
            playerId: '1',
        }));
        expect(hooks.clearRecoveryTracker).toHaveBeenCalledWith('match-repeat-unblock');
        expect(hooks.reportRecoveryFeedback).toHaveBeenCalledWith(expect.objectContaining({
            incidentKind: 'repeated-recovery-force-unblocked',
            status: 'open',
            severity: 'high',
            reason: 'visible-interaction:repeat-limit-force-unblock:3/3:commands=SYS_INTERACTION_CANCEL+ADVANCE_PHASE',
            stateSnapshot: 'snapshot:repeated_recovery_force_unblocked',
            actionLog: 'action-log:repeated_recovery_force_unblocked',
        }));
        expect(match.executing).toBe(false);
    });
});
