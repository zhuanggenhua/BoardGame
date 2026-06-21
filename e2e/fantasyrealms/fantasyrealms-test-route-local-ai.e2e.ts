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
                sys?: {
                    actionLog?: {
                        entries?: Array<{ kind?: string }>;
                    };
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

async function waitForHumanDiscardTurn(page: Page, minimumHandCount = 1, timeout = 10000) {
    await page.waitForFunction((expectedHandCount) => {
        const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.currentPlayer === '0'
            && state?.core?.stage === 'discard'
            && (state?.core?.players?.['0']?.hand?.length ?? 0) >= expectedHandCount;
    }, minimumHandCount, { timeout });
}

async function waitForHumanDrawTurn(page: Page, minimumTurn: number, minimumActionLogLength: number, timeout = 10000) {
    await page.waitForFunction(({ expectedTurn, expectedActionLogLength }) => {
        const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.currentPlayer === '0'
            && state?.core?.stage === 'draw'
            && (state?.core?.turn ?? 0) >= expectedTurn
            && (state?.sys?.actionLog?.entries?.length ?? 0) >= expectedActionLogLength;
    }, {
        expectedTurn: minimumTurn,
        expectedActionLogLength: minimumActionLogLength,
    }, { timeout });
}

async function playSingleUiRoundAndMeasure(page: Page, roundIndex: number) {
    const beforeState = await readHarnessState(page);
    const beforeTurn = beforeState?.core?.turn ?? 0;
    const beforeActionLogLength = beforeState?.sys?.actionLog?.entries?.length ?? 0;

    const drawActionButton = page.getByTestId('fantasyrealms-live-action-draw');
    if (await drawActionButton.count()) {
        await drawActionButton.click({ force: true });
    }

    await waitForHumanDiscardTurn(page, 1, 10000);

    const discardButton = page.locator('.fr-card-button--live-hand[data-action-state="discard"]').first();
    const totalStartedAt = Date.now();
    await discardButton.click({ force: true });
    const afterClickAt = Date.now();

    await waitForHumanDrawTurn(page, beforeTurn + 2, beforeActionLogLength + 4, 10000);
    const finishedAt = Date.now();

    const afterState = await readHarnessState(page);
    return {
        round: roundIndex,
        clickDispatchMs: afterClickAt - totalStartedAt,
        aiRoundtripMs: finishedAt - afterClickAt,
        totalMs: finishedAt - totalStartedAt,
        currentPlayer: afterState?.core?.currentPlayer,
        stage: afterState?.core?.stage,
        turn: afterState?.core?.turn,
        playerIds: afterState?.core?.playerIds ?? [],
        actionLogLength: afterState?.sys?.actionLog?.entries?.length ?? 0,
    };
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

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && (state?.core?.players?.['0']?.hand?.length ?? 0) >= 1;
            }, { timeout: 10000 });

            const stateAfterDraw = await readHarnessState(page);
            expect(stateAfterDraw?.sys?.actionLog?.entries?.map((entry) => entry.kind) ?? []).toEqual(['DRAW_FROM_DECK']);
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
                    && (state?.sys?.actionLog?.entries?.length ?? 0) >= 4;
            }, { timeout: 20000 });
            const aiRoundtripElapsedMs = Date.now() - aiRoundtripStartedAt;

            const stateAfterAiRoundtrip = await readHarnessState(page);
            const actionKinds = stateAfterAiRoundtrip?.sys?.actionLog?.entries?.map((entry) => entry.kind) ?? [];
            expect(actionKinds.slice(0, 2)).toEqual([
                'DRAW_FROM_DECK',
                'DISCARD_CARD',
            ]);
            expect(actionKinds[2]).toMatch(/^(DRAW_FROM_DECK|TAKE_FROM_DISCARD)$/);
            expect(actionKinds[3]).toBe('DISCARD_CARD');
            expect(actionKinds).toHaveLength(4);
            expect(stateAfterAiRoundtrip?.core?.discardPile?.length ?? 0).toBeGreaterThanOrEqual(1);

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByText(/^玩家3$/)).toHaveCount(0);
            await expect(page.getByText('notInDrawStage')).toHaveCount(0);
            expect(aiRoundtripElapsedMs).toBeLessThan(1200);
            console.log(`[fantasyrealms-local-ai-roundtrip-ms] ${aiRoundtripElapsedMs}`);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-roundtrip-back-to-human');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            const postRoundtripState = await readHarnessState(page);
            expect(postRoundtripState?.core?.currentPlayer).toBe('0');
            expect(postRoundtripState?.core?.stage).toBe('draw');
            expect(postRoundtripState?.core?.turn).toBe(3);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('真实点击连跑 3 轮时，seat1 local-ai 会稳定快返，不会误跳到玩家3', async ({ browser }, testInfo) => {
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

            const roundMetrics = [];
            for (let round = 1; round <= 3; round += 1) {
                const metrics = await playSingleUiRoundAndMeasure(page, round);
                roundMetrics.push(metrics);
                expect(metrics.currentPlayer).toBe('0');
                expect(metrics.stage).toBe('draw');
                expect(metrics.playerIds).toEqual(['0', '1']);
                expect(metrics.aiRoundtripMs).toBeLessThan(400);
                await expect(page.getByText(/^玩家3$/)).toHaveCount(0);
            }

            console.log(`[fantasyrealms-local-ai-3-rounds] ${JSON.stringify(roundMetrics)}`);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'test-route-local-ai-three-rounds-back-to-human');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });
});
