import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力16 - 精灵（使用新API + 真实游戏场景）
 * 能力：你赢得游戏（trigger: onLose - 失败时触发）
 * 
 * 测试场景（模拟真实游戏）：
 * - 使用状态注入构造 Round 1 结束后的场景：
 *   - P1 精灵（16）在 playedCards 中，有 1 枚印戒（Round 1 获胜）
 *   - P2 雇佣剑士（1）在 playedCards 中，0 枚印戒（Round 1 失败）
 * - Round 2: P1 打出女导师（14），P2 打出发明家（15）→ P1 失败
 * - P1 激活女导师能力，选择复制精灵的能力
 * - 女导师复制并执行精灵能力，P1 直接获胜
 * 
 * 注意：
 * - 精灵能力的 trigger 是 'onLose'，只能在失败时激活
 * - Round 1 精灵获胜（不触发能力），确保精灵在 playedCards 中
 * - Round 2 女导师失败后，可以复制精灵的能力（即使精灵本身没有失败）
 */
test.describe('Cardia 一号牌组 - 精灵（新API）', () => {
    test('影响力16 - 精灵：通过女导师复制能力直接获胜', async ({ browser }) => {
        // ✨ 新API：使用状态注入构造 Round 1 结束后的场景
        // Round 1: P1 精灵（16）vs P2 雇佣剑士（1）→ P1 获胜
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_14'], // 女导师（14）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
                playedCards: [
                    { defId: 'deck_i_card_16', signets: 1, encounterIndex: 0 }, // 精灵（16，Round 1 获胜）
                ],
            },
            player2: {
                hand: ['deck_i_card_15'], // 发明家（15）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_01', signets: 0, encounterIndex: 0 }, // 雇佣剑士（1，Round 1 失败）
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 阶段1：验证初始状态（Round 1 已结束）===');
            
            const initialState = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    phase: state?.core?.phase,
                    p1PlayedCards: state?.core?.players?.['0']?.playedCards?.map((c: any) => ({ 
                        defId: c.defId, 
                        signets: c.signets 
                    })),
                    p2PlayedCards: state?.core?.players?.['1']?.playedCards?.map((c: any) => ({ 
                        defId: c.defId, 
                        signets: c.signets 
                    })),
                };
            });
            
            console.log('初始状态（Round 1 已结束）:', initialState);
            
            // 精灵应该在 P1 的 playedCards 中，且有 1 枚印戒（Round 1 获胜）
            const elfCard = initialState.p1PlayedCards?.find((c: any) => c.defId === 'deck_i_card_16');
            expect(elfCard).toBeDefined();
            expect(elfCard.signets).toBe(1);
            console.log('✅ 精灵已在 playedCards 中，有 1 枚印戒（Round 1 获胜）');
            
            console.log('\n=== 阶段2：Round 2 - 女导师失败 ===');
            
            // 1. P1 打出女导师（影响力14）
            console.log('P1 打出影响力14（女导师）');
            await playCard(setup.player1Page, 0);
            
            // 2. P2 打出发明家（影响力15）
            console.log('P2 打出影响力15（发明家）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 阶段3：激活女导师能力 ===');
            
            // 3. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 4. 激活女导师能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活女导师能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 5. 等待卡牌选择弹窗出现（选择要复制的能力）
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 卡牌选择弹窗已显示（选择要复制的能力）');
            
            // 6. 选择精灵（影响力16，满足条件：影响力 >= 14）
            // 使用与 card13/card14 相同的按钮选择模式：枚举按钮，检查 isEnabled()
            const allButtons = modal.locator('button');
            const cardButtons = allButtons.filter({ hasNotText: /确认|Confirm|取消|Cancel/ });
            const cardButtonCount = await cardButtons.count();
            
            console.log(`找到 ${cardButtonCount} 个卡牌按钮`);
            
            let clickedButton = null;
            for (let i = 0; i < cardButtonCount; i++) {
                const button = cardButtons.nth(i);
                const isDisabled = await button.isDisabled();
                const text = await button.textContent();
                console.log(`按钮 ${i}: ${text}, disabled: ${isDisabled}`);
                
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
            console.log('✅ 已选择精灵');
            
            // 7. 点击确认按钮
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            console.log('✅ 已确认选择');
            
            // 8. 等待弹窗关闭
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 9. 等待能力执行完成（精灵能力直接胜利，不需要额外交互）
            await setup.player1Page.waitForTimeout(2000);
            
            console.log('\n=== 验证游戏结束 ===');
            
            const stateAfter = await setup.player1Page.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                return {
                    sys: state?.sys,
                };
            });
            
            type SystemState = { gameover?: { winner: string; reason?: string } };
            const sys = stateAfter.sys as SystemState;
            
            console.log('能力执行后（完整状态）:', {
                isGameOver: !!sys?.gameover,
                winner: sys?.gameover?.winner,
                reason: sys?.gameover?.reason,
            });
            
            // 核心功能验证：游戏结束，P1 获胜（女导师复制精灵能力）
            expect(sys.gameover).toBeDefined();
            expect(sys.gameover!.winner).toBe('0');
            
            console.log('✅ P1 通过女导师复制精灵能力直接获胜');
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
