import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import {
    FailingTrainingDataRecorder,
    InMemoryStorage,
    MockIO,
    MockSocket,
    MockTrainingDataRecorder,
    createEngineConfig,
    createEngineConfigWithGameOver,
    createMetadata,
    createOnlineAiRecoveryMetadata,
    createStoredState,
    hasEvent,
    nextTick,
} from './helpers/serverTestHarness';

describe('GameTransportServer（command side effects / training capture）', () => {
    it('成功命令后应采集训练决策样本', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const recorder = new MockTrainingDataRecorder();

        await storage.createMatch('match-train-1', {
            initialState: createStoredState(),
            metadata: {
                ...createMetadata('cred-0'),
                createdAt: Date.now() - 1000,
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithGameOver()],
            trainingDataRecorder: recorder,
            trainingDataMinCompletedMatchDurationMs: 1,
            rulesVersion: 'test-rules-v1',
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-train-1');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-1', '0', 'cred-0');
        await socket.clientEmit('command', 'match-train-1', 'TEST_CMD', { foo: 'bar' }, 'cred-0');

        expect(recorder.completedMatches).toHaveLength(1);
        expect(recorder.completedMatches[0]).toHaveLength(1);
        expect(recorder.completedMatches[0][0]).toMatchObject({
            rulesVersion: 'test-rules-v1',
            gameId: 'test-game',
            matchId: 'match-train-1',
            playerId: '0',
            seatControllerType: 'human',
            stateIdBefore: 0,
            stateIdAfter: 1,
            command: {
                type: 'TEST_CMD',
                payload: { foo: 'bar' },
            },
            legalActions: [],
        });
        expect(recorder.completedMatches[0][0].preState).toBeTruthy();
        expect(recorder.completedMatches[0][0].postState).toBeTruthy();
    });

    it('成功命令后应通知调用方刷新房间摘要', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const onCommandSucceeded = vi.fn();

        await storage.createMatch('match-summary-refresh', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-summary'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onCommandSucceeded,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-summary-refresh');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-summary-refresh', '0', 'cred-summary');
        await socket.clientEmit('command', 'match-summary-refresh', 'TEST_CMD', { foo: 'bar' }, 'cred-summary');

        expect(onCommandSucceeded).toHaveBeenCalledTimes(1);
        expect(onCommandSucceeded).toHaveBeenCalledWith('match-summary-refresh', 'test-game', 'TEST_CMD');
    });

    it('教程 AI 裸 RESPOND 经过 socket command 入口时，应自动补当前 interactionId', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-tutorial-ai-command-inject', {
            initialState: {
                G: {
                    core: { currentPlayer: '0' },
                    sys: {
                        phase: 'main',
                        turnNumber: 1,
                        tutorial: { active: true },
                        interaction: {
                            current: {
                                id: 'tutorial-choice-1',
                                playerId: '1',
                            },
                            queue: [],
                            isBlocked: false,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const serverInternal = server as unknown as {
            handleCommand: (
                matchID: string,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };
        const handleCommandSpy = vi.spyOn(serverInternal, 'handleCommand').mockResolvedValue(true);

        const socket = new MockSocket('socket-tutorial-ai-command-inject');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-tutorial-ai-command-inject', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit(
            'command',
            'match-tutorial-ai-command-inject',
            'SYS_INTERACTION_RESPOND',
            {
                optionId: 'skip',
                __tutorialPlayerId: '1',
                __tutorialAiCommand: true,
            },
            'cred-0',
        );

        expect(handleCommandSpy).toHaveBeenCalledTimes(1);
        expect(handleCommandSpy).toHaveBeenCalledWith(
            'match-tutorial-ai-command-inject',
            '1',
            'SYS_INTERACTION_RESPOND',
            {
                interactionId: 'tutorial-choice-1',
                optionId: 'skip',
            },
        );
    });

    it('在线 socket command 入口不应接受 __internalPlayerId 覆盖执行者', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-online-ignore-internal-player-id', {
            initialState: {
                G: {
                    core: { currentPlayer: '0' },
                    sys: {
                        phase: 'main',
                        turnNumber: 1,
                        tutorial: { active: false },
                        interaction: { queue: [], isBlocked: false },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const serverInternal = server as unknown as {
            handleCommand: (
                matchID: string,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };
        const handleCommandSpy = vi.spyOn(serverInternal, 'handleCommand').mockResolvedValue(true);

        const socket = new MockSocket('socket-online-ignore-internal-player-id');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-online-ignore-internal-player-id', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit(
            'command',
            'match-online-ignore-internal-player-id',
            'ROLL_DICE',
            {
                keepIds: [0],
                __internalPlayerId: '1',
            },
            'cred-0',
        );

        expect(handleCommandSpy).toHaveBeenCalledTimes(1);
        expect(handleCommandSpy).toHaveBeenCalledWith(
            'match-online-ignore-internal-player-id',
            '0',
            'ROLL_DICE',
            {
                keepIds: [0],
            },
        );
    });

    it('在线非教程命令即使带 __tutorialPlayerId，也不应覆盖已认证玩家', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-online-ignore-tutorial-player-id', {
            initialState: {
                G: {
                    core: { currentPlayer: '0' },
                    sys: {
                        phase: 'main',
                        turnNumber: 1,
                        tutorial: { active: true },
                        interaction: { queue: [], isBlocked: false },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const serverInternal = server as unknown as {
            handleCommand: (
                matchID: string,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };
        const handleCommandSpy = vi.spyOn(serverInternal, 'handleCommand').mockResolvedValue(true);

        const socket = new MockSocket('socket-online-ignore-tutorial-player-id');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-online-ignore-tutorial-player-id', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit(
            'command',
            'match-online-ignore-tutorial-player-id',
            'ROLL_DICE',
            {
                keepIds: [0],
                __tutorialPlayerId: '1',
            },
            'cred-0',
        );

        expect(handleCommandSpy).toHaveBeenCalledTimes(1);
        expect(handleCommandSpy).toHaveBeenCalledWith(
            'match-online-ignore-tutorial-player-id',
            '0',
            'ROLL_DICE',
            {
                keepIds: [0],
            },
        );
    });

    it('training recorder 失败不应影响命令执行', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-train-fail', {
            initialState: createStoredState(),
            metadata: {
                ...createMetadata('cred-0'),
                createdAt: Date.now() - 1000,
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithGameOver()],
            trainingDataRecorder: new FailingTrainingDataRecorder(),
            trainingDataMinCompletedMatchDurationMs: 1,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-train-fail');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-fail', '0', 'cred-0');
        await socket.clientEmit('command', 'match-train-fail', 'TEST_CMD', { foo: 'bar' }, 'cred-0');
        await nextTick();

        const persisted = await storage.fetch('match-train-fail', { state: true });
        expect(persisted.state?._stateID).toBe(1);
        expect(hasEvent(socket, 'error')).toBe(false);
    });

    it('未完成对局即使超过时长门槛也不得提交正式训练数据', async () => {
        vi.useFakeTimers();
        const now = Date.now();
        const minDurationMs = 10 * 60 * 1000;

        try {
            const io = new MockIO();
            const storage = new InMemoryStorage();
            const recorder = new MockTrainingDataRecorder();

            await storage.createMatch('match-train-duration', {
                initialState: createStoredState(),
                metadata: {
                    ...createMetadata('cred-duration'),
                    createdAt: now,
                    updatedAt: now,
                },
            });

            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                trainingDataRecorder: recorder,
                trainingDataMinCompletedMatchDurationMs: minDurationMs,
                authenticate: async (_matchID, playerID, credentials, metadata) => {
                    return metadata.players[playerID]?.credentials === credentials;
                },
            });
            server.start();

            const socket = new MockSocket('socket-train-duration');
            io.gameNamespace.connectSocket(socket);
            await socket.clientEmit('sync', 'match-train-duration', '0', 'cred-duration');
            await socket.clientEmit('command', 'match-train-duration', 'TEST_CMD', { foo: 'bar' }, 'cred-duration');

            expect(recorder.completedMatches).toHaveLength(0);

            vi.setSystemTime(now + minDurationMs + 1000);
            await socket.clientEmit('command', 'match-train-duration', 'TEST_CMD_2', { foo: 'baz' }, 'cred-duration');

            expect(recorder.completedMatches).toHaveLength(0);
            expect(recorder.pending.get('match-train-duration')?.map((sample) => sample.command.type))
                .toEqual(['TEST_CMD', 'TEST_CMD_2']);
        } finally {
            vi.useRealTimers();
        }
    });

    it('完整对局低于时长门槛时不得提交正式训练数据', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const recorder = new MockTrainingDataRecorder();

        await storage.createMatch('match-train-too-short', {
            initialState: createStoredState(),
            metadata: {
                ...createMetadata('cred-too-short'),
                createdAt: Date.now(),
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithGameOver()],
            trainingDataRecorder: recorder,
            trainingDataMinCompletedMatchDurationMs: 10 * 60 * 1000,
            authenticate: async (_matchID, playerID, credentials, metadata) => (
                metadata.players[playerID]?.credentials === credentials
            ),
        });
        server.start();

        const socket = new MockSocket('socket-train-too-short');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-too-short', '0', 'cred-too-short');
        await socket.clientEmit('command', 'match-train-too-short', 'TEST_CMD', {}, 'cred-too-short');

        expect(recorder.completedMatches).toHaveLength(0);
        expect(recorder.pending.has('match-train-too-short')).toBe(false);
    });

    it('默认应跳过 AI seat 的训练样本，只记录真人 seat', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const recorder = new MockTrainingDataRecorder();

        await storage.createMatch('match-train-human-only', {
            initialState: createStoredState(),
            metadata: {
                ...createMetadata('cred-ai'),
                createdAt: Date.now() - 1000,
                players: {
                    '0': { name: '玩家0', credentials: 'cred-ai', isConnected: false },
                    '1': { name: 'AI 玩家1', credentials: 'cred-ai-seat-1', isConnected: false },
                },
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
            trainingDataRecorder: recorder,
            trainingDataMinCompletedMatchDurationMs: 1,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-train-human-only');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-human-only', '0', 'cred-ai');
        await socket.clientEmit('command', 'match-train-human-only', 'TEST_CMD', { foo: 'bar' }, 'cred-ai');

        expect(recorder.pending.get('match-train-human-only')).toHaveLength(1);
        expect(recorder.pending.get('match-train-human-only')?.[0]).toMatchObject({
            playerId: '0',
            seatControllerType: 'human',
        });

        await server.executeCommand('match-train-human-only', '1', 'AI_CMD', { auto: true });

        expect(recorder.pending.get('match-train-human-only')).toHaveLength(1);
    });

    it('manifest 声明 all-seats 时应继续采集 AI seat 样本', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const recorder = new MockTrainingDataRecorder();

        await storage.createMatch('match-train-all-seats', {
            initialState: createStoredState(),
            metadata: {
                ...createMetadata('cred-ai-all'),
                createdAt: Date.now() - 1000,
                players: {
                    '0': { name: '玩家0', credentials: 'cred-ai-all', isConnected: false },
                    '1': { name: 'AI 玩家1', credentials: 'cred-ai-seat-1', isConnected: false },
                },
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
            gameManifests: {
                'test-game': {
                    ai: {
                        capture: true,
                        capturePolicy: 'all-seats',
                        trainingMinCompletedDurationMs: 1,
                        localAi: true,
                        remoteAi: true,
                    },
                },
            },
            trainingDataRecorder: recorder,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-train-all-seats');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-all-seats', '0', 'cred-ai-all');
        await server.executeCommand('match-train-all-seats', '1', 'AI_CMD', { auto: true });

        expect(recorder.pending.get('match-train-all-seats')).toHaveLength(1);
        expect(recorder.pending.get('match-train-all-seats')?.[0]).toMatchObject({
            playerId: '1',
            seatControllerType: 'local-ai',
            command: {
                type: 'AI_CMD',
                payload: { auto: true },
            },
        });
    });

});
