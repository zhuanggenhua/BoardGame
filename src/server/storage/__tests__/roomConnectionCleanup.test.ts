import { describe, expect, it, vi } from 'vitest';
import { GameTransportServer } from '../../../engine/transport/server';
import { MockIO, MockSocket, createEngineConfig, createMetadata, createStoredState, hasEvent, nextTick } from '../../../engine/transport/__tests__/helpers/serverTestHarness';
import { HybridStorage } from '../HybridStorage';
import { mongoStorage } from '../MongoStorage';

describe('房间连接与清理', () => {
    it('已同步玩家在线时保留房间，断线后仍按宽限期清理', async () => {
        const storage = new HybridStorage(mongoStorage, { persistentEnabled: false });
        const metadata = createMetadata('room-credential');
        await storage.createMatch('room-connection-cleanup', { initialState: createStoredState(), metadata });
        const io = new MockIO();
        const onPlayerConnectionChanged = vi.fn();
        const transport = new GameTransportServer({
            io: io as never, storage, games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, meta) => meta.players[playerID]?.credentials === credentials,
            onPlayerConnectionChanged,
        });
        transport.start();
        const socket = new MockSocket('room-player');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'room-connection-cleanup', '0', 'room-credential');
        expect(hasEvent(socket, 'state:sync')).toBe(true);
        await nextTick();
        expect(onPlayerConnectionChanged).toHaveBeenCalledWith('room-connection-cleanup', 'test-game');

        const stored = (await storage.fetch('room-connection-cleanup', { metadata: true })).metadata!;
        await storage.setMetadata('room-connection-cleanup', {
            ...stored, players: { ...stored.players, '0': { ...stored.players['0'], isConnected: false } },
            disconnectedSince: Date.now() - 6 * 60 * 1000,
        });
        const connected = (matchID: string) => transport.hasConnectedPlayer(matchID);
        expect(await storage.cleanupEphemeralMatches(0, connected)).toBe(0);
        expect((await storage.fetch('room-connection-cleanup', { metadata: true })).metadata).toBeDefined();

        socket.disconnect();
        await nextTick();
        expect(onPlayerConnectionChanged).toHaveBeenCalledTimes(2);
        expect(connected('room-connection-cleanup')).toBe(false);
        expect(await storage.cleanupEphemeralMatches(0, connected)).toBe(1);
        expect((await storage.fetch('room-connection-cleanup', { metadata: true })).metadata).toBeUndefined();
    });
});
