import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { canManualForceAdvanceAfterConfirmedRoll } from '../onlineAiWatchdogSequenceHelpers';
import { buildAiProgressMarker } from '../onlineAiRecovery';
import * as aiModule from '../../ai';
import {
    InMemoryStorage,
    MockIO,
    MockSocket,
    createEngineConfig,
    createEngineConfigWithId,
    createMetadata,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    createStoredState,
    hasEvent,
} from './helpers/serverTestHarness';

describe('GameTransportServer（command authority / manual AI control）', () => {
    it('batch expectedStateID 落后于服务端权威 stateID 时，应拒绝为 stale_state 且不执行命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-batch-stale-state', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-batch-stale-state');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-batch-stale-state', '0', 'cred-0');
        await socket.clientEmit('command', 'match-batch-stale-state', 'TEST_CMD', { foo: 'fresh' }, 'cred-0');

        socket.sent.length = 0;

        await socket.clientEmit(
            'batch',
            'match-batch-stale-state',
            'batch-stale-1',
            [{ type: 'TEST_CMD', payload: { foo: 'stale' } }],
            'cred-0',
            { expectedStateID: 0 },
        );

        expect(hasEvent(socket, 'batch:rejected', (args) => args[1] === 'batch-stale-1' && args[2] === 'stale_state')).toBe(true);

        const persisted = await storage.fetch('match-batch-stale-state', { state: true });
        expect(persisted.state?._stateID).toBe(1);
    });

    it('human 单条命令 expectedStateID 落后于服务端权威 stateID 时，应拒绝为 stale_state 且不执行旧命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const executeSpy = vi.fn(() => []);
        const baseEngineConfig = createEngineConfig();

        await storage.createMatch('match-human-command-stale-state', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...baseEngineConfig,
                domain: {
                    ...baseEngineConfig.domain,
                    execute: executeSpy,
                },
            }],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-human-command-stale-state');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-human-command-stale-state', '0', 'cred-0');
        await socket.clientEmit('command', 'match-human-command-stale-state', 'TEST_CMD', { foo: 'fresh' }, 'cred-0');
        expect(executeSpy).toHaveBeenCalledTimes(1);

        socket.sent.length = 0;

        await socket.clientEmit(
            'command',
            'match-human-command-stale-state',
            'TEST_CMD',
            { foo: 'stale' },
            'cred-0',
            { expectedStateID: 0 },
        );

        expect(hasEvent(socket, 'error', (args) => args[1] === 'stale_state')).toBe(true);
        expect(executeSpy).toHaveBeenCalledTimes(1);

        const persisted = await storage.fetch('match-human-command-stale-state', { state: true });
        expect(persisted.state?._stateID).toBe(1);
    });

    it('旧浏览器 AI seat 连接不得提交正式命令，服务端应在领域管线前拒绝', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const executeSpy = vi.fn(() => []);
        const feedbackReporter = vi.fn(async () => undefined);
        const baseEngineConfig = createEngineConfig();

        await storage.createMatch('match-command-stale-ai-state', {
            initialState: createOnlineAiRecoveryState({ phase: 'playCards' }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...baseEngineConfig,
                domain: {
                    ...baseEngineConfig.domain,
                    execute: executeSpy,
                },
            }],
            authenticate: async (_matchID, playerID, credentials, metadata) => (
                metadata.players[playerID]?.credentials === credentials
            ),
            onlineAiRecoveryTickMs: 0,
            onlineAiCircuitFailureBudget: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });
        server.start();

        const socket = new MockSocket('socket-command-stale-ai-state');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-command-stale-ai-state', '1', 'cred-1');
        socket.sent.length = 0;

        socket.sent.length = 0;

        await socket.clientEmit(
            'command',
            'match-command-stale-ai-state',
            'TEST_CMD',
            { stale: true },
            'cred-1',
            {
                expectedStateID: 0,
                onlineAiAttemptKey: 'ai-stale-attempt-1',
                clientTransport: {
                    sentAt: 1000,
                    lastStateEventKind: 'patch',
                    lastStateEventStateID: 0,
                    lastStateEventAt: 900,
                    syncInFlight: false,
                    lastSyncRequestReason: null,
                    lastSyncRequestedAt: null,
                    lastPatchIssue: {
                        kind: 'discontinuity',
                        expectedStateID: 1,
                        receivedStateID: 2,
                        at: 800,
                    },
                },
            },
        );

        expect(hasEvent(socket, 'error', (args) => args[1] === 'online_ai_server_authority')).toBe(true);
        expect(executeSpy).not.toHaveBeenCalled();

        const persisted = await storage.fetch('match-command-stale-ai-state', { state: true });
        expect(persisted.state?._stateID).toBe(0);
        expect(feedbackReporter).not.toHaveBeenCalled();
    });

    it('房主只能请求服务端执行当前权威的 AI 准备选择', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-manual-setup-server-authority';
        const executeSpy = vi.fn(() => []);
        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => playerId === '1'
                ? [{
                    actionId: 'setup-select-faction-robots',
                    kind: 'setup-select-faction',
                    label: '选择 robots',
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'robots' } }],
                }]
                : [],
        });
        const metadata = createOnlineAiRecoveryMetadata({
            gameName: gameId,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        });
        metadata.setupData = {
            ...(metadata.setupData as Record<string, unknown>),
            ownerKey: 'user:owner',
        };
        metadata.players['0'].ownerKey = 'user:owner';
        await storage.createMatch('match-manual-setup-server-authority', {
            initialState: {
                G: {
                    core: { hostStarted: false, activePlayerId: '1' },
                    sys: { phase: 'factionSelect', turnNumber: 1 },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata,
        });
        const base = createEngineConfigWithId(gameId);
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...base,
                domain: { ...base.domain, execute: executeSpy },
            }],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => (
                latestMetadata.players[playerID]?.credentials === credentials
            ),
        });
        server.start();

        const socket = new MockSocket('socket-manual-setup-owner');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-manual-setup-server-authority', '0', 'cred-0');
        socket.sent.length = 0;
        await socket.clientEmit('manual-setup-selection', 'match-manual-setup-server-authority', {
            targetPlayerId: '1',
            actionKind: 'setup-select-faction',
            selectionId: 'robots',
        }, 'cred-0');

        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(executeSpy.mock.calls[0]?.[1]).toMatchObject({
            type: 'SELECT_FACTION',
            playerId: '1',
            payload: { factionId: 'robots' },
        });
        expect(hasEvent(socket, 'error')).toBe(false);
    });

    it('非房主不能请求服务端替 AI 执行准备选择', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-manual-setup-non-owner';
        const executeSpy = vi.fn(() => []);
        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [{
                actionId: 'setup-select-faction-robots',
                kind: 'setup-select-faction',
                label: '选择 robots',
                commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'robots' } }],
            }],
        });
        const metadata = createOnlineAiRecoveryMetadata({
            gameName: gameId,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
                '2': { type: 'human' },
            },
        });
        metadata.setupData = { ...(metadata.setupData as Record<string, unknown>), ownerKey: 'user:owner' };
        metadata.players['0'].ownerKey = 'user:owner';
        metadata.players['2'] = { name: '访客', credentials: 'cred-2', ownerKey: 'user:guest', isConnected: false };
        await storage.createMatch('match-manual-setup-non-owner', {
            initialState: createOnlineAiRecoveryState({ phase: 'factionSelect' }),
            metadata,
        });
        const base = createEngineConfigWithId(gameId);
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{ ...base, domain: { ...base.domain, execute: executeSpy } }],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => latestMetadata.players[playerID]?.credentials === credentials,
        });
        server.start();

        const socket = new MockSocket('socket-manual-setup-non-owner');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-manual-setup-non-owner', '2', 'cred-2');
        socket.sent.length = 0;
        await socket.clientEmit('manual-setup-selection', 'match-manual-setup-non-owner', {
            targetPlayerId: '1', actionKind: 'setup-select-faction', selectionId: 'robots',
        }, 'cred-2');

        expect(executeSpy).not.toHaveBeenCalled();
        expect(hasEvent(socket, 'error', (args) => args[1] === 'manual_setup_selection_rejected')).toBe(true);
    });

    it('未开启手动代选的 AI 座位不能被房主请求服务端代选', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-manual-setup-unchecked-ai-seat';
        const executeSpy = vi.fn(() => []);
        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => playerId === '1'
                ? [{
                    actionId: 'setup-select-faction-robots',
                    kind: 'setup-select-faction',
                    label: '选择 robots',
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'robots' } }],
                }]
                : [],
        });
        const metadata = createOnlineAiRecoveryMetadata({
            gameName: gameId,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        });
        metadata.setupData = { ...(metadata.setupData as Record<string, unknown>), ownerKey: 'user:owner' };
        metadata.players['0'].ownerKey = 'user:owner';
        await storage.createMatch('match-manual-setup-unchecked-ai-seat', {
            initialState: createOnlineAiRecoveryState({ phase: 'factionSelect' }),
            metadata,
        });
        const base = createEngineConfigWithId(gameId);
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{ ...base, domain: { ...base.domain, execute: executeSpy } }],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => latestMetadata.players[playerID]?.credentials === credentials,
        });
        server.start();

        const socket = new MockSocket('socket-manual-setup-unchecked-ai-seat');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-manual-setup-unchecked-ai-seat', '0', 'cred-0');
        socket.sent.length = 0;
        await socket.clientEmit('manual-setup-selection', 'match-manual-setup-unchecked-ai-seat', {
            targetPlayerId: '1', actionKind: 'setup-select-faction', selectionId: 'robots',
        }, 'cred-0');

        expect(executeSpy).not.toHaveBeenCalled();
        expect(hasEvent(socket, 'error', (args) => args[1] === 'manual_setup_selection_rejected')).toBe(true);
    });

    it('服务端拒绝不属于人工准备选择的 AI 命令和真人目标座位', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-manual-setup-reject-non-setup';
        const executeSpy = vi.fn(() => []);
        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => playerId === '1'
                ? [{
                    actionId: 'play-card', kind: 'play-card', label: '打出卡牌',
                    commands: [{ type: 'PLAY_CARD', payload: { cardUid: 'card-1' } }],
                }]
                : [],
        });
        const metadata = createOnlineAiRecoveryMetadata({
            gameName: gameId,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        });
        metadata.setupData = { ...(metadata.setupData as Record<string, unknown>), ownerKey: 'user:owner' };
        metadata.players['0'].ownerKey = 'user:owner';
        await storage.createMatch('match-manual-setup-reject-non-setup', {
            initialState: createOnlineAiRecoveryState({ phase: 'playCards' }),
            metadata,
        });
        const base = createEngineConfigWithId(gameId);
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{ ...base, domain: { ...base.domain, execute: executeSpy } }],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => latestMetadata.players[playerID]?.credentials === credentials,
        });
        server.start();

        const socket = new MockSocket('socket-manual-setup-reject-non-setup');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-manual-setup-reject-non-setup', '0', 'cred-0');
        socket.sent.length = 0;
        await socket.clientEmit('manual-setup-selection', 'match-manual-setup-reject-non-setup', {
            targetPlayerId: '1', actionKind: 'play-card', selectionId: 'card-1',
        }, 'cred-0');
        await socket.clientEmit('manual-setup-selection', 'match-manual-setup-reject-non-setup', {
            targetPlayerId: '0', actionKind: 'setup-select-faction', selectionId: 'robots',
        }, 'cred-0');

        expect(executeSpy).not.toHaveBeenCalled();
        expect(socket.sent.filter((item) => item.event === 'error' && item.args[1] === 'manual_setup_selection_rejected')).toHaveLength(2);
    });

    it('旧浏览器的 __manualAiSeatId payload 不得代理 AI 正式命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const executeSpy = vi.fn(() => []);
        await storage.createMatch('match-legacy-manual-ai-payload', {
            initialState: createOnlineAiRecoveryState({ phase: 'playCards' }),
            metadata: createOnlineAiRecoveryMetadata(),
        });
        const base = createEngineConfig();
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{ ...base, domain: { ...base.domain, execute: executeSpy } }],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, playerID, credentials, metadata) => metadata.players[playerID]?.credentials === credentials,
        });
        server.start();

        const socket = new MockSocket('socket-legacy-manual-ai-payload');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-legacy-manual-ai-payload', '0', 'cred-0');
        socket.sent.length = 0;
        await socket.clientEmit('command', 'match-legacy-manual-ai-payload', 'PLAY_CARD', {
            cardUid: 'card-1',
            __manualAiSeatId: '1',
        }, 'cred-0');

        expect(executeSpy).not.toHaveBeenCalled();
        expect(hasEvent(socket, 'error', (args) => args[1] === 'online_ai_server_authority')).toBe(true);
    });

    it('房主点击强制结束 AI 阶段时，服务端应按权威状态执行 watchdog 恢复', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const matchID = 'match-manual-force-end-ai-phase';
        const metadata = createOnlineAiRecoveryMetadata();
        metadata.setupData = {
            ...(metadata.setupData as Record<string, unknown>),
            ownerKey: 'user:owner',
        };
        metadata.players['0'].ownerKey = 'user:owner';

        await storage.createMatch(matchID, {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
            }),
            metadata,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => (
                latestMetadata.players[playerID]?.credentials === credentials
            ),
        });
        const serverInternal = server as unknown as {
            loadMatch: (id: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };
        server.start();

        const socket = new MockSocket('socket-manual-force-end-ai-phase');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', matchID, '0', 'cred-0');
        socket.sent.length = 0;

        const match = await serverInternal.loadMatch(matchID);
        match.state = {
            ...match.state,
            core: {
                ...match.state.core,
                activePlayerId: '1',
                currentPlayerIndex: 1,
            },
            sys: {
                ...match.state.sys,
                phase: 'main2',
                eventStream: { nextId: 1 },
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined },
            },
        };
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
                    phase: 'main2',
                    eventStream: { nextId: 2 },
                },
            };
            return true;
        });
        let ack: unknown = null;

        try {
            await socket.clientEmit('manual-force-end-ai-phase', matchID, 'cred-0', (result: unknown) => {
                ack = result;
            });

            expect(ack).toEqual({ accepted: true });
            expect(executeSpy).toHaveBeenCalledTimes(1);
            expect(hasEvent(socket, 'error')).toBe(false);
            expect(match.state.core.activePlayerId).toBe('0');
        } finally {
            executeSpy.mockRestore();
        }
    });

    it('房主点击强制结束 AI 阶段时，若 AI 回合里轮到 human 响应，应先关窗并进入攻击掷骰但不裸跳过攻击阶段', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const matchID = 'match-manual-force-end-ai-human-response-window';
        const metadata = createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' });
        metadata.setupData = {
            ...(metadata.setupData as Record<string, unknown>),
            ownerKey: 'user:owner',
        };
        metadata.players['0'].ownerKey = 'user:owner';

        await storage.createMatch(matchID, {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
            }),
            metadata,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, playerID, credentials, latestMetadata) => (
                latestMetadata.players[playerID]?.credentials === credentials
            ),
        });
        const serverInternal = server as unknown as {
            loadMatch: (id: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };
        server.start();

        const socket = new MockSocket('socket-manual-force-end-ai-human-response-window');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', matchID, '0', 'cred-0');
        socket.sent.length = 0;

        const match = await serverInternal.loadMatch(matchID);
        match.state = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'main1',
            responseWindow: {
                current: {
                    id: 'rw-manual-human-response',
                    windowType: 'afterCardPlayed',
                    sourceId: 'manual-force-end-human-response',
                    responderQueue: ['0'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        }).G;
        const executed: string[] = [];
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'idle',
                idleReason: 'human-response-window',
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'manual-force-end-advance-to-offensive-roll',
                    source: 'local-ai',
                    action: {
                        actionId: 'phase:advance:main1:offensiveRoll',
                        kind: 'advance-phase',
                        label: '推进到进攻投骰',
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'manual-force-end-roll-dice',
                    source: 'local-ai',
                    action: {
                        actionId: 'roll:dice',
                        kind: 'roll-dice',
                        label: '掷骰',
                        commands: [{ type: 'ROLL_DICE', payload: {} }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'manual-force-end-confirm-roll',
                    source: 'local-ai',
                    action: {
                        actionId: 'roll:confirm',
                        kind: 'confirm-roll',
                        label: '确认骰面',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                        metadata: { rollConfirmScope: 'main-roll' },
                    },
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'manual-force-end-complete',
            });
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            executed.push(commandType);

            if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
                expect(payload).toEqual({});
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                        eventStream: { nextId: 2 },
                    },
                };
                activeMatch.stateID += 1;
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                expect(payload).toEqual({});
                expect(activeMatch.state.sys.responseWindow?.current).toBeUndefined();
                const nextPhase = activeMatch.state.sys.phase === 'offensiveRoll'
                    ? 'main2'
                    : 'offensiveRoll';
                const nextEventId = nextPhase === 'main2' ? 6 : 3;
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: nextPhase,
                        eventStream: { nextId: nextEventId },
                    },
                };
                activeMatch.stateID += 1;
                return true;
            }

            if (commandType === 'ROLL_DICE') {
                expect(payload).toEqual({});
                expect(activeMatch.state.sys.phase).toBe('offensiveRoll');
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollCount: 1,
                        rollConfirmed: false,
                        dice: [
                            { id: 0, value: 1 },
                            { id: 1, value: 2 },
                            { id: 2, value: 3 },
                            { id: 3, value: 4 },
                            { id: 4, value: 5 },
                        ],
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 4 },
                    },
                };
                activeMatch.stateID += 1;
                return true;
            }

            if (commandType === 'CONFIRM_ROLL') {
                expect(payload).toEqual({});
                expect(activeMatch.state.sys.phase).toBe('offensiveRoll');
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollConfirmed: true,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 5 },
                    },
                };
                activeMatch.stateID += 1;
                return true;
            }

            return false;
        });
        let ack: unknown = null;

        try {
            await socket.clientEmit('manual-force-end-ai-phase', matchID, 'cred-0', (result: unknown) => {
                ack = result;
            });

            expect(ack).toEqual({ accepted: true });
            expect(executed).toEqual(['SYS_RESPONSE_WINDOW_FORCE_CLOSE', 'ADVANCE_PHASE', 'ROLL_DICE', 'CONFIRM_ROLL']);
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
            expect(match.state.sys.phase).toBe('offensiveRoll');
            expect(match.state.core.rollConfirmed).toBe(true);
            expect(match.state.core.activePlayerId).toBe('1');
            expect(hasEvent(socket, 'error')).toBe(false);
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('临时骰确认不得取得“确认后强推阶段”资格，避免攻击掷骰被连续跳过', async () => {
        expect(canManualForceAdvanceAfterConfirmedRoll({
            actionKind: 'confirm-roll',
            metadata: { rollConfirmScope: 'bonus-roll' },
        })).toBe(false);
        expect(canManualForceAdvanceAfterConfirmedRoll({
            actionKind: 'confirm-roll',
            metadata: { rollConfirmScope: 'main-roll' },
        })).toBe(true);
        expect(canManualForceAdvanceAfterConfirmedRoll({
            actionKind: 'confirm-roll',
            metadata: undefined,
        })).toBe(false);

        const io = new MockIO();
        const storage = new InMemoryStorage();
        const matchID = 'match-manual-bonus-roll-confirm-no-phase-advance';
        const metadata = createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' });

        await storage.createMatch(matchID, {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main1',
                pendingBonusDiceSettlement: {
                    id: 'bonus-main1',
                    attackerId: '1',
                    displayOnly: true,
                    dice: [{ index: 0, value: 4 }],
                },
            }),
            metadata,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
        });
        const serverInternal = server as unknown as {
            loadMatch: (id: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai'; policyId?: string }>,
                options?: { reuseExecutionLock?: boolean; allowManualImmediateAiContinuation?: boolean },
            ) => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch(matchID);
        const progressMarkerBeforeRecovery = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const executed: string[] = [];
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'manual-bonus-roll-confirm',
                    source: 'local-ai',
                    action: {
                        actionId: 'bonus-die:confirm',
                        kind: 'confirm-roll',
                        label: '确认当前奖励骰',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                        metadata: { rollConfirmScope: 'bonus-roll', bonusDiceSettlementId: 'bonus-main1' },
                    },
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
            });
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(payload).toEqual({});
            executed.push(commandType);

            if (commandType === 'CONFIRM_ROLL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        pendingBonusDiceSettlement: undefined,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
                activeMatch.stateID += 1;
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'offensiveRoll',
                        eventStream: { nextId: 3 },
                    },
                };
                activeMatch.stateID += 1;
                return true;
            }

            return false;
        });

        try {
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                {
                    key: 'manual-bonus-roll-confirm',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                },
                {
                    playerId: '1',
                    reason: 'active-turn',
                    legalActionOnly: true,
                    fingerprintHint: 'manual-bonus-roll-confirm',
                    resolution: {
                        playerId: '1',
                        attemptKey: 'manual-bonus-roll-confirm',
                        source: 'local-ai',
                        action: {
                            actionId: 'manual-bonus-roll-confirm',
                            kind: 'manual-immediate-ai-continuation',
                            label: '临时骰确认测试',
                            commands: [],
                        },
                    },
                },
                progressMarkerBeforeRecovery,
                { '1': { type: 'local-ai' } },
                { allowManualImmediateAiContinuation: true },
            );

            expect(executed).toEqual(['CONFIRM_ROLL', 'ADVANCE_PHASE']);
            expect(match.state.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(match.state.sys.phase).toBe('offensiveRoll');
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

});
