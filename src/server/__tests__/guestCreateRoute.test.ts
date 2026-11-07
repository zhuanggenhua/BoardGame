import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import * as ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as ownerProof from '../guestRoomOwnership';
import * as duplicateRooms from '../duplicateOwnerRooms';
import { evaluateEmptyRoomJoinGuard } from '../joinGuard';
import type { MatchMetadata } from '../../engine/transport/storage';

// Execute the actual registered production callback, not a copied route body.
// External storage/runtime/HTTP context are synthetic; server startup is not run.
const source = ts.createSourceFile('server.ts', readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
function route(path: string, environment: Record<string, unknown>) {
    let callback: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'router.post'
            && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) callback = node.arguments[1];
        ts.forEachChild(node, visit);
    };
    visit(source);
    if (!callback) throw new Error('Production callback not found');
    const compiled = ts.transpileModule(`const handler = ${callback.getText(source)}; handler;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
    return runInNewContext(compiled.outputText, environment) as (ctx: Record<string, unknown>) => Promise<void>;
}
const ownerKey = 'guest:synthetic-owner';
const oldMetadata = (): MatchMetadata => ({
    gameName: 'tictactoe', players: { '0': { ownerKey, credentials: 'synthetic-old-proof' }, '1': {} },
    setupData: { ownerKey, ownerType: 'guest' }, createdAt: 0, updatedAt: 0,
});
function harness(options: { old?: MatchMetadata; type?: 'guest' | 'user'; body?: Record<string, unknown>; race?: boolean; setupFailure?: boolean; concurrentMetadata?: boolean; other?: boolean; unsupportedStorage?: boolean } = {}) {
    const type = options.type ?? 'guest';
    const rooms = new Map<string, MatchMetadata>(options.old ? [['old', structuredClone(options.old)]] : []);
    if (options.other && options.old) rooms.set('other', structuredClone(options.old));
    const storage = {
        fetchMatchForReplacement: vi.fn(async (id: string) => rooms.has(id) ? structuredClone({ metadata: rooms.get(id), state: { G: {}, _stateID: 0 }, token: id }) : undefined),
        replaceMatchIfUnchanged: vi.fn(async (sourceID: string, snapshot: { metadata: MatchMetadata }, id: string, data: { metadata: MatchMetadata }) => {
            if (!isDeepStrictEqual(rooms.get(sourceID), snapshot.metadata)) return 'conflict';
            rooms.set(id, data.metadata); rooms.delete(sourceID); return 'replaced';
        }),
        findMatchesByOwnerKey: vi.fn(async () => options.race ? [] : [...rooms].map(([matchID, metadata]) => ({ matchID, gameName: metadata.gameName }))),
        fetch: vi.fn(async (id: string) => ({ metadata: rooms.get(id) })),
        createMatch: vi.fn(async (id: string, data: { metadata: MatchMetadata }) => {
            if (options.race) throw new Error('ACTIVE_MATCH_EXISTS:tictactoe:old');
            rooms.set(id, data.metadata);
        }),
        setMetadata: vi.fn(),
    };
    const cleanupMatchRoom = vi.fn(async (id: string) => rooms.delete(id));
    const gameTransport = { setupMatch: vi.fn(async () => {
        if (options.setupFailure) throw new Error('synthetic setup failure');
        if (options.concurrentMetadata) rooms.get('old')!.players['0'].credentials = 'rotated-proof';
        return { state: {}, randomCursor: 0 };
    }), updateMatchMetadata: vi.fn() };
    const cleanupReplacedMatchRuntime = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const env = {
        ...ownerProof, ...duplicateRooms, storage, cleanupMatchRoom, cleanupReplacedMatchRuntime, gameTransport, logger,
        isMatchReplacementStorage: () => !options.unsupportedStorage,
        normalizeGameName: (name: string) => name, isSupportedGame: () => true,
        GAME_SERVER_MANIFEST: [{ manifest: { id: 'tictactoe' }, engineConfig: {} }],
        resolveAllowedPlayerCountsForGame: () => [2], isSupportedPlayerCount: () => true,
        resolveOwnerFromRequest: () => ({ ownerKey: type === 'guest' ? ownerKey : 'user:synthetic-owner', ownerType: type }),
        supportsOwnerMatchLookup: () => true, nanoid: (length: number) => `synthetic-generated-${length}`,
        setTimeout: vi.fn(), lobbyCoordinator: { handleMatchCreated: vi.fn() },
        evaluateEmptyRoomJoinGuard, JWT_SECRET: 'synthetic-test-only',
    };
    const ctx = {
        params: { name: 'tictactoe', matchID: 'old' }, request: { body: options.body ?? { numPlayers: 2, setupData: { guestId: 'synthetic-owner' } } },
        status: 200, body: undefined as unknown, get: () => '',
        throw: (status: number, message: string) => { throw Object.assign(new Error(message), { status }); },
    };
    return { ctx, env, rooms, storage, cleanupMatchRoom, cleanupReplacedMatchRuntime, gameTransport, logger };
}
describe('production guest create/join callback integration', () => {
    it.each([undefined, 'wrong'])('refuses replacement before prevMatch state reads, deletion or setup: %s', previousOwnerCredentials => {
        const h = harness({ old: oldMetadata(), body: { setupData: { guestId: 'synthetic-owner', prevMatchID: 'old' }, previousOwnerCredentials } });
        return route('/games/:name/create', h.env)(h.ctx).then(() => {
            expect(h.ctx.status).toBe(403);
            expect(h.ctx.body).toEqual({ error: previousOwnerCredentials ? 'GUEST_OWNER_PROOF_INVALID' : 'GUEST_OWNER_PROOF_REQUIRED' });
            expect(h.storage.fetchMatchForReplacement.mock.calls).toHaveLength(1);
            expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
            expect(h.gameTransport.setupMatch).not.toHaveBeenCalled();
            expect(h.storage.createMatch).not.toHaveBeenCalled();
        });
    });
    it('creates a first unnamed guest room and returns fresh P0 proof only to its creator', async () => {
        const h = harness(); await route('/games/:name/create', h.env)(h.ctx);
        expect(h.ctx.body).toMatchObject({ ownerPlayerID: '0', ownerCredentials: 'synthetic-generated-21' });
        expect(h.rooms.get('synthetic-generated-11')?.players['0'].credentials).toBe('synthetic-generated-21');
    });
    it('valid replacement succeeds and never forwards previous proof into setup, metadata, logs or response', async () => {
        const h = harness({ old: oldMetadata(), body: { previousOwnerCredentials: 'synthetic-old-proof', setupData: { guestId: 'synthetic-owner', previousOwnerCredentials: 'synthetic-old-proof' } } });
        await route('/games/:name/create', h.env)(h.ctx);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        expect(h.cleanupReplacedMatchRuntime).toHaveBeenCalledTimes(1);
        expect(h.storage.replaceMatchIfUnchanged).toHaveBeenCalledTimes(1);
        expect(h.storage.createMatch).not.toHaveBeenCalled();
        expect(h.rooms.has('old')).toBe(false);
        expect(JSON.stringify(h.ctx.body)).not.toContain('synthetic-old-proof');
        expect(JSON.stringify(h.gameTransport.setupMatch.mock.calls)).not.toContain('synthetic-old-proof');
        expect(JSON.stringify(h.storage.createMatch.mock.calls)).not.toContain('synthetic-old-proof');
        expect(JSON.stringify(h.logger.info.mock.calls)).not.toContain('synthetic-old-proof');
    });
    it('rejects a new competing room with a different credential instead of force-cleaning it', async () => {
        const h = harness({ old: oldMetadata(), race: true, body: { previousOwnerCredentials: 'wrong', setupData: { guestId: 'synthetic-owner' } } });
        await route('/games/:name/create', h.env)(h.ctx);
        expect(h.ctx.status).toBe(409);
        expect(h.ctx.body).toMatchObject({ error: 'ACTIVE_MATCH_EXISTS' });
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
    });
    it('preserves the account active-room conflict without a forced replacement request', async () => {
        const h = harness({ old: oldMetadata(), type: 'user' });
        await route('/games/:name/create', h.env)(h.ctx);
        expect(h.ctx.status).toBe(409); expect(h.ctx.body).toMatchObject({ error: 'ACTIVE_MATCH_EXISTS' });
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
    });
    it.each([ownerKey, undefined])('empty guest/ownerless join never mints credentials or deletes a room: %s', key => {
        const old = oldMetadata(); old.players = { '0': {}, '1': {} }; old.setupData = key ? { ownerKey: key } : {};
        const h = harness({ old, body: { playerID: '0', playerName: 'Synthetic', data: { guestId: 'synthetic-owner' } } });
        return route('/games/:name/:matchID/join', h.env)(h.ctx).then(() => {
            expect(h.ctx.status).toBe(key ? 409 : 403);
            if (key) expect(h.ctx.body).toEqual({ error: 'GUEST_OWNER_PROOF_UNAVAILABLE' });
            expect(h.storage.setMetadata).not.toHaveBeenCalled();
            expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        });
    });
});


describe('ordinary owner-room replacement is atomic too', () => {
    const body = { previousOwnerCredentials: 'synthetic-old-proof', setupData: { guestId: 'synthetic-owner' } };
    it('leaves the old room untouched if new-game initialization fails', async () => {
        const h = harness({ old: oldMetadata(), body, setupFailure: true });
        await expect(route('/games/:name/create', h.env)(h.ctx)).rejects.toThrow('synthetic setup failure');
        expect(h.rooms.has('old')).toBe(true);
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
        expect(h.cleanupReplacedMatchRuntime).not.toHaveBeenCalled();
        expect(h.storage.replaceMatchIfUnchanged).not.toHaveBeenCalled();
    });
    it('refuses a credential change between authorization and persistence', async () => {
        const h = harness({ old: oldMetadata(), body, concurrentMetadata: true });
        await route('/games/:name/create', h.env)(h.ctx);
        expect(h.ctx.body).toEqual({ error: 'ROOM_REPLACEMENT_CONFLICT' });
        expect(h.rooms.get('old')?.players['0'].credentials).toBe('rotated-proof');
        expect(h.rooms.size).toBe(1);
        expect(h.cleanupReplacedMatchRuntime).not.toHaveBeenCalled();
    });
    it.each([{ other: true }, { unsupportedStorage: true }])('fails closed for replacement outside the single-source atomic contract: %j', async flags => {
        const h = harness({ old: oldMetadata(), body, ...flags });
        await route('/games/:name/create', h.env)(h.ctx);
        expect(h.ctx.body).toEqual({ error: 'ROOM_REPLACEMENT_UNSUPPORTED' });
        expect(h.rooms.has('old')).toBe(true);
        expect(h.gameTransport.setupMatch).not.toHaveBeenCalled();
        expect(h.cleanupMatchRoom).not.toHaveBeenCalled();
    });
});
