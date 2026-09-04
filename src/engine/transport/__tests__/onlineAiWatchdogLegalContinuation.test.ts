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
} from './helpers/serverTestHarness';

describe('online AI watchdog legal-action continuation', () => {
    it('online AI watchdog 在 active-turn legal-only 第一步后若仍是同一 AI 回合，应继续第二次 legal-action 直到真正交回 human', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-fantasyrealms-double-legal-action-chain', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'draw',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'fantasyrealms' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('fantasyrealms')],
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

        const match = await serverInternal.loadMatch('match-watchdog-fantasyrealms-double-legal-action-chain');
        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:draw:take-discard',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:draw:take-discard',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:draw:take-discard',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行拿公开弃牌',
                    commands: [],
                },
            },
        };
        const followUpCandidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:discard:discard-card',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:discard:discard-card',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:discard:discard-card',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行继续弃牌',
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
        tracker.key = `1:active-turn:${(server as any).buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        )}`;
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        let legalActionAttemptCount = 0;
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch, currentCandidate) => {
            legalActionAttemptCount += 1;
            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);

            if (legalActionAttemptCount === 1) {
                expect(currentCandidate.fingerprintHint).toContain('draw:take-discard');
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'discard',
                        turnNumber: 4,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: ((activeMatch.state.sys?.eventStream as { nextId?: number } | undefined)?.nextId ?? 1) + 1,
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
                    executedCommandTypes: ['TAKE_FROM_DISCARD'],
                    outcome: 'applied',
                    reportedAction: {
                        candidateReason: 'active-turn',
                        playerId: '1',
                        actionKind: 'take-discard',
                        actionId: 'legal-take-discard',
                    },
                };
            }

            expect(currentCandidate.fingerprintHint).toContain('discard:discard-card');
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
                    turnNumber: 5,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: ((activeMatch.state.sys?.eventStream as { nextId?: number } | undefined)?.nextId ?? 1) + 1,
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
                executedCommandTypes: ['DISCARD_CARD'],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'active-turn',
                    playerId: '1',
                    actionKind: 'discard-card',
                    actionId: 'legal-discard-card',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(followUpCandidate)
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
        expect(match.state.core.activePlayerId).toBe('0');
        expect(match.state.sys.phase).toBe('draw');
        expect(match.state.sys.turnNumber).toBe(5);
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain',
            incidentKind: 'force-end-turn-failed',
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain',
            playerId: '1',
            incidentKind: 'legal-action-recovered',
            status: 'resolved',
            reason: 'active-turn:legal-action:discard-card:legal-discard-card',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
        expect(snapshot.blockerFingerprint).toContain('discard');
        expect(snapshot.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
        expect(actionLog.blockerFingerprint).toContain('discard');
        expect(actionLog.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-fantasyrealms-double-legal-action-chain')).toBe(false);
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-seat-legal-only-no-legal-action', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-seat-legal-only-no-action',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'seat-legal-only-followup-no-action',
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-seat-legal-only-no-legal-action');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:defensiveRoll:simple-choice:seat-legal-only-followup-no-action:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-seat-legal-only-no-action',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-seat-legal-only-no-action',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-seat-legal-only-no-action', optionId: 'confirm' } }],
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
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(seatLegalOnlyCandidate)
            .mockResolvedValueOnce(seatLegalOnlyCandidate);

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
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-seat-legal-only-no-legal-action',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: 'seat-legal-only:follow-up-advance:legal_action_unavailable',
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-seat-legal-only-no-legal-action',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-seat-legal-only-no-legal-action',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('seat-legal-only');
        expect(snapshot.blockerFingerprint).toContain('defensiveRoll');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('seat-legal-only');
        expect(actionLog.blockerFingerprint).toContain('defensiveRoll');
        expect(actionLog.trackerKey).toContain('seat-legal-only:seat-legal-only:1:defensiveRoll:advance-phase:legal-advance');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-interaction-seat-legal-only-no-legal-action')).toBe(true);
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且已无合法动作时，不应把失败吞成 null', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-no-legal-action', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-no-action',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-no-action',
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-no-legal-action');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:main2:simple-choice:active-turn-followup-no-action:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-no-action',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-no-action',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-no-action', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn:1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn:1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                    activePlayerId: '1',
                    phase: 'main2',
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
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

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-no-legal-action',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('legal_action_unavailable'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-no-legal-action',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-no-legal-action',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('legal-action-only');
        expect(snapshot.blockerFingerprint).toContain('main2');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('legal-action-only');
        expect(actionLog.blockerFingerprint).toContain('main2');
        expect(actionLog.trackerKey).toContain('active-turn:legal-action-only:1:main2');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且合法动作命令失败时，应上报 legal_action_command_failed', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-command-failed', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-command-failed',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-command-failed',
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
                failedCommandType?: string;
                commandFailureReason?: string | null;
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-command-failed');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:main2:simple-choice:active-turn-followup-command-failed:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-command-failed',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-command-failed',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-command-failed', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn:1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn:1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                    activePlayerId: '1',
                    phase: 'main2',
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'legal-action-command-failed',
                failedCommandType: 'ROLL_DICE',
                commandFailureReason: 'pipeline_error: follow-up roll denied',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
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

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-command-failed',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn:follow-up-advance:legal_action_command_failed:ROLL_DICE:pipeline_error: follow-up roll denied'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-command-failed',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-command-failed',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('legal-action-only');
        expect(snapshot.blockerFingerprint).toContain('main2');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('legal-action-only');
        expect(actionLog.blockerFingerprint).toContain('main2');
        expect(actionLog.trackerKey).toContain('active-turn:legal-action-only:1:main2');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-private-overlay 时，应上报 private_overlay_missing', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-missing-private-overlay', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-missing-private-overlay',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-missing-private-overlay',
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-missing-private-overlay');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:main2:simple-choice:active-turn-followup-missing-private-overlay:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-missing-private-overlay',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-missing-private-overlay',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-missing-private-overlay', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn:1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn:1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                    activePlayerId: '1',
                    phase: 'main2',
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: 'missing-private-overlay',
                executedCommandTypes: [],
                outcome: 'blocked',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
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

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-missing-private-overlay',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn:follow-up-advance:private_overlay_missing'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-missing-private-overlay',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-missing-private-overlay',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('missing-private-overlay');
        expect(snapshot.blockerFingerprint).toContain('main2');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('missing-private-overlay');
        expect(actionLog.blockerFingerprint).toContain('main2');
        expect(actionLog.trackerKey).toContain('active-turn:legal-action-only:1:main2');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 stale-private-overlay 时，应上报 private_overlay_stale', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-stale-private-overlay', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-stale-private-overlay',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-stale-private-overlay',
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-stale-private-overlay');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:main2:simple-choice:active-turn-followup-stale-private-overlay:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-stale-private-overlay',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-stale-private-overlay',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-stale-private-overlay', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn:1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn:1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                    activePlayerId: '1',
                    phase: 'main2',
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: 'stale-private-overlay',
                executedCommandTypes: [],
                outcome: 'blocked',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
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

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-stale-private-overlay',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn:follow-up-advance:private_overlay_stale'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-stale-private-overlay',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-stale-private-overlay',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('stale-private-overlay');
        expect(snapshot.blockerFingerprint).toContain('main2');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('stale-private-overlay');
        expect(actionLog.blockerFingerprint).toContain('main2');
        expect(actionLog.trackerKey).toContain('active-turn:legal-action-only:1:main2');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-visible-state 时，应上报 missing_visible_state', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-missing-visible-state', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-missing-visible-state',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-missing-visible-state',
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-missing-visible-state');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:main2:simple-choice:active-turn-followup-missing-visible-state:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-missing-visible-state',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-missing-visible-state',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-missing-visible-state', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn:1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn:1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                    activePlayerId: '1',
                    phase: 'main2',
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: 'missing-visible-state',
                executedCommandTypes: [],
                outcome: 'blocked',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
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

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-missing-visible-state',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn:follow-up-advance:missing_visible_state'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-missing-visible-state',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-missing-visible-state',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('missing-visible-state');
        expect(snapshot.blockerFingerprint).toContain('main2');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('missing-visible-state');
        expect(actionLog.blockerFingerprint).toContain('main2');
        expect(actionLog.trackerKey).toContain('active-turn:legal-action-only:1:main2');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE 而不是提前报 legal_action_unavailable', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-force-fallback',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-force-fallback',
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
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback');
        expect(match.connections.get('1')?.size ?? 0).toBe(0);
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:playCards:simple-choice:active-turn-followup-force-fallback:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-force-fallback',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-force-fallback',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-force-fallback', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            fingerprintHint: '5|scoreBases|1|0|||||||1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:5|scoreBases|1|0|||||||1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:5|scoreBases|1|0|||||||1',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进主动回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'scoreBases',
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            expect(currentCandidate.allowForceCommandAfterLegalActionExhausted).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
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
                    phase: 'playCards',
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
        expect(match.state.sys.phase).toBe('playCards');
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('legal_action_unavailable'),
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
            reason: 'active-turn:follow-up-advance:steps=1',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('playCards');
        expect(snapshot.blockerFingerprint).toContain('active-turn-followup-force-fallback');
        expect(snapshot.trackerKey).toContain('active-turn:5|scoreBases|1|0');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('playCards');
        expect(actionLog.blockerFingerprint).toContain('active-turn-followup-force-fallback');
        expect(actionLog.trackerKey).toContain('active-turn:5|scoreBases|1|0');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-interaction-active-turn-legal-only-force-fallback')).toBe(false);
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 命令失败时，应上报 legal_action_command_failed', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-command-failed', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-force-fallback-command-failed',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-force-fallback-command-failed',
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
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-command-failed');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:playCards:simple-choice:active-turn-followup-force-fallback-command-failed:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-force-fallback-command-failed',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-force-fallback-command-failed',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-force-fallback-command-failed', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            fingerprintHint: '5|scoreBases|1|0|||||||1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:5|scoreBases|1|0|||||||1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:5|scoreBases|1|0|||||||1',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进主动回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'scoreBases',
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            expect(currentCandidate.allowForceCommandAfterLegalActionExhausted).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
            .mockResolvedValueOnce(activeTurnCandidate);
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ADVANCE_PHASE');
            expect(payload).toEqual({});
            activeMatch.lastCommandFailureReason = 'pipeline_error: forced advance denied';
            return false;
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
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-command-failed',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: 'active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:pipeline_error: forced advance denied',
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-command-failed',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('legal_action_unavailable'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-command-failed',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('scoreBases');
        expect(snapshot.blockerFingerprint).toContain('5|scoreBases|1|0');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('scoreBases');
        expect(actionLog.blockerFingerprint).toContain('5|scoreBases|1|0');
        expect(actionLog.trackerKey).toContain('active-turn:5|scoreBases|1|0');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 被 advance guard 拦住时，应上报 advance_guard_blocked', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-advance-guard-blocked', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-force-fallback-advance-guard-blocked',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-force-fallback-advance-guard-blocked',
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
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-advance-guard-blocked');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:playCards:simple-choice:active-turn-followup-force-fallback-advance-guard-blocked:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-force-fallback-advance-guard-blocked',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-force-fallback-advance-guard-blocked',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-force-fallback-advance-guard-blocked', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            fingerprintHint: '5|scoreBases|1|0|||||||1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:5|scoreBases|1|0|||||||1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:5|scoreBases|1|0|||||||1',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进主动回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'scoreBases',
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        interaction: {
                            current: createSimpleChoice(
                                'advance-guard-followup-interaction',
                                '1',
                                '后续交互仍未收口',
                                [{
                                    id: 'ack',
                                    label: '确认',
                                    value: { kind: 'ack' },
                                }],
                                {
                                    sourceId: 'advance-guard-followup-interaction',
                                    targetType: 'button',
                                },
                            ),
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                };
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            expect(currentCandidate.allowForceCommandAfterLegalActionExhausted).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
            .mockResolvedValueOnce(activeTurnCandidate);
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

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
        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-advance-guard-blocked',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn:follow-up-advance:advance_guard_blocked'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-advance-guard-blocked',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('legal_action_unavailable'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-advance-guard-blocked',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-advance-guard-blocked',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('scoreBases');
        expect(snapshot.blockerFingerprint).toContain('5|scoreBases|1|0');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('scoreBases');
        expect(actionLog.blockerFingerprint).toContain('5|scoreBases|1|0');
        expect(actionLog.trackerKey).toContain('active-turn:5|scoreBases|1|0');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 成功但现场未推进时，应上报 no_progress', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-no-progress', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-force-fallback-no-progress',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-force-fallback-no-progress',
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
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
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

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-no-progress');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:playCards:simple-choice:active-turn-followup-force-fallback-no-progress:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-force-fallback-no-progress',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-force-fallback-no-progress',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-force-fallback-no-progress', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            fingerprintHint: '5|scoreBases|1|0|||||||1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:5|scoreBases|1|0|||||||1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:5|scoreBases|1|0|||||||1',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进主动回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'scoreBases',
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
                            current: undefined,
                        },
                    },
                };
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

            expect(currentCandidate.reason).toBe('active-turn');
            expect(currentCandidate.legalActionOnly).toBe(true);
            expect(currentCandidate.allowForceCommandAfterLegalActionExhausted).toBe(true);
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(activeTurnCandidate)
            .mockResolvedValueOnce(activeTurnCandidate);
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (_activeMatch, playerID, commandType, payload) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ADVANCE_PHASE');
            expect(payload).toEqual({});
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
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-no-progress',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn:follow-up-advance:no_progress'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-no-progress',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('legal_action_unavailable'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-no-progress',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('scoreBases');
        expect(snapshot.blockerFingerprint).toContain('5|scoreBases|1|0');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('scoreBases');
        expect(actionLog.blockerFingerprint).toContain('5|scoreBases|1|0');
        expect(actionLog.trackerKey).toContain('active-turn:5|scoreBases|1|0');
    });
    it('online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 后进入 seat-legal-only 时，应继续 watchdog 收口而不是吞成 no_progress', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-becomes-seat-legal-only', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-active-turn-force-fallback-seat-legal-only',
                        '1',
                        '选择一个要结算的选项',
                        [{
                            id: 'confirm',
                            label: '确认',
                            value: { kind: 'confirm' },
                        }],
                        {
                            sourceId: 'active-turn-followup-force-fallback-seat-legal-only',
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
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-interaction-active-turn-legal-only-force-fallback-becomes-seat-legal-only');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:playCards:simple-choice:active-turn-followup-force-fallback-seat-legal-only:选择一个要结算的选项:::confirm:0:{"kind":"confirm"}',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction-visible-active-turn-force-fallback-seat-legal-only',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction-visible-active-turn-force-fallback-seat-legal-only',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 解除交互阻塞',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'visible-choice-active-turn-force-fallback-seat-legal-only', optionId: 'confirm' } }],
                },
            },
        };
        const activeTurnCandidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            fingerprintHint: '0|defensiveRoll|2|0|||||||1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:0|defensiveRoll|2|0|||||||1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:0|defensiveRoll|2|0|||||||1',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进主动回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
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
                    activePlayerId: '1',
                    currentPlayerIndex: 1,
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

            if (legalActionAttemptCount === 2) {
                expect(currentCandidate.reason).toBe('active-turn');
                expect(currentCandidate.legalActionOnly).toBe(true);
                expect(currentCandidate.allowForceCommandAfterLegalActionExhausted).toBe(true);
                return {
                    applied: false,
                    resolved: false,
                    blockedReason: null,
                    executedCommandTypes: [],
                    outcome: 'no-legal-action',
                };
            }

            expect(currentCandidate.reason).toBe('seat-legal-only');
            activeMatch.state = createOnlineAiRecoveryState({
                activePlayerId: '0',
                currentPlayerIndex: 0,
                phase: 'main2',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 4,
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
            .mockResolvedValueOnce(activeTurnCandidate)
            .mockResolvedValueOnce(seatLegalOnlyCandidate)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ADVANCE_PHASE');
            expect(payload).toEqual({});
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
                eventStreamNextId: 3,
            }).G as any;
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

        expect(tryRecoverSpy).toHaveBeenCalledTimes(3);
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(match.state.sys.phase).toBe('main2');
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-becomes-seat-legal-only',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('no_progress'),
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-becomes-seat-legal-only',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-interaction-active-turn-legal-only-force-fallback-becomes-seat-legal-only',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
            reason: 'active-turn:follow-up-advance:steps=1',
        }));
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-interaction-active-turn-legal-only-force-fallback-becomes-seat-legal-only')).toBe(false);
    });
});
