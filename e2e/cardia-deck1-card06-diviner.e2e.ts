import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力6 - 占卜师（使用新API重写）
 * 能力：下一次遭遇中，你的对手必须在你之前朝上打出牌
 * 
 * 能力类型：即时能力（instant）
 * 效果：设置 revealFirstNextEncounter 为对手ID，改变下次遭遇的揭示顺序
 * 持续时间：一次性（只影响下一次遭遇）
 * 
 * 测试场景：
 * - P1 打出影响力6（占卜师）
 * - P2 打出影响力10（傀儡师）
 * - P1 失败（6 < 10），激活占卜师能力
 * - 验证：revealFirstNextEncounter 设置为 '1'（对手先揭示）
 * - 验证：回合结束后，双方抽牌
 * 
 * 对比旧版本：
 * - 旧版：~95行代码，手动注入状态，复杂的交互处理
 * - 新版：~75行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 占卜师（新API）', () => {
    test('影响力6 - 占卜师：对手下次先揭示', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_06'], // 占卜师（影响力6）
                deck: ['deck_i_card_01', 'deck_i_card_02'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                deck: unknown[]; 
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            const initialRevealFirst = initialState.revealFirstNextEncounter;
            
            console.log('初始状态:', {
                p1DeckSize: initialP1DeckSize,
                p2DeckSize: initialP2DeckSize,
                revealFirstNextEncounter: initialRevealFirst,
            });
            
            // 2. P1 打出影响力6（占卜师）
            console.log('P1 打出影响力6（占卜师）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力10（傀儡师）
            console.log('P2 打出影响力10（傀儡师）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 阶段2：激活能力 ===');
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 5. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活占卜师能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 6. 验证：revealFirstNextEncounter 应该设置为对手ID
            const afterAbility = await readCoreState(setup.player1Page);
            
            console.log('能力执行后:', {
                revealFirstNextEncounter: afterAbility.revealFirstNextEncounter,
                phase: afterAbility.phase,
            });
            
            // 核心功能验证：揭示顺序改变（对手先揭示）
            expect(afterAbility.revealFirstNextEncounter).toBe('1'); // P2 (opponent) 先揭示
            
            console.log('✅ 揭示顺序已改变');
            
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 7. 等待回合结束（自动推进）
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 8. 验证：双方都抽牌（牌库减少1张）
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('回合结束后:', {
                p1DeckSize: playersAfter['0'].deck.length,
                p2DeckSize: playersAfter['1'].deck.length,
                revealFirstNextEncounter: stateAfter.revealFirstNextEncounter,
            });
            
            // 验证：双方都抽牌（牌库减少1张）
            expect(playersAfter['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfter['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：揭示顺序标记仍然存在（等待下次遭遇使用）
            expect(stateAfter.revealFirstNextEncounter).toBe('1');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
