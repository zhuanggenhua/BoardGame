/**
 * DiceThrone 简单启动测试
 * 只测试到游戏开始，不测试业务逻辑
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard, readyAndStartGame } from './helpers/dicethrone';

test.describe('DiceThrone Simple Start', () => {
    test('Online match: Can start a game successfully', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        // 选择英雄：野蛮人 vs 圣骑士
        await selectCharacter(hostPage, 'barbarian');
        await selectCharacter(guestPage, 'paladin');
        
        // 准备并开始游戏
        await readyAndStartGame(hostPage, guestPage);
        
        // 等待游戏开始
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);

        // 截图验证
        await hostPage.screenshot({ path: testInfo.outputPath('host-game-started.png'), fullPage: false });
        await guestPage.screenshot({ path: testInfo.outputPath('guest-game-started.png'), fullPage: false });

        // 验证游戏界面元素存在（而不是验证 window.__BG_STATE__，因为 DiceThrone 使用新的传输层架构）
        const hostDiceButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(hostDiceButton).toBeVisible({ timeout: 5000 });

        const guestDiceButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(guestDiceButton).toBeVisible({ timeout: 5000 });

        await guestContext.close();
        await hostContext.close();
    });
});
