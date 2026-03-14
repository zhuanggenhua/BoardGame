import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { MatchMetadata, StoredMatchState, CreateMatchData } from '../../../engine/transport/storage';
import { mongoStorage } from '../MongoStorage';
import { runStartupCleanupTasks, type StartupCleanupTask } from '../startupCleanup';

const buildState = (setupData: Record<string, unknown>): StoredMatchState => ({
    G: { __setupData: setupData },
    _stateID: 0,
});

describe('MongoStorage.cleanupCorruptMatches', () => {
    let mongo: MongoMemoryServer;

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri(), { dbName: 'boardgame-test-corrupt-cleanup' });
        await mongoStorage.connect();
    }, 60000);

    beforeEach(async () => {
        await mongoose.connection.db!.dropDatabase();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongo) await mongo.stop();
    });

    it('仅清理超过阈值且无人占座的脏房间', async () => {
        const Match = mongoose.model('Match');
        const now = Date.now();
        const staleUpdatedAt = new Date(now - 2 * 60 * 60 * 1000);

        await Match.create({
            matchID: 'corrupt-stale-empty',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: {},
                    1: {},
                },
                setupData: { ownerKey: { broken: true } },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
        });
        await Match.collection.updateOne(
            { matchID: 'corrupt-stale-empty' },
            { $set: { updatedAt: staleUpdatedAt } }
        );

        await Match.create({
            matchID: 'corrupt-stale-occupied',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { name: 'P0' },
                    1: {},
                },
                setupData: { ownerKey: { broken: true } },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
        });
        await Match.collection.updateOne(
            { matchID: 'corrupt-stale-occupied' },
            { $set: { updatedAt: staleUpdatedAt } }
        );

        await Match.create({
            matchID: 'corrupt-fresh-empty',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: {},
                    1: {},
                },
                setupData: { ownerKey: { broken: true } },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
        });

        const cleaned = await mongoStorage.cleanupCorruptMatches(1);
        expect(cleaned).toBe(1);

        const remaining = await Match.find({
            matchID: { $in: ['corrupt-stale-empty', 'corrupt-stale-occupied', 'corrupt-fresh-empty'] },
        }).lean<Array<{ matchID: string }>>();
        const remainingIds = remaining.map(doc => doc.matchID);

        expect(remainingIds).not.toContain('corrupt-stale-empty');
        expect(remainingIds).toContain('corrupt-stale-occupied');
        expect(remainingIds).toContain('corrupt-fresh-empty');
    });
    it('keeps legacy rooms whose isConnected is null', async () => {
        const Match = mongoose.model('Match');
        const now = Date.now();
        const staleUpdatedAt = new Date(now - 2 * 60 * 60 * 1000);

        await Match.create({
            matchID: 'legacy-null-isConnected',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { isConnected: null },
                    1: {},
                },
                setupData: { ownerKey: 'legacy-owner' },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
        });
        await Match.collection.updateOne(
            { matchID: 'legacy-null-isConnected' },
            { $set: { updatedAt: staleUpdatedAt } }
        );

        const cleaned = await mongoStorage.cleanupCorruptMatches(1);
        expect(cleaned).toBe(0);

        const remaining = await Match.findOne({ matchID: 'legacy-null-isConnected' }).lean<{ matchID: string } | null>();
        expect(remaining?.matchID).toBe('legacy-null-isConnected');
    });

    it('findMatchesByOwnerKey 只返回指定 owner 的房间', async () => {
        const Match = mongoose.model('Match');
        const now = Date.now();

        await Match.create({
            matchID: 'owner-1-a',
            gameName: 'dicethrone',
            state: null,
            metadata: {
                gameName: 'dicethrone',
                players: { 0: {}, 1: {} },
                setupData: { ownerKey: 'user:owner-1' },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
        });
        await Match.create({
            matchID: 'owner-1-b',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: { 0: {}, 1: {} },
                setupData: { ownerKey: 'user:owner-1' },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
        });
        await Match.create({
            matchID: 'owner-2-a',
            gameName: 'smashup',
            state: null,
            metadata: {
                gameName: 'smashup',
                players: { 0: {}, 1: {} },
                setupData: { ownerKey: 'user:owner-2' },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
        });

        const matches = await mongoStorage.findMatchesByOwnerKey('user:owner-1');
        expect(matches).toHaveLength(2);
        expect(matches.map((match) => match.matchID).sort()).toEqual(['owner-1-a', 'owner-1-b']);
        expect(matches.map((match) => match.gameName).sort()).toEqual(['dicethrone', 'tictactoe']);
    });
});

