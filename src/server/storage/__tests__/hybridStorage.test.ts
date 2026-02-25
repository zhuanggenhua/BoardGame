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

describe('HybridStorage 行为（统一 MongoDB）', () => {
    let mongo: MongoMemoryServer;
    let hybrid: HybridStorage;

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri(), { dbName: 'boardgame-test' });
        await mongoStorage.connect();
    }, 60_000);

    beforeEach(async () => {
        await mongoose.connection.db!.dropDatabase();
        hybrid = new HybridStorage(mongoStorage);
        await hybrid.connect();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongo.stop();
    });

    it('游客房间持久化到 MongoDB（服务重启后可恢复）', async () => {
        await hybrid.createMatch('guest-1', buildCreateData());

        const Match = mongoose.model('Match');
        const doc = await Match.findOne({ matchID: 'guest-1' }).lean();
        expect(doc).toBeTruthy();

        const { metadata } = await hybrid.fetch('guest-1', { metadata: true });
        expect(metadata).toBeTruthy();
    });

    it('游客重复创建会覆盖旧房间（MongoStorage ownerKey 去重）', async () => {
        await hybrid.createMatch('guest-1', buildCreateData());
        await hybrid.createMatch('guest-2', buildCreateData());

        const matches = await hybrid.listMatches();
        expect(matches).toContain('guest-2');
        expect(matches).not.toContain('guest-1');
    });

    it('注册用户房间持久化到 MongoDB', async () => {
        await hybrid.createMatch('user-1', buildCreateData({
            ownerKey: 'user:abc',
            ownerType: 'user',
        }));

        const Match = mongoose.model('Match');
        const doc = await Match.findOne({ matchID: 'user-1' }).lean();
        expect(doc).toBeTruthy();
    });

    it('临时房间断线超时后被清理', async () => {
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

        // MongoStorage.cleanupEphemeralMatches 需要 metadata 中有 disconnectedSince
        // 手动更新 metadata 以模拟断线状态
        await hybrid.setMetadata('guest-clean', baseMetadata);

        const cleaned = await hybrid.cleanupEphemeralMatches();
        expect(cleaned).toBeGreaterThanOrEqual(1);

        const { metadata: fetchedMetadata } = await hybrid.fetch('guest-clean', { metadata: true });
        expect(fetchedMetadata).toBeUndefined();
    });

    it('setState 和 fetch 正常工作', async () => {
        await hybrid.createMatch('test-1', buildCreateData());

        const newState: StoredMatchState = {
            G: { core: { hp: 10 }, sys: {} },
            _stateID: 1,
        };
        await hybrid.setState('test-1', newState);

        const { state } = await hybrid.fetch('test-1', { state: true });
        expect(state).toBeTruthy();
        expect(state!._stateID).toBe(1);
    });

    it('wipe 删除房间', async () => {
        await hybrid.createMatch('wipe-1', buildCreateData());
        await hybrid.wipe('wipe-1');

        const { metadata } = await hybrid.fetch('wipe-1', { metadata: true });
        expect(metadata).toBeUndefined();
    });
});
