import type { Locator, Page } from '@playwright/test';
import { test, expect } from './framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';
import { setChineseLocale, waitForFrontendAssets, waitForHomeGameList } from './helpers/common';

const HOME_V2_MOBILE_LANDSCAPE_VIEWPORT = { width: 852, height: 393 };

async function disableAnimations(page: Page) {
    await page.addStyleTag({
        content: `
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
                scroll-behavior: auto !important;
            }
        `,
    });
}

async function openClassicAuthModal(page: Page) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45000);
    await waitForHomeGameList(page, 45000);
    await disableAnimations(page);

    const loginButton = page.locator('header button:has-text("登录")').first();
    await expect(loginButton).toBeVisible({ timeout: 15000 });
    await loginButton.click({ force: true });

    if (await page.getByTestId('auth-modal').count() === 0) {
        await page.waitForTimeout(300);
        await loginButton.click({ force: true });
    }
}

async function openHomeV2AuthModal(page: Page) {
    await page.setViewportSize(HOME_V2_MOBILE_LANDSCAPE_VIEWPORT);
    await page.goto('/dev/home-v2-preview', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    await expect(page.getByTestId('home-v2-root')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('home-v2-account-entry')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('home-v2-account-entry').click();
}

async function readAuthModalShell(modal: Locator) {
    return modal.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
            className: element.className,
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            borderColor: style.borderColor,
            maxWidth: style.maxWidth,
        };
    });
}

async function readAuthModalContentSignature(modal: Locator) {
    return modal.evaluate((element) => {
        const query = (testId: string) => element.querySelector(`[data-testid="${testId}"]`);
        const submitText = query('auth-submit-button')?.textContent?.replace(/\s+/g, '') ?? '';
        return {
            hasAccountInput: Boolean(query('auth-login-account-input')),
            hasPasswordInput: Boolean(query('auth-login-password-input')),
            hasForgotButton: Boolean(query('auth-login-forgot-button')),
            hasLoginSwitch: Boolean(query('auth-switch-login')),
            hasRegisterSwitch: Boolean(query('auth-switch-register')),
            submitText,
        };
    });
}

test('认证弹窗经典首页与书本首页样式隔离，只有内容结构保持一致', async ({ page }, testInfo) => {
    await clearEvidenceScreenshotsForTest(testInfo);
    await setChineseLocale(page);
    await page.route('**/auth/me', async (route) => {
        await route.fulfill({
            status: 401,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({ error: 'unauthorized' }),
        });
    });

    await openClassicAuthModal(page);

    const classicModal = page.getByTestId('auth-modal').first();
    await expect(classicModal).toBeVisible({ timeout: 10000 });
    await expect(classicModal.getByTestId('auth-login-account-input')).toBeVisible();
    await expect(classicModal.getByTestId('auth-login-password-input')).toBeVisible();
    await expect(classicModal.getByTestId('auth-submit-button')).toHaveText(/登\s*录/);

    const classicShell = await readAuthModalShell(classicModal);
    const classicContent = await readAuthModalContentSignature(classicModal);
    console.log(`[classic-auth-modal] ${JSON.stringify(classicShell)}`);
    expect(classicShell.className).toContain('max-w-[400px]');
    expect(classicShell.className).not.toContain('home-v2-paper-modal-frame');
    expect(classicShell.backgroundColor).toBe('rgb(252, 251, 249)');
    expect(classicShell.borderColor).toBe('rgb(229, 224, 208)');
    expect(classicShell.maxWidth).toBe('400px');

    const classicScreenshotPath = getEvidenceScreenshotPath(testInfo, 'classic-auth-modal-style-isolation');
    await page.screenshot({ path: classicScreenshotPath, fullPage: true });

    await openHomeV2AuthModal(page);

    const homeV2Modal = page.getByTestId('auth-modal').first();
    await expect(homeV2Modal).toBeVisible({ timeout: 10000 });
    await expect(homeV2Modal.getByTestId('auth-login-account-input')).toBeVisible();
    await expect(homeV2Modal.getByTestId('auth-login-password-input')).toBeVisible();
    await expect(homeV2Modal.getByTestId('auth-submit-button')).toHaveText(/登\s*录/);

    const homeV2Shell = await readAuthModalShell(homeV2Modal);
    const homeV2Content = await readAuthModalContentSignature(homeV2Modal);
    console.log(`[home-v2-auth-modal] ${JSON.stringify(homeV2Shell)}`);
    expect(homeV2Content).toEqual(classicContent);
    expect(homeV2Shell.className).toContain('home-v2-paper-modal-frame');
    expect(homeV2Shell.className).not.toContain('max-w-[400px]');
    expect(homeV2Shell.backgroundImage).toContain('radial-gradient');
    expect(homeV2Shell.backgroundColor).toBe('rgb(231, 204, 160)');

    const homeV2ScreenshotPath = getEvidenceScreenshotPath(testInfo, 'home-v2-auth-modal-style-isolation');
    await page.screenshot({ path: homeV2ScreenshotPath, fullPage: true });
});
