/**
 * E2E 测试：忍者渗透 - 选择并消灭基地上的战术卡
 * 
 * 测试场景：
 * 1. 创建在线对局并完成派系选择
 * 2. 使用 TestHarness.state.patch 注入测试状态
 * 3. 基地上有两个战术卡
 * 4. 玩家打出渗透到基地上
 * 5. 应该弹出选择界面，显示两个战术卡
 * 6. 玩家点击其中一个战术卡
 * 7. 该战术卡被消灭，渗透留在基地上
 * 
 * 稳定性方案：
 * - 使用 smashupMatch fixture 自动完成派系选择
 * - 使用 TestHarness.state.patch 注入状态（比 setupScene 更稳定）
 * - 等待足够的时间确保 React 重新渲染
 */

import { test, expect } from '../fixtures';

test.describe('忍者渗透 - 战术卡选择', () => {
    test('渗透打在基地上后，应该能选择并消灭基地上的战术卡', async ({ smashupMatch }, testInfo) => {
        test.setTimeout(120000); // 增加超时时间到 2 分钟
        
        const { host } = smashupMatch;

        // 等待游戏开始（等待基地区域渲染）
        await host.page.waitForSelector('[data-testid^="base-zone-"]', { timeout: 15000 });
        await host.page.waitForTimeout(2000); // 等待初始化完成

        // 注入状态：基地上有两个战术卡，玩家 0 手牌有渗透
        await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            
            harness.state.patch({
                'core.bases.0.ongoingActions': [
                    {
                        uid: 'ongoing-1',
                        defId: 'alien_supreme_overlord',
                        owner: '1',
                        type: 'action',
                    },
                    {
                        uid: 'ongoing-2',
                        defId: 'dinosaur_king_rex',
                        owner: '1',
                        type: 'action',
                    },
                ],
                'core.players.0.hand': [
                    {
                        uid: 'card-infiltrate',
                        defId: 'ninja_infiltrate',
                        type: 'action',
                        owner: '0',
                    },
                ],
                'core.players.0.actionsPlayed': 0,
                'core.players.0.actionLimit': 1,
            });
        });

        // 等待 React 重新渲染
        await host.page.waitForTimeout(2000);

        // 等待手牌渲染
        await host.page.waitForSelector('[data-card-uid="card-infiltrate"]', { timeout: 10000 });

        // 截图：初始状态（显示基地上的两个战术卡和手牌中的渗透）
        await host.page.screenshot({ path: testInfo.outputPath('01-before-play.png'), fullPage: true });

        // 验证初始状态
        const initialState = await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        expect(initialState.core.bases[0].ongoingActions.length).toBe(2);
        expect(initialState.core.players['0'].hand.some((c: any) => c.defId === 'ninja_infiltrate')).toBe(true);

        // 打出渗透到基地 0
        const infiltrateCardInHand = host.page.locator('[data-card-uid="card-infiltrate"]');
        await expect(infiltrateCardInHand).toBeVisible({ timeout: 5000 });
        await infiltrateCardInHand.click();
        await host.page.waitForTimeout(500);

        // 点击基地 0
        const base0 = host.page.locator('[data-base-index="0"]');
        await expect(base0).toBeVisible({ timeout: 5000 });
        await base0.click();
        await host.page.waitForTimeout(1500);

        // 应该弹出选择界面，显示两个战术卡
        const promptOverlay = host.page.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).toBeVisible({ timeout: 5000 });

        // 截图：选择界面（显示两个战术卡的选择提示）
        await host.page.screenshot({ path: testInfo.outputPath('02-select-prompt.png'), fullPage: true });

        // 点击第一个战术卡（Supreme Overlord）
        const ongoingCard1 = host.page.locator('[data-ongoing-uid="ongoing-1"]');
        await expect(ongoingCard1).toBeVisible({ timeout: 5000 });
        await ongoingCard1.click();
        await host.page.waitForTimeout(1500);

        // 截图：选择后状态（Supreme Overlord 被消灭，King Rex 还在，渗透在基地上）
        await host.page.screenshot({ path: testInfo.outputPath('03-after-select.png'), fullPage: true });

        // 验证：Supreme Overlord 被消灭，King Rex 还在，渗透在基地上
        const finalState = await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        const base0Ongoing = finalState.core.bases[0].ongoingActions;
        
        // 应该有 2 个战术卡：渗透 + King Rex
        expect(base0Ongoing.length).toBe(2);
        
        // 渗透应该在基地上
        expect(base0Ongoing.some((c: any) => c.defId === 'ninja_infiltrate')).toBe(true);
        
        // King Rex 应该还在
        expect(base0Ongoing.some((c: any) => c.defId === 'dinosaur_king_rex')).toBe(true);
        
        // Supreme Overlord 应该被消灭
        expect(base0Ongoing.some((c: any) => c.defId === 'alien_supreme_overlord')).toBe(false);

        console.log('[E2E] ✅ 测试通过：渗透可以选择并消灭基地上的战术卡');
    });
});
