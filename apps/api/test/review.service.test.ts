import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { ReviewModule } from '../src/modules/review/review.module';
import { ReviewService } from '../src/modules/review/review.service';
import { Review, type ReviewDocument } from '../src/modules/review/schemas/review.schema';

describe('ReviewService', () => {
    let mongo: MongoMemoryServer | null;
    let moduleRef: import('@nestjs/testing').TestingModule;
    let reviewService: ReviewService;
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

        moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri),
                ReviewModule,
            ],
        }).compile();

        await moduleRef.init();

        reviewService = moduleRef.get(ReviewService);
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        reviewModel = moduleRef.get<Model<ReviewDocument>>(getModelToken(Review.name));
    });

    beforeEach(async () => {
        await Promise.all([
            userModel.deleteMany({}),
            reviewModel.deleteMany({}),
        ]);
    });

    afterAll(async () => {
        if (moduleRef) {
            await moduleRef.close();
        }
        if (mongo) {
            await mongo.stop();
        }
    });

    it('创建与更新评论会刷新统计缓存', async () => {
        const user = await userModel.create({ username: 'tester', password: 'pass1234' });
        const gameId = 'dicethrone';

        const createResult = await reviewService.createOrUpdateReview(gameId, user._id.toString(), true, '好玩');
        expect(createResult.ok).toBe(true);

        const statsAfterCreate = await reviewService.getReviewStats(gameId);
        expect(statsAfterCreate.positive).toBe(1);

        const updateResult = await reviewService.createOrUpdateReview(gameId, user._id.toString(), false, '一般');
        expect(updateResult.ok).toBe(true);

        const statsAfterUpdate = await reviewService.getReviewStats(gameId);
        expect(statsAfterUpdate.positive).toBe(0);
        expect(statsAfterUpdate.negative).toBe(1);
    });

    it('内容过滤与长度限制', async () => {
        const user = await userModel.create({ username: 'tester2', password: 'pass1234' });
        const gameId = 'dicethrone';

        const tooLong = await reviewService.createOrUpdateReview(
            gameId,
            user._id.toString(),
            true,
            'a'.repeat(501)
        );
        expect(tooLong.ok).toBe(false);
        if (!tooLong.ok) {
            expect(tooLong.code).toBe('contentTooLong');
        }

        const blocked = await reviewService.createOrUpdateReview(
            gameId,
            user._id.toString(),
            true,
            'bad content'
        );
        expect(blocked.ok).toBe(false);
        if (!blocked.ok) {
            expect(blocked.code).toBe('contentBlocked');
        }
    });
});
