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
import type { Locator, Page } from '@playwright/test';
import { setEnglishLocale, disableAudio, blockAudioRequests } from './helpers/common';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';

type InteractionOption = {
    id: string;
    label?: string;
    value?: Record<string, unknown>;
};

const waitForTutorialStep = async (page: Page, stepId: string, timeout = 30000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const clickNext = async (page: Page) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const nextBtn = page.getByRole('button', { name: /^(Next|下一步)$/i });
        await expect(nextBtn).toBeVisible({ timeout: 10000 });
        try {
            await nextBtn.click({ timeout: 5000 });
            return;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    await page.getByRole('button', { name: /^(Next|下一步)$/i }).click({ force: true });
};

const clickFinish = async (page: Page) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const finishBtn = page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i });
        await expect(finishBtn).toBeVisible({ timeout: 10000 });
        try {
            await finishBtn.click({ timeout: 5000 });
            return;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    await page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i }).click({ force: true });
};

const waitForInteractionSource = async (game: { getState: () => Promise<unknown> }, sourceId: string, timeout = 10000) => {
    await expect.poll(async () => {
        const state = await game.getState() as {
            sys?: {
                interaction?: {
                    current?: {
                        data?: {
                            sourceId?: string | null;
                        };
                    };
                };
            };
        };
        return state.sys?.interaction?.current?.data?.sourceId ?? null;
    }, { timeout }).toBe(sourceId);
};

const selectInteractionOption = async (
    game: {
        getInteractionOptions: () => Promise<unknown[]>;
        selectOption: (optionId: string) => Promise<void>;
    },
    matcher: (option: InteractionOption) => boolean,
    description: string,
) => {
    const options = await game.getInteractionOptions() as InteractionOption[];
    const option = options.find(matcher);
    expect(option, `未找到交互选项：${description}`).toBeTruthy();
    await game.selectOption(option!.id);
};

const waitForActionPrompt = async (page: Page, timeout = 15000) => {
    await expect(page.locator('[data-tutorial-step] .animate-pulse')).toBeVisible({ timeout });
};

const navigateToTutorial = async (page: Page, path = '/play/smashup/tutorial') => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    // 冷启动时教程页会串行加载游戏实现 + namespace + 教程初始化链路，
    // 移动端横屏回归场景下比普通页面更慢，30 秒偶发误杀。
    await page.waitForSelector('[data-game-page][data-game-id="smashup"]', { timeout: 60000 });
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

const readTutorialOcclusionMetrics = async (page: Page, targetSelector: string) => page.evaluate((selector) => {
    const overlay = document.querySelector('[data-testid="tutorial-overlay-card"]') as HTMLElement | null;
    const target = document.querySelector(selector) as HTMLElement | null;
    const overlayRect = overlay?.getBoundingClientRect() ?? null;
    const targetRect = target?.getBoundingClientRect() ?? null;
    const overlapWidth = overlayRect && targetRect
        ? Math.max(0, Math.min(overlayRect.right, targetRect.right) - Math.max(overlayRect.left, targetRect.left))
        : 0;
    const overlapHeight = overlayRect && targetRect
        ? Math.max(0, Math.min(overlayRect.bottom, targetRect.bottom) - Math.max(overlayRect.top, targetRect.top))
        : 0;
    return {
        overlayRect,
        targetRect,
        overlapArea: overlapWidth * overlapHeight,
        placement: overlay?.dataset.tutorialPlacement ?? null,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
    };
}, targetSelector);

const sampleElementRectDrift = async (page: Page, selector: string, samples = 6, intervalMs = 120) => page.evaluate(
    async ({ selector: elementSelector, samples: sampleCount, intervalMs: sampleIntervalMs }) => {
        const collect = () => {
            const element = document.querySelector(elementSelector) as HTMLElement | null;
            if (!element) {
                return null;
            }
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                transform: style.transform,
                opacity: style.opacity,
            };
        };

        const results: Array<ReturnType<typeof collect>> = [];
        for (let index = 0; index < sampleCount; index += 1) {
            results.push(collect());
            if (index < sampleCount - 1) {
                await new Promise((resolve) => window.setTimeout(resolve, sampleIntervalMs));
            }
        }

        return results;
    },
    { selector, samples, intervalMs },
);

