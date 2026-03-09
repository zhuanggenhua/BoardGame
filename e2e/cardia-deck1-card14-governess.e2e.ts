import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力14 - 女导师（使用新API重写）
 * 能力：复制并发动你的一张影响力不小于本牌的已打出牌的即时能力
 * 
 * 能力类型：即时能力（instant）
 * 效果：
 * - 步骤1：P1 选择一张自己之前打出的牌（影响力 >= 14）
 * - 步骤2：复制并执行该牌的即时能力
 * 
 * 测试场景：
 * - P1 之前打出了 card15（发明家，影响力15，即时能力）
 * - P1 打出影响力14（女导师）
 * - P2 打出影响力16（精灵）
 * - P1 失败（14 < 16），激活女导师能力
 * - P1 选择复制 card15（发明家）的能力
 * - 验证：发明家的能力被执行（添加+3影响力到任一张牌，添加-3影响力到另一张牌）
 * 
 * 对比旧版本：
 * - 旧版：~150行代码，手动注入状态
 * - 新版：~120行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 女导师（新API）', () => {
    test('影响力14 - 女导师：复制并执行已打出牌的即时能力', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_14'], // 女导师（影响力14）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
                playedCards: [
                    { defId: 'deck_i_card_15', signets: 1, encounterIndex: 0 }, // 发明家（影响力15）
                    { defId: 'deck_i_card_13', signets: 0, encounterIndex: 1 }, // 沼泽守卫（影响力13）
                ],
            },
            player2: {
                hand: ['deck_i_card_16'], // 精灵（影响力16）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_10', signets: 0, encounterIndex: 0 }, // 傀儡师（影响力10）
                    { defId: 'deck_i_card_12', signets: 1, encounterIndex: 1 }, // 财务官（影响力12）
                ],
            },
            phase: 'play',
        });
        
        try {
            // 监听浏览器控制台日志
            const consoleLogs: string[] = [];
            setup.player1Page.on('console', msg => {
                consoleLogs.push(msg.text());
            });
            
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: Array<{ uid: string; defId: string }>;
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number; encounterIndex: number }>;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            // 记录发明家的 UID（要复制的能力）
            const inventorCard = players['0'].playedCards.find(c => c.defId === 'deck_i_card_15');
            const inventorCardUid = inventorCard?.uid;
            
            console.log('初始状态:', {
                p1PlayedCards: players['0'].playedCards.map(c => ({ 
                    defId: c.defId, 
                    influence: c.baseInfluence,
                    encounterIndex: c.encounterIndex,
                })),
                inventorCard: { uid: inventorCardUid, defId: inventorCard?.defId },
                coreModifierTokens: initialState.modifierTokens,
            });
            
            // 2. P1 打出影响力14（女导师）
            console.log('P1 打出影响力14（女导师）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力16（精灵）
            console.log('P2 打出影响力16（精灵）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 阶段2：激活能力 ===');
            
            // 检查当前状态
            const stateBeforeAbility = await readCoreState(setup.player1Page);
            const playersBeforeAbility = stateBeforeAbility.players as Record<string, PlayerState>;
            console.log('能力阶段前状态:', {
                phase: stateBeforeAbility.phase,
                p1PlayedCards: playersBeforeAbility['0'].playedCards.map(c => ({ 
                    uid: c.uid, 
                    defId: c.defId, 
                    encounterIndex: c.encounterIndex 
                })),
            });
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 5. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活女导师能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 6. 等待卡牌选择弹窗出现（选择要复制的能力）
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 卡牌选择弹窗已显示（选择要复制的能力）');
            
            // 7. 选择发明家（影响力15，满足条件）
            // 注意：需要找到第一个未禁用的按钮（其他卡牌可能因影响力不足而被禁用）
            const allButtons = modal.locator('button');
            const cardButtons = allButtons.filter({ hasNotText: /确认|Confirm|取消|Cancel/ });
            const cardButtonCount = await cardButtons.count();
            
            let clickedButton = null;
            for (let i = 0; i < cardButtonCount; i++) {
                const button = cardButtons.nth(i);
                const isDisabled = await button.isDisabled();
                if (!isDisabled) {
                    clickedButton = button;
                    break;
                }
            }
            
            if (!clickedButton) {
                throw new Error('No enabled card buttons found');
            }
            
            await clickedButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择发明家');
            
            // 8. 点击确认按钮
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            console.log('✅ 已确认选择');
            
            // 9. 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 打印浏览器控制台日志
            console.log('\n=== 浏览器控制台日志（选择发明家后）===');
            const relevantLogs = consoleLogs.filter(log => 
                log.includes('Governess') || 
                log.includes('Inventor') ||
                log.includes('wrapCardiaInteraction') ||
                log.includes('[Cardia]')
            );
            relevantLogs.forEach(log => console.log(log));
            console.log(`总共 ${consoleLogs.length} 条日志，相关日志 ${relevantLogs.length} 条`);
            console.log('=== 日志结束 ===\n');
            
            // 10. 等待发明家能力的交互弹窗出现（选择+3影响力的目标）
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 发明家能力弹窗已显示（选择+3影响力的目标）');
            
            // 11. 选择第一张牌（添加+3影响力）
            const firstCardButton = modal.locator('button').first();
            await firstCardButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择第一张牌（+3影响力）');
            
            // 12. 点击确认按钮
            await confirmButton.first().click({ timeout: 5000 });
            console.log('✅ 已确认选择');
            
            // 13. 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 14. 等待发明家能力的第二个交互弹窗出现（选择-3影响力的目标）
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 发明家能力弹窗已显示（选择-3影响力的目标）');
            
            // 15. 选择第二张牌（添加-3影响力）
            const secondCardButton = modal.locator('button').nth(1);
            await secondCardButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择第二张牌（-3影响力）');
            
            // 16. 点击确认按钮
            await confirmButton.first().click({ timeout: 5000 });
            console.log('✅ 已确认选择');
            
            // 17. 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 18. 等待能力执行完成（自动回合结束）
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 19. 验证：修正标记已添加
            const stateAfter = await readCoreState(setup.player1Page);
            
            console.log('回合结束后:', {
                coreModifierTokens: stateAfter.modifierTokens,
                phase: stateAfter.phase,
            });
            
            // 核心功能验证：修正标记已添加
            type ModifierToken = { cardId: string; value: number; source: string };
            const modifierTokens = stateAfter.modifierTokens as ModifierToken[];
            
            expect(modifierTokens).toBeDefined();
            expect(modifierTokens.length).toBeGreaterThanOrEqual(2); // 至少有 +3 和 -3 两个修正
            
            // 查找发明家能力添加的修正标记
            const inventorModifiers = modifierTokens.filter(
                (m) => m.source === 'ability_i_inventor'
            );
            expect(inventorModifiers.length).toBeGreaterThanOrEqual(2); // +3 和 -3
            
            // 验证有 +3 修正
            const plusModifier = inventorModifiers.find(m => m.value === 3);
            expect(plusModifier).toBeDefined();
            console.log('✅ +3 修正标记已添加');
            
            // 验证有 -3 修正
            const minusModifier = inventorModifiers.find(m => m.value === -3);
            expect(minusModifier).toBeDefined();
            console.log('✅ -3 修正标记已添加');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
