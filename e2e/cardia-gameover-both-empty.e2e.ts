/**
 * Cardia 游戏结束测试：双方都无牌可打的场景
 * 
 * 测试规则：
 * - 如果阶段1双方都无法打出牌 → 印戒总和多者获胜
 * - 如果印戒总和相同 → 游戏平局
 */

import { test, expect } from '@playwright/test';
import { setupCardiaTestScenario, readLiveState, playCard, waitForPhase } from './helpers/cardia';

test.describe('Cardia 游戏结束：双方都无牌可打', () => {
    
    test('场景1：双方都无牌，P2印戒多（1 > 0）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: [],
            },
            player2: {
                hand: ['deck_i_card_05'], // 影响力5
                deck: [],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景1：双方都无牌，P2印戒多 ===');
            
            // 打出卡牌
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // 等待游戏结束
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });
            
            // 验证结果
            const finalState = await readLiveState(setup.player1Page);
            const gameover = finalState.sys?.gameover as { winner?: string; draw?: boolean } | undefined;
            
            expect(gameover?.winner).toBe('1'); // P2获胜（印戒：1 > 0）
            expect(gameover?.draw).toBeUndefined();
            
            console.log('✅ P2因印戒优势获胜');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('场景2：双方都无牌，印戒相同（2 = 2）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 1 },
                    { defId: 'deck_i_card_03', signets: 1 },
                ],
            },
            player2: {
                hand: ['deck_i_card_05'], // 影响力5
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_06', signets: 1 },
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景2：双方都无牌，印戒相同（2 = 2）===');
            
            // 打出卡牌
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // 等待游戏结束
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });
            
            // 验证结果
            const finalState = await readLiveState(setup.player1Page);
            const gameover = finalState.sys?.gameover as { winner?: string; draw?: boolean } | undefined;
            
            // P1初始有2个印戒，P2初始有1个印戒
            // 这回合P2获胜得1个印戒（总共2个）
            // P1失败不得印戒（总共2个）
            // 印戒相同，应该是平局
            expect(gameover?.draw).toBe(true);
            expect(gameover?.winner).toBeUndefined();
            
            console.log('✅ 游戏平局（印戒相同：2 = 2）');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('场景2B：双方都无牌，P1印戒多（3 > 1）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 2 },
                    { defId: 'deck_i_card_03', signets: 1 },
                ],
            },
            player2: {
                hand: ['deck_i_card_05'], // 影响力5
                deck: [],
                playedCards: [],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景2B：双方都无牌，P1印戒多（3 > 1）===');
            
            // 打出卡牌
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // 等待游戏结束
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });
            
            // 验证结果
            const finalState = await readLiveState(setup.player1Page);
            const gameover = finalState.sys?.gameover as { winner?: string; draw?: boolean } | undefined;
            
            // P1初始有3个印戒，P2初始有0个印戒
            // 这回合P2获胜得1个印戒（总共1个）
            // P1失败不得印戒（总共3个）
            // P1印戒多，P1获胜
            expect(gameover?.winner).toBe('0');
            expect(gameover?.draw).toBeUndefined();
            
            console.log('✅ P1因印戒优势获胜（3 > 1）');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('场景3：双方都无牌，印戒相同（都是0）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: [],
            },
            player2: {
                hand: ['deck_i_card_01'], // 影响力1（平局）
                deck: [],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景3：双方都无牌，印戒相同（都是0）===');
            
            // 打出卡牌
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            // 平局时跳过能力阶段，直接进入回合结束
            // 但双方都无牌可打，游戏应该立即结束
            
            // 等待游戏结束
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });
            
            // 验证结果
            const finalState = await readLiveState(setup.player1Page);
            const gameover = finalState.sys?.gameover as { winner?: string; draw?: boolean } | undefined;
            
            console.log('游戏结束状态:', gameover);
            
            // 双方影响力相同（1 = 1），平局，都不得印戒
            // 双方都无牌可打，印戒总和都是0
            // 应该判定为平局
            expect(gameover?.draw).toBe(true);
            expect(gameover?.winner).toBeUndefined();
            
            console.log('✅ 游戏平局（印戒相同）');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('场景4：双方都无牌，印戒相同（都是2）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 1 },
                    { defId: 'deck_i_card_03', signets: 1 },
                ],
            },
            player2: {
                hand: ['deck_i_card_05'], // 影响力5
                deck: [],
                playedCards: [
                    { defId: 'deck_i_card_06', signets: 1 },
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景4：双方都无牌，印戒相同（都是2）===');
            
            // 打出卡牌
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // 等待游戏结束
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });
            
            // 验证结果
            const finalState = await readLiveState(setup.player1Page);
            const gameover = finalState.sys?.gameover as { winner?: string; draw?: boolean } | undefined;
            
            // P1初始有2个印戒，P2初始有1个印戒
            // 这回合P2获胜得1个印戒（总共2个）
            // P1失败不得印戒（总共2个）
            // 印戒相同，应该是平局
            expect(gameover?.draw).toBe(true);
            expect(gameover?.winner).toBeUndefined();
            
            console.log('✅ 游戏平局（印戒相同：2 = 2）');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('场景5：只有P1无牌，P2有牌', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: [], // P1无牌
            },
            player2: {
                hand: ['deck_i_card_05'], // 影响力5
                deck: ['deck_i_card_06', 'deck_i_card_07'], // P2还有牌
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 场景5：只有P1无牌，P2有牌 ===');
            
            // 打出卡牌
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            await waitForPhase(setup.player1Page, 'ability');
            
            // 等待游戏结束
            const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
            await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });
            
            // 验证结果
            const finalState = await readLiveState(setup.player1Page);
            const gameover = finalState.sys?.gameover as { winner?: string; draw?: boolean } | undefined;
            
            // P1无牌可打，P2获胜
            expect(gameover?.winner).toBe('1');
            expect(gameover?.draw).toBeUndefined();
            
            console.log('✅ P2获胜（P1无牌可打）');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
});
