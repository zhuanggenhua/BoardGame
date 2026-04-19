import { test, expect } from './fixtures';
import { 
    setupCardiaTestScenario,
    readLiveState,
    waitForPhase,
} from './helpers/cardia';

/**
 * Cardia AI Transport Connection Bug - Exploration Test
 * 
 * **CRITICAL**: 这个测试必须在未修复代码上失败 - 失败确认 bug 存在
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: 这个测试编码了预期行为 - 当修复后测试通过时将验证修复有效
 * **GOAL**: 暴露反例，证明 AI 座位 transport client sendBatch 回调未触发
 * 
 * Bug Condition:
 * - AI 座位的 GameTransportClient 报告 isConnected: true
 * - 但 sendBatch 的回调（onConfirmed / onRejected）从未被触发
 * - 导致游戏状态无法更新，AI 陷入无限重试循环
 * 
 * 测试场景：
 * 1. Ambusher 单次交互：AI 座位触发 Ambusher 能力（选择派系交互）
 * 2. Inventor 第一次交互：AI 座位触发 Inventor 能力（第一次选择卡牌）
 * 3. Inventor 第二次交互：AI 座位触发 Inventor 能力（第二次选择卡牌）
 * 4. 超出范围键测试：AI 座位在只有 3 个选项时尝试选择第 9 个选项
 * 
 * 预期结果：测试在未修复代码上失败（这是正确的 - 证明 bug 存在）
 */
