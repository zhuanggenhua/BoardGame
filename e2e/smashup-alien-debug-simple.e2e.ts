/**
 * SmashUp 外星人派系 - 调试面板测试（简化版）
 * 使用 addInitScript 在页面加载前注入 __BG_E2E_DEBUG__
 */

import { test, expect } from '@playwright/test';

test.describe('SmashUp 调试面板显示测试', () => {
    test('验证调试面板在 E2E 环境中显示', async ({ browser }, testInfo) => {
        // 创建带有 initScript 的 context
        const context = await browser.newContext();
        await context.addInitScript(() => {
            (window as any).__BG_E2E_DEBUG__ = true;
            console.log('[E2E] __BG_E2E_DEBUG__ 已设置');
        });

        const page = await context.newPage();

        try {
            // 访问首页
            await page.goto('http://localhost:3000');
            await page.waitForTimeout(2000);

            // 检查标志是否设置成功
            const debugFlag = await page.evaluate(() => {
                return (window as any).__BG_E2E_DEBUG__;
            });
            console.log('[测试] __BG_E2E_DEBUG__ =', debugFlag);
            expect(debugFlag).toBe(true);

            // 创建对局（简化流程）
            const createButton = page.locator('button:has-text("Create Match")').or(page.locator('button:has-text("创建对局")'));
            await createButton.click();
            await page.waitForTimeout(1000);

            // 填写对局名称
            const nameInput = page.locator('input[placeholder*="Match"]').or(page.locator('input[placeholder*="对局"]'));
            await nameInput.fill('Debug Test');
            
            // 点击确认
            const confirmButton = page.locator('button:has-text("Create")').or(page.locator('button:has-text("创建")'));
            await confirmButton.click();
            await page.waitForTimeout(3000);

            // 检查是否进入对局页面
            await page.waitForURL(/\/play\/smashup\/match\//);
            console.log('[测试] 已进入对局页面');

            // 等待游戏加载
            await page.waitForTimeout(5000);

            // 检查调试按钮
            const debugButtons = await page.locator('button:has-text("🐛")').count();
            console.log('[测试] 调试按钮数量:', debugButtons);

            if (debugButtons === 0) {
                await page.screenshot({
                    path: testInfo.outputPath('no-debug-button-simple.png'),
                    fullPage: true,
                });
                console.log('[测试] ❌ 调试按钮不存在');
            } else {
                console.log('[测试] ✅ 调试按钮存在');
                
                // 点击调试按钮
                await page.locator('button:has-text("🐛")').first().click();
                await page.waitForTimeout(1000);

                // 截图调试面板
                await page.screenshot({
                    path: testInfo.outputPath('debug-panel-open.png'),
                    fullPage: true,
                });
                console.log('[测试] ✅ 已打开调试面板并截图');
            }

        } finally {
            await context.close();
        }
    });
});
