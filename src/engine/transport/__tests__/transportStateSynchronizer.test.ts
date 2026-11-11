import { describe, expect, it } from 'vitest';
import type { GameEngineConfig } from '../engineConfig';
import { TransportStateSynchronizer } from '../transportStateSynchronizer';
import type { TransportStateProjectionMatch } from '../stateProjection';

type EmittedEvent = {
    socketId: string;
    event: string;
    args: unknown[];
};

class MockNamespace {
    readonly sent: EmittedEvent[] = [];

    to(socketId: string) {
        return {
            emit: (event: string, ...args: unknown[]) => {
                this.sent.push({ socketId, event, args });
            },
        };
    }
}

class MockIO {
    readonly gameNamespace = new MockNamespace();

    of(namespace: string): MockNamespace {
        expect(namespace).toBe('/game');
        return this.gameNamespace;
    }
}

function createEngineConfig(): GameEngineConfig {
    return {
        gameId: 'sync-test',
        domain: {
            setup: () => ({ publicValue: 'setup' }),
            validate: () => ({ valid: true }),
            execute: ({ state }) => ({ state, events: [] }),
            playerView: (_core, playerId) => ({
                visibleTo: playerId,
                privateHand: playerId === '0' ? ['alpha'] : [],
            }),
        },
        systems: [],
    } as unknown as GameEngineConfig;
}

function createMatch(): TransportStateProjectionMatch {
    return {
        matchID: 'match-sync',
        engineConfig: createEngineConfig(),
        state: {
            core: { publicValue: 'before' },
            sys: { phase: 'main', eventStream: { entries: [], nextId: 1 } },
        },
        metadata: {
            gameName: 'sync-test',
            players: {
                '0': { name: 'Zero', isConnected: true },
                '1': { name: 'One', isConnected: true },
            },
            createdAt: 1,
            updatedAt: 1,
        },
        stateID: 1,
        randomSeed: 'seed-1',
        getRandomCursor: () => 7,
        connections: new Map([['0', new Set(['socket-0'])]]),
        spectatorSockets: new Set(),
        lastBroadcastedViews: new Map(),
        lastCommandPlayerId: null,
    };
}

describe('TransportStateSynchronizer', () => {
    it('syncSocket 发送裁剪后的 seat view，并写入后续 patch 基线', () => {
        const io = new MockIO();
        const synchronizer = new TransportStateSynchronizer(io as unknown as never);
        const socketEvents: Array<{ event: string; args: unknown[] }> = [];
        const socket = {
            emit: (event: string, ...args: unknown[]) => socketEvents.push({ event, args }),
        };
        const match = createMatch();

        synchronizer.syncSocket({ socket, match, playerID: '0' });

        expect(socketEvents).toHaveLength(1);
        expect(socketEvents[0].event).toBe('state:sync');
        expect(socketEvents[0].args[0]).toBe('match-sync');
        expect(socketEvents[0].args[1]).toMatchObject({
            core: {
                publicValue: 'before',
                visibleTo: '0',
                privateHand: ['alpha'],
            },
            sys: { phase: 'main' },
        });
        expect(socketEvents[0].args[3]).toEqual({ seed: 'seed-1', cursor: 7 });
        expect(socketEvents[0].args[4]).toEqual({ stateID: 1 });
        expect(match.lastBroadcastedViews.get('0')).toMatchObject({
            core: { publicValue: 'before', visibleTo: '0', privateHand: ['alpha'] },
        });
    });

    it('broadcast 首次发送全量 update，后续基于基线发送 patch', () => {
        const io = new MockIO();
        const synchronizer = new TransportStateSynchronizer(io as unknown as never);
        const match = createMatch();

        synchronizer.broadcast(match);
        expect(io.gameNamespace.sent).toHaveLength(1);
        expect(io.gameNamespace.sent[0]).toMatchObject({
            socketId: 'socket-0',
            event: 'state:update',
        });

        match.state = {
            ...match.state,
            core: { publicValue: 'after' },
        };
        match.stateID = 2;
        synchronizer.broadcast(match);

        expect(io.gameNamespace.sent).toHaveLength(2);
        expect(io.gameNamespace.sent[1]).toMatchObject({
            socketId: 'socket-0',
            event: 'state:patch',
        });
        expect(io.gameNamespace.sent[1].args[1]).toEqual(expect.arrayContaining([
            expect.objectContaining({ path: '/core/publicValue', value: 'after' }),
        ]));
    });

    it('重连同步后的基线与权威状态隔离，并能正确发送后续变化', () => {
        const io = new MockIO();
        const synchronizer = new TransportStateSynchronizer(io as unknown as never);
        const match = createMatch();
        const socket = { emit: () => {} };

        synchronizer.syncSocket({ socket, match, playerID: '0' });
        (match.state.core as { publicValue: string }).publicValue = 'after';
        expect((match.lastBroadcastedViews.get('0') as { core: { publicValue: string } }).core.publicValue).toBe('before');
        match.stateID = 2;
        synchronizer.broadcast(match);

        expect(io.gameNamespace.sent[0]).toMatchObject({ socketId: 'socket-0', event: 'state:patch' });
        expect(io.gameNamespace.sent[0].args[1]).toEqual(expect.arrayContaining([
            expect.objectContaining({ path: '/core/publicValue', value: 'after' }),
        ]));
    });

    it('广播缓存与权威状态隔离，原地修改后仍能产生下一次更新', () => {
        const io = new MockIO();
        const synchronizer = new TransportStateSynchronizer(io as unknown as never);
        const match = createMatch();
        synchronizer.broadcast(match);
        (match.state.core as { publicValue: string }).publicValue = 'after';
        expect((match.lastBroadcastedViews.get('0') as { core: { publicValue: string } }).core.publicValue).toBe('before');
        match.stateID = 2;
        synchronizer.broadcast(match);
        expect(io.gameNamespace.sent[1].args[1]).toEqual(expect.arrayContaining([
            expect.objectContaining({ path: '/core/publicValue', value: 'after' }),
        ]));
    });

    it('不同玩家和观战者的广播缓存保持各自视图', () => {
        const io = new MockIO();
        const synchronizer = new TransportStateSynchronizer(io as unknown as never);
        const match = createMatch();
        match.connections.set('1', new Set(['socket-1']));
        match.spectatorSockets.add('spectator');
        synchronizer.broadcast(match);
        const core = (key: string) => (match.lastBroadcastedViews.get(key) as { core: { privateHand?: string[] } }).core;
        expect(core('0').privateHand).toEqual(['alpha']);
        expect(core('1').privateHand).toEqual([]);
        expect(core('spectator').privateHand).toBeUndefined();
        expect(io.gameNamespace.sent.map(event => event.socketId)).toEqual(['socket-0', 'socket-1', 'spectator']);
    });
});
