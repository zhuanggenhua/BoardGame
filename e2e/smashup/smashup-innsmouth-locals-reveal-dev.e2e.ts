/**
 * 大杀四方 - 印斯茅斯"本地人"展示测试（开发服务器）
 * 
 * 验证"本地人"技能的展示功能：
 * - 打出"本地人"后，展示牌库顶 3 张牌
 * - 展示 UI 应该对所有玩家可见（revealTo: 'all'）
 * - 同名卡放入手牌，其余放牌库底
 * 
 * 使用开发服务器（端口 3000）+ 测试模式
 */

import { test, expect } from '@playwright/test';

test.describe('印斯茅斯"本地人"展示功能（开发服务器）', () => {
    test('打出"本地人"后应该显示展示 UI', async ({ page }) => {
        // 1. 导航到游戏
        await page.goto('/play/smashup');
        
        // 2. 等待游戏加载完成
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );

        await page.waitForTimeout(1000);

        // 3. 注入状态：玩家 0 手牌有"本地人"，牌库顶有 3 张牌（2 张本地人 + 1 张其他）
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) throw new Error('TestHarness not available');

            const state = harness.state.get();
            console.log('[Test] State structure:', Object.keys(state));
            
            // SmashUp 的状态在 core 下
            const core = state.core || state;
            const player0 = core.players['0'];

            // 清空手牌，只保留一张"本地人"
            player0.hand = [
                { uid: 'h1', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
            ];

            // 设置牌库顶 3 张牌：2 张本地人 + 1 张其他
            player0.deck = [
                { uid: 'd1', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
                { uid: 'd2', defId: 'aliens_scout', type: 'minion', owner: '0' },
                { uid: 'd3', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
                ...player0.deck.slice(3), // 保留剩余牌库
            ];

            // 确保有足够的随从额度
            player0.minionsRemaining = 1;

            harness.state.set(state);
        });

        await page.waitForTimeout(1000);

        // 4. 截图：初始状态
        await page.screenshot({ path: 'test-results/innsmouth-locals-01-initial.png' });

        // 5. 打出"本地人"
        await page.click('[data-card-uid="h1"]'); // 点击手牌
        await page.waitForTimeout(500);
        await page.click('[data-base-index="0"]'); // 选择基地
        await page.waitForTimeout(2000);

        // 6. 等待展示 UI 出现
        await page.waitForSelector('[data-testid="reveal-overlay"]', { timeout: 5000 });

        // 7. 验证展示 UI 可见
        const revealVisible = await page.isVisible('[data-testid="reveal-overlay"]');
        expect(revealVisible).toBe(true);

        // 8. 验证展示的卡牌数量（应该是 3 张）
        const cardCount = await page.locator('[data-testid="reveal-overlay"] [data-card-preview]').count();
        expect(cardCount).toBe(3);

        // 9. 截图：展示 UI
        await page.screenshot({ path: 'test-results/innsmouth-locals-02-reveal-ui.png' });

        // 10. 点击关闭展示 UI
        await page.click('[data-testid="reveal-overlay"]');

        // 11. 验证展示 UI 消失
        await page.waitForSelector('[data-testid="reveal-overlay"]', { state: 'hidden', timeout: 2000 });

        // 12. 截图：关闭后
        await page.screenshot({ path: 'test-results/innsmouth-locals-03-after-close.png' });

        // 13. 验证结果：玩家 0 手牌应该有 3 张本地人（原来 1 张 + 牌库顶 2 张）
        const finalState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const core = state.core || state;
            return core;
        });
        const player0Hand = finalState.players['0'].hand;
        const localsInHand = player0Hand.filter((c: any) => c.defId === 'innsmouth_the_locals').length;

        expect(localsInHand).toBe(3); // 原来 1 张 + 牌库顶 2 张本地人
    });
});
