import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { State, Server, StorageAPI } from 'boardgame.io';
import { mongoStorage } from '../MongoStorage';

const buildState = (setupData: Record<string, unknown>): State => ({
    G: { __setupData: setupData },
    ctx: {
        numPlayers: 2,
        playOrder: ['0', '1'],
        playOrderPos: 0,
        activePlayers: null,
        currentPlayer: '0',
        turn: 0,
        phase: 'default',
        gameover: null,
    },
    plugins: {},
    _undo: [],
    _redo: [],
    _stateID: 0,
});

const buildMetadata = (
    setupData: Record<string, unknown> | undefined,
    gameover?: Server.MatchData['gameover']
): Server.MatchData => ({
    gameName: 'tictactoe',
    players: {
        0: { id: 0, name: 'P0' },
        1: { id: 1, name: 'P1' },
    },
    setupData,
    gameover,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

const buildSetupData = (ownerKey?: string, ttlSeconds?: number): Record<string, unknown> => {
    const setupData: Record<string, unknown> = {};
    if (ownerKey) setupData.ownerKey = ownerKey;
    if (typeof ttlSeconds === 'number') setupData.ttlSeconds = ttlSeconds;
    return setupData;
};

const buildCreateOpts = (
    ownerKey?: string,
    gameover?: Server.MatchData['gameover'],
    ttlSeconds?: number
): StorageAPI.CreateMatchOpts => {
    const setupData = buildSetupData(ownerKey, ttlSeconds);
    return {
        initialState: buildState(setupData),
        metadata: buildMetadata(Object.keys(setupData).length > 0 ? setupData : undefined, gameover),
    };
};

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

    it('同一 ownerKey 创建新房间会清理旧房间', async () => {
        await mongoStorage.createMatch('match-1', buildCreateOpts('user:1'));
        await expect(mongoStorage.createMatch('match-2', buildCreateOpts('user:1')))
            .resolves.toBeUndefined();

        const Match = mongoose.model('Match');
        const remaining = await Match.find({ 'metadata.setupData.ownerKey': 'user:1' }).lean();
        const remainingIds = remaining.map((doc: any) => doc.matchID);
        expect(remainingIds).toEqual(['match-2']);
    });

    it('不同 ownerKey 允许创建多个房间', async () => {
        await mongoStorage.createMatch('match-1', buildCreateOpts('user:1'));
        await expect(mongoStorage.createMatch('match-2', buildCreateOpts('user:2')))
            .resolves.toBeUndefined();
    });

    it('空房间不阻止新建房间', async () => {
        const Match = mongoose.model('Match');
        await Match.create({
            matchID: 'match-1',
            gameName: 'tictactoe',
            state: null,
            initialState: null,
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
        await expect(mongoStorage.createMatch('match-2', buildCreateOpts('user:1')))
            .resolves.toBeUndefined();
    });

    it('cleanupDuplicateOwnerMatches 仅保留最新房间', async () => {
        const Match = mongoose.model('Match');
        await Match.create({
            matchID: 'dup-old',
            gameName: 'tictactoe',
            state: null,
            initialState: null,
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
            initialState: null,
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

        const remaining = await Match.find({ 'metadata.setupData.ownerKey': 'user:dup' }).lean();
        const remainingIds = remaining.map((doc: any) => doc.matchID);
        expect(remainingIds).toEqual(['dup-new']);
    });

    it('cleanupEphemeralMatches 删除无在线玩家的临时房间', async () => {
        const Match = mongoose.model('Match');
        await Match.create({
            matchID: 'ephemeral-empty',
            gameName: 'tictactoe',
            state: null,
            initialState: null,
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { id: 0, isConnected: false },
                    1: { id: 1, isConnected: false },
                },
                setupData: { ownerKey: 'user:ephemeral' },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            ttlSeconds: 0,
        });
        await Match.create({
            matchID: 'ephemeral-active',
            gameName: 'tictactoe',
            state: null,
            initialState: null,
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

        const remaining = await Match.find({ matchID: { $in: ['ephemeral-empty', 'ephemeral-active'] } }).lean();
        const remainingIds = remaining.map((doc: any) => doc.matchID);
        expect(remainingIds).toContain('ephemeral-active');
        expect(remainingIds).not.toContain('ephemeral-empty');
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
            initialState: null,
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
            initialState: null,
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

        const remaining = await Match.find({ matchID: { $in: ['legacy-empty', 'legacy-occupied'] } }).lean();
        const remainingIds = remaining.map((doc: any) => doc.matchID);
        expect(remainingIds).toContain('legacy-occupied');
        expect(remainingIds).not.toContain('legacy-empty');
    });

    it('createMatch 设置 1 天游留存时写入 TTL 与 expiresAt', async () => {
        const start = Date.now();
        await mongoStorage.createMatch('ttl-1day', buildCreateOpts('user:ttl', undefined, 86400));
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

    it('cleanupOldMatches 清理超过 24 小时的房间', async () => {
        const Match = mongoose.model('Match');
        const now = Date.now();

        await Match.create({
            matchID: 'old-1day',
            gameName: 'tictactoe',
            state: null,
            initialState: null,
            metadata: buildMetadata({ ownerKey: 'user:old' }),
            ttlSeconds: 86400,
        });
        await Match.create({
            matchID: 'fresh-1day',
            gameName: 'tictactoe',
            state: null,
            initialState: null,
            metadata: buildMetadata({ ownerKey: 'user:fresh' }),
            ttlSeconds: 86400,
        });

        await Match.updateOne({ matchID: 'old-1day' }, { updatedAt: new Date(now - 25 * 60 * 60 * 1000) });
        await Match.updateOne({ matchID: 'fresh-1day' }, { updatedAt: new Date(now - 2 * 60 * 60 * 1000) });

        const cleaned = await mongoStorage.cleanupOldMatches(24);
        expect(cleaned).toBe(1);

        const remaining = await Match.find({ matchID: { $in: ['old-1day', 'fresh-1day'] } }).lean();
        const remainingIds = remaining.map((doc: any) => doc.matchID);
        expect(remainingIds).toContain('fresh-1day');
        expect(remainingIds).not.toContain('old-1day');
    });
});
