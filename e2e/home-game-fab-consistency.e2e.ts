import { test, expect, initHome, switchStyle, openGame, capture } from './helpers/homeAcceptance';

for (const mobile of [false, true]) for (const style of ['modern', 'classic'] as const) {
    test(`${mobile ? '手机' : '桌面'}${style === 'modern' ? '现代' : '经典'}首页与局内悬浮球一致`, async ({ browser }, info) => {
        info.setTimeout(90_000);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
        try {
            const page = await context.newPage();
            await initHome(page);
            if (style === 'classic') await switchStyle(page, 'classic');
            await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
            await page.mouse.move(0, 0);
            const mainBall = page.getByTestId('fab-menu').locator('[data-fab-visual-id]').first();
            const appearance = (node: Element) => {
                const css = getComputedStyle(node);
                return { background: css.backgroundColor, color: css.color, border: css.borderColor, radius: css.borderRadius, width: css.width, height: css.height };
            };
            await expect(mainBall).toBeVisible();
            await expect.poll(() => mainBall.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(213, 255, 0)');
            const home = await mainBall.evaluate(appearance);
            await page.keyboard.press('Tab');
            await mainBall.locator('..').focus();
            await expect.poll(() => mainBall.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(255, 0, 138)');
            await mainBall.locator('..').blur();
            await expect.poll(() => mainBall.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(213, 255, 0)');
            await capture(page, `${mobile ? '手机' : '桌面'}-${style}-首页悬浮球`);
            await page.getByTestId('fab-menu').locator('[data-fab-id="settings"]').click();
            await expect(page.getByTestId('fab-panel-settings')).toBeVisible();
            await expect(page.getByTestId('fab-panel-settings').locator('input[type="range"]').first()).toBeVisible();
            await capture(page, `${mobile ? '手机' : '桌面'}-${style}-首页设置展开`);
            await page.getByTestId('fab-menu').locator('[data-fab-id="settings"]').click();
            await expect(page.getByTestId('fab-panel-settings')).toHaveCount(0);
            await openGame(page, style, 'tictactoe', '井字棋', mobile);
            await page.getByRole('button', { name: '创建房间', exact: true }).click();
            await page.getByTestId('create-room-name-input').fill(`浮球回归-${style}`);
            const create = page.waitForResponse(response => response.url().endsWith('/games/tictactoe/create') && response.request().method() === 'POST');
            await page.getByTestId('create-room-confirm-button').click();
            expect((await create).ok()).toBe(true);
            await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });
            await expect(mainBall).toBeVisible();
            expect(await mainBall.evaluate(appearance)).toEqual(home);
            await page.keyboard.press('Tab');
            await mainBall.locator('..').focus();
            await expect.poll(() => mainBall.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(255, 0, 138)');
            await mainBall.locator('..').blur();
            await capture(page, `${mobile ? '手机' : '桌面'}-${style}-局内悬浮球`);
            await page.getByTestId('fab-menu').locator('button[data-fab-id]').first().click();
            const gameSettings = page.locator('[data-fab-id="settings"]').filter({ visible: true });
            await gameSettings.click();
            await expect(page.getByTestId('fab-panel-settings')).toBeVisible();
            await expect(page.getByTestId('fab-panel-settings').locator('input[type="range"]').first()).toBeVisible();
            await capture(page, `${mobile ? '手机' : '桌面'}-${style}-局内设置展开`);
        } finally { await context.close(); }
    });
}
