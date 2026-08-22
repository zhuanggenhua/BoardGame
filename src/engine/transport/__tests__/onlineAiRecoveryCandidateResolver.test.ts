import { describe, expect, it, vi } from 'vitest';
import type { AiDispatchResult, AiLegalAction } from '../../ai';
import type { MatchState } from '../../types';
import type { GameEngineConfig } from '../engineConfig';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import { OnlineAiRecoveryCandidateResolver } from '../onlineAiRecoveryCandidateResolver';
import type { OnlineAiWatchdogSeatController } from '../onlineAiWatchdogSeatControllers';
import type { OnlineAiRecoveryTracker } from '../onlineAiWatchdogTracker';

type TestMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    engineConfig: GameEngineConfig;
};

const seatControllers = {
    '0': { type: 'human' },
    '1': { type: 'local-ai' },
} satisfies Record<string, OnlineAiWatchdogSeatController>;

function createState(overrides: {
    activePlayerId?: string;
    phase?: string;
    sys?: Partial<MatchState<unknown>['sys']>;
} = {}): MatchState<unknown> {
    return {
        core: { activePlayerId: overrides.activePlayerId ?? '0' },
        sys: {
            phase: overrides.phase ?? 'setup',
            turnNumber: 1,
            eventStream: { nextId: 1, entries: [] },
            ...overrides.sys,
        },
    } as MatchState<unknown>;
}

function createEngineConfig(
    overrides: Partial<GameEngineConfig['onlineAiRecovery']> = {},
): GameEngineConfig {
    return {
        gameId: 'resolver-test',
        onlineAiRecovery: {
            shouldProbeHumanTurnLegalActionOnlyCandidate: () => true,
            ...overrides,
        },
    } as GameEngineConfig;
}

function createMatch(overrides: Partial<TestMatch> = {}): TestMatch {
    return {
        matchID: 'match-candidate-resolver',
        gameId: 'resolver-test',
        state: createState(),
        engineConfig: createEngineConfig(),
        ...overrides,
    };
}

function createCandidate(
    overrides: Partial<ForceEndTurnStalledAiResolution> = {},
): ForceEndTurnStalledAiResolution {
    return {
        playerId: '1',
        reason: 'response-window',
        fingerprintHint: 'response-window:1:setup:test:source:1|2:rw-1',
        resolution: {
            playerId: '1',
            attemptKey: 'attempt-response-window',
            source: 'local-ai',
            action: {
                actionId: 'force-response-window',
                kind: 'force-end-turn',
                label: '强制结束 AI 回合',
                commands: [{ type: 'RESPONSE_PASS', payload: {} }],
            },
        },
        ...overrides,
    } as ForceEndTurnStalledAiResolution;
}

function createManualSetupAction(): AiLegalAction {
    return {
        actionId: 'setup-select-faction:elves',
        kind: 'setup-select-faction',
        label: '选择阵营',
        commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'elves' } }],
    };
}

function createResolver(options: {
    privateOverlay?: MatchState<unknown>;
    currentTracker?: OnlineAiRecoveryTracker;
    resolveBaseCandidate?: () => ForceEndTurnStalledAiResolution | null;
    resolveAiDispatch?: () => Promise<AiDispatchResult>;
    buildLegalActions?: () => AiLegalAction[];
} = {}) {
    const hooks = {
        resolvePrivateOverlay: vi.fn((_match: TestMatch) => options.privateOverlay ?? _match.state),
        getCurrentTracker: vi.fn(() => options.currentTracker),
        buildRecoveryFingerprint: vi.fn(() => 'fingerprint-1'),
    };
    const resolver = new OnlineAiRecoveryCandidateResolver<TestMatch>({
        rulesVersion: 'rules-test',
        hooks,
        deps: {
            resolveBaseCandidate: vi.fn(() => options.resolveBaseCandidate?.() ?? null),
            resolveAiDispatch: vi.fn(async () => options.resolveAiDispatch?.() ?? ({
                kind: 'idle',
                idleReason: 'no-action',
            })),
            buildLegalActions: vi.fn(() => options.buildLegalActions?.() ?? []),
            shouldTreatAsManualSetupSelection: vi.fn(() => false),
            getAiRuntime: vi.fn(() => null),
        },
    });

    return { resolver, hooks };
}

