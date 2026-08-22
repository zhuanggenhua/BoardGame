import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Types, type Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { AdminAuditLog, type AdminAuditLogDocument } from '../src/modules/auth/schemas/admin-audit-log.schema';
import { AdminModule } from '../src/modules/admin/admin.module';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { Friend, type FriendDocument } from '../src/modules/friend/schemas/friend.schema';
import { Message, type MessageDocument } from '../src/modules/message/schemas/message.schema';
import { Review, type ReviewDocument } from '../src/modules/review/schemas/review.schema';
import { MatchRecord, type MatchRecordDocument } from '../src/modules/admin/schemas/match-record.schema';
import { ROOM_MATCH_MODEL_NAME, type RoomMatchDocument } from '../src/modules/admin/schemas/room-match.schema';
import { UgcPackage, type UgcPackageDocument } from '../src/modules/ugc/schemas/ugc-package.schema';
import { UgcAsset, type UgcAssetDocument } from '../src/modules/ugc/schemas/ugc-asset.schema';
import { AdminService } from '../src/modules/admin/admin.service';
import { GameChangelogModule } from '../src/modules/game-changelog/game-changelog.module';
import { GameChangelog, type GameChangelogDocument } from '../src/modules/game-changelog/game-changelog.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('AdminService stats aggregation', () => {
    it('应正确构建统计数据而不是把聚合结果错位到 todayMatches', async () => {
        const userModel = {
            countDocuments: vi
                .fn()
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(1),
        };
        const matchRecordModel = {
            countDocuments: vi
                .fn()
                .mockResolvedValueOnce(5)
                .mockResolvedValueOnce(2),
            aggregate: vi.fn().mockResolvedValue([{ _id: 'tictactoe', count: 5 }]),
        };
        const cacheManager = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            del: vi.fn().mockResolvedValue(undefined),
            store: {},
        };

        const service = new AdminService(
            userModel as never,
            {} as never,
            {} as never,
            {} as never,
            matchRecordModel as never,
            {} as never,
            {} as never,
            {} as never,
            cacheManager as never,
        );

        vi.spyOn(service as never, 'getOnlineUserIds').mockResolvedValue([]);
        vi.spyOn(service as never, 'countActiveUsers24h').mockResolvedValue(0);
        vi.spyOn(service as never, 'getGamePlayStats').mockResolvedValue([]);

        const stats = await service.getStats();

        expect(stats.totalUsers).toBe(2);
        expect(stats.todayUsers).toBe(2);
        expect(stats.bannedUsers).toBe(1);
        expect(stats.totalMatches).toBe(5);
        expect(stats.todayMatches).toBe(2);
        expect(stats.games).toEqual([{ name: 'tictactoe', count: 5 }]);
    });

    it('当游戏聚合结果异常为 undefined 时不应因 map 崩溃', async () => {
        const userModel = {
            countDocuments: vi
                .fn()
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(1)
                .mockResolvedValueOnce(0),
        };
        const matchRecordModel = {
            countDocuments: vi
                .fn()
                .mockResolvedValueOnce(3)
                .mockResolvedValueOnce(1),
            aggregate: vi.fn().mockResolvedValue(undefined),
        };
        const cacheManager = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            del: vi.fn().mockResolvedValue(undefined),
            store: {},
        };

        const service = new AdminService(
            userModel as never,
            {} as never,
            {} as never,
            {} as never,
            matchRecordModel as never,
            {} as never,
            {} as never,
            {} as never,
            cacheManager as never,
        );

        vi.spyOn(service as never, 'getOnlineUserIds').mockResolvedValue([]);
        vi.spyOn(service as never, 'countActiveUsers24h').mockResolvedValue(0);
        vi.spyOn(service as never, 'getGamePlayStats').mockResolvedValue([]);

        const stats = await service.getStats();

        expect(stats.totalUsers).toBe(2);
        expect(stats.todayUsers).toBe(1);
        expect(stats.bannedUsers).toBe(0);
        expect(stats.totalMatches).toBe(3);
        expect(stats.todayMatches).toBe(1);
        expect(stats.games).toEqual([]);
    });
});

