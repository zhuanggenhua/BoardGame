import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readLiveState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 简化的发明家调试测试
 * 只测试第一次交互后的状态
 */
test.describe('Cardia - 发明家简化调试', () => {
    test('发明家：第一次交互后检查状态', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_15'], // 发明家（影响力15）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
                playedCards: [
                    { defId: 'deck_i_card_03', signets: 0, encounterIndex: 0 }, // 外科医生（影响力3）
                ],
            },
            player2: {
                hand: ['deck_i_card_16'], // 精灵（影响力16）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_10', signets: 0, encounterIndex: 0 }, // 傀儡师（影响力10）
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 打出卡牌 ===');
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 激活能力 ===');
            await waitForPhase(setup.player1Page, 'ability');
            
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            console.log('\n=== 第一次交互 ===');
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 找到所有按钮，排除确认/取消按钮
            const allButtons = modal.locator('button');
            const cardButtons = allButtons.filter({ hasNotText: /确认|Confirm|取消|Cancel/ });
            const cardCount = await cardButtons.count();
            console.log(`找到 ${cardCount} 个卡牌按钮`);
            
            // 找到第一个启用的卡牌按钮
            let firstEnabledButton = null;
            for (let i = 0; i < cardCount; i++) {
                const button = cardButtons.nth(i);
                const isEnabled = await button.isEnabled();
                if (isEnabled) {
                    firstEnabledButton = button;
                    console.log(`找到第一个启用的按钮：索引 ${i}`);
                    break;
                }
            }
            
            if (!firstEnabledButton) {
                throw new Error('未找到启用的卡牌按钮');
            }
            
            // 选择第一张卡牌
            await firstEnabledButton.click();
            await setup.player1Page.waitForTimeout(300);
            
            // 确认选择
            const confirmButton = modal.locator('button').filter({ hasText: /confirm|确认/i });
            await confirmButton.first().click({ timeout: 5000 });
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 第一次交互完成');
            
            // 等待一下，让事件处理完成
            await setup.player1Page.waitForTimeout(2000);
            
            console.log('\n=== 检查状态 ===');
            const state = await readLiveState(setup.player1Page);
            
            console.log('当前状态:', {
                phase: state.core.phase,
                modifierTokensCount: state.core.modifierTokens?.length || 0,
                modifierTokens: state.core.modifierTokens,
                interactionQueue: state.sys?.interaction?.queue?.length || 0,
                currentInteraction: state.sys?.interaction?.current,
            });
            
            // 检查是否有第二次交互在队列中
            const queueLength = state.sys?.interaction?.queue?.length || 0;
            const currentInteraction = state.sys?.interaction?.current;
            const hasSecondInteraction = queueLength > 0 || currentInteraction !== null && currentInteraction !== undefined;
            
            console.log('交互状态:', {
                queueLength,
                hasCurrentInteraction: currentInteraction !== null && currentInteraction !== undefined,
                currentInteractionId: currentInteraction?.interactionId,
            });
            console.log('是否有第二次交互:', hasSecondInteraction);
            
            // 检查是否放置了 +3 修正标记
            type ModifierToken = { cardId: string; value: number; source: string };
            const modifierTokens = state.core.modifierTokens as ModifierToken[];
            const inventorModifiers = modifierTokens?.filter(
                (m) => m.source === 'ability_i_inventor'
            ) || [];
            
            console.log('发明家修正标记数量:', inventorModifiers.length);
            console.log('发明家修正标记:', inventorModifiers);
            
            expect(inventorModifiers.length).toBeGreaterThanOrEqual(1);
            console.log('✅ 找到至少 1 个修正标记');
            
            if (hasSecondInteraction) {
                console.log('✅ 第二次交互已在队列中');
            } else {
                console.log('❌ 第二次交互未在队列中');
            }
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
