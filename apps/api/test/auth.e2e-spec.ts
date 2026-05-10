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
import { AdminInitService } from '../src/modules/auth/admin-init.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AdminAuditLog, type AdminAuditLogDocument } from '../src/modules/auth/schemas/admin-audit-log.schema';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { GlobalHttpExceptionFilter } from '../src/shared/filters/http-exception.filter';

describe('AuthModule (e2e)', () => {

    let mongo: MongoMemoryServer | null;
    let app: import('@nestjs/common').INestApplication;
    let userModel: Model<UserDocument>;
    let authService: AuthService;
    let adminInitService: AdminInitService;
    let adminAuditModel: Model<AdminAuditLogDocument>;
    const ADMIN_EMAIL = 'admin@example.com';
    const ADMIN_PASSWORD = 'admin-pass-1234';
    const ADMIN_USERNAME = '管理员';

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
                MongooseModule.forRoot(mongoUri, externalMongoUri ? { dbName: 'boardgame_test_auth' } : undefined),
                AuthModule,
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        authService = moduleRef.get<AuthService>(AuthService);
        adminInitService = moduleRef.get<AdminInitService>(AdminInitService);
        adminAuditModel = moduleRef.get<Model<AdminAuditLogDocument>>(getModelToken(AdminAuditLog.name));
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
            adminAuditModel.deleteMany({}),
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

    it('初始化管理员（CLI）', async () => {
        const created = await adminInitService.initAdminOnce({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            username: ADMIN_USERNAME,
            actor: 'cli-test',
        });
        expect(created.status).toBe('created');

        const admin = await userModel.findOne({ email: ADMIN_EMAIL }).lean();
        expect(admin).toBeTruthy();
        expect(admin?.role).toBe('admin');
        expect(admin?.emailVerified).toBe(true);
        expect(admin?.username).toBe(ADMIN_USERNAME);

        const createdAgain = await adminInitService.initAdminOnce({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            username: ADMIN_USERNAME,
            actor: 'cli-test',
        });
        expect(createdAgain.status).toBe('exists');

        const auditCount = await adminAuditModel.countDocuments({ targetEmail: ADMIN_EMAIL });
        expect(auditCount).toBeGreaterThanOrEqual(2);
    });

    it('生产环境禁止初始化管理员', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        await expect(adminInitService.initAdminOnce({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            username: ADMIN_USERNAME,
            actor: 'cli-test',
        })).rejects.toThrow('生产环境禁止初始化管理员');
        process.env.NODE_ENV = originalEnv;
    });

    it('注册-登录-获取当前用户-登出流程', async () => {
        const email = 'test-user@example.com';
        const code = '123456';
        await authService.storeEmailCode(email, code);

        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'test-user', email, code, password: 'pass1234' })
            .expect(201);

        expect(registerRes.body.token).toBeDefined();
        expect(registerRes.body.user.username).toBe('test-user');

        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ account: email, password: 'pass1234' })
            .expect(200);

        expect(loginRes.body.success).toBe(true);
        const token = loginRes.body.data.token as string;
        expect(token).toBeDefined();

        await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(401);
    });

    it('登录后应下发长期 refresh cookie，并可在 access token 失效后续签', async () => {
        const email = 'refresh-user@example.com';
        const code = '123456';
        await authService.storeEmailCode(email, code);
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'refresh-user', email, code, password: 'pass1234' })
            .expect(201);

        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ account: email, password: 'pass1234' })
            .expect(200);

        const setCookieHeader = loginRes.headers['set-cookie'];
        expect(Array.isArray(setCookieHeader)).toBe(true);
        const refreshSetCookie = (setCookieHeader as string[]).find(cookie => cookie.startsWith('refresh_token='));
        expect(refreshSetCookie).toBeDefined();
        expect(refreshSetCookie).toContain('HttpOnly');

        const expiresMatch = refreshSetCookie?.match(/Expires=([^;]+)/);
        expect(expiresMatch?.[1]).toBeDefined();
        const refreshExpiresAt = new Date(expiresMatch![1]).getTime();
        expect(refreshExpiresAt - Date.now()).toBeGreaterThan(1000 * 60 * 60 * 24 * 150);

        const refreshCookie = refreshSetCookie!.split(';')[0];
        const refreshRes = await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Cookie', refreshCookie)
            .expect(200);

        expect(refreshRes.body.success).toBe(true);
        expect(refreshRes.body.code).toBe('AUTH_REFRESH_OK');
        expect(refreshRes.body.data.token).toBeDefined();

        const rotatedSetCookie = refreshRes.headers['set-cookie'];
        expect(Array.isArray(rotatedSetCookie)).toBe(true);
        const rotatedRefreshCookie = (rotatedSetCookie as string[]).find(cookie => cookie.startsWith('refresh_token='));
        expect(rotatedRefreshCookie).toBeDefined();
        expect(rotatedRefreshCookie!.split(';')[0]).not.toBe(refreshCookie);

        const reusedOldRefreshRes = await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Cookie', refreshCookie)
            .expect(200);

        expect(reusedOldRefreshRes.body.success).toBe(false);
        expect(reusedOldRefreshRes.body.code).toBe('AUTH_INVALID_TOKEN');
    });

    it('登录失败触发账号锁定', async () => {
        const email = 'lock-user@example.com';
        const code = '123456';
        await authService.storeEmailCode(email, code);
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'lock-user', email, code, password: 'pass1234' })
            .expect(201);

        const ip = '203.0.113.10';
        const attempts = [] as Array<{ success: boolean; code: string }>;
        // LOGIN_FAIL_MAX_COUNT = 10，需要 10 次失败才会锁定
        for (let i = 0; i < 10; i += 1) {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .set('x-forwarded-for', ip)
                .send({ account: email, password: 'wrong-pass' })
                .expect(200);
            attempts.push({ success: res.body.success, code: res.body.code });
        }

        expect(attempts[0].code).toBe('AUTH_INVALID_PASSWORD');
        expect(attempts[9].code).toBe('AUTH_LOGIN_LOCKED');
        expect(attempts[9].success).toBe(false);
    });

    it('修改昵称流程', async () => {
        const email = 'nickname-user@example.com';
        const code = '123456';
        await authService.storeEmailCode(email, code);

        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'old-name', email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token;
        expect(registerRes.body.user.username).toBe('old-name');

        // 正常修改昵称
        const updateRes = await request(app.getHttpServer())
            .post('/auth/update-username')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: '新昵称' })
            .expect(201);

        expect(updateRes.body.user.username).toBe('新昵称');

        // 验证 /me 也返回新昵称
        const meRes = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(meRes.body.user.username).toBe('新昵称');

        // 昵称太短应报错
        await request(app.getHttpServer())
            .post('/auth/update-username')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'a' })
            .expect(400);

        // 昵称太长应报错
        await request(app.getHttpServer())
            .post('/auth/update-username')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'a'.repeat(21) })
            .expect(400);

        // 未登录应报错
        await request(app.getHttpServer())
            .post('/auth/update-username')
            .send({ username: 'test' })
            .expect(401);
    });

    it('修改密码流程', async () => {
        const email = 'password-user@example.com';
        const code = '123456';
        await authService.storeEmailCode(email, code);

        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'pwd-user', email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token;

        // 正常修改密码
        await request(app.getHttpServer())
            .post('/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'pass1234', newPassword: 'newpass5678' })
            .expect(201);

        // 用新密码登录
        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ account: email, password: 'newpass5678' })
            .expect(200);

        expect(loginRes.body.success).toBe(true);

        // 用旧密码登录应失败
        const failRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ account: email, password: 'pass1234' })
            .expect(200);

        expect(failRes.body.success).toBe(false);
    });

    it('更新头像流程', async () => {
        const email = 'avatar-user@example.com';
        const code = '123456';
        await authService.storeEmailCode(email, code);

        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'test-user', email, code, password: 'pass1234' })
            .expect(201);

        const token = registerRes.body.token;

        const avatarUrl = 'https://example.com/avatar.png';
        const updateRes = await request(app.getHttpServer())
            .post('/auth/update-avatar')
            .set('Authorization', `Bearer ${token}`)
            .send({ avatar: avatarUrl })
            .expect(201);

        expect(updateRes.body.user.avatar).toBe(avatarUrl);

        const meRes = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(meRes.body.user.avatar).toBe(avatarUrl);
    });
});
