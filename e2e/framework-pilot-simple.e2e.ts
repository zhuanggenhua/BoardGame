/**
 * 测试框架试点 - 简化版
 * 
 * 验证测试框架的核心能力：
 * 1. 场景构建（setupScene）
 * 2. 命令分发（通过 TestHarness）
 * 3. 状态验证（断言方法）
 * 
 * 注意：暂不测试复杂的交互流程，先验证基础功能
 */

import { test } from './framework';

test.describe('测试框架试点 - 简化版', () => {
    test('应该能构建场景并通过命令打出卡牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000); // 增加超时时间到 60 秒
        // 监听控制台日志和错误
        page.on('console', msg => {
            console.log(`[浏览器控制台] ${msg.type()}: ${msg.text()}`);
        });
        
        page.on('pageerror', error => {
            console.error(`[浏览器错误] ${error.message}`);
            console.error(error.stack);
        });
        
        // 1. 导航到测试模式（启用 skipFactionSelect）
        console.log('📍 步骤 1: 导航到测试模式');
        await page.goto('/play/smashup/test?p0=wizards,aliens&p1=zombies,pirates&seed=12345&skipFactionSelect=true');
        
        // 2. 等待游戏完全就绪（优化：合并等待条件，增加轮询间隔）
        console.log('⏳ 步骤 2: 等待游戏就绪');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness?.state?.isRegistered()) return false;
                
                const state = harness.state.get();
                // 简化条件：只检查关键状态
                return state?.sys?.phase === 'playCards' &&
                       state?.core?.players?.['0']?.hand?.length > 0;
            },
            { timeout: 20000, polling: 200 } // 增加轮询间隔到 200ms
        );
        console.log('✅ 游戏已就绪');

        // 3. 构建测试场景
        console.log('📝 步骤 3: 构建测试场景');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['wizard_portal'],
                discard: ['alien_invader'],
                deck: ['wizard_chronomage', 'alien_invader', 'wizard_neophyte', 'alien_supreme_overlord', 'wizard_apprentice'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });
        
        // 等待场景构建完成（优化：只等待关键状态，不重复检查所有字段）
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get();
                const player = state?.core?.players?.['0'];
                return player?.hand?.length === 1 && player?.hand[0]?.defId === 'wizard_portal';
            },
            { timeout: 5000, polling: 200 } // 增加轮询间隔到 200ms
        );
        console.log('✅ 场景构建完成');
        
        // 验证初始状态
        await game.expectCardInHand('wizard_portal');
        await game.expectCardInDiscard('alien_invader');
        console.log('✅ 初始状态验证通过');

        // 4. 打出传送门并等待交互创建（优化：合并同步等待）
        console.log('🎴 步骤 4: 打出传送门');
        const result = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const currentPlayerIndex = state.core.currentPlayerIndex;
            const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
            const player = state.core.players[currentPlayerId];
            const card = player.hand.find((c: any) => c.defId === 'wizard_portal');
            
            if (!card) {
                return { success: false, error: 'wizard_portal not found in hand', hasInteraction: false };
            }
            
            try {
                harness.command.dispatch({
                    type: 'su:play_action',
                    payload: { cardUid: card.uid }
                });
                
                // 同步等待交互创建（最多 100ms）
                const startTime = Date.now();
                while (Date.now() - startTime < 100) {
                    const currentState = harness.state.get();
                    if (currentState?.sys?.interaction?.current) {
                        return { success: true, cardUid: card.uid, hasInteraction: true };
                    }
                }
                
                return { success: true, cardUid: card.uid, hasInteraction: false };
            } catch (error) {
                return { success: false, error: (error as Error).message, hasInteraction: false };
            }
        });
        
        if (!result.success) {
            throw new Error(`Failed to play wizard_portal: ${result.error}`);
        }
        console.log(`✅ 传送门已打出: ${result.cardUid}`);

        // 如果同步等待失败，再用异步等待
        if (!result.hasInteraction) {
            console.log('⏳ 同步等待失败，使用异步等待...');
            await page.waitForFunction(
                () => {
                    const harness = (window as any).__BG_TEST_HARNESS__;
                    const state = harness?.state?.get();
                    return !!state?.sys?.interaction?.current;
                },
                { timeout: 5000 }
            );
        }
        console.log('✅ 交互已创建');

        // 5. 验证最终状态
        console.log('🔍 步骤 5: 验证最终状态');
        const actualState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const currentPlayerIndex = state.core.currentPlayerIndex;
            const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
            const player = state.core.players[currentPlayerId];
            return {
                hand: player.hand.map((c: any) => c.defId),
                discard: player.discard.map((c: any) => c.defId),
                hasInteraction: !!state.sys?.interaction?.current,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId,
                actionsPlayed: player.actionsPlayed,
            };
        });

        // 验证：传送门应该创建了交互
        if (!actualState.hasInteraction) {
            throw new Error('Expected interaction to be created, but none found');
        }
        console.log(`✅ 交互已创建: ${actualState.interactionSourceId}`);
        
        // 验证：传送门已经被打出（移到弃牌堆）
        await game.expectCardInDiscard('wizard_portal');
        console.log('✅ wizard_portal 已打出（在弃牌堆中）');

        console.log('🎉 测试通过！所有功能正常工作');
        
        // 截图：最终状态（仅保留一张截图用于验证）
        await page.screenshot({ 
            path: testInfo.outputPath('final-state.png'), 
            fullPage: true,
            timeout: 10000
        });
        console.log('📸 截图已保存: final-state.png');
    });
});
