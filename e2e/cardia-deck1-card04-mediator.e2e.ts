import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力4 - 调停者（使用新API重写）
 * 能力：🔄 这次遭遇为平局
 * 
 * 能力类型：持续能力（ongoing）
 * 效果：放置持续标记，将当前遭遇结果强制变为平局
 * 持续时间：永久（直到被虚空法师移除）
 * 
 * 测试场景：
 * - P1 打出影响力4（调停者）
 * - P2 打出影响力10（傀儡师）
 * - P1 失败（4 < 10），激活调停者能力
 * - 验证：遭遇结果变为平局，持续标记已放置
 * - 验证：平局时印戒归还（双方都不获得印戒）
 * 
 * 对比旧版本：
 * - 旧版：~120行代码，手动注入状态，复杂的交互处理
 * - 新版：~80行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 调停者（新API）', () => {
    test('影响力4 - 调停者：强制平局', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04'], // 调停者（影响力4）
                deck: ['deck_i_card_01', 'deck_i_card_02'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 阶段1：打出卡牌 ===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                deck: unknown[]; 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number }>;
                signets: number;
            };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            const initialP1Signets = players['0'].signets;
            const initialP2Signets = players['1'].signets;
            
            console.log('初始状态:', {
                p1DeckSize: initialP1DeckSize,
                p2DeckSize: initialP2DeckSize,
                p1Signets: initialP1Signets,
                p2Signets: initialP2Signets,
            });
            
            // 2. P1 打出影响力4（调停者）
            console.log('P1 打出影响力4（调停者）');
            await playCard(setup.player1Page, 0);
            
            // 3. P2 打出影响力10（傀儡师）
            console.log('P2 打出影响力10（傀儡师）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 阶段2：激活能力 ===');
            
            // 4. 等待进入能力阶段（P1失败，应该有能力按钮）
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 5. 记录能力执行前的状态
            const beforeAbility = await readCoreState(setup.player1Page);
            type EncounterState = {
                winnerId?: string;
                player1Influence: number;
                player2Influence: number;
            };
            const encounterBefore = beforeAbility.currentEncounter as EncounterState;
            
            console.log('能力执行前:', {
                winnerId: encounterBefore?.winnerId,
                p1Influence: encounterBefore?.player1Influence,
                p2Influence: encounterBefore?.player2Influence,
            });
            
            // 验证：P2 应该赢（10 > 4）
            expect(encounterBefore?.winnerId).toBe('1');
            expect(encounterBefore?.player1Influence).toBe(4);
            expect(encounterBefore?.player2Influence).toBe(10);
            
            // 6. 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活调停者能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 7. 验证：遭遇结果应该变为平局
            const afterAbility = await readCoreState(setup.player1Page);
            type OngoingAbility = {
                abilityId: string;
                cardId: string;
                effectType: string;
                encounterIndex?: number;
            };
            const ongoingAbilities = afterAbility.ongoingAbilities as OngoingAbility[];
            const encounterAfter = afterAbility.currentEncounter as EncounterState;
            
            console.log('能力执行后:', {
                winnerId: encounterAfter?.winnerId,
                p1Influence: encounterAfter?.player1Influence,
                p2Influence: encounterAfter?.player2Influence,
                ongoingAbilities: ongoingAbilities,
            });
            
            // 核心功能验证：持续能力已放置
            expect(ongoingAbilities).toBeDefined();
            expect(ongoingAbilities.length).toBeGreaterThan(0);
            
            // 查找调停者的持续能力
            const mediatorOngoing = ongoingAbilities.find(
                (a) => a.abilityId === 'ability_i_mediator'
            );
            expect(mediatorOngoing).toBeDefined();
            expect(mediatorOngoing!.effectType).toBe('forceTie');
            
            console.log('✅ 持续能力已放置:', mediatorOngoing);
            
            // 核心功能验证：遭遇结果变为平局
            // 注意：能力执行后，遭遇可能已经结束并清理，所以 currentEncounter 可能为 undefined
            // 我们通过持续标记的存在来验证能力已生效
            expect(encounterAfter?.winnerId).toBeUndefined(); // 平局（undefined 表示平局）
            
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 8. 等待回合结束（自动推进）
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 9. 验证：平局时印戒归还（双方都不获得印戒）
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            console.log('回合结束后:', {
                p1Signets: playersAfter['0'].signets,
                p2Signets: playersAfter['1'].signets,
                p1DeckSize: playersAfter['0'].deck.length,
                p2DeckSize: playersAfter['1'].deck.length,
            });
            
            // 验证：印戒数量不变（平局时不放置印戒）
            expect(playersAfter['0'].signets).toBe(initialP1Signets);
            expect(playersAfter['1'].signets).toBe(initialP2Signets);
            
            // 验证：双方都抽牌（牌库减少1张）
            expect(playersAfter['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfter['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：持续标记仍然存在（永久效果）
            const ongoingAbilitiesAfter = stateAfter.ongoingAbilities as OngoingAbility[];
            const mediatorOngoingAfter = ongoingAbilitiesAfter.find(
                (a) => a.abilityId === 'ability_i_mediator'
            );
            expect(mediatorOngoingAfter).toBeDefined();
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
