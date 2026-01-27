import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Model } from 'mongoose';
import { AuthModule } from '../src/modules/auth/auth.module';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { ReviewModule } from '../src/modules/review/review.module';
import { Review, type ReviewDocument } from '../src/modules/review/schemas/review.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('Review Module (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let reviewModel: Model<ReviewDocument>;

    beforeAll(async () => {
        process.env.REVIEW_CONTENT_BLACKLIST = 'bad,违规';
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri),
                AuthModule,
                ReviewModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        reviewModel = moduleRef.get<Model<ReviewDocument>>(getModelToken(Review.name));
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
            reviewModel.deleteMany({}),
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

    it('评论创建/更新/删除流程', async () => {
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'reviewer', password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token as string;
        const gameId = 'dicethrone';

        const createRes = await request(app.getHttpServer())
            .post(`/auth/reviews/${gameId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ isPositive: true, content: '很好玩' })
            .expect(201);

        expect(createRes.body.review.isPositive).toBe(true);

        const statsRes = await request(app.getHttpServer())
            .get(`/auth/reviews/${gameId}/stats`)
            .expect(200);

        expect(statsRes.body.positive).toBe(1);
        expect(statsRes.body.negative).toBe(0);

        const updateRes = await request(app.getHttpServer())
            .post(`/auth/reviews/${gameId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ isPositive: false, content: '一般' })
            .expect(201);

        expect(updateRes.body.review.isPositive).toBe(false);

        const statsAfterUpdate = await request(app.getHttpServer())
            .get(`/auth/reviews/${gameId}/stats`)
            .expect(200);

        expect(statsAfterUpdate.body.positive).toBe(0);
        expect(statsAfterUpdate.body.negative).toBe(1);

        const listRes = await request(app.getHttpServer())
            .get(`/auth/reviews/${gameId}?page=1&limit=20`)
            .expect(200);

        expect(listRes.body.items.length).toBe(1);

        const mineRes = await request(app.getHttpServer())
            .get(`/auth/reviews/${gameId}/mine`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(mineRes.body.isPositive).toBe(false);

        await request(app.getHttpServer())
            .delete(`/auth/reviews/${gameId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const statsAfterDelete = await request(app.getHttpServer())
            .get(`/auth/reviews/${gameId}/stats`)
            .expect(200);

        expect(statsAfterDelete.body.total).toBe(0);
    });

    it('评论内容校验 - contentTooLong/contentBlocked', async () => {
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'reviewer-2', password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token as string;
        const gameId = 'dicethrone';

        await request(app.getHttpServer())
            .post(`/auth/reviews/${gameId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ isPositive: true, content: 'a'.repeat(501) })
            .expect(400);

        await request(app.getHttpServer())
            .post(`/auth/reviews/${gameId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ isPositive: true, content: 'bad content' })
            .expect(400);
    });

    it('未登录访问 - unauthorized', async () => {
        await request(app.getHttpServer())
            .get('/auth/reviews/dicethrone/mine')
            .expect(401);
    });
});
