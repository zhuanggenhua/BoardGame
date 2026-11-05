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
import { UserUISettings, type UserUISettingsDocument } from '../src/modules/user-settings/schemas/user-ui-settings.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('UserSettings Module (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let settingsModel: Model<UserAudioSettingsDocument>;
    let uiSettingsModel: Model<UserUISettingsDocument>;
    let authService: AuthService;

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI?.trim() || undefined;
        // Tests use the returned loopback TCP URI; no UNIX socket is needed.
        mongo = externalMongoUri ? null : await MongoMemoryServer.create({
            instance: { args: process.platform === 'win32' ? [] : ['--nounixsocket'] },
        });
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
        uiSettingsModel = moduleRef.get<Model<UserUISettingsDocument>>(getModelToken(UserUISettings.name));
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
            uiSettingsModel.deleteMany({}),
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

        const payload = {
            muted: true,
            masterVolume: 0.7,
            sfxVolume: 0.4,
            bgmVolume: 0.2,
            singleTrackLoop: true,
            bgmSelections: {
                summonerwars: { normal: 'bgm_key_a', battle: 'bgm_key_b' },
            },
        };
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
        expect(saved?.singleTrackLoop).toBe(true);
        expect(saved?.bgmSelections).toMatchObject(payload.bgmSelections);
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

    it('读取与更新本地 AI 开局偏好', async () => {
        const email = 'local-ai-user@example.com';
        const code = '999888';
        await authService.storeEmailCode(email, code);

        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'local-ai-user', email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token as string;
        const userId = registerRes.body.user.id as string;

        const emptyRes = await request(app.getHttpServer())
            .get('/auth/user-settings/local-ai/smashup')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(emptyRes.body.empty).toBe(true);
        expect(emptyRes.body.settings).toBeNull();

        const payload = {
            numPlayers: 3,
            seatControllers: {
                '1': { type: 'local-ai', policyId: 'opening-v1' },
                '2': { type: 'human' },
            },
            setupSelections: {
                expansions: ['titans'],
            },
        };

        const updateRes = await request(app.getHttpServer())
            .put('/auth/user-settings/local-ai/smashup')
            .set('Authorization', `Bearer ${token}`)
            .send(payload)
            .expect(201);

        expect(updateRes.body.settings).toMatchObject(payload);

        const getRes = await request(app.getHttpServer())
            .get('/auth/user-settings/local-ai/smashup')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(getRes.body.empty).toBe(false);
        expect(getRes.body.settings).toMatchObject(payload);

        const saved = await uiSettingsModel.findOne({ userId }).lean();
        expect(saved?.localAiMatchPreferences?.smashup).toMatchObject(payload);
    });

    async function registerLibraryUser(suffix: string) {
        const email = `library-${suffix}@example.com`;
        const code = '246810';
        await authService.storeEmailCode(email, code);
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: `library-${suffix}`, email, code, password: 'pass1234' })
            .expect(201);
        return { token: response.body.token as string, userId: response.body.user.id as string };
    }

    it('收藏接口拒绝未登录读取与写入', async () => {
        await request(app.getHttpServer()).get('/auth/user-settings/library').expect(401);
        await request(app.getHttpServer()).put('/auth/user-settings/library')
            .send({ gameId: 'betrayal', favorite: true }).expect(401);
        expect(await uiSettingsModel.countDocuments()).toBe(0);
    });

    it('收藏增删去重后持久化，账户隔离且不覆盖其他设置', async () => {
        const alice = await registerLibraryUser('alice');
        const bob = await registerLibraryUser('bob');
        const read = (token: string) => request(app.getHttpServer())
            .get('/auth/user-settings/library').set('Authorization', `Bearer ${token}`);
        const write = (token: string, gameId: string, favorite: boolean) => request(app.getHttpServer())
            .put('/auth/user-settings/library').set('Authorization', `Bearer ${token}`)
            .send({ gameId, favorite });
        expect((await read(alice.token).expect(200)).body.gameIds).toEqual([]);
        const preferences = { numPlayers: 3, seatControllers: { '1': { type: 'local-ai', policyId: 'opening-v1' } } };
        await request(app.getHttpServer()).put('/auth/user-settings/local-ai/smashup')
            .set('Authorization', `Bearer ${alice.token}`).send(preferences).expect(201);
        await write(alice.token, 'betrayal', true).expect(200);
        await write(alice.token, 'fate-domination', true).expect(200);
        const duplicate = await write(alice.token, 'betrayal', true).expect(200);
        expect(duplicate.body.gameIds).toHaveLength(2);
        expect(duplicate.body.gameIds).toEqual(expect.arrayContaining(['betrayal', 'fate-domination']));
        await write(alice.token, 'betrayal', false).expect(200);
        expect((await read(alice.token).expect(200)).body.gameIds).toEqual(['fate-domination']);
        expect((await read(bob.token).expect(200)).body.gameIds).toEqual([]);
        await write(bob.token, 'betrayal', true).expect(200);
        expect((await read(bob.token).expect(200)).body.gameIds).toEqual(['betrayal']);
        expect((await read(alice.token).expect(200)).body.gameIds).toEqual(['fate-domination']);
        const saved = await uiSettingsModel.findOne({ userId: alice.userId }).lean();
        expect(saved?.favoriteGameIds).toEqual(['fate-domination']);
        expect(saved?.localAiMatchPreferences?.smashup).toMatchObject(preferences);
        const settings = await request(app.getHttpServer()).get('/auth/user-settings/local-ai/smashup')
            .set('Authorization', `Bearer ${alice.token}`).expect(200);
        expect(settings.body.settings).toMatchObject(preferences);
    });

    it('收藏拒绝非法参数且不污染已保存集合', async () => {
        const { token } = await registerLibraryUser('validation');
        const write = (body: Record<string, unknown>) => request(app.getHttpServer())
            .put('/auth/user-settings/library').set('Authorization', `Bearer ${token}`).send(body);
        await write({ gameId: 'betrayal', favorite: true }).expect(200);
        for (const body of [
            { gameId: '', favorite: true },
            { gameId: '../betrayal', favorite: true },
            { gameId: 'x'.repeat(129), favorite: true },
            { gameId: 'betrayal', favorite: 'false' },
            { gameId: 'betrayal', favorite: 1 },
            { gameId: 'betrayal' },
        ]) await write(body).expect(400);
        const result = await request(app.getHttpServer()).get('/auth/user-settings/library')
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(result.body.gameIds).toEqual(['betrayal']);
    });

});
