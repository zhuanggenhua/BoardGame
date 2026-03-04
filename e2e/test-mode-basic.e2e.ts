/**
 * 测试模式基础验证
 * 
 * 验证测试模式的基础设施是否正常工作
 */

import { test, expect } from '@playwright/test';

test.describe('测试模式基础验证', () => {
    test('应该能加载测试模式页面并自动完成派系选择', async ({ page, context }) => {
        // 收集所有控制台日志
        const consoleLogs: string[] = [];
        
        // 监听所有控制台日志
        page.on('console', msg => {
            const logText = `[Browser ${msg.type()}] ${msg.text()}`;
            console.log(logText);
            consoleLogs.push(logText);
        });
        
        // 监听页面错误
        page.on('pageerror', error => {
            const errorText = `[Page Error] ${error.message}`;
            console.error(errorText);
            consoleLogs.push(errorText);
        });
        
        // 注入测试模式标志
        await context.addInitScript(() => {
            (window as any).__E2E_TEST_MODE__ = true;
        });

        // 导航到测试模式
        console.log('导航到测试模式页面...');
        await page.goto('/play/smashup/test?p0=wizards,aliens&p1=zombies,pirates&seed=12345', {
            waitUntil: 'networkidle',
        });
        
        // 等待 LocalGameProvider 渲染
        console.log('等待组件挂载...');
        await page.waitForTimeout(2000);
        
        // 检查页面内容
        const pageContent = await page.evaluate(() => {
            return {
                bodyText: document.body.innerText.substring(0, 500),
                hasLoadingScreen: document.body.innerText.includes('Loading') || document.body.innerText.includes('加载'),
                hasGameContent: document.body.innerText.includes('派系') || document.body.innerText.includes('Faction'),
            };
        });
        
        console.log('页面内容:', pageContent);
        
        // 如果页面还在加载，等待更长时间
        if (pageContent.hasLoadingScreen) {
            console.log('页面仍在加载，等待更长时间...');
            await page.waitForTimeout(5000);
        }
        
        // 检查 TestHarness 是否挂载
        const hasTestHarness = await page.evaluate(() => {
            return !!(window as any).__BG_TEST_HARNESS__;
        });
        
        console.log('TestHarness 是否挂载:', hasTestHarness);
        expect(hasTestHarness).toBe(true);
        
        // 等待 StateInjector 注册（最多等待 5 秒）
        console.log('等待 StateInjector 注册...');
        let stateRegistered = false;
        let regAttempts = 0;
        const maxRegAttempts = 10; // 5 秒（每次 500ms）
        
        while (!stateRegistered && regAttempts < maxRegAttempts) {
            await page.waitForTimeout(500);
            regAttempts++;
            
            stateRegistered = await page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            });
            
            console.log(`[尝试 ${regAttempts}/${maxRegAttempts}] StateInjector 是否注册: ${stateRegistered}`);
        }
        
        console.log('StateInjector 是否注册:', stateRegistered);
        
        // 如果 StateInjector 未注册，输出所有日志以便调试
        if (!stateRegistered) {
            console.log('\n=== 所有浏览器日志 ===');
            consoleLogs.forEach(log => console.log(log));
            console.log('=== 日志结束 ===\n');
        }
        
        expect(stateRegistered).toBe(true);
        
        // 等待派系选择自动完成（最多等待 10 秒）
        console.log('等待派系选择自动完成...');
        let phase = 'factionSelect';
        let attempts = 0;
        const maxAttempts = 20; // 10 秒（每次 500ms）
        
        while (phase === 'factionSelect' && attempts < maxAttempts) {
            await page.waitForTimeout(500);
            attempts++;
            
            const state = await page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness.state.get();
            });
            
            phase = state?.sys?.phase;
            console.log(`[尝试 ${attempts}/${maxAttempts}] 当前阶段: ${phase}`);
        }
        
        // 验证派系选择已完成
        expect(phase).not.toBe('factionSelect');
        console.log('✅ 派系选择已自动完成，当前阶段:', phase);
        
        // 读取最终状态
        const finalState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        console.log('最终状态:', JSON.stringify({
            phase: finalState.sys.phase,
            turnNumber: finalState.sys.turnNumber,
            player0Factions: finalState.core.players['0'].factions,
            player1Factions: finalState.core.players['1'].factions,
            player0HandSize: finalState.core.players['0'].hand.length,
            player1HandSize: finalState.core.players['1'].hand.length,
        }, null, 2));
        
        // 验证派系已正确设置（包含指定的派系）
        const p0Factions = finalState.core.players['0'].factions;
        const p1Factions = finalState.core.players['1'].factions;
        
        expect(p0Factions).toContain('wizards');
        expect(p0Factions).toContain('aliens');
        expect(p1Factions).toContain('zombies');
        expect(p1Factions).toContain('pirates');
        
        // 验证玩家已抽到初始手牌
        expect(finalState.core.players['0'].hand.length).toBeGreaterThan(0);
        expect(finalState.core.players['1'].hand.length).toBeGreaterThan(0);
        
        // 截图
        await page.screenshot({ path: 'test-results/test-mode-basic.png', fullPage: true });
        
        console.log('✅ 测试通过：派系选择自动完成，游戏已开始');
    });
});
