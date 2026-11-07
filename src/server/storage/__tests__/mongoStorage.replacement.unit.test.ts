// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import type { CreateMatchData } from '../../../engine/transport/storage';
import { MatchReplacementOutcomeUnknownError } from '../../../engine/transport/storage';
import { MongoStorage } from '../MongoStorage';

const data = (): CreateMatchData => ({
    initialState: { G: { core: { turn: 1 } }, _stateID: 7 },
    metadata: { gameName: 'tictactoe', players: { '0': { credentials: 'synthetic-proof' }, '1': {} }, createdAt: 1, updatedAt: 1, setupData: { ttlSeconds: 3600 } },
});
const document = () => ({
    _id: new mongoose.Types.ObjectId(), matchID: 'old', gameName: 'tictactoe',
    state: data().initialState, metadata: data().metadata,
    ttlSeconds: 3600, expiresAt: new Date('2030-01-01'),
    createdAt: new Date(1), updatedAt: new Date(1), legacyField: { empty: null },
});

// Adapter contract tests, not a substitute for the real mongod integration suite.
describe('MongoStorage replacement command and failure boundaries', () => {
    let storage: MongoStorage;
    const collection = () => mongoose.model('Match').collection;
    beforeEach(async () => { storage = new MongoStorage(); await storage.connect(); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('issues one exact full-document CAS with _id, no upsert and bytewise collation', async () => {
        const old = document();
        const read = vi.spyOn(collection(), 'findOne').mockResolvedValueOnce(old);
        const write = vi.spyOn(collection(), 'replaceOne').mockResolvedValueOnce({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        snapshot.metadata.players['0'].credentials = 'external mutation'; snapshot.state._stateID = 100;
        expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('replaced');
        expect(read).toHaveBeenCalledTimes(1); expect(write).toHaveBeenCalledTimes(1);
        const [filter, next, options] = write.mock.calls[0];
        expect(filter).toEqual({ _id: old._id, matchID: 'old', $expr: { $eq: ['$$ROOT', { $literal: old }] } });
        expect(next).toMatchObject({ _id: old._id, matchID: 'new', state: data().initialState, metadata: data().metadata, ttlSeconds: 3600 });
        expect(next.legacyField).toBeUndefined();
        expect(next.expiresAt).toBeInstanceOf(Date);
        expect(options).toEqual({ upsert: false, collation: { locale: 'simple' } });
    });

    it('reports no-match or definite unique-key rejection as conflict without a second write', async () => {
        const read = vi.spyOn(collection(), 'findOne').mockResolvedValue(document());
        const write = vi.spyOn(collection(), 'replaceOne')
            .mockResolvedValueOnce({ acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null })
            .mockRejectedValueOnce(new mongoose.mongo.MongoServerError({ code: 11000, message: 'duplicate target ID' }));
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('conflict');
        expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'other', data())).toBe('conflict');
        expect(write).toHaveBeenCalledTimes(2); expect(read).toHaveBeenCalledTimes(1);
    });

    it('never submits a write if cloning, validation or complete command size preparation fails', async () => {
        vi.spyOn(collection(), 'findOne').mockResolvedValue(document()); const write = vi.spyOn(collection(), 'replaceOne');
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        const invalid = data(); invalid.initialState.G = () => undefined;
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', invalid)).rejects.toThrow();
        const invalidMetadata = data(); invalidMetadata.metadata.gameName = '';
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', invalidMetadata)).rejects.toThrow();
        const huge = data(); huge.initialState.G = { payload: 'x'.repeat(17 * 1024 * 1024) };
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', huge)).rejects.toThrow();
        expect(write).not.toHaveBeenCalled();
    });

    it('rejects command-envelope overflow even when each individual room is below 16 MiB', async () => {
        const old = document(); old.state.G = { payload: 'x'.repeat(9 * 1024 * 1024) };
        vi.spyOn(collection(), 'findOne').mockResolvedValue(old); const write = vi.spyOn(collection(), 'replaceOne');
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        const next = data(); next.initialState.G = { payload: 'y'.repeat(9 * 1024 * 1024) };
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', next)).rejects.toThrow();
        expect(write).not.toHaveBeenCalled();
    });

    it('confirms a lost response using only an exact new-document read, never retrying the write', async () => {
        const read = vi.spyOn(collection(), 'findOne').mockResolvedValueOnce(document());
        const write = vi.spyOn(collection(), 'replaceOne').mockRejectedValueOnce(new mongoose.mongo.MongoNetworkError('response lost'));
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        read.mockImplementationOnce(async filter => {
            const [, prepared] = write.mock.calls[0];
            expect(filter).toEqual({ _id: prepared._id, matchID: 'new', $expr: { $eq: ['$$ROOT', { $literal: prepared }] } });
            return prepared;
        });
        expect(await storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('replaced');
        expect(write).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(2);
    });

    it.each(['missing', 'read-failed', 'unacknowledged'] as const)('keeps %s outcomes uncertain without fallback creation/deletion/rewrite', async kind => {
        const read = vi.spyOn(collection(), 'findOne').mockResolvedValueOnce(document());
        const write = vi.spyOn(collection(), 'replaceOne');
        if (kind === 'unacknowledged') write.mockResolvedValueOnce({ acknowledged: false, matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null });
        else write.mockRejectedValueOnce(new mongoose.mongo.MongoNetworkError('write response lost'));
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        if (kind === 'read-failed') read.mockRejectedValueOnce(new mongoose.mongo.MongoNetworkError('read failed'));
        else read.mockResolvedValueOnce(null);
        await expect(storage.replaceMatchIfUnchanged('old', snapshot, 'new', data())).rejects.toBeInstanceOf(MatchReplacementOutcomeUnknownError);
        expect(write).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(2);
    });

    it('rejects foreign tokens before any backend write', async () => {
        vi.spyOn(collection(), 'findOne').mockResolvedValue(document()); const write = vi.spyOn(collection(), 'replaceOne');
        const snapshot = (await storage.fetchMatchForReplacement('old'))!;
        expect(await new MongoStorage().replaceMatchIfUnchanged('old', snapshot, 'new', data())).toBe('conflict');
        expect(await storage.replaceMatchIfUnchanged('other', snapshot, 'new', data())).toBe('conflict');
        expect(write).not.toHaveBeenCalled();
    });
});
