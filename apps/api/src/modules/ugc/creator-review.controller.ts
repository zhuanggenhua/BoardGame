import { Body, Controller, Get, Inject, Param, Post, Put, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { Roles } from '../admin/guards/roles.decorator';
import { CreatorClaimsService } from './creator-claims.service';
import { GameSubmissionsService } from './game-submissions.service';
import { ExternalGamesService } from './external-games.service';
import { CheckEmbedDto, ReviewCreatorClaimDto, ReviewSubmissionDto } from './dtos/external-game.dto';
import { claimResponse } from './creator-claims.controller';

@Controller('ugc/creator-review')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('admin')
export class CreatorReviewController {
    constructor(@Inject(CreatorClaimsService) private readonly claims: CreatorClaimsService,
        @Inject(GameSubmissionsService) private readonly submissions: GameSubmissionsService,
        @Inject(ExternalGamesService) private readonly games: ExternalGamesService) {}
    @Get() async queue() {
        return { claims: (await this.claims.pending()).map(({ record, applicantName }) => ({ ...claimResponse(record), applicantName })), submissions: await this.submissions.pending(), games: await this.games.listForReview() };
    }
    @Post('claims/:id')
    async claim(@CurrentUser() user: { userId: string }, @Param('id') id: string,
        @Body(new ValidationPipe({ whitelist: true, transform: true, expectedType: ReviewCreatorClaimDto })) data: ReviewCreatorClaimDto) {
        return claimResponse(await this.claims.review(user.userId, id, data));
    }
    @Get('claims/:id/evidence')
    async evidence(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() response: Response) {
        const image = await this.claims.image(user.userId, id, true);
        response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(image);
    }
    @Post('submissions/:id')
    reviewSubmission(@CurrentUser() user: { userId: string }, @Param('id') id: string,
        @Body(new ValidationPipe({ whitelist: true, transform: true, expectedType: ReviewSubmissionDto })) data: ReviewSubmissionDto) {
        return this.submissions.review(user.userId, id, data);
    }
    @Put('games/:id/embed')
    checkEmbed(@Param('id') id: string,
        @Body(new ValidationPipe({ whitelist: true, transform: true, expectedType: CheckEmbedDto })) data: CheckEmbedDto) {
        return this.games.setEmbedCheck(id, data);
    }
}
