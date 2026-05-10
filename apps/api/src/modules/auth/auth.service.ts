import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Cache } from 'cache-manager';
import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type { Model } from 'mongoose';
import { User, type UserDocument } from './schemas/user.schema';

const JWT_SECRET = process.env.JWT_SECRET || 'boardgame-secret-key-change-in-production';
// 登录态（JWT）有效期：30 天
const JWT_EXPIRES_IN = '30d';
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
// Refresh token 承担长期登录态续签，必须长于 Access Token。
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 180;
const REFRESH_TOKEN_PREFIX = 'refresh:token:';
const REFRESH_TOKEN_USER_PREFIX = 'refresh:user:';
const EMAIL_CODE_TTL_SECONDS = 5 * 60;
const RESET_CODE_TTL_SECONDS = 5 * 60;
const RESET_SEND_INTERVAL_SECONDS = 60;
const RESET_ATTEMPT_WINDOW_SECONDS = 10 * 60;
const RESET_MAX_ATTEMPTS = 5;
// 商业标准：10 分钟内失败 10 次触发锁定，锁定 15 分钟（宽松友好）
const LOGIN_FAIL_WINDOW_SECONDS = 10 * 60;
const LOGIN_FAIL_MAX_COUNT = 10;
const LOGIN_LOCK_SECONDS = 15 * 60;
const LOGIN_FAIL_PREFIX = 'login:fail:';
const LOGIN_LOCK_PREFIX = 'login:lock:';
const RESET_CODE_PREFIX = 'reset:code:';
const RESET_SEND_PREFIX = 'reset:send:';
const RESET_ATTEMPT_PREFIX = 'reset:attempt:';
// 注册验证码发送：60 秒冷却，同 IP 10 分钟内最多发 5 次
const REGISTER_CODE_SEND_INTERVAL_SECONDS = 60;
const REGISTER_CODE_SEND_MAX = 5;
const REGISTER_CODE_SEND_WINDOW_SECONDS = 10 * 60;
const REGISTER_CODE_SEND_PREFIX = 'register:send:';
const MEMORY_TTL_MAX_MS = 2_147_000_000;

type RefreshTokenRecord = {
    userId: string;
    issuedAt: number;
    expiresAt: number;
    revokedAt?: number;
    replacedBy?: string;
};

type LoginFailRecord = {
    count: number;
    firstFailedAt: number;
};

type ResetAttemptRecord = {
    count: number;
    firstFailedAt: number;
};

type CodeVerifyResult = 'ok' | 'missing' | 'mismatch';