const skipIntroSteps = async (page: Page) => {
    await waitForTutorialStep(page, 'welcome', 40000);
    for (const stepId of ['welcome', 'scoreboard', 'handIntro', 'turnTracker', 'endTurnBtn', 'playCardsExplain']) {
        await waitForTutorialStep(page, stepId, 10000);
        await clickNext(page);
    }
};

const clickHandCard = async (page: Page, locator: Locator) => {
    await expect(locator).toBeVisible({ timeout: 10000 });
    await locator.click();
    await page.waitForTimeout(300);
};

const clickLocatorCenter = async (page: Page, locator: Locator) => {
    await expect(locator).toBeVisible({ timeout: 10000 });
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    await page.waitForTimeout(300);
};

const expectTutorialPlacementAwayFromBoardCenter = (placement: string | null) => {
    expect(placement === 'left' || placement === 'right').toBe(true);
};

const expectTutorialPanelKeepsCenterLaneClear = (metrics: {
    placement: string | null;
    overlayRect: { left: number; right: number } | null;
    viewport: { width: number };
}) => {
    if (metrics.placement === 'left') {
        expect(metrics.overlayRect?.right ?? 99999).toBeLessThan(metrics.viewport.width * 0.42);
        return;
    }

    if (metrics.placement === 'right') {
        expect(metrics.overlayRect?.left ?? -1).toBeGreaterThan(metrics.viewport.width * 0.58);
        return;
    }

    throw new Error(`教程浮层未落在左右贴边位置: ${metrics.placement ?? 'null'}`);
};

