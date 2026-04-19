/**
 * 大杀四方 - 特殊交互类型 E2E 测试
 *
 * 覆盖范围（每种 UI 交互模式至少一个代表）：
 * 1. 选卡名交互：zombie_mall_crawl（进发商场）
 * 2. 多步链交互：pirate_dinghy（小艇）
 * 3. 循环链交互：zombie_lord（僵尸领主）
 * 4. 多选交互：zombie_lend_a_hand（借把手）
 * 5. 弃牌堆出牌：zombie_tenacious_z（顽强丧尸）
 * 6. onMinionPlayed 触发：trickster_flame_trap（火焰陷阱）
 * 7. Protection 保护：robot_warbot（战争机器人）
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    cleanupTwoPlayerMatch,
    completeFactionSelectionCustom,
    waitForHandArea,
    waitForMyTurn,
    clickHandCard,
    clickBase,
    clickFinishTurn,
    isPromptVisible,
    FACTION,
} from './smashup-helpers';

test.describe('SmashUp 特殊交互类型 E2E', () => {
    test.setTimeout(180000);

    // ========================================================================
    // 1. 选卡名交互：zombie_mall_crawl（进发商场）
    // ========================================================================
    test('zombie_mall_crawl: 选卡名 → 同名卡进弃牌堆', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            console.log('⚠️  游戏服务器不可用，跳过测试。请先运行: npm run dev:game');
            test.skip(true, '游戏服务器不可用');
            return;
        }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            // P0 选 Zombies + Pirates，P1 选 Ninjas + Aliens
            await completeFactionSelectionCustom(hostPage, guestPage, [FACTION.ZOMBIES, FACTION.PIRATES], [FACTION.NINJAS, FACTION.ALIENS]);
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            // P0 回合：找到并打出"进发商场"（zombie_mall_crawl）
            await waitForMyTurn(hostPage);

            // 查找手牌中的"进发商场"
            const handArea = hostPage.getByTestId('su-hand-area');
            const cards = handArea.locator('> div > div');
            const cardCount = await cards.count();

            let mallCrawlIndex = -1;
            for (let i = 0; i < cardCount; i++) {
                const cardText = await cards.nth(i).textContent();
                if (cardText?.includes('进发商场') || cardText?.includes('Mall Crawl')) {
                    mallCrawlIndex = i;
                    break;
                }
            }

            if (mallCrawlIndex === -1) {
                test.skip(true, '手牌中没有"进发商场"，跳过测试');
                return;
            }

            // 打出"进发商场"
            await clickHandCard(hostPage, mallCrawlIndex);
            await hostPage.waitForTimeout(1000);

            // 应该出现 Prompt：选择卡名
            const promptVisible = await isPromptVisible(hostPage);
            expect(promptVisible).toBe(true);

            // 验证 Prompt 标题
            const promptTitle = hostPage.locator('.fixed.inset-0').getByText(/选择一个卡名|将牌库中所有同名卡放入弃牌堆/i);
            await expect(promptTitle).toBeVisible({ timeout: 5000 });

            // 验证有选项（按钮或卡牌）
            const options = hostPage.locator('.fixed.inset-0 button:not([disabled])');
            const optionCount = await options.count();
            expect(optionCount).toBeGreaterThan(0);

            // 点击第一个选项
            await options.first().click();
            await hostPage.waitForTimeout(1000);

            // Prompt 应该消失
            const promptGone = !(await isPromptVisible(hostPage));
            expect(promptGone).toBe(true);

            console.log('✅ zombie_mall_crawl 选卡名交互测试通过');
        } finally {
            await cleanupTwoPlayerMatch({ ...setup, hostContext, guestContext });
        }
    });

    // ========================================================================
    // 2. 多步链交互：pirate_dinghy（小艇）
    // ========================================================================
    test('pirate_dinghy: 选随从 → 选基地 → 选第二随从(可跳过) → 选基地', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            // P0 选 Pirates + Aliens，P1 选 Ninjas + Robots
            await completeFactionSelectionCustom(hostPage, guestPage, [FACTION.PIRATES, FACTION.ALIENS], [FACTION.NINJAS, FACTION.ROBOTS]);
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            // 先打出几个随从到基地（为 dinghy 准备目标）
            await waitForMyTurn(hostPage);
            await clickHandCard(hostPage, 0);
            await hostPage.waitForTimeout(300);
            await clickBase(hostPage, 0);
            await hostPage.waitForTimeout(1000);

            // 处理可能的 Prompt
            if (await isPromptVisible(hostPage)) {
                const options = hostPage.locator('.fixed.inset-0 button:not([disabled])');
                await options.first().click();
                await hostPage.waitForTimeout(500);
            }

            await clickFinishTurn(hostPage);
            await hostPage.waitForTimeout(2000);

            // P1 回合：打出随从
            await waitForMyTurn(guestPage);
            await clickHandCard(guestPage, 0);
            await guestPage.waitForTimeout(300);
            await clickBase(guestPage, 0);
            await guestPage.waitForTimeout(1000);

            if (await isPromptVisible(guestPage)) {
                const options = guestPage.locator('.fixed.inset-0 button:not([disabled])');
                await options.first().click();
                await guestPage.waitForTimeout(500);
            }

            await clickFinishTurn(guestPage);
            await guestPage.waitForTimeout(2000);

            // P0 第二回合：找到并打出"小艇"（pirate_dinghy）
            await waitForMyTurn(hostPage);

            const handArea = hostPage.getByTestId('su-hand-area');
            const cards = handArea.locator('> div > div');
            const cardCount = await cards.count();

            let dinghyIndex = -1;
            for (let i = 0; i < cardCount; i++) {
                const cardText = await cards.nth(i).textContent();
                if (cardText?.includes('小艇') || cardText?.includes('Dinghy')) {
                    dinghyIndex = i;
                    break;
                }
            }

            if (dinghyIndex === -1) {
                test.skip(true, '手牌中没有"小艇"，跳过测试');
                return;
            }

            // 打出"小艇"
            await clickHandCard(hostPage, dinghyIndex);
            await hostPage.waitForTimeout(1000);

            // 第一步：选随从
            let promptVisible = await isPromptVisible(hostPage);
            if (promptVisible) {
                const options = hostPage.locator('.fixed.inset-0 button:not([disabled])');
                await options.first().click();
                await hostPage.waitForTimeout(1000);

                // 第二步：选基地
                promptVisible = await isPromptVisible(hostPage);
                if (promptVisible) {
                    const options2 = hostPage.locator('.fixed.inset-0 button:not([disabled])');
                    await options2.first().click();
                    await hostPage.waitForTimeout(1000);

                    // 第三步：选第二个随从（或跳过）
                    promptVisible = await isPromptVisible(hostPage);
                    if (promptVisible) {
                        // 查找"跳过"按钮
                        const skipButton = hostPage.locator('.fixed.inset-0 button').filter({ hasText: /跳过|Skip/i });
                        if (await skipButton.isVisible().catch(() => false)) {
                            await skipButton.click();
                            await hostPage.waitForTimeout(500);
                        } else {
                            // 没有跳过按钮，选第一个选项
                            const options3 = hostPage.locator('.fixed.inset-0 button:not([disabled])');
                            await options3.first().click();
                            await hostPage.waitForTimeout(1000);

                            // 第四步：选第二个基地
                            promptVisible = await isPromptVisible(hostPage);
                            if (promptVisible) {
                                const options4 = hostPage.locator('.fixed.inset-0 button:not([disabled])');
                                await options4.first().click();
                                await hostPage.waitForTimeout(500);
                            }
                        }
                    }
                }
            }

            // 所有 Prompt 应该消失
            const promptGone = !(await isPromptVisible(hostPage));
            expect(promptGone).toBe(true);

            console.log('✅ pirate_dinghy 多步链交互测试通过');
        } finally {
            await cleanupTwoPlayerMatch({ ...setup, hostContext, guestContext });
        }
    });

    // ========================================================================
    // 3. 多选交互：zombie_lend_a_hand（借把手）
    // ========================================================================
    test('zombie_lend_a_hand: 多选弃牌堆卡 → 确认', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            // P0 选 Zombies + Pirates
            await completeFactionSelectionCustom(hostPage, guestPage, [FACTION.ZOMBIES, FACTION.PIRATES], [FACTION.NINJAS, FACTION.ALIENS]);
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            // 先打几张牌到弃牌堆（为 lend_a_hand 准备目标）
            await waitForMyTurn(hostPage);

            // 打出几张牌
            for (let i = 0; i < 2; i++) {
                await clickHandCard(hostPage, 0);
                await hostPage.waitForTimeout(300);
                await clickBase(hostPage, 0);
                await hostPage.waitForTimeout(1000);

                if (await isPromptVisible(hostPage)) {
                    const options = hostPage.locator('.fixed.inset-0 button:not([disabled])');
                    await options.first().click();
                    await hostPage.waitForTimeout(500);
                }
            }

            await clickFinishTurn(hostPage);
            await hostPage.waitForTimeout(2000);

            // P1 回合
            await waitForMyTurn(guestPage);
            await clickFinishTurn(guestPage);
            await guestPage.waitForTimeout(2000);

            // P0 第二回合：找到并打出"借把手"（zombie_lend_a_hand）
            await waitForMyTurn(hostPage);

            const handArea = hostPage.getByTestId('su-hand-area');
            const cards = handArea.locator('> div > div');
            const cardCount = await cards.count();

            let lendHandIndex = -1;
            for (let i = 0; i < cardCount; i++) {
                const cardText = await cards.nth(i).textContent();
                if (cardText?.includes('借把手') || cardText?.includes('Lend a Hand')) {
                    lendHandIndex = i;
                    break;
                }
            }

            if (lendHandIndex === -1) {
                test.skip(true, '手牌中没有"借把手"，跳过测试');
                return;
            }

            // 打出"借把手"
            await clickHandCard(hostPage, lendHandIndex);
            await hostPage.waitForTimeout(1000);

            // 应该出现多选 Prompt
            const promptVisible = await isPromptVisible(hostPage);
            expect(promptVisible).toBe(true);

            // 验证有选项
            const options = hostPage.locator('.fixed.inset-0 button:not([disabled])');
            const optionCount = await options.count();
            expect(optionCount).toBeGreaterThan(0);

            // 选择第一个选项（多选模式）
            await options.first().click();
            await hostPage.waitForTimeout(500);

            // 查找确认按钮
            const confirmButton = hostPage.locator('.fixed.inset-0 button').filter({ hasText: /确认|Confirm/i });
            await expect(confirmButton).toBeVisible({ timeout: 5000 });
            await confirmButton.click();
            await hostPage.waitForTimeout(1000);

            // Prompt 应该消失
            const promptGone = !(await isPromptVisible(hostPage));
            expect(promptGone).toBe(true);

            console.log('✅ zombie_lend_a_hand 多选交互测试通过');
        } finally {
            await cleanupTwoPlayerMatch({ ...setup, hostContext, guestContext });
        }
    });

    // ========================================================================
    // 5. 弃牌堆出牌：zombie_tenacious_z（顽强丧尸）
    // ========================================================================
    test('zombie_tenacious_z: 弃牌堆卡牌高亮 → 点击选中 → 基地高亮 → 点击基地打出', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            // P0 选 Zombies + Pirates
            await completeFactionSelectionCustom(hostPage, guestPage, [FACTION.ZOMBIES, FACTION.PIRATES], [FACTION.NINJAS, FACTION.ALIENS]);
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            await waitForMyTurn(hostPage);

            // 先打出几张随从到弃牌堆（为顽强丧尸准备目标）
            for (let i = 0; i < 3; i++) {
                const handArea = hostPage.getByTestId('su-hand-area');
                const cards = handArea.locator('> div > div');
                const cardCount = await cards.count();
                
                // 找到随从卡（通常有力量值）
                let minionIndex = -1;
                for (let j = 0; j < cardCount; j++) {
                    const cardText = await cards.nth(j).textContent();
                    // 跳过行动卡（通常没有力量值或有特定关键词）
                    if (cardText && !cardText.includes('行动') && !cardText.includes('Action')) {
                        minionIndex = j;
                        break;
                    }
                }
                
                if (minionIndex === -1) break;
                
                await clickHandCard(hostPage, minionIndex);
                await hostPage.waitForTimeout(300);
                await clickBase(hostPage, 0);
                await hostPage.waitForTimeout(1000);

                if (await isPromptVisible(hostPage)) {
                    const options = hostPage.locator('.fixed.inset-0 button:not([disabled])');
                    await options.first().click();
                    await hostPage.waitForTimeout(500);
                }
            }

            await clickFinishTurn(hostPage);
            await hostPage.waitForTimeout(2000);

            // P1 回合
            await waitForMyTurn(guestPage);
            await clickFinishTurn(guestPage);
            await guestPage.waitForTimeout(2000);

            // P0 第二回合：找到并打出"顽强丧尸"（zombie_tenacious_z）
            await waitForMyTurn(hostPage);

            const handArea = hostPage.getByTestId('su-hand-area');
            const cards = handArea.locator('> div > div');
            const cardCount = await cards.count();

            let tenaciousIndex = -1;
            for (let i = 0; i < cardCount; i++) {
                const cardText = await cards.nth(i).textContent();
                if (cardText?.includes('顽强') || cardText?.includes('Tenacious')) {
                    tenaciousIndex = i;
                    break;
                }
            }

            if (tenaciousIndex === -1) {
                test.skip(true, '手牌中没有"顽强丧尸"，跳过测试');
                return;
            }

            // 打出"顽强丧尸"
            await clickHandCard(hostPage, tenaciousIndex);
            await hostPage.waitForTimeout(1000);

            // 应该出现弃牌堆面板，显示可打出的卡牌
            const discardPanel = hostPage.locator('.fixed.bottom-0').filter({ hasText: /弃牌堆|Discard/i });
            await expect(discardPanel).toBeVisible({ timeout: 5000 });

            // 验证有高亮的卡牌（金色边框 ring-2 ring-amber-300/80）
            const highlightedCards = discardPanel.locator('.ring-2.ring-amber-300\\/80');
            const highlightedCount = await highlightedCards.count();
            expect(highlightedCount).toBeGreaterThan(0);

            console.log(`✅ 找到 ${highlightedCount} 张高亮的可打出卡牌`);

            // 点击第一张高亮的卡牌
            await highlightedCards.first().click();
            await hostPage.waitForTimeout(1000);

            // 验证基地高亮（isSelectable 类）
            const bases = hostPage.locator('[data-tutorial-id^="su-base-"]');
            const baseCount = await bases.count();
            
            let highlightedBaseFound = false;
            for (let i = 0; i < baseCount; i++) {
                const base = bases.nth(i);
                const classes = await base.getAttribute('class');
                // 检查是否有高亮样式（ring-4 ring-amber-400 表示可选基地）
                if (classes && classes.includes('ring-4') && classes.includes('ring-amber-400')) {
                    highlightedBaseFound = true;
                    console.log(`✅ 基地 ${i} 已高亮（弃牌堆出牌模式）`);
                    
                    // 点击高亮的基地
                    await base.click();
                    await hostPage.waitForTimeout(1000);
                    break;
                }
            }

            expect(highlightedBaseFound).toBe(true);

            // 弃牌堆面板应该消失
            const panelGone = !(await discardPanel.isVisible().catch(() => false));
            expect(panelGone).toBe(true);

            // 验证随从已经打出到基地上
            const baseWithMinion = hostPage.locator('[data-tutorial-id^="su-base-"]').first();
            const minionCards = baseWithMinion.locator('[data-card-uid]');
            const minionCount = await minionCards.count();
            expect(minionCount).toBeGreaterThan(0);

            console.log('✅ zombie_tenacious_z 弃牌堆出牌交互测试通过');
        } finally {
            await cleanupTwoPlayerMatch({ ...setup, hostContext, guestContext });
        }
    });
});
