import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Feedback, FeedbackDocument, FeedbackStatus } from './feedback.schema';
import { CreateFeedbackDto, FeedbackFilterDto, QueryFeedbackDto } from './dto';

@Injectable()
export class FeedbackService {
    constructor(
        @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
    ) { }

    async create(userId: string | null, dto: CreateFeedbackDto): Promise<Feedback> {
        return this.feedbackModel.create({
            ...dto,
            ...(userId && { userId }), // 只有在 userId 存在时才添加该字段
        });
    }

    async findAll(query: QueryFeedbackDto) {
        const { page = 1, limit = 20, status, type } = query;
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        const total = await this.feedbackModel.countDocuments(filter);
        const items = await this.feedbackModel
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'username avatar email')
            .exec();

        return { items, total, page, limit };
    }

    async updateStatus(id: string, status: FeedbackStatus): Promise<Feedback | null> {
        return this.feedbackModel.findByIdAndUpdate(id, { status }, { new: true });
    }

    async deleteOne(id: string): Promise<boolean> {
        const result = await this.feedbackModel.deleteOne({ _id: id });
        return (result.deletedCount ?? 0) > 0;
    }

    async bulkDeleteByIds(ids: string[]) {
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
            return { requested: 0, deleted: 0 };
        }
        const result = await this.feedbackModel.deleteMany({ _id: { $in: uniqueIds } });
        return { requested: uniqueIds.length, deleted: result.deletedCount ?? 0 };
    }

    async bulkDeleteByFilter(filterDto: FeedbackFilterDto) {
        const filter: Record<string, unknown> = {};
        if (filterDto.status) filter.status = filterDto.status;
        if (filterDto.type) filter.type = filterDto.type;
        const total = await this.feedbackModel.countDocuments(filter);
        if (total === 0) {
            return { requested: 0, deleted: 0 };
        }
        const result = await this.feedbackModel.deleteMany(filter);
        return { requested: total, deleted: result.deletedCount ?? 0 };
    }
}