const doPlayMinion = async (page: Page) => {
    await waitForTutorialStep(page, 'playMinion', 10000);
    await waitForActionPrompt(page);
    await page.waitForTimeout(500);

    const handArea = page.locator('[data-testid="su-hand-area"]');
    await expect(handArea).toBeVisible();

    const handCards = handArea.locator('> div > div');
    await expect(handCards.first()).toBeVisible({ timeout: 10000 });
    await clickHandCard(page, handCards.first());
    await page.waitForTimeout(500);

    const bases = page.locator('.group\\/base');
    await expect(bases.first()).toBeVisible({ timeout: 5000 });
    await clickLocatorCenter(page, bases.first());
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
        await clickHandCard(page, actionCards.nth(i));
        await page.waitForTimeout(300);
        if (!(await page.locator('[data-tutorial-step="playAction"]').isVisible({ timeout: 1000 }).catch(() => false))) {
            break;
        }
        await clickHandCard(page, actionCards.nth(i));
        await page.waitForTimeout(500);
        if (await bases.first().isVisible().catch(() => false)) {
            await clickLocatorCenter(page, bases.first());
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
    await clickLocatorCenter(page, librarianMinion.first());
    await page.waitForTimeout(800);
};

const doEndPlayCards = async (page: Page) => {
    await waitForTutorialStep(page, 'endPlayCards', 15000);
    await waitForActionPrompt(page);
    const finishTurnButton = page.getByRole('button', { name: /^(Finish Turn|结束回合)$/i });
    await expect(finishTurnButton).toBeVisible({ timeout: 5000 });
    await finishTurnButton.click();
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

    test('派系没有机制教程时不显示详情入口占位', async ({ page }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await setEnglishLocale(page);
        await disableAudio(page);

        await page.goto('/play/smashup', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-game-page][data-game-id="smashup"]', { timeout: 30000 });

        const robotsOption = page.getByTestId('faction-option-robots');
        await expect(robotsOption).toBeVisible({ timeout: 20000 });
        await robotsOption.click({ force: true });

        const detailPanel = page.getByTestId('faction-detail-panel');
        await expect(detailPanel).toBeVisible({ timeout: 10000 });
        await expect(detailPanel.locator('h2').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('faction-mechanic-tutorial-entry')).toHaveCount(0);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'robots-detail-no-entry', {
                filename: 'robots-detail-no-entry.png',
            }),
            fullPage: false,
        });
    });

    test('派系详情标题右侧机制教程入口可进入牛仔决斗子教程并完成主流程', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await setEnglishLocale(page);
        await disableAudio(page);

        await page.goto('/play/smashup', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-game-page][data-game-id="smashup"]', { timeout: 30000 });

        const cowboysOption = page.getByTestId('faction-option-cowboys');
        await expect(cowboysOption).toBeVisible({ timeout: 20000 });
        await cowboysOption.click({ force: true });

        const detailPanel = page.getByTestId('faction-detail-panel');
        const titleLocator = detailPanel.locator('h2').first();
        const tutorialEntry = page.getByTestId('faction-mechanic-tutorial-entry');
        await expect(detailPanel).toBeVisible({ timeout: 10000 });
        await expect(titleLocator).toBeVisible({ timeout: 10000 });
        await expect(tutorialEntry).toBeVisible({ timeout: 10000 });

        const titleBox = await titleLocator.boundingBox();
        const entryBox = await tutorialEntry.boundingBox();
        expect(titleBox).toBeTruthy();
        expect(entryBox).toBeTruthy();
        expect((entryBox?.x ?? 0) + 8).toBeGreaterThan((titleBox?.x ?? 0) + (titleBox?.width ?? 0));
        expect(Math.abs((entryBox?.y ?? 0) - (titleBox?.y ?? 0))).toBeLessThan(36);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'cowboys-detail-entry', {
                filename: 'cowboys-detail-entry.png',
            }),
            fullPage: false,
        });

        await tutorialEntry.click();
        await page.waitForURL(/\/play\/smashup\/tutorial\/cowboys-duel$/, { timeout: 15000 });
        await waitForTutorialStep(page, 'duelIntro', 40000);
        await clickNext(page);

        await waitForTutorialStep(page, 'playGunfighter', 10000);
        await page.locator('[data-testid="su-hand-area"] [data-card-uid="gun-1"]').click({ force: true });
        await page.locator('[data-base-index="0"]').click({ force: true });
        await clickLocatorCenter(page, page.locator('[data-minion-uid="enemy-1"]'));

        await waitForTutorialStep(page, 'pecosBillWindow', 10000);
        await waitForInteractionSource(game, 'titan_pecos_bill_duel_start');
        await selectInteractionOption(game, option => option.value?.skip === true, 'Pecos Bill 跳过');

        await waitForTutorialStep(page, 'pinkertonCounter', 10000);
        await waitForInteractionSource(game, 'smashup_duel_pinkerton');
        await page.getByRole('button', { name: /Place 1 counter|放置 1 个指示物/i }).click();

        await waitForTutorialStep(page, 'duelCard', 10000);
        await waitForInteractionSource(game, 'smashup_duel_card');
        await selectInteractionOption(game, option => option.value?.skip === true, '决斗牌跳过');

        await waitForTutorialStep(page, 'deputyBoost', 20000);
        await waitForInteractionSource(game, 'smashup_duel_deputy_card');
        await page.locator('[data-testid="su-hand-area"] [data-card-uid="deputy-1"]').click();
        await waitForInteractionSource(game, 'smashup_duel_deputy_target');
        await clickLocatorCenter(page, page.locator('[data-minion-uid="gun-1"]'));

        await expect.poll(async () => {
            const state = await game.getState() as {
                core: {
                    bases: Array<{ minions: Array<{ uid: string }> }>;
                    players: Record<string, { discard: Array<{ uid: string }> }>;
                    activeDuel?: unknown;
                };
            };
            return {
                enemyGone: !state.core.bases[0].minions.some((minion) => minion.uid === 'enemy-1'),
                deputyDiscarded: state.core.players['0'].discard.some((card) => card.uid === 'deputy-1'),
                activeDuel: state.core.activeDuel ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            enemyGone: true,
            deputyDiscarded: true,
            activeDuel: null,
        });

        await waitForTutorialStep(page, 'finish', 10000);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'cowboys-duel-resolved', {
                filename: 'cowboys-duel-resolved.png',
            }),
            fullPage: false,
        });
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'cowboys-duel-finish', {
                filename: 'cowboys-duel-finish.png',
            }),
            fullPage: false,
        });

        await clickFinish(page);
        await page.waitForURL(/\/play\/smashup$/, { timeout: 15000 });
        await expect(page.getByTestId('faction-option-cowboys')).toBeVisible({ timeout: 15000 });
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

    test('手机横屏下主教程关键交互不应被提示挡住', async ({ page }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 812, height: 375 });
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await skipIntroSteps(page);

        await waitForTutorialStep(page, 'playMinion', 10000);
        const playMinionMetrics = await readTutorialOcclusionMetrics(page, '[data-base-index="0"]');
        expect(playMinionMetrics.overlayRect).toBeTruthy();
        expect(playMinionMetrics.targetRect).toBeTruthy();
        expectTutorialPlacementAwayFromBoardCenter(playMinionMetrics.placement);
        expectTutorialPanelKeepsCenterLaneClear(playMinionMetrics);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'main-tutorial-mobile-play-minion-clear', {
                filename: 'main-tutorial-mobile-play-minion-clear.png',
            }),
            fullPage: false,
        });

        await doPlayMinion(page);

        await waitForTutorialStep(page, 'playAction', 15000);
        const playActionMetrics = await readTutorialOcclusionMetrics(page, '[data-base-index="0"]');
        expect(playActionMetrics.overlayRect).toBeTruthy();
        expect(playActionMetrics.targetRect).toBeTruthy();
        expectTutorialPlacementAwayFromBoardCenter(playActionMetrics.placement);
        expectTutorialPanelKeepsCenterLaneClear(playActionMetrics);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'main-tutorial-mobile-play-action-clear', {
                filename: 'main-tutorial-mobile-play-action-clear.png',
            }),
            fullPage: false,
        });

        await doPlayAction(page);

        await waitForTutorialStep(page, 'useTalent', 15000);
        const useTalentMetrics = await readTutorialOcclusionMetrics(page, '[data-minion-def-id="miskatonic_librarian"]');
        expect(useTalentMetrics.overlayRect).toBeTruthy();
        expect(useTalentMetrics.targetRect).toBeTruthy();
        expect(useTalentMetrics.overlapArea).toBe(0);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'main-tutorial-mobile-use-talent-clear', {
                filename: 'main-tutorial-mobile-use-talent-clear.png',
            }),
            fullPage: false,
        });

        await doUseTalent(page);

        await waitForTutorialStep(page, 'endPlayCards', 15000);
        const endTurnMetrics = await readTutorialOcclusionMetrics(page, '[data-tutorial-id="su-end-turn-btn"]');
        expect(endTurnMetrics.overlayRect).toBeTruthy();
        expect(endTurnMetrics.targetRect).toBeTruthy();
        expect(endTurnMetrics.overlapArea).toBe(0);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'main-tutorial-mobile-end-turn-clear', {
                filename: 'main-tutorial-mobile-end-turn-clear.png',
            }),
            fullPage: false,
        });

        await doEndPlayCards(page);
        await waitForTutorialStep(page, 'baseScoring', 15000);
    });

    test('主教程首个已入场随从在后续步骤切换时不应重复播放入场动画', async ({ page }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 812, height: 375 });
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page);

        await skipIntroSteps(page);
        await doPlayMinion(page);

        await waitForTutorialStep(page, 'playAction', 15000);
        const minionLocator = page.locator('[data-minion-uid="tut-1"]').first();
        await expect(minionLocator).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(300);

        const samples = await sampleElementRectDrift(page, '[data-minion-uid="tut-1"]', 6, 120);
        const validSamples = samples.filter((sample): sample is NonNullable<typeof sample> => !!sample);
        expect(validSamples.length).toBeGreaterThanOrEqual(4);

        const first = validSamples[0];
        const maxTopDrift = Math.max(...validSamples.map((sample) => Math.abs(sample.top - first.top)));
        const maxLeftDrift = Math.max(...validSamples.map((sample) => Math.abs(sample.left - first.left)));
        const maxWidthDrift = Math.max(...validSamples.map((sample) => Math.abs(sample.width - first.width)));
        const maxHeightDrift = Math.max(...validSamples.map((sample) => Math.abs(sample.height - first.height)));
        const opacityValues = validSamples.map((sample) => Number(sample.opacity));

        expect(maxTopDrift).toBeLessThan(3);
        expect(maxLeftDrift).toBeLessThan(3);
        expect(maxWidthDrift).toBeLessThan(2);
        expect(maxHeightDrift).toBeLessThan(2);
        expect(Math.min(...opacityValues)).toBeGreaterThan(0.99);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'main-tutorial-minion-no-reentry-animation', {
                filename: 'main-tutorial-minion-no-reentry-animation.png',
            }),
            fullPage: false,
        });
    });

    test('牛仔决斗子教程在手机横屏下提示不应遮挡基地且副警长可正常弃置', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 812, height: 375 });
        await setEnglishLocale(page);
        await disableAudio(page);
        await navigateToTutorial(page, '/play/smashup/tutorial/cowboys-duel');

        await waitForTutorialStep(page, 'duelIntro', 40000);
        const duelIntroMetrics = await readTutorialOcclusionMetrics(page, '[data-base-index="0"]');
        expect(duelIntroMetrics.overlayRect).toBeTruthy();
        expect(duelIntroMetrics.targetRect).toBeTruthy();
        expect(duelIntroMetrics.overlayRect?.right ?? 99999).toBeLessThanOrEqual(duelIntroMetrics.viewport.width + 1);
        expect(duelIntroMetrics.overlayRect?.bottom ?? 99999).toBeLessThanOrEqual(duelIntroMetrics.viewport.height + 1);
        expect(duelIntroMetrics.placement === 'left' || duelIntroMetrics.placement === 'right').toBe(true);
        expect(duelIntroMetrics.overlapArea).toBe(0);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'cowboys-duel-mobile-no-base-occlusion', {
                filename: 'cowboys-duel-mobile-no-base-occlusion.png',
            }),
            fullPage: false,
        });

        await clickNext(page);

        await waitForTutorialStep(page, 'playGunfighter', 10000);
        await page.locator('[data-testid="su-hand-area"] [data-card-uid="gun-1"]').click();
        await page.locator('[data-base-index="0"]').click();
        await clickLocatorCenter(page, page.locator('[data-minion-uid="enemy-1"]'));

        await waitForTutorialStep(page, 'pecosBillWindow', 10000);
        await waitForInteractionSource(game, 'titan_pecos_bill_duel_start');
        await selectInteractionOption(game, option => option.value?.skip === true, 'Pecos Bill 跳过');

        await waitForTutorialStep(page, 'pinkertonCounter', 10000);
        await waitForInteractionSource(game, 'smashup_duel_pinkerton');
        await page.getByRole('button', { name: /Place 1 counter|放置 1 个指示物/i }).click();

        await waitForTutorialStep(page, 'duelCard', 10000);
        await waitForInteractionSource(game, 'smashup_duel_card');
        await selectInteractionOption(game, option => option.value?.skip === true, '决斗牌跳过');

        await waitForTutorialStep(page, 'deputyBoost', 20000);
        await waitForInteractionSource(game, 'smashup_duel_deputy_card');
        await page.locator('[data-testid="su-hand-area"] [data-card-uid="deputy-1"]').click();
        await waitForInteractionSource(game, 'smashup_duel_deputy_target');
        await clickLocatorCenter(page, page.locator('[data-minion-uid="gun-1"]'));

        await expect.poll(async () => {
            const state = await game.getState() as {
                core: {
                    players: Record<string, { discard: Array<{ uid: string }> }>;
                };
            };
            return state.core.players['0'].discard.some((card) => card.uid === 'deputy-1');
        }, { timeout: 10000 }).toBe(true);
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
