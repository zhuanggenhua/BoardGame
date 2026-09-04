import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { resolveForceEndTurnForStalledAi } from '../onlineAiRecovery';
import { createSimpleChoice, INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import * as aiModule from '../../ai';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfig,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    nextTick,
} from './helpers/serverTestHarness';

describe('online AI watchdog emergency playerView', () => {
    it('online AI watchdog 在 hidden-interaction 遇到 private overlay stale 时，也应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-hidden-interaction-private-overlay-stale-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main1',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'main1',
                    privatePhase: 'main1',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '0',
                    privateCurrentPlayerId: '0',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:hidden-owner-only:skip',
                        kind: 'interaction-choice',
                        label: '跳过隐藏交互',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'hidden-owner-only', optionId: 'skip' },
                        }],
                    },
                    attemptKey: 'watchdog-hidden-interaction-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
                stateSynchronizer: {
                    applyPlayerView: (match: any, playerID: string) => MatchState<unknown>;
                };
            };

            const match = await serverInternal.loadMatch('match-watchdog-hidden-interaction-private-overlay-stale-emergency-view');
            match.lastBroadcastedViews.set('1', {
                sys: {
                    eventStream: { nextId: 999 },
                    interaction: {
                        current: {
                            id: 'hidden-owner-only-stale-cache',
                            kind: 'simple-choice',
                            playerId: '1',
                            data: {
                                sourceId: 'stale-hidden-source',
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            });
            let hiddenStillPresent = true;
            vi.spyOn(serverInternal.stateSynchronizer, 'applyPlayerView').mockImplementation((activeMatch, playerID) => {
                if (playerID !== '1') {
                    return activeMatch.state as MatchState<unknown>;
                }
                return {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: hiddenStillPresent
                            ? {
                                current: createSimpleChoice(
                                    'hidden-owner-only',
                                    '1',
                                    '选择要处理的秘密目标',
                                    [{ id: 'skip', label: '跳过', value: { skip: true } }],
                                    { sourceId: 'super_spies_secret_agent_discard', targetType: 'hand' },
                                ),
                                queue: [],
                                isBlocked: false,
                            }
                            : {
                                current: undefined,
                                queue: [],
                                isBlocked: false,
                            },
                    },
                } as MatchState<unknown>;
            });

            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');
                if (commandType !== INTERACTION_COMMANDS.RESPOND) {
                    throw new Error(`Unexpected command: ${commandType}`);
                }
                hiddenStillPresent = false;
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        interaction: {
                            ...(activeMatch.state.sys?.interaction ?? {}),
                            current: undefined,
                            isBlocked: false,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed).toEqual([{
                commandType: INTERACTION_COMMANDS.RESPOND,
                payload: { interactionId: 'hidden-owner-only', optionId: 'skip' },
            }]);
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-hidden-interaction-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('super_spies_secret_agent_discard');
            expect(snapshot.trackerKey).toContain('hidden-interaction:interaction:1:main1:simple-choice:super_spies_secret_agent_discard');
            expect(snapshot.blockerFingerprint).not.toContain('hidden-owner-only-stale-cache');
            expect(snapshot.trackerKey).not.toContain('hidden-owner-only-stale-cache');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('super_spies_secret_agent_discard');
            expect(actionLog.trackerKey).toContain('hidden-interaction:interaction:1:main1:simple-choice:super_spies_secret_agent_discard');
            expect(actionLog.blockerFingerprint).not.toContain('hidden-owner-only-stale-cache');
            expect(actionLog.trackerKey).not.toContain('hidden-owner-only-stale-cache');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'playCards',
            interaction: {
                current: createSimpleChoice(
                    'smashup-extra-action-choice',
                    '1',
                    '立刻打出一张额外战术，或放弃这次机会',
                    [
                        {
                            id: 'card-0',
                            label: '额外战术 A',
                            value: { cardUid: 'hand-1', defId: 'test_action' },
                        },
                        {
                            id: 'skip',
                            label: '放弃这次额外战术',
                            value: { skip: true },
                        },
                    ],
                    {
                        sourceId: 'smashup_immediate_extra_action',
                        targetType: 'hand',
                    },
                ),
                queue: [],
                isBlocked: false,
            },
        });
        initialState.G.core = {
            ...initialState.G.core,
            players: {
                '0': {
                    id: '0',
                    factionIds: ['robot'],
                    hand: [],
                    deck: [],
                    discard: [],
                    vp: 0,
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
                '1': {
                    id: '1',
                    factionIds: ['wizard'],
                    hand: [],
                    deck: [],
                    discard: [],
                    vp: 0,
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
            },
            bases: [],
        };

        await storage.createMatch('match-watchdog-smashup-extra-action-skip-turn', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });
        const originalResolveNextAiDispatch = aiModule.resolveNextAiDispatch;
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        let dispatchAttempt = 0;
        resolutionSpy.mockImplementation(async (...args) => {
            dispatchAttempt += 1;
            if (dispatchAttempt === 1) {
                return originalResolveNextAiDispatch(...args as Parameters<typeof aiModule.resolveNextAiDispatch>);
            }
            return {
                kind: 'idle',
                idleReason: 'no-action',
            } as any;
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-extra-action-skip-turn');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            phase: 'playCards',
                            turnNumber: (activeMatch.state.sys?.turnNumber ?? 4) + 1,
                        },
                    };
                    return true;
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(executed[0]?.payload).toEqual({
                interactionId: 'smashup-extra-action-choice',
                optionId: 'card-0',
            });
            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('playCards');
            expect(match.state.sys.turnNumber).toBe(4);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-smashup-extra-action-skip-turn',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'visible-interaction:legal-action:interaction-choice:interaction:smashup-extra-action-choice:card-0',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在额外战术交互中遇到 private overlay stale 时，不应 fallback 到 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-extra-action-private-overlay-stale', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-stale-overlay',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:stale-private-overlay',
            diagnostics: {
                sharedPhase: 'playCards',
                privatePhase: 'playCards',
                sharedTurnNumber: 4,
                privateTurnNumber: 4,
                sharedCurrentPlayerId: '1',
                privateCurrentPlayerId: '1',
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-extra-action-private-overlay-stale');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            phase: 'playCards',
                            turnNumber: (activeMatch.state.sys?.turnNumber ?? 4) + 1,
                        },
                    };
                    return true;
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(executed[0]?.payload).toEqual({
                interactionId: 'smashup-extra-action-choice-stale-overlay',
                optionId: 'skip',
            });
            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.turnNumber).toBe(4);
            expect(broadcastSpy).toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在额外战术交互中遇到 missing private overlay 时，不应 fallback 到 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-extra-action-missing-private-overlay', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-missing-overlay',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'missing-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:missing-private-overlay',
            diagnostics: {
                sharedPhase: 'playCards',
                privatePhase: 'playCards',
                sharedTurnNumber: 4,
                privateTurnNumber: 4,
                sharedCurrentPlayerId: '1',
                privateCurrentPlayerId: '1',
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-extra-action-missing-private-overlay');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            phase: 'playCards',
                            turnNumber: (activeMatch.state.sys?.turnNumber ?? 4) + 1,
                        },
                    };
                    return true;
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(executed[0]?.payload).toEqual({
                interactionId: 'smashup-extra-action-choice-missing-overlay',
                optionId: 'skip',
            });
            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.turnNumber).toBe(4);
            expect(broadcastSpy).toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 active-turn 遇到 private overlay stale 时，也应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-active-turn-private-overlay-stale-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'playCards',
                turnNumber: 4,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 211,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'playCards',
                    privatePhase: 'playCards',
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
                        actionId: 'advance-phase:playCards:1',
                        kind: 'advance-phase',
                        label: '结束当前阶段',
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                    attemptKey: 'watchdog-active-turn-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-active-turn-private-overlay-stale-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');
                if (commandType !== 'ADVANCE_PHASE') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }
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
                        turnNumber: 5,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed).toEqual([{ commandType: 'ADVANCE_PHASE', payload: {} }]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.turnNumber).toBe(5);
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-active-turn-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('playCards');
            expect(snapshot.blockerFingerprint).toContain('4|playCards|1|0');
            expect(snapshot.trackerKey).toContain('active-turn:4|playCards|1|0');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('playCards');
            expect(actionLog.blockerFingerprint).toContain('4|playCards|1|0');
            expect(actionLog.trackerKey).toContain('active-turn:4|playCards|1|0');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 active-turn 遇到 missing private overlay 时，也应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-active-turn-missing-private-overlay-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'playCards',
                turnNumber: 4,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 311,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'playCards',
                    privatePhase: 'playCards',
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
                        actionId: 'advance-phase:playCards:1',
                        kind: 'advance-phase',
                        label: '结束当前阶段',
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                    attemptKey: 'watchdog-active-turn-emergency-player-view-missing-private-overlay',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-active-turn-missing-private-overlay-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');
                if (commandType !== 'ADVANCE_PHASE') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }
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
                        turnNumber: 5,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed).toEqual([{ commandType: 'ADVANCE_PHASE', payload: {} }]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.turnNumber).toBe(5);
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-active-turn-missing-private-overlay-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('playCards');
            expect(snapshot.blockerFingerprint).toContain('4|playCards|1|0');
            expect(snapshot.trackerKey).toContain('active-turn:4|playCards|1|0');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('playCards');
            expect(actionLog.blockerFingerprint).toContain('4|playCards|1|0');
            expect(actionLog.trackerKey).toContain('active-turn:4|playCards|1|0');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 遇到 private overlay stale 时，应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-private-overlay-stale-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-emergency-view',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'playCards',
                    privatePhase: 'playCards',
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
                        actionId: 'interaction:smashup-extra-action-choice-emergency-view:skip',
                        kind: 'interaction-choice',
                        label: '放弃这次额外战术',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'smashup-extra-action-choice-stale-overlay', optionId: 'skip' },
                        }],
                    },
                    attemptKey: 'watchdog-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-private-overlay-stale-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    throw new Error('不应在 emergency playerView 重试成功后触发 ADVANCE_PHASE');
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-smashup-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 遇到 missing private overlay 时，也应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-missing-private-overlay-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-missing-overlay',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'playCards',
                    privatePhase: 'playCards',
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
                        actionId: 'interaction:smashup-extra-action-choice-missing-overlay:skip',
                        kind: 'interaction-choice',
                        label: '放弃这次额外战术',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'smashup-extra-action-choice-missing-overlay', optionId: 'skip' },
                        }],
                    },
                    attemptKey: 'watchdog-emergency-player-view-missing-private-overlay',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-missing-private-overlay-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    throw new Error('不应在 missing private overlay 的 emergency playerView 重试成功后触发 ADVANCE_PHASE');
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(executed[0]?.payload).toEqual({
                interactionId: 'smashup-extra-action-choice-missing-overlay',
                optionId: 'skip',
            });
            expect(match.state.core.activePlayerId).toBe('0');
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-smashup-missing-private-overlay-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 factionSelect legal-action-only 遇到 private overlay stale 时，也应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-faction-select-private-overlay-stale-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'factionSelect',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'factionSelect',
                    privatePhase: 'factionSelect',
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
                        actionId: 'select-faction:wizards',
                        kind: 'select-faction',
                        label: '选择派系 wizards',
                        commands: [{
                            type: 'SELECT_FACTION',
                            payload: { factionId: 'wizards' },
                        }],
                    },
                    attemptKey: 'watchdog-faction-select-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-faction-select-private-overlay-stale-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                if (commandType !== 'SELECT_FACTION') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed.map((item) => item.commandType)).toEqual(['SELECT_FACTION']);
            expect(executed[0]?.payload).toEqual({ factionId: 'wizards' });
            expect(match.state.core.activePlayerId).toBe('0');
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-faction-select-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 factionSelect legal-action-only 遇到 missing private overlay 时，也应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-faction-select-missing-private-overlay-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'factionSelect',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'factionSelect',
                    privatePhase: 'factionSelect',
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
                        actionId: 'select-faction:wizards',
                        kind: 'select-faction',
                        label: '选择派系 wizards',
                        commands: [{
                            type: 'SELECT_FACTION',
                            payload: { factionId: 'wizards' },
                        }],
                    },
                    attemptKey: 'watchdog-faction-select-emergency-player-view-missing-private-overlay',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-faction-select-missing-private-overlay-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                if (commandType !== 'SELECT_FACTION') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed.map((item) => item.commandType)).toEqual(['SELECT_FACTION']);
            expect(executed[0]?.payload).toEqual({ factionId: 'wizards' });
            expect(match.state.core.activePlayerId).toBe('0');
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-faction-select-missing-private-overlay-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 response window 遇到 private overlay stale 时，也应使用 emergency playerView 重试响应动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'defensiveRoll',
            responseWindow: {
                current: {
                    id: 'response-window-stale-emergency-view-1',
                    windowType: 'afterAttackResolved',
                    sourceId: 'attack-1',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                },
            },
        });
        initialState.G.sys.actionLog = {
            entries: [
                {
                    text: '玩家 1 进入防御响应窗口',
                    event: { type: 'dt:response-window-opened' },
                },
            ],
        } as any;
        initialState.G.sys.eventStream = {
            ...(initialState.G.sys.eventStream ?? {}),
            nextId: 2,
            entries: [
                {
                    type: 'dt:response-window-opened',
                    timestamp: 123,
                    payload: { sourceId: 'attack-1' },
                },
            ],
        } as any;

        await storage.createMatch('match-watchdog-response-window-private-overlay-stale-emergency-view', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 1,
                    privateEventStreamNextId: 0,
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'response-play-card:card-next-time',
                        kind: 'response-play-card',
                        label: '打出下次不算',
                        commands: [{
                            type: 'PLAY_CARD',
                            payload: { cardId: 'card-next-time' },
                        }],
                    },
                    attemptKey: 'watchdog-response-window-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-window-private-overlay-stale-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');

                if (commandType !== 'PLAY_CARD') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }

                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed).toEqual([{
                commandType: 'PLAY_CARD',
                payload: { cardId: 'card-next-time' },
            }]);
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-response-window-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('attack-1');
            expect(snapshot.trackerKey).toContain('attack-1');
            expect(snapshot.recentActionLogTail).toContainEqual(expect.objectContaining({
                text: '玩家 1 进入防御响应窗口',
                type: 'dt:response-window-opened',
            }));
            expect(snapshot.recentEventStreamTail).toContainEqual(expect.objectContaining({
                type: 'dt:response-window-opened',
                payload: expect.objectContaining({ sourceId: 'attack-1' }),
            }));

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog).toMatchObject({
                kind: 'online-ai-feedback-diagnostic',
                reason: 'response-window',
            });
            expect(actionLog.blockerFingerprint).toContain('attack-1');
            expect(actionLog.trackerKey).toContain('attack-1');
            expect(actionLog.actionLogTail).toContainEqual(expect.objectContaining({
                text: '玩家 1 进入防御响应窗口',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('tryRecoverOnlineAiWithLegalAction 在 response-loop 遇到 private overlay stale 时，也应使用 emergency playerView 重试响应动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop-private-overlay-stale-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-stale-emergency-view-1',
                        windowType: 'afterAttackResolved',
                        sourceId: 'attack-loop-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
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
                        actionId: 'response-play-card:card-loop-next-time',
                        kind: 'response-play-card',
                        label: '打出下次不算',
                        commands: [{
                            type: 'PLAY_CARD',
                            payload: { cardId: 'card-loop-next-time' },
                        }],
                    },
                    attemptKey: 'watchdog-response-loop-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                tryRecoverOnlineAiWithLegalAction: (
                    match: any,
                    candidate: any,
                    tracker: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<{
                    applied: boolean;
                    resolved: boolean;
                    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                    executedCommandTypes: string[];
                    outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                }>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-loop-private-overlay-stale-emergency-view');
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
                expect(playerID).toBe('1');
                expect(commandType).toBe('PLAY_CARD');
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            });

            const result = await serverInternal.tryRecoverOnlineAiWithLegalAction(
                match,
                {
                    playerId: '1',
                    reason: 'response-loop',
                    requiresConfirmedAdvancePhase: true,
                    resolution: {
                        playerId: '1',
                        attemptKey: 'force-end-turn:1:response-loop:stale-emergency-view',
                        source: 'local-ai',
                        action: {
                            actionId: 'force-end-turn:response-loop:stale-emergency-view',
                            kind: 'force-end-turn',
                            label: '强制结束 AI 回合',
                            commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                        },
                    },
                },
                {
                    key: '1:response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-1:1:response-loop-stale-emergency-view-1',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                },
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            );

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(result).toMatchObject({
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['PLAY_CARD'],
                outcome: 'applied',
            });
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('tryRecoverOnlineAiWithLegalAction 在 visible simple-choice 仅 option value 漂移且 progress marker 不变时，也应视为已推进', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-visible-simple-choice-value-drift-progress', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-counter-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'counter-0',
                                label: '维尔的力量',
                                value: {
                                    cardUid: 'force-1',
                                    defId: 'geeks_force_of_wil',
                                    cardType: 'action',
                                },
                            },
                            {
                                id: 'pass',
                                label: '让过',
                                value: { pass: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_action_counter_choose',
                            targetType: 'generic',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'watchdog-visible-simple-choice-value-drift',
                source: 'local-ai',
                action: {
                    actionId: 'respond-counter-0',
                    kind: 'interaction-respond',
                    label: '响应第一张反制牌',
                    commands: [{
                        type: INTERACTION_COMMANDS.RESPOND,
                        payload: {
                            interactionId: 'smashup-counter-choice-1',
                            optionId: 'counter-0',
                        },
                    }],
                },
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                tryRecoverOnlineAiWithLegalAction: (
                    match: any,
                    candidate: any,
                    tracker: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<{
                    applied: boolean;
                    resolved: boolean;
                    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                    executedCommandTypes: string[];
                    outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                }>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-visible-simple-choice-value-drift-progress');
            const seatControllers = {
                '0': { type: 'human' as const },
                '1': { type: 'local-ai' as const },
            };
            const candidate = resolveForceEndTurnForStalledAi({
                sharedState: match.state,
                seatControllers,
                seatStates: {},
            });
            expect(candidate?.reason).toBe('visible-interaction');

            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                expect(playerID).toBe('1');
                expect(commandType).toBe(INTERACTION_COMMANDS.RESPOND);
                expect(payload).toEqual({
                    interactionId: 'smashup-counter-choice-1',
                    optionId: 'counter-0',
                });
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: {
                            current: createSimpleChoice(
                                'smashup-counter-choice-1',
                                '1',
                                '选择一个反应动作',
                                [
                                    {
                                        id: 'counter-0',
                                        label: '维尔的力量',
                                        value: {
                                            cardUid: 'force-1b',
                                            defId: 'geeks_force_of_wil',
                                            cardType: 'action',
                                        },
                                    },
                                    {
                                        id: 'pass',
                                        label: '让过',
                                        value: { pass: true },
                                    },
                                ],
                                {
                                    sourceId: 'smashup_action_counter_choose',
                                    targetType: 'generic',
                                },
                            ),
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return true;
            });
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');

            const result = await serverInternal.tryRecoverOnlineAiWithLegalAction(
                match,
                candidate!,
                {
                    key: `1:visible-interaction:${candidate?.fingerprintHint ?? ''}`,
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                },
                seatControllers,
            );

            expect(executeSpy).toHaveBeenCalledTimes(1);
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(result).toMatchObject({
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: [INTERACTION_COMMANDS.RESPOND],
                outcome: 'applied',
            });
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('tryRecoverOnlineAiWithLegalAction 在 response-loop 经 emergency playerView 后仍 stale-private-overlay 时，不应再触发 overlay resync', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop-stale-no-resync', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-stale-no-resync-1',
                        windowType: 'afterAttackResolved',
                        sourceId: 'attack-loop-stale-no-resync',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                tryRecoverOnlineAiWithLegalAction: (
                    match: any,
                    candidate: any,
                    tracker: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<{
                    applied: boolean;
                    resolved: boolean;
                    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                    executedCommandTypes: string[];
                    outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                }>;
                maybeTriggerOnlineAiOverlayResync: (args: {
                    match: any;
                    playerId: string;
                    blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
                    blockedKey: string;
                    progressMarker: string;
                }) => void;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-loop-stale-no-resync');
            const overlaySpy = vi.spyOn(serverInternal, 'maybeTriggerOnlineAiOverlayResync');

            const result = await serverInternal.tryRecoverOnlineAiWithLegalAction(
                match,
                {
                    playerId: '1',
                    reason: 'response-loop',
                    requiresConfirmedAdvancePhase: true,
                    resolution: {
                        playerId: '1',
                        attemptKey: 'force-end-turn:1:response-loop:stale-no-resync',
                        source: 'local-ai',
                        action: {
                            actionId: 'force-end-turn:response-loop:stale-no-resync',
                            kind: 'force-end-turn',
                            label: '强制结束 AI 回合',
                            commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                        },
                    },
                },
                {
                    key: '1:response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-stale-no-resync:1:response-loop-stale-no-resync-1',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                },
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            );

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(overlaySpy).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                applied: false,
                resolved: false,
                blockedReason: 'stale-private-overlay',
                executedCommandTypes: [],
                outcome: 'blocked',
            });
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('tryRecoverOnlineAiWithLegalAction 在 response-loop 遇到 missing private overlay 时，也应使用 emergency playerView 重试响应动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop-missing-private-overlay-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-missing-emergency-view-1',
                        windowType: 'afterAttackResolved',
                        sourceId: 'attack-loop-missing-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
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
                        actionId: 'response-play-card:card-loop-missing-overlay',
                        kind: 'response-play-card',
                        label: '打出下次不算',
                        commands: [{
                            type: 'PLAY_CARD',
                            payload: { cardId: 'card-loop-missing-overlay' },
                        }],
                    },
                    attemptKey: 'watchdog-response-loop-emergency-player-view-missing-private-overlay',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                tryRecoverOnlineAiWithLegalAction: (
                    match: any,
                    candidate: any,
                    tracker: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<{
                    applied: boolean;
                    resolved: boolean;
                    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                    executedCommandTypes: string[];
                    outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                }>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-loop-missing-private-overlay-emergency-view');
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
                expect(playerID).toBe('1');
                expect(commandType).toBe('PLAY_CARD');
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            });

            const result = await serverInternal.tryRecoverOnlineAiWithLegalAction(
                match,
                {
                    playerId: '1',
                    reason: 'response-loop',
                    requiresConfirmedAdvancePhase: true,
                    resolution: {
                        playerId: '1',
                        attemptKey: 'force-end-turn:1:response-loop:missing-emergency-view',
                        source: 'local-ai',
                        action: {
                            actionId: 'force-end-turn:response-loop:missing-emergency-view',
                            kind: 'force-end-turn',
                            label: '强制结束 AI 回合',
                            commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                        },
                    },
                },
                {
                    key: '1:response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-missing-1:1:response-loop-missing-emergency-view-1',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                },
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            );

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(result).toMatchObject({
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['PLAY_CARD'],
                outcome: 'applied',
            });
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('tryRecoverOnlineAiWithLegalAction 在 response-loop 经 emergency playerView 后仍 missing-private-overlay 时，不应再触发 overlay resync', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop-missing-no-resync', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-missing-no-resync-1',
                        windowType: 'afterAttackResolved',
                        sourceId: 'attack-loop-missing-no-resync',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                tryRecoverOnlineAiWithLegalAction: (
                    match: any,
                    candidate: any,
                    tracker: any,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
                ) => Promise<{
                    applied: boolean;
                    resolved: boolean;
                    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                    executedCommandTypes: string[];
                    outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                }>;
                maybeTriggerOnlineAiOverlayResync: (args: {
                    match: any;
                    playerId: string;
                    blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
                    blockedKey: string;
                    progressMarker: string;
                }) => void;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-loop-missing-no-resync');
            const overlaySpy = vi.spyOn(serverInternal, 'maybeTriggerOnlineAiOverlayResync');

            const result = await serverInternal.tryRecoverOnlineAiWithLegalAction(
                match,
                {
                    playerId: '1',
                    reason: 'response-loop',
                    requiresConfirmedAdvancePhase: true,
                    resolution: {
                        playerId: '1',
                        attemptKey: 'force-end-turn:1:response-loop:missing-no-resync',
                        source: 'local-ai',
                        action: {
                            actionId: 'force-end-turn:response-loop:missing-no-resync',
                            kind: 'force-end-turn',
                            label: '强制结束 AI 回合',
                            commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                        },
                    },
                },
                {
                    key: '1:response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-missing-no-resync:1:response-loop-missing-no-resync-1',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                },
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            );

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(overlaySpy).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                applied: false,
                resolved: false,
                blockedReason: 'missing-private-overlay',
                executedCommandTypes: [],
                outcome: 'blocked',
            });
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 response window 遇到 missing private overlay 时，也应使用 emergency playerView 重试响应动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'defensiveRoll',
            responseWindow: {
                current: {
                    id: 'response-window-missing-emergency-view-1',
                    windowType: 'afterAttackResolved',
                    sourceId: 'attack-missing-1',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                },
            },
        });
        initialState.G.sys.actionLog = {
            entries: [
                {
                    text: '玩家 1 进入防御响应窗口',
                    event: { type: 'dt:response-window-opened' },
                },
            ],
        } as any;
        initialState.G.sys.eventStream = {
            ...(initialState.G.sys.eventStream ?? {}),
            nextId: 2,
            entries: [
                {
                    type: 'dt:response-window-opened',
                    timestamp: 456,
                    payload: { sourceId: 'attack-missing-1' },
                },
            ],
        } as any;

        await storage.createMatch('match-watchdog-response-window-missing-private-overlay-emergency-view', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 1,
                    privateEventStreamNextId: 0,
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'response-play-card:card-next-time-missing-overlay',
                        kind: 'response-play-card',
                        label: '打出下次不算',
                        commands: [{
                            type: 'PLAY_CARD',
                            payload: { cardId: 'card-next-time-missing-overlay' },
                        }],
                    },
                    attemptKey: 'watchdog-response-window-emergency-player-view-missing-private-overlay',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-window-missing-private-overlay-emergency-view');
            const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');

                if (commandType !== 'PLAY_CARD') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }

                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed).toEqual([{
                commandType: 'PLAY_CARD',
                payload: { cardId: 'card-next-time-missing-overlay' },
            }]);
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-response-window-missing-private-overlay-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('attack-missing-1');
            expect(snapshot.blockerFingerprint).toContain('response-window-missing-emergency-view-1');
            expect(snapshot.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterAttackResolved:attack-missing-1:1:response-window-missing-emergency-view-1');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('attack-missing-1');
            expect(actionLog.blockerFingerprint).toContain('response-window-missing-emergency-view-1');
            expect(actionLog.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterAttackResolved:attack-missing-1:1:response-window-missing-emergency-view-1');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
});
