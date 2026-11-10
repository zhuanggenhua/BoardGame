import { test, expect, initHome, login, openGame, record, switchStyle } from './helpers/homeAcceptance';

for (const mobile of [false, true]) {
    for (const authenticated of [false, true]) {
        const label = `${mobile ? '手机' : '桌面'}-${authenticated ? '账户' : '访客'}`;
        test(`${label}现代收藏在切换经典并返回后保留`, async ({ browser, accounts }, info) => {
            info.setTimeout(60_000);
            const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
            try {
                const page = await context.newPage();
                await initHome(page);
                if (authenticated) await login(page, accounts.alice);
                const details = page.getByTestId('game-details-modal-root');
                await openGame(page, 'modern', 'tictactoe', '井字棋', mobile);
                const setFavorite = async (name: string) => {
                    const write = authenticated ? page.waitForResponse(response => response.url().endsWith('/auth/user-settings/library') && response.request().method() === 'PUT') : null;
                    await details.getByRole('button', { name, exact: true }).click();
                    if (write) expect((await write).ok()).toBe(true);
                };
                const alreadyFavorite = details.getByRole('button', { name: '移出收藏：井字棋', exact: true });
                if (await alreadyFavorite.count()) await setFavorite('移出收藏：井字棋');
                await setFavorite('收藏：井字棋');
                await expect(details.getByRole('button', { name: '移出收藏：井字棋', exact: true })).toHaveAttribute('aria-pressed', 'true');
                await page.getByTestId('game-details-close-button').click();
                await expect(details).toHaveCount(0);
                await switchStyle(page, 'classic');
                await page.reload();
                await expect(page.getByTestId('classic-home-surface')).toBeVisible();
                await openGame(page, 'classic', 'tictactoe', '井字棋', mobile);
                await expect(details.getByRole('button', { name: /收藏/ })).toHaveCount(0);
                await page.getByTestId('game-details-close-button').click();
                await expect(details).toHaveCount(0);
                await switchStyle(page, 'modern');
                await page.reload();
                await openGame(page, 'modern', 'tictactoe', '井字棋', mobile);
                await expect(details.getByRole('button', { name: '移出收藏：井字棋', exact: true })).toHaveAttribute('aria-pressed', 'true');
                await setFavorite('移出收藏：井字棋');
                await expect(details.getByRole('button', { name: '收藏：井字棋', exact: true })).toHaveAttribute('aria-pressed', 'false');
                await record(`${label}-切换风格保留收藏`, { authenticated, mobile, classicHasNoFavorite: true, modernFavoriteRetained: true, reloadedBothStyles: true });
            } finally { await context.close(); }
        });
    }
}
