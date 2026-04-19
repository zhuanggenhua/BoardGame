import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import { SystemNotification, type SystemNotificationDocument } from './notification.schema';
import type { CreateNotificationDto, UpdateNotificationDto } from './dto';

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel(SystemNotification.name) private notificationModel: Model<SystemNotificationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {}

    /** 管理端：创建通知 */
    async create(dto: CreateNotificationDto): Promise<SystemNotificationDocument> {
        return this.notificationModel.create(dto);
    }

    /** 管理端：更新通知 */
    async update(id: string, dto: UpdateNotificationDto): Promise<SystemNotificationDocument | null> {
        return this.notificationModel.findByIdAndUpdate(id, dto, { new: true });
    }

    /** 管理端：删除通知 */
    async delete(id: string): Promise<boolean> {
        const result = await this.notificationModel.findByIdAndDelete(id);
        return !!result;
    }

    /** 管理端：获取所有通知（含草稿），置顶优先，再按创建时间倒序 */
    async findAll(): Promise<SystemNotificationDocument[]> {
        return this.notificationModel.find().sort({ pinned: -1, createdAt: -1 });
    }

    /** 用户端：获取当前有效的已发布通知，置顶优先 */
    async findActive(): Promise<SystemNotificationDocument[]> {
        const now = new Date();
        return this.notificationModel.find({
            published: true,
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null },
                { expiresAt: { $gt: now } },
            ],
        }).sort({ pinned: -1, createdAt: -1 });
    }

    async getUserLastSeenAt(userId: string): Promise<Date | null> {
        const user = await this.userModel.findById(userId).select({ notificationLastSeenAt: 1 }).lean<{ notificationLastSeenAt?: Date | null }>();
        return user?.notificationLastSeenAt ?? null;
    }

    async markUserSeenAt(userId: string, seenAt: Date): Promise<Date | null> {
        const normalizedSeenAt = Number.isNaN(seenAt.getTime()) ? new Date() : seenAt;
        const updated = await this.userModel.findByIdAndUpdate(
            userId,
            { $max: { notificationLastSeenAt: normalizedSeenAt } },
            { new: true },
        ).select({ notificationLastSeenAt: 1 }).lean<{ notificationLastSeenAt?: Date | null }>();
        return updated?.notificationLastSeenAt ?? normalizedSeenAt;
    }
}
