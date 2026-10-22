import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { UgcModule } from '../src/modules/ugc/ugc.module';
import { GameSubmission, type GameSubmissionDocument } from '../src/modules/ugc/schemas/game-submission.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

// Real local HTTP, filesystem and Mongo contract; never publish or call external storage.
describe('外部游戏投稿 HTTP 与本地持久化', () => {
    let app: INestApplication;
    let mongo: MongoMemoryServer;
    let storageRoot: string;
    let auth: AuthService;
    let users: Model<UserDocument>;
    let submissions: Model<GameSubmissionDocument>;
    let cover: Buffer;
    const originalStorageEnv = Object.fromEntries(
        ['UGC_STORAGE_MODE', 'UGC_LOCAL_PATH', 'UGC_PUBLIC_URL_BASE'].map(key => [key, process.env[key]]),
    );
    const draft = { name: '本地测试桌游', url: 'https://example.com/game', category: 'card',
        minPlayers: 2, maxPlayers: 4, durationMinutes: 20, author: '本地测试作者', description: '仅用于隔离测试', rules: '测试规则' };
    const register = async (name: string) => {
        const email = `${name}@example.com`, code = '135790';
        await auth.storeEmailCode(email, code);
        const response = await request(app.getHttpServer()).post('/auth/register')
            .send({ username: name, email, code, password: 'pass1234' }).expect(201);
        return { token: response.body.token as string, id: response.body.user.id as string };
    };
    const api = () => request(app.getHttpServer());

    beforeAll(async () => {
        storageRoot = await mkdtemp(join(tmpdir(), 'boardgame-submission-test-'));
        process.env.UGC_STORAGE_MODE = 'local';
        process.env.UGC_LOCAL_PATH = storageRoot;
        process.env.UGC_PUBLIC_URL_BASE = '/assets';
        mongo = await MongoMemoryServer.create({ instance: { args: process.platform === 'win32' ? [] : ['--nounixsocket'] } });
        const module = await Test.createTestingModule({ imports: [CacheModule.register({ isGlobal: true }),
            MongooseModule.forRoot(mongo.getUri()), AuthModule, UgcModule] }).compile();
        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        app.useGlobalFilters(new GlobalHttpExceptionFilter());
        await app.init();
        auth = module.get(AuthService);
        users = module.get(getModelToken(User.name));
        submissions = module.get(getModelToken(GameSubmission.name));
        cover = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#346789' } }).png().toBuffer();
    });
    beforeEach(async () => { await Promise.all([users.deleteMany({}), submissions.deleteMany({})]); });
    afterAll(async () => {
        try { if (app) await app.close(); }
        finally {
            try { if (mongo) await mongo.stop(); }
            finally {
                try { if (storageRoot) await rm(storageRoot, { recursive: true, force: true }); }
                finally {
                    for (const [key, value] of Object.entries(originalStorageEnv)) {
                        if (value === undefined) delete process.env[key]; else process.env[key] = value;
                    }
                }
            }
        }
    });

    it('未登录不能列出或创建投稿', async () => {
        await api().get('/ugc/submissions').expect(401);
        await api().post('/ugc/submissions').send(draft).expect(401);
        expect(await submissions.countDocuments()).toBe(0);
    });

    it('草稿、真实封面、送审及读回闭环保持账户隔离', async () => {
        const alice = await register('submission-alice'), bob = await register('submission-bob');
        const created = await api().post('/ugc/submissions').auth(alice.token, { type: 'bearer' }).send(draft).expect(201);
        const id = created.body.submissionId as string, endpoint = `/ugc/submissions/${id}`;
        expect(created.body).toMatchObject({ status: 'draft', ownerId: alice.id, coverUrl: '' });
        const updatedDraft = { ...draft, name: '已编辑的测试桌游', description: '修改后必须真实保存' };
        const updated = await api().put(endpoint).auth(alice.token, { type: 'bearer' }).send(updatedDraft);
        expect(updated.status, JSON.stringify(updated.body)).toBe(200);
        expect(updated.body).toMatchObject({ name: updatedDraft.name, description: updatedDraft.description });
        await api().post(`${endpoint}/submit`).auth(alice.token, { type: 'bearer' }).expect(400);
        const uploaded = await api().post(`${endpoint}/cover`).auth(alice.token, { type: 'bearer' })
            .attach('file', cover, { filename: 'cover.png', contentType: 'image/png' }).expect(201);
        const file = join(storageRoot, 'ugc', alice.id, `submission-${id}`, 'cover.webp');
        const bytes = await readFile(file);
        expect((await sharp(bytes).metadata()).format).toBe('webp');
        expect(uploaded.body.coverUrl).toMatch(new RegExp(`/submission-${id}/cover\\.webp\\?v=[a-f0-9]{16}$`));
        await api().post(`${endpoint}/submit`).auth(alice.token, { type: 'bearer' }).expect(201);
        const list = await api().get('/ugc/submissions').auth(alice.token, { type: 'bearer' }).expect(200);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0]).toMatchObject({ submissionId: id, name: updatedDraft.name, description: updatedDraft.description, status: 'pending', coverUrl: uploaded.body.coverUrl });
        expect((await api().get('/ugc/submissions').auth(bob.token, { type: 'bearer' }).expect(200)).body.items).toEqual([]);
        await api().put(endpoint).auth(bob.token, { type: 'bearer' }).send({ ...draft, name: '越权修改' }).expect(404);
        const differentCover = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#ff3344' } }).png().toBuffer();
        await api().post(`${endpoint}/cover`).auth(bob.token, { type: 'bearer' })
            .attach('file', differentCover, { filename: 'other.png', contentType: 'image/png' }).expect(404);
        await api().post(`${endpoint}/submit`).auth(bob.token, { type: 'bearer' }).expect(404);
        expect((await submissions.findOne({ submissionId: id }).lean())).toMatchObject({
            ownerId: alice.id, name: updatedDraft.name, description: updatedDraft.description, status: 'pending', coverUrl: uploaded.body.coverUrl,
        });
        expect(await readFile(file)).toEqual(bytes);
    });

    it('非法字段和失败上传不污染已保存投稿', async () => {
        const owner = await register('submission-invalid');
        for (const invalid of [{ ...draft, url: 'javascript:alert(1)' }, { ...draft, minPlayers: 5, maxPlayers: 2 }]) {
            await api().post('/ugc/submissions').auth(owner.token, { type: 'bearer' }).send(invalid).expect(400);
        }
        expect(await submissions.countDocuments()).toBe(0);
        const created = await api().post('/ugc/submissions').auth(owner.token, { type: 'bearer' }).send(draft).expect(201);
        const id = created.body.submissionId as string, endpoint = `/ugc/submissions/${id}/cover`;
        await api().put(`/ugc/submissions/${id}`).auth(owner.token, { type: 'bearer' })
            .send({ ...draft, url: 'javascript:alert(1)' }).expect(400);
        expect((await submissions.findOne({ submissionId: id }).lean())?.url).toBe(draft.url);
        await api().post(endpoint).auth(owner.token, { type: 'bearer' })
            .attach('file', cover, { filename: 'valid.png', contentType: 'image/png' }).expect(201);
        const before = await submissions.findOne({ submissionId: id }).lean();
        const path = join(storageRoot, 'ugc', owner.id, `submission-${id}`, 'cover.webp');
        const bytes = await readFile(path);
        await api().post(endpoint).auth(owner.token, { type: 'bearer' }).expect(400);
        await api().post(endpoint).auth(owner.token, { type: 'bearer' })
            .attach('file', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
        await api().post(endpoint).auth(owner.token, { type: 'bearer' })
            .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' }).expect(413);
        const after = await submissions.findOne({ submissionId: id }).lean();
        expect(after?.coverUrl).toBe(before?.coverUrl);
        expect(after?.status).toBe('draft');
        expect(await readFile(path)).toEqual(bytes);
    });
});
