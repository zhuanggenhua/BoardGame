// @vitest-environment node
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { Server as IOServer } from 'socket.io';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameTransportServer } from '../../engine/transport/server';
import { isMatchReplacementStorage, MatchReplacementOutcomeUnknownError, type MatchMetadata } from '../../engine/transport/storage';
import { engineConfig } from '../../games/betrayal/game';
import manifest from '../../games/betrayal/manifest';
import { resolveAllowedPlayerCountsForGame } from '../../shared/roomSetup';
import { isSupportedPlayerCount } from '../matchOccupancy';
import { HybridStorage } from '../storage/HybridStorage';
import type { MongoStorage } from '../storage/MongoStorage';
import { isAuthenticatedRematchPlayer } from '../rematch';
import * as rematchSetup from '../rematchSetup';
import * as ownerProof from '../guestRoomOwnership';
import * as duplicateRooms from '../duplicateOwnerRooms';
import { buildMatchDetailPayload } from '../lobbyMatch';
import { productionCallback } from './helpers/productionServerCallback';

// Real loopback HTTP/socket, production callbacks, Betrayal setup and memory CAS.
// This intentionally does not boot server.ts, connect to Mongo or claim browser E2E.
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanups.splice(0)) await close(); vi.restoreAllMocks(); });
const ownerKey = 'guest:isolated-rematch';
const ownerProofValue = 'synthetic-old-owner-proof';
const setup = {
    ownerKey, ownerType: 'guest', guestId: 'isolated-rematch',
    roomName: 'Original room', scenario: 'first-scenario', password: 'synthetic-password',
    enableAi: true, ttlSeconds: 259200,
    seatControllers: { '0': { type: 'human' }, '1': { type: 'human' }, '2': { type: 'local-ai', difficulty: 'expert' } },
};
function once(socket: Socket, event: string): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out waiting for ${event}`)); }, 5000);
        const handler = (...args: unknown[]) => { clearTimeout(timer); resolve(args); };
        socket.once(event, handler);
    });
}
async function harness(extraSetup: Record<string, unknown> = {}, holdCreateResponse?: Promise<void>) {
    const app = new Koa();
    const http: Server = createServer(app.callback());
    const io = new IOServer(http, { transports: ['websocket'] });
    // Throw if any persistence method is accidentally requested. No Mongo process.
    const mongo = new Proxy({}, { get: () => { throw new Error('Mongo access forbidden in this memory-only test'); } });
    const lobbySocketIO = new IOServer(http, { path: '/lobby-socket', transports: ['websocket'] });
    const storage = new HybridStorage(mongo as MongoStorage, { persistentEnabled: false });
    const gameTransport = new GameTransportServer({ io, storage, games: [engineConfig], onlineAiRecoveryTickMs: 0,
        authenticate: async (_id, playerId, credentials, metadata) => metadata.players[playerId]?.credentials === credentials,
    });
    gameTransport.start();
    const settings = { ...setup, ...extraSetup };
    const initial = (await gameTransport.setupMatch('old', 'betrayal', ['0', '1', '2'], 'synthetic-seed', settings))!;
    const metadata: MatchMetadata = {
        gameName: 'betrayal', createdAt: Date.now(), updatedAt: Date.now(), setupData: settings,
        players: { '0': { id: 0, name: 'Owner', ownerKey, credentials: ownerProofValue }, '1': { id: 1, name: 'Follower', credentials: 'follower-proof' }, '2': { id: 2 } },
    };
    await storage.createMatch('old', { initialState: { G: initial.state, _stateID: 0, randomSeed: 'synthetic-seed', randomCursor: initial.randomCursor }, metadata });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const REMATCH_EVENTS = { JOIN_MATCH: 'rematch:join', STATE_UPDATE: 'rematch:stateUpdate', DEBUG_NEW_ROOM: 'debug:newRoom' };
    const env: Record<string, unknown> = {
        ...rematchSetup, ...ownerProof, ...duplicateRooms, storage, gameTransport, logger, lobbySocketIO, REMATCH_EVENTS, isAuthenticatedRematchPlayer,
        fetchRematchMetadata: async (id: string) => (await storage.fetch(id, { metadata: true })).metadata,
        resolveAutoAcceptedRematchPlayerIds: async () => ['2'],
        isMatchReplacementStorage, MatchReplacementOutcomeUnknownError,
        normalizeGameName: (name: string) => name.toLowerCase(), isSupportedGame: (name: string) => name === 'betrayal',
        GAME_SERVER_MANIFEST: [{ manifest, engineConfig }], resolveAllowedPlayerCountsForGame, isSupportedPlayerCount,
        supportsOwnerMatchLookup: () => true, nanoid: (n: number) => randomBytes(n).toString('hex').slice(0, n),
        claimSeatUtils: { parseBearerToken: () => null, verifyGameToken: () => null }, JWT_SECRET: 'synthetic-only',
        process: { env: { NODE_ENV: 'production' } }, setTimeout: vi.fn(),
        lobbyCoordinator: { handleMatchCreated: vi.fn(), emitMatchEnded: vi.fn(), forgetLobbyMatch: vi.fn() },
        matchSubscribers: new Map(), rematchStateByMatch: new Map(), chatHistoryByMatch: new Map(), buildMatchDetailPayload,
    };
    env.notifyRematchSuccessor = productionCallback('successor', env);
    lobbySocketIO.on('connection', socket => {
        socket.on(REMATCH_EVENTS.JOIN_MATCH, productionCallback('rematchJoin', { ...env, socket }));
    });
    env.cleanupReplacedMatchRuntime = productionCallback('cleanup', env);
    const router = new Router();
    router.post('/games/:name/create', productionCallback<Koa.Middleware>('create', env));
    router.get('/games/:name/:matchID', productionCallback<Koa.Middleware>('detail', env));
    app.use(async (ctx, next) => { await next(); if (ctx.path.endsWith('/create')) await holdCreateResponse; });
    app.use(productionCallback<Koa.Middleware>('errors', env));
    app.use(bodyParser()); app.use(router.routes());
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    const clients: Socket[] = [];
    cleanups.push(async () => {
        for (const id of await storage.listMatches()) gameTransport.unloadMatch(id);
        for (const socket of clients) socket.disconnect();
        await new Promise<void>(resolve => lobbySocketIO.close(() => resolve()));
        await new Promise<void>(resolve => io.close(() => resolve()));
        if (http.listening) await new Promise<void>(resolve => http.close(() => resolve()));
    });
    const connect = async () => {
        const socket = connectSocket(`${base}/game`, { transports: ['websocket'], forceNew: true, reconnection: false });
        clients.push(socket); await once(socket, 'connect'); return socket;
    };
    const joinFollower = async () => {
        const socket = connectSocket(base, { path: '/lobby-socket', transports: ['websocket'], forceNew: true, reconnection: false });
        clients.push(socket); await once(socket, 'connect');
        const joined = once(socket, 'rematch:stateUpdate');
        socket.emit('rematch:join', { matchId: 'old', playerId: '1', credentials: 'follower-proof' });
        await joined; return socket;
    };
    const sync = async (socket: Socket, id: string, credentials = ownerProofValue) => {
        const response = once(socket, 'state:sync'); socket.emit('sync', id, '0', credentials); return response;
    };
    const rematch = async (credentials = ownerProofValue, signal?: AbortSignal) => {
        const response = await fetch(`${base}/games/betrayal/create`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rematch: { matchID: 'old', playerID: '0', credentials } }) });
        return { status: response.status, body: await response.json() as Record<string, string> };
    };
    return { base, storage, gameTransport, connect, sync, rematch, joinFollower };
}

describe('Betrayal rematch HTTP, runtime and memory CAS integration', () => {
    it('preserves exact setup, retires old runtime, authenticates successor and keeps public DTO private', async () => {
        const h = await harness(); const oldClient = await h.connect(); await h.sync(oldClient, 'old');
        const oldError = once(oldClient, 'error');
        const oldDisconnect = once(oldClient, 'disconnect');
        const result = await h.rematch();
        expect(result.status).toBe(200);
        expect(await oldError).toEqual(['old', 'match_not_found']);
        await oldDisconnect;
        expect(await h.storage.fetch('old', { state: true, metadata: true })).toEqual({ state: undefined, metadata: undefined });
        expect(await h.gameTransport.executeCommand('old', '0', 'SELECT_CHARACTER', {})).toBe(false);
        const next = await h.storage.fetch(result.body.matchID, { state: true, metadata: true });
        expect(next.metadata?.setupData).toMatchObject(setup);
        expect(await h.storage.findMatchesByOwnerKey(ownerKey)).toEqual([{ matchID: result.body.matchID, gameName: 'betrayal' }]);
        const nextClient = await h.connect();
        const [, state, , random] = await h.sync(nextClient, result.body.matchID, result.body.ownerCredentials);
        expect(state).toMatchObject({ core: { scenarioId: 'first-scenario', phase: 'characterSelect' } });
        expect(random).toBeNull();
        const detail = await (await fetch(`${h.base}/games/betrayal/${result.body.matchID}`)).json();
        expect(detail.players[2].isAi).toBe(true);
        expect(JSON.stringify(detail)).not.toContain('synthetic-password');
        expect(JSON.stringify(detail)).not.toContain(result.body.ownerCredentials);
        expect(detail.setupData).not.toHaveProperty('ownerKey');
    });

    it.each([
        ['bad proof', 'wrong', {}, 403, 'REMATCH_PROOF_INVALID'],
        ['unsupported setup', ownerProofValue, { privateDeck: ['secret'] }, 409, 'REMATCH_SETUP_UNSUPPORTED'],
    ] as const)('keeps an active source syncable after %s', async (_label, proof, extra, status, error) => {
        const h = await harness(extra); const socket = await h.connect(); await h.sync(socket, 'old');
        expect(await h.rematch(proof)).toEqual({ status, body: { error } });
        expect((await h.storage.fetch('old', { metadata: true })).metadata).toBeDefined();
        expect((await h.sync(socket, 'old'))[0]).toBe('old');
    });

    it.each(['state', 'metadata'] as const)('keeps the concurrently changed %s and runtime after CAS rejection', async change => {
        const h = await harness(); const socket = await h.connect(); await h.sync(socket, 'old');
        const original = h.storage.fetchMatchForReplacement.bind(h.storage);
        vi.spyOn(h.storage, 'fetchMatchForReplacement').mockImplementationOnce(async id => {
            const snapshot = await original(id);
            if (change === 'state') await h.storage.setState(id, { ...snapshot!.state, _stateID: 71 });
            else await h.storage.setMetadata(id, { ...snapshot!.metadata, updatedAt: 71 });
            return snapshot;
        });
        expect(await h.rematch()).toEqual({ status: 409, body: { error: 'ROOM_REPLACEMENT_CONFLICT' } });
        const kept = await h.storage.fetch('old', { state: true, metadata: true });
        expect(change === 'state' ? kept.state?._stateID : kept.metadata?.updatedAt).toBe(71);
        expect(await h.storage.listMatches()).toEqual(['old']);
        expect((await h.sync(socket, 'old'))[0]).toBe('old');
    });
});


it('delivers the successor to an authenticated follower while the owner HTTP response stays delayed past 8 seconds', async () => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const h = await harness({}, held);
    const follower = await h.joinFollower();
    const notified = once(follower, 'debug:newRoom');
    let responseFinished = false;
    const started = Date.now();
    const request = h.rematch().then(result => { responseFinished = true; return result; });
    try {
        const notification = await notified;
        expect(Date.now() - started).toBeLessThan(8000);
        expect(responseFinished).toBe(false);
        expect(notification).toEqual([{ url: expect.stringMatching(/^\/play\/betrayal\/match\/[a-f0-9]+$/) }]);
        expect(JSON.stringify(notification)).not.toContain('proof');
        // Real sockets and native HTTP continue while P0 has no create response.
        await new Promise(resolve => setTimeout(resolve, Math.max(0, 8100 - (Date.now() - started))));
        expect(responseFinished).toBe(false);
        release();
        const result = await request;
        expect(result.status).toBe(200);
        expect(notification).toEqual([{ url: `/play/betrayal/match/${result.body.matchID}` }]);
        const nextClient = await h.connect();
        expect((await h.sync(nextClient, result.body.matchID, result.body.ownerCredentials))[0]).toBe(result.body.matchID);
    } finally { release(); await request; }
}, 15000);


// Characterization of an unresolved recovery boundary, not a recovery PASS.
it('a lost creator response after commit leaves a successor that old guest proof cannot recover', async () => {
    let release!: () => void;
    const h = await harness({}, new Promise<void>(resolve => { release = resolve; }));
    const follower = await h.joinFollower();
    const notified = once(follower, 'debug:newRoom');
    const controller = new AbortController();
    const request = h.rematch(ownerProofValue, controller.signal).then(
        result => ({ result, error: undefined }),
        (error: Error) => ({ result: undefined, error }),
    );
    try {
        const [notification] = await notified as [{ url: string }];
        const nextMatchID = notification.url.split('/').at(-1)!;
        controller.abort();
        const outcome = await request;
        expect(outcome.result).toBeUndefined();
        expect(outcome.error?.name).toBe('AbortError');
        expect((await h.storage.fetch('old', { metadata: true })).metadata).toBeUndefined();
        expect((await h.storage.fetch(nextMatchID, { metadata: true })).metadata).toBeDefined();
        expect(await h.gameTransport.validateTestAccess(nextMatchID, '0', ownerProofValue)).toBe(false);
        const detail = await (await fetch(`${h.base}/games/betrayal/${nextMatchID}`)).json();
        expect(detail.players[0]).not.toHaveProperty('credentials');
        expect(notification).toEqual({ url: `/play/betrayal/match/${nextMatchID}` });
    } finally { release(); await request; }
});
