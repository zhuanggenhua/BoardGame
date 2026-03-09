import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 沼泽守卫能力验证测试
 * 
 * 验证两个问题：
 * 1. 回收卡牌时标记信息是否被清空（signets、ongoingMarkers、encounterIndex、modifierTokens）
 * 2. 卡牌选择弹窗是否显示对方的牌（阴影不可选）
 */
test.describe('Cardia - 沼泽守卫能力验证', () => {
    test('验证问题1：回收卡牌时标记信息被清空', async ({ browser }) => {
        // 设置场景：P1 有一张带标记的已打出牌
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_13'], // 沼泽守卫（影响力13）
                deck: ['deck_i_card_15', 'deck_i_card_16'],
                playedCards: [
                    { 
                        defId: 'deck_i_card_01', 
                        signets: 2,  // 有印戒标记
                        encounterIndex: 0,
                        // 注意：ongoingMarkers 和 modifierTokens 需要在状态注入后手动添加
                    },
                    { defId: 'deck_i_card_03', signets: 0, encounterIndex: 1 },
                ],
            },
            player2: {
                hand: ['deck_i_card_14'], // 女导师（影响力14）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 0, encounterIndex: 0 },
                    { defId: 'deck_i_card_05', signets: 1, encounterIndex: 1 },
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 验证问题1：回收卡牌时标记信息被清空 ===');
            
            // 1. 手动添加 ongoingMarkers 和 modifierTokens 到目标卡牌
            await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const targetCard = state.core.players['0'].playedCards.find((c: any) => c.encounterIndex === 0);
                
                if (targetCard) {
                    // 添加持续标记
                    targetCard.ongoingMarkers = [
                        { abilityId: 'test_ability_1', sourceCardUid: 'test_source_1' },
                        { abilityId: 'test_ability_2', sourceCardUid: 'test_source_2' },
                    ];
                    
                    // 添加修正标记
                    state.core.modifierTokens = state.core.modifierTokens || [];
                    state.core.modifierTokens.push(
                        { cardId: targetCard.uid, value: 3 },
                        { cardId: targetCard.uid, value: -2 },
                    );
                }
            });
            
            // 2. 验证初始状态
            const initialState = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const targetCard = state.core.players['0'].playedCards.find((c: any) => c.encounterIndex === 0);
                const modifierTokens = state.core.modifierTokens?.filter((t: any) => t.cardId === targetCard?.uid) || [];
                
                return {
                    targetCardUid: targetCard?.uid,
                    signets: targetCard?.signets,
                    ongoingMarkers: targetCard?.ongoingMarkers?.length || 0,
                    encounterIndex: targetCard?.encounterIndex,
                    modifierTokens: modifierTokens.length,
                };
            });
            
            console.log('初始状态（回收前）:', initialState);
            expect(initialState.signets).toBe(2);
            expect(initialState.ongoingMarkers).toBe(2);
            expect(initialState.encounterIndex).toBe(0);
            expect(initialState.modifierTokens).toBe(2);
            
            // 3. P1 打出沼泽守卫
            console.log('P1 打出沼泽守卫');
            await playCard(setup.player1Page, 0);
            
            // 4. P2 打出女导师
            console.log('P2 打出女导师');
            await playCard(setup.player2Page, 0);
            
            // 5. 等待进入能力阶段
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 6. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活沼泽守卫能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 7. 等待卡牌选择弹窗
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 卡牌选择弹窗已显示');
            
            // 8. 选择第一张卡牌（带标记的那张）
            const allButtons = modal.locator('button');
            const cardButtons = allButtons.filter({ hasNotText: /确认|Confirm|取消|Cancel/ });
            await cardButtons.first().click();
            await setup.player1Page.waitForTimeout(500);
            
            // 9. 确认选择
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            console.log('✅ 已确认选择');
            
            // 10. 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            
            // 11. 等待回合结束
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 12. 验证：回收后的卡牌标记信息被清空
            const finalState = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const targetCardUid = state.core.players['0'].hand.find((c: any) => c.defId === 'deck_i_card_01')?.uid;
                const recoveredCard = state.core.players['0'].hand.find((c: any) => c.uid === targetCardUid);
                const modifierTokens = state.core.modifierTokens?.filter((t: any) => t.cardId === targetCardUid) || [];
                
                return {
                    found: !!recoveredCard,
                    signets: recoveredCard?.signets,
                    ongoingMarkers: recoveredCard?.ongoingMarkers?.length || 0,
                    encounterIndex: recoveredCard?.encounterIndex,
                    modifierTokens: modifierTokens.length,
                };
            });
            
            console.log('最终状态（回收后）:', finalState);
            
            // 核心验证：所有标记信息被清空
            expect(finalState.found).toBe(true);
            expect(finalState.signets).toBe(0); // ✅ 印戒被清空
            expect(finalState.ongoingMarkers).toBe(0); // ✅ 持续标记被清空
            expect(finalState.encounterIndex).toBe(-1); // ✅ encounterIndex 重置为 -1
            expect(finalState.modifierTokens).toBe(0); // ✅ 修正标记被清空
            
            console.log('✅ 问题1验证通过：回收卡牌时标记信息被清空');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('验证问题2：卡牌选择弹窗显示对方的牌（阴影不可选）', async ({ browser }) => {
        // 设置场景：双方都有已打出的牌
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_13'], // 沼泽守卫（影响力13）
                deck: ['deck_i_card_15', 'deck_i_card_16'],
                playedCards: [
                    { defId: 'deck_i_card_01', signets: 1, encounterIndex: 0 }, // P1 的牌
                    { defId: 'deck_i_card_03', signets: 0, encounterIndex: 1 }, // P1 的牌
                ],
            },
            player2: {
                hand: ['deck_i_card_14'], // 女导师（影响力14）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 0, encounterIndex: 0 }, // P2 的牌
                    { defId: 'deck_i_card_05', signets: 1, encounterIndex: 1 }, // P2 的牌
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 验证问题2：卡牌选择弹窗显示对方的牌（阴影不可选） ===');
            
            // 1. P1 打出沼泽守卫
            console.log('P1 打出沼泽守卫');
            await playCard(setup.player1Page, 0);
            
            // 2. P2 打出女导师
            console.log('P2 打出女导师');
            await playCard(setup.player2Page, 0);
            
            // 3. 等待进入能力阶段
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 4. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活沼泽守卫能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 5. 等待卡牌选择弹窗
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 卡牌选择弹窗已显示');
            
            // 6. 验证弹窗内容
            const modalContent = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const interaction = state?.sys?.interaction?.current;
                const data = interaction?.data;
                
                return {
                    hasInteraction: !!interaction,
                    interactionType: data?.interactionType,
                    totalCards: data?.cards?.length || 0,
                    availableCards: data?.cards?.filter((c: any) => 
                        !data?.disabledCardUids?.includes(c.uid)
                    ).length || 0,
                    disabledCards: data?.disabledCardUids?.length || 0,
                    myPlayerId: data?.myPlayerId,
                    opponentId: data?.opponentId,
                    cards: data?.cards?.map((c: any) => ({
                        defId: c.defId,
                        ownerId: c.ownerId,
                        isDisabled: data?.disabledCardUids?.includes(c.uid),
                    })) || [],
                };
            });
            
            console.log('弹窗内容:', JSON.stringify(modalContent, null, 2));
            
            // 核心验证1：交互数据包含 myPlayerId 和 opponentId
            expect(modalContent.myPlayerId).toBe('0');
            expect(modalContent.opponentId).toBe('1');
            console.log('✅ 交互数据包含 myPlayerId 和 opponentId');
            
            // 核心验证2：显示所有卡牌（我的 + 对手的）
            // P1 有 2 张已打出的牌，P2 有 2 张已打出的牌 + 1 张当前回合打出的牌，总共 5 张
            expect(modalContent.totalCards).toBeGreaterThanOrEqual(4);
            console.log('✅ 显示所有卡牌（我的 + 对手的）');
            
            // 核心验证3：只有我的卡牌可选（2 张），对手的卡牌被禁用（≥2 张）
            expect(modalContent.availableCards).toBe(2);
            expect(modalContent.disabledCards).toBeGreaterThanOrEqual(2);
            console.log('✅ 只有我的卡牌可选，对手的卡牌被禁用');
            
            // 核心验证4：检查卡牌归属和禁用状态
            const myCards = modalContent.cards.filter(c => c.ownerId === '0');
            const opponentCards = modalContent.cards.filter(c => c.ownerId === '1');
            
            expect(myCards.length).toBe(2);
            expect(opponentCards.length).toBeGreaterThanOrEqual(2);
            
            // 我的卡牌不应该被禁用
            expect(myCards.every(c => !c.isDisabled)).toBe(true);
            
            // 对手的卡牌应该被禁用
            expect(opponentCards.every(c => c.isDisabled)).toBe(true);
            console.log('✅ 我的卡牌可选，对手的卡牌被禁用');
            
            // 7. 验证 UI 显示：检查是否有分组显示（"对手" 和 "你" 标签）
            const hasOpponentLabel = await modal.locator('text=/opponent|对手/i').count();
            const hasYouLabel = await modal.locator('text=/you|你/i').count();
            
            expect(hasOpponentLabel).toBeGreaterThan(0);
            expect(hasYouLabel).toBeGreaterThan(0);
            console.log('✅ UI 显示分组标签（对手 / 你）');
            
            // 8. 验证 UI 显示：检查是否有 VS 指示器
            const hasVSIndicator = await modal.locator('text=/VS/i').count();
            expect(hasVSIndicator).toBeGreaterThan(0);
            console.log('✅ UI 显示 VS 指示器');
            
            // 9. 验证禁用卡牌的阴影遮罩
            // 查找所有带有阴影遮罩的卡牌（包含 "bg-black/60" 和 "backdrop-blur" 的元素）
            const disabledCardOverlays = await modal.locator('.bg-black\\/60.backdrop-blur-\\[2px\\]').count();
            expect(disabledCardOverlays).toBeGreaterThanOrEqual(2); // 应该至少有 2 张对手的卡牌显示阴影
            console.log('✅ 禁用卡牌显示阴影遮罩');
            
            // 10. 尝试点击对手的卡牌（应该无效）
            const allButtons = modal.locator('button');
            const cardButtons = allButtons.filter({ hasNotText: /确认|Confirm|取消|Cancel/ });
            
            // 获取所有卡牌按钮的状态
            const buttonStates = await cardButtons.evaluateAll(buttons => {
                return buttons.map(btn => ({
                    disabled: btn.hasAttribute('disabled'),
                    classList: btn.className,
                }));
            });
            
            console.log('卡牌按钮状态:', buttonStates);
            
            // 对手的卡牌按钮应该被禁用（cursor-not-allowed）
            const disabledButtons = buttonStates.filter(state => 
                state.classList.includes('cursor-not-allowed')
            );
            expect(disabledButtons.length).toBeGreaterThanOrEqual(2);
            console.log('✅ 对手的卡牌按钮被禁用（cursor-not-allowed）');
            
            console.log('✅ 问题2验证通过：卡牌选择弹窗显示对方的牌（阴影不可选）');
            
            // 11. 清理：取消弹窗
            const cancelButton = modal.locator('button').filter({ hasText: /Cancel|取消/ });
            await cancelButton.first().click({ timeout: 5000 });
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
