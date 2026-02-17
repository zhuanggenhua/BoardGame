/**
 * 召唤师战争 - 阵营选择流程 E2E 测试
 *
 * 覆盖：创建房间 → 双方加入 → 选择阵营 → 准备 → 开始 → 进入游戏
 */

import { test, expect } from '@playwright/test';
import { initContext, ensureGameServerAvailable, joinMatchViaAPI, seedMatchCredentials, getGameServerBaseURL } from './helpers/common';
import {
    createSWRoomViaAPI,
    ensurePlayerIdInUrl,
    waitForFactionSelection,
    selectFaction,
    waitForSummonerWarsUI,
    GAME_NAME,
} from './helpers/summonerwars';

const joinMatchAsGuest = async (page: import('@playwright/test').Page, matchId: string) => {
    const credentials = await joinMatchViaAPI(page, GAME_NAME, matchId, '1', 'Guest-SW-Selection');
    if (!credentials) throw new Error('Failed to join match');
    await seedMatchCredentials(page, GAME_NAME, matchId, '1', credentials);
    await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
};

test.describe('SummonerWars 阵营选择流程', () => {
    test('完整联机流程：选择阵营 → 准备 → 开始 → 进入游戏', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        // ---- Host ----
        const hostContext = await browser.newContext({ baseURL });
        await initContext(hostContext, { storageKey: '__sw_storage_reset' });
        const hostPage = await hostContext.newPage();

        // 预热 Vite 模块缓存
        await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
        await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

        if (!(await ensureGameServerAvailable(hostPage))) {
            test.skip(true, 'Game server unavailable');
        }

        const matchId = await createSWRoomViaAPI(hostPage);
        if (!matchId) test.skip(true, 'Room creation failed');

        // 导航到对局页面
        await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await waitForFactionSelection(hostPage);
        await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-initial.png') });

        // ---- Guest ----
        const guestContext = await browser.newContext({ baseURL });
        await initContext(guestContext, { storageKey: '__sw_storage_reset_g' });
        const guestPage = await guestContext.newPage();

        // 预热 Vite 模块缓存
        await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
        await guestPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

        await joinMatchAsGuest(guestPage, matchId!);
        await waitForFactionSelection(guestPage);

        // ---- Host 选择阵营 ----
        await selectFaction(hostPage, 0);
        await hostPage.waitForTimeout(1000);
        await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-host-selected.png') });

        // ---- Guest 选择阵营 ----
        await selectFaction(guestPage, 1);
        await guestPage.waitForTimeout(1000);
        await guestPage.screenshot({ path: testInfo.outputPath('sw-selection-guest-selected.png') });

        // ---- Guest 准备 ----
        const readyButton = guestPage.locator('button').filter({ hasText: /准备|Ready/i });
        await expect(readyButton).toBeVisible({ timeout: 5000 });
        await readyButton.click();
        await hostPage.waitForTimeout(1000);

        // ---- Host 开始游戏 ----
        const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game/i });
        await expect(startButton).toBeVisible({ timeout: 5000 });
        await expect(startButton).toBeEnabled({ timeout: 5000 });
        await startButton.click();

        // ---- 等待游戏 UI ----
        await waitForSummonerWarsUI(hostPage, 30000);
        await waitForSummonerWarsUI(guestPage, 30000);

        await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-game-started.png') });

        await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible();
        await expect(hostPage.getByTestId('sw-hand-area')).toBeVisible();
        await expect(hostPage.getByTestId('sw-energy-player')).toBeVisible();

        await hostContext.close();
        await guestContext.close();
    });
});
