// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { CreateMatchData } from '../../../engine/transport/storage';
import { MatchReplacementOutcomeUnknownError } from '../../../engine/transport/storage';
import { MongoStorage } from '../MongoStorage';

const data = (owner = 'guest:synthetic'): CreateMatchData => ({
    initialState: { G: { core: { turn: 1 } }, _stateID: 7 },
    metadata: {
        gameName: 'tictactoe', players: { '0': { credentials: 'synthetic-proof' }, '1': {} },
        setupData: { ownerKey: owner, ownerType: 'guest', ttlSeconds: 3600 },
        createdAt: 1, updatedAt: 1, gameover: { winner: '0' },
    },
});

describe('MongoStorage single-document replacement CAS', () => {
    let mongo: MongoMemoryServer | undefined;
    let directory: string | undefined;
    const storage = new MongoStorage();
    const collection = () => mongoose.model('Match').collection;
    beforeAll(async () => {
        directory = await mkdtemp(join(tmpdir(), 'match-replacement-'));
        vi.stubEnv('MONGOMS_DOWNLOAD_DIR', join(tmpdir(), 'match-replacement-mongodb-binaries'));
        vi.stubEnv('MONGOMS_PREFER_GLOBAL_PATH', 'false');
        // Never call resolvePreferredTestMongoUri: it can reuse MONGO_URI or an
        // existing local database. This suite owns a fresh local mongod/dbPath.
        mongo = await MongoMemoryServer.create({
            instance: { ip: '127.0.0.1', dbPath: directory, storageEngine: 'wiredTiger' },
            binary: { version: '7.0.24', downloadDir: join(tmpdir(), 'match-replacement-mongodb-binaries') },
        });
        await mongoose.connect(mongo.getUri(), { dbName: 'isolated-match-replacement' });
        await storage.connect();
        await mongoose.model('Match').init();
    }, 180000);
    beforeEach(async () => { await collection().deleteMany({}); });
    afterEach(() => { vi.restoreAllMocks(); });
    afterAll(async () => {
        await mongoose.disconnect();
        await mongo?.stop();
        if (directory) await rm(directory, { recursive: true, force: true });
        vi.unstubAllEnvs();
    });

    it('renames one document, preserves _id, resets TTL/timestamps and discards old extra fields', async () => {
        await storage.createMatch('old', data());
        await collection().updateOne({ matchID: 'old' }, { $set: { legacyPrivateField: 'old' } });
        const original = await collection().findOne({ matchID: 'old' });
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        const next = data(); next.initialState._stateID = 0; next.metadata.setupData = { ownerKey: 'guest:synthetic', ownerType: 'guest', ttlSeconds: 7200 };
        expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'new', next)).toBe('replaced');
        expect(await collection().countDocuments({})).toBe(1);
        expect(await collection().findOne({ matchID: 'old' })).toBeNull();
        const created = (await collection().findOne({ matchID: 'new' }))!;
        expect(created._id).toEqual(original!._id);
        expect(created.state).toEqual(next.initialState);
        expect(created.metadata).toEqual(next.metadata);
        expect(created.ttlSeconds).toBe(7200);
        expect(created.expiresAt.getTime()).toBeGreaterThan(original!.expiresAt.getTime());
        expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(original!.createdAt.getTime());
        expect(created.legacyPrivateField).toBeUndefined();
    });

    it.each(['state', 'metadata', 'claim', 'ttl', 'expiry', 'extra', 'missing-to-null', 'wipe', 'recreate'] as const)(
        'rejects concurrent %s changes and leaves the winning data untouched', async kind => {
            await storage.createMatch('old', data()); const snapshot = (await storage.fetchMatchForReplacement('old'))!;
            if (kind === 'state') await storage.setState('old', { G: { core: { turn: 2 } }, _stateID: 7 });
            if (kind === 'metadata') await collection().updateOne({ matchID: 'old' }, { $set: { 'metadata.players.0.credentials': 'SYNTHETIC-PROOF' } });
            if (kind === 'claim') await storage.claimSeatMetadata('old', { playerID: '1', playerCredentials: 'new-seat' });
            if (kind === 'ttl') await collection().updateOne({ matchID: 'old' }, { $set: { ttlSeconds: 1 } });
            if (kind === 'expiry') await collection().updateOne({ matchID: 'old' }, { $set: { expiresAt: new Date(Date.now() + 36000000) } });
            if (kind === 'extra') await collection().updateOne({ matchID: 'old' }, { $set: { extraConcurrentField: true } });
            if (kind === 'missing-to-null') await collection().updateOne({ matchID: 'old' }, { $set: { formerlyMissing: null } });
            if (kind === 'wipe' || kind === 'recreate') await storage.wipe('old');
            if (kind === 'recreate') await storage.createMatch('old', data());
            const current = await collection().findOne({ matchID: 'old' });
            expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('conflict');
            expect(await collection().findOne({ matchID: 'old' })).toEqual(current);
            expect(await collection().findOne({ matchID: 'new' })).toBeNull();
        },
    );

    it('allows one winner across independent storage instances and simultaneous commands', async () => {
        await storage.createMatch('old', data()); const other = new MongoStorage();
        const a = (await storage.fetchMatchForReplacement('old'))!; const b = (await other.fetchMatchForReplacement('old'))!;
        const results = await Promise.all([storage.replaceMatchIfUnchanged('old', a, 'new-a', data()), other.replaceMatchIfUnchanged('old', b, 'new-b', data())]);
        expect(results.sort()).toEqual(['conflict', 'replaced']);
        expect(await collection().countDocuments({})).toBe(1);
    });

    it('leaves both rooms intact on an actual unique-index target collision', async () => {
        await storage.createMatch('old', data()); await storage.createMatch('new', data('guest:other'));
        const before = await collection().find({}).toArray();
        expect(await storage.replaceMatchIfUnchanged('old', (await storage.fetchMatchForReplacement('old'))!, 'new', data())).toBe('conflict');
        expect(await collection().find({}).toArray()).toEqual(before);
    });

    it('keeps its BSON token independent from returned state and metadata references', async () => {
        await storage.createMatch('old', data()); const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        snapshot.state._stateID = 99; snapshot.metadata.players['0'].credentials = 'changed locally';
        expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('replaced');
    });

    it('rejects a token from another instance or source ID', async () => {
        await storage.createMatch('old', data()); const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        expect(await new MongoStorage().replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('conflict');
        expect(await storage.replaceMatchIfUnchanged('different', snapshot, 'new', data())).toBe('conflict');
        expect(await collection().countDocuments({ matchID: 'old' })).toBe(1);
    });

    it('fails preparation before any write for unsupported or oversized new data', async () => {
        await storage.createMatch('old', data()); const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        const write = vi.spyOn(collection(), 'replaceOne');
        const invalid = data(); invalid.initialState.G = () => undefined;
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', invalid)).rejects.toThrow();
        const large = data(); large.initialState.G = { payload: 'x'.repeat(17 * 1024 * 1024) };
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', large)).rejects.toThrow();
        expect(write).not.toHaveBeenCalled();
        expect(await collection().countDocuments({ matchID: 'old' })).toBe(1);
    });

    it('does not resurrect the removed ID through late updates or claims', async () => {
        await storage.createMatch('old', data());
        await storage.replaceMatchIfUnchanged('old', (await storage.fetchMatchForReplacement('old'))!, 'new', data());
        await Promise.all([storage.setState('old', data().initialState), storage.setMetadata('old', data().metadata), storage.claimSeatMetadata('old', { playerID: '1', playerCredentials: 'late' })]);
        expect(await collection().countDocuments({})).toBe(1);
        expect(await collection().findOne({ matchID: 'old' })).toBeNull();
    });

    it('confirms a lost response only by reading back the exact committed new document', async () => {
        await storage.createMatch('old', data()); const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        const original = collection().replaceOne.bind(collection());
        vi.spyOn(collection(), 'replaceOne').mockImplementationOnce(async (...args) => {
            await original(...args);
            throw new mongoose.mongo.MongoNetworkError('synthetic lost write response');
        });
        expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('replaced');
        expect(await collection().findOne({ matchID: 'old' })).toBeNull();
        expect(await collection().countDocuments({ matchID: 'new' })).toBe(1);
    });
    it('reports an uncertain result if the write committed but readback also fails', async () => {
        await storage.createMatch('old', data()); const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        const original = collection().replaceOne.bind(collection());
        vi.spyOn(collection(), 'replaceOne').mockImplementationOnce(async (...args) => {
            await original(...args);
            throw new mongoose.mongo.MongoNetworkError('synthetic lost write response');
        });
        vi.spyOn(collection(), 'findOne').mockRejectedValueOnce(new mongoose.mongo.MongoNetworkError('synthetic readback failure'));
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).rejects.toBeInstanceOf(MatchReplacementOutcomeUnknownError);
        expect(await collection().findOne({ matchID: 'old' })).toBeNull();
        expect(await collection().countDocuments({ matchID: 'new' })).toBe(1);
    });

});
