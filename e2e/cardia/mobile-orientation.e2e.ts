import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

async function createIPhoneXRContext(
    browser: Parameters<typeof test>[0]['browser'],
    baseURL: string | undefined,
    viewport: { width: number; height: number },
) {
    return browser.newContext({
        baseURL,
        viewport,
        isMobile: true,
        hasTouch: true,
    });
}

test.describe('Cardia 移动端方向兼容', () => {
    test('主页在 iPhone XR 竖屏下不显示横屏 gate，继续保留首页操作', async ({ browser }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await createIPhoneXRContext(browser, baseURL, { width: 414, height: 896 });
        const page = await context.newPage();

        try {
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#root > *', { timeout: 15000 });

            await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
            await expect(page.getByText('请切换到横屏继续')).toHaveCount(0);
            await expect(page.locator('#root')).toBeVisible();

            await page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'home-portrait-no-game-gate'),
                fullPage: false,
            });
        } finally {
            await context.close();
        }
    });

    test('Cardia 在 iPhone XR 竖屏下显示独立横屏 gate，转为横屏后正常进入对局', async ({ browser }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const portraitContext = await createIPhoneXRContext(browser, baseURL, { width: 414, height: 896 });
        const portraitPage = await portraitContext.newPage();

        try {
            await portraitPage.goto('/play/cardia', { waitUntil: 'domcontentloaded' });
            await portraitPage.waitForSelector('div[data-game-page="true"]', { timeout: 20000 });

            const gate = portraitPage.getByTestId('mobile-orientation-game-gate');
            await expect(gate).toBeVisible({ timeout: 15000 });
            await expect(gate.getByText('请切换到横屏继续')).toBeVisible();
            await expect(portraitPage.getByRole('button', { name: '关闭提示' })).toHaveCount(0);
            await expect(portraitPage.getByText('建议旋转至横屏以获得更佳体验')).toHaveCount(0);

            await portraitPage.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'cardia-portrait-orientation-gate'),
                fullPage: false,
            });
        } finally {
            await portraitContext.close();
        }

        const landscapeContext = await createIPhoneXRContext(browser, baseURL, { width: 896, height: 414 });
        const landscapePage = await landscapeContext.newPage();

        try {
            await landscapePage.goto('/play/cardia', { waitUntil: 'domcontentloaded' });
            await landscapePage.waitForSelector('div[data-game-page="true"]', { timeout: 20000 });

            await expect(landscapePage.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
            await expect(landscapePage.locator('div[data-game-page="true"]').first()).toBeVisible();

            await landscapePage.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'cardia-landscape-board-visible'),
                fullPage: false,
            });
        } finally {
            await landscapeContext.close();
        }
    });
});
