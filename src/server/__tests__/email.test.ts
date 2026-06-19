import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createTransportMock = vi.fn();

vi.mock('nodemailer', () => ({
    default: {
        createTransport: createTransportMock,
    },
}));

vi.mock('../../../server/logger', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
    },
}));

describe('email service', () => {
    const originalEnv = process.env;
    const originalConsoleLog = console.log;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = {
            ...originalEnv,
            SMTP_HOST: 'smtp.qq.com',
            SMTP_PORT: '465',
            SMTP_USER: 'tester@example.com',
            SMTP_PASS: 'secret',
        };
        console.log = vi.fn();
    });

    afterEach(() => {
        process.env = originalEnv;
        console.log = originalConsoleLog;
    });

    it('在 production 下 SMTP 失败时返回失败而不是假成功', async () => {
        process.env.NODE_ENV = 'production';
        createTransportMock.mockReturnValue({
            sendMail: vi.fn().mockRejectedValue(new Error('EAUTH 535')),
        });

        const { sendVerificationEmailWithCode } = await import('../email');
        const result = await sendVerificationEmailWithCode('user@example.com', '123456');

        expect(result.success).toBe(false);
        expect(result.message).toBe('邮件发送失败，请稍后重试');
        expect(console.log).not.toHaveBeenCalled();
    });

    it('在非 production 下 SMTP 失败时保留开发 fallback', async () => {
        process.env.NODE_ENV = 'development';
        createTransportMock.mockReturnValue({
            sendMail: vi.fn().mockRejectedValue(new Error('EAUTH 535')),
        });

        const { sendVerificationEmailWithCode } = await import('../email');
        const result = await sendVerificationEmailWithCode('user@example.com', '123456');

        expect(result.success).toBe(true);
        expect(result.message).toBe('开发模式：验证码已打印到服务器终端');
        expect(console.log).toHaveBeenCalled();
    });
});
