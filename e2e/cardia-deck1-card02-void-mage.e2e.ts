import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
    applyCoreStateDirect,
} from './helpers/cardia';

/**
 * 影响力2 - 虚空法师（使用真实游戏操作）
 * 能力：从任一张牌上弃掉所有修正标记和持续标记
 * 
 * 能力类型：即时能力（instant）
 * 效果：
 * - 步骤1：P1 选择一张牌（任意玩家的已打出牌）
 * - 步骤2：移除该牌上的所有修正标记和持续标记
 * 
 * 测试场景（真实游戏操作）：
 * - 回合1：P1 打出 card07（宫廷卫士，影响力7），P2 打出 card08（审判官，影响力8）
 *   - P1 失败（7 < 8），宫廷卫士能力：选择派系，对手不弃牌则本牌 +7 影响力
 *   - P2 选择不弃牌，宫廷卫士获得 +7 修正标记
 * - 回合2：P1 打出 card02（虚空法师，影响力2），P2 打出 card06（占卜师，影响力6）
 *   - P1 失败（2 < 6），激活虚空法师能力
 *   - P1 选择移除宫廷卫士的 +7 修正标记
 * - 验证：修正标记被移除
 */
test.describe('Cardia 一号牌组 - 虚空法师（真实操作）', () => {
    test('影响力2 - 虚空法师：移除修正标记', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_07', 'deck_i_card_02'], // 宫廷卫士、虚空法师
                deck: ['deck_i_card_05', 'deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_08', 'deck_i_card_06'], // 审判官、占卜师
                deck: ['deck_i_card_04', 'deck_i_card_09'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 回合1：宫廷卫士失败并创建修正标记 ===');
            
            // P1 打出宫廷卫士（影响力7）
            console.log('P1 打出影响力7（宫廷卫士）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出审判官（影响力8）
            console.log('P2 打出影响力8（审判官）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P1 失败，进入能力阶段
            console.log('等待能力阶段...');
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            // 激活宫廷卫士能力
            const courtGuardAbilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await courtGuardAbilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活宫廷卫士能力');
            await courtGuardAbilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 选择派系（假设弹窗出现，选择第一个派系）
            const factionModal = setup.player1Page.locator('.fixed.inset-0.z-50').first();
            await factionModal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 点击第一个派系按钮
            const factionButtons = factionModal.locator('button').filter({ hasText: /Swamp|Academy|Guild|Dynasty|沼泽|学院|公会|王朝/ });
            await factionButtons.first().click();
            await setup.player1Page.waitForTimeout(1000);
            
            // P2 可能需要选择是否弃牌，等待一段时间让交互完成
            console.log('等待宫廷卫士能力执行完成');
            await setup.player2Page.waitForTimeout(2000);
            
            // 如果 P2 有弃牌选项，尝试点击跳过（如果没有就忽略）
            const skipButton = setup.player2Page.locator('button').filter({ hasText: /Skip|跳过|不弃牌/ });
            const skipCount = await skipButton.count();
            if (skipCount > 0) {
                console.log('P2 选择不弃牌');
                await skipButton.first().click();
                await setup.player2Page.waitForTimeout(500);
            } else {
                console.log('P2 没有弃牌选项（可能没有该派系的牌）');
            }
            
            // 等待回合结束
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 验证宫廷卫士获得了 +7 修正标记
            const stateAfterRound1 = await readCoreState(setup.player1Page);
            console.log('回合1结束状态:', {
                modifierTokens: stateAfterRound1.modifierTokens,
                p1PlayedCards: (stateAfterRound1.players as any)['0'].playedCards.map((c: any) => ({ uid: c.uid, defId: c.defId })),
            });
            
            expect((stateAfterRound1.modifierTokens as any[]).length).toBeGreaterThan(0);
            console.log('✅ 宫廷卫士获得了修正标记');
            
            console.log('\n=== 回合2：虚空法师移除修正标记 ===');
            
            // P1 打出虚空法师（影响力2）
            console.log('P1 打出影响力2（虚空法师）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出占卜师（影响力6）
            console.log('P2 打出影响力6（占卜师）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            console.log('\n=== 激活虚空法师能力 ===');
            
            await waitForPhase(setup.player1Page, 'ability');
            
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活虚空法师能力');
            
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(2000);
            
            // 检查弹窗
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50').first();
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 查找卡牌（应该显示宫廷卫士，因为它有修正标记）
            const cardDivs = modal.locator('[data-testid^="card-"]');
            const cardCount = await cardDivs.count();
            console.log('找到的卡牌数量:', cardCount);
            
            if (cardCount === 0) {
                await setup.player1Page.screenshot({ 
                    path: 'test-results/card02-no-cards.png',
                    fullPage: true 
                });
                throw new Error('未找到卡牌');
            }
            
            // 找到所有卡牌按钮（data-testid 在 button 内部的 div 上）
            // 先找到所有有 data-testid 的 div，然后找它们的父 button
            const cardDivs2 = modal.locator('[data-testid^="card-"]');
            const allCardButtons = [];
            for (let i = 0; i < cardCount; i++) {
                const div = cardDivs2.nth(i);
                const button = div.locator('xpath=ancestor::button[1]');
                allCardButtons.push(button);
            }
            
            console.log('所有卡牌按钮数量:', allCardButtons.length);
            
            // 检查每个按钮的禁用状态
            for (let i = 0; i < allCardButtons.length; i++) {
                const button = allCardButtons[i];
                const isDisabled = await button.getAttribute('disabled');
                const testId = await button.locator('[data-testid^="card-"]').getAttribute('data-testid');
                console.log(`卡牌 ${i}: testId=${testId}, disabled=${isDisabled !== null}`);
            }
            
            // 找到第一个未禁用的按钮
            let enabledButton = null;
            for (let i = 0; i < allCardButtons.length; i++) {
                const button = allCardButtons[i];
                const isDisabled = await button.getAttribute('disabled');
                if (isDisabled === null) {
                    enabledButton = button;
                    console.log(`找到可点击的卡牌: 索引 ${i}`);
                    break;
                }
            }
            
            if (enabledButton === null) {
                await setup.player1Page.screenshot({ 
                    path: 'test-results/card02-all-disabled.png',
                    fullPage: true 
                });
                throw new Error('所有卡牌都被禁用');
            }
            
            // 点击第一张可点击的卡牌（宫廷卫士）
            await enabledButton.click();
            await setup.player1Page.waitForTimeout(500);
            
            // 点击确认按钮
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 验证修正标记已移除 ===');
            
            const stateAfter = await readCoreState(setup.player1Page);
            console.log('虚空法师能力执行后:', {
                modifierTokens: stateAfter.modifierTokens,
            });
            
            expect((stateAfter.modifierTokens as any[]).length).toBe(0);
            console.log('✅ 修正标记已被移除');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('影响力2 - 虚空法师：移除持续标记', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04', 'deck_i_card_02'], // 调停者、虚空法师
                deck: ['deck_i_card_05', 'deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_06', 'deck_i_card_08'], // 占卜师、审判官
                deck: ['deck_i_card_09', 'deck_i_card_11'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 回合1：调停者失败并创建持续标记 ===');
            
            // P1 打出调停者（影响力4）
            console.log('P1 打出影响力4（调停者）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出占卜师（影响力6）
            console.log('P2 打出影响力6（占卜师）');
            await playCard(setup.player2Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P1 失败，进入能力阶段
            console.log('等待能力阶段...');
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            // 激活调停者能力
            const mediatorAbilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await mediatorAbilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活调停者能力');
            await mediatorAbilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 等待回合结束
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 验证调停者获得了持续标记
            const stateAfterRound1 = await readCoreState(setup.player1Page);
            console.log('回合1结束状态:', {
                ongoingAbilities: stateAfterRound1.ongoingAbilities,
                p1PlayedCards: (stateAfterRound1.players as any)['0'].playedCards.map((c: any) => ({ uid: c.uid, defId: c.defId })),
            });
            
            expect((stateAfterRound1.ongoingAbilities as any[]).length).toBeGreaterThan(0);
            console.log('✅ 调停者获得了持续标记');
            
            console.log('\n=== 回合2：虚空法师移除持续标记 ===');
            
            // P1 打出虚空法师（影响力2）
            console.log('P1 打出影响力2（虚空法师）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            
            // P2 打出审判官（影响力8）
            console.log('P2 打出影响力8（审判官）');
            await playCard(setup.player2Page, 1); // 第二回合打第二张牌（审判官，索引1）
            await setup.player1Page.waitForTimeout(500);
            
            console.log('\n=== 激活虚空法师能力 ===');
            
            await waitForPhase(setup.player1Page, 'ability');
            
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活虚空法师能力');
            
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(2000);
            
            // 检查弹窗
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50').first();
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 查找卡牌（应该显示调停者，因为它有持续标记）
            const cardDivs = modal.locator('[data-testid^="card-"]');
            const cardCount = await cardDivs.count();
            console.log('找到的卡牌数量:', cardCount);
            
            if (cardCount === 0) {
                await setup.player1Page.screenshot({ 
                    path: 'test-results/card02-ongoing-no-cards.png',
                    fullPage: true 
                });
                throw new Error('未找到卡牌');
            }
            
            // 找到所有卡牌按钮
            const cardDivs2 = modal.locator('[data-testid^="card-"]');
            const allCardButtons = [];
            for (let i = 0; i < cardCount; i++) {
                const div = cardDivs2.nth(i);
                const button = div.locator('xpath=ancestor::button[1]');
                allCardButtons.push(button);
            }
            
            console.log('所有卡牌按钮数量:', allCardButtons.length);
            
            // 找到第一个未禁用的按钮
            let enabledButton = null;
            for (let i = 0; i < allCardButtons.length; i++) {
                const button = allCardButtons[i];
                const isDisabled = await button.getAttribute('disabled');
                const testId = await button.locator('[data-testid^="card-"]').getAttribute('data-testid');
                console.log(`卡牌 ${i}: testId=${testId}, disabled=${isDisabled !== null}`);
                if (isDisabled === null) {
                    enabledButton = button;
                    console.log(`找到可点击的卡牌: 索引 ${i}`);
                    break;
                }
            }
            
            if (enabledButton === null) {
                await setup.player1Page.screenshot({ 
                    path: 'test-results/card02-ongoing-all-disabled.png',
                    fullPage: true 
                });
                throw new Error('所有卡牌都被禁用');
            }
            
            // 点击第一张可点击的卡牌（调停者）
            await enabledButton.click();
            await setup.player1Page.waitForTimeout(500);
            
            // 点击确认按钮
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 验证持续标记已移除 ===');
            
            const stateAfter = await readCoreState(setup.player1Page);
            console.log('虚空法师能力执行后:', {
                ongoingAbilities: stateAfter.ongoingAbilities,
            });
            
            expect((stateAfter.ongoingAbilities as any[]).length).toBe(0);
            console.log('✅ 持续标记已被移除');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
