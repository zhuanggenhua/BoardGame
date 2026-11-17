import { test, expect, initHome, openGame, switchStyle } from './helpers/homeAcceptance';
import { mkdir } from 'node:fs/promises';

for (const style of ['modern', 'classic'] as const) {
    test(`${style} 房间列表随玩家断线和重连更新颜色`, async ({ browser }, info) => {
        info.setTimeout(120_000);
        const options = { baseURL: info.project.use.baseURL, viewport: { width: 1440, height: 900 } };
        const owner = await browser.newContext(options);
        const observer = await browser.newContext(options);
        try {
            const host = await owner.newPage();
            await initHome(host);
            await openGame(host, 'modern', 'tictactoe', '井字棋');
            await host.getByRole('button', { name: '创建房间', exact: true }).click();
            await host.getByTestId('create-room-name-input').fill(`在线状态-${style}`);
            const responsePromise = host.waitForResponse(r => r.url().endsWith('/games/tictactoe/create') && r.request().method() === 'POST');
            await host.getByTestId('create-room-confirm-button').click();
            const response = await responsePromise;
            expect(response.ok()).toBe(true);
            const { matchID } = await response.json();
            await expect(host.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });

            const page = await observer.newPage();
            await initHome(page);
            if (style === 'classic') await switchStyle(page, style);
            await openGame(page, style, 'tictactoe', '井字棋');
            const room = page.getByTestId(`room-list-item-${matchID}`);
            await expect(room.locator('[data-player-status="online"]')).toBeVisible({ timeout: 30_000 });
            const evidence = `test-results/evidence-screenshots/room-presence/${style}`;
            await mkdir(evidence, { recursive: true });
            await page.screenshot({ path: `${evidence}/online.png` });
            const matchUrl = host.url();
            await host.close();
            await expect(room.locator('[data-player-status="offline"]')).toBeVisible({ timeout: 30_000 });
            await page.screenshot({ path: `${evidence}/offline.png` });
            const reconnect = await owner.newPage();
            await reconnect.goto(matchUrl);
            await expect(room.locator('[data-player-status="online"]')).toBeVisible({ timeout: 30_000 });
        } finally {
            await owner.close();
            await observer.close();
        }
    });
}
