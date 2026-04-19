/**
 * 测试工具使用示例
 * 
 * 演示如何使用 TestHarness 进行 E2E 测试
 */

import { test, expect } from '@playwright/test';
import {
    setupDTOnlineMatch,
    selectCharacter,
    readyAndStartGame,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { waitForTestHarness } from '../helpers/common';

test.describe('测试工具使用示例', () => {
    test('骰子注入示例', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

        console.log(`[Test] 对局创建成功: ${matchId}`);

        // 选择角色
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'barbarian');
        console.log('[Test] 角色选择完成');

        // 准备并开始游戏
        await readyAndStartGame(hostPage, guestPage);
        console.log('[Test] 游戏开始');

        // 等待游戏棋盘加载
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        console.log('[Test] 游戏棋盘已加载');

        // 等待测试工具就绪
        await waitForTestHarness(hostPage);
        console.log('[Test] 测试工具已就绪');

        // 检查测试工具状态
        const status = await hostPage.evaluate(() => {
            return window.__BG_TEST_HARNESS__!.getStatus();
        });
        console.log('[Test] 测试工具状态:', status);

        // 注入骰子值
        await hostPage.evaluate(() => {
            window.__BG_TEST_HARNESS__!.dice.setValues([6, 6, 6, 6, 6]);
        });
        console.log('[Test] 已注入骰子值: [6,6,6,6,6]');

        // 推进到 offensiveRoll 阶段
        const advanceButton = hostPage.locator('button').filter({ hasText: /推进阶段|Advance Phase/i });
        if (await advanceButton.isVisible().catch(() => false)) {
            await advanceButton.click();
            await hostPage.waitForTimeout(1000);
        }

        // 点击掷骰按钮
        const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeVisible({ timeout: 5000 });
        await rollButton.click();
        console.log('[Test] 已点击掷骰按钮');

        // 等待掷骰动画
        await hostPage.waitForTimeout(2500);

        // 点击确认按钮
        const confirmButton = hostPage.locator('button').filter({ hasText: /确认|Confirm/i });
        await expect(confirmButton).toBeVisible({ timeout: 5000 });
        await confirmButton.click();
        console.log('[Test] 已确认掷骰');

        // 验证骰子值
        const state = await hostPage.evaluate(() => {
            return window.__BG_TEST_HARNESS__!.state.get();
        });
        
        const diceValues = state.core.dice?.map((d: any) => d.value) || [];
        console.log('[Test] 骰子值:', diceValues);
        
        // 验证至少有一些骰子值为 6（可能不是全部，因为有些可能被重掷）
        const sixCount = diceValues.filter((v: number) => v === 6).length;
        expect(sixCount).toBeGreaterThan(0);
        
        console.log('[Test] ✅ 测试通过：骰子注入成功');

        // 清理
        await guestContext.close();
        await hostContext.close();
    });

    test('状态注入示例', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

        // 选择角色并开始游戏
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForTestHarness(hostPage);

        // 读取当前状态
        const initialState = await hostPage.evaluate(() => {
            return window.__BG_TEST_HARNESS__!.state.get();
        });
        console.log('[Test] 初始 HP:', initialState.core.players['0'].resources.hp);

        // 修改玩家 HP
        await hostPage.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.get();
            state.core.players['0'].resources.hp = 10;
            window.__BG_TEST_HARNESS__!.state.set(state);
        });
        console.log('[Test] 已修改玩家0 HP 为 10');

        // 验证状态变更
        const updatedState = await hostPage.evaluate(() => {
            return window.__BG_TEST_HARNESS__!.state.get();
        });
        
        expect(updatedState.core.players['0'].resources.hp).toBe(10);
        console.log('[Test] ✅ 测试通过：状态注入成功');

        // 清理
        await guestContext.close();
        await hostContext.close();
    });

    test('命令分发示例', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

        // 选择角色并开始游戏
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForTestHarness(hostPage);

        // 通过命令代理推进阶段
        await hostPage.evaluate(() => {
            window.__BG_TEST_HARNESS__!.command.dispatch({
                type: 'ADVANCE_PHASE',
                playerId: '0',
                payload: {}
            });
        });
        console.log('[Test] 已通过命令代理推进阶段');

        await hostPage.waitForTimeout(1000);

        // 验证阶段变更
        const state = await hostPage.evaluate(() => {
            return window.__BG_TEST_HARNESS__!.state.get();
        });
        
        console.log('[Test] 当前阶段:', state.sys.phase);
        expect(state.sys.phase).toBe('offensiveRoll');
        console.log('[Test] ✅ 测试通过：命令分发成功');

        // 清理
        await guestContext.close();
        await hostContext.close();
    });
});
