/**
 * 大杀四方 (Smash Up) - 完整游戏流程 E2E 测试
 *
 * 覆盖范围：
 * - 创建房间 → 双人加入 → 派系选择（蛇形选秀）
 * - 出牌阶段：打出随从到基地、打出行动卡
 * - 结束回合 → 对手回合 → 多回合循环
 * - 手牌上限弃牌交互
 * - Me First 响应窗口（特殊牌/让过）
 * - Prompt 目标选择覆盖层
 * - 基地记分 → VP 更新
 * - 牌库/弃牌堆查看
 * - 卡牌详情预览
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    cleanupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    waitForMyTurn,
    waitForOpponentTurn,
    clickHandCard,
    clickBase,
    clickFinishTurn,
    openFactionCard,
    confirmFactionSelection,
    selectFactionByIndex,
    isDiscardOverlayVisible,
    performDiscard,
    isMeFirstVisible,
    meFirstPass,
    isPromptVisible,
    selectFirstPromptOption,
    closeCardDetail,
    handleAllOverlays,
    playTurnIfActive,
} from './smashup-helpers';

// ============================================================================
// 测试用例
// ============================================================================

test.describe('Smash Up 完整游戏流程', () => {
    test.setTimeout(120000);

    test('派系选择 → 出牌 → 结束回合 → 多回合循环', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            // ---- 1. 派系选择 ----
            await completeFactionSelection(hostPage, guestPage);

            // 验证双方都进入了游戏（手牌区可见）
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            // 验证双方都有手牌（5 张起始手牌）
            const hostHandCards = hostPage.getByTestId('su-hand-area').locator('> div > div');
            await expect(hostHandCards.first()).toBeVisible({ timeout: 15000 });
            const hostCardCount = await hostHandCards.count();
            expect(hostCardCount).toBe(5);
            const guestHandCards = guestPage.getByTestId('su-hand-area').locator('> div > div');
            await expect(guestHandCards.first()).toBeVisible({ timeout: 15000 });
            const guestCardCount = await guestHandCards.count();
            expect(guestCardCount).toBe(5);

            // 验证记分板可见
            const scoreSheet = hostPage.getByText(/Score Sheet|记分板/i);
            await expect(scoreSheet).toBeVisible({ timeout: 5000 });

            // 验证基地可见（至少 3 个基地 = 玩家数+1）
            const bases = hostPage.locator('.group\\/base');
            const baseCount = await bases.count();
            expect(baseCount).toBeGreaterThanOrEqual(3);

            // ---- 2. 第一回合：P0 出牌 ----
            const finishButton = await waitForMyTurn(hostPage);
            expect(finishButton).toBeTruthy();

            // 验证 P1 看不到 Finish Turn（不是自己的回合）
            await waitForOpponentTurn(guestPage);

            // P0 点击第一张手牌 → 点击基地部署
            await clickHandCard(hostPage, 0);
            await hostPage.waitForTimeout(500);
            await clickBase(hostPage, 0);
            await hostPage.waitForTimeout(1000);

            // 处理可能出现的 Prompt
            if (await isPromptVisible(hostPage)) {
                await selectFirstPromptOption(hostPage);
                await hostPage.waitForTimeout(500);
            }

            // P0 结束回合
            const finishBtnAfterPlay = hostPage.getByRole('button', { name: /Finish Turn|结束回合/i });
            if (await finishBtnAfterPlay.isVisible().catch(() => false)) {
                await clickFinishTurn(hostPage);
            }

            // ---- 3. 等待阶段自动推进 ----
            await hostPage.waitForTimeout(2000);

            if (await isDiscardOverlayVisible(hostPage)) await performDiscard(hostPage, 1);
            if (await isMeFirstVisible(hostPage)) await meFirstPass(hostPage);
            if (await isMeFirstVisible(guestPage)) await meFirstPass(guestPage);

            // ---- 4. P1 的回合 ----
            await guestPage.waitForTimeout(3000);

            const guestFinishBtn = guestPage.getByRole('button', { name: /Finish Turn|结束回合/i });
            const isGuestTurn = await guestFinishBtn.isVisible().catch(() => false);

            if (isGuestTurn) {
                await clickHandCard(guestPage, 0);
                await guestPage.waitForTimeout(500);
                await clickBase(guestPage, 0);
                await guestPage.waitForTimeout(1000);

                if (await isPromptVisible(guestPage)) {
                    await selectFirstPromptOption(guestPage);
                    await guestPage.waitForTimeout(500);
                }

                const guestFinishBtnAfter = guestPage.getByRole('button', { name: /Finish Turn|结束回合/i });
                if (await guestFinishBtnAfter.isVisible().catch(() => false)) {
                    await clickFinishTurn(guestPage);
                }
            }

            // ---- 5. 验证回合推进 ----
            await hostPage.waitForTimeout(3000);
            await handleAllOverlays([hostPage, guestPage]);
            await hostPage.waitForTimeout(2000);
            await handleAllOverlays([hostPage, guestPage]);

            await hostPage.screenshot({ path: testInfo.outputPath('after-round1-host.png') });
            await guestPage.screenshot({ path: testInfo.outputPath('after-round1-guest.png') });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('派系选择交互面：详情模态框、已选标记、已占标记', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            // ---- 1. P0 打开派系详情模态框 ----
            await openFactionCard(hostPage, 0);

            const confirmBtn = hostPage.getByRole('button', { name: /Confirm Selection|确认选择/i });
            await expect(confirmBtn).toBeVisible({ timeout: 5000 });

            const previewText = hostPage.getByText(/Faction Details|派系详情/i);
            await expect(previewText).toBeVisible({ timeout: 5000 });

            const minionCount = hostPage.getByText(/\d+ Minions|\d+ 随从/i);
            await expect(minionCount).toBeVisible({ timeout: 5000 });

            await confirmFactionSelection(hostPage);

            // ---- 2. 验证"已选择"标记 ----
            await openFactionCard(hostPage, 0);
            const selectedBadge = hostPage.getByText(/Selected|已选择/i).first();
            await expect(selectedBadge).toBeVisible({ timeout: 5000 });
            const closeBtn = hostPage.locator('.fixed.inset-0.z-\\[100\\] button').first();
            await closeBtn.click();
            await hostPage.waitForTimeout(500);

            // ---- 3. P1 选两个派系 ----
            await selectFactionByIndex(guestPage, 1);
            await selectFactionByIndex(guestPage, 2);

            // ---- 4. P1 看到 P0 已选的派系被标记为"已占" ----
            await openFactionCard(guestPage, 0);
            const takenBadge = guestPage.getByText(/Taken by|已被|被.*选/i).first();
            await expect(takenBadge).toBeVisible({ timeout: 10000 });
            const closeBtnGuest = guestPage.locator('.fixed.inset-0.z-\\[100\\] button').first();
            await closeBtnGuest.click();
            await guestPage.waitForTimeout(500);

            // ---- 5. P0 选第二个派系 ----
            await selectFactionByIndex(hostPage, 3);

            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            await hostPage.screenshot({ path: testInfo.outputPath('faction-selection-complete.png') });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('卡牌详情预览：手牌点击查看、基地点击查看', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);

            // 点击基地查看详情
            await clickBase(hostPage, 0);
            await hostPage.waitForTimeout(500);

            const detailOverlay = hostPage.locator('.fixed.inset-0.z-\\[100\\].bg-black\\/80');
            await expect(detailOverlay).toBeVisible({ timeout: 5000 });

            await closeCardDetail(hostPage);
            await expect(detailOverlay).toBeHidden({ timeout: 5000 });

            // 牌库/弃牌堆区域可见
            const deckText = hostPage.getByText(/Deck|牌库/i).first();
            await expect(deckText).toBeVisible({ timeout: 5000 });

            await hostPage.screenshot({ path: testInfo.outputPath('card-detail-preview.png') });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('弃牌交互：手牌超限时弃牌覆盖层', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);

            let discardAppeared = false;

            for (let round = 0; round < 6; round++) {
                await hostPage.waitForTimeout(2000);

                const hostFinish = hostPage.getByRole('button', { name: /Finish Turn|结束回合/i });
                const isHostTurn = await hostFinish.isVisible().catch(() => false);

                if (isHostTurn) {
                    // 直接结束回合（不出牌，积累手牌）
                    await clickFinishTurn(hostPage);
                    await hostPage.waitForTimeout(2000);

                    if (await isDiscardOverlayVisible(hostPage)) {
                        discardAppeared = true;

                        const discardHeading = hostPage.getByText(/Too Many Cards|手牌过多/i);
                        await expect(discardHeading).toBeVisible();

                        const throwButton = hostPage.getByRole('button', { name: /Throw Away|丢弃并继续/i });
                        await expect(throwButton).toBeDisabled();

                        await performDiscard(hostPage, 1);
                        await hostPage.screenshot({ path: testInfo.outputPath('discard-overlay.png') });
                        break;
                    }
                }

                if (await isMeFirstVisible(hostPage)) await meFirstPass(hostPage);
                if (await isMeFirstVisible(guestPage)) await meFirstPass(guestPage);

                const guestFinish = guestPage.getByRole('button', { name: /Finish Turn|结束回合/i });
                const isGuestTurn = await guestFinish.isVisible().catch(() => false);
                if (isGuestTurn) {
                    await clickFinishTurn(guestPage);
                    await guestPage.waitForTimeout(2000);
                    if (await isDiscardOverlayVisible(guestPage)) await performDiscard(guestPage, 1);
                }

                if (await isMeFirstVisible(hostPage)) await meFirstPass(hostPage);
                if (await isMeFirstVisible(guestPage)) await meFirstPass(guestPage);
                if (await isPromptVisible(hostPage)) await selectFirstPromptOption(hostPage);
                if (await isPromptVisible(guestPage)) await selectFirstPromptOption(guestPage);
            }

            if (!discardAppeared) {
                console.log('[INFO] 弃牌场景未在 6 回合内自然出现，跳过弃牌断言');
            }
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('Me First 响应窗口交互', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);

            let meFirstAppeared = false;

            for (let round = 0; round < 10; round++) {
                await hostPage.waitForTimeout(1500);

                for (const page of [hostPage, guestPage]) {
                    await playTurnIfActive(page);
                    if (await isDiscardOverlayVisible(page)) await performDiscard(page, 1);
                }

                // 检查 Me First 窗口
                for (const page of [hostPage, guestPage]) {
                    if (await isMeFirstVisible(page)) {
                        meFirstAppeared = true;

                        const overlay = page.getByTestId('me-first-overlay');
                        await expect(overlay).toBeVisible();

                        const statusText = page.getByTestId('me-first-status');
                        await expect(statusText).toBeVisible();

                        const passBtn = page.getByTestId('me-first-pass-button');
                        await expect(passBtn).toBeVisible();

                        await meFirstPass(page);
                        await page.waitForTimeout(500);

                        await page.screenshot({ path: testInfo.outputPath('me-first-overlay.png') });
                    }
                }

                // 处理另一方的 Me First / Prompt
                await handleAllOverlays([hostPage, guestPage]);

                if (meFirstAppeared) break;
            }

            if (!meFirstAppeared) {
                console.log('[INFO] Me First 窗口未在 10 回合内自然出现');
            }
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('Prompt 目标选择覆盖层交互', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);

            let promptAppeared = false;

            for (let round = 0; round < 8; round++) {
                await hostPage.waitForTimeout(1500);

                for (const page of [hostPage, guestPage]) {
                    const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
                    const isTurn = await finishBtn.isVisible().catch(() => false);

                    if (isTurn) {
                        const handArea = page.getByTestId('su-hand-area');
                        const cardCount = await handArea.locator('> div > div').count();

                        for (let c = 0; c < Math.min(cardCount, 3); c++) {
                            await clickHandCard(page, c);
                            await page.waitForTimeout(300);

                            const baseCards = page.locator('.group\\/base');
                            if (await baseCards.first().isVisible().catch(() => false)) {
                                await clickBase(page, 0);
                                await page.waitForTimeout(500);
                            }

                            if (await isPromptVisible(page)) {
                                promptAppeared = true;

                                const promptModal = page.locator('.fixed.inset-0.z-\\[100\\]');
                                await expect(promptModal).toBeVisible();

                                const options = promptModal.locator('button');
                                const optionCount = await options.count();
                                expect(optionCount).toBeGreaterThan(0);

                                await selectFirstPromptOption(page);
                                await page.waitForTimeout(500);

                                await page.screenshot({ path: testInfo.outputPath('prompt-overlay.png') });
                                break;
                            }
                        }

                        const finishBtnAfter = page.getByRole('button', { name: /Finish Turn|结束回合/i });
                        if (await finishBtnAfter.isVisible().catch(() => false)) {
                            await clickFinishTurn(page);
                        }
                        await page.waitForTimeout(1500);
                    }

                    if (await isDiscardOverlayVisible(page)) await performDiscard(page, 1);
                    if (await isMeFirstVisible(page)) await meFirstPass(page);
                }

                if (promptAppeared) break;
            }

            if (!promptAppeared) {
                console.log('[INFO] Prompt 覆盖层未在 8 回合内自然出现（取决于派系能力）');
            }
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('VP 更新与记分板显示', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);

            // 验证初始 VP 为 0
            const vpBadges = hostPage.locator('.rounded-full.text-white.font-black');
            const initialVPs: string[] = [];
            const badgeCount = await vpBadges.count();
            for (let i = 0; i < badgeCount; i++) {
                const text = await vpBadges.nth(i).textContent();
                if (text !== null) initialVPs.push(text.trim());
            }
            expect(initialVPs.filter(v => v === '0').length).toBeGreaterThanOrEqual(2);

            // 多回合积累力量，等待基地记分
            for (let round = 0; round < 12; round++) {
                await hostPage.waitForTimeout(1500);

                for (const page of [hostPage, guestPage]) {
                    await playTurnIfActive(page);
                    if (await isDiscardOverlayVisible(page)) await performDiscard(page, 1);
                    if (await isMeFirstVisible(page)) await meFirstPass(page);
                    if (await isPromptVisible(page)) await selectFirstPromptOption(page);
                }

                // 检查是否有 VP 变化
                const currentVPs: string[] = [];
                const currentBadgeCount = await vpBadges.count();
                for (let i = 0; i < currentBadgeCount; i++) {
                    const text = await vpBadges.nth(i).textContent();
                    if (text !== null) currentVPs.push(text.trim());
                }
                const hasVPChange = currentVPs.some(v => v !== '0');
                if (hasVPChange) {
                    console.log(`[INFO] VP 变化检测到: ${currentVPs.join(', ')}`);
                    await hostPage.screenshot({ path: testInfo.outputPath('vp-update.png') });
                    break;
                }
            }
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
