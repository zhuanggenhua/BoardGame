import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { MatchMetadata, StoredMatchState, CreateMatchData } from '../../../engine/transport/storage';
import { mongoStorage } from '../MongoStorage';

const buildState = (setupData: Record<string, unknown>): StoredMatchState => ({
    G: { __setupData: setupData },
    _stateID: 0,
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

describe('MongoStorage 行为', () => {
    let mongo: MongoMemoryServer;

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri(), { dbName: 'boardgame-test' });
        await mongoStorage.connect();
    });

    beforeEach(async () => {
        await mongoose.connection.db!.dropDatabase();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongo.stop();
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
