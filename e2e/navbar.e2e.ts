import { test, expect } from '@playwright/test';

test('Homepage Navbar Check', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
    // 1. 访问首页 (自动使用 config 中的 baseURL)
    await page.goto('/');

    // 2. 等待页面加载
    await expect(page.getByRole('heading', { name: 'Board Game Learning & Play' })).toBeVisible();

    // 3. 检查导航栏元素
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // 检查登录/注册按钮
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();

    // 检查游戏分类 Pills
    const categories = ['All Games', 'Strategy', 'Casual', 'Party', 'Abstract', 'Tools'];
    for (const cat of categories) {
        await expect(page.getByRole('button', { name: cat })).toBeVisible();
    }

    // 4. 截图保存
    await page.screenshot({ path: 'e2e/screenshots/homepage-navbar.png', fullPage: false });
    console.log('Screenshot saved to e2e/screenshots/homepage-navbar.png');
});
