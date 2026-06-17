import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';

type TestHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => {
                core?: {
                    currentPlayer?: string;
                    stage?: string;
                    discardPile?: unknown[];
                    players?: Record<string, { hand?: unknown[] } | undefined>;
                };
            };
            isRegistered?: () => boolean;
        };
        command?: {
            isRegistered?: () => boolean;
        };
    };
};

async function waitForTestHarness(page: Page, timeout = 15000) {
    await page.waitForFunction(() => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        return harness?.state?.isRegistered?.() === true
            && harness?.command?.isRegistered?.() === true;
    }, { timeout });
}

async function openFantasyRealmsTestRoute(page: Page, baseURL?: string) {
    await page.goto(
        `${baseURL ?? ''}/play/fantasyrealms?players=2&playerID=0&seat1=local-ai`,
        { waitUntil: 'domcontentloaded' },
    );
    await waitForTestHarness(page, 15000);
}

test.describe('FantasyRealms legal test-route local AI flow', () => {
    test('合法测试入口里 human 连续两轮后，seat1 local-ai 仍会真实接手并把回合交回', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openFantasyRealmsTestRoute(page, baseURL);

            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 15000 });

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            const firstHandDiscardButton = page.locator('[data-testid="fantasyrealms-hand-row"] .fr-card-button').first();
            const firstDiscardPileButton = page.locator('[data-testid="fantasyrealms-discard-row"] .fr-card-button').first();
            const magnifyOverlay = page.getByTestId('fantasyrealms-magnify-overlay');
            const openingEvidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-opening');
            await mkdir(dirname(openingEvidencePath), { recursive: true });
            await page.screenshot({ path: openingEvidencePath, fullPage: false });

            await expect(liveActionButton).toContainText('摸 2 张');
            await liveActionButton.click();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toContainText('弃置 1 张');

            await expect(firstHandDiscardButton).toBeVisible({ timeout: 10000 });
            await firstHandDiscardButton.click();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toContainText('确认弃牌');
            const discardBannerEvidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-discard-banner');
            await page.screenshot({ path: discardBannerEvidencePath, fullPage: false });

            await expect(liveActionButton).toContainText('确认弃置');
            await firstHandDiscardButton.click();
            await expect(magnifyOverlay).toHaveCSS('opacity', '1');
            const discardPreviewEvidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-discard-preview');
            await page.screenshot({ path: discardPreviewEvidencePath, fullPage: false });
            await magnifyOverlay.click({ position: { x: 12, y: 12 } });
            await expect(magnifyOverlay).toHaveCSS('opacity', '0');
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.turn === 3
                    && state?.core?.stage === 'draw'
                    && (state?.core?.discardPile?.length ?? 0) >= 2;
            }, { timeout: 20000 });

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText(/摸牌|摸 1 张|摸 2 张/);
            const round2HumanEvidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-round2-human');
            await page.screenshot({ path: round2HumanEvidencePath, fullPage: false });
            await firstDiscardPileButton.click();
            await expect(liveActionButton).toContainText('确认选择');
            await firstDiscardPileButton.click();
            await expect(magnifyOverlay).toHaveCSS('opacity', '1');
            const round2PreviewEvidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-round2-preview');
            await page.screenshot({ path: round2PreviewEvidencePath, fullPage: false });
            await magnifyOverlay.click({ position: { x: 12, y: 12 } });
            await expect(magnifyOverlay).toHaveCSS('opacity', '0');
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.turn === 5
                    && state?.core?.stage === 'draw';
            }, { timeout: 20000 });

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText(/摸牌|摸 1 张|摸 2 张/);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-roundtrip-back-to-human');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });
});
