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

const FANTASY_REALMS_DECK_DRAW_BUTTON_NAME = /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/;

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
    test('合法测试入口里 human 首手后，seat1 local-ai 会真实接手并把回合交回', async ({ browser }, testInfo) => {
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
            const deckButton = page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME });

            await expect(deckButton).toBeVisible({ timeout: 10000 });
            await deckButton.click();

            const firstHandDiscardButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await expect(firstHandDiscardButton).toBeVisible({ timeout: 10000 });
            await firstHandDiscardButton.click();

            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1';
            }, { timeout: 10000 });

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                const discardLen = state?.core?.discardPile?.length ?? 0;
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'draw'
                    && discardLen >= 2;
            }, { timeout: 20000 });

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(deckButton).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-roundtrip-back-to-human');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });
});
