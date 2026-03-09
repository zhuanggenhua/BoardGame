import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * Cardia 游戏结束检测调试测试
 * 
 * 目标：调试场景5和场景6的游戏结束检测问题
 */
test.describe('Cardia 游戏结束检测调试', () => {
    
    /**
     * 调试场景6：达到5印戒时的胜利流程
     * 
     * 简化版本：只验证印戒放置和游戏结束检测
     */
    test('调试：达到5印戒时的胜利流程', async ({ browser }) => {
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
            console.log('\n=== 调试：达到5印戒时的胜利流程 ===');
            
            // 监听浏览器控制台日志
            setup.player1Page.on('console', msg => {
                const text = msg.text();
                if (text.includes('[Cardia]') || text.includes('[Pipeline]')) {
                    console.log('[Browser Console]', text);
                }
            });
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { playedCards: Array<{ signets: number; defId: string }> };
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
                p1PlayedCards: players['0'].playedCards.length,
                p2PlayedCards: players['1'].playedCards.length,
                phase: initialState.phase,
                targetSignets: initialState.targetSignets,
            });
            
            // 验证初始印戒数量
            expect(initialP1Signets).toBe(1);
            expect(initialP2Signets).toBe(4);
            
            // ===== 打出卡牌 =====
            console.log('\n--- 打出卡牌 ---');
            
            await playCard(setup.player1Page, 0);
            console.log('P1 打出卡牌');
            
            await setup.player1Page.waitForTimeout(500);
            
            await playCard(setup.player2Page, 0);
            console.log('P2 打出卡牌');
            
            // ===== 等待游戏结束弹窗 =====
            console.log('\n--- 等待游戏结束弹窗 ---');
            
            // 等待 endgame overlay 出现
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            
            try {
                await endgameOverlay.waitFor({ state: 'visible', timeout: 10000 });
                console.log('✅ 游戏结束弹窗已出现');
                
                // 读取最终状态（直接从 window.__BG_STATE__）
                const finalState = await setup.player1Page.evaluate(() => {
                    const state = (window as any).__BG_STATE__;
                    return state ? JSON.parse(JSON.stringify(state)) : null;
                });
                
                if (finalState) {
                    type PlayerState = { playedCards: Array<{ signets: number; defId: string }> };
                    const finalPlayers = finalState.core.players as Record<string, PlayerState>;
                    
                    const finalP2Signets = finalPlayers['1'].playedCards.reduce(
                        (sum: number, c: any) => sum + (c.signets || 0), 0
                    );
                    
                    console.log('最终状态:', {
                        p2Signets: finalP2Signets,
                        phase: finalState.core.phase,
                        gameover: finalState.sys?.gameover,
                    });
                    
                    // 验证 sys.gameover 已定义
                    if (finalState.sys?.gameover) {
                        console.log('✅ sys.gameover 已定义:', finalState.sys.gameover);
                    } else {
                        console.log('❌ sys.gameover 仍然未定义');
                    }
                } else {
                    console.log('❌ 无法读取 window.__BG_STATE__');
                }
                
            } catch (error) {
                console.log('❌ 游戏结束弹窗未出现（超时10秒）');
                
                // 读取当前状态
                const currentState = await readCoreState(setup.player1Page);
                const currentPlayers = currentState.players as Record<string, PlayerState>;
                
                const currentP2Signets = currentPlayers['1'].playedCards.reduce(
                    (sum, c) => sum + (c.signets || 0), 0
                );
                
                console.log('当前状态:', {
                    p2Signets: currentP2Signets,
                    phase: currentState.phase,
                    gameover: currentState.sys?.gameover,
                });
                
                // 手动检查游戏结束条件
                const manualCheck = await setup.player1Page.evaluate(() => {
                    const state = (window as any).__BG_STATE__;
                    if (!state) return { error: 'No state found' };
                    
                    const core = state.core;
                    const targetSignets = core.targetSignets || 5;
                    
                    const signetsCount: Record<string, number> = {};
                    for (const playerId of core.playerOrder) {
                        const player = core.players[playerId];
                        signetsCount[playerId] = player.playedCards.reduce(
                            (sum: number, card: any) => sum + (card.signets || 0), 0
                        );
                    }
                    
                    const playersWithEnoughSignets = core.playerOrder.filter(
                        (pid: string) => signetsCount[pid] >= targetSignets
                    );
                    
                    return {
                        signetsCount,
                        targetSignets,
                        playersWithEnoughSignets,
                        shouldGameOver: playersWithEnoughSignets.length > 0,
                    };
                });
                
                console.log('手动游戏结束检查:', manualCheck);
            }
            
            console.log('\n测试完成');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    /**
     * 调试场景5：牌库为空时的回合流程
     * 
     * 简化版本：只验证牌库为空时的行为
     */
    test('调试：牌库为空时的回合流程', async ({ browser }) => {
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
            console.log('\n=== 调试：牌库为空时的回合流程 ===');
            
            // 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            type PlayerState = { hand: unknown[]; deck: unknown[]; playedCards: unknown[] };
            const players = initialState.players as Record<string, PlayerState>;
            
            console.log('初始状态:', {
                p1Hand: players['0'].hand.length,
                p2Hand: players['1'].hand.length,
                p1Deck: players['0'].deck.length,
                p2Deck: players['1'].deck.length,
                phase: initialState.phase,
            });
            
            // ===== 打出卡牌 =====
            console.log('\n--- 打出卡牌 ---');
            
            await playCard(setup.player1Page, 0);
            console.log('P1 打出卡牌');
            
            await setup.player1Page.waitForTimeout(500);
            
            await playCard(setup.player2Page, 0);
            console.log('P2 打出卡牌');
            
            // ===== 等待遭遇战解析 =====
            console.log('\n--- 等待遭遇战解析 ---');
            await setup.player1Page.waitForTimeout(2000);
            
            const afterEncounter = await readCoreState(setup.player1Page);
            console.log('遭遇战解析后:', {
                phase: afterEncounter.phase,
                gameover: afterEncounter.sys?.gameover,
            });
            
            // ===== 检查是否应该触发游戏结束 =====
            console.log('\n--- 检查游戏结束条件 ---');
            
            const playersAfterEncounter = afterEncounter.players as Record<string, PlayerState>;
            const p1CanPlay = playersAfterEncounter['0'].hand.length > 0 || playersAfterEncounter['0'].deck.length > 0;
            const p2CanPlay = playersAfterEncounter['1'].hand.length > 0 || playersAfterEncounter['1'].deck.length > 0;
            
            console.log('玩家状态:', {
                p1Hand: playersAfterEncounter['0'].hand.length,
                p1Deck: playersAfterEncounter['0'].deck.length,
                p1CanPlay,
                p2Hand: playersAfterEncounter['1'].hand.length,
                p2Deck: playersAfterEncounter['1'].deck.length,
                p2CanPlay,
            });
            
            if (!p1CanPlay) {
                console.log('⚠️ P1无法打出卡牌（手牌和牌库都为空），应该触发游戏结束');
            }
            if (!p2CanPlay) {
                console.log('⚠️ P2无法打出卡牌（手牌和牌库都为空），应该触发游戏结束');
            }
            
            // ===== 尝试跳过能力 =====
            console.log('\n--- 尝试跳过能力 ---');
            
            if (afterEncounter.phase === 'ability') {
                console.log('当前在 ability 阶段，尝试跳过能力');
                
                const skipButton = setup.player1Page.locator('[data-testid="cardia-skip-ability-btn"]');
                const isVisible = await skipButton.isVisible().catch(() => false);
                
                if (isVisible) {
                    console.log('找到跳过能力按钮，点击');
                    await skipButton.click();
                    await setup.player1Page.waitForTimeout(2000);
                    
                    const afterSkip = await readCoreState(setup.player1Page);
                    console.log('跳过能力后:', {
                        phase: afterSkip.phase,
                        gameover: afterSkip.sys?.gameover,
                    });
                } else {
                    console.log('❌ 未找到跳过能力按钮');
                }
            } else {
                console.log(`当前不在 ability 阶段（phase=${afterEncounter.phase}）`);
            }
            
            // ===== 等待更长时间 =====
            console.log('\n--- 等待更长时间（5秒）---');
            await setup.player1Page.waitForTimeout(5000);
            
            const afterWait = await readCoreState(setup.player1Page);
            console.log('等待5秒后:', {
                phase: afterWait.phase,
                gameover: afterWait.sys?.gameover,
            });
            
            // ===== 最终断言 =====
            console.log('\n--- 最终断言 ---');
            
            // 暂时不做断言，只输出信息
            console.log('测试完成，请查看上面的日志');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    /**
     * 简化测试：只打出一张卡牌，检查状态
     */
    test('简化：打出一张卡牌后的状态', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'],
                deck: ['deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_05'],
                deck: ['deck_i_card_06'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 简化：打出一张卡牌后的状态 ===');
            
            // 打出卡牌
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);
            await playCard(setup.player2Page, 0);
            
            // 等待遭遇战解析
            await setup.player1Page.waitForTimeout(2000);
            
            // 读取状态
            const state = await readCoreState(setup.player1Page);
            
            console.log('状态:', {
                phase: state.phase,
                gameover: state.sys?.gameover,
                gameWonBy: state.gameWonBy,
                targetSignets: state.targetSignets,
            });
            
            console.log('测试完成');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
