import type { RouterContext } from '@koa/router';
import { createTestRoutes } from '../../../server/routes/test';
import type { Server as IOServer } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { GameTransportServer } from '../server';
import type { FetchResult, MatchMetadata } from '../storage';
import {
    InMemoryStorage,
    MockIO,
    MockSocket,
    createEngineConfig,
    createMetadata,
    createStoredState,
    hasEvent,
} from './helpers/serverTestHarness';

describe('GameTransportServer（房间退役竞态）', () => {
    it.each(['0', null])('卸载 pending-only 房间后，迟到读取不能同步或重新激活旧房（player=%s）', async playerID => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('old-room', {
            initialState: createStoredState(), metadata: createMetadata('cred-0'),
        });
        const oldSnapshot = await storage.fetch('old-room', { state: true, metadata: true });
        let finishRead!: (result: FetchResult) => void;
        vi.spyOn(storage, 'fetch').mockImplementationOnce(() => new Promise(resolve => {
            finishRead = resolve;
        }));
        const server = new GameTransportServer({
            io: io as unknown as IOServer,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, player, credentials, metadata) => (
                metadata.players[player]?.credentials === credentials
            ),
        });
        server.start();
        const socket = new MockSocket('old-reader');
        io.gameNamespace.connectSocket(socket);
        const sync = socket.clientEmit('sync', 'old-room', playerID, 'cred-0');

        await storage.wipe('old-room');
        expect(server.unloadMatch('old-room')).toBe(false);
        finishRead(oldSnapshot);
        await sync;

        expect(hasEvent(socket, 'state:sync')).toBe(false);
        expect(hasEvent(socket, 'error', args => args[1] === 'match_not_found')).toBe(true);
        expect(socket.rooms.has('game:old-room')).toBe(false);
        expect(await server.executeCommand('old-room', '0', 'TEST_CMD', {})).toBe(false);
        expect(await storage.fetch('old-room', { metadata: true, state: true })).toEqual({
            metadata: undefined, state: undefined,
        });
    });

    it.each([true, false])('权威 metadata missing 时不能使用旧缓存身份同步（轻量读取=%s）', async useAuthProvider => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        if (!useAuthProvider) {
            Object.defineProperty(storage, 'fetchAuthMetadata', { value: undefined });
        }
        await storage.createMatch('old-room', {
            initialState: createStoredState(), metadata: createMetadata('cred-0'),
        });
        const server = new GameTransportServer({
            io: io as unknown as IOServer,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            authenticate: async (_matchID, player, credentials, metadata) => (
                metadata.players[player]?.credentials === credentials
            ),
        });
        server.start();
        const socket = new MockSocket('cached-player');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'old-room', '0', 'cred-0');
        expect(hasEvent(socket, 'state:sync')).toBe(true);
        socket.sent.length = 0;
        await storage.wipe('old-room');
        const metadataWrite = vi.spyOn(storage, 'setMetadata');

        await socket.clientEmit('sync', 'old-room', '0', 'cred-0');
        await socket.clientEmit('command', 'old-room', 'TEST_CMD', {}, 'cred-0');

        expect(hasEvent(socket, 'state:sync')).toBe(false);
        expect(hasEvent(socket, 'error', args => args[1] === 'match_not_found')).toBe(true);
        expect(metadataWrite).not.toHaveBeenCalled();
        expect(await storage.fetch('old-room', { metadata: true, state: true })).toEqual({
            metadata: undefined, state: undefined,
        });
    });

    it('sync 等待鉴权时卸载房间，迟到的鉴权成功不能注册连接或发送旧状态', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('old-room', {
            initialState: createStoredState(), metadata: createMetadata('cred-0'),
        });
        let finishAuth!: (authorized: boolean) => void;
        let signalAuthStarted!: () => void;
        const authStarted = new Promise<void>(resolve => { signalAuthStarted = resolve; });
        const server = new GameTransportServer({
            io: io as unknown as IOServer,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            authenticate: () => new Promise<boolean>(resolve => {
                finishAuth = resolve;
                signalAuthStarted();
            }),
        });
        server.start();
        const socket = new MockSocket('late-authorized-player');
        io.gameNamespace.connectSocket(socket);
        const sync = socket.clientEmit('sync', 'old-room', '0', 'cred-0');
        await authStarted;
        await storage.wipe('old-room');
        expect(server.unloadMatch('old-room')).toBe(true);
        const metadataWrite = vi.spyOn(storage, 'setMetadata');
        finishAuth(true);
        await sync;

        expect(hasEvent(socket, 'state:sync')).toBe(false);
        expect(hasEvent(socket, 'error', args => args[1] === 'match_not_found')).toBe(true);
        expect(socket.rooms.has('game:old-room')).toBe(false);
        expect(metadataWrite).not.toHaveBeenCalled();
    });
    it.each(['sync-auth', 'sync-metadata', 'test-auth', 'route-prefetch'] as const)('%s 等待期间同 ID 重载，不得把旧 metadata 写入新 runtime', async stalledAt => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const originalMetadata = createMetadata('old-credential');
        originalMetadata.players['0'].name = 'Old player';
        await storage.createMatch('same-room', { initialState: createStoredState(), metadata: originalMetadata });
        let releaseAuth!: (allowed: boolean) => void;
        let releaseMetadata!: (metadata: MatchMetadata) => void;
        let releaseRouteRead!: (result: FetchResult) => void;
        let signalStarted!: () => void;
        const started = new Promise<void>(resolve => { signalStarted = resolve; });
        const server = new GameTransportServer({
            io: io as unknown as IOServer, storage, games: [createEngineConfig()], onlineAiRecoveryTickMs: 0,
            authenticate: (_matchID, playerID, credentials, metadata) => stalledAt === 'route-prefetch'
                ? Promise.resolve(metadata.players[playerID]?.credentials === credentials)
                : stalledAt === 'sync-metadata' ? Promise.resolve(true) : new Promise<boolean>(resolve => {
                releaseAuth = resolve;
                signalStarted();
            }),
        });
        server.start();
        const warmer = new MockSocket('warm-runtime');
        io.gameNamespace.connectSocket(warmer);
        await warmer.clientEmit('sync', 'same-room', null);
        if (stalledAt === 'sync-metadata') {
            vi.spyOn(storage, 'fetchAuthMetadata').mockImplementationOnce(() => new Promise(resolve => {
                releaseMetadata = resolve;
                signalStarted();
            }));
        }
        if (stalledAt === 'route-prefetch') {
            vi.spyOn(storage, 'fetch').mockImplementationOnce(() => new Promise(resolve => {
                releaseRouteRead = resolve;
                signalStarted();
            }));
        }
        const routeContext = {
            request: { body: { matchId: 'same-room', state: createStoredState().G } },
            get: (name: string) => name === 'x-test-player-id' ? '0' : 'old-credential',
            status: 200, body: undefined as unknown,
        };
        const route = createTestRoutes(server, storage).stack.find(layer => layer.path === '/test/inject-state');
        const staleSocket = new MockSocket('stale-reader');
        io.gameNamespace.connectSocket(staleSocket);
        const pending = stalledAt === 'route-prefetch'
            ? route!.stack[0](routeContext as unknown as RouterContext, async () => {})
            : stalledAt === 'test-auth'
            ? server.validateTestAccess('same-room', '0', 'old-credential')
            : staleSocket.clientEmit('sync', 'same-room', '0', 'old-credential');
        await started;
        expect(server.unloadMatch('same-room')).toBe(true);
        const freshMetadata = createMetadata('new-credential');
        freshMetadata.players['0'].name = 'New player';
        await storage.setMetadata('same-room', freshMetadata);
        const freshSocket = new MockSocket('fresh-reader');
        io.gameNamespace.connectSocket(freshSocket);
        await freshSocket.clientEmit('sync', 'same-room', null);
        if (stalledAt === 'sync-metadata') releaseMetadata(originalMetadata);
        else if (stalledAt === 'route-prefetch') releaseRouteRead({ metadata: originalMetadata });
        else releaseAuth(true);
        const result = await pending;
        if (stalledAt === 'test-auth') expect(result).toBe(false);
        else if (stalledAt === 'route-prefetch') expect(routeContext.status).toBe(403);
        else {
            expect(hasEvent(staleSocket, 'state:sync')).toBe(false);
            expect(hasEvent(staleSocket, 'error', args => args[1] === 'match_not_found')).toBe(true);
        }
        freshSocket.sent.length = 0;
        await freshSocket.clientEmit('sync', 'same-room', null);
        const players = freshSocket.sent.find(event => event.event === 'state:sync')?.args[2];
        expect(players).toEqual(expect.arrayContaining([expect.objectContaining({ id: 0, name: 'New player' })]));
        expect((await storage.fetch('same-room', { metadata: true })).metadata?.players['0'].credentials).toBe('new-credential');
    });

});
