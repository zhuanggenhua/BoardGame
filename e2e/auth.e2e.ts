import { test, expect } from '@playwright/test';

test.describe('Auth Modal E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'en');
        });
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Board Game Learning & Play' })).toBeVisible();
    });

    test('Login modal renders required fields', async ({ page }) => {
        await page.getByRole('button', { name: /Log In|登录/i }).click();
        await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
        await expect(page.locator('input[type="text"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('Register modal renders confirm password field', async ({ page }) => {
        await page.getByRole('button', { name: /Sign Up|注册/i }).click();
        await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
        await expect(page.locator('input[type="text"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toHaveCount(2);
    });
});
