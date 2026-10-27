import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CreatorClaimsService } from './creator-claims.service';
import { CreateCreatorClaimDto } from './dtos/external-game.dto';
import type { CreatorClaimDocument } from './schemas/creator-claim.schema';

/** create/save 结果也可能携带私有二进制字段，响应始终显式挑选。 */
export function claimResponse(record: CreatorClaimDocument) {
    return {
        claimId: record.claimId, gameId: record.gameId, applicantId: record.applicantId,
        profileUrl: record.profileUrl, explanation: record.explanation,
        verificationCode: record.verificationCode, verificationExpiresAt: record.verificationExpiresAt,
        hasEvidence: record.hasEvidence, evidenceDigest: record.evidenceDigest,
        status: record.status, reviewComment: record.reviewComment, updatedAt: record.updatedAt,
    };
}
@Controller('ugc/creator-claims')
@UseGuards(JwtAuthGuard)
export class CreatorClaimsController {
    constructor(@Inject(CreatorClaimsService) private readonly claims: CreatorClaimsService) {}
    @Get() async list(@CurrentUser() user: { userId: string }) { return { items: (await this.claims.list(user.userId)).map(claimResponse) }; }
    @Post() async create(@CurrentUser() user: { userId: string },
        @Body(new ValidationPipe({ whitelist: true, transform: true, expectedType: CreateCreatorClaimDto })) data: CreateCreatorClaimDto) {
        return claimResponse(await this.claims.create(user.userId, data));
    }
    @Post(':id/evidence')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    async upload(@CurrentUser() user: { userId: string }, @Param('id') id: string, @UploadedFile() file?: { buffer: Buffer }) {
        if (!file) throw new BadRequestException('请选择认证截图');
        return claimResponse(await this.claims.upload(user.userId, id, file.buffer));
    }
    @Get(':id/evidence')
    async evidence(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() response: Response) {
        const image = await this.claims.image(user.userId, id);
        response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(image);
    }
    @Post(':id/submit') async submit(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return claimResponse(await this.claims.submit(user.userId, id)); }
    @Post(':id/withdraw') async withdraw(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return claimResponse(await this.claims.withdraw(user.userId, id)); }
}
