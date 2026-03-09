/**
 * Cardia - 状态调试测试
 * 用于调试卡牌打出后的状态变化
 */

import { test, expect } from '@playwright/test';
import { setupCardiaOnlineMatch, cleanupCardiaMatch } from './helpers/cardia';

test.describe('Cardia - Debug State', () => {
    test('should debug card play state', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // 读取初始状态
            const initialState = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                    turnNumber: state.core.turnNumber,
                    p1Hand: state.core.players['0'].hand.length,
                    p2Hand: state.core.players['1'].hand.length,
                    p1PlayedCards: state.core.players['0'].playedCards.length,
                    p2PlayedCards: state.core.players['1'].playedCards.length,
                    p1CurrentCard: state.core.players['0'].currentCard,
                    p2CurrentCard: state.core.players['1'].currentCard,
                };
            });
            
            console.log('[DEBUG] Initial state:', JSON.stringify(initialState, null, 2));
            
            // P1 打出第一张手牌
            const p1FirstCard = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            const p1CardUid = await p1FirstCard.getAttribute('data-testid');
            console.log('[DEBUG] P1 clicking card:', p1CardUid);
            
            await p1FirstCard.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(1000);
            
            // 读取P1打牌后的状态
            const afterP1State = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                    p1Hand: state.core.players['0'].hand.length,
                    p1PlayedCards: state.core.players['0'].playedCards.length,
                    p1CurrentCard: state.core.players['0'].currentCard ? {
                        uid: state.core.players['0'].currentCard.uid,
                        defId: state.core.players['0'].currentCard.defId,
                        encounterIndex: state.core.players['0'].currentCard.encounterIndex,
                    } : null,
                    p1HasPlayed: state.core.players['0'].hasPlayed,
                    p1CardRevealed: state.core.players['0'].cardRevealed,
                };
            });
            
            console.log('[DEBUG] After P1 play:', JSON.stringify(afterP1State, null, 2));
            
            // 检查战场上是否有卡牌元素
            const battlefieldCards = await p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').count();
            console.log('[DEBUG] Battlefield cards count:', battlefieldCards);
            
            // 检查战场HTML结构
            const battlefieldHTML = await p1Page.locator('[data-testid="cardia-battlefield"]').innerHTML();
            console.log('[DEBUG] Battlefield HTML:', battlefieldHTML.substring(0, 500));
            
            // P2 打出第一张手牌
            const p2FirstCard = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            const p2CardUid = await p2FirstCard.getAttribute('data-testid');
            console.log('[DEBUG] P2 clicking card:', p2CardUid);
            
            await p2FirstCard.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(1000);
            
            // 读取双方都打牌后的状态
            const afterP2State = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                    p1PlayedCards: state.core.players['0'].playedCards.map((c: any) => ({
                        uid: c.uid,
                        defId: c.defId,
                        encounterIndex: c.encounterIndex,
                    })),
                    p2PlayedCards: state.core.players['1'].playedCards.map((c: any) => ({
                        uid: c.uid,
                        defId: c.defId,
                        encounterIndex: c.encounterIndex,
                    })),
                    p1CurrentCard: state.core.players['0'].currentCard,
                    p2CurrentCard: state.core.players['1'].currentCard,
                    currentEncounter: state.core.currentEncounter,
                };
            });
            
            console.log('[DEBUG] After P2 play:', JSON.stringify(afterP2State, null, 2));
            
            // 再次检查战场上是否有卡牌元素
            const battlefieldCards2 = await p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').count();
            console.log('[DEBUG] Battlefield cards count after P2:', battlefieldCards2);
            
            // 检查战场HTML结构
            const battlefieldHTML2 = await p1Page.locator('[data-testid="cardia-battlefield"]').innerHTML();
            console.log('[DEBUG] Battlefield HTML after P2:', battlefieldHTML2.substring(0, 500));
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
});
