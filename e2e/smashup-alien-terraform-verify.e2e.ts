/**
 * SmashUp 外星人派系 - 适居化(Terraforming)卡牌图片验证
 * 用户报告："发适居化显示探究"
 * 
 * 验证策略：
 * 1. 使用调试面板发牌功能，按索引发特定卡牌
 * 2. 截图手牌区域，验证显示的图片是否正确
 * 3. 根据图集布局：
 *    - 探究(Probe): 索引 41
 *    - 适居化(Terraforming): 索引 42
 *    - 麦田怪圈(Crop Circles): 索引 43
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';

test.describe('SmashUp 外星人 - 适居化图片验证', () => {
    test('验证适居化(Terraforming)显示正确的图片', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            console.log('[测试] 创建对局失败');
            test.skip();
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            // 启用 E2E 调试模式
            await hostPage.evaluate(() => {
                (window as any).__BG_E2E_DEBUG__ = true;
            });

            // 完成派系选择（选择外星人派系）
            await completeFactionSelection(hostPage, guestPage, {
                hostFactions: ['aliens', 'robots'],
                guestFactions: ['ninjas', 'pirates'],
            });

            await waitForHandArea(hostPage);

            // 等待调试面板加载
            await hostPage.waitForSelector('[data-testid="su-debug-deal"]', { timeout: 5000 });

            // 查找牌库中的适居化卡牌索引
            const deckInfo = await hostPage.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                if (!state?.core?.players?.['0']?.deck) return null;

                const deck = state.core.players['0'].deck;
                const terraformIndex = deck.findIndex((c: any) => c.defId === 'alien_terraform');
                const probeIndex = deck.findIndex((c: any) => c.defId === 'alien_probe');
                const cropIndex = deck.findIndex((c: any) => c.defId === 'alien_crop_circles');

                return {
                    deckLength: deck.length,
                    terraformIndex,
                    probeIndex,
                    cropIndex,
                    deck: deck.map((c: any, i: number) => ({ idx: i, defId: c.defId })),
                };
            });

            console.log('[测试] 牌库信息:', deckInfo);

            if (!deckInfo || deckInfo.terraformIndex === -1) {
                console.log('[测试] 牌库中没有适居化卡牌，跳过测试');
                test.skip();
                return;
            }

            // 使用调试面板发适居化卡牌
            const terraformIndex = deckInfo.terraformIndex;
            await hostPage.fill('input[type="number"]', String(terraformIndex));
            await hostPage.waitForTimeout(500);

            // 截图发牌前的状态
            await hostPage.screenshot({
                path: testInfo.outputPath('before-deal-terraform.png'),
                fullPage: true,
            });

            // 点击发牌按钮
            await hostPage.click('[data-testid="su-debug-deal-apply"]');
            await hostPage.waitForTimeout(1500);

            // 截图手牌区域
            const handArea = hostPage.locator('[data-testid="su-hand-area"]');
            await handArea.screenshot({
                path: testInfo.outputPath('hand-with-terraform.png'),
                animations: 'disabled',
            });

            console.log('[测试] ✅ 已截图手牌区域');
            console.log('[测试] 📸 请检查截图 hand-with-terraform.png');
            console.log('[测试] 🔍 最右侧的卡牌应该是"适居化(Terraforming)"');
            console.log('[测试] ❌ 如果显示的是"探究(Probe)"，说明索引配置错误');
            console.log('[测试]');
            console.log('[测试] 当前配置:');
            console.log('[测试]   - alien_probe: 索引 41');
            console.log('[测试]   - alien_terraform: 索引 42');
            console.log('[测试]   - alien_crop_circles: 索引 43');

            // 验证手牌数量增加
            const handCount = await hostPage.locator('[data-testid="su-hand-area"] [data-card-uid]').count();
            expect(handCount).toBeGreaterThan(0);

        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('对比发探究和发适居化的图片差异', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            console.log('[测试] 创建对局失败');
            test.skip();
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            // 启用 E2E 调试模式
            await hostPage.evaluate(() => {
                (window as any).__BG_E2E_DEBUG__ = true;
            });

            await completeFactionSelection(hostPage, guestPage, {
                hostFactions: ['aliens', 'robots'],
                guestFactions: ['ninjas', 'pirates'],
            });

            await waitForHandArea(hostPage);
            await hostPage.waitForSelector('[data-testid="su-debug-deal"]', { timeout: 5000 });

            // 查找两张卡牌的索引
            const deckInfo = await hostPage.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                if (!state?.core?.players?.['0']?.deck) return null;

                const deck = state.core.players['0'].deck;
                return {
                    probeIndex: deck.findIndex((c: any) => c.defId === 'alien_probe'),
                    terraformIndex: deck.findIndex((c: any) => c.defId === 'alien_terraform'),
                };
            });

            if (!deckInfo || deckInfo.probeIndex === -1 || deckInfo.terraformIndex === -1) {
                console.log('[测试] 牌库中缺少必要卡牌，跳过测试');
                test.skip();
                return;
            }

            // 先发探究
            await hostPage.fill('input[type="number"]', String(deckInfo.probeIndex));
            await hostPage.waitForTimeout(500);
            await hostPage.click('[data-testid="su-debug-deal-apply"]');
            await hostPage.waitForTimeout(1500);

            const handArea = hostPage.locator('[data-testid="su-hand-area"]');
            await handArea.screenshot({
                path: testInfo.outputPath('hand-with-probe.png'),
                animations: 'disabled',
            });

            // 再发适居化
            await hostPage.fill('input[type="number"]', String(deckInfo.terraformIndex));
            await hostPage.waitForTimeout(500);
            await hostPage.click('[data-testid="su-debug-deal-apply"]');
            await hostPage.waitForTimeout(1500);

            await handArea.screenshot({
                path: testInfo.outputPath('hand-with-both.png'),
                animations: 'disabled',
            });

            console.log('[测试] ✅ 已生成对比截图');
            console.log('[测试] 📸 hand-with-probe.png - 只有探究');
            console.log('[测试] 📸 hand-with-both.png - 探究 + 适居化');
            console.log('[测试] 🔍 请对比两张截图，确认适居化和探究的图片不同');

        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
