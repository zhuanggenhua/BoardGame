/**
 * 忍者侍从 - 额外随从 E2E 测试
 * 
 * 使用新的 GameTestContext API 验证：
 * 1. 忍者侍从返回手牌后授予基地限定随从额度
 * 2. 玩家可以打出额外随从到该基地
 * 3. 额外随从不消耗全局随从额度
 * 4. 限制：每个基地只能使用一次
 * 5. 限制：本回合还未打出随从时才能使用
 * 
 * 核心验证：
 * - LIMIT_MODIFIED 事件正确授予 baseLimitedMinionQuota
 * - MINION_PLAYED 事件正确消耗基地限定额度
 * - 全局 minionsPlayed 不增加
 * - 可以选择跳过
 */

import { test, expect } from './fixtures';
import { GameTestContext } from './framework/GameTestContext';

test.describe('忍者侍从 - 额外随从', () => {
    test('应该授予基地限定随从额度并允许打出额外随从', async ({ page, smashupMatch }, testInfo) => {
        const { host, guest } = smashupMatch;
        const game = new GameTestContext(host.page);

        // 等待游戏开始
        await host.page.waitForSelector('[data-testid^="base-zone-"]', { timeout: 10000 });

        // 注入场上随从（使用 TestHarness.state.patch）
        await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            
            console.log('[Test] 注入前状态:', harness.state.get().core.bases[0].minions);
            
            harness.state.patch({
                'core.bases.0.minions': [
                    {
                        uid: 'acolyte-test',
                        defId: 'ninja_acolyte',
                        controller: '0',
                        owner: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    }
                ],
                'core.players.0.hand': [
                    { uid: 'shinobi-1', defId: 'ninja_shinobi', type: 'minion', owner: '0' },
                    { uid: 'mate-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                ],
            });
            
            console.log('[Test] 注入后状态:', harness.state.get().core.bases[0].minions);
        });

        await host.page.waitForTimeout(2000); // 等待 React 重新渲染

        // 截图：初始状态
        await host.page.screenshot({ path: testInfo.outputPath('01-initial-state.png'), fullPage: true });

        // 验证初始状态：minionsPlayed = 0
        const initialState = await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        expect(initialState.core.players['0'].minionsPlayed).toBe(0);
        expect(initialState.core.bases[0].minions.some((m: any) => m.defId === 'ninja_acolyte')).toBe(true);

        // 点击基地 0 上的忍者侍从激活 special
        const acolyteCard = host.page.locator('[data-minion-uid="acolyte-test"]');
        await expect(acolyteCard).toBeVisible({ timeout: 5000 });
        await acolyteCard.click();
        await host.page.waitForTimeout(500);

        // 应该弹出选择界面
        await host.page.waitForSelector('text=选择一个随从', { timeout: 5000 });
        await host.page.waitForTimeout(500);

        // 截图：选择界面
        await host.page.screenshot({ path: testInfo.outputPath('02-select-minion-prompt.png'), fullPage: true });

        // 选择打出影舞者
        const shinobiOption = host.page.locator('[data-option-id]').filter({ hasText: '影舞者' }).first();
        await expect(shinobiOption).toBeVisible({ timeout: 5000 });
        await shinobiOption.click();
        await host.page.waitForTimeout(500);

        // 点击确认
        const confirmButton = host.page.locator('button').filter({ hasText: '确认' });
        await confirmButton.click();
        await host.page.waitForTimeout(1500);

        // 截图：打出影舞者后
        await host.page.screenshot({ path: testInfo.outputPath('03-after-play-shinobi.png'), fullPage: true });

        // 验证最终状态
        const finalState = await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        // 忍者侍从应该回到手牌
        expect(finalState.core.players['0'].hand.some((c: any) => c.defId === 'ninja_acolyte')).toBe(true);
        
        // 影舞者应该在基地 0 上
        expect(finalState.core.bases[0].minions.some((m: any) => m.defId === 'ninja_shinobi')).toBe(true);
        
        // 关键验证：minionsPlayed 仍然是 0（没有消耗全局额度）
        expect(finalState.core.players['0'].minionsPlayed).toBe(0);
        
        // baseLimitedMinionQuota 应该被消耗（从 1 变成 0）
        expect(finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBeUndefined();

        console.log('[E2E] ✅ 测试通过：忍者侍从授予基地限定额度，打出额外随从不消耗全局额度');
    });

    test('应该允许选择跳过', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到游戏
        await page.goto('/play/smashup');
        
        // 2. 等待游戏加载完成
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );

        // 3. 快速场景构建
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_shinobi'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 注入场上随从
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                'core.bases.0.minions': [
                    {
                        uid: 'acolyte-test',
                        defId: 'ninja_acolyte',
                        controller: '0',
                        owner: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    }
                ],
            });
        });

        await page.waitForTimeout(1000);

        // 4. 激活忍者侍从
        const acolyteCard = page.locator('[data-minion-uid]').filter({ hasText: '忍者侍从' }).first();
        await expect(acolyteCard).toBeVisible({ timeout: 5000 });
        await acolyteCard.click();
        await page.waitForTimeout(500);

        // 5. 等待交互
        await game.waitForInteraction('ninja_acolyte_play');
        await page.waitForTimeout(500);

        // 6. 截图：选择界面
        await game.screenshot('01-skip-prompt', testInfo);

        // 7. 选择跳过
        await game.selectOption('skip');
        await game.confirm();
        await page.waitForTimeout(1000);

        // 8. 截图：跳过后
        await game.screenshot('02-after-skip', testInfo);

        // 9. 验证：忍者侍从应该回到手牌，但没有打出额外随从
        const finalState = await game.getState();
        
        expect(finalState.core.players['0'].hand.some((c: any) => c.defId === 'ninja_acolyte')).toBe(true);
        expect(finalState.core.bases[0].minions.every((m: any) => m.defId !== 'ninja_acolyte')).toBe(true);
        expect(finalState.core.players['0'].minionsPlayed).toBe(0);

        console.log('[E2E] ✅ 测试通过：可以选择跳过');
    });

    test('本回合已打出随从时应该无法使用', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到游戏
        await page.goto('/play/smashup');
        
        // 2. 等待游戏加载完成
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );

        // 3. 快速场景构建：minionsPlayed = 1
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_shinobi'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 注入场上随从和 minionsPlayed
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                'core.bases.0.minions': [
                    {
                        uid: 'acolyte-test',
                        defId: 'ninja_acolyte',
                        controller: '0',
                        owner: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'mate-test',
                        defId: 'pirate_first_mate',
                        controller: '0',
                        owner: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    }
                ],
                'core.players.0.minionsPlayed': 1,
            });
        });

        await page.waitForTimeout(1000);

        // 4. 截图：初始状态
        await game.screenshot('01-already-played-minion', testInfo);

        // 5. 尝试点击忍者侍从（应该无法激活）
        const acolyteCard = page.locator('[data-minion-uid]').filter({ hasText: '忍者侍从' }).first();
        await expect(acolyteCard).toBeVisible({ timeout: 5000 });
        await acolyteCard.click();
        await page.waitForTimeout(1000);

        // 6. 验证：不应该弹出交互
        const hasInteraction = await page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.sys?.interaction?.current !== null;
        });
        expect(hasInteraction).toBe(false);

        // 7. 截图：无法激活
        await game.screenshot('02-cannot-activate', testInfo);

        console.log('[E2E] ✅ 测试通过：本回合已打出随从时无法使用忍者侍从');
    });

    test('同一基地不能使用两次', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        // 1. 导航到游戏
        await page.goto('/play/smashup');
        
        // 2. 等待游戏加载完成
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return harness?.state?.isRegistered();
            },
            { timeout: 15000 }
        );

        // 3. 快速场景构建：两个忍者侍从在基地 0
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_shinobi', 'pirate_first_mate'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        // 注入两个忍者侍从
        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.state.patch({
                'core.bases.0.minions': [
                    {
                        uid: 'acolyte-1',
                        defId: 'ninja_acolyte',
                        controller: '0',
                        owner: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'acolyte-2',
                        defId: 'ninja_acolyte',
                        controller: '0',
                        owner: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    }
                ],
            });
        });

        await page.waitForTimeout(1000);

        // 4. 激活第一个忍者侍从
        const acolyte1 = page.locator('[data-minion-uid="acolyte-1"]');
        await expect(acolyte1).toBeVisible({ timeout: 5000 });
        await acolyte1.click();
        await page.waitForTimeout(500);

        // 5. 等待交互并打出影舞者
        await game.waitForInteraction('ninja_acolyte_play');
        await page.waitForTimeout(500);
        
        await game.selectOption('hand-0'); // 选择第一个手牌
        await game.confirm();
        await page.waitForTimeout(1500);

        // 6. 截图：第一次使用后
        await game.screenshot('01-after-first-use', testInfo);

        // 7. 尝试激活第二个忍者侍从（应该无法激活）
        const acolyte2 = page.locator('[data-minion-uid="acolyte-2"]');
        await expect(acolyte2).toBeVisible({ timeout: 5000 });
        await acolyte2.click();
        await page.waitForTimeout(1000);

        // 8. 验证：不应该弹出交互
        const hasInteraction = await page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.sys?.interaction?.current !== null;
        });
        expect(hasInteraction).toBe(false);

        // 9. 截图：无法再次使用
        await game.screenshot('02-cannot-use-again', testInfo);

        console.log('[E2E] ✅ 测试通过：同一基地不能使用两次忍者侍从');
    });
});
