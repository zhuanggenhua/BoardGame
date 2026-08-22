import { describe, expect, it, vi } from 'vitest';
import type { Socket as IOSocket } from 'socket.io';
import type { MatchState } from '../../types';
import type { GameEngineConfig } from '../engineConfig';
import type { MatchMetadata } from '../storage';
import {
    MatchConnectionLifecycleCoordinator,
    type MatchConnectionLifecycleHooks,
    type MatchConnectionLifecycleMatch,
    type MatchConnectionSocketInfo,
} from '../matchConnectionLifecycleCoordinator';

type EmittedEvent = {
    event: string;
    args: unknown[];
};

class MockSocket {
    readonly sent: EmittedEvent[] = [];
    readonly broadcast: Array<{ room: string; event: string; args: unknown[] }> = [];
    readonly joined: string[] = [];

    constructor(readonly id: string) {}

    emit(event: string, ...args: unknown[]): void {
        this.sent.push({ event, args });
    }

    join(room: string): void {
        this.joined.push(room);
    }

    to(room: string): { emit: (event: string, ...args: unknown[]) => void } {
        return {
            emit: (event: string, ...args: unknown[]) => {
                this.broadcast.push({ room, event, args });
            },
        };
    }
}

type TestMatch = MatchConnectionLifecycleMatch & {
    syncedPlayers: Array<string | null>;
};

function createEngineConfig(overrides?: Partial<GameEngineConfig>): GameEngineConfig {
    return {
        gameId: 'test-game',
        domain: {
            setup: () => ({}),
            validate: () => ({ valid: true }),
            execute: () => [],
        },
        systems: [],
        ...overrides,
    } as unknown as GameEngineConfig;
}

