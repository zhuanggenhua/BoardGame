import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力5 - 破坏者（使用新API重写）
 * 能力：对手弃掉牌库顶2张牌
 * 
 * 对比旧版本：
 * - 旧版：~100行代码，手动注入状态
 * - 新版：~60行代码，使用 setupCardiaTestScenario 一行配置
 * 
 * 测试覆盖：
 * 1. 基础功能：对手牌库有足够牌时，弃掉2张
 * 2. 边界条件：对手牌库只有1张时，弃掉1张
 */
test.describe('Cardia 一号牌组 - 破坏者（新API）', () => {
    test('基础功能：对手弃掉牌库顶2张牌', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_05'], // 破坏者（影响力5）
                deck: ['deck_i_card_01', 'deck_i_card_02'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_03', 'deck_i_card_04', 'deck_i_card_06'], // 至少3张（能力会弃2张）
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试破坏者能力（新API）===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { deck: unknown[]; discard: unknown[] };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1DeckSize = players['0'].deck.length;
            const initialP1DiscardSize = players['0'].discard.length;
            const initialP2DeckSize = players['1'].deck.length;
            const initialP2DiscardSize = players['1'].discard.length;
            
            console.log('初始状态:', {
                p1DeckSize: initialP1DeckSize,
                p1DiscardSize: initialP1DiscardSize,
                p2DeckSize: initialP2DeckSize,
                p2DiscardSize: initialP2DiscardSize,
            });
            
            // 2. P1 打出影响力5（破坏者）
            console.log('P1 打出影响力5（破坏者）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力10
            console.log('P2 打出影响力10');
            await playCard(setup.player2Page, 0);
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 5. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活破坏者能力');
            await abilityButton.click();
            
            // 6. 等待能力执行完成（自动回合结束）
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 7. 验证结果
            const afterAbility = await readCoreState(setup.player1Page);
            const playersAfter = afterAbility.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p1DeckSize: playersAfter['0'].deck.length,
                p1DiscardSize: playersAfter['0'].discard.length,
                p2DeckSize: playersAfter['1'].deck.length,
                p2DiscardSize: playersAfter['1'].discard.length,
            });
            
            // 核心功能验证：P2 牌库减少2张（弃掉）+ 1张（抽牌）= 3张
            expect(playersAfter['1'].deck.length).toBe(initialP2DeckSize - 3);
            
            // 副作用验证：P2 弃牌堆增加2张
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize + 2);
            
            // 负路径验证：P1 牌库减少1张（抽牌），弃牌堆不变
            expect(playersAfter['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfter['0'].discard.length).toBe(initialP1DiscardSize);
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('边界条件：对手牌库只有1张时，弃掉1张', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_05'], // 破坏者（影响力5）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_03'], // 只有1张牌
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试破坏者能力（牌库只有1张）===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { deck: unknown[]; discard: unknown[] };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP2DeckSize = players['1'].deck.length;
            const initialP2DiscardSize = players['1'].discard.length;
            
            console.log('初始状态:', {
                p2DeckSize: initialP2DeckSize,
                p2DiscardSize: initialP2DiscardSize,
            });
            
            expect(initialP2DeckSize).toBe(1); // 确认只有1张牌
            
            // 2. P1 打出影响力5（破坏者）
            console.log('P1 打出影响力5（破坏者）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力10
            console.log('P2 打出影响力10');
            await playCard(setup.player2Page, 0);
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 5. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活破坏者能力');
            await abilityButton.click();
            
            // 6. 等待能力执行完成（自动回合结束）
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 7. 验证结果
            const afterAbility = await readCoreState(setup.player1Page);
            const playersAfter = afterAbility.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p2DeckSize: playersAfter['1'].deck.length,
                p2DiscardSize: playersAfter['1'].discard.length,
            });
            
            // 核心功能验证：P2 牌库减少1张（弃掉）+ 1张（抽牌）= 2张，但初始只有1张，所以变为0
            expect(playersAfter['1'].deck.length).toBe(0);
            
            // 副作用验证：P2 弃牌堆增加1张（只能弃掉1张，因为牌库只有1张）
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize + 1);
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
