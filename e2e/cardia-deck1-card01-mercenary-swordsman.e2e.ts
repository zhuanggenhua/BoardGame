import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力1 - 雇佣剑士（使用新API重写）
 * 能力：弃掉本牌和相对的牌
 * 
 * 对比旧版本：
 * - 旧版：~150行代码，手动注入状态，复杂的交互处理
 * - 新版：~80行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 雇佣剑士（新API）', () => {
    test('影响力1 - 雇佣剑士：弃掉本牌和相对的牌', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 雇佣剑士（影响力1）
                deck: ['deck_i_card_02', 'deck_i_card_04'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_03'], // 外科医生（影响力3）
                deck: ['deck_i_card_05', 'deck_i_card_06'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试雇佣剑士能力（新API）===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: unknown[]; 
                deck: unknown[]; 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number }>;
                discard: Array<{ defId: string }>;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1HandSize = players['0'].hand.length;
            const initialP2HandSize = players['1'].hand.length;
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            
            console.log('初始状态:', {
                p1HandSize: initialP1HandSize,
                p2HandSize: initialP2HandSize,
                p1DeckSize: initialP1DeckSize,
                p2DeckSize: initialP2DeckSize,
            });
            
            // ===== 阶段1：打出卡牌 =====
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            // P1 打出影响力1（雇佣剑士）
            console.log('P1 打出影响力1（雇佣剑士）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出影响力3（外科医生）
            console.log('P2 打出影响力3（外科医生）');
            await playCard(setup.player2Page, 0);
            
            // 验证阶段1：卡牌已打出，阶段推进到 ability
            const afterPlay = await readCoreState(setup.player1Page);
            const playersAfterPlay = afterPlay.players as Record<string, PlayerState>;
            
            expect(playersAfterPlay['0'].playedCards.length).toBe(1);
            expect(playersAfterPlay['1'].playedCards.length).toBe(1);
            expect(playersAfterPlay['0'].hand.length).toBe(initialP1HandSize - 1);
            expect(playersAfterPlay['1'].hand.length).toBe(initialP2HandSize - 1);
            expect(afterPlay.phase).toBe('ability');
            console.log('✅ 阶段1验证通过');
            
            // ===== 阶段2：激活能力 =====
            console.log('\n=== 阶段2：激活能力 ===');
            
            // 等待进入能力阶段（P1失败，应该有能力按钮）
            await waitForPhase(setup.player1Page, 'ability');
            
            // 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活雇佣剑士能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 验证阶段2：两张牌都被弃掉
            const afterAbility = await readCoreState(setup.player1Page);
            const playersAfterAbility = afterAbility.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p1PlayedCards: playersAfterAbility['0'].playedCards.length,
                p2PlayedCards: playersAfterAbility['1'].playedCards.length,
                p1DiscardSize: playersAfterAbility['0'].discard.length,
                p2DiscardSize: playersAfterAbility['1'].discard.length,
            });
            
            // 核心功能验证：场上牌被弃掉
            expect(playersAfterAbility['0'].playedCards.length).toBe(0); // P1的牌被弃掉
            expect(playersAfterAbility['1'].playedCards.length).toBe(0); // P2的牌被弃掉
            
            // 副作用验证：弃牌堆包含正确的卡牌
            const p1DiscardCards = playersAfterAbility['0'].discard.map((c) => c.defId);
            const p2DiscardCards = playersAfterAbility['1'].discard.map((c) => c.defId);
            expect(p1DiscardCards).toContain('deck_i_card_01'); // 雇佣剑士
            expect(p2DiscardCards).toContain('deck_i_card_03'); // 外科医生
            console.log('✅ 阶段2验证通过');
            
            // ===== 阶段3：回合结束 =====
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 等待回合结束，进入下一回合的 play 阶段
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            // 验证阶段3：双方抽牌
            const afterDraw = await readCoreState(setup.player1Page);
            const playersAfterDraw = afterDraw.players as Record<string, PlayerState>;
            
            console.log('回合结束后:', {
                p1HandSize: playersAfterDraw['0'].hand.length,
                p2HandSize: playersAfterDraw['1'].hand.length,
                p1DeckSize: playersAfterDraw['0'].deck.length,
                p2DeckSize: playersAfterDraw['1'].deck.length,
            });
            
            // 验证：双方都抽1张牌
            expect(playersAfterDraw['0'].hand.length).toBe(initialP1HandSize); // 打出1张，抽1张，回到初始值
            expect(playersAfterDraw['1'].hand.length).toBe(initialP2HandSize);
            
            // 验证：牌库减少1张
            expect(playersAfterDraw['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfterDraw['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：阶段推进到下一回合的 play
            expect(afterDraw.phase).toBe('play');
            console.log('✅ 阶段3验证通过');
            
            console.log('\n✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