describe('OnlineAiRecoveryCandidateResolver', () => {
    it('真人当前回合允许探测时，AI private overlay stale 会形成 seat-legal-only 候选', async () => {
        const match = createMatch();
        const { resolver } = createResolver({
            resolveAiDispatch: async () => ({
                kind: 'blocked',
                playerId: '1',
                visibility: 'private-required',
                blockedReason: 'stale-private-overlay',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: null,
            }),
        });

        const candidate = await resolver.resolveCandidate(match, seatControllers);

        expect(candidate).toMatchObject({
            playerId: '1',
            reason: 'seat-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'seat-legal-only:1:setup:stale-private-overlay:1:private-required:stale-private-overlay',
        });
        expect(candidate?.resolution.action.commands).toEqual([]);
    });

    it('人工 setup 选择只剩人工动作时压制 legal-only watchdog 候选', async () => {
        const match = createMatch({
            engineConfig: createEngineConfig({
                shouldTreatActionAsManualSetupSelection: () => true,
            }),
        });
        const manualSeatControllers = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', manualSetupSelection: true },
        } satisfies Record<string, OnlineAiWatchdogSeatController>;
        const { resolver } = createResolver({
            resolveBaseCandidate: () => createCandidate({
                playerId: '1',
                reason: 'active-turn-legal-only',
                legalActionOnly: true,
            }),
            buildLegalActions: () => [createManualSetupAction()],
        });

        await expect(resolver.resolveCandidate(match, manualSeatControllers)).resolves.toBeNull();
    });

    it('response-window 只有 AI responder 且已有失败 tracker 时升级为 response-loop', async () => {
        const state = createState({
            activePlayerId: '1',
            sys: {
                responseWindow: {
                    current: {
                        id: 'rw-1',
                        windowType: 'test-window',
                        sourceId: 'source-1',
                        responderQueue: ['1', '2'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });
        const match = createMatch({ state });
        const currentTracker = {
            key: '1:response-window:fingerprint-1',
            firstSeenAt: 1_000,
            autoSubmittedAt: 1_500,
            lastReportedFailureReason: null,
            failureCount: 1,
        };
        const { resolver } = createResolver({
            currentTracker,
            resolveBaseCandidate: () => createCandidate({ playerId: '1', reason: 'response-window' }),
        });

        const candidate = await resolver.resolveCandidate(match, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
            '2': { type: 'remote-ai', providerId: 'test-provider' },
        });

        expect(candidate).toMatchObject({
            playerId: '1',
            reason: 'response-loop',
            fingerprintHint: 'response-loop:1:setup:test-window:source-1:1|2:rw-1',
        });
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} },
        ]);
    });

    it('response-window 队列仍含真人 responder 时不得升级 response-loop', async () => {
        const state = createState({
            activePlayerId: '1',
            sys: {
                responseWindow: {
                    current: {
                        id: 'rw-1',
                        windowType: 'test-window',
                        sourceId: 'source-1',
                        responderQueue: ['1', '0'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });
        const match = createMatch({ state });
        const baseCandidate = createCandidate({ playerId: '1', reason: 'response-window' });
        const { resolver } = createResolver({
            currentTracker: {
                key: '1:response-window:fingerprint-1',
                firstSeenAt: 1_000,
                autoSubmittedAt: 1_500,
                lastReportedFailureReason: null,
                failureCount: 1,
            },
            resolveBaseCandidate: () => baseCandidate,
        });

        await expect(resolver.resolveCandidate(match, seatControllers)).resolves.toBe(baseCandidate);
    });
});
