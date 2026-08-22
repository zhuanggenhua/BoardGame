import { afterEach, describe, expect, it, vi } from 'vitest';
import * as aiModule from '../../ai';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import {
    OnlineAiLegalActionRecoveryCoordinator,
    type OnlineAiLegalActionRecoveryCoordinatorHooks,
    type OnlineAiLegalActionRecoveryCoordinatorMatch,
} from '../onlineAiLegalActionRecoveryCoordinator';
import type { OnlineAiRecoveryTracker } from '../onlineAiWatchdogTracker';
import type { OnlineAiWatchdogSeatController } from '../onlineAiWatchdogSeatControllers';

const createState = (phase = 'summon'): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase,
        turnNumber: 1,
        eventStream: { nextId: 1, entries: [] },
    },
}) as unknown as MatchState<unknown>;

const createCandidate = (): ForceEndTurnStalledAiResolution => ({
    playerId: '1',
    reason: 'active-turn',
    resolution: {
        playerId: '1',
        attemptKey: 'force-end-turn:1',
        source: 'local-ai',
        action: {
            actionId: 'force-end-turn:1',
            kind: 'force-end-turn',
            label: '强制结束 AI 回合',
            commands: [],
        },
    },
});

const createMatch = (): OnlineAiLegalActionRecoveryCoordinatorMatch => ({
    matchID: 'match-legal-action-coordinator',
    gameId: 'test-game',
    state: createState(),
    stateID: 0,
    unloaded: false,
    lastCommandFailureReason: null,
    engineConfig: {
        gameId: 'test-game',
        domain: {
            validate: () => ({ valid: true }),
        },
    } as any,
});

const tracker: OnlineAiRecoveryTracker = {
    key: '1:active-turn:test',
    firstSeenAt: 1,
    autoSubmittedAt: 2,
    lastReportedFailureReason: null,
    failureCount: 0,
};

const seatControllers: Record<string, OnlineAiWatchdogSeatController> = {
    '0': { type: 'human' },
    '1': { type: 'local-ai' },
};

const createHooks = (
    overrides: Partial<OnlineAiLegalActionRecoveryCoordinatorHooks<OnlineAiLegalActionRecoveryCoordinatorMatch>> = {},
): OnlineAiLegalActionRecoveryCoordinatorHooks<OnlineAiLegalActionRecoveryCoordinatorMatch> => ({
    resolvePrivateOverlay: vi.fn((match) => match.state),
    getLatestSeatController: vi.fn(() => ({ type: 'local-ai' })),
    buildRecoveryFingerprint: vi.fn((_, __, marker) => `fingerprint:${marker}`),
    hasRecoveryResolved: vi.fn(async () => true),
    settleRecoveryResolvedStatus: vi.fn(),
    resetRecoveryAttempt: vi.fn(),
    executeCommand: vi.fn(async ({ match, command }) => {
        match.state = createState(command.type);
        match.stateID += 1;
        return true;
    }),
    broadcastState: vi.fn(),
    onEmergencyOverlayFallbackRetry: vi.fn(),
    onLegalActionBlocked: vi.fn(),
    onPrecheckDeferred: vi.fn(),
    onAuthoritativeInvalidCommand: vi.fn(async () => {}),
    onStoppedAfterOwnershipChanged: vi.fn(),
    onRecoveredLegalAction: vi.fn(),
    ...overrides,
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('OnlineAiLegalActionRecoveryCoordinator', () => {
    it('AI dispatch 被 private overlay 阻塞时不上权威命令，只触发 blocked adapter', async () => {
        vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'missing-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:missing-private-overlay',
            diagnostics: null,
        });
        const hooks = createHooks();
        const coordinator = new OnlineAiLegalActionRecoveryCoordinator({
            emitTrace: vi.fn(),
            hooks,
        });

        const result = await coordinator.tryRecover({
            match: createMatch(),
            candidate: createCandidate(),
            tracker,
            seatControllers,
        });

        expect(result).toMatchObject({
            applied: false,
            outcome: 'blocked',
            blockedReason: 'missing-private-overlay',
        });
        expect(hooks.executeCommand).not.toHaveBeenCalled();
        expect(hooks.onLegalActionBlocked).toHaveBeenCalledWith(expect.objectContaining({
            playerId: '1',
            blockedReason: 'missing-private-overlay',
            shouldTriggerOverlayResync: true,
        }));
    });

    it('AI dispatch 返回合法动作时通过唯一 executeCommand adapter 执行并回写恢复结果', async () => {
        vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'legal-action:1',
                source: 'local-ai',
                action: {
                    actionId: 'legal-end-phase',
                    kind: 'end-phase',
                    label: '结束阶段',
                    commands: [{ type: 'END_PHASE', payload: {} }],
                    metadata: { source: 'test' },
                },
            },
        });
        const hooks = createHooks();
        const coordinator = new OnlineAiLegalActionRecoveryCoordinator({
            emitTrace: vi.fn(),
            hooks,
        });

        const result = await coordinator.tryRecover({
            match: createMatch(),
            candidate: createCandidate(),
            tracker,
            seatControllers,
        });

        expect(hooks.executeCommand).toHaveBeenCalledWith(expect.objectContaining({
            playerId: '1',
            command: { type: 'END_PHASE', payload: {} },
        }));
        expect(hooks.broadcastState).toHaveBeenCalledTimes(1);
        expect(hooks.settleRecoveryResolvedStatus).toHaveBeenCalledWith(expect.objectContaining({
            resolved: true,
        }));
        expect(result).toMatchObject({
            applied: true,
            resolved: true,
            executedCommandTypes: ['END_PHASE'],
            reportedAction: {
                candidateReason: 'active-turn',
                playerId: '1',
                actionKind: 'end-phase',
                actionId: 'legal-end-phase',
                metadata: { source: 'test' },
            },
        });
    });
});
