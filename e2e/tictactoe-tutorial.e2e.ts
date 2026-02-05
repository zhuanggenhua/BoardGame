import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const setEnglishLocale = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
};

test.describe('TicTacToe Tutorial E2E', () => {
    test('Tutorial flow advances through AI step and finishes', async ({ page }) => {
        await setEnglishLocale(page);
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('header h1')).toBeVisible({ timeout: 15000 });

        const allGamesButton = page.getByRole('button', { name: /All Games|全部游戏/i });
        if (await allGamesButton.isVisible().catch(() => false)) {
            await allGamesButton.click();
        }

        const tictactoeCard = page.locator('a[href="/?game=tictactoe"]');
        await expect(tictactoeCard).toBeVisible({ timeout: 15000 });
        await tictactoeCard.click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await page.getByRole('button', { name: /Tutorial|教程/i }).click();
        await page.waitForURL(/\/play\/tictactoe\/tutorial/);

        await expect(page.locator('[data-tutorial-id="cell-4"]')).toBeVisible({ timeout: 15000 });

        await expect(page.getByText(/Welcome to Tic-Tac-Toe/i)).toBeVisible();
        await page.getByRole('button', { name: /^(Next|下一步)$/i }).click();

        await expect(page.getByText(/Take the center/i)).toBeVisible();
        await page.locator('[data-tutorial-id="cell-4"]').click();
        await expect(page.locator('[data-tutorial-id="cell-4"] svg')).toBeVisible();

        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/block it/i)).toBeVisible();
        await page.getByRole('button', { name: /^(Next|下一步)$/i }).click();

        await expect(page.getByText(/Good luck/i)).toBeVisible();
        await page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i }).click();

        await expect(page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i })).toHaveCount(0);
    });
});