export type RefreshTokenRotationResult =
    | { status: 'ok'; userId: string; token: string; expiresAt: number }
    | { status: 'reuse'; userId: string }
    | { status: 'invalid' };

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    normalizeEmail(email: string): string | null {
        const trimmed = email?.trim();
        if (!trimmed) return null;
        return trimmed.toLowerCase();
    }

    async findByEmail(email: string): Promise<UserDocument | null> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return null;
        return this.userModel.findOne({ email: normalized });
    }

    async findByEmailExcludingUser(email: string, userId: string): Promise<UserDocument | null> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return null;
        return this.userModel.findOne({ email: normalized, _id: { $ne: userId } });
    }

    // 登录仅支持邮箱：account 字段保留，但必须是邮箱格式
    async findByAccount(account: string): Promise<UserDocument | null> {
        const trimmed = account.trim();
        const emailRegex = /^\S+@\S+\.\S+$/;
        const normalized = this.normalizeEmail(trimmed);
        if (!normalized || !emailRegex.test(normalized)) {
            return null;
        }
        return this.userModel.findOne({ email: normalized });
    }

    async findById(userId: string): Promise<UserDocument | null> {
        return this.userModel.findById(userId).select('-password').exec() as Promise<UserDocument | null>;
    }

    async createUser(username: string, password: string, email: string): Promise<UserDocument> {
        const normalized = this.normalizeEmail(email);
        const user = new this.userModel({ username, password, email: normalized ?? email, emailVerified: true });
        return user.save();
    }

    async validateUserById(userId: string, password: string): Promise<UserDocument | null> {
        const user = await this.userModel.findById(userId);
        if (!user) return null;
        const isMatch = await (user as UserDocument).comparePassword(password);
        return isMatch ? user : null;
    }

    async validateUser(account: string, password: string): Promise<UserDocument | null> {
        const user = await this.findByAccount(account);
        if (!user) return null;
        const isMatch = await (user as UserDocument).comparePassword(password);
        return isMatch ? user : null;
    }

    async getLoginLockStatus(email: string, ip: string | null): Promise<{ locked: boolean; retryAfterSeconds: number } | null> {
        const lockKey = this.loginLockKey(email, ip);
        const lockedUntil = await this.cacheManager.get<number>(lockKey);
        if (!lockedUntil) {
            return null;
        }

        const nowSeconds = this.nowSeconds();
        const retryAfterSeconds = Math.max(lockedUntil - nowSeconds, 0);
        if (retryAfterSeconds <= 0) {
            await this.cacheManager.del(lockKey);
            return null;
        }

        return { locked: true, retryAfterSeconds };
    }

    async recordLoginFailure(email: string, ip: string | null): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
        const failKey = this.loginFailKey(email, ip);
        const nowSeconds = this.nowSeconds();
        const existing = await this.cacheManager.get<LoginFailRecord>(failKey);
        const firstFailedAt = existing?.firstFailedAt ?? nowSeconds;
        const nextCount = (existing?.count ?? 0) + 1;
        const ttlSeconds = Math.max(LOGIN_FAIL_WINDOW_SECONDS - (nowSeconds - firstFailedAt), 1);

        if (nextCount >= LOGIN_FAIL_MAX_COUNT) {
            const lockedUntil = nowSeconds + LOGIN_LOCK_SECONDS;
            await this.setCacheWithSeconds(this.loginLockKey(email, ip), lockedUntil, LOGIN_LOCK_SECONDS);
            await this.cacheManager.del(failKey);
            return { locked: true, retryAfterSeconds: LOGIN_LOCK_SECONDS };
        }

        await this.setCacheWithSeconds(failKey, { count: nextCount, firstFailedAt }, ttlSeconds);
        return { locked: false };
    }

    async clearLoginFailures(email: string, ip: string | null): Promise<void> {
        await Promise.all([
            this.cacheManager.del(this.loginFailKey(email, ip)),
            this.cacheManager.del(this.loginLockKey(email, ip)),
        ]);
    }

    async updatePassword(userId: string, newPassword: string): Promise<void> {
        // 直接 save() 以触发 schema 的 pre('save') hash。
        const user = await this.userModel.findById(userId);
        if (!user) return;
        user.password = newPassword;
        await user.save();
    }

    async updateEmail(userId: string, email: string): Promise<UserDocument | null> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return null;
        return this.userModel.findByIdAndUpdate(
            userId,
            { email: normalized, emailVerified: true },
            { new: true }
        );
    }

    async updateUsername(userId: string, username: string): Promise<UserDocument | null> {
        return this.userModel.findByIdAndUpdate(
            userId,
            { username },
            { new: true }
        );
    }

    async updateAvatar(userId: string, avatar: string): Promise<UserDocument | null> {
        return this.userModel.findByIdAndUpdate(
            userId,
            { avatar },
            { new: true }
        );
    }

    /**
     * 处理头像文件上传：裁剪为正方形、压缩为 WebP、保存到 uploads/avatars/
     */
    async uploadAvatarFile(
        userId: string,
        fileBuffer: Buffer,
        cropData?: { x: number; y: number; width: number; height: number }
    ): Promise<{ url: string; user: UserDocument } | null> {
        let sharpModule: typeof import('sharp');
        try {
            sharpModule = (await import('sharp')).default;
        } catch {
            throw new Error('图片处理库未安装，请安装 sharp');
        }

        const AVATAR_SIZE = 256;
        const AVATAR_QUALITY = 85;

        let pipeline = sharpModule(fileBuffer);

        // 前端传了裁剪区域则先裁剪
        if (cropData && cropData.width > 0 && cropData.height > 0) {
            pipeline = pipeline.extract({
                left: Math.round(cropData.x),
                top: Math.round(cropData.y),
                width: Math.round(cropData.width),
                height: Math.round(cropData.height),
            });
        }

        const outputBuffer = await pipeline
            .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
            .webp({ quality: AVATAR_QUALITY })
            .toBuffer();

        const { join } = await import('path');
        const { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } = await import('fs');

        const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
        if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `${userId}-${Date.now()}.webp`;
        const filePath = join(uploadsDir, fileName);
        writeFileSync(filePath, outputBuffer);

        // 清理该用户的旧头像文件
        const prefix = `${userId}-`;
        for (const file of readdirSync(uploadsDir)) {
            if (file.startsWith(prefix) && file !== fileName) {
                try { unlinkSync(join(uploadsDir, file)); } catch { /* 忽略 */ }
            }
        }

        const avatarUrl = `/assets/avatars/${fileName}`;
        const user = await this.userModel.findByIdAndUpdate(
            userId,
            { avatar: avatarUrl },
            { new: true }
        );

        if (!user) return null;
        return { url: avatarUrl, user };
    }

    createToken(user: UserDocument): string {
        return jwt.sign(
            { userId: user._id.toString(), username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    async issueRefreshToken(userId: string): Promise<{ token: string; expiresAt: number }> {
        const token = this.createRefreshToken();
        const tokenHash = this.hashRefreshToken(token);
        const nowSeconds = this.nowSeconds();
        const expiresAt = nowSeconds + REFRESH_TOKEN_TTL_SECONDS;
        const record: RefreshTokenRecord = {
            userId,
            issuedAt: nowSeconds,
            expiresAt,
        };

        const existingHash = await this.cacheManager.get<string>(this.refreshUserKey(userId));
        if (existingHash) {
            const existingRecord = await this.getRefreshTokenRecord(existingHash);
            if (existingRecord) {
                await this.markRefreshTokenRevoked(existingHash, existingRecord, tokenHash);
            }
        }

        await this.setCacheWithSeconds(this.refreshTokenKey(tokenHash), record, REFRESH_TOKEN_TTL_SECONDS);
        await this.setCacheWithSeconds(this.refreshUserKey(userId), tokenHash, REFRESH_TOKEN_TTL_SECONDS);

        return { token, expiresAt };
    }

    async rotateRefreshToken(refreshToken: string): Promise<RefreshTokenRotationResult> {
        const tokenHash = this.hashRefreshToken(refreshToken);
        const record = await this.getRefreshTokenRecord(tokenHash);
        if (!record) {
            return { status: 'invalid' };
        }

        if (record.revokedAt || record.replacedBy) {
            await this.revokeRefreshTokensForUser(record.userId);
            return { status: 'reuse', userId: record.userId };
        }

        const nowSeconds = this.nowSeconds();
        if (record.expiresAt <= nowSeconds) {
            await this.revokeRefreshTokensForUser(record.userId);
            return { status: 'invalid' };
        }

        const newToken = this.createRefreshToken();
        const newHash = this.hashRefreshToken(newToken);
        const newExpiresAt = nowSeconds + REFRESH_TOKEN_TTL_SECONDS;
        const newRecord: RefreshTokenRecord = {
            userId: record.userId,
            issuedAt: nowSeconds,
            expiresAt: newExpiresAt,
        };

        await this.setCacheWithSeconds(this.refreshTokenKey(newHash), newRecord, REFRESH_TOKEN_TTL_SECONDS);
        await this.setCacheWithSeconds(this.refreshUserKey(record.userId), newHash, REFRESH_TOKEN_TTL_SECONDS);
        await this.markRefreshTokenRevoked(tokenHash, record, newHash);

        return { status: 'ok', userId: record.userId, token: newToken, expiresAt: newExpiresAt };
    }

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        const tokenHash = this.hashRefreshToken(refreshToken);
        const record = await this.getRefreshTokenRecord(tokenHash);
        if (!record) {
            return;
        }

        await this.markRefreshTokenRevoked(tokenHash, record);
        const currentHash = await this.cacheManager.get<string>(this.refreshUserKey(record.userId));
        if (currentHash === tokenHash) {
            await this.cacheManager.del(this.refreshUserKey(record.userId));
        }
    }

    async revokeRefreshTokensForUser(userId: string): Promise<void> {
        const currentHash = await this.cacheManager.get<string>(this.refreshUserKey(userId));
        if (!currentHash) {
            return;
        }

        const record = await this.getRefreshTokenRecord(currentHash);
        if (record) {
            await this.markRefreshTokenRevoked(currentHash, record);
        }
        await this.cacheManager.del(this.refreshUserKey(userId));
    }

    async blacklistToken(token: string): Promise<void> {
        const ttlSeconds = this.resolveTokenTtlSeconds(token);
        await this.setCacheWithSeconds(`jwt:blacklist:${token}`, true, ttlSeconds);
    }

    async storeEmailCode(email: string, code: string): Promise<void> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return;
        await this.setCacheWithSeconds(`verify:email:${normalized}`, code, EMAIL_CODE_TTL_SECONDS);
    }

    async verifyEmailCode(email: string, code: string): Promise<CodeVerifyResult> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return 'missing';
        const stored = await this.cacheManager.get<string>(`verify:email:${normalized}`);
        if (!stored) return 'missing';
        if (stored !== code) return 'mismatch';
        await this.cacheManager.del(`verify:email:${normalized}`);
        return 'ok';
    }

    async storeResetCode(email: string, code: string): Promise<void> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return;
        await this.setCacheWithSeconds(this.resetCodeKey(normalized), code, RESET_CODE_TTL_SECONDS);
    }

    async verifyResetCode(email: string, code: string): Promise<CodeVerifyResult> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return 'missing';
        const stored = await this.cacheManager.get<string>(this.resetCodeKey(normalized));
        if (!stored) return 'missing';
        if (stored !== code) return 'mismatch';
        await this.cacheManager.del(this.resetCodeKey(normalized));
        return 'ok';
    }

    async getResetSendStatus(email: string, ip: string | null): Promise<{ retryAfterSeconds: number } | null> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return null;
        const key = this.resetSendKey(normalized, ip);
        const nextAllowed = await this.cacheManager.get<number>(key);
        if (!nextAllowed) return null;
        const retryAfterSeconds = Math.max(nextAllowed - this.nowSeconds(), 0);
        if (retryAfterSeconds <= 0) {
            await this.cacheManager.del(key);
            return null;
        }
        return { retryAfterSeconds };
    }

    async markResetSend(email: string, ip: string | null): Promise<void> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return;
        const nextAllowed = this.nowSeconds() + RESET_SEND_INTERVAL_SECONDS;
        await this.setCacheWithSeconds(this.resetSendKey(normalized, ip), nextAllowed, RESET_SEND_INTERVAL_SECONDS);
    }

    // 注册验证码发送速率限制：60 秒冷却 + 10 分钟内最多 5 次
    async getRegisterCodeSendStatus(email: string, ip: string | null): Promise<{ retryAfterSeconds: number; reason: 'cooldown' | 'limit' } | null> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return null;

        // 检查冷却时间
        const cooldownKey = this.registerCodeCooldownKey(normalized, ip);
        const nextAllowed = await this.cacheManager.get<number>(cooldownKey);
        if (nextAllowed) {
            const retryAfterSeconds = Math.max(nextAllowed - this.nowSeconds(), 0);
            if (retryAfterSeconds > 0) return { retryAfterSeconds, reason: 'cooldown' };
            await this.cacheManager.del(cooldownKey);
        }

        // 检查频率上限
        const countKey = this.registerCodeCountKey(normalized, ip);
        const record = await this.cacheManager.get<{ count: number; firstAt: number }>(countKey);
        if (record && record.count >= REGISTER_CODE_SEND_MAX) {
            const retryAfterSeconds = Math.max(REGISTER_CODE_SEND_WINDOW_SECONDS - (this.nowSeconds() - record.firstAt), 0);
            if (retryAfterSeconds > 0) return { retryAfterSeconds, reason: 'limit' };
            await this.cacheManager.del(countKey);
        }

        return null;
    }

    async markRegisterCodeSend(email: string, ip: string | null): Promise<void> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return;
        const nowSeconds = this.nowSeconds();

        // 设置冷却
        const nextAllowed = nowSeconds + REGISTER_CODE_SEND_INTERVAL_SECONDS;
        await this.setCacheWithSeconds(this.registerCodeCooldownKey(normalized, ip), nextAllowed, REGISTER_CODE_SEND_INTERVAL_SECONDS);

        // 累计计数
        const countKey = this.registerCodeCountKey(normalized, ip);
        const existing = await this.cacheManager.get<{ count: number; firstAt: number }>(countKey);
        const firstAt = existing?.firstAt ?? nowSeconds;
        const count = (existing?.count ?? 0) + 1;
        const ttl = Math.max(REGISTER_CODE_SEND_WINDOW_SECONDS - (nowSeconds - firstAt), 1);
        await this.setCacheWithSeconds(countKey, { count, firstAt }, ttl);
    }

    async getResetAttemptStatus(email: string): Promise<{ retryAfterSeconds: number } | null> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return null;
        const record = await this.cacheManager.get<ResetAttemptRecord>(this.resetAttemptKey(normalized));
        if (!record) return null;
        if (record.count < RESET_MAX_ATTEMPTS) return null;
        const retryAfterSeconds = Math.max(RESET_ATTEMPT_WINDOW_SECONDS - (this.nowSeconds() - record.firstFailedAt), 0);
        if (retryAfterSeconds <= 0) {
            await this.cacheManager.del(this.resetAttemptKey(normalized));
            return null;
        }
        return { retryAfterSeconds };
    }

    async recordResetAttempt(email: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return { locked: false };
        const nowSeconds = this.nowSeconds();
        const existing = await this.cacheManager.get<ResetAttemptRecord>(this.resetAttemptKey(normalized));
        const firstFailedAt = existing?.firstFailedAt ?? nowSeconds;
        const nextCount = (existing?.count ?? 0) + 1;
        const ttlSeconds = Math.max(RESET_ATTEMPT_WINDOW_SECONDS - (nowSeconds - firstFailedAt), 1);
        await this.setCacheWithSeconds(this.resetAttemptKey(normalized), { count: nextCount, firstFailedAt }, ttlSeconds);
        if (nextCount >= RESET_MAX_ATTEMPTS) {
            return { locked: true, retryAfterSeconds: ttlSeconds };
        }
        return { locked: false };
    }

    async clearResetAttempts(email: string): Promise<void> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return;
        await this.cacheManager.del(this.resetAttemptKey(normalized));
    }

    private resolveTokenTtlSeconds(token: string): number {
        const decoded = jwt.decode(token);
        if (decoded && typeof decoded === 'object' && 'exp' in decoded) {
            const exp = (decoded as { exp?: number }).exp;
            if (exp) {
                const ttl = Math.floor(exp - Date.now() / 1000);
                return ttl > 0 ? ttl : 1;
            }
        }
        return DEFAULT_TOKEN_TTL_SECONDS;
    }

    private createRefreshToken(): string {
        return randomBytes(32).toString('hex');
    }

    private hashRefreshToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    private refreshTokenKey(tokenHash: string): string {
        return `${REFRESH_TOKEN_PREFIX}${tokenHash}`;
    }

    private refreshUserKey(userId: string): string {
        return `${REFRESH_TOKEN_USER_PREFIX}${userId}`;
    }

    private loginFailKey(email: string, ip: string | null): string {
        return `${LOGIN_FAIL_PREFIX}${email.toLowerCase()}:${this.normalizeIpKey(ip)}`;
    }

    private loginLockKey(email: string, ip: string | null): string {
        return `${LOGIN_LOCK_PREFIX}${email.toLowerCase()}:${this.normalizeIpKey(ip)}`;
    }

    private resetCodeKey(email: string): string {
        return `${RESET_CODE_PREFIX}${email}`;
    }

    private resetSendKey(email: string, ip: string | null): string {
        return `${RESET_SEND_PREFIX}${email}:${this.normalizeIpKey(ip)}`;
    }

    private resetAttemptKey(email: string): string {
        return `${RESET_ATTEMPT_PREFIX}${email}`;
    }

    private registerCodeCooldownKey(email: string, ip: string | null): string {
        return `${REGISTER_CODE_SEND_PREFIX}cooldown:${email}:${this.normalizeIpKey(ip)}`;
    }

    private registerCodeCountKey(email: string, ip: string | null): string {
        return `${REGISTER_CODE_SEND_PREFIX}count:${email}:${this.normalizeIpKey(ip)}`;
    }

    private normalizeIpKey(ip: string | null): string {
        return (ip ?? 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
    }

    private nowSeconds(): number {
        return Math.floor(Date.now() / 1000);
    }

    private isRedisCacheStore(): boolean {
        const store = (this.cacheManager as Cache & { store?: { getClient?: () => unknown; client?: unknown } }).store;
        return Boolean(store?.getClient || store?.client);
    }

    private toStoreTtl(ttlSeconds: number): number {
        const safeSeconds = Math.max(Math.floor(ttlSeconds), 1);
        if (this.isRedisCacheStore()) {
            return safeSeconds;
        }
        return Math.min(safeSeconds * 1000, MEMORY_TTL_MAX_MS);
    }

    private async setCacheWithSeconds<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        await this.cacheManager.set(key, value, this.toStoreTtl(ttlSeconds));
    }

    private async getRefreshTokenRecord(tokenHash: string): Promise<RefreshTokenRecord | null> {
        const record = await this.cacheManager.get<RefreshTokenRecord>(this.refreshTokenKey(tokenHash));
        return record ?? null;
    }

    private resolveRefreshTokenTtlSeconds(expiresAt: number): number {
        const ttl = Math.floor(expiresAt - Date.now() / 1000);
        return ttl > 0 ? ttl : 1;
    }

    private async markRefreshTokenRevoked(
        tokenHash: string,
        record: RefreshTokenRecord,
        replacedBy?: string
    ): Promise<void> {
        const revokedAt = record.revokedAt ?? this.nowSeconds();
        const updated: RefreshTokenRecord = {
            ...record,
            revokedAt,
            replacedBy: replacedBy ?? record.replacedBy,
        };

        await this.setCacheWithSeconds(
            this.refreshTokenKey(tokenHash),
            updated,
            this.resolveRefreshTokenTtlSeconds(record.expiresAt)
        );
    }
}