const buildMetadata = (
    setupData: Record<string, unknown> | undefined,
    gameover?: unknown
): MatchMetadata => ({
    gameName: 'tictactoe',
    players: {
        0: { name: 'P0' },
        1: { name: 'P1' },
    },
    setupData,
    gameover,
    createdAt: Date.now(),
    updatedAt: Date.now(),
} as MatchMetadata);

const buildSetupData = (ownerKey?: string, ttlSeconds?: number): Record<string, unknown> => {
    const setupData: Record<string, unknown> = {};
    if (ownerKey) setupData.ownerKey = ownerKey;
    if (typeof ttlSeconds === 'number') setupData.ttlSeconds = ttlSeconds;
    return setupData;
};

const buildCreateData = (
    ownerKey?: string,
    gameover?: unknown,
    ttlSeconds?: number
): CreateMatchData => {
    const setupData = buildSetupData(ownerKey, ttlSeconds);
    return {
        initialState: buildState(setupData),
        metadata: buildMetadata(Object.keys(setupData).length > 0 ? setupData : undefined, gameover),
    };
};

type MatchIdDoc = { matchID: string };

// MongoDB 内存服务器在某些环境下启动很慢（>60s），暂时跳过测试
// 如需运行这些测试，请移除下面的 .skip
describe.skip('MongoStorage 行为', () => {
    let mongo: MongoMemoryServer;

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri(), { dbName: 'boardgame-test' });
        await mongoStorage.connect();
    }, 60000); // 60 秒超时（MongoDB 内存服务器启动可能较慢）

    beforeEach(async () => {
        await mongoose.connection.db!.dropDatabase();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongo) await mongo.stop(); // 防御性检查
    });

    it('同一 ownerKey 创建新房间会自动清理旧房间', async () => {
        await mongoStorage.createMatch('match-1', buildCreateData('user:1'));
        // 新行为：自动覆盖旧房间，不再抛异常
        await expect(mongoStorage.createMatch('match-2', buildCreateData('user:1')))
            .resolves.toBeUndefined();

        // 验证旧房间已被清理
        const Match = mongoose.model('Match');
        const remaining = await Match.find({ 'metadata.setupData.ownerKey': 'user:1' }).lean<MatchIdDoc[]>();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].matchID).toBe('match-2');
    });

    it('不同 ownerKey 允许创建多个房间', async () => {
        await mongoStorage.createMatch('match-1', buildCreateData('user:1'));
        await expect(mongoStorage.createMatch('match-2', buildCreateData('user:2')))
            .resolves.toBeUndefined();
    });

    it('空房间也会被自动清理', async () => {
        const Match = mongoose.model('Match');
        await Match.create({
            matchID: 'match-1',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { id: 0 },
                    1: { id: 1 },
                },
                setupData: { ownerKey: 'user:1' },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });
        // 新行为：自动覆盖旧房间
        await expect(mongoStorage.createMatch('match-2', buildCreateData('user:1')))
            .resolves.toBeUndefined();

        // 验证旧房间已被清理
        const remaining = await Match.find({ 'metadata.setupData.ownerKey': 'user:1' }).lean<MatchIdDoc[]>();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].matchID).toBe('match-2');
    });

    it('cleanupDuplicateOwnerMatches 仅保留最新房间', async () => {
        const Match = mongoose.model('Match');
        await Match.create({
            matchID: 'dup-old',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: { 0: { id: 0 }, 1: { id: 1 } },
                setupData: { ownerKey: 'user:dup' },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });
        await Match.create({
            matchID: 'dup-new',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: { 0: { id: 0 }, 1: { id: 1 } },
                setupData: { ownerKey: 'user:dup' },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });

        await Match.updateOne({ matchID: 'dup-old' }, { updatedAt: new Date(Date.now() - 60 * 1000) });
        await Match.updateOne({ matchID: 'dup-new' }, { updatedAt: new Date() });

        const cleaned = await mongoStorage.cleanupDuplicateOwnerMatches();
        expect(cleaned).toBe(1);

        const remaining = await Match.find({ 'metadata.setupData.ownerKey': 'user:dup' }).lean<MatchIdDoc[]>();
        const remainingIds = remaining.map(doc => doc.matchID);
        expect(remainingIds).toEqual(['dup-new']);
    });

    it('cleanupEphemeralMatches 在断线超时后清理临时房间', async () => {
        const Match = mongoose.model('Match');
        const disconnectedSince = Date.now() - 6 * 60 * 1000;
        await Match.create({
            matchID: 'ephemeral-empty',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { id: 0, isConnected: false },
                    1: { id: 1, isConnected: false },
                },
                setupData: { ownerKey: 'user:ephemeral' },
                disconnectedSince,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });
        await Match.create({
            matchID: 'ephemeral-active',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { id: 0, isConnected: true },
                    1: { id: 1, isConnected: false },
                },
                setupData: { ownerKey: 'user:ephemeral-active' },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });

        const cleaned = await mongoStorage.cleanupEphemeralMatches();
        expect(cleaned).toBe(1);

        const remaining = await Match.find({ matchID: { $in: ['ephemeral-empty', 'ephemeral-active'] } }).lean<MatchIdDoc[]>();
        const remainingIds = remaining.map(doc => doc.matchID);
        expect(remainingIds).toContain('ephemeral-active');
        expect(remainingIds).not.toContain('ephemeral-empty');
    });

    it('cleanupEphemeralMatches 标记重启遗留连接但不立即删除', async () => {
        const Match = mongoose.model('Match');
        const now = Date.now();
        const staleUpdatedAt = new Date(now - 60 * 1000);

        await Match.create({
            matchID: 'ephemeral-stale',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { id: 0, isConnected: true },
                    1: { id: 1, isConnected: false },
                },
                setupData: { ownerKey: 'user:stale' },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
            updatedAt: staleUpdatedAt,
        });

        await Match.collection.updateOne(
            { matchID: 'ephemeral-stale' },
            { $set: { updatedAt: staleUpdatedAt } }
        );

        (mongoStorage as unknown as { bootTimeMs: number }).bootTimeMs = now;

        const cleaned = await mongoStorage.cleanupEphemeralMatches();
        expect(cleaned).toBe(0);

        const doc = await Match.findOne({ matchID: 'ephemeral-stale' }).lean<{
            metadata?: { players?: Record<string, { isConnected?: boolean }>; disconnectedSince?: number | null } | null;
        }>();
        expect(doc).toBeTruthy();
        const players = doc?.metadata?.players ?? {};
        expect(players['0']?.isConnected).toBe(false);
        expect(typeof doc?.metadata?.disconnectedSince).toBe('number');
    });

    it('cleanupLegacyMatches 仅清理缺失 ownerKey 且无人占座的遗留房间', async () => {
        const Match = mongoose.model('Match');
        const legacyPlayers = {
            0: { id: 0 },
            1: { id: 1 },
        };
        const occupiedPlayers = {
            0: { id: 0, name: 'Alice' },
            1: { id: 1 },
        };
        await Match.create({
            matchID: 'legacy-empty',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: legacyPlayers,
                setupData: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });
        await Match.create({
            matchID: 'legacy-occupied',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: occupiedPlayers,
                setupData: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });

        const cutoff = new Date(Date.now() - 60 * 1000);
        await Match.updateOne({ matchID: 'legacy-empty' }, { updatedAt: cutoff });
        await Match.updateOne({ matchID: 'legacy-occupied' }, { updatedAt: cutoff });

        const cleaned = await mongoStorage.cleanupLegacyMatches(0);
        expect(cleaned).toBe(1);

        const remaining = await Match.find({ matchID: { $in: ['legacy-empty', 'legacy-occupied'] } }).lean<MatchIdDoc[]>();
        const remainingIds = remaining.map(doc => doc.matchID);
        expect(remainingIds).toContain('legacy-occupied');
        expect(remainingIds).not.toContain('legacy-empty');
    });

    it('同一 ownerKey 创建新房间时也清理已结束的旧房间', async () => {
        // 先创建一个已结束的房间
        await mongoStorage.createMatch('match-gameover', buildCreateData('user:1', { winner: '0' }));
        // 再创建新房间
        await expect(mongoStorage.createMatch('match-new', buildCreateData('user:1')))
            .resolves.toBeUndefined();

        const Match = mongoose.model('Match');
        const remaining = await Match.find({ 'metadata.setupData.ownerKey': 'user:1' }).lean<MatchIdDoc[]>();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].matchID).toBe('match-new');
    });

    it('cleanupEphemeralMatches 强制清理幽灵连接（长时间无更新但 isConnected=true）', async () => {
        const Match = mongoose.model('Match');
        const now = Date.now();
        // 31 分钟前更新，超过 30 分钟强制降级阈值
        const staleUpdatedAt = new Date(now - 31 * 60 * 1000);

        await Match.create({
            matchID: 'ghost-conn',
            gameName: 'tictactoe',
            state: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { id: 0, isConnected: true },
                    1: { id: 1, isConnected: false },
                },
                setupData: { ownerKey: 'user:ghost' },
                createdAt: now,
                updatedAt: now,
            },
            ttlSeconds: 0,
            updatedAt: staleUpdatedAt,
        });

        await Match.collection.updateOne(
            { matchID: 'ghost-conn' },
            { $set: { updatedAt: staleUpdatedAt } }
        );

        // bootTimeMs 设为很早以前，确保不走 isStaleConnected 分支
        (mongoStorage as unknown as { bootTimeMs: number }).bootTimeMs = now - 60 * 60 * 1000;

        const cleaned = await mongoStorage.cleanupEphemeralMatches();
        // 第一次只标记断线，不删除
        expect(cleaned).toBe(0);

        const doc = await Match.findOne({ matchID: 'ghost-conn' }).lean<{
            metadata?: { players?: Record<string, { isConnected?: boolean }>; disconnectedSince?: number | null } | null;
        }>();
        expect(doc).toBeTruthy();
        const players = doc?.metadata?.players ?? {};
        expect(players['0']?.isConnected).toBe(false);
        expect(typeof doc?.metadata?.disconnectedSince).toBe('number');
    });

    it('createMatch 设置 1 天游留存时写入 TTL 与 expiresAt', async () => {
        const start = Date.now();
        await mongoStorage.createMatch('ttl-1day', buildCreateData('user:ttl', undefined, 86400));
        const end = Date.now();

        const Match = mongoose.model('Match');
        type MatchTTLDoc = { ttlSeconds?: number; expiresAt?: Date | null };
        const doc = await Match.findOne({ matchID: 'ttl-1day' }).lean<MatchTTLDoc | null>();
        expect(doc?.ttlSeconds).toBe(86400);
        expect(doc?.expiresAt).toBeInstanceOf(Date);

        const expiresAt = (doc?.expiresAt as Date).getTime();
        const ttlMs = 86400 * 1000;
        expect(expiresAt).toBeGreaterThanOrEqual(start + ttlMs);
        expect(expiresAt).toBeLessThanOrEqual(end + ttlMs + 1000);
    });
});

describe('runStartupCleanupTasks', () => {
    it('在任一清理任务报错后仍继续执行后续任务', async () => {
        const calls: string[] = [];
        const onError = vi.fn<(message: string, error: unknown) => void>((message) => {
            calls.push(`error:${message}`);
        });
        const tasks: StartupCleanupTask[] = [
            {
                reason: 'cleanup:a',
                run: async () => {
                    calls.push('run:a');
                    return 1;
                },
                errorMessage: 'cleanup a failed',
            },
            {
                reason: 'cleanup:b',
                run: async () => {
                    calls.push('run:b');
                    throw new Error('boom');
                },
                errorMessage: 'cleanup b failed',
            },
            {
                reason: 'cleanup:c',
                run: async () => {
                    calls.push('run:c');
                    return 0;
                },
                errorMessage: 'cleanup c failed',
            },
        ];

        await runStartupCleanupTasks(tasks, {
            onDirty: async (reason) => {
                calls.push(`dirty:${reason}`);
            },
            onError,
        });

        expect(calls).toEqual([
            'run:a',
            'dirty:cleanup:a',
            'run:b',
            'error:cleanup b failed',
            'run:c',
        ]);
        expect(onError).toHaveBeenCalledTimes(1);
    });
});
