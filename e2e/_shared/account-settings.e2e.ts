import { test, expect } from '@playwright/test';

const ACCOUNT_SETTINGS_MOBILE_SCREENSHOT_PATH = 'test-results/evidence-screenshots/_shared/account-settings-mobile-password-inputs.png';
const EMAIL_BIND_MOBILE_SCREENSHOT_PATH = 'test-results/evidence-screenshots/_shared/email-bind-mobile-verify-input.png';

async function openAccountSettings(page: import('@playwright/test').Page) {
    await page.getByText('旧昵称').click();
    await page.getByText('账户设置').click();
    return page.getByTestId('account-settings-modal');
}

/**
 * 账户设置弹窗 E2E 测试
 * 
 * 覆盖：
 * - 从 UserMenu 打开账户设置弹窗
 * - 修改昵称（正常 + 校验）
 * - 修改密码（正常 + 校验）
 * - 邮箱显示与操作入口
 */

test.describe('账户设置', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'zh-CN');
            localStorage.setItem('auth_token', 'fake_jwt_token');
            localStorage.setItem('auth_user', JSON.stringify({
                id: 'user_123',
                username: '旧昵称',
                email: 'test@example.com',
                emailVerified: true,
                avatar: null,
                role: 'user',
                banned: false,
            }));
        });

        // mock /auth/me
        await page.route('**/auth/me', async route => {
            await route.fulfill({
                json: {
                    user: {
                        id: 'user_123',
                        username: '旧昵称',
                        email: 'test@example.com',
                        emailVerified: true,
                        avatar: null,
                        role: 'user',
                        banned: false,
                    },
                },
            });
        });

        // mock 通知接口
        await page.route('**/notifications', async route => {
            await route.fulfill({ json: { notifications: [] } });
        });

        await page.addStyleTag({
            content: `
                *, *::before, *::after {
                    animation: none !important;
                    transition: none !important;
                    scroll-behavior: auto !important;
                }
            `,
        }).catch(() => {});
    });

    test('打开账户设置弹窗并显示用户信息', async ({ page }) => {
        await page.goto('/');

        // 点击用户名/头像打开菜单
        const modal = await openAccountSettings(page);
        await expect(modal).toBeVisible();

        // 验证显示当前昵称
        await expect(modal.getByText('旧昵称')).toBeVisible();

        // 验证显示邮箱
        await expect(modal.getByText('test@example.com')).toBeVisible();

        // 验证密码区域显示
        await expect(modal.getByText('••••••')).toBeVisible();
    });

    test('移动端账户设置与邮箱绑定输入应保持可见可编辑', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.route('**/auth/send-email-code', async route => {
            await route.fulfill({ status: 200, json: { message: 'ok' } });
        });

        await openAccountSettings(page);
        const modal = page.getByTestId('account-settings-modal');
        await expect(modal).toBeVisible();

        await page.getByTestId('account-settings-edit-password').dispatchEvent('click');

        const currentPasswordInput = page.getByTestId('account-settings-current-password-input');
        const newPasswordInput = page.getByTestId('account-settings-new-password-input');
        const confirmPasswordInput = page.getByTestId('account-settings-confirm-password-input');
        const currentPasswordToggle = page.getByTestId('account-settings-current-password-toggle');

        await expect(currentPasswordInput).toHaveAttribute('type', 'password');
        await currentPasswordToggle.click();
        await expect(currentPasswordInput).toHaveAttribute('type', 'text');

        await currentPasswordInput.fill('oldpass');
        await newPasswordInput.fill('newpass1234');
        await confirmPasswordInput.fill('newpass1234');

        const passwordMetrics = await modal.evaluate((element) => {
            const inputs = [
                element.querySelector('[data-testid="account-settings-current-password-input"]'),
                element.querySelector('[data-testid="account-settings-new-password-input"]'),
                element.querySelector('[data-testid="account-settings-confirm-password-input"]'),
            ].filter((node): node is HTMLInputElement => node instanceof HTMLInputElement);
            return {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                inputRights: inputs.map((node) => node.getBoundingClientRect().right),
                inputFontSizes: inputs.map((node) => Number.parseFloat(window.getComputedStyle(node).fontSize || '0')),
            };
        });

        expect(Math.max(...passwordMetrics.inputRights)).toBeLessThanOrEqual(passwordMetrics.viewportWidth);
        expect(Math.min(...passwordMetrics.inputFontSizes)).toBeGreaterThanOrEqual(16);
        await page.screenshot({ path: ACCOUNT_SETTINGS_MOBILE_SCREENSHOT_PATH });

        await page.getByTestId('account-settings-open-email').dispatchEvent('click');
        const emailBindModal = page.getByTestId('email-bind-modal');
        await expect(emailBindModal).toBeVisible();

        const emailInput = emailBindModal.getByTestId('email-bind-address-input');
        await emailInput.fill('mobile@example.com');
        await emailBindModal.getByTestId('email-bind-send-code').click();

        const codeInput = emailBindModal.getByTestId('email-bind-code-input');
        await expect(codeInput).toBeVisible();
        await codeInput.fill('123456');

        const emailBindMetrics = await emailBindModal.evaluate((element) => {
            const email = element.querySelector('[data-testid="email-bind-address-input"]');
            const code = element.querySelector('[data-testid="email-bind-code-input"]');
            const confirm = element.querySelector('[data-testid="email-bind-confirm-button"]');
            return {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                emailRight: email?.getBoundingClientRect().right ?? 0,
                codeBottom: code?.getBoundingClientRect().bottom ?? 0,
                confirmBottom: confirm?.getBoundingClientRect().bottom ?? 0,
                inputFontSizes: [email, code]
                    .filter(Boolean)
                    .map((node) => Number.parseFloat(window.getComputedStyle(node as Element).fontSize || '0')),
            };
        });

        expect(emailBindMetrics.emailRight).toBeLessThanOrEqual(emailBindMetrics.viewportWidth);
        expect(emailBindMetrics.codeBottom).toBeLessThanOrEqual(emailBindMetrics.viewportHeight);
        expect(emailBindMetrics.confirmBottom).toBeLessThanOrEqual(emailBindMetrics.viewportHeight);
        expect(Math.min(...emailBindMetrics.inputFontSizes)).toBeGreaterThanOrEqual(16);
        await page.screenshot({ path: EMAIL_BIND_MOBILE_SCREENSHOT_PATH });
    });

    test('修改昵称成功', async ({ page }) => {
        let lastBody: unknown = null;

        await page.route('**/auth/update-username', async route => {
            lastBody = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                json: {
                    message: '昵称修改成功',
                    user: {
                        id: 'user_123',
                        username: '新昵称',
                        email: 'test@example.com',
                        emailVerified: true,
                        role: 'user',
                        banned: false,
                    },
                },
            });
        });

        await page.goto('/');
        await page.getByText('旧昵称').click();
        await page.getByText('账户设置').click();

        const modal = page.locator('.pointer-events-auto').first();
        await expect(modal).toBeVisible();

        // 找到昵称行的"修改"按钮（第二个，第一个是头像的）
        const editButtons = modal.getByText('修改');
        // 昵称行的修改按钮
        await editButtons.nth(1).click();

        // 清空并输入新昵称
        const input = modal.locator('input[type="text"]');
        await input.clear();
        await input.fill('新昵称');

        // 点击确认（绿色勾）
        await modal.locator('button[aria-label="保存"]').click();

        // 验证请求发送正确
        await expect.poll(() => lastBody).toEqual({ username: '新昵称' });

        // 验证 UI 更新
        await expect(modal.getByText('新昵称')).toBeVisible();
    });

    test('修改密码成功', async ({ page }) => {
        let lastBody: unknown = null;

        await page.route('**/auth/change-password', async route => {
            lastBody = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({ status: 200, json: { message: 'ok' } });
        });

        await page.goto('/');
        await page.getByText('旧昵称').click();
        await page.getByText('账户设置').click();

        const modal = page.locator('.pointer-events-auto').first();
        await expect(modal).toBeVisible();

        // 点击密码行的"修改"按钮
        await modal.getByText('修改').nth(2).click();

        // 填写密码表单
        const inputs = modal.locator('input[type="password"]');
        await inputs.nth(0).fill('oldpass');
        await inputs.nth(1).fill('newpass1234');
        await inputs.nth(2).fill('newpass1234');

        // 点击"修改密码"按钮
        await modal.getByText('修改密码').click();

        // 验证请求
        await expect.poll(() => lastBody).toEqual({
            currentPassword: 'oldpass',
            newPassword: 'newpass1234',
        });
    });

    test('密码不一致时显示错误', async ({ page }) => {
        await page.goto('/');
        await page.getByText('旧昵称').click();
        await page.getByText('账户设置').click();

        const modal = page.locator('.pointer-events-auto').first();
        await expect(modal).toBeVisible();

        // 点击密码行的"修改"按钮
        await modal.getByText('修改').nth(2).click();

        // 填写不一致的密码
        const inputs = modal.locator('input[type="password"]');
        await inputs.nth(0).fill('oldpass');
        await inputs.nth(1).fill('newpass1234');
        await inputs.nth(2).fill('different');

        await modal.getByText('修改密码').click();

        // 验证错误提示
        await expect(modal.getByText('两次输入的密码不一致')).toBeVisible();
    });

    test('UserMenu 不再显示旧的"设置头像"和"绑定邮箱"', async ({ page }) => {
        await page.goto('/');
        await page.getByText('旧昵称').click();

        // 菜单中应该有"账户设置"
        await expect(page.getByText('账户设置')).toBeVisible();

        // 菜单中不应该有旧的"设置头像"和"绑定邮箱"
        await expect(page.getByText('设置头像')).not.toBeVisible();
        await expect(page.getByText('绑定邮箱')).not.toBeVisible();
        await expect(page.getByText('已绑定邮箱')).not.toBeVisible();
    });
});
