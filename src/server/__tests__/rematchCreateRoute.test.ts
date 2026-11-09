import { productionCallback } from './helpers/productionServerCallback';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { isAuthenticatedRematchPlayer } from '../rematch';
import * as rematchSetup from '../rematchSetup';
import * as recoveryServer from '../rematchRecovery';
import * as recoveryShared from '../../shared/rematchRecovery';
import * as ownerProof from '../guestRoomOwnership';
import * as duplicateRooms from '../duplicateOwnerRooms';
import { MatchReplacementOutcomeUnknownError, type MatchMetadata } from '../../engine/transport/storage';

// Runs registered production callbacks and the real inline error middleware.
// Storage/runtime are in-memory doubles; this is not HTTP/Mongo E2E.

const ownerKey = 'guest:synthetic-owner';
const sourceRoom = (setup: Record<string, unknown> = {}): MatchMetadata => ({
    gameName: 'betrayal', createdAt: 0, updatedAt: 0,
    players: { '0': { ownerKey, name: 'Owner', credentials: 'synthetic-proof' }, '1': {}, '2': {} },
    setupData: { ownerKey, ownerType: 'guest', guestId: 'synthetic-owner', scenario: 'first-scenario', ...setup },
});
function harness(options: { old?: MatchMetadata; credentials?: string; body?: Record<string, unknown>; other?: boolean; failure?: boolean; race?: 'metadata' | 'state'; storageFailure?: boolean; unsupportedStorage?: boolean; cleanupFailure?: boolean; uncertainWrite?: boolean } = {}) {
    const old = options.old ?? sourceRoom();
    const rooms = new Map([['old', structuredClone(old)]]);
    if (options.other) rooms.set('other', structuredClone(old));
    const states = new Map([['old', { G: { core: {} }, _stateID: 1 }]]);
    const storage = {
        fetchMatchForReplacement: vi.fn(async (id: string) => rooms.has(id) ? structuredClone({ metadata: rooms.get(id), state: states.get(id), token: id }) : undefined),
        replaceMatchIfUnchanged: vi.fn(async (sourceID: string, snapshot: { metadata: MatchMetadata; state: unknown }, id: string, data: { metadata: MatchMetadata; initialState: never }) => {
            if (options.storageFailure) throw new Error('synthetic database rejection before commit');
            if (!isDeepStrictEqual(rooms.get(sourceID), snapshot.metadata) || !isDeepStrictEqual(states.get(sourceID), snapshot.state)) return 'conflict';
            rooms.set(id, data.metadata); states.set(id, data.initialState); rooms.delete(sourceID); states.delete(sourceID);
            if (options.uncertainWrite) throw new MatchReplacementOutcomeUnknownError(new Error('synthetic write concern failure'));
            return 'replaced';
        }),
        fetch: vi.fn(async (id: string) => ({ metadata: rooms.get(id), state: { G: { core: {} } } })),
        findMatchesByOwnerKey: vi.fn(async () => [...rooms].map(([matchID, metadata]) => ({ matchID, gameName: metadata.gameName }))),
        createMatch: vi.fn(async (id: string, data: { metadata: MatchMetadata }) => rooms.set(id, data.metadata)),
    };
    const cleanupMatchRoom = vi.fn(async (id: string) => rooms.delete(id));
    const gameTransport = { setupMatch: vi.fn(async () => {
        if (options.failure) throw new Error('synthetic engine failure');
        if (options.race === 'metadata') rooms.get('old')!.players['0'].credentials = 'rotated-proof';
        if (options.race === 'state') states.get('old')!._stateID += 1;
        return { state: {}, randomCursor: 0 };
    }) };
    const cleanupReplacedMatchRuntime = vi.fn(() => { if (options.cleanupFailure) throw new Error('synthetic notification failure'); });
    const notifyRematchSuccessor = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const env = {
        ...rematchSetup, ...recoveryServer, ...recoveryShared, ...ownerProof, ...duplicateRooms, storage, cleanupMatchRoom, cleanupReplacedMatchRuntime, gameTransport, logger, notifyRematchSuccessor,
        isMatchReplacementStorage: () => !options.unsupportedStorage, MatchReplacementOutcomeUnknownError,
        normalizeGameName: (name: string) => name, isSupportedGame: () => true,
        GAME_SERVER_MANIFEST: [{ manifest: { id: old.gameName }, engineConfig: {} }],
        resolveAllowedPlayerCountsForGame: () => [3], isSupportedPlayerCount: (count: number) => count === 3,
        resolveOwnerFromRequest: vi.fn(() => { throw new Error('must not use public request ownership'); }),
        supportsOwnerMatchLookup: () => true, nanoid: (n: number) => `synthetic-new-${n}`,
        setTimeout: vi.fn(), lobbyCoordinator: { handleMatchCreated: vi.fn() },
        claimSeatUtils: { parseBearerToken: () => null, verifyGameToken: () => null }, JWT_SECRET: 'synthetic',
        process: { env: { NODE_ENV: 'production' } },
    };
    const ctx = {
        params: { name: old.gameName }, request: { body: options.body ?? { rematch: { matchID: 'old', playerID: '0', credentials: options.credentials ?? 'synthetic-proof' } } },
        method: 'POST', path: `/games/${old.gameName}/create`, get: () => '',
        status: 200, body: undefined as unknown, set: vi.fn(),
        throw: (status: number, message: string) => { throw Object.assign(new Error(message), { status }); },
    };
    const run = () => productionCallback('errors', env)(ctx, () => productionCallback('create', env)(ctx));
    return { ctx, rooms, states, storage, cleanupMatchRoom, cleanupReplacedMatchRuntime, gameTransport, logger, notifyRematchSuccessor, env, run };
}

