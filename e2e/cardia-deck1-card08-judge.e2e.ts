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

    test('影响力8 - 审判官：持续标记被移除后，历史平局遭遇的印戒应该被拿掉', async ({ browser }) => {
        // ✨ 测试场景：
        // 1. 回合1：P1 打出审判官（影响力8），P2 打出傀儡师（影响力10）
        //    - P1 失败（8 < 10），激活审判官能力（放置持续标记）
        // 2. 回合2：P1 打出调停者（影响力4），P2 打出调停者（影响力4）
        //    - 原本平局（4 = 4），但审判官能力让 P1 赢得平局
        //    - 结果：P1 获胜，P1 调停者卡牌获得1枚印戒
        // 3. 回合3：P1 打出财务官（影响力12），P2 打出虚空法师（影响力2）
        //    - P2 失败（2 < 12），虚空法师能力：移除审判官的持续标记
        //    - 验证：P1 调停者卡牌的印戒应该被拿掉（从1枚变为0枚）
        
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_08', 'deck_i_card_04', 'deck_i_card_11'], // 审判官、调停者、钟表匠
                deck: ['deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_10', 'deck_i_card_04', 'deck_i_card_02'], // 傀儡师、调停者、虚空法师
                deck: ['deck_i_card_05'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 回合1：P1 失败，激活审判官能力 ===');
            
            // 1. P1 打出审判官（影响力8）
            console.log('P1 打出影响力8（审判官）');
            await playCard(setup.player1Page, 0);
            
            // 2. P2 打出傀儡师（影响力10）
            console.log('P2 打出影响力10（傀儡师）');
            await playCard(setup.player2Page, 0);
            
            // 3. 等待进入能力阶段（P1 失败）
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            // 4. P1 激活审判官能力（放置持续标记）
            const p1AbilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await p1AbilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('P1 激活审判官能力');
            await p1AbilityButton.click();
            await setup.player1Page.waitForTimeout(1000);
            
            // 5. 等待回合结束
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            // 6. 验证：审判官持续标记已放置
            const afterRound1 = await readCoreState(setup.player1Page);
            type OngoingAbility = { abilityId: string; playerId: string; cardId: string };
            const ongoingAbilities1 = afterRound1.ongoingAbilities as OngoingAbility[];
            
            const magistrateOngoing = ongoingAbilities1.find(
                a => a.abilityId === 'ability_i_magistrate'
            );
            
            console.log('回合1结束后:', {
                magistrateOngoingExists: !!magistrateOngoing,
                magistrateCardId: magistrateOngoing?.cardId,
            });
            
            expect(magistrateOngoing).toBeDefined();
            const magistrateCardId = magistrateOngoing!.cardId;
            
            console.log('✅ 回合1验证通过：审判官持续标记已放置');
            
            console.log('\n=== 回合2：审判官赢得平局并获得印戒 ===');
            
            // 7. P1 打出调停者（影响力4）
            console.log('P1 打出影响力4（调停者）');
            await playCard(setup.player1Page, 0);
            
            // 8. P2 打出调停者（影响力4）
            console.log('P2 打出影响力4（调停者）');
            await playCard(setup.player2Page, 0);
            
            // 9. 等待回合结束（原本平局，审判官能力让 P1 获胜，但平局不触发能力）
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            // 10. 验证：P1 调停者卡牌获得1枚印戒（赢得平局）
            const afterRound2 = await readCoreState(setup.player1Page);
            type PlayerState = { 
                playedCards: Array<{ uid: string; defId: string; baseInfluence: number; signets: number }>;
            };
            const playersAfterRound2 = afterRound2.players as Record<string, PlayerState>;
            
            const mediatorCard = playersAfterRound2['0'].playedCards.find(
                c => c.defId === 'deck_i_card_04'
            );
            
            console.log('回合2结束后:', {
                mediatorSignets: mediatorCard?.signets,
                mediatorCardUid: mediatorCard?.uid,
            });
            
            expect(mediatorCard).toBeDefined();
            expect(mediatorCard!.signets).toBe(1); // 调停者获得1枚印戒（审判官能力赢得平局）
            
            console.log('✅ 回合2验证通过：P1 调停者获得1枚印戒');
            
            console.log('\n=== 回合3：虚空法师移除审判官持续标记 ===');
            
            // 11. P1 打出钟表匠（影响力11）
            console.log('P1 打出影响力11（钟表匠）');
            await playCard(setup.player1Page, 0);
            
            // 12. P2 打出虚空法师（影响力2）
            console.log('P2 打出影响力2（虚空法师）');
            await playCard(setup.player2Page, 0);
            
            // 13. 等待进入能力阶段（P1 获胜，钟表匠不触发；P2 失败，虚空法师有能力）
            await waitForPhase(setup.player1Page, 'ability', 10000);
            
            // 14. P2 激活虚空法师能力（P2 失败）
            const voidMageButton = setup.player2Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await voidMageButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('P2 激活虚空法师能力');
            await voidMageButton.click();
            await setup.player2Page.waitForTimeout(2000);
            
            // 15. 等待卡牌选择弹窗出现
            console.log('等待卡牌选择弹窗...');
            const modal = setup.player2Page.locator('.fixed.inset-0.z-50').first();
            await modal.waitFor({ state: 'visible', timeout: 5000 });
            
            // 16. 查找审判官卡牌（通过 cardId）
            console.log('查找审判官卡牌，cardId:', magistrateCardId);
            const cardDivs = modal.locator('[data-testid^="card-"]');
            const cardCount = await cardDivs.count();
            console.log('找到的卡牌数量:', cardCount);
            
            // 找到审判官卡牌的按钮
            let magistrateButton = null;
            for (let i = 0; i < cardCount; i++) {
                const div = cardDivs.nth(i);
                const testId = await div.getAttribute('data-testid');
                console.log(`卡牌 ${i}: testId=${testId}`);
                
                // 检查是否是审判官卡牌
                if (testId && testId.includes(magistrateCardId)) {
                    const button = div.locator('xpath=ancestor::button[1]');
                    magistrateButton = button;
                    console.log(`找到审判官卡牌: 索引 ${i}`);
                    break;
                }
            }
            
            if (magistrateButton === null) {
                await setup.player2Page.screenshot({ 
                    path: 'test-results/card08-magistrate-not-found.png',
                    fullPage: true 
                });
                throw new Error('未找到审判官卡牌');
            }
            
            // 点击审判官卡牌
            await magistrateButton.click();
            await setup.player2Page.waitForTimeout(500);
            
            // 点击确认按钮
            const confirmButton = modal.locator('button').filter({ hasText: /Confirm|确认/ });
            await confirmButton.first().click({ timeout: 5000 });
            
            await modal.waitFor({ state: 'hidden', timeout: 5000 });
            
            // 17. 等待回合结束
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            // 18. 验证：审判官的持续标记已被移除
            const afterRound3 = await readCoreState(setup.player1Page);
            const ongoingAbilitiesAfterRound3 = afterRound3.ongoingAbilities as OngoingAbility[];
            
            const magistrateOngoingAfterRemoval = ongoingAbilitiesAfterRound3.find(
                a => a.abilityId === 'ability_i_magistrate'
            );
            
            console.log('回合3结束后:', {
                magistrateOngoingExists: !!magistrateOngoingAfterRemoval,
                ongoingAbilitiesCount: ongoingAbilitiesAfterRound3.length,
            });
            
            expect(magistrateOngoingAfterRemoval).toBeUndefined(); // 审判官持续标记已被移除
            
            // 19. 核心验证：P1 调停者卡牌的印戒应该被拿掉（从1枚变为0枚）
            const playersAfterRound3 = afterRound3.players as Record<string, PlayerState>;
            const mediatorCardAfterRemoval = playersAfterRound3['0'].playedCards.find(
                c => c.defId === 'deck_i_card_04'
            );
            
            console.log('P1 调停者卡牌状态:', {
                signets: mediatorCardAfterRemoval?.signets,
            });
            
            expect(mediatorCardAfterRemoval).toBeDefined();
            expect(mediatorCardAfterRemoval!.signets).toBe(0); // 印戒应该被拿掉
            
            console.log('✅ 回合3验证通过：P1 调停者的印戒被拿掉');
            console.log('✅ 所有断言通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
