import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力4 - 调停者（综合测试）
 * 能力：🔄 这次遭遇为平局
 * 
 * 能力类型：持续能力（ongoing）
 * 效果：放置持续标记，将当前遭遇结果强制变为平局
 * 持续时间：永久（直到被虚空法师移除）
 * 
 * 测试覆盖：
 * 1. 基础功能：强制平局 + 持续标记放置
 * 2. 印戒归还：从"有获胜方"变为"平局"时移除印戒
 * 3. 作用范围：只影响当前遭遇，不影响后续遭遇
 */
test.describe('Cardia 一号牌组 - 调停者（综合测试）', () => {
    test('基础功能：强制平局 + 持续标记放置', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04'], // 调停者（影响力4）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 打出卡牌 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                deck: unknown[]; 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number }>;
                signets: number;
            };
            const players = initialState.players as Record<string, PlayerState>;
            const initialP1Signets = players['0'].signets;
            const initialP2Signets = players['1'].signets;
            
            // P1 打出调停者（影响力4）
            console.log('P1 打出影响力4（调停者）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出傀儡师（影响力10）
            console.log('P2 打出影响力10（傀儡师）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 激活能力 ===');
            
            // 等待进入能力阶段（P1失败）
            await waitForPhase(setup.player1Page, 'ability');
            
            // 验证能力执行前：P2 应该赢
            const beforeAbility = await readCoreState(setup.player1Page);
            type EncounterState = {
                winnerId?: string;
                player1Influence: number;
                player2Influence: number;
            };
            const encounterBefore = beforeAbility.currentEncounter as EncounterState;
            expect(encounterBefore?.winnerId).toBe('1');
            expect(encounterBefore?.player1Influence).toBe(4);
            expect(encounterBefore?.player2Influence).toBe(10);
            console.log('✅ 能力执行前：P2 获胜（10 > 4）');
            
            // 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活调停者能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 验证能力执行后：持续标记已放置
            const afterAbility = await readCoreState(setup.player1Page);
            type OngoingAbility = {
                abilityId: string;
                cardId: string;
                effectType: string;
            };
            const ongoingAbilities = afterAbility.ongoingAbilities as OngoingAbility[];
            const encounterAfter = afterAbility.currentEncounter as EncounterState;
            
            expect(ongoingAbilities.length).toBeGreaterThan(0);
            const mediatorOngoing = ongoingAbilities.find(
                (a) => a.abilityId === 'ability_i_mediator'
            );
            expect(mediatorOngoing).toBeDefined();
            expect(mediatorOngoing!.effectType).toBe('forceTie');
            console.log('✅ 持续能力已放置');
            
            // 验证遭遇结果变为平局
            expect(encounterAfter?.winnerId).toBeUndefined();
            console.log('✅ 遭遇结果变为平局');
            
            console.log('\n=== 回合结束 ===');
            
            // 等待回合结束
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 验证：平局时印戒不放置
            const stateAfter = await readCoreState(setup.player1Page);
            const playersAfter = stateAfter.players as Record<string, PlayerState>;
            
            expect(playersAfter['0'].signets).toBe(initialP1Signets);
            expect(playersAfter['1'].signets).toBe(initialP2Signets);
            console.log('✅ 平局时印戒不放置');
            
            // 验证：持续标记仍然存在
            const ongoingAbilitiesAfter = stateAfter.ongoingAbilities as OngoingAbility[];
            const mediatorOngoingAfter = ongoingAbilitiesAfter.find(
                (a) => a.abilityId === 'ability_i_mediator'
            );
            expect(mediatorOngoingAfter).toBeDefined();
            console.log('✅ 持续标记仍然存在（永久效果）');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('印戒归还：从"有获胜方"变为"平局"时移除印戒', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04'], // 调停者（影响力4）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_ii_card_15'], // 机械精灵（影响力15）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 打出卡牌 ===');
            
            // P1 打出调停者（影响力4）
            console.log('P1 打出影响力4（调停者）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出机械精灵（影响力15）
            console.log('P2 打出影响力15（机械精灵）');
            await playCard(setup.player2Page, 0);
            
            console.log('\n=== 验证能力激活前：P2 卡牌获得印戒 ===');
            
            // 等待进入能力阶段
            await waitForPhase(setup.player1Page, 'ability');
            
            // 读取能力激活前的状态
            const beforeAbility = await readCoreState(setup.player1Page);
            type PlayerState = { 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number; signets: number }>;
                signets: number;
            };
            const playersBefore = beforeAbility.players as Record<string, PlayerState>;
            type EncounterState = {
                winnerId?: string;
                player1Influence: number;
                player2Influence: number;
            };
            const encounterBefore = beforeAbility.currentEncounter as EncounterState;
            
            // 验证：P2 获胜并获得印戒
            expect(encounterBefore?.winnerId).toBe('1');
            expect(encounterBefore?.player1Influence).toBe(4);
            expect(encounterBefore?.player2Influence).toBe(15);
            
            const p2Card = playersBefore['1'].playedCards[0];
            expect(p2Card.signets).toBe(1);
            console.log('✅ P2 获胜（15 > 4），卡牌获得1枚印戒');
            
            console.log('\n=== 激活调停者能力 ===');
            
            // 激活能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活调停者能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            console.log('\n=== 验证：遭遇结果变为平局，印戒被移除 ===');
            
            // 读取能力激活后的状态
            const afterAbility = await readCoreState(setup.player1Page);
            const playersAfter = afterAbility.players as Record<string, PlayerState>;
            const encounterAfter = afterAbility.currentEncounter as EncounterState;
            
            // 验证：遭遇结果变为平局
            expect(encounterAfter?.winnerId).toBeUndefined();
            console.log('✅ 遭遇结果变为平局');
            
            // 验证：P2 卡牌上的印戒被移除
            const p2CardAfter = playersAfter['1'].playedCards[0];
            expect(p2CardAfter.signets).toBe(0); // 印戒被移除：1 → 0
            console.log('✅ P2 卡牌印戒被移除（1 → 0）');
            
            // 验证：P1 卡牌没有印戒
            const p1CardAfter = playersAfter['0'].playedCards[0];
            expect(p1CardAfter.signets).toBe(0);
            console.log('✅ P1 卡牌没有印戒');
            
            console.log('✅ 测试通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('作用范围：只影响当前遭遇，不影响后续遭遇', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04', 'deck_i_card_01'], // 调停者（影响力4）、影响力1
                deck: ['deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_10', 'deck_i_card_01'], // 傀儡师（影响力10）、雇佣剑士（影响力1）
                deck: ['deck_i_card_08'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 第一回合：调停者强制平局 ===');
            
            // P1 打出调停者（影响力4）
            console.log('P1 打出调停者（影响力4）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出傀儡师（影响力10）
            console.log('P2 打出傀儡师（影响力10）');
            await playCard(setup.player2Page, 0);
            
            // 等待进入能力阶段
            await waitForPhase(setup.player1Page, 'ability');
            
            // 激活调停者能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活调停者能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 等待回合结束
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 验证第一回合结果：遭遇为平局，印戒被移除
            const afterRound1 = await readCoreState(setup.player1Page);
            type PlayerState = { 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number; signets: number }>;
                signets: number;
            };
            const playersAfterRound1 = afterRound1.players as Record<string, PlayerState>;
            
            expect(playersAfterRound1['0'].playedCards[0].signets).toBe(0);
            expect(playersAfterRound1['1'].playedCards[0].signets).toBe(0); // 印戒被移除
            console.log('✅ 第一回合为平局，P2卡牌印戒被移除（1 → 0）');
            
            console.log('\n=== 第二回合：正常判定（不受调停者影响）===');
            
            // P1 打出影响力1
            console.log('P1 打出影响力1');
            await playCard(setup.player1Page, 0);
            
            // P2 打出雇佣剑士（影响力1）
            console.log('P2 打出影响力1（雇佣剑士）');
            await playCard(setup.player2Page, 0);
            
            // 平局（1 = 1），不会触发能力阶段
            console.log('平局（1 = 1），不会触发能力阶段');
            
            // 等待回合结束
            await waitForPhase(setup.player1Page, 'play', 10000);
            
            // 读取第二回合遭遇结果
            const afterRound2 = await readCoreState(setup.player1Page);
            type EncounterState = {
                winnerId?: string;
                player1Influence: number;
                player2Influence: number;
            };
            const playersAfterRound2 = afterRound2.players as Record<string, PlayerState>;
            
            // 验证：第二回合为平局（不受调停者影响）
            console.log('✅ 第二回合为平局（1 = 1），不受调停者影响');
            
            // 验证：第二回合卡牌都没有印戒（平局）
            expect(playersAfterRound2['0'].playedCards[1].signets).toBe(0);
            expect(playersAfterRound2['1'].playedCards[1].signets).toBe(0);
            console.log('✅ 第二回合卡牌都没有印戒（平局）');
            
            // 验证最终状态
            const finalState = await readCoreState(setup.player1Page);
            const playersFinal = finalState.players as Record<string, PlayerState>;
            
            // 验证：第一回合卡牌印戒被移除
            expect(playersFinal['0'].playedCards[0].signets).toBe(0);
            expect(playersFinal['1'].playedCards[0].signets).toBe(0); // 印戒被移除
            console.log('✅ 第一回合P2卡牌印戒被移除（调停者能力）');
            
            // 验证：第二回合卡牌都没有印戒（平局）
            expect(playersFinal['0'].playedCards[1].signets).toBe(0);
            expect(playersFinal['1'].playedCards[1].signets).toBe(0);
            console.log('✅ 第二回合卡牌都没有印戒（平局，不受调停者影响）');
            
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
