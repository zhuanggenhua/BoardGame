import { test, expect } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

test.describe('井字棋教学 E2E', () => {
    test('教学流程会推进到 AI 步骤并正常结束', async ({ page }) => {
        await setChineseLocale(page);
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        const tictactoeCard = page.getByRole('heading', { name: '井字棋' });
        await expect(tictactoeCard).toBeVisible({ timeout: 15000 });
        await tictactoeCard.click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await page.getByRole('button', { name: '教程模式' }).click();
        await page.waitForURL(/\/play\/tictactoe\/tutorial/);

        await expect(page.locator('[data-tutorial-id="cell-4"]')).toBeVisible({ timeout: 15000 });

        await expect(page.getByText(/欢迎来到井字棋/i)).toBeVisible();
        await page.getByRole('button', { name: '下一步' }).click();

        await expect(page.getByText(/占据中心是最好的开局/i)).toBeVisible();
        await page.locator('[data-tutorial-id="cell-4"]').click();
        await expect(page.locator('[data-tutorial-id="cell-4"] svg')).toBeVisible();

        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/一定要堵住它/i)).toBeVisible();
        await page.getByRole('button', { name: '下一步' }).click();

        await expect(page.getByText(/祝你好运/i)).toBeVisible();
        await page.getByRole('button', { name: '完成并返回' }).click();

        await expect(page.getByRole('button', { name: '完成并返回' })).toHaveCount(0);
    });
});
