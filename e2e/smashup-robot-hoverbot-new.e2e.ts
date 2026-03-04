/**
 * 大杀四方 - 盘旋机器人 E2E 测试（使用新框架）
 * 
 * 测试场景：
 * 1. 打出盘旋机器人
 * 2. 查看牌库顶（随从）
 * 3. 验证交互弹窗正常显示（不一闪而过）
 * 4. 验证有两个选项（打出 + 跳过）
 * 5. 选择打出 / 跳过
 * 
 * 核心验证：_source: 'static' 修复生效
 * - 修复前：客户端只收到 1 个选项（play 被过滤掉）
 * - 修复后：客户端收到 2 个选项（play 有 _source: static，不被过滤）
 */

import { test, expect } from './framework';

test.describe('盘旋机器人交互测试（新框架）', () => {
    test('应该正确显示交互弹窗并允许选择打出', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        
        // 监听控制台日志和错误
        page.on('console', msg => {
            console.log(`[浏览器控制台] ${msg.type()}: ${msg.text()}`);
        });
        
        page.on('pageerror', error => {
            console.error(`[浏览器错误] ${error.message}`);
        });
        
        // 1. 导航到测试模式
        console.log('📍 步骤 1: 导航到测试模式');
        await page.goto('/play/smashup/test?p0=robots,pirates&p1=ninjas,dinosaurs&seed=12345&skipFactionSelect=true');
        
        // 2. 等待游戏就绪
        console.log('⏳ 步骤 2: 等待游戏就绪');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness?.state?.isRegistered()) return false;
                const state = harness.state.get();
                return state?.sys?.phase === 'playCards' && state?.core?.players?.['0']?.hand?.length > 0;
            },
            { timeout: 20000, polling: 200 }
        );
        console.log('✅ 游戏已就绪');

        // 3. 快速构造测试场景
        console.log('📝 步骤 3: 构建测试场景');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['pirate_first_mate', 'pirate_swashbuckler'],
            },
            player1: {
                hand: [],
                deck: [],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });
        
        // 等待场景构建完成
        console.log('⏳ 步骤 4: 等待场景构建完成');
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get();
                const player = state?.core?.players?.['0'];
                return player?.hand?.length === 1 && player?.hand[0]?.defId === 'robot_hoverbot';
            },
            { timeout: 5000, polling: 200 }
        );
        console.log('✅ 场景构建完成');

        // 4. 验证牌库状态
        console.log('🔍 步骤 5: 验证牌库状态');
        const deckState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const player = state.core.players['0'];
            return {
                handCount: player.hand.length,
                deckCount: player.deck.length,
                deckTop: player.deck[0]?.defId,
                hand: player.hand.map((c: any) => c.defId),
                deck: player.deck.map((c: any) => c.defId),
            };
        });
        console.log('牌库状态:', JSON.stringify(deckState, null, 2));
        
        // 5. 打出盘旋机器人（使用 TestHarness 命令，不用 UI 点击）
        console.log('🎴 步骤 6: 打出盘旋机器人');
        const result = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const player = state.core.players['0'];
            const card = player.hand.find((c: any) => c.defId === 'robot_hoverbot');
            
            if (!card) {
                return { success: false, error: 'robot_hoverbot not found in hand', deckCount: player.deck.length };
            }
            
            console.log('[Test] 打出前牌库:', player.deck.map((c: any) => c.defId));
            
            try {
                harness.command.dispatch({
                    type: 'su:play_minion',
                    payload: { cardUid: card.uid, baseIndex: 0 }
                });
                
                // 同步等待交互创建（最多 100ms）
                const startTime = Date.now();
                while (Date.now() - startTime < 100) {
                    const currentState = harness.state.get();
                    if (currentState?.sys?.interaction?.current) {
                        return { success: true, hasInteraction: true, deckCount: player.deck.length };
                    }
                }
                
                const finalState = harness.state.get();
                return { 
                    success: true, 
                    hasInteraction: false, 
                    deckCount: player.deck.length,
                    finalDeckCount: finalState.core.players['0'].deck.length,
                    interaction: finalState.sys?.interaction?.current,
                };
            } catch (error) {
                return { success: false, error: (error as Error).message, deckCount: player.deck.length };
            }
        });
        
        if (!result.success) {
            throw new Error(`Failed to play robot_hoverbot: ${result.error}`);
        }
        console.log('✅ 盘旋机器人已打出');
        console.log('调试信息:', JSON.stringify(result, null, 2));

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

        // 5. 验证交互弹窗稳定显示（不一闪而过）
        console.log('🔍 步骤 6: 验证交互弹窗');
        await page.waitForTimeout(2000);
        const promptOverlay = page.locator('[data-testid^="prompt-card-"]').first();
        await expect(promptOverlay).toBeVisible();

        // 6. 验证有两个选项：打出 + 跳过
        console.log('🔍 步骤 7: 验证选项');
        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        const optionCount = await cardOptions.count();
        console.log(`选项数量: ${optionCount}`);
        expect(optionCount).toBeGreaterThanOrEqual(1); // 至少有 1 个卡牌选项

        const skipButton = page.getByRole('button', { name: /跳过|放回牌库顶|Skip/i });
        await expect(skipButton).toBeVisible();
        console.log('✅ 选项验证通过');

        // 7. 截图：交互弹窗显示
        console.log('📸 步骤 8: 截图');
        await page.screenshot({ 
            path: testInfo.outputPath('hoverbot-interaction-visible.png'), 
            fullPage: true 
        });

        // 8. 选择"打出"（点击第一个卡牌选项）
        console.log('🎯 步骤 9: 选择打出');
        await promptOverlay.click();
        await page.waitForTimeout(500);

        // 9. 截图：最终状态
        await page.screenshot({ 
            path: testInfo.outputPath('hoverbot-played-pirate.png'), 
            fullPage: true 
        });
        console.log('🎉 测试通过！');
    });
});
