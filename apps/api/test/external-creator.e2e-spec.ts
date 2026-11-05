import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { UgcModule } from '../src/modules/ugc/ugc.module';
import { ExternalPlayRecord, type ExternalPlayDocument } from '../src/modules/ugc/schemas/external-play.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('外链收录、作者认领与停留时间 HTTP 合同', () => {
    let app: INestApplication;
    let mongo: MongoMemoryServer;
    let storageRoot = '';
    let auth: AuthService;
    let users: Model<UserDocument>;
    let sessions: Model<ExternalPlayDocument>;
    let picture: Buffer;
    const originalEnv = Object.fromEntries(['UGC_STORAGE_MODE', 'UGC_LOCAL_PATH', 'UGC_PUBLIC_URL_BASE'].map(key => [key, process.env[key]]));
    const api = () => request(app.getHttpServer());
    const register = async (name: string) => {
        const email = `${name}@example.com`, code = '135790';
        await auth.storeEmailCode(email, code);
        const response = await api().post('/auth/register').send({ username: name, email, code, password: 'pass1234' }).expect(201);
        return { token: response.body.token as string, id: response.body.user.id as string };
    };
    const submitClaim = async (token: string, gameId: string, name: string) => {
        const created = await api().post('/ugc/creator-claims').auth(token, { type: 'bearer' })
            .send({ gameId, profileUrl: `https://example.com/${name}`, explanation: '我是这个游戏的作者和开发者。' }).expect(201);
        expect(created.body.evidenceImage).toBeUndefined();
        const claimId = created.body.claimId as string;
        const uploaded = await api().post(`/ugc/creator-claims/${claimId}/evidence`).auth(token, { type: 'bearer' })
            .attach('file', picture, { filename: 'proof.png', contentType: 'image/png' }).expect(201);
        expect(uploaded.body.evidenceImage).toBeUndefined();
        const pending = await api().post(`/ugc/creator-claims/${claimId}/submit`).auth(token, { type: 'bearer' }).expect(201);
        return pending.body as { claimId: string; evidenceDigest: string };
    };
    const decision = (claim: { evidenceDigest: string }) => ({ decision: 'approved', comment: '已核对主页及作品关系',
        evidenceDigest: claim.evidenceDigest, profileControlVerified: true, gameRelationshipVerified: true });

    beforeAll(async () => {
        storageRoot = await mkdtemp(join(tmpdir(), 'boardgame-creator-e2e-'));
        process.env.UGC_STORAGE_MODE = 'local'; process.env.UGC_LOCAL_PATH = storageRoot; process.env.UGC_PUBLIC_URL_BASE = '/assets';
        mongo = await MongoMemoryServer.create({ instance: { args: process.platform === 'win32' ? [] : ['--nounixsocket'] } });
        const module = await Test.createTestingModule({ imports: [CacheModule.register({ isGlobal: true }),
            MongooseModule.forRoot(mongo.getUri()), AuthModule, UgcModule] }).compile();
        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        app.useGlobalFilters(new GlobalHttpExceptionFilter());
        await app.init();
        auth = module.get(AuthService); users = module.get(getModelToken(User.name));
        sessions = module.get(getModelToken(ExternalPlayRecord.name));
        picture = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#346789' } }).png().toBuffer();
    });
    afterAll(async () => {
        try { if (app) await app.close(); if (mongo) await mongo.stop(); }
        finally {
            const prefix = resolve(join(tmpdir(), 'boardgame-creator-e2e-'));
            if (storageRoot && resolve(storageRoot).startsWith(prefix)) await rm(storageRoot, { recursive: true, force: true });
            for (const [key, value] of Object.entries(originalEnv)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    });

    it('收录、冻结审核材料、认领及权限隔离保持真实服务端合同', async () => {
        const author = await register('creator-author'), submitter = await register('creator-submitter'), admin = await register('creator-admin');
        await users.updateOne({ _id: admin.id }, { $set: { role: 'admin' } });
        const seeded = await api().get('/ugc/external-games').expect(200);
        expect(seeded.body.items).toContainEqual(expect.objectContaining({ gameId: 'external-yuanyi-games', name: '山中小屋', author: '鸢一桑', embedStatus: 'blocked', authorProfileUrl: 'https://space.bilibili.com/31976469', ownerUserId: null }));
        await api().post('/ugc/external-games/external-yuanyi-games/sessions').auth(author.token, { type: 'bearer' }).expect(409);
        await api().get('/ugc/creator-review').expect(401);
        await api().get('/ugc/creator-review').auth(author.token, { type: 'bearer' }).expect(403);

        const data = { name: '认证测试游戏', url: 'https://example.com/game', category: 'card', minPlayers: 2, maxPlayers: 4,
            author: '测试作者', authorProfileUrl: 'https://example.com/author', description: '这是用于审核的游戏介绍', rules: '测试规则' };
        const created = await api().post('/ugc/submissions').auth(submitter.token, { type: 'bearer' }).send(data).expect(201);
        const submissionId = created.body.submissionId as string;
        await api().post(`/ugc/submissions/${submissionId}/cover`).auth(submitter.token, { type: 'bearer' }).attach('file', picture, 'cover.png').expect(201);
        const pending = await api().post(`/ugc/submissions/${submissionId}/submit`).auth(submitter.token, { type: 'bearer' }).expect(201);
        await api().put(`/ugc/submissions/${submissionId}`).auth(submitter.token, { type: 'bearer' }).send({ ...data, name: '审阅中篡改' }).expect(409);
        await api().post(`/ugc/submissions/${submissionId}/cover`).auth(submitter.token, { type: 'bearer' }).attach('file', picture, 'cover.png').expect(409);
        await api().post(`/ugc/creator-review/submissions/${submissionId}`).auth(admin.token, { type: 'bearer' })
            .send({ decision: 'approved', comment: '审核通过', revision: '2000-01-01T00:00:00.000Z' }).expect(409);
        await api().post(`/ugc/creator-review/submissions/${submissionId}`).auth(admin.token, { type: 'bearer' })
            .send({ decision: 'rejected', comment: '请补充作品介绍', revision: pending.body.updatedAt }).expect(201);
        await api().put(`/ugc/submissions/${submissionId}`).auth(submitter.token, { type: 'bearer' }).send(data).expect(200);
        const resubmitted = await api().post(`/ugc/submissions/${submissionId}/submit`).auth(submitter.token, { type: 'bearer' }).expect(201);
        expect(resubmitted.body.reviewRevision).toBeUndefined();
        const approved = await api().post(`/ugc/creator-review/submissions/${submissionId}`).auth(admin.token, { type: 'bearer' })
            .send({ decision: 'approved', comment: '审核通过', revision: resubmitted.body.updatedAt }).expect(201);
        const gameId = approved.body.gameId as string;
        expect((await api().get(`/ugc/external-games/${gameId}`).expect(200)).body).toMatchObject({ name: data.name, ownerUserId: null });

        const claim = await submitClaim(author.token, gameId, 'creator-author');
        await api().post(`/ugc/creator-claims/${claim.claimId}/evidence`).auth(author.token, { type: 'bearer' }).attach('file', picture, 'changed.png').expect(403);
        await api().get(`/ugc/creator-claims/${claim.claimId}/evidence`).auth(submitter.token, { type: 'bearer' }).expect(404);
        const evidence = await api().get(`/ugc/creator-review/claims/${claim.claimId}/evidence`).auth(admin.token, { type: 'bearer' }).expect(200);
        expect(evidence.headers['cache-control']).toContain('no-store');
        await api().post(`/ugc/creator-review/claims/${claim.claimId}`).auth(author.token, { type: 'bearer' }).send(decision(claim)).expect(403);
        await api().post(`/ugc/creator-review/claims/${claim.claimId}`).auth(admin.token, { type: 'bearer' })
            .send({ ...decision(claim), gameRelationshipVerified: false }).expect(400);
        await api().post(`/ugc/creator-review/claims/${claim.claimId}`).auth(admin.token, { type: 'bearer' })
            .send({ ...decision(claim), evidenceDigest: 'stale' }).expect(409);
        await api().post(`/ugc/creator-review/claims/${claim.claimId}`).auth(admin.token, { type: 'bearer' }).send(decision(claim)).expect(201);
        await api().post(`/ugc/creator-review/claims/${claim.claimId}`).auth(admin.token, { type: 'bearer' }).send(decision(claim)).expect(409);
        expect((await api().get('/ugc/external-games/mine').auth(author.token, { type: 'bearer' }).expect(200)).body.items).toContainEqual(expect.objectContaining({ gameId }));
        expect((await api().get('/ugc/external-games/mine').auth(submitter.token, { type: 'bearer' }).expect(200)).body.items).toEqual([]);
        await api().put(`/ugc/submissions/${submissionId}`).auth(submitter.token, { type: 'bearer' }).send(data).expect(403);
        await api().post(`/ugc/submissions/${submissionId}/cover`).auth(submitter.token, { type: 'bearer' }).attach('file', picture, 'cover.png').expect(403);
        await api().put(`/ugc/external-games/${gameId}`).auth(submitter.token, { type: 'bearer' }).send({ ...data, published: true }).expect(403);
        const edited = await api().put(`/ugc/external-games/${gameId}`).auth(author.token, { type: 'bearer' })
            .send({ ...data, name: '作者更新后的游戏', url: 'https://example.com/changed', minPlayers: null, maxPlayers: null, published: true, ownerUserId: submitter.id }).expect(200);
        expect(edited.body).toMatchObject({ name: '作者更新后的游戏', ownerUserId: author.id, embedStatus: 'unknown' });
        expect(edited.body.minPlayers).toBeUndefined();

        await api().put(`/ugc/creator-review/games/${gameId}/embed`).auth(admin.token, { type: 'bearer' })
            .send({ status: 'allowed', reason: '隔离测试站允许嵌入', url: 'https://example.com/changed' }).expect(200);
        const started = await api().post(`/ugc/external-games/${gameId}/sessions`).auth(author.token, { type: 'bearer' }).expect(201);
        const sessionId = started.body.sessionId as string;
        await sessions.updateOne({ sessionId }, { $set: { lastSeenAt: new Date(Date.now() - 10_000) } });
        await api().put(`/ugc/external-games/sessions/${sessionId}`).auth(submitter.token, { type: 'bearer' }).send({ sequence: 1, active: false, elapsedMs: 10_000, offsetMs: 10_000 }).expect(404);
        expect((await api().put(`/ugc/external-games/sessions/${sessionId}`).auth(author.token, { type: 'bearer' }).send({ sequence: 1, active: false, elapsedMs: 10_000, offsetMs: 10_000 }).expect(200)).body.accepted).toBe(true);
        expect((await api().put(`/ugc/external-games/sessions/${sessionId}`).auth(author.token, { type: 'bearer' }).send({ sequence: 1, active: false, elapsedMs: 10_000, offsetMs: 10_000 }).expect(200)).body.duplicate).toBe(true);
        await api().put(`/ugc/external-games/sessions/${sessionId}`).auth(author.token, { type: 'bearer' }).send({ sequence: 2, active: true, elapsedMs: 0, offsetMs: 10_000 }).expect(200);
        const firstSegment = await sessions.findOne({ sessionId }).lean();
        await sessions.updateOne({ sessionId }, { $set: { lastSeenAt: new Date(Date.now() - 5_000),
            ranges: firstSegment!.ranges.map(range => ({ start: range.start - 10_000, end: range.end - 10_000 })) } });
        await api().put(`/ugc/external-games/sessions/${sessionId}`).auth(author.token, { type: 'bearer' }).send({ sequence: 3, active: false, elapsedMs: 5_000, offsetMs: 15_000, ended: true }).expect(200);
        expect((await api().put(`/ugc/external-games/sessions/${sessionId}`).auth(author.token, { type: 'bearer' }).send({ sequence: 4, active: true, elapsedMs: 0, offsetMs: 15_000 }).expect(200)).body.accepted).toBe(false);
        const history = await api().get('/ugc/external-games/history').auth(author.token, { type: 'bearer' }).expect(200);
        expect(history.body.totalSeconds).toBeGreaterThanOrEqual(14);
        expect(history.body.items).toContainEqual(expect.objectContaining({ gameId, name: '作者更新后的游戏' }));
        const previousLastPlayedAt = history.body.items.find((item: { gameId: string }) => item.gameId === gameId).lastPlayedAt;
        expect((await api().get('/ugc/external-games/history').auth(submitter.token, { type: 'bearer' }).expect(200)).body.totalSeconds).toBe(0);

        // 模拟断网五分钟后按原顺序补发：历史片段必须留在发生时刻，不得搬到联网时。
        const delayed = await api().post(`/ugc/external-games/${gameId}/sessions`).auth(author.token, { type: 'bearer' }).expect(201);
        const delayedId = delayed.body.sessionId as string;
        const startedAt = Date.now() - 300_000;
        await sessions.collection.updateOne({ sessionId: delayedId }, { $set: { createdAt: new Date(startedAt), lastSeenAt: new Date(startedAt) } });
        await api().put(`/ugc/external-games/sessions/${delayedId}`).auth(author.token, { type: 'bearer' })
            .send({ sequence: 1, active: true, elapsedMs: 10_000, offsetMs: 10_000 }).expect(200);
        await api().put(`/ugc/external-games/sessions/${delayedId}`).auth(author.token, { type: 'bearer' })
            .send({ sequence: 2, active: false, elapsedMs: 5_000, offsetMs: 15_000, ended: true }).expect(200);
        const delayedRecord = await sessions.findOne({ sessionId: delayedId }).lean();
        expect(delayedRecord!.ranges).toHaveLength(1);
        expect(delayedRecord!.ranges[0]).toMatchObject({ start: startedAt, end: startedAt + 15_000 });
        const afterDelayed = await api().get('/ugc/external-games/history').auth(author.token, { type: 'bearer' }).expect(200);
        expect(afterDelayed.body.items.find((item: { gameId: string }) => item.gameId === gameId).lastPlayedAt).toBe(previousLastPlayedAt);
        const hiddenSession = await api().post(`/ugc/external-games/${gameId}/sessions`).auth(author.token, { type: 'bearer' }).expect(201);
        await api().put(`/ugc/external-games/${gameId}`).auth(author.token, { type: 'bearer' })
            .send({ ...data, url: 'https://example.com/changed', published: false }).expect(200);
        const hiddenId = hiddenSession.body.sessionId as string;
        expect((await api().put(`/ugc/external-games/sessions/${hiddenId}`).auth(author.token, { type: 'bearer' })
            .send({ sequence: 1, active: true, elapsedMs: 10_000, offsetMs: 10_000 }).expect(200)).body.accepted).toBe(false);
        expect(await sessions.findOne({ sessionId: hiddenId }).lean()).toMatchObject({ ended: true, active: false, ranges: [] });
    }, 120_000);

    it('两个申请同时审核时同一作品最多授予一个管理者', async () => {
        const one = await register('creator-one'), two = await register('creator-two'), admin = await register('creator-judge');
        await users.updateOne({ _id: admin.id }, { $set: { role: 'admin' } });
        const a = await submitClaim(one.token, 'external-yuanyi-games', 'one');
        const b = await submitClaim(two.token, 'external-yuanyi-games', 'two');
        const results = await Promise.all([a, b].map(claim => api().post(`/ugc/creator-review/claims/${claim.claimId}`).auth(admin.token, { type: 'bearer' }).send(decision(claim))));
        expect(results.map(result => result.status).sort()).toEqual([201, 409]);
        const game = await api().get('/ugc/external-games/external-yuanyi-games').expect(200);
        expect([one.id, two.id]).toContain(game.body.ownerUserId);
    }, 120_000);
});
