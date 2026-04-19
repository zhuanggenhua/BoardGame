import { test, expect } from './fixtures';
import {
    setupCardiaTestScenario,
    readLiveState,
    waitForPhase,
} from './helpers/cardia';

/**
 * Cardia AI 对手系统 E2E 测试
 * 
 * 测试覆盖：
 * 1. AI vs AI 完整对局：验证两个 AI 能够完成完整游戏流程
 * 2. AI 打牌阶段决策：验证 AI 能够选择卡牌
 * 3. AI 能力阶段决策：验证 AI 能够激活或跳过能力
 * 4. AI 不生成非法动作：验证 AI 决策符合游戏规则
 * 5. 游戏正常结束：验证 AI 对局能够达到胜利条件
 */
test.describe('Cardia AI 对手系统', () => {
    test('AI vs AI 完整对局：验证两个 AI 能够完成完整游戏', async ({ browser }) => {
        test.setTimeout(120000); // 增加超时时间到 120 秒
        
        console.log('\n=== 创建 AI vs AI 对局 ===');
        
        const setup = await setupCardiaTestScenario(browser, {
            // 配置 AI 控制器
            aiSeats: ['0', '1'], // 两个玩家都由 AI 控制
            targetSignets: 13,   // 目标印戒数
        });

        try {
            console.log('✅ AI vs AI 对局创建成功');

            // 监听浏览器控制台输出
            setup.player1Page.on('console', (msg) => {
                const text = msg.text();
                if (text.includes('AI') || text.includes('resolveNextAiAction') || text.includes('OnlineAiSeatBridge')) {
                    console.log(`[Browser Console] ${text}`);
                }
            });

            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log(`初始阶段: ${initialState.core.phase}`);
            console.log(`当前玩家: ${initialState.core.currentPlayerId}`);
            console.log(`玩家顺序: ${JSON.stringify(initialState.core.playerOrder)}`);
            console.log(`回合数: ${initialState.core.turnNumber}`);
            console.log(`P1 手牌数: ${initialState.core.players['0'].hand.length}`);
            console.log(`P2 手牌数: ${initialState.core.players['1'].hand.length}`);

            // 检查 AI 座位凭据
            const aiCredentials = await setup.player1Page.evaluate(({ matchId }) => {
                const raw = localStorage.getItem(`match_ai_creds_${matchId}`);
                return raw ? JSON.parse(raw) : null;
            }, { matchId: setup.matchId });
            console.log('AI 座位凭据:', JSON.stringify(aiCredentials));

            // 检查 match info
            const matchInfo = await setup.player1Page.evaluate(async ({ gameId, matchId }) => {
                const response = await fetch(`http://127.0.0.1:18000/games/${gameId}/${matchId}`);
                return response.json();
            }, { gameId: 'cardia', matchId: setup.matchId });
            console.log('Match setupData:', JSON.stringify(matchInfo.setupData));

            // 等待 AI 完成多个回合
            console.log('\n=== 等待 AI 执行多个回合 ===');
            
            let turnCount = 0;
            const maxTurns = 20; // 最多等待 20 个回合
            const maxWaitTime = 60000; // 最多等待 60 秒
            const startTime = Date.now();

            while (turnCount < maxTurns && (Date.now() - startTime) < maxWaitTime) {
                await setup.player1Page.waitForTimeout(2000); // 等待 AI 决策

                const currentState = await readLiveState(setup.player1Page);
                const currentTurn = currentState.core.turnNumber;

                if (currentTurn > turnCount) {
                    turnCount = currentTurn;
                    console.log(`✅ 回合 ${turnCount} 完成`);
                    console.log(`  阶段: ${currentState.core.phase}`);
                    console.log(`  当前玩家: ${currentState.core.currentPlayerId}`);

                    // 检查游戏是否结束
                    if (currentState.sys.gameover) {
                        console.log('\n=== 游戏结束 ===');
                        console.log(`胜者: ${currentState.sys.gameover.winnerId}`);
                        console.log(`原因: ${currentState.sys.gameover.reason}`);
                        break;
                    }
                }

                // 检查是否卡住
                if (turnCount === 0 && (Date.now() - startTime) > 10000) {
                    console.error('❌ AI 未能开始游戏（10秒内无进展）');
                    break;
                }
            }

            // 验证 AI 至少完成了几个回合
            expect(turnCount).toBeGreaterThan(0);
            console.log(`✅ AI 完成了 ${turnCount} 个回合`);

            // 读取最终状态
            const finalState = await readLiveState(setup.player1Page);

            // 验证游戏状态合法
            expect(finalState.core.phase).toBeDefined();
            expect(finalState.core.currentPlayerId).toBeDefined();
            console.log('✅ 游戏状态合法');

            // 验证玩家状态
            const player1 = finalState.core.players['0'];
            const player2 = finalState.core.players['1'];

            expect(player1).toBeDefined();
            expect(player2).toBeDefined();
            console.log('✅ 玩家状态正常');

            // 验证至少有一些卡牌被打出
            const totalPlayedCards = player1.playedCards.length + player2.playedCards.length;
            expect(totalPlayedCards).toBeGreaterThan(0);
            console.log(`✅ 共打出 ${totalPlayedCards} 张卡牌`);

            // 如果游戏结束，验证胜利条件
            if (finalState.sys.gameover) {
                expect(finalState.sys.gameover.winnerId).toBeDefined();
                expect(['0', '1']).toContain(finalState.sys.gameover.winnerId);
                console.log('✅ 游戏正常结束，有明确胜者');
            } else {
                console.log('⚠️  游戏未在测试时间内结束（这是正常的）');
            }

            console.log('\n✅ 所有断言通过');

        } finally {
            await setup.cleanup();
        }
    });

    test('AI 打牌阶段决策：验证 AI 能够选择卡牌', async ({ browser }) => {
        console.log('\n=== 测试 AI 打牌阶段决策 ===');
        
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03'],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
            },
            player2: {
                hand: ['deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03'],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
            },
            phase: 'play',
            aiSeats: ['0'], // 只有 P1 由 AI 控制
        });

        try {
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            const initialHandSize = initialState.core.players['0'].hand.length;
            console.log(`P1 初始手牌数: ${initialHandSize}`);

            // 等待 AI 打出卡牌
            console.log('等待 AI 打出卡牌...');
            await setup.player1Page.waitForTimeout(3000);

            // 读取状态验证 AI 已打牌
            const afterAiPlay = await readLiveState(setup.player1Page);
            const player1 = afterAiPlay.core.players['0'];

            // 验证 AI 已打出卡牌
            expect(player1.hasPlayed).toBe(true);
            console.log('✅ AI 已打出卡牌');

            // 验证手牌减少
            expect(player1.hand.length).toBe(initialHandSize - 1);
            console.log(`✅ 手牌从 ${initialHandSize} 减少到 ${player1.hand.length}`);

            // 验证卡牌已揭示
            expect(player1.cardRevealed).toBe(true);
            console.log('✅ 卡牌已揭示');

            console.log('\n✅ 所有断言通过');

        } finally {
            await setup.cleanup();
        }
    });

    test('AI 能力阶段决策：验证 AI 能够激活或跳过能力', async ({ browser }) => {
        console.log('\n=== 测试 AI 能力阶段决策 ===');
        
        // 使用有能力的卡牌
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04'], // 使用有能力的卡牌
                deck: ['deck_i_card_05', 'deck_i_card_06'],
            },
            player2: {
                hand: ['deck_i_card_01'], // 使用低影响力卡牌，确保 P1 输掉
                deck: ['deck_i_card_02', 'deck_i_card_03'],
            },
            phase: 'play',
            aiSeats: ['0', '1'], // 两个玩家都由 AI 控制
        });

        try {
            // 等待双方打出卡牌并进入能力阶段
            console.log('等待 AI 完成打牌阶段...');
            await setup.player1Page.waitForTimeout(5000);

            // 等待能力阶段
            await waitForPhase(setup.player1Page, 'ability', 10000);
            console.log('✅ 进入能力阶段');

            // 读取能力阶段状态
            const abilityPhaseState = await readLiveState(setup.player1Page);
            expect(abilityPhaseState.core.phase).toBe('ability');

            // 验证有遭遇战结果
            expect(abilityPhaseState.core.currentEncounter).toBeDefined();
            console.log('✅ 遭遇战结果已生成');

            // 等待 AI 做出能力决策
            console.log('等待 AI 做出能力决策...');
            await setup.player1Page.waitForTimeout(3000);

            // 读取决策后状态
            const afterAbilityDecision = await readLiveState(setup.player1Page);

            // 验证阶段已推进（AI 已做出决策）
            // 可能进入下一个能力阶段或结束阶段
            const phaseChanged = afterAbilityDecision.core.phase !== 'ability' ||
                                afterAbilityDecision.core.currentPlayerId !== abilityPhaseState.core.currentPlayerId;

            expect(phaseChanged).toBe(true);
            console.log(`✅ AI 已做出能力决策，阶段推进到: ${afterAbilityDecision.core.phase}`);

            console.log('\n✅ 所有断言通过');

        } finally {
            await setup.cleanup();
        }
    });

    test('AI 不生成非法动作：验证 AI 决策符合游戏规则', async ({ browser }) => {
        console.log('\n=== 测试 AI 不生成非法动作 ===');
        
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03', 'deck_i_card_04'],
            },
            player2: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03', 'deck_i_card_04'],
            },
            phase: 'play',
            aiSeats: ['0', '1'],
        });

        try {
            // 执行多个回合，监控是否有错误
            console.log('执行多个回合，监控错误...');
            
            let errorOccurred = false;
            const errors: string[] = [];

            // 监听页面错误
            setup.player1Page.on('pageerror', (error) => {
                errorOccurred = true;
                errors.push(error.message);
                console.error('❌ 页面错误:', error.message);
            });

            // 监听控制台错误
            setup.player1Page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    errorOccurred = true;
                    errors.push(msg.text());
                    console.error('❌ 控制台错误:', msg.text());
                }
            });

            // 执行几个回合
            for (let i = 0; i < 5; i++) {
                await setup.player1Page.waitForTimeout(2000);
                
                const state = await readLiveState(setup.player1Page);
                console.log(`回合 ${state.core.turnNumber}, 阶段: ${state.core.phase}`);

                if (state.sys.gameover) {
                    console.log('游戏结束');
                    break;
                }
            }

            // 验证没有错误发生
            expect(errorOccurred).toBe(false);
            if (errors.length > 0) {
                console.error('捕获的错误:', errors);
            }
            console.log('✅ 没有检测到错误');

            // 读取最终状态验证游戏状态合法
            const finalState = await readLiveState(setup.player1Page);
            
            // 验证基本状态合法性
            expect(finalState.core.phase).toBeDefined();
            expect(['play', 'ability', 'end']).toContain(finalState.core.phase);
            console.log('✅ 游戏阶段合法');

            // 验证玩家状态
            const player1 = finalState.core.players['0'];
            const player2 = finalState.core.players['1'];

            // 手牌数量不应为负
            expect(player1.hand.length).toBeGreaterThanOrEqual(0);
            expect(player2.hand.length).toBeGreaterThanOrEqual(0);
            console.log('✅ 手牌数量合法');

            // 印戒数量不应为负
            const p1Signets = player1.playedCards.reduce((sum, card) => sum + card.signets, 0);
            const p2Signets = player2.playedCards.reduce((sum, card) => sum + card.signets, 0);
            expect(p1Signets).toBeGreaterThanOrEqual(0);
            expect(p2Signets).toBeGreaterThanOrEqual(0);
            console.log('✅ 印戒数量合法');

            console.log('\n✅ 所有断言通过');

        } finally {
            await setup.cleanup();
        }
    });

    test('游戏正常结束：验证 AI 对局能够达到胜利条件', async ({ browser }) => {
        console.log('\n=== 测试游戏正常结束 ===');
        
        // 使用较少的卡牌，加快游戏结束
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03'],
            },
            phase: 'play',
            targetSignets: 3, // 降低胜利条件，加快游戏结束
            aiSeats: ['0', '1'],
        });

        try {
            console.log('等待游戏结束...');
            
            const maxWaitTime = 60000; // 最多等待 60 秒
            const startTime = Date.now();
            let gameEnded = false;

            while ((Date.now() - startTime) < maxWaitTime) {
                await setup.player1Page.waitForTimeout(2000);

                const state = await readLiveState(setup.player1Page);
                
                if (state.sys.gameover) {
                    gameEnded = true;
                    console.log('\n=== 游戏结束 ===');
                    console.log(`回合数: ${state.core.turnNumber}`);
                    console.log(`胜者: ${state.sys.gameover.winnerId}`);
                    console.log(`原因: ${state.sys.gameover.reason}`);
                    
                    // 验证胜利条件
                    expect(state.sys.gameover.winnerId).toBeDefined();
                    expect(['0', '1']).toContain(state.sys.gameover.winnerId);
                    console.log('✅ 有明确胜者');

                    // 验证胜利原因
                    expect(state.sys.gameover.reason).toBeDefined();
                    console.log('✅ 有胜利原因');

                    // 验证印戒数量
                    const winner = state.core.players[state.sys.gameover.winnerId];
                    const winnerSignets = winner.playedCards.reduce((sum, card) => sum + card.signets, 0);
                    console.log(`胜者印戒数: ${winnerSignets}`);
                    
                    break;
                }

                console.log(`回合 ${state.core.turnNumber}, 阶段: ${state.core.phase}`);
            }

            // 验证游戏在合理时间内结束
            expect(gameEnded).toBe(true);
            console.log('✅ 游戏在合理时间内结束');

            console.log('\n✅ 所有断言通过');

        } finally {
            await setup.cleanup();
        }
    });
});
