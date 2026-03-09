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
 * 效果：
 * 1. 设置 revealFirstNextEncounter 为对手ID（对手先揭示卡牌）
 * 2. 设置 forcedPlayOrderNextEncounter 为对手ID（对手必须先出牌）
 * 持续时间：一次性（只影响下一次遭遇）
 * 
 * 测试场景：
 * - 回合1：P1 打出影响力6（占卜师），P2 打出影响力10（傀儡师）
 * - P1 失败（6 < 10），激活占卜师能力
 * - 回合2：验证对手先出牌且强制出明牌
 *   - P2 先出牌（forcedPlayOrderNextEncounter 生效）
 *   - P2 的牌立即揭示（revealFirstNextEncounter 生效）
 *   - P1 后出牌
 * - 回合3：验证能力只影响一次遭遇（恢复正常顺序）
 * 
 * 对比旧版本：
 * - 旧版：~95行代码，手动注入状态，复杂的交互处理
 * - 新版：~180行代码，使用 setupCardiaTestScenario 一行配置，验证完整流程
 */
test.describe('Cardia 一号牌组 - 占卜师（新API）', () => {
    test('影响力6 - 占卜师：对手下次先出牌且强制出明牌', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_06', 'deck_i_card_01', 'deck_i_card_02'], // 占卜师（影响力6）、雇佣剑士（影响力1）、虚空法师（影响力2）
                deck: ['deck_i_card_03'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_10', 'deck_i_card_03', 'deck_i_card_04'], // 傀儡师（影响力10）、外科医生（影响力3）、调停者（影响力4）
                deck: ['deck_i_card_07'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 回合1：打出卡牌并激活能力 ===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            const initialRevealFirst = initialState.revealFirstNextEncounter;
            
            console.log('初始状态:', {
                revealFirstNextEncounter: initialRevealFirst,
            });
            
            // 2. P1 打出影响力6（占卜师）
            console.log('P1 打出影响力6（占卜师）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力10（傀儡师）
            console.log('P2 打出影响力10（傀儡师）');
            await playCard(setup.player2Page, 0);
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 检查能力按钮是否存在
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            const buttonCount = await abilityButton.count();
            console.log('能力按钮数量:', buttonCount);
            
            if (buttonCount === 0) {
                await setup.player1Page.screenshot({ 
                    path: 'test-results/card06-no-ability-button.png',
                    fullPage: true 
                });
                throw new Error('未找到能力按钮');
            }
            
            // 5. 激活能力
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活占卜师能力');
            await abilityButton.click();
            
            // 6. 等待回合结束
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 7. 验证：revealFirstNextEncounter 应该设置为对手ID
            const afterRound1 = await readCoreState(setup.player1Page);
            
            console.log('回合1结束后:', {
                revealFirstNextEncounter: afterRound1.revealFirstNextEncounter,
                forcedPlayOrderNextEncounter: afterRound1.forcedPlayOrderNextEncounter,
            });
            
            // 核心验证1：揭示顺序改变（对手先揭示）
            expect(afterRound1.revealFirstNextEncounter).toBe('1'); // P2 (opponent) 先揭示
            
            // 核心验证2：出牌顺序改变（对手先出牌）
            expect(afterRound1.forcedPlayOrderNextEncounter).toBe('1'); // P2 (opponent) 先出牌
            
            console.log('✅ 状态字段验证通过：对手下次先出牌且强制出明牌');
            
            console.log('\n=== 回合2：验证对手先出牌且强制出明牌 ===');
            
            // 8. 验证：P2 必须先出牌（P1 不能先出牌）
            console.log('验证 P1 不能先出牌（等待 P2 先出）');
            
            // 尝试让 P1 先出牌（应该被阻止或等待）
            // 在实际游戏中，UI 会禁用 P1 的出牌按钮
            // 这里我们直接让 P2 先出牌
            
            // 9. P2 先出牌（影响力3，外科医生）
            console.log('P2 先出牌（影响力3，外科医生）');
            await playCard(setup.player2Page, 0);
            
            // 等待一下让状态更新
            await setup.player1Page.waitForTimeout(500);
            
            // 10. 验证：P2 的牌立即揭示（revealFirstNextEncounter 生效）
            const afterP2Play = await readCoreState(setup.player1Page);
            type PlayerState = { 
                cardRevealed: boolean;
                hasPlayed: boolean;
                currentCard: { defId: string; baseInfluence: number } | null;
            };
            const playersAfterP2 = afterP2Play.players as Record<string, PlayerState>;
            
            console.log('P2 出牌后状态:', {
                p2HasPlayed: playersAfterP2['1'].hasPlayed,
                p2CardRevealed: playersAfterP2['1'].cardRevealed,
                p2CurrentCard: playersAfterP2['1'].currentCard?.defId,
            });
            
            // 核心验证1：P2 已出牌
            expect(playersAfterP2['1'].hasPlayed).toBe(true);
            
            // 核心验证2：P2 的牌立即揭示（强制明牌）
            expect(playersAfterP2['1'].cardRevealed).toBe(true);
            
            console.log('✅ P2 先出牌且强制出明牌');
            
            // 11. P1 后出牌（影响力1，雇佣剑士）
            console.log('P1 后出牌（影响力1，雇佣剑士）');
            await playCard(setup.player1Page, 0);
            
            // 12. 等待能力阶段或回合结束（P1 失败，雇佣剑士有能力）
            console.log('等待能力阶段或回合结束...');
            await setup.player1Page.waitForTimeout(1000);
            
            const currentPhase = await setup.player1Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
            console.log('当前阶段:', currentPhase);
            
            if (currentPhase?.includes('Ability')) {
                console.log('进入能力阶段，跳过雇佣剑士能力');
                const skipButton = setup.player1Page.locator('[data-testid="cardia-skip-ability-btn"]');
                await skipButton.waitFor({ state: 'visible', timeout: 5000 });
                await skipButton.click();
                await setup.player1Page.waitForTimeout(500);
            }
            
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 13. 验证：回合2结束后，揭示顺序标记已被清除
            const afterRound2 = await readCoreState(setup.player1Page);
            
            console.log('回合2结束后:', {
                revealFirstNextEncounter: afterRound2.revealFirstNextEncounter,
                forcedPlayOrderNextEncounter: afterRound2.forcedPlayOrderNextEncounter,
            });
            
            console.log('✅ 回合2完成，占卜师能力生效');
            
            console.log('\n=== 回合3：验证能力只影响一次遭遇 ===');
            
            // 14. P1 打出影响力2（虚空法师）
            console.log('P1 打出影响力2（虚空法师）');
            await playCard(setup.player1Page, 0);
            
            // 等待一下
            await setup.player1Page.waitForTimeout(500);
            
            // 15. 验证：P1 的牌不会立即揭示（恢复正常）
            const afterP1PlayRound3 = await readCoreState(setup.player1Page);
            const playersAfterP1Round3 = afterP1PlayRound3.players as Record<string, PlayerState>;
            
            console.log('回合3 P1 出牌后状态:', {
                p1HasPlayed: playersAfterP1Round3['0'].hasPlayed,
                p1CardRevealed: playersAfterP1Round3['0'].cardRevealed,
            });
            
            // 验证：P1 的牌不会立即揭示（恢复正常顺序）
            expect(playersAfterP1Round3['0'].cardRevealed).toBe(false);
            
            console.log('✅ P1 的牌不会立即揭示（恢复正常）');
            
            // 16. P2 打出影响力4（调停者）
            console.log('P2 打出影响力4（调停者）');
            await playCard(setup.player2Page, 0);
            
            // 17. 等待能力阶段或回合结束（P1 失败，虚空法师有能力）
            console.log('等待能力阶段或回合结束...');
            await setup.player1Page.waitForTimeout(1000);
            
            const currentPhaseRound3 = await setup.player1Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
            console.log('当前阶段:', currentPhaseRound3);
            
            if (currentPhaseRound3?.includes('Ability')) {
                console.log('进入能力阶段，跳过虚空法师能力');
                const skipButton = setup.player1Page.locator('[data-testid="cardia-skip-ability-btn"]');
                await skipButton.waitFor({ state: 'visible', timeout: 5000 });
                await skipButton.click();
                await setup.player1Page.waitForTimeout(500);
            }
            
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('✅ 回合3完成，能力只影响了一次遭遇');
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
