import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { buildAiProgressMarker } from '../onlineAiRecovery';
import { createSimpleChoice, INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    nextTick,
} from './helpers/serverTestHarness';

describe('online AI watchdog legal-only incident transitions', () => {
    it('online AI watchdog 在 legal-only 恢复前若现场切到 human afterRollConfirmed，应丢弃旧 candidate 而不是继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-stale-legal-only-becomes-human-response', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-stale-legal-only-becomes-human-response');
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: {
                            id: 'rw-after-roll-human-late-1',
                            sourceId: 'attack-roll-1',
                            windowType: 'afterRollConfirmed',
                            responderQueue: ['0'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 6; i++) { await nextTick(); }

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(match.state.sys.responseWindow.current).toMatchObject({
            id: 'rw-after-roll-human-late-1',
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
            currentResponderIndex: 0,
        });
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-stale-legal-only-becomes-human-response')).toBe(false);
    });
    it('online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 visible incident 时，不应把旧 tracker 落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-legal-only-becomes-visible-incident', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-only-becomes-visible-incident');
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:offensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:offensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:offensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const visibleCandidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint: 'interaction:1:main1:simple-choice:follow-up-visible:选择后续目标:1::choose-visible:0:{"targetId":"visible-target"}',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:main1:simple-choice:follow-up-visible:选择后续目标:1::choose-visible:0:{"targetId":"visible-target"}',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:main1:simple-choice:follow-up-visible:选择后续目标:1::choose-visible:0:{"targetId":"visible-target"}',
                    kind: 'respond',
                    label: '服务端代 AI 交互响应',
                    commands: [],
                },
            },
        };
        const tracker = {
            key: '1:active-turn-legal-only:active-turn-legal-only:1:offensiveRoll',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'main1',
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: createSimpleChoice(
                            'follow-up-visible-1',
                            '1',
                            '选择后续目标',
                            [
                                { id: 'choose-visible', label: '后续目标', value: { targetId: 'visible-target' } },
                            ],
                            { sourceId: 'follow-up-visible' },
                        ),
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };
            (server as any).onlineAiRecoveryLedger.clearTracker(activeMatch.matchID);
            tracker.autoSubmittedAt = null;
            return {
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['ROLL_DICE'],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'active-turn-legal-only',
                    playerId: '1',
                    actionKind: 'roll-dice',
                    actionId: 'legal-roll',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(visibleCandidate)
            .mockResolvedValueOnce(visibleCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(match.state.sys.phase).toBe('main1');
        expect(match.state.sys.interaction.current).toMatchObject({
            id: 'follow-up-visible-1',
            playerId: '1',
        });
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-legal-only-becomes-visible-incident')).toBe(false);
    });
    it('online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 hidden incident 时，不应把旧 tracker 落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-legal-only-becomes-hidden-incident', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-only-becomes-hidden-incident');
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:offensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:offensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:offensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const hiddenCandidate = {
            playerId: '1',
            reason: 'hidden-interaction',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint: 'interaction:1:main1:simple-choice:follow-up-hidden:选择秘密目标:1::choose-hidden:0:{"targetId":"hidden-target"}',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:main1:simple-choice:follow-up-hidden:选择秘密目标:1::choose-hidden:0:{"targetId":"hidden-target"}',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:main1:simple-choice:follow-up-hidden:选择秘密目标:1::choose-hidden:0:{"targetId":"hidden-target"}',
                    kind: 'respond',
                    label: '服务端代 AI 私有交互响应',
                    commands: [],
                },
            },
        };
        const tracker = {
            key: '1:active-turn-legal-only:active-turn-legal-only:1:offensiveRoll',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'main1',
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: createSimpleChoice(
                            'follow-up-hidden-1',
                            '1',
                            '选择秘密目标',
                            [
                                { id: 'choose-hidden', label: '秘密目标', value: { targetId: 'hidden-target' } },
                            ],
                            { sourceId: 'follow-up-hidden', targetType: 'hand' },
                        ),
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };
            (server as any).onlineAiRecoveryLedger.clearTracker(activeMatch.matchID);
            tracker.autoSubmittedAt = null;
            return {
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['ROLL_DICE'],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'active-turn-legal-only',
                    playerId: '1',
                    actionKind: 'roll-dice',
                    actionId: 'legal-roll',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(hiddenCandidate)
            .mockResolvedValueOnce(hiddenCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(match.state.sys.phase).toBe('main1');
        expect(match.state.sys.interaction.current).toMatchObject({
            id: 'follow-up-hidden-1',
            playerId: '1',
        });
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-legal-only-becomes-hidden-incident')).toBe(false);
    });
    it('online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 response-window incident 时，不应把旧 tracker 落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-legal-only-becomes-response-window-incident', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-only-becomes-response-window-incident');
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:offensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:offensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:offensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const responseWindowCandidate = {
            playerId: '1',
            reason: 'response-window',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint: 'response-window:1:defensiveRoll:afterRollConfirmed:follow-up-attack-1:1:follow-up-response-window-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:response-window:1:defensiveRoll:afterRollConfirmed:follow-up-attack-1:1:follow-up-response-window-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:response-window:1:defensiveRoll:afterRollConfirmed:follow-up-attack-1:1:follow-up-response-window-1',
                    kind: 'respond',
                    label: '服务端代 AI 响应窗口处理',
                    commands: [],
                },
            },
        };
        const tracker = {
            key: '1:active-turn-legal-only:active-turn-legal-only:1:offensiveRoll',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'defensiveRoll',
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: {
                            id: 'follow-up-response-window-1',
                            sourceId: 'follow-up-attack-1',
                            windowType: 'afterRollConfirmed',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            };
            (server as any).onlineAiRecoveryLedger.clearTracker(activeMatch.matchID);
            tracker.autoSubmittedAt = null;
            return {
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['ROLL_DICE'],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'active-turn-legal-only',
                    playerId: '1',
                    actionKind: 'roll-dice',
                    actionId: 'legal-roll',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(responseWindowCandidate)
            .mockResolvedValueOnce(responseWindowCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(match.state.sys.phase).toBe('defensiveRoll');
        expect(match.state.sys.responseWindow.current).toMatchObject({
            id: 'follow-up-response-window-1',
            sourceId: 'follow-up-attack-1',
            responderQueue: ['1'],
            currentResponderIndex: 0,
        });
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-legal-only-becomes-response-window-incident')).toBe(false);
    });
    it('online AI 唯一服务端执行器在 legal-only 合法动作切到同一 AI 的新 active-turn 时，不依赖 seat 在线继续收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-legal-only-becomes-active-turn-online', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-only-becomes-active-turn-online');
        match.connections.set('1', new Set(['socket-ai-live']));
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:offensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:offensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:offensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            fingerprintHint: '5|main1|1|0|||||||0',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:5|main1|1|0|||||||0',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:5|main1|1|0|||||||0',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进主动回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: '1:active-turn-legal-only:active-turn-legal-only:1:offensiveRoll',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '1',
                    currentPlayerIndex: 1,
                },
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'main1',
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };
            return {
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['ROLL_DICE'],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'active-turn-legal-only',
                    playerId: '1',
                    actionKind: 'roll-dice',
                    actionId: 'legal-roll',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(activeTurnCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(match.state.sys.phase).toBe('main1');
        expect(match.connections.get('1')?.size ?? 0).toBe(1);
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-legal-only-becomes-active-turn-online',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-legal-only-becomes-active-turn-online')).toBe(false);
    });
    it('online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 离线时，应继续 watchdog 收口而不是误交给自然链路', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-legal-only-becomes-active-turn-offline', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-only-becomes-active-turn-offline');
        expect(match.connections.get('1')?.size ?? 0).toBe(0);
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:offensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:offensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:offensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            fingerprintHint: '4|main1|2|0|||||||1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:4|main1|2|0|||||||1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:4|main1|2|0|||||||1',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进主动回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: '1:active-turn-legal-only:active-turn-legal-only:1:offensiveRoll',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        let legalActionAttemptCount = 0;
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch, currentCandidate) => {
            legalActionAttemptCount += 1;
            if (legalActionAttemptCount === 1) {
                expect(currentCandidate.reason).toBe('active-turn-legal-only');
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: true,
                    blockedReason: null,
                    executedCommandTypes: ['ROLL_DICE'],
                    outcome: 'applied',
                    reportedAction: {
                        candidateReason: 'active-turn-legal-only',
                        playerId: '1',
                        actionKind: 'roll-dice',
                        actionId: 'legal-roll',
                    },
                };
            }

            expect(currentCandidate.reason).toBe('active-turn');
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(activeTurnCandidate)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ADVANCE_PHASE');
            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '0',
                    currentPlayerIndex: 0,
                },
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'draw',
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                },
            };
            return true;
        });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(match.state.core.activePlayerId).toBe('0');
        expect(match.state.sys.phase).toBe('draw');
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-legal-only-becomes-active-turn-offline',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-legal-only-becomes-active-turn-offline',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
            reason: 'active-turn:follow-up-advance:steps=1',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
        expect(snapshot.blockerFingerprint).toContain('offensiveRoll');
        expect(snapshot.trackerKey).toContain('active-turn-legal-only:1:offensiveRoll');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
        expect(actionLog.blockerFingerprint).toContain('offensiveRoll');
        expect(actionLog.trackerKey).toContain('active-turn-legal-only:1:offensiveRoll');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-legal-only-becomes-active-turn-offline')).toBe(false);
    });
    it('DiceThrone 线上反馈 6a4a157d：offensiveRoll 仅剩 advance-phase 时 watchdog 应继续推进到 main2 并收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-dicethrone-offensive-advance-only', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-offensive-advance-only');
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:offensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:offensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:offensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const tracker = {
            key: '1:active-turn-legal-only:active-turn-legal-only:1:offensiveRoll',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch, currentCandidate) => {
            expect(currentCandidate.reason).toBe('active-turn-legal-only');
            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '1',
                    currentPlayerIndex: 1,
                },
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'main2',
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };
            return {
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['ADVANCE_PHASE'],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'active-turn-legal-only',
                    playerId: '1',
                    actionKind: 'advance-phase',
                    actionId: 'phase:advance:offensiveRoll:main2',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(null);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(1);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(match.state.core.activePlayerId).toBe('1');
        expect(match.state.sys.phase).toBe('main2');
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-dicethrone-offensive-advance-only',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-dicethrone-offensive-advance-only')).toBe(false);
    });
    it('online AI watchdog 在交互合法动作已把现场切到同一 AI 的新 seat-legal-only 时，应继续 watchdog 收口而不是落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-becomes-seat-legal-only', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-seat-legal-only',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'seat-legal-only-followup',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-interaction-becomes-seat-legal-only');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:defensiveRoll:simple-choice:seat-legal-only-followup:选择一个要结算的选项::1',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-seat-legal-only',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-seat-legal-only',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-seat-legal-only', optionId: 'confirm' } }],
                },
            },
        };
        const seatLegalOnlyCandidate = {
            playerId: '1',
            reason: 'seat-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'seat-legal-only:1:defensiveRoll:advance-phase:legal-advance',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:seat-legal-only:1:defensiveRoll:advance-phase:legal-advance',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:seat-legal-only:1:defensiveRoll:advance-phase:legal-advance',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const tracker = {
            key: '',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        tracker.key = `1:visible-interaction:${(server as any).buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        )}`;
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        let legalActionAttemptCount = 0;
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch, currentCandidate) => {
            legalActionAttemptCount += 1;
            if (legalActionAttemptCount === 1) {
                expect(currentCandidate.reason).toBe('visible-interaction');
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '0',
                    phase: 'defensiveRoll',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    eventStreamNextId: 2,
                }).G as any;
                return {
                    applied: true,
                    resolved: true,
                    blockedReason: null,
                    executedCommandTypes: [INTERACTION_COMMANDS.RESPOND],
                    outcome: 'applied',
                    reportedAction: {
                        candidateReason: 'visible-interaction',
                        playerId: '1',
                        actionKind: 'interaction-choice',
                        actionId: 'respond-visible-choice',
                    },
                };
            }

            expect(currentCandidate.reason).toBe('seat-legal-only');
            activeMatch.state = createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 3,
            }).G as any;
            return {
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['ADVANCE_PHASE'],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'seat-legal-only',
                    playerId: '1',
                    actionKind: 'advance-phase',
                    actionId: 'legal-advance',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(seatLegalOnlyCandidate)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(match.state.sys.phase).toBe('main2');
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-becomes-seat-legal-only',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-becomes-seat-legal-only',
            playerId: '1',
            incidentKind: 'legal-action-recovered',
            status: 'resolved',
            reason: 'seat-legal-only:legal-action:advance-phase:legal-advance',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('seat-legal-only');
        expect(snapshot.blockerFingerprint).toContain('defensiveRoll');
        expect(snapshot.trackerKey).toContain('seat-legal-only:1:defensiveRoll:advance-phase:legal-advance');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('seat-legal-only');
        expect(actionLog.blockerFingerprint).toContain('defensiveRoll');
        expect(actionLog.trackerKey).toContain('seat-legal-only:1:defensiveRoll:advance-phase:legal-advance');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-interaction-becomes-seat-legal-only')).toBe(false);
    });
});
