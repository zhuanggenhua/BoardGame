import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { createInitialSystemState, executePipeline } from '../../pipeline';
import * as aiModule from '../../ai';
import diceThroneEngineConfig from '../../../games/dicethrone/game';
import { createHeroMatchup, createQueuedRandom } from '../../../games/dicethrone/__tests__/test-utils';
import {
    InMemoryStorage,
    MockIO,
    MockSocket,
    createEngineConfig,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    nextTick,
} from './helpers/serverTestHarness';

describe('online AI immediate server-side execution', () => {
    it('online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-faction-select-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '2',
                        currentPlayerIndex: 2,
                        turnOrder: ['0', '1', '2', '3'],
                        hostStarted: false,
                        factionSelection: {
                            takenFactions: ['aliens', 'pirates'],
                            playerSelections: {
                                '0': ['aliens'],
                                '1': ['pirates'],
                                '2': [],
                                '3': [],
                            },
                            completedPlayers: [],
                        },
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
            metadata: {
                gameName: 'test-game',
                players: {
                    '0': { name: '玩家0', credentials: 'cred-0', isConnected: false },
                    '1': { name: 'AI 1', credentials: 'cred-1', isConnected: false },
                    '2': { name: 'AI 2', credentials: 'cred-2', isConnected: false },
                    '3': { name: 'AI 3', credentials: 'cred-3', isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                        '2': { type: 'local-ai' },
                        '3': { type: 'local-ai' },
                    },
                },
            },
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '2',
                action: {
                    actionId: 'select-faction:robots',
                    kind: 'select-faction',
                    label: '选择派系 robots',
                    commands: [{
                        type: 'SELECT_FACTION',
                        payload: { factionId: 'robots' },
                    }],
                },
                attemptKey: 'watchdog-faction-select-step-1',
                source: 'local-ai',
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...createEngineConfig(),
                onlineAiRecovery: {
                    publicPregameLegalActionPhases: ['factionSelect'],
                    shouldTreatActionAsManualSetupSelection: () => false,
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

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('2');
            expect(commandType).toBe('SELECT_FACTION');
            expect(payload).toEqual({ factionId: 'robots' });

            const core = activeMatch.state.core as {
                factionSelection: {
                    takenFactions: string[];
                    playerSelections: Record<string, string[]>;
                    completedPlayers: string[];
                };
            };

            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '3',
                    currentPlayerIndex: 3,
                    factionSelection: {
                        ...core.factionSelection,
                        takenFactions: [...core.factionSelection.takenFactions, 'robots'],
                        playerSelections: {
                            ...core.factionSelection.playerSelections,
                            '2': ['robots'],
                        },
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
            const match = await serverInternal.loadMatch('match-watchdog-faction-select-legal-action');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual(['SELECT_FACTION']);
            expect(match.state.core.activePlayerId).toBe('3');
            expect(match.state.sys.phase).toBe('factionSelect');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-faction-select-legal-action',
                playerId: '2',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                trackerKey?: string;
                blockerFingerprint?: string | null;
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('active-turn-legal-only');
            expect(snapshot.blockerFingerprint).toContain('factionSelect');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('active-turn-legal-only');
            expect(actionLog.blockerFingerprint).toContain('factionSelect');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 DiceThrone 普通 setup 阶段应代普通 AI 选择角色', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const setupData = {
            enableAi: true,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 1000 },
            },
        };
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([1]);
        const setupCore = diceThroneEngineConfig.domain.setup(playerIds, random, setupData);
        const setupState = {
            core: setupCore,
            sys: {
                ...createInitialSystemState(playerIds, diceThroneEngineConfig.systems, 'match-watchdog-dicethrone-setup-character'),
                phase: 'setup',
            },
        };
        const humanSelectionResult = executePipeline(
            {
                domain: diceThroneEngineConfig.domain,
                systems: diceThroneEngineConfig.systems,
            },
            setupState,
            {
                type: 'SELECT_CHARACTER',
                playerId: '0',
                payload: { characterId: 'tianshi' },
                timestamp: Date.now(),
            } as any,
            random,
            playerIds,
        );

        expect(humanSelectionResult.success).toBe(true);
        expect((humanSelectionResult.state.core as any).selectedCharacters['0']).toBe('tianshi');
        expect((humanSelectionResult.state.core as any).selectedCharacters['1']).toBe('unselected');

        await storage.createMatch('match-watchdog-dicethrone-setup-character', {
            initialState: {
                G: humanSelectionResult.state as any,
                _stateID: 1,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [diceThroneEngineConfig],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
        };
        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-setup-character');

        for (let step = 0; step < 4; step += 1) {
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
        }

        const selectedCharacters = match.state.core.selectedCharacters as Record<string, string>;
        expect(selectedCharacters['0']).toBe('tianshi');
        expect(selectedCharacters['1']).not.toBe('unselected');
        expect(match.state.core.players['1'].characterId).toBe(selectedCharacters['1']);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-dicethrone-setup-character',
            playerId: '1',
            incidentKind: 'legal-action-recovered',
            status: 'resolved',
        }));
    });
    it('DiceThrone 在线普通 AI 应在人类选角命令成功后立即由服务端继续选角，不依赖 watchdog 轮询', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const setupData = {
            enableAi: true,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 1000 },
            },
        };
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([1]);
        const setupCore = diceThroneEngineConfig.domain.setup(playerIds, random, setupData);
        const setupState = {
            core: setupCore,
            sys: {
                ...createInitialSystemState(playerIds, diceThroneEngineConfig.systems, 'match-dicethrone-immediate-online-ai-setup-character'),
                phase: 'setup',
            },
        };

        expect((setupState.core as any).selectedCharacters['0']).toBe('unselected');
        expect((setupState.core as any).selectedCharacters['1']).toBe('unselected');

        await storage.createMatch('match-dicethrone-immediate-online-ai-setup-character', {
            initialState: {
                G: setupState as any,
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [diceThroneEngineConfig],
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => (
                latestMetadata.players[playerID]?.credentials === credentials
            ),
            // 关闭周期轮询，确保本用例只验证“命令成功后的即时服务端 AI 执行入口”。
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 8000,
        });
        server.start();

        const socket = new MockSocket('socket-dicethrone-immediate-online-ai-setup-character');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-dicethrone-immediate-online-ai-setup-character', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit(
            'command',
            'match-dicethrone-immediate-online-ai-setup-character',
            'SELECT_CHARACTER',
            { characterId: 'tianshi' },
            'cred-0',
        );
        await nextTick();
        await nextTick();

        const persisted = await storage.fetch('match-dicethrone-immediate-online-ai-setup-character', { state: true });
        const selectedCharacters = (persisted.state?.G as any).core.selectedCharacters as Record<string, string>;
        expect(selectedCharacters['0']).toBe('tianshi');
        expect(selectedCharacters['1']).not.toBe('unselected');
        expect(((persisted.state?.G as any).core.players['1'] as { characterId?: string }).characterId)
            .toBe(selectedCharacters['1']);
    });
    it('DiceThrone 在线普通 AI 应在人类同步进房后继续既有 setup 卡点，不依赖 watchdog 轮询', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const setupData = {
            enableAi: true,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 1000 },
            },
        };
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([1]);
        const setupCore = diceThroneEngineConfig.domain.setup(playerIds, random, setupData);
        const setupState = {
            core: setupCore,
            sys: {
                ...createInitialSystemState(playerIds, diceThroneEngineConfig.systems, 'match-dicethrone-sync-online-ai-setup-character'),
                phase: 'setup',
            },
        };
        const humanSelectionResult = executePipeline(
            {
                domain: diceThroneEngineConfig.domain,
                systems: diceThroneEngineConfig.systems,
            },
            setupState,
            {
                type: 'SELECT_CHARACTER',
                playerId: '0',
                payload: { characterId: 'tianshi' },
                timestamp: Date.now(),
            } as any,
            random,
            playerIds,
        );

        expect(humanSelectionResult.success).toBe(true);
        expect((humanSelectionResult.state.core as any).selectedCharacters['0']).toBe('tianshi');
        expect((humanSelectionResult.state.core as any).selectedCharacters['1']).toBe('unselected');

        await storage.createMatch('match-dicethrone-sync-online-ai-setup-character', {
            initialState: {
                G: humanSelectionResult.state as any,
                _stateID: 1,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [diceThroneEngineConfig],
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => (
                latestMetadata.players[playerID]?.credentials === credentials
            ),
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 8000,
        });
        server.start();

        const socket = new MockSocket('socket-dicethrone-sync-online-ai-setup-character');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-dicethrone-sync-online-ai-setup-character', '0', 'cred-0');
        await nextTick();
        await nextTick();

        const persisted = await storage.fetch('match-dicethrone-sync-online-ai-setup-character', { state: true });
        const selectedCharacters = (persisted.state?.G as any).core.selectedCharacters as Record<string, string>;
        expect(selectedCharacters['0']).toBe('tianshi');
        expect(selectedCharacters['1']).not.toBe('unselected');
        expect(((persisted.state?.G as any).core.players['1'] as { characterId?: string }).characterId)
            .toBe(selectedCharacters['1']);
    });
    it('DiceThrone 在线普通 AI 应在人类回合 defensiveRoll 立即连续掷骰并确认，不被同阶段去重截断', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const setupData = {
            enableAi: true,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 1000 },
            },
        };
        const playerIds = ['0', '1'];
        const defensiveState = createHeroMatchup('tianshi', 'artificer')(
            playerIds,
            createQueuedRandom([1, 2, 3, 4, 5, 6]),
        ) as any;
        defensiveState.core.seatControllers = setupData.seatControllers;
        defensiveState.core.activePlayerId = '0';
        defensiveState.core.currentPlayerIndex = 0;
        defensiveState.core.turnNumber = 1;
        defensiveState.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            settlementStage: 'preDamage',
            isDefendable: true,
            sourceAbilityId: 'holy-radiance',
            isUltimate: false,
            damageResolved: false,
            resolvedDamage: 0,
            statusEffectsAppliedThisAttack: {},
            attackDiceFaceCounts: {},
            attackDiceValues: [3, 4, 3, 2, 5],
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            preDefenseResolved: true,
            defenseAbilityId: 'tinker',
        };
        defensiveState.core.activatingAbilityId = 'tinker';
        defensiveState.core.rollCount = 0;
        defensiveState.core.rollLimit = 1;
        defensiveState.core.rollDiceCount = 4;
        defensiveState.core.rollConfirmed = false;
        defensiveState.sys.phase = 'defensiveRoll';
        defensiveState.sys.turnNumber = 0;
        defensiveState.sys.interaction = { current: undefined, queue: [], isBlocked: false };
        defensiveState.sys.responseWindow = { current: undefined };

        await storage.createMatch('match-dicethrone-immediate-online-ai-defense', {
            initialState: {
                G: defensiveState,
                _stateID: 1,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [diceThroneEngineConfig],
            // 关闭周期轮询，确保本用例只验证“命令成功后的即时服务端 AI 执行入口”。
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryMaxStepsPerSlice: 3,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiImmediateExecution: (match: any, trigger: 'command-succeeded' | 'sync') => Promise<void>;
        };
        const match = await serverInternal.loadMatch('match-dicethrone-immediate-online-ai-defense');

        await serverInternal.runOnlineAiImmediateExecution(match, 'command-succeeded');

        expect(match.state.core.rollCount).toBe(1);
        expect(match.state.core.rollConfirmed).toBe(true);
        expect(match.state.sys.phase).toBe('main2');
        expect(match.state.core.activePlayerId).toBe('0');
    });
    it('Summoner Wars 即时服务端 AI 可见动作应等待 minimumActionDelayMs 后再执行', async () => {
        vi.useFakeTimers();
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-summonerwars-visible-ai-delay', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'draw',
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'summonerwars',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', minimumActionDelayMs: 1000 } as any,
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'summonerwars:advance-phase:draw',
                        kind: 'advance-phase',
                        label: '结束抽牌阶段',
                        commands: [{
                            type: 'ADVANCE_PHASE',
                            payload: {},
                        }],
                        metadata: {
                            phase: 'draw',
                            visibleStepDelayPolicy: 'visible',
                        },
                    },
                    attemptKey: 'summonerwars-visible-delay',
                    source: 'local-ai',
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('summonerwars')],
            onlineAiRecoveryTickMs: 0,
        });
        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiImmediateExecution: (match: any, trigger: 'command-succeeded' | 'sync') => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: unknown,
            ) => Promise<boolean>;
        };
        const match = await serverInternal.loadMatch('match-summonerwars-visible-ai-delay');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ADVANCE_PHASE');
            expect(payload).toEqual({});
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
                    eventStream: { nextId: 2 },
                },
            };
            activeMatch.stateID += 1;
            return true;
        });

        try {
            const runPromise = serverInternal.runOnlineAiImmediateExecution(match, 'sync');
            await Promise.resolve();
            await Promise.resolve();

            await vi.advanceTimersByTimeAsync(999);
            expect(executeSpy).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            await runPromise;

            expect(executeSpy).toHaveBeenCalledTimes(1);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.executing).toBe(false);
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
            vi.useRealTimers();
        }
    });
    it('Summoner Wars 即时服务端 AI 同一自动片段里的连续可见动作应按上次可见完成时间重新等待', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-19T00:00:00.000Z'));
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const delayTracePayloads: Array<Record<string, unknown>> = [];

        await storage.createMatch('match-summonerwars-visible-action-interval', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main1',
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'summonerwars',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', minimumActionDelayMs: 1000 } as any,
                },
            }),
        });

        const makeVisibleAction = (suffix: string, commandType: string): aiModule.AiResolution => ({
            playerId: '1',
            action: {
                actionId: `summonerwars:summon-unit:${suffix}`,
                kind: 'summon-unit',
                label: `召唤单位 ${suffix}`,
                commands: [{ type: commandType, payload: { suffix } }],
            },
            attemptKey: `summonerwars-visible-action-interval:${suffix}`,
            source: 'local-ai',
        });
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: makeVisibleAction('one', 'VISIBLE_ONE'),
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: makeVisibleAction('two', 'VISIBLE_TWO'),
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
            });
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation((marker?: unknown, payload?: unknown) => {
            if (
                marker === '[ONLINE_AI_BATCH_TRACE]'
                && payload
                && typeof payload === 'object'
            ) {
                delayTracePayloads.push(payload as Record<string, unknown>);
            }
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('summonerwars')],
            onlineAiRecoveryTickMs: 0,
        });
        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiImmediateExecution: (match: any, trigger: 'command-succeeded' | 'sync') => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: unknown,
            ) => Promise<boolean>;
        };
        const match = await serverInternal.loadMatch('match-summonerwars-visible-action-interval');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');
            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '1',
                    currentPlayerIndex: 1,
                    lastVisibleCommandType: commandType,
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 0) + 1 },
                },
            };
            activeMatch.stateID += 1;
            return true;
        });

        const waitForDelayPlanCount = async (count: number) => {
            for (let attempt = 0; attempt < 10; attempt += 1) {
                const plans = delayTracePayloads.filter((payload) => (
                    payload.stage === 'online-ai-delay-started'
                    || payload.stage === 'online-ai-delay-skipped'
                ));
                if (plans.length >= count) {
                    return plans;
                }
                await Promise.resolve();
                await vi.advanceTimersByTimeAsync(0);
            }
            return delayTracePayloads.filter((payload) => (
                payload.stage === 'online-ai-delay-started'
                || payload.stage === 'online-ai-delay-skipped'
            ));
        };

        try {
            const runPromise = serverInternal.runOnlineAiImmediateExecution(match, 'sync');
            await Promise.resolve();
            await Promise.resolve();

            await vi.advanceTimersByTimeAsync(999);
            expect(executeSpy).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(0);
            expect(executeSpy).toHaveBeenCalledTimes(1);

            const delayPlans = await waitForDelayPlanCount(2);
            expect(delayPlans).toHaveLength(2);
            expect(delayPlans[0]).toMatchObject({
                stage: 'online-ai-delay-started',
                actionKind: 'summon-unit',
                remainingDelayMs: 1000,
                lastVisibleActionAt: null,
            });
            expect(delayPlans[1]).toMatchObject({
                stage: 'online-ai-delay-started',
                actionKind: 'summon-unit',
                remainingDelayMs: 1000,
                visibleStepElapsedMs: 0,
            });
            expect(delayPlans[1].lastVisibleActionAt).toEqual(expect.any(Number));

            await vi.advanceTimersByTimeAsync(999);
            expect(executeSpy).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(1);
            await runPromise;
            expect(executeSpy).toHaveBeenCalledTimes(2);

            expect(match.state.core.lastVisibleCommandType).toBe('VISIBLE_TWO');
        } finally {
            executeSpy.mockRestore();
            consoleSpy.mockRestore();
            resolutionSpy.mockRestore();
            vi.useRealTimers();
        }
    });
    it('即时服务端 AI 在 SmashUp 公开选阵营阶段应走正常 AI 动作，不写恢复反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-smashup-immediate-ai-faction-select', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                        factionSelection: {
                            takenFactions: ['aliens'],
                            playerSelections: {
                                '0': ['aliens'],
                                '1': [],
                            },
                            completedPlayers: [],
                        },
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
                gameName: 'smashup',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'select-faction:robots',
                        kind: 'select-faction',
                        label: '选择派系 robots',
                        commands: [{
                            type: 'su:select_faction',
                            payload: { factionId: 'robots' },
                        }],
                    },
                    attemptKey: 'immediate-smashup-faction-select',
                    source: 'local-ai',
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
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
            runOnlineAiImmediateExecution: (match: any, trigger: 'command-succeeded' | 'sync') => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean; reportFailureFeedback?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('su:select_faction');
            expect(payload).toEqual({ factionId: 'robots' });

            const core = activeMatch.state.core as {
                factionSelection: {
                    takenFactions: string[];
                    playerSelections: Record<string, string[]>;
                    completedPlayers: string[];
                };
            };

            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '0',
                    currentPlayerIndex: 0,
                    factionSelection: {
                        ...core.factionSelection,
                        takenFactions: [...core.factionSelection.takenFactions, 'robots'],
                        playerSelections: {
                            ...core.factionSelection.playerSelections,
                            '1': ['robots'],
                        },
                    },
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: 2 },
                },
            };
            activeMatch.stateID += 1;
            return true;
        });
        const recoverySpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction');

        try {
            const match = await serverInternal.loadMatch('match-smashup-immediate-ai-faction-select');
            await serverInternal.runOnlineAiImmediateExecution(match, 'command-succeeded');

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual(['su:select_faction']);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.core.factionSelection.playerSelections['1']).toEqual(['robots']);
            expect(recoverySpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                incidentKind: 'legal-action-recovered',
            }));
        } finally {
            recoverySpy.mockRestore();
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('即时服务端 AI 执行拿不到合法动作且游戏允许强制恢复时，应立即回落到恢复序列', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const matchID = 'match-immediate-ai-fallback-force-sequence';
        await storage.createMatch(matchID, {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'smashup',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', minimumActionDelayMs: 0 },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
        });
        const serverInternal = server as unknown as {
            loadMatch: (id: string) => Promise<any>;
            runOnlineAiImmediateExecution: (match: any, trigger: 'command-succeeded' | 'sync') => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: null;
                executedCommandTypes: string[];
                outcome: 'no-legal-action';
                reportedAction: null;
            }>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };
        const match = await serverInternal.loadMatch(matchID);
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        });
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockResolvedValue({
            applied: false,
            resolved: false,
            blockedReason: null,
            executedCommandTypes: [],
            outcome: 'no-legal-action',
            reportedAction: null,
        });
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ADVANCE_PHASE');
            expect(payload).toEqual({});
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
            return true;
        });

        try {
            await serverInternal.runOnlineAiImmediateExecution(match, 'sync');

            expect(tryRecoverSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executeSpy).toHaveBeenCalledTimes(1);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.executing).toBe(false);
        } finally {
            tryRecoverSpy.mockRestore();
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
});
