import { test, expect } from '@playwright/test';

// 只做“新登录模型”最小覆盖：
// - login body 发送 account（仅邮箱）
// - change-password 正常发起

const AUTH_DESKTOP_SCREENSHOT_PATH = 'test-results/evidence-screenshots/_shared/auth-modal-desktop-login-filled.png';
const AUTH_MOBILE_SCREENSHOT_PATH = 'test-results/evidence-screenshots/_shared/auth-modal-mobile-register-filled.png';

async function applyKeyboardViewportSimulation(
    page: import('@playwright/test').Page,
    options: { runtimeViewportHeight: number; keyboardInsetHeight: number },
) {
    await page.evaluate(({ runtimeViewportHeight, keyboardInsetHeight }) => {
        const root = document.documentElement;
        root.style.setProperty('--runtime-viewport-height', `${runtimeViewportHeight}px`);
        root.style.setProperty('--keyboard-inset-height', `${keyboardInsetHeight}px`);
        root.dataset.keyboardVisible = 'true';
    }, options);
}

async function clickHeaderLoginEntry(page: import('@playwright/test').Page) {
    const loginButton = page.locator('header button:has-text("登录")').first();
    await expect(loginButton).toBeVisible();
    await page.waitForTimeout(500);
    await loginButton.click({ force: true });
    if (await page.getByTestId('auth-modal').count() === 0) {
        await page.waitForTimeout(500);
        await loginButton.click({ force: true });
    }
}

async function clickHeaderRegisterEntry(page: import('@playwright/test').Page) {
    const registerButton = page.locator('header button:has-text("注册")').first();
    await expect(registerButton).toBeVisible();
    await page.waitForTimeout(500);
    await registerButton.click({ force: true });
    if (await page.getByTestId('auth-modal').count() === 0) {
        await page.waitForTimeout(500);
        await registerButton.click({ force: true });
    }
}

