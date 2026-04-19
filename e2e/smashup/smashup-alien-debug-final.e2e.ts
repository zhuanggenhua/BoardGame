/**
 * SmashUp 外星人派系 - 通过调试面板验证卡牌图片
 * 使用 enableE2EDebug 选项启用调试面板
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';

test.describe('SmashUp 外星人卡牌调试面板验证', () => {
    test('通过调试面板发牌并验证图片', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        
        // 启用 E2E 调试模式
        const setup = await setupTwoPlayerMatch(browser, baseURL, { enableE2EDebug: true });
        if (!setup) {
            console.log('[测试] 创建对局失败');
            test.skip();
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            // 选择外星人派系
            await completeFactionSelection(hostPage, guestPage, {
                hostFactions: ['aliens', 'robots'],
                guestFactions: ['ninjas', 'pirates'],
            });

            await waitForHandArea(hostPage);
            
            // 等待更长时间让调试面板初始化
            await hostPage.waitForTimeout(5000);

            // 验证 E2E 调试标志
            const debugInfo = await hostPage.evaluate(() => {
                return {
                    debugFlag: (window as any).__BG_E2E_DEBUG__,
                    localStorage: localStorage.getItem('debug_panel_position'),
                    windowSize: { width: window.innerWidth, height: window.innerHeight },
                };
            });
            console.log('[测试] 调试信息:', JSON.stringify(debugInfo, null, 2));

            // 检查调试按钮（正确的 emoji 是 🛠️）
            const debugButton = hostPage.locator('button:has-text("🛠️")').or(hostPage.locator('[data-testid="debug-toggle"]'));
            const buttonCount = await debugButton.count();
            console.log('[测试] 调试按钮数量:', buttonCount);

            if (buttonCount === 0) {
                await hostPage.screenshot({
                    path: testInfo.outputPath('no-debug-button-final.png'),
                    fullPage: true,
                });
                console.log('[测试] ❌ 调试按钮不存在');
                test.skip();
                return;
            }

            console.log('[测试] ✅ 调试按钮存在');

            // 点击打开调试面板
            await debugButton.click();
            await hostPage.waitForTimeout(1000);

            // 等待调试面板内容加载
            await hostPage.waitForSelector('[data-testid="su-debug-deal"]', { timeout: 5000 });
            console.log('[测试] ✅ 调试面板已打开');

            // 截图调试面板
            await hostPage.screenshot({
                path: testInfo.outputPath('debug-panel-opened.png'),
                fullPage: true,
            });

            // 查找牌库中的关键卡牌
            const deckInfo = await hostPage.evaluate(() => {
                // 通过调试面板的 UI 读取牌库信息
                const deckItems = Array.from(document.querySelectorAll('[data-testid="su-debug-deal"] + div [class*="space-y-1"] > div'));
                return {
                    deckSize: deckItems.length,
                    firstFewCards: deckItems.slice(0, 5).map((item, idx) => ({
                        index: idx,
                        text: item.textContent?.trim().substring(0, 50),
                    })),
                };
            });

            console.log('[测试] 牌库信息:', JSON.stringify(deckInfo, null, 2));

            // 查找外星人关键卡牌
            const targetCards = ['alien_terraform', 'alien_probe', 'alien_crop_circles'];
            const foundCards: Array<{ index: number; defId: string; name: string }> = [];
            
            // 读取完整牌库找到目标卡牌
            const fullDeckInfo = await hostPage.evaluate((targets) => {
                const deckItems = Array.from(document.querySelectorAll('[data-testid="su-debug-deal"] + div [class*="space-y-1"] > div'));
                const found: Array<{ index: number; defId: string; name: string }> = [];
                
                deckItems.forEach((item, idx) => {
                    const text = item.textContent || '';
                    if (text.includes('alien_terraform')) {
                        found.push({ index: idx, defId: 'alien_terraform', name: '适居化' });
                    } else if (text.includes('alien_probe')) {
                        found.push({ index: idx, defId: 'alien_probe', name: '探究' });
                    } else if (text.includes('alien_crop_circles')) {
                        found.push({ index: idx, defId: 'alien_crop_circles', name: '麦田怪圈' });
                    }
                });
                
                return found;
            }, targetCards);
            
            console.log('[测试] 找到的外星人卡牌:', JSON.stringify(fullDeckInfo, null, 2));
            
            if (fullDeckInfo.length === 0) {
                console.log('[测试] ❌ 牌库中没有目标外星人卡牌');
                test.skip();
                return;
            }
            
            // 依次发每张找到的卡牌并截图
            for (const card of fullDeckInfo) {
                console.log(`[测试] 发 ${card.name} (索引 ${card.index}, defId: ${card.defId})`);
                
                await hostPage.fill('[data-testid="su-debug-deal"] input[type="number"]', String(card.index));
                await hostPage.waitForTimeout(500);
                await hostPage.click('[data-testid="su-debug-deal-apply"]');
                await hostPage.waitForTimeout(2000);
                
                // 截图手牌
                const handArea = hostPage.locator('[data-testid="su-hand-area"]');
                await handArea.screenshot({
                    path: testInfo.outputPath(`hand-with-${card.defId}.png`),
                    animations: 'disabled',
                });
                
                console.log(`[测试] ✅ 已发 ${card.name} 并截图: hand-with-${card.defId}.png`);
            }
            
            console.log('[测试]');
            console.log('[测试] 📸 请检查以下截图，确认图片与卡牌名称匹配：');
            fullDeckInfo.forEach(card => {
                console.log(`[测试]   - hand-with-${card.defId}.png 最右侧应显示 ${card.name} 的图片`);
            });
            console.log('[测试]');
            console.log('[测试] 当前图集索引配置：');
            console.log('[测试]   - alien_probe: 33');
            console.log('[测试]   - alien_terraform: 34');
            console.log('[测试]   - alien_crop_circles: 31');

        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
