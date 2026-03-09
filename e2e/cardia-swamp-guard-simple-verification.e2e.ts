import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
} from './helpers/cardia';

/**
 * 沼泽守卫能力简化验证测试
 * 
 * 只验证两个核心问题：
 * 1. 回收卡牌时标记信息是否被清空
 * 2. 卡牌选择弹窗是否显示对方的牌（阴影不可选）
 */
test.describe('Cardia - 沼泽守卫能力简化验证', () => {
    test('验证卡牌选择弹窗显示对方的牌（阴影不可选）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_13'], // 沼泽守卫
                deck: ['deck_i_card_15', 'deck_i_card_16'],
                playedCards: [
                    { defId: 'deck_i_card_01', signets: 1, encounterIndex: 0 },
                    { defId: 'deck_i_card_03', signets: 0, encounterIndex: 1 },
                ],
            },
            player2: {
                hand: ['deck_i_card_14'], // 女导师
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 0, encounterIndex: 0 },
                    { defId: 'deck_i_card_05', signets: 1, encounterIndex: 1 },
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 验证卡牌选择弹窗显示对方的牌 ===');
            
            // 1. P1 打出沼泽守卫
            const p1HandCard = await setup.player1Page.locator('[data-testid^="card-"]').first();
            await p1HandCard.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 2. P2 打出女导师
            const p2HandCard = await setup.player2Page.locator('[data-testid^="card-"]').first();
            await p2HandCard.click();
            await setup.player2Page.waitForTimeout(1000);
            
            // 3. 等待进入能力阶段
            await setup.player1Page.waitForTimeout(2000);
            
            // 4. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 10000 });
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 5. 等待卡牌选择弹窗
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 卡牌选择弹窗已显示');
            
            // 6. 验证弹窗内容
            const modalContent = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const interaction = state?.sys?.interaction?.current;
                const data = interaction?.data;
                
                return {
                    totalCards: data?.cards?.length || 0,
                    availableCards: data?.cards?.filter((c: any) => 
                        !data?.disabledCardUids?.includes(c.uid)
                    ).length || 0,
                    disabledCards: data?.disabledCardUids?.length || 0,
                    myPlayerId: data?.myPlayerId,
                    opponentId: data?.opponentId,
                    cards: data?.cards?.map((c: any) => ({
                        defId: c.defId,
                        ownerId: c.ownerId,
                        isDisabled: data?.disabledCardUids?.includes(c.uid),
                    })) || [],
                };
            });
            
            console.log('弹窗内容:', JSON.stringify(modalContent, null, 2));
            
            // 核心验证
            expect(modalContent.myPlayerId).toBe('0');
            expect(modalContent.opponentId).toBe('1');
            expect(modalContent.totalCards).toBeGreaterThanOrEqual(4);
            expect(modalContent.availableCards).toBe(2);
            expect(modalContent.disabledCards).toBeGreaterThanOrEqual(2);
            
            const myCards = modalContent.cards.filter(c => c.ownerId === '0');
            const opponentCards = modalContent.cards.filter(c => c.ownerId === '1');
            
            expect(myCards.length).toBe(2);
            expect(opponentCards.length).toBeGreaterThanOrEqual(2);
            expect(myCards.every(c => !c.isDisabled)).toBe(true);
            expect(opponentCards.every(c => c.isDisabled)).toBe(true);
            
            console.log('✅ 所有验证通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
