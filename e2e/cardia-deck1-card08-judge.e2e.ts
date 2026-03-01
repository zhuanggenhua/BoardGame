import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 影响力8 - 审判官（使用新API重写）
 * 能力：🔄 你赢得所有平局，包括之后的遭遇。平局不会触发能力
 * 
 * 对比旧版本：
 * - 旧版：~120行代码，手动注入状态
 * - 新版：~80行代码，使用 setupCardiaTestScenario 一行配置
 */
test.describe('Cardia 一号牌组 - 审判官（新API）', () => {
    test('影响力8 - 审判官：放置持续能力标记', async ({ browser }) => {
        // ✨ 新API：一行配置完整场景
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_08'], // 审判官（影响力8）
                deck: ['deck_i_card_01', 'deck_i_card_02'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_03', 'deck_i_card_04'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试审判官能力（新API）===');
            
            // 1. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { 
                hand: unknown[]; 
                deck: unknown[]; 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number }>;
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
            
            // P1 打出影响力8（审判官）
            console.log('P1 打出影响力8（审判官）');
            await playCard(setup.player1Page, 0);
            
            // P2 打出影响力10（傀儡师）
            console.log('P2 打出影响力10（傀儡师）');
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
            console.log('激活审判官能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 验证阶段2：持续能力已放置
            const afterAbility = await readCoreState(setup.player1Page);
            
            console.log('能力执行后:', {
                ongoingAbilitiesCount: (afterAbility.ongoingAbilities as unknown[])?.length || 0,
                ongoingAbilities: afterAbility.ongoingAbilities,
                phase: afterAbility.phase,
            });
            
            // 核心功能验证：持续能力已放置
            type OngoingAbility = { abilityId: string; playerId: string };
            const ongoingAbilities = afterAbility.ongoingAbilities as OngoingAbility[];
            expect(ongoingAbilities).toBeDefined();
            expect(ongoingAbilities.length).toBeGreaterThan(0);
            
            // 查找审判官的持续能力
            const magistrateOngoing = ongoingAbilities.find(
                (a) => a.abilityId === 'ability_i_magistrate'
            );
            expect(magistrateOngoing).toBeDefined();
            expect(magistrateOngoing!.playerId).toBe('0');
            console.log('✅ 阶段2验证通过');
            
            // ===== 阶段3：回合结束 =====
            console.log('\n=== 阶段3：回合结束 ===');
            
            // 等待回合结束，进入下一回合的 play 阶段
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            // 验证阶段3：双方抽牌，持续能力仍然存在
            const afterDraw = await readCoreState(setup.player1Page);
            const playersAfterDraw = afterDraw.players as Record<string, PlayerState>;
            
            console.log('回合结束后:', {
                p1HandSize: playersAfterDraw['0'].hand.length,
                p2HandSize: playersAfterDraw['1'].hand.length,
                p1DeckSize: playersAfterDraw['0'].deck.length,
                p2DeckSize: playersAfterDraw['1'].deck.length,
                ongoingAbilitiesCount: (afterDraw.ongoingAbilities as unknown[])?.length || 0,
            });
            
            // 验证：双方都抽1张牌
            expect(playersAfterDraw['0'].hand.length).toBe(initialP1HandSize); // 打出1张，抽1张，回到初始值
            expect(playersAfterDraw['1'].hand.length).toBe(initialP2HandSize);
            
            // 验证：牌库减少1张
            expect(playersAfterDraw['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfterDraw['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：阶段推进到下一回合的 play
            expect(afterDraw.phase).toBe('play');
            
            // 验证：持续能力仍然存在（持续能力不会在回合结束时清除）
            const ongoingAbilitiesAfterDraw = afterDraw.ongoingAbilities as OngoingAbility[];
            const magistrateOngoingAfterDraw = ongoingAbilitiesAfterDraw.find(
                (a) => a.abilityId === 'ability_i_magistrate'
            );
            expect(magistrateOngoingAfterDraw).toBeDefined();
            console.log('✅ 阶段3验证通过（持续能力仍然存在）');
            
            console.log('\n✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
