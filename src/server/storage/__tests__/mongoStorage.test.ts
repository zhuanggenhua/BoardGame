import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { State, Server } from 'boardgame.io';
import type { StorageAPI } from 'boardgame.io/dist/types/src/server/db';
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

const buildCreateOpts = (
    ownerKey?: string,
    gameover?: Server.MatchData['gameover']
): StorageAPI.CreateMatchOpts => {
    const setupData = ownerKey ? { ownerKey } : {};
    return {
        initialState: buildState(setupData),
        metadata: buildMetadata(ownerKey ? { ownerKey } : undefined, gameover),
    };
};

describe('MongoStorage 全局单房间限制', () => {
    let mongo: MongoMemoryServer;

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri(), { dbName: 'boardgame-test' });
        await mongoStorage.connect();
    });

    beforeEach(async () => {
        await mongoose.connection.db.dropDatabase();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongo.stop();
    });

    it('同一 ownerKey 只能创建一个未结束房间 - activeMatchExists', async () => {
        await mongoStorage.createMatch('match-1', buildCreateOpts('user:1'));
        await expect(mongoStorage.createMatch('match-2', buildCreateOpts('user:1')))
            .rejects.toThrow('ACTIVE_MATCH_EXISTS');
    });

    it('不同 ownerKey 允许创建多个房间', async () => {
        await mongoStorage.createMatch('match-1', buildCreateOpts('user:1'));
        await expect(mongoStorage.createMatch('match-2', buildCreateOpts('user:2')))
            .resolves.toBeUndefined();
    });

    it('已结束房间不阻止新建房间', async () => {
        await mongoStorage.createMatch(
            'match-1',
            buildCreateOpts('user:1', { winner: '0' })
        );
        await expect(mongoStorage.createMatch('match-2', buildCreateOpts('user:1')))
            .resolves.toBeUndefined();
    });
});
