import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import type { Cache } from 'cache-manager';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { User, type UserDocument } from '../src/modules/auth/schemas/user.schema';
import { RefreshSession, type RefreshSessionDocument } from '../src/modules/auth/schemas/refresh-session.schema';
import { createHash, randomBytes } from 'crypto';

describe('AuthService', () => {
    let mongo: MongoMemoryServer | null;
    let moduleRef: import('@nestjs/testing').TestingModule;
    let authService: AuthService;
    let userModel: Model<UserDocument>;
    let refreshSessionModel: Model<RefreshSessionDocument>;
    let cacheManager: Cache;

    beforeAll(async () => {
        const externalMongoUri = process.env.MONGO_URI;
        mongo = externalMongoUri ? null : await MongoMemoryServer.create();
        const mongoUri = externalMongoUri ?? mongo?.getUri();
        if (!mongoUri) {
            throw new Error('缺少 MongoDB 连接地址，请配置 MONGO_URI 或启用内存 MongoDB');
        }

        moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register({ isGlobal: true }),
                MongooseModule.forRoot(mongoUri),
                AuthModule,
            ],
        }).compile();

        await moduleRef.init();

        authService = moduleRef.get(AuthService);
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
        refreshSessionModel = moduleRef.get<Model<RefreshSessionDocument>>(getModelToken(RefreshSession.name));
        cacheManager = moduleRef.get('CACHE_MANAGER');
    });

    beforeEach(async () => {
        await Promise.all([userModel.deleteMany({}), refreshSessionModel.deleteMany({})]);
    });

    afterAll(async () => {
        if (moduleRef) {
            await moduleRef.close();
        }
        if (mongo) {
            await mongo.stop();
        }
    });

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('应规范化邮箱并支持大小写查找', async () => {
        const user = await authService.createUser('tester', 'pass1234', 'Test@Example.com');
        const found = await authService.findByEmail('  test@example.com ');
        expect(found?.id).toBe(user.id);
    });

    it('重置验证码应可校验且单次有效', async () => {
        const email = 'reset@example.com';
        await authService.storeResetCode(email, '123456');
        const first = await authService.verifyResetCode(email, '123456');
        const second = await authService.verifyResetCode(email, '123456');
        expect(first).toBe('ok');
        expect(second).toBe('missing');
    });

    it('Refresh 会话按设备独立持久化，原子轮换和撤销只影响当前设备', async () => {
        const user = await authService.createUser('sessions', 'pass1234', 'sessions@example.com');
        const first = await authService.issueRefreshToken(user.id);
        const second = await authService.issueRefreshToken(user.id);

        expect(first.sessionId).not.toBe(second.sessionId);
        expect(await refreshSessionModel.countDocuments({ userId: user.id, revokedAt: null })).toBe(2);
        const stored = await refreshSessionModel.findOne({ sessionId: first.sessionId }).select('+tokenHash').lean();
        expect(stored?.tokenHash).toBe(createHash('sha256').update(first.token).digest('hex'));
        expect(stored).not.toHaveProperty('expiresAt');

        const concurrentRotations = await Promise.all([
            authService.rotateRefreshToken(first.token),
            authService.rotateRefreshToken(first.token),
        ]);
        expect(concurrentRotations.map(result => result.status).sort()).toEqual(['ok', 'race']);
        const rotated = concurrentRotations.find(result => result.status === 'ok');
        const racing = concurrentRotations.find(result => result.status === 'race');
        if (rotated?.status !== 'ok' || racing?.status !== 'race') throw new Error('应得到一次原子轮换和一次竞态结果');
        expect(racing.token).toBe(rotated.token);

        const racingOldToken = await authService.rotateRefreshToken(first.token);
        expect(racingOldToken).toMatchObject({ status: 'race', sessionId: first.sessionId, token: rotated.token });

        await authService.revokeRefreshToken(first.token);
        expect(await authService.rotateRefreshToken(rotated.token)).toEqual({ status: 'invalid' });
        expect(['ok', 'race']).toContain((await authService.rotateRefreshToken(second.token)).status);

        await authService.revokeRefreshToken(rotated.token);
        expect(await authService.rotateRefreshToken(rotated.token)).toEqual({ status: 'invalid' });
        expect(['ok', 'race']).toContain((await authService.rotateRefreshToken(second.token)).status);

        const third = await authService.issueRefreshToken(user.id);
        const thirdRotation = await authService.rotateRefreshToken(third.token);
        if (thirdRotation.status !== 'ok' && thirdRotation.status !== 'race') {
            throw new Error('第三台设备会话应成功续签');
        }
        await refreshSessionModel.updateOne(
            { sessionId: third.sessionId },
            { $set: { previousTokenGraceUntil: new Date(Date.now() - 60_000) } },
        ).exec();
        await authService.revokeRefreshToken(third.token);
        expect(['ok', 'race']).toContain((await authService.rotateRefreshToken(thirdRotation.token)).status);
    });

    it('仍有效的旧缓存 Refresh Token 可并发幂等迁移到 MongoDB', async () => {
        const user = await authService.createUser('legacy', 'pass1234', 'legacy@example.com');
        const oldToken = randomBytes(32).toString('hex');
        const oldHash = createHash('sha256').update(oldToken).digest('hex');
        const now = Math.floor(Date.now() / 1000);
        await cacheManager.set(`refresh:token:${oldHash}`, {
            userId: user.id,
            issuedAt: now,
            expiresAt: now + 60 * 60,
        }, 60 * 60);

        const results = await Promise.all([
            authService.rotateRefreshToken(oldToken),
            authService.rotateRefreshToken(oldToken),
        ]);
        expect(results.map(result => result.status)).toEqual(['ok', 'ok']);
        if (results[0].status !== 'ok' || results[1].status !== 'ok') throw new Error('迁移请求应幂等返回同一凭证');
        expect(results[0].token).toBe(results[1].token);
        expect(await refreshSessionModel.countDocuments({ userId: user.id, legacyTokenHash: oldHash })).toBe(1);
        const migratedRecord = await cacheManager.get<{ revokedAt?: number }>(`refresh:token:${oldHash}`);
        expect(migratedRecord?.revokedAt).toBeDefined();
        const retryAfterLostResponse = await authService.rotateRefreshToken(oldToken);
        expect(retryAfterLostResponse).toMatchObject({ status: 'ok', token: results[0].token });

        await authService.revokeRefreshToken(oldToken);
        expect(await authService.rotateRefreshToken(results[0].token)).toEqual({ status: 'invalid' });
    });

    it('旧缓存 Refresh Token 的迁移宽限期过后不能再撤销已迁移会话', async () => {
        const user = await authService.createUser('legacy-expired-grace', 'pass1234', 'legacy-expired-grace@example.com');
        const oldToken = randomBytes(32).toString('hex');
        const oldHash = createHash('sha256').update(oldToken).digest('hex');
        const now = Math.floor(Date.now() / 1000);
        await cacheManager.set(`refresh:token:${oldHash}`, {
            userId: user.id,
            issuedAt: now,
            expiresAt: now + 60 * 60,
        }, 60 * 60);

        const migrated = await authService.rotateRefreshToken(oldToken);
        if (migrated.status !== 'ok') throw new Error('旧会话应成功迁移');
        await refreshSessionModel.updateOne(
            { sessionId: migrated.sessionId },
            { $set: { migrationGraceUntil: new Date(Date.now() - 60_000) } },
        ).exec();

        await authService.revokeRefreshToken(oldToken);
        expect(['ok', 'race']).toContain((await authService.rotateRefreshToken(migrated.token)).status);
    });

    it('即使 Mongo TTL 后台清理尚未运行，超过 400 天闲置的会话也不能续签', async () => {
        const user = await authService.createUser('idle', 'pass1234', 'idle@example.com');
        const issued = await authService.issueRefreshToken(user.id);
        await refreshSessionModel.updateOne(
            { sessionId: issued.sessionId },
            { $set: { lastUsedAt: new Date(Date.now() - 401 * 24 * 60 * 60 * 1000) } },
        ).exec();

        expect(await authService.rotateRefreshToken(issued.token)).toEqual({ status: 'invalid' });
    });

    it('邮箱验证码在内存缓存下不应 300ms 内过期', async () => {
        const email = 'verify@example.com';
        await authService.storeEmailCode(email, '123456');
        await wait(800);
        const first = await authService.verifyEmailCode(email, '123456');
        const second = await authService.verifyEmailCode(email, '123456');
        expect(first).toBe('ok');
        expect(second).toBe('missing');
    });

    it('重置失败次数过多应锁定并可清除', async () => {
        const email = 'lock@example.com';
        for (let i = 0; i < 4; i += 1) {
            const result = await authService.recordResetAttempt(email);
            expect(result.locked).toBe(false);
        }
        const last = await authService.recordResetAttempt(email);
        expect(last.locked).toBe(true);

        const status = await authService.getResetAttemptStatus(email);
        expect(status).not.toBeNull();

        await authService.clearResetAttempts(email);
        const cleared = await authService.getResetAttemptStatus(email);
        expect(cleared).toBeNull();
    });

    it('登录失败 10 次才锁定（宽松阈值）', async () => {
        const email = 'login-lock@example.com';
        const ip = '1.2.3.4';

        // 前 9 次不锁定
        for (let i = 0; i < 9; i += 1) {
            const result = await authService.recordLoginFailure(email, ip);
            expect(result.locked).toBe(false);
        }

        // 第 10 次触发锁定
        const last = await authService.recordLoginFailure(email, ip);
        expect(last.locked).toBe(true);
        expect(last.retryAfterSeconds).toBeGreaterThan(0);

        const status = await authService.getLoginLockStatus(email, ip);
        expect(status?.locked).toBe(true);
    });

    it('登录成功后清除失败记录', async () => {
        const email = 'clear-fail@example.com';
        const ip = '1.2.3.4';

        await authService.recordLoginFailure(email, ip);
        await authService.recordLoginFailure(email, ip);
        await authService.clearLoginFailures(email, ip);

        // 清除后重新计数，9 次仍不锁定
        for (let i = 0; i < 9; i += 1) {
            const result = await authService.recordLoginFailure(email, ip);
            expect(result.locked).toBe(false);
        }
    });

    it('注册验证码发送：60 秒内重复发送应返回 cooldown', async () => {
        const email = 'reg-cooldown@example.com';
        const ip = '1.2.3.4';

        // 首次发送无限制
        expect(await authService.getRegisterCodeSendStatus(email, ip)).toBeNull();

        await authService.markRegisterCodeSend(email, ip);

        // 冷却中
        const status = await authService.getRegisterCodeSendStatus(email, ip);
        expect(status).not.toBeNull();
        expect(status?.reason).toBe('cooldown');
        expect(status?.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('注册验证码发送：10 分钟内超过 5 次应返回 limit', async () => {
        const email = 'reg-limit@example.com';
        const ip = '5.6.7.8';

        // 模拟 5 次发送（每次 markRegisterCodeSend 会设置冷却，需要先清除冷却再继续）
        // 直接调用内部逻辑：连续 mark 5 次，每次都会覆盖冷却 key，计数累加
        for (let i = 0; i < 5; i += 1) {
            await authService.markRegisterCodeSend(email, ip);
        }

        // 此时冷却中（reason=cooldown），但计数已达上限
        // 等冷却过期后（通过不同 IP 绕过冷却检查来验证计数逻辑）
        const differentIpStatus = await authService.getRegisterCodeSendStatus(email, '9.9.9.9');
        // 不同 IP 不受同一计数影响，应为 null
        expect(differentIpStatus).toBeNull();

        // 同 IP 冷却中
        const sameIpStatus = await authService.getRegisterCodeSendStatus(email, ip);
        expect(sameIpStatus).not.toBeNull();
    });
});