describe('production rematch create route with error middleware', () => {
    it('inherits private Betrayal config with authoritative player count and guest ownership', async () => {
        const settings = { roomName: 'Original', enableAi: true, ttlSeconds: 259200, password: 'synthetic-password', seatControllers: { '0': { type: 'human' }, '1': { type: 'local-ai', difficulty: 'expert' }, '2': { type: 'human' } } };
        const h = harness({ old: sourceRoom(settings), body: { rematch: { matchID: 'old', playerID: '0', credentials: 'synthetic-proof' }, numPlayers: 99, setupData: { scenario: 'tampered', ownerKey: 'guest:attacker' } } });
        await h.run();
        expect(h.ctx.status).toBe(200);
        expect(h.storage.replaceMatchIfUnchanged).toHaveBeenCalledTimes(1);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        expect(h.storage.createMatch).not.toHaveBeenCalled();
        expect(h.cleanupReplacedMatchRuntime).toHaveBeenCalledTimes(1);
        expect(h.ctx.body).toEqual({ matchID: 'synthetic-new-11', ownerPlayerID: '0', ownerCredentials: 'synthetic-new-21', ownerType: 'guest' });
        expect(h.gameTransport.setupMatch).toHaveBeenCalledWith('synthetic-new-11', 'betrayal', ['0', '1', '2'], 'synthetic-new-16', expect.objectContaining(settings));
        expect(h.rooms.get('synthetic-new-11')?.setupData).toMatchObject({ ...settings, ownerKey, ownerType: 'guest', scenario: 'first-scenario' });
        expect(JSON.stringify(h.ctx.body)).not.toContain('synthetic-password');
        expect(JSON.stringify(h.logger.info.mock.calls)).not.toContain('synthetic-proof');
        expect(JSON.stringify(h.storage.createMatch.mock.calls)).not.toContain('synthetic-proof');
    });
    it.each([
        ['invalid proof', 'wrong', {}, 403, 'REMATCH_PROOF_INVALID'],
        ['unsupported setup', 'synthetic-proof', { privateDeck: ['secret'] }, 409, 'REMATCH_SETUP_UNSUPPORTED'],
        ['malformed TTL', 'synthetic-proof', { ttlSeconds: '86400' }, 409, 'REMATCH_SETUP_UNSUPPORTED'],
    ] as const)('preserves source and known error code in production: %s', async (_label, credentials, setup, status, code) => {
        const h = harness({ old: sourceRoom(setup), credentials });
        await h.run();
        expect(h.ctx.status).toBe(status);
        expect(h.ctx.body).toEqual({ error: code });
        expect(h.rooms.has('old')).toBe(true);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        expect(h.gameTransport.setupMatch).not.toHaveBeenCalled();
        expect(h.storage.createMatch).not.toHaveBeenCalled();
    });
    it('retains unverified game rather than creating a default match', async () => {
        const old = sourceRoom(); old.gameName = 'smashup';
        const h = harness({ old }); await h.run();
        expect(h.ctx.body).toEqual({ error: 'REMATCH_SETUP_UNSUPPORTED' });
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
    });
    it('source proof cannot force-delete a different room', async () => {
        const h = harness({ other: true }); await h.run();
        expect(h.ctx.status).toBe(409);
        expect(h.ctx.body).toMatchObject({ error: 'ACTIVE_MATCH_EXISTS', matchID: 'other', canForceReplace: false });
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
    });
    it('keeps the source when new runtime setup fails and hides internal error text in production', async () => {
        const h = harness({ failure: true }); await h.run();
        expect(h.ctx.status).toBe(500);
        expect(h.ctx.body).toEqual({ error: 'Internal Server Error' });
        expect(h.rooms.has('old')).toBe(true);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        expect(h.storage.createMatch).not.toHaveBeenCalled();
    });
});


