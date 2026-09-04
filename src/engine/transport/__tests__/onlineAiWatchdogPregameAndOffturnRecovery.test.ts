import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { buildAiProgressMarker } from '../onlineAiRecovery';
import { createInitialSystemState, executePipeline } from '../../pipeline';
import * as aiModule from '../../ai';
import betrayalEngineConfig from '../../../games/betrayal/game';
import { createQueuedRandom } from '../../../games/dicethrone/__tests__/test-utils';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    nextTick,
} from './helpers/serverTestHarness';

describe('online AI watchdog pregame and off-turn recovery', () => {
    it('online AI watchdog 在 Betrayal characterSelect 阶段应代单个 AI 选择探索者并确认', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([1]);
        const setupCore = betrayalEngineConfig.domain.setup(playerIds, random);
        const setupState = {
            core: setupCore,
            sys: {
                ...createInitialSystemState(playerIds, betrayalEngineConfig.systems, 'match-watchdog-betrayal-character-select'),
                phase: 'characterSelect',
            },
        };

        const humanSelectionResult = executePipeline(
            {
                domain: betrayalEngineConfig.domain,
                systems: betrayalEngineConfig.systems,
            },
            setupState,
            {
                type: 'SELECT_EXPLORER',
                playerId: '0',
                payload: { explorerId: 'jaden-jones' },
                timestamp: Date.now(),
            } as any,
            random,
            playerIds,
        );

        expect(humanSelectionResult.success).toBe(true);
        expect((humanSelectionResult.state.core as any).selectedExplorerByPlayerId['0']).toBe('jaden-jones');
        expect((humanSelectionResult.state.core as any).selectedExplorerByPlayerId['1']).toBeUndefined();
        expect((humanSelectionResult.state.core as any).selectedExplorerByPlayerId['2']).toBeUndefined();

        await storage.createMatch('match-watchdog-betrayal-character-select', {
            initialState: {
                G: humanSelectionResult.state as any,
                _stateID: 1,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'betrayal',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [betrayalEngineConfig],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
        };
        const match = await serverInternal.loadMatch('match-watchdog-betrayal-character-select');

        for (let step = 0; step < 4; step += 1) {
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
        }

        const core = match.state.core as any;
        expect(core.phase).toBe('characterSelect');
        expect(core.selectedExplorerByPlayerId['0']).toBe('jaden-jones');
        expect(core.selectedExplorerByPlayerId['1']).toBeTruthy();
        expect(core.selectedExplorerByPlayerId['1']).not.toBe('jaden-jones');
        expect(core.readyPlayerIds).toContain('1');
        expect(core.readyPlayerIds).not.toContain('0');
        expect(core.scenarioCardConfirmations['1']).toBe(core.proposedScenarioCardId);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-betrayal-character-select',
            incidentKind: 'legal-action-recovered',
            status: 'resolved',
        }));
    });
    it('Betrayal 在线普通 AI 应在人类选探索者命令成功后连续收口多个 AI 座位', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const playerIds = ['0', '1', '2'];
        const random = createQueuedRandom([1]);
        const setupCore = betrayalEngineConfig.domain.setup(playerIds, random);
        const setupState = {
            core: setupCore,
            sys: {
                ...createInitialSystemState(playerIds, betrayalEngineConfig.systems, 'match-betrayal-immediate-online-ai-character-select'),
                phase: 'characterSelect',
            },
        };

        const metadata = createOnlineAiRecoveryMetadata({
            gameName: 'betrayal',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
                '2': { type: 'local-ai', policyId: 'baseline' },
            },
        });
        metadata.players['2'] = {
            name: 'AI 2',
            credentials: 'cred-2',
            isConnected: false,
        };

        await storage.createMatch('match-betrayal-immediate-online-ai-character-select', {
            initialState: {
                G: setupState as any,
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [betrayalEngineConfig],
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => (
                latestMetadata.players[playerID]?.credentials === credentials
            ),
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 8000,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<any>;
        };
        await serverInternal.loadMatch('match-betrayal-immediate-online-ai-character-select');
        const recoverySpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction');

        try {
            const commandSucceeded = await server.executeCommand(
                'match-betrayal-immediate-online-ai-character-select',
                '0',
                'SELECT_EXPLORER',
                { explorerId: 'jaden-jones' },
            );
            expect(commandSucceeded).toBe(true);

            const persisted = await storage.fetch('match-betrayal-immediate-online-ai-character-select', { state: true });
            const core = (persisted.state?.G as any).core;
            expect(core.phase).toBe('characterSelect');
            expect(core.selectedExplorerByPlayerId['0']).toBe('jaden-jones');
            expect(core.selectedExplorerByPlayerId['1']).toBeTruthy();
            expect(core.selectedExplorerByPlayerId['2']).toBeTruthy();
            expect(core.selectedExplorerByPlayerId['1']).not.toBe('jaden-jones');
            expect(core.selectedExplorerByPlayerId['2']).not.toBe('jaden-jones');
            expect(core.readyPlayerIds).toEqual(expect.arrayContaining(['1', '2']));
            expect(core.readyPlayerIds).not.toContain('0');
            expect(core.scenarioCardConfirmations['1']).toBe(core.proposedScenarioCardId);
            expect(core.scenarioCardConfirmations['2']).toBe(core.proposedScenarioCardId);
            expect(recoverySpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                incidentKind: 'legal-action-recovered',
            }));
        } finally {
            recoverySpy.mockRestore();
        }
    });
    it('online AI watchdog 在 summonerwars 公开选阵营阶段也应代 AI 执行 legal action', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-summonerwars-pregame-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                        hostPlayerId: '0',
                        selectedFactions: {
                            '0': 'necromancer',
                            '1': 'unselected',
                        },
                        readyPlayers: {
                            '0': false,
                            '1': false,
                        },
                    },
                    sys: {
                        phase: 'summon',
                        turnNumber: 1,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'summonerwars',
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'sw:select-faction:paladin',
                        kind: 'setup-select-faction',
                        label: '选择阵营 paladin',
                        commands: [{
                            type: 'sw:select_faction',
                            payload: { factionId: 'paladin' },
                        }],
                    },
                    attemptKey: 'watchdog-summonerwars-pregame-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'sw:select-faction:paladin',
                        kind: 'setup-select-faction',
                        label: '选择阵营 paladin',
                        commands: [{
                            type: 'sw:select_faction',
                            payload: { factionId: 'paladin' },
                        }],
                    },
                    attemptKey: 'watchdog-summonerwars-pregame-step-1-apply',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'sw:select-faction:paladin',
                        kind: 'setup-select-faction',
                        label: '选择阵营 paladin',
                        commands: [{
                            type: 'sw:select_faction',
                            payload: { factionId: 'paladin' },
                        }],
                    },
                    attemptKey: 'watchdog-summonerwars-pregame-step-1-recover',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'idle',
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('summonerwars')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('sw:select_faction');
            expect(payload).toEqual({ factionId: 'paladin' });

            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    selectedFactions: {
                        ...activeMatch.state.core.selectedFactions,
                        '1': 'paladin',
                    },
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: 2 },
                },
            };

            return true;
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-summonerwars-pregame-legal-action');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual(['sw:select_faction']);
            expect(match.state.core.selectedFactions).toMatchObject({
                '0': 'necromancer',
                '1': 'paladin',
            });
            expect(match.state.core.hostStarted).toBe(false);
            // 这个夹具只模拟“选择阵营”，没有模拟后续 ready 收口；此时不能伪报整段开局已恢复。
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 summonerwars 观察到 AI 已恢复时也应写入系统反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameConfig = createEngineConfigWithId('summonerwars');

        await storage.createMatch('match-watchdog-summonerwars-observed-recovery', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                        hostPlayerId: '0',
                        selectedFactions: {
                            '0': 'necromancer',
                            '1': 'unselected',
                        },
                        readyPlayers: {
                            '0': false,
                            '1': false,
                        },
                    },
                    sys: {
                        phase: 'summon',
                        turnNumber: 1,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'summonerwars',
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [gameConfig],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai'; policyId?: string }>,
            ) => Promise<void>;
        };

        const tryRecoverSpy = vi.spyOn(server as any, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch: any) => {
            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    selectedFactions: {
                        ...activeMatch.state.core.selectedFactions,
                        '1': 'yongheng',
                    },
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: 3 },
                },
            };
            return {
                applied: true,
                resolved: true,
                blockedReason: null,
                executedCommandTypes: ['sw:select_faction'],
                outcome: 'applied',
                reportedAction: null,
            };
        });
        const resolveCandidateSpy = vi.spyOn(server as any, 'resolveOnlineAiRecoveryCandidate').mockResolvedValue(null);

        try {
            const match = await serverInternal.loadMatch('match-watchdog-summonerwars-observed-recovery');
            const candidate = {
                playerId: '1',
                reason: 'seat-legal-only',
                legalActionOnly: true,
                fingerprintHint: 'seat-legal-only:1:summon:setup-select-faction:sw:select-faction:yongheng',
                resolution: {
                    playerId: '1',
                    attemptKey: 'force-end-turn:1:summonerwars-observed-recovery',
                    source: 'local-ai',
                    action: {
                        actionId: 'force-end-turn:summonerwars-observed-recovery',
                        kind: 'force-end-turn',
                        label: '服务端观察 AI 恢复',
                        commands: [],
                    },
                },
            };
            const progressMarker = buildAiProgressMarker(match.state, {
                engineConfig: gameConfig,
                gameId: 'summonerwars',
            });
            const tracker = {
                key: '1:seat-legal-only:observed-recovery',
                firstSeenAt: Date.now(),
                autoSubmittedAt: Date.now(),
                lastReportedFailureReason: null,
                failureCount: 0,
            };

            await serverInternal.runOnlineAiRecoverySequence(
                match,
                tracker,
                candidate,
                progressMarker,
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            );

            expect(match.state.core.selectedFactions).toMatchObject({
                '0': 'necromancer',
                '1': 'yongheng',
            });
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-summonerwars-observed-recovery',
                playerId: '1',
                incidentKind: 'observed-recovery',
                status: 'resolved',
                reason: 'seat-legal-only:observed-progress',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                trackerKey?: string;
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('seat-legal-only');
            expect(snapshot.blockerFingerprint).toContain('summon');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('seat-legal-only');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            tryRecoverSpy.mockRestore();
            resolveCandidateSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-offturn-defensive-legal-action';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const phase = (state.sys?.phase ?? '') as string;
                const core = state.core as {
                    rollCount?: number;
                    rollConfirmed?: boolean;
                };

                if (playerId !== '1' || phase !== 'defensiveRoll') {
                    return [];
                }

                if ((core.rollCount ?? 0) === 0) {
                    return [{
                        actionId: 'legal-roll',
                        kind: 'roll-dice',
                        label: '合法防御掷骰',
                        commands: [{ type: 'ROLL_DICE', payload: {} }],
                    }];
                }

                if (core.rollConfirmed !== true) {
                    return [{
                        actionId: 'legal-confirm',
                        kind: 'confirm-roll',
                        label: '合法确认防御骰',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                        metadata: { rollConfirmScope: 'main-roll' },
                    }];
                }

                return [{
                    actionId: 'legal-advance',
                    kind: 'advance-phase',
                    label: '合法结束防御阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                }];
            },
            localPolicies: {
                offTurnLegalRecoveryPolicy: {
                    id: 'offTurnLegalRecoveryPolicy',
                    decide: (context) => ({
                        actionId: context.legalActions[0]?.actionId ?? 'legal-advance',
                        confidence: 0.96,
                        reasoningSummary: '当前真人仍是 activePlayer，但 AI 防御阶段已有合法动作，应由 watchdog 代执行。',
                    }),
                },
            },
            defaultLocalPolicyId: 'offTurnLegalRecoveryPolicy',
        });

        await storage.createMatch('match-watchdog-offturn-defensive-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'offTurnLegalRecoveryPolicy' },
                },
            }),
        });

        const engineConfig = createEngineConfigWithId(gameId);
        engineConfig.onlineAiRecovery = {
            ...engineConfig.onlineAiRecovery,
            humanTurnLegalActionProbePhases: ['defensiveRoll'],
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-offturn-defensive-legal-action');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'ROLL_DICE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollCount: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
                return true;
            }

            if (commandType === 'CONFIRM_ROLL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollConfirmed: true,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main2',
                        eventStream: { nextId: 4 },
                    },
                };
                return true;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'ROLL_DICE',
                'CONFIRM_ROLL',
                'ADVANCE_PHASE',
            ]);
            expect(match.state.sys.phase).toBe('main2');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-offturn-defensive-legal-action',
                gameId,
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { reason?: string; trackerKey?: string; stateSnapshot?: string; actionLog?: string } | undefined;
            expect(payload?.reason).toContain('seat-legal-only:legal-action:advance-phase:legal-advance');

            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('seat-legal-only');
            expect(snapshot.blockerFingerprint).toContain('defensiveRoll');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('seat-legal-only');
            expect(actionLog.blockerFingerprint).toContain('defensiveRoll');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            executeSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-offturn-targeting-legal-action';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const phase = (state.sys?.phase ?? '') as string;
                const core = state.core as {
                    rollCount?: number;
                    rollConfirmed?: boolean;
                };

                if (playerId !== '1' || phase !== 'targetingRoll') {
                    return [];
                }

                if ((core.rollCount ?? 0) === 0) {
                    return [{
                        actionId: 'legal-roll',
                        kind: 'roll-dice',
                        label: '合法掷出选目标骰',
                        commands: [{ type: 'ROLL_DICE', payload: {} }],
                    }];
                }

                if (core.rollConfirmed !== true) {
                    return [{
                        actionId: 'legal-confirm',
                        kind: 'confirm-roll',
                        label: '合法确认选目标骰',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                        metadata: { rollConfirmScope: 'main-roll' },
                    }];
                }

                return [{
                    actionId: 'legal-advance',
                    kind: 'advance-phase',
                    label: '合法结束 targetingRoll',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                }];
            },
            localPolicies: {
                offTurnTargetingRecoveryPolicy: {
                    id: 'offTurnTargetingRecoveryPolicy',
                    decide: (context) => ({
                        actionId: context.legalActions[0]?.actionId ?? 'legal-advance',
                        confidence: 0.96,
                        reasoningSummary: '当前真人仍是 activePlayer，但 AI targetingRoll 已有合法动作，应由 watchdog 代执行。',
                    }),
                },
            },
            defaultLocalPolicyId: 'offTurnTargetingRecoveryPolicy',
        });

        await storage.createMatch('match-watchdog-offturn-targeting-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'offTurnTargetingRecoveryPolicy' },
                },
            }),
        });

        const engineConfig = createEngineConfigWithId(gameId);
        engineConfig.onlineAiRecovery = {
            ...engineConfig.onlineAiRecovery,
            humanTurnLegalActionProbePhases: ['targetingRoll'],
        };
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-offturn-targeting-legal-action');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'ROLL_DICE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollCount: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
                return true;
            }

            if (commandType === 'CONFIRM_ROLL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollConfirmed: true,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'defensiveRoll',
                        eventStream: { nextId: 4 },
                    },
                };
                return true;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'ROLL_DICE',
                'CONFIRM_ROLL',
                'ADVANCE_PHASE',
            ]);
            expect(match.state.sys.phase).toBe('defensiveRoll');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-offturn-targeting-legal-action',
                gameId,
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { reason?: string; trackerKey?: string; stateSnapshot?: string; actionLog?: string } | undefined;
            expect(payload?.reason).toContain('seat-legal-only:legal-action:advance-phase:legal-advance');

            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('seat-legal-only');
            expect(snapshot.blockerFingerprint).toContain('targetingRoll');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('seat-legal-only');
            expect(actionLog.blockerFingerprint).toContain('targetingRoll');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            executeSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-active-targeting-legal-only-no-fallback';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                idlePolicy: {
                    id: 'idlePolicy',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'idlePolicy',
        });

        await storage.createMatch('match-watchdog-active-targeting-legal-only-no-fallback', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 1,
                        rollLimit: 1,
                        rollConfirmed: true,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 7,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'idlePolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-active-targeting-legal-only-no-fallback');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-active-targeting-legal-only-no-fallback',
            gameId,
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn-legal-only:follow-up-advance:legal_action_unavailable'),
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
        expect(snapshot.blockerFingerprint).toContain('targetingRoll');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
        expect(actionLog.blockerFingerprint).toContain('targetingRoll');
    });
    it('online AI watchdog 在手动代 AI 选派系阶段不应上报 legal_action_unavailable 噪音反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-manual-faction-selection-suppressed';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                if (playerId !== '1' || state.sys?.phase !== 'factionSelect') {
                    return [];
                }

                return [{
                    actionId: 'select-faction-wizard',
                    kind: 'select-faction',
                    label: '选择派系 wizard',
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'wizard' } }],
                }];
            },
            localPolicies: {
                manualFactionSelectionPolicy: {
                    id: 'manualFactionSelectionPolicy',
                    decide: () => ({
                        actionId: 'select-faction-wizard',
                        confidence: 0.99,
                        reasoningSummary: '存在合法选派系动作，但该 AI 座位开启了手动代选，应交给真人。',
                    }),
                },
            },
            defaultLocalPolicyId: 'manualFactionSelectionPolicy',
        });

        await storage.createMatch('match-watchdog-manual-faction-selection-suppressed', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                    },
                    sys: {
                        phase: 'factionSelect',
                        turnNumber: 1,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'manualFactionSelectionPolicy', manualFactionSelection: true },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-manual-faction-selection-suppressed');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在手动代 AI 选角色阶段不应上报 legal_action_unavailable 噪音反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-manual-setup-character-selection-suppressed';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                if (playerId !== '1' || state.sys?.phase !== 'setup') {
                    return [];
                }

                return [{
                    actionId: 'setup-select-character-samurai',
                    kind: 'setup-select-character',
                    label: '选择角色 samurai',
                    commands: [{ type: 'SELECT_CHARACTER', payload: { characterId: 'samurai' } }],
                }];
            },
            localPolicies: {
                manualSetupSelectionPolicy: {
                    id: 'manualSetupSelectionPolicy',
                    decide: () => ({
                        actionId: 'setup-select-character-samurai',
                        confidence: 0.99,
                        reasoningSummary: '存在合法选角色动作，但该 AI 座位开启了手动代选，应交给真人。',
                    }),
                },
            },
            defaultLocalPolicyId: 'manualSetupSelectionPolicy',
        });

        await storage.createMatch('match-watchdog-manual-setup-character-selection-suppressed', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                        selectedCharacters: {
                            '0': 'monk',
                            '1': 'unselected',
                        },
                    },
                    sys: {
                        phase: 'setup',
                        turnNumber: 1,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'manualSetupSelectionPolicy', manualSetupSelection: true },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...createEngineConfigWithId(gameId),
                onlineAiRecovery: {
                    ...createEngineConfigWithId(gameId).onlineAiRecovery,
                    publicPregameLegalActionPhases: ['setup'],
                },
            }],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-manual-setup-character-selection-suppressed');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在自定义手动前置选择阶段不应上报 legal_action_unavailable 噪音反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-manual-custom-setup-selection-suppressed';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                if (playerId !== '1' || state.sys?.phase !== 'draft') {
                    return [];
                }

                return [{
                    actionId: 'setup-select-draft-ranger',
                    kind: 'setup-select-draft',
                    label: '选择草案 ranger',
                    commands: [{ type: 'SELECT_DRAFT', payload: { draftId: 'ranger' } }],
                }];
            },
            localPolicies: {
                manualSetupSelectionPolicy: {
                    id: 'manualSetupSelectionPolicy',
                    decide: () => ({
                        actionId: 'setup-select-draft-ranger',
                        confidence: 0.99,
                        reasoningSummary: '存在合法草案选择动作，但该 AI 座位开启了手动代选，应交给真人。',
                    }),
                },
            },
            defaultLocalPolicyId: 'manualSetupSelectionPolicy',
        });

        await storage.createMatch('match-watchdog-manual-custom-setup-selection-suppressed', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                    },
                    sys: {
                        phase: 'draft',
                        turnNumber: 1,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'manualSetupSelectionPolicy', manualSetupSelection: true },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...createEngineConfigWithId(gameId),
                onlineAiRecovery: {
                    ...createEngineConfigWithId(gameId).onlineAiRecovery,
                    publicPregameLegalActionPhases: ['draft'],
                    shouldTreatActionAsManualSetupSelection: ({ actionKind }) => (
                        actionKind === 'setup-select-draft' ? true : undefined
                    ),
                },
            }],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-manual-custom-setup-selection-suppressed');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在 summonerwars pregame 已 ready 但仍等待 human host 时，不应上报 legal_action_unavailable 噪音反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-summonerwars-pregame-waiting-host', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                        hostPlayerId: '0',
                        selectedFactions: {
                            '0': 'unselected',
                            '1': 'trickster',
                        },
                        readyPlayers: {
                            '0': false,
                            '1': true,
                        },
                    },
                    sys: {
                        phase: 'summon',
                        turnNumber: 0,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'summonerwars',
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('summonerwars')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-summonerwars-pregame-waiting-host');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在 active-turn-legal-only 的合法动作命令失败时，应上报 legal_action_command_failed 并保留 legal-only blockerFingerprint', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-active-targeting-command-failed';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                if (playerId !== '1' || state.sys?.phase !== 'targetingRoll') {
                    return [];
                }

                return [{
                    actionId: 'legal-roll',
                    kind: 'roll-dice',
                    label: '合法掷出 targetingRoll 骰子',
                    commands: [{ type: 'ROLL_DICE', payload: {} }],
                }];
            },
            localPolicies: {
                targetingRollFailurePolicy: {
                    id: 'targetingRollFailurePolicy',
                    decide: (context) => ({
                        actionId: context.legalActions[0]?.actionId ?? 'legal-roll',
                        confidence: 0.95,
                        reasoningSummary: 'targetingRoll 只有一个合法动作，应先尝试执行它。',
                    }),
                },
            },
            defaultLocalPolicyId: 'targetingRollFailurePolicy',
        });

        await storage.createMatch('match-watchdog-active-targeting-command-failed', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 7,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'targetingRollFailurePolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-active-targeting-command-failed');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType, payload) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ROLL_DICE');
            expect(payload).toEqual({});
            match.lastCommandFailureReason = 'pipeline_error: test roll denied';
            return false;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-active-targeting-command-failed',
                gameId,
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('active-turn-legal-only:follow-up-advance:legal_action_command_failed:ROLL_DICE:pipeline_error: test roll denied'),
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
            expect(snapshot.blockerFingerprint).toContain('targetingRoll');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
            expect(actionLog.blockerFingerprint).toContain('targetingRoll');
        } finally {
            executeSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 active-turn-legal-only 经 emergency playerView 后仍 missing-private-overlay 时，应上报 private_overlay_missing 并保留 blockedKey', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-active-targeting-missing-private-overlay';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                idlePolicy: {
                    id: 'idlePolicy',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'idlePolicy',
        });

        await storage.createMatch('match-watchdog-active-targeting-missing-private-overlay', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 7,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'idlePolicy' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'missing-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:missing-private-overlay',
                diagnostics: {
                    sharedPhase: 'targetingRoll',
                    privatePhase: 'targetingRoll',
                    sharedTurnNumber: 7,
                    privateTurnNumber: 7,
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
                    sharedPhase: 'targetingRoll',
                    privatePhase: 'targetingRoll',
                    sharedTurnNumber: 7,
                    privateTurnNumber: 7,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId(gameId)],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
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
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            await serverInternal.loadMatch('match-watchdog-active-targeting-missing-private-overlay');
            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalledTimes(2);
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-active-targeting-missing-private-overlay',
                gameId,
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('active-turn-legal-only:follow-up-advance:private_overlay_missing'),
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('missing-private-overlay');
            expect(snapshot.blockerFingerprint).toContain('targetingRoll');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('missing-private-overlay');
            expect(actionLog.blockerFingerprint).toContain('targetingRoll');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 active-turn-legal-only 经 emergency playerView 后仍 stale-private-overlay 时，应上报 private_overlay_stale 并保留 blockedKey', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-active-targeting-stale-private-overlay';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                idlePolicy: {
                    id: 'idlePolicy',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'idlePolicy',
        });

        await storage.createMatch('match-watchdog-active-targeting-stale-private-overlay', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 7,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'idlePolicy' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'targetingRoll',
                    privatePhase: 'targetingRoll',
                    sharedTurnNumber: 7,
                    privateTurnNumber: 7,
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
                    sharedPhase: 'targetingRoll',
                    privatePhase: 'targetingRoll',
                    sharedTurnNumber: 7,
                    privateTurnNumber: 7,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId(gameId)],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
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
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            await serverInternal.loadMatch('match-watchdog-active-targeting-stale-private-overlay');
            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalledTimes(2);
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-active-targeting-stale-private-overlay',
                gameId,
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('active-turn-legal-only:follow-up-advance:private_overlay_stale'),
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('stale-private-overlay');
            expect(snapshot.blockerFingerprint).toContain('targetingRoll');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('stale-private-overlay');
            expect(actionLog.blockerFingerprint).toContain('targetingRoll');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 AI active 的 targetingRoll 且 visible state 缺失时，应上报 missing_visible_state 而不是泛化失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-active-targeting-missing-visible-state';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                idlePolicy: {
                    id: 'idlePolicy',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'idlePolicy',
        });

        await storage.createMatch('match-watchdog-active-targeting-missing-visible-state', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 1,
                        rollLimit: 1,
                        rollConfirmed: true,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 7,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'idlePolicy' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'missing-visible-state',
            visibility: 'unknown',
            blockedKey: '1:missing-visible-state',
            diagnostics: null,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
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
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-active-targeting-missing-visible-state');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(resolutionSpy).toHaveBeenCalled();
        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-active-targeting-missing-visible-state',
            gameId,
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn-legal-only:follow-up-advance:missing_visible_state'),
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('missing-visible-state');
        expect(snapshot.blockerFingerprint).toContain('targetingRoll');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('missing-visible-state');

        resolutionSpy.mockRestore();
    });
});
