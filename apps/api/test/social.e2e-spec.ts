import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { FriendModule } from '../src/modules/friend/friend.module';
import { Friend, type FriendDocument } from '../src/modules/friend/schemas/friend.schema';
import { InviteModule } from '../src/modules/invite/invite.module';
import { MessageModule } from '../src/modules/message/message.module';
import { Message, type MessageDocument } from '../src/modules/message/schemas/message.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('Social Modules (e2e)', () => {

    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let friendModel: Model<FriendDocument>;
    let messageModel: Model<MessageDocument>;
    let authService: AuthService;

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缂哄皯 MongoDB 杩炴帴鍦板潃锛岃閰嶇疆 MONGO_URI 鎴栧惎鐢ㄥ唴瀛?MongoDB');
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_social' } : undefined),
                AuthModule,
                FriendModule,
                MessageModule,
                InviteModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        friendModel = moduleRef.get<Model<FriendDocument>>(getModelToken(Friend.name));
        messageModel = moduleRef.get<Model<MessageDocument>>(getModelToken(Message.name));
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
            friendModel.deleteMany({}),
            messageModel.deleteMany({}),
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

    const registerUser = async ({
        username,
        email,
        code,
    }: {
        username: string;
        email: string;
        code: string;
    }) => {
        await authService.storeEmailCode(email, code);
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username, email, code, password: 'pass1234' })
            .expect(201);

        return {
            token: registerRes.body.token as string,
            userId: registerRes.body.user.id as string,
        };
    };

    it('好友请求、消息与邀请流程', async () => {
        const registerA = await registerUser({
            username: 'alice',
            email: 'alice@example.com',
            code: '123456',
        });
        const registerB = await registerUser({
            username: 'bob',
            email: 'bob@example.com',
            code: '654321',
        });

        const tokenA = registerA.token;
        const tokenB = registerB.token;
        const userAId = registerA.userId;
        const userBId = registerB.userId;

        const requestRes = await request(app.getHttpServer())
            .post('/auth/friends/request')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ userId: userBId })
            .expect(201);

        const requestId = requestRes.body.request.id as string;
        expect(requestId).toBeDefined();

        const pendingRes = await request(app.getHttpServer())
            .get('/auth/friends/requests')
            .set('Authorization', `Bearer ${tokenB}`)
            .expect(200);

        expect(pendingRes.body.requests.length).toBe(1);

        await request(app.getHttpServer())
            .post(`/auth/friends/accept/${requestId}`)
            .set('Authorization', `Bearer ${tokenB}`)
            .expect(201);

        const friendListRes = await request(app.getHttpServer())
            .get('/auth/friends')
            .set('Authorization', `Bearer ${tokenA}`)
            .expect(200);

        const friendIds = friendListRes.body.friends.map((item: { id: string }) => item.id);
        expect(friendIds).toContain(userBId);

        await request(app.getHttpServer())
            .post('/auth/messages/send')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ toUserId: userBId, content: 'hello' })
            .expect(201);

        const conversationsRes = await request(app.getHttpServer())
            .get('/auth/messages/conversations')
            .set('Authorization', `Bearer ${tokenB}`)
            .expect(200);

        expect(conversationsRes.body.conversations.length).toBe(1);
        expect(conversationsRes.body.conversations[0].user.id).toBe(userAId);

        const historyRes = await request(app.getHttpServer())
            .get(`/auth/messages/${userAId}`)
            .set('Authorization', `Bearer ${tokenB}`)
            .expect(200);

        expect(historyRes.body.messages.length).toBeGreaterThan(0);

        await request(app.getHttpServer())
            .post(`/auth/messages/read/${userAId}`)
            .set('Authorization', `Bearer ${tokenB}`)
            .expect(201);

        await request(app.getHttpServer())
            .post('/auth/invites/send')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ toUserId: userBId, matchId: 'match-1', gameName: 'tictactoe' })
            .expect(201);
    });

    it('好友搜索可反映待处理、拒绝和删除好友状态', async () => {
        const alice = await registerUser({
            username: 'alice-search',
            email: 'alice-search@example.com',
            code: '111111',
        });
        const bob = await registerUser({
            username: 'bob-search',
            email: 'bob-search@example.com',
            code: '222222',
        });
        await registerUser({
            username: 'charlie-search',
            email: 'charlie-search@example.com',
            code: '333333',
        });

        const initialSearchRes = await request(app.getHttpServer())
            .get('/auth/friends/search?q=bob')
            .set('Authorization', `Bearer ${alice.token}`)
            .expect(200);

        expect(initialSearchRes.body.users).toEqual([
            expect.objectContaining({
                id: bob.userId,
                username: 'bob-search',
                status: 'none',
            }),
        ]);

        await request(app.getHttpServer())
            .post('/auth/friends/request')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({ userId: bob.userId })
            .expect(201);

        const incomingSearchRes = await request(app.getHttpServer())
            .get('/auth/friends/search?q=alice')
            .set('Authorization', `Bearer ${bob.token}`)
            .expect(200);

        expect(incomingSearchRes.body.users).toEqual([
            expect.objectContaining({
                id: alice.userId,
                username: 'alice-search',
                status: 'incoming',
            }),
        ]);

        const pendingBeforeReject = await request(app.getHttpServer())
            .get('/auth/friends/requests')
            .set('Authorization', `Bearer ${bob.token}`)
            .expect(200);

        expect(pendingBeforeReject.body.requests).toHaveLength(1);
        const rejectedRequestId = pendingBeforeReject.body.requests[0].id as string;

        await request(app.getHttpServer())
            .post(`/auth/friends/reject/${rejectedRequestId}`)
            .set('Authorization', `Bearer ${bob.token}`)
            .expect(201);

        const searchAfterReject = await request(app.getHttpServer())
            .get('/auth/friends/search?q=bob')
            .set('Authorization', `Bearer ${alice.token}`)
            .expect(200);

        expect(searchAfterReject.body.users).toEqual([
            expect.objectContaining({
                id: bob.userId,
                status: 'none',
            }),
        ]);

        await request(app.getHttpServer())
            .post('/auth/friends/request')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({ userId: bob.userId })
            .expect(201);

        const pendingBeforeAccept = await request(app.getHttpServer())
            .get('/auth/friends/requests')
            .set('Authorization', `Bearer ${bob.token}`)
            .expect(200);

        const acceptedRequestId = pendingBeforeAccept.body.requests[0].id as string;
        await request(app.getHttpServer())
            .post(`/auth/friends/accept/${acceptedRequestId}`)
            .set('Authorization', `Bearer ${bob.token}`)
            .expect(201);

        const acceptedSearchRes = await request(app.getHttpServer())
            .get('/auth/friends/search?q=bob')
            .set('Authorization', `Bearer ${alice.token}`)
            .expect(200);

        expect(acceptedSearchRes.body.users).toEqual([
            expect.objectContaining({
                id: bob.userId,
                status: 'accepted',
            }),
        ]);

        await request(app.getHttpServer())
            .delete(`/auth/friends/${bob.userId}`)
            .set('Authorization', `Bearer ${alice.token}`)
            .expect(200);

        const friendListAfterDelete = await request(app.getHttpServer())
            .get('/auth/friends')
            .set('Authorization', `Bearer ${alice.token}`)
            .expect(200);

        expect(friendListAfterDelete.body.friends).toHaveLength(0);

        const searchAfterDelete = await request(app.getHttpServer())
            .get('/auth/friends/search?q=bob')
            .set('Authorization', `Bearer ${alice.token}`)
            .expect(200);

        expect(searchAfterDelete.body.users).toEqual([
            expect.objectContaining({
                id: bob.userId,
                status: 'none',
            }),
        ]);
    });
});
