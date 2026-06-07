import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import type { MatchMetadata, StoredMatchState, CreateMatchData } from '../../../engine/transport/storage';
import { mongoStorage } from '../MongoStorage';
import { HybridStorage } from '../HybridStorage';
import { MONGO_TEST_HOOK_TIMEOUT_MS, resolvePreferredTestMongoUri } from '../../testUtils/mongoMemory';
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
    let mongo: MongoMemoryServer | null = null;
    let hybrid: HybridStorage;

    beforeAll(async () => {
        const resolved = await resolvePreferredTestMongoUri();
        mongo = resolved.mongo;
        await mongoose.connect(resolved.mongoUri, { dbName: 'boardgame-test' });
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

    it('游客房间在持久化开启时落库，保证重启可恢复', async () => {
        await hybrid.createMatch('guest-1', buildCreateData());

        const Match = mongoose.model('Match');
        const doc = await Match.findOne({ matchID: 'guest-1' }).lean();
        expect(doc).toBeTruthy();

        const { metadata } = await hybrid.fetch('guest-1', { metadata: true });
        expect(metadata).toBeTruthy();
    });

    it('游客重复创建在存储层不自动覆盖，由上层防重逻辑处理', async () => {
        await hybrid.createMatch('guest-1', buildCreateData());
        await hybrid.createMatch('guest-2', buildCreateData());

        const matches = (await hybrid.listMatches()).sort();
        expect(matches).toEqual(['guest-1', 'guest-2']);
    });

    it('游客临时房间断线超时后清理（走 Mongo 清理流程）', async () => {
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

    it('Mongo 路径并发 claimSeatMetadata 应保留所有 seat 凭据', async () => {
        const setupData = buildSetupData({
            ownerKey: 'user:mongo-ai-owner',
            ownerType: 'user',
        });
        await hybrid.createMatch('mongo-ai-room', {
            initialState: buildState(setupData),
            metadata: {
                ...buildMetadata(setupData),
                players: {
                    0: { name: 'Host', credentials: 'host-cred' },
                    1: { name: 'AI-1' },
                    2: { name: 'AI-2' },
                    3: { name: 'AI-3' },
                },
            },
        });

        const results = await Promise.all(['1', '2', '3'].map((playerID) => hybrid.claimSeatMetadata(
            'mongo-ai-room',
            {
                playerID,
                playerCredentials: `mongo-cred-${playerID}`,
                playerName: `AI-${playerID}`,
            },
        )));
        const { metadata } = await hybrid.fetch('mongo-ai-room', { metadata: true });

        expect(results.map((result) => result.playerCredentials).sort())
            .toEqual(['mongo-cred-1', 'mongo-cred-2', 'mongo-cred-3']);
        expect(metadata?.players['1']?.credentials).toBe('mongo-cred-1');
        expect(metadata?.players['2']?.credentials).toBe('mongo-cred-2');
        expect(metadata?.players['3']?.credentials).toBe('mongo-cred-3');
    });
});

const buildMongoStub = () => ({
    connect: vi.fn(async () => {}),
    createMatch: vi.fn(async () => {}),
    setState: vi.fn(async () => {}),
    setMetadata: vi.fn(async () => {}),
    claimSeatMetadata: vi.fn(async () => ({ playerExists: false })),
    fetch: vi.fn(async () => ({})),
    fetchAuthMetadata: vi.fn(async () => undefined),
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

    it('persistent=false 时 fetchAuthMetadata 也应只走内存', async () => {
        const mongoStub = buildMongoStub();
        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: false,
        });

        await hybrid.createMatch('user-room-auth', buildCreateData({
            ownerKey: 'user:owner-auth',
            ownerType: 'user',
        }));

        const metadata = await hybrid.fetchAuthMetadata('user-room-auth');

        expect(metadata?.gameName).toBe('tictactoe');
        expect(metadata?.players['0']?.isConnected).toBe(false);
        expect(mongoStub.fetchAuthMetadata).not.toHaveBeenCalled();
        expect(mongoStub.fetch).not.toHaveBeenCalled();
    });

    it('persistent=false 时并发 claimSeatMetadata 应保留所有 seat 凭据', async () => {
        const mongoStub = buildMongoStub();
        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: false,
        });
        const setupData = buildSetupData({
            ownerKey: 'guest:ai-owner',
            guestId: 'ai-owner',
            ownerType: 'guest',
        });

        await hybrid.createMatch('guest-ai-room', {
            initialState: buildState(setupData),
            metadata: {
                ...buildMetadata(setupData),
                players: {
                    0: { name: 'Host', credentials: 'host-cred' },
                    1: { name: 'AI-1' },
                    2: { name: 'AI-2' },
                    3: { name: 'AI-3' },
                },
            },
        });

        const results = await Promise.all(['1', '2', '3'].map((playerID) => hybrid.claimSeatMetadata(
            'guest-ai-room',
            {
                playerID,
                playerCredentials: `cred-${playerID}`,
                playerName: `AI-${playerID}`,
            },
        )));
        const { metadata } = await hybrid.fetch('guest-ai-room', { metadata: true });

        expect(results.map((result) => result.playerCredentials).sort()).toEqual(['cred-1', 'cred-2', 'cred-3']);
        expect(metadata?.players['1']?.credentials).toBe('cred-1');
        expect(metadata?.players['2']?.credentials).toBe('cred-2');
        expect(metadata?.players['3']?.credentials).toBe('cred-3');
        expect(mongoStub.claimSeatMetadata).not.toHaveBeenCalled();
    });
});

