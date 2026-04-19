import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力12 - 财务官
 * 能力：🔄 上个遭遇获胜的牌额外获得1枚印戒（持续能力）
 * 
 * 测试场景：完整走完两个回合
 * - 第1回合：P1 精灵（16）获胜，P2 虚空法师（2）失败
 * - 第2回合：P1 财务官（12）失败，P2 精灵（16）获胜
 * - P1 激活财务官能力，立即给第1回合的精灵额外印戒
 * - 验证：第1回合的精灵有2个印戒（1个基础 + 1个财务官能力额外）
 * - 验证：持续标记已放置，并记录了目标卡牌信息
 */
test.describe('Cardia 一号牌组 - 财务官', () => {
    test('影响力12 - 财务官：上个遭遇获胜的牌额外获得1枚印戒（持续能力）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_16', 'deck_i_card_12'], // 精灵、财务官
                deck: [],
                playedCards: [],
            },
            player2: {
                hand: ['deck_i_card_02', 'deck_i_card_16'], // 虚空法师、精灵
                deck: [],
                playedCards: [],
            },
            phase: 'play',
            turnNumber: 0,
        });
        
        try {
            console.log('\n=== 第1回合：P1 精灵获胜 ===');
            
            // P1 打出精灵（16）
            console.log('P1 打出精灵（16）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出虚空法师（2）
            console.log('P2 打出虚空法师（2）');
            await playCard(setup.player2Page, 0);
            
            // 等待遭遇解析
            await setup.player1Page.waitForTimeout(2000);
            
            // 等待进入 ability 阶段（P2 失败）
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            // P2 跳过能力（虚空法师没有能力）
            console.log('P2 跳过能力');
            await setup.player2Page.evaluate(async () => {
                const dispatch = (window as any).__BG_DISPATCH__;
                await dispatch('cardia:skip_ability', {});
            });
            
            // 等待回合结束，进入下一回合
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 验证第1回合结果
            const afterRound1 = await readCoreState(setup.player1Page);
            type PlayerState = { 
                playedCards: Array<{ uid: string; defId: string; signets: number }>;
            };
            const players1 = afterRound1.players as Record<string, PlayerState>;
            const elfCard1 = players1['0'].playedCards.find(c => c.defId === 'deck_i_card_16');
            
            console.log('第1回合结果:', {
                elfCard: elfCard1 ? { defId: elfCard1.defId, signets: elfCard1.signets } : null,
            });
            
            expect(elfCard1).toBeDefined();
            expect(elfCard1!.signets).toBe(1); // 精灵有1个印戒
            
            console.log('✅ 第1回合验证通过：精灵有1个印戒');
            
            console.log('\n=== 第2回合：P1 财务官失败，激活能力 ===');
            
            // P1 打出财务官（12）
            console.log('P1 打出财务官（12）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出精灵（16）
            console.log('P2 打出精灵（16）');
            await playCard(setup.player2Page, 0);
            
            // 等待遭遇解析
            await setup.player1Page.waitForTimeout(2000);
            
            // 等待进入 ability 阶段（P1 失败）
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            console.log('✅ 已进入 ability 阶段');
            
            // P1 激活财务官能力
            console.log('P1 激活财务官能力');
            const currentState = await readCoreState(setup.player1Page);
            const treasurerCardUid = currentState.players['0'].currentCard.uid;
            
            await setup.player1Page.evaluate(async ({ abilityId, cardUid }) => {
                const dispatch = (window as any).__BG_DISPATCH__;
                await dispatch('cardia:activate_ability', {
                    abilityId,
                    sourceCardUid: cardUid,
                });
            }, {
                abilityId: 'ability_i_treasurer',
                cardUid: treasurerCardUid,
            });
            
            await setup.player1Page.waitForTimeout(2000);
            console.log('✅ 财务官能力已激活');
            
            console.log('\n=== 验证财务官能力效果 ===');
            
            // 读取状态，验证精灵获得了额外印戒
            const afterAbility = await readCoreState(setup.player1Page);
            const players2 = afterAbility.players as Record<string, PlayerState>;
            
            const elfCard2 = players2['0'].playedCards.find(c => c.defId === 'deck_i_card_16');
            
            console.log('能力激活后状态:', {
                elfCard: elfCard2 ? { defId: elfCard2.defId, signets: elfCard2.signets } : null,
            });
            
            expect(elfCard2).toBeDefined();
            expect(elfCard2!.signets).toBe(2); // 1个基础 + 1个财务官能力额外
            
            console.log('✅ 验证通过：精灵获得了额外印戒（总共2枚）');
            
            // 验证持续标记已放置，并记录了目标卡牌信息
            type OngoingAbility = { 
                abilityId: string; 
                targetCardId?: string;
                targetPlayerId?: string;
            };
            const ongoingAbilities = afterAbility.ongoingAbilities as OngoingAbility[];
            const treasurerAbility = ongoingAbilities.find(a => a.abilityId === 'ability_i_treasurer');
            
            expect(treasurerAbility).toBeDefined();
            expect(treasurerAbility!.targetCardId).toBe(elfCard2!.uid);
            expect(treasurerAbility!.targetPlayerId).toBe('0');
            
            console.log('✅ 持续标记已放置，并记录了目标卡牌信息');
            
            console.log('\n✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
