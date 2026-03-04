import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { MatchMetadata, StoredMatchState, CreateMatchData } from '../../../engine/transport/storage';
import { mongoStorage } from '../MongoStorage';
import { HybridStorage } from '../HybridStorage';

const buildState = (setupData: Record<string, unknown>): StoredMatchState => ({
    G: { __setupData: setupData },
    _stateID: 0,
});

const buildMetadata = (setupData: Record<string, unknown> | undefined): MatchMetadata => ({
    gameName: 'tictactoe',
    players: {
        0: { isConnected: false },
        1: { isConnected: false },
    },
    setupData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
} as MatchMetadata);

const buildSetupData = (overrides?: Record<string, unknown>): Record<string, unknown> => ({
    ownerKey: 'guest:1',
    ownerType: 'guest',
    ttlSeconds: 0,
    ...overrides,
});

const buildCreateData = (setupOverrides?: Record<string, unknown>): CreateMatchData => {
    const setupData = buildSetupData(setupOverrides);
    return {
        initialState: buildState(setupData),
        metadata: buildMetadata(setupData),
    };
};

describe('HybridStorage 行为', () => {
    let mongo: MongoMemoryServer;
    let hybrid: HybridStorage;

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri(), { dbName: 'boardgame-test' });
        await mongoStorage.connect();
    });

    beforeEach(async () => {
        await mongoose.connection.db!.dropDatabase();
        hybrid = new HybridStorage(mongoStorage);
        await hybrid.connect();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongo.stop();
    });

    it('游客房间只在内存中创建，不落库', async () => {
        await hybrid.createMatch('guest-1', buildCreateData());

        const Match = mongoose.model('Match');
        const doc = await Match.findOne({ matchID: 'guest-1' }).lean();
        expect(doc).toBeNull();

        const { metadata } = await hybrid.fetch('guest-1', { metadata: true });
        expect(metadata).toBeTruthy();
    });

    it('游客重复创建会覆盖旧房间', async () => {
        await hybrid.createMatch('guest-1', buildCreateData());
        await hybrid.createMatch('guest-2', buildCreateData());

        const matches = await hybrid.listMatches();
        expect(matches).toContain('guest-2');
        expect(matches).not.toContain('guest-1');
    });

    it('内存临时房间断线超时后清理', async () => {
        const disconnectedSince = Date.now() - 6 * 60 * 1000;
        const setupData = buildSetupData();
        const baseMetadata = {
            ...buildMetadata(setupData),
            disconnectedSince,
        } as MatchMetadata & { disconnectedSince?: number };
        const createData: CreateMatchData = {
            initialState: buildState(setupData),
            metadata: baseMetadata,
        };

        await hybrid.createMatch('guest-clean', createData);

        const cleaned = await hybrid.cleanupEphemeralMatches();
        expect(cleaned).toBe(1);

        const { metadata: fetchedMetadata } = await hybrid.fetch('guest-clean', { metadata: true });
        expect(fetchedMetadata).toBeUndefined();
    });
});
