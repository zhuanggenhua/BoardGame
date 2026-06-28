import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';

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
    test('基础教程会覆盖完整引导流程，并顺手保留关键截图', async ({ browser }, testInfo) => {
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

            await waitForTutorialStep(page, 'welcome');
            const openingPath = getEvidenceScreenshotPath(testInfo, '01-教程首个正式牌桌引导态');
            await mkdir(dirname(openingPath), { recursive: true });
            await page.screenshot({ path: openingPath, fullPage: true });

            await clickNext(page);
            await waitForTutorialStep(page, 'deck-intro');
            await clickNext(page);
            await waitForTutorialStep(page, 'center-row-intro');
            await clickNext(page);
            await waitForTutorialStep(page, 'draw-from-deck');

            const drawButton = page.getByTestId('fantasyrealms-live-action-draw');
            await expect(drawButton).toBeVisible({ timeout: 15000 });
            await drawButton.click();

            await waitForTutorialStep(page, 'discard-after-draw');
            await expect(getLiveHandCardButton(page, 'land-bell-tower')).toBeVisible({ timeout: 15000 });

            const afterDrawPath = getEvidenceScreenshotPath(testInfo, '02-摸牌后进入待弃牌态');
            await mkdir(dirname(afterDrawPath), { recursive: true });
            await page.screenshot({ path: afterDrawPath, fullPage: true });

            await getLiveHandCardButton(page, 'land-bell-tower').click();
            await waitForTutorialStep(page, 'take-center-card');
            await expect(getLiveCenterCardButton(page, 'land-bell-tower')).toBeVisible({ timeout: 15000 });

            const takeCenterPath = getEvidenceScreenshotPath(testInfo, '03-切到公开弃牌拿牌教学');
            await mkdir(dirname(takeCenterPath), { recursive: true });
            await page.screenshot({ path: takeCenterPath, fullPage: true });

            await getLiveCenterCardButton(page, 'land-bell-tower').click();
            await waitForTutorialStep(page, 'discard-after-center');
            await expect(getLiveHandCardButton(page, 'weapon-magic-wand')).toBeVisible({ timeout: 15000 });

            const afterTakePath = getEvidenceScreenshotPath(testInfo, '04-拿公开弃牌后再次进入待弃牌态');
            await mkdir(dirname(afterTakePath), { recursive: true });
            await page.screenshot({ path: afterTakePath, fullPage: true });

            await getLiveHandCardButton(page, 'weapon-magic-wand').click();
            await waitForTutorialStep(page, 'turn-loop');
            await clickNext(page);
            await waitForTutorialStep(page, 'endgame-rule');
            await clickNext(page);
            await waitForTutorialStep(page, 'finish');

            const finishPath = getEvidenceScreenshotPath(testInfo, '05-教程结束说明态');
            await mkdir(dirname(finishPath), { recursive: true });
            await page.screenshot({ path: finishPath, fullPage: true });

            await clickNext(page);
            await expect(page.locator('[data-tutorial-step]')).toHaveCount(0, { timeout: 15000 });
        } finally {
            await context.close().catch(() => {});
        }
    });
});
