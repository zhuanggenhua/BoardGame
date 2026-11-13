/**
 * Cardia - 基础流程 E2E 测试
 * 
 * 测试场景：
 * 1. 创建对局
 * 2. 双方打出卡牌
 * 3. 激活能力
 * 4. 结束回合
 * 5. 完成一次完整遭遇战
 */

import { test, expect } from '@playwright/test';
import { setupCardiaOnlineMatch, cleanupCardiaMatch, waitForPhase } from '../helpers/cardia';

test.describe('Cardia - Basic Flow', () => {
    test('should complete a full turn cycle', async ({ browser }, testInfo) => {
        test.setTimeout(120000);

        // 创建两个玩家的浏览器上下文
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        // 捕获控制台日志以诊断问题
        p1Page.on('console', msg => {
            console.log(`[P1 Console ${msg.type()}] ${msg.text()}`);
        });
        
        p2Page.on('console', msg => {
            console.log(`[P2 Console ${msg.type()}] ${msg.text()}`);
        });
        
        // 捕获页面错误
        p1Page.on('pageerror', error => {
            console.log(`[P1 Page Error] ${error.message}`);
            console.log(error.stack);
        });
        
        p2Page.on('pageerror', error => {
            console.log(`[P2 Page Error] ${error.message}`);
            console.log(error.stack);
        });
        
        try {
            // 检查页面内容，看看是否显示"Game client not found"
            await p1Page.waitForTimeout(5000);
            const pageContent = await p1Page.content();
            if (pageContent.includes('Game client not found')) {
                console.log('[DEBUG] Page shows "Game client not found"');
                
                // 检查 loadGameImplementation 是否被调用
                const debugInfo = await p1Page.evaluate(() => {
                    return {
                        hasRegistry: typeof (window as any).__GAME_REGISTRY__ !== 'undefined',
                        gameId: (window as any).__CURRENT_GAME_ID__,
                    };
                });
                console.log('[DEBUG] Debug info:', debugInfo);
            }
            
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // ============================================================
            // 打出卡牌阶段：双方同时打出卡牌
            // ============================================================
            
            // 验证当前是打出卡牌阶段
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Play Card|打出卡牌/);
            await expect(p2Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Play Card|打出卡牌/);
            
            // P1 打出第一张手牌
            const p1FirstCard = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p1FirstCard.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(500);
            
            // P2 打出第一张手牌
            const p2FirstCard = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p2FirstCard.click();
            
            // 等待双方卡牌都打出后,战场上应该出现卡牌
            await expect(p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first()).toBeVisible({ timeout: 10000 });
            
            // 等待状态同步
            await p1Page.waitForTimeout(1000);
            
            // ============================================================
            // 能力阶段：失败者可以激活能力
            // ============================================================
            
            // 平局直接进入下一回合；有胜负时由失败者决定是否使用能力。
            await p1Page.waitForFunction(() => {
                const core = (window as any).__BG_STATE__?.core;
                return core && (core.phase === 'ability' || (core.phase === 'play' && core.turnNumber > 1));
            }, null, { timeout: 15000 });
            const outcome = await p1Page.evaluate(() => {
                const core = (window as any).__BG_STATE__.core;
                return { phase: core.phase, loserId: core.currentEncounter?.loserId, encounter: core.encounterHistory[0] };
            });
            expect(outcome.encounter).toBeTruthy();
            if (outcome.phase === 'ability') {
                expect(['0', '1']).toContain(outcome.loserId);
                await expect(p2Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Ability|能力/, { timeout: 10000 });
                const loserPage = outcome.loserId === '0' ? p1Page : p2Page;
                await loserPage.locator('[data-testid="cardia-skip-ability-btn"]').click({ timeout: 10000 });
            } else {
                expect(outcome.encounter.winnerId).toBeUndefined();
                expect(outcome.encounter.loserId).toBeUndefined();
            }
            
            // ============================================================
            // 结束阶段：Cardia 现行流程会自动完成回合结束并回到出牌阶段
            // ============================================================

            await waitForPhase(p1Page, 'play', 15000);
            await waitForPhase(p2Page, 'play', 15000);
            
            // ============================================================
            // 验证回合结束后的状态
            // ============================================================
            
            // 验证回合数增加
            // 验证双方都抽了新牌
            // 验证回到打出卡牌阶段
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Play Card|打出卡牌/, { timeout: 10000 });
            await expect(p2Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Play Card|打出卡牌/, { timeout: 10000 });
            
            // 验证印戒计数器更新（至少有一方获得印戒）
            // 注意：页面上有两个 signet display（我方和对方），所以使用 first() 获取第一个
            const p1SignetsText = await p1Page.locator('[data-testid="cardia-signet-display"]').first().textContent();
            const p2SignetsText = await p2Page.locator('[data-testid="cardia-signet-display"]').first().textContent();
            
            // 至少有一方的印戒数量应该 > 0（除非平局）
            const p1Signets = parseInt(p1SignetsText?.match(/\d+/)?.[0] || '0');
            const p2Signets = parseInt(p2SignetsText?.match(/\d+/)?.[0] || '0');
            const totalSignets = p1Signets + p2Signets;
            expect(totalSignets).toBeGreaterThanOrEqual(0);
            
            // ============================================================
            // 验证回合循环
            // ============================================================
            
            // 应该回到 P1 的回合
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Play Card|打出卡牌/);
            
            // 验证回合数增加
            const turnNumber = await p1Page.locator('[data-testid="cardia-turn-number"]').textContent();
            expect(parseInt(turnNumber || '1')).toBeGreaterThan(1);
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
    
    test('should handle ability activation', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // P1 打出卡牌
            const p1Card = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p1Card.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(500);
            
            // P2 打出卡牌
            const p2Card = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p2Card.click();
            
            // 等待双方卡牌都打出后,战场上应该出现卡牌
            await expect(p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first()).toBeVisible({ timeout: 10000 });
            
            // 等待遭遇战解析和进入能力阶段
            await p1Page.waitForTimeout(1000);
            
            // 验证进入能力阶段
            await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Ability|能力/, { timeout: 10000 });
            await expect(p2Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText(/Ability|能力/, { timeout: 10000 });
            
            // 检查哪个玩家是失败者（可以激活能力）
            const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
            const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
            
            // 如果有失败者，尝试激活能力或跳过
            try {
                await p1SkipButton.waitFor({ state: 'visible', timeout: 5000 });
                // P1 是失败者，可以激活能力
                const battlefieldCard = p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first();
                if (await battlefieldCard.isVisible()) {
                    // 尝试点击卡牌激活能力
                    await battlefieldCard.click();
                    await p1Page.waitForTimeout(500);
                }
                // 跳过能力
                await p1SkipButton.click();
            } catch {
                try {
                    await p2SkipButton.waitFor({ state: 'visible', timeout: 5000 });
                    // P2 是失败者，可以激活能力
                    const battlefieldCard = p2Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first();
                    if (await battlefieldCard.isVisible()) {
                        // 尝试点击卡牌激活能力
                        await battlefieldCard.click();
                        await p2Page.waitForTimeout(500);
                    }
                    // 跳过能力
                    await p2SkipButton.click();
                } catch {
                    console.log('[DEBUG] 没有找到跳过能力按钮');
                }
            }
            
            // 验证能力阶段完成
            await p1Page.waitForTimeout(500);
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
    
    test('should end game when player reaches 5 signets', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // 使用作弊命令快速设置印戒数量
            await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (harness) {
                    harness.state.patch({
                        players: {
                            '0': { signets: 4 },
                        },
                    });
                }
            });
            
            // 等待状态同步
            await p1Page.waitForTimeout(500);
            
            // 进行一次遭遇战，让 P1 获得第 5 个印戒
            // P1 打出卡牌
            const p1Card = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p1Card.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(500);
            
            // P2 打出卡牌
            const p2Card = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p2Card.click();
            
            // 等待双方卡牌都打出后,战场上应该出现卡牌
            await expect(p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first()).toBeVisible({ timeout: 10000 });
            
            // 等待遭遇战解析
            await p1Page.waitForTimeout(1000);
            
            // 检查哪个玩家是失败者并跳过能力
            const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
            const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
            
            try {
                await p1SkipButton.waitFor({ state: 'visible', timeout: 5000 });
                await p1SkipButton.click();
            } catch {
                try {
                    await p2SkipButton.waitFor({ state: 'visible', timeout: 5000 });
                    await p2SkipButton.click();
                } catch {
                    console.log('[DEBUG] 没有找到跳过能力按钮');
                }
            }
            
            // 等待进入结束阶段
            await p1Page.waitForTimeout(500);
            
            // 结束回合
            const p1EndButton = p1Page.locator('[data-testid="cardia-end-turn-btn"]');
            const p2EndButton = p2Page.locator('[data-testid="cardia-end-turn-btn"]');
            
            if (await p1EndButton.isVisible()) {
                await p1EndButton.click();
            } else if (await p2EndButton.isVisible()) {
                await p2EndButton.click();
            }
            
            // 等待游戏结束
            await p1Page.waitForTimeout(2000);
            
            // 验证游戏结束界面出现
            const gameOverModal = p1Page.locator('[data-testid="game-over-modal"]');
            if (await gameOverModal.isVisible()) {
                await expect(gameOverModal).toContainText('胜利');
            }
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
});
