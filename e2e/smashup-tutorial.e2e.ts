/**
 * 大杀四方（Smash Up）教程 E2E 测试
 *
 * 覆盖范围：
 * - 教程初始化与基础 UI 介绍
 * - 出牌阶段核心交互
 * - 完整教程流程
 * - 教程入口可达性
 * - 教程高亮目标存在性
 * - 手机横屏下教程浮层视口约束
 */

import { test, expect } from './framework';
import type { Page } from '@playwright/test';
import { setEnglishLocale, disableAudio, blockAudioRequests } from './helpers/common';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';

const waitForTutorialStep = async (page: Page, stepId: string, timeout = 30000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const clickNext = async (page: Page) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const nextBtn = page.getByRole('button', { name: /^Next$/i });
        await expect(nextBtn).toBeVisible({ timeout: 10000 });
        try {
            await nextBtn.click({ timeout: 5000 });
            return;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    await page.getByRole('button', { name: /^Next$/i }).click({ force: true });
};

const clickFinish = async (page: Page) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const finishBtn = page.getByRole('button', { name: /^Finish and return$/i });
        await expect(finishBtn).toBeVisible({ timeout: 10000 });
        try {
            await finishBtn.click({ timeout: 5000 });
            return;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    await page.getByRole('button', { name: /^Finish and return$/i }).click({ force: true });
};

const waitForActionPrompt = async (page: Page, timeout = 15000) => {
    await expect(page.locator('[data-tutorial-step] .animate-pulse')).toBeVisible({ timeout });
};

const navigateToTutorial = async (page: Page) => {
    await page.goto('/play/smashup/tutorial', { waitUntil: 'domcontentloaded' });
    // 冷启动时教程页会串行加载较长的前端模块链，15 秒在 E2E 环境下会偶发误杀。
    await page.waitForSelector('[data-game-page][data-game-id="smashup"]', { timeout: 30000 });
};

const readTutorialViewportMetrics = async (page: Page) => page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const shell = document.querySelector('.mobile-board-shell') as HTMLElement | null;
    const overlay = document.querySelector('[data-testid="tutorial-overlay-card"]') as HTMLElement | null;
    const nextButton = document.querySelector('[data-testid="tutorial-next-button"]') as HTMLElement | null;
    const overlayRect = overlay?.getBoundingClientRect() ?? null;
    const nextButtonRect = nextButton?.getBoundingClientRect() ?? null;
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    return {
        innerWidth,
        innerHeight,
        rootScrollWidth: root.scrollWidth,
        bodyScrollWidth: body.scrollWidth,
        runtimeViewportWidth: getComputedStyle(root).getPropertyValue('--runtime-viewport-width').trim(),
        runtimeViewportHeight: getComputedStyle(root).getPropertyValue('--runtime-viewport-height').trim(),
        shellRect: shell?.getBoundingClientRect() ?? null,
        overlayRect,
        nextButtonRect,
        overlayWidthRatio: overlayRect ? overlayRect.width / innerWidth : null,
        overlayHeightRatio: overlayRect ? overlayRect.height / innerHeight : null,
    };
});

const skipIntroSteps = async (page: Page) => {
    await waitForTutorialStep(page, 'welcome', 40000);
    for (const stepId of ['welcome', 'scoreboard', 'handIntro', 'turnTracker', 'endTurnBtn', 'playCardsExplain']) {
        await waitForTutorialStep(page, stepId, 10000);
        await clickNext(page);
    }
};

const doPlayMinion = async (page: Page) => {
    await waitForTutorialStep(page, 'playMinion', 10000);
    await waitForActionPrompt(page);
    await page.waitForTimeout(500);

    const handArea = page.locator('[data-testid="su-hand-area"]');
    await expect(handArea).toBeVisible();

    const handCards = handArea.locator('> div > div');
    await expect(handCards.first()).toBeVisible({ timeout: 10000 });
    await handCards.first().click({ force: true });
    await page.waitForTimeout(500);

    const bases = page.locator('.group\\/base');
    await expect(bases.first()).toBeVisible({ timeout: 5000 });
    await bases.first().click({ force: true });
    await page.waitForTimeout(1000);
};

const doPlayAction = async (page: Page) => {
    await waitForTutorialStep(page, 'playAction', 15000);
    await waitForActionPrompt(page);
    await page.waitForTimeout(500);

    const handArea = page.locator('[data-testid="su-hand-area"]');
    const actionCards = handArea.locator('> div > div');
    const bases = page.locator('.group\\/base');
    const count = await actionCards.count();

    for (let i = 0; i < count; i++) {
        await actionCards.nth(i).click({ force: true });
        await page.waitForTimeout(300);
        if (await bases.first().isVisible().catch(() => false)) {
            await bases.first().click({ force: true });
            await page.waitForTimeout(500);
        }
        if (!(await page.locator('[data-tutorial-step="playAction"]').isVisible({ timeout: 1000 }).catch(() => false))) {
            break;
        }
    }
};

