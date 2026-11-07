// @vitest-environment node
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import { afterEach, expect, it, vi } from 'vitest';
import { productionCallback } from '../../server/__tests__/helpers/productionServerCallback';
import { applyRematchVoteToggle, isAuthenticatedRematchPlayer, resolveRematchPlayerGroups } from '../../server/rematch';
import type { MatchMetadata } from '../../engine/transport/storage';

const transport = vi.hoisted(() => ({ socket: null as Socket | null }));
vi.mock('../../services/lobbySocket', () => ({ lobbySocket: {
    acquireConnection: () => transport.socket,
    getSharedSocket: () => transport.socket,
    releaseConnection: vi.fn(),
} }));
import { matchSocket, REMATCH_EVENTS, type RematchVoteState } from '../../services/matchSocket';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
    matchSocket.disconnect();
    transport.socket?.disconnect();
    transport.socket = null;
    for (const close of cleanups.splice(0)) await close();
});
function once(socket: Socket, event: string) {
    return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { socket.off(event, done); reject(new Error(`Timed out: ${event}`)); }, 3000);
        function done() { clearTimeout(timer); resolve(); }
        socket.once(event, done);
    });
}
function gate() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

it('rejoins through delayed production authentication after a real socket reconnect and accepts recreated revision zero', async () => {
    const http = createServer();
    const server = new Server(http, { transports: ['websocket'] });
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())));
    const states = new Map<string, RematchVoteState>();
    const metadata: MatchMetadata = {
        gameName: 'betrayal', createdAt: 1, updatedAt: 1,
        players: { '0': { name: 'Owner', credentials: 'synthetic-proof' }, '1': { name: 'Other' } },
    };
    let authentication = gate();
    let joinStarted = gate();
    let receivedVotes = 0;
    server.on('connection', socket => {
        const environment = {
            socket, logger: { info: vi.fn(), warn: vi.fn() }, REMATCH_EVENTS,
            fetchRematchMetadata: async () => { joinStarted.release(); await authentication.promise; return metadata; },
            resolveAutoAcceptedRematchPlayerIds: async () => [],
            isAuthenticatedRematchPlayer, applyRematchVoteToggle, resolveRematchPlayerGroups,
            normalizeRematchPlayerIds: (value: string[]) => value,
            matchSubscribers: new Map(), rematchStateByMatch: states, lobbySocketIO: server,
            scheduleRematchStateReset: vi.fn(), lobbyCoordinator: { startLobbyHeartbeat: vi.fn() },
        };
        socket.on(REMATCH_EVENTS.JOIN_MATCH, productionCallback('rematchJoin', environment));
        socket.on(REMATCH_EVENTS.VOTE, () => { receivedVotes += 1; });
        socket.on(REMATCH_EVENTS.VOTE, productionCallback('rematchVote', environment));
    });
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    const socket = io(`http://127.0.0.1:${(http.address() as AddressInfo).port}`, {
        autoConnect: false, transports: ['websocket'], reconnection: false, forceNew: true,
    });
    transport.socket = socket;
    const connected = once(socket, 'connect');
    matchSocket.joinMatch('room', '0', { credentials: 'synthetic-proof' });
    socket.connect(); await connected; await joinStarted.promise;
    const readiness: boolean[] = [];
    const unsubscribe = matchSocket.subscribeRematchConnection(value => readiness.push(value));
    expect(readiness).toEqual([false]);
    const emitSpy = vi.spyOn(socket, 'emit');
    matchSocket.vote();
    expect(emitSpy.mock.calls.some(([event]) => event === REMATCH_EVENTS.VOTE)).toBe(false);
    const initial = once(socket, REMATCH_EVENTS.STATE_UPDATE);
    authentication.release(); await initial;
    expect(readiness).toEqual([false, true]);
    let updated = once(socket, REMATCH_EVENTS.STATE_UPDATE);
    matchSocket.vote(); await updated;
    expect(matchSocket.getState()).toEqual({ votes: { 0: true }, ready: false, revision: 1 });
    expect(receivedVotes).toBe(1);

    socket.disconnect();
    expect(readiness.at(-1)).toBe(false);
    // A restarted server has no in-memory rematch votes. Keep the same public
    // room and proof, and exercise a fresh actual Socket.IO connection.
    states.clear(); authentication = gate(); joinStarted = gate();
    const reconnected = once(socket, 'connect');
    socket.connect(); await reconnected; await joinStarted.promise;
    emitSpy.mockClear();
    matchSocket.vote();
    expect(emitSpy.mock.calls.some(([event]) => event === REMATCH_EVENTS.VOTE)).toBe(false);
    const resynced = once(socket, REMATCH_EVENTS.STATE_UPDATE);
    authentication.release(); await resynced;
    expect(matchSocket.getState()).toEqual({ votes: {}, ready: false, revision: 0 });
    expect(readiness.at(-1)).toBe(true);
    updated = once(socket, REMATCH_EVENTS.STATE_UPDATE);
    matchSocket.vote(); await updated;
    expect(matchSocket.getState()).toEqual({ votes: { 0: true }, ready: false, revision: 1 });
    expect(receivedVotes).toBe(2);
    emitSpy.mockRestore(); unsubscribe();
});
