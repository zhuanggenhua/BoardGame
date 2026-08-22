import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, Res, UseGuards, applyDecorators } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { createRequestI18n } from '../../shared/i18n';
import { AdminUserRoleService } from './admin-user-role.service';
import { BanUserDto } from './dtos/ban-user.dto';
import { BulkIdsDto } from './dtos/bulk-ids.dto';
import { RoomFilterDto } from './dtos/room-filter.dto';
import { QueryMatchesDto } from './dtos/query-matches.dto';
import { QueryRoomsDto } from './dtos/query-rooms.dto';
import { QueryStatsDto } from './dtos/query-stats.dto';
import { QueryUsersDto } from './dtos/query-users.dto';
import { QueryUgcPackagesDto } from './dtos/query-ugc-packages.dto';
import { UpdateAdminTestLatencyDto } from './dtos/update-admin-test-latency.dto';
import { UpdateUserRoleDto } from './dtos/update-user-role.dto';
import {
    AndroidGamePackageReleaseDto,
    AndroidNativeReleaseDto,
    AndroidOtaReleaseDto,
    DeployRollbackExecuteDto,
    DeployRollbackPreviewDto,
    DeployUpdateExecuteDto,
    DeployUpdatePreviewDto,
} from './dtos/mobile-release.dto';
import { AdminGuard } from './guards/admin.guard';
import { Roles } from './guards/roles.decorator';
import { AdminMobileReleaseService } from './admin-mobile-release.service';
import { AdminTestLatencyService } from './admin-test-latency.service';
import { AdminService } from './admin.service';

@Controller('admin-api')
export class AdminController {
    constructor(
        @Inject(AdminService) private readonly adminService: AdminService,
        @Inject(AdminMobileReleaseService) private readonly adminMobileReleaseService: AdminMobileReleaseService,
        @Inject(AdminTestLatencyService) private readonly adminTestLatencyService: AdminTestLatencyService,
        @Inject(AdminUserRoleService) private readonly adminUserRoleService: AdminUserRoleService,
    ) {}

    private static AdminOnly() {
        return applyDecorators(
            UseGuards(JwtAuthGuard, AdminGuard),
            Roles('admin'),
        );
    }

    @Get('test-latency')
    @AdminController.AdminOnly()
    getTestLatency(@Res() res: Response) {
        return res.json(this.adminTestLatencyService.getState());
    }

    @Patch('test-latency')
    @AdminController.AdminOnly()
    updateTestLatency(@Body() body: UpdateAdminTestLatencyDto, @Res() res: Response) {
        const state = this.adminTestLatencyService.update(body);
        return res.json(state);
    }

    @Get('mobile-release/android/ota/status')
    @AdminController.AdminOnly()
    async getAndroidOtaStatus(@Query('channel') channel: string | undefined, @Res() res: Response) {
        const normalizedChannel = channel === 'gray' || channel === 'edge' ? channel : 'stable';
        const status = await this.adminMobileReleaseService.getAndroidOtaStatus(normalizedChannel);
        return res.json(status);
    }

    @Get('mobile-release/android/status')
    @AdminController.AdminOnly()
    async getAndroidReleaseStatus(@Query('channel') channel: string | undefined, @Res() res: Response) {
        const normalizedChannel = channel === 'gray' || channel === 'edge' ? channel : 'stable';
        const status = await this.adminMobileReleaseService.getAndroidReleaseStatus(normalizedChannel);
        return res.json(status);
    }

    @Post('mobile-release/android/ota/publish')
    @AdminController.AdminOnly()
    async publishAndroidOta(@Body() body: AndroidOtaReleaseDto, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.publishAndroidOta(body);
        return res.status(200).json(result);
    }

    @Post('mobile-release/android/native/publish')
    @AdminController.AdminOnly()
    async publishAndroidNative(@Body() body: AndroidNativeReleaseDto, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.publishAndroidNative(body);
        return res.status(200).json(result);
    }

    @Post('mobile-release/android/packages/publish')
    @AdminController.AdminOnly()
    async publishAndroidGamePackage(@Body() body: AndroidGamePackageReleaseDto, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.publishAndroidGamePackage(body);
        return res.status(200).json(result);
    }

    @Post('mobile-release/deploy/rollback/preview')
    @AdminController.AdminOnly()
    async previewDeployRollback(@Body() body: DeployRollbackPreviewDto, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.previewDeployRollback(body);
        return res.status(200).json(result);
    }

    @Post('mobile-release/deploy/rollback/execute')
    @AdminController.AdminOnly()
    async executeDeployRollback(@Body() body: DeployRollbackExecuteDto, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.executeDeployRollback(body);
        return res.status(200).json(result);
    }

