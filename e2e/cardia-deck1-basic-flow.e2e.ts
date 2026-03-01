import { test, expect } from '@playwright/test';
import { setupCardiaOnlineMatch, cleanupCardiaMatch } from './helpers/cardia';

/**
 * Cardia 一号牌组基本流程测试
 * 
 * 验证游戏基本流程能够正常运行
 */

test.describe('Cardia 一号牌组基本流程', () => {
    
    test('应该能够完成多个回合并触发能力', async ({ browser }) => {
        const setup = await setupCardiaOnlineMatch(browser);
        if (!setup) throw new Error('Failed to setup match');
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            console.log('\n=== 测试基本游戏流程 ===');
            
            // 辅助函数：打出手牌中的第一张卡牌
            async function playFirstCard(page: any) {
                const card = page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
                await card.waitFor({ state: 'visible', timeout: 5000 });
                await card.click();
                await page.waitForTimeout(500);
            }
            
            // 辅助函数：跳过能力
            async function skipAbility(page: any) {
                const skipButton = page.locator('[data-testid="cardia-skip-ability-btn"]');
                const isVisible = await skipButton.isVisible().catch(() => false);
                if (isVisible) {
                    await skipButton.click();
                    await page.waitForTimeout(500);
                }
            }
            
            // 辅助函数：结束回合
            async function endTurn(page: any) {
                const endButton = page.locator('[data-testid="cardia-end-turn-btn"]');
                await endButton.waitFor({ state: 'visible', timeout: 5000 });
                await endButton.click();
                await page.waitForTimeout(500);
            }
            
            // 回合 1
            console.log('\n[回合 1]');
            await playFirstCard(p1Page);
            await playFirstCard(p2Page);
            await p1Page.waitForTimeout(1000);
            
            // 检查是否进入能力阶段
            const phase1 = await p1Page.evaluate(() => (window as any).__BG_STATE__.core.phase);
            console.log('当前阶段:', phase1);
            expect(phase1).toBe('ability');
            
            // 跳过能力
            await skipAbility(p1Page);
            await skipAbility(p2Page);
            
            // 结束回合
            const currentPlayer1 = await p1Page.evaluate(() => (window as any).__BG_STATE__.core.currentPlayerId);
            await endTurn(currentPlayer1 === '0' ? p1Page : p2Page);
            
            // 回合 2
            console.log('\n[回合 2]');
            await playFirstCard(p1Page);
            await playFirstCard(p2Page);
            await p1Page.waitForTimeout(1000);
            
            const phase2 = await p1Page.evaluate(() => (window as any).__BG_STATE__.core.phase);
            console.log('当前阶段:', phase2);
            expect(phase2).toBe('ability');
            
            await skipAbility(p1Page);
            await skipAbility(p2Page);
            
            const currentPlayer2 = await p1Page.evaluate(() => (window as any).__BG_STATE__.core.currentPlayerId);
            await endTurn(currentPlayer2 === '0' ? p1Page : p2Page);
            
            // 回合 3
            console.log('\n[回合 3]');
            await playFirstCard(p1Page);
            await playFirstCard(p2Page);
            await p1Page.waitForTimeout(1000);
            
            const phase3 = await p1Page.evaluate(() => (window as any).__BG_STATE__.core.phase);
            console.log('当前阶段:', phase3);
            expect(phase3).toBe('ability');
            
            // 验证游戏状态
            const finalState = await p1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    turnNumber: state.core.turnNumber,
                    p1PlayedCards: state.core.players['0'].playedCards.length,
                    p2PlayedCards: state.core.players['1'].playedCards.length,
                    p1Hand: state.core.players['0'].hand.length,
                    p2Hand: state.core.players['1'].hand.length,
                };
            });
            
            console.log('\n最终状态:', finalState);
            expect(finalState.turnNumber).toBe(3);
            expect(finalState.p1PlayedCards).toBe(3);
            expect(finalState.p2PlayedCards).toBe(3);
            
            console.log('\n=== 基本流程测试完成 ===');
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
});