describe('atomic replacement boundary in production create route', () => {
    it.each(['metadata', 'state'] as const)('refuses a concurrently changed %s without deleting or unloading the old room', async race => {
        const h = harness({ race }); await h.run();
        expect(h.ctx.status).toBe(409);
        expect(h.ctx.body).toEqual({ error: 'ROOM_REPLACEMENT_CONFLICT' });
        expect(h.rooms.has('old')).toBe(true);
        expect(h.rooms.has('synthetic-new-11')).toBe(false);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        expect(h.cleanupReplacedMatchRuntime).not.toHaveBeenCalled();
        expect(h.storage.createMatch).not.toHaveBeenCalled();
    });
    it('preserves the source on a confirmed persistence rejection before commit', async () => {
        const h = harness({ storageFailure: true }); await h.run();
        expect(h.ctx.status).toBe(500);
        expect(h.rooms.has('old')).toBe(true);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        expect(h.cleanupReplacedMatchRuntime).not.toHaveBeenCalled();
    });
    it('fails closed when storage cannot perform atomic replacement', async () => {
        const h = harness({ unsupportedStorage: true }); await h.run();
        expect(h.ctx.status).toBe(409);
        expect(h.ctx.body).toEqual({ error: 'ROOM_REPLACEMENT_UNSUPPORTED' });
        expect(h.rooms.has('old')).toBe(true);
        expect(h.gameTransport.setupMatch).not.toHaveBeenCalled();
    });
    it('does not turn a committed replacement into a false failure if runtime notification throws', async () => {
        const h = harness({ cleanupFailure: true }); await h.run();
        expect(h.ctx.status).toBe(200);
        expect(h.ctx.body).toMatchObject({ matchID: 'synthetic-new-11' });
        expect(h.rooms.has('synthetic-new-11')).toBe(true);
        expect(h.rooms.has('old')).toBe(false);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
    });
});


it('reports uncertain persistence without pretending the old room survived or retrying the write', async () => {
    const h = harness({ uncertainWrite: true }); await h.run();
    expect(h.ctx.status).toBe(503);
    expect(h.ctx.body).toEqual({ error: 'ROOM_REPLACEMENT_OUTCOME_UNKNOWN' });
    expect(h.rooms.has('old')).toBe(false);
    expect(h.rooms.has('synthetic-new-11')).toBe(true);
    expect(h.storage.replaceMatchIfUnchanged).toHaveBeenCalledTimes(1);
    expect(h.storage.createMatch).not.toHaveBeenCalled();
    expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
    expect(h.cleanupReplacedMatchRuntime).not.toHaveBeenCalled();
});


it('notifies the committed rematch before retiring its subscribers', async () => {
    const h = harness(); await h.run();
    expect(h.notifyRematchSuccessor).toHaveBeenCalledWith('old', expect.objectContaining({ gameName: 'betrayal' }), 'synthetic-new-11');
    expect(h.notifyRematchSuccessor.mock.invocationCallOrder[0]).toBeLessThan(h.cleanupReplacedMatchRuntime.mock.invocationCallOrder[0]);
});
it.each([{ race: 'state' as const }, { storageFailure: true }, { uncertainWrite: true }, { credentials: 'invalid' }])('does not notify a successor on rejection or uncertain commit %j', async options => {
    const h = harness(options); await h.run();
    expect(h.notifyRematchSuccessor).not.toHaveBeenCalled();
});
it('still returns committed owner proof and retires runtime when successor notification fails', async () => {
    const h = harness(); h.notifyRematchSuccessor.mockImplementation(() => { throw new Error('synthetic socket failure'); });
    await h.run(); expect(h.ctx.status).toBe(200);
    expect(h.ctx.body).toMatchObject({ ownerCredentials: 'synthetic-new-21' });
    expect(h.cleanupReplacedMatchRuntime).toHaveBeenCalledTimes(1);
});


it('notifies only current authenticated non-owner source subscribers with a URL, never private data', () => {
    const metadata = sourceRoom(); metadata.players['1'] = { credentials: 'follower-secret' };
    const socket = (data: Record<string, unknown>, joined = true) => ({
        data, rooms: new Set(joined ? ['rematch:old'] : []), emit: vi.fn(),
    });
    const valid = { rematchMatchId: 'old', rematchPlayerId: '1', rematchCredentials: 'follower-secret' };
    const sockets = new Map([
        ['valid', socket(valid)],
        ['owner', socket({ ...valid, rematchPlayerId: '0', rematchCredentials: 'synthetic-proof' })],
        ['invalid', socket({ ...valid, rematchCredentials: 'wrong' })],
        ['switched', socket({ ...valid, rematchMatchId: 'other' })],
        ['left', socket(valid, false)],
        ['unsubscribed', socket(valid)],
    ]);
    const notify = productionCallback<(id: string, metadata: MatchMetadata, next: string) => void>('successor', {
        matchSubscribers: new Map([['old', new Set(['valid', 'owner', 'invalid', 'switched', 'left', 'gone'])]]),
        lobbySocketIO: { sockets: { sockets } }, isAuthenticatedRematchPlayer,
        normalizeGameName: (name: string) => name.toLowerCase(), REMATCH_EVENTS: { DEBUG_NEW_ROOM: 'debug:newRoom' },
    });
    notify('old', metadata, 'next');
    expect(sockets.get('valid')!.emit.mock.calls).toEqual([['debug:newRoom', { url: '/play/betrayal/match/next' }]]);
    for (const [id, client] of sockets) if (id !== 'valid') expect(client.emit).not.toHaveBeenCalled();
    expect(JSON.stringify([...sockets.values()].flatMap(client => client.emit.mock.calls))).not.toContain('secret');
});


