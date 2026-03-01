import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    readLiveState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * Cardia 完整回合流程测试
 * 
 * 测试目标：验证完整的回合流程（阶段1 → 阶段2 → 自动回合结束）
 * 
 * 根据规则文档：
 * - 阶段1：打出卡牌 (play)
 * - 阶段2：激活能力 (ability)
 * - 阶段3：回合结束（自动执行，无需手动点击）
 *   - 双方抽牌
 *   - 检查胜利条件
 *   - 推进到下一回合
 */
test.describe('Cardia 完整回合流程', () => {
    
    /**
     * 场景1：基础回合流程（无能力）
     * 
     * 测试流程：
     * 1. 阶段1：双方打出卡牌
     * 2. 阶段2：影响力比较 → 判定胜负 → 印戒放置 → 跳过能力
     * 3. 阶段3：自动回合结束 → 双方抽牌 → 检查胜利条件 → 推进到下一回合
     */
    test('场景1：基础回合流程（无能力激活）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'], // 影响力1 + 备用
                deck: ['deck_i_card_03', 'deck_i_card_04'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_05', 'deck_i_card_06'], // 影响力5 + 备用
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景1：基础回合流程 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { hand: unknown[]; deck: unknown[]; playedCards: unknown[] };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1HandSize = players['0'].hand.length;
            const initialP2HandSize = players['1'].hand.length;
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            
            console.log('初始状态:', {
                p1Hand: initialP1HandSize,
                p2Hand: initialP2HandSize,
                p1Deck: initialP1DeckSize,
                p2Deck: initialP2DeckSize,
                phase: initialState.phase,
            });
            
            // ===== 阶段1：打出卡牌 =====
            console.log('\n--- 阶段1：打出卡牌 ---');
            
            // P1 打出影响力1
            console.log('P1 打出影响力1');
            await playCard(setup.player1Page, 0);
            
            // P2 打出影响力5
            console.log('P2 打出影响力5');
            await playCard(setup.player2Page, 0);
            
            // 验证阶段1
            const afterPlay = await readCoreState(setup.player1Page);
            const playersAfterPlay = afterPlay.players as Record<string, PlayerState>;
            
            console.log('阶段1验证:', {
                p1PlayedCards: playersAfterPlay['0'].playedCards.length,
                p2PlayedCards: playersAfterPlay['1'].playedCards.length,
                p1Hand: playersAfterPlay['0'].hand.length,
                p2Hand: playersAfterPlay['1'].hand.length,
                phase: afterPlay.phase,
            });
            
            // 验证：场上有牌
            expect(playersAfterPlay['0'].playedCards.length).toBe(1);
            expect(playersAfterPlay['1'].playedCards.length).toBe(1);
            
            // 验证：手牌减少
            expect(playersAfterPlay['0'].hand.length).toBe(initialP1HandSize - 1);
            expect(playersAfterPlay['1'].hand.length).toBe(initialP2HandSize - 1);
            
            // 验证：阶段推进到 ability
            expect(afterPlay.phase).toBe('ability');
            
            console.log('✅ 阶段1验证通过');
            
            // ===== 阶段2：激活能力 =====
            console.log('\n--- 阶段2：激活能力 ---');
            
            await waitForPhase(setup.player1Page, 'ability');
            
            const beforeAbility = await readCoreState(setup.player1Page);
            type CardWithInfluence = { baseInfluence: number; signets?: number };
            const playersBeforeAbility = beforeAbility.players as Record<string, { playedCards: CardWithInfluence[] }>;
            const p1Card = playersBeforeAbility['0'].playedCards[0];
            const p2Card = playersBeforeAbility['1'].playedCards[0];
            
            console.log('影响力比较:', {
                p1Influence: p1Card.baseInfluence,
                p2Influence: p2Card.baseInfluence,
                winner: p2Card.baseInfluence > p1Card.baseInfluence ? 'P2' : 'P1',
            });
            
            // 验证：P2获胜（影响力5 > 1）
            expect(p2Card.baseInfluence).toBeGreaterThan(p1Card.baseInfluence);
            
            // 验证：印戒放置在获胜者的牌上
            expect(p2Card.signets).toBe(1);
            expect(p1Card.signets || 0).toBe(0);
            
            console.log('✅ 阶段2验证通过（印戒放置正确）');
            
            // P1失败，跳过能力
            const skipButton = setup.player1Page.locator('[data-testid="cardia-skip-ability-btn"]');
            if (await skipButton.isVisible().catch(() => false)) {
                console.log('点击跳过能力');
                await skipButton.click();
            }
            
            await setup.player1Page.waitForTimeout(1000);
            
            // ===== 阶段3：回合结束 =====
            console.log('\n--- 阶段3：回合结束（自动执行）---');
            
            // 方案A：阶段2结束后自动执行回合结束逻辑
            // 无需手动点击按钮，直接等待阶段推进到下一回合的 play
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            const afterDraw = await readCoreState(setup.player1Page);
            const playersAfterDraw = afterDraw.players as Record<string, PlayerState & { playedCards: CardWithInfluence[] }>;
            
            console.log('阶段3验证:', {
                p1Hand: playersAfterDraw['0'].hand.length,
                p2Hand: playersAfterDraw['1'].hand.length,
                p1Deck: playersAfterDraw['0'].deck.length,
                p2Deck: playersAfterDraw['1'].deck.length,
                phase: afterDraw.phase,
            });
            
            // 验证：双方都抽了1张牌（手牌恢复）
            expect(playersAfterDraw['0'].hand.length).toBe(initialP1HandSize); // -1打出 +1抽牌
            expect(playersAfterDraw['1'].hand.length).toBe(initialP2HandSize);
            
            // 验证：牌库减少1张
            expect(playersAfterDraw['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfterDraw['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：胜利条件检查（P2有1个印戒，未达到5个）
            const p2TotalSignets = playersAfterDraw['1'].playedCards.reduce(
                (sum, c) => sum + (c.signets || 0), 0
            );
            expect(p2TotalSignets).toBe(1);
            expect(afterDraw.sys?.gameover).toBeUndefined(); // 未达到胜利条件
            
            // 验证：阶段推进到下一回合的 play
            expect(afterDraw.phase).toBe('play');
            
            console.log('✅ 阶段3验证通过');
            console.log('✅ 完整回合流程测试通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    /**
     * 场景2：即时能力回合流程
     * 
     * 测试流程：
     * 1. 阶段1：双方打出卡牌
     * 2. 阶段2：P1失败，激活雇佣剑士能力（弃掉双方的牌）
     * 3. 阶段3：自动回合结束 → 双方抽牌 → 推进到下一回合
     */
    test('场景2：即时能力回合流程（雇佣剑士）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 雇佣剑士（影响力1）
                deck: ['deck_i_card_02', 'deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_05'], // 破坏者（影响力5）
                deck: ['deck_i_card_06', 'deck_i_card_07'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景2：即时能力回合流程 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { hand: unknown[]; deck: unknown[]; discard: unknown[]; playedCards: unknown[] };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1HandSize = players['0'].hand.length;
            const initialP2HandSize = players['1'].hand.length;
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            const initialP1DiscardSize = players['0'].discard.length;
            const initialP2DiscardSize = players['1'].discard.length;
            
            console.log('初始状态:', {
                p1Hand: initialP1HandSize,
                p2Hand: initialP2HandSize,
                p1Deck: initialP1DeckSize,
                p2Deck: initialP2DeckSize,
                p1Discard: initialP1DiscardSize,
                p2Discard: initialP2DiscardSize,
                phase: initialState.phase,
            });
            
            // ===== 阶段1：打出卡牌 =====
            console.log('\n--- 阶段1：打出卡牌 ---');
            
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            const afterPlay = await readCoreState(setup.player1Page);
            const playersAfterPlay = afterPlay.players as Record<string, PlayerState>;
            
            expect(playersAfterPlay['0'].playedCards.length).toBe(1);
            expect(playersAfterPlay['1'].playedCards.length).toBe(1);
            expect(afterPlay.phase).toBe('ability');
            console.log('✅ 阶段1验证通过');
            
            // ===== 阶段2：激活能力 =====
            console.log('\n--- 阶段2：激活能力（雇佣剑士）---');
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // P1失败，激活雇佣剑士能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活雇佣剑士能力（弃掉双方的牌）');
            await abilityButton.click();
            
            // ===== 阶段3：自动回合结束 =====
            console.log('\n--- 阶段3：自动回合结束 ---');
            
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            const afterAbility = await readCoreState(setup.player1Page);
            const playersAfterAbility = afterAbility.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p1Hand: playersAfterAbility['0'].hand.length,
                p2Hand: playersAfterAbility['1'].hand.length,
                p1Deck: playersAfterAbility['0'].deck.length,
                p2Deck: playersAfterAbility['1'].deck.length,
                p1Discard: playersAfterAbility['0'].discard.length,
                p2Discard: playersAfterAbility['1'].discard.length,
                phase: afterAbility.phase,
            });
            
            // 验证：雇佣剑士能力（弃掉双方的牌）
            expect(playersAfterAbility['0'].discard.length).toBe(initialP1DiscardSize + 1); // P1的牌被弃
            expect(playersAfterAbility['1'].discard.length).toBe(initialP2DiscardSize + 1); // P2的牌被弃
            
            // 验证：双方抽牌
            expect(playersAfterAbility['0'].hand.length).toBe(initialP1HandSize); // -1打出 +1抽牌
            expect(playersAfterAbility['1'].hand.length).toBe(initialP2HandSize);
            
            // 验证：牌库减少
            expect(playersAfterAbility['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfterAbility['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：阶段推进
            expect(afterAbility.phase).toBe('play');
            
            console.log('✅ 场景2验证通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    /**
     * 场景3：持续能力回合流程
     * 
     * 测试流程：
     * 1. 阶段1：双方打出卡牌
     * 2. 阶段2：P1失败，激活调停者能力（强制平局，放置持续标记）
     * 3. 阶段3：自动回合结束 → 双方抽牌 → 推进到下一回合
     */
    test('场景3：持续能力回合流程（调停者）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04'], // 调停者（影响力4）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_08'], // 审判官（影响力8）
                deck: ['deck_i_card_09', 'deck_i_card_10'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景3：持续能力回合流程 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { hand: unknown[]; deck: unknown[]; playedCards: Array<{ uid: string; ongoingMarkers: string[] }> };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1HandSize = players['0'].hand.length;
            const initialP2HandSize = players['1'].hand.length;
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            
            console.log('初始状态:', {
                p1Hand: initialP1HandSize,
                p2Hand: initialP2HandSize,
                p1Deck: initialP1DeckSize,
                p2Deck: initialP2DeckSize,
                phase: initialState.phase,
            });
            
            // ===== 阶段1：打出卡牌 =====
            console.log('\n--- 阶段1：打出卡牌 ---');
            
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            const afterPlay = await readCoreState(setup.player1Page);
            expect(afterPlay.phase).toBe('ability');
            console.log('✅ 阶段1验证通过');
            
            // ===== 阶段2：激活能力 =====
            console.log('\n--- 阶段2：激活能力（调停者）---');
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // P1失败，激活调停者能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活调停者能力（强制平局）');
            await abilityButton.click();
            
            // ===== 阶段3：自动回合结束 =====
            console.log('\n--- 阶段3：自动回合结束 ---');
            
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            const afterAbility = await readCoreState(setup.player1Page);
            const playersAfterAbility = afterAbility.players as Record<string, PlayerState>;
            
            console.log('能力执行后:', {
                p1Hand: playersAfterAbility['0'].hand.length,
                p2Hand: playersAfterAbility['1'].hand.length,
                p1Deck: playersAfterAbility['0'].deck.length,
                p2Deck: playersAfterAbility['1'].deck.length,
                p1OngoingMarkers: playersAfterAbility['0'].playedCards[0]?.ongoingMarkers,
                phase: afterAbility.phase,
            });
            
            // 验证：持续标记放置
            const p1Card = playersAfterAbility['0'].playedCards[0];
            expect(p1Card.ongoingMarkers).toBeDefined();
            expect(p1Card.ongoingMarkers.length).toBeGreaterThan(0);
            expect(p1Card.ongoingMarkers).toContain('ability_i_mediator');
            
            // 验证：双方抽牌
            expect(playersAfterAbility['0'].hand.length).toBe(initialP1HandSize);
            expect(playersAfterAbility['1'].hand.length).toBe(initialP2HandSize);
            
            // 验证：牌库减少
            expect(playersAfterAbility['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfterAbility['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：阶段推进
            expect(afterAbility.phase).toBe('play');
            
            console.log('✅ 场景3验证通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    /**
     * 场景4：平局回合流程
     * 
     * 测试流程：
     * 1. 阶段1：双方打出相同影响力的卡牌
     * 2. 阶段2：判定平局 → 无印戒放置 → 跳过能力阶段
     * 3. 阶段3：自动回合结束 → 双方抽牌 → 推进到下一回合
     */
    test('场景4：平局回合流程', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_05'], // 破坏者（影响力5）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_05'], // 破坏者（影响力5，相同）
                deck: ['deck_i_card_06', 'deck_i_card_07'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景4：平局回合流程 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { hand: unknown[]; deck: unknown[]; playedCards: Array<{ signets: number }> };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1HandSize = players['0'].hand.length;
            const initialP2HandSize = players['1'].hand.length;
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            
            console.log('初始状态:', {
                p1Hand: initialP1HandSize,
                p2Hand: initialP2HandSize,
                p1Deck: initialP1DeckSize,
                p2Deck: initialP2DeckSize,
                phase: initialState.phase,
            });
            
            // ===== 阶段1：打出卡牌 =====
            console.log('\n--- 阶段1：打出卡牌（相同影响力）---');
            
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            // ===== 阶段2：平局判定 =====
            console.log('\n--- 阶段2：平局判定（跳过能力阶段）---');
            
            // 平局时应该直接跳过能力阶段，自动回合结束
            // 等待阶段推进到下一回合的 play
            await waitForPhase(setup.player1Page, 'play', 15000);
            
            const afterTie = await readCoreState(setup.player1Page);
            const playersAfterTie = afterTie.players as Record<string, PlayerState>;
            
            console.log('平局后:', {
                p1Hand: playersAfterTie['0'].hand.length,
                p2Hand: playersAfterTie['1'].hand.length,
                p1Deck: playersAfterTie['0'].deck.length,
                p2Deck: playersAfterTie['1'].deck.length,
                p1Signets: playersAfterTie['0'].playedCards[0]?.signets || 0,
                p2Signets: playersAfterTie['1'].playedCards[0]?.signets || 0,
                phase: afterTie.phase,
            });
            
            // 验证：无印戒放置
            expect(playersAfterTie['0'].playedCards[0].signets || 0).toBe(0);
            expect(playersAfterTie['1'].playedCards[0].signets || 0).toBe(0);
            
            // 验证：双方抽牌
            expect(playersAfterTie['0'].hand.length).toBe(initialP1HandSize);
            expect(playersAfterTie['1'].hand.length).toBe(initialP2HandSize);
            
            // 验证：牌库减少
            expect(playersAfterTie['0'].deck.length).toBe(initialP1DeckSize - 1);
            expect(playersAfterTie['1'].deck.length).toBe(initialP2DeckSize - 1);
            
            // 验证：阶段推进
            expect(afterTie.phase).toBe('play');
            
            console.log('✅ 场景4验证通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    /**
     * 场景5：牌库为空时的回合流程
     * 
     * 测试流程：
     * 1. 阶段1：双方打出卡牌（牌库已空）
     * 2. 阶段2：判定胜负 → 跳过能力
     * 3. 游戏结束：双方无牌可打，触发游戏结束
     */
    test('场景5：牌库为空时的回合流程', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: [], // 牌库为空
            },
            player2: {
                hand: ['deck_i_card_05'], // 影响力5
                deck: [], // 牌库为空
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景5：牌库为空时的回合流程 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { hand: unknown[]; deck: unknown[]; playedCards: unknown[] };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1HandSize = players['0'].hand.length;
            const initialP2HandSize = players['1'].hand.length;
            const initialP1DeckSize = players['0'].deck.length;
            const initialP2DeckSize = players['1'].deck.length;
            
            console.log('初始状态:', {
                p1Hand: initialP1HandSize,
                p2Hand: initialP2HandSize,
                p1Deck: initialP1DeckSize,
                p2Deck: initialP2DeckSize,
                phase: initialState.phase,
            });
            
            // ===== 阶段1：打出卡牌 =====
            console.log('\n--- 阶段1：打出卡牌 ---');
            
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            const afterPlay = await readCoreState(setup.player1Page);
            expect(afterPlay.phase).toBe('ability');
            console.log('✅ 阶段1验证通过');
            
            // ===== 阶段2：等待游戏结束 =====
            console.log('\n--- 阶段2：等待游戏结束（双方无牌可打）---');
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // 双方都无牌可打，游戏应该自动结束
            // 不需要点击跳过能力按钮，因为游戏会自动检测到无牌可打并结束
            
            // ===== 验证游戏结束 =====
            console.log('\n--- 验证游戏结束 ---');
            
            // 等待游戏结束弹窗出现（增加超时时间）
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            
            try {
                await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });
                console.log('✅ 游戏结束弹窗已出现');
            } catch (error) {
                console.log('❌ 游戏结束弹窗未出现，检查当前状态...');
                
                // 读取当前状态
                const currentState = await readLiveState(setup.player1Page);
                const currentPlayers = currentState.core.players as Record<string, PlayerState>;
                
                console.log('当前状态:', {
                    p1Hand: currentPlayers['0'].hand.length,
                    p2Hand: currentPlayers['1'].hand.length,
                    p1Deck: currentPlayers['0'].deck.length,
                    p2Deck: currentPlayers['1'].deck.length,
                    phase: currentState.core.phase,
                    gameover: currentState.sys?.gameover,
                });
                
                throw error;
            }
            
            // 读取最终状态（使用 readLiveState 获取实时状态）
            const finalState = await readLiveState(setup.player1Page);
            const finalPlayers = finalState.core.players as Record<string, PlayerState>;
            
            console.log('游戏结束后:', {
                p1Hand: finalPlayers['0'].hand.length,
                p2Hand: finalPlayers['1'].hand.length,
                p1Deck: finalPlayers['0'].deck.length,
                p2Deck: finalPlayers['1'].deck.length,
                gameover: finalState.sys?.gameover,
            });
            
            // 验证：游戏结束
            expect(finalState.sys?.gameover).toBeDefined();
            
            // 验证：P2获胜（双方都无牌可打，P2有1个印戒，P1有0个印戒）
            const gameover = finalState.sys?.gameover as { winner?: string; draw?: boolean } | undefined;
            expect(gameover?.winner).toBe('1'); // P2获胜（印戒总和：1 > 0）
            expect(gameover?.draw).toBeUndefined();
            
            console.log('✅ 场景5验证通过（P2因印戒优势获胜）');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    /**
     * 场景6：达到5印戒时的胜利流程
     * 
     * 测试流程：
     * 1. 阶段1：双方打出卡牌（P2已有4个印戒）
     * 2. 阶段2：P2获胜，获得第5个印戒 → 触发游戏胜利
     * 3. 验证：游戏结束，P2获胜
     */
    test('场景6：达到5印戒时的胜利流程', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: ['deck_i_card_02'],
                playedCards: [
                    { defId: 'deck_i_card_03', signets: 1 },
                ],
            },
            player2: {
                hand: ['deck_i_card_05'], // 影响力5
                deck: ['deck_i_card_06'],
                playedCards: [
                    { defId: 'deck_i_card_07', signets: 1 },
                    { defId: 'deck_i_card_08', signets: 1 },
                    { defId: 'deck_i_card_09', signets: 1 },
                    { defId: 'deck_i_card_10', signets: 1 },
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景6：达到5印戒时的胜利流程 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { playedCards: Array<{ signets: number }> };
            const players = initialState.players as Record<string, PlayerState>;
            
            const initialP1Signets = players['0'].playedCards.reduce(
                (sum, c) => sum + (c.signets || 0), 0
            );
            const initialP2Signets = players['1'].playedCards.reduce(
                (sum, c) => sum + (c.signets || 0), 0
            );
            
            console.log('初始状态:', {
                p1Signets: initialP1Signets,
                p2Signets: initialP2Signets,
                phase: initialState.phase,
            });
            
            // 验证初始印戒数量
            expect(initialP1Signets).toBe(1);
            expect(initialP2Signets).toBe(4);
            
            // ===== 阶段1：打出卡牌 =====
            console.log('\n--- 阶段1：打出卡牌 ---');
            
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            // ===== 验证游戏结束 =====
            console.log('\n--- 验证游戏结束（P2达到5印戒）---');
            
            // 等待游戏结束弹窗出现
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            await endgameOverlay.waitFor({ state: 'visible', timeout: 10000 });
            console.log('✅ 游戏结束弹窗已出现');
            
            // 读取最终状态（使用 readLiveState 获取实时状态）
            const finalState = await readLiveState(setup.player1Page);
            const finalPlayers = finalState.core.players as Record<string, PlayerState>;
            
            // 计算P2的总印戒数
            const p2TotalSignets = finalPlayers['1'].playedCards.reduce(
                (sum, c) => sum + (c.signets || 0), 0
            );
            
            console.log('游戏结束后:', {
                p2TotalSignets,
                gameover: finalState.sys?.gameover,
                p2PlayedCards: finalPlayers['1'].playedCards.length,
            });
            
            // 验证：P2达到5个印戒
            expect(p2TotalSignets).toBeGreaterThanOrEqual(5);
            
            // 验证：游戏结束
            expect(finalState.sys?.gameover).toBeDefined();
            
            // 验证：P2获胜
            const gameover = finalState.sys?.gameover as { winner?: string } | undefined;
            expect(gameover?.winner).toBe('1');
            
            console.log('✅ 场景6验证通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
