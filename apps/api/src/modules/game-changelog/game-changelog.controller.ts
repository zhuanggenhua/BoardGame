import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { Roles } from '../admin/guards/roles.decorator';
import { CreateGameChangelogDto, UpdateGameChangelogDto } from './dto';
import { GameChangelogService } from './game-changelog.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('admin', 'developer')
@Controller('admin-api/game-changelogs')
export class GameChangelogAdminController {
    constructor(
        @Inject(GameChangelogService) private readonly changelogService: GameChangelogService,
    ) {}

    @Get()
    async findAll(
        @CurrentUser() currentUser: { userId: string } | null,
        @Query('gameId') gameId?: string,
    ) {
        if (!currentUser?.userId) {
            return { items: [], availableGameIds: [] };
        }
        return this.changelogService.listForAdmin(currentUser.userId, gameId);
    }

    @Post()
    @HttpCode(201)
    async create(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() dto: CreateGameChangelogDto,
    ) {
        if (!currentUser?.userId) {
            throw new UnauthorizedException('缺少登录凭证');
        }
        const changelog = await this.changelogService.createForAdmin({ userId: currentUser.userId }, dto);
        return { changelog };
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() dto: UpdateGameChangelogDto,
    ) {
        if (!currentUser?.userId) {
            throw new UnauthorizedException('缺少登录凭证');
        }
        const changelog = await this.changelogService.updateForAdmin({ userId: currentUser.userId }, id, dto);
        return { changelog };
    }

    @Delete(':id')
    async delete(
        @Param('id') id: string,
        @CurrentUser() currentUser: { userId: string } | null,
    ) {
        if (!currentUser?.userId) {
            throw new UnauthorizedException('缺少登录凭证');
        }
        return this.changelogService.deleteForAdmin(currentUser.userId, id);
    }
}

@Controller('game-changelogs')
export class GameChangelogPublicController {
    constructor(
        @Inject(GameChangelogService) private readonly changelogService: GameChangelogService,
    ) {}

    @Get(':gameId')
    async findPublished(@Param('gameId') gameId: string) {
        const changelogs = await this.changelogService.listPublishedByGame(gameId);
        return { changelogs };
    }
}
