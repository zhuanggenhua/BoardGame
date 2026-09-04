import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { buildAiProgressMarker } from '../onlineAiRecovery';
import { createCompareRollChoice, createSimpleChoice } from '../../systems/InteractionSystem';
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

describe('online AI watchdog active-turn recovery', () => {
    it('online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合（或遇到 blocker/步数上限）', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-success', {
            initialState: createOnlineAiRecoveryState(),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 4,
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

        const match = await serverInternal.loadMatch('match-watchdog-success');
        expect(match).toBeTruthy();

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType !== 'ADVANCE_PHASE') {
                return false;
            }
            if (activeMatch.state.sys.phase === 'main2') {
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
                    },
                };
                return true;
            }
            if (activeMatch.state.sys.phase === 'discard') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        turnNumber: 5,
                    },
                };
                return true;
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();
        await nextTick();

        // main2 -> discard -> main1（交还到玩家0）
        expect(executeSpy).toHaveBeenCalledTimes(2);
        expect(match.state.sys.phase).toBe('main1');
        expect(match.state.sys.turnNumber).toBe(5);
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-success',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            trackerKey?: string;
            blockerFingerprint?: string | null;
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('4|main2|1|0');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('4|main2|1|0');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
    it('online AI watchdog 应按时间片限制连续恢复步数，并在下一 tick 继续交还真人回合', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-recovery-slice-budget', {
            initialState: createOnlineAiRecoveryState(),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 4,
            onlineAiRecoveryMaxStepsPerSlice: 1,
        } as any);

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

        const match = await serverInternal.loadMatch('match-watchdog-recovery-slice-budget');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType !== 'ADVANCE_PHASE') {
                return false;
            }
            if (activeMatch.state.sys.phase === 'main2') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'discard',
                    },
                };
                return true;
            }
            if (activeMatch.state.sys.phase === 'discard') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        turnNumber: 5,
                    },
                };
                return true;
            }
            return false;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();

        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(match.state.sys.phase).toBe('discard');
        expect(match.state.core.activePlayerId).toBe('1');

        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();

        expect(executeSpy).toHaveBeenCalledTimes(2);
        expect(match.state.sys.phase).toBe('main1');
        expect(match.state.core.activePlayerId).toBe('0');
    });
    it('online AI watchdog 在 AI seat 已离线时应立即接管 active-turn，而不是继续等待宿主页恢复', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-offline-ai-immediate-takeover', {
            initialState: createOnlineAiRecoveryState(),
            metadata: createOnlineAiRecoveryMetadata({
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'remote-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
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

        const match = await serverInternal.loadMatch('match-watchdog-offline-ai-immediate-takeover');
        expect(match).toBeTruthy();
        expect(match.connections.get('1')?.size ?? 0).toBe(0);

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
            executed.push(commandType);
            expect(playerID).toBe('1');

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
                        phase: 'main1',
                        turnNumber: 5,
                    },
                };
                return true;
            }

            return false;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 5; i += 1) {
            await nextTick();
        }

        expect(executed).toEqual(['ADVANCE_PHASE']);
        expect(match.state.core.activePlayerId).toBe('0');
        expect(match.state.sys.phase).toBe('main1');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-offline-ai-immediate-takeover',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            trackerKey?: string;
            blockerFingerprint?: string | null;
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('4|main2|1|0');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('4|main2|1|0');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
    it('online AI watchdog 在 remote-ai seat 已离线时应立即接管 response-window，而不是继续等待宿主页恢复', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-offline-remote-ai-response-window', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-offline-remote-ai-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'remote-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
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

        const match = await serverInternal.loadMatch('match-watchdog-offline-remote-ai-response-window');
        expect(match).toBeTruthy();
        expect(match.connections.get('1')?.size ?? 0).toBe(0);

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
            executed.push(commandType);
            expect(playerID).toBe('1');

            if (commandType === 'RESPONSE_PASS') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            return false;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 5; i += 1) {
            await nextTick();
        }

        expect(executed).toEqual(['RESPONSE_PASS']);
        expect(match.state.sys.responseWindow?.current).toBeUndefined();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-offline-remote-ai-response-window',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            trackerKey?: string;
            blockerFingerprint?: string | null;
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('attack-1');
        expect(snapshot.blockerFingerprint).toContain('response-window-offline-remote-ai-1');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('attack-1');
        expect(actionLog.blockerFingerprint).toContain('response-window-offline-remote-ai-1');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
    it('online AI watchdog 在 remote-ai seat 已离线时也应立即接管 response-loop，而不是继续等待宿主页恢复', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-offline-remote-ai-response-loop', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-offline-remote-ai-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'remote-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 10_000,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            resolveOnlineAiRecoveryTimeoutMs: (match: any, candidate: any) => number;
        };

        const match = await serverInternal.loadMatch('match-watchdog-offline-remote-ai-response-loop');
        expect(match).toBeTruthy();
        expect(match.connections.get('1')?.size ?? 0).toBe(0);

        const candidate = {
            playerId: '1',
            reason: 'response-loop',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint: 'response-loop:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-loop-offline-remote-ai-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:response-loop:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-loop-offline-remote-ai-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:response-loop:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-loop-offline-remote-ai-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                },
            },
        };

        expect(serverInternal.resolveOnlineAiRecoveryTimeoutMs(match, candidate)).toBe(0);
    });
    it('summonerwars 公开选阵营阶段的 AI seat 未连接时应立即接管，而不是等待 watchdog 超时', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'summon',
        });
        initialState.G.core = {
            ...initialState.G.core,
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
        };

        await storage.createMatch('match-watchdog-summonerwars-pregame-timeout', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'summonerwars',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const gameConfig = createEngineConfigWithId('summonerwars');
        gameConfig.onlineAiRecovery = {
            publicPregameLegalActionPhases: ['factionSelect', 'summon'],
        };
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [gameConfig],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 8_000,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            resolveOnlineAiRecoveryTimeoutMs: (match: any, candidate: any) => number;
        };

        const match = await serverInternal.loadMatch('match-watchdog-summonerwars-pregame-timeout');
        expect(match).toBeTruthy();
        expect(match.connections.get('1')?.size ?? 0).toBe(0);

        const candidate = {
            playerId: '1',
            reason: 'seat-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'seat-legal-only:1:summon:setup-select-faction:sw:select-faction:paladin',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:summonerwars-pregame-select-faction',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:summonerwars-pregame-select-faction',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 选择阵营',
                    commands: [],
                },
            },
        };

        expect(serverInternal.resolveOnlineAiRecoveryTimeoutMs(match, candidate)).toBe(0);
    });
    it('online AI watchdog 完成 legal action 恢复后也应写入系统反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-legal-action-recovery';

        let legalActionCallCount = 0;
        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => legalActionCallCount++ > 0 ? [] : [{
                actionId: 'legal-advance',
                kind: 'advance-phase',
                label: '合法推进阶段',
                commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
            }],
            localPolicies: {
                legalRecoveryPolicy: {
                    id: 'legalRecoveryPolicy',
                    decide: () => legalActionCallCount > 1 ? null : ({
                        actionId: 'legal-advance',
                        confidence: 0.91,
                        reasoningSummary: '当前 AI 仍有合法动作，先走合法动作恢复推进。',
                    }),
                },
            },
            defaultLocalPolicyId: 'legalRecoveryPolicy',
        });

        await storage.createMatch('match-watchdog-legal-action-feedback', {
            initialState: createOnlineAiRecoveryState(),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'legalRecoveryPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
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

        const match = await serverInternal.loadMatch('match-watchdog-legal-action-feedback');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType === 'ADVANCE_PHASE' && activeMatch.state.sys.phase === 'main2') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        turnNumber: 5,
                    },
                };
                return true;
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();

        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(match.state.sys.phase).toBe('main1');
        expect(match.state.sys.turnNumber).toBe(5);
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-legal-action-feedback',
            gameId,
            playerId: '1',
            incidentKind: 'legal-action-recovered',
            status: 'resolved',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { reason?: string; trackerKey?: string; stateSnapshot?: string; actionLog?: string } | undefined;
        expect(payload?.reason).toContain('active-turn:legal-action:advance-phase:legal-advance');
        expect(typeof payload?.stateSnapshot).toBe('string');

        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('4|main2|1|0');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('4|main2|1|0');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
    it('online AI watchdog 在 summonerwars 应使用 END_PHASE 推进阶段', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-sw-end-phase', {
            initialState: createOnlineAiRecoveryState(),
            metadata: {
                ...createOnlineAiRecoveryMetadata(),
                gameName: 'summonerwars',
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('summonerwars')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-sw-end-phase');
        expect(match).toBeTruthy();

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType !== 'sw:end_phase') {
                return false;
            }
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'discard',
                },
            };
            return true;
        });
        // 本用例只验证阶段推进命令的映射，不把不完整的 SummonerWars 开局夹具交给真实 AI 决策。
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        });

        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:test',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:test',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: '',
            firstSeenAt: Date.now(),
            autoSubmittedAt: null,
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        const progressMarker = buildAiProgressMarker(match.state);
        tracker.key = `${candidate.playerId}:${candidate.reason}:${progressMarker}`;
        try {
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                tracker,
                candidate,
                progressMarker,
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            );

            // 初始 + 一次 follow-up（maxAdvanceSteps=1）都应映射成 sw:end_phase
            expect(executeSpy).toHaveBeenCalledTimes(2);
            expect(executeSpy).toHaveBeenNthCalledWith(
                1,
                expect.anything(),
                '1',
                'sw:end_phase',
                expect.anything(),
                expect.objectContaining({
                    reportFailureFeedback: true,
                    feedbackSource: 'online-ai-watchdog',
                }),
            );
            expect(executeSpy).toHaveBeenNthCalledWith(
                2,
                expect.anything(),
                '1',
                'sw:end_phase',
                expect.anything(),
                expect.objectContaining({
                    reportFailureFeedback: true,
                    feedbackSource: 'online-ai-watchdog',
                }),
            );
        } finally {
            resolutionSpy.mockRestore();
            executeSpy.mockRestore();
        }
    });
    it('online AI watchdog 对 manifest 明确禁用 AI 的游戏应忽略残留 seatControllers', async () => {
        const gameId = 'watchdog-no-ai-game';
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-splendor-manifest-no-ai', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main1',
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'stale-splendor-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            gameManifests: {
                [gameId]: {
                    ai: {
                        capture: true,
                        localAi: false,
                        remoteAi: false,
                    },
                },
            },
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

        await serverInternal.loadMatch('match-watchdog-splendor-manifest-no-ai');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        executeSpy.mockRestore();
    });
    it('online AI watchdog 在 Splendor 未开局时不得代 AI 执行动作或写失败反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-splendor-pregame-noop', {
            initialState: {
                G: {
                    core: {
                        hostStarted: false,
                        currentPlayer: '1',
                    },
                    sys: {
                        phase: 'main1',
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
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'splendor' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('splendor')],
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

        await serverInternal.loadMatch('match-watchdog-splendor-pregame-noop');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        executeSpy.mockRestore();
    });
    it('online AI watchdog 在 Splendor turn0 / unknown-phase 残态下不得写 legal_action_unavailable 反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-splendor-unknown-phase-noop', {
            initialState: {
                G: {
                    core: {
                        currentPlayer: '1',
                    },
                    sys: {
                        phase: '',
                        turnNumber: 0,
                        eventStream: { nextId: 94 },
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
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'splendor' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('splendor')],
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

        await serverInternal.loadMatch('match-watchdog-splendor-unknown-phase-noop');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        executeSpy.mockRestore();
    });
    it('online AI watchdog fallback 到 ADVANCE_PHASE 前应校验当前仍是 AI 回合，避免误推进 human 回合', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-advance-guard-blocked', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-advance-guard-blocked');
        expect(match).toBeTruthy();

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        });
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:advance-guard',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:advance-guard',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: 'advance-guard-test',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        const progressMarker = buildAiProgressMarker(match.state);

        try {
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                tracker,
                candidate,
                progressMarker,
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            );
        } finally {
            resolutionSpy.mockRestore();
            executeSpy.mockRestore();
        }

        expect(executeSpy).not.toHaveBeenCalled();
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-advance-guard-blocked',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('advance_guard_blocked'),
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('legal-action-only');
        expect(snapshot.blockerFingerprint).toContain('main2');
        expect(snapshot.trackerKey).toBe('advance-guard-test');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('legal-action-only');
        expect(actionLog.blockerFingerprint).toContain('main2');
        expect(actionLog.trackerKey).toBe('advance-guard-test');
    });
    it('online AI watchdog 执行多命令 legal-action 时，第一条命令若已交回 human，应停止后续命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-legal-action-owner-changed', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main2',
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

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
                executedCommandTypes: string[];
            }>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-action-owner-changed');
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'watchdog-multi-command-owner-changed',
                source: 'local-ai',
                action: {
                    actionId: 'multi-command-owner-changed',
                    kind: 'advance-phase',
                    label: '模拟 AI 连续推进',
                    commands: [
                        { type: 'ADVANCE_PHASE', payload: {} },
                        { type: 'ADVANCE_PHASE', payload: {} },
                    ],
                },
            },
        });
        const executed: string[] = [];
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
            expect(playerID).toBe('1');
            executed.push(commandType);
            if (executed.length === 1) {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
            }
            return true;
        });

        try {
            const result = await serverInternal.tryRecoverOnlineAiWithLegalAction(
                match,
                {
                    playerId: '1',
                    reason: 'active-turn',
                    legalActionOnly: true,
                    fingerprintHint: 'active-turn-legal-only:1:main2:multi',
                    resolution: {
                        playerId: '1',
                        attemptKey: 'force-end-turn:1:active-turn-legal-only:1:main2:multi',
                        source: 'local-ai',
                        action: {
                            actionId: 'force-end-turn:active-turn-legal-only:1:main2:multi',
                            kind: 'force-end-turn',
                            label: '服务端代 AI 收口',
                            commands: [],
                        },
                    },
                },
                {
                    key: 'legal-action-owner-changed',
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

            expect(result.applied).toBe(true);
            expect(result.resolved).toBe(true);
            expect(result.executedCommandTypes).toEqual(['ADVANCE_PHASE']);
            expect(executed).toEqual(['ADVANCE_PHASE']);
            expect(match.state.core.activePlayerId).toBe('0');
        } finally {
            resolutionSpy.mockRestore();
            executeSpy.mockRestore();
        }
    });
    it('online AI watchdog 不得在当前轮到 human 时误触发恢复', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-human-guard', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

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

        await serverInternal.loadMatch('match-watchdog-human-guard');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在 AI 当前阶段卡在 human 可见交互时不得误发 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-human-visible-interaction', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'human-choice-1',
                        '0',
                        'human choice',
                        [{
                            id: 'move-base',
                            label: '移动基地',
                            value: { targetId: 'base-2' },
                        }],
                        {
                            sourceId: 'pirate_first_mate_choose_base',
                            targetType: 'base',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

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

        await serverInternal.loadMatch('match-watchdog-human-visible-interaction');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 面对 human owner 的 compare-roll 可见特例时，不得因 contestant seat 也能看见 current 而误接管', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-human-owned-compare-roll-visible', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-human-owner-1',
                        '0',
                        {
                            title: 'compareRoll.gunslingerDuel.title',
                            sourceId: 'gunslinger_showdown',
                            contestants: [
                                { playerId: '0', roll: 6, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                { playerId: '1', roll: 2, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                            ],
                            resultTextKey: 'compareRoll.gunslingerDuel.win',
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: true } },
                            ],
                        },
                    ),
                    queue: [],
                    isBlocked: false,
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

        await serverInternal.loadMatch('match-watchdog-human-owned-compare-roll-visible');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(resolveDispatchSpy).not.toHaveBeenCalled();
        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 应以当前状态座位控制权为准，不得用旧 AI 配置抢走真人可见交互', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'defensiveRoll',
            interaction: {
                current: createSimpleChoice(
                    'human-state-choice-1',
                    '1',
                    '真人当前选项',
                    [{
                        id: 'reroll-die-1',
                        label: '重掷骰子',
                        value: { dieId: 1 },
                    }],
                    {
                        sourceId: 'dicethrone-human-state-interaction',
                        targetType: 'die',
                    },
                ),
                queue: [],
                isBlocked: false,
            },
        });
        initialState.G.core = {
            ...initialState.G.core,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'human' },
            },
        };

        await storage.createMatch('match-watchdog-state-human-overrides-stale-ai', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
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

        await serverInternal.loadMatch('match-watchdog-state-human-overrides-stale-ai');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(resolveDispatchSpy).not.toHaveBeenCalled();
        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在缺失 interaction id 的 AI 交互上应先取消交互，避免误发 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-missing-interaction-id', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            options: [],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

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

        const match = await serverInternal.loadMatch('match-watchdog-missing-interaction-id');
        const executed: string[] = [];
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            executed.push(commandType);
            expect(playerID).toBe('1');

            if (commandType === 'SYS_INTERACTION_CANCEL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                return false;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy).toHaveBeenCalled();
            expect(executed[0]).toBe('SYS_INTERACTION_CANCEL');
            expect(executed).not.toContain('ADVANCE_PHASE');
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('main1');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-missing-interaction-id',
                playerId: '1',
                incidentKind: 'force-end-turn-success',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                trackerKey?: string;
                blockerFingerprint?: string | null;
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(typeof snapshot.blockerFingerprint).toBe('string');
            expect(snapshot.blockerFingerprint).toContain('defensiveRoll');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(typeof actionLog.blockerFingerprint).toBe('string');
            expect(actionLog.blockerFingerprint).toContain('defensiveRoll');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            executeSpy.mockRestore();
        }
    });
    it('online AI watchdog 缺少 enableAi 标记时仍应根据 seatControllers 启动', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-stale-seat-controllers', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main2',
            }),
            metadata: {
                ...createOnlineAiRecoveryMetadata(),
                setupData: {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                    },
                },
            },
        });

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

        const match = await serverInternal.loadMatch('match-watchdog-stale-seat-controllers');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType !== 'ADVANCE_PHASE') {
                return false;
            }
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'main1',
                    turnNumber: (activeMatch.state.sys?.turnNumber ?? 0) + 1,
                },
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '0',
                    currentPlayerIndex: 0,
                },
            };
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).toHaveBeenCalled();
        expect(match.state.core.activePlayerId).toBe('0');
        expect(match.state.sys.phase).toBe('main1');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-stale-seat-controllers',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            trackerKey?: string;
            blockerFingerprint?: string | null;
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('4|main2|1|0');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('4|main2|1|0');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
    it('online AI watchdog 在 enableAi=false 时不得根据残留 seatControllers 推进真人座位', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-ai-disabled-stale-seat-controllers', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main2',
            }),
            metadata: {
                ...createOnlineAiRecoveryMetadata(),
                setupData: {
                    enableAi: false,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                    },
                },
            },
        });

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

        const match = await serverInternal.loadMatch('match-watchdog-ai-disabled-stale-seat-controllers');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(true);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(match.state.core.activePlayerId).toBe('1');
        expect(match.state.sys.phase).toBe('main2');
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在 AI 当前阶段遇到 human 响应窗口时，不应代替真人强关', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-human-during-ai-phase', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1', // AI 回合
                phase: 'main2',
                responseWindow: {
                    current: {
                        id: 'rw-1',
                        windowType: 'test',
                        responderQueue: ['0'], // 轮到 human 响应
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

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

        const match = await serverInternal.loadMatch('match-watchdog-response-window-human-during-ai-phase');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(match.state.sys.responseWindow.current).toMatchObject({
            id: 'rw-1',
            responderQueue: ['0'],
            currentResponderIndex: 0,
        });
        expect(match.state.sys.phase).toBe('main2');
        expect(match.state.core.activePlayerId).toBe('1');
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 在 human 自己回合的 human 响应窗口中不应强制关窗', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-human-own-turn', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
                responseWindow: {
                    current: {
                        id: 'rw-human-own-turn',
                        windowType: 'test',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

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

        const match = await serverInternal.loadMatch('match-watchdog-response-window-human-own-turn');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(match.state.sys.responseWindow.current).toMatchObject({
            id: 'rw-human-own-turn',
            responderQueue: ['0'],
            currentResponderIndex: 0,
        });
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
});