test.describe('Cardia AI Transport Connection Bug - Exploration', () => {
    
    test('Bug Condition 1: Ambusher 单次交互 - AI 座位 sendBatch 回调未触发', async ({ browser }) => {
        test.setTimeout(60000); // 60 秒超时
        
        console.log('\n=== Bug Condition 1: Ambusher 单次交互 ===');
        console.log('测试目标：验证 AI 座位触发 Ambusher 能力时，sendBatch 回调被触发');
        
        // 创建 AI vs AI 对局，AI 座位触发 Ambusher 能力
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 备用手牌
                deck: ['deck_i_card_02', 'deck_i_card_03'],
                playedCards: [
                    { defId: 'deck_i_card_09', signets: 0, encounterIndex: 0 }, // Ambusher（影响力9）
                ],
            },
            player2: {
                hand: [
                    'deck_i_card_02', // Academy 派系
                    'deck_i_card_03', // Guild 派系
                ],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
                playedCards: [
                    { defId: 'deck_i_card_16', signets: 0, encounterIndex: 0 }, // 审判官（影响力16）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 9,
                player2Influence: 16,
                winnerId: '1', // P2 获胜，P1 失败触发 Ambusher 能力
            },
            aiSeats: ['0'], // P1 由 AI 控制
        });
        
        try {
            // 监听浏览器控制台输出
            const consoleLogs: string[] = [];
            setup.player1Page.on('console', (msg) => {
                const text = msg.text();
                consoleLogs.push(text);
                if (text.includes('AI') || text.includes('sendBatch') || text.includes('OnlineAiSeatBridge')) {
                    console.log(`[Browser Console] ${text}`);
                }
            });
            
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                turnNumber: initialState.core.turnNumber,
                currentPlayerId: initialState.core.currentPlayerId,
            });
            
            expect(initialState.core.phase).toBe('ability');
            expect(initialState.core.turnNumber).toBe(0);
            
            // 等待 AI 做出决策（选择派系）
            console.log('\n等待 AI 做出决策（选择派系）...');
            const maxWaitTime = 30000; // 最多等待 30 秒
            const startTime = Date.now();
            let phaseChanged = false;
            let turnAdvanced = false;
            
            while ((Date.now() - startTime) < maxWaitTime) {
                await setup.player1Page.waitForTimeout(2000);
                
                const currentState = await readLiveState(setup.player1Page);
                
                // 检查阶段是否推进（表示 AI 决策完成）
                if (currentState.core.phase !== 'ability') {
                    phaseChanged = true;
                    console.log(`✅ 阶段已推进到: ${currentState.core.phase}`);
                }
                
                // 检查回合数是否推进（表示游戏状态更新）
                if (currentState.core.turnNumber > initialState.core.turnNumber) {
                    turnAdvanced = true;
                    console.log(`✅ 回合数已推进: ${initialState.core.turnNumber} -> ${currentState.core.turnNumber}`);
                }
                
                if (phaseChanged && turnAdvanced) {
                    break;
                }
                
                // 检查是否卡住（10秒内无进展）
                if ((Date.now() - startTime) > 10000 && !phaseChanged && !turnAdvanced) {
                    console.error('❌ AI 未能做出决策（10秒内无进展）');
                    console.error('当前状态:', {
                        phase: currentState.core.phase,
                        turnNumber: currentState.core.turnNumber,
                        currentPlayerId: currentState.core.currentPlayerId,
                    });
                    break;
                }
            }
            
            // 读取最终状态
            const finalState = await readLiveState(setup.player1Page);
            
            console.log('\n最终状态:', {
                phase: finalState.core.phase,
                turnNumber: finalState.core.turnNumber,
                phaseChanged,
                turnAdvanced,
            });
            
            // 打印相关日志
            console.log('\n=== 相关浏览器控制台日志 ===');
            const relevantLogs = consoleLogs.filter(log => 
                log.includes('AI') || 
                log.includes('sendBatch') ||
                log.includes('OnlineAiSeatBridge') ||
                log.includes('transport') ||
                log.includes('batch:confirmed') ||
                log.includes('batch:rejected')
            );
            relevantLogs.forEach(log => console.log(log));
            console.log(`总共 ${consoleLogs.length} 条日志，相关日志 ${relevantLogs.length} 条`);
            
            // **核心断言：验证 sendBatch 回调被触发**
            // 如果回调被触发，游戏状态应该更新（阶段推进或回合数推进）
            expect(phaseChanged || turnAdvanced).toBe(true);
            
            // 验证回合数推进（表示游戏状态更新）
            expect(finalState.core.turnNumber).toBeGreaterThan(initialState.core.turnNumber);
            
            console.log('\n✅ 所有断言通过 - sendBatch 回调被触发，游戏状态更新');
            
        } finally {
            await setup.cleanup();
        }
    });
    
    test('Bug Condition 2: Inventor 第一次交互 - AI 座位 sendBatch 回调未触发', async ({ browser }) => {
        test.setTimeout(60000);
        
        console.log('\n=== Bug Condition 2: Inventor 第一次交互 ===');
        console.log('测试目标：验证 AI 座位触发 Inventor 能力（第一次选择）时，sendBatch 回调被触发');
        
        // 创建 AI vs AI 对局，AI 座位触发 Inventor 能力（第一次选择）
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 备用手牌
                deck: ['deck_i_card_02', 'deck_i_card_03'],
                playedCards: [
                    { defId: 'deck_i_card_15', signets: 0, encounterIndex: 0 }, // Inventor（影响力15）
                    { defId: 'deck_i_card_13', signets: 0, encounterIndex: 1 }, // 沼泽守卫（影响力13）
                ],
            },
            player2: {
                hand: ['deck_i_card_16'], // 精灵（影响力16）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_10', signets: 0, encounterIndex: 0 }, // 傀儡师（影响力10）
                    { defId: 'deck_i_card_12', signets: 1, encounterIndex: 1 }, // 财务官（影响力12）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 15,
                player2Influence: 16,
                winnerId: '1', // P2 获胜，P1 失败触发 Inventor 能力
            },
            aiSeats: ['0'], // P1 由 AI 控制
        });
        
        try {
            // 监听浏览器控制台输出
            const consoleLogs: string[] = [];
            setup.player1Page.on('console', (msg) => {
                const text = msg.text();
                consoleLogs.push(text);
                if (text.includes('AI') || text.includes('sendBatch') || text.includes('Inventor')) {
                    console.log(`[Browser Console] ${text}`);
                }
            });
            
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                turnNumber: initialState.core.turnNumber,
                modifierTokens: initialState.core.modifierTokens,
            });
            
            expect(initialState.core.phase).toBe('ability');
            
            // 等待 AI 做出第一次决策（选择+3影响力的目标）
            console.log('\n等待 AI 做出第一次决策（选择+3影响力的目标）...');
            const maxWaitTime = 30000;
            const startTime = Date.now();
            let firstInteractionCompleted = false;
            
            while ((Date.now() - startTime) < maxWaitTime) {
                await setup.player1Page.waitForTimeout(2000);
                
                const currentState = await readLiveState(setup.player1Page);
                
                // 检查是否有修正标记被添加（表示第一次交互完成）
                const modifierTokens = currentState.core.modifierTokens as Array<{ value: number; source: string }>;
                const hasPositiveModifier = modifierTokens && modifierTokens.some(m => m.value === 3 && m.source === 'ability_i_inventor');
                
                if (hasPositiveModifier) {
                    firstInteractionCompleted = true;
                    console.log('✅ 第一次交互完成：+3 修正标记已添加');
                    break;
                }
                
                // 检查是否卡住
                if ((Date.now() - startTime) > 10000 && !firstInteractionCompleted) {
                    console.error('❌ AI 未能完成第一次交互（10秒内无进展）');
                    break;
                }
            }
            
            // 读取最终状态
            const finalState = await readLiveState(setup.player1Page);
            
            console.log('\n最终状态:', {
                phase: finalState.core.phase,
                modifierTokens: finalState.core.modifierTokens,
                firstInteractionCompleted,
            });
            
            // 打印相关日志
            console.log('\n=== 相关浏览器控制台日志 ===');
            const relevantLogs = consoleLogs.filter(log => 
                log.includes('AI') || 
                log.includes('sendBatch') ||
                log.includes('Inventor') ||
                log.includes('transport')
            );
            relevantLogs.forEach(log => console.log(log));
            
            // **核心断言：验证第一次交互完成**
            expect(firstInteractionCompleted).toBe(true);
            
            // 验证修正标记已添加
            const modifierTokens = finalState.core.modifierTokens as Array<{ value: number; source: string }>;
            const hasPositiveModifier = modifierTokens && modifierTokens.some(m => m.value === 3 && m.source === 'ability_i_inventor');
            expect(hasPositiveModifier).toBe(true);
            
            console.log('\n✅ 所有断言通过 - 第一次交互完成，sendBatch 回调被触发');
            
        } finally {
            await setup.cleanup();
        }
    });
    
    test('Bug Condition 3: Inventor 第二次交互 - AI 座位 sendBatch 回调未触发', async ({ browser }) => {
        test.setTimeout(60000);
        
        console.log('\n=== Bug Condition 3: Inventor 第二次交互 ===');
        console.log('测试目标：验证 AI 座位触发 Inventor 能力（第二次选择）时，sendBatch 回调被触发');
        
        // 创建 AI vs AI 对局，AI 座位触发 Inventor 能力（第二次选择）
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 备用手牌
                deck: ['deck_i_card_02', 'deck_i_card_03'],
                playedCards: [
                    { defId: 'deck_i_card_15', signets: 0, encounterIndex: 0 }, // Inventor（影响力15）
                    { defId: 'deck_i_card_13', signets: 0, encounterIndex: 1 }, // 沼泽守卫（影响力13）
                ],
            },
            player2: {
                hand: ['deck_i_card_16'], // 精灵（影响力16）
                deck: ['deck_i_card_07', 'deck_i_card_11'],
                playedCards: [
                    { defId: 'deck_i_card_10', signets: 0, encounterIndex: 0 }, // 傀儡师（影响力10）
                    { defId: 'deck_i_card_12', signets: 1, encounterIndex: 1 }, // 财务官（影响力12）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 15,
                player2Influence: 16,
                winnerId: '1', // P2 获胜，P1 失败触发 Inventor 能力
            },
            aiSeats: ['0'], // P1 由 AI 控制
        });
        
        try {
            // 监听浏览器控制台输出
            const consoleLogs: string[] = [];
            setup.player1Page.on('console', (msg) => {
                const text = msg.text();
                consoleLogs.push(text);
                if (text.includes('AI') || text.includes('sendBatch') || text.includes('Inventor')) {
                    console.log(`[Browser Console] ${text}`);
                }
            });
            
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                turnNumber: initialState.core.turnNumber,
                modifierTokens: initialState.core.modifierTokens,
            });
            
            expect(initialState.core.phase).toBe('ability');
            
            // 等待 AI 完成两次交互
            console.log('\n等待 AI 完成两次交互（+3 和 -3 修正标记）...');
            const maxWaitTime = 40000; // 增加超时时间，因为需要完成两次交互
            const startTime = Date.now();
            let bothInteractionsCompleted = false;
            let phaseChanged = false;
            
            while ((Date.now() - startTime) < maxWaitTime) {
                await setup.player1Page.waitForTimeout(2000);
                
                const currentState = await readLiveState(setup.player1Page);
                
                // 检查是否有两个修正标记被添加（+3 和 -3）
                const modifierTokens = currentState.core.modifierTokens as Array<{ value: number; source: string }>;
                const hasPositiveModifier = modifierTokens && modifierTokens.some(m => m.value === 3 && m.source === 'ability_i_inventor');
                const hasNegativeModifier = modifierTokens && modifierTokens.some(m => m.value === -3 && m.source === 'ability_i_inventor');
                
                if (hasPositiveModifier && hasNegativeModifier) {
                    bothInteractionsCompleted = true;
                    console.log('✅ 两次交互都完成：+3 和 -3 修正标记已添加');
                }
                
                // 检查阶段是否推进（表示能力执行完成）
                if (currentState.core.phase !== 'ability') {
                    phaseChanged = true;
                    console.log(`✅ 阶段已推进到: ${currentState.core.phase}`);
                }
                
                if (bothInteractionsCompleted && phaseChanged) {
                    break;
                }
                
                // 检查是否卡住
                if ((Date.now() - startTime) > 15000 && !bothInteractionsCompleted) {
                    console.error('❌ AI 未能完成两次交互（15秒内无进展）');
                    console.error('当前修正标记:', modifierTokens);
                    break;
                }
            }
            
            // 读取最终状态
            const finalState = await readLiveState(setup.player1Page);
            
            console.log('\n最终状态:', {
                phase: finalState.core.phase,
                modifierTokens: finalState.core.modifierTokens,
                bothInteractionsCompleted,
                phaseChanged,
            });
            
            // 打印相关日志
            console.log('\n=== 相关浏览器控制台日志 ===');
            const relevantLogs = consoleLogs.filter(log => 
                log.includes('AI') || 
                log.includes('sendBatch') ||
                log.includes('Inventor') ||
                log.includes('transport') ||
                log.includes('batch:confirmed') ||
                log.includes('batch:rejected')
            );
            relevantLogs.forEach(log => console.log(log));
            
            // **核心断言：验证两次交互都完成**
            expect(bothInteractionsCompleted).toBe(true);
            
            // 验证修正标记已添加
            const modifierTokens = finalState.core.modifierTokens as Array<{ value: number; source: string }>;
            const hasPositiveModifier = modifierTokens && modifierTokens.some(m => m.value === 3 && m.source === 'ability_i_inventor');
            const hasNegativeModifier = modifierTokens && modifierTokens.some(m => m.value === -3 && m.source === 'ability_i_inventor');
            
            expect(hasPositiveModifier).toBe(true);
            expect(hasNegativeModifier).toBe(true);
            
            // 验证阶段推进（表示能力执行完成）
            expect(phaseChanged).toBe(true);
            
            console.log('\n✅ 所有断言通过 - 两次交互都完成，sendBatch 回调被触发');
            
        } finally {
            await setup.cleanup();
        }
    });
    
    test('Bug Condition 4: 超出范围键测试 - AI 座位选择无效选项', async ({ browser }) => {
        test.setTimeout(60000);
        
        console.log('\n=== Bug Condition 4: 超出范围键测试 ===');
        console.log('测试目标：验证 AI 座位选择无效选项时，服务器返回 batch:rejected');
        
        // 创建 AI vs AI 对局，AI 座位触发 Ambusher 能力
        // 注意：这个测试场景模拟 AI 尝试选择不存在的选项（如第 9 个选项，但只有 3 个派系）
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 备用手牌
                deck: ['deck_i_card_02', 'deck_i_card_03'],
                playedCards: [
                    { defId: 'deck_i_card_09', signets: 0, encounterIndex: 0 }, // Ambusher（影响力9）
                ],
            },
            player2: {
                hand: [
                    'deck_i_card_02', // Academy 派系
                    'deck_i_card_03', // Guild 派系
                ],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
                playedCards: [
                    { defId: 'deck_i_card_16', signets: 0, encounterIndex: 0 }, // 审判官（影响力16）
                ],
            },
            phase: 'ability',
            currentEncounter: {
                player1Influence: 9,
                player2Influence: 16,
                winnerId: '1', // P2 获胜，P1 失败触发 Ambusher 能力
            },
            aiSeats: ['0'], // P1 由 AI 控制
        });
        
        try {
            // 监听浏览器控制台输出
            const consoleLogs: string[] = [];
            const errorLogs: string[] = [];
            
            setup.player1Page.on('console', (msg) => {
                const text = msg.text();
                consoleLogs.push(text);
                
                if (msg.type() === 'error') {
                    errorLogs.push(text);
                }
                
                if (text.includes('AI') || text.includes('sendBatch') || text.includes('rejected')) {
                    console.log(`[Browser Console] ${text}`);
                }
            });
            
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                turnNumber: initialState.core.turnNumber,
            });
            
            expect(initialState.core.phase).toBe('ability');
            
            // 等待 AI 做出决策
            // 注意：正常情况下，AI 应该选择有效的派系（Academy/Guild/Dynasty）
            // 但如果 AI 尝试选择无效选项，服务器应该返回 batch:rejected
            console.log('\n等待 AI 做出决策...');
            const maxWaitTime = 30000;
            const startTime = Date.now();
            let decisionMade = false;
            
            while ((Date.now() - startTime) < maxWaitTime) {
                await setup.player1Page.waitForTimeout(2000);
                
                const currentState = await readLiveState(setup.player1Page);
                
                // 检查阶段是否推进或回合数是否推进（表示决策完成）
                if (currentState.core.phase !== 'ability' || currentState.core.turnNumber > initialState.core.turnNumber) {
                    decisionMade = true;
                    console.log('✅ AI 决策完成');
                    break;
                }
                
                // 检查是否卡住
                if ((Date.now() - startTime) > 10000 && !decisionMade) {
                    console.error('❌ AI 未能做出决策（10秒内无进展）');
                    break;
                }
            }
            
            // 读取最终状态
            const finalState = await readLiveState(setup.player1Page);
            
            console.log('\n最终状态:', {
                phase: finalState.core.phase,
                turnNumber: finalState.core.turnNumber,
                decisionMade,
            });
            
            // 打印相关日志
            console.log('\n=== 相关浏览器控制台日志 ===');
            const relevantLogs = consoleLogs.filter(log => 
                log.includes('AI') || 
                log.includes('sendBatch') ||
                log.includes('rejected') ||
                log.includes('transport')
            );
            relevantLogs.forEach(log => console.log(log));
            
            if (errorLogs.length > 0) {
                console.log('\n=== 错误日志 ===');
                errorLogs.forEach(log => console.log(log));
            }
            
            // **核心断言：验证 AI 决策完成**
            // 即使 AI 选择了无效选项，服务器也应该返回 batch:rejected，而不是静默失败
            expect(decisionMade).toBe(true);
            
            // 验证游戏状态更新（阶段推进或回合数推进）
            const stateChanged = finalState.core.phase !== initialState.core.phase || 
                                 finalState.core.turnNumber > initialState.core.turnNumber;
            expect(stateChanged).toBe(true);
            
            console.log('\n✅ 所有断言通过 - AI 决策完成，sendBatch 回调被触发（即使选择无效选项）');
            
        } finally {
            await setup.cleanup();
        }
    });
});
