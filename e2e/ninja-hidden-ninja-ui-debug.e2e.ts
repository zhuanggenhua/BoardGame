/**
 * 便衣忍者 UI 调试测试
 * 
 * 在真实浏览器环境中测试便衣忍者的交互，查看完整的 UI 层日志
 */

import { test, expect } from './fixtures';

test.describe('便衣忍者 UI 调试', () => {
    test('在 Me First! 窗口打出便衣忍者，查看 UI 层日志', async ({ setupOnlineMatch, page }) => {
        const { player1Page, player2Page, matchId } = await setupOnlineMatch({
            gameId: 'smashup',
            factions: {
                player1: ['ninjas', 'pirates'],
                player2: ['robots', 'zombies'],
            },
        });

        // 使用 player1 的页面
        await player1Page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 注入测试状态：P0 在 scoreBases 阶段，Me First! 窗口打开，手牌中有便衣忍者和随从
        await player1Page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) throw new Error('TestHarness not available');

            // 构造测试状态
            const state = harness.state.get();
            const p0 = state.core.players['0'];
            const p1 = state.core.players['1'];

            // 清空手牌，添加便衣忍者 + 2 张随从
            p0.hand = [
                { uid: 'c1', defId: 'ninja_hidden_ninja', type: 'action' },
                { uid: 'c2', defId: 'ninja_tiger_assassin', type: 'minion' },
                { uid: 'c3', defId: 'ninja_acolyte', type: 'minion' },
            ];

            // 设置阶段为 scoreBases
            state.sys.phase = 'scoreBases';

            // 锁定计分基地
            state.core.scoringEligibleBaseIndices = [0];

            // 打开 Me First! 响应窗口
            state.sys.responseWindow = {
                current: {
                    id: 'meFirst_test_1',
                    responderQueue: ['0', '1'],
                    currentResponderIndex: 0,
                    windowType: 'meFirst',
                    sourceId: 'scoreBases',
                },
            };

            harness.state.patch(state);
        });

        // 等待状态更新
        await player1Page.waitForTimeout(500);

        // 监听控制台日志
        const logs: string[] = [];
        player1Page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[DEBUG]')) {
                logs.push(text);
                console.log(text);
            }
        });

        // 点击便衣忍者
        await player1Page.click('[data-card-uid="c1"]');

        // 等待交互创建
        await player1Page.waitForTimeout(1000);

        // 检查交互是否创建
        const hasInteraction = await player1Page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            return {
                hasCurrentInteraction: !!state.sys.interaction?.current,
                interactionId: state.sys.interaction?.current?.id,
                targetType: state.sys.interaction?.current?.data?.targetType,
                optionsCount: state.sys.interaction?.current?.data?.options?.length ?? 0,
                hasResponseWindow: !!state.sys.responseWindow?.current,
                responseWindowId: state.sys.responseWindow?.current?.id,
            };
        });

        console.log('=== Interaction State ===');
        console.log(JSON.stringify(hasInteraction, null, 2));

        // 打印所有 DEBUG 日志
        console.log('\n=== All DEBUG Logs ===');
        logs.forEach(log => console.log(log));

        // 断言交互已创建
        expect(hasInteraction.hasCurrentInteraction).toBe(true);
        expect(hasInteraction.targetType).toBe('hand');
        expect(hasInteraction.optionsCount).toBe(2);

        // 尝试点击随从卡
        console.log('\n=== Clicking minion card ===');
        await player1Page.click('[data-card-uid="c2"]');

        // 等待响应
        await player1Page.waitForTimeout(1000);

        // 检查交互是否被解决
        const afterClick = await player1Page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            return {
                hasCurrentInteraction: !!state.sys.interaction?.current,
                interactionId: state.sys.interaction?.current?.id,
            };
        });

        console.log('\n=== After Click State ===');
        console.log(JSON.stringify(afterClick, null, 2));

        // 打印点击后的日志
        console.log('\n=== Logs After Click ===');
        logs.slice(-20).forEach(log => console.log(log));
    });
});
