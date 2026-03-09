import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readLiveState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力15 - 发明家（修复版）
 * 能力：添加+3影响力到任一张牌，并添加-3影响力到另外任一张牌
 * 
 * 实现：两次独立的交互
 * - 第一次交互：选择第一张卡牌（+3）
 * - 第二次交互：选择第二张卡牌（-3，不能选择第一张）
 */
test.describe('Cardia 一号牌组 - 发明家（修复版）', () => {
    test('影响力15 - 发明家：第一次和第二次选择的牌不能重复', async ({ browser }) => {
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
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            console.log('P1 打出影响力15（发明家）');
            await playCard(setup.player1Page, 0);
            
            console.log('P2 打出影响力16（精灵）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 阶段2：激活能力 ===');
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // P1 失败（15 < 16），发明家能力应该可以激活
            console.log('等待 P1 的能力按钮（发明家能力 - onLose 触发）');
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 能力按钮已显示');
            
            // 激活发明家能力
            console.log('激活发明家能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 第一次交互：选择第一张卡牌（+3）
            console.log('\n=== 第一次交互：选择第一张卡牌（+3） ===');
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 读取第一次交互的数据
            const stateBeforeFirst = await readLiveState(setup.player1Page);
            const firstInteraction = stateBeforeFirst.sys.interaction.current;
            console.log('第一次交互数据:', {
                title: (firstInteraction as any)?.data?.title,
                cardsCount: (firstInteraction as any)?.data?.cards?.length,
            });
            
            // 选择第一张卡牌（找到第一个启用的卡牌按钮）
            const allButtons1 = modal.locator('button');
            const count1 = await allButtons1.count();
            console.log(`第一次交互：找到 ${count1} 个按钮`);
            
            // 找到第一个启用的卡牌按钮（排除确认/取消按钮）
            let firstCardButtonIndex = -1;
            let firstButtonCardUid: string | null = null;
            for (let i = 0; i < count1; i++) {
                const text = await allButtons1.nth(i).textContent();
                const isEnabled = await allButtons1.nth(i).isEnabled();
                if (text && !text.match(/确认|Confirm|取消|Cancel/) && isEnabled) {
                    firstCardButtonIndex = i;
                    // 获取卡牌 UID
                    firstButtonCardUid = await allButtons1.nth(i).evaluate((button) => {
                        const cardElement = button.querySelector('[data-testid^="card-"]');
                        if (cardElement) {
                            const testId = cardElement.getAttribute('data-testid');
                            return testId?.replace('card-', '') || null;
                        }
                        return null;
                    });
                    console.log(`找到第一个启用的卡牌按钮：索引 ${i}，UID: ${firstButtonCardUid}`);
                    break;
                }
            }
            
            if (firstCardButtonIndex >= 0 && firstButtonCardUid) {
                await allButtons1.nth(firstCardButtonIndex).click();
                await setup.player1Page.waitForTimeout(500);
                console.log('✅ 已选择第一张卡牌');
            } else {
                throw new Error('未找到可用的卡牌按钮');
            }
            
            // 确认第一次选择
            const confirmButton1 = modal.locator('button').filter({ hasText: /Confirm|确认|confirm/ });
            await confirmButton1.first().click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 第二次交互：选择第二张卡牌（-3）
            console.log('\n=== 第二次交互：选择第二张卡牌（-3） ===');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 读取第二次交互的数据
            const stateBeforeSecond = await readLiveState(setup.player1Page);
            const secondInteraction = stateBeforeSecond.sys.interaction.current;
            const secondCards = (secondInteraction as any)?.data?.cards;
            const disabledCardUids = (secondInteraction as any)?.data?.disabledCardUids || [];
            console.log('第二次交互数据:', {
                title: (secondInteraction as any)?.data?.title,
                cardsCount: secondCards?.length,
                cards: secondCards?.map((c: any) => ({ uid: c.uid, defId: c.defId })),
                disabledCardUids,
            });
            
            // 验证第二次交互包含所有卡牌，但第一张卡牌被标记为禁用
            const firstCardUid = firstButtonCardUid;  // 使用实际点击的卡牌 UID
            const secondCardUids = secondCards?.map((c: any) => c.uid) || [];
            console.log('第一张卡牌 UID:', firstCardUid);
            console.log('第二次交互所有卡牌 UIDs:', secondCardUids);
            console.log('第二次交互禁用卡牌 UIDs:', disabledCardUids);
            
            expect(secondCardUids).toContain(firstCardUid);
            console.log('✅ 第二次交互包含第一张卡牌（显示但禁用）');
            
            expect(disabledCardUids).toContain(firstCardUid);
            console.log('✅ 第一张卡牌被标记为禁用');
            
            // 选择第二张卡牌（找到第一个启用的卡牌按钮）
            const allButtons2 = modal.locator('button');
            const count2 = await allButtons2.count();
            console.log(`第二次交互：找到 ${count2} 个按钮`);
            
            // 找到第一个启用的卡牌按钮（排除确认/取消按钮和禁用的卡牌）
            let secondCardButtonIndex = -1;
            for (let i = 0; i < count2; i++) {
                const text = await allButtons2.nth(i).textContent();
                const isEnabled = await allButtons2.nth(i).isEnabled();
                if (text && !text.match(/确认|Confirm|取消|Cancel/) && isEnabled) {
                    secondCardButtonIndex = i;
                    console.log(`找到第一个启用的卡牌按钮：索引 ${i}`);
                    break;
                }
            }
            
            if (secondCardButtonIndex >= 0) {
                await allButtons2.nth(secondCardButtonIndex).click();
                await setup.player1Page.waitForTimeout(500);
                console.log('✅ 已选择第二张卡牌');
            } else {
                throw new Error('未找到可用的卡牌按钮');
            }
            
            // 确认第二次选择
            const confirmButton2 = modal.locator('button').filter({ hasText: /Confirm|确认|confirm/ });
            await confirmButton2.first().click();
            await setup.player1Page.waitForTimeout(1000);
            
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 两次交互完成');
            
            // 等待回合结束
            console.log('\n=== 等待回合结束 ===');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 阶段3：验证能力效果 ===');
            
            const stateAfter = await readLiveState(setup.player1Page);
            
            type ModifierToken = { cardId: string; value: number; source: string };
            const modifierTokens = stateAfter.core.modifierTokens as ModifierToken[];
            
            console.log('能力执行后:', {
                modifierTokensCount: modifierTokens?.length || 0,
                modifierTokens: modifierTokens,
            });
            
            expect(modifierTokens).toBeDefined();
            expect(modifierTokens.length).toBeGreaterThanOrEqual(2);
            
            const inventorModifiers = modifierTokens.filter(
                (m) => m.source === 'ability_i_inventor'
            );
            expect(inventorModifiers.length).toBe(2);
            
            const plusModifier = inventorModifiers.find(m => m.value === 3);
            expect(plusModifier).toBeDefined();
            console.log('✅ 找到 +3 修正标记');
            
            const minusModifier = inventorModifiers.find(m => m.value === -3);
            expect(minusModifier).toBeDefined();
            console.log('✅ 找到 -3 修正标记');
            
            // 验证两个修正标记在不同的卡牌上
            expect(plusModifier!.cardId).not.toBe(minusModifier!.cardId);
            console.log('✅ +3 和 -3 修正标记在不同的卡牌上');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
