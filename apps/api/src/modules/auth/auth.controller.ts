import { Body, Controller, Get, Inject, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { createRequestI18n } from '../../shared/i18n';
import { generateCode, sendPasswordResetEmailWithCode, sendVerificationEmailWithCode } from '../../../../../src/server/email';
import { AuthService } from './auth.service';
import { serializeDeveloperGameIds } from './schemas/developer-game-access';
import { ChangePasswordDto, LoginDto, RegisterDto, SendEmailCodeDto, SendRegisterCodeDto, SendResetCodeDto, ResetPasswordDto, VerifyEmailDto, UpdateAvatarDto, UpdateUsernameDto } from './dtos/auth.dto';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/auth';

const serializeBackofficeRole = (user: {
    role: 'user' | 'developer' | 'admin';
    developerGameIds?: string[];
}) => {
    const developerGameIds = serializeDeveloperGameIds(user.role, user.developerGameIds);

    return developerGameIds !== undefined
        ? { role: user.role, developerGameIds }
        : { role: user.role };
};

@Controller('auth')
export class AuthController {
    constructor(@Inject(AuthService) private readonly authService: AuthService) { }

    @Post('send-register-code')
    async sendRegisterCode(@Body() body: SendRegisterCodeDto, @Req() req: Request, @Res() res: Response) {
        const { t, locale } = createRequestI18n(req);
        const email = body.email?.trim();

        if (!email) {
            return this.sendError(res, 400, t('auth.error.missingEmail'));
        }

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return this.sendError(res, 400, t('auth.error.invalidEmail'));
        }

        // 速率限制：60 秒冷却 + 10 分钟内最多 5 次
        const clientIp = this.resolveClientIp(req);
        const sendStatus = await this.authService.getRegisterCodeSendStatus(email, clientIp);
        if (sendStatus) {
            const minutes = Math.ceil(sendStatus.retryAfterSeconds / 60);
            const seconds = sendStatus.retryAfterSeconds;
            const message = seconds < 60
                ? t('auth.error.registerCodeSendTooFrequent', { seconds })
                : t('auth.error.registerCodeSendLimited', { minutes });
            return this.sendError(res, 429, message);
        }

        const existingUser = await this.authService.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                error: t('auth.error.emailAlreadyRegistered'),
                suggestLogin: true,
            });
        }

        const code = generateCode();
        const result = await sendVerificationEmailWithCode(email, code, locale);
        if (!result.success) {
            return this.sendError(res, 500, result.message);
        }

        await this.authService.storeEmailCode(email, code);
        await this.authService.markRegisterCodeSend(email, clientIp);

        return res.json({ message: result.message });
    }

    @Post('send-reset-code')
    async sendResetCode(@Body() body: SendResetCodeDto, @Req() req: Request, @Res() res: Response) {
        const { t, locale } = createRequestI18n(req);
        const email = body.email?.trim();

        if (!email) {
            return this.sendError(res, 400, t('auth.error.missingEmail'));
        }

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return this.sendError(res, 400, t('auth.error.invalidEmail'));
        }

        const clientIp = this.resolveClientIp(req);
        const sendStatus = await this.authService.getResetSendStatus(email, clientIp);
        if (sendStatus) {
            return this.sendError(res, 429, t('auth.error.resetSendTooFrequent', { seconds: sendStatus.retryAfterSeconds }));
        }

        const existingUser = await this.authService.findByEmail(email);
        if (!existingUser) {
            await this.authService.markResetSend(email, clientIp);
            return this.sendError(res, 404, t('auth.error.emailNotRegistered'));
        }

        const code = generateCode();
        const result = await sendPasswordResetEmailWithCode(email, code, locale);
        if (!result.success) {
            return this.sendError(res, 500, result.message);
        }

        await this.authService.storeResetCode(email, code);
        await this.authService.markResetSend(email, clientIp);
        return res.json({ message: t('auth.success.resetCodeSent') });
    }

    @Post('register')
    async register(@Body() body: RegisterDto, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const { username, email, code, password } = body;

        if (!username || !email || !code || !password) {
            return this.sendError(res, 400, t('auth.error.missingRegisterFields'));
        }

        if (username.length < 2 || username.length > 20) {
            return this.sendError(res, 400, t('auth.error.usernameLength'));
        }

        if (password.length < 4) {
            return this.sendError(res, 400, t('auth.error.passwordLength'));
        }

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return this.sendError(res, 400, t('auth.error.invalidEmail'));
        }

        // 验证邮箱验证码
        const emailCodeStatus = await this.authService.verifyEmailCode(email, code);
        if (emailCodeStatus !== 'ok') {
            const messageKey = emailCodeStatus === 'missing'
                ? 'auth.error.emailCodeExpired'
                : 'auth.error.emailCodeMismatch';
            return this.sendError(res, 400, t(messageKey));
        }

        // username 不再要求唯一（仅昵称）；邮箱仍为唯一标识。
        const existingEmail = await this.authService.findByEmail(email);
        if (existingEmail) {
            return res.status(409).json({
                error: t('auth.error.emailAlreadyRegistered'),
                suggestLogin: true,
            });
        }

        const user = await this.authService.createUser(username, password, email);
        const token = this.authService.createToken(user);
        const refreshToken = await this.authService.issueRefreshToken(user._id.toString());
        this.setRefreshCookie(res, refreshToken.token, refreshToken.expiresAt);

        return res.status(201).json({
            message: t('auth.success.register'),
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                emailVerified: user.emailVerified,
                ...serializeBackofficeRole(user),
                banned: user.banned,
                feedbackPoints: user.feedbackPoints ?? 0,
            },
            token,
        });
    }

    @Post('reset-password')
    async resetPassword(@Body() body: ResetPasswordDto, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const email = body.email?.trim();
        const code = body.code?.trim();
        const newPassword = body.newPassword ?? '';

        if (!email || !code || !newPassword) {
            return this.sendError(res, 400, t('auth.error.missingResetFields'));
        }

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return this.sendError(res, 400, t('auth.error.invalidEmail'));
        }

        if (newPassword.length < 4) {
            return this.sendError(res, 400, t('auth.error.passwordLength'));
        }

        const attemptStatus = await this.authService.getResetAttemptStatus(email);
        if (attemptStatus) {
            return this.sendError(res, 429, t('auth.error.resetLocked', { seconds: attemptStatus.retryAfterSeconds }));
        }

        const resetCodeStatus = await this.authService.verifyResetCode(email, code);
        if (resetCodeStatus !== 'ok') {
            const failure = await this.authService.recordResetAttempt(email);
            if (failure.locked) {
                return this.sendError(res, 429, t('auth.error.resetLocked', { seconds: failure.retryAfterSeconds ?? 0 }));
            }
            const messageKey = resetCodeStatus === 'missing'
                ? 'auth.error.resetCodeExpired'
                : 'auth.error.resetCodeMismatch';
            return this.sendError(res, 400, t(messageKey));
        }

        const user = await this.authService.findByEmail(email);
        if (!user) {
            return this.sendError(res, 400, t('auth.error.invalidResetCode'));
        }

        await this.authService.updatePassword(user._id.toString(), newPassword);
        await this.authService.clearResetAttempts(email);
        await this.authService.revokeRefreshTokensForUser(user._id.toString());

        return res.json({ message: t('auth.success.passwordReset') });
    }

    @Post('login')
    async login(@Body() body: LoginDto, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const { account, password } = body;

        if (!account || !password) {
            return this.sendAuthFailure(res, 'AUTH_MISSING_CREDENTIALS', t('auth.error.missingCredentials'));
        }

        const trimmedAccount = account.trim();
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(trimmedAccount)) {
            return this.sendAuthFailure(res, 'AUTH_INVALID_EMAIL', t('auth.error.invalidEmail'));
        }

        const clientIp = this.resolveClientIp(req);
        const lockStatus = await this.authService.getLoginLockStatus(trimmedAccount, clientIp);
        if (lockStatus) {
            const minutes = Math.ceil(lockStatus.retryAfterSeconds / 60);
            return this.sendAuthFailure(res, 'AUTH_LOGIN_LOCKED', t('auth.error.loginLocked', { minutes }), {
                retryAfterSeconds: lockStatus.retryAfterSeconds,
            });
        }

        // 先检查邮箱是否存在
        const existingUser = await this.authService.findByEmail(trimmedAccount);
        if (!existingUser) {
            return this.sendAuthFailure(res, 'AUTH_EMAIL_NOT_REGISTERED', t('auth.error.emailNotRegisteredLogin'), {
                suggestRegister: true,
            });
        }

        const user = await this.authService.validateUser(trimmedAccount, password);
        if (!user) {
            const failure = await this.authService.recordLoginFailure(trimmedAccount, clientIp);
            if (failure.locked) {
                const minutes = Math.ceil((failure.retryAfterSeconds ?? 0) / 60);
                return this.sendAuthFailure(res, 'AUTH_LOGIN_LOCKED', t('auth.error.loginLocked', { minutes }), {
                    retryAfterSeconds: failure.retryAfterSeconds ?? 0,
                });
            }
            return this.sendAuthFailure(res, 'AUTH_INVALID_PASSWORD', t('auth.error.invalidPassword'));
        }

        await this.authService.clearLoginFailures(trimmedAccount, clientIp);
        const token = this.authService.createToken(user);
        const refreshToken = await this.authService.issueRefreshToken(user._id.toString());
        this.setRefreshCookie(res, refreshToken.token, refreshToken.expiresAt);

        return this.sendAuthSuccess(res, 'AUTH_LOGIN_OK', t('auth.success.login'), {
            token,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                emailVerified: user.emailVerified,
                ...serializeBackofficeRole(user),
                banned: user.banned,
                feedbackPoints: user.feedbackPoints ?? 0,
            },
        });
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async me(@CurrentUser() currentUser: { userId: string } | null, @Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.invalidToken'));
        }

        const user = await this.authService.findById(currentUser.userId);
        if (!user) {
            return this.sendError(res, 404, t('auth.error.userNotFound'));
        }

        return res.json({
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                emailVerified: user.emailVerified,
                lastOnline: user.lastOnline ?? null,
                avatar: user.avatar ?? null,
                ...serializeBackofficeRole(user),
                banned: user.banned,
                bannedAt: user.bannedAt ?? null,
                bannedReason: user.bannedReason ?? null,
                feedbackPoints: user.feedbackPoints ?? 0,
                createdAt: user.createdAt,
            },
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('send-email-code')
    async sendEmailCode(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: SendEmailCodeDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t, locale } = createRequestI18n(req);
        const email = body.email?.trim();

        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }

        if (!email) {
            return this.sendError(res, 400, t('auth.error.missingEmail'));
        }

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return this.sendError(res, 400, t('auth.error.invalidEmail'));
        }

        const existingUser = await this.authService.findByEmailExcludingUser(email, currentUser.userId);
        if (existingUser) {
            return this.sendError(res, 409, t('auth.error.emailAlreadyBound'));
        }

        const code = generateCode();
        const result = await sendVerificationEmailWithCode(email, code, locale);
        if (!result.success) {
            return this.sendError(res, 500, result.message);
        }

        await this.authService.storeEmailCode(email, code);

        return res.json({ message: result.message });
    }

    @UseGuards(JwtAuthGuard)
    @Post('verify-email')
    async verifyEmail(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: VerifyEmailDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        const email = body.email?.trim();
        const code = body.code?.trim();

        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }

        if (!email || !code) {
            return this.sendError(res, 400, t('auth.error.missingEmailCode'));
        }

        const emailCodeStatus = await this.authService.verifyEmailCode(email, code);
        if (emailCodeStatus !== 'ok') {
            const messageKey = emailCodeStatus === 'missing'
                ? 'auth.error.emailCodeExpired'
                : 'auth.error.emailCodeMismatch';
            return this.sendError(res, 400, t(messageKey));
        }

        const user = await this.authService.updateEmail(currentUser.userId, email);
        if (!user) {
            return this.sendError(res, 404, t('auth.error.userNotFound'));
        }

        return res.json({
            message: t('auth.success.emailBound'),
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                emailVerified: user.emailVerified,
                ...serializeBackofficeRole(user),
                banned: user.banned,
                feedbackPoints: user.feedbackPoints ?? 0,
            },
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('update-username')
    async updateUsername(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: UpdateUsernameDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }

        const username = body.username?.trim();
        if (!username || username.length < 2 || username.length > 20) {
            return this.sendError(res, 400, t('auth.error.usernameLength'));
        }

        const user = await this.authService.updateUsername(currentUser.userId, username);
        if (!user) {
            return this.sendError(res, 404, t('auth.error.userNotFound'));
        }

        // 用户名变更后签发新 JWT（JWT payload 包含 username 字段）
        const token = this.authService.createToken(user);

        return res.json({
            message: t('auth.success.usernameUpdated'),
            user: {
                id: user._id.toString(),
                username: user.username,
                avatar: user.avatar,
                email: user.email,
                emailVerified: user.emailVerified,
                ...serializeBackofficeRole(user),
                banned: user.banned,
                feedbackPoints: user.feedbackPoints ?? 0,
            },
            token,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('update-avatar')
    async updateAvatar(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: UpdateAvatarDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }

        const user = await this.authService.updateAvatar(currentUser.userId, body.avatar);
        if (!user) {
            return this.sendError(res, 404, t('auth.error.userNotFound'));
        }

        return res.json({
            message: t('auth.success.avatarUpdated') || 'Avatar updated',
            user: {
                id: user._id.toString(),
                username: user.username,
                avatar: user.avatar,
                ...serializeBackofficeRole(user),
                banned: user.banned,
                feedbackPoints: user.feedbackPoints ?? 0,
            },
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('upload-avatar')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    async uploadAvatar(
        @CurrentUser() currentUser: { userId: string } | null,
        @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype?: string; size: number } | undefined,
        @Body() body: { cropX?: string; cropY?: string; cropWidth?: string; cropHeight?: string },
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }
        if (!file) {
            return this.sendError(res, 400, t('auth.error.avatarMissingFile'));
        }

        // 校验文件类型
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (file.mimetype && !allowedMimes.includes(file.mimetype)) {
            return this.sendError(res, 400, t('auth.error.avatarInvalidType'));
        }

        // 解析裁剪参数（FormData 传过来的是字符串）
        const cropData = (body.cropWidth && body.cropHeight)
            ? {
                x: Number(body.cropX) || 0,
                y: Number(body.cropY) || 0,
                width: Number(body.cropWidth) || 0,
                height: Number(body.cropHeight) || 0,
            }
            : undefined;

        try {
            const result = await this.authService.uploadAvatarFile(
                currentUser.userId,
                file.buffer,
                cropData
            );
            if (!result) {
                return this.sendError(res, 404, t('auth.error.userNotFound'));
            }

            return res.json({
                message: t('auth.success.avatarUpdated') || 'Avatar updated',
                user: {
                    id: result.user._id.toString(),
                    username: result.user.username,
                    avatar: result.user.avatar,
                    ...serializeBackofficeRole(result.user),
                    banned: result.user.banned,
                    feedbackPoints: result.user.feedbackPoints ?? 0,
                },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : t('auth.error.avatarUploadFailed');
            return this.sendError(res, 500, message);
        }
    }

    @Post('refresh')
    async refresh(@Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const refreshToken = this.extractRefreshToken(req);
        if (!refreshToken) {
            return this.sendAuthFailure(res, 'AUTH_MISSING_TOKEN', t('auth.error.missingToken'));
        }

        const rotation = await this.authService.rotateRefreshToken(refreshToken);
        if (rotation.status === 'invalid' || rotation.status === 'reuse') {
            this.clearRefreshCookie(res);
            return this.sendAuthFailure(res, 'AUTH_INVALID_TOKEN', t('auth.error.invalidToken'));
        }

        const user = await this.authService.findById(rotation.userId);
        if (!user) {
            await this.authService.revokeRefreshTokensForUser(rotation.userId);
            this.clearRefreshCookie(res);
            return this.sendAuthFailure(res, 'AUTH_USER_NOT_FOUND', t('auth.error.userNotFound'));
        }

        const token = this.authService.createToken(user);
        this.setRefreshCookie(res, rotation.token, rotation.expiresAt);

        return this.sendAuthSuccess(res, 'AUTH_REFRESH_OK', t('auth.success.refreshToken'), { token });
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Req() req: Request, @Res() res: Response) {
        const { t } = createRequestI18n(req);
        const token = this.extractToken(req);

        if (!token) {
            return this.sendAuthFailure(res, 'AUTH_MISSING_TOKEN', t('auth.error.missingToken'));
        }

        await this.authService.blacklistToken(token);
        const refreshToken = this.extractRefreshToken(req);
        if (refreshToken) {
            await this.authService.revokeRefreshToken(refreshToken);
        }
        this.clearRefreshCookie(res);
        return this.sendAuthSuccess(res, 'AUTH_LOGOUT_OK', t('auth.success.logout'), {});
    }

    @UseGuards(JwtAuthGuard)
    @Post('change-password')
    async changePassword(
        @CurrentUser() currentUser: { userId: string } | null,
        @Body() body: ChangePasswordDto,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { t } = createRequestI18n(req);
        if (!currentUser?.userId) {
            return this.sendError(res, 401, t('auth.error.loginRequired'));
        }

        const currentPassword = body.currentPassword ?? '';
        const newPassword = body.newPassword ?? '';

        if (!currentPassword || !newPassword) {
            return this.sendError(res, 400, t('auth.error.missingPasswordFields'));
        }

        if (newPassword.length < 4) {
            return this.sendError(res, 400, t('auth.error.passwordLength'));
        }

        const user = await this.authService.validateUserById(currentUser.userId, currentPassword);
        if (!user) {
            return this.sendError(res, 401, t('auth.error.invalidCredentials'));
        }

        await this.authService.updatePassword(currentUser.userId, newPassword);
        return res.json({ message: t('auth.success.passwordUpdated') });
    }

    private extractToken(request: Request): string | null {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.slice(7);
    }

    private extractRefreshToken(request: Request): string | null {
        const cookieHeader = request.headers.cookie;
        if (!cookieHeader) {
            return null;
        }

        const parts = cookieHeader.split(';');
        for (const part of parts) {
            const [key, ...rest] = part.trim().split('=');
            if (key === REFRESH_COOKIE_NAME) {
                return decodeURIComponent(rest.join('='));
            }
        }

        return null;
    }

    private setRefreshCookie(res: Response, token: string, expiresAt: number) {
        res.cookie(REFRESH_COOKIE_NAME, token, {
            ...this.getRefreshCookieBaseOptions(),
            expires: new Date(expiresAt * 1000),
        });
    }

    private clearRefreshCookie(res: Response) {
        res.clearCookie(REFRESH_COOKIE_NAME, this.getRefreshCookieBaseOptions());
    }

    private sendAuthSuccess(
        res: Response,
        code: string,
        message: string,
        data: Record<string, unknown>
    ) {
        return res.status(200).json({
            success: true,
            code,
            message,
            data,
        });
    }

    private sendAuthFailure(
        res: Response,
        code: string,
        message: string,
        data: Record<string, unknown> = {}
    ) {
        return res.status(200).json({
            success: false,
            code,
            message,
            data,
        });
    }

    private resolveClientIp(req: Request): string | null {
        const forwarded = req.headers['x-forwarded-for'];
        if (Array.isArray(forwarded) && forwarded.length > 0) {
            return forwarded[0]?.split(',')[0]?.trim() ?? null;
        }
        if (typeof forwarded === 'string' && forwarded.length > 0) {
            return forwarded.split(',')[0]?.trim() ?? null;
        }
        return req.socket.remoteAddress ?? null;
    }

    private getRefreshCookieBaseOptions(): CookieOptions {
        const isProd = process.env.NODE_ENV === 'production';
        // 如果 WEB_ORIGINS 包含 http:// 地址（如 IP 直连），cookie 降级为非 secure
        // 这样 HTTP 访问时浏览器也能正常发送 cookie
        const allowHttp = (process.env.WEB_ORIGINS || '').split(',').some(o => o.trim().startsWith('http://'));
        const secure = isProd && !allowHttp;
        const sameSite: CookieOptions['sameSite'] = secure ? 'none' : 'lax';
        return {
            httpOnly: true,
            secure,
            sameSite,
            path: REFRESH_COOKIE_PATH,
        };
    }

    private sendError(res: Response, status: number, message: string) {
        return res.status(status).json({ error: message });
    }
}