function createMetadata(overrides?: Partial<MatchMetadata>): MatchMetadata {
    return {
        gameName: 'test-game',
        players: {
            '0': { name: 'Zero', credentials: 'cred-0', isConnected: false },
            '1': { name: 'One', credentials: 'cred-1', isConnected: false },
        },
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

function createMatch(matchID = 'match-1', metadata = createMetadata()): TestMatch {
    return {
        matchID,
        engineConfig: createEngineConfig(),
        state: {
            core: {},
            sys: {
                phase: 'main',
                turnNumber: 1,
                interaction: { queue: [] },
            },
        } as MatchState<unknown>,
        metadata,
        connections: new Map(),
        spectatorSockets: new Set(),
        offlineTimers: new Map(),
        syncedPlayers: [],
    };
}

function createHarness(options?: {
    activeMatch?: TestMatch;
    loadedMatch?: TestMatch;
    socketInfo?: MatchConnectionSocketInfo;
    freshMetadata?: MatchMetadata;
    controllerType?: 'human' | 'ai';
}) {
    const socketIndex = new Map<string, MatchConnectionSocketInfo>();
    if (options?.socketInfo) {
        socketIndex.set('socket-1', options.socketInfo);
    }
    const persisted: Array<{ matchID: string; metadata: MatchMetadata }> = [];
    const removed: Array<{ socketId: string; info: MatchConnectionSocketInfo }> = [];
    const immediate: Array<{ matchID: string; reason: string }> = [];
    const validated: Array<{ matchID: string; playerID: string; metadata: MatchMetadata }> = [];
    const persistFailures: Array<{ matchID: string; playerID: string; error: unknown }> = [];
    const clearedBaselines: Array<{ matchID: string; playerID: string | null }> = [];
    const disconnectedEvents: Array<{ matchID: string; playerID: string }> = [];
    const disconnectLogs: Array<{ socketId: string; matchID: string; reason: string }> = [];
    const offlineCommands: Array<{ matchID: string; playerID: string; commandType: string }> = [];

    const hooks: MatchConnectionLifecycleHooks<TestMatch> = {
        getActiveMatch: vi.fn((matchID) => (
            options?.activeMatch?.matchID === matchID ? options.activeMatch : undefined
        )),
        loadMatch: vi.fn(async (matchID) => (
            options?.loadedMatch?.matchID === matchID ? options.loadedMatch : undefined
        )),
        getSocketInfo: (socketId) => socketIndex.get(socketId),
        setSocketInfo: (socketId, info) => {
            socketIndex.set(socketId, info);
        },
        deleteSocketInfo: (socketId) => {
            socketIndex.delete(socketId);
        },
        removeSocketFromPreviousMatch: (socketId, info) => {
            removed.push({ socketId, info });
        },
        readFreshAuthMetadata: vi.fn(async () => options?.freshMetadata),
        validateCommandAuth: vi.fn(async (matchID, playerID, credentials, metadata) => {
            validated.push({ matchID, playerID, metadata });
            return metadata.players[playerID]?.credentials === credentials;
        }),
        persistMetadata: vi.fn(async (matchID, metadata) => {
            persisted.push({ matchID, metadata });
        }),
        clearSyncBaseline: (match, playerID) => {
            clearedBaselines.push({ matchID: match.matchID, playerID });
        },
        emitPlayerDisconnected: (matchID, playerID) => {
            disconnectedEvents.push({ matchID, playerID });
        },
        logSocketDisconnected: (socketId, matchID, reason) => {
            disconnectLogs.push({ socketId, matchID, reason });
        },
        executeOfflineAdjudicationCommand: async (match, playerID, commandType) => {
            offlineCommands.push({ matchID: match.matchID, playerID, commandType });
        },
        syncSocket: ({ match, playerID }) => {
            match.syncedPlayers.push(playerID);
        },
        resolveOnlineAiSeatControllerType: () => options?.controllerType ?? 'human',
        runOnlineAiImmediateExecution: async (match, reason) => {
            immediate.push({ matchID: match.matchID, reason });
        },
        onPersistConnectedMetadataFailed: (failure) => {
            persistFailures.push(failure);
        },
    };

    return {
        coordinator: new MatchConnectionLifecycleCoordinator({ offlineGraceMs: 1000, hooks }),
        hooks,
        socketIndex,
        persisted,
        removed,
        immediate,
        validated,
        persistFailures,
        clearedBaselines,
        disconnectedEvents,
        disconnectLogs,
        offlineCommands,
    };
}

describe('MatchConnectionLifecycleCoordinator', () => {
    it('房间不存在时只回传 match_not_found，不登记 socket', async () => {
        const harness = createHarness();
        const socket = new MockSocket('socket-1');

        await harness.coordinator.handleSync({
            socket: socket as unknown as IOSocket,
            matchID: 'missing-match',
            playerID: '0',
            credentials: 'cred-0',
        });

        expect(socket.sent).toEqual([{
            event: 'error',
            args: ['missing-match', 'match_not_found'],
        }]);
        expect(harness.socketIndex.size).toBe(0);
        expect(harness.hooks.loadMatch).toHaveBeenCalledWith('missing-match');
    });

    it('复用活跃房间时用最新 metadata 认证，再登记连接并触发同步后即时 AI', async () => {
        const activeMetadata = createMetadata({
            players: {
                '0': { name: 'Zero', credentials: 'old-cred', isConnected: false },
                '1': { name: 'One', credentials: 'cred-1', isConnected: false },
            },
        });
        const freshMetadata = createMetadata({
            players: {
                '0': { name: 'Zero', credentials: 'new-cred', isConnected: false },
                '1': { name: 'One', credentials: 'cred-1', isConnected: false },
            },
        });
        const match = createMatch('match-1', activeMetadata);
        const timer = setTimeout(() => undefined, 10_000);
        match.offlineTimers.set('0', timer);
        const harness = createHarness({ activeMatch: match, freshMetadata });
        const socket = new MockSocket('socket-1');

        await harness.coordinator.handleSync({
            socket: socket as unknown as IOSocket,
            matchID: 'match-1',
            playerID: '0',
            credentials: 'new-cred',
        });

        expect(harness.validated[0]).toMatchObject({
            matchID: 'match-1',
            playerID: '0',
            metadata: freshMetadata,
        });
        expect(harness.socketIndex.get('socket-1')).toEqual({
            matchID: 'match-1',
            playerID: '0',
            credentials: 'new-cred',
        });
        expect(socket.joined).toEqual(['game:match-1']);
        expect(match.connections.get('0')).toEqual(new Set(['socket-1']));
        expect(match.offlineTimers.has('0')).toBe(false);
        expect(match.metadata.players['0'].isConnected).toBe(true);
        expect(harness.persisted).toHaveLength(1);
        expect(match.syncedPlayers).toEqual(['0']);
        expect(socket.broadcast).toEqual([{
            room: 'game:match-1',
            event: 'player:connected',
            args: ['match-1', '0'],
        }]);
        expect(harness.immediate).toEqual([{ matchID: 'match-1', reason: 'sync' }]);
    });

    it('旁观者同步只登记 spectator，不做玩家认证、连接广播或即时 AI', async () => {
        const match = createMatch('match-1');
        const harness = createHarness({ loadedMatch: match });
        const socket = new MockSocket('socket-1');

        await harness.coordinator.handleSync({
            socket: socket as unknown as IOSocket,
            matchID: 'match-1',
            playerID: null,
        });

        expect(harness.hooks.validateCommandAuth).not.toHaveBeenCalled();
        expect(match.spectatorSockets).toEqual(new Set(['socket-1']));
        expect(match.connections.size).toBe(0);
        expect(harness.persisted).toEqual([]);
        expect(match.syncedPlayers).toEqual([null]);
        expect(socket.broadcast).toEqual([]);
        expect(harness.immediate).toEqual([]);
    });

    it('同一 socket 切换房间或玩家时先从旧房间移除', async () => {
        const match = createMatch('match-2');
        const previousInfo: MatchConnectionSocketInfo = {
            matchID: 'match-1',
            playerID: '0',
            credentials: 'old-cred',
        };
        const harness = createHarness({
            loadedMatch: match,
            socketInfo: previousInfo,
        });
        const socket = new MockSocket('socket-1');

        await harness.coordinator.handleSync({
            socket: socket as unknown as IOSocket,
            matchID: 'match-2',
            playerID: '1',
            credentials: 'cred-1',
        });

        expect(harness.removed).toEqual([{ socketId: 'socket-1', info: previousInfo }]);
        expect(harness.socketIndex.get('socket-1')).toEqual({
            matchID: 'match-2',
            playerID: '1',
            credentials: 'cred-1',
        });
    });

    it('认证失败时不登记 socket，也不触发同步副作用', async () => {
        const match = createMatch('match-1');
        const harness = createHarness({ loadedMatch: match });
        const socket = new MockSocket('socket-1');

        await harness.coordinator.handleSync({
            socket: socket as unknown as IOSocket,
            matchID: 'match-1',
            playerID: '0',
            credentials: 'bad-cred',
        });

        expect(socket.sent).toEqual([{
            event: 'error',
            args: ['match-1', 'unauthorized'],
        }]);
        expect(harness.socketIndex.size).toBe(0);
        expect(match.connections.size).toBe(0);
        expect(match.syncedPlayers).toEqual([]);
        expect(harness.immediate).toEqual([]);
    });

    it('最后一个玩家 socket 断开时标记离线、清同步基线并启动离线裁决计时', () => {
        vi.useFakeTimers();
        try {
            const metadata = createMetadata({
                players: {
                    '0': { name: 'Zero', credentials: 'cred-0', isConnected: true },
                    '1': { name: 'One', credentials: 'cred-1', isConnected: false },
                },
            });
            const match = createMatch('match-1', metadata);
            match.connections.set('0', new Set(['socket-1']));
            const harness = createHarness({
                activeMatch: match,
                socketInfo: { matchID: 'match-1', playerID: '0', credentials: 'cred-0' },
            });
            const socket = new MockSocket('socket-1');

            harness.coordinator.handleDisconnect(socket as unknown as IOSocket);

            expect(harness.socketIndex.has('socket-1')).toBe(false);
            expect(match.connections.has('0')).toBe(false);
            expect(match.metadata.players['0'].isConnected).toBe(false);
            expect(harness.persisted).toHaveLength(1);
            expect(harness.clearedBaselines).toEqual([{ matchID: 'match-1', playerID: '0' }]);
            expect(harness.disconnectedEvents).toEqual([{ matchID: 'match-1', playerID: '0' }]);
            expect(harness.disconnectLogs).toEqual([{
                socketId: 'socket-1',
                matchID: 'match-1',
                reason: 'client_disconnect',
            }]);
            expect(match.offlineTimers.has('0')).toBe(true);
        } finally {
            vi.clearAllTimers();
            vi.useRealTimers();
        }
    });

    it('最后一个旁观者 socket 断开时只清 spectator 同步基线', () => {
        const match = createMatch('match-1');
        match.spectatorSockets.add('socket-1');
        const harness = createHarness({
            activeMatch: match,
            socketInfo: { matchID: 'match-1', playerID: null },
        });
        const socket = new MockSocket('socket-1');

        harness.coordinator.handleDisconnect(socket as unknown as IOSocket);

        expect(match.spectatorSockets.size).toBe(0);
        expect(harness.clearedBaselines).toEqual([{ matchID: 'match-1', playerID: null }]);
        expect(harness.persisted).toEqual([]);
        expect(harness.disconnectedEvents).toEqual([]);
    });

    it('离线裁决用默认 CANCEL 处理未知交互 kind，并尊重游戏配置的 null 显式禁用', async () => {
        const match = createMatch('match-1');
        match.state = {
            core: {},
            sys: {
                phase: 'main',
                turnNumber: 1,
                interaction: {
                    current: {
                        kind: 'custom-card-interaction',
                        playerId: '0',
                    },
                    queue: [],
                },
            },
        } as MatchState<unknown>;
        const harness = createHarness({ activeMatch: match });

        await harness.coordinator.runOfflineAdjudication(match, '0');

        expect(harness.offlineCommands).toEqual([{
            matchID: 'match-1',
            playerID: '0',
            commandType: 'SYS_INTERACTION_CANCEL',
        }]);

        const disabledMatch = createMatch('match-disabled');
        disabledMatch.engineConfig = createEngineConfig({
            onlineAiRecovery: {
                offlineAdjudicationCommandByInteractionKind: {
                    'custom-bonus-dice': null,
                },
            },
        });
        disabledMatch.state = {
            core: {},
            sys: {
                phase: 'main',
                turnNumber: 1,
                interaction: {
                    current: {
                        kind: 'custom-bonus-dice',
                        playerId: '0',
                    },
                    queue: [],
                },
            },
        } as MatchState<unknown>;

        await harness.coordinator.runOfflineAdjudication(disabledMatch, '0');

        expect(harness.offlineCommands).toHaveLength(1);
    });

    it('离线裁决优先使用游戏 resolver，并允许显式阻止旧 kind 映射', async () => {
        const resolverCalls: Array<{ kind: unknown; fallbackCommandType: string | null }> = [];
        const match = createMatch('match-resolver');
        match.engineConfig = createEngineConfig({
            onlineAiRecovery: {
                offlineAdjudicationCommandByInteractionKind: {
                    'custom-token-response': 'OLD_SKIP',
                },
                resolveOfflineAdjudicationCommand: ({ interaction, fallbackCommandType }) => {
                    resolverCalls.push({ kind: interaction.kind, fallbackCommandType });
                    const data = interaction.data as { allowSkip?: unknown } | undefined;
                    return data?.allowSkip === true ? 'CONTRACT_SKIP' : null;
                },
            },
        });
        match.state = {
            core: {},
            sys: {
                phase: 'main',
                turnNumber: 1,
                interaction: {
                    current: {
                        kind: 'custom-token-response',
                        playerId: '0',
                        data: { allowSkip: false },
                    },
                    queue: [],
                },
            },
        } as MatchState<unknown>;
        const harness = createHarness({ activeMatch: match });

        await harness.coordinator.runOfflineAdjudication(match, '0');

        expect(resolverCalls).toEqual([{
            kind: 'custom-token-response',
            fallbackCommandType: 'OLD_SKIP',
        }]);
        expect(harness.offlineCommands).toEqual([]);

        match.state = {
            core: {},
            sys: {
                phase: 'main',
                turnNumber: 1,
                interaction: {
                    current: {
                        kind: 'custom-token-response',
                        playerId: '0',
                        data: { allowSkip: true },
                    },
                    queue: [],
                },
            },
        } as MatchState<unknown>;

        await harness.coordinator.runOfflineAdjudication(match, '0');

        expect(harness.offlineCommands).toEqual([{
            matchID: 'match-resolver',
            playerID: '0',
            commandType: 'CONTRACT_SKIP',
        }]);
    });
});
