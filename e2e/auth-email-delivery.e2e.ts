import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect, initHome, record, capture } from './helpers/homeAcceptance';

type Mail = { to: string[]; secure: boolean; raw: string };
const inbox = () => JSON.parse(readFileSync(process.env.AUTH_E2E_INBOX!, 'utf8')) as Mail[];
const rejectMail = (reject: boolean) => writeFileSync(process.env.AUTH_E2E_SMTP_MODE!, JSON.stringify({ reject }));
function codeFromMail(email: string) {
    const mail = inbox().filter(item => item.to.includes(email)).at(-1);
    expect(mail).toBeTruthy();
    expect(mail!.secure).toBe(true);
    const html = mail!.raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const code = html.match(/>\s*(\d{6})\s*</)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    return code!;
}

for (const mobile of [false, true]) {
    test(`${mobile ? '手机' : '桌面'}注册和找回密码实际投递、失败重试及新旧密码验证`, async ({ browser }, info) => {
        info.setTimeout(90_000);
        expect(process.env.MONGO_URI).toBe(`mongodb://127.0.0.1:37022/boardgame_home_acceptance_${process.env.PLATFORM_E2E_RUN_ID}`);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, hasTouch: mobile, isMobile: mobile });
        const email = `${mobile ? 'mobile' : 'desktop'}-${process.env.PLATFORM_E2E_RUN_ID}@example.invalid`;
        const initialPassword = 'synthetic-before-248';
        const nextPassword = 'synthetic-after-579';
        try {
            const page = await context.newPage();
            await initHome(page);
            const activate = async (control: import('@playwright/test').Locator) => mobile ? control.tap() : control.click();
            const assertFieldsNeverOverlap = async (ids: string[]) => {
                // 在切换后的连续绘制帧中检查布局，不能等动画结束后才把重叠漏过去。
                const overlap = await page.evaluate(async (testIds) => {
                    const start = performance.now();
                    do {
                        const boxes = testIds.map(id => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect());
                        for (let i = 1; i < boxes.length; i++) {
                            if (!boxes[i] || !boxes[i - 1]) return '表单字段缺失';
                            if (boxes[i]!.top < boxes[i - 1]!.bottom - 1) return `${testIds[i - 1]} 与 ${testIds[i]} 重叠`;
                        }
                        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                    } while (performance.now() - start < 350);
                    return null;
                }, ids);
                expect(overlap, '表单切换全程不得出现输入框重叠').toBeNull();
            };
            await activate(page.getByRole('button', { name: '登录', exact: true }).first());
            await expect(page.getByTestId('auth-login-account-input')).toBeVisible();
            await capture(page, `${mobile ? '手机' : '桌面'}-登录默认`);
            await activate(page.getByRole('navigation', { name: '账户入口' }).getByRole('button', { name: '注册', exact: true }));
            await assertFieldsNeverOverlap(['auth-register-email-input', 'auth-register-code-input', 'auth-register-username-input', 'auth-register-password-input', 'auth-register-confirm-password-input']);
            await capture(page, `${mobile ? '手机' : '桌面'}-注册默认`);
            await page.getByTestId('auth-register-email-input').fill(email);
            const sendRegister = page.getByTestId('auth-register-send-code');
            rejectMail(true);
            let response = page.waitForResponse(r => r.url().endsWith('/auth/send-register-code') && r.request().method() === 'POST');
            await sendRegister.click();
            expect((await response).status()).toBe(500);
            await expect(page.getByText('邮件发送失败，请稍后重试', { exact: true })).toBeVisible();
            await expect(sendRegister).toBeEnabled();
            expect(inbox().filter(item => item.to.includes(email))).toHaveLength(0);
            await capture(page, `${mobile ? '手机' : '桌面'}-注册邮件失败反馈`);
            rejectMail(false);
            response = page.waitForResponse(r => r.url().endsWith('/auth/send-register-code') && r.request().method() === 'POST');
            await sendRegister.click();
            expect((await response).status()).toBe(201);
            await expect(sendRegister).toBeDisabled();
            await capture(page, `${mobile ? '手机' : '桌面'}-注册验证码已发送`);
            await page.getByTestId('auth-register-code-input').fill(codeFromMail(email));
            await page.getByTestId('auth-register-username-input').fill(mobile ? '手机邮件验收' : '桌面邮件验收');
            await page.getByTestId('auth-register-password-input').fill(initialPassword);
            await page.getByTestId('auth-register-confirm-password-input').fill(initialPassword);
            if (mobile) {
                await page.getByTestId('auth-register-confirm-password-input').tap();
                await expect(page.getByTestId('auth-register-confirm-password-input')).toBeFocused();
                await capture(page, '手机-注册表单末项');
            }
            response = page.waitForResponse(r => r.url().endsWith('/auth/register') && r.request().method() === 'POST');
            await page.getByTestId('auth-submit-button').click();
            expect((await response).status()).toBe(201);
            await page.getByTestId('user-menu-trigger').click();
            await page.locator('[data-user-menu-panel] > button').last().click();
            await page.getByRole('button', { name: '登录', exact: true }).first().click();
            await page.getByTestId('auth-login-forgot-button').click();
            await assertFieldsNeverOverlap(['auth-reset-email-input', 'auth-reset-code-input', 'auth-reset-new-password-input', 'auth-reset-confirm-password-input']);
            await capture(page, `${mobile ? '手机' : '桌面'}-找回密码默认`);
            await activate(page.getByRole('button', { name: '返回登录', exact: true }));
            await expect(page.getByTestId('auth-login-account-input')).toBeVisible();
            await activate(page.getByTestId('auth-login-forgot-button'));
            await page.getByTestId('auth-reset-email-input').fill(email);
            const sendReset = page.getByTestId('auth-reset-send-code');
            rejectMail(true);
            response = page.waitForResponse(r => r.url().endsWith('/auth/send-reset-code') && r.request().method() === 'POST');
            await sendReset.click();
            expect((await response).status()).toBe(500);
            await expect(page.getByText('邮件发送失败，请稍后重试', { exact: true })).toBeVisible();
            await expect(sendReset).toBeEnabled();
            expect(inbox().filter(item => item.to.includes(email))).toHaveLength(1);
            await capture(page, `${mobile ? '手机' : '桌面'}-找回密码邮件失败反馈`);
            rejectMail(false);
            response = page.waitForResponse(r => r.url().endsWith('/auth/send-reset-code') && r.request().method() === 'POST');
            await sendReset.click();
            expect((await response).status()).toBe(201);
            await expect(sendReset).toBeDisabled();
            await capture(page, `${mobile ? '手机' : '桌面'}-找回验证码已发送`);
            const resetCode = codeFromMail(email);
            await page.getByTestId('auth-reset-code-input').fill(resetCode);
            await page.getByTestId('auth-reset-new-password-input').fill(nextPassword);
            await page.getByTestId('auth-reset-confirm-password-input').fill(nextPassword);
            if (mobile) {
                await page.getByTestId('auth-reset-confirm-password-input').tap();
                await expect(page.getByTestId('auth-reset-confirm-password-input')).toBeFocused();
                await capture(page, '手机-找回表单末项');
            }
            response = page.waitForResponse(r => r.url().endsWith('/auth/reset-password') && r.request().method() === 'POST');
            await page.getByTestId('auth-submit-button').click();
            expect((await response).status()).toBe(201);
            await page.getByRole('button', { name: '登录', exact: true }).first().click();
            await page.getByTestId('auth-login-account-input').fill(email);
            await page.getByTestId('auth-login-password-input').fill(initialPassword);
            response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
            await page.getByTestId('auth-submit-button').click();
            expect((await (await response).json()).code).toBe('AUTH_INVALID_PASSWORD');
            await page.getByTestId('auth-login-password-input').fill(nextPassword);
            response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
            await page.getByTestId('auth-submit-button').click();
            expect((await (await response).json()).success).toBe(true);
            await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
            await record(`${mobile ? '手机' : '桌面'}邮件完整行为`, { formTransitionFieldsNeverOverlap: true, registerSmtpRejected500: true, registerRetryDelivered: true, registeredUsingReceivedCode: true, resetSmtpRejected500: true, resetRetryDelivered: true, resetUsingReceivedCode: true, oldPasswordRejected: true, newPasswordLogin: true, smtpAcceptedMessages: inbox().filter(item => item.to.includes(email)).length, deliveryBoundary: '真实 API 经验证证书的 STARTTLS 向隔离 SMTP 收件箱投递；不代表外部邮箱收件' });
        } finally {
            rejectMail(false);
            await context.close();
        }
    });
}
