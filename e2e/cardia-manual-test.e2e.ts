import { test, expect } from '@playwright/test';
import { setupCardiaOnlineMatch, cleanupCardiaMatch } from './helpers/cardia';

/**
 * Cardia 手动测试 - 验证基本游戏流程
 * 
 * 目标：确保游戏能够正常运行，双方能够打牌、遭遇结算、能力发动
 */

test.describe('Cardia 手动测试', () => {
    test('应该能够完成一个完整的回合', async ({ browser }) => {
        const setup = await setupCardiaOnlineMatch(browser);
        if (!setup) {
            throw new Error('Failed to setup match');
        }
        const { hostPage: p1Page, guestPage: p2Page, matchId } = setup;
        
        try {
            console.log('\n=== 开始手动测试 ===');
            
            // 步骤 1：验证初始状态
            console.log('\n[步骤 1] 验证初始状态');
            const p1InitialState = await p1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    phase: state.core.phase,
                    turnNumber: state.core.turnNumber,
                    p1Hand: state.core.players['0'].hand.length,
                    p2Hand: state.core.players['1'].hand.length,
                };
            });
            console.log('初始状态:', p1InitialState);
            expect(p1InitialState.phase).toBe('play');
            expect(p1InitialState.turnNumber).toBe(1);
            expect(p1InitialState.p1Hand).toBe(5);
            expect(p1InitialState.p2Hand).toBe(5);
            
            // 步骤 2：P1 打牌
            console.log('\n[步骤 2] P1 打牌');
            const p1Card = await p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p1Card.waitFor({ state: 'visible', timeout: 5000 });
            const p1CardId = await p1Card.getAttribute('data-testid');
            console.log('P1 打出卡牌:', p1CardId);
            await p1Card.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(1000);
            
            const p1AfterPlay = await p1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    phase: state.core.phase,
                    p1HasPlayed: state.core.players['0'].hasPlayed,
                    p1Hand: state.core.players['0'].hand.length,
                    p1CurrentCard: state.core.players['0'].currentCard?.defId,
                };
            });
            console.log('P1 打牌后状态:', p1AfterPlay);
            expect(p1AfterPlay.p1HasPlayed).toBe(true);
            expect(p1AfterPlay.p1Hand).toBe(4);
            
            // 步骤 3：P2 打牌
            console.log('\n[步骤 3] P2 打牌');
            const p2Card = await p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            await p2Card.waitFor({ state: 'visible', timeout: 5000 });
            const p2CardId = await p2Card.getAttribute('data-testid');
            console.log('P2 打出卡牌:', p2CardId);
            await p2Card.click();
            
            // 等待遭遇结算
            await p1Page.waitForTimeout(2000);
            
            // 步骤 4：验证遭遇结算
            console.log('\n[步骤 4] 验证遭遇结算');
            const afterEncounter = await p1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    phase: state.core.phase,
                    currentEncounter: state.core.currentEncounter,
                    p1PlayedCards: state.core.players['0'].playedCards.length,
                    p2PlayedCards: state.core.players['1'].playedCards.length,
                };
            });
            console.log('遭遇结算后状态:', afterEncounter);
            
            // 应该进入能力阶段
            expect(afterEncounter.phase).toBe('ability');
            expect(afterEncounter.p1PlayedCards).toBe(1);
            expect(afterEncounter.p2PlayedCards).toBe(1);
            expect(afterEncounter.currentEncounter).toBeTruthy();
            
            console.log('当前遭遇:', {
                winnerId: afterEncounter.currentEncounter.winnerId,
                loserId: afterEncounter.currentEncounter.loserId,
                p1Influence: afterEncounter.currentEncounter.player1Influence,
                p2Influence: afterEncounter.currentEncounter.player2Influence,
            });
            
            // 步骤 5：处理能力阶段
            console.log('\n[步骤 5] 处理能力阶段');
            const loserId = afterEncounter.currentEncounter.loserId;
            const loserPage = loserId === '0' ? p1Page : p2Page;
            console.log('失败者:', loserId);
            
            // 检查是否有能力按钮
            const hasAbilityButton = await loserPage.locator('[data-testid^="ability-btn-"]').isVisible().catch(() => false);
            const hasSkipButton = await loserPage.locator('[data-testid="cardia-skip-ability-btn"]').isVisible().catch(() => false);
            console.log('失败者有能力按钮:', hasAbilityButton);
            console.log('失败者有跳过按钮:', hasSkipButton);
            
            // 调试：检查失败者的状态
            const loserState = await loserPage.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const myPlayerId = (window as any).__BG_PLAYER_ID__ || '1';
                const myPlayer = state.core.players[myPlayerId];
                const myCurrentCard = state.core.phase === 'ability'
                    ? myPlayer.playedCards.find((card: any) => card.encounterIndex === state.core.turnNumber)
                    : myPlayer.currentCard;
                return {
                    phase: state.core.phase,
                    myPlayerId,
                    loserId: state.core.currentEncounter?.loserId,
                    canActivateAbility: state.core.phase === 'ability' && state.core.currentEncounter?.loserId === myPlayerId,
                    myCurrentCard: myCurrentCard ? {
                        uid: myCurrentCard.uid,
                        defId: myCurrentCard.defId,
                        abilityIds: myCurrentCard.abilityIds,
                    } : null,
                };
            });
            console.log('失败者状态:', loserState);
            
            if (hasAbilityButton || hasSkipButton) {
                // 如果有能力或跳过按钮，点击跳过
                const skipButton = loserPage.locator('[data-testid="cardia-skip-ability-btn"]');
                const skipButtonVisible = await skipButton.isVisible().catch(() => false);
                if (skipButtonVisible) {
                    console.log('点击跳过能力');
                    await skipButton.click();
                } else {
                    console.log('⚠️ 跳过按钮不可见');
                }
            } else {
                console.log('⚠️ 没有能力按钮或跳过按钮，能力阶段可能卡住');
            }
            
            // 等待进入结束阶段
            await p1Page.waitForTimeout(1000);
            
            // 步骤 6：验证进入结束阶段
            console.log('\n[步骤 6] 验证进入结束阶段');
            const afterAbility = await p1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    phase: state.core.phase,
                    currentPlayerId: state.core.currentPlayerId,
                };
            });
            console.log('能力阶段后状态:', afterAbility);
            expect(afterAbility.phase).toBe('end');
            
            // 步骤 7：结束回合
            console.log('\n[步骤 7] 结束回合');
            const currentPlayerPage = afterAbility.currentPlayerId === '0' ? p1Page : p2Page;
            const endTurnButton = currentPlayerPage.locator('[data-testid="cardia-end-turn-btn"]');
            await endTurnButton.waitFor({ state: 'visible', timeout: 5000 });
            await endTurnButton.click();
            
            // 等待回合结束
            await p1Page.waitForTimeout(1000);
            
            // 步骤 8：验证新回合开始
            console.log('\n[步骤 8] 验证新回合开始');
            const afterEndTurn = await p1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    phase: state.core.phase,
                    turnNumber: state.core.turnNumber,
                    p1Hand: state.core.players['0'].hand.length,
                    p2Hand: state.core.players['1'].hand.length,
                };
            });
            console.log('新回合状态:', afterEndTurn);
            expect(afterEndTurn.phase).toBe('play');
            expect(afterEndTurn.turnNumber).toBe(2);
            
            console.log('\n=== 手动测试完成 ===');
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });
});
