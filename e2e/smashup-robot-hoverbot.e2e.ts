/**
 * 盘旋机器人 E2E 测试
 * 
 * 验证完整的用户交互流程，覆盖 GameTestRunner 无法覆盖的层级。
 * 
 * 审计维度：
 * - D45（Pipeline 多阶段调用去重）
 * - D47（E2E 测试覆盖完整性）
 * 
 * 关键验证点：
 * 1. 交互 ID 稳定（robot_hoverbot_0，不是时间戳）
 * 2. 交互不会一闪而过（sys.interaction.current 持续存在）
 * 3. 完整的 WebSocket 传输层 + UI 层流程
 */

import { test, expect } from './fixtures';

test.describe('盘旋机器人交互稳定性 E2E', () => {
    test('打出盘旋机器人后交互应该稳定显示', async ({ smashupMatch }) => {
        const { hostPage: page } = smashupMatch;

        // 等待游戏加载完成
        await page.waitForSelector('text=大杀四方', { timeout: 15000 });

        // 使用 TestHarness 注入测试场景并执行命令
        const result = await page.evaluate(async () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) {
                throw new Error('Test harness not available');
            }
            
            // 1. 注入测试场景
            const state = harness.state.read();
            const p1 = state.core.players['0'];
            
            p1.hand = [{
                defId: 'robot_hoverbot',
                uid: 'test_hoverbot',
                type: 'minion',
                owner: '0',
            }];
            
            p1.deck = [{
                defId: 'pirate_first_mate',
                uid: 'test_pirate',
                type: 'minion',
                owner: '0',
            }];
            
            p1.minionLimit = 2;
            p1.minionsPlayed = 0;
            
            harness.state.patch({ core: state.core });
            
            // 等待状态同步
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 2. 执行打出随从命令
            await harness.command.dispatch({
                type: 'PLAY_MINION',
                payload: {
                    playerId: '0',
                    cardUid: 'test_hoverbot',
                    baseIndex: 0,
                },
            });
            
            // 等待命令执行完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 3. 读取交互状态
            const finalState = harness.state.read();
            return {
                interactionId: finalState.sys.interaction?.current?.id,
                interactionExists: !!finalState.sys.interaction?.current,
                interactionTitle: finalState.sys.interaction?.current?.data?.title,
                optionsCount: finalState.sys.interaction?.current?.data?.options?.length,
            };
        });

        // 关键验证 1：交互 ID 应该是 robot_hoverbot_0（不是时间戳）
        expect(result.interactionId).toBe('robot_hoverbot_0');

        // 关键验证 2：交互应该存在（不一闪而过）
        expect(result.interactionExists).toBe(true);

        // 验证 3：交互内容正确
        expect(result.interactionTitle).toContain('盘旋机器人');
        expect(result.optionsCount).toBe(2); // "放回牌库顶" 和 "打出"

        // 截图保存证据
        await page.screenshot({ 
            path: 'test-results/robot-hoverbot-interaction-stable.png',
            fullPage: true 
        });
    });
});
