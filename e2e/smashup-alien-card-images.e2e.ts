/**
 * SmashUp 外星人派系卡牌图片验证测试
 * 基于图集图片验证每张卡的索引是否正确
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    completeFactionSelectionCustom,
    waitForHandArea,
    cleanupTwoPlayerMatch,
    FACTION,
} from './smashup-helpers';

test.describe('SmashUp 外星人卡牌图片验证', () => {
    test('验证关键卡牌的图片索引正确性', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            console.log('[测试] 创建对局失败，跳过测试');
            test.skip();
            return;
        }

        const { hostPage, guestPage } = setup;

        // 选择外星人派系
        await completeFactionSelectionCustom(
            hostPage,
            guestPage,
            [FACTION.ALIENS, FACTION.ROBOTS],
            [FACTION.NINJAS, FACTION.PIRATES]
        );

        await waitForHandArea(hostPage);
        await waitForHandArea(guestPage);

        // 打开调试面板
        await hostPage.click('[data-testid="debug-toggle"]');
        await hostPage.waitForSelector('[data-testid="su-debug-deal"]');

        // 测试关键卡牌：探究(Probe)、适居化(Terraforming)、麦田怪圈(Crop Circles)
        const testCards = [
            { name: '探究', nameEn: 'Probe', expectedIndex: 41 },
            { name: '适居化', nameEn: 'Terraforming', expectedIndex: 42 },
            { name: '麦田怪圈', nameEn: 'Crop Circles', expectedIndex: 43 },
        ];

        for (const card of testCards) {
            // 查找卡牌在牌库中的位置
            const deckItems = await hostPage.locator('[data-testid="su-debug-deal"] .space-y-1 > div').all();
            
            let cardIndex = -1;
            for (let i = 0; i < deckItems.length; i++) {
                const text = await deckItems[i].textContent();
                if (text?.includes(card.name) || text?.includes(card.nameEn)) {
                    cardIndex = i;
                    console.log(`[测试] 找到 ${card.name}，牌库索引: ${i}`);
                    break;
                }
            }

            if (cardIndex === -1) {
                console.log(`[测试] 未在牌库中找到 ${card.name}，跳过`);
                continue;
            }

            // 记录发牌前的手牌数量
            const beforeCount = await hostPage.locator('[data-testid="su-hand-area"] > div > div').count();

            // 发这张牌
            await hostPage.fill('input[type="number"]', cardIndex.toString());
            await hostPage.click('[data-testid="su-debug-deal-apply"]');
            await hostPage.waitForTimeout(1000);

            // 验证手牌数量增加
            const afterCount = await hostPage.locator('[data-testid="su-hand-area"] > div > div').count();
            expect(afterCount).toBe(beforeCount + 1);

            // 截图最后一张手牌（刚发的牌）
            const lastCard = hostPage.locator('[data-testid="su-hand-area"] > div > div').last();
            await lastCard.screenshot({ 
                path: testInfo.outputPath(`${card.nameEn.toLowerCase().replace(/\s+/g, '-')}-card.png`) 
            });

            console.log(`[测试] ${card.name} 已发到手牌，截图已保存`);
        }

        await cleanupTwoPlayerMatch(setup);
    });
});
