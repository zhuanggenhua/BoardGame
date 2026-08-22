import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import {
    buildAiProgressMarker,
    type ForceEndTurnStalledAiResolution,
    type OnlineAiRecoveryEngineConfig,
} from '../onlineAiRecovery';
import { OnlineAiCircuitBreaker } from '../onlineAiCircuitBreaker';
import {
    OnlineAiRecoveryController,
    type OnlineAiRecoveryControllerHooks,
    type OnlineAiRecoveryControllerMatch,
    type OnlineAiRecoveryControllerSeat,
} from '../onlineAiRecoveryController';
import { OnlineAiRecoveryRuntimeLedger } from '../onlineAiRecoveryRuntimeLedger';
import type { OnlineAiRecoveryTracker } from '../onlineAiWatchdogTracker';

type TestMatch = OnlineAiRecoveryControllerMatch;
type TestSeat = OnlineAiRecoveryControllerSeat;

function createState(): MatchState<unknown> {
    return {
        core: {},
        sys: {
            phase: 'main',
            turnNumber: 1,
            eventStream: { nextId: 1, entries: [] },
        },
    } as MatchState<unknown>;
}

function createMatch(overrides: Partial<TestMatch> = {}): TestMatch {
    return {
        matchID: 'match-controller',
        gameId: 'controller-test',
        state: createState(),
        stateID: 1,
        engineConfig: { gameId: 'controller-test' } as OnlineAiRecoveryEngineConfig,
        ...overrides,
    };
}

function createCandidate(overrides: Partial<ForceEndTurnStalledAiResolution> = {}): ForceEndTurnStalledAiResolution {
    return {
        playerId: '1',
        reason: 'active-turn',
        requiresConfirmedAdvancePhase: false,
        resolution: {
            playerId: '1',
            attemptKey: 'attempt-1',
            source: 'local-ai',
            action: {
                actionId: 'force-end-turn:1',
                kind: 'force-end-turn',
                label: 'force',
                commands: [],
            },
        },
        ...overrides,
    } as ForceEndTurnStalledAiResolution;
}

function createTracker(key: string): OnlineAiRecoveryTracker {
    return {
        key,
        firstSeenAt: 1_000,
        autoSubmittedAt: null,
        lastReportedFailureReason: null,
        failureCount: 0,
    };
}

function createHarness(options?: {
    matches?: TestMatch[];
    seatControllers?: Record<string, TestSeat>;
    candidate?: ForceEndTurnStalledAiResolution | null;
    repeatedAttemptLimit?: number;
    recoveryTimeoutMs?: number;
}) {
    const ledger = new OnlineAiRecoveryRuntimeLedger();
    const circuitBreaker = new OnlineAiCircuitBreaker({ now: () => 1_000 });
    const match = options?.matches?.[0] ?? createMatch();
    const candidate = options?.candidate === undefined ? createCandidate() : options.candidate;
    const hooks: OnlineAiRecoveryControllerHooks<TestMatch, TestSeat> = {
        getMatches: () => options?.matches ?? [match],
        pruneExpiredFeedbackCooldowns: vi.fn(),
        buildSeatControllers: vi.fn(() => options?.seatControllers ?? {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        }),
        resolveCandidate: vi.fn(async () => candidate),
        buildRecoveryFingerprint: vi.fn(() => 'fingerprint-1'),
        resolveRecoveryTimeoutMs: vi.fn(() => options?.recoveryTimeoutMs ?? 0),
        tryForceUnblockRepeatedRecovery: vi.fn(async () => ({ handled: false, suppressionReason: 'no_safe_force_unblock' })),
        reportRepeatedRecoverySuppressed: vi.fn(async () => undefined),
        runRecoverySequence: vi.fn(async () => undefined),
    };
    const controller = new OnlineAiRecoveryController({
        ledger,
        circuitBreaker,
        repeatedAttemptLimit: options?.repeatedAttemptLimit ?? 3,
        hooks,
    });

    return { controller, ledger, circuitBreaker, hooks, match, candidate };
}

describe('OnlineAiRecoveryController', () => {
    it('没有 AI 座位时清理恢复进度和 circuit 状态', async () => {
        const { controller, ledger, circuitBreaker, match, hooks } = createHarness({
            seatControllers: { '0': { type: 'human' } },
        });
        ledger.setTracker(match.matchID, createTracker('stale-tracker'));
        circuitBreaker.recordFailure({
            matchId: match.matchID,
            playerId: '1',
            failure: {
                commandType: 'TEST',
                reason: 'stale_state',
                stateID: 1,
                source: 'watchdog',
            },
        });

        await controller.runTick(2_000);

        expect(ledger.hasTracker(match.matchID)).toBe(false);
        expect(circuitBreaker.getSnapshot(match.matchID, '1').failureCount).toBe(0);
        expect(hooks.runRecoverySequence).not.toHaveBeenCalled();
    });

    it('候选达到恢复时机时启动 recovery sequence，并在完成后释放 in-flight', async () => {
        const { controller, ledger, hooks, match, candidate } = createHarness();

        await expect(controller.runTick(2_000)).resolves.toEqual({ launchedRecoveries: 1 });
        expect(hooks.runRecoverySequence).toHaveBeenCalledWith({
            match,
            tracker: expect.objectContaining({
                key: '1:active-turn:fingerprint-1',
                autoSubmittedAt: 2_000,
            }),
            candidate,
            progressMarker: buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            }),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        });

        await Promise.resolve();
        expect(ledger.isInFlight(match.matchID)).toBe(false);
    });

    it('active-turn 刚触发过 overlay resync 时跳过调度且不创建 tracker', async () => {
        const match = createMatch();
        const progressMarker = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const { controller, ledger, hooks } = createHarness({ matches: [match] });
        ledger.markOverlayResyncRequested({
            matchId: match.matchID,
            playerId: '1',
            blockedKey: 'blocked-key-1',
            progressMarker,
            now: 1_500,
        });

        await expect(controller.runTick(2_000)).resolves.toEqual({ launchedRecoveries: 0 });

        expect(ledger.hasTracker(match.matchID)).toBe(false);
        expect(hooks.runRecoverySequence).not.toHaveBeenCalled();
    });

    it('重复恢复达到上限时先尝试 safe unblock，失败后上报 suppressed', async () => {
        const candidate = createCandidate({ reason: 'visible-interaction' });
        const { controller, ledger, hooks, match } = createHarness({ candidate });
        const trackerKey = '1:visible-interaction:fingerprint-1';
        ledger.recordRepeatedAttempt(match.matchID, trackerKey, 1_000);
        ledger.recordRepeatedAttempt(match.matchID, trackerKey, 1_100);
        ledger.recordRepeatedAttempt(match.matchID, trackerKey, 1_200);

        await expect(controller.runTick(2_000)).resolves.toEqual({ launchedRecoveries: 0 });

        expect(hooks.tryForceUnblockRepeatedRecovery).toHaveBeenCalledWith(expect.objectContaining({
            match,
            candidate,
            trackerKey,
            repeatedAttemptKey: `${match.matchID}:${trackerKey}`,
            repeatedAttempt: expect.objectContaining({ count: 3 }),
        }));
        expect(hooks.reportRepeatedRecoverySuppressed).toHaveBeenCalledWith(expect.objectContaining({
            match,
            candidate,
            trackerKey,
            repeatedAttempt: expect.objectContaining({ count: 3 }),
            suppressionReason: 'no_safe_force_unblock',
        }));
        expect(hooks.runRecoverySequence).not.toHaveBeenCalled();
    });
});
