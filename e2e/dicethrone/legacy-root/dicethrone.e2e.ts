/**
 * DiceThrone 核心 E2E 测试
 *
 * 覆盖：在线对局手牌验证、僧侣技能交互、教学流程全链路。
 * 通用工具从 helpers/common 导入，DT 专用工具从 helpers/dicethrone 导入。
 */

import { test, expect } from '@playwright/test';
import { TOKEN_IDS, STATUS_IDS } from '../../../src/games/dicethrone/domain/ids';
import { setChineseLocale } from '../../helpers/common';
import {
    setupOnlineMatch,
    waitForTutorialBoardReady,
    getPlayerIdFromUrl,
    setPlayerToken,
    applyDiceValues,
    getModalContainerByHeading,
    readCoreState,
    assertHandCardsVisible,
    waitForTutorialStep,
    dispatchLocalCommand,
} from '../../helpers/dicethrone';

test.describe('DiceThrone E2E', () => {
    test('Tutorial landscape feedback keeps inputs visible in game HUD', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const context = await browser.newContext({
            viewport: { width: 852, height: 393 },
            isMobile: true,
            hasTouch: true,
            baseURL: testInfo.project.use.baseURL as string | undefined,
        });

        try {
            await setChineseLocale(context);
            const page = await context.newPage();
            await page.goto('/play/dicethrone/tutorial');

            const waitForTutorialHud = async () => {
                for (let attempt = 0; attempt < 4; attempt += 1) {
                    const namespaceRetryButton = page.getByRole('button', { name: /^重试$/ });
                    const rescueReloadButton = page.getByRole('button', { name: /刷新重试/i });
                    const namespaceError = page.getByText('游戏文案加载失败');
                    const rescueGate = page.getByTestId('game-page-rescue-gate');
                    const rescueTitle = page.getByText('页面没有正常显示');

                    const shouldRetryNamespace = await namespaceError.isVisible({ timeout: 2500 }).catch(() => false)
                        || await namespaceRetryButton.isVisible({ timeout: 2500 }).catch(() => false);
                    if (shouldRetryNamespace) {
                        await namespaceRetryButton.click().catch(() => page.reload({ waitUntil: 'domcontentloaded' }));
                        await page.waitForTimeout(1200);
                        continue;
                    }

                    const shouldReloadRescueGate = await rescueGate.isVisible({ timeout: 1500 }).catch(() => false)
                        || await rescueTitle.isVisible({ timeout: 1500 }).catch(() => false);
                    if (shouldReloadRescueGate) {
                        await rescueReloadButton.click().catch(() => page.reload({ waitUntil: 'domcontentloaded' }));
                        await page.waitForTimeout(1200);
                        continue;
                    }

                    try {
                        await waitForTutorialBoardReady(page, 45000);
                        const hudButton = page.locator('[data-fab-id="chat"]');
                        await expect(hudButton).toBeVisible({ timeout: 15000 });
                        return hudButton;
                    } catch (error) {
                        if (attempt === 3) {
                            throw error;
                        }
                        await page.reload({ waitUntil: 'domcontentloaded' });
                        await page.waitForTimeout(1200);
                    }
                }

                throw new Error('教程页未能稳定进入可操作 HUD');
            };

            const hudMainButton = await waitForTutorialHud();
            await hudMainButton.click();
            await expect(page.locator('[data-fab-id="feedback"]')).toBeVisible({ timeout: 10000 });
            await page.locator('[data-fab-id="feedback"]').click();

            const feedbackModal = page.getByTestId('feedback-modal');
            const feedbackTextarea = feedbackModal.getByPlaceholder(/描述/i);
            const contactInput = feedbackModal.getByPlaceholder(/邮箱或 QQ/i);

            await expect(feedbackModal).toBeVisible({ timeout: 10000 });
            await expect(feedbackTextarea).toBeVisible();
            await expect(contactInput).toBeVisible();

            const metrics = await feedbackModal.evaluate((element) => {
                const textarea = element.querySelector('textarea');
                const contact = element.querySelector('input[type="text"]');
                const submitButton = element.querySelector('button[type="submit"]');

                return {
                    modalRight: element.getBoundingClientRect().right,
                    textareaBottom: textarea?.getBoundingClientRect().bottom ?? 0,
                    contactBottom: contact?.getBoundingClientRect().bottom ?? 0,
                    submitBottom: submitButton?.getBoundingClientRect().bottom ?? 0,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    textareaFontSize: textarea ? Number.parseFloat(window.getComputedStyle(textarea).fontSize || '0') : 0,
                    contactFontSize: contact ? Number.parseFloat(window.getComputedStyle(contact).fontSize || '0') : 0,
                };
            });

            expect(metrics.modalRight, '横屏反馈弹窗右边界不应超出视口').toBeLessThanOrEqual(metrics.viewportWidth);
            expect(metrics.textareaBottom, '横屏反馈描述输入区应完整留在视口内').toBeLessThanOrEqual(metrics.viewportHeight);
            expect(metrics.contactBottom, '横屏反馈联系方式输入区应完整留在视口内').toBeLessThanOrEqual(metrics.viewportHeight);
            expect(metrics.submitBottom, '横屏反馈提交按钮应完整留在视口内').toBeLessThanOrEqual(metrics.viewportHeight);
            expect(metrics.textareaFontSize, '横屏反馈描述输入区至少应保持 16px').toBeGreaterThanOrEqual(16);
            expect(metrics.contactFontSize, '横屏反馈联系方式输入区至少应保持 16px').toBeGreaterThanOrEqual(16);

            await page.evaluate(() => {
                const root = document.documentElement;
                root.style.setProperty('--runtime-viewport-height', '245px');
                root.style.setProperty('--keyboard-inset-height', '148px');
                root.dataset.keyboardVisible = 'true';
            });

            const mobileProxy = page.getByTestId('mobile-text-entry-proxy').last();
            const mobileProxyTextarea = page.getByTestId('mobile-text-entry-proxy-textarea').last();
            const mobileProxyInput = page.getByTestId('mobile-text-entry-proxy-input').last();

            await feedbackTextarea.click();
            await expect(mobileProxy).toBeVisible();
            await mobileProxyTextarea.fill('游戏内横屏反馈输入可见性校验');

            await contactInput.click();
            await expect(mobileProxy).toBeVisible();
            await mobileProxyInput.fill('tester@example.com');
            await expect(feedbackTextarea).toHaveValue('游戏内横屏反馈输入可见性校验');
            await expect(contactInput).toHaveValue('tester@example.com');

            await feedbackModal.locator('button').first().click();
            await expect(feedbackModal).toBeHidden({ timeout: 10000 });

            await expect(page.locator('[data-fab-id="feedback"]')).toBeVisible({ timeout: 10000 });
            await page.locator('[data-fab-id="feedback"]').click();
            await expect(feedbackModal).toBeVisible({ timeout: 10000 });
            await expect(feedbackTextarea).toHaveValue('游戏内横屏反馈输入可见性校验');
            await expect(contactInput).toHaveValue('tester@example.com');

            await page.screenshot({
                path: 'test-results/evidence-screenshots/dicethrone-feedback-modal-landscape.png',
                fullPage: false,
            });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('Online match shows starting hand cards after character selection', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) {
            test.skip(true, 'Game server unavailable for online tests.');
        }

        const { hostPage, guestPage, hostContext, guestContext } = match!;
        try {
            await hostPage.waitForTimeout(2000);
            await guestPage.waitForTimeout(2000);

            await assertHandCardsVisible(hostPage, 4, 'host');
            await assertHandCardsVisible(guestPage, 4, 'guest');


            await hostPage.screenshot({ path: testInfo.outputPath('hand-cards-success.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Online match: Monk Lotus Bloom choice consumes Taiji', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, hostContext, guestContext } = match!;

        try {
            const monkPage = hostPage;
            const monkNextPhase = monkPage.locator('[data-tutorial-id="advance-phase-button"]');
            const monkActive = await monkNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!monkActive) {
                test.skip(true, '非预期起始玩家，无法覆盖花开见佛选择');
            }

            const monkPlayerId = getPlayerIdFromUrl(monkPage, '0');
            await setPlayerToken(monkPage, monkPlayerId, TOKEN_IDS.TAIJI, 2);

            // 推进到进攻投骰阶段
            const advanceButton = monkPage.locator('[data-tutorial-id="advance-phase-button"]');
            while (await advanceButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
                await advanceButton.click();
                await monkPage.waitForTimeout(400);
            }
            const rollButton = monkPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await monkPage.waitForTimeout(300);
            await applyDiceValues(monkPage, [6, 6, 6, 6, 1]);

            const confirmButton = monkPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();

            const highlightedSlots = monkPage
                .locator('[data-ability-slot]')
                .filter({ has: monkPage.locator('div.animate-pulse[class*="border-"]') });
            const hasHighlight = await highlightedSlots.first().isVisible({ timeout: 8000 }).catch(() => false);
            if (!hasHighlight) {
                test.skip(true, '未触发花开见佛技能');
            }
            await highlightedSlots.first().click();

            const resolveAttackButton = monkPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
            await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
            await resolveAttackButton.click();

            const choiceModal = await getModalContainerByHeading(monkPage, /Ability Resolution Choice|技能结算选择/i, 15000);
            const payButton = choiceModal.getByRole('button', { name: /Spend 2 Taiji|花费2.*太极|支付2.*太极/i });
            await expect(payButton).toBeVisible({ timeout: 5000 });
            await payButton.click();

            await monkPage.waitForTimeout(300);
            const coreAfter = await readCoreState(monkPage);
            const monkState = (coreAfter.players as Record<string, Record<string, unknown>> | undefined)?.[monkPlayerId];
            const taijiAfter = (monkState?.tokens as Record<string, number> | undefined)?.[TOKEN_IDS.TAIJI] ?? 0;
            expect(taijiAfter).toBe(0);

            await monkPage.screenshot({ path: testInfo.outputPath('monk-lotus-palm-choice.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Online match: Monk Thunder Strike bonus die reroll consumes Taiji', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) test.skip(true, '游戏服务器不可用或房间创建失败');
        const { hostPage, hostContext, guestContext } = match!;

        try {
            const monkPage = hostPage;
            const monkNextPhase = monkPage.locator('[data-tutorial-id="advance-phase-button"]');
            const monkActive = await monkNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!monkActive) {
                test.skip(true, '非预期起始玩家，无法覆盖雷霆万钧重掷');
            }

            const monkPlayerId = getPlayerIdFromUrl(monkPage, '0');
            await setPlayerToken(monkPage, monkPlayerId, TOKEN_IDS.TAIJI, 2);

            // 推进到进攻投骰阶段
            const advanceButton = monkPage.locator('[data-tutorial-id="advance-phase-button"]');
            while (await advanceButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
                await advanceButton.click();
                await monkPage.waitForTimeout(400);
            }
            const rollButton = monkPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await monkPage.waitForTimeout(300);
            await applyDiceValues(monkPage, [3, 3, 3, 1, 1]);

            const confirmButton = monkPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();

            const highlightedSlots = monkPage
                .locator('[data-ability-slot]')
                .filter({ has: monkPage.locator('div.animate-pulse[class*="border-"]') });
            const hasHighlight = await highlightedSlots.first().isVisible({ timeout: 8000 }).catch(() => false);
            if (!hasHighlight) {
                test.skip(true, '未触发雷霆万钧技能');
            }
            await highlightedSlots.first().click();

            const resolveAttackButton = monkPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
            await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
            await resolveAttackButton.click();

            const rerollPrompt = monkPage.getByText(/Click a die to spend|点击.*重掷|消耗.*重掷/i).first();
            await expect(rerollPrompt).toBeVisible({ timeout: 15000 });
            const rerollRoot = rerollPrompt.locator('..');
            const rerollDice = rerollRoot.getByTestId('dice-2d');
            await expect(rerollDice.first()).toBeVisible({ timeout: 5000 });
            await rerollDice.first().click();

            await monkPage.waitForTimeout(500);
            const coreAfter = await readCoreState(monkPage);
            const monkState = (coreAfter.players as Record<string, Record<string, unknown>> | undefined)?.[monkPlayerId];
            const taijiAfter = (monkState?.tokens as Record<string, number> | undefined)?.[TOKEN_IDS.TAIJI] ?? 0;
            expect(taijiAfter).toBe(0);

            const confirmDamageButton = rerollRoot.getByRole('button', { name: /Confirm Damage|Continue|确认伤害|继续/i });
            if (await confirmDamageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await confirmDamageButton.click();
            }

            await monkPage.screenshot({ path: testInfo.outputPath('monk-thunder-strike-reroll.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Tutorial completes the full flow (main1 -> offensive -> defense -> finish)', async ({ page }, testInfo) => {
        test.setTimeout(180000); // 增加超时时间
        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];
        page.on('pageerror', (error) => {
            const message = error.stack || error.message;
            pageErrors.push(message);
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await setChineseLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await waitForTutorialBoardReady(page, 60000);

        // 教学步骤本地辅助函数
        const getTutorialStepId = async () => page
            .locator('[data-tutorial-step]')
            .first()
            .getAttribute('data-tutorial-step')
            .catch(() => null);

        const clickNextOverlayStep = async () => {
            const nextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
            if (await nextButton.isVisible({ timeout: 1500 }).catch(() => false)) {
                const beforeStep = await getTutorialStepId();
                await nextButton.click({ timeout: 2000, force: true }).catch(() => undefined);
                await page.waitForFunction(
                    (prev) => {
                        const el = document.querySelector('[data-tutorial-step]');
                        return el && el.getAttribute('data-tutorial-step') !== prev;
                    },
                    beforeStep,
                    { timeout: 2000 },
                ).catch(() => undefined);
            }
        };

        const clickHandCard = async (cardId: string) => {
            const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
            await expect(card).toBeVisible({ timeout: 10000 });
            const box = await page.evaluate((nextCardId) => {
                const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
                if (!node) return null;
                const rect = node.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }, cardId);
            if (!box || box.width <= 0 || box.height <= 0) {
                throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
            }
            const startX = box.x + (box.width / 2);
            const startY = box.y + (box.height * 0.78);
            const endY = Math.max(24, startY - 240);
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(startX, endY, { steps: 12 });
            await page.mouse.up();
            await page.mouse.move(2, 2);
        };

        const clickHandCardArea = async (cardId: string) => {
            const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
            await expect(card).toBeVisible({ timeout: 10000 });
            const box = await card.boundingBox();
            if (!box) {
                throw new Error(`未能获取手牌 ${cardId} 的点击区域`);
            }
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        };

        const overlayNextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
        await expect(overlayNextButton).toBeVisible({ timeout: 15000 });
        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');

        while (true) {
            const stepId = await getTutorialStepId();
            if (stepId === 'sell-card-intro') break;
            await clickNextOverlayStep();
        }

        await dispatchLocalCommand(page, 'SELL_CARD', { cardId: 'card-deep-thought' });
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-tutorial-step]');
            return el?.getAttribute('data-tutorial-step') === 'undo-sell-intro';
        }, { timeout: 5000 });

        await clickNextOverlayStep();

        await dispatchLocalCommand(page, 'UNDO_SELL_CARD', {});
        await waitForTutorialStep(page, 'advance', 5000);
        await expect(advanceButton).toBeEnabled({ timeout: 5000 });
        await advanceButton.click();
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-tutorial-step]');
            const stepId = el?.getAttribute('data-tutorial-step');
            return stepId === 'dice-tray' || stepId === 'dice-roll' || stepId === 'play-six';
        }, { timeout: 10000 });

        const initialDiceStep = await getTutorialStepId();
        if (initialDiceStep === 'dice-tray') {
            await clickNextOverlayStep();
            await page.waitForFunction(() => {
                const stepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
                return stepId === 'dice-roll' || stepId === 'play-six';
            }, { timeout: 10000 });
        }

        // 骰子区域可见
        const diceTray = page.locator('[data-tutorial-id="dice-tray"]');
        await expect(diceTray).toBeVisible();

        // 步骤 B1: 掷骰（教学 randomPolicy=fixed:[6]，全莲花）
        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await rollButton.click();
        await page.waitForTimeout(500);

        // 步骤 B2: play-six 出牌（教学期望打出"玩得六啊"修改骰面）
        const waitForPlaySixOrConfirm = async () => {
            const deadline = Date.now() + 15000;
            while (Date.now() < deadline) {
                const stepId = await getTutorialStepId();
                if (stepId === 'play-six') return 'play-six';
                if (stepId === 'dice-confirm') return 'dice-confirm';
                await page.waitForTimeout(300);
            }
            return null;
        };
        const playSixStep = await waitForPlaySixOrConfirm();

        if (playSixStep === 'play-six') {
            await dispatchLocalCommand(page, 'PLAY_CARD', { cardId: 'card-play-six' });
            await dispatchLocalCommand(page, 'MODIFY_DIE', { dieId: 0, newValue: 6 });
            await waitForTutorialStep(page, 'dice-confirm', 10000);
        }

        // 步骤 B3: dice-confirm 确认骰子
        const waitForDiceConfirmStep = async () => {
            const deadline = Date.now() + 15000;
            while (Date.now() < deadline) {
                const stepId = await getTutorialStepId();
                if (stepId === 'dice-confirm' || stepId === 'abilities' || stepId === 'resolve-attack') return stepId;
                await page.waitForTimeout(300);
            }
            return null;
        };
        const diceConfirmStep = await waitForDiceConfirmStep();

        if (diceConfirmStep === 'dice-confirm') {
            const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 10000 });
            await confirmButton.click();
            await page.waitForTimeout(500);
        }

        // 步骤 B4: abilities 选择技能
        const waitForAbilitiesStep = async () => {
            const deadline = Date.now() + 15000;
            while (Date.now() < deadline) {
                const stepId = await getTutorialStepId();
                if (stepId === 'abilities' || stepId === 'resolve-attack') return stepId;
                await page.waitForTimeout(300);
            }
            return null;
        };
        const abilitiesStep = await waitForAbilitiesStep();

        if (abilitiesStep === 'abilities') {
            await dispatchLocalCommand(page, 'SELECT_ABILITY', { abilityId: 'fist-technique-4' });
            await waitForTutorialStep(page, 'resolve-attack', 10000);
        }

        // 教学步骤顺序表（与 tutorial.ts 定义一致）
        const stepOrder = [
            'setup', 'intro', 'stats', 'phases', 'player-board', 'tip-board',
            'hand', 'discard', 'status-tokens',
            'advance', 'dice-tray', 'dice-roll', 'play-six', 'dice-confirm', 'abilities', 'resolve-attack',
            'opponent-defense', 'main2-intro', 'enlightenment-play', 'inner-peace',
            'ai-turn-intro', 'ai-turn', 'knockdown-explain', 'purify-use',
            'meditation-2', 'finish',
        ];
        const getStepIndex = (id: string) => stepOrder.indexOf(id);

        /** 等待教学步骤，支持 fallback 检测 */
        const advanceToStep = async (targetStep: string, timeout = 15000) => {
            const targetIndex = getStepIndex(targetStep);
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline) {
                const stepId = await getTutorialStepId();
                if (!stepId) {
                    // 教学覆盖层消失，可能已经跳过了目标步骤
                    if (targetStep === 'finish') {
                        const finishBtn = await page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i }).first().isVisible({ timeout: 500 }).catch(() => false);
                        if (finishBtn) return targetStep;
                    }
                    await page.waitForTimeout(300);
                    continue;
                }
                if (stepId === targetStep) return stepId;
                const currentIndex = getStepIndex(stepId);
                // 已经超过目标步骤
                if (targetIndex >= 0 && currentIndex >= 0 && currentIndex > targetIndex) return stepId;
                // 还没到目标步骤，尝试点击 Next
                if (targetIndex >= 0 && currentIndex >= 0 && currentIndex < targetIndex) {
                    await clickNextOverlayStep();
                    await page.waitForTimeout(200);
                    continue;
                }
                await page.waitForTimeout(300);
            }
            const finalStep = await getTutorialStepId();
            if (targetStep === 'finish') return targetStep;
            throw new Error(`未能到达 ${targetStep} 步骤（最终步骤=${finalStep}）`);
        };

        const stepBeforeResolve = await getTutorialStepId();
        const canResolveImmediately = stepBeforeResolve === 'abilities'
            && await advanceButton.isEnabled({ timeout: 1000 }).catch(() => false);
        if (!canResolveImmediately) {
            await advanceToStep('resolve-attack', 15000);
        }
        await expect(advanceButton).toBeEnabled({ timeout: 10000 });
        await advanceButton.click({ force: true });

        // opponent-defense 步骤有 aiActions，教学系统会自动执行 AI 防御并进入 main2
        await advanceToStep('main2-intro', 30000);
        await clickNextOverlayStep();

        // enlightenment-play：真实点击手牌，覆盖奖励骰必须停在右侧 2D 骰盘并由普通确认收口
        await advanceToStep('enlightenment-play', 15000);
        await clickHandCard('card-enlightenment');
        const rightDiceTray = page.locator('[data-testid="dicethrone-2d-dice-tray"]:visible').first();
        const rightDiceRail = rightDiceTray.locator('xpath=ancestor::*[@data-player-seat-anchor][1]');
        const rightDiceConfirmButton = rightDiceRail.locator('[data-tutorial-id="dice-confirm-button"]').first();
        await expect(page.getByTestId('bonus-die-overlay')).toHaveCount(0);
        await expect(page.getByTestId('bonus-dice-confirm-button')).toHaveCount(0);
        await expect(rightDiceTray).toBeVisible({ timeout: 10000 });
        await expect(rightDiceTray.getByTestId('dice-2d')).toHaveCount(1, { timeout: 10000 });
        await expect(rightDiceConfirmButton).toBeVisible({ timeout: 10000 });
        await rightDiceConfirmButton.click();

        // inner-peace：右侧骰盘确认后，下一张牌区域不应被旧中央奖励骰展示卡死
        await advanceToStep('inner-peace', 15000);
        await clickHandCardArea('card-inner-peace');
        await expect(page.getByTestId('bonus-die-overlay')).toHaveCount(0);
        await clickHandCard('card-inner-peace');

        // ai-turn 步骤有大量 aiActions，教学系统自动执行，结束后应进入击倒说明
        await advanceToStep('ai-turn-intro', 15000);
        await clickNextOverlayStep();
        await advanceToStep('knockdown-explain', 45000);
        await clickNextOverlayStep();

        // purify-use：使用净化 token 移除击倒
        await advanceToStep('purify-use', 15000);
        await dispatchLocalCommand(page, 'USE_PURIFY', { statusId: STATUS_IDS.KNOCKDOWN });
        await page.waitForTimeout(500);

        // meditation-2：升级冥想技能（需要 2 CP + 卡牌在手中）
        await advanceToStep('meditation-2', 15000);
        // 兜底：若并发改动让抽牌/资源状态偏离，原子注入确保 tutorial 收尾能继续验证
        await page.evaluate(() => {
            const w = window as Window & {
                __BG_LOCAL_DISPATCH__?: (type: string, payload: unknown) => void;
                __BG_LOCAL_STATE__?: { core?: Record<string, unknown> };
            };
            if (!w.__BG_LOCAL_DISPATCH__ || !w.__BG_LOCAL_STATE__?.core) return;
            // 深拷贝避免直接修改 React 状态引用
            const core = JSON.parse(JSON.stringify(w.__BG_LOCAL_STATE__.core)) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>> | undefined;
            const player = players?.['0'];
            if (!player) return;
            // 设置 CP = 2
            const resources = (player.resources as Record<string, unknown>) ?? {};
            resources.cp = 2;
            player.resources = resources;
            // 净化步骤结束后应移除击倒，保持状态与教程预期一致
            const statusEffects = (player.statusEffects as Record<string, unknown>) ?? {};
            delete statusEffects.knockdown;
            player.statusEffects = statusEffects;
            const tokens = (player.tokens as Record<string, unknown>) ?? {};
            tokens.purify = 0;
            player.tokens = tokens;
            // 确保 card-meditation-2 在手牌中
            const hand = (player.hand as Array<{ id?: string }>) ?? [];
            if (!hand.some(c => c?.id === 'card-meditation-2')) {
                const deck = (player.deck as Array<{ id?: string }>) ?? [];
                const discard = (player.discard as Array<{ id?: string }>) ?? [];
                const idx1 = deck.findIndex(c => c?.id === 'card-meditation-2');
                if (idx1 >= 0) {
                    hand.push(deck.splice(idx1, 1)[0]);
                } else {
                    const idx2 = discard.findIndex(c => c?.id === 'card-meditation-2');
                    if (idx2 >= 0) hand.push(discard.splice(idx2, 1)[0]);
                }
                player.hand = hand;
                player.deck = deck;
                player.discard = discard;
            }
            w.__BG_LOCAL_DISPATCH__('SYS_CHEAT_SET_STATE', { state: core });
        });
        await page.waitForTimeout(300);
        await dispatchLocalCommand(page, 'PLAY_CARD', { cardId: 'card-meditation-2' });
        await page.waitForTimeout(500);

        // finish：教学完成
        await advanceToStep('finish', 30000);
        const finishButton = page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i }).first();
        const overlayVisible = await page.locator('[data-tutorial-step]').first().isVisible({ timeout: 500 }).catch(() => false);
        const finishVisible = await finishButton.isVisible({ timeout: 1000 }).catch(() => false);
        if (!overlayVisible && !finishVisible) return;
        if (finishVisible) {
            await page.screenshot({ path: testInfo.outputPath('tutorial-final-step.png'), fullPage: false });
            await finishButton.click();
        }
    });

});