    @Post('mobile-release/deploy/update/preview')
    @AdminController.AdminOnly()
    async previewDeployUpdate(@Body() body: DeployUpdatePreviewDto, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.previewDeployUpdate(body);
        return res.status(200).json(result);
    }

    @Post('mobile-release/deploy/update/execute')
    @AdminController.AdminOnly()
    async executeDeployUpdate(@Body() body: DeployUpdateExecuteDto, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.executeDeployUpdate(body);
        return res.status(200).json(result);
    }

    @Get('mobile-release/deploy/jobs/:jobId')
    @AdminController.AdminOnly()
    async getDeployJob(@Param('jobId') jobId: string, @Res() res: Response) {
        const result = await this.adminMobileReleaseService.getDeployJob(jobId);
        return res.status(200).json(result);
    }

    @Get('stats')
    async getStats(@Req() req: Request, @Res() res: Response) {
        const stats = await this.adminService.getStats();
        return res.json(stats);
    }

    @Get('stats/trend')
    async getStatsTrend(@Query() query: QueryStatsDto, @Res() res: Response) {
        const trend = await this.adminService.getStatsTrend(query.days);
        return res.json(trend);
    }

    @Get('stats/retention')
    @AdminController.AdminOnly()
    async getRetention(@Res() res: Response) {
        const data = await this.adminService.getRetention();
        return res.json(data);
    }

    @Get('stats/activity-tiers')
    @AdminController.AdminOnly()
    async getActivityTiers(@Res() res: Response) {
        const data = await this.adminService.getUserActivityTiers();
        return res.json(data);
    }

    @Get('users')
    @AdminController.AdminOnly()
    async getUsers(@Query() query: QueryUsersDto, @Res() res: Response) {
        const result = await this.adminService.getUsers(query);
        return res.json(result);
    }

    @Get('rooms')
    @AdminController.AdminOnly()
    async getRooms(@Query() query: QueryRoomsDto, @Res() res: Response) {
        const result = await this.adminService.getRooms(query);
        return res.json(result);
    }

    @Get('ugc/packages')
    @AdminController.AdminOnly()
    async getUgcPackages(@Query() query: QueryUgcPackagesDto, @Res() res: Response) {
        const result = await this.adminService.getUgcPackages(query);
        return res.json(result);
    }

    @Post('ugc/packages/:packageId/unpublish')
    @AdminController.AdminOnly()
    async unpublishUgcPackage(
        @Param('packageId') packageId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        const result = await this.adminService.unpublishUgcPackage(packageId.trim());
        if (!result.ok) {
            return this.sendError(res, 404, t('admin.error.ugcPackageNotFound'));
        }
        return res.status(200).json({ package: result.package });
    }

    @Delete('ugc/packages/:packageId')
    @AdminController.AdminOnly()
    async deleteUgcPackage(
        @Param('packageId') packageId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        const result = await this.adminService.deleteUgcPackage(packageId.trim());
        if (!result.ok) {
            return this.sendError(res, 404, t('admin.error.ugcPackageNotFound'));
        }
        return res.status(200).json({ deleted: true, assetsDeleted: result.assetsDeleted });
    }

    @Delete('rooms/:id')
    @AdminController.AdminOnly()
    async destroyRoom(@Param('id') matchId: string, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const ok = await this.adminService.destroyRoom(matchId);
        if (!ok) {
            return this.sendError(res, 404, t('admin.error.roomNotFound'));
        }
        return res.status(200).json({ message: t('admin.success.roomDestroyed'), matchID: matchId });
    }

    @Post('rooms/bulk-delete')
    @AdminController.AdminOnly()
    async bulkDestroyRooms(@Body() body: BulkIdsDto, @Res() res: Response) {
        const result = await this.adminService.bulkDestroyRooms(body.ids || []);
        return res.status(200).json(result);
    }

    @Post('rooms/bulk-delete-by-filter')
    @AdminController.AdminOnly()
    async bulkDestroyRoomsByFilter(@Body() body: RoomFilterDto, @Res() res: Response) {
        const result = await this.adminService.bulkDestroyRoomsByFilter(body);
        return res.status(200).json(result);
    }

    @Get('users/:id')
    @AdminController.AdminOnly()
    async getUserDetail(@Param('id') userId: string, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const result = await this.adminService.getUserDetail(userId);
        if (!result.ok) {
            return this.sendError(res, 404, t('admin.error.userNotFound'));
        }
        return res.json(result.data);
    }

    @Patch('users/:id/role')
    @AdminController.AdminOnly()
    async updateUserRole(
        @Param('id') userId: string,
        @Body() body: UpdateUserRoleDto,
        @CurrentUser() currentUser: { userId: string; username: string } | null,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.invalidToken'));
        }

