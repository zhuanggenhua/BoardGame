import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * 测试新的 setupCardiaTestScenario API
 * 
 * 这个测试验证新API是否能正确工作
 */
test.describe('Cardia 测试场景API验证', () => {
    test('基础场景：配置手牌和阶段', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'], // 雇佣剑士 + 虚空法师
                deck: ['deck_i_card_03', 'deck_i_card_04'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_03'], // 外科医生
                deck: ['deck_i_card_05', 'deck_i_card_06'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试新API：基础场景 ===');
            
            // 1. 验证初始状态
            const initialState = await readCoreState(setup.player1Page);
            
            console.log('初始状态:', {
                p1HandSize: (initialState.players as Record<string, { hand: unknown[] }>)['0'].hand.length,
                p2HandSize: (initialState.players as Record<string, { hand: unknown[] }>)['1'].hand.length,
                p1DeckSize: (initialState.players as Record<string, { deck: unknown[] }>)['0'].deck.length,
                p2DeckSize: (initialState.players as Record<string, { deck: unknown[] }>)['1'].deck.length,
                phase: initialState.phase,
            });
            
            // 验证手牌数量
            expect((initialState.players as Record<string, { hand: unknown[] }>)['0'].hand.length).toBe(2);
            expect((initialState.players as Record<string, { hand: unknown[] }>)['1'].hand.length).toBe(1);
            
            // 验证牌库数量
            expect((initialState.players as Record<string, { deck: unknown[] }>)['0'].deck.length).toBe(2);
            expect((initialState.players as Record<string, { deck: unknown[] }>)['1'].deck.length).toBe(2);
            
            // 验证阶段
            expect(initialState.phase).toBe('play');
            
            // 2. 测试打牌流程
            console.log('P1 打出第一张牌');
            await playCard(setup.player1Page, 0);
            
            console.log('P2 打出第一张牌');
            await playCard(setup.player2Page, 0);
            
            // 3. 等待进入能力阶段
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 4. 验证阶段推进
            const afterPlay = await readCoreState(setup.player1Page);
            expect(afterPlay.phase).toBe('ability');
            
            // 验证场上有牌
            expect((afterPlay.players as Record<string, { playedCards: unknown[] }>)['0'].playedCards.length).toBe(1);
            expect((afterPlay.players as Record<string, { playedCards: unknown[] }>)['1'].playedCards.length).toBe(1);
            
            console.log('✅ 新API测试通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('完整场景：配置已打出的牌和印戒', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'],
                playedCards: [
                    { defId: 'deck_i_card_02', seals: 1 }, // 之前的牌，有1个印戒
                    { defId: 'deck_i_card_03', seals: 2 }, // 之前的牌，有2个印戒
                ],
            },
            player2: {
                hand: ['deck_i_card_04'],
                playedCards: [
                    { defId: 'deck_i_card_05', seals: 1 },
                ],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试新API：完整场景 ===');
            
            // 验证已打出的牌
            const state = await readCoreState(setup.player1Page);
            const p1PlayedCards = (state.players as Record<string, { playedCards: Array<{ seals: number }> }>)['0'].playedCards;
            const p2PlayedCards = (state.players as Record<string, { playedCards: Array<{ seals: number }> }>)['1'].playedCards;
            
            console.log('已打出的牌:', {
                p1Count: p1PlayedCards.length,
                p2Count: p2PlayedCards.length,
                p1Seals: p1PlayedCards.map(c => c.seals),
                p2Seals: p2PlayedCards.map(c => c.seals),
            });
            
            // 验证场上牌数量
            expect(p1PlayedCards.length).toBe(2);
            expect(p2PlayedCards.length).toBe(1);
            
            // 验证印戒数量
            expect(p1PlayedCards[0].seals).toBe(1);
            expect(p1PlayedCards[1].seals).toBe(2);
            expect(p2PlayedCards[0].seals).toBe(1);
            
            // 验证总印戒数
            const p1TotalSeals = p1PlayedCards.reduce((sum, c) => sum + c.seals, 0);
            const p2TotalSeals = p2PlayedCards.reduce((sum, c) => sum + c.seals, 0);
            expect(p1TotalSeals).toBe(3);
            expect(p2TotalSeals).toBe(1);
            
            console.log('✅ 完整场景测试通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
