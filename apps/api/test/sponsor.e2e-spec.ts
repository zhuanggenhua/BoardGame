import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { SponsorModule } from '../src/modules/sponsor/sponsor.module';
import { Sponsor, type SponsorDocument } from '../src/modules/sponsor/sponsor.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Sponsor Module (e2e)', () => {
    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let sponsorModel: Model<SponsorDocument>;
    let cacheManager: Cache;
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
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_sponsor' } : undefined),
                AuthModule,
                SponsorModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        sponsorModel = moduleRef.get<Model<SponsorDocument>>(getModelToken(Sponsor.name));
        cacheManager = moduleRef.get<Cache>(CACHE_MANAGER);
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
            sponsorModel.deleteMany({}),
        ]);
        await cacheManager.reset();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (mongo) {
            await mongo.stop();
        }
    });

    const seedAdmin = async () => {
        const adminEmail = 'admin-sponsor@example.com';
        const adminCode = '123456';
        await authService.storeEmailCode(adminEmail, adminCode);
        const adminRegister = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'admin-sponsor', email: adminEmail, code: adminCode, password: 'pass1234' })
            .expect(201);

        const adminToken = adminRegister.body.token as string;
        const adminId = adminRegister.body.user.id as string;
        await userModel.updateOne({ _id: adminId }, { role: 'admin' });
        return adminToken;
    };

    it('公开列表按置顶 + 创建时间排序', async () => {
        await sponsorModel.create({ name: '普通赞助', amount: 10, isPinned: false });
        await sleep(5);
        await sponsorModel.create({ name: '置顶赞助-A', amount: 99, isPinned: true });
        await sleep(5);
        await sponsorModel.create({ name: '置顶赞助-B', amount: 199, isPinned: true });

        const res = await request(app.getHttpServer())
            .get('/sponsors?limit=10')
            .expect(200);

        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(10);
        expect(res.body.hasMore).toBe(false);
        expect(res.body.items.length).toBe(3);
        expect(Object.prototype.hasOwnProperty.call(res.body.items[0], 'avatar')).toBe(false);
        expect(res.body.items[0].name).toBe('置顶赞助-B');
        expect(res.body.items[1].name).toBe('置顶赞助-A');
        expect(res.body.items[2].name).toBe('普通赞助');
    });

    it('管理员创建/更新/删除赞助', async () => {
        const adminToken = await seedAdmin();

        const createRes = await request(app.getHttpServer())
            .post('/admin-api/sponsors')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: '新赞助者', amount: 88, isPinned: true })
            .expect(201);

        const sponsorId = createRes.body.id as string;
        expect(createRes.body.name).toBe('新赞助者');
        expect(createRes.body.isPinned).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(createRes.body, 'avatar')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(createRes.body, 'message')).toBe(false);

        const updateRes = await request(app.getHttpServer())
            .patch(`/admin-api/sponsors/${sponsorId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ amount: 100, isPinned: false })
            .expect(200);

        expect(updateRes.body.amount).toBe(100);
        expect(updateRes.body.isPinned).toBe(false);

        await request(app.getHttpServer())
            .delete(`/admin-api/sponsors/${sponsorId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const listRes = await request(app.getHttpServer())
            .get('/admin-api/sponsors')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(listRes.body.items.length).toBe(0);
    });
});
