import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import type { GameEngineConfig } from '../engineConfig';
import { createSimpleChoice } from '../../systems/InteractionSystem';
import type { MatchMetadata, StoredMatchState } from '../storage';
import smashUpEngineConfig from '../../../games/smashup/game';
import {
    InMemoryStorage,
    MockIO,
    MockSocket,
    createEngineConfig,
    createMetadata,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    createStoredState,
    hasEvent,
    nextTick,
} from './helpers/serverTestHarness';

describe('GameTransportServer（setup / sync / lifecycle）', () => {
    it('setupMatch 应返回初始化后的随机游标', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const randomEngine: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (_playerIds, random) => ({
                    currentPlayer: '0',
                    initRoll: random.d(6),
                }),
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [randomEngine],
        });

        const result = await server.setupMatch('match-seed', 'test-game', ['0', '1'], 'seed-1');

        expect(result).toBeTruthy();
        expect(result?.randomCursor).toBeGreaterThan(0);
    });

    it('setupMatch 应把 AI 座位写入 undo 状态', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
        });

        const result = await server.setupMatch('match-ai-undo', 'test-game', ['0', '1'], 'seed-ai', {
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        });

        expect(result?.state.sys.undo.aiSeatIds).toEqual(['1']);
    });

    it('setupMatch 应透传 setupData 到 domain.setup', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const setupData = { firstPlayerId: '1', tag: 'from-test' };
        let receivedSetupData: unknown;

        const engineWithSetupData: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (_playerIds, _random, incomingSetupData) => {
                    receivedSetupData = incomingSetupData;
                    return { currentPlayer: '0' };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineWithSetupData],
        });

        const result = await server.setupMatch(
            'match-setup-data',
            'test-game',
            ['0', '1'],
            'seed-2',
            setupData,
        );

        expect(result).toBeTruthy();
        expect(receivedSetupData).toEqual(setupData);
    });

    it('setupMatch 在混合人机且未显式指定先手时，应默认把真人座位排到 setup 先手', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let receivedPlayerIds: string[] = [];

        const engineWithPlayerCapture: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (incomingPlayerIds) => {
                    receivedPlayerIds = [...incomingPlayerIds];
                    return { currentPlayer: incomingPlayerIds[0] };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineWithPlayerCapture],
        });

        const result = await server.setupMatch(
            'match-setup-human-first-default',
            'test-game',
            ['0', '1'],
            'seed-human-first-default',
            {
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'human' },
                },
            },
        );

        expect(result).toBeTruthy();
        expect(receivedPlayerIds).toEqual(['1', '0']);
    });

    it('setupMatch 在显式 firstPlayerId/turnOrder 存在时，不应覆盖调用方顺序', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let receivedPlayerIds: string[] = [];

        const engineWithPlayerCapture: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (incomingPlayerIds) => {
                    receivedPlayerIds = [...incomingPlayerIds];
                    return { currentPlayer: incomingPlayerIds[0] };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineWithPlayerCapture],
        });

        await server.setupMatch(
            'match-setup-human-first-explicit',
            'test-game',
            ['0', '1'],
            'seed-human-first-explicit',
            {
                firstPlayerId: '0',
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'human' },
                },
            },
        );

        expect(receivedPlayerIds).toEqual(['0', '1']);
    });

    it('offline adjudication should use generic cancel for unknown interaction kinds', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let lastCommandType: string | undefined;

        const initialState: StoredMatchState = {
            G: {
                core: { currentPlayer: '0' },
                sys: {
                    phase: 'main',
                    turnNumber: 1,
                    interaction: {
                        current: {
                            id: 'custom-interaction-1',
                            kind: 'game-card-interaction',
                            playerId: '0',
                            data: {
                                id: 'interaction-1',
                                playerId: '0',
                                sourceCardId: 'card-1',
                            },
                        },
                        queue: [],
                    },
                },
            },
            _stateID: 0,
            randomSeed: 'seed',
            randomCursor: 0,
        };

        await storage.createMatch('match-offline-unknown-kind', {
            initialState,
            metadata: createMetadata('offline-cred'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                validate: (_state, command) => {
                    lastCommandType = command.type;
                    return { valid: true };
                },
                execute: () => [],
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<unknown>;
            runOfflineAdjudication: (match: unknown, playerID: string) => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-offline-unknown-kind');
        expect(match).toBeTruthy();

        await serverInternal.runOfflineAdjudication(match, '0');

        expect(lastCommandType).toBe('SYS_INTERACTION_CANCEL');
    });

    it.each([
        ['simple-choice', 'SYS_INTERACTION_CANCEL'],
    ])('离线裁决默认表应按 kind=%s 映射命令 %s', async (kind, expectedCommand) => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let lastCommandType: string | undefined;

        const initialState: StoredMatchState = {
            G: {
                core: { currentPlayer: '0' },
                sys: {
                    phase: 'main',
                    turnNumber: 1,
                    interaction: {
                        current: {
                            id: `interaction-${kind}`,
                            kind,
                            playerId: '0',
                            data: {},
                        },
                        queue: [],
                    },
                },
            },
            _stateID: 0,
            randomSeed: 'seed',
            randomCursor: 0,
        };

        await storage.createMatch(`match-offline-${kind}`, {
            initialState,
            metadata: createMetadata('offline-cred'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                validate: (_state, command) => {
                    lastCommandType = command.type;
                    return { valid: true };
                },
                execute: () => [],
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<unknown>;
            runOfflineAdjudication: (match: unknown, playerID: string) => Promise<void>;
        };

        const match = await serverInternal.loadMatch(`match-offline-${kind}`);
        expect(match).toBeTruthy();

        await serverInternal.runOfflineAdjudication(match, '0');

        expect(lastCommandType).toBe(expectedCommand ?? undefined);
    });

    it.each([
        ['custom-token-response', 'CUSTOM_SKIP_TOKEN_RESPONSE'],
        ['custom-bonus-dice', null],
    ])('离线裁决应使用游戏配置映射 kind=%s 为命令 %s', async (kind, expectedCommand) => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let lastCommandType: string | undefined;

        const initialState: StoredMatchState = {
            G: {
                core: { currentPlayer: '0' },
                sys: {
                    phase: 'main',
                    turnNumber: 1,
                    interaction: {
                        current: {
                            id: `interaction-${kind}`,
                            kind,
                            playerId: '0',
                            data: {},
                        },
                        queue: [],
                    },
                },
            },
            _stateID: 0,
            randomSeed: 'seed',
            randomCursor: 0,
        };

        await storage.createMatch(`match-offline-configured-${kind}`, {
            initialState,
            metadata: createMetadata('offline-cred'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                validate: (_state, command) => {
                    lastCommandType = command.type;
                    return { valid: true };
                },
                execute: () => [],
            },
            onlineAiRecovery: {
                offlineAdjudicationCommandByInteractionKind: {
                    'custom-token-response': 'CUSTOM_SKIP_TOKEN_RESPONSE',
                    'custom-bonus-dice': null,
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<unknown>;
            runOfflineAdjudication: (match: unknown, playerID: string) => Promise<void>;
        };

        const match = await serverInternal.loadMatch(`match-offline-configured-${kind}`);
        expect(match).toBeTruthy();

        await serverInternal.runOfflineAdjudication(match, '0');

        expect(lastCommandType).toBe(expectedCommand ?? undefined);
    });

    it('sync should reject stale credentials after metadata refresh', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialMetadata = createMetadata('old-cred');
        await storage.createMatch('match-1', {
            initialState: createStoredState(),
            metadata: initialMetadata,
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

        const oldSocket = new MockSocket('socket-old');
        io.gameNamespace.connectSocket(oldSocket);
        await oldSocket.clientEmit('sync', 'match-1', '0', 'old-cred');
        expect(hasEvent(oldSocket, 'state:sync')).toBe(true);

        const refreshedMetadata: MatchMetadata = {
            ...initialMetadata,
            players: {
                ...initialMetadata.players,
                '0': {
                    ...initialMetadata.players['0'],
                    credentials: 'new-cred',
                },
            },
            updatedAt: Date.now(),
        };
        await storage.setMetadata('match-1', refreshedMetadata);

        // 不更新 active match 缓存，验证 sync 会主动读取存储层最新 metadata。
        await oldSocket.clientEmit('sync', 'match-1', '0', 'old-cred');
        expect(hasEvent(oldSocket, 'error', (args) => args[1] === 'unauthorized')).toBe(true);

        const newSocket = new MockSocket('socket-new');
        io.gameNamespace.connectSocket(newSocket);
        await newSocket.clientEmit('sync', 'match-1', '0', 'new-cred');
        expect(hasEvent(newSocket, 'state:sync')).toBe(true);
        expect(hasEvent(newSocket, 'error', (args) => args[1] === 'unauthorized')).toBe(false);
    });

    it('临时 UI 事件只从已同步玩家转发给同局其他连接', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-ui-event', {
            initialState: createStoredState(),
            metadata: {
                gameName: 'test-game',
                players: {
                    '0': {
                        name: '玩家0',
                        credentials: 'cred-0',
                        isConnected: false,
                    },
                    '1': {
                        name: '玩家1',
                        credentials: 'cred-1',
                        isConnected: false,
                    },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
                setupData: {},
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => (
                metadata.players[playerID]?.credentials === credentials
            ),
        });
        server.start();

        const senderSocket = new MockSocket('socket-ui-event-sender');
        const receiverSocket = new MockSocket('socket-ui-event-receiver');
        const unsyncedSocket = new MockSocket('socket-ui-event-unsynced');
        io.gameNamespace.connectSocket(senderSocket);
        io.gameNamespace.connectSocket(receiverSocket);
        io.gameNamespace.connectSocket(unsyncedSocket);

        await unsyncedSocket.clientEmit('ui:event', 'match-ui-event', 'the-gang:chip-drag', { action: 'move' });
        expect(hasEvent(senderSocket, 'ui:event')).toBe(false);
        expect(hasEvent(receiverSocket, 'ui:event')).toBe(false);

        await senderSocket.clientEmit('sync', 'match-ui-event', '0', 'cred-0');
        await receiverSocket.clientEmit('sync', 'match-ui-event', '1', 'cred-1');
        senderSocket.sent.length = 0;
        receiverSocket.sent.length = 0;
        unsyncedSocket.sent.length = 0;

        const payload = {
            action: 'move',
            chip: 2,
            round: 1,
            x: 0.45,
            y: 0.5,
        };
        await senderSocket.clientEmit('ui:event', 'match-ui-event', 'the-gang:chip-drag', payload);

        expect(hasEvent(senderSocket, 'ui:event')).toBe(false);
        expect(hasEvent(unsyncedSocket, 'ui:event')).toBe(false);
        expect(hasEvent(receiverSocket, 'ui:event', (args) => {
            const [matchID, event] = args;
            return matchID === 'match-ui-event'
                && typeof event === 'object'
                && event !== null
                && (event as { type?: unknown }).type === 'the-gang:chip-drag'
                && (event as { playerId?: unknown }).playerId === '0'
                && (event as { payload?: unknown }).payload === payload
                && typeof (event as { sentAt?: unknown }).sentAt === 'number';
        })).toBe(true);
    });

    it('sync should prefer auth metadata provider for active matches', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-auth-provider', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-auth-provider'),
        });

        const fetchSpy = vi.spyOn(storage, 'fetch');
        const authMetadataSpy = vi.spyOn(storage, 'fetchAuthMetadata');

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-auth-provider');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-auth-provider', '0', 'cred-auth-provider');

        fetchSpy.mockClear();
        authMetadataSpy.mockClear();
        socket.sent.length = 0;

        await socket.clientEmit('sync', 'match-auth-provider', '0', 'cred-auth-provider');

        expect(authMetadataSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(hasEvent(socket, 'state:sync')).toBe(true);
    });

    it('sync should not wait for metadata persistence before emitting state:sync', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-sync-fast', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-fast'),
        });

        let resolvePersist: (() => void) | null = null;
        const persistBlocked = new Promise<void>((resolve) => {
            resolvePersist = resolve;
        });
        const setMetadataSpy = vi.spyOn(storage, 'setMetadata').mockImplementation(async (matchID, metadata) => {
            await persistBlocked;
            return InMemoryStorage.prototype.setMetadata.call(storage, matchID, metadata);
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

        const socket = new MockSocket('socket-sync-fast');
        io.gameNamespace.connectSocket(socket);

        const syncPromise = socket.clientEmit('sync', 'match-sync-fast', '0', 'cred-fast');
        await nextTick();

        expect(hasEvent(socket, 'state:sync')).toBe(true);
        expect(setMetadataSpy).toHaveBeenCalledTimes(1);

        resolvePersist?.();
        await syncPromise;
    });

    it('sync 发出的 state:sync 必须按 seat view 过滤 owner-only prompt，非 owner 不得直接拿到私有交互', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-sync-smashup-private-prompt', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-owner-only-secret',
                        '0',
                        '选择要弃掉的手牌',
                        [
                            { id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } },
                            { id: 'hand-b', label: '手牌 B', value: { cardUid: 'hand-b' } },
                        ],
                        {
                            sourceId: 'super_spies_secret_agent_discard',
                            targetType: 'hand',
                        },
                    ),
                    queue: [
                        createSimpleChoice(
                            'smashup-owner-only-secret-queued',
                            '0',
                            '继续选择要弃掉的手牌',
                            [
                                { id: 'queued-hand-a', label: '排队手牌 A', value: { cardUid: 'queued-hand-a' } },
                            ],
                            {
                                sourceId: 'super_spies_secret_agent_discard_queue',
                                targetType: 'hand',
                            },
                        ),
                    ],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [smashUpEngineConfig],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const ownerSocket = new MockSocket('socket-owner-private-prompt');
        const otherSocket = new MockSocket('socket-other-private-prompt');
        io.gameNamespace.connectSocket(ownerSocket);
        io.gameNamespace.connectSocket(otherSocket);

        await ownerSocket.clientEmit('sync', 'match-sync-smashup-private-prompt', '0', 'cred-0');
        await otherSocket.clientEmit('sync', 'match-sync-smashup-private-prompt', '1', 'cred-1');

        const ownerSync = ownerSocket.sent.find((event) => event.event === 'state:sync');
        const otherSync = otherSocket.sent.find((event) => event.event === 'state:sync');
        expect(ownerSync).toBeDefined();
        expect(otherSync).toBeDefined();

        const ownerView = ownerSync?.args[1] as any;
        const otherView = otherSync?.args[1] as any;

        expect(ownerView?.sys?.interaction?.current?.id).toBe('smashup-owner-only-secret');
        expect(ownerView?.sys?.interaction?.current?.playerId).toBe('0');
        expect(ownerView?.sys?.interaction?.queue?.[0]?.id).toBe('smashup-owner-only-secret-queued');
        expect(ownerView?.sys?.interaction?.queue?.[0]?.playerId).toBe('0');
        expect(otherView?.sys?.interaction?.current).toBeUndefined();
        expect(otherView?.sys?.interaction?.queue).toEqual([]);
    });

    it('sync 发出的 state:sync 对 spectator 也必须过滤 owner-only prompt，不得退回完整 shared state', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-sync-smashup-spectator-private-prompt', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-owner-only-secret-spectator-sync',
                        '0',
                        '选择要弃掉的手牌',
                        [
                            { id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } },
                            { id: 'hand-b', label: '手牌 B', value: { cardUid: 'hand-b' } },
                        ],
                        {
                            sourceId: 'super_spies_secret_agent_discard',
                            targetType: 'hand',
                        },
                    ),
                    queue: [
                        createSimpleChoice(
                            'smashup-owner-only-secret-spectator-sync-queued',
                            '0',
                            '继续选择要弃掉的手牌',
                            [
                                { id: 'queued-hand-a', label: '排队手牌 A', value: { cardUid: 'queued-hand-a' } },
                            ],
                            {
                                sourceId: 'super_spies_secret_agent_discard_queue',
                                targetType: 'hand',
                            },
                        ),
                    ],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [smashUpEngineConfig],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const spectatorSocket = new MockSocket('socket-spectator-private-prompt');
        io.gameNamespace.connectSocket(spectatorSocket);

        await spectatorSocket.clientEmit('sync', 'match-sync-smashup-spectator-private-prompt', null);

        const spectatorSync = spectatorSocket.sent.find((event) => event.event === 'state:sync');
        expect(spectatorSync).toBeDefined();

        const spectatorView = spectatorSync?.args[1] as any;
        expect(spectatorView?.sys?.interaction?.current).toBeUndefined();
        expect(spectatorView?.sys?.interaction?.queue).toEqual([]);
        expect(spectatorView?.sys?.interaction?.isBlocked).toBe(true);
    });

    it('stateSynchronizer.broadcast 的 state:patch 也必须按 seat view 隔离 owner-only prompt，非 owner 不得收到同一私有交互补丁', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'playCards',
        });
        await storage.createMatch('match-broadcast-smashup-private-patch', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [smashUpEngineConfig],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const ownerSocket = new MockSocket('socket-owner-private-patch');
        const otherSocket = new MockSocket('socket-other-private-patch');
        io.gameNamespace.connectSocket(ownerSocket);
        io.gameNamespace.connectSocket(otherSocket);

        await ownerSocket.clientEmit('sync', 'match-broadcast-smashup-private-patch', '0', 'cred-0');
        await otherSocket.clientEmit('sync', 'match-broadcast-smashup-private-patch', '1', 'cred-1');
        ownerSocket.sent.length = 0;
        otherSocket.sent.length = 0;

        const match = (server as any).activeMatches.get('match-broadcast-smashup-private-patch');
        expect(match).toBeDefined();
        expect(match.connections.get('0')?.size ?? 0).toBe(1);
        expect(match.connections.get('1')?.size ?? 0).toBe(1);

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: createSimpleChoice(
                        'smashup-owner-only-private-patch',
                        '0',
                        '选择要弃掉的手牌',
                        [
                            { id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } },
                            { id: 'hand-b', label: '手牌 B', value: { cardUid: 'hand-b' } },
                        ],
                        {
                            sourceId: 'super_spies_secret_agent_discard',
                            targetType: 'hand',
                        },
                    ),
                    queue: [
                        createSimpleChoice(
                            'smashup-owner-only-private-patch-queued',
                            '0',
                            '继续选择要弃掉的手牌',
                            [
                                { id: 'queued-hand-a', label: '排队手牌 A', value: { cardUid: 'queued-hand-a' } },
                            ],
                            {
                                sourceId: 'super_spies_secret_agent_discard_queue',
                                targetType: 'hand',
                            },
                        ),
                    ],
                    isBlocked: false,
                },
                eventStream: {
                    ...(match.state.sys?.eventStream ?? {}),
                    nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                },
            },
        };
        match.stateID += 1;

        (server as any).stateSynchronizer.broadcast(match);

        const ownerPatch = ownerSocket.sent.find((event) => event.event === 'state:patch' || event.event === 'state:update');
        const otherPatch = otherSocket.sent.find((event) => event.event === 'state:patch' || event.event === 'state:update');
        expect(ownerPatch).toBeDefined();
        if (ownerPatch?.event === 'state:update') {
            const ownerView = ownerPatch.args[1] as any;
            expect(ownerView?.sys?.interaction?.current?.id).toBe('smashup-owner-only-private-patch');
            expect(ownerView?.sys?.interaction?.current?.playerId).toBe('0');
            expect(ownerView?.sys?.interaction?.queue?.[0]?.id).toBe('smashup-owner-only-private-patch-queued');
        } else {
            const ownerPatches = ownerPatch?.args[1] as Array<{ op?: string; path?: string; value?: any }> | undefined;
            expect(ownerPatches).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/current',
                    value: expect.objectContaining({
                        id: 'smashup-owner-only-private-patch',
                        playerId: '0',
                    }),
                }),
                expect.objectContaining({
                    path: '/sys/interaction/queue/0',
                    value: expect.objectContaining({
                        id: 'smashup-owner-only-private-patch-queued',
                        playerId: '0',
                    }),
                }),
            ]));
        }

        expect(otherPatch).toBeDefined();
        if (otherPatch?.event === 'state:update') {
            const otherView = otherPatch.args[1] as any;
            expect(otherView?.sys?.interaction?.current).toBeUndefined();
            expect(otherView?.sys?.interaction?.queue).toEqual([]);
        } else {
            const otherPatches = otherPatch?.args[1] as Array<{ op?: string; path?: string; value?: any }> | undefined;
            expect(otherPatches).not.toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/current',
                }),
            ]));
            expect(otherPatches).not.toEqual(expect.arrayContaining([
                expect.objectContaining({
                    value: expect.objectContaining({
                        id: 'smashup-owner-only-private-patch',
                    }),
                }),
            ]));
            expect(otherPatches).not.toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/queue/0',
                }),
            ]));
        }
    });

    it('stateSynchronizer.broadcast 发给 spectator 的 state:update/state:patch 也必须过滤 owner-only prompt', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'playCards',
        });
        await storage.createMatch('match-broadcast-smashup-spectator-private-patch', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [smashUpEngineConfig],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const ownerSocket = new MockSocket('socket-owner-spectator-private-patch');
        const spectatorSocket = new MockSocket('socket-spectator-private-patch');
        io.gameNamespace.connectSocket(ownerSocket);
        io.gameNamespace.connectSocket(spectatorSocket);

        await ownerSocket.clientEmit('sync', 'match-broadcast-smashup-spectator-private-patch', '0', 'cred-0');
        await spectatorSocket.clientEmit('sync', 'match-broadcast-smashup-spectator-private-patch', null);
        ownerSocket.sent.length = 0;
        spectatorSocket.sent.length = 0;

        const match = (server as any).activeMatches.get('match-broadcast-smashup-spectator-private-patch');
        expect(match).toBeDefined();
        expect(match.connections.get('0')?.size ?? 0).toBe(1);
        expect(match.spectatorSockets.size).toBe(1);

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: createSimpleChoice(
                        'smashup-owner-only-private-patch-spectator',
                        '0',
                        '选择要弃掉的手牌',
                        [
                            { id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } },
                            { id: 'hand-b', label: '手牌 B', value: { cardUid: 'hand-b' } },
                        ],
                        {
                            sourceId: 'super_spies_secret_agent_discard',
                            targetType: 'hand',
                        },
                    ),
                    queue: [
                        createSimpleChoice(
                            'smashup-owner-only-private-patch-spectator-queued',
                            '0',
                            '继续选择要弃掉的手牌',
                            [
                                { id: 'queued-hand-a', label: '排队手牌 A', value: { cardUid: 'queued-hand-a' } },
                            ],
                            {
                                sourceId: 'super_spies_secret_agent_discard_queue',
                                targetType: 'hand',
                            },
                        ),
                    ],
                    isBlocked: false,
                },
                eventStream: {
                    ...(match.state.sys?.eventStream ?? {}),
                    nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                },
            },
        };
        match.stateID += 1;

        (server as any).stateSynchronizer.broadcast(match);

        const spectatorUpdate = spectatorSocket.sent.find((event) => event.event === 'state:patch' || event.event === 'state:update');
        expect(spectatorUpdate).toBeDefined();

        if (spectatorUpdate?.event === 'state:update') {
            const spectatorView = spectatorUpdate.args[1] as any;
            expect(spectatorView?.sys?.interaction?.current).toBeUndefined();
            expect(spectatorView?.sys?.interaction?.queue).toEqual([]);
            expect(spectatorView?.sys?.interaction?.isBlocked).toBe(true);
        } else {
            const spectatorPatches = spectatorUpdate?.args[1] as Array<{ op?: string; path?: string; value?: any }> | undefined;
            expect(spectatorPatches).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/isBlocked',
                    value: true,
                }),
            ]));
            expect(spectatorPatches).not.toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/current',
                }),
            ]));
            expect(spectatorPatches).not.toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/queue/0',
                }),
            ]));
        }
    });

    it('owner-only 交互关闭后，stateSynchronizer.broadcast 必须把非 owner shared view 的 isBlocked 明确收口为 false', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-broadcast-smashup-hidden-block-release', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-owner-only-block-release',
                        '0',
                        '选择要弃掉的手牌',
                        [
                            { id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } },
                        ],
                        {
                            sourceId: 'super_spies_secret_agent_discard',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [smashUpEngineConfig],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const ownerSocket = new MockSocket('socket-owner-block-release');
        const otherSocket = new MockSocket('socket-other-block-release');
        io.gameNamespace.connectSocket(ownerSocket);
        io.gameNamespace.connectSocket(otherSocket);

        await ownerSocket.clientEmit('sync', 'match-broadcast-smashup-hidden-block-release', '0', 'cred-0');
        await otherSocket.clientEmit('sync', 'match-broadcast-smashup-hidden-block-release', '1', 'cred-1');

        const otherSync = otherSocket.sent.find((event) => event.event === 'state:sync');
        expect(otherSync).toBeDefined();
        const otherInitialView = otherSync?.args[1] as any;
        expect(otherInitialView?.sys?.interaction?.current).toBeUndefined();
        expect(otherInitialView?.sys?.interaction?.queue).toEqual([]);
        expect(otherInitialView?.sys?.interaction?.isBlocked).toBe(true);

        ownerSocket.sent.length = 0;
        otherSocket.sent.length = 0;

        const match = (server as any).activeMatches.get('match-broadcast-smashup-hidden-block-release');
        expect(match).toBeDefined();

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: {
                    ...(match.state.sys?.eventStream ?? {}),
                    nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                },
            },
        };
        match.stateID += 1;

        (server as any).stateSynchronizer.broadcast(match);

        const otherUpdate = otherSocket.sent.find((event) => event.event === 'state:patch' || event.event === 'state:update');
        expect(otherUpdate).toBeDefined();

        if (otherUpdate?.event === 'state:update') {
            const otherView = otherUpdate.args[1] as any;
            expect(otherView?.sys?.interaction?.current).toBeUndefined();
            expect(otherView?.sys?.interaction?.queue).toEqual([]);
            expect(otherView?.sys?.interaction?.isBlocked).toBe(false);
        } else {
            const otherPatches = otherUpdate?.args[1] as Array<{ op?: string; path?: string; value?: any }> | undefined;
            expect(otherPatches).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/isBlocked',
                    value: false,
                }),
            ]));
            expect(otherPatches).not.toEqual(expect.arrayContaining([
                expect.objectContaining({
                    path: '/sys/interaction/current',
                }),
            ]));
        }
    });

    it('离座后断开旧连接，使用新凭证可继续同一 seat 进度', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialMetadata = createMetadata('seat-cred-old');
        await storage.createMatch('match-2', {
            initialState: createStoredState(),
            metadata: initialMetadata,
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

        const oldSocket = new MockSocket('socket-seat-old');
        io.gameNamespace.connectSocket(oldSocket);
        await oldSocket.clientEmit('sync', 'match-2', '0', 'seat-cred-old');
        expect(hasEvent(oldSocket, 'state:sync')).toBe(true);

        const leftMetadata: MatchMetadata = {
            ...initialMetadata,
            players: {
                ...initialMetadata.players,
                '0': {
                    isConnected: false,
                },
            },
            updatedAt: Date.now(),
        };
        await storage.setMetadata('match-2', leftMetadata);
        server.updateMatchMetadata('match-2', leftMetadata);
        server.disconnectPlayer('match-2', '0', { disconnectSockets: true });
        await nextTick();
        expect(oldSocket.disconnected).toBe(true);

        const rejoinMetadata: MatchMetadata = {
            ...leftMetadata,
            players: {
                ...leftMetadata.players,
                '0': {
                    name: '接替玩家',
                    credentials: 'seat-cred-new',
                    isConnected: false,
                },
            },
            updatedAt: Date.now(),
        };
        await storage.setMetadata('match-2', rejoinMetadata);
        server.updateMatchMetadata('match-2', rejoinMetadata);

        const newSocket = new MockSocket('socket-seat-new');
        io.gameNamespace.connectSocket(newSocket);
        await newSocket.clientEmit('sync', 'match-2', '0', 'seat-cred-new');
        expect(hasEvent(newSocket, 'state:sync')).toBe(true);
        expect(hasEvent(newSocket, 'error', (args) => args[1] === 'unauthorized')).toBe(false);
    });

    it('销毁活跃房间时，应先向房间内连接发送 match_not_found 再断开', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-destroyed', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
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

        const socket = new MockSocket('socket-destroyed-room');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-destroyed', '0', 'cred-0');
        expect(hasEvent(socket, 'state:sync')).toBe(true);

        server.unloadMatch('match-destroyed', { disconnectSockets: true });
        await nextTick();

        expect(hasEvent(socket, 'error', (args) => args[0] === 'match-destroyed' && args[1] === 'match_not_found')).toBe(true);
        expect(socket.disconnected).toBe(true);
    });

    it('已卸载房间的在途后台命令不应继续写回状态', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-unloaded-inflight', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });
        const setStateSpy = vi.spyOn(storage, 'setState');

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

        const socket = new MockSocket('socket-unloaded-inflight');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-unloaded-inflight', '0', 'cred-0');

        const activeMatch = (server as unknown as {
            activeMatches: Map<string, unknown>;
        }).activeMatches.get('match-unloaded-inflight');
        expect(activeMatch).toBeTruthy();
        expect(server.unloadMatch('match-unloaded-inflight')).toBe(true);

        const success = await (server as unknown as {
            executeCommandInternal: (
                match: unknown,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        }).executeCommandInternal(activeMatch, '0', 'TEST_CMD', {});

        expect(success).toBe(false);
        expect(setStateSpy).not.toHaveBeenCalled();
    });

    it('不应通过 /game socket 暴露 test:injectState', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialState = createStoredState();
        await storage.createMatch('match-no-socket-inject', {
            initialState,
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

        const socket = new MockSocket('socket-no-inject');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-no-socket-inject', '0', 'cred-0');
        expect(hasEvent(socket, 'state:sync')).toBe(true);

        const injectedState = createStoredState().G as { core: { currentPlayer: string } };
        injectedState.core.currentPlayer = '1';

        await socket.clientEmit('test:injectState', 'match-no-socket-inject', injectedState);

        const persisted = await storage.fetch('match-no-socket-inject', { state: true });
        expect((persisted.state?.G as { core: { currentPlayer: string } }).core.currentPlayer).toBe('0');
        expect(hasEvent(socket, 'test:injectState:success')).toBe(false);
        expect(hasEvent(socket, 'test:injectState:error')).toBe(false);
    });

});