const doUseTalent = async (page: Page) => {
    await waitForTutorialStep(page, 'useTalent', 15000);
    await waitForActionPrompt(page);
    await page.waitForTimeout(500);

    // 基地区随从容器本身负责 onClick -> dispatch USE_TALENT
    const baseArea = page.locator('[data-tutorial-id="su-base-area"]');
    await expect(baseArea).toBeVisible({ timeout: 5000 });
    const librarianMinion = baseArea.locator('[data-minion-def-id="miskatonic_librarian"]');
    await expect(librarianMinion.first()).toBeVisible({ timeout: 10000 });
    await librarianMinion.first().click({ force: true });
    await page.waitForTimeout(800);
};

const doEndPlayCards = async (page: Page) => {
    await waitForTutorialStep(page, 'endPlayCards', 15000);
    await waitForActionPrompt(page);
    const finishTurnButton = page.getByRole('button', { name: /^Finish Turn$/i });
    await expect(finishTurnButton).toBeVisible({ timeout: 5000 });
    await finishTurnButton.click({ force: true });
    await page.waitForTimeout(500);
};

test.describe('Smash Up Tutorial E2E', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ context }) => {
        await blockAudioRequests(context);
    });

    test('教程初始化与 UI 介绍可逐步推进', async ({ page }) => {
        test.setTimeout(90000);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await waitForTutorialStep(page, 'welcome', 40000);
        await expect(page.locator('[data-tutorial-id="su-base-area"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'scoreboard', 10000);
        await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'handIntro', 10000);
        await expect(page.locator('[data-tutorial-id="su-hand-area"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'turnTracker', 10000);
        await expect(page.locator('[data-tutorial-id="su-turn-tracker"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'endTurnBtn', 10000);
        await expect(page.locator('[data-tutorial-id="su-end-turn-btn"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'playCardsExplain', 10000);
        await expect(page.locator('[data-tutorial-id="su-hand-area"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'playMinion', 10000);
        await expect(page.getByRole('button', { name: /^Next$/i })).toHaveCount(0, { timeout: 3000 });
        await waitForActionPrompt(page);
    });

    test('出牌阶段可完成随从 行动和结束回合', async ({ page }) => {
        test.setTimeout(120000);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await skipIntroSteps(page);
        await doPlayMinion(page);
        await doPlayAction(page);
        await doUseTalent(page);
        await doEndPlayCards(page);
        await waitForTutorialStep(page, 'baseScoring', 15000);
    });

    test('完整教程流程可从开始推进到结束', async ({ page }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await waitForTutorialStep(page, 'welcome', 40000);
        await clickNext(page);
        for (const stepId of ['scoreboard', 'handIntro', 'turnTracker', 'endTurnBtn', 'playCardsExplain']) {
            await waitForTutorialStep(page, stepId, 10000);
            await clickNext(page);
        }

        await doPlayMinion(page);
        await doPlayAction(page);
        await doUseTalent(page);
        await doEndPlayCards(page);

        await waitForTutorialStep(page, 'baseScoring', 15000);
        await clickNext(page);

        await waitForTutorialStep(page, 'vpAwards', 10000);
        await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'scoringPhase', 15000);
        await clickNext(page);

        await waitForTutorialStep(page, 'drawExplain', 20000);
        await expect(page.locator('[data-tutorial-id="su-deck-discard"]')).toHaveCount(1);
        await clickNext(page);

        await waitForTutorialStep(page, 'handLimit', 10000);
        await clickNext(page);

        await waitForTutorialStep(page, 'endDraw', 10000);
        await clickNext(page);

        // opponentTurn 含 aiActions，TutorialOverlay 在该步不会渲染；直接等待自动推进后的 turnCycle
        await waitForTutorialStep(page, 'turnCycle', 40000);
        await clickNext(page);

        await waitForTutorialStep(page, 'summary', 10000);
        await clickNext(page);

        await waitForTutorialStep(page, 'finish', 10000);
        await expect(page.locator('[data-tutorial-id="su-base-area"]')).toBeVisible();
        await clickFinish(page);

        await expect(page.getByRole('button', { name: /^Finish and return$/i })).toHaveCount(0, { timeout: 10000 });
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tutorial-complete'),
            fullPage: false,
        });
    });

    test('首页可以进入教程路由', async ({ page }) => {
        test.setTimeout(120000);
        await setEnglishLocale(page);
        await disableAudio(page);

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('[data-game-id]').first()).toBeVisible({ timeout: 20000 });

        const card = page.locator('[data-game-id="smashup"]');
        if (await card.count() === 0) {
            const allTab = page.getByRole('button', { name: /^All Games$/i });
            if (await allTab.isVisible().catch(() => false)) {
                await allTab.click();
            }
        }

        await expect(card.first()).toBeVisible({ timeout: 15000 });
        await card.first().click();

        const tutorialBtn = page.getByRole('button', { name: /Tutorial/i });
        await expect(tutorialBtn).toBeVisible({ timeout: 10000 });
        await tutorialBtn.click();

        await page.waitForURL(/\/play\/smashup\/tutorial/, { timeout: 15000 });
        await waitForTutorialStep(page, 'welcome', 40000);
    });

    test('教程高亮目标与关键 UI 元素一一对应', async ({ page }) => {
        test.setTimeout(60000);
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await waitForTutorialStep(page, 'welcome', 40000);
        await expect(page.locator('[data-tutorial-id="su-base-area"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'scoreboard', 10000);
        await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'handIntro', 10000);
        await expect(page.locator('[data-tutorial-id="su-hand-area"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'turnTracker', 10000);
        await expect(page.locator('[data-tutorial-id="su-turn-tracker"]')).toBeVisible();
        await clickNext(page);

        await waitForTutorialStep(page, 'endTurnBtn', 10000);
        await expect(page.locator('[data-tutorial-id="su-end-turn-btn"]')).toBeVisible();
    });

    test('手机横屏下教程浮层不应跑出视口', async ({ page }, testInfo) => {
        test.setTimeout(60000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 812, height: 375 });
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await waitForTutorialStep(page, 'welcome', 40000);
        await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible({ timeout: 10000 });

        const metrics = await readTutorialViewportMetrics(page);
        expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.shellRect?.left ?? -1).toBeGreaterThanOrEqual(-1);
        expect(metrics.shellRect?.right ?? 99999).toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.overlayRect?.left ?? -1).toBeGreaterThanOrEqual(0);
        expect(metrics.overlayRect?.right ?? 99999).toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.overlayRect?.bottom ?? 99999).toBeLessThanOrEqual(metrics.innerHeight + 1);
        expect(metrics.overlayWidthRatio ?? 99999).toBeLessThanOrEqual(0.4);
        expect(metrics.overlayHeightRatio ?? 99999).toBeLessThanOrEqual(0.64);
        expect(metrics.nextButtonRect?.left ?? -1).toBeGreaterThanOrEqual(0);
        expect(metrics.nextButtonRect?.right ?? 99999).toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.nextButtonRect?.bottom ?? 99999).toBeLessThanOrEqual(metrics.innerHeight + 1);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tutorial-mobile-landscape', {
                filename: 'tutorial-mobile-landscape.png',
            }),
            fullPage: false,
        });
    });

    test('手机从竖屏旋转到横屏后教程画布不应塌成黑屏', async ({ page }, testInfo) => {
        test.setTimeout(60000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 375, height: 812 });
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await waitForTutorialStep(page, 'welcome', 40000);
        await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible({ timeout: 10000 });

        await page.setViewportSize({ width: 812, height: 375 });
        await page.waitForTimeout(800);

        const metrics = await readTutorialViewportMetrics(page);
        expect(metrics.runtimeViewportWidth).toBeTruthy();
        expect(metrics.runtimeViewportHeight).toBeTruthy();
        expect(metrics.shellRect?.width ?? 0).toBeGreaterThan(300);
        expect(metrics.shellRect?.height ?? 0).toBeGreaterThan(200);
        expect(metrics.overlayRect?.width ?? 0).toBeGreaterThan(120);
        expect(metrics.overlayRect?.height ?? 0).toBeGreaterThan(80);
        expect(metrics.nextButtonRect?.width ?? 0).toBeGreaterThan(60);
        expect(metrics.nextButtonRect?.height ?? 0).toBeGreaterThan(24);
        expect(metrics.overlayRect?.bottom ?? 99999).toBeLessThanOrEqual(metrics.innerHeight + 1);
        await expect(page.locator('.mobile-board-shell')).toBeVisible();
        await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible();

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tutorial-rotate-to-landscape', {
                filename: 'tutorial-rotate-to-landscape.png',
            }),
            fullPage: false,
        });
    });
});
