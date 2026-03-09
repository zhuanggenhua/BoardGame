/**
 * 大杀四方 - 响应窗口 Pass 测试
 * 
 * 测试场景：验证响应窗口在所有玩家 pass 后正确关闭
 */

import { test, expect } from './framework';

test.describe('大杀四方 - 响应窗口 Pass 测试', () => {
    test('两个玩家都 pass 后响应窗口应该关闭', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        // 1. 导航到游戏
        await page.goto('/play/smashup');

        // 2. 等待游戏加载
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );

        // 3. 使用 TestHarness 直接打开响应窗口
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            
            // 直接修改状态，打开响应窗口
            const newState = {
                ...state,
                sys: {
                    ...state.sys,
                    responseWindow: {
                        current: {
                            id: 'test-window',
                            windowType: 'me_first',
                            responderQueue: ['0', '1'],
                            currentResponderIndex: 0,
                            passedPlayers: [],
                            actionTakenThisRound: false,
                            consecutivePassRounds: 0,
                        },
                    },
                },
            };
            
            harness.state.patch(newState);
        });

        await page.waitForTimeout(1000);
        await game.screenshot('01-window-opened', testInfo);

        // 4. 验证响应窗口已打开
        const windowState1 = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            return {
                hasWindow: !!state.sys.responseWindow?.current,
                windowId: state.sys.responseWindow?.current?.id,
                currentResponder: state.sys.responseWindow?.current?.responderQueue[state.sys.responseWindow?.current?.currentResponderIndex],
            };
        });

        console.log('[TEST] 窗口状态 1:', windowState1);
        expect(windowState1.hasWindow).toBe(true);
        expect(windowState1.currentResponder).toBe('0');

        // 5. P0 pass
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'RESPONSE_PASS',
                playerId: '0',
                payload: { windowId: 'test-window' },
            });
        });

        await page.waitForTimeout(1000);
        await game.screenshot('02-p0-passed', testInfo);

        // 6. 验证窗口仍然打开，当前响应者变为 P1
        const windowState2 = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            return {
                hasWindow: !!state.sys.responseWindow?.current,
                windowId: state.sys.responseWindow?.current?.id,
                currentResponder: state.sys.responseWindow?.current?.responderQueue[state.sys.responseWindow?.current?.currentResponderIndex],
                passedPlayers: state.sys.responseWindow?.current?.passedPlayers || [],
            };
        });

        console.log('[TEST] 窗口状态 2:', windowState2);
        expect(windowState2.hasWindow).toBe(true);
        expect(windowState2.currentResponder).toBe('1');
        expect(windowState2.passedPlayers).toContain('0');

        // 7. P1 pass
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'RESPONSE_PASS',
                playerId: '1',
                payload: { windowId: 'test-window' },
            });
        });

        await page.waitForTimeout(1000);
        await game.screenshot('03-p1-passed', testInfo);

        // 8. 验证窗口已关闭
        const windowState3 = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            return {
                hasWindow: !!state.sys.responseWindow?.current,
                windowId: state.sys.responseWindow?.current?.id,
            };
        });

        console.log('[TEST] 窗口状态 3:', windowState3);
        expect(windowState3.hasWindow).toBe(false);
    });
});
