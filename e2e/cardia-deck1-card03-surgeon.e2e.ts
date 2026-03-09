import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力3 - 外科医生（使用真实游戏操作）
 * 能力：为你下一张打出的牌添加-5影响力
 * 
 * 能力类型：延迟效果（delayed effect）
 * 效果：
 * - 步骤1：P1 激活外科医生能力
 * - 步骤2：注册延迟效果（onNextCardPlayed）
 * - 步骤3：P1 下一张打出的牌自动获得 -5 影响力修正
 * 
 * 测试场景（真实游戏操作）：
 * - 回合1：P1 打出 card03（外科医生，影响力3），P2 打出 card06（占卜师，影响力6）
 *   - P1 失败（3 < 6），激活外科医生能力
 *   - 注册延迟效果：下一张打出的牌 -5 影响力
 * - 回合2：P1 打出 card08（审判官，影响力8），P2 打出使者（影响力3）
 *   - 延迟效果触发：审判官获得 -5 修正标记（8 - 5 = 3）
 *   - P1 胜利（3 > 3）
 * - 验证：审判官获得了 -5 修正标记
 */
test.describe('Cardia 一号牌组 - 外科医生（真实操作）', () => {
    test('影响力3 - 外科医生：为下一张打出的牌添加-5影响力', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_03', 'deck_i_card_08'], // 外科医生、审判官
                deck: ['deck_i_card_05', 'deck_i_card_09'],
            },
            player2: {
                hand: ['deck_i_card_06', 'deck_ii_card_03'], // 占卜师、使者（无能力冲突）
                deck: ['deck_i_card_04', 'deck_i_card_10'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 回合1：外科医生注册延迟效果 ===');
            
            // P1 打出外科医生（影响力3）
            console.log('P1 打出影响力3（外科医生）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出占卜师（影响力6）
            console.log('P2 打出影响力6（占卜师）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P1 失败，进入能力阶段
            console.log('等待能力阶段...');
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            // 激活外科医生能力
            const surgeonAbilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await surgeonAbilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活外科医生能力');
            await surgeonAbilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 外科医生能力不需要交互，直接注册延迟效果
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 验证延迟效果已注册
            const stateAfterRound1 = await readCoreState(setup.player1Page);
            console.log('回合1结束状态:', {
                delayedEffects: stateAfterRound1.delayedEffects,
            });
            
            expect((stateAfterRound1.delayedEffects as any[]).length).toBeGreaterThan(0);
            const surgeonEffect = (stateAfterRound1.delayedEffects as any[]).find(
                (e: any) => e.condition === 'onNextCardPlayed' && e.value === -5
            );
            expect(surgeonEffect).toBeDefined();
            console.log('✅ 外科医生延迟效果已注册');
            
            console.log('\n=== 回合2：延迟效果触发 ===');
            
            // P1 打出审判官（影响力8）
            console.log('P1 打出影响力8（审判官）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出使者（影响力3）
            console.log('P2 打出影响力3（使者）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P1 胜利，可能进入能力阶段（审判官有能力）
            const currentPhase = await setup.player1Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
            console.log('当前阶段:', currentPhase);
            
            if (currentPhase?.includes('Ability')) {
                console.log('进入能力阶段，跳过审判官能力');
                const skipButton = setup.player1Page.locator('button').filter({ hasText: /Skip|跳过/ });
                const skipCount = await skipButton.count();
                if (skipCount > 0) {
                    await skipButton.first().click();
                    await setup.player1Page.waitForTimeout(500);
                }
            }
            
            // 等待回合结束
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 验证延迟效果已触发 ===');
            
            const stateAfter = await readCoreState(setup.player1Page);
            console.log('延迟效果触发后:', {
                modifierTokens: stateAfter.modifierTokens,
                delayedEffects: stateAfter.delayedEffects,
            });
            
            // 验证审判官获得了 -5 修正标记
            const magistrateModifier = (stateAfter.modifierTokens as any[]).find(
                (token: any) => token.value === -5
            );
            expect(magistrateModifier).toBeDefined();
            console.log('✅ 审判官获得了 -5 修正标记');
            
            // 验证延迟效果已被消耗
            expect((stateAfter.delayedEffects as any[]).length).toBe(0);
            console.log('✅ 延迟效果已被消耗');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('影响力3 - 外科医生：延迟效果只影响下一张牌', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_03', 'deck_i_card_08', 'deck_i_card_10'], // 外科医生、审判官、傀儡师
                deck: ['deck_i_card_05'],
            },
            player2: {
                hand: ['deck_i_card_06', 'deck_ii_card_03', 'deck_i_card_10'], // 占卜师、使者、傀儡师
                deck: ['deck_i_card_04'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 回合1：外科医生注册延迟效果 ===');
            
            // P1 打出外科医生（影响力3）
            console.log('P1 打出影响力3（外科医生）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出占卜师（影响力6）
            console.log('P2 打出影响力6（占卜师）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P1 失败，进入能力阶段
            console.log('等待能力阶段...');
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            // 激活外科医生能力
            const surgeonAbilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await surgeonAbilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活外科医生能力');
            await surgeonAbilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 回合2：延迟效果触发（第一张牌） ===');
            
            // P1 打出审判官（影响力8）
            console.log('P1 打出影响力8（审判官）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出使者（影响力3）
            console.log('P2 打出影响力3（使者）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P1 胜利，可能进入能力阶段（审判官有能力）
            // 等待能力阶段或直接进入打牌阶段
            const currentPhase = await setup.player1Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
            console.log('当前阶段:', currentPhase);
            
            if (currentPhase?.includes('Ability')) {
                console.log('进入能力阶段，跳过审判官能力');
                // 如果有跳过按钮，点击跳过
                const skipButton = setup.player1Page.locator('button').filter({ hasText: /Skip|跳过/ });
                const skipCount = await skipButton.count();
                if (skipCount > 0) {
                    await skipButton.first().click();
                    await setup.player1Page.waitForTimeout(500);
                }
            }
            
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 验证审判官获得了 -5 修正标记
            const stateAfterRound2 = await readCoreState(setup.player1Page);
            const magistrateModifier = (stateAfterRound2.modifierTokens as any[]).find(
                (token: any) => token.value === -5
            );
            expect(magistrateModifier).toBeDefined();
            console.log('✅ 审判官获得了 -5 修正标记');
            
            console.log('\n=== 回合3：延迟效果不再触发（第二张牌） ===');
            
            // P1 打出傀儡师（影响力10）
            console.log('P1 打出影响力10（傀儡师）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出傀儡师（影响力10）
            console.log('P2 打出影响力10（傀儡师）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // 平局，不会触发能力阶段
            console.log('平局，不会触发能力阶段');
            
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 验证延迟效果只影响了第一张牌 ===');
            
            const stateAfter = await readCoreState(setup.player1Page);
            console.log('回合3结束状态:', {
                modifierTokens: stateAfter.modifierTokens,
            });
            
            // 验证只有一个 -5 修正标记（审判官的）
            const minusFiveModifiers = (stateAfter.modifierTokens as any[]).filter(
                (token: any) => token.value === -5
            );
            expect(minusFiveModifiers.length).toBe(1);
            console.log('✅ 只有审判官获得了 -5 修正标记，第二张傀儡师没有');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