// MongoDB 内存服务器在某些环境下启动很慢或超时，暂时跳过测试
// 如需运行这些测试，请移除下面的 .skip
describe('Admin Module (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let adminAuditModel: Model<AdminAuditLogDocument>;
    let matchRecordModel: Model<MatchRecordDocument>;
    let roomMatchModel: Model<RoomMatchDocument>;
    let friendModel: Model<FriendDocument>;
    let messageModel: Model<MessageDocument>;
    let reviewModel: Model<ReviewDocument>;
    let ugcPackageModel: Model<UgcPackageDocument>;
    let ugcAssetModel: Model<UgcAssetDocument>;
    let cacheManager: Cache;
    let authService: AuthService;
    const originalGameServerProxyTarget = process.env.GAME_SERVER_PROXY_TARGET;

    beforeAll(async () => {
        // e2e 仅验证当前测试库数据，避免被外部 game-server 实时房间污染断言。
        process.env.GAME_SERVER_PROXY_TARGET = 'http://127.0.0.1:1';
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_admin' } : undefined),
                AuthModule,
                AdminModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        adminAuditModel = moduleRef.get<Model<AdminAuditLogDocument>>(getModelToken(AdminAuditLog.name));
        authService = moduleRef.get<AuthService>(AuthService);
        matchRecordModel = moduleRef.get<Model<MatchRecordDocument>>(getModelToken(MatchRecord.name));
        roomMatchModel = moduleRef.get<Model<RoomMatchDocument>>(getModelToken(ROOM_MATCH_MODEL_NAME));
        friendModel = moduleRef.get<Model<FriendDocument>>(getModelToken(Friend.name));
        messageModel = moduleRef.get<Model<MessageDocument>>(getModelToken(Message.name));
        reviewModel = moduleRef.get<Model<ReviewDocument>>(getModelToken(Review.name));
        ugcPackageModel = moduleRef.get<Model<UgcPackageDocument>>(getModelToken(UgcPackage.name));
        ugcAssetModel = moduleRef.get<Model<UgcAssetDocument>>(getModelToken(UgcAsset.name));
        cacheManager = moduleRef.get<Cache>(CACHE_MANAGER);
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
            adminAuditModel.deleteMany({}),
            matchRecordModel.deleteMany({}),
            roomMatchModel.deleteMany({}),
            friendModel.deleteMany({}),
            messageModel.deleteMany({}),
            reviewModel.deleteMany({}),
            ugcPackageModel.deleteMany({}),
            ugcAssetModel.deleteMany({}),
        ]);
        await cacheManager.del('admin:stats');
        const store = cacheManager.store as { keys?: (pattern: string) => Promise<string[]> | string[] };
        if (store?.keys) {
            const keys = await Promise.resolve(store.keys('social:online:*'));
            if (Array.isArray(keys)) {
                await Promise.all(keys.map(key => cacheManager.del(key)));
            }
        }
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (mongo) {
            await mongo.stop();
        }
        if (originalGameServerProxyTarget === undefined) {
            delete process.env.GAME_SERVER_PROXY_TARGET;
        } else {
            process.env.GAME_SERVER_PROXY_TARGET = originalGameServerProxyTarget;
        }
    });

    const registerUser = async ({
        username,
        email,
        code,
        role = 'user',
    }: {
        username: string;
        email: string;
        code: string;
        role?: 'user' | 'developer' | 'admin';
    }) => {
        await authService.storeEmailCode(email, code);
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username, email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token as string;
        const userId = registerRes.body.user.id as string;

        if (role !== 'user') {
            await userModel.updateOne({ _id: userId }, { role });
        }

        return { token, userId, email };
    };

    const seedUsers = async () => {
        const admin = await registerUser({
            username: 'admin-user',
            email: 'admin-user@example.com',
            code: '123456',
            role: 'admin',
        });
        const user = await registerUser({
            username: 'player-a',
            email: 'player-a@example.com',
            code: '654321',
        });

        return {
            adminToken: admin.token,
            adminId: admin.userId,
            adminEmail: admin.email,
            userToken: user.token,
            userId: user.userId,
            userEmail: user.email,
        };
    };

    const seedMatch = async () => {
        const record = await matchRecordModel.create({
            matchID: 'match-1',
            gameName: 'tictactoe',
            players: [
                { id: '0', name: 'player-a', result: 'win' },
                { id: '1', name: 'player-b', result: 'loss' },
            ],
            winnerID: '0',
            endedAt: new Date(),
        });
        return record.matchID as string;
    };

    const seedRoom = async () => {
        const record = await roomMatchModel.create({
            matchID: 'room-1',
            gameName: 'tictactoe',
            metadata: {
                gameName: 'tictactoe',
                players: {
                    0: { id: 0, name: 'player-a', isConnected: true },
                    1: { id: 1, name: 'player-b', isConnected: false },
                },
                setupData: {
                    roomName: '测试房间',
                    ownerKey: 'user:test',
                    ownerType: 'user',
                    password: '1234',
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            state: {
                G: {
                    __setupData: {
                        roomName: '测试房间',
                        ownerKey: 'user:test',
                        ownerType: 'user',
                        password: '1234',
                    },
                },
            },
        });
        return record.matchID as string;
    };

    it('游客与普通用户可访问公开概览与对局只读接口', async () => {
        const { userToken } = await seedUsers();
        const matchID = await seedMatch();

        await request(app.getHttpServer())
            .get('/admin-api/stats')
            .expect(200);

        await request(app.getHttpServer())
            .get('/admin-api/stats/trend?days=7')
            .expect(200);

        await request(app.getHttpServer())
            .get('/admin-api/matches?limit=10')
            .expect(200);

        await request(app.getHttpServer())
            .get(`/admin-api/matches/${matchID}`)
            .expect(200);

        await request(app.getHttpServer())
            .get('/admin-api/stats')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);
    });

    it('developer 可访问概览统计，但不能访问管理员专属接口', async () => {
        const { adminToken } = await seedUsers();
        const matchID = await seedMatch();
        const developer = await registerUser({
            username: 'dev-overview',
            email: 'dev-overview@example.com',
            code: '223344',
            role: 'developer',
        });

        const statsRes = await request(app.getHttpServer())
            .get('/admin-api/stats')
            .set('Authorization', `Bearer ${developer.token}`)
            .expect(200);

        expect(statsRes.body.totalUsers).toBe(3);
        expect(statsRes.body.todayUsers).toBe(3);

        const trendRes = await request(app.getHttpServer())
            .get('/admin-api/stats/trend?days=7')
            .set('Authorization', `Bearer ${developer.token}`)
            .expect(200);

        expect(trendRes.body.days).toBe(7);
        expect(Array.isArray(trendRes.body.dailyUsers)).toBe(true);

        const matchesRes = await request(app.getHttpServer())
            .get('/admin-api/matches?limit=10')
            .set('Authorization', `Bearer ${developer.token}`)
            .expect(200);

        expect(matchesRes.body.total).toBe(1);

        const matchDetailRes = await request(app.getHttpServer())
            .get(`/admin-api/matches/${matchID}`)
            .set('Authorization', `Bearer ${developer.token}`)
            .expect(200);

        expect(matchDetailRes.body.matchID).toBe(matchID);

        await request(app.getHttpServer())
            .get('/admin-api/users?limit=10')
            .set('Authorization', `Bearer ${developer.token}`)
            .expect(403);

        await request(app.getHttpServer())
            .delete(`/admin-api/matches/${matchID}`)
            .set('Authorization', `Bearer ${developer.token}`)
            .expect(403);

        await request(app.getHttpServer())
            .get('/admin-api/stats')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
    });

    it('管理员统计/用户/对局查询', async () => {
        const { adminToken, userId } = await seedUsers();
        const matchID = await seedMatch();
        const roomID = await seedRoom();

        const statsRes = await request(app.getHttpServer())
            .get('/admin-api/stats')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(statsRes.body.totalUsers).toBe(2);
        expect(statsRes.body.todayUsers).toBe(2);
        expect(statsRes.body.totalMatches).toBe(1);
        expect(statsRes.body.todayMatches).toBe(1);
        expect(statsRes.body.bannedUsers).toBe(0);
        expect(statsRes.body.onlineUsers).toBe(0);
        expect(statsRes.body.activeUsers24h).toBe(0);

        const trendRes = await request(app.getHttpServer())
            .get('/admin-api/stats/trend?days=7')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(trendRes.body.days).toBe(7);
        expect(trendRes.body.dailyUsers.length).toBe(7);
        expect(trendRes.body.dailyMatches.length).toBe(7);
        expect(trendRes.body.dailyUsers.reduce((sum: number, item: { count: number }) => sum + item.count, 0)).toBe(2);
        expect(trendRes.body.dailyMatches.reduce((sum: number, item: { count: number }) => sum + item.count, 0)).toBe(1);

        const usersRes = await request(app.getHttpServer())
            .get('/admin-api/users?limit=10')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const player = usersRes.body.items.find((item: { username: string }) => item.username === 'player-a');
        expect(player?.matchCount).toBe(1);

        const detailRes = await request(app.getHttpServer())
            .get(`/admin-api/users/${userId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(detailRes.body.stats.totalMatches).toBe(1);
        expect(detailRes.body.stats.wins).toBe(1);
        expect(detailRes.body.recentMatches.length).toBe(1);

        const matchesRes = await request(app.getHttpServer())
            .get('/admin-api/matches?limit=10')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(matchesRes.body.total).toBe(1);

        const roomsRes = await request(app.getHttpServer())
            .get('/admin-api/rooms?limit=10')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(roomsRes.body.total).toBe(1);
        expect(roomsRes.body.items[0].matchID).toBe(roomID);
        expect(roomsRes.body.items[0].isLocked).toBe(true);

        await request(app.getHttpServer())
            .delete(`/admin-api/rooms/${roomID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const matchDetailRes = await request(app.getHttpServer())
            .get(`/admin-api/matches/${matchID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(matchDetailRes.body.matchID).toBe(matchID);
    });

    it('绠＄悊鍛樺彲浠ヨ幏鍙栫暀瀛樹笌娲昏穬鍒嗗眰缁熻', async () => {
        const now = Date.now();
        const { adminToken, adminId, userId } = await seedUsers();
        const retainedUser = await registerUser({
            username: 'retained-player',
            email: 'retained-player@example.com',
            code: '111111',
        });
        const silentUser = await registerUser({
            username: 'silent-player',
            email: 'silent-player@example.com',
            code: '222222',
        });
        const churnedUser = await registerUser({
            username: 'churned-player',
            email: 'churned-player@example.com',
            code: '333333',
        });
        const bannedUser = await registerUser({
            username: 'banned-player',
            email: 'banned-player@example.com',
            code: '444444',
        });

        await Promise.all([
            userModel.collection.updateOne({ _id: new Types.ObjectId(adminId) }, { $set: { lastOnline: new Date(now - 60 * 60 * 1000) } }),
            userModel.collection.updateOne({ _id: new Types.ObjectId(userId) }, { $set: { lastOnline: new Date(now - 24 * 60 * 60 * 1000) } }),
            userModel.collection.updateOne(
                { _id: new Types.ObjectId(retainedUser.userId) },
                {
                    $set: {
                        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
                        lastOnline: new Date(now - 24 * 60 * 60 * 1000),
                    },
                },
            ),
            userModel.collection.updateOne(
                { _id: new Types.ObjectId(silentUser.userId) },
                { $set: { lastOnline: new Date(now - 10 * 24 * 60 * 60 * 1000) } },
            ),
            userModel.collection.updateOne(
                { _id: new Types.ObjectId(churnedUser.userId) },
                { $set: { lastOnline: new Date(now - 40 * 24 * 60 * 60 * 1000) } },
            ),
            userModel.collection.updateOne(
                { _id: new Types.ObjectId(bannedUser.userId) },
                { $set: { banned: true, bannedAt: new Date(now - 2 * 60 * 60 * 1000) } },
            ),
        ]);

        const retentionRes = await request(app.getHttpServer())
            .get('/admin-api/stats/retention')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(retentionRes.body.items).toHaveLength(5);
        const retentionMap = new Map(
            retentionRes.body.items.map((item: { label: string; total: number; retained: number; rate: number }) => [item.label, item])
        );
        expect(retentionMap.get('次日留存')).toMatchObject({
            total: 1,
            retained: 1,
            rate: 1,
        });

        const activityRes = await request(app.getHttpServer())
            .get('/admin-api/stats/activity-tiers')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(activityRes.body.totalUsers).toBe(6);
        const tierMap = new Map(
            activityRes.body.tiers.map((item: { label: string; count: number }) => [item.label, item.count])
        );
        expect(tierMap.get('活跃')).toBe(3);
        expect(tierMap.get('沉默')).toBe(1);
        expect(tierMap.get('流失')).toBe(1);
        expect(tierMap.get('封禁')).toBe(1);
    });

    it('管理员可以更新用户角色并写入审计日志', async () => {
        const { adminToken, adminId, userId, userEmail } = await seedUsers();

        const promoteRes = await request(app.getHttpServer())
            .patch(`/admin-api/users/${userId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'admin' })
            .expect(200);

        expect(promoteRes.body.user.role).toBe('admin');
        expect(promoteRes.body.changed).toBe(true);

        const promotedUser = await userModel.findById(userId).lean();
        expect(promotedUser?.role).toBe('admin');

        const demoteRes = await request(app.getHttpServer())
            .patch(`/admin-api/users/${userId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'user' })
            .expect(200);

        expect(demoteRes.body.user.role).toBe('user');
        expect(demoteRes.body.changed).toBe(true);

        const logs = await adminAuditModel.find({ targetEmail: userEmail }).sort({ createdAt: 1 }).lean();
        expect(logs).toHaveLength(2);
        expect(logs.map(log => log.action)).toEqual(['change-role', 'change-role']);
        expect(logs.every(log => log.status === 'updated')).toBe(true);
        expect(logs.every(log => typeof log.message === 'string' && log.message.includes(`targetUserId=${userId}`))).toBe(true);

        await request(app.getHttpServer())
            .patch(`/admin-api/users/${adminId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'user' })
            .expect(400);
    });

    it('封禁/解封用户流程', async () => {
        const { adminToken, userId } = await seedUsers();

        const banRes = await request(app.getHttpServer())
            .post(`/admin-api/users/${userId}/ban`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ reason: '违规行为' })
            .expect(201);

        expect(banRes.body.user.banned).toBe(true);

        const unbanRes = await request(app.getHttpServer())
            .post(`/admin-api/users/${userId}/unban`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(unbanRes.body.user.banned).toBe(false);
    });

    it('封禁管理员 - cannotBanAdmin', async () => {
        const { adminToken, adminId } = await seedUsers();
        await request(app.getHttpServer())
            .post(`/admin-api/users/${adminId}/ban`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ reason: '测试' })
            .expect(400);
    });

    it('UGC 包列表/下架/删除', async () => {
        const { adminToken } = await seedUsers();
        const now = new Date();

        await ugcPackageModel.create([
            {
                packageId: 'ugc-pub-a',
                ownerId: 'user-a',
                name: '测试 UGC 包 A',
                status: 'published',
                publishedAt: now,
                manifest: { name: 'A' },
                gameId: 'ugc-game',
                version: '1.0.0',
            },
            {
                packageId: 'ugc-draft-b',
                ownerId: 'user-b',
                name: '测试 UGC 包 B',
                status: 'draft',
                publishedAt: null,
            },
        ]);

        await ugcAssetModel.create([
            {
                assetId: 'asset-1',
                packageId: 'ugc-pub-a',
                ownerId: 'user-a',
                type: 'image',
                originalFilename: 'cover.png',
                originalFormat: 'png',
                originalSize: 1024,
                uploadedAt: now.toISOString(),
                compressionStatus: 'completed',
            },
            {
                assetId: 'asset-2',
                packageId: 'ugc-pub-a',
                ownerId: 'user-a',
                type: 'json',
                originalFilename: 'manifest.json',
                originalFormat: 'json',
                originalSize: 2048,
                uploadedAt: now.toISOString(),
                compressionStatus: 'completed',
            },
        ]);

        const listRes = await request(app.getHttpServer())
            .get('/admin-api/ugc/packages?limit=10')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(listRes.body.total).toBe(2);
        expect(listRes.body.items.some((item: { packageId: string }) => item.packageId === 'ugc-pub-a')).toBe(true);

        const unpublishRes = await request(app.getHttpServer())
            .post('/admin-api/ugc/packages/ugc-pub-a/unpublish')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(unpublishRes.body.package.status).toBe('draft');
        expect(unpublishRes.body.package.publishedAt).toBeNull();

        const deleteDraftRes = await request(app.getHttpServer())
            .delete('/admin-api/ugc/packages/ugc-draft-b')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(deleteDraftRes.body.deleted).toBe(true);
        expect(deleteDraftRes.body.assetsDeleted).toBe(0);
        expect(await ugcPackageModel.findOne({ packageId: 'ugc-draft-b' })).toBeNull();

        const deletePubRes = await request(app.getHttpServer())
            .delete('/admin-api/ugc/packages/ugc-pub-a')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(deletePubRes.body.assetsDeleted).toBe(2);
        expect(await ugcPackageModel.findOne({ packageId: 'ugc-pub-a' })).toBeNull();
        expect(await ugcAssetModel.countDocuments({ packageId: 'ugc-pub-a' })).toBe(0);
    });

    it('对局/房间/用户删除与批量删除', async () => {
        const { adminToken, userId, adminId } = await seedUsers();

        const matchA = await matchRecordModel.create({
            matchID: 'match-bulk-a',
            gameName: 'tictactoe',
            players: [
                { id: '0', name: 'player-a', result: 'win' },
                { id: '1', name: 'player-b', result: 'loss' },
            ],
            winnerID: '0',
            endedAt: new Date(),
        });
        const matchB = await matchRecordModel.create({
            matchID: 'match-bulk-b',
            gameName: 'tictactoe',
            players: [
                { id: '0', name: 'player-a', result: 'win' },
                { id: '1', name: 'player-b', result: 'loss' },
            ],
            winnerID: '0',
            endedAt: new Date(),
        });

        await request(app.getHttpServer())
            .delete(`/admin-api/matches/${matchA.matchID}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(await matchRecordModel.findOne({ matchID: matchA.matchID })).toBeNull();

        await request(app.getHttpServer())
            .post('/admin-api/matches/bulk-delete')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ids: [matchB.matchID, 'missing'] })
            .expect(200);

        expect(await matchRecordModel.findOne({ matchID: matchB.matchID })).toBeNull();

        const roomA = await roomMatchModel.create({
            matchID: 'room-bulk-a',
            gameName: 'tictactoe',
            metadata: { setupData: { roomName: '批量房间 A' } },
            state: { G: { __setupData: { roomName: '批量房间 A' } } },
        });
        const roomB = await roomMatchModel.create({
            matchID: 'room-bulk-b',
            gameName: 'tictactoe',
            metadata: { setupData: { roomName: '批量房间 B' } },
            state: { G: { __setupData: { roomName: '批量房间 B' } } },
        });
        const roomC = await roomMatchModel.create({
            matchID: 'room-bulk-c',
            gameName: 'dicethrone',
            metadata: { setupData: { roomName: '批量房间 C' } },
            state: { G: { __setupData: { roomName: '批量房间 C' } } },
        });

        await request(app.getHttpServer())
            .post('/admin-api/rooms/bulk-delete')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ids: [roomA.matchID, roomB.matchID] })
            .expect(200);

        expect(await roomMatchModel.findOne({ matchID: roomA.matchID })).toBeNull();
        expect(await roomMatchModel.findOne({ matchID: roomB.matchID })).toBeNull();

        await request(app.getHttpServer())
            .post('/admin-api/rooms/bulk-delete-by-filter')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ gameName: 'dicethrone' })
            .expect(200);

        expect(await roomMatchModel.findOne({ matchID: roomC.matchID })).toBeNull();

        const bulkUserRes = await request(app.getHttpServer())
            .post('/admin-api/users/bulk-delete')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ids: [userId, adminId, 'invalid-id'] })
            .expect(200);

        expect(bulkUserRes.body.deleted).toBe(1);
        expect(bulkUserRes.body.skipped?.length).toBe(2);
        expect(await userModel.findById(userId)).toBeNull();
        expect(await userModel.findById(adminId)).not.toBeNull();
    });

    it('删除用户 - 级联清理', async () => {
        const { adminToken, adminId, userId } = await seedUsers();
        await friendModel.create({ user: adminId, friend: userId, status: 'accepted' });
        await messageModel.create({ from: adminId, to: userId, content: 'hi', type: 'text' });
        await reviewModel.create({ user: userId, gameId: 'tictactoe', isPositive: true, content: '好玩' });
        await matchRecordModel.create({
            matchID: 'match-delete',
            gameName: 'tictactoe',
            players: [
                { id: '0', name: 'player-a', result: 'win' },
                { id: '1', name: 'player-b', result: 'loss' },
            ],
            winnerID: '0',
            endedAt: new Date(),
        });

        await request(app.getHttpServer())
            .delete(`/admin-api/users/${userId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const [user, friendCount, messageCount, reviewCount, match] = await Promise.all([
            userModel.findById(userId).lean(),
            friendModel.countDocuments({ $or: [{ user: adminId }, { friend: userId }] }),
            messageModel.countDocuments({ $or: [{ from: adminId }, { to: userId }] }),
            reviewModel.countDocuments({ user: userId }),
            matchRecordModel.findOne({ matchID: 'match-delete' }).lean(),
        ]);

        expect(user).toBeNull();
        expect(friendCount).toBe(0);
        expect(messageCount).toBe(0);
        expect(reviewCount).toBe(0);
        expect(
            match?.players?.some(player => player.ownerKey === `deleted:${userId}` && player.name !== 'player-a')
        ).toBe(true);

        await request(app.getHttpServer())
            .delete(`/admin-api/users/${adminId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(400);
    });
});

describe('Admin user role update (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let adminAuditModel: Model<AdminAuditLogDocument>;
    let authService: AuthService;

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_admin_role' } : undefined),
                AuthModule,
                AdminModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        adminAuditModel = moduleRef.get<Model<AdminAuditLogDocument>>(getModelToken(AdminAuditLog.name));
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
            adminAuditModel.deleteMany({}),
        ]);
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (mongo) {
            await mongo.stop();
        }
    });

    const seedUsers = async () => {
        const adminEmail = 'admin-role@example.com';
        const adminCode = '123456';
        await authService.storeEmailCode(adminEmail, adminCode);
        const adminRegister = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'admin-role', email: adminEmail, code: adminCode, password: 'pass1234' })
            .expect(201);

        const adminToken = adminRegister.body.token as string;
        const adminId = adminRegister.body.user.id as string;
        await userModel.updateOne({ _id: adminId }, { role: 'admin' });

        const userEmail = 'player-role@example.com';
        const userCode = '654321';
        await authService.storeEmailCode(userEmail, userCode);
        const userRegister = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'player-role', email: userEmail, code: userCode, password: 'pass1234' })
            .expect(201);

        return {
            adminToken,
            adminId,
            adminEmail,
            userToken: userRegister.body.token as string,
            userId: userRegister.body.user.id as string,
            userEmail,
        };
    };

    it('更新用户角色并写入审计日志', async () => {
        const { adminToken, adminId, adminEmail, userId, userEmail } = await seedUsers();

        const promoteRes = await request(app.getHttpServer())
            .patch(`/admin-api/users/${userId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'admin' })
            .expect(200);

        expect(promoteRes.body.user.role).toBe('admin');
        expect(promoteRes.body.changed).toBe(true);
        expect((await userModel.findById(userId).lean())?.role).toBe('admin');

        const demoteRes = await request(app.getHttpServer())
            .patch(`/admin-api/users/${userId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'user' })
            .expect(200);

        expect(demoteRes.body.user.role).toBe('user');
        expect(demoteRes.body.changed).toBe(true);

        await request(app.getHttpServer())
            .patch(`/admin-api/users/${adminId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'user' })
            .expect(400);

        const logs = await adminAuditModel
            .find({ targetEmail: { $in: [userEmail, adminEmail] } })
            .sort({ createdAt: 1 })
            .lean();

        expect(logs.map(log => log.action)).toEqual(['change-role', 'change-role', 'change-role']);
        expect(logs.map(log => log.status)).toEqual(['updated', 'updated', 'failed']);
        expect(logs[0]?.targetEmail).toBe(userEmail);
        expect(logs[2]?.targetEmail).toBe(adminEmail);
        expect(logs[2]?.message).toContain('self_role_change_forbidden');
    });

    it('可将用户设置为 developer 并保存多个游戏', async () => {
        const { adminToken, userId, userEmail } = await seedUsers();

        const updateRes = await request(app.getHttpServer())
            .patch(`/admin-api/users/${userId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                role: 'developer',
                developerGameIds: ['smashup', 'dicethrone', 'smashup'],
            })
            .expect(200);

        expect(updateRes.body.user.role).toBe('developer');
        expect(updateRes.body.user.developerGameIds).toEqual(['smashup', 'dicethrone']);
        expect(updateRes.body.changed).toBe(true);

        const updatedUser = await userModel.findById(userId).lean();
        expect(updatedUser?.role).toBe('developer');
        expect(updatedUser?.developerGameIds).toEqual(['smashup', 'dicethrone']);

        const logs = await adminAuditModel.find({ targetEmail: userEmail }).sort({ createdAt: 1 }).lean();
        expect(logs.at(-1)?.action).toBe('change-role');
        expect(logs.at(-1)?.status).toBe('updated');
        expect(logs.at(-1)?.message).toContain('developerGameIds=smashup,dicethrone');
    });

    it('将用户设置为 developer 但不分配游戏会被拒绝', async () => {
        const { adminToken, userId, userEmail } = await seedUsers();

        await request(app.getHttpServer())
            .patch(`/admin-api/users/${userId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                role: 'developer',
                developerGameIds: [],
            })
            .expect(400);

        const updatedUser = await userModel.findById(userId).lean();
        expect(updatedUser?.role).toBe('user');
        expect(updatedUser?.developerGameIds ?? []).toEqual([]);

        const logs = await adminAuditModel.find({ targetEmail: userEmail }).sort({ createdAt: 1 }).lean();
        expect(logs.at(-1)?.action).toBe('change-role');
        expect(logs.at(-1)?.status).toBe('failed');
        expect(logs.at(-1)?.message).toContain('developer_games_required');
    });

    it('并发互相降权时仍会保留至少一名管理员', async () => {
        const { adminToken, adminId, userToken, userId } = await seedUsers();
        await userModel.updateOne({ _id: userId }, { role: 'admin' });

        const [demotePeer, demoteActor] = await Promise.all([
            request(app.getHttpServer())
                .patch(`/admin-api/users/${userId}/role`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'user' }),
            request(app.getHttpServer())
                .patch(`/admin-api/users/${adminId}/role`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ role: 'user' }),
        ]);

        const statuses = [demotePeer.status, demoteActor.status].sort((a, b) => a - b);
        expect(statuses).toEqual([200, 400]);
        expect(await userModel.countDocuments({ role: 'admin' })).toBe(1);

        const revokeLogs = await adminAuditModel
            .find({ action: 'change-role' })
            .sort({ createdAt: 1 })
            .lean();

        expect(revokeLogs).toHaveLength(2);
        expect(revokeLogs.map((log) => log.status).sort()).toEqual(['failed', 'updated']);
        expect(revokeLogs.some((log) => log.message?.includes('must_keep_one_admin'))).toBe(true);
    });
});

