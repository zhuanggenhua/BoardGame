import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { buildAiProgressMarker } from '../onlineAiRecovery';
import * as aiModule from '../../ai';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
} from './helpers/serverTestHarness';

describe('online AI watchdog Fantasy Realms continuation', () => {
    it('online AI watchdog 在 Fantasy Realms 深分支先后两次遭遇 stale-private-overlay 时，也应通过 emergency playerView 连续两次 legal-action 收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-fantasyrealms-double-legal-action-chain-stale-overlay', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'draw',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 401,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'fantasyrealms' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'draw',
                    privatePhase: 'draw',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-take-discard-emergency',
                        kind: 'take-discard',
                        label: '服务端代 AI 执行拿公开弃牌',
                        commands: [{ type: 'TAKE_FROM_DISCARD', payload: { cardId: 'weather-air-elemental' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-take-discard',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'discard',
                    privatePhase: 'discard',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-discard-card-emergency',
                        kind: 'discard-card',
                        label: '服务端代 AI 执行继续弃牌',
                        commands: [{ type: 'DISCARD_CARD', payload: { cardId: 'wizard-rainstorm' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-discard-card',
                    source: 'local-ai',
                },
            });

        try {
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
                resolveOnlineAiRecoveryCandidate: (
                    match: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<any>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-fantasyrealms-double-legal-action-chain-stale-overlay');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
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
            const primeTracker = (activeCandidate: typeof candidate) => {
                const tracker = {
                    key: '',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                tracker.key = `1:active-turn:${(server as any).buildOnlineAiRecoveryFingerprint(
                    match,
                    activeCandidate,
                    buildAiProgressMarker(match.state),
                )}`;
                (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);
                return tracker;
            };

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');

                if (commandType === 'TAKE_FROM_DISCARD') {
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
                    return true;
                }

                if (commandType === 'DISCARD_CARD') {
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
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
                .mockResolvedValue(null);
            const seatControllers = {
                '0': { type: 'human' as const },
                '1': { type: 'local-ai' as const },
            };

            const drawTracker = primeTracker(candidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                drawTracker,
                candidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('discard');
            expect(match.state.sys.turnNumber).toBe(4);

            const discardTracker = primeTracker(followUpCandidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                discardTracker,
                followUpCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(resolutionSpy).toHaveBeenCalled();
            expect(resolveCandidateSpy).toHaveBeenCalled();
            expect(executed.map((item) => item.commandType)).toEqual([
                'TAKE_FROM_DISCARD',
                'DISCARD_CARD',
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.sys.turnNumber).toBe(5);
            expect(broadcastSpy).toHaveBeenCalledTimes(2);
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-stale-overlay',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('blocker_persisted'),
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(1, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-stale-overlay',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:take-discard:legal-take-discard-emergency',
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(2, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-stale-overlay',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:discard-card:legal-discard-card-emergency',
            }));
            const payload = feedbackReporter.mock.calls[1]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
            expect(snapshot.blockerFingerprint).toContain('discard');
            expect(snapshot.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
            expect(actionLog.blockerFingerprint).toContain('discard');
            expect(actionLog.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');
            expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-fantasyrealms-double-legal-action-chain-stale-overlay')).toBe(false);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 Fantasy Realms 深分支先后两次遭遇 missing-private-overlay 时，也应通过 emergency playerView 连续两次 legal-action 收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-fantasyrealms-double-legal-action-chain-missing-overlay', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'draw',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 411,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'fantasyrealms' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'draw',
                    privatePhase: 'draw',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-take-discard-emergency-missing',
                        kind: 'take-discard',
                        label: '服务端代 AI 执行拿公开弃牌',
                        commands: [{ type: 'TAKE_FROM_DISCARD', payload: { cardId: 'weather-air-elemental' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-take-discard-missing',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'discard',
                    privatePhase: 'discard',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-discard-card-emergency-missing',
                        kind: 'discard-card',
                        label: '服务端代 AI 执行继续弃牌',
                        commands: [{ type: 'DISCARD_CARD', payload: { cardId: 'wizard-rainstorm' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-discard-card-missing',
                    source: 'local-ai',
                },
            });

        try {
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
                resolveOnlineAiRecoveryCandidate: (
                    match: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<any>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-fantasyrealms-double-legal-action-chain-missing-overlay');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
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
            const primeTracker = (activeCandidate: typeof candidate) => {
                const tracker = {
                    key: '',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                tracker.key = `1:active-turn:${(server as any).buildOnlineAiRecoveryFingerprint(
                    match,
                    activeCandidate,
                    buildAiProgressMarker(match.state),
                )}`;
                (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);
                return tracker;
            };

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');

                if (commandType === 'TAKE_FROM_DISCARD') {
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
                    return true;
                }

                if (commandType === 'DISCARD_CARD') {
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
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
                .mockResolvedValue(null);
            const seatControllers = {
                '0': { type: 'human' as const },
                '1': { type: 'local-ai' as const },
            };

            const drawTracker = primeTracker(candidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                drawTracker,
                candidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('discard');
            expect(match.state.sys.turnNumber).toBe(4);

            const discardTracker = primeTracker(followUpCandidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                discardTracker,
                followUpCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(resolutionSpy).toHaveBeenCalledTimes(4);
            expect(resolveCandidateSpy).toHaveBeenCalled();
            expect(executed.map((item) => item.commandType)).toEqual([
                'TAKE_FROM_DISCARD',
                'DISCARD_CARD',
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.sys.turnNumber).toBe(5);
            expect(broadcastSpy).toHaveBeenCalledTimes(2);
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-missing-overlay',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('blocker_persisted'),
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(1, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-missing-overlay',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:take-discard:legal-take-discard-emergency-missing',
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(2, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-missing-overlay',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:discard-card:legal-discard-card-emergency-missing',
            }));
            const payload = feedbackReporter.mock.calls[1]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
            expect(snapshot.blockerFingerprint).toContain('discard');
            expect(snapshot.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
            expect(actionLog.blockerFingerprint).toContain('discard');
            expect(actionLog.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');
            expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-fantasyrealms-double-legal-action-chain-missing-overlay')).toBe(false);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 Fantasy Realms 深分支先后遭遇 stale-private-overlay 与 missing-private-overlay 时，也应继续沿新 blocker 收口而不是误落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'draw',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 421,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'fantasyrealms' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'draw',
                    privatePhase: 'draw',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-take-discard-emergency-mixed',
                        kind: 'take-discard',
                        label: '服务端代 AI 执行拿公开弃牌',
                        commands: [{ type: 'TAKE_FROM_DISCARD', payload: { cardId: 'weather-air-elemental' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-take-discard-mixed',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'discard',
                    privatePhase: 'discard',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-discard-card-emergency-mixed',
                        kind: 'discard-card',
                        label: '服务端代 AI 执行继续弃牌',
                        commands: [{ type: 'DISCARD_CARD', payload: { cardId: 'wizard-rainstorm' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-discard-card-mixed',
                    source: 'local-ai',
                },
            });

        try {
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
                resolveOnlineAiRecoveryCandidate: (
                    match: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<any>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
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
            const primeTracker = (activeCandidate: typeof candidate) => {
                const tracker = {
                    key: '',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                tracker.key = `1:active-turn:${(server as any).buildOnlineAiRecoveryFingerprint(
                    match,
                    activeCandidate,
                    buildAiProgressMarker(match.state),
                )}`;
                (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);
                return tracker;
            };

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');

                if (commandType === 'TAKE_FROM_DISCARD') {
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
                    return true;
                }

                if (commandType === 'DISCARD_CARD') {
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
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
                .mockResolvedValue(null);
            const seatControllers = {
                '0': { type: 'human' as const },
                '1': { type: 'local-ai' as const },
            };

            const drawTracker = primeTracker(candidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                drawTracker,
                candidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('discard');
            expect(match.state.sys.turnNumber).toBe(4);

            const discardTracker = primeTracker(followUpCandidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                discardTracker,
                followUpCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(resolutionSpy).toHaveBeenCalledTimes(4);
            expect(resolveCandidateSpy).toHaveBeenCalled();
            expect(executed.map((item) => item.commandType)).toEqual([
                'TAKE_FROM_DISCARD',
                'DISCARD_CARD',
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.sys.turnNumber).toBe(5);
            expect(broadcastSpy).toHaveBeenCalledTimes(2);
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('blocker_persisted'),
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(1, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:take-discard:legal-take-discard-emergency-mixed',
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(2, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:discard-card:legal-discard-card-emergency-mixed',
            }));
            const payload = feedbackReporter.mock.calls[1]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
            expect(snapshot.blockerFingerprint).toContain('discard');
            expect(snapshot.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
            expect(actionLog.blockerFingerprint).toContain('discard');
            expect(actionLog.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');
            expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay')).toBe(false);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 Fantasy Realms 深分支先后遭遇 missing-private-overlay 与 stale-private-overlay 时，也应继续沿新 blocker 收口而不是误落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay-reverse', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'draw',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 431,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'fantasyrealms' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'draw',
                    privatePhase: 'draw',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-take-discard-emergency-mixed-reverse',
                        kind: 'take-discard',
                        label: '服务端代 AI 执行拿公开弃牌',
                        commands: [{ type: 'TAKE_FROM_DISCARD', payload: { cardId: 'weather-air-elemental' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-take-discard-mixed-reverse',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'discard',
                    privatePhase: 'discard',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-discard-card-emergency-mixed-reverse',
                        kind: 'discard-card',
                        label: '服务端代 AI 执行继续弃牌',
                        commands: [{ type: 'DISCARD_CARD', payload: { cardId: 'wizard-rainstorm' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-discard-card-mixed-reverse',
                    source: 'local-ai',
                },
            });

        try {
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
                resolveOnlineAiRecoveryCandidate: (
                    match: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<any>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay-reverse');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
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
            const primeTracker = (activeCandidate: typeof candidate) => {
                const tracker = {
                    key: '',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                tracker.key = `1:active-turn:${(server as any).buildOnlineAiRecoveryFingerprint(
                    match,
                    activeCandidate,
                    buildAiProgressMarker(match.state),
                )}`;
                (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);
                return tracker;
            };

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');

                if (commandType === 'TAKE_FROM_DISCARD') {
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
                    return true;
                }

                if (commandType === 'DISCARD_CARD') {
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
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
                .mockResolvedValue(null);
            const seatControllers = {
                '0': { type: 'human' as const },
                '1': { type: 'local-ai' as const },
            };

            const drawTracker = primeTracker(candidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                drawTracker,
                candidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('discard');
            expect(match.state.sys.turnNumber).toBe(4);

            const discardTracker = primeTracker(followUpCandidate);
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                discardTracker,
                followUpCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(resolutionSpy).toHaveBeenCalledTimes(4);
            expect(resolveCandidateSpy).toHaveBeenCalled();
            expect(executed.map((item) => item.commandType)).toEqual([
                'TAKE_FROM_DISCARD',
                'DISCARD_CARD',
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.sys.turnNumber).toBe(5);
            expect(broadcastSpy).toHaveBeenCalledTimes(2);
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay-reverse',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('blocker_persisted'),
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(1, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay-reverse',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:take-discard:legal-take-discard-emergency-mixed-reverse',
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(2, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay-reverse',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:discard-card:legal-discard-card-emergency-mixed-reverse',
            }));
            const payload = feedbackReporter.mock.calls[1]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
            expect(snapshot.blockerFingerprint).toContain('discard');
            expect(snapshot.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
            expect(actionLog.blockerFingerprint).toContain('discard');
            expect(actionLog.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');
            expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-fantasyrealms-double-legal-action-chain-mixed-overlay-reverse')).toBe(false);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 Fantasy Realms 同一 match 的下一次 AI 回合再入深分支时，不应被上一轮 tracker 残留污染', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-fantasyrealms-double-legal-action-chain-across-turns', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'draw',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 441,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'fantasyrealms' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'draw',
                    privatePhase: 'draw',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-take-discard-emergency-turn4',
                        kind: 'take-discard',
                        label: '服务端代 AI 执行拿公开弃牌',
                        commands: [{ type: 'TAKE_FROM_DISCARD', payload: { cardId: 'weather-air-elemental' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-take-discard-turn4',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'discard',
                    privatePhase: 'discard',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-discard-card-emergency-turn4',
                        kind: 'discard-card',
                        label: '服务端代 AI 执行继续弃牌',
                        commands: [{ type: 'DISCARD_CARD', payload: { cardId: 'wizard-rainstorm' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-discard-card-turn4',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'draw',
                    privatePhase: 'draw',
                    sharedTurnNumber: 6,
                    privateTurnNumber: 6,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-take-discard-emergency-turn6',
                        kind: 'take-discard',
                        label: '服务端代 AI 执行拿公开弃牌',
                        commands: [{ type: 'TAKE_FROM_DISCARD', payload: { cardId: 'flood-island' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-take-discard-turn6',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'discard',
                    privatePhase: 'discard',
                    sharedTurnNumber: 6,
                    privateTurnNumber: 6,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-discard-card-emergency-turn6',
                        kind: 'discard-card',
                        label: '服务端代 AI 执行继续弃牌',
                        commands: [{ type: 'DISCARD_CARD', payload: { cardId: 'land-forest' } }],
                    },
                    attemptKey: 'watchdog-fantasyrealms-emergency-discard-card-turn6',
                    source: 'local-ai',
                },
            });

        try {
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
                resolveOnlineAiRecoveryCandidate: (
                    match: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<any>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-fantasyrealms-double-legal-action-chain-across-turns');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const drawCandidate = {
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
            const discardCandidate = {
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
            const primeTracker = (activeCandidate: typeof drawCandidate) => {
                const tracker = {
                    key: '',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                tracker.key = `1:active-turn:${(server as any).buildOnlineAiRecoveryFingerprint(
                    match,
                    activeCandidate,
                    buildAiProgressMarker(match.state),
                )}`;
                (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);
                return tracker;
            };
            const seatControllers = {
                '0': { type: 'human' as const },
                '1': { type: 'local-ai' as const },
            };

            let takeCount = 0;
            let discardCount = 0;
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
                expect(playerID).toBe('1');

                if (commandType === 'TAKE_FROM_DISCARD') {
                    takeCount += 1;
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
                            turnNumber: takeCount === 1 ? 4 : 6,
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
                    return true;
                }

                if (commandType === 'DISCARD_CARD') {
                    discardCount += 1;
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
                            turnNumber: discardCount === 1 ? 5 : 7,
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
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
                .mockResolvedValue(null);

            await serverInternal.runOnlineAiRecoverySequence(
                match,
                primeTracker(drawCandidate),
                drawCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('discard');
            expect(match.state.sys.turnNumber).toBe(4);

            await serverInternal.runOnlineAiRecoverySequence(
                match,
                primeTracker(discardCandidate),
                discardCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.sys.turnNumber).toBe(5);
            expect((server as any).onlineAiRecoveryLedger.hasTracker(match.matchID)).toBe(false);

            match.state = {
                ...match.state,
                core: {
                    ...match.state.core,
                    activePlayerId: '1',
                    currentPlayerIndex: 1,
                },
                sys: {
                    ...match.state.sys,
                    phase: 'draw',
                    turnNumber: 6,
                    eventStream: {
                        ...(match.state.sys?.eventStream ?? {}),
                        nextId: ((match.state.sys?.eventStream as { nextId?: number } | undefined)?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        ...(match.state.sys?.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };

            expect((server as any).onlineAiRecoveryLedger.hasTracker(match.matchID)).toBe(false);

            await serverInternal.runOnlineAiRecoverySequence(
                match,
                primeTracker(drawCandidate),
                drawCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('discard');
            expect(match.state.sys.turnNumber).toBe(6);

            await serverInternal.runOnlineAiRecoverySequence(
                match,
                primeTracker(discardCandidate),
                discardCandidate,
                buildAiProgressMarker(match.state),
                seatControllers,
            );

            expect(resolutionSpy).toHaveBeenCalledTimes(8);
            expect(resolveCandidateSpy).toHaveBeenCalled();
            expect(takeCount).toBe(2);
            expect(discardCount).toBe(2);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.sys.turnNumber).toBe(7);
            expect(broadcastSpy).toHaveBeenCalledTimes(4);
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-across-turns',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('blocker_persisted'),
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(1, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-across-turns',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:take-discard:legal-take-discard-emergency-turn4',
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(2, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-across-turns',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:discard-card:legal-discard-card-emergency-turn4',
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(3, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-across-turns',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:take-discard:legal-take-discard-emergency-turn6',
            }));
            expect(feedbackReporter).toHaveBeenNthCalledWith(4, expect.objectContaining({
                matchId: 'match-watchdog-fantasyrealms-double-legal-action-chain-across-turns',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'active-turn:legal-action:discard-card:legal-discard-card-emergency-turn6',
            }));
            const payload = feedbackReporter.mock.calls[3]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
            expect(snapshot.blockerFingerprint).toContain('discard');
            expect(snapshot.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
            expect(actionLog.blockerFingerprint).toContain('discard');
            expect(actionLog.trackerKey).toContain('active-turn-legal-only:1:discard:discard-card');
            expect((server as any).onlineAiRecoveryLedger.hasTracker(match.matchID)).toBe(false);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
});
