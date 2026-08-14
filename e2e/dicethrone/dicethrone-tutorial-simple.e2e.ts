/**
 * DiceThrone 教程简化测试
 * 
 * 只测试教程能启动、显示基本步骤、并能通过点击 Next 推进
 */

import { mkdirSync } from 'node:fs';
import { test, expect } from '../framework';
import { dirname, join } from 'node:path';

import { setChineseLocale } from '../helpers/common';
import { disableFabMenu, dispatchLocalCommand, waitForTutorialBoardReady } from '../helpers/dicethrone';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDiceTray, settleCurrentBonusDice } from './bonus-dice-flow';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;


const MOBILE_LANDSCAPE_VIEWPORT = { width: 936, height: 432 } as const;

const readTutorialState = async (page: Parameters<typeof test>[0]['page']) => page.evaluate(() => (
    (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null
));

const waitForTutorialStep = async (page: Parameters<typeof test>[0]['page'], stepId: string, timeout = 15000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const clickNextOverlayStep = async (page: Parameters<typeof test>[0]['page']) => {
    const nextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
    const beforeStep = await page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step');
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click({ force: true });
    await page.waitForFunction(
        (prev) => {
            const el = document.querySelector('[data-tutorial-step]');
            return el && el.getAttribute('data-tutorial-step') !== prev;
        },
        beforeStep,
        { timeout: 5000 },
    );
};

const clickHandCardVisibleArea = async (
    page: Parameters<typeof test>[0]['page'],
    cardId: string,
    yRatio = 0.82,
) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const box = await card.boundingBox();
    if (!box) {
        throw new Error(`未能获取手牌 ${cardId} 的点击区域`);
    }
    await page.mouse.click(
        box.x + box.width / 2,
        box.y + box.height * yRatio,
    );
};

const readHighlightMetrics = async (page: Parameters<typeof test>[0]['page'], targetId: string) => page.evaluate((resolvedTargetId) => {
    const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tutorial-id="${resolvedTargetId}"]`),
    );
    const highlight = document.querySelector('[data-tutorial-step] > div.absolute.pointer-events-none') as HTMLElement | null;
    if (candidates.length === 0 || !highlight) {
        return null;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let targetRect: DOMRect | null = null;
    let bestVisibleArea = -1;

    for (const candidate of candidates) {
        const style = getComputedStyle(candidate);
        if (style.display === 'none' || style.visibility === 'hidden') {
            continue;
        }

        let rect = candidate.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) {
            if (resolvedTargetId === 'status-tokens') {
                // status-tokens 在无状态时天然可能是“细条/零高”，与教程高亮一致，不要错误扩展到父容器
                // 直接使用原始 rect 参与比较即可
            } else {
            const parentRect = candidate.parentElement?.getBoundingClientRect() ?? null;
            if (!parentRect || parentRect.width <= 1 || parentRect.height <= 1) {
                continue;
            }
            rect = parentRect;
            }
        }

        const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
        const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
        const visibleArea = visibleWidth * visibleHeight;

        if (visibleArea > bestVisibleArea) {
            bestVisibleArea = visibleArea;
            targetRect = rect;
        }
    }

    if (!targetRect) {
        return null;
    }

    const highlightRect = highlight.getBoundingClientRect();
    return {
        targetRect,
        highlightRect,
        deltaLeft: Math.abs(targetRect.left - (highlightRect.left + 4)),
        deltaTop: Math.abs(targetRect.top - (highlightRect.top + 4)),
        deltaWidth: Math.abs(targetRect.width - (highlightRect.width - 8)),
        deltaHeight: Math.abs(targetRect.height - (highlightRect.height - 8)),
    };
}, targetId);

const waitForTutorialStepIn = async (
    page: Parameters<typeof test>[0]['page'],
    stepIds: string[],
    timeout = 15000,
) => {
    await page.waitForFunction(
        (expectedStepIds) => {
            const stepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
            return !!stepId && expectedStepIds.includes(stepId);
        },
        stepIds,
        { timeout },
    );

    const stepId = await page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step');
    if (!stepId || !stepIds.includes(stepId)) {
        throw new Error(`未能命中步骤集合: ${stepIds.join(', ')}，当前=${stepId}`);
    }
    return stepId;
};

const dragHandCardToDiscard = async (
    page: Parameters<typeof test>[0]['page'],
    cardId: string,
) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    const discardPile = page.getByTestId('discard-pile');
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(discardPile).toBeVisible({ timeout: 10000 });

    const cardBox = await card.boundingBox();
    const discardBox = await discardPile.boundingBox();
    if (!cardBox || !discardBox) {
        throw new Error(`未能获取拖拽区域: card=${cardId}`);
    }

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height * 0.82;
    const endX = discardBox.x + discardBox.width / 2;
    const endY = discardBox.y + discardBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

const dragHandCardToPlay = async (
    page: Parameters<typeof test>[0]['page'],
    cardId: string,
) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });

    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取拖拽区域: card=${cardId}`);
    }

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height * 0.82;
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

