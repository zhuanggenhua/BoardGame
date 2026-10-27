import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { ExternalGamesService } from './external-games.service';
import { ExternalPlayService } from './external-play.service';
import { ExternalGameEditDto, PlayHeartbeatDto } from './dtos/external-game.dto';

const validated = <T>(expectedType: new () => T) => new ValidationPipe({ whitelist: true, transform: true, expectedType });
@Controller('ugc/external-games')
export class ExternalGamesController {
    constructor(@Inject(ExternalGamesService) private readonly games: ExternalGamesService,
        @Inject(ExternalPlayService) private readonly plays: ExternalPlayService) {}
    @Get() async list() { return { items: await this.games.list() }; }
    @Get('mine') @UseGuards(JwtAuthGuard)
    async mine(@CurrentUser() user: { userId: string }) { return { items: await this.games.mine(user.userId) }; }
    @Get('history') @UseGuards(JwtAuthGuard)
    history(@CurrentUser() user: { userId: string }) { return this.plays.history(user.userId); }
    @Get('mine/:id') @UseGuards(JwtAuthGuard)
    getOwned(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.games.getOwned(user.userId, id); }
    @Get(':id') get(@Param('id') id: string) { return this.games.get(id); }
    @Put(':id') @UseGuards(JwtAuthGuard)
    edit(@CurrentUser() user: { userId: string }, @Param('id') id: string,
        @Body(validated(ExternalGameEditDto)) data: ExternalGameEditDto) { return this.games.edit(user.userId, id, data); }
    @Post(':id/cover') @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
    cover(@CurrentUser() user: { userId: string }, @Param('id') id: string, @UploadedFile() file?: { buffer: Buffer }) {
        if (!file) throw new BadRequestException('请选择封面图片');
        return this.games.uploadCover(user.userId, id, file.buffer);
    }
    @Post(':id/sessions') @UseGuards(JwtAuthGuard)
    start(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.plays.start(user.userId, id); }
    @Put('sessions/:sessionId') @UseGuards(JwtAuthGuard)
    heartbeat(@CurrentUser() user: { userId: string }, @Param('sessionId') id: string,
        @Body(validated(PlayHeartbeatDto)) data: PlayHeartbeatDto) { return this.plays.heartbeat(user.userId, id, data); }
}