        const result = await this.adminUserRoleService.updateUserRole({
            actorUserId: currentUser.userId,
            actorUsername: currentUser.username,
            actorIp: this.resolveClientIp(req),
            targetUserId: userId,
            role: body.role,
            developerGameIds: body.developerGameIds,
        });

        if (!result.ok) {
            const map: Record<string, { status: number; message: string }> = {
                notFound: { status: 404, message: t('admin.error.userNotFound') },
                cannotChangeOwnRole: { status: 400, message: t('admin.error.cannotChangeOwnRole') },
                mustKeepOneAdmin: { status: 400, message: t('admin.error.mustKeepOneAdmin') },
                developerGamesRequired: { status: 400, message: t('admin.error.developerGamesRequired') },
            };
            const payload = map[result.code];
            return this.sendError(res, payload.status, payload.message);
        }

        return res.status(200).json({
            message: t('admin.success.userRoleUpdated'),
            user: result.user,
            changed: result.changed,
        });
    }

    @Post('users/:id/ban')
    @AdminController.AdminOnly()
    async banUser(
        @Param('id') userId: string,
        @Body() body: BanUserDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        const reason = body.reason?.trim();
        if (!reason) {
            return this.sendError(res, 400, t('admin.error.missingBanReason'));
        }

        const result = await this.adminService.banUser(userId, reason);
        if (!result.ok) {
            const map: Record<string, { status: number; message: string }> = {
                notFound: { status: 404, message: t('admin.error.userNotFound') },
                cannotBanAdmin: { status: 400, message: t('admin.error.cannotBanAdmin') },
            };
            const payload = map[result.code];
            return this.sendError(res, payload.status, payload.message);
        }

        return res.status(201).json({ message: t('admin.success.userBanned'), user: result.user });
    }

    @Post('users/:id/unban')
    @AdminController.AdminOnly()
    async unbanUser(@Param('id') userId: string, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const result = await this.adminService.unbanUser(userId);
        if (!result.ok) {
            return this.sendError(res, 404, t('admin.error.userNotFound'));
        }
        return res.status(200).json({ message: t('admin.success.userUnbanned'), user: result.user });
    }

    @Delete('users/:id')
    @AdminController.AdminOnly()
    async deleteUser(@Param('id') userId: string, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const result = await this.adminService.deleteUser(userId);
        if (!result.ok) {
            const map: Record<string, { status: number; message: string }> = {
                notFound: { status: 404, message: t('admin.error.userNotFound') },
                cannotDeleteAdmin: { status: 400, message: t('admin.error.cannotDeleteAdmin') },
            };
            const payload = map[result.code];
            return this.sendError(res, payload.status, payload.message);
        }
        return res.status(200).json({ message: t('admin.success.userDeleted'), user: result.user });
    }

    @Post('users/bulk-delete')
    @AdminController.AdminOnly()
    async bulkDeleteUsers(@Body() body: BulkIdsDto, @Res() res: Response) {
        const result = await this.adminService.bulkDeleteUsers(body.ids || []);
        return res.status(200).json(result);
    }

    @Get('matches')
    async getMatches(@Query() query: QueryMatchesDto, @Res() res: Response) {
        const result = await this.adminService.getMatches(query);
        return res.json(result);
    }

    @Get('matches/:id')
    async getMatchDetail(@Param('id') matchId: string, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const match = await this.adminService.getMatchDetail(matchId);
        if (!match) {
            return this.sendError(res, 404, t('admin.error.matchNotFound'));
        }
        return res.json(match);
    }

    @Delete('matches/:id')
    @AdminController.AdminOnly()
    async deleteMatch(@Param('id') matchId: string, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const ok = await this.adminService.deleteMatch(matchId);
        if (!ok) {
            return this.sendError(res, 404, t('admin.error.matchNotFound'));
        }
        return res.status(200).json({ message: t('admin.success.matchDeleted'), matchID: matchId });
    }

    @Post('matches/bulk-delete')
    @AdminController.AdminOnly()
    async bulkDeleteMatches(@Body() body: BulkIdsDto, @Res() res: Response) {
        const result = await this.adminService.bulkDeleteMatches(body.ids || []);
        return res.status(200).json(result);
    }

    private resolveClientIp(req: Request): string | null {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            const ip = forwarded.split(',')[0]?.trim();
            return ip || null;
        }
        if (Array.isArray(forwarded)) {
            const ip = forwarded[0]?.split(',')[0]?.trim();
            return ip || null;
        }
        return req.ip ?? null;
    }

    private sendError(res: Response, status: number, message: string) {
        return res.status(status).json({ error: message });
    }
}
