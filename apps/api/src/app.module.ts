import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { redisStore } from 'cache-manager-redis-store';
import { AuthModule } from './modules/auth/auth.module';
import { FriendModule } from './modules/friend/friend.module';
import { HealthModule } from './modules/health/health.module';
import { InviteModule } from './modules/invite/invite.module';
import { MessageModule } from './modules/message/message.module';
import { ReviewModule } from './modules/review/review.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        MongooseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('MONGO_URI') || 'mongodb://localhost:27017/boardgame',
            }),
        }),
        CacheModule.registerAsync({
            isGlobal: true,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const redisHost = configService.get<string>('REDIS_HOST');
                const redisPort = configService.get<string>('REDIS_PORT');
                if (!redisHost && !redisPort) {
                    return {} as never;
                }
                return {
                    store: redisStore as unknown as never,
                    host: redisHost || 'localhost',
                    port: Number(redisPort || 6379),
                } as never;
            },
        }),
        AuthModule,
        FriendModule,
        MessageModule,
        InviteModule,
        ReviewModule,
        HealthModule,
    ],
})
export class AppModule {}
