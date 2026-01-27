import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { createRequestI18n } from '../../shared/i18n';
import { CreateReviewDto } from './dtos/create-review.dto';
import { ReviewListQueryDto } from './dtos/review-query.dto';
import { ReviewService } from './review.service';

@Controller('auth/reviews')
export class ReviewController {
    constructor(@Inject(ReviewService) private readonly reviewService: ReviewService) {}

    @Get(':gameId')
    async getReviewList(
        @Param('gameId') gameId: string,
        @Query() query: ReviewListQueryDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        const trimmedGameId = gameId.trim();
        if (!trimmedGameId) {
            return this.sendError(res, 400, t('review.error.missingGameId'));
        }
        const result = await this.reviewService.getReviewList(trimmedGameId, query.page, query.limit);
        return res.json(result);
    }

    @Get(':gameId/stats')
    async getReviewStats(@Param('gameId') gameId: string, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const trimmedGameId = gameId.trim();
        if (!trimmedGameId) {
            return this.sendError(res, 400, t('review.error.missingGameId'));
        }
        const stats = await this.reviewService.getReviewStats(trimmedGameId);
        return res.json(stats);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':gameId/mine')
    async getMyReview(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('gameId') gameId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const trimmedGameId = gameId.trim();
        if (!trimmedGameId) {
            return this.sendError(res, 400, t('review.error.missingGameId'));
        }
        const review = await this.reviewService.getUserReview(trimmedGameId, currentUser.userId);
        return res.json(review);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':gameId')
    async createOrUpdateReview(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('gameId') gameId: string,
        @Body() body: CreateReviewDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const trimmedGameId = gameId.trim();
        if (!trimmedGameId) {
            return this.sendError(res, 400, t('review.error.missingGameId'));
        }

        const result = await this.reviewService.createOrUpdateReview(
            trimmedGameId,
            currentUser.userId,
            body.isPositive,
            body.content
        );

        if (!result.ok) {
            const map: Record<string, { status: number; message: string }> = {
                contentTooLong: { status: 400, message: t('review.error.contentTooLong') },
                contentBlocked: { status: 400, message: t('review.error.contentBlocked') },
            };
            const payload = map[result.code];
            return this.sendError(res, payload.status, payload.message);
        }

        return res.status(201).json({ message: t('review.success.saved'), review: result.review });
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':gameId')
    async deleteReview(
        @CurrentUser() currentUser: { userId: string } | null,
        @Param('gameId') gameId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        const trimmedGameId = gameId.trim();
        if (!trimmedGameId) {
            return this.sendError(res, 400, t('review.error.missingGameId'));
        }
        const result = await this.reviewService.deleteReview(trimmedGameId, currentUser.userId);
        if (!result.ok) {
            return this.sendError(res, 404, t('review.error.notFound'));
        }
        return res.json({ message: t('review.success.deleted') });
    }

    private sendError(res: Response, status: number, message: string) {
        return res.status(status).json({ error: message });
    }
}
