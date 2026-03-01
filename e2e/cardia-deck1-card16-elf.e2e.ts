import { test, expect } from '@playwright/test';
import { 
    setupCardiaOnlineMatch, 
    cleanupCardiaMatch,
    readCoreState,
    injectHandCards,
    setPhase,
    playCard,
    waitForPhase,
    applyCoreStateDirect,
} from './helpers/cardia';

/**
 * 影响力16 - 精灵
 * 能力：失败时直接获胜
 * 触发条件：onLose（遭遇失败时）
 * 
 * 使用 Debug Panel API 进行状态注入，创建测试场景：
 * - P1 打出精灵（影响力16）
 * - P2 打出更高影响力的牌（使用修正标记让影响力 > 16）
 * - P1 失败，触发精灵能力
 * - P1 激活精灵能力，直接获胜
 */
test.describe('Cardia 一号牌组 - 精灵', () => {
    test('影响力16 - 精灵：失败时直接获胜', async ({ browser }) => {
        const setup = await setupCardiaOnlineMatch(browser);
        if (!setup) throw new Error('Failed to setup match');
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            console.log('\n=== 测试精灵能力 ===');
            
            // 1. 注入手牌：P1 有精灵，P2 有低影响力牌
            console.log('注入 P1 手牌：影响力16（精灵）');
            await injectHandCards(p1Page, '0', [
                { defId: 'deck_i_card_16' } // 精灵
            ]);
            
            console.log('注入 P2 手牌：影响力1');
            await injectHandCards(p2Page, '1', [
                { defId: 'deck_i_card_01' } // 雇佣剑士（影响力1）
            ]);
            
            // 设置阶段为 play
            await setPhase(p1Page, 'play');
            await p1Page.waitForTimeout(500);
            
            // 2. P1 打出精灵（影响力16）
            console.log('P1 打出影响力16（精灵）');
            await playCard(p1Page, 0);
            await p1Page.waitForTimeout(500);
            
            // 3. 在 P2 打牌前，给 P2 的手牌添加修正标记，使其影响力 > 16
            console.log('给 P2 的手牌添加修正标记（+20影响力）');
            const stateBeforeP2Play = await readCoreState(p1Page);
            const p2HandCard = stateBeforeP2Play.players['1'].hand[0];
            
            // 添加修正标记到 core.modifierTokens
            if (!stateBeforeP2Play.modifierTokens) {
                stateBeforeP2Play.modifierTokens = [];
            }
            stateBeforeP2Play.modifierTokens.push({
                cardId: p2HandCard.uid,
                value: 20,
                source: 'test_modifier',
            });
            
            await applyCoreStateDirect(p1Page, stateBeforeP2Play);
            await p1Page.waitForTimeout(500);
            
            console.log('修正标记已添加到 P2 手牌:', {
                cardUid: p2HandCard.uid,
                baseInfluence: p2HandCard.baseInfluence,
                modifierValue: 20,
                expectedTotal: p2HandCard.baseInfluence + 20,
            });
            
            // 4. P2 打出影响力1（带修正标记，实际影响力 21）
            console.log('P2 打出影响力1（带修正标记，实际影响力 21）');
            await playCard(p2Page, 0);
            
            // 5. 等待进入能力阶段
            console.log('等待进入能力阶段...');
            await waitForPhase(p1Page, 'ability');
            
            // 6. 验证遭遇战结果：P2 应该赢（21 > 16），P1 失败
            const stateAfterEncounter = await readCoreState(p1Page);
            console.log('遭遇战解析后状态:', {
                phase: stateAfterEncounter.phase,
                p1PlayedCard: stateAfterEncounter.players['0'].playedCards[0]?.baseInfluence,
                p2PlayedCard: stateAfterEncounter.players['1'].playedCards[0]?.baseInfluence,
                modifierTokens: stateAfterEncounter.modifierTokens,
            });
            
            // 7. P1 失败，精灵能力应该可以激活（trigger: 'onLose'）
            console.log('等待 P1 的能力按钮（精灵能力 - onLose 触发）');
            const abilityButton = p1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 能力按钮已显示');
            
            // 8. 激活精灵能力
            console.log('激活精灵能力');
            await abilityButton.click();
            await p1Page.waitForTimeout(2000); // 增加等待时间，确保事件处理完成
            
            // 9. 验证：游戏应该结束，P1 获胜（精灵能力：失败时直接获胜）
            // 注意：需要读取完整状态（包含 sys），不只是 core
            const fullState = await p1Page.evaluate(() => {
                const debugPanel = document.querySelector('[data-testid="debug-state-json"]');
                if (!debugPanel) return null;
                const raw = debugPanel.textContent || '{}';
                return JSON.parse(raw);
            });
            
            console.log('能力执行后（完整状态）:', {
                isGameOver: fullState?.sys?.gameover?.isGameOver || false,
                winnerId: fullState?.sys?.gameover?.winnerId,
                fullGameover: fullState?.sys?.gameover,
            });
            
            // 核心功能验证：游戏结束，P1 获胜
            expect(fullState?.sys?.gameover).toBeDefined();
            expect(fullState?.sys?.gameover?.winner).toBe('0');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
});
