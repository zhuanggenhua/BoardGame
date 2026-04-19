import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { NotificationModule } from '../src/modules/notification/notification.module';
import { NotificationService } from '../src/modules/notification/notification.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { SystemNotification, type SystemNotificationDocument } from '../src/modules/notification/notification.schema';

describe('NotificationService', () => {
    let mongo: MongoMemoryServer | null;
    let moduleRef: import('@nestjs/testing').TestingModule;
    let service: NotificationService;
    let model: Model<SystemNotificationDocument>;
    let userModel: Model<UserDocument>;

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) throw new Error('缺少 MongoDB 连接地址');

        moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_notification' } : undefined),
                NotificationModule,
            ],
        }).compile();

        await moduleRef.init();
        service = moduleRef.get(NotificationService);
        model = moduleRef.get<Model<SystemNotificationDocument>>(getModelToken(SystemNotification.name));
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
    });

    beforeEach(async () => {
        await model.deleteMany({});
        await userModel.deleteMany({});
    });

    afterAll(async () => {
        if (moduleRef) await moduleRef.close();
        if (mongo) await mongo.stop();
    });

    it('创建通知并查询', async () => {
        const created = await service.create({ title: '维护公告', content: '今晚 22:00 维护' });
        expect(created.title).toBe('维护公告');
        expect(created.published).toBe(true);

        const all = await service.findAll();
        expect(all).toHaveLength(1);
    });

    it('更新通知', async () => {
        const created = await service.create({ title: '原标题', content: '原内容' });
        const updated = await service.update(created._id.toString(), { title: '新标题' });
        expect(updated?.title).toBe('新标题');
        expect(updated?.content).toBe('原内容');
    });

    it('删除通知', async () => {
        const created = await service.create({ title: '待删除', content: '内容' });
        const ok = await service.delete(created._id.toString());
        expect(ok).toBe(true);

        const all = await service.findAll();
        expect(all).toHaveLength(0);
    });

    it('findActive 只返回已发布且未过期的通知', async () => {
        // 已发布、无过期
        await service.create({ title: '永久公告', content: '内容' });
        // 已发布、未来过期
        await service.create({ title: '限时公告', content: '内容', expiresAt: new Date(Date.now() + 86400000).toISOString() });
        // 已发布、已过期
        await service.create({ title: '过期公告', content: '内容', expiresAt: new Date(Date.now() - 86400000).toISOString() });
        // 草稿
        await service.create({ title: '草稿', content: '内容', published: false });

        const active = await service.findActive();
        expect(active).toHaveLength(2);
        const titles = active.map(n => n.title);
        expect(titles).toContain('永久公告');
        expect(titles).toContain('限时公告');
        expect(titles).not.toContain('过期公告');
        expect(titles).not.toContain('草稿');
    });

    it('findAll 返回所有通知（含草稿和过期）', async () => {
        await service.create({ title: '公告1', content: '内容' });
        await service.create({ title: '草稿', content: '内容', published: false });
        await service.create({ title: '过期', content: '内容', expiresAt: new Date(Date.now() - 86400000).toISOString() });

        const all = await service.findAll();
        expect(all).toHaveLength(3);
    });

    it('markUserSeenAt 持久化且不会被更早时间回退', async () => {
        const user = await userModel.create({
            username: 'notif-user',
            email: 'notif-user@test.com',
            password: 'hashed-password',
            role: 'user',
            banned: false,
        });

        const firstSeenAt = new Date('2026-01-01T10:00:00.000Z');
        const secondSeenAt = new Date('2026-01-02T10:00:00.000Z');

        await service.markUserSeenAt(user._id.toString(), secondSeenAt);
        await service.markUserSeenAt(user._id.toString(), firstSeenAt);

        const persisted = await service.getUserLastSeenAt(user._id.toString());
        expect(persisted?.toISOString()).toBe(secondSeenAt.toISOString());
    });
});
