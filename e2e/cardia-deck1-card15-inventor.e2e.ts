import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readLiveState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力15 - 发明家（使用新API重写）
 * 能力：添加+3影响力到任一张牌，并添加-3影响力到另外任一张牌
 * 
 * 实现：两次独立的交互
 * - 第一次交互：选择第一张卡牌（+3）
 * - 第二次交互：选择第二张卡牌（-3）
 * - 最终执行：添加两个修正标记
 */
test.describe('Cardia 一号牌组 - 发明家（新API）', () => {
    test('影响力15 - 发明家：添加+3和-3修正', async ({ browser }) => {
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
            
            // 一次交互：选择 2 张卡牌（第一张+3，第二张-3）
            console.log('选择 2 张卡牌（第一张+3，第二张-3）');
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 读取当前状态，查看交互数据
            const stateBeforeSelection = await readLiveState(setup.player1Page);
            console.log('交互数据:', {
                current: stateBeforeSelection.sys.interaction.current,
                data: (stateBeforeSelection.sys.interaction.current as any)?.data,
            });
            
            // 选择第一张卡牌
            const firstCardButton = modal.locator('button').first();
            await firstCardButton.click();
            await setup.player1Page.waitForTimeout(500);
            
            // 选择第二张卡牌
            const secondCardButton = modal.locator('button').nth(1);
            await secondCardButton.click();
            await setup.player1Page.waitForTimeout(500);
            
            // 确认选择
            console.log('准备确认选择...');
            
            // 在点击前，使用 evaluate 获取详细信息
            const debugInfo = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const interaction = state?.sys?.interaction?.current;
                if (!interaction) return { error: 'No interaction' };
                
                const data = interaction.data;
                return {
                    options: data.options?.map((o: any) => ({ id: o.id, label: o.label })),
                    cards: data.cards?.map((c: any) => ({ uid: c.uid, optionId: c.optionId, defId: c.defId })),
                    minSelect: data.minSelect,
                    maxSelect: data.maxSelect,
                };
            });
            console.log('交互选项详情:', JSON.stringify(debugInfo, null, 2));
            
            // 选择前两张卡牌（通过 data-testid 或其他方式）
            // 由于 CardSelectionModal 使用 card.uid 作为 key，我们可以通过索引选择
            const cardButtons = modal.locator('button').filter({ has: setup.player1Page.locator('[class*="aspect-"]') });
            const buttonCount = await cardButtons.count();
            console.log(`找到 ${buttonCount} 个卡牌按钮`);
            
            // 选择第一张和第二张卡牌
            await cardButtons.nth(0).click();
            await setup.player1Page.waitForTimeout(300);
            await cardButtons.nth(1).click();
            await setup.player1Page.waitForTimeout(300);
            
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认|confirm/ });
            await confirmButton.first().click({ timeout: 5000 });
            await setup.player1Page.waitForTimeout(2000); // 等待更长时间
            
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 交互完成');
            
            // 等待回合结束
            console.log('等待回合结束...');
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
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
