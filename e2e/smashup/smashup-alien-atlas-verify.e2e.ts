/**
 * SmashUp 外星人派系图集索引验证
 * 通过注入状态直接测试特定卡牌的图片显示
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';

test.describe('SmashUp 外星人图集索引验证', () => {
    test('验证 Probe、Terraforming、Crop Circles 的图片', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            console.log('[测试] 创建对局失败');
            test.skip();
            return;
        }

        const { hostPage, guestPage } = setup;

        await completeFactionSelection(hostPage, guestPage);
        await waitForHandArea(hostPage);
        await waitForHandArea(guestPage);

        // 注入测试卡牌到手牌
        await hostPage.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (!dispatch) return;

            // 使用 SYS_CHEAT_INJECT_STATE 注入特定卡牌
            dispatch('SYS_CHEAT_INJECT_STATE', {
                path: 'players.0.hand',
                value: [
                    { uid: 'test-probe', defId: 'alien_probe', type: 'action', owner: '0' },
                    { uid: 'test-terraform', defId: 'alien_terraform', type: 'action', owner: '0' },
                    { uid: 'test-crop', defId: 'alien_crop_circles', type: 'action', owner: '0' },
                ],
            });
        });

        await hostPage.waitForTimeout(1000);

        // 截图手牌区域
        const handArea = hostPage.locator('[data-testid="su-hand-area"]');
        await handArea.screenshot({ 
            path: testInfo.outputPath('alien-cards-verification.png'),
            animations: 'disabled'
        });

        console.log('[测试] 已截图手牌，包含 Probe、Terraforming、Crop Circles');
        console.log('[测试] 请检查截图 alien-cards-verification.png');
        console.log('[测试] 从左到右应该是：探究(Probe)、适居化(Terraforming)、麦田怪圈(Crop Circles)');

        await cleanupTwoPlayerMatch(setup);
    });
});
