import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildUgcServerGames } from '../ugcRegistration';
import { getUgcPackageModel } from '../models/UgcPackage';

const ORIGINAL_ENV = { ...process.env };

const restoreEnvValue = (key: string) => {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
};

const buildDomainCode = () => `
  const domain = {
    gameId: 'ugc-test',
    setup() { return {}; },
    validate() { return { valid: true }; },
    execute() { return []; },
    reduce(state) { return state; }
  };
`;

describe('UGC 动态注册集成', () => {
    let mongo: MongoMemoryServer | null = null;
    const uploadDir = join(process.cwd(), 'uploads-test-ugc');

    beforeAll(async () => {
        process.env.MONGO_URI = '';
        process.env.UGC_LOCAL_PATH = uploadDir;
        process.env.UGC_PUBLIC_URL_BASE = '/assets';
        mongo = await MongoMemoryServer.create();
        const uri = mongo.getUri();
        await mongoose.connect(uri);
        mkdirSync(join(uploadDir, 'ugc', 'user-1', 'pkg-1'), { recursive: true });
        writeFileSync(join(uploadDir, 'ugc', 'user-1', 'pkg-1', 'domain.js'), buildDomainCode(), 'utf-8');
    });

    beforeEach(async () => {
        const Model = getUgcPackageModel();
        await Model.deleteMany({});
        await Model.create({
            packageId: 'pkg-1',
            ownerId: 'user-1',
            name: '测试包',
            status: 'published',
            publishedAt: new Date(),
            manifest: {
                files: ['domain.js'],
                metadata: { playerOptions: [2, 4] },
            },
        });
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongo) await mongo.stop();
        rmSync(uploadDir, { recursive: true, force: true });
        restoreEnvValue('MONGO_URI');
        restoreEnvValue('UGC_LOCAL_PATH');
        restoreEnvValue('UGC_PUBLIC_URL_BASE');
    });

    it('应从数据库与本地文件构建动态游戏列表', async () => {
        const { games, gameIds } = await buildUgcServerGames();
        expect(gameIds).toEqual(['pkg-1']);
        expect(games.length).toBe(1);
        expect(games[0]?.minPlayers).toBe(2);
        expect(games[0]?.maxPlayers).toBe(4);
    });

    it('应跳过重复 gameId 的包', async () => {
        const { gameIds } = await buildUgcServerGames({ existingGameIds: new Set(['pkg-1']) });
        expect(gameIds.length).toBe(0);
    });
});
