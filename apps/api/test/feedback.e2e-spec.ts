import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { FeedbackModule } from '../src/modules/feedback/feedback.module';
import { Feedback, type FeedbackDocument } from '../src/modules/feedback/feedback.schema';
import {
    WATCHDOG_AGGREGATION_WINDOW_MS,
    WATCHDOG_MAX_RECENT_RECORDS,
    WATCHDOG_RECENT_RETENTION_MS,
} from '../src/modules/feedback/feedback.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('Feedback Module (e2e)', () => {
    const INTERNAL_FEEDBACK_TOKEN = 'test-internal-feedback-token';
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let feedbackModel: Model<FeedbackDocument>;
    let cacheManager: Cache;
    let authService: AuthService;
    let previousInternalFeedbackToken: string | undefined;
    let feedbackMongoUri: string;

    beforeAll(async () => {
        previousInternalFeedbackToken = process.env.INTERNAL_FEEDBACK_TOKEN;
        process.env.INTERNAL_FEEDBACK_TOKEN = INTERNAL_FEEDBACK_TOKEN;
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }
        if (externalMongoUri) {
            const parsed = new URL(mongoUri);
            parsed.pathname = '/boardgame_test_feedback';
            feedbackMongoUri = parsed.toString();
        } else {
            feedbackMongoUri = mongoUri;
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_feedback' } : undefined),
                AuthModule,
                FeedbackModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        feedbackModel = moduleRef.get<Model<FeedbackDocument>>(getModelToken(Feedback.name));
        cacheManager = moduleRef.get<Cache>(CACHE_MANAGER);
        authService = moduleRef.get<AuthService>(AuthService);
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
            })
        );
        app.useGlobalFilters(new GlobalHttpExceptionFilter());
        await app.init();
    });

    beforeEach(async () => {
        await Promise.all([
            userModel.deleteMany({}),
            feedbackModel.deleteMany({}),
        ]);
        await cacheManager.reset();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (mongo) {
            await mongo.stop();
        }
        if (previousInternalFeedbackToken === undefined) {
            delete process.env.INTERNAL_FEEDBACK_TOKEN;
        } else {
            process.env.INTERNAL_FEEDBACK_TOKEN = previousInternalFeedbackToken;
        }
    });

    const registerUser = async ({
        username,
        email,
        code,
        role = 'user',
        developerGameIds,
    }: {
        username: string;
        email: string;
        code: string;
        role?: 'user' | 'developer' | 'admin';
        developerGameIds?: string[];
    }) => {
        await authService.storeEmailCode(email, code);
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username, email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token as string;
        const userId = registerRes.body.user.id as string;
        if (role !== 'user') {
            await userModel.updateOne(
                { _id: userId },
                {
                    role,
                    ...(role === 'developer' ? { developerGameIds: developerGameIds ?? [] } : {}),
                }
            );
        }

        return { token, userId };
    };

    const seedUsers = async () => {
        const { token: adminToken, userId: adminId } = await registerUser({
            username: 'admin-feedback',
            email: 'admin-feedback@example.com',
            code: '123456',
            role: 'admin',
        });

        const { token: developerToken, userId: developerId } = await registerUser({
            username: 'developer-feedback',
            email: 'developer-feedback@example.com',
            code: '112233',
            role: 'developer',
            developerGameIds: ['smashup'],
        });

        const { token: userToken, userId } = await registerUser({
            username: 'player-feedback',
            email: 'player-feedback@example.com',
            code: '654321',
        });

        return { adminToken, adminId, developerToken, developerId, userToken, userId };
    };

    it('未登录可以匿名提交反馈', async () => {
        const res = await request(app.getHttpServer())
            .post('/feedback')
            .send({ content: '匿名反馈内容' })
            .expect(201);

        expect(res.body.content).toBe('匿名反馈内容');
        expect(res.body.userId).toBeUndefined();
    });

    it('失效登录态不会阻断匿名反馈提交', async () => {
        const res = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', 'Bearer expired-or-invalid-token')
            .send({ content: '失效登录态下仍可反馈' })
            .expect(201);

        expect(res.body.content).toBe('失效登录态下仍可反馈');
        expect(res.body.userId).toBeUndefined();
        expect(res.body.rewardPoints).toBe(0);
    });

    it('运行时守卫自动反馈允许保留受控 source 与 autoReportKind', async () => {
        const res = await request(app.getHttpServer())
            .post('/feedback')
            .send({
                content: '[auto][smashup-runtime-guard] 发现空数组合同破坏',
                source: 'client-runtime-guard',
                autoReportKind: 'smashup-runtime-state-normalized',
                type: 'bug',
                severity: 'high',
                gameName: 'smashup',
                clientContext: {
                    gameId: 'smashup',
                    matchId: 'match-1',
                    playerId: '0',
                },
                errorContext: {
                    name: 'SmashUpRuntimeStateNormalized',
                    source: 'smashup.runtime_state_guard',
                },
            })
            .expect(201);

        expect(res.body.reporterType).toBe('system');
        expect(res.body.source).toBe('client-runtime-guard');
        expect(res.body.autoReportKind).toBe('smashup-runtime-state-normalized');
        expect(res.body.clientContext?.matchId).toBe('match-1');
    });

    it('全局客户端错误自动反馈来源也允许透传', async () => {
        const res = await request(app.getHttpServer())
            .post('/feedback')
            .send({
                content: '[auto][window.error] 页面运行时异常',
                source: 'client-window-error',
                autoReportKind: 'window-error',
                type: 'bug',
                severity: 'high',
                gameName: 'client',
                errorContext: {
                    name: 'TypeError',
                    message: 'window boom',
                    source: 'window.error',
                },
            })
            .expect(201);

        expect(res.body.reporterType).toBe('system');
        expect(res.body.source).toBe('client-window-error');
        expect(res.body.autoReportKind).toBe('window-error');
    });

    it('普通用户自定义未知 source 会被收敛回反馈弹窗来源', async () => {
        const res = await request(app.getHttpServer())
            .post('/feedback')
            .send({
                content: '伪造来源测试',
                source: 'evil-bot',
            })
            .expect(201);

        expect(res.body.source).toBe('feedback-modal');
    });

    it('未登录可以匿名读取反馈列表（只读）', async () => {
        await request(app.getHttpServer())
            .post('/feedback')
            .send({
                content: '匿名可读列表样本',
                type: 'bug',
                severity: 'low',
                gameName: 'tictactoe',
            })
            .expect(201);

        const listRes = await request(app.getHttpServer())
            .get('/admin/feedback?limit=20')
            .expect(200);

        expect(listRes.body.items).toHaveLength(1);
        expect(listRes.body.items[0].content).toBe('匿名可读列表样本');
        expect(listRes.body.items[0].canManage).toBe(false);
    });

    it('登录用户提交反馈会记录奖励积分并同步到用户资料', async () => {
        const { token, userId } = await registerUser({
            username: 'reward-player',
            email: 'reward-player@example.com',
            code: '345678',
        });

        const createRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${token}`)
            .send({
                content: '登录反馈奖励测试',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
            })
            .expect(201);

        expect(createRes.body.rewardPoints).toBe(1);

        const storedUser = await userModel.findById(userId).lean();
        expect(storedUser?.feedbackPoints).toBe(1);

        const meRes = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(meRes.body.user.feedbackPoints).toBe(1);
    });

    it('mineOnly=true 只返回当前登录用户自己的反馈', async () => {
        const { userToken: firstUserToken } = await seedUsers();
        const { token: secondUserToken } = await registerUser({
            username: 'other-feedback-owner',
            email: 'other-feedback-owner@example.com',
            code: '778899',
        });

        await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${firstUserToken}`)
            .send({
                content: '我的反馈 A',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
            })
            .expect(201);

        await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${secondUserToken}`)
            .send({
                content: '别人的反馈 B',
                type: 'suggestion',
                severity: 'low',
                gameName: 'tictactoe',
            })
            .expect(201);

        const ownListRes = await request(app.getHttpServer())
            .get('/admin/feedback?mineOnly=true&limit=20')
            .set('Authorization', `Bearer ${firstUserToken}`)
            .expect(200);

        expect(ownListRes.body.items).toHaveLength(1);
        expect(ownListRes.body.items[0].content).toBe('我的反馈 A');
    });

    it('普通用户反馈关闭时不填写关闭理由会返回 400', async () => {
        const { userToken } = await seedUsers();

        const createRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '需要关闭理由的普通反馈',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
            })
            .expect(201);

        const closeRes = await request(app.getHttpServer())
            .patch(`/admin/feedback/${createRes.body._id as string}/status`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ status: 'closed' })
            .expect(400);

        expect(String(closeRes.body.error ?? closeRes.body.message ?? '')).toContain('关闭理由不能为空');
    });

    it('系统反馈关闭时允许不填写关闭理由', async () => {
        const { adminToken } = await seedUsers();

        const createRes = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                content: '[system][online-ai-watchdog] 自动反馈关闭无需理由',
                source: 'online-ai-watchdog',
                type: 'bug',
                severity: 'high',
                gameName: 'dicethrone',
                clientContext: {
                    gameId: 'dicethrone',
                    route: 'server-watchdog',
                    mode: 'online',
                },
                errorContext: {
                    source: 'online-ai-watchdog',
                    name: 'auto-close-no-reason',
                    message: 'auto-close-no-reason',
                },
            })
            .expect(201);

        const closeRes = await request(app.getHttpServer())
            .patch(`/admin/feedback/${createRes.body._id as string}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'closed' })
            .expect(200);

        expect(closeRes.body.status).toBe('closed');
    });

    it('标记为已解决时不填写解决方式会返回 400', async () => {
        const { userToken } = await seedUsers();

        const createRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '需要填写解决方式的反馈',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
            })
            .expect(201);

        const resolveRes = await request(app.getHttpServer())
            .patch(`/admin/feedback/${createRes.body._id as string}/status`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ status: 'resolved' })
            .expect(400);

        expect(String(resolveRes.body.error ?? resolveRes.body.message ?? '')).toContain('解决方式不能为空');
    });

    it('标记为已解决时会保存解决方式', async () => {
        const { userToken } = await seedUsers();

        const createRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '需要记录解决方式的反馈',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
            })
            .expect(201);

        const resolveRes = await request(app.getHttpServer())
            .patch(`/admin/feedback/${createRes.body._id as string}/status`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ status: 'resolved', resolvedMethod: '补充判定分支并增加回归测试' })
            .expect(200);

        expect(resolveRes.body.status).toBe('resolved');
        expect(resolveRes.body.resolvedMethod).toBe('补充判定分支并增加回归测试');
    });

    it('internal feedback 需要 token 且可创建系统反馈', async () => {
        const payload = {
            content: 'system feedback',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            status: 'resolved',
        };

        await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .send(payload)
            .expect(401);

        await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', 'wrong-token')
            .send(payload)
            .expect(403);

        const okRes = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        expect(okRes.body.reporterType).toBe('system');
        expect(okRes.body.source).toBe('online-ai-watchdog');
        expect(okRes.body.status).toBe('resolved');
        expect(okRes.body.resolvedMethod).toBe('系统已自动恢复这次在线 AI 步骤，对局已继续运行。');
    });

    it('online-ai-watchdog 相同根因的系统反馈应聚合到同一条记录并累计次数', async () => {
        const payloadA = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'tracker-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };
        const payloadB = {
            ...payloadA,
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=3',
            incidentKey: 'tracker-b',
            errorContext: {
                ...payloadA.errorContext,
                message: 'active-turn:follow-up-advance:steps=3',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadA)
            .expect(201);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadB)
            .expect(201);

        expect(second.body._id).toBe(first.body._id);
        expect(second.body.incidentKey).toContain('system-feedback:online-ai-watchdog:dicethrone:server-watchdog:online:force-end-turn:active-turn:follow-up-advance');
        expect(second.body.latestIncidentKey).toBe('tracker-b');
        expect(second.body.occurrenceCount).toBe(2);
        expect(second.body.status).toBe('resolved');
        expect(second.body.resolvedMethod).toBe('系统已自动推进停滞的 AI 座位，让对局继续进行。');

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).lean();
        expect(docs).toHaveLength(1);
        expect(docs[0].occurrenceCount).toBe(2);
        expect(docs[0].latestIncidentKey).toBe('tracker-b');
        expect(docs[0].resolvedMethod).toBe('系统已自动推进停滞的 AI 座位，让对局继续进行。');
    });

    it('online-ai-watchdog 并发同 key 上报时 occurrenceCount 应精确累加且仅保留一个 canonical', async () => {
        const concurrentCount = 8;
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const responses = await Promise.all(
            Array.from({ length: concurrentCount }, (_, index) =>
                request(app.getHttpServer())
                    .post('/internal/feedback/system')
                    .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
                    .send({
                        ...payload,
                        incidentKey: `concurrent-${index + 1}`,
                    })
                    .expect(201)
            ),
        );

        const canonicalIds = new Set(responses.map((res) => String(res.body._id)));
        expect(canonicalIds.size).toBe(1);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).lean();
        expect(docs).toHaveLength(1);
        expect(docs[0].occurrenceCount).toBe(concurrentCount);
        expect(String(docs[0].aggregationActiveKey || '')).toContain(
            'system-feedback:online-ai-watchdog:dicethrone:server-watchdog:online:force-end-turn:active-turn:follow-up-advance',
        );
        expect(String(docs[0].latestIncidentKey || '')).toContain('concurrent-');
    });

    it('online-ai-watchdog legal-action-recovered 同动作不同卡面细节应聚合到同一条记录', async () => {
        const payloadA = {
            content: '[system][online-ai-watchdog] legal-action-recovered active-turn:legal-action:discard-for-magic:discard-for-magic:necro-hellfire-blade-0-1-21',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'legal-action-recovered',
            incidentKey: 'legal-a',
            gameName: 'summonerwars',
            clientContext: {
                gameId: 'summonerwars',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'legal-action-recovered',
                message: 'active-turn:legal-action:discard-for-magic:discard-for-magic:necro-hellfire-blade-0-1-21',
            },
        };
        const payloadB = {
            ...payloadA,
            content: '[system][online-ai-watchdog] legal-action-recovered active-turn:legal-action:discard-for-magic:discard-for-magic:necro-annihilate-1-1-24',
            incidentKey: 'legal-b',
            errorContext: {
                ...payloadA.errorContext,
                message: 'active-turn:legal-action:discard-for-magic:discard-for-magic:necro-annihilate-1-1-24',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadA)
            .expect(201);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadB)
            .expect(201);

        expect(second.body._id).toBe(first.body._id);
        expect(second.body.incidentKey).toContain('system-feedback:online-ai-watchdog:summonerwars:server-watchdog:online:legal-action-recovered:active-turn:legal-action:discard-for-magic');
        expect(second.body.latestIncidentKey).toBe('legal-b');
        expect(second.body.occurrenceCount).toBe(2);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).lean();
        expect(docs).toHaveLength(1);
        expect(docs[0].occurrenceCount).toBe(2);
    });

    it('online-ai-watchdog legal-action-recovered 在同动作下也应按 responseWindow.sourceId 分桶', async () => {
        const payloadA = {
            content: '[system][online-ai-watchdog] legal-action-recovered response-window:legal-action:response-pass:response-pass:window-a',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'legal-action-recovered',
            incidentKey: 'legal-window-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'legal-action-recovered',
                message: 'response-window:legal-action:response-pass:response-pass:window-a',
            },
            stateSnapshot: JSON.stringify({
                phase: 'defensiveRoll',
                reason: 'response-window',
                responseWindow: {
                    windowType: 'afterAttackResolved',
                    sourceId: 'attack-1',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                },
            }),
        };
        const payloadB = {
            ...payloadA,
            content: '[system][online-ai-watchdog] legal-action-recovered response-window:legal-action:response-pass:response-pass:window-b',
            incidentKey: 'legal-window-b',
            errorContext: {
                ...payloadA.errorContext,
                message: 'response-window:legal-action:response-pass:response-pass:window-b',
            },
            stateSnapshot: JSON.stringify({
                phase: 'defensiveRoll',
                reason: 'response-window',
                responseWindow: {
                    windowType: 'afterAttackResolved',
                    sourceId: 'attack-2',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                },
            }),
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadA)
            .expect(201);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadB)
            .expect(201);

        expect(second.body._id).not.toBe(first.body._id);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        expect(String(docs[0].aggregationKey || '')).toContain('attack-1');
        expect(String(docs[1].aggregationKey || '')).toContain('attack-2');
    });

    it('online-ai-watchdog force-end-turn-failed 应按交互 sourceId 分桶，避免不同卡死交互混桶', async () => {
        const payloadA = {
            content: '[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            autoReportKind: 'force-end-turn-failed',
            incidentKey: 'force-failed-a',
            gameName: 'smashup',
            clientContext: {
                gameId: 'smashup',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-failed',
                message: 'visible-interaction:recover-interaction:blocker_persisted',
            },
            stateSnapshot: JSON.stringify({
                phase: 'scoreBases',
                reason: 'visible-interaction',
                interaction: {
                    seat: {
                        kind: 'simple-choice',
                        sourceId: 'pirate_first_mate_choose_base',
                    },
                },
            }),
        };
        const payloadB = {
            ...payloadA,
            incidentKey: 'force-failed-b',
            stateSnapshot: JSON.stringify({
                phase: 'scoreBases',
                reason: 'visible-interaction',
                interaction: {
                    seat: {
                        kind: 'simple-choice',
                        sourceId: 'smashup_reaction_choose',
                    },
                },
            }),
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadA)
            .expect(201);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadB)
            .expect(201);

        expect(second.body._id).not.toBe(first.body._id);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        expect(String(docs[0].aggregationKey || '')).toContain('pirate_first_mate_choose_base');
        expect(String(docs[1].aggregationKey || '')).toContain('smashup_reaction_choose');
    });

    it('online-ai-watchdog 已打开的失败聚合项，不应被后续一次成功恢复自动改成 resolved', async () => {
        const failed = {
            content: '[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            autoReportKind: 'force-end-turn-failed',
            incidentKey: 'failure-tracker',
            gameName: 'smashup',
            clientContext: {
                gameId: 'smashup',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-failed',
                message: 'active-turn:follow-up-advance:command_failed',
            },
        };
        const recovered = {
            ...failed,
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'failure-tracker-2',
            errorContext: {
                ...failed.errorContext,
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(failed)
            .expect(201);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(recovered)
            .expect(201);

        expect(second.body._id).toBe(first.body._id);
        expect(second.body.status).toBe('open');
        expect(second.body.occurrenceCount).toBe(2);
    });

    it('online-ai-watchdog 已 resolved 的失败聚合项，不应被旧线上重复失败上报重新打开', async () => {
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:legal_action_unavailable',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            autoReportKind: 'force-end-turn-failed',
            incidentKey: 'resolved-failure-tracker-a',
            gameName: 'splendor',
            clientContext: {
                gameId: 'splendor',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-failed',
                message: 'active-turn:follow-up-advance:legal_action_unavailable',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        await feedbackModel.findByIdAndUpdate(first.body._id, {
            status: 'resolved',
            resolvedMethod: '已按领域动作修复，等待发布链路带到线上',
        });

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                incidentKey: 'resolved-failure-tracker-b',
            })
            .expect(201);

        expect(second.body._id).toBe(first.body._id);
        expect(second.body.status).toBe('resolved');
        expect(second.body.occurrenceCount).toBe(2);
        expect(second.body.latestIncidentKey).toBe('resolved-failure-tracker-b');

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).lean();
        expect(docs).toHaveLength(1);
        expect(docs[0].status).toBe('resolved');
    });

    it('online-ai-watchdog 超出去重窗口后应新建新的 canonical 记录', async () => {
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'window-tracker-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        const staleOccurredAt = new Date(Date.now() - WATCHDOG_AGGREGATION_WINDOW_MS - 1000);
        await feedbackModel.findByIdAndUpdate(first.body._id, {
            firstOccurredAt: staleOccurredAt,
            lastOccurredAt: staleOccurredAt,
        });

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=2',
                incidentKey: 'window-tracker-b',
                errorContext: {
                    ...payload.errorContext,
                    message: 'active-turn:follow-up-advance:steps=2',
                },
            })
            .expect(201);

        expect(second.body._id).not.toBe(first.body._id);
        expect(second.body.occurrenceCount).toBe(1);
        expect(second.body.latestIncidentKey).toBe('window-tracker-b');

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        expect(docs[0]._id.toString()).toBe(first.body._id);
        expect(docs[1]._id.toString()).toBe(second.body._id);
        expect(docs[0].status).toBe('closed');
        expect(docs[0].aggregationActiveKey).toBeUndefined();
        expect(docs[1].status).toBe('resolved');
        expect(docs[1].aggregationActiveKey).toContain('system-feedback:online-ai-watchdog:dicethrone');
    });

    it('online-ai-watchdog 已 closed 的归档项命中同 key 时应新开 canonical 记录', async () => {
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            autoReportKind: 'force-end-turn-failed',
            incidentKey: 'closed-tracker-a',
            gameName: 'smashup',
            clientContext: {
                gameId: 'smashup',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-failed',
                message: 'active-turn:follow-up-advance:command_failed',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        await feedbackModel.findByIdAndUpdate(first.body._id, { status: 'closed' });

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                incidentKey: 'closed-tracker-b',
            })
            .expect(201);

        expect(second.body._id).not.toBe(first.body._id);
        expect(second.body.status).toBe('open');
        expect(second.body.occurrenceCount).toBe(1);
        expect(second.body.latestIncidentKey).toBe('closed-tracker-b');

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        expect(docs[0].status).toBe('closed');
        expect(docs[1].status).toBe('open');
    });

    it('online-ai-watchdog 超过3天的聚合归档应在新上报时自动清理，避免数据库累积', async () => {
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'archive-retention-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        const staleOccurredAt = new Date(Date.now() - WATCHDOG_RECENT_RETENTION_MS - 60_000);
        await feedbackModel.updateOne(
            { _id: first.body._id },
            {
                $set: {
                    status: 'closed',
                    firstOccurredAt: staleOccurredAt,
                    lastOccurredAt: staleOccurredAt,
                },
                $unset: { aggregationActiveKey: '' },
            },
        );

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                incidentKey: 'archive-retention-b',
            })
            .expect(201);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(1);
        expect(docs[0]._id.toString()).toBe(second.body._id);
        expect(docs[0].status).toBe('resolved');
        expect(docs[0].latestIncidentKey).toBe('archive-retention-b');
    });

    it('online-ai-watchdog 近3天内的聚合归档在未超100条时不应被提前清理', async () => {
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'archive-fresh-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        const freshOccurredAt = new Date(Date.now() - WATCHDOG_RECENT_RETENTION_MS + 60_000);
        await feedbackModel.updateOne(
            { _id: first.body._id },
            {
                $set: {
                    status: 'closed',
                    firstOccurredAt: freshOccurredAt,
                    lastOccurredAt: freshOccurredAt,
                },
                $unset: { aggregationActiveKey: '' },
            },
        );

        await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                incidentKey: 'archive-fresh-b',
            })
            .expect(201);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        const retainedClosed = docs.find((doc) => String(doc._id) === String(first.body._id));
        expect(retainedClosed?.status).toBe('closed');
    });

    it('online-ai-watchdog 近3天内也只保留最近100条，超出上限时应自动删除更旧记录', async () => {
        await feedbackModel.deleteMany({ source: 'online-ai-watchdog' });

        const basePayload = {
            content: '[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            autoReportKind: 'force-end-turn-failed',
            gameName: 'smashup',
            clientContext: {
                gameId: 'smashup',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-failed',
                message: 'visible-interaction:recover-interaction:blocker_persisted',
            },
        };

        const totalRows = WATCHDOG_MAX_RECENT_RECORDS + 5;
        for (let index = 0; index < totalRows; index += 1) {
            await request(app.getHttpServer())
                .post('/internal/feedback/system')
                .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
                .send({
                    ...basePayload,
                    incidentKey: `recent-cap-${index}`,
                    stateSnapshot: JSON.stringify({
                        phase: 'scoreBases',
                        reason: 'visible-interaction',
                        interaction: {
                            seat: {
                                kind: 'simple-choice',
                                sourceId: `retention-source-${index}`,
                            },
                        },
                    }),
                })
                .expect(201);
        }

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(WATCHDOG_MAX_RECENT_RECORDS);
        expect(
            docs.filter((doc) => String(doc.aggregationKey || '').includes('retention-source-')).length,
        ).toBe(WATCHDOG_MAX_RECENT_RECORDS);
        expect(docs.some((doc) => String(doc.aggregationKey || '').includes(`retention-source-${totalRows - 1}`))).toBe(true);
    });

    it('online-ai-watchdog clientContext.gameId 为空白时应回退到 gameName 作为聚合 gameId', async () => {
        const payloadA = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'blank-gameid-a',
            gameName: 'summonerwars',
            clientContext: {
                gameId: '   ',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payloadA)
            .expect(201);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payloadA,
                incidentKey: 'blank-gameid-b',
            })
            .expect(201);

        expect(second.body._id).toBe(first.body._id);
        expect(String(second.body.incidentKey || '')).toContain(':summonerwars:');
        expect(second.body.gameId).toBe('summonerwars');
    });

    it('online-ai-watchdog unsatisfiable-interaction-auto-skipped 应按交互 sourceId 分桶，避免不同强制跳过根因混桶', async () => {
        const basePayload = {
            content: '[system][online-ai-watchdog] unsatisfiable-interaction-auto-skipped all-options-disabled',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'unsatisfiable-interaction-auto-skipped',
            gameName: 'smashup',
            clientContext: {
                gameId: 'smashup',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'unsatisfiable-interaction-auto-skipped',
                message: 'all-options-disabled',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...basePayload,
                incidentKey: 'unsat-a',
                stateSnapshot: JSON.stringify({
                    phase: 'playCards',
                    commandType: 'SYS_INTERACTION_RESPOND',
                    interaction: {
                        seat: {
                            id: 'interaction-a',
                            kind: 'simple-choice',
                            sourceId: 'card-alpha',
                        },
                    },
                }),
            })
            .expect(201);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...basePayload,
                incidentKey: 'unsat-b',
                stateSnapshot: JSON.stringify({
                    phase: 'playCards',
                    commandType: 'SYS_INTERACTION_RESPOND',
                    interaction: {
                        seat: {
                            id: 'interaction-b',
                            kind: 'simple-choice',
                            sourceId: 'card-beta',
                        },
                    },
                }),
            })
            .expect(201);

        expect(second.body._id).not.toBe(first.body._id);

        const docs = await feedbackModel.find({
            source: 'online-ai-watchdog',
            autoReportKind: 'unsatisfiable-interaction-auto-skipped',
        }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        expect(String(docs[0].incidentKey || '')).toContain('card-alpha');
        expect(String(docs[1].incidentKey || '')).toContain('card-beta');
    });

    it('watchdog 聚合项被管理员 reopen 后应恢复 activeKey 并继续复用同一 canonical', async () => {
        const { adminToken } = await seedUsers();
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'reopen-tracker-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        const closed = await request(app.getHttpServer())
            .patch(`/admin/feedback/${first.body._id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'closed' })
            .expect(200);
        expect(closed.body.status).toBe('closed');

        const closedDoc = await feedbackModel.findById(first.body._id).lean();
        expect(closedDoc?.aggregationActiveKey).toBeUndefined();

        const reopened = await request(app.getHttpServer())
            .patch(`/admin/feedback/${first.body._id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'resolved', resolvedMethod: '重新激活聚合记录用于继续跟进' })
            .expect(200);
        expect(reopened.body.status).toBe('resolved');
        expect(reopened.body.aggregationActiveKey).toBe(first.body.incidentKey);

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                incidentKey: 'reopen-tracker-b',
            })
            .expect(201);

        expect(second.body._id).toBe(first.body._id);
        expect(second.body.occurrenceCount).toBe(2);
        expect(second.body.latestIncidentKey).toBe('reopen-tracker-b');
    });

    it('watchdog 旧窗口归档项在已有活跃 canonical 时不允许 reopen', async () => {
        const { adminToken } = await seedUsers();
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'reopen-conflict-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        const staleOccurredAt = new Date(Date.now() - WATCHDOG_AGGREGATION_WINDOW_MS - 1000);
        await feedbackModel.findByIdAndUpdate(first.body._id, {
            firstOccurredAt: staleOccurredAt,
            lastOccurredAt: staleOccurredAt,
        });

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                incidentKey: 'reopen-conflict-b',
            })
            .expect(201);

        expect(second.body._id).not.toBe(first.body._id);

        await request(app.getHttpServer())
            .patch(`/admin/feedback/${first.body._id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'resolved', resolvedMethod: '尝试重新打开旧聚合记录' })
            .expect(409);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        expect(docs[0]._id.toString()).toBe(first.body._id);
        expect(docs[0].status).toBe('closed');
        expect(docs[1]._id.toString()).toBe(second.body._id);
        expect(['open', 'resolved']).toContain(docs[1].status);
    });

    it('watchdog 两条同聚合键归档项并发 reopen 时应返回 200+409 且不出现 500', async () => {
        const { adminToken } = await seedUsers();
        const payload = {
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            type: 'bug',
            severity: 'high',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'reopen-race-a',
            gameName: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
        };

        const first = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send(payload)
            .expect(201);

        const staleOccurredAt = new Date(Date.now() - WATCHDOG_AGGREGATION_WINDOW_MS - 1000);
        await feedbackModel.findByIdAndUpdate(first.body._id, {
            firstOccurredAt: staleOccurredAt,
            lastOccurredAt: staleOccurredAt,
        });

        const second = await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                ...payload,
                incidentKey: 'reopen-race-b',
            })
            .expect(201);
        expect(second.body._id).not.toBe(first.body._id);

        await request(app.getHttpServer())
            .patch(`/admin/feedback/${first.body._id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'closed' })
            .expect(200);
        await request(app.getHttpServer())
            .patch(`/admin/feedback/${second.body._id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'closed' })
            .expect(200);

        const [reopenA, reopenB] = await Promise.all([
            request(app.getHttpServer())
                .patch(`/admin/feedback/${first.body._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'resolved', resolvedMethod: '并发重开聚合记录 A' }),
            request(app.getHttpServer())
                .patch(`/admin/feedback/${second.body._id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'resolved', resolvedMethod: '并发重开聚合记录 B' }),
        ]);
        const statuses = [reopenA.status, reopenB.status].sort((a, b) => a - b);
        expect(statuses).toEqual([200, 409]);
        const conflictResponse = [reopenA, reopenB].find((res) => res.status === 409);
        expect(conflictResponse?.status).toBe(409);

        const docs = await feedbackModel.find({ source: 'online-ai-watchdog' }).sort({ createdAt: 1 }).lean();
        expect(docs).toHaveLength(2);
        const activeDocs = docs.filter((doc) => ['open', 'in_progress', 'resolved'].includes(doc.status));
        expect(activeDocs).toHaveLength(1);
        expect(Boolean(activeDocs[0].aggregationActiveKey)).toBe(true);
    });

    it('watchdog 去重脚本在旧窗口 active + 最新窗口 closed canonical 时应保留一个 active canonical', async () => {
        const scriptPath = path.resolve(process.cwd(), 'scripts/db/close-watchdog-resolved-dedupe.mjs');
        const staleOccurredAt = new Date(Date.now() - WATCHDOG_AGGREGATION_WINDOW_MS - 1000);
        const latestOccurredAt = new Date();

        const oldActive = await feedbackModel.create({
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            reporterType: 'system',
            type: 'bug',
            severity: 'high',
            status: 'open',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'legacy-active-incident',
            aggregationKey: 'system-feedback:online-ai-watchdog:dicethrone:server-watchdog:online:force-end-turn:active-turn:follow-up-advance',
            aggregationActiveKey: 'system-feedback:online-ai-watchdog:dicethrone:server-watchdog:online:force-end-turn:active-turn:follow-up-advance',
            gameId: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
            firstOccurredAt: staleOccurredAt,
            lastOccurredAt: staleOccurredAt,
            latestIncidentKey: 'legacy-active-incident',
            occurrenceCount: 3,
        });

        const latestClosed = await feedbackModel.create({
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            reporterType: 'system',
            type: 'bug',
            severity: 'medium',
            status: 'closed',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'latest-closed-incident',
            gameId: 'dicethrone',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
            firstOccurredAt: latestOccurredAt,
            lastOccurredAt: latestOccurredAt,
            latestIncidentKey: 'latest-closed-incident',
            occurrenceCount: 1,
        });

        const beforeScriptRows = await feedbackModel
            .find({ source: 'online-ai-watchdog' })
            .sort({ createdAt: 1 })
            .lean();
        expect(beforeScriptRows).toHaveLength(2);
        const preOld = beforeScriptRows.find((doc) => doc._id.toString() === String(oldActive._id));
        const preLatest = beforeScriptRows.find((doc) => doc._id.toString() === String(latestClosed._id));
        const preOldTime = preOld?.lastOccurredAt ? new Date(preOld.lastOccurredAt).getTime() : Number.NaN;
        const preLatestTime = preLatest?.lastOccurredAt ? new Date(preLatest.lastOccurredAt).getTime() : Number.NaN;
        expect(Number.isFinite(preOldTime)).toBe(true);
        expect(Number.isFinite(preLatestTime)).toBe(true);
        expect(preLatestTime - preOldTime).toBeGreaterThan(WATCHDOG_AGGREGATION_WINDOW_MS);

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watchdog-closeout-'));
        const boardPath = path.join(tempDir, 'status-board.json');
        const outputPath = path.join(tempDir, 'report.json');
        await fs.writeFile(
            boardPath,
            JSON.stringify(
                {
                    version: 1,
                    updatedAt: new Date().toISOString(),
                    items: [
                        {
                            feedbackId: String(oldActive._id),
                            status: 'open',
                            lastFetchedStatus: 'open',
                            notes: '',
                        },
                        {
                            feedbackId: String(latestClosed._id),
                            status: 'closed',
                            lastFetchedStatus: 'closed',
                            notes: '',
                        },
                    ],
                },
                null,
                2,
            ),
            'utf8',
        );

        try {
            execFileSync(
                process.execPath,
                [scriptPath, '--apply', `--board=${boardPath}`, `--output=${outputPath}`],
                {
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        MONGO_URI: feedbackMongoUri,
                    },
                    stdio: 'pipe',
                },
            );
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }

        const docs = await feedbackModel
            .find({ source: 'online-ai-watchdog' })
            .sort({ createdAt: 1 })
            .lean();
        expect(docs).toHaveLength(2);
        const refreshedOld = docs.find((doc) => doc._id.toString() === String(oldActive._id));
        const refreshedLatest = docs.find((doc) => doc._id.toString() === String(latestClosed._id));
        expect(refreshedOld?.status).toBe('closed');
        expect(refreshedOld?.aggregationActiveKey).toBeUndefined();
        expect(refreshedLatest?.status).toBe('resolved');
        expect(String(refreshedLatest?.aggregationActiveKey || '')).toContain(
            'system-feedback:online-ai-watchdog:dicethrone:server-watchdog:online:force-end-turn:active-turn:follow-up-advance',
        );
    });

    it('watchdog 去重脚本应按 clientContext.gameId/gameName 区分桶并跳过缺失 game identity 的 legacy 行', async () => {
        const scriptPath = path.resolve(process.cwd(), 'scripts/db/close-watchdog-resolved-dedupe.mjs');
        const now = new Date();

        const feedbackByClientGameA = await feedbackModel.create({
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            reporterType: 'system',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'legacy-client-game-a',
            gameId: '   ',
            clientContext: {
                gameId: 'dicethrone',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
            firstOccurredAt: now,
            lastOccurredAt: now,
            latestIncidentKey: 'legacy-client-game-a',
            occurrenceCount: 1,
        });

        const feedbackByClientGameB = await feedbackModel.create({
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            reporterType: 'system',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'legacy-client-game-b',
            clientContext: {
                gameId: 'smashup',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
            firstOccurredAt: now,
            lastOccurredAt: now,
            latestIncidentKey: 'legacy-client-game-b',
            occurrenceCount: 1,
        });

        const feedbackByGameName = await feedbackModel.create({
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            reporterType: 'system',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'legacy-game-name-only',
            gameId: '',
            gameName: 'summonerwars',
            clientContext: {
                gameId: '   ',
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
            firstOccurredAt: now,
            lastOccurredAt: now,
            latestIncidentKey: 'legacy-game-name-only',
            occurrenceCount: 1,
        });

        const feedbackMissingGameIdentity = await feedbackModel.create({
            content: '[system][online-ai-watchdog] force-end-turn-success active-turn:follow-up-advance:steps=1',
            source: 'online-ai-watchdog',
            reporterType: 'system',
            type: 'bug',
            severity: 'medium',
            status: 'resolved',
            autoReportKind: 'force-end-turn-success',
            incidentKey: 'legacy-missing-game-id',
            clientContext: {
                route: 'server-watchdog',
                mode: 'online',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'force-end-turn-success',
                message: 'active-turn:follow-up-advance:steps=1',
            },
            firstOccurredAt: now,
            lastOccurredAt: now,
            latestIncidentKey: 'legacy-missing-game-id',
            occurrenceCount: 1,
        });

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watchdog-closeout-'));
        const boardPath = path.join(tempDir, 'status-board.json');
        const outputPath = path.join(tempDir, 'report.json');
        await fs.writeFile(
            boardPath,
            JSON.stringify(
                {
                    version: 1,
                    updatedAt: new Date().toISOString(),
                    items: [
                        { feedbackId: String(feedbackByClientGameA._id), status: 'resolved', lastFetchedStatus: 'resolved', notes: '' },
                        { feedbackId: String(feedbackByClientGameB._id), status: 'resolved', lastFetchedStatus: 'resolved', notes: '' },
                        { feedbackId: String(feedbackByGameName._id), status: 'resolved', lastFetchedStatus: 'resolved', notes: '' },
                        { feedbackId: String(feedbackMissingGameIdentity._id), status: 'resolved', lastFetchedStatus: 'resolved', notes: '' },
                    ],
                },
                null,
                2,
            ),
            'utf8',
        );

        try {
            execFileSync(
                process.execPath,
                [scriptPath, '--apply', `--board=${boardPath}`, `--output=${outputPath}`],
                {
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        MONGO_URI: feedbackMongoUri,
                    },
                    stdio: 'pipe',
                },
            );

            const report = JSON.parse(await fs.readFile(outputPath, 'utf8')) as {
                totalClusterCount?: number;
                skippedMissingGameIdentityCount?: number;
                skippedMissingGameIdentityFeedbackIds?: string[];
            };
            expect(report.totalClusterCount).toBe(3);
            expect(report.skippedMissingGameIdentityCount).toBe(1);
            expect(report.skippedMissingGameIdentityFeedbackIds).toContain(String(feedbackMissingGameIdentity._id));
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }

        const rows = await feedbackModel.find({ source: 'online-ai-watchdog' }).lean();
        const rowA = rows.find((row) => row._id.toString() === String(feedbackByClientGameA._id));
        const rowB = rows.find((row) => row._id.toString() === String(feedbackByClientGameB._id));
        const rowByName = rows.find((row) => row._id.toString() === String(feedbackByGameName._id));
        const rowMissing = rows.find((row) => row._id.toString() === String(feedbackMissingGameIdentity._id));

        expect(rowA?.status).toBe('resolved');
        expect(rowB?.status).toBe('resolved');
        expect(rowByName?.status).toBe('resolved');
        expect(rowMissing?.status).toBe('resolved');
        expect(rowMissing?.aggregationActiveKey).toBeUndefined();
    });

    it('登录用户反馈会绑定 userId 且管理员可更新状态', async () => {
        const { adminToken, userToken, userId } = await seedUsers();

        const createRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '反馈内容',
                type: 'bug',
                severity: 'high',
                gameName: 'tictactoe',
                actionLog: '[12:00] P1: cast card',
            })
            .expect(201);

        expect(createRes.body.content).toBe('反馈内容');
        expect(String(createRes.body.userId)).toBe(userId);
        const feedbackId = createRes.body._id as string;

        const listRes = await request(app.getHttpServer())
            .get('/admin/feedback?limit=20')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(listRes.body.items.length).toBe(1);
        expect(listRes.body.items[0]._id).toBe(feedbackId);

        const updateRes = await request(app.getHttpServer())
            .patch(`/admin/feedback/${feedbackId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'resolved', resolvedMethod: '后台确认问题已修复' })
            .expect(200);

        expect(updateRes.body.status).toBe('resolved');
    });

    it('普通用户可查看全部反馈且仅能修改自己的反馈，并可切换我的优先排序', async () => {
        const { userToken } = await seedUsers();
        const { token: otherUserToken } = await registerUser({
            username: 'player-feedback-2',
            email: 'player-feedback-2@example.com',
            code: '778899',
        });

        const ownFeedbackRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'user own feedback',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
                clientContext: { gameId: 'smashup' },
            })
            .expect(201);

        const otherFeedbackRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${otherUserToken}`)
            .send({
                content: 'other user feedback',
                type: 'bug',
                severity: 'medium',
                gameName: 'tictactoe',
                clientContext: { gameId: 'tictactoe' },
            })
            .expect(201);

        await feedbackModel.findByIdAndUpdate(ownFeedbackRes.body._id, { createdAt: new Date('2026-03-14T10:00:00.000Z') });
        await feedbackModel.findByIdAndUpdate(otherFeedbackRes.body._id, { createdAt: new Date('2026-03-14T11:00:00.000Z') });

        const listRes = await request(app.getHttpServer())
            .get('/admin/feedback?limit=20')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(listRes.body.items).toHaveLength(2);
        expect(listRes.body.items[0]._id).toBe(otherFeedbackRes.body._id);
        const ownRow = listRes.body.items.find((item: { _id: string }) => item._id === ownFeedbackRes.body._id);
        const otherRow = listRes.body.items.find((item: { _id: string }) => item._id === otherFeedbackRes.body._id);
        expect(ownRow?.canManage).toBe(true);
        expect(otherRow?.canManage).toBe(false);

        const preferMineListRes = await request(app.getHttpServer())
            .get('/admin/feedback?limit=20&preferMine=true')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(preferMineListRes.body.items).toHaveLength(2);
        expect(preferMineListRes.body.items[0]._id).toBe(ownFeedbackRes.body._id);

        await request(app.getHttpServer())
            .patch(`/admin/feedback/${ownFeedbackRes.body._id as string}/status`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ status: 'resolved', resolvedMethod: '本人确认并记录解决方式' })
            .expect(200);

        await request(app.getHttpServer())
            .patch(`/admin/feedback/${otherFeedbackRes.body._id as string}/status`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ status: 'resolved', resolvedMethod: '越权尝试不应成功' })
            .expect(404);
    });

    it('developer 可查看全部反馈并更新负责游戏的反馈', async () => {
        const { adminToken, developerToken, userToken } = await seedUsers();

        const ownFeedbackRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'developer visible feedback',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
                actionLog: '[12:30] P1: trigger ability',
                clientContext: {
                    gameId: 'smashup',
                },
            })
            .expect(201);

        const otherFeedbackRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'developer hidden feedback',
                type: 'bug',
                severity: 'medium',
                gameName: 'tictactoe',
                actionLog: '[12:31] P1: trigger ability',
                clientContext: {
                    gameId: 'tictactoe',
                },
            })
            .expect(201);

        const ownFeedbackId = ownFeedbackRes.body._id as string;
        const otherFeedbackId = otherFeedbackRes.body._id as string;

        const listRes = await request(app.getHttpServer())
            .get('/admin/feedback?limit=20')
            .set('Authorization', `Bearer ${developerToken}`)
            .expect(200);

        expect(listRes.body.items).toHaveLength(2);
        const visibleIds = listRes.body.items.map((item: { _id: string }) => item._id);
        expect(visibleIds).toContain(ownFeedbackId);
        expect(visibleIds).toContain(otherFeedbackId);
        const ownRow = listRes.body.items.find((item: { _id: string }) => item._id === ownFeedbackId);
        const otherRow = listRes.body.items.find((item: { _id: string }) => item._id === otherFeedbackId);
        expect(ownRow?.canManage).toBe(true);
        expect(otherRow?.canManage).toBe(false);

        const updateRes = await request(app.getHttpServer())
            .patch(`/admin/feedback/${ownFeedbackId}/status`)
            .set('Authorization', `Bearer ${developerToken}`)
            .send({ status: 'resolved', resolvedMethod: '负责游戏已完成修复' })
            .expect(200);

        expect(updateRes.body.status).toBe('resolved');

        await request(app.getHttpServer())
            .patch(`/admin/feedback/${otherFeedbackId}/status`)
            .set('Authorization', `Bearer ${developerToken}`)
            .send({ status: 'resolved', resolvedMethod: '越权尝试不应成功' })
            .expect(404);

        const adminListRes = await request(app.getHttpServer())
            .get('/admin/feedback?limit=20')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const ownFeedback = adminListRes.body.items.find((item: { _id: string }) => item._id === ownFeedbackId);
        const otherFeedback = adminListRes.body.items.find((item: { _id: string }) => item._id === otherFeedbackId);
        expect(ownFeedback?.status).toBe('resolved');
        expect(otherFeedback?.status).toBe('open');
    });

    it('admin 列表支持严重程度筛选、分页，并返回调试上下文', async () => {
        const { adminToken, userToken } = await seedUsers();

        await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '低优先级反馈',
                type: 'other',
                severity: 'low',
                gameName: 'tictactoe',
            })
            .expect(201);

        await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '第一个严重问题',
                type: 'bug',
                severity: 'critical',
                gameName: 'smashup',
                actionLog: '[12:00] P1: cast card',
                clientContext: {
                    route: '/play/smashup/match/abc',
                    mode: 'online',
                    matchId: 'abc',
                    playerId: '0',
                    gameId: 'smashup',
                },
                errorContext: {
                    name: 'TypeError',
                    message: 'Cannot read properties of undefined',
                    source: 'react.error_boundary',
                },
            })
            .expect(201);

        await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '第二个严重问题',
                type: 'bug',
                severity: 'critical',
                gameName: 'smashup',
                actionLog: '[12:05] P1: trigger ability',
            })
            .expect(201);

        const listRes = await request(app.getHttpServer())
            .get('/admin/feedback?severity=critical&page=2&limit=1')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(listRes.body.total).toBe(2);
        expect(listRes.body.page).toBe(2);
        expect(listRes.body.limit).toBe(1);
        expect(listRes.body.items).toHaveLength(1);
        expect(listRes.body.items[0].content).toBe('第一个严重问题');
        expect(listRes.body.items[0].clientContext?.matchId).toBe('abc');
        expect(listRes.body.items[0].errorContext?.name).toBe('TypeError');
    });

    it('admin 列表支持 reporterType/source 过滤并兼容 legacy watchdog', async () => {
        const { adminToken } = await seedUsers();

        await request(app.getHttpServer())
            .post('/internal/feedback/system')
            .set('X-Internal-Feedback-Token', INTERNAL_FEEDBACK_TOKEN)
            .send({
                content: 'system watchdog',
                source: 'online-ai-watchdog',
                type: 'bug',
                severity: 'high',
            })
            .expect(201);

        await feedbackModel.collection.insertOne({
            content: '[system][online-ai-watchdog] legacy',
            type: 'bug',
            severity: 'high',
            contactInfo: 'system:online-ai-watchdog',
            errorContext: {
                source: 'online-ai-watchdog',
                name: 'unsatisfiable-interaction-auto-skipped',
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const listRes = await request(app.getHttpServer())
            .get('/admin/feedback?reporterType=system&source=online-ai-watchdog&limit=20')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(listRes.body.items).toHaveLength(2);
        const legacyItem = listRes.body.items.find((item: { content: string }) => item.content.includes('legacy'));
        expect(legacyItem?.reporterType).toBe('system');
        expect(legacyItem?.source).toBe('online-ai-watchdog');
    });

    it('admin 列表筛选 user 时应排除历史错标的公开自动反馈，并可按 system/source 查到', async () => {
        const { adminToken, userToken } = await seedUsers();

        await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '正常用户反馈',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
                source: 'feedback-modal',
            })
            .expect(201);

        await feedbackModel.collection.insertOne({
            content: '[auto][window.error] 历史错标样本',
            type: 'bug',
            severity: 'high',
            reporterType: 'user',
            source: 'client-window-error',
            autoReportKind: 'window-error',
            gameName: 'client',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const userListRes = await request(app.getHttpServer())
            .get('/admin/feedback?reporterType=user&limit=20')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(userListRes.body.items).toHaveLength(1);
        expect(userListRes.body.items[0].content).toBe('正常用户反馈');

        const systemListRes = await request(app.getHttpServer())
            .get('/admin/feedback?reporterType=system&source=client-window-error&limit=20')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(systemListRes.body.items).toHaveLength(1);
        expect(systemListRes.body.items[0].content).toBe('[auto][window.error] 历史错标样本');
        expect(systemListRes.body.items[0].reporterType).toBe('system');
        expect(systemListRes.body.items[0].source).toBe('client-window-error');
    });

    it('admin 列表支持按时间正序排序', async () => {
        const { adminToken, userToken } = await seedUsers();

        const olderRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'older feedback',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
                actionLog: '[11:00] older',
            })
            .expect(201);

        const newerRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'newer feedback',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
                actionLog: '[12:00] newer',
            })
            .expect(201);

        await feedbackModel.findByIdAndUpdate(olderRes.body._id, { createdAt: new Date('2026-03-14T10:00:00.000Z') });
        await feedbackModel.findByIdAndUpdate(newerRes.body._id, { createdAt: new Date('2026-03-14T11:00:00.000Z') });

        const listRes = await request(app.getHttpServer())
            .get('/admin/feedback?sort=oldest&limit=20')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(listRes.body.items).toHaveLength(2);
        expect(listRes.body.items[0].content).toBe('older feedback');
        expect(listRes.body.items[1].content).toBe('newer feedback');
    });

    it('bug 类型不附带 actionLog 或 stateSnapshot 也允许提交', async () => {
        const { userToken } = await seedUsers();

        const acceptedWithoutDiagnostic = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '缺少调试信息',
                type: 'bug',
                severity: 'high',
                gameName: 'smashup',
            })
            .expect(201);

        expect(acceptedWithoutDiagnostic.body.type).toBe('bug');
        expect(acceptedWithoutDiagnostic.body.actionLog).toBeUndefined();
        expect(acceptedWithoutDiagnostic.body.stateSnapshot).toBeUndefined();

        const accepted = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: '携带日志',
                type: 'bug',
                severity: 'high',
                gameName: 'smashup',
                actionLog: '[12:00] P1: cast card',
                clientContext: {
                    route: '/play/smashup/match/abc',
                    mode: 'online',
                    matchId: 'abc',
                    playerId: '0',
                    gameId: 'smashup',
                    appVersion: 'dev',
                    appCommitSha: 'abc123def456',
                    appBuildTime: '2026-06-19T10:00:00.000Z',
                    appReleaseChannel: 'production',
                    userAgent: 'vitest',
                    viewport: { width: 1280, height: 720 },
                    language: 'zh-CN',
                    timezone: 'Asia/Shanghai',
                    activeElement: {
                        tagName: 'button',
                        testId: 'confirm-play',
                        text: '确认出牌',
                    },
                    lastUserAction: {
                        type: 'click',
                        at: '2026-06-20T08:00:00.000Z',
                        target: {
                            tagName: 'button',
                            testId: 'confirm-play',
                        },
                    },
                    recentUserActions: [
                        {
                            type: 'pointerdown',
                            at: '2026-06-20T07:59:59.000Z',
                            target: { tagName: 'button', testId: 'confirm-play' },
                        },
                        {
                            type: 'click',
                            at: '2026-06-20T08:00:00.000Z',
                            target: { tagName: 'button', testId: 'confirm-play' },
                        },
                    ],
                    lastRouteChange: {
                        from: '/play/smashup/match/abc?seat=0',
                        to: '/play/smashup/match/abc?seat=0&step=confirm',
                        trigger: 'pushState',
                        at: '2026-06-20T08:00:01.000Z',
                    },
                    recentRouteChanges: [
                        {
                            to: '/play/smashup/match/abc?seat=0',
                            trigger: 'init',
                            at: '2026-06-20T07:59:58.000Z',
                        },
                        {
                            from: '/play/smashup/match/abc?seat=0',
                            to: '/play/smashup/match/abc?seat=0&step=confirm',
                            trigger: 'pushState',
                            at: '2026-06-20T08:00:01.000Z',
                        },
                    ],
                    pageFlags: {
                        isGamePage: true,
                        hasModalOpen: true,
                        gameId: 'smashup',
                        mobileLayoutPreset: 'board-shell',
                    },
                },
                errorContext: {
                    message: 'Cannot read properties of undefined',
                    name: 'TypeError',
                    stack: 'TypeError: ...',
                    source: 'react.error_boundary',
                    jsStack: 'TypeError: ...\n    at CardPanel',
                    componentStack: '\n    at CardPanel\n    at MatchRoomWithAudio',
                },
            })
            .expect(201);

        expect(accepted.body.type).toBe('bug');
        expect(accepted.body.actionLog).toContain('cast card');
        expect(accepted.body.clientContext?.matchId).toBe('abc');
        expect(accepted.body.clientContext?.appCommitSha).toBe('abc123def456');
        expect(accepted.body.clientContext?.appBuildTime).toBe('2026-06-19T10:00:00.000Z');
        expect(accepted.body.clientContext?.appReleaseChannel).toBe('production');
        expect(accepted.body.clientContext?.activeElement?.testId).toBe('confirm-play');
        expect(accepted.body.clientContext?.lastUserAction?.type).toBe('click');
        expect(accepted.body.clientContext?.recentUserActions).toHaveLength(2);
        expect(accepted.body.clientContext?.lastRouteChange?.trigger).toBe('pushState');
        expect(accepted.body.clientContext?.recentRouteChanges).toHaveLength(2);
        expect(accepted.body.clientContext?.pageFlags?.mobileLayoutPreset).toBe('board-shell');
        expect(accepted.body.errorContext?.name).toBe('TypeError');
        expect(accepted.body.errorContext?.jsStack).toContain('CardPanel');
        expect(accepted.body.errorContext?.componentStack).toContain('MatchRoomWithAudio');
    });

    it('admin 可删除单条反馈并批量删除命中的反馈', async () => {
        const { adminToken, userToken } = await seedUsers();

        const firstRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'delete-one',
                type: 'other',
                severity: 'low',
                gameName: 'tictactoe',
            })
            .expect(201);
        const secondRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'bulk-id-a',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
                actionLog: '[12:10] A',
            })
            .expect(201);
        const thirdRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'bulk-id-b',
                type: 'bug',
                severity: 'medium',
                gameName: 'smashup',
                actionLog: '[12:11] B',
            })
            .expect(201);
        const fourthRes = await request(app.getHttpServer())
            .post('/feedback')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                content: 'bulk-filter-target',
                type: 'bug',
                severity: 'high',
                gameName: 'smashup',
                actionLog: '[12:12] C',
            })
            .expect(201);

        const deleteOneRes = await request(app.getHttpServer())
            .delete(`/admin/feedback/${firstRes.body._id as string}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(deleteOneRes.body.ok).toBe(true);
        expect(await feedbackModel.countDocuments({ _id: firstRes.body._id })).toBe(0);

        const bulkDeleteRes = await request(app.getHttpServer())
            .post('/admin/feedback/bulk-delete')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ids: [secondRes.body._id, thirdRes.body._id] })
            .expect(201);

        expect(bulkDeleteRes.body).toMatchObject({
            requested: 2,
            deleted: 2,
        });
        expect(await feedbackModel.countDocuments({ _id: { $in: [secondRes.body._id, thirdRes.body._id] } })).toBe(0);

        const bulkFilterRes = await request(app.getHttpServer())
            .post('/admin/feedback/bulk-delete-by-filter')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ severity: 'high' })
            .expect(201);

        expect(bulkFilterRes.body).toMatchObject({
            requested: 1,
            deleted: 1,
        });
        expect(await feedbackModel.countDocuments({ _id: fourthRes.body._id })).toBe(0);
        expect(await feedbackModel.countDocuments({})).toBe(0);
    });
});
