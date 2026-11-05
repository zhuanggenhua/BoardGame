import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../framework';
import { dismissViteOverlay, initContext, waitForFrontendAssets, waitForHomeGameList } from '../helpers/common';
import { waitForDiceThroneHarness } from '../helpers/dicethrone';

const SCREENSHOT_DIR = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    '_shared',
    'operation-guide-home-real-screenshots-20260913',
);

const EXPECTED_SCREENSHOTS = [
    '01-web-home-right-top-entry.png',
    '02-web-home-centered-guide-modal-top.png',
    '03-web-home-guide-long-press-zoom.png',
    '04-web-home-guide-opponent-public-info-zoom.png',
    '05-web-home-guide-home-fab-zoom.png',
    '06-web-home-guide-game-fab-zoom.png',
    '07-app-home-right-top-entry.png',
    '08-app-home-centered-guide-modal-top.png',
    '09-app-home-guide-app-fab-zoom.png',
    '10-app-home-guide-game-fab-zoom.png',
] as const;

const screenshotPath = (filename: string) => {
    const path = join(SCREENSHOT_DIR, filename);
    mkdirSync(dirname(path), { recursive: true });
    return path;
};

const listRelativeFiles = (dir: string, prefix = ''): string[] => {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const fullPath = join(dir, entry.name);
        return entry.isDirectory()
            ? listRelativeFiles(fullPath, relativePath)
            : [relativePath];
    });
};

const assertOperationGuideImagesLoaded = async (modal: ReturnType<Page['getByTestId']>) => {
    const images = modal.locator('img[data-testid^="operation-guide-real-screenshot-"]');
    await expect(images).toHaveCount(4);

    await expect.poll(async () => images.evaluateAll((nodes) => nodes.every((node) => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    })), {
        message: '操作指南弹窗内四张真实截图必须加载完成',
        timeout: 10000,
    }).toBe(true);

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
        expect.objectContaining({
            testId: 'operation-guide-real-screenshot-opponent-public-info',
            complete: true,
            src: expect.stringContaining('/images/operation-guide/opponent-public-info-annotated.png'),
        }),
        expect.objectContaining({
            testId: 'operation-guide-real-screenshot-game-fab',
            complete: true,
            src: expect.stringContaining('/images/operation-guide/game-fab-annotated.png'),
        }),
    ]));
    for (const status of imageStatuses) {
        expect(status.naturalWidth, `${status.testId} 必须加载真实截图宽度`).toBeGreaterThan(0);
        expect(status.naturalHeight, `${status.testId} 必须加载真实截图高度`).toBeGreaterThan(0);
    }
};

const assertGuideScreenshotCanZoom = async (
    page: Page,
    modal: ReturnType<Page['getByTestId']>,
    testId: string,
    expectedSrc: string,
) => {
    const trigger = modal.getByTestId(`${testId}-zoom-trigger`);
    await expect(trigger).toBeVisible();
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.width).toBeGreaterThan(44);
    expect(triggerBox!.height).toBeGreaterThan(44);

    await trigger.click();

    const viewer = page.getByTestId('operation-guide-image-viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText(/标注截图|点击放大查看/)).toHaveCount(0);
    await expect(page.getByTestId('operation-guide-image-viewer-image')).toHaveAttribute('src', expectedSrc);

    const closeButton = page.getByTestId('operation-guide-image-viewer-close');
    const closeBox = await closeButton.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
};

const closeGuideScreenshotZoom = async (page: Page) => {
    await page.getByTestId('operation-guide-image-viewer-close').click();
    await expect(page.getByTestId('operation-guide-image-viewer')).toHaveCount(0);
};

const assertGuideButtonIsLeftOfAccountArea = async (guide: Locator, account: Locator) => {
    const guideBox = await guide.boundingBox();
    const accountBox = await account.boundingBox();

    expect(guideBox).not.toBeNull();
    expect(accountBox).not.toBeNull();
    expect(guideBox!.x + guideBox!.width).toBeLessThanOrEqual(accountBox!.x + 4);
};

const assertNoExtraGuideUi = async (modal: ReturnType<Page['getByTestId']>) => {
    await expect(modal.getByText('先看这三件事')).toHaveCount(0);
    await expect(modal.getByText('点击放大查看')).toHaveCount(0);
    await expect(modal.getByText('新手帮助')).toHaveCount(0);
    await expect(modal.getByTestId('operation-guide-priority-list')).toHaveCount(0);
    await expect(modal.getByTestId('operation-guide-common-list')).toHaveCount(0);
    await expect(modal.getByTestId('operation-guide-fab-list')).toHaveCount(0);
    await expect(modal.locator('[data-testid^="operation-guide-fab-item-"]')).toHaveCount(0);
    await expect(modal.locator('[data-testid^="operation-guide-callout-"]')).toHaveCount(0);
};

const assertGuideBodyCanScroll = async (modal: ReturnType<Page['getByTestId']>) => {
    const scrollBody = modal.getByTestId('operation-guide-scroll-body');
    const scrollState = await scrollBody.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return {
            scrollTop: element.scrollTop,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
        };
    });

    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
    expect(scrollState.scrollTop + scrollState.clientHeight).toBeGreaterThanOrEqual(scrollState.scrollHeight - 4);
    await scrollBody.evaluate((element) => {
        element.scrollTop = 0;
    });
};

