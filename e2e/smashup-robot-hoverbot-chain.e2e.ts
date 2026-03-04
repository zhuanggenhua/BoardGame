/**
 * 盘旋机器人链式打出 E2E 测试
 * 
 * 使用新的 GameTestContext API 验证：
 * 1. 连续打出两个盘旋机器人
 * 2. 第二个盘旋看到新的牌库顶（不是自己）
 * 3. 不会出现无限循环
 * 
 * 核心验证：
 * - _source: 'static' 修复生效
 * - optionsGenerator + continuationContext 正确工作
 * - 交互解决器的校验机制生效
 */

import { test, expect } from './fixtures';
import { GameTestContext } from './framework/GameTestContext';

test.describe('盘旋机器人链式打出', () => {
    test('应该正确处理连续打出两个盘旋机器人', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到测试模式
        await page.goto('/play/smashup/test?p0=robots,pirates&p1=ninjas,dinosaurs&seed=12345');
        
        // 2. 等待游戏加载完成
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );

        // 3. 快速场景构建：手牌有第一个盘旋，牌库顶是第二个盘旋和 zapbot
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: [
                    'robot_hoverbot',  // 牌库顶：第二个盘旋
                    'robot_zapbot',    // 第三张：zapbot
                ],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出第一个盘旋机器人
        await game.playCard('robot_hoverbot');

        // 3. 等待交互：应该看到第二个盘旋机器人
        await game.waitForInteraction('robot_hoverbot');

        // 4. 验证选项引用第二个盘旋机器人
        const options1 = await game.getInteractionOptions();
        expect(options1.length).toBeGreaterThanOrEqual(2); // play + skip
        const playOption1 = options1.find(opt => opt.id === 'play');
        expect(playOption1).toBeDefined();
        expect(playOption1?.value?.defId).toBe('robot_hoverbot');

        // 5. 选择打出第二个盘旋机器人
        await game.selectOption('play');
        await game.confirm();

        // 6. 等待新的交互：应该看到 zapbot（新的牌库顶）
        await game.waitForInteraction('robot_hoverbot');

        // 7. 验证选项引用 zapbot（不是第二个盘旋机器人）
        const options2 = await game.getInteractionOptions();
        expect(options2.length).toBeGreaterThanOrEqual(2);
        const playOption2 = options2.find(opt => opt.id === 'play');
        expect(playOption2).toBeDefined();
        expect(playOption2?.value?.defId).toBe('robot_zapbot');

        // 8. 选择打出 zapbot
        await game.selectOption('play');
        await game.confirm();

        // 9. 验证最终状态：三个随从都在场上
        const finalState = await game.getState();
        const base0Minions = finalState.core.bases[0].minions.filter((m: any) => m.controller === '0');
        
        expect(base0Minions.length).toBe(3);
        expect(base0Minions.some((m: any) => m.defId === 'robot_hoverbot')).toBe(true);
        expect(base0Minions.filter((m: any) => m.defId === 'robot_hoverbot').length).toBe(2); // 两个盘旋
        expect(base0Minions.some((m: any) => m.defId === 'robot_zapbot')).toBe(true);

        // 10. 验证牌库已空
        expect(finalState.core.players['0'].deck.length).toBe(0);

        // 11. 截图保存
        await game.screenshot('final-state', testInfo);

        console.log('[E2E] ✅ 测试通过：连续打出两个盘旋机器人，第二个盘旋看到新的牌库顶');
    });

    test('第二个盘旋应该看到新的牌库顶（不是自己）', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到测试模式
        await page.goto('/play/smashup/test?p0=robots,pirates&p1=ninjas,dinosaurs&seed=12345');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );

        // 2. 场景构建
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_hoverbot', 'robot_zapbot'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出第一个盘旋
        await game.playCard('robot_hoverbot');
        await game.waitForInteraction('robot_hoverbot');

        // 3. 选择打出第二个盘旋
        await game.selectOption('play');
        await game.confirm();

        // 4. 等待新的交互
        await game.waitForInteraction('robot_hoverbot');

        // 5. 验证选项引用 zapbot（不是第二个盘旋）
        const options = await game.getInteractionOptions();
        const playOption = options.find(opt => opt.id === 'play');
        expect(playOption?.value?.defId).toBe('robot_zapbot');

        // 6. 验证牌库顶确实是 zapbot
        const state = await game.getState();
        expect(state.core.players['0'].deck[0]?.defId).toBe('robot_zapbot');

        // 7. 验证第二个盘旋已在场上
        const base0Minions = state.core.bases[0].minions.filter((m: any) => m.controller === '0');
        expect(base0Minions.some((m: any) => m.defId === 'robot_hoverbot')).toBe(true);
        expect(base0Minions.filter((m: any) => m.defId === 'robot_hoverbot').length).toBe(2);

        await game.screenshot('second-hoverbot-sees-new-deck-top', testInfo);

        console.log('[E2E] ✅ 测试通过：第二个盘旋看到新的牌库顶（zapbot）');
    });

    test('交互不应该一闪而过', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到测试模式
        await page.goto('/play/smashup/test?p0=robots,pirates&p1=ninjas,dinosaurs&seed=12345');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );

        // 2. 场景构建
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_zapbot'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出盘旋机器人
        await game.playCard('robot_hoverbot');

        // 3. 等待交互出现
        await game.waitForInteraction('robot_hoverbot');

        // 4. 等待 2 秒，确认交互仍然存在
        await page.waitForTimeout(2000);

        // 5. 再次检查交互是否仍然存在
        const stillExists = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state.get();
            const current = state?.sys?.interaction?.current;
            return current?.data?.sourceId === 'robot_hoverbot';
        });

        expect(stillExists).toBe(true);

        // 6. 验证选项仍然可见
        const options = await game.getInteractionOptions();
        expect(options.length).toBeGreaterThanOrEqual(2);

        await game.screenshot('interaction-persists', testInfo);

        console.log('[E2E] ✅ 测试通过：交互不会一闪而过');
    });

    test('应该允许选择"跳过"', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到测试模式
        await page.goto('/play/smashup/test?p0=robots,pirates&p1=ninjas,dinosaurs&seed=12345');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );

        // 2. 场景构建
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_zapbot'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出盘旋机器人
        await game.playCard('robot_hoverbot');
        await game.waitForInteraction('robot_hoverbot');

        // 3. 选择"跳过"
        await game.skip();

        // 4. 验证交互已消失
        const state = await game.getState();
        expect(state.sys.interaction?.current).toBeUndefined();

        // 5. 验证 zapbot 仍在牌库顶（未打出）
        expect(state.core.players['0'].deck[0]?.defId).toBe('robot_zapbot');

        // 6. 验证只有盘旋机器人在场上
        const base0Minions = state.core.bases[0].minions.filter((m: any) => m.controller === '0');
        expect(base0Minions.length).toBe(1);
        expect(base0Minions[0].defId).toBe('robot_hoverbot');

        await game.screenshot('skip-option', testInfo);

        console.log('[E2E] ✅ 测试通过：跳过功能正常工作');
    });

    test('牌库顶是行动卡时不应该创建交互', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到测试模式
        await page.goto('/play/smashup/test?p0=robots,pirates&p1=ninjas,dinosaurs&seed=12345');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );

        // 2. 场景构建：牌库顶是行动卡
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['robot_tech_center'], // 行动卡
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 2. 打出盘旋机器人
        await game.playCard('robot_hoverbot');

        // 3. 等待 2 秒，确认不会出现交互
        await page.waitForTimeout(2000);

        // 4. 验证没有交互
        const state = await game.getState();
        expect(state.sys.interaction?.current).toBeUndefined();

        // 5. 验证只有盘旋机器人在场上
        const base0Minions = state.core.bases[0].minions.filter((m: any) => m.controller === '0');
        expect(base0Minions.length).toBe(1);
        expect(base0Minions[0].defId).toBe('robot_hoverbot');

        await game.screenshot('action-card-no-interaction', testInfo);

        console.log('[E2E] ✅ 测试通过：牌库顶是行动卡时不创建交互');
    });
});
