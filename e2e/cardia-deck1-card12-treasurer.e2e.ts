import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力12 - 财务官（使用新API重写）
 * 能力：🔄 在下一个遭遇获胜的那张牌额外获得1枚印戒（持续能力）
 * 
 * 测试场景（两回合）：
 * - 第一回合：
 *   - P1 打出财务官（card12，影响力12）
 *   - P2 打出精灵（card16，影响力16）
 *   - P1 失败，手动激活财务官能力（放置持续标记）
 *   - 注意：只有失败者才能在能力阶段激活能力
 * - 第二回合：
 *   - P1 打出精灵（card16，影响力16）
 *   - P2 打出虚空法师（card02，影响力2）
 *   - P1 获胜，持续标记自动生效，精灵额外获得1枚印戒（总共2枚）
 *   - 持续标记被移除（一次性效果）
 * 
 * 对比旧版本：
 * - 旧版：~120行代码，手动注入状态，简化验证
 * - 新版：~100行代码，使用 setupCardiaTestScenario 一行配置，完整两回合验证
 */
test.describe('Cardia 一号牌组 - 财务官（新API）', () => {
    test('影响力12 - 财务官：在下一个遭遇获胜的那张牌额外获得1枚印戒（持续能力）', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_12', 'deck_i_card_16'], // 财务官 + 精灵
                deck: [], // 不需要抽牌
            },
            player2: {
                hand: ['deck_i_card_16', 'deck_i_card_02'], // 精灵 + 虚空法师
                deck: [],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试财务官能力（新API - 持续能力）===');
            
            // ===== 第一回合：P1 失败，手动激活财务官能力（放置持续标记）=====
            console.log('\n=== 第一回合：P1 失败，手动激活财务官能力 ===');
            
            // P1 打出影响力12（财务官）
            console.log('P1 打出影响力12（财务官）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出影响力16（精灵）
            console.log('P2 打出影响力16（精灵）');
            await playCard(setup.player2Page, 0);
            
            // 等待进入能力阶段（P1失败，应该有能力按钮）
            await waitForPhase(setup.player1Page, 'ability');
            
            // 手动激活财务官能力（放置持续标记）
            // 注意：只有失败者才能在能力阶段激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('手动激活财务官能力（放置持续标记）');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(2000);
            
            // 验证：持续标记已放置
            const afterAbility = await readCoreState(setup.player1Page);
            type OngoingAbility = { abilityId: string; cardId: string; playerId: string; effectType: string };
            const ongoingAbilities = afterAbility.ongoingAbilities as OngoingAbility[];
            
            expect(ongoingAbilities).toBeDefined();
            expect(ongoingAbilities.length).toBeGreaterThan(0);
            
            const treasurerAbility = ongoingAbilities.find(
                (a) => a.abilityId === 'ability_i_treasurer' && a.playerId === '0'
            );
            expect(treasurerAbility).toBeDefined();
            expect(treasurerAbility!.effectType).toBe('extraSignet');
            
            console.log('✅ 第一回合验证通过：持续标记已手动放置');
            
            // 等待回合结束
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            // ===== 第二回合：P1 获胜，持续标记生效 =====
            console.log('\n=== 第二回合：P1 获胜，持续标记生效 ===');
            
            // P1 打出影响力16（精灵）
            console.log('P1 打出影响力16（精灵）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出影响力2（虚空法师）
            console.log('P2 打出影响力2（虚空法师）');
            await playCard(setup.player2Page, 0);
            
            // 等待进入能力阶段（P1获胜）
            await waitForPhase(setup.player1Page, 'ability');
            
            // 读取状态，验证精灵获得了额外的印戒
            const afterRound2 = await readCoreState(setup.player1Page);
            type PlayerState = { 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number; signets: number }>;
            };
            const playersAfterRound2 = afterRound2.players as Record<string, PlayerState>;
            
            // 查找精灵卡牌
            const elfCard = playersAfterRound2['0'].playedCards.find(
                (card) => card.defId === 'deck_i_card_16'
            );
            expect(elfCard).toBeDefined();
            
            // 验证：精灵获得了2枚印戒（1枚基础 + 1枚财务官额外）
            expect(elfCard!.signets).toBe(2);
            
            console.log('✅ 第二回合验证通过：精灵获得了额外的印戒（总共2枚）');
            
            // 验证：持续标记已被移除（一次性效果）
            const ongoingAbilitiesRound2 = afterRound2.ongoingAbilities as OngoingAbility[];
            const treasurerAbilityRound2 = ongoingAbilitiesRound2.find(
                (a) => a.abilityId === 'ability_i_treasurer' && a.playerId === '0'
            );
            expect(treasurerAbilityRound2).toBeUndefined(); // 持续标记已被移除
            
            console.log('✅ 持续标记已被移除（一次性效果）');
            
            console.log('\n✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
