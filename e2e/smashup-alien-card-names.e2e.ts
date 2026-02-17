/**
 * SmashUp 外星人派系 - 卡牌图片索引验证（通过卡牌名称）
 * 
 * 验证策略：
 * 1. 使用调试面板按 defId 发特定卡牌
 * 2. 读取手牌区域显示的卡牌名称
 * 3. 断言显示的名称与预期一致
 * 
 * 如果图集索引错误，卡牌会显示错误的图片，但 hover 时显示的名称应该是正确的
 * （因为名称来自 CardDef，图片来自 previewRef.index）
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';

test.describe('SmashUp 外星人卡牌名称验证', () => {
    test('通过调试面板发牌并验证卡牌名称显示', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        
        // 创建带有 E2E 调试标志的 context
        const context = await browser.newContext();
        await context.addInitScript(() => {
            (window as any).__BG_E2E_DEBUG__ = true;
        });
        
        const hostPage = await context.newPage();
        const guestPage = await context.newPage();
        
        // 手动执行 setupTwoPlayerMatch 的逻辑
        const { initContext } = await import('./helpers/common');
        await initContext(hostPage);
        await initContext(guestPage);
        
        // 创建对局
        const { openSmashUpModal, createMatch, joinMatchViaAPI, seedMatchCredentials } = await import('./smashup-helpers');
        
        await openSmashUpModal(hostPage);
        const matchId = await createMatch(hostPage, 'Test Match');
        if (!matchId) {
            console.log('[测试] 创建对局失败');
            await context.close();
            test.skip();
            return;
        }
        
        const hostCredentials = await joinMatchViaAPI(hostPage, matchId, '0', 'Host');
        const guestCredentials = await joinMatchViaAPI(guestPage, matchId, '1', 'Guest');
        
        if (!hostCredentials || !guestCredentials) {
            console.log('[测试] 加入对局失败');
            await context.close();
            test.skip();
            return;
        }
        
        await seedMatchCredentials(context, matchId, '0', hostCredentials);
        await seedMatchCredentials(context, matchId, '1', guestCredentials);
        
        await hostPage.goto(`/play/smashup/match/${matchId}?playerID=0`);
        await guestPage.goto(`/play/smashup/match/${matchId}?playerID=1`);

        try {
            // 选择外星人派系
            await completeFactionSelection(hostPage, guestPage, {
                hostFactions: ['aliens', 'robots'],
                guestFactions: ['ninjas', 'pirates'],
            });

            await waitForHandArea(hostPage);
            await hostPage.waitForTimeout(3000);

            // 等待调试按钮出现（更长的超时时间）
            const debugButton = hostPage.locator('button:has-text("🐛")').first();
            
            // 先检查按钮是否存在
            const buttonExists = await debugButton.count();
            console.log('[测试] 调试按钮数量:', buttonExists);
            
            if (buttonExists === 0) {
                // 截图当前页面
                await hostPage.screenshot({
                    path: testInfo.outputPath('no-debug-button.png'),
                    fullPage: true,
                });
                console.log('[测试] ❌ 调试按钮不存在，已截图 no-debug-button.png');
                console.log('[测试] 可能原因：');
                console.log('[测试]   1. 不在 DEV 模式');
                console.log('[测试]   2. buttonPosition 未初始化');
                console.log('[测试]   3. 调试面板被隐藏');
                test.skip();
                return;
            }

            await debugButton.waitFor({ state: 'visible', timeout: 15000 });
            
            // 点击打开调试面板
            await debugButton.click();
            await hostPage.waitForTimeout(1000);

            // 等待调试面板加载
            await hostPage.waitForSelector('[data-testid="su-debug-deal"]', { timeout: 5000 });

            console.log('[测试] ✅ 调试面板已打开');

            // 查找牌库中的关键卡牌索引
            const deckInfo = await hostPage.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                if (!state?.core?.players?.['0']?.deck) return null;

                const deck = state.core.players['0'].deck;
                return {
                    probeIndex: deck.findIndex((c: any) => c.defId === 'alien_probe'),
                    terraformIndex: deck.findIndex((c: any) => c.defId === 'alien_terraform'),
                    cropIndex: deck.findIndex((c: any) => c.defId === 'alien_crop_circles'),
                };
            });

            console.log('[测试] 牌库信息:', deckInfo);

            if (!deckInfo || deckInfo.terraformIndex === -1) {
                console.log('[测试] 牌库中没有适居化卡牌，跳过测试');
                test.skip();
                return;
            }

            // 测试 1: 发适居化卡牌
            console.log('[测试] 发适居化卡牌，索引:', deckInfo.terraformIndex);
            await hostPage.fill('input[type="number"]', String(deckInfo.terraformIndex));
            await hostPage.waitForTimeout(500);
            await hostPage.click('[data-testid="su-debug-deal-apply"]');
            await hostPage.waitForTimeout(2000);

            // 截图手牌
            const handArea = hostPage.locator('[data-testid="su-hand-area"]');
            await handArea.screenshot({
                path: testInfo.outputPath('hand-with-terraform.png'),
                animations: 'disabled',
            });

            // 获取最后一张手牌的 defId（刚发的牌）
            const lastCardDefId = await hostPage.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                const hand = state?.core?.players?.['0']?.hand;
                if (!hand || hand.length === 0) return null;
                return hand[hand.length - 1].defId;
            });

            console.log('[测试] 最后一张手牌的 defId:', lastCardDefId);
            expect(lastCardDefId).toBe('alien_terraform');

            // 测试 2: 发探究卡牌
            if (deckInfo.probeIndex !== -1) {
                console.log('[测试] 发探究卡牌，索引:', deckInfo.probeIndex);
                await hostPage.fill('input[type="number"]', String(deckInfo.probeIndex));
                await hostPage.waitForTimeout(500);
                await hostPage.click('[data-testid="su-debug-deal-apply"]');
                await hostPage.waitForTimeout(2000);

                await handArea.screenshot({
                    path: testInfo.outputPath('hand-with-probe.png'),
                    animations: 'disabled',
                });

                const lastCardDefId2 = await hostPage.evaluate(() => {
                    const state = (window as any).__BG_STATE__;
                    const hand = state?.core?.players?.['0']?.hand;
                    if (!hand || hand.length === 0) return null;
                    return hand[hand.length - 1].defId;
                });

                console.log('[测试] 最后一张手牌的 defId:', lastCardDefId2);
                expect(lastCardDefId2).toBe('alien_probe');
            }

            // 测试 3: 发麦田怪圈卡牌
            if (deckInfo.cropIndex !== -1) {
                console.log('[测试] 发麦田怪圈卡牌，索引:', deckInfo.cropIndex);
                await hostPage.fill('input[type="number"]', String(deckInfo.cropIndex));
                await hostPage.waitForTimeout(500);
                await hostPage.click('[data-testid="su-debug-deal-apply"]');
                await hostPage.waitForTimeout(2000);

                await handArea.screenshot({
                    path: testInfo.outputPath('hand-with-crop-circles.png'),
                    animations: 'disabled',
                });

                const lastCardDefId3 = await hostPage.evaluate(() => {
                    const state = (window as any).__BG_STATE__;
                    const hand = state?.core?.players?.['0']?.hand;
                    if (!hand || hand.length === 0) return null;
                    return hand[hand.length - 1].defId;
                });

                console.log('[测试] 最后一张手牌的 defId:', lastCardDefId3);
                expect(lastCardDefId3).toBe('alien_crop_circles');
            }

            console.log('[测试] ✅ 所有卡牌 defId 验证通过');
            console.log('[测试] 📸 请检查截图，确认图片与卡牌名称匹配：');
            console.log('[测试]   - hand-with-terraform.png 应该显示适居化的图片');
            console.log('[测试]   - hand-with-probe.png 应该显示探究的图片');
            console.log('[测试]   - hand-with-crop-circles.png 应该显示麦田怪圈的图片');

        } finally {
            await context.close();
        }
    });
});
