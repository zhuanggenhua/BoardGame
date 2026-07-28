import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustControlImpulsesSicknessExchangeRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-control-impulses-sickness-exchange';
const BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-控制冲动发起前.jpg`;
const WAITING_ACCEPT_SCREENSHOT = `${EVIDENCE_DIR}/02-控制冲动等待同意.jpg`;
const ACCEPTED_SCREENSHOT = `${EVIDENCE_DIR}/03-控制冲动同意后交换疾病.jpg`;
const WAITING_DECLINE_SCREENSHOT = `${EVIDENCE_DIR}/04-控制冲动拒绝等待同意.jpg`;
const DECLINED_SCREENSHOT = `${EVIDENCE_DIR}/05-控制冲动拒绝后未交换.jpg`;
const ALL_INFECTED_ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/06-控制冲动全员感染叛徒胜利.jpg`;
const actorUrl = (suffix: string) =>
    `/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-control-impulses-${suffix}`;
const targetUrl = (suffix: string) =>
    `/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human&seed=the-dust-control-impulses-target-${suffix}`;

type DustControlImpulsesState = {
    phase?: string;
    currentPlayer?: string;
    activePlayerId?: string | null;
    pendingExchange?: {
        requesterPlayerId?: string;
        targetPlayerId?: string;
    } | null;
    usedCardIdsThisTurn?: string[];
    permanentTraitorPlayerIds?: string[];
    exchangedSicknessThisTurnPlayerIds?: string[];
    sicknessValuesByPlayerId?: Record<string, Array<number | null>>;
    deadPlayerIds?: string[];
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
    latestLog?: string;
};

