import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { BulkFeedbackIdsDto, CreateFeedbackDto, CreateSystemFeedbackDto, FeedbackFilterDto, UpdateFeedbackStatusDto, QueryFeedbackDto } from './dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { Roles } from '../admin/guards/roles.decorator';
import { AdminGuard } from '../admin/guards/admin.guard';
import { InternalFeedbackGuard } from '../../shared/guards/internal-feedback.guard';

type FeedbackAdminRequest = {
    user?: {
        userId: string;
    };
};

@Controller('feedback')
export class FeedbackController {
    constructor(@Inject(FeedbackService) private readonly feedbackService: FeedbackService) { }

    /**
     * 创建反馈
     * 
     * 速率限制：
     * - 匿名用户：每 IP 每分钟最多 3 次请求
     * - 已登录用户：每用户每分钟最多 10 次请求
     * 
     * TODO: 添加 @nestjs/throttler 依赖后启用速率限制
     * @Throttle({ default: { limit: 3, ttl: 60000 } }) // 匿名用户限制
     */
    @UseGuards(OptionalJwtAuthGuard)
    @Post()
    async create(@Request() req: FeedbackAdminRequest, @Body() dto: CreateFeedbackDto) {
        // 如果用户已登录，使用用户 ID；否则使用 null（匿名反馈）
        const userId = req.user?.userId || null;
        return this.feedbackService.create(userId, dto);
    }
}

@UseGuards(InternalFeedbackGuard)
@Controller('internal/feedback')
export class FeedbackInternalController {
    constructor(@Inject(FeedbackService) private readonly feedbackService: FeedbackService) { }

    @Post('system')
    async createSystem(@Body() dto: CreateSystemFeedbackDto) {
        return this.feedbackService.createSystem(dto);
    }
}

@Controller('admin/feedback')
export class FeedbackAdminController {
    constructor(@Inject(FeedbackService) private readonly feedbackService: FeedbackService) { }

    @UseGuards(OptionalJwtAuthGuard)
    @Get()
    async findAll(@Request() req: FeedbackAdminRequest, @Query() query: QueryFeedbackDto) {
        return this.feedbackService.findAll(req.user?.userId ?? null, query);
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Get(':id')
    async findOne(@Request() req: FeedbackAdminRequest, @Param('id') id: string) {
        const item = await this.feedbackService.findOne(req.user?.userId ?? null, id);
        if (!item) {
            throw new NotFoundException('feedback not found');
        }
        return item;
    }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Roles('admin', 'developer', 'user')
    @Patch(':id/status')
    async updateStatus(@Request() req: FeedbackAdminRequest, @Param('id') id: string, @Body() dto: UpdateFeedbackStatusDto) {
        const updated = await this.feedbackService.updateStatus(req.user!.userId, id, dto);
        if (!updated) {
            throw new NotFoundException('feedback not found');
        }
        return updated;
    }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Roles('admin', 'developer', 'user')
    @Delete(':id')
    async deleteOne(@Request() req: FeedbackAdminRequest, @Param('id') id: string) {
        const ok = await this.feedbackService.deleteOne(req.user!.userId, id);
        return { ok };
    }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Roles('admin', 'developer', 'user')
    @Post('bulk-delete')
    async bulkDelete(@Request() req: FeedbackAdminRequest, @Body() body: BulkFeedbackIdsDto) {
        return this.feedbackService.bulkDeleteByIds(req.user!.userId, body.ids || []);
    }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Roles('admin', 'developer', 'user')
    @Post('bulk-delete-by-filter')
    async bulkDeleteByFilter(@Request() req: FeedbackAdminRequest, @Body() body: FeedbackFilterDto) {
        return this.feedbackService.bulkDeleteByFilter(req.user!.userId, body);
    }
}
