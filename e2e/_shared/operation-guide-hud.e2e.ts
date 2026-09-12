import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import { dismissViteOverlay, initContext, waitForFrontendAssets, waitForHomeGameList, waitForTestHarness } from '../helpers/common';

const SCREENSHOT_DIR = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    '_shared',
    'operation-guide-home-real-screenshots-20260913',
);

const screenshotPath = (filename: string) => {
    const path = join(SCREENSHOT_DIR, filename);
    mkdirSync(dirname(path), { recursive: true });
    return path;
};

const assertOperationGuideImagesLoaded = async (modal: ReturnType<Page['getByTestId']>) => {
    const images = modal.locator('img[data-testid^="operation-guide-real-screenshot-"]');
    await expect(images).toHaveCount(2);

    const imageStatuses = await images.evaluateAll((nodes) => nodes.map((node) => {
        const image = node as HTMLImageElement;
        return {
            testId: image.getAttribute('data-testid'),
            src: image.getAttribute('src'),
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
        };
    }));

    expect(imageStatuses).toEqual(expect.arrayContaining([
        expect.objectContaining({
            testId: 'operation-guide-real-screenshot-home-fab',
            complete: true,
            src: expect.stringContaining('/images/operation-guide/home-'),
        }),
        expect.objectContaining({
            testId: 'operation-guide-real-screenshot-long-press',
            complete: true,
            src: expect.stringContaining('/images/operation-guide/mobile-long-press-annotated.png'),
        }),
    ]));
    for (const status of imageStatuses) {
        expect(status.naturalWidth, `${status.testId} 必须加载真实截图宽度`).toBeGreaterThan(0);
        expect(status.naturalHeight, `${status.testId} 必须加载真实截图高度`).toBeGreaterThan(0);
    }
};

const assertGuideButtonIsLeftOfAccountArea = async (page: Page, accountSelector: string) => {
    const metrics = await page.evaluate((selector) => {
        const guide = document.querySelector('[data-testid="home-operation-guide-entry"]') as HTMLElement | null;
        const account = document.querySelector(selector) as HTMLElement | null;
        const fabGuide = document.querySelector('[data-fab-id="operation-guide"]');
        const modal = document.querySelector('[data-testid="operation-guide-modal"]') as HTMLElement | null;
        if (!guide || !account) return null;
        const guideRect = guide.getBoundingClientRect();
        const accountRect = account.getBoundingClientRect();
        const modalRect = modal?.getBoundingClientRect();
        return {
            guideRect: {
                left: guideRect.left,
                right: guideRect.right,
                top: guideRect.top,
                bottom: guideRect.bottom,
            },
            accountRect: {
                left: accountRect.left,
                right: accountRect.right,
            },
            modalRect: modalRect
                ? {
                    left: modalRect.left,
                    right: modalRect.right,
                    top: modalRect.top,
                    bottom: modalRect.bottom,
                    centerX: modalRect.left + modalRect.width / 2,
                    centerY: modalRect.top + modalRect.height / 2,
                }
                : null,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            hasOperationGuideInsideFab: Boolean(fabGuide),
        };
    }, accountSelector);

    expect(metrics).not.toBeNull();
    expect(metrics!.guideRect.right).toBeLessThanOrEqual(metrics!.accountRect.left + 4);
    expect(metrics!.hasOperationGuideInsideFab).toBe(false);
};

