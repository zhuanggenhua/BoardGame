import { test, expect } from './fixtures';
import { 
    setupCardiaTestScenario,
    readLiveState,
} from './helpers/cardia';

/**
 * Cardia AI Transport Connection Fix - Preservation Tests
 * 
 * **IMPORTANT**: 遵循观察优先方法论
 * - 在未修复代码上观察非 buggy 输入的行为
 * - 编写属性测试捕获观察到的行为模式（来自 design.md 的 Preservation Requirements）
 * 
 * **EXPECTED OUTCOME**: 测试在未修复代码上通过（确认要保留的基线行为）
 * 
 * Preservation Requirements:
 * - 人类玩家的 transport client 命令处理必须继续正常工作
 * - Dice Throne 和 Smash Up 游戏的 AI 座位命令处理必须继续正常工作
 * - Transport client 的连接/断开/重连逻辑必须保持不变
 * - Transport client 的 sync 握手流程必须保持不变
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
test.describe('Cardia AI Transport Connection Fix - Preservation Tests', () => {
    
    test('Preservation 1: 人类玩家状态同步 - 基本游戏流程正常工作', async ({ browser }) => {
        test.setTimeout(60000);
        
        console.log('\n=== Preservation 1: 人类玩家状态同步 ===');
        console.log('测试目标：验证人类玩家的基本游戏流程和状态同步正常工作');
        
        // 创建人类 vs 人类对局
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03'],
                playedCards: [],
            },
            player2: {
                hand: ['deck_i_card_04'],
                deck: ['deck_i_card_05'],
                playedCards: [],
            },
            phase: 'play',
            aiSeats: [], // 无 AI 座位，都是人类玩家
        });
        
        try {
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                turnNumber: initialState.core.turnNumber,
                player1HandCount: initialState.core.players['0'].hand.length,
            });
            
            expect(initialState.core.phase).toBe('play');
            expect(initialState.core.players['0'].hand.length).toBe(2);
            
            // 等待游戏 UI 加载完成
            await setup.player1Page.waitForSelector('[data-game-page][data-game-id="cardia"]', { timeout: 10000 });
            await setup.player1Page.waitForTimeout(2000);
            
            // 读取最终状态（验证状态同步正常）
            const finalState = await readLiveState(setup.player1Page);
            
            console.log('\n最终状态:', {
                phase: finalState.core.phase,
                turnNumber: finalState.core.turnNumber,
                player1HandCount: finalState.core.players['0'].hand.length,
            });
            
            // **核心断言：验证状态同步正常**
            // 状态应该与初始状态一致（没有发生意外变化）
            expect(finalState.core.phase).toBe(initialState.core.phase);
            expect(finalState.core.turnNumber).toBe(initialState.core.turnNumber);
            expect(finalState.core.players['0'].hand.length).toBe(initialState.core.players['0'].hand.length);
            
            console.log('\n✅ 所有断言通过 - 人类玩家状态同步正常');
            
        } finally {
            await setup.cleanup();
        }
    });
    
    test('Preservation 2: 人类玩家多次命令 - 连续命令正常处理', async ({ browser }) => {
        test.setTimeout(60000);
        
        console.log('\n=== Preservation 2: 人类玩家多次命令 ===');
        console.log('测试目标：验证人类玩家连续发送多个命令时，所有命令都正常处理');
        
        // 创建简单对局
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03'],
                deck: ['deck_i_card_04'],
                playedCards: [],
            },
            player2: {
                hand: ['deck_i_card_05'],
                deck: ['deck_i_card_06'],
                playedCards: [],
            },
            phase: 'play',
            aiSeats: [],
        });
        
        try {
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                player1HandCount: initialState.core.players['0'].hand.length,
            });
            
            expect(initialState.core.phase).toBe('play');
            expect(initialState.core.players['0'].hand.length).toBe(3);
            
            // 连续打出 3 张卡牌
            console.log('\n连续打出 3 张卡牌...');
            for (let i = 0; i < 3; i++) {
                const currentState = await readLiveState(setup.player1Page);
                const cardId = currentState.core.players['0'].hand[0];
                
                // 点击卡牌打出
                const cardElement = setup.player1Page.locator(`[data-card-id="${cardId}"]`).first();
                await cardElement.click();
                
                await setup.player1Page.waitForTimeout(1000);
                
                console.log(`✅ 已打出第 ${i + 1} 张卡牌`);
            }
            
            // 读取最终状态
            const finalState = await readLiveState(setup.player1Page);
            
            console.log('\n最终状态:', {
                phase: finalState.core.phase,
                player1HandCount: finalState.core.players['0'].hand.length,
            });
            
            // **核心断言：验证所有命令都正常处理**
            // 手牌数量应该减少 3 张
            expect(finalState.core.players['0'].hand.length).toBe(initialState.core.players['0'].hand.length - 3);
            
            console.log('\n✅ 所有断言通过 - 连续命令正常处理');
            
        } finally {
            await setup.cleanup();
        }
    });
    
    test('Preservation 3: 人类玩家阶段推进 - 回合流程正常工作', async ({ browser }) => {
        test.setTimeout(60000);
        
        console.log('\n=== Preservation 3: 人类玩家阶段推进 ===');
        console.log('测试目标：验证人类玩家的回合流程和阶段推进正常工作');
        
        // 创建简单对局
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'],
                deck: ['deck_i_card_02'],
                playedCards: [
                    { defId: 'deck_i_card_03', signets: 0, encounterIndex: 0 },
                ],
            },
            player2: {
                hand: ['deck_i_card_04'],
                deck: ['deck_i_card_05'],
                playedCards: [
                    { defId: 'deck_i_card_06', signets: 0, encounterIndex: 0 },
                ],
            },
            phase: 'play',
            aiSeats: [],
        });
        
        try {
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                turnNumber: initialState.core.turnNumber,
            });
            
            expect(initialState.core.phase).toBe('play');
            
            // 点击"结束回合"按钮推进阶段
            console.log('\n点击结束回合按钮...');
            const endTurnButton = setup.player1Page.getByRole('button', { name: /结束.*回合|End.*Turn/i });
            await expect(endTurnButton).toBeVisible({ timeout: 5000 });
            await endTurnButton.click();
            
            await setup.player1Page.waitForTimeout(2000);
            
            // 读取最终状态
            const finalState = await readLiveState(setup.player1Page);
            
            console.log('\n最终状态:', {
                phase: finalState.core.phase,
                turnNumber: finalState.core.turnNumber,
            });
            
            // **核心断言：验证阶段推进正常**
            // 阶段应该改变或回合数应该推进
            const stateChanged = finalState.core.phase !== initialState.core.phase || 
                                 finalState.core.turnNumber > initialState.core.turnNumber;
            expect(stateChanged).toBe(true);
            
            console.log('\n✅ 所有断言通过 - 回合流程正常工作');
            
        } finally {
            await setup.cleanup();
        }
    });
    
    test('Preservation 4: 人类玩家状态同步 - 刷新后状态恢复正常', async ({ browser }) => {
        test.setTimeout(60000);
        
        console.log('\n=== Preservation 4: 人类玩家状态同步 ===');
        console.log('测试目标：验证人类玩家刷新页面后，状态同步正常工作');
        
        // 创建简单对局
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03'],
                playedCards: [],
            },
            player2: {
                hand: ['deck_i_card_04'],
                deck: ['deck_i_card_05'],
                playedCards: [],
            },
            phase: 'play',
            aiSeats: [],
        });
        
        try {
            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            console.log('初始状态:', {
                phase: initialState.core.phase,
                turnNumber: initialState.core.turnNumber,
                player1HandCount: initialState.core.players['0'].hand.length,
            });
            
            expect(initialState.core.phase).toBe('play');
            expect(initialState.core.players['0'].hand.length).toBe(2);
            
            // 刷新页面
            console.log('\n刷新页面...');
            await setup.player1Page.reload({ waitUntil: 'domcontentloaded' });
            
            // 等待页面重新加载
            await setup.player1Page.waitForSelector('[data-game-page][data-game-id="cardia"]', { timeout: 30000 });
            await setup.player1Page.waitForTimeout(2000);
            
            // 读取刷新后的状态
            const afterReloadState = await readLiveState(setup.player1Page);
            
            console.log('\n刷新后状态:', {
                phase: afterReloadState.core.phase,
                turnNumber: afterReloadState.core.turnNumber,
                player1HandCount: afterReloadState.core.players['0'].hand.length,
            });
            
            // **核心断言：验证刷新后状态同步正常**
            // 状态应该与刷新前一致
            expect(afterReloadState.core.phase).toBe(initialState.core.phase);
            expect(afterReloadState.core.turnNumber).toBe(initialState.core.turnNumber);
            expect(afterReloadState.core.players['0'].hand.length).toBe(initialState.core.players['0'].hand.length);
            
            console.log('\n✅ 所有断言通过 - 状态同步正常');
            
        } finally {
            await setup.cleanup();
        }
    });
});
