import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';

test.describe('SmashUp 调试面板发牌功能', () => {
    test('按索引发牌应该能够发出卡牌', async ({ browser }, testInfo) => {
        // 1. 创建在线对局
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) throw new Error('创建对局失败');

        const { hostPage, guestPage } = setup;

        // 2. 完成派系选择
        await completeFactionSelection(hostPage, guestPage);

        // 3. 等待游戏开始
        await waitForHandArea(hostPage);
        await waitForHandArea(guestPage);

        // 4. 打开调试面板
        await hostPage.click('[data-testid="debug-toggle"]');
        await hostPage.waitForSelector('[data-testid="su-debug-deal"]');

        // 5. 读取初始手牌数量
        const initialHandCards = await hostPage.locator('[data-testid="su-hand-area"] > div > div').count();
        console.log(`[测试] 初始手牌数量: ${initialHandCards}`);

        // 6. 在调试面板中输入索引 2 并发牌
        await hostPage.fill('input[type="number"]', '2');
        await hostPage.click('[data-testid="su-debug-deal-apply"]');

        // 7. 等待状态更新
        await hostPage.waitForTimeout(1000);

        // 8. 验证：手牌数量应该增加 1
        const afterHandCards = await hostPage.locator('[data-testid="su-hand-area"] > div > div').count();
        console.log(`[测试] 发牌后手牌数量: ${afterHandCards}`);
        
        expect(afterHandCards).toBe(initialHandCards + 1);

        await cleanupTwoPlayerMatch(setup);
    });

    test('连续发牌应该正确更新牌库和手牌', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) throw new Error('创建对局失败');

        const { hostPage, guestPage } = setup;

        await completeFactionSelection(hostPage, guestPage);
        await waitForHandArea(hostPage);
        await waitForHandArea(guestPage);

        await hostPage.click('[data-testid="debug-toggle"]');
        await hostPage.waitForSelector('[data-testid="su-debug-deal"]');

        // 读取初始手牌数量
        const initialHandCards = await hostPage.locator('[data-testid="su-hand-area"] > div > div').count();

        // 发第 0 张牌
        await hostPage.fill('input[type="number"]', '0');
        await hostPage.click('[data-testid="su-debug-deal-apply"]');
        await hostPage.waitForTimeout(500);

        // 验证手牌增加 1
        const afterFirstDeal = await hostPage.locator('[data-testid="su-hand-area"] > div > div').count();
        expect(afterFirstDeal).toBe(initialHandCards + 1);

        // 再发第 1 张
        await hostPage.fill('input[type="number"]', '1');
        await hostPage.click('[data-testid="su-debug-deal-apply"]');
        await hostPage.waitForTimeout(500);

        // 验证手牌再增加 1
        const afterSecondDeal = await hostPage.locator('[data-testid="su-hand-area"] > div > div').count();
        expect(afterSecondDeal).toBe(initialHandCards + 2);

        await cleanupTwoPlayerMatch(setup);
    });
});