describe('durable rematch response recovery', () => {
    const recovery = { nextMatchID: 'abcdefghijklmnopqrstuv', token: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ' };
    const body = { rematch: { matchID: 'old', playerID: '0', credentials: 'synthetic-proof', recovery } };

    it('commits a recoverable successor and replays it after the source was removed', async () => {
        const h = harness({ body }); await h.run();
        expect(h.ctx.status).toBe(200);
        expect(h.ctx.body).toMatchObject({ matchID: recovery.nextMatchID, ownerCredentials: 'synthetic-new-21' });
        expect(h.rooms.get(recovery.nextMatchID)?.rematchRecovery).toMatchObject({ sourceMatchID: 'old' });
        expect(JSON.stringify(h.rooms.get(recovery.nextMatchID))).not.toContain(recovery.token);
        const first = h.ctx.body;
        await h.run();
        expect(h.ctx.body).toEqual(first);
        expect(h.gameTransport.setupMatch).toHaveBeenCalledTimes(1);
        expect(h.storage.replaceMatchIfUnchanged).toHaveBeenCalledTimes(1);
    });

    it('recovers a committed but uncertain write without creating or deleting again', async () => {
        const h = harness({ body, uncertainWrite: true }); await h.run();
        expect(h.ctx.status).toBe(200);
        expect(h.ctx.body).toMatchObject({ matchID: recovery.nextMatchID, ownerCredentials: 'synthetic-new-21' });
        expect(h.storage.replaceMatchIfUnchanged).toHaveBeenCalledTimes(1);
        expect(h.cleanupReplacedMatchRuntime).toHaveBeenCalledTimes(1);
        expect(h.notifyRematchSuccessor).toHaveBeenCalledTimes(1);
        expect(h.storage.createMatch).not.toHaveBeenCalled();
    });
    it('two same-request CAS candidates return only the committed winner credential', async () => {
        const h = harness({ body }); let sequence = 0;
        h.env.nanoid = (n: number) => n === 21 ? `candidate-${++sequence}` : `random-${n}`;
        let arrived = 0; let release!: () => void;
        const barrier = new Promise<void>(resolve => { release = resolve; });
        h.gameTransport.setupMatch.mockImplementation(async () => {
            if (++arrived === 2) release(); await barrier;
            return { state: {}, randomCursor: 0 };
        });
        const second = { ...h.ctx, request: { body } };
        await Promise.all([h.run(), productionCallback('errors', h.env)(second, () => productionCallback('create', h.env)(second))]);
        expect(h.ctx.status).toBe(200); expect(second.status).toBe(200); expect(second.body).toEqual(h.ctx.body);
        expect((h.ctx.body as { ownerCredentials: string }).ownerCredentials).toBe(h.rooms.get(recovery.nextMatchID)!.players['0'].credentials);
        expect(h.rooms.size).toBe(1); expect(h.storage.replaceMatchIfUnchanged).toHaveBeenCalledTimes(2);
        expect(h.notifyRematchSuccessor).toHaveBeenCalledTimes(1);
    });
    it('target collision never overwrites an unrelated room or removes the source', async () => {
        const h = harness({ body }); h.rooms.set(recovery.nextMatchID, sourceRoom());
        await h.run(); expect(h.ctx.status).toBe(409); expect(h.rooms.size).toBe(2);
        expect(h.storage.replaceMatchIfUnchanged).not.toHaveBeenCalled(); expect(h.gameTransport.setupMatch).not.toHaveBeenCalled();
    });
    it('confirms a winner that commits between target precheck and source lookup', async () => {
        const h = harness({ body }); await h.run(); const result = h.ctx.body;
        h.storage.fetch.mockResolvedValueOnce({ metadata: undefined, state: { G: { core: {} } } });
        await h.run(); expect(h.ctx.status).toBe(200); expect(h.ctx.body).toEqual(result);
        expect(h.storage.replaceMatchIfUnchanged).toHaveBeenCalledTimes(1);
    });

});
