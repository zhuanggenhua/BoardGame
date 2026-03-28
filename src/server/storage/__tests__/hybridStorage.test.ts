import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import type { MatchMetadata, StoredMatchState, CreateMatchData } from '../../../engine/transport/storage';
import { mongoStorage } from '../MongoStorage';
import { HybridStorage } from '../HybridStorage';
import { MONGO_TEST_HOOK_TIMEOUT_MS, createSharedMongoMemoryServer } from '../../testUtils/mongoMemory';
import type { MongoMemoryServer } from 'mongodb-memory-server';

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

// MongoDB 内存服务器在某些环境下启动很慢（>60s），暂时跳过测试
// 如需运行这些测试，请移除下面的 .skip
describe('HybridStorage 行为', () => {
    let mongo: MongoMemoryServer;
    let hybrid: HybridStorage;

    beforeAll(async () => {
        mongo = await createSharedMongoMemoryServer();
        await mongoose.connect(mongo.getUri(), { dbName: 'boardgame-test' });
        await mongoStorage.connect();
    }, MONGO_TEST_HOOK_TIMEOUT_MS);

    beforeEach(async () => {
        await mongoose.connection.db!.dropDatabase();
        hybrid = new HybridStorage(mongoStorage);
        await hybrid.connect();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongo) await mongo.stop(); // 防御性检查
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

const buildMongoStub = () => ({
    connect: vi.fn(async () => {}),
    createMatch: vi.fn(async () => {}),
    setState: vi.fn(async () => {}),
    setMetadata: vi.fn(async () => {}),
    fetch: vi.fn(async () => ({})),
    wipe: vi.fn(async () => {}),
    listMatches: vi.fn(async () => []),
    cleanupEphemeralMatches: vi.fn(async () => 0),
    findMatchesByOwnerKey: vi.fn(async () => []),
});

describe('HybridStorage 纯内存模式', () => {
    it('persistent=false 时用户房间也应只走内存，不触碰 Mongo', async () => {
        const mongoStub = buildMongoStub();
        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: false,
        });

        await hybrid.connect();
        await hybrid.createMatch('user-room-1', buildCreateData({
            ownerKey: 'user:owner-1',
            ownerType: 'user',
        }));

        const fetched = await hybrid.fetch('user-room-1', { metadata: true, state: true });
        const matches = await hybrid.listMatches();
        const ownerMatches = await hybrid.findMatchesByOwnerKey('user:owner-1');

        expect(fetched.metadata?.gameName).toBe('tictactoe');
        expect(matches).toEqual(['user-room-1']);
        expect(ownerMatches).toEqual([{ matchID: 'user-room-1', gameName: 'tictactoe' }]);

        expect(mongoStub.connect).not.toHaveBeenCalled();
        expect(mongoStub.createMatch).not.toHaveBeenCalled();
        expect(mongoStub.fetch).not.toHaveBeenCalled();
        expect(mongoStub.listMatches).not.toHaveBeenCalled();
        expect(mongoStub.findMatchesByOwnerKey).not.toHaveBeenCalled();
    });

    it('active guest room must block duplicate create instead of silent wipe', async () => {
        const mongoStub = buildMongoStub();
        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: false,
        });

        await hybrid.createMatch('guest-room-1', buildCreateData({
            ownerKey: 'guest:active-owner',
            guestId: 'active-owner',
            ownerType: 'guest',
        }));
        await hybrid.setMetadata('guest-room-1', {
            ...buildMetadata(buildSetupData({ ownerKey: 'guest:active-owner', guestId: 'active-owner', ownerType: 'guest' })),
            players: {
                0: { name: 'Alice', credentials: 'cred-a', isConnected: true },
                1: {},
            },
        });

        await expect(hybrid.createMatch('guest-room-2', buildCreateData({
            ownerKey: 'guest:active-owner',
            guestId: 'active-owner',
            ownerType: 'guest',
        }))).rejects.toThrow('ACTIVE_MATCH_EXISTS:tictactoe:guest-room-1');

        const matches = (await hybrid.listMatches()).sort();
        expect(matches).toEqual(['guest-room-1']);
        expect((await hybrid.fetch('guest-room-1', { metadata: true })).metadata?.players['0']?.name).toBe('Alice');
    });

    it('finished guest room can be replaced safely', async () => {
        const mongoStub = buildMongoStub();
        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: false,
        });

        const setupData = buildSetupData({ ownerKey: 'guest:finished-owner', guestId: 'finished-owner', ownerType: 'guest' });
        await hybrid.createMatch('guest-room-old', {
            initialState: buildState(setupData),
            metadata: {
                ...buildMetadata(setupData),
                gameover: { winner: '0' },
                players: {
                    0: { name: 'Alice', credentials: 'cred-a', isConnected: false },
                    1: { name: 'Bob', credentials: 'cred-b', isConnected: false },
                },
            },
        });

        await hybrid.createMatch('guest-room-new', buildCreateData({
            ownerKey: 'guest:finished-owner',
            guestId: 'finished-owner',
            ownerType: 'guest',
        }));

        const matches = (await hybrid.listMatches()).sort();
        expect(matches).toEqual(['guest-room-new']);
        expect((await hybrid.fetch('guest-room-old', { metadata: true })).metadata).toBeUndefined();
    });

    it('persistent=false 时缺失房间查询不应回退到 Mongo', async () => {
        const mongoStub = buildMongoStub();
        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: false,
        });

        const result = await hybrid.fetch('missing-room', { metadata: true });
        const cleaned = await hybrid.cleanupEphemeralMatches();

        expect(result.metadata).toBeUndefined();
        expect(cleaned).toBe(0);
        expect(mongoStub.fetch).not.toHaveBeenCalled();
        expect(mongoStub.cleanupEphemeralMatches).not.toHaveBeenCalled();
    });
});