describe('HybridStorage 缓存目标回退', () => {
    it('cleanup 清掉内存房间后，fetch 不应继续锁死在旧 memory cache，而应回退到 mongo 并刷新目标缓存', async () => {
        const mongoStub = buildMongoStub();
        const mongoMetadata = {
            ...buildMetadata(buildSetupData({ ownerKey: 'guest:fallback-owner', guestId: 'fallback-owner', ownerType: 'guest' })),
            players: {
                0: { name: 'Mongo Alice', credentials: 'mongo-cred', isConnected: true },
                1: {},
            },
        } satisfies MatchMetadata;
        mongoStub.fetch.mockImplementation(async (matchID: string, opts: { metadata?: boolean; state?: boolean }) => {
            if (matchID !== 'guest-fallback' || !opts.metadata) {
                return {};
            }
            return { metadata: mongoMetadata };
        });
        mongoStub.fetchAuthMetadata.mockImplementation(async (matchID: string) => (
            matchID === 'guest-fallback' ? mongoMetadata : undefined
        ));

        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: true,
            persistGuestRooms: false,
        });

        await hybrid.createMatch('guest-fallback', {
            initialState: buildState(buildSetupData({ ownerKey: 'guest:fallback-owner', guestId: 'fallback-owner', ownerType: 'guest' })),
            metadata: {
                ...buildMetadata(buildSetupData({ ownerKey: 'guest:fallback-owner', guestId: 'fallback-owner', ownerType: 'guest' })),
                players: {
                    0: {},
                    1: {},
                },
                disconnectedSince: Date.now() - 10 * 60 * 1000,
            },
        });

        expect((await hybrid.fetch('guest-fallback', { metadata: true })).metadata?.players['0']?.name).toBeUndefined();

        const cleaned = await hybrid.cleanupEphemeralMatches(0);
        expect(cleaned).toBe(1);

        const fetched = await hybrid.fetch('guest-fallback', { metadata: true });
        expect(fetched.metadata?.players['0']).toMatchObject({
            name: 'Mongo Alice',
            credentials: 'mongo-cred',
            isConnected: true,
        });

        const cachedTarget = (hybrid as unknown as { matchStorage: Map<string, 'mongo' | 'memory'> }).matchStorage.get('guest-fallback');
        expect(cachedTarget).toBe('mongo');
    });

    it('cached memory target miss 后，fetchAuthMetadata 也应回退到 mongo 并刷新目标缓存', async () => {
        const mongoStub = buildMongoStub();
        const mongoMetadata = {
            ...buildMetadata(buildSetupData({ ownerKey: 'guest:auth-owner', guestId: 'auth-owner', ownerType: 'guest' })),
            players: {
                0: { name: 'Mongo Bob', credentials: 'mongo-auth', isConnected: false },
                1: {},
            },
        } satisfies MatchMetadata;
        mongoStub.fetchAuthMetadata.mockImplementation(async (matchID: string) => (
            matchID === 'guest-auth-fallback' ? mongoMetadata : undefined
        ));

        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: true,
            persistGuestRooms: false,
        });

        await hybrid.createMatch('guest-auth-fallback', {
            initialState: buildState(buildSetupData({ ownerKey: 'guest:auth-owner', guestId: 'auth-owner', ownerType: 'guest' })),
            metadata: {
                ...buildMetadata(buildSetupData({ ownerKey: 'guest:auth-owner', guestId: 'auth-owner', ownerType: 'guest' })),
                players: {
                    0: {},
                    1: {},
                },
                disconnectedSince: Date.now() - 10 * 60 * 1000,
            },
        });

        const cleaned = await hybrid.cleanupEphemeralMatches(0);
        expect(cleaned).toBe(1);

        const metadata = await hybrid.fetchAuthMetadata('guest-auth-fallback');
        expect(metadata?.players['0']).toMatchObject({
            name: 'Mongo Bob',
            credentials: 'mongo-auth',
            isConnected: false,
        });

        const cachedTarget = (hybrid as unknown as { matchStorage: Map<string, 'mongo' | 'memory'> }).matchStorage.get('guest-auth-fallback');
        expect(cachedTarget).toBe('mongo');
    });

    it('cached memory target miss 后，setMetadata 也应改写到 mongo 而不是继续写回已清空的 memory', async () => {
        const mongoStub = buildMongoStub();
        const mongoMetadata = {
            ...buildMetadata(buildSetupData({ ownerKey: 'guest:write-owner', guestId: 'write-owner', ownerType: 'guest' })),
            players: {
                0: { name: 'Mongo Carol', credentials: 'mongo-write', isConnected: false },
                1: {},
            },
        } satisfies MatchMetadata;
        mongoStub.fetch.mockImplementation(async (matchID: string, opts: { metadata?: boolean; state?: boolean }) => {
            if (matchID !== 'guest-write-fallback' || !opts.metadata) {
                return {};
            }
            return { metadata: mongoMetadata };
        });

        const hybrid = new HybridStorage(mongoStub as unknown as typeof mongoStorage, {
            persistentEnabled: true,
            persistGuestRooms: false,
        });

        await hybrid.createMatch('guest-write-fallback', {
            initialState: buildState(buildSetupData({ ownerKey: 'guest:write-owner', guestId: 'write-owner', ownerType: 'guest' })),
            metadata: {
                ...buildMetadata(buildSetupData({ ownerKey: 'guest:write-owner', guestId: 'write-owner', ownerType: 'guest' })),
                players: {
                    0: {},
                    1: {},
                },
                disconnectedSince: Date.now() - 10 * 60 * 1000,
            },
        });

        const cleaned = await hybrid.cleanupEphemeralMatches(0);
        expect(cleaned).toBe(1);

        const nextMetadata = {
            ...mongoMetadata,
            players: {
                0: { name: 'Mongo Carol Updated', credentials: 'mongo-write-2', isConnected: true },
                1: {},
            },
            updatedAt: Date.now(),
        } satisfies MatchMetadata;

        await hybrid.setMetadata('guest-write-fallback', nextMetadata);

        expect(mongoStub.setMetadata).toHaveBeenCalledWith('guest-write-fallback', nextMetadata);
        const cachedTarget = (hybrid as unknown as { matchStorage: Map<string, 'mongo' | 'memory'> }).matchStorage.get('guest-write-fallback');
        expect(cachedTarget).toBe('mongo');
    });
});
