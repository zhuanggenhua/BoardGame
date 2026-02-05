import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Model } from 'mongoose';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { UserSettingsModule } from '../src/modules/user-settings/user-settings.module';
import { UserAudioSettings, type UserAudioSettingsDocument } from '../src/modules/user-settings/schemas/user-audio-settings.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('UserSettings Module (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let settingsModel: Model<UserAudioSettingsDocument>;
    let authService: AuthService;

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_settings' } : undefined),
                AuthModule,
                UserSettingsModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        settingsModel = moduleRef.get<Model<UserAudioSettingsDocument>>(getModelToken(UserAudioSettings.name));
        authService = moduleRef.get<AuthService>(AuthService);
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
            })
        );
        app.useGlobalFilters(new GlobalHttpExceptionFilter());
        await app.init();
    });

    beforeEach(async () => {
        await Promise.all([
            userModel.deleteMany({}),
            settingsModel.deleteMany({}),
        ]);
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (mongo) {
            await mongo.stop();
        }
    });

    it('未登录访问 - unauthorized', async () => {
        await request(app.getHttpServer())
            .get('/auth/user-settings/audio')
            .expect(401);

        await request(app.getHttpServer())
            .put('/auth/user-settings/audio')
            .send({ muted: false, masterVolume: 1, sfxVolume: 1, bgmVolume: 1 })
            .expect(401);
    });

    it('读取与更新音频设置', async () => {
        const email = 'audio-user@example.com';
        const code = '123456';
        await authService.storeEmailCode(email, code);

        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'audio-user', email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token as string;
        const userId = registerRes.body.user.id as string;

        const emptyRes = await request(app.getHttpServer())
            .get('/auth/user-settings/audio')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(emptyRes.body.empty).toBe(true);
        expect(emptyRes.body.settings).toBeNull();

        const payload = { muted: true, masterVolume: 0.7, sfxVolume: 0.4, bgmVolume: 0.2 };
        const updateRes = await request(app.getHttpServer())
            .put('/auth/user-settings/audio')
            .set('Authorization', `Bearer ${token}`)
            .send(payload)
            .expect(201);

        expect(updateRes.body.settings).toMatchObject(payload);

        const getRes = await request(app.getHttpServer())
            .get('/auth/user-settings/audio')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(getRes.body.empty).toBe(false);
        expect(getRes.body.settings).toMatchObject(payload);

        const saved = await settingsModel.findOne({ userId }).lean();
        expect(saved).toBeTruthy();
        expect(saved?.muted).toBe(true);
        expect(saved?.masterVolume).toBe(payload.masterVolume);
    });

    it('参数校验 - invalid volume', async () => {
        const email = 'audio-user-2@example.com';
        const code = '654321';
        await authService.storeEmailCode(email, code);

        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'audio-user-2', email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token as string;

        await request(app.getHttpServer())
            .put('/auth/user-settings/audio')
            .set('Authorization', `Bearer ${token}`)
            .send({ muted: false, masterVolume: 1.5, sfxVolume: 0.5, bgmVolume: 0.5 })
            .expect(400);
    });
});