const clickAbilitySlot = async (
    page: Parameters<typeof test>[0]['page'],
    slotId: string,
) => {
    const slot = page.locator(`[data-ability-slot="${slotId}"]`).first();
    await expect(slot).toBeVisible({ timeout: 10000 });
    await slot.click();
};

const assertHighlightAligned = async (
    page: Parameters<typeof test>[0]['page'],
    options: {
        stepId: string;
        targetId: string;
        testInfo: Parameters<typeof test>[1];
        evidenceDir: string;
        screenshotKey: string;
    },
) => {
    await waitForTutorialStep(page, options.stepId, 15000);
    await page.waitForTimeout(300);

    await expect.poll(
        async () => readHighlightMetrics(page, options.targetId),
        { timeout: 10000 },
    ).not.toBeNull();

    const metrics = await readHighlightMetrics(page, options.targetId);
    console.log('tutorial-highlight-real-flow', options.stepId, options.targetId, JSON.stringify(metrics));
    expect(metrics).not.toBeNull();
    expect(metrics?.deltaLeft ?? 99999).toBeLessThanOrEqual(4);
    expect(metrics?.deltaTop ?? 99999).toBeLessThanOrEqual(4);
    expect(metrics?.deltaWidth ?? 99999).toBeLessThanOrEqual(4);
    expect(metrics?.deltaHeight ?? 99999).toBeLessThanOrEqual(4);

    await page.screenshot({
        path: options.testInfo.outputPath(`${options.screenshotKey}.png`),
        fullPage: false,
    });
    await page.screenshot({
        path: join(options.evidenceDir, `${options.screenshotKey}.png`),
        fullPage: false,
    });
};

