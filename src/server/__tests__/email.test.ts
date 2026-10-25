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

    for (const environment of ['production', 'development', 'test']) {
        for (const flow of ['register', 'reset']) {
            it(environment + ' ' + flow + ' SMTP 失败必须返回失败，不能模拟成功', async () => {
                process.env.NODE_ENV = environment;
                createTransportMock.mockReturnValue({ sendMail: vi.fn().mockRejectedValue(new Error('EAUTH 535')) });
                const service = await import('../email');
                const send = flow === 'register' ? service.sendVerificationEmailWithCode : service.sendPasswordResetEmailWithCode;
                const result = await send('user@example.invalid', '123456');
                expect(result.success).toBe(false);
                expect(result.message).toBe('邮件发送失败，请稍后重试');
                expect(console.log).not.toHaveBeenCalled();
            });
        }
    }
});
