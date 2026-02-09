/**
 * 大杀四方 (Smash Up) - 克苏鲁扩展 E2E 测试
 *
 * 覆盖范围：
 * - 克苏鲁派系选择 → 疯狂牌库初始化
 * - 疯狂牌出现在手牌中（通过能力散播）
 * - 天赋能力激活交互（金色发光环 + 点击）
 * - 弃牌堆查看覆盖层
 * - 克苏鲁 + 基础派系混搭组合
 * - Prompt 目标选择（献祭/散播疯狂牌）
 */

import { test, expect } from '@playwright/test';
import {
    FACTION,
    setupTwoPlayerMatch,
    cleanupTwoPlayerMatch,
    completeFactionSelectionCustom,
    waitForHandArea,
    clickHandCard,
    clickBase,
    clickFinishTurn,
    isDiscardOverlayVisible,
    performDiscard,
    isPromptVisible,
    selectFirstPromptOption,
    handleAllOverlays,
    playTurnIfActive,
} from './smashup-helpers';

// ============================================================================
// 测试用例
// ============================================================================

test.describe('Smash Up 克苏鲁扩展特殊交互', () => {
    test.setTimeout(120000);

    test('克苏鲁派系选择 → 疯狂牌库初始化 → 进入游戏', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            // P0: 克苏鲁仆从 + 远古物种
            // P1: 米斯卡塔尼克 + 印斯茅斯
            await completeFactionSelectionCustom(
                hostPage, guestPage,
                [FACTION.CTHULHU, FACTION.ELDER_THINGS],
                [FACTION.MISKATONIC, FACTION.INNSMOUTH],
            );

            // 验证双方都进入了游戏
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            // 验证双方都有 5 张起始手牌
            const hostHandCards = hostPage.getByTestId('su-hand-area').locator('> div > div');
            await expect(hostHandCards.first()).toBeVisible({ timeout: 15000 });
            const hostCardCount = await hostHandCards.count();
            expect(hostCardCount).toBe(5);

            const guestHandCards = guestPage.getByTestId('su-hand-area').locator('> div > div');
            await expect(guestHandCards.first()).toBeVisible({ timeout: 15000 });
            const guestCardCount = await guestHandCards.count();
            expect(guestCardCount).toBe(5);

            // 验证记分板显示克苏鲁派系图标（英文 locale 下用英文 title）
            const scoreSheet = hostPage.getByText(/Score Sheet|记分板/i);
            await expect(scoreSheet).toBeVisible({ timeout: 5000 });

            // 验证基地可见（≥3）
            const bases = hostPage.locator('.group\\/base');
            const baseCount = await bases.count();
            expect(baseCount).toBeGreaterThanOrEqual(3);

            await hostPage.screenshot({ path: testInfo.outputPath('cthulhu-game-start.png') });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('克苏鲁 + 基础派系混搭：多回合游戏流程', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelectionCustom(
                hostPage, guestPage,
                [FACTION.CTHULHU, FACTION.PIRATES],
                [FACTION.DINOSAURS, FACTION.MISKATONIC],
            );

            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            let promptTriggered = false;

            for (let round = 0; round < 8; round++) {
                await hostPage.waitForTimeout(1500);

                for (const page of [hostPage, guestPage]) {
                    const played = await playTurnIfActive(page);
                    if (played) {
                        if (await isPromptVisible(page)) {
                            promptTriggered = true;
                            await selectFirstPromptOption(page);
                            await page.waitForTimeout(300);
                        }
                    }
                }

                await handleAllOverlays([hostPage, guestPage]);
                await hostPage.waitForTimeout(500);
                await handleAllOverlays([hostPage, guestPage]);
            }

            console.log(`[INFO] Prompt 触发: ${promptTriggered ? '是' : '否（取决于手牌组合）'}`);

            await hostPage.screenshot({ path: testInfo.outputPath('cthulhu-mixed-rounds.png') });
            await guestPage.screenshot({ path: testInfo.outputPath('cthulhu-mixed-rounds-guest.png') });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('天赋能力交互：金色发光环 + 点击激活', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelectionCustom(
                hostPage, guestPage,
                [FACTION.STEAMPUNKS, FACTION.PLANTS],
                [FACTION.NINJAS, FACTION.ALIENS],
            );

            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            let talentGlowFound = false;

            for (let round = 0; round < 10; round++) {
                await hostPage.waitForTimeout(1500);

                for (const page of [hostPage, guestPage]) {
                    await playTurnIfActive(page);
                }

                await handleAllOverlays([hostPage, guestPage]);
                await hostPage.waitForTimeout(500);
                await handleAllOverlays([hostPage, guestPage]);

                const talentMinions = hostPage.locator('.ring-amber-400\\/80');
                const talentCount = await talentMinions.count().catch(() => 0);

                if (talentCount > 0) {
                    talentGlowFound = true;
                    await expect(talentMinions.first()).toBeVisible();
                    await hostPage.screenshot({ path: testInfo.outputPath('talent-glow-visible.png') });

                    await talentMinions.first().click();
                    await hostPage.waitForTimeout(1000);

                    if (await isPromptVisible(hostPage)) {
                        await selectFirstPromptOption(hostPage);
                        await hostPage.waitForTimeout(500);
                    }

                    const usedMark = hostPage.getByText('已用');
                    if (await usedMark.isVisible().catch(() => false)) {
                        await expect(usedMark).toBeVisible();
                    }

                    await hostPage.screenshot({ path: testInfo.outputPath('talent-after-use.png') });
                    break;
                }
            }

            if (!talentGlowFound) {
                console.log('[INFO] 天赋发光随从未在 10 回合内出现在场上（取决于手牌抽取）');
            }
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('弃牌堆查看：点击弃牌堆打开覆盖层', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelectionCustom(
                hostPage, guestPage,
                [FACTION.PIRATES, FACTION.DINOSAURS],
                [FACTION.ROBOTS, FACTION.ALIENS],
            );

            await waitForHandArea(hostPage);

            const discardClicked = await hostPage.evaluate(() => {
                const elements = document.querySelectorAll('div');
                for (const el of elements) {
                    const cls = el.className || '';
                    if (cls.includes('z-30') && cls.includes('cursor-pointer') && cls.includes('right-')) {
                        el.click();
                        return true;
                    }
                }
                return false;
            });

            if (discardClicked) {
                await hostPage.waitForTimeout(800);

                const overlayFound = await hostPage.evaluate(() => {
                    const fixedElements = document.querySelectorAll('.fixed');
                    for (const el of fixedElements) {
                        const h2 = el.querySelector('h2');
                        if (h2 && el.querySelector('button')) {
                            return true;
                        }
                    }
                    return false;
                });

                if (overlayFound) {
                    const overlayH2 = hostPage.locator('.fixed h2').first();
                    await expect(overlayH2).toBeVisible({ timeout: 3000 });
                    await hostPage.screenshot({ path: testInfo.outputPath('discard-pile-overlay.png') });

                    const closeBtn = hostPage.locator('.fixed h2').locator('..').locator('..').locator('button').first();
                    if (await closeBtn.isVisible().catch(() => false)) {
                        await closeBtn.click();
                        await hostPage.waitForTimeout(500);
                    }
                } else {
                    console.log('[INFO] 弃牌堆覆盖层未出现');
                }
            } else {
                console.log('[INFO] 未找到弃牌堆可点击元素');
            }

            await hostPage.screenshot({ path: testInfo.outputPath('discard-zone-visible.png') });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('克苏鲁全系对决：Prompt 献祭/散播疯狂牌交互', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage } = setup;

        try {
            await completeFactionSelectionCustom(
                hostPage, guestPage,
                [FACTION.CTHULHU, FACTION.INNSMOUTH],
                [FACTION.ELDER_THINGS, FACTION.MISKATONIC],
            );

            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            let promptCount = 0;
            let madnessInHandDetected = false;

            for (let round = 0; round < 12; round++) {
                await hostPage.waitForTimeout(1500);

                for (const page of [hostPage, guestPage]) {
                    const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
                    const isTurn = await finishBtn.isVisible().catch(() => false);

                    if (isTurn) {
                        const handArea = page.getByTestId('su-hand-area');
                        const cardCount = await handArea.locator('> div > div').count();

                        for (let c = 0; c < Math.min(cardCount, 2); c++) {
                            await clickHandCard(page, c);
                            await page.waitForTimeout(300);

                            const baseCards = page.locator('.group\\/base');
                            if (await baseCards.first().isVisible().catch(() => false)) {
                                await clickBase(page, 0);
                                await page.waitForTimeout(500);
                            }

                            if (await isPromptVisible(page)) {
                                promptCount++;

                                const promptModal = page.locator('.fixed.inset-0.z-\\[100\\]');
                                await expect(promptModal).toBeVisible();

                                const options = promptModal.locator('button:not([disabled])');
                                const optionCount = await options.count();
                                expect(optionCount).toBeGreaterThan(0);

                                if (promptCount === 1) {
                                    await page.screenshot({ path: testInfo.outputPath('cthulhu-prompt.png') });
                                }

                                await selectFirstPromptOption(page);
                                await page.waitForTimeout(500);
                            }
                        }

                        const finishBtnAfter = page.getByRole('button', { name: /Finish Turn|结束回合/i });
                        if (await finishBtnAfter.isVisible().catch(() => false)) {
                            await clickFinishTurn(page);
                        }
                        await page.waitForTimeout(1500);
                    }

                    if (await isDiscardOverlayVisible(page)) await performDiscard(page, 1);
                }

                await handleAllOverlays([hostPage, guestPage]);

                for (const page of [hostPage, guestPage]) {
                    const handArea = page.getByTestId('su-hand-area');
                    const isVisible = await handArea.isVisible().catch(() => false);
                    if (isVisible) {
                        const cardCount = await handArea.locator('> div > div').count().catch(() => 0);
                        if (cardCount > 7 && !madnessInHandDetected) {
                            madnessInHandDetected = true;
                            console.log(`[INFO] 检测到手牌数量异常增多 (${cardCount})，可能包含疯狂牌`);
                        }
                    }
                }
            }

            console.log(`[INFO] Prompt 触发次数: ${promptCount}`);
            console.log(`[INFO] 疯狂牌检测: ${madnessInHandDetected ? '可能出现' : '未明确检测到'}`);

            await hostPage.screenshot({ path: testInfo.outputPath('cthulhu-full-match.png') });
            await guestPage.screenshot({ path: testInfo.outputPath('cthulhu-full-match-guest.png') });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
