/**
 * Cardia - 能力阶段调试测试
 * 用于调试能力阶段为什么卡住
 */

import { test, expect } from '@playwright/test';
import { setupCardiaOnlineMatch, cleanupCardiaMatch } from './helpers/cardia';

test.describe('Cardia - Debug Ability Phase', () => {
    test('should debug ability phase stuck', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // P1 打出第一张手牌
            const p1FirstCard = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p1FirstCard.click();
            await p1Page.waitForTimeout(500);
            
            // P2 打出第一张手牌
            const p2FirstCard = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p2FirstCard.click();
            
            // 等待遭遇解析
            await p1Page.waitForTimeout(1000);
            
            // 读取能力阶段的状态
            const abilityPhaseState = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                    currentEncounter: state.core.currentEncounter ? {
                        winnerId: state.core.currentEncounter.winnerId,
                        loserId: state.core.currentEncounter.loserId,
                        player1Influence: state.core.currentEncounter.player1Influence,
                        player2Influence: state.core.currentEncounter.player2Influence,
                    } : null,
                    p1CurrentCard: state.core.players['0'].currentCard,
                    p2CurrentCard: state.core.players['1'].currentCard,
                    p1PlayedCards: state.core.players['0'].playedCards.length,
                    p2PlayedCards: state.core.players['1'].playedCards.length,
                };
            });
            
            console.log('[DEBUG] Ability phase state:', JSON.stringify(abilityPhaseState, null, 2));
            
            // 检查是否有跳过按钮
            const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
            const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
            
            const p1HasSkipButton = await p1SkipButton.isVisible();
            const p2HasSkipButton = await p2SkipButton.isVisible();
            
            console.log('[DEBUG] P1 has skip button:', p1HasSkipButton);
            console.log('[DEBUG] P2 has skip button:', p2HasSkipButton);
            
            // 检查是否有能力按钮
            const p1AbilityButton = p1Page.locator('[data-testid^="ability-button-"]');
            const p2AbilityButton = p2Page.locator('[data-testid^="ability-button-"]');
            
            const p1AbilityButtonCount = await p1AbilityButton.count();
            const p2AbilityButtonCount = await p2AbilityButton.count();
            
            console.log('[DEBUG] P1 ability button count:', p1AbilityButtonCount);
            console.log('[DEBUG] P2 ability button count:', p2AbilityButtonCount);
            
            // 检查阶段指示器的实际文本
            const p1PhaseText = await p1Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
            const p2PhaseText = await p2Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
            
            console.log('[DEBUG] P1 phase text:', p1PhaseText);
            console.log('[DEBUG] P2 phase text:', p2PhaseText);
            
            // 如果有跳过按钮,点击它
            if (p1HasSkipButton) {
                console.log('[DEBUG] Clicking P1 skip button');
                await p1SkipButton.click();
                await p1Page.waitForTimeout(1000);
            } else if (p2HasSkipButton) {
                console.log('[DEBUG] Clicking P2 skip button');
                await p2SkipButton.click();
                await p2Page.waitForTimeout(1000);
            } else {
                console.log('[DEBUG] No skip button found!');
            }
            
            // 读取跳过后的状态
            const afterSkipState = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                };
            });
            
            console.log('[DEBUG] After skip state:', JSON.stringify(afterSkipState, null, 2));
            
            // 检查阶段是否推进
            const afterSkipPhaseText = await p1Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
            console.log('[DEBUG] After skip phase text:', afterSkipPhaseText);
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
});