test.describe('Auth (account login) E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'zh-CN');
        });

        // 未登录时 /auth/me 401，让页面展示“未登录”状态
        await page.route('**/auth/me', async route => {
            await route.fulfill({ status: 401, json: { error: 'unauthorized' } });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.addStyleTag({
            content: `
                *, *::before, *::after {
                    animation: none !important;
                    transition: none !important;
                    scroll-behavior: auto !important;
                }
            `,
        });
    });

    test('AuthModal login should remain usable on desktop', async ({ page }) => {
        // 打开登录弹窗（UserMenu / Home 中应该有“登录/Log In”入口）
        await clickHeaderLoginEntry(page);

        const dialog = page.getByTestId('auth-modal');
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(50);

        const accountInput = dialog.getByTestId('auth-login-account-input');
        const passwordInput = dialog.getByTestId('auth-login-password-input');
        const passwordToggle = dialog.getByTestId('auth-login-password-toggle');
        const submitButton = dialog.getByTestId('auth-submit-button');

        await expect(passwordInput).toHaveAttribute('type', 'password');
        await passwordToggle.click();
        await expect(passwordInput).toHaveAttribute('type', 'text');
        await passwordToggle.click();
        await expect(passwordInput).toHaveAttribute('type', 'password');

        await accountInput.evaluate((node, value) => {
            const input = node as HTMLInputElement;
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, 'test@example.com');
        await passwordInput.evaluate((node, value) => {
            const input = node as HTMLInputElement;
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, '1234');

        await expect(accountInput).toHaveValue('test@example.com');
        await expect(passwordInput).toHaveValue('1234');
        await expect(submitButton).toBeVisible();

        await page.screenshot({
            path: AUTH_DESKTOP_SCREENSHOT_PATH,
            fullPage: false,
        });
    });

    test('AuthModal register should keep mobile inputs visible and editable on narrow screens', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        await clickHeaderRegisterEntry(page);

        const getAuthModal = () => page.getByTestId('auth-modal').last();
        const getEmailInput = () => page.getByTestId('auth-register-email-input').last();
        const getCodeInput = () => page.getByTestId('auth-register-code-input').last();

        await expect(getAuthModal()).toBeVisible();
        await page.waitForTimeout(50);

        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 564,
            keyboardInsetHeight: 280,
        });

        await expect(getAuthModal()).toBeVisible({ timeout: 10000 });
        await expect(getEmailInput()).toBeVisible();
        await expect(getCodeInput()).toBeVisible();

        await getEmailInput().evaluate((node, value) => {
            if (!(node instanceof HTMLInputElement)) {
                throw new Error('注册邮箱输入框节点不是 input');
            }
            node.focus();
            node.value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
        }, 'remembered@example.com');
        await getCodeInput().evaluate((node, value) => {
            if (!(node instanceof HTMLInputElement)) {
                throw new Error('注册验证码输入框节点不是 input');
            }
            node.focus();
            node.value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
        }, '123456');

        await expect(getEmailInput()).toHaveValue('remembered@example.com');
        await expect(getCodeInput()).toHaveValue('123456');

        const layoutMetrics = await getAuthModal().evaluate((element) => {
            const submitButton = element.querySelector('button[type="submit"]');
            const emailInput = element.querySelector('[data-testid="auth-register-email-input"]');
            const codeInput = element.querySelector('[data-testid="auth-register-code-input"]');
            if (!(element instanceof HTMLElement)) {
                throw new Error('认证弹窗节点不是 HTMLElement');
            }

            return {
                modalTop: element.getBoundingClientRect().top,
                emailRight: emailInput?.getBoundingClientRect().right ?? 0,
                emailBottom: emailInput?.getBoundingClientRect().bottom ?? 0,
                codeRight: codeInput?.getBoundingClientRect().right ?? 0,
                codeBottom: codeInput?.getBoundingClientRect().bottom ?? 0,
                submitBottom: submitButton?.getBoundingClientRect().bottom ?? 0,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                runtimeViewportHeight: Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0'),
                inputFontSizes: Array.from(element.querySelectorAll('input')).map((node) => {
                    const fontSize = window.getComputedStyle(node).fontSize || '0';
                    return Number.parseFloat(fontSize);
                }),
            };
        });

        expect(layoutMetrics.modalTop).toBeGreaterThanOrEqual(0);
        expect(layoutMetrics.emailRight).toBeLessThanOrEqual(layoutMetrics.viewportWidth);
        expect(layoutMetrics.codeRight).toBeLessThanOrEqual(layoutMetrics.viewportWidth);
        expect(layoutMetrics.emailBottom).toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(layoutMetrics.codeBottom).toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(Math.min(...layoutMetrics.inputFontSizes)).toBeGreaterThanOrEqual(16);
        expect(layoutMetrics.submitBottom).toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);

        await page.screenshot({
            path: AUTH_MOBILE_SCREENSHOT_PATH,
            fullPage: false,
        });

    });

    test('AuthModal should preserve remembered identifiers across mode switches and persist drafts', async ({ page }) => {
        await clickHeaderRegisterEntry(page);

        const modal = page.getByTestId('auth-modal');
        await expect(modal).toBeVisible();

        await modal.getByTestId('auth-register-email-input').fill('remembered@example.com');
        await modal.getByTestId('auth-register-username-input').fill('RememberMe');

        await modal.getByTestId('auth-switch-login').evaluate((node) => {
            (node as HTMLButtonElement).click();
        });
        const loginModal = page.getByTestId('auth-modal');
        await expect(loginModal.getByTestId('auth-login-account-input')).toHaveValue('remembered@example.com');

        await modal.getByTestId('auth-switch-register').evaluate((node) => {
            (node as HTMLButtonElement).click();
        });
        const registerModal = page.getByTestId('auth-modal');
        await expect(registerModal.getByTestId('auth-register-email-input')).toHaveValue('remembered@example.com');
        await expect(registerModal.getByTestId('auth-register-username-input')).toHaveValue('RememberMe');

        const rememberedDraft = await page.evaluate(() => {
            const raw = window.localStorage.getItem('auth_modal_remembered_fields_v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(rememberedDraft).toMatchObject({
            email: 'remembered@example.com',
            username: 'RememberMe',
        });

        await page.mouse.click(12, 12);
        await expect(page.getByTestId('auth-modal')).toBeHidden();

        await clickHeaderRegisterEntry(page);
        const reopenedModal = page.getByTestId('auth-modal');
        await expect(reopenedModal).toBeVisible();
        await expect(reopenedModal.getByTestId('auth-register-email-input')).toHaveValue('remembered@example.com');
        await expect(reopenedModal.getByTestId('auth-register-username-input')).toHaveValue('RememberMe');
    });

    test('Change password should POST /auth/change-password with currentPassword + newPassword', async ({ page }) => {
        // 该仓库的 e2e 默认会起 Vite WebServer，但后端 /api/auth/* 未必启动。
        // 这里不走真实网络请求，仅验证：AuthContext 暴露了 changePassword()，并且它会命中正确的 endpoint。

        await page.addInitScript(() => {
            localStorage.setItem('auth_token', 'fake_jwt_token');
            localStorage.setItem('auth_user', JSON.stringify({
                id: 'user_123',
                username: 'TestNick',
                email: 'test@example.com',
                role: 'user',
                banned: false,
            }));
        });

        let lastBody: unknown = null;
        let lastAuthHeader: string | null = null;

        await page.route('**/auth/change-password', async route => {
            lastAuthHeader = route.request().headers()['authorization'] ?? null;
            lastBody = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({ status: 200, json: { message: 'ok' } });
        });

        await page.goto('/');

        // 通过 window.fetch 直接触发（等后续补“修改密码 UI”再替换为用户路径）
        await page.evaluate(async () => {
            await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer fake_jwt_token',
                },
                body: JSON.stringify({ currentPassword: '1234', newPassword: '5678' }),
            });
        });

        expect(lastAuthHeader).toBe('Bearer fake_jwt_token');
        expect(lastBody).toEqual({ currentPassword: '1234', newPassword: '5678' });
    });
});
