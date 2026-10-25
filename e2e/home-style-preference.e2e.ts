import { test, expect, initHome, login, settings, switchStyle, capture, record } from './helpers/homeAcceptance';

test.describe.configure({ mode: 'serial' });

for (const mobile of [false, true]) {
    for (const authenticated of [false, true]) {
        const label = `${mobile ? '手机' : '桌面'}-${authenticated ? '账户' : '访客'}`;
        test(`${label}正式首页风格即时生效、刷新与跨标签同步`, async ({ browser, accounts }, info) => {
            const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
            try {
                const page = await context.newPage();
                await initHome(page);
                if (authenticated) await login(page, accounts.alice);
                const sibling = await context.newPage(); await sibling.goto('/');
                await expect(sibling.locator('html')).toHaveAttribute('data-home-entry-style', 'modern');
                await capture(page, `${label}-现代首页`);
                await settings(page); await capture(page, `${label}-现代设置展开`);
                await page.getByTestId('home-style-classic').filter({ visible: true }).click();
                await expect(page.locator('html')).toHaveAttribute('data-home-entry-style', 'classic');
                await expect(page.locator('[data-fab-id="settings"]')).toBeFocused();
                await expect(sibling.locator('html')).toHaveAttribute('data-home-entry-style', 'classic');
                await page.reload();
                await expect(page.getByTestId('classic-home-surface')).toBeVisible();
                if (authenticated) await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
                await settings(page);
                await page.keyboard.press('Escape');
                await expect(page.getByRole('radiogroup')).toHaveCount(0);
                await expect(page.locator('[data-fab-id="settings"]')).toBeFocused();
                await settings(page);
                await page.getByTestId('home-style-classic').focus();
                await expect(page.getByTestId('home-style-classic').filter({ visible: true })).toBeFocused();
                await page.keyboard.press('ArrowUp');
                await expect(sibling.locator('html')).toHaveAttribute('data-home-entry-style', 'modern');
                await page.reload();
                await expect(page.locator('html')).toHaveAttribute('data-home-entry-style', 'modern');
                await record(label, { authenticated, mobile, immediate: true, reloadBothStyles: true, crossTabBothDirections: true, keyboardSelection: true });
            } finally { await context.close(); }
        });
    }
}

test('旧书本偏好迁移仅改变首页相关键，经典及其它偏好原样保留', async ({ page }) => {
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem('bg_home_entry_style', 'book');
            localStorage.setItem('i18nextLng', 'zh-CN');
            localStorage.setItem('bg_guest_game_library', '["tictactoe"]');
            localStorage.setItem('acceptance-other-preference', 'keep-original');
            sessionStorage.setItem('seeded', 'yes');
        }
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-home-entry-style', 'modern');
    expect(await page.evaluate(() => ({ style: localStorage.getItem('bg_home_entry_style'), other: localStorage.getItem('acceptance-other-preference'), favorites: localStorage.getItem('bg_guest_game_library'), language: localStorage.getItem('i18nextLng') }))).toEqual({ style: 'modern', other: 'keep-original', favorites: '["tictactoe"]', language: 'zh-CN' });
    await switchStyle(page, 'classic');
    for (const path of ['/', '/dev/home-v2-preview', '/dev/home-v2-authoring']) {
        await page.goto(path);
        await expect(page.getByTestId('classic-home-surface')).toBeVisible();
        await expect(page).toHaveURL(/\/$/);
    }
});