const readDustControlImpulsesState = async (page: Page): Promise<DustControlImpulsesState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            phase?: string;
                            currentPlayer?: string;
                            activePlayerId?: string | null;
                            usedCardIdsThisTurn?: string[];
                            activityLog?: Array<{ text?: string }>;
                            endgameResult?: DustControlImpulsesState['endgameResult'];
                            scenarioRuntime?: {
                                deadExplorerPlayerIds?: string[];
                                dust?: {
                                    permanentTraitorPlayerIds?: string[];
                                    exchangedSicknessThisTurnPlayerIds?: string[];
                                    pendingSicknessExchange?: {
                                        requesterPlayerId?: string;
                                        targetPlayerId?: string;
                                    };
                                    sicknessTokensByPlayerId?: Record<string, Array<{ value: number | null }>>;
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const dust = core?.scenarioRuntime?.dust;

        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            activePlayerId: core?.activePlayerId ?? null,
            pendingExchange: dust?.pendingSicknessExchange ?? null,
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
            permanentTraitorPlayerIds: dust?.permanentTraitorPlayerIds ?? [],
            exchangedSicknessThisTurnPlayerIds: dust?.exchangedSicknessThisTurnPlayerIds ?? [],
            sicknessValuesByPlayerId: Object.fromEntries(
                Object.entries(dust?.sicknessTokensByPlayerId ?? {}).map(([playerId, tokens]) => [
                    playerId,
                    tokens.map((token) => token.value),
                ]),
            ),
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            endgameResult: core?.endgameResult ?? null,
            latestLog: core?.activityLog?.[0]?.text ?? '',
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const openTargetPerspective = async (
    context: BrowserContext,
    sourcePage: Page,
    suffix: string,
): Promise<Page> => {
    const pendingCore = await sourcePage.evaluate(() => {
        const harness = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: unknown;
                    };
                };
            };
        }).__BG_TEST_HARNESS__;
        return harness?.state?.get?.()?.core;
    });
    const targetPage = await context.newPage();
    await targetPage.setViewportSize({ width: 1600, height: 900 });
    await targetPage.goto(targetUrl(suffix), { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(targetPage);
    await injectCore(targetPage, pendingCore);
    await expect(targetPage.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    return targetPage;
};

const requestControlImpulsesExchange = async (page: Page) => {
    await expect(page.getByTestId('betrayal-action-trade')).toContainText('交换疾病');
    await page.getByTestId('betrayal-action-trade').click();
    await expect(page.getByTestId('betrayal-action-use')).toHaveAttribute('data-haunt-targeting-status', 'true');
    await expect(page.getByTestId('betrayal-action-cue')).toContainText('杰登·琼斯');
    const targetToken = page.getByTestId('betrayal-room-occupant-hallway-0');
    await expect(targetToken).toHaveAttribute('data-direct-target', 'true');
    await expect(page.getByTestId('betrayal-room-occupant-target-cue-hallway-0')).toContainText('交换疾病');
    await targetToken.click();
    await expect(page.getByTestId('betrayal-sickness-exchange-banner')).toHaveAttribute('data-sickness-exchange-state', 'waiting');
    await expect.poll(() => readDustControlImpulsesState(page)).toMatchObject({
        activePlayerId: '0',
        pendingExchange: {
            requesterPlayerId: '1',
            targetPlayerId: '0',
        },
    });
};

test.describe('山屋惊魂作祟3灰尘控制冲动疾病交换', () => {
    test('目标同意后会随机交换疾病标记并记录本回合已交换', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-control-impulses-accept');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(actorUrl('accept'), { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustControlImpulsesSicknessExchangeRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readDustControlImpulsesState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            activePlayerId: null,
            permanentTraitorPlayerIds: ['0'],
            exchangedSicknessThisTurnPlayerIds: [],
            sicknessValuesByPlayerId: {
                '0': [1, 7, 8],
                '1': [4, 5, 6],
                '2': [9, 10, 11],
            },
        });
        await saveScreenshot(page, BEFORE_SCREENSHOT);

        await requestControlImpulsesExchange(page);
        await saveScreenshot(page, WAITING_ACCEPT_SCREENSHOT);

        const targetPage = await openTargetPerspective(context, page, 'accept');
        const targetDiagnostics = attachPageDiagnostics(targetPage, 'betrayal-the-dust-control-impulses-accept-target');
        await expect(targetPage.getByTestId('betrayal-sickness-exchange-banner')).toHaveAttribute('data-sickness-exchange-state', 'incoming');
        await setHarnessRandomQueue(targetPage, [0, 0]);
        await targetPage.getByTestId('betrayal-sickness-exchange-accept').click();

        await expect.poll(() => readDustControlImpulsesState(targetPage)).toMatchObject({
            activePlayerId: null,
            pendingExchange: null,
            usedCardIdsThisTurn: expect.arrayContaining(['sickness-exchange']),
            permanentTraitorPlayerIds: ['0', '1'],
            exchangedSicknessThisTurnPlayerIds: ['1', '0'],
            sicknessValuesByPlayerId: {
                '0': [4, 7, 8],
                '1': [1, 5, 6],
                '2': [9, 10, 11],
            },
            latestLog: expect.stringContaining('同意了'),
        });
        await expect(targetPage.getByTestId('betrayal-sickness-exchange-banner')).toHaveCount(0);
        await expect(targetPage.getByTestId('betrayal-room-latest-feedback')).toContainText('同意了');
        await saveScreenshot(targetPage, ACCEPTED_SCREENSHOT);

        assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-control-impulses-accept', diagnostics },
            { label: 'betrayal-the-dust-control-impulses-accept-target', diagnostics: targetDiagnostics },
        ]);
        await targetPage.close();
    });

    test('目标拒绝后会清空等待态且不交换疾病标记', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-control-impulses-decline');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(actorUrl('decline'), { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustControlImpulsesSicknessExchangeRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await requestControlImpulsesExchange(page);
        await saveScreenshot(page, WAITING_DECLINE_SCREENSHOT);

        const targetPage = await openTargetPerspective(context, page, 'decline');
        const targetDiagnostics = attachPageDiagnostics(targetPage, 'betrayal-the-dust-control-impulses-decline-target');
        await expect(targetPage.getByTestId('betrayal-sickness-exchange-banner')).toHaveAttribute('data-sickness-exchange-state', 'incoming');
        await setHarnessRandomQueue(targetPage, [0, 0]);
        await targetPage.getByTestId('betrayal-sickness-exchange-decline').click();

        await expect.poll(() => readDustControlImpulsesState(targetPage)).toMatchObject({
            activePlayerId: null,
            pendingExchange: null,
            permanentTraitorPlayerIds: ['0'],
            exchangedSicknessThisTurnPlayerIds: [],
            sicknessValuesByPlayerId: {
                '0': [1, 7, 8],
                '1': [4, 5, 6],
                '2': [9, 10, 11],
            },
            latestLog: expect.stringContaining('拒绝了'),
        });
        await expect(targetPage.getByTestId('betrayal-sickness-exchange-banner')).toHaveCount(0);
        await expect(targetPage.getByTestId('betrayal-room-latest-feedback')).toContainText('拒绝了');
        await saveScreenshot(targetPage, DECLINED_SCREENSHOT);

        assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-control-impulses-decline', diagnostics },
            { label: 'betrayal-the-dust-control-impulses-decline-target', diagnostics: targetDiagnostics },
        ]);
        await targetPage.close();
    });

    test('目标同意后若所有存活者都永久感染则进入叛徒胜利', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-control-impulses-all-infected');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(actorUrl('all-infected'), { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createDustControlImpulsesSicknessExchangeRuntimeCore();
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readDustControlImpulsesState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            permanentTraitorPlayerIds: ['0'],
            deadPlayerIds: ['2'],
            endgameResult: null,
        });

        await requestControlImpulsesExchange(page);
        const targetPage = await openTargetPerspective(context, page, 'all-infected');
        const targetDiagnostics = attachPageDiagnostics(targetPage, 'betrayal-the-dust-control-impulses-all-infected-target');
        await expect(targetPage.getByTestId('betrayal-sickness-exchange-banner')).toHaveAttribute('data-sickness-exchange-state', 'incoming');
        await setHarnessRandomQueue(targetPage, [0, 0]);
        await targetPage.getByTestId('betrayal-sickness-exchange-accept').click();

        const endgameScreen = targetPage.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('灰尘');
        await expect(endgameScreen).toContainText('叛徒得逞');
        await expect.poll(() => readDustControlImpulsesState(targetPage)).toMatchObject({
            phase: 'endgame',
            permanentTraitorPlayerIds: ['0', '1'],
            deadPlayerIds: ['2'],
            endgameResult: {
                hauntId: 'the-dust',
                outcome: 'traitor',
                winners: ['0', '1'],
            },
        });
        await saveScreenshot(targetPage, ALL_INFECTED_ENDGAME_SCREENSHOT);

        assertNoFatalFrontendErrors([
            { label: 'betrayal-the-dust-control-impulses-all-infected', diagnostics },
            { label: 'betrayal-the-dust-control-impulses-all-infected-target', diagnostics: targetDiagnostics },
        ]);
        await targetPage.close();
    });
});