describe('Game changelog access (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let changelogModel: Model<GameChangelogDocument>;
    let authService: AuthService;

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_game_changelog' } : undefined),
                AuthModule,
                AdminModule,
                GameChangelogModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        changelogModel = moduleRef.get<Model<GameChangelogDocument>>(getModelToken(GameChangelog.name));
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
            changelogModel.deleteMany({}),
        ]);
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (mongo) {
            await mongo.stop();
        }
    });

    const seedBackofficeUsers = async () => {
        const adminEmail = 'admin-changelog@example.com';
        const developerEmail = 'developer-changelog@example.com';

        await authService.storeEmailCode(adminEmail, '123456');
        const adminRegister = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'admin-changelog', email: adminEmail, code: '123456', password: 'pass1234' })
            .expect(201);
        await userModel.updateOne({ _id: adminRegister.body.user.id }, { role: 'admin' });

        await authService.storeEmailCode(developerEmail, '654321');
        const developerRegister = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'developer-changelog', email: developerEmail, code: '654321', password: 'pass1234' })
            .expect(201);
        await userModel.updateOne(
            { _id: developerRegister.body.user.id },
            {
                role: 'developer',
                developerGameIds: ['smashup', 'dicethrone'],
            }
        );

        return {
            adminId: adminRegister.body.user.id as string,
            developerToken: developerRegister.body.token as string,
        };
    };

    it('developer 只能读取并管理自己被分配的游戏', async () => {
        const { adminId, developerToken } = await seedBackofficeUsers();
        const now = new Date();

        await changelogModel.create([
            {
                gameId: 'smashup',
                title: 'Smash Up 更新',
                content: '开发者可见',
                published: false,
                pinned: false,
                publishedAt: null,
                createdBy: adminId,
                updatedBy: adminId,
                createdAt: now,
                updatedAt: now,
            },
            {
                gameId: 'tictactoe',
                title: '井字棋更新',
                content: '开发者不可见',
                published: false,
                pinned: false,
                publishedAt: null,
                createdBy: adminId,
                updatedBy: adminId,
                createdAt: now,
                updatedAt: now,
            },
        ]);

        const listRes = await request(app.getHttpServer())
            .get('/admin-api/game-changelogs')
            .set('Authorization', `Bearer ${developerToken}`)
            .expect(200);

        expect(listRes.body.availableGameIds).toEqual(['smashup', 'dicethrone']);
        expect(listRes.body.items).toHaveLength(1);
        expect(listRes.body.items[0]?.gameId).toBe('smashup');

        await request(app.getHttpServer())
            .post('/admin-api/game-changelogs')
            .set('Authorization', `Bearer ${developerToken}`)
            .send({
                gameId: 'tictactoe',
                title: '越权更新',
                content: '不应成功',
            })
            .expect(403);

        const forbiddenTarget = await changelogModel.findOne({ gameId: 'tictactoe' }).lean();
        expect(forbiddenTarget?._id).toBeDefined();

        await request(app.getHttpServer())
            .put(`/admin-api/game-changelogs/${forbiddenTarget!._id.toString()}`)
            .set('Authorization', `Bearer ${developerToken}`)
            .send({
                title: '越权修改',
            })
            .expect(403);

        await request(app.getHttpServer())
            .delete(`/admin-api/game-changelogs/${forbiddenTarget!._id.toString()}`)
            .set('Authorization', `Bearer ${developerToken}`)
            .expect(403);

        const createRes = await request(app.getHttpServer())
            .post('/admin-api/game-changelogs')
            .set('Authorization', `Bearer ${developerToken}`)
            .send({
                gameId: 'dicethrone',
                title: 'Dice Throne 更新',
                versionLabel: 'v1.0.0',
                content: '开发者可创建',
                published: true,
            })
            .expect(201);

        expect(createRes.body.changelog.gameId).toBe('dicethrone');
        expect(createRes.body.changelog.published).toBe(true);
    });

    it('公开接口只返回已发布的游戏更新日志', async () => {
        const { adminId } = await seedBackofficeUsers();
        const now = new Date();

        await changelogModel.create([
            {
                gameId: 'smashup',
                title: '已发布日志',
                content: '前台可见',
                published: true,
                pinned: true,
                publishedAt: now,
                createdBy: adminId,
                updatedBy: adminId,
                createdAt: now,
                updatedAt: now,
            },
            {
                gameId: 'smashup',
                title: '草稿日志',
                content: '前台不可见',
                published: false,
                pinned: false,
                publishedAt: null,
                createdBy: adminId,
                updatedBy: adminId,
                createdAt: now,
                updatedAt: now,
            },
        ]);

        const res = await request(app.getHttpServer())
            .get('/game-changelogs/smashup')
            .expect(200);

        expect(res.body.changelogs).toHaveLength(1);
        expect(res.body.changelogs[0]?.title).toBe('已发布日志');
    });
});

