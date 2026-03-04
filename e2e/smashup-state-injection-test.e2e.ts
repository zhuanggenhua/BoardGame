/**
 * SmashUp - 状态注入功能测试
 * 
 * 测试目标：验证状态注入工具是否正常工作
 * 
 * 注意：这个测试跳过派系选择，直接进入游戏后测试状态注入
 */

import { test, expect } from '@playwright/test';
import { initContext, getGameServerBaseURL } from './helpers/common';
import {
    waitForTestHarness,
    buildScene,
    readGameState,
} from './helpers/smashup-state-builder';

test.describe('状态注入功能测试', () => {
    test('应该能够注入手牌和牌库', async ({ browser }) => {
        // 创建一个简单的浏览器上下文
        const context = await browser.newContext();
        await initContext(context, '__test_storage');
        const page = await context.newPage();

        // 导航到首页
        await page.goto('/');
        
        // 等待页面加载
        await page.waitForTimeout(2000);

        // 等待测试工具就绪
        await waitForTestHarness(page);

        // 测试：注入状态
        await buildScene(page, {
            playerId: '0',
            hand: ['wizard_portal', 'wizard_familiar'],
            deck: ['wizard_archmage', 'wizard_chronomage'],
            currentPlayer: '0',
            phase: 'play',
        });

        // 验证：读取状态
        const state = await readGameState(page);
        
        console.log('注入后的状态:', JSON.stringify(state, null, 2));

        // 验证手牌
        expect(state.core.players['0'].hand.length).toBe(2);
        expect(state.core.players['0'].hand[0].defId).toBe('wizard_portal');
        expect(state.core.players['0'].hand[1].defId).toBe('wizard_familiar');

        // 验证牌库
        expect(state.core.players['0'].deck.length).toBe(2);
        expect(state.core.players['0'].deck[0].defId).toBe('wizard_archmage');
        expect(state.core.players['0'].deck[1].defId).toBe('wizard_chronomage');

        // 验证当前玩家
        expect(state.core.currentPlayer).toBe('0');

        // 验证阶段
        expect(state.core.phase).toBe('play');

        await context.close();
    });

    test('应该能够控制随机数', async ({ browser }) => {
        const context = await browser.newContext();
        await initContext(context, '__test_storage2');
        const page = await context.newPage();

        await page.goto('/');
        await page.waitForTimeout(2000);
        await waitForTestHarness(page);

        // 设置随机数队列
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.random.setQueue([0.1, 0.5, 0.9]);
        });

        // 验证随机数队列
        const queueLength = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.random.queueLength();
        });

        expect(queueLength).toBe(3);

        await context.close();
    });
});
