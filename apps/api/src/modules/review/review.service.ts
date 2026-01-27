import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Cache } from 'cache-manager';
import type { Model, Types } from 'mongoose';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import type { ReviewResponseDto, ReviewUserDto } from './dtos/review-response.dto';
import { ContentFilterService } from './filters/content-filter.service';
import { Review, type ReviewDocument } from './schemas/review.schema';

const REVIEW_STATS_TTL_SECONDS = 300;
const REVIEW_STATS_KEY_PREFIX = 'review:stats:';

type ReviewStats = {
    gameId: string;
    positive: number;
    negative: number;
    total: number;
    rate: number;
};

type CreateReviewResult =
    | { ok: true; review: ReviewResponseDto }
    | { ok: false; code: 'contentTooLong' | 'contentBlocked' };

type DeleteReviewResult =
    | { ok: true }
    | { ok: false; code: 'notFound' };

type ReviewLean = {
    _id: Types.ObjectId;
    user: Types.ObjectId;
    isPositive: boolean;
    content?: string;
    createdAt: Date;
};

const isValidStats = (value: unknown): value is ReviewStats => {
    if (!value || typeof value !== 'object') return false;
    const stats = value as Record<string, unknown>;
    return (
        typeof stats.gameId === 'string'
        && typeof stats.positive === 'number'
        && typeof stats.negative === 'number'
        && typeof stats.total === 'number'
        && typeof stats.rate === 'number'
    );
};

@Injectable()
export class ReviewService {
    constructor(
        @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        @Inject(ContentFilterService) private readonly contentFilterService: ContentFilterService
    ) {}

    async getReviewList(gameId: string, page: number, limit: number) {
        const query = { gameId };
        const [reviews, total] = await Promise.all([
            this.reviewModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<ReviewLean[]>(),
            this.reviewModel.countDocuments(query),
        ]);

        if (!reviews.length) {
            return {
                items: [] as ReviewResponseDto[],
                page,
                limit,
                total,
                hasMore: false,
            };
        }

        const userIds = [...new Set(reviews.map(review => review.user.toString()))];
        const userMap = await this.buildUserMap(userIds);

        return {
            items: reviews.map(review => this.toReviewResponse(review, userMap.get(review.user.toString()) ?? null)),
            page,
            limit,
            total,
            hasMore: page * limit < total,
        };
    }

    async getReviewStats(gameId: string): Promise<ReviewStats> {
        const key = this.getStatsKey(gameId);
        const cached = await this.cacheManager.get<ReviewStats>(key);
        if (cached && isValidStats(cached)) {
            return cached;
        }

        const [positive, negative] = await Promise.all([
            this.reviewModel.countDocuments({ gameId, isPositive: true }),
            this.reviewModel.countDocuments({ gameId, isPositive: false }),
        ]);

        const total = positive + negative;
        const rate = total > 0 ? Math.round((positive / total) * 100) : 0;
        const stats: ReviewStats = { gameId, positive, negative, total, rate };

        await this.cacheManager.set(key, stats, REVIEW_STATS_TTL_SECONDS);
        return stats;
    }

    async getUserReview(gameId: string, userId: string): Promise<ReviewResponseDto | null> {
        const review = await this.reviewModel.findOne({ gameId, user: userId }).lean<ReviewLean | null>();
        if (!review) return null;
        const user = await this.getUserPreview(userId);
        return this.toReviewResponse(review, user);
    }

    async createOrUpdateReview(gameId: string, userId: string, isPositive: boolean, content?: string): Promise<CreateReviewResult> {
        const normalizedContent = this.normalizeContent(content);

        if (normalizedContent && normalizedContent.length > 500) {
            return { ok: false, code: 'contentTooLong' };
        }

        if (normalizedContent && !this.contentFilterService.validate(normalizedContent)) {
            return { ok: false, code: 'contentBlocked' };
        }

        let reviewDoc = await this.reviewModel.findOne({ gameId, user: userId });
        if (reviewDoc) {
            reviewDoc.isPositive = isPositive;
            reviewDoc.content = normalizedContent;
            reviewDoc = await reviewDoc.save();
        } else {
            reviewDoc = await this.reviewModel.create({
                gameId,
                user: userId,
                isPositive,
                content: normalizedContent,
            });
        }

        await this.clearStatsCache(gameId);

        const user = await this.getUserPreview(userId);
        const review = this.toReviewResponse(reviewDoc.toObject() as ReviewLean, user);
        return { ok: true, review };
    }

    async deleteReview(gameId: string, userId: string): Promise<DeleteReviewResult> {
        const review = await this.reviewModel.findOneAndDelete({ gameId, user: userId }).lean<ReviewLean | null>();
        if (!review) {
            return { ok: false, code: 'notFound' };
        }

        await this.clearStatsCache(gameId);
        return { ok: true };
    }

    private getStatsKey(gameId: string) {
        return `${REVIEW_STATS_KEY_PREFIX}${gameId}`;
    }

    private normalizeContent(content?: string) {
        const trimmed = content?.trim();
        return trimmed ? trimmed : undefined;
    }

    private async buildUserMap(userIds: string[]) {
        if (!userIds.length) return new Map<string, ReviewUserDto>();
        const users = await this.userModel
            .find({ _id: { $in: userIds } })
            .select('username avatar')
            .lean();
        return new Map(
            users.map(user => [user._id.toString(), {
                id: user._id.toString(),
                username: user.username,
                avatar: user.avatar ?? null,
            }])
        );
    }

    private async getUserPreview(userId: string): Promise<ReviewUserDto | null> {
        const user = await this.userModel.findById(userId).select('username avatar').lean();
        if (!user) return null;
        return {
            id: user._id.toString(),
            username: user.username,
            avatar: user.avatar ?? null,
        };
    }

    private toReviewResponse(review: ReviewLean, user: ReviewUserDto | null): ReviewResponseDto {
        return {
            id: review._id.toString(),
            user,
            isPositive: review.isPositive,
            content: review.content,
            createdAt: review.createdAt,
        };
    }

    private async clearStatsCache(gameId: string) {
        await this.cacheManager.del(this.getStatsKey(gameId));
    }
}
