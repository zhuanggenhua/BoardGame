import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Post, Put, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { Roles } from '../admin/guards/roles.decorator';
import { NotificationService } from './notification.service';
import { CreateNotificationDto, UpdateNotificationDto, UpdateNotificationReadStateDto } from './dto';

/** 管理端：通知 CRUD */
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('admin')
@Controller('admin-api/notifications')
export class NotificationAdminController {
    constructor(@Inject(NotificationService) private readonly notificationService: NotificationService) {}

    @Get()
    async findAll() {
        const list = await this.notificationService.findAll();
        return { notifications: list };
    }

    @Post()
    @HttpCode(201)
    async create(@Body() dto: CreateNotificationDto) {
        const notification = await this.notificationService.create(dto);
        return { notification };
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateNotificationDto) {
        const notification = await this.notificationService.update(id, dto);
        if (!notification) throw new NotFoundException('通知不存在');
        return { notification };
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        const ok = await this.notificationService.delete(id);
        if (!ok) throw new NotFoundException('通知不存在');
        return { deleted: true };
    }
}

/** 用户端：获取当前有效通知（无需登录） */
@Controller('notifications')
export class NotificationPublicController {
    constructor(@Inject(NotificationService) private readonly notificationService: NotificationService) {}

    @Get()
    async findActive() {
        const list = await this.notificationService.findActive();
        return { notifications: list };
    }

    @UseGuards(JwtAuthGuard)
    @Get('read-state')
    async getReadState(@CurrentUser() currentUser: { userId: string } | null) {
        if (!currentUser?.userId) {
            throw new UnauthorizedException('登录凭证无效');
        }
        const lastSeenAt = await this.notificationService.getUserLastSeenAt(currentUser.userId);
        return { lastSeenAt: lastSeenAt?.toISOString() ?? null };
    }

    @UseGuards(JwtAuthGuard)
    @Post('read-state')
    @HttpCode(200)
    async updateReadState(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: UpdateNotificationReadStateDto,
    ) {
        if (!currentUser?.userId) {
            throw new UnauthorizedException('登录凭证无效');
        }
        const seenAt = body.seenAt ? new Date(body.seenAt) : new Date();
        const updatedSeenAt = await this.notificationService.markUserSeenAt(currentUser.userId, seenAt);
        return { lastSeenAt: updatedSeenAt?.toISOString() ?? null };
    }
}