describe('AdminService.getRooms compatibility', () => {
    it('merges live room snapshots with persisted fallback data', async () => {
        const validOwnerId = new Types.ObjectId().toString();
        const ownerLean = vi.fn().mockResolvedValue([
            { _id: new Types.ObjectId(validOwnerId), username: 'owner-user' },
        ]);
        const ownerSelect = vi.fn().mockReturnValue({ lean: ownerLean });
        const userFind = vi.fn().mockReturnValue({ select: ownerSelect });
        const roomMatchLean = vi.fn().mockResolvedValue([
            {
                matchID: 'legacy-room',
                gameName: 'tictactoe',
                metadata: {
                    players: { '0': { name: 'legacy-player' } },
                    setupData: {
                        roomName: 'legacy-room',
                        ownerKey: { legacy: true } as unknown as string,
                    },
                },
                state: null,
                createdAt: new Date('2026-03-20T10:00:00.000Z'),
                updatedAt: new Date('2026-03-20T10:30:00.000Z'),
            },
        ]);
        const roomMatchSelect = vi.fn().mockReturnValue({ lean: roomMatchLean });
        const roomMatchFind = vi.fn().mockReturnValue({ select: roomMatchSelect });
        const cacheManager = {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
        };
        const now = Date.now();
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    items: [
                        {
                            matchID: 'good-room',
                            gameName: 'tictactoe',
                            players: [{ id: 0, name: 'good-player', isConnected: true }],
                            roomName: 'good-room',
                            ownerKey: `user:${validOwnerId}`,
                            ownerType: 'user',
                            isLocked: false,
                            createdAt: now - 5000,
                            updatedAt: now,
                        },
                    ],
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            ),
        );

        try {
            const service = new AdminService(
                { find: userFind } as unknown as Model<UserDocument>,
                {} as Model<FriendDocument>,
                {} as Model<MessageDocument>,
                {} as Model<ReviewDocument>,
                {} as Model<MatchRecordDocument>,
                { find: roomMatchFind } as unknown as Model<RoomMatchDocument>,
                {} as Model<UgcPackageDocument>,
                {} as Model<UgcAssetDocument>,
                cacheManager as unknown as Cache,
            );

            const result = await service.getRooms({ page: 1, limit: 10 } as never);

            expect(result.total).toBe(2);
            expect(result.items.map(item => item.matchID)).toEqual(['good-room', 'legacy-room']);
            expect(result.items[0].ownerName).toBe('owner-user');
            expect(result.items[1].ownerName).toBeUndefined();
            expect(userFind).toHaveBeenCalledTimes(1);
            expect(roomMatchFind).toHaveBeenCalledWith({});
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(String(fetchSpy.mock.calls[0]?.[0] ?? '')).toContain('/internal/rooms');
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('falls back to persisted room records when game-server is unavailable', async () => {
        const cacheManager = {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
        };
        const roomMatchLean = vi.fn().mockResolvedValue([
            {
                matchID: 'mongo-room',
                gameName: 'smashup',
                metadata: {
                    players: {
                        '0': { name: 'mongo-player', isConnected: false },
                    },
                    setupData: {
                        roomName: 'mongo fallback room',
                    },
                },
                state: null,
                createdAt: new Date('2026-03-20T10:00:00.000Z'),
                updatedAt: new Date('2026-03-20T11:00:00.000Z'),
            },
        ]);
        const roomMatchSelect = vi.fn().mockReturnValue({ lean: roomMatchLean });
        const roomMatchFind = vi.fn().mockReturnValue({ select: roomMatchSelect });
        const userLean = vi.fn().mockResolvedValue([]);
        const userSelect = vi.fn().mockReturnValue({ lean: userLean });
        const userFind = vi.fn().mockReturnValue({ select: userSelect });
        const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));

        try {
            const service = new AdminService(
                { find: userFind } as unknown as Model<UserDocument>,
                {} as Model<FriendDocument>,
                {} as Model<MessageDocument>,
                {} as Model<ReviewDocument>,
                {} as Model<MatchRecordDocument>,
                { find: roomMatchFind } as unknown as Model<RoomMatchDocument>,
                {} as Model<UgcPackageDocument>,
                {} as Model<UgcAssetDocument>,
                cacheManager as unknown as Cache,
            );

            const result = await service.getRooms({ page: 1, limit: 10 } as never);

            expect(result.total).toBe(1);
            expect(result.items.map(item => item.matchID)).toEqual(['mongo-room']);
            expect(roomMatchFind).toHaveBeenCalledWith({});
        } finally {
            fetchSpy.mockRestore();
        }
    });
});
