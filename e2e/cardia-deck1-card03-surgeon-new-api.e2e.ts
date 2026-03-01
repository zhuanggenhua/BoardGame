import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力3 - 外科医生（使用新API重写）
 * 能力：添加+5影响力修正
 * 
 * 对比旧版本：
 * - 旧版：~150行代码，手动注入状态，复杂的交互处理
 * - 新版：~80行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 外科医生（新API）', () => {
    test('影响力3 - 外科医生：添加+5影响力修正', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_03'], // 外科医生（影响力3）
                deck: ['deck_i_card_01', 'deck_i_card_02'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_06'], // 占卜师（影响力6）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试外科医生能力（新API）===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { deck: unknown[]; playedCards: Array<{ uid: string; defId: string; baseInfluence: number }> };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            
            console.log('初始状态:', {
                p1DeckSize: initialP1DeckSize,
                p2DeckSize: initialP2DeckSize,
            });
            
            // 2. P1 打出影响力3（外科医生）
            console.log('P1 打出影响力3（外科医生）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力6
            console.log('P2 打出影响力6');
            await playCard(setup.player2Page, 0);
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 5. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活外科医生能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 6. 等待卡牌选择弹窗出现
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 卡牌选择弹窗已显示');
            
            // 7. 选择自己的牌（点击第一张卡牌）
            const cardButton = modal.locator('button').first();
            await cardButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择卡牌');
            
            // 8. 点击确认按钮
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            console.log('✅ 已确认选择');
            
            // 9. 等待能力执行完成（自动回合结束）
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 10. 验证修正标记已添加
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            const myCardAfter = playersAfter['0'].playedCards[0]; // P1 只有一张牌
            
            console.log('能力执行后:', {
                cardDefId: myCardAfter.defId,
                cardUid: myCardAfter.uid,
                baseInfluence: myCardAfter.baseInfluence,
                coreModifierTokens: stateAfter.modifierTokens,
            });
            
            // 检查 core.modifierTokens 数组
            type ModifierToken = { cardId: string; value: number; source: string };
            const modifierTokens = stateAfter.modifierTokens as ModifierToken[];
            
            expect(modifierTokens).toBeDefined();
            expect(modifierTokens.length).toBeGreaterThan(0);
            
            // 查找外科医生添加的修正标记
            const surgeonModifier = modifierTokens.find(
                (m) => m.cardId === myCardAfter.uid && m.source === 'ability_i_surgeon'
            );
            expect(surgeonModifier).toBeDefined();
            expect(surgeonModifier!.value).toBe(5);
            
            // 验证当前影响力 = 基础影响力 + 修正值
            const totalModifiers = modifierTokens
                .filter((m) => m.cardId === myCardAfter.uid)
                .reduce((sum, m) => sum + m.value, 0);
            const currentInfluence = myCardAfter.baseInfluence + totalModifiers;
            expect(currentInfluence).toBe(8); // 3 + 5
            
            // 负路径验证：牌库减少1张（抽牌）
            expect(playersAfter['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfter['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
