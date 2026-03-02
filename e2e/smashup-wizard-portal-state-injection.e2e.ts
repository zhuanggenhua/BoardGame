/**
 * 传送门交互测试 - 跳过派系选择（简化版）
 * 
 * 测试目标：验证跳过派系选择功能是否正常工作
 */

import { test, expect } from '@playwright/test';

test.describe('跳过派系选择 - 简化测试', () => {
    test('应该能通过 TestHarness 跳过派系选择', async ({ page }) => {
        // 1. 访问首页
        await page.goto('/');
        
        // 2. 等待页面加载
        await page.waitForSelector('[data-game-id]', { timeout: 10000 });
        
        // 3. 点击 SmashUp 游戏
        await page.click('[data-game-id="smashup"]');
        
        // 4. 点击本地游戏
        await page.click('text=本地游戏');
        
        // 5. 等待派系选择界面
        await page.waitForSelector('h1', { timeout: 10000 });
        
        // 6. 等待 TestHarness 可用
        await page.waitForFunction(() => window.__BG_TEST_HARNESS__ !== undefined, { timeout: 10000 });
        
        // 7. 通过 TestHarness 跳过派系选择
        await page.evaluate(() => {
            const harness = window.__BG_TEST_HARNESS__!;
            const currentState = harness.state.get();
            
            // 清除派系选择状态
            const newState = {
                ...currentState,
                factionSelection: undefined,
                players: {
                    ...currentState.players,
                    '0': {
                        ...currentState.players['0'],
                        factions: ['wizard', 'robot'],
                        hand: [
                            { uid: '0-card-1', defId: 'wizard_portal', type: 'action', owner: '0' },
                            { uid: '0-card-2', defId: 'wizard_chronomage', type: 'minion', owner: '0' },
                        ],
                    },
                    '1': {
                        ...currentState.players['1'],
                        factions: ['pirate', 'ninja'],
                        hand: [],
                    },
                },
            };
            
            harness.state.patch(newState);
        });
        
        // 8. 验证状态已更新
        const state = await page.evaluate(() => {
            return window.__BG_TEST_HARNESS__?.state.get();
        });
        
        expect(state.factionSelection).toBeUndefined();
        expect(state.players['0'].factions).toEqual(['wizard', 'robot']);
        expect(state.players['0'].hand.length).toBe(2);
        
        console.log('✅ 跳过派系选择成功！');
    });
});
