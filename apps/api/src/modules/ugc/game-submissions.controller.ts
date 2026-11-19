import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { GameSubmissionDetailsDto, GameSubmissionDto } from './dtos/game-submission.dto';
import { GameSubmissionsService } from './game-submissions.service';
import { hasControlCharacters, MAX_RULES_FILE_BYTES, MAX_WEB_ZIP_BYTES } from '../../../../../src/shared/externalGames';
import type { GameRulesUpload } from './game-rules-file';

@Controller('ugc/submissions')
@UseGuards(JwtAuthGuard)
export class GameSubmissionsController {
    private readonly zipDetails = new ValidationPipe({ whitelist: true, transform: true, expectedType: GameSubmissionDetailsDto });
    constructor(@Inject(GameSubmissionsService) private readonly submissions: GameSubmissionsService) {}
    @Get()
    async list(@CurrentUser() user: { userId: string }) { return { items: await this.submissions.list(user.userId) }; }
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true, expectedType: GameSubmissionDto }))
    create(@CurrentUser() user: { userId: string }, @Body() body: GameSubmissionDto) { return this.submissions.create(user.userId, body); }
    @Post('web-zip')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_WEB_ZIP_BYTES + 1, fields: 3, fieldSize: 512 * 1024 } }))
    async webZip(@CurrentUser() user: { userId: string }, @Body('data') data: string, @Body('submissionId') id: string | undefined,
        @Body('name') name: string, @UploadedFile() file?: { buffer: Buffer }) {
        if (!file || typeof name !== 'string' || !/^[^/\\]{1,196}\.zip$/i.test(name) || hasControlCharacters(name)) throw new BadRequestException('请选择网页 ZIP');
        if (id !== undefined && typeof id !== 'string') throw new BadRequestException('投稿编号无效');
        let fields: unknown;
        try { fields = JSON.parse(data); } catch { throw new BadRequestException('投稿资料无效'); }
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new BadRequestException('投稿资料无效');
        const body = await this.zipDetails.transform(fields, { type: 'body' }) as GameSubmissionDetailsDto;
        return this.submissions.saveWebZip(user.userId, body, { name, buffer: file.buffer }, id);
    }
    @Put(':id')
    update(
        @CurrentUser() user: { userId: string },
        @Param('id') id: string,
        @Body(new ValidationPipe({ whitelist: true, transform: true, expectedType: GameSubmissionDto })) body: GameSubmissionDto,
    ) { return this.submissions.update(user.userId, id, body); }
    @Post(':id/cover')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
    cover(@CurrentUser() user: { userId: string }, @Param('id') id: string, @UploadedFile() file?: { buffer: Buffer }) {
        if (!file) throw new BadRequestException('请选择封面');
        return this.submissions.uploadCover(user.userId, id, file.buffer);
    }
    @Post(':id/rules')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RULES_FILE_BYTES } }))
    rules(@CurrentUser() user: { userId: string }, @Param('id') id: string, @UploadedFile() file?: GameRulesUpload) {
        if (!file) throw new BadRequestException('请选择规则文件');
        return this.submissions.uploadRules(user.userId, id, file);
    }
    @Delete(':id/rules')
    removeRules(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.submissions.removeRules(user.userId, id); }
    @Post(':id/submit')
    submit(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.submissions.submit(user.userId, id); }
    @Post(':id/withdraw')
    withdraw(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.submissions.withdraw(user.userId, id); }
}
