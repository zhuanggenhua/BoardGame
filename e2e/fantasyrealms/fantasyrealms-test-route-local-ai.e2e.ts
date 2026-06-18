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
                    turn?: number;
                    discardPile?: unknown[];
                    players?: Record<string, { hand?: unknown[] } | undefined>;
                };
            };
            isRegistered?: () => boolean;
        };
        command?: {
            dispatch?: (command: {
                type: string;
                playerId: string;
                payload: Record<string, unknown>;
            }) => Promise<void>;
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
        `${baseURL ?? ''}/play/fantasyrealms?players=2&playerID=0&seat1=local-ai&seat1Delay=0`,
        { waitUntil: 'domcontentloaded' },
    );
    await waitForTestHarness(page, 15000);
}

async function readHarnessState(page: Page) {
    return await page.evaluate(() => (
        (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.() ?? null
    ));
}

async function dispatchHarnessCommand(page: Page, command: {
    type: string;
    playerId: string;
    payload: Record<string, unknown>;
}) {
    await page.evaluate(async (nextCommand) => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) {
            throw new Error('__BG_TEST_HARNESS__.command.dispatch 不可用');
        }
        await harness.command.dispatch(nextCommand);
    }, command);
}

test.describe('FantasyRealms legal test-route local AI flow', () => {
    test('合法测试入口里显式 seat1Delay=0 时，seat1 local-ai 会在无最小等待预算下真实接手并把回合交回', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
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
            await expect(page).toHaveURL(/seat1Delay=0/);

            const openingEvidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-opening');
            await mkdir(dirname(openingEvidencePath), { recursive: true });
            await page.screenshot({ path: openingEvidencePath, fullPage: false });

            await dispatchHarnessCommand(page, {
                type: 'DRAW_FROM_DECK',
                playerId: '0',
                payload: {},
            });
            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && (state?.core?.players?.['0']?.hand?.length ?? 0) >= 1;
            }, { timeout: 10000 });

            const stateAfterDraw = await readHarnessState(page);
            const discardCard = stateAfterDraw?.core?.players?.['0']?.hand?.[0] as { id?: string } | undefined;
            expect(discardCard?.id).toBeTruthy();
            const aiRoundtripStartedAt = Date.now();
            await dispatchHarnessCommand(page, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCard!.id! },
            });

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.turn === 3
                    && state?.core?.stage === 'draw'
                    && (state?.core?.discardPile?.length ?? 0) >= 2;
            }, { timeout: 20000 });
            const aiRoundtripElapsedMs = Date.now() - aiRoundtripStartedAt;

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            expect(aiRoundtripElapsedMs).toBeLessThan(1200);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-roundtrip-back-to-human');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });
});
