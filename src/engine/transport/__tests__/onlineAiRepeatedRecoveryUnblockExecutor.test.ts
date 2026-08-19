import { describe, expect, it, vi } from 'vitest';
import { INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import type { OnlineAiCircuitSnapshot } from '../onlineAiCircuitBreaker';
import {
    resolveRepeatLimitCurrentAiInteraction,
    tryForceUnblockRepeatedOnlineAiRecovery,
    type OnlineAiRepeatedRecoveryUnblockHooks,
    type OnlineAiRepeatedRecoveryUnblockMatch,
} from '../onlineAiRepeatedRecoveryUnblockExecutor';

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
    overrides: Partial<OnlineAiRepeatedRecoveryUnblockHooks> = {},
): OnlineAiRepeatedRecoveryUnblockHooks => ({
    getCircuitSnapshot: vi.fn(() => createCircuitSnapshot()),
    beginSafeUnblock: vi.fn(() => true),
    finishSafeUnblock: vi.fn(),
    executeCommand: vi.fn(async (commandType) => {
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
    reportSuppressed: vi.fn(async () => {}),
    markRepeatedAttemptReported: vi.fn(() => ({
        count: 3,
        lastAttemptAt: 10,
        reported: true,
    })),
    clearRecoveryTracker: vi.fn(),
    reportForceUnblocked: vi.fn(async () => {}),
    drainCommandQueue: vi.fn(async () => {}),
    ...overrides,
});

describe('onlineAiRepeatedRecoveryUnblockExecutor', () => {
    it('重复 visible interaction 可安全取消并推进阶段时，返回 handled 并上报 force-unblocked', async () => {
        const match = createMatch();
        const hooks = createHooks(match);

        const result = await tryForceUnblockRepeatedOnlineAiRecovery({
            match,
            candidate: createCandidate('visible-interaction'),
            progressMarker: 'before-marker',
            repeatedAttemptKey: 'match-repeat-unblock:tracker',
            repeatedAttempt: { count: 3, lastAttemptAt: 1, reported: false },
            repeatedAttemptLimit: 3,
            seatControllers: { '1': { type: 'local-ai' } },
            hooks,
        });

        expect(result).toEqual({ handled: true });
        expect(hooks.executeCommand).toHaveBeenCalledWith(
            INTERACTION_COMMANDS.CANCEL,
            { interactionId: 'repeat-choice', reason: 'repeated-recovery-limit' },
            {
                reportFailureFeedback: true,
                feedbackSource: 'online-ai-watchdog',
                onlineAiCircuitSource: 'watchdog',
            },
        );
        expect(hooks.executeCommand).toHaveBeenCalledWith(
            'ADVANCE_PHASE',
            {},
            {
                reportFailureFeedback: true,
                feedbackSource: 'online-ai-watchdog',
                onlineAiCircuitSource: 'watchdog',
            },
        );
        expect(hooks.clearRecoveryTracker).toHaveBeenCalledTimes(1);
        expect(hooks.reportForceUnblocked).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'visible-interaction:repeat-limit-force-unblock:3/3:commands=SYS_INTERACTION_CANCEL+ADVANCE_PHASE',
            forcedCommands: [INTERACTION_COMMANDS.CANCEL, 'ADVANCE_PHASE'],
        }));
        expect(hooks.drainCommandQueue).toHaveBeenCalledTimes(1);
        expect(match.executing).toBe(false);
    });

    it('response window 存在时不把 interaction 候选裸推进', () => {
        const match = createMatch({
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
                responseWindow: {
                    current: {
                        id: 'response-window',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as unknown as MatchState<unknown>);

        expect(resolveRepeatLimitCurrentAiInteraction({
            match,
            candidate: createCandidate('visible-interaction'),
            seatControllers: { '1': { type: 'local-ai' } },
        })).toBeNull();
    });
});
