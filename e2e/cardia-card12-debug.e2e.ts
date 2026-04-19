import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    applyCoreStateDirect,
} from './helpers/cardia';

/**
 * 调试财务官能力 - 完整场景
 * 
 * 场景：
 * - 回合3：P1 打出女导师（14），P2 打出财务官（12），P1 获胜
 * - P2 激活财务官能力（持续标记）
 * - 回合4：任意遭遇结算
 * - 预期：女导师（上一个遭遇的获胜卡牌）额外获得1枚印戒
 */
test.describe('Cardia 财务官调试', () => {
    test('财务官能力：给上一个遭遇获胜的牌额外印戒（无论谁获胜）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_07'], // 宫廷卫士
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_04', signets: 0, encounterIndex: 1, ongoingMarkers: ['ability_i_mediator'] },
                    { defId: 'deck_i_card_05', signets: 0, encounterIndex: 2 },
                    { defId: 'deck_i_card_14', signets: 1, encounterIndex: 3 }, // 女导师（第3回合获胜）
                ],
            },
            player2: {
                hand: ['deck_i_card_06'], // 占卜师
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_08', signets: 0, encounterIndex: 1 },
                    { defId: 'deck_i_card_11', signets: 1, encounterIndex: 2 },
                    { defId: 'deck_i_card_12', signets: 0, encounterIndex: 3, ongoingMarkers: ['ability_i_treasurer'] }, // 财务官（第3回合失败，但激活了能力）
                ],
            },
            phase: 'play',
            turnNumber: 4,
            ongoingAbilities: [
                {
                    abilityId: 'ability_i_mediator',
                    cardId: 'deck_i_card_04_xxx',
                    playerId: '0',
                    effectType: 'forceTie',
                    encounterIndex: 1,
                },
                {
                    abilityId: 'ability_i_treasurer',
                    cardId: 'deck_i_card_12_xxx',
                    playerId: '1',
                    effectType: 'extraSignet',
                    encounterIndex: 3,
                },
            ],
        });
        
        try {
            console.log('\n=== 初始状态 ===');
            const initialState = await readCoreState(setup.player1Page);
            
            // 手动注入 previousEncounter（模拟第3回合：P1 女导师获胜）
            const governess = initialState.players['0'].playedCards.find((c: any) => c.defId === 'deck_i_card_14');
            const treasurer = initialState.players['1'].playedCards.find((c: any) => c.defId === 'deck_i_card_12');
            
            const stateWithPreviousEncounter = {
                ...initialState,
                previousEncounter: {
                    player1Card: governess,
                    player2Card: treasurer,
                    player1Influence: 14,
                    player2Influence: 12,
                    winnerId: '0',  // P1 获胜
                    loserId: '1',
                },
            };
            
            await applyCoreStateDirect(setup.player1Page, stateWithPreviousEncounter);
            await setup.player1Page.waitForTimeout(500);
            
            console.log('已注入 previousEncounter:', {
                winnerId: '0',
                player1Card: 'deck_i_card_14 (女导师)',
                player2Card: 'deck_i_card_12 (财务官)',
            });
            
            console.log('\nP1 playedCards (before):', initialState.players['0'].playedCards.map((c: any) => ({
                defId: c.defId,
                signets: c.signets,
            })));
            
            // 打出第 4 回合的卡牌
            console.log('\n=== 第 4 回合 ===');
            console.log('P2 打出占卜师（6）');
            await playCard(setup.player2Page, 0);
            await setup.player2Page.waitForTimeout(1000);
            
            console.log('P1 打出宫廷卫士（7）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(3000);
            
            // 读取状态
            const afterEncounter = await readCoreState(setup.player1Page);
            
            console.log('\n=== 遭遇结算后 ===');
            console.log('currentEncounter winner:', afterEncounter.currentEncounter?.winnerId);
            console.log('previousEncounter:', afterEncounter.previousEncounter ? {
                winnerId: afterEncounter.previousEncounter.winnerId,
                player1Card: afterEncounter.previousEncounter.player1Card?.defId,
                player2Card: afterEncounter.previousEncounter.player2Card?.defId,
            } : 'undefined');
            
            console.log('\nP1 playedCards (after):', afterEncounter.players['0'].playedCards.map((c: any) => ({
                defId: c.defId,
                signets: c.signets,
            })));
            
            // 检查女导师是否获得了额外印戒
            const governessAfter = afterEncounter.players['0'].playedCards.find((c: any) => c.defId === 'deck_i_card_14');
            console.log('\n女导师卡牌状态:', {
                defId: governessAfter?.defId,
                signets: governessAfter?.signets,
                expected: 2,  // 1 (基础) + 1 (财务官能力)
            });
            
            expect(governessAfter).toBeDefined();
            expect(governessAfter.signets).toBe(2);
            
            console.log('✅ 验证通过：女导师（上一个遭遇的获胜卡牌）获得了额外印戒');
            
            // 检查财务官能力是否被移除
            const treasurerAbility = (afterEncounter.ongoingAbilities as any[]).find(
                a => a.abilityId === 'ability_i_treasurer'
            );
            
            expect(treasurerAbility).toBeUndefined();
            console.log('✅ 财务官能力已被移除（一次性效果）');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
