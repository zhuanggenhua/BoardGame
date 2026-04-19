/**
 * TestHarness 基础功能验证测试
 * 
 * 验证测试工具的基本功能是否正常工作
 */

import { test, expect } from '@playwright/test';
import { waitForCoreState } from '../helpers/waitForState';
import {
    setupDTOnlineMatch,
    selectCharacter,
    readyAndStartGame,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { waitForTestHarness } from '../helpers/common';

test.describe('TestHarness 基础功能验证', () => {
    test('测试工具初始化和状态查询', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        // 选择角色并开始游戏
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);

        // 等待测试工具就绪
        await waitForTestHarness(hostPage);
        console.log('[Test] ✅ 测试工具已就绪');

        // 检查测试工具状态
        const status = await hostPage.evaluate(() => {
            return window.__BG_TEST_HARNESS__!.getStatus();
        });
        console.log('[Test] 测试工具状态:', status);

        // 验证测试工具已注册
        expect(status.state.registered).toBe(true);
        expect(status.command.registered).toBe(true);
        console.log('[Test] ✅ 测试工具注册验证通过');

        // 验证可以读取状态
        const state = await hostPage.evaluate(() => {
            return window.__BG_TEST_HARNESS__!.state.get();
        });
        expect(state).toBeDefined();
        expect(state.core).toBeDefined();
        expect(state.core.players).toBeDefined();
        console.log('[Test] ✅ 状态读取验证通过');

        // 清理
        await guestContext.close();
        await hostContext.close();
        
        console.log('[Test] ✅ 所有基础功能验证通过');
    });

    test('骰子注入基础验证', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        // 选择角色并开始游戏
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);

        // 等待测试工具就绪
        await waitForTestHarness(hostPage);

        // 注入骰子值
        await hostPage.evaluate(() => {
            window.__BG_TEST_HARNESS__!.dice.setValues([6, 6, 6, 6, 6]);
        });
        console.log('[Test] 已注入骰子值: [6,6,6,6,6]');

        // 检查骰子队列
        const diceStatus = await hostPage.evaluate(() => {
            return {
                remaining: window.__BG_TEST_HARNESS__!.dice.remaining(),
                values: window.__BG_TEST_HARNESS__!.dice.getValues(),
            };
        });
        console.log('[Test] 骰子状态:', diceStatus);
        
        expect(diceStatus.remaining).toBeGreaterThan(0);
        console.log('[Test] ✅ 骰子注入验证通过');

        // 清理
        await guestContext.close();
        await hostContext.close();
    });

    test('状态修改基础验证', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        // 选择角色并开始游戏
        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);

        // 等待测试工具就绪
        await waitForTestHarness(hostPage);

        // 读取初始 HP
        const initialHp = await hostPage.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.get();
            return state.core.players['0'].resources.hp;
        });
        console.log('[Test] 初始 HP:', initialHp);

        // 修改 HP
        await hostPage.evaluate(() => {
            window.__BG_TEST_HARNESS__!.state.patch({
                core: {
                    players: {
                        '0': {
                            resources: { hp: 10 }
                        }
                    }
                }
            });
        });
        console.log('[Test] 已修改玩家0 HP 为 10');

        // 等待状态更新
        await waitForCoreState(hostPage, (core: any) => core.players['0'].resources.hp === 10, {
            message: '等待 HP 更新为 10'
        });

        // 验证 HP 已修改
        const updatedHp = await hostPage.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.get();
            return state.core.players['0'].resources.hp;
        });
        console.log('[Test] 更新后 HP:', updatedHp);
        
        expect(updatedHp).toBe(10);
        expect(updatedHp).not.toBe(initialHp);
        console.log('[Test] ✅ 状态修改验证通过');

        // 清理
        await guestContext.close();
        await hostContext.close();
    });
});
