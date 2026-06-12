import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

async function readBoardMetrics(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const overlap = (a: DOMRect | null, b: DOMRect | null) => {
            if (!a || !b) return false;
            return !(
                a.right <= b.left
                || a.left >= b.right
                || a.bottom <= b.top
                || a.top >= b.bottom
            );
        };
        const getRect = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            return element ? element.getBoundingClientRect() : null;
        };
        const cellNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-id^="cell-"]'));
        const rects = cellNodes.map((node) => node.getBoundingClientRect());
        const left = Math.min(...rects.map((rect) => rect.left));
        const right = Math.max(...rects.map((rect) => rect.right));
        const top = Math.min(...rects.map((rect) => rect.top));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        const debugToggleRect = getRect('[data-testid="debug-toggle-container"]');
        const scoreRightRect = getRect('[data-testid="tictactoe-score-right"]');
        const turnStatusRect = getRect('[data-testid="tictactoe-turn-status"]');

        return {
            cellCount: cellNodes.length,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
            boardLeft: left,
            boardRight: right,
            boardTop: top,
            boardBottom: bottom,
            boardWidth: right - left,
            boardHeight: bottom - top,
            debugOverlapsRightScore: overlap(debugToggleRect, scoreRightRect),
            debugOverlapsTurnStatus: overlap(debugToggleRect, turnStatusRect),
        };
    });
}

test.describe('TicTacToe 移动端布局兼容', () => {
    test('手机竖屏下棋盘应保持正方形，横屏时只显示可关闭方向提示条', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('tictactoe');
        await expect(page.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(400);

        const portraitMetrics = await readBoardMetrics(page);
        expect(portraitMetrics.cellCount).toBe(9);
        expect(portraitMetrics.pageOverflowX).toBeLessThanOrEqual(1);
        expect(portraitMetrics.boardLeft).toBeGreaterThanOrEqual(-1);
        expect(portraitMetrics.boardRight).toBeLessThanOrEqual(portraitMetrics.viewportWidth + 1);
        expect(portraitMetrics.boardTop).toBeGreaterThanOrEqual(-1);
        expect(portraitMetrics.boardBottom).toBeLessThanOrEqual(portraitMetrics.viewportHeight + 1);
        expect(Math.abs(portraitMetrics.boardWidth - portraitMetrics.boardHeight)).toBeLessThanOrEqual(6);
        expect(portraitMetrics.debugOverlapsRightScore).toBe(false);
        expect(portraitMetrics.debugOverlapsTurnStatus).toBe(false);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-board-portrait'),
            fullPage: false,
        });

        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(400);

        const banner = page.getByTestId('mobile-orientation-game-banner');
        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(banner).toBeVisible({ timeout: 10000 });
        await expect(banner.getByText('建议切换为竖屏以获得更佳体验')).toBeVisible();
        await expect(page.getByRole('button', { name: '关闭提示' })).toBeVisible();

        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflowX).toBeLessThanOrEqual(1);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-landscape-orientation-banner'),
            fullPage: false,
        });
    });

    test('手机端切到错方向后显示提示条，切回竖屏后仍可继续当前对局', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('tictactoe');
        await expect(page.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(400);

        await page.locator('[data-tutorial-id="cell-0"]').click();
        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 10000 });

        const portraitMetrics = await readBoardMetrics(page);
        expect(portraitMetrics.pageOverflowX).toBeLessThanOrEqual(1);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-portrait-after-first-move'),
            fullPage: false,
        });

        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(400);
        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(page.getByTestId('mobile-orientation-game-banner')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('建议切换为竖屏以获得更佳体验')).toBeVisible();
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-landscape-banner-after-first-move'),
            fullPage: false,
        });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(400);

        await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 10000 });

        await page.locator('[data-tutorial-id="cell-4"]').click();
        await expect(page.locator('[data-tutorial-id="cell-4"] svg')).toBeVisible({ timeout: 10000 });

        const portraitReturnMetrics = await readBoardMetrics(page);
        expect(portraitReturnMetrics.pageOverflowX).toBeLessThanOrEqual(1);
        expect(Math.abs(portraitReturnMetrics.boardWidth - portraitReturnMetrics.boardHeight)).toBeLessThanOrEqual(6);
        expect(portraitReturnMetrics.debugOverlapsRightScore).toBe(false);
        expect(portraitReturnMetrics.debugOverlapsTurnStatus).toBe(false);

        const filledCells = await page.evaluate(() =>
            Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-id^="cell-"] svg')).length,
        );
        expect(filledCells, '切回竖屏后应保留已下的子并可继续对局').toBeGreaterThanOrEqual(2);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-portrait-after-second-move'),
            fullPage: false,
        });
    });
});
