import { describe, expect, it, vi } from 'vitest';
import { GameEngineRegistry, createGameModuleLoader } from '../gameEngineRegistry';
import { createEngineConfig } from './helpers/serverTestHarness';
import { GameTransportServer } from '../server';
import { InMemoryStorage, MockIO, MockSocket, createMetadata, createStoredState, hasEvent } from './helpers/serverTestHarness';

describe('on-demand game engines', () => {
    it('keeps a module evaluation failure terminal instead of reusing partial exports', async () => {
        const evaluate = vi.fn(async () => { throw new Error('evaluation failed after an export was assigned'); });
        const load = createGameModuleLoader(evaluate);
        await expect(load()).rejects.toThrow('evaluation failed');
        await expect(load()).rejects.toThrow('evaluation failed');
        expect(evaluate).toHaveBeenCalledTimes(1);
    });
    it('does not resurrect a room destroyed while its rules are loading', async () => {
        const io = new MockIO(), storage = new InMemoryStorage();
        await storage.createMatch('deleted-during-load', { initialState: createStoredState(), metadata: createMetadata('cred') });
        let complete!: () => void;
        let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        const server = new GameTransportServer({ io: io as never, storage, games: [], gameLoaders: [{
            gameId: 'test-game', loadEngine: () => new Promise(resolve => { entered(); complete = () => resolve(createEngineConfig()); }),
        }] });
        server.start();
        const socket = new MockSocket('pending-destroy');
        io.gameNamespace.connectSocket(socket);
        const sync = socket.clientEmit('sync', 'deleted-during-load', '0', 'cred');
        await started;
        await storage.wipe('deleted-during-load');
        server.unloadMatch('deleted-during-load', { disconnectSockets: true });
        complete();
        await sync;
        expect(hasEvent(socket, 'state:sync')).toBe(false);
        expect(hasEvent(socket, 'error', args => args[1] === 'match_not_found')).toBe(true);
    });
    it('reports a failed game over sync without rejecting the socket handler or blocking another game', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('bad-room', { initialState: createStoredState(), metadata: { ...createMetadata('cred'), gameName: 'bad' } });
        await storage.createMatch('good-room', { initialState: createStoredState(), metadata: createMetadata('cred') });
        const server = new GameTransportServer({ io: io as never, storage, games: [], gameLoaders: [
            { gameId: 'bad', loadEngine: async () => { throw new Error('broken module'); } },
            { gameId: 'test-game', loadEngine: async () => createEngineConfig() },
        ] });
        server.start();
        const socket = new MockSocket('isolated-loader');
        io.gameNamespace.connectSocket(socket);
        await expect(socket.clientEmit('sync', 'bad-room', '0', 'cred')).resolves.toBeUndefined();
        expect(hasEvent(socket, 'error', args => args[1] === 'game_unavailable')).toBe(true);
        await socket.clientEmit('sync', 'good-room', '0', 'cred');
        expect(hasEvent(socket, 'state:sync')).toBe(true);
    });
    it('does not evaluate a catalog at startup and deduplicates concurrent requests', async () => {
        const config = createEngineConfig();
        const loadEngine = vi.fn(async () => config);
        const registry = new GameEngineRegistry([], [{ gameId: config.gameId, loadEngine }]);
        expect(loadEngine).not.toHaveBeenCalled();
        const [a, b] = await Promise.all([registry.get(config.gameId), registry.get(config.gameId)]);
        expect(a).toBe(config);
        expect(b).toBe(a);
        expect(loadEngine).toHaveBeenCalledTimes(1);
    });
    it('isolates unavailable rules and retries a transient loader without caching partial exports', async () => {
        const good = createEngineConfig();
        let failed = true;
        const transient = vi.fn(async () => {
            if (failed) throw new Error('transient');
            return { ...good, gameId: 'retry' };
        });
        const registry = new GameEngineRegistry([], [
            { gameId: 'retry', loadEngine: transient },
            { gameId: 'bad', loadEngine: async () => undefined! },
            { gameId: good.gameId, loadEngine: async () => good },
        ]);
        await expect(registry.get('retry')).rejects.toThrow('transient');
        await expect(registry.get('bad')).rejects.toThrow('Invalid engine export');
        expect(await registry.get(good.gameId)).toBe(good);
        failed = false;
        expect((await registry.get('retry'))?.gameId).toBe('retry');
        await expect(registry.get('bad')).rejects.toThrow('Invalid engine export');
        expect(await registry.get('disabled')).toBeUndefined();
    });
});