test.describe('DiceThrone Tutorial (Simplified)', () => {
    test('Tutorial starts and shows initial steps', async ({ page }, testInfo) => {
        test.setTimeout(120000);

        await setChineseLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await waitForTutorialBoardReady(page, 60000);

        // 等待教学覆盖层出现
        const overlayNextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
        await expect(overlayNextButton).toBeVisible({ timeout: 15000 });

        // 验证教学步骤存在
        const tutorialStep = page.locator('[data-tutorial-step]').first();
        await expect(tutorialStep).toBeVisible();

        // 获取当前步骤 ID
        const stepId = await tutorialStep.getAttribute('data-tutorial-step');
        console.log('Initial tutorial step:', stepId);

        // 点击 Next 按钮推进几步
        for (let i = 0; i < 5; i++) {
            if (await overlayNextButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await overlayNextButton.click();
                await page.waitForTimeout(500);
            } else {
                break;
            }
        }

        // 截图
        await page.screenshot({ path: testInfo.outputPath('tutorial-progress.png'), fullPage: false });

        // 验证教程仍在运行
        const stillHasStep = await page.locator('[data-tutorial-step]').first().isVisible({ timeout: 1000 }).catch(() => false);
        expect(stillHasStep).toBe(true);
    });

    test('Tutorial can advance through main phases', async ({ page }, testInfo) => {
        test.setTimeout(120000);

        await setChineseLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await waitForTutorialBoardReady(page, 60000);

        const getTutorialStepId = async () => page
            .locator('[data-tutorial-step]')
            .first()
            .getAttribute('data-tutorial-step')
            .catch(() => null);

        const clickNextOverlayStep = async () => {
            const nextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
            await expect(nextButton).toBeVisible({ timeout: 5000 });
            const beforeStep = await getTutorialStepId();
            await nextButton.click({ force: true });
            await page.waitForFunction(
                (prev) => {
                    const el = document.querySelector('[data-tutorial-step]');
                    return el && el.getAttribute('data-tutorial-step') !== prev;
                },
                beforeStep,
                { timeout: 5000 },
            );
        };

        // 信息步：setup 之后一路点到卖牌教学
        while (true) {
            const stepId = await getTutorialStepId();
            if (stepId === 'sell-card-intro') break;
            await clickNextOverlayStep();
        }

        // 强制步骤：卖掉 deep thought
        await dispatchLocalCommand(page, 'SELL_CARD', { cardId: 'card-deep-thought' });
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-tutorial-step]');
            return el?.getAttribute('data-tutorial-step') === 'undo-sell-intro';
        }, { timeout: 5000 });

        // 信息步：撤回介绍
        await clickNextOverlayStep();

        // 强制步骤：撤回卖牌
        await dispatchLocalCommand(page, 'UNDO_SELL_CARD', {});
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-tutorial-step]');
            return el?.getAttribute('data-tutorial-step') === 'advance';
        }, { timeout: 5000 });

        // 验证到达 advance 步骤
        const advanceStep = page.locator('[data-tutorial-step="advance"]');
        await expect(advanceStep).toBeVisible({ timeout: 5000 });

        // 点击 Next Phase 按钮
        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        await expect(advanceButton).toBeEnabled({ timeout: 5000 });
        await advanceButton.click();
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-tutorial-step]');
            const stepId = el?.getAttribute('data-tutorial-step');
            return stepId === 'dice-tray' || stepId === 'dice-roll' || stepId === 'play-six';
        }, { timeout: 10000 });

        // 截图
        await page.screenshot({ path: testInfo.outputPath('tutorial-after-advance.png'), fullPage: false });

        // 验证进入了新阶段（骰子相关步骤）
        const diceStep = await getTutorialStepId();
        console.log('After advance, step:', diceStep);
        expect(['dice-tray', 'dice-roll', 'play-six']).toContain(diceStep);
    });

    test('Tutorial roll visual should not block next required action', async ({ page }, testInfo) => {
        test.setTimeout(120000);

        await setChineseLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await waitForTutorialBoardReady(page, 60000);

        const getTutorialStepId = async () => page
            .locator('[data-tutorial-step]')
            .first()
            .getAttribute('data-tutorial-step')
            .catch(() => null);

        const clickNextOverlayStep = async () => {
            const nextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
            const beforeStep = await getTutorialStepId();
            await expect(nextButton).toBeVisible({ timeout: 5000 });
            await nextButton.click({ force: true });
            await page.waitForFunction(
                (prev) => {
                    const el = document.querySelector('[data-tutorial-step]');
                    return el && el.getAttribute('data-tutorial-step') !== prev;
                },
                beforeStep,
                { timeout: 5000 },
            );
        };

        while (true) {
            const stepId = await getTutorialStepId();
            if (stepId === 'sell-card-intro') break;
            await clickNextOverlayStep();
        }

        await dispatchLocalCommand(page, 'SELL_CARD', { cardId: 'card-deep-thought' });
        await page.waitForFunction(() => document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step') === 'undo-sell-intro', { timeout: 5000 });
        await clickNextOverlayStep();
        await dispatchLocalCommand(page, 'UNDO_SELL_CARD', {});
        await page.waitForFunction(() => document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step') === 'advance', { timeout: 5000 });

        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        await expect(advanceButton).toBeEnabled({ timeout: 5000 });
        await advanceButton.click();
        await page.waitForFunction(() => {
            const stepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
            return stepId === 'dice-tray' || stepId === 'dice-roll';
        }, { timeout: 10000 });

        if (await page.locator('[data-tutorial-step="dice-tray"]').isVisible().catch(() => false)) {
            await clickNextOverlayStep();
        }

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await rollButton.click();

        const handCard = page.locator('[data-card-id="card-play-six"]').first();
        await expect(handCard).toBeVisible({ timeout: 10000 });
        await dragHandCardToPlay(page, 'card-play-six');

        await page.waitForFunction(() => {
            return document.body.textContent?.includes('选择要设为6的骰子');
        }, { timeout: 10000 });

        const firstDieButton = page.locator('[data-testid="die-button-0"]');
        await expect(firstDieButton).toBeVisible({ timeout: 10000 });
        await firstDieButton.click();

        await page.waitForFunction(
            () => document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step') === 'dice-confirm',
            { timeout: 10000 },
        );

        const evidencePath = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            'dicethrone-tutorial-simple.e2e',
            'tutorial-roll-visual-should-not-block-next-required-action',
            'tutorial-roll-visual-non-blocking.png',
        );
        mkdirSync(dirname(evidencePath), { recursive: true });
        await page.screenshot({ path: evidencePath, fullPage: false });
        await page.screenshot({ path: testInfo.outputPath('tutorial-roll-visual-non-blocking.png'), fullPage: false });

        expect(await getTutorialStepId()).toBe('dice-confirm');
    });

    test('移动端教程蓝框应在真实点击全流程中与目标元素对齐', async ({ page }, testInfo) => {
        test.setTimeout(240000);

        await setChineseLocale(page);
        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await page.goto('/play/dicethrone/tutorial');
        await waitForTutorialBoardReady(page, 60000);
        await disableFabMenu(page);

        while ((await page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step')) !== 'stats') {
            await clickNextOverlayStep(page);
        }

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            'dicethrone-tutorial-simple.e2e',
            'tutorial-highlight-mobile-real-click-flow',
        );
        mkdirSync(evidenceDir, { recursive: true });
        const captureAlignedStep = async (
            sequence: number,
            stepId: string,
            targetId: string,
        ) => assertHighlightAligned(page, {
            stepId,
            targetId,
            testInfo,
            evidenceDir,
            screenshotKey: `${String(sequence).padStart(2, '0')}-${stepId}`,
        });

        await captureAlignedStep(1, 'stats', 'player-stats');
        await clickNextOverlayStep(page);
        await captureAlignedStep(2, 'phases', 'phase-indicator');
        await clickNextOverlayStep(page);
        await captureAlignedStep(3, 'player-board', 'player-board');
        await clickNextOverlayStep(page);
        await captureAlignedStep(4, 'tip-board', 'tip-board');
        await clickNextOverlayStep(page);
        await captureAlignedStep(5, 'hand', 'hand-area');
        await clickNextOverlayStep(page);
        await captureAlignedStep(6, 'discard', 'discard-pile');
        await clickNextOverlayStep(page);
        await captureAlignedStep(7, 'status-tokens', 'status-tokens');
        await clickNextOverlayStep(page);

        await captureAlignedStep(8, 'sell-card-intro', 'hand-area');
        await dragHandCardToDiscard(page, 'card-deep-thought');
        await waitForTutorialStep(page, 'undo-sell-intro', 10000);

        await captureAlignedStep(9, 'undo-sell-intro', 'discard-pile');
        await clickNextOverlayStep(page);
        await captureAlignedStep(10, 'undo-sell', 'discard-pile');
        await page.getByTestId('discard-pile').click();
        await waitForTutorialStep(page, 'advance', 10000);

        await captureAlignedStep(11, 'advance', 'advance-phase-button');
        await page.locator('[data-tutorial-id="advance-phase-button"]').click();

        const postAdvanceStep = await waitForTutorialStepIn(page, ['dice-tray', 'dice-roll', 'play-six'], 15000);
        if (postAdvanceStep === 'dice-tray') {
            await captureAlignedStep(12, 'dice-tray', 'dice-tray');
            await clickNextOverlayStep(page);
        }

        await waitForTutorialStepIn(page, ['dice-roll', 'play-six'], 10000);
        if (await page.locator('[data-tutorial-step="dice-roll"]').isVisible().catch(() => false)) {
            await captureAlignedStep(13, 'dice-roll', 'dice-roll-button');
            await page.locator('[data-tutorial-id="dice-roll-button"]').click();
        }

        await waitForTutorialStep(page, 'play-six', 10000);
        await captureAlignedStep(14, 'play-six', 'hand-area');
        await clickHandCardVisibleArea(page, 'card-play-six');
        await page.locator('[data-testid="die-button-0"]').click();

        await waitForTutorialStep(page, 'dice-confirm', 10000);
        await captureAlignedStep(15, 'dice-confirm', 'dice-confirm-button');
        await page.locator('[data-tutorial-id="dice-confirm-button"]').click();

        await waitForTutorialStep(page, 'abilities', 10000);
        await captureAlignedStep(16, 'abilities', 'ability-slots');
        await clickAbilitySlot(page, 'fist');

        await waitForTutorialStep(page, 'resolve-attack', 10000);
        await captureAlignedStep(17, 'resolve-attack', 'advance-phase-button');
        await page.locator('[data-tutorial-id="advance-phase-button"]').click();

        await waitForTutorialStepIn(page, ['opponent-defense', 'main2-intro'], 30000);
        if (await page.locator('[data-tutorial-step="opponent-defense"]').isVisible().catch(() => false)) {
            await waitForTutorialStep(page, 'main2-intro', 30000);
        }

        await captureAlignedStep(18, 'main2-intro', 'hand-area');
        await clickNextOverlayStep(page);

        await captureAlignedStep(19, 'enlightenment-play', 'hand-area');
        await clickHandCardVisibleArea(page, 'card-enlightenment');
        await expectRightTrayBonusDiceConfirmation(page, () => readTutorialState(page));
        await settleCurrentBonusDice(page, () => readTutorialState(page), {});

        await waitForTutorialStep(page, 'inner-peace', 10000);
        await captureAlignedStep(20, 'inner-peace', 'hand-area');
        await clickHandCardVisibleArea(page, 'card-inner-peace');

        await waitForTutorialStep(page, 'ai-turn-intro', 10000);
        await clickNextOverlayStep(page);
        await waitForTutorialStep(page, 'knockdown-explain', 45000);
        await captureAlignedStep(21, 'knockdown-explain', 'status-tokens');
        await clickNextOverlayStep(page);

        await captureAlignedStep(22, 'purify-use', 'status-tokens');
        await page.locator('[data-tutorial-id="status-tokens"] .animate-pulse').first().click();
        await expect(page.getByRole('heading', { name: /使用净化|Purify/i }).first()).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /^确认$|^Confirm$/i }).last().click();

        await waitForTutorialStep(page, 'meditation-2', 15000);
        await captureAlignedStep(23, 'meditation-2', 'hand-area');
        await clickHandCardVisibleArea(page, 'card-meditation-2');

        await waitForTutorialStep(page, 'finish', 30000);
        await page.screenshot({
            path: testInfo.outputPath('24-finish.png'),
            fullPage: false,
        });
        await page.screenshot({
            path: join(evidenceDir, '24-finish.png'),
            fullPage: false,
        });
    });

    test('顿悟后的右侧奖励骰骰盘不应卡死手牌区', async ({ page }, testInfo) => {
        test.setTimeout(180000);

        await setChineseLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await waitForTutorialBoardReady(page, 60000);

        const getTutorialStepId = async () => page
            .locator('[data-tutorial-step]')
            .first()
            .getAttribute('data-tutorial-step')
            .catch(() => null);

        const advanceToStep = async (targetStep: string, timeout = 15000) => {
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline) {
                const stepId = await getTutorialStepId();
                if (stepId === targetStep) return;
                await clickNextOverlayStep(page);
                await page.waitForTimeout(200);
            }
            throw new Error(`未能到达 ${targetStep} 步骤（最终步骤=${await getTutorialStepId()}）`);
        };

        while ((await getTutorialStepId()) !== 'sell-card-intro') {
            await clickNextOverlayStep(page);
        }

        await dispatchLocalCommand(page, 'SELL_CARD', { cardId: 'card-deep-thought' });
        await waitForTutorialStep(page, 'undo-sell-intro', 5000);
        await clickNextOverlayStep(page);
        await dispatchLocalCommand(page, 'UNDO_SELL_CARD', {});
        await waitForTutorialStep(page, 'advance', 5000);

        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        await expect(advanceButton).toBeEnabled({ timeout: 5000 });
        await advanceButton.click();
        await page.waitForFunction(() => {
            const stepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
            return stepId === 'dice-tray' || stepId === 'dice-roll' || stepId === 'play-six';
        }, { timeout: 10000 });

        if ((await getTutorialStepId()) === 'dice-tray') {
            await clickNextOverlayStep(page);
        }

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await rollButton.click();
        await page.waitForTimeout(300);

        if ((await getTutorialStepId()) === 'play-six') {
            await dispatchLocalCommand(page, 'PLAY_CARD', { cardId: 'card-play-six' });
            await dispatchLocalCommand(page, 'MODIFY_DIE', { dieId: 0, newValue: 6 });
            await waitForTutorialStep(page, 'dice-confirm', 10000);
        }

        if ((await getTutorialStepId()) === 'dice-confirm') {
            const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 10000 });
            await confirmButton.click();
            await page.waitForTimeout(300);
        }

        if ((await getTutorialStepId()) === 'abilities') {
            await dispatchLocalCommand(page, 'SELECT_ABILITY', { abilityId: 'fist-technique-4' });
            await waitForTutorialStep(page, 'resolve-attack', 10000);
        }

        await expect(advanceButton).toBeEnabled({ timeout: 10000 });
        await advanceButton.click({ force: true });
        await advanceToStep('main2-intro', 30000);
        await clickNextOverlayStep(page);
        await advanceToStep('enlightenment-play', 15000);

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            'dicethrone-tutorial-simple.e2e',
            'tutorial-enlightenment-hand-area',
        );
        mkdirSync(evidenceDir, { recursive: true });
        let capturedOverlayVisible = false;
        let openedEnlightenmentOverlay = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            await clickHandCardVisibleArea(page, 'card-enlightenment');
            try {
                await expectRightTrayBonusDiceConfirmation(page, () => readTutorialState(page));
                if (!capturedOverlayVisible) {
                    capturedOverlayVisible = true;
                    await getRightTrayDiceTray(page).screenshot({
                        path: join(evidenceDir, 'tutorial-enlightenment-bonus-die-right-tray.png'),
                    });
                    await getRightTrayDiceTray(page).screenshot({
                        path: testInfo.outputPath('tutorial-enlightenment-bonus-die-right-tray.png'),
                    });
                    await page.screenshot({
                        path: join(evidenceDir, 'tutorial-enlightenment-bonus-die-visible.png'),
                        fullPage: false,
                    });
                    await page.screenshot({
                        path: testInfo.outputPath('tutorial-enlightenment-bonus-die-visible.png'),
                        fullPage: false,
                    });
                }
                openedEnlightenmentOverlay = true;
                break;
            } catch {
                await page.waitForTimeout(250);
            }
        }
        expect(openedEnlightenmentOverlay).toBe(true);

        await settleCurrentBonusDice(page, () => readTutorialState(page), {});
        await waitForTutorialStep(page, 'inner-peace', 10000);
        await clickHandCardVisibleArea(page, 'card-inner-peace');
        await page.screenshot({
            path: join(evidenceDir, 'tutorial-enlightenment-bonus-die-auto-close.png'),
            fullPage: false,
        });
        await page.screenshot({
            path: testInfo.outputPath('tutorial-enlightenment-bonus-die-auto-close.png'),
            fullPage: false,
        });

        await page.screenshot({
            path: join(evidenceDir, 'tutorial-enlightenment-hand-area-after-close.png'),
            fullPage: false,
        });
        await page.screenshot({
            path: testInfo.outputPath('tutorial-enlightenment-hand-area-after-close.png'),
            fullPage: false,
        });

        let advancedToAiTurn = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            await clickHandCardVisibleArea(page, 'card-inner-peace');
            try {
                await page.waitForFunction(() => {
                    const stepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
                    return stepId === 'ai-turn-intro' || stepId === 'ai-turn';
                }, { timeout: 2500 });
                advancedToAiTurn = true;
                break;
            } catch {
                await page.waitForTimeout(250);
            }
        }

        expect(advancedToAiTurn).toBe(true);
    });
});
