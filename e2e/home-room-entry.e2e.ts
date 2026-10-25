import { test, expect, initHome, switchStyle, openGame, capture, record } from './helpers/homeAcceptance';

for (const mobile of [false, true]) for (const style of ['modern', 'classic'] as const) {
    const label = `${mobile ? '手机' : '桌面'}-${style === 'modern' ? '现代' : '经典'}`;
    test(`${label}正式首页建房、第二上下文加入、离线后刷新恢复同一座位`, async ({ browser }, info) => {
        info.setTimeout(90_000);
        const options = { baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, hasTouch: mobile, isMobile: mobile };
        const host = await browser.newContext(options);
        const guest = await browser.newContext(options);
        try {
            const page = await host.newPage();
            await initHome(page);
            if (style === 'classic') await switchStyle(page, style);
            await openGame(page, style, 'tictactoe', '井字棋', mobile);
            await page.getByRole('button', { name: '创建房间', exact: true }).click();
            await page.getByTestId('create-room-name-input').fill(`首页验收-${style}`);
            await capture(page, `${label}-建房弹层`);
            const create = page.waitForResponse(r => r.url().endsWith('/games/tictactoe/create') && r.request().method() === 'POST');
            await page.getByTestId('create-room-confirm-button').click();
            const created = await create; expect(created.ok()).toBe(true);
            const { matchID } = await created.json(); expect(matchID).toBeTruthy();
            await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });
            const second = await guest.newPage(); await initHome(second);
            if (style === 'classic') await switchStyle(second, style);
            await openGame(second, style, 'tictactoe', '井字棋', mobile);
            await expect(second.getByTestId(`room-list-join-${matchID}`)).toBeVisible({ timeout: 15_000 });
            await second.getByTestId(`room-list-join-${matchID}`).click();
            await expect(second).toHaveURL(/playerID=1/);
            await expect(second.locator('[data-tutorial-id="cell-0"]')).toBeVisible();
            if (mobile) await page.locator('[data-tutorial-id="cell-0"]').tap();
            else await page.locator('[data-tutorial-id="cell-0"]').click();
            await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible();
            await expect(second.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible();
            const guestUrl = second.url();
            await guest.setOffline(true);
            await expect.poll(() => second.evaluate(() => navigator.onLine)).toBe(false);
            // 离线时刷新真实页面，确保旧 socket 和内存状态都不参与恢复。
            await second.reload({ timeout: 5_000 }).catch(error => { expect(String(error)).toMatch(/ERR_INTERNET_DISCONNECTED|ERR_FAILED|Timeout/); });
            await guest.setOffline(false);
            await second.goto(guestUrl);
            await expect(second.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 30_000 });
            await expect(second).toHaveURL(/playerID=1/);
            if (mobile) await second.locator('[data-tutorial-id="cell-1"]').tap();
            else await second.locator('[data-tutorial-id="cell-1"]').click();
            await expect(page.locator('[data-tutorial-id="cell-1"] svg')).toBeVisible();
            // 回首页只能通过正式入口恢复已有房间，验证首页重连操作。
            await page.goto('/');
            await expect(page.getByTestId('home-active-match-banner')).toBeVisible();
            if (mobile) {
                const sizes = await page.getByTestId('home-active-match-actions').getByRole('button').evaluateAll(buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
                expect(sizes.length).toBe(2);
                for (const size of sizes) { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); }
            }
            await capture(page, `${label}-首页已有房间`);
            await page.getByRole('button', { name: '重连进入', exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`/match/${matchID}`));
            await expect(page.locator('[data-tutorial-id="cell-1"] svg')).toBeVisible();
            await record(`${label}-房间`, { createStatus: created.status(), matchID, secondContextJoined: true, hostMoveSynced: true, offlineReloadRecoveredSeat: '1', recoveredMoveSynced: true, homeReconnect: true });
        } finally { await host.close(); await guest.close(); }
    });
}
