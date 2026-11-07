// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { CreateMatchData, MatchReplacementSnapshot } from '../../../engine/transport/storage';
import { isMatchReplacementStorage } from '../../../engine/transport/storage';
import { HybridStorage } from '../HybridStorage';
import type { MongoStorage } from '../MongoStorage';

const data = (owner = 'guest:one'): CreateMatchData => ({
    initialState: { G: { core: { turn: 1 } }, _stateID: 7 },
    metadata: {
        gameName: 'tictactoe', players: { '0': { credentials: 'synthetic-owner' }, '1': {} },
        setupData: { ownerKey: owner, ownerType: owner.startsWith('user:') ? 'user' : 'guest' },
        createdAt: 1, updatedAt: 1, gameover: { winner: '0' },
    },
});
const build = () => new HybridStorage({} as MongoStorage, { persistentEnabled: false });
const snapshot = async (storage: HybridStorage) => (await storage.fetchMatchForReplacement('old'))!;

describe('HybridStorage atomic room replacement', () => {
    it('exposes an optional capability and moves the room and owner index together', async () => {
        const storage = build();
        expect(isMatchReplacementStorage(storage)).toBe(true);
        expect(isMatchReplacementStorage({} as HybridStorage)).toBe(false);
        await storage.createMatch('old', data());
        const next = data(); next.initialState._stateID = 0;
        expect(await storage.replaceMatchIfUnchanged('old', await snapshot(storage), 'new', next)).toBe('replaced');
        expect(await storage.fetch('old', { state: true, metadata: true })).toEqual({ state: undefined, metadata: undefined });
        expect(await storage.fetch('new', { state: true, metadata: true })).toEqual({ state: next.initialState, metadata: next.metadata });
        expect(await storage.findMatchesByOwnerKey('guest:one')).toEqual([{ matchID: 'new', gameName: 'tictactoe' }]);
    });

    it.each(['state', 'metadata', 'claim', 'wipe', 'recreate'] as const)('rejects a concurrent %s without destroying the current room', async kind => {
        const storage = build(); await storage.createMatch('old', data());
        const before = await snapshot(storage);
        if (kind === 'state') await storage.setState('old', { G: { core: { turn: 2 } }, _stateID: 7 });
        if (kind === 'metadata') { const changed = data().metadata; changed.players['0'].isConnected = true; await storage.setMetadata('old', changed); }
        if (kind === 'claim') await storage.claimSeatMetadata('old', { playerID: '1', playerCredentials: 'new-seat' });
        if (kind === 'wipe' || kind === 'recreate') await storage.wipe('old');
        if (kind === 'recreate') await storage.createMatch('old', data());
        const current = await storage.fetch('old', { state: true, metadata: true });
        expect(await storage.replaceMatchIfUnchanged('old', before, 'new', data())).toBe('conflict');
        expect(await storage.fetch('old', { state: true, metadata: true })).toEqual(current);
        expect((await storage.fetch('new', { metadata: true })).metadata).toBeUndefined();
    });

    it('lets only one replacement win for the same snapshot', async () => {
        const storage = build(); await storage.createMatch('old', data());
        const before = await snapshot(storage);
        expect(await Promise.all([
            storage.replaceMatchIfUnchanged('old', before, 'new-a', data()),
            storage.replaceMatchIfUnchanged('old', before, 'new-b', data()),
        ])).toEqual(['replaced', 'conflict']);
        expect(await storage.listMatches()).toEqual(['new-a']);
    });

    it.each([true, false])('keeps concurrent create/replace linearizable (create first: %s)', async createFirst => {
        const storage = build(); await storage.createMatch('old', data()); const before = await snapshot(storage);
        const create = () => storage.createMatch('new', data('guest:two'));
        const replace = () => storage.replaceMatchIfUnchanged('old', before, 'new', data());
        const results = await Promise.allSettled(createFirst ? [create(), replace()] : [replace(), create()]);
        if (createFirst) {
            expect(results[1]).toEqual({ status: 'fulfilled', value: 'conflict' });
            expect((await storage.fetch('old', { metadata: true })).metadata).toEqual(data().metadata);
            expect((await storage.fetch('new', { metadata: true })).metadata).toEqual(data('guest:two').metadata);
        } else {
            expect(results[0]).toEqual({ status: 'fulfilled', value: 'replaced' });
            expect(results[1].status).toBe('rejected');
            expect(await storage.listMatches()).toEqual(['new']);
            expect((await storage.fetch('new', { metadata: true })).metadata).toEqual(data().metadata);
        }
    });

    it('does not allow snapshot or ordinary read/write reference mutation to alter stored data', async () => {
        const storage = build(); const original = data(); await storage.createMatch('old', original);
        original.metadata.players['0'].credentials = 'mutated';
        original.initialState._stateID = 99;
        const before = await snapshot(storage);
        expect(before.metadata.players['0'].credentials).toBe('synthetic-owner');
        expect(before.state._stateID).toBe(7);
        before.metadata.players['0'].credentials = 'snapshot-mutation'; before.state._stateID = 100;
        const read = await storage.fetch('old', { state: true, metadata: true });
        read.metadata!.players['0'].credentials = 'read-mutation'; read.state!._stateID = 101;
        expect(await storage.replaceMatchIfUnchanged('old', before, 'new', data())).toBe('replaced');
    });

    it('keeps both rooms on target ID collision and rejects direct duplicate creation', async () => {
        const storage = build(); await storage.createMatch('old', data()); await storage.createMatch('new', data('guest:two'));
        expect(await storage.replaceMatchIfUnchanged('old', await snapshot(storage), 'new', data())).toBe('conflict');
        await expect(storage.createMatch('new', data('guest:three'))).rejects.toThrow();
        expect((await storage.fetch('new', { metadata: true })).metadata).toEqual(data('guest:two').metadata);
        expect(await storage.findMatchesByOwnerKey('guest:one')).toEqual([{ matchID: 'old', gameName: 'tictactoe' }]);
    });

    it('keeps the old room when new data cannot be cloned', async () => {
        const storage = build(); await storage.createMatch('old', data()); const before = await snapshot(storage);
        const invalid = data(); invalid.initialState.G = () => undefined;
        await expect(storage.replaceMatchIfUnchanged('old', before, 'new', invalid)).rejects.toThrow();
        expect(await storage.listMatches()).toEqual(['old']);
        expect(await storage.replaceMatchIfUnchanged('old', before, 'new', data())).toBe('replaced');
    });

    it('does not resurrect an old ID through late setters or seat claims', async () => {
        const storage = build(); await storage.createMatch('old', data()); const before = await snapshot(storage);
        const lateState = storage.setState('old', { G: { late: true }, _stateID: 8 });
        const lateMetadata = storage.setMetadata('old', data().metadata);
        const replace = storage.replaceMatchIfUnchanged('old', before, 'new', data());
        await Promise.all([lateState, lateMetadata, replace]);
        // A write that wins before CAS must cause a conflict, never loss of its update.
        if ((await storage.fetch('old', { metadata: true })).metadata) {
            expect(await replace).toBe('conflict');
            expect(await storage.replaceMatchIfUnchanged('old', await snapshot(storage), 'new', data())).toBe('replaced');
        }
        await Promise.all([storage.setState('old', data().initialState), storage.setMetadata('old', data().metadata), storage.claimSeatMetadata('old', { playerID: '1', playerCredentials: 'late' })]);
        expect(await storage.listMatches()).toEqual(['new']);
    });

    it('does not make a failed create visible in routing or owner indexes', async () => {
        const storage = build(); const invalid = data(); invalid.initialState.G = () => undefined;
        await expect(storage.createMatch('broken', invalid)).rejects.toThrow();
        expect(await storage.findMatchesByOwnerKey('guest:one')).toEqual([]);
        await storage.createMatch('valid', data()); expect(await storage.listMatches()).toEqual(['valid']);
    });

    it('preserves the snapshot target and refuses migration without calling a backend write', async () => {
        const mongoSnapshot: MatchReplacementSnapshot = { state: data('user:one').initialState, metadata: data('user:one').metadata, token: {} };
        const mongo = { fetchMatchForReplacement: vi.fn(async () => mongoSnapshot), replaceMatchIfUnchanged: vi.fn() };
        const storage = new HybridStorage(mongo as unknown as MongoStorage, { persistGuestRooms: false });
        const before = await snapshot(storage);
        expect(await storage.replaceMatchIfUnchanged('old', before, 'new', data())).toBe('conflict');
        expect(mongo.replaceMatchIfUnchanged).not.toHaveBeenCalled();
    });

    it('propagates uncertain Mongo results without claiming success or fallback creation', async () => {
        const mongoSnapshot: MatchReplacementSnapshot = { state: data('user:one').initialState, metadata: data('user:one').metadata, token: {} };
        const mongo = { fetchMatchForReplacement: vi.fn(async () => mongoSnapshot), replaceMatchIfUnchanged: vi.fn(async () => { throw new Error('result unknown'); }), createMatch: vi.fn() };
        const storage = new HybridStorage(mongo as unknown as MongoStorage);
        await expect(storage.replaceMatchIfUnchanged('old', await snapshot(storage), 'new', data('user:one'))).rejects.toThrow('result unknown');
        expect(mongo.createMatch).not.toHaveBeenCalled();
    });
});
