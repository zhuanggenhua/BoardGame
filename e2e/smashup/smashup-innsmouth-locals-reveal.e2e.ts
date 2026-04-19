/**
 * 大杀四方 - 印斯茅斯"本地人"展示测试
 * 
 * 验证"本地人"技能的展示功能：
 * - 打出"本地人"后，展示牌库顶 3 张牌
 * - 展示 UI 应该对所有玩家可见（revealTo: 'all'）
 * - 同名卡放入手牌，其余放牌库底
 */

import { test, expect } from '../fixtures';

test.describe('印斯茅斯"本地人"展示功能', () => {
    test('打出"本地人"后，两个玩家都能看到展示 UI', async ({ smashupMatch }) => {
        const { hostPage, guestPage } = smashupMatch;

        // 等待游戏加载完成
        await hostPage.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
        await guestPage.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 注入状态：玩家 0 手牌有"本地人"，牌库顶有 3 张牌（2 张本地人 + 1 张其他）
        await hostPage.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) throw new Error('TestHarness not available');

            const state = harness.state.get();
            const player0 = state.players['0'];

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

            // 确保有足够的行动点
            player0.minionsRemaining = 1;

            harness.state.set(state);
        });

        await hostPage.waitForTimeout(1000);

        // 玩家 0 打出"本地人"
        await hostPage.click('[data-card-uid="h1"]'); // 点击手牌
        await hostPage.waitForTimeout(500);
        await hostPage.click('[data-base-index="0"]'); // 选择基地
        await hostPage.waitForTimeout(2000);

        // 等待展示 UI 出现（两个玩家都应该看到）
        await Promise.all([
            hostPage.waitForSelector('[data-testid="reveal-overlay"]', { timeout: 5000 }),
            guestPage.waitForSelector('[data-testid="reveal-overlay"]', { timeout: 5000 }),
        ]);

        // 验证玩家 0 看到展示 UI
        const player0RevealVisible = await hostPage.isVisible('[data-testid="reveal-overlay"]');
        expect(player0RevealVisible).toBe(true);

        // 验证玩家 1 看到展示 UI
        const player1RevealVisible = await guestPage.isVisible('[data-testid="reveal-overlay"]');
        expect(player1RevealVisible).toBe(true);

        // 验证展示的卡牌数量（应该是 3 张）
        const player0CardCount = await hostPage.locator('[data-testid="reveal-overlay"] [data-card-preview]').count();
        expect(player0CardCount).toBe(3);

        const player1CardCount = await guestPage.locator('[data-testid="reveal-overlay"] [data-card-preview]').count();
        expect(player1CardCount).toBe(3);

        // 截图保存证据
        await hostPage.screenshot({ path: 'test-results/innsmouth-locals-reveal-player0.png' });
        await guestPage.screenshot({ path: 'test-results/innsmouth-locals-reveal-player1.png' });

        // 点击关闭展示 UI
        await hostPage.click('[data-testid="reveal-overlay"]');

        // 验证展示 UI 消失
        await hostPage.waitForSelector('[data-testid="reveal-overlay"]', { state: 'hidden', timeout: 2000 });
        await guestPage.waitForSelector('[data-testid="reveal-overlay"]', { state: 'hidden', timeout: 2000 });

        // 验证结果：玩家 0 手牌应该有 3 张本地人（原来 1 张 + 牌库顶 2 张）
        const finalState = await hostPage.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        const player0Hand = finalState.players['0'].hand;
        const localsInHand = player0Hand.filter((c: any) => c.defId === 'innsmouth_the_locals').length;

        expect(localsInHand).toBe(3); // 原来 1 张 + 牌库顶 2 张本地人
    });

    test('牌库顶没有同名卡时，展示后全部放牌库底', async ({ smashupMatch }) => {
        const { hostPage, guestPage } = smashupMatch;

        // 等待游戏加载完成
        await hostPage.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
        await guestPage.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 注入状态：玩家 0 手牌有"本地人"，牌库顶 3 张都不是本地人
        await hostPage.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) throw new Error('TestHarness not available');

            const state = harness.state.get();
            const player0 = state.players['0'];

            player0.hand = [
                { uid: 'h1', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
            ];

            player0.deck = [
                { uid: 'd1', defId: 'aliens_scout', type: 'minion', owner: '0' },
                { uid: 'd2', defId: 'aliens_invader', type: 'minion', owner: '0' },
                { uid: 'd3', defId: 'aliens_supreme_overlord', type: 'minion', owner: '0' },
                ...player0.deck.slice(3),
            ];

            player0.minionsRemaining = 1;

            harness.state.set(state);
        });

        await hostPage.waitForTimeout(1000);

        // 打出"本地人"
        await hostPage.click('[data-card-uid="h1"]');
        await hostPage.waitForTimeout(500);
        await hostPage.click('[data-base-index="0"]');
        await hostPage.waitForTimeout(2000);

        // 等待展示 UI
        await hostPage.waitForSelector('[data-testid="reveal-overlay"]', { timeout: 5000 });
        await guestPage.waitForSelector('[data-testid="reveal-overlay"]', { timeout: 5000 });

        // 验证展示 3 张牌
        const cardCount = await hostPage.locator('[data-testid="reveal-overlay"] [data-card-preview]').count();
        expect(cardCount).toBe(3);

        // 关闭展示
        await hostPage.click('[data-testid="reveal-overlay"]');
        await hostPage.waitForSelector('[data-testid="reveal-overlay"]', { state: 'hidden' });

        // 验证：手牌只有 1 张（没有新增），牌库顶 3 张被放到牌库底
        const finalState = await hostPage.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        const player0 = finalState.players['0'];

        expect(player0.hand.length).toBe(1); // 只有原来的 1 张本地人

        // 牌库顶应该不是刚才展示的 3 张（它们被放到牌库底了）
        const deckTopCard = player0.deck[0]?.defId;
        expect(['aliens_scout', 'aliens_invader', 'aliens_supreme_overlord']).not.toContain(deckTopCard);
    });
});
