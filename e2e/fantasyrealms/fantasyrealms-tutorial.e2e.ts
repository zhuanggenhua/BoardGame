import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext, waitForTestHarness } from '../helpers/common';

type TutorialHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => {
                core?: {
                    playerIds?: string[];
                    setupConfig?: { variant?: string };
                    turn?: number;
                    stage?: string;
                    drawPile?: Array<unknown>;
                    discardPile?: Array<unknown>;
                };
                sys?: {
                    tutorial?: {
                        stepIndex?: number;
                        step?: { id?: string; aiActions?: unknown[] };
                    };
                };
            };
        };
    };
};

const waitForTutorialStep = async (page: Page, stepId: string, timeout = 40000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const clickNext = async (page: Page) => {
    const nextBtn = page.getByTestId('tutorial-next-button');
    await expect(nextBtn).toBeVisible({ timeout: 15000 });
    await nextBtn.click();
};

const getLiveHandCardButton = (page: Page, cardId: string) =>
    page.locator('.fr-card-button--live-hand').filter({
        has: page.locator(`[data-atlas-card-id="${cardId}"]`),
    }).first();

const getLiveCenterCardButton = (page: Page, cardId: string) =>
    page.locator('.fr-card-button--live-center').filter({
        has: page.locator(`[data-atlas-card-id="${cardId}"]`),
    }).first();

test.describe('FantasyRealms tutorial flow', () => {
    test('基础教程会按真实常规对局示范摸牌 弃牌 拿中央牌 计分，并保留关键截图', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            skipTutorial: false,
            skipImageGate: true,
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            storageKey: '__fr_tutorial_flow__',
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await page.goto(`${baseURL ?? ''}/play/fantasyrealms/tutorial`, { waitUntil: 'domcontentloaded' });

            await expect(page.locator('div[data-game-page][data-game-id="fantasyrealms"]').first()).toBeVisible({ timeout: 60000 });
            await expect(page.getByTestId('fantasyrealms-live-deck')).toBeVisible({ timeout: 60000 });
            await waitForTestHarness(page);

            await waitForTutorialStep(page, 'draw-overview');
            const openingPath = getEvidenceScreenshotPath(testInfo, '01-开场先讲目标与基础回合');
            await mkdir(dirname(openingPath), { recursive: true });
            await page.screenshot({ path: openingPath, fullPage: true });

            await clickNext(page);
            await waitForTutorialStep(page, 'draw-from-deck');
            const tutorialStateAfterSetup = await page.evaluate(() => {
                const state = (window as TutorialHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    href: window.location.href,
                    playerIds: state?.core?.playerIds ?? [],
                    variant: state?.core?.setupConfig?.variant ?? null,
                    turn: state?.core?.turn ?? null,
                    stage: state?.core?.stage ?? null,
                    drawPileCount: state?.core?.drawPile?.length ?? null,
                    discardPileCount: state?.core?.discardPile?.length ?? null,
                    handButtons: document.querySelectorAll('.fr-card-button--live-hand').length,
                    actionButtons: document.querySelectorAll('.fr-live-action-button').length,
                    tutorialStepId: state?.sys?.tutorial?.step?.id ?? null,
                    tutorialStepIndex: state?.sys?.tutorial?.stepIndex ?? null,
                    tutorialAiActions: state?.sys?.tutorial?.step?.aiActions?.length ?? 0,
                };
            });

            const drawButton = page.getByTestId('fantasyrealms-live-action-draw');
            await expect(drawButton, JSON.stringify(tutorialStateAfterSetup)).toBeVisible({ timeout: 15000 });
            await drawButton.click();

            await waitForTutorialStep(page, 'discard-after-draw');
            const drawPath = getEvidenceScreenshotPath(testInfo, '02-摸牌后直接按组合收益弃掉王后');
            await mkdir(dirname(drawPath), { recursive: true });
            await page.screenshot({ path: drawPath, fullPage: true });

            await expect(getLiveHandCardButton(page, 'leader-queen')).toBeVisible({ timeout: 15000 });
            await getLiveHandCardButton(page, 'leader-queen').click();
            await waitForTutorialStep(page, 'take-center-card');
            const centerDecisionPath = getEvidenceScreenshotPath(testInfo, '03-中央有钟塔时直接拿取');
            await mkdir(dirname(centerDecisionPath), { recursive: true });
            await page.screenshot({ path: centerDecisionPath, fullPage: true });

            await expect(getLiveCenterCardButton(page, 'land-bell-tower')).toBeVisible({ timeout: 15000 });
            await getLiveCenterCardButton(page, 'land-bell-tower').click();

            await waitForTutorialStep(page, 'discard-after-center');
            await expect(getLiveHandCardButton(page, 'weather-rainstorm')).toBeVisible({ timeout: 15000 });
            const discardActionPath = getEvidenceScreenshotPath(testInfo, '04-拿到钟塔后弃掉暴风雨');
            await mkdir(dirname(discardActionPath), { recursive: true });
            await page.screenshot({ path: discardActionPath, fullPage: true });

            await getLiveHandCardButton(page, 'weather-rainstorm').click();
            await waitForTutorialStep(page, 'score-intro');
            await expect(page.getByTestId('fantasyrealms-live-score-total')).toContainText('198', { timeout: 15000 });

            const scorePath = getEvidenceScreenshotPath(testInfo, '05-进入计分并看到总分结果');
            await mkdir(dirname(scorePath), { recursive: true });
            await page.screenshot({ path: scorePath, fullPage: true });

            await clickNext(page);
            await waitForTutorialStep(page, 'score-card-details');
            const scoreCardDetailsPath = getEvidenceScreenshotPath(testInfo, '06-查看单张牌的基础分与加分效果');
            await mkdir(dirname(scoreCardDetailsPath), { recursive: true });
            await page.screenshot({ path: scoreCardDetailsPath, fullPage: true });

            await clickNext(page);
            await waitForTutorialStep(page, 'score-total-review');
            await clickNext(page);
            await waitForTutorialStep(page, 'endgame-review');
            await expect(page.getByTestId('fantasyrealms-live-endgame')).toBeVisible({ timeout: 15000 });

            const finishPath = getEvidenceScreenshotPath(testInfo, '07-终局排名与教程结语收口');
            await mkdir(dirname(finishPath), { recursive: true });
            await page.screenshot({ path: finishPath, fullPage: true });

            await clickNext(page);
            await waitForTutorialStep(page, 'finish');
            await clickNext(page);
            await expect(page.locator('[data-tutorial-step]')).toHaveCount(0, { timeout: 15000 });
        } finally {
            await context.close().catch(() => {});
        }
    });
});
