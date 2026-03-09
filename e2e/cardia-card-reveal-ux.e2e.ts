/**
 * Cardia - 卡牌翻开用户体验测试
 * 
 * 测试场景：
 * 1. P1 打出卡牌后，应该立即看到自己的卡牌（翻开状态）
 * 2. P1 打出卡牌后，对手的卡牌应该显示为卡背（未翻开状态）
 * 3. P2 打出卡牌后，双方的卡牌都应该翻开
 */

import { test, expect } from '@playwright/test';
import { setupOnlineMatch } from './helpers/cardia';

test.describe('Cardia - 卡牌翻开用户体验', () => {
    test('P1 打出卡牌后应该立即看到自己的卡牌', async ({ page }) => {
        const setup = await setupOnlineMatch(page);
        const { player1Page, player2Page, matchId } = setup;
        
        console.log('\n=== 阶段1：P1 打出卡牌 ===');
        
        // 等待游戏加载
        await player1Page.waitForTimeout(1000);
        
        // P1 打出第一张手牌
        const p1FirstCard = await player1Page.locator('[data-testid="cardia-hand-area"] button').first();
        await p1FirstCard.click();
        
        console.log('✅ P1 打出卡牌');
        
        // 等待卡牌出现在战场上
        await player1Page.waitForTimeout(1000);
        
        // 验证：P1 应该看到自己的卡牌（翻开状态）
        const myCardInBattlefield = await player1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first();
        const isMyCardVisible = await myCardInBattlefield.isVisible();
        
        console.log('我的卡牌是否可见:', isMyCardVisible);
        expect(isMyCardVisible).toBe(true);
        
        // 验证：我的卡牌应该显示影响力数值（说明是翻开状态，不是卡背）
        const myCardInfluence = await myCardInBattlefield.locator('.bg-black\\/70').first();
        const hasInfluence = await myCardInfluence.isVisible();
        
        console.log('我的卡牌是否显示影响力:', hasInfluence);
        expect(hasInfluence).toBe(true);
        
        // 验证：对手的卡牌应该显示为空槽位（因为对手还没打出卡牌）
        const emptySlots = await player1Page.locator('[data-testid="cardia-battlefield"] .border-dashed').all();
        console.log('空槽位数量:', emptySlots.length);
        expect(emptySlots.length).toBeGreaterThan(0);
        
        console.log('\n=== 阶段2：P2 打出卡牌 ===');
        
        // 等待 P2 页面加载
        await player2Page.waitForTimeout(1000);
        
        // P2 打出第一张手牌
        const p2FirstCard = await player2Page.locator('[data-testid="cardia-hand-area"] button').first();
        await p2FirstCard.click();
        
        console.log('✅ P2 打出卡牌');
        
        // 等待卡牌出现在战场上
        await player2Page.waitForTimeout(1000);
        
        console.log('\n=== 阶段3：验证双方卡牌都已翻开 ===');
        
        // 在 P1 页面验证：双方的卡牌都应该翻开
        const allCardsInBattlefield = await player1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').all();
        
        console.log('战场上的卡牌数量:', allCardsInBattlefield.length);
        expect(allCardsInBattlefield.length).toBeGreaterThanOrEqual(2);
        
        // 验证：所有卡牌都显示影响力数值（说明都是翻开状态）
        for (const card of allCardsInBattlefield) {
            const influence = await card.locator('.bg-black\\/70').first();
            const hasInfluence = await influence.isVisible();
            expect(hasInfluence).toBe(true);
        }
        
        console.log('✅ 双方卡牌都已翻开');
        console.log('✅ 所有断言通过');
        
        // 清理
        await setup.player1Context.close().catch(() => {});
        await setup.player2Context.close().catch(() => {});
    });
});
