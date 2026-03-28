import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { normalizeDeveloperGameIds } from '../auth/schemas/developer-game-access';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import type { UserRole } from '../auth/schemas/user-role';
import { Feedback, FeedbackDocument, FeedbackStatus, FeedbackType } from './feedback.schema';
import { CreateFeedbackDto, FeedbackFilterDto, QueryFeedbackDto } from './dto';

type FeedbackManagerScope = {
    role: Extract<UserRole, 'developer' | 'admin'>;
    developerGameIds: string[] | null;
};

@Injectable()
export class FeedbackService {
    constructor(
        @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    async create(userId: string | null, dto: CreateFeedbackDto): Promise<Feedback> {
        if (
            dto.type === FeedbackType.BUG
            && !dto.actionLog?.trim()
            && !dto.stateSnapshot?.trim()
        ) {
            throw new BadRequestException('bug 反馈必须附带操作日志或状态快照');
        }

        return this.feedbackModel.create({
            ...dto,
            gameId: this.normalizeFeedbackGameId(dto.clientContext?.gameId ?? dto.gameName),
            ...(userId && { userId }),
        });
    }

    async findAll(actorUserId: string, query: QueryFeedbackDto) {
        const manager = await this.assertActorCanManage(actorUserId);
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
        const { status, type, severity, sort } = query;
        const filter = this.buildScopedFilter(manager);
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (severity) filter.severity = severity;
        const createdAtSort = sort === 'oldest' ? 1 : -1;

        const total = await this.feedbackModel.countDocuments(filter);
        const items = await this.feedbackModel
            .find(filter)
            .sort({ createdAt: createdAtSort })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'username avatar email')
            .exec();

        return { items, total, page, limit };
    }

    async updateStatus(actorUserId: string, id: string, status: FeedbackStatus): Promise<Feedback | null> {
        const manager = await this.assertActorCanManage(actorUserId);
        const scopeFilter = this.buildScopedFilter(manager);
        return this.feedbackModel.findOneAndUpdate({ _id: id, ...scopeFilter }, { status }, { new: true });
    }

    async deleteOne(actorUserId: string, id: string): Promise<boolean> {
        const manager = await this.assertActorCanManage(actorUserId);
        const scopeFilter = this.buildScopedFilter(manager);
        const result = await this.feedbackModel.deleteOne({ _id: id, ...scopeFilter });
        return (result.deletedCount ?? 0) > 0;
    }

    async bulkDeleteByIds(actorUserId: string, ids: string[]) {
        const manager = await this.assertActorCanManage(actorUserId);
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
            return { requested: 0, deleted: 0 };
        }
        const scopeFilter = this.buildScopedFilter(manager);
        const result = await this.feedbackModel.deleteMany({ _id: { $in: uniqueIds }, ...scopeFilter });
        return { requested: uniqueIds.length, deleted: result.deletedCount ?? 0 };
    }

    async bulkDeleteByFilter(actorUserId: string, filterDto: FeedbackFilterDto) {
        const manager = await this.assertActorCanManage(actorUserId);
        const filter = this.buildScopedFilter(manager);
        if (filterDto.status) filter.status = filterDto.status;
        if (filterDto.type) filter.type = filterDto.type;
        if (filterDto.severity) filter.severity = filterDto.severity;
        const total = await this.feedbackModel.countDocuments(filter);
        if (total === 0) {
            return { requested: 0, deleted: 0 };
        }
        const result = await this.feedbackModel.deleteMany(filter);
        return { requested: total, deleted: result.deletedCount ?? 0 };
    }

    private normalizeFeedbackGameId(value?: string | null): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }
        const normalized = value.trim().toLowerCase();
        return normalized || undefined;
    }

    private buildScopedFilter(
        manager: FeedbackManagerScope,
        extra: Record<string, unknown> = {}
    ): Record<string, unknown> {
        const filter: Record<string, unknown> = { ...extra };

        if (manager.role === 'admin' || manager.developerGameIds === null) {
            return filter;
        }

        if (manager.developerGameIds.length === 0) {
            filter._id = { $exists: false };
            return filter;
        }

        filter.$or = [
            { gameId: { $in: manager.developerGameIds } },
            { 'clientContext.gameId': { $in: manager.developerGameIds } },
            { gameName: { $in: manager.developerGameIds } },
        ];

        return filter;
    }

    private async assertActorCanManage(actorUserId: string): Promise<FeedbackManagerScope> {
        const actor = await this.userModel.findById(actorUserId).select('role developerGameIds').lean<{
            role: UserRole;
            developerGameIds?: string[];
        } | null>();

        if (!actor || (actor.role !== 'admin' && actor.role !== 'developer')) {
            throw new ForbiddenException('无权管理反馈');
        }

        if (actor.role === 'admin') {
            return {
                role: actor.role,
                developerGameIds: null,
            };
        }

        return {
            role: actor.role,
            developerGameIds: normalizeDeveloperGameIds(actor.developerGameIds),
        };
    }
}

