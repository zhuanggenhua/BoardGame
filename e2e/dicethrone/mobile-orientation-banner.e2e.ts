import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

test.describe('DiceThrone 移动端方向提示条', () => {
    test('手机竖屏下进入横屏主界面游戏时只显示可关闭提示条，不再整屏遮挡', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('dicethrone');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(500);

        const banner = page.getByTestId('mobile-orientation-game-banner');
        const closeButton = page.getByRole('button', { name: '关闭提示' });

        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(banner).toBeVisible({ timeout: 15000 });
        await expect(banner.getByText('建议旋转至横屏以获得更佳体验')).toBeVisible();
        await expect(closeButton).toBeVisible();
        await expect(page.locator('[data-testid="character-selection-overlay"]')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('选择你的英雄')).toBeVisible();

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'dicethrone-phone-portrait-orientation-banner'),
            fullPage: false,
        });

        await closeButton.click();
        await expect(banner).toHaveCount(0);
        await expect(page.locator('[data-testid="character-selection-overlay"]')).toBeVisible({ timeout: 15000 });

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'dicethrone-phone-portrait-orientation-banner-dismissed'),
            fullPage: false,
        });
    });
});