const openOperationGuide = async (page: Page, testId: string) => {
    const guideButton = page.getByTestId(testId).first();
    await expect(guideButton).toBeVisible({ timeout: 30000 });
    await guideButton.click();

    const modal = page.getByTestId('operation-guide-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByTestId('operation-guide-common-list')).toContainText(/长按|long-press/i);
    await expect(modal.getByTestId('operation-guide-annotated-screenshot')).toBeVisible();
    await expect(modal.getByTestId('operation-guide-fab-item-operation-guide')).toHaveCount(0);
    await assertOperationGuideImagesLoaded(modal);
    return modal;
};

test.describe('共享操作指南真实首页入口', () => {
    test('网页主页右上角入口在登录注册左侧，打开后显示居中真实截图指南', async ({ page }) => {
        await initContext(page.context(), {
            storageKey: '__operation_guide_web__',
            skipImageGate: true,
        });

        await page.goto('/?homeStyle=classic', { waitUntil: 'domcontentloaded' });
        await waitForFrontendAssets(page);
        await waitForHomeGameList(page);
        await dismissViteOverlay(page);

        await expect(page.locator('[data-fab-id="operation-guide"]')).toHaveCount(0);
        await assertGuideButtonIsLeftOfAccountArea(page, 'button:has-text("登录")');
        await page.screenshot({
            path: screenshotPath('01-web-home-right-top-entry.png'),
            fullPage: false,
        });

        const modal = await openOperationGuide(page, 'home-operation-guide-entry');
        await expect(modal).toContainText('网页端');
        await expect(modal.getByTestId('operation-guide-fab-item-download-app')).toBeVisible();
        await expect(modal.getByTestId('operation-guide-fab-item-check-update')).toHaveCount(0);

        const modalMetrics = await modal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
                viewport: { width: window.innerWidth, height: window.innerHeight },
            };
        });
        expect(Math.abs(modalMetrics.centerX - modalMetrics.viewport.width / 2)).toBeLessThan(16);
        expect(Math.abs(modalMetrics.centerY - modalMetrics.viewport.height / 2)).toBeLessThan(16);
        await page.screenshot({
            path: screenshotPath('02-web-home-centered-guide-modal.png'),
            fullPage: false,
        });
    });

    test('App 主页右上角入口打开后显示 App 端指南和检查更新入口', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.context().addInitScript(() => {
            (window as Window & {
                Capacitor?: { getPlatform: () => string; isNativePlatform: () => boolean };
                androidBridge?: Record<string, never>;
                __BG_E2E_NATIVE_ANDROID_RUNTIME__?: boolean;
            }).Capacitor = {
                getPlatform: () => 'android',
                isNativePlatform: () => true,
            };
            (window as Window & { androidBridge?: Record<string, never> }).androidBridge = {};
            (window as Window & { __BG_E2E_NATIVE_ANDROID_RUNTIME__?: boolean }).__BG_E2E_NATIVE_ANDROID_RUNTIME__ = true;
        });
        await initContext(page.context(), {
            storageKey: '__operation_guide_app__',
            skipImageGate: true,
        });

        await page.goto('/?homeStyle=classic', { waitUntil: 'domcontentloaded' });
        await waitForFrontendAssets(page);
        await waitForHomeGameList(page);
        await dismissViteOverlay(page);

        await expect(page.locator('[data-fab-id="operation-guide"]')).toHaveCount(0);
        await expect(page.getByTestId('home-operation-guide-entry')).toBeVisible();
        await page.screenshot({
            path: screenshotPath('03-app-home-right-top-entry.png'),
            fullPage: false,
        });

        const modal = await openOperationGuide(page, 'home-operation-guide-entry');
        await expect(modal).toContainText('App 端');
        await expect(modal.getByTestId('operation-guide-fab-item-check-update')).toBeVisible();
        await expect(modal.getByTestId('operation-guide-fab-item-download-app')).toHaveCount(0);
        await page.screenshot({
            path: screenshotPath('04-app-home-centered-guide-modal.png'),
            fullPage: false,
        });
    });

    test('游戏页不再提供操作指南入口', async ({ page }) => {
        await initContext(page.context(), {
            storageKey: '__operation_guide_game_absent__',
            skipImageGate: true,
        });

        await page.goto('/play/fantasyrealms?players=2&skipFactionSelect=true&seed=operation-guide', {
            waitUntil: 'domcontentloaded',
        });
        await dismissViteOverlay(page);
        await expect(page.locator('div[data-game-page][data-game-id="fantasyrealms"]').first()).toBeVisible({
            timeout: 60000,
        });
        await waitForTestHarness(page, 30000);

        await expect(page.getByTestId('game-operation-guide-entry')).toHaveCount(0);
        await expect(page.locator('[data-fab-id="operation-guide"]')).toHaveCount(0);
    });
});
