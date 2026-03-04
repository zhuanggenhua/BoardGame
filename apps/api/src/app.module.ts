import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { redisStore } from 'cache-manager-redis-store';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { FriendModule } from './modules/friend/friend.module';
import { HealthModule } from './modules/health/health.module';
import { InviteModule } from './modules/invite/invite.module';
import { MessageModule } from './modules/message/message.module';
import { ReviewModule } from './modules/review/review.module';
import { UgcModule } from './modules/ugc/ugc.module';
import { LayoutModule } from './modules/layout/layout.module';
import { UserSettingsModule } from './modules/user-settings/user-settings.module';
import { CustomDeckModule } from './modules/custom-deck/custom-deck.module';
import { SponsorModule } from './modules/sponsor/sponsor.module';

import { FeedbackModule } from './modules/feedback/feedback.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        MongooseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('MONGO_URI') || 'mongodb://localhost:27017/boardgame',
                // 连接池优化（生产环境标准配置）
                maxPoolSize: 10,              // 最大连接数（默认 100，降低以节省内存）
                minPoolSize: 2,               // 最小连接数（保持 2 个热连接）
                maxIdleTimeMS: 60000,         // 空闲连接 60 秒后关闭
                serverSelectionTimeoutMS: 5000, // 服务器选择超时 5 秒
                socketTimeoutMS: 45000,       // Socket 超时 45 秒
                connectTimeoutMS: 10000,      // 连接超时 10 秒
            }),
        }),
        CacheModule.registerAsync({
            isGlobal: true,
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                const redisHost = configService.get<string>('REDIS_HOST');
                const redisPort = configService.get<string>('REDIS_PORT');
                if (!redisHost && !redisPort) {
                    return {} as never;
                }

                const host = redisHost || 'localhost';
                const port = Number(redisPort || 6379);

                const store = await redisStore({
                    socket: {
                        host,
                        port,
                    },
                });

                // cache-manager v5 的 set(key, value, ttl) 传数字 TTL，
                // 但 cache-manager-redis-store v3 期望 set(key, value, { ttl })。
                // 包装 store.set 做格式适配，确保 TTL 正确传递给 Redis SETEX。
                const originalSet = store.set.bind(store);
                store.set = (key: string, value: unknown, options: unknown, cb?: unknown) => {
                    if (typeof options === 'number') {
                        return originalSet(key, value, { ttl: options }, cb);
                    }
                    return originalSet(key, value, options, cb);
                };

                return { store } as never;
            },
        }),
        AuthModule,
        AdminModule,
        FriendModule,
        MessageModule,
        InviteModule,
        ReviewModule,
        FeedbackModule,
        NotificationModule,
        HealthModule,
        UgcModule,
        LayoutModule,
        UserSettingsModule,
        CustomDeckModule,
        SponsorModule,
    ],
})
export class AppModule { }
