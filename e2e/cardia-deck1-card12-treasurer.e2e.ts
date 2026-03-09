import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
    applyCoreStateDirect,
} from './helpers/cardia';

/**
 * 影响力12 - 财务官
 * 能力：🔄 上个遭遇获胜的牌额外获得1枚印戒（持续能力）
 * 
 * 测试场景（使用状态注入）：
 * - 初始状态：
 *   - 第1回合已结束：P1 打出精灵（16），P2 打出虚空法师（2），P1 获胜，精灵有1个印戒
 *   - P1 已经激活过财务官能力（持续标记已放置）
 *   - 双方各有一张手牌
 * - 测试流程：
 *   - 第2回合：P1 打出财务官（card12，影响力12）
 *   - P2 打出傀儡师（card10，影响力10）
 *   - P1 获胜（当前遭遇）
 *   - 持续标记自动生效：**上一个遭遇（第1回合）获胜的牌（精灵）**额外获得1枚印戒（总共2枚）
 *   - 持续标记被移除（一次性效果）
 * 
 * 注：能力描述"上个遭遇获胜的牌"指的是：已经结束的上一个遭遇的获胜者
 */
test.describe('Cardia 一号牌组 - 财务官', () => {
    test('影响力12 - 财务官：上个遭遇获胜的牌额外获得1枚印戒（持续能力）', async ({ browser }) => {
        // ✨ 使用状态注入：直接构造财务官能力已激活的场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_12'], // 财务官
                deck: [],
                playedCards: [
                    { 
                        defId: 'deck_i_card_16', 
                        signets: 1, 
                        encounterIndex: 0,
                        ongoingMarkers: ['ability_i_treasurer'], // 财务官能力已激活（标记在精灵上）
                    }, // 精灵（第1回合获胜，有1个印戒）
                ],
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 0, encounterIndex: 0 }, // 虚空法师（第1回合失败）
                ],
            },
            phase: 'play',
            turnNumber: 1,
        });
        
        try {
            console.log('\n=== 测试财务官能力 ===');
            
            // 验证初始状态：持续标记已存在，精灵有1个印戒
            const initialState = await readCoreState(setup.player1Page);
            type OngoingAbility = { abilityId: string; cardId: string; playerId: string; effectType: string };
            const ongoingAbilities = initialState.ongoingAbilities as OngoingAbility[];
            
            type PlayerState = { 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number; signets: number }>;
            };
            const playersInitial = initialState.players as Record<string, PlayerState>;
            
            const elfCardInitial = playersInitial['0'].playedCards.find(
                (card) => card.defId === 'deck_i_card_16'
            );
            
            console.log('初始状态:', {
                phase: initialState.phase,
                turnNumber: initialState.turnNumber,
                ongoingAbilitiesCount: ongoingAbilities.length,
                treasurerAbility: ongoingAbilities.find(a => a.abilityId === 'ability_i_treasurer'),
                elfCard: elfCardInitial ? {
                    defId: elfCardInitial.defId,
                    signets: elfCardInitial.signets,
                } : null,
            });
            
            expect(ongoingAbilities).toBeDefined();
            expect(ongoingAbilities.length).toBeGreaterThan(0);
            
            const treasurerAbility = ongoingAbilities.find(
                (a) => a.abilityId === 'ability_i_treasurer' && a.playerId === '0'
            );
            expect(treasurerAbility).toBeDefined();
            
            expect(elfCardInitial).toBeDefined();
            expect(elfCardInitial!.signets).toBe(1); // 第1回合获胜，有1个印戒
            
            console.log('✅ 初始验证通过：财务官持续标记已存在，精灵有1个印戒');
            
            // 手动注入 previousEncounter（模拟第1回合精灵获胜的遭遇）
            const stateWithPreviousEncounter = {
                ...initialState,
                previousEncounter: {
                    player1Card: elfCardInitial,
                    player2Card: playersInitial['1'].playedCards[0], // 虚空法师
                    player1Influence: 16,
                    player2Influence: 2,
                    winnerId: '0',
                    loserId: '1',
                },
            };
            
            await applyCoreStateDirect(setup.player1Page, stateWithPreviousEncounter);
            
            // 等待状态同步
            await setup.player1Page.waitForTimeout(500);
            
            // ===== 打出卡牌：P1 获胜（当前遭遇），精灵（上一个遭遇获胜的牌）额外获得1枚印戒 =====
            console.log('\n=== P1 打出财务官，P2 打出傀儡师 ===');
            
            // P1 打出影响力12（财务官）
            console.log('P1 打出影响力12（财务官）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出影响力10（傀儡师）
            console.log('P2 打出影响力10（傀儡师）');
            await playCard(setup.player2Page, 0);
            
            // 等待遭遇解析完成
            await setup.player1Page.waitForTimeout(3000);
            
            console.log('\n=== 验证财务官能力效果 ===');
            
            // 读取状态，验证精灵（上一个遭遇获胜的牌）获得了额外的印戒
            const afterEncounter = await readCoreState(setup.player1Page);
            const playersAfterEncounter = afterEncounter.players as Record<string, PlayerState>;
            
            console.log('遭遇解析后状态:', {
                phase: afterEncounter.phase,
                currentEncounter: afterEncounter.currentEncounter,
                player0PlayedCards: playersAfterEncounter['0'].playedCards.map(c => ({
                    defId: c.defId,
                    signets: c.signets,
                })),
            });
            
            // 查找精灵卡牌（上一个遭遇获胜的牌）
            const elfCard = playersAfterEncounter['0'].playedCards.find(
                (card) => card.defId === 'deck_i_card_16'
            );
            expect(elfCard).toBeDefined();
            
            // 验证：精灵获得了2枚印戒（1枚基础 + 1枚财务官能力额外）
            console.log('精灵卡牌状态:', {
                defId: elfCard!.defId,
                signets: elfCard!.signets,
                expected: 2,
            });
            
            expect(elfCard!.signets).toBe(2);
            
            console.log('✅ 验证通过：精灵（上一个遭遇获胜的牌）获得了额外的印戒（总共2枚）');
            
            // 查找财务官卡牌（当前遭遇获胜的牌）
            const treasurerCard = playersAfterEncounter['0'].playedCards.find(
                (card) => card.defId === 'deck_i_card_12'
            );
            expect(treasurerCard).toBeDefined();
            
            // 验证：财务官只有1枚印戒（基础印戒，不受财务官能力影响）
            console.log('财务官卡牌状态:', {
                defId: treasurerCard!.defId,
                signets: treasurerCard!.signets,
                expected: 1,
            });
            
            expect(treasurerCard!.signets).toBe(1);
            
            console.log('✅ 验证通过：财务官（当前遭遇获胜的牌）只有1枚印戒（不受财务官能力影响）');
            
            // 验证：持续标记已被移除（一次性效果）
            const ongoingAbilitiesAfter = afterEncounter.ongoingAbilities as OngoingAbility[];
            const treasurerAbilityAfter = ongoingAbilitiesAfter.find(
                (a) => a.abilityId === 'ability_i_treasurer' && a.playerId === '0'
            );
            expect(treasurerAbilityAfter).toBeUndefined(); // 持续标记已被移除
            
            console.log('✅ 持续标记已被移除（一次性效果）');
            
            console.log('\n✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
