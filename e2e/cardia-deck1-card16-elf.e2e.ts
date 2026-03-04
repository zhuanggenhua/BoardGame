import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readLiveState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力16 - 精灵（使用新API重写）
 * 能力：你赢得游戏（trigger: onLose - 失败时触发）
 * 
 * 测试场景：
 * - P1 打出精灵（影响力16）
 * - P2 打出更高影响力的牌（使用修正标记让影响力 > 16）
 * - P1 失败，触发精灵能力
 * - P1 激活精灵能力，直接获胜
 */
test.describe('Cardia 一号牌组 - 精灵（新API）', () => {
    test('影响力16 - 精灵：失败时直接获胜', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_16'], // 精灵（影响力16）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_01'], // 雇佣剑士（影响力1）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
            },
            // 给 P2 的手牌添加修正标记，使其影响力 > 16
            modifierTokens: [
                {
                    cardId: 'test_1_0', // P2 的第一张手牌
                    value: 20,
                    source: 'test_modifier',
                }
            ],
            phase: 'play',
        });
        
        try {
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            console.log('P1 打出影响力16（精灵）');
            await playCard(setup.player1Page, 0);
            
            console.log('P2 打出影响力1（带修正标记，实际影响力 21）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 阶段2：激活能力 ===');
            
            // 等待进入能力阶段
            await waitForPhase(setup.player1Page, 'ability');
            
            // 验证遭遇战结果：P2 应该赢（21 > 16），P1 失败
            const stateAfterEncounter = await readLiveState(setup.player1Page);
            console.log('遭遇战解析后状态:', {
                phase: stateAfterEncounter.core.phase,
                p1PlayedCard: stateAfterEncounter.core.players['0'].playedCards[0]?.baseInfluence,
                p2PlayedCard: stateAfterEncounter.core.players['1'].playedCards[0]?.baseInfluence,
                modifierTokens: stateAfterEncounter.core.modifierTokens,
            });
            
            // P1 失败，精灵能力应该可以激活（trigger: 'onLose'）
            console.log('等待 P1 的能力按钮（精灵能力 - onLose 触发）');
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 能力按钮已显示');
            
            // 激活精灵能力
            console.log('激活精灵能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(2000);
            
            console.log('\n=== 验证游戏结束 ===');
            
            const stateAfter = await readLiveState(setup.player1Page);
            
            type SystemState = { gameover?: { winner: string; reason: string } };
            const sys = stateAfter.sys as SystemState;
            
            console.log('能力执行后（完整状态）:', {
                isGameOver: sys?.gameover !== undefined,
                winner: sys?.gameover?.winner,
                fullGameover: sys?.gameover,
            });
            
            // 核心功能验证：游戏结束，P1 获胜（精灵能力：失败时直接获胜）
            expect(sys.gameover).toBeDefined();
            expect(sys.gameover!.winner).toBe('0');
            // 注意：reason 字段可能不存在，不强制检查
            
            console.log('✅ P1 通过精灵能力直接获胜');
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
