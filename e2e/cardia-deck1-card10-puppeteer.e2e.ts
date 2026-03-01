import { test, expect } from '@playwright/test';
import { 
    setupOnlineMatch, 
    readCoreState,
    injectHandCards,
    setPhase,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力10 - 傀儡师
 * 能力：弃掉相对的牌，替换为你从对手手牌随机抽取的一张牌
 * 
 * 使用 Debug Panel API 进行状态注入，确保测试稳定性
 * 测试策略：验证对手场上牌被替换，对手手牌减少
 */
test.describe('Cardia 一号牌组 - 傀儡师', () => {
    test('影响力10 - 傀儡师：替换对手场上牌', async ({ page }) => {
        const setup = await setupOnlineMatch(page);
        const { player1Page: p1Page, player2Page: p2Page } = setup;
        
        try {
            console.log('\n=== 测试傀儡师能力 ===');
            
            // 1. 注入测试场景：P1 手牌包含影响力10（傀儡师），P2 手牌包含影响力16 + 额外手牌
            console.log('注入 P1 手牌：影响力10（傀儡师）');
            await injectHandCards(p1Page, '0', [
                { defId: 'deck_i_card_10' } // 傀儡师
            ]);
            
            console.log('注入 P2 手牌：影响力16 + 影响力1（用于替换）');
            await injectHandCards(p2Page, '1', [
                { defId: 'deck_i_card_16' }, // 精灵（影响力16）
                { defId: 'deck_i_card_01' }  // 雇佣剑士（影响力1，用于替换）
            ]);
            
            // 设置阶段为 play
            await setPhase(p1Page, 'play');
            
            // 等待 UI 更新
            await p1Page.waitForTimeout(500);
            await p2Page.waitForTimeout(500);
            
            // 2. 记录初始状态
            const stateBefore = await readCoreState(p1Page);
            const p2HandBefore = stateBefore.players['1'].hand.length;
            const p2PlayedCardBefore = stateBefore.players['1'].playedCards[0]; // 应该为空，因为还没打牌
            console.log('P2 初始状态:', {
                handSize: p2HandBefore,
                playedCardsCount: stateBefore.players['1'].playedCards.length,
            });
            
            // 3. P1 打出影响力10（傀儡师）
            console.log('P1 打出影响力10（傀儡师）');
            await playCard(p1Page, 0);
            
            // 4. P2 打出影响力16
            console.log('P2 打出影响力16');
            await playCard(p2Page, 0);
            
            // 5. 记录 P2 打出的牌
            const stateAfterPlay = await readCoreState(p1Page);
            const p2PlayedCardDefId = stateAfterPlay.players['1'].playedCards[0]?.defId;
            console.log('P2 打出的牌:', p2PlayedCardDefId);
            
            // 6. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(p1Page, 'ability');
            
            // 7. 检查能力按钮
            const abilityButton = p1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 能力按钮已显示');
            
            // 8. 激活能力
            console.log('激活傀儡师能力');
            await abilityButton.click();
            await p1Page.waitForTimeout(2000); // 增加等待时间，确保替换完成
            
            // 9. 验证：对手场上牌被替换，对手手牌减少
            const stateAfter = await readCoreState(p1Page);
            const p2HandAfter = stateAfter.players['1'].hand.length;
            const p2PlayedCardAfter = stateAfter.players['1'].playedCards[0];
            
            console.log('能力执行后:', {
                p2HandSize: p2HandAfter,
                p2PlayedCardDefId: p2PlayedCardAfter?.defId,
                handChange: p2HandAfter - p2HandBefore,
            });
            
            // 核心功能验证：
            // 1. P2 手牌减少 1 张（被抽取用于替换）
            expect(p2HandAfter).toBe(p2HandBefore - 1);
            console.log('✅ 对手手牌减少 1 张');
            
            // 2. P2 场上牌被替换（defId 应该改变）
            // 注意：原来是 deck_i_card_16（精灵），现在应该是 deck_i_card_01（雇佣剑士）
            expect(p2PlayedCardAfter).toBeDefined();
            expect(p2PlayedCardAfter.defId).not.toBe(p2PlayedCardDefId);
            expect(p2PlayedCardAfter.defId).toBe('deck_i_card_01'); // 应该是从手牌抽取的那张
            console.log('✅ 对手场上牌被替换');
            
            // 3. 验证 P2 弃牌堆增加（原来的牌被弃掉）
            const p2DiscardAfter = stateAfter.players['1'].discard.length;
            expect(p2DiscardAfter).toBeGreaterThan(0);
            console.log('✅ 原来的牌被弃掉');
            
            console.log('✅ 所有断言通过');
        } catch (error) {
            console.error('测试失败:', error);
            throw error;
        }
    });
});
