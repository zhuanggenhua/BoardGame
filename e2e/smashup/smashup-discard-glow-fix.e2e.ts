/**
 * 大杀四方 - 弃牌堆闪烁修复验证
 *
 * 验证场景：当随从额度已满且无额外出牌能力时，弃牌堆不应闪烁
 */

import { test, expect } from '@playwright/test';

test.describe('SmashUp - 弃牌堆闪烁修复', () => {
    test('随从额度已满且无额外出牌能力时，弃牌堆不闪烁', async ({ page }) => {
        // 进入本地模式
        await page.goto('/play/smashup/local');
        await page.waitForLoadState('networkidle');

        // 等待派系选择界面
        await page.waitForSelector('[data-tutorial-id="su-faction-select"]', { timeout: 10000 });

        // 选择派系（非僵尸/幽灵派系，避免弃牌堆出牌能力）
        const factionCards = page.locator('[data-faction-card]');
        await factionCards.nth(0).click(); // 选择第一个派系
        await factionCards.nth(1).click(); // 选择第二个派系

        // 点击确认按钮
        await page.locator('button:has-text("确认")').click();

        // 等待游戏开始
        await page.waitForSelector('[data-tutorial-id="su-base-area"]', { timeout: 10000 });

        // 使用调试面板注入状态：随从额度已满，弃牌堆有随从，但无额外出牌能力
        await page.evaluate(() => {
            const state = (window as any).__BG_STATE__();
            const dispatch = (window as any).__BG_DISPATCH__;
            if (!state || !dispatch) return;

            const currentPid = state.core.turnOrder[state.core.currentPlayerIndex];
            const player = state.core.players[currentPid];

            // 修改状态：随从额度已满，弃牌堆有随从
            player.minionsPlayed = 1;
            player.minionLimit = 1;
            player.discard = [
                { uid: 'test-minion-1', defId: 'pirate_first_mate', type: 'minion', owner: currentPid },
            ];

            // 应用状态
            dispatch('SYS_APPLY_STATE', { state: state.core });
        });

        // 等待状态应用
        await page.waitForTimeout(500);

        // 检查弃牌堆是否闪烁（通过检查是否有 animate-pulse 或 animate-ping 类）
        const discardZone = page.locator('[data-discard-toggle]');
        await expect(discardZone).toBeVisible();

        // 检查弃牌堆标签是否有闪烁动画（amber背景 + animate-pulse）
        const discardLabel = discardZone.locator('div').filter({ hasText: /弃牌/ }).last();
        const labelClasses = await discardLabel.getAttribute('class');
        
        // 不应该有 amber 背景和 animate-pulse（表示没有可打出的卡）
        expect(labelClasses).not.toContain('bg-amber-500');
        expect(labelClasses).not.toContain('animate-pulse');

        // 检查弃牌堆外围是否有闪烁光环（通过检查父容器内是否有 animate-ping 元素）
        const glowElements = await discardZone.locator('div.animate-ping').count();
        expect(glowElements).toBe(0);
    });

    test('随从额度已满但有基地限定额度时，弃牌堆应该闪烁（如果有可打出的卡）', async ({ page }) => {
        // 进入本地模式
        await page.goto('/play/smashup/local');
        await page.waitForLoadState('networkidle');

        // 等待派系选择界面
        await page.waitForSelector('[data-tutorial-id="su-faction-select"]', { timeout: 10000 });

        // 选择包含僵尸派系（有弃牌堆出牌能力）
        const factionCards = page.locator('[data-faction-card]');
        const zombieFaction = factionCards.filter({ has: page.locator('text=/僵尸|Zombie/i') }).first();
        await zombieFaction.click();
        await factionCards.nth(1).click(); // 选择第二个派系

        // 点击确认按钮
        await page.locator('button:has-text("确认")').click();

        // 等待游戏开始
        await page.waitForSelector('[data-tutorial-id="su-base-area"]', { timeout: 10000 });

        // 使用调试面板注入状态：随从额度已满，有基地限定额度，弃牌堆有顽强丧尸
        await page.evaluate(() => {
            const state = (window as any).__BG_STATE__();
            const dispatch = (window as any).__BG_DISPATCH__;
            if (!state || !dispatch) return;

            const currentPid = state.core.turnOrder[state.core.currentPlayerIndex];
            const player = state.core.players[currentPid];

            // 修改状态：随从额度已满，有基地限定额度，弃牌堆有顽强丧尸
            player.minionsPlayed = 1;
            player.minionLimit = 1;
            player.baseLimitedMinionQuota = { 0: 1 }; // 基地0有1个额外额度
            player.discard = [
                { uid: 'test-tz-1', defId: 'zombie_tenacious_z', type: 'minion', owner: currentPid },
            ];

            // 应用状态
            dispatch('SYS_APPLY_STATE', { state: state.core });
        });

        // 等待状态应用
        await page.waitForTimeout(500);

        // 检查弃牌堆是否闪烁
        const discardZone = page.locator('[data-discard-toggle]');
        await expect(discardZone).toBeVisible();

        // 检查弃牌堆标签是否有闪烁动画（amber背景 + animate-pulse）
        const discardLabel = discardZone.locator('div').filter({ hasText: /弃牌/ }).last();
        const labelClasses = await discardLabel.getAttribute('class');
        
        // 应该有 amber 背景和 animate-pulse（表示有可打出的卡）
        expect(labelClasses).toContain('bg-amber-500');
        expect(labelClasses).toContain('animate-pulse');

        // 检查弃牌堆外围是否有闪烁光环
        const glowElements = await discardZone.locator('div.animate-ping').count();
        expect(glowElements).toBeGreaterThan(0);
    });
});
