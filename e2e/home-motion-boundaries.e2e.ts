import { test, expect, initHome, openGame, record } from './helpers/homeAcceptance';

for (const mobile of [false, true]) {
    test(`${mobile ? '手机' : '桌面'}详情快速重开、退出键与离开路由清理`, async ({ browser }, info) => {
        info.setTimeout(90_000);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
        try {
            const page = await context.newPage();
            await initHome(page);
            await openGame(page, 'modern', 'tictactoe', '井字棋', mobile);
            if (mobile) await page.getByTestId('game-details-close-button').tap(); else await page.getByTestId('game-details-close-button').click();
            await openGame(page, 'modern', 'tictactoe', '井字棋', mobile);
            await expect(page.getByTestId('game-details-modal-root')).toHaveCount(1);
            await expect(page.locator('[data-modal-exiting]')).toHaveCount(0);
            await page.keyboard.press('Escape');
            await expect(page.getByTestId('game-details-modal-root')).toHaveCount(0);
            await expect(page.locator('[data-modal-exiting]')).toHaveCount(0);
            await openGame(page, 'modern', 'tictactoe', '井字棋', mobile);
            const tutorial = page.getByTestId('game-details-modal-root').getByRole('button', { name: '教程模式', exact: true });
            if (mobile) await tutorial.tap(); else await tutorial.click();
            await expect(page).toHaveURL(/\/play\/tictactoe\/tutorial/);
            await expect(page.getByTestId('game-details-modal-root')).toHaveCount(0);
            await expect(page.locator('[data-modal-exiting]')).toHaveCount(0);
            await record('详情动效关闭边界', { mobile, reopenedOnce: true, escapeCleaned: true, actualTutorialNavigationCleaned: true });
        } finally { await context.close(); }
    });
}
