import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力9 - 伏击者（使用新API重写）
 * 能力：选择一个派系，你的对手弃掉所有该派系的手牌
 * 
 * 能力类型：即时能力（instant）
 * 效果：
 * - 步骤1：P1 选择一个派系
 * - 步骤2：P2 弃掉所有该派系的手牌
 * 
 * 测试场景：
 * - P1 打出影响力9（伏击者）
 * - P2 打出影响力10（傀儡师）
 * - P1 失败（9 < 10），激活伏击者能力
 * - P1 选择派系（Guild）
 * - P2 手牌中有 2 张 Guild 派系的牌
 * - 验证：P2 的 2 张 Guild 派系手牌被弃掉
 * 
 * 对比旧版本：
 * - 旧版：~150行代码，手动注入状态
 * - 新版：~100行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 伏击者（新API）', () => {
    test('影响力9 - 伏击者：对手弃掉所有指定派系的手牌', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_09'], // 伏击者（影响力9）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: [
                    'deck_i_card_10', // 傀儡师（影响力10，Guild派系）
                    'deck_i_card_08', // 审判官（影响力8，Guild派系）
                    'deck_i_card_14', // 女导师（影响力14，Guild派系）
                    'deck_i_card_01', // 雇佣剑士（影响力1，Swamp派系）
                ],
                deck: ['deck_i_card_07', 'deck_i_card_11'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: Array<{ uid: string; defId: string; faction: string }>;
                deck: unknown[];
                discard: unknown[];
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP2HandSize = players['1'].hand.length;
            const initialP2DiscardSize = players['1'].discard.length;
            
            console.log('初始状态:', {
                p2HandSize: initialP2HandSize,
                p2Hand: players['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
                p2DiscardSize: initialP2DiscardSize,
            });
            
            // 2. P1 打出影响力9（伏击者）
            console.log('P1 打出影响力9（伏击者）');
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
            console.log('激活伏击者能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 6. 等待派系选择弹窗出现
            const modal = setup.player1Page.locator('.fixed.inset-0.z-50');
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 派系选择弹窗已显示');
            
            // 7. 选择 Guild 派系（P2 手牌中有 3 张 Guild 派系的牌）
            // 注意：弹窗中的派系按钮顺序可能是：Swamp, Academy, Guild, Dynasty
            const factionButtons = modal.locator('button');
            const guildButton = factionButtons.nth(2); // 假设第三个是 Guild
            await guildButton.click();
            await setup.player1Page.waitForTimeout(500);
            console.log('✅ 已选择 Guild 派系');
            
            // 8. 等待弹窗关闭（表示交互已处理）
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ 弹窗已关闭');
            
            // 9. 等待能力执行完成（自动回合结束）
            console.log('等待回合结束...');
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 10. 验证：P2 的 Guild 派系手牌被弃掉
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('回合结束后:', {
                p2HandSize: playersAfter['1'].hand.length,
                p2Hand: playersAfter['1'].hand.map(c => ({ defId: c.defId, faction: c.faction })),
                p2DiscardSize: playersAfter['1'].discard.length,
                phase: stateAfter.phase,
            });
            
            // 核心功能验证：Guild 派系手牌被弃掉
            // 初始手牌：4 张（3 张 Guild + 1 张 Swamp）
            // P2 打出 1 张 Guild（傀儡师）
            // 剩余手牌：3 张（2 张 Guild + 1 张 Swamp）
            // 伏击者能力：弃掉所有 Guild 派系手牌（2 张）
            // 最终手牌：1 张（1 张 Swamp）
            expect(playersAfter['1'].hand.length).toBe(1);
            
            // 验证剩余手牌是 Swamp 派系
            const remainingCard = playersAfter['1'].hand[0];
            expect(remainingCard.faction).toBe('swamp');
            expect(remainingCard.defId).toBe('deck_i_card_01'); // 雇佣剑士
            
            // 验证弃牌堆增加了 2 张（被弃掉的 Guild 派系手牌）
            expect(playersAfter['1'].discard.length).toBe(initialP2DiscardSize + 2);
            
            console.log('✅ P2 的 Guild 派系手牌被弃掉，只剩下 Swamp 派系手牌');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