const openOperationGuide = async (page: Page, testId: string) => {
    const guideButton = page.getByTestId(testId).first();
    await expect(guideButton).toBeVisible({ timeout: 30000 });
    await guideButton.click();

    const modal = page.getByTestId('operation-guide-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await assertNoExtraGuideUi(modal);
    await expect(modal.getByTestId('operation-guide-annotated-screenshot')).toBeVisible();
    await assertOperationGuideImagesLoaded(modal);
    await assertGuideBodyCanScroll(modal);
    return modal;
};

test.describe('共享操作指南真实首页入口', () => {
    test.beforeAll(() => {
        rmSync(SCREENSHOT_DIR, { recursive: true, force: true });
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    test.afterAll(() => {
        const files = listRelativeFiles(SCREENSHOT_DIR).sort();
        expect(files).toEqual([...EXPECTED_SCREENSHOTS].sort());
        expect(files.some((file) => /fab-list|labeled|sequence/i.test(file))).toBe(false);
    });

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
        await assertGuideButtonIsLeftOfAccountArea(
            page.getByTestId('home-operation-guide-entry'),
            page.getByRole('button', { name: '登录' }),
        );
        await page.screenshot({
            path: screenshotPath('01-web-home-right-top-entry.png'),
            fullPage: false,
        });

        const modal = await openOperationGuide(page, 'home-operation-guide-entry');

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
            path: screenshotPath('02-web-home-centered-guide-modal-top.png'),
            fullPage: false,
        });
        await assertGuideScreenshotCanZoom(
            page,
            modal,
            'operation-guide-real-screenshot-long-press',
            '/images/operation-guide/mobile-long-press-annotated.png',
        );
        await page.screenshot({
            path: screenshotPath('03-web-home-guide-long-press-zoom.png'),
            fullPage: false,
        });
        await closeGuideScreenshotZoom(page);
        await assertGuideScreenshotCanZoom(
            page,
            modal,
            'operation-guide-real-screenshot-opponent-public-info',
            '/images/operation-guide/opponent-public-info-annotated.png',
        );
        await page.screenshot({
            path: screenshotPath('04-web-home-guide-opponent-public-info-zoom.png'),
            fullPage: false,
        });
        await closeGuideScreenshotZoom(page);
        await assertGuideScreenshotCanZoom(
            page,
            modal,
            'operation-guide-real-screenshot-home-fab',
            '/images/operation-guide/home-web-fab-annotated.png',
        );
        await page.screenshot({
            path: screenshotPath('05-web-home-guide-home-fab-zoom.png'),
            fullPage: false,
        });
        await closeGuideScreenshotZoom(page);
        await assertGuideScreenshotCanZoom(
            page,
            modal,
            'operation-guide-real-screenshot-game-fab',
            '/images/operation-guide/game-fab-annotated.png',
        );
        await page.screenshot({
            path: screenshotPath('06-web-home-guide-game-fab-zoom.png'),
            fullPage: false,
        });
        await closeGuideScreenshotZoom(page);
    });

    test('App 主页右上角入口打开后显示 App 端真实截图指南', async ({ page }) => {
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
        await assertGuideButtonIsLeftOfAccountArea(
            page.getByTestId('home-operation-guide-entry'),
            page.getByRole('button', { name: '登录' }),
        );
        await page.screenshot({
            path: screenshotPath('07-app-home-right-top-entry.png'),
            fullPage: false,
        });

        const modal = await openOperationGuide(page, 'home-operation-guide-entry');
        await page.screenshot({
            path: screenshotPath('08-app-home-centered-guide-modal-top.png'),
            fullPage: false,
        });
        await assertGuideScreenshotCanZoom(
            page,
            modal,
            'operation-guide-real-screenshot-home-fab',
            '/images/operation-guide/home-app-fab-annotated.png',
        );
        await page.screenshot({
            path: screenshotPath('09-app-home-guide-app-fab-zoom.png'),
            fullPage: false,
        });
        await closeGuideScreenshotZoom(page);
        await assertGuideScreenshotCanZoom(
            page,
            modal,
            'operation-guide-real-screenshot-game-fab',
            '/images/operation-guide/game-fab-annotated.png',
        );
        await page.screenshot({
            path: screenshotPath('10-app-home-guide-game-fab-zoom.png'),
            fullPage: false,
        });
        await closeGuideScreenshotZoom(page);
    });

    test('DiceThrone 游戏页不再提供操作指南入口', async ({ page, game }) => {
        await initContext(page.context(), {
            storageKey: '__operation_guide_game_absent__',
            skipImageGate: true,
        });

        await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true }, 180000);
        await dismissViteOverlay(page);
        await waitForDiceThroneHarness(page, 40000);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });
        await expect(page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 20000 });

        await expect(page.getByTestId('game-operation-guide-entry')).toHaveCount(0);
        await expect(page.locator('[data-fab-id="operation-guide"]')).toHaveCount(0);
    });
});
