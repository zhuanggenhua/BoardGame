/**
 * SmashUp 外星人派系 - 卡牌图片视觉验证
 * 用户报告："发适居化显示探究"
 * 
 * 验证策略：直接截图手牌中的外星人卡牌，人工检查图片是否正确
 */

import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';

test.describe('SmashUp 外星人卡牌图片视觉验证', () => {
    test('截图手牌中的外星人卡牌', async ({ browser }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'smashup-selection-to-ingame-online');
        mkdirSync(evidenceDir, { recursive: true });
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            console.log('[测试] 创建对局失败');
            test.skip();
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            // 选择外星人派系
            await completeFactionSelection(hostPage, guestPage, {
                hostFactions: ['aliens', 'robots'],
                guestFactions: ['ninjas', 'pirates'],
            });

            await waitForHandArea(hostPage);
            await hostPage.waitForTimeout(2000);

            // 截图整个游戏界面
            await hostPage.screenshot({
                path: testInfo.outputPath('alien-game-full.png'),
                fullPage: true,
            });
            await hostPage.screenshot({
                path: join(evidenceDir, 'alien-game-full.png'),
                fullPage: true,
            });

            // 截图手牌区域
            const handArea = hostPage.locator('[data-testid="su-hand-area"]');
            await handArea.screenshot({
                path: testInfo.outputPath('alien-hand-area.png'),
                animations: 'disabled',
            });
            await handArea.screenshot({
                path: join(evidenceDir, 'alien-hand-area.png'),
                animations: 'disabled',
            });

            // 获取手牌信息用于日志
            const handInfo = await hostPage.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                if (!state?.core?.players?.['0']?.hand) return null;

                const hand = state.core.players['0'].hand;
                return hand.map((c: any) => ({
                    defId: c.defId,
                    type: c.type,
                }));
            });

            console.log('[测试] ✅ 已截图手牌区域');
            console.log('[测试] 📸 alien-hand-area.png - 手牌特写');
            console.log('[测试] 📸 alien-game-full.png - 完整游戏界面');
            console.log('[测试] 🃏 手牌内容:', JSON.stringify(handInfo, null, 2));
            console.log('[测试]');
            console.log('[测试] 🔍 请检查截图中的外星人卡牌图片是否正确：');
            console.log('[测试]   - 探究(Probe) 应该显示探究的图片');
            console.log('[测试]   - 适居化(Terraforming) 应该显示适居化的图片');
            console.log('[测试]   - 麦田怪圈(Crop Circles) 应该显示麦田怪圈的图片');
            console.log('[测试]');
            console.log('[测试] 当前配置的图集索引：');
            console.log('[测试]   - alien_probe: 41');
            console.log('[测试]   - alien_terraform: 42');
            console.log('[测试]   - alien_crop_circles: 43');

        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
