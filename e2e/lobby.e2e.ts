import { test, expect } from '@playwright/test';

test.describe('Lobby E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'en');
        });
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Board Game Learning & Play' })).toBeVisible();
    });

    test('Category filters show expected games', async ({ page }) => {
        // Tools should only show Asset Slicer
        await page.getByRole('button', { name: 'Tools' }).click();
        await expect(page.getByRole('heading', { name: 'Asset Slicer' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Dice Throne' })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Tic-Tac-Toe' })).toHaveCount(0);

        // All Games should hide tools and show strategy games
        await page.getByRole('button', { name: 'All Games' }).click();
        await expect(page.getByRole('heading', { name: 'Dice Throne' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Tic-Tac-Toe' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Asset Slicer' })).toHaveCount(0);
    });

    test('Game details modal opens and shows actions', async ({ page }) => {
        await page.getByRole('heading', { name: 'Tic-Tac-Toe' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Local/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Tutorial/i })).toBeVisible();

        // Switch to leaderboard tab to ensure tab switch works
        await page.getByRole('button', { name: 'Leaderboard' }).click();
        await expect(page.getByText(/Loading|Top Wins|加载|胜场/i)).toBeVisible();
    });
});
