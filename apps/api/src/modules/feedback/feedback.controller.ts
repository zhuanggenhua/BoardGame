import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { BulkFeedbackIdsDto, CreateFeedbackDto, FeedbackFilterDto, UpdateFeedbackStatusDto, QueryFeedbackDto } from './dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { Roles } from '../admin/guards/roles.decorator';
import { AdminGuard } from '../admin/guards/admin.guard';

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
    @Post()
    async create(@Request() req: any, @Body() dto: CreateFeedbackDto) {
        // 如果用户已登录，使用用户 ID；否则使用 null（匿名反馈）
        const userId = req.user?.userId || null;
        return this.feedbackService.create(userId, dto);
    }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('admin')
@Controller('admin/feedback')
export class FeedbackAdminController {
    constructor(@Inject(FeedbackService) private readonly feedbackService: FeedbackService) { }

    @Get()
    async findAll(@Query() query: QueryFeedbackDto) {
        return this.feedbackService.findAll(query);
    }

    @Patch(':id/status')
    async updateStatus(@Param('id') id: string, @Body() dto: UpdateFeedbackStatusDto) {
        const updated = await this.feedbackService.updateStatus(id, dto.status);
        if (!updated) {
            throw new NotFoundException('feedback not found');
        }
        return updated;
    }

    @Delete(':id')
    async deleteOne(@Param('id') id: string) {
        const ok = await this.feedbackService.deleteOne(id);
        return { ok };
    }

    @Post('bulk-delete')
    async bulkDelete(@Body() body: BulkFeedbackIdsDto) {
        return this.feedbackService.bulkDeleteByIds(body.ids || []);
    }

    @Post('bulk-delete-by-filter')
    async bulkDeleteByFilter(@Body() body: FeedbackFilterDto) {
        return this.feedbackService.bulkDeleteByFilter(body);
    }
}
