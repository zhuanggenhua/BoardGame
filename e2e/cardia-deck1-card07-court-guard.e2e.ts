import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力7 - 宫廷卫士（使用新API重写）
 * 能力：你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力
 * 
 * 能力类型：即时能力（instant），条件能力（conditional）
 * 效果：
 * - 步骤1：P1 选择一个派系
 * - 步骤2：P2 选择是否弃掉该派系的手牌
 * - 结果：如果 P2 弃牌，无额外效果；如果 P2 不弃牌，P1 的牌获得+7影响力
 * 
 * 测试场景：
 * - P1 打出影响力7（宫廷卫士）
 * - P2 打出影响力10（傀儡师）
 * - P1 失败（7 < 10），激活宫廷卫士能力
 * - P1 选择派系（Swamp）
 * - P2 选择不弃牌（因为手牌中没有 Swamp 派系的牌）
 * - 验证：P1 的牌获得+7影响力修正
 * 
 * 对比旧版本：
 * - 旧版：~100行代码，手动注入状态，只验证了派系选择
 * - 新版：~120行代码，使用 setupCardiaTestScenario 一行配置，验证完整流程
 */
test.describe('Cardia 一号牌组 - 宫廷卫士（新API）', () => {
    test('影响力7 - 宫廷卫士：对手不弃牌时获得+7影响力', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_07'], // 宫廷卫士（影响力7）
                deck: ['deck_i_card_01', 'deck_i_card_02'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10，Guild派系）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });
        
        // 监听浏览器控制台日志
        setup.player1Page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[CardiaEventSystem]') || text.includes('INTERACTION') || text.includes('court_guard') || text.includes('Handler')) {
                console.log('🔍 P1浏览器日志:', text);
            }
        });
        setup.player2Page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[CardiaEventSystem]') || text.includes('INTERACTION') || text.includes('court_guard') || text.includes('Handler')) {
                console.log('🔍 P2浏览器日志:', text);
            }
        });
        
        try {
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                deck: unknown[];
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number }>;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            
            console.log('初始状态:', {
                p1DeckSize: initialP1DeckSize,
                p2DeckSize: initialP2DeckSize,
            });
            
            // 2. P1 打出影响力7（宫廷卫士）
            console.log('P1 打出影响力7（宫廷卫士）');
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
            console.log('激活宫廷卫士能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 6. 等待派系选择弹窗出现
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 派系选择弹窗已显示');
            
            // 7. 选择 Swamp 派系（P2 手牌中没有 Swamp 派系的牌）
            // 注意：弹窗中的派系按钮顺序可能是：Swamp, Academy, Guild, Dynasty
            const factionButtons = modal.locator('button');
            const swampButton = factionButtons.first(); // 假设第一个是 Swamp
            await swampButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择 Swamp 派系');
            
            // 8. 等待弹窗关闭（表示交互已处理）
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 9. 等待能力执行完成（自动回合结束）
            // 由于 P2 手牌中没有 Swamp 派系的牌，应该直接添加+7修正（无需对手交互）
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 9. 验证：P1 的牌应该获得+7影响力修正
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            const p1Card = playersAfter['0'].playedCards[0];
            
            console.log('回合结束后:', {
                cardUid: p1Card.uid,
                baseInfluence: p1Card.baseInfluence,
                modifierTokens: stateAfter.modifierTokens,
                modifierTokensCount: (stateAfter.modifierTokens as unknown[]).length,
                p1DeckSize: playersAfter['0'].deck.length,
                p2DeckSize: playersAfter['1'].deck.length,
                phase: stateAfter.phase,
            });
            
            // 核心功能验证：修正标记已添加
            type ModifierToken = { cardId: string; value: number; source: string };
            const modifierTokens = stateAfter.modifierTokens as ModifierToken[];
            
            expect(modifierTokens).toBeDefined();
            
            console.log('所有修正标记:', modifierTokens.map(m => ({
                cardId: m.cardId,
                value: m.value,
                source: m.source,
                matchesP1Card: m.cardId === p1Card.uid,
            })));
            
            // 查找宫廷卫士添加的修正标记
            const courtGuardModifier = modifierTokens.find(
                (m) => m.cardId === p1Card.uid && m.source === 'ability_i_court_guard'
            );
            
            // 对手没有 Swamp 派系的牌，应该有+7修正
            expect(courtGuardModifier).toBeDefined();
            expect(courtGuardModifier!.value).toBe(7);
            
            console.log('✅ 对手没有 Swamp 派系的牌，P1 获得+7影响力修正');
            
            // 10. 验证：双方都抽牌（牌库减少1张）
            const playersFinal = stateAfter.players as Record<string, PlayerState>;
            
            console.log('回合结束后:', {
                p1DeckSize: playersFinal['0'].deck.length,
                p2DeckSize: playersFinal['1'].deck.length,
            });
            
            // 验证：双方都抽牌（牌库减少1张）
            expect(playersFinal['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersFinal['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
