/**
 * 大杀四方 - 简单阶段转换测试
 * 
 * 目的：验证点击"结束回合"按钮能否正确触发阶段转换
 */

import { test } from './framework';

test('简单阶段转换 - 点击结束回合', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);
    
    // 1. 导航到游戏
    await page.goto('/play/smashup');
    
    // 2. 等待游戏加载
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
        { timeout: 15000 }
    );
    
    // 3. 状态注入（最简单的场景：没有达到临界点的基地）
    await game.setupScene({
        gameId: 'smashup',
        player0: { 
            hand: [
                { uid: 'card-1', defId: 'wizard_portal', type: 'action' }
            ],
        },
        player1: {},
        bases: [
            { breakpoint: 25, power: 0 }, // 空基地，不会触发计分
        ],
        currentPlayer: '0',
        phase: 'playCards',
    });
    
    await page.waitForTimeout(2000);
    await game.screenshot('01-initial-state', testInfo);
    
    // 4. 验证初始阶段
    const initialPhase = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness.state.get().sys.phase;
    });
    console.log('[TEST] 初始阶段:', initialPhase);
    
    // 5. 点击"结束回合"按钮
    console.log('[TEST] 点击"结束回合"按钮');
    // 按钮文本可能被分成两行，使用更宽松的选择器
    const finishTurnButton = page.locator('button').filter({ hasText: /Finish|Turn|结束|回合/i }).first();
    await finishTurnButton.click();
    await page.waitForTimeout(2000);
    
    await game.screenshot('02-after-finish-turn', testInfo);
    
    // 6. 验证阶段是否改变
    const afterPhase = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness.state.get().sys.phase;
    });
    console.log('[TEST] 点击后阶段:', afterPhase);
    
    // 7. 期望：阶段应该从 playCards 变为 scoreBases（即使没有基地达标，也应该进入该阶段）
    // 或者直接跳到 draw（如果 scoreBases 被自动跳过）
    if (afterPhase === 'playCards') {
        console.error('[TEST] ❌ 阶段没有改变，仍然是 playCards');
    } else {
        console.log('[TEST] ✅ 阶段已改变:', afterPhase);
    }
});
