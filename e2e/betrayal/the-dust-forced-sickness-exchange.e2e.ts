import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustForcedSicknessExchangeRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-forced-sickness-exchange';
const BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-灰尘同房强制交换结束回合前.jpg`;
const AFTER_SCREENSHOT = `${EVIDENCE_DIR}/02-灰尘同房强制交换后交接.jpg`;
const ALL_INFECTED_ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/03-同房强制交换全员感染叛徒胜利.jpg`;
const TEST_URL = '/play/betrayal?players=4&playerID=1&seat0=human&seat1=human&seat2=human&seat3=human&seed=the-dust-forced-sickness-exchange';

type DustForcedExchangeState = {
    phase?: string;
    currentPlayer?: string;
    pendingDamageAllocation?: unknown | null;
    permanentTraitorPlayerIds?: string[];
    deadPlayerIds?: string[];
    exchangedSicknessThisTurnPlayerIds?: string[];
    sicknessValuesByPlayerId?: Record<string, Array<number | null>>;
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
    latestLog?: string;
};

const readDustForcedExchangeState = async (page: Page): Promise<DustForcedExchangeState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            phase?: string;
                            currentPlayer?: string;
                            pendingDamageAllocation?: unknown | null;
                            activityLog?: Array<{ text?: string }>;
                            endgameResult?: DustForcedExchangeState['endgameResult'];
                            scenarioRuntime?: {
                                deadExplorerPlayerIds?: string[];
                                dust?: {
                                    permanentTraitorPlayerIds?: string[];
                                    exchangedSicknessThisTurnPlayerIds?: string[];
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
            pendingDamageAllocation: core?.pendingDamageAllocation ?? null,
            permanentTraitorPlayerIds: dust?.permanentTraitorPlayerIds ?? [],
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            exchangedSicknessThisTurnPlayerIds: dust?.exchangedSicknessThisTurnPlayerIds ?? [],
            sicknessValuesByPlayerId: Object.fromEntries(
                Object.entries(dust?.sicknessTokensByPlayerId ?? {}).map(([playerId, tokens]) => [
                    playerId,
                    tokens.map((token) => token.value),
                ]),
            ),
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

test.describe('山屋惊魂作祟3灰尘回合末同房强制交换', () => {
    test('同房多名探索者结束回合会逐个随机交换疾病标记，并直接交给下一名玩家', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-forced-sickness-exchange');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustForcedSicknessExchangeRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readDustForcedExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            pendingDamageAllocation: null,
            permanentTraitorPlayerIds: ['0'],
            exchangedSicknessThisTurnPlayerIds: [],
            sicknessValuesByPlayerId: {
                '0': [1, 7, 8],
                '1': [4, 5, 6],
                '2': [9, 10, 11],
                '3': [12, 13, 14],
            },
        });
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('交换疾病可用');
        await expect(page.getByTestId('betrayal-room-occupant-hallway-0')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-occupant-hallway-1')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-occupant-hallway-2')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
        await saveScreenshot(page, BEFORE_SCREENSHOT);

        await setHarnessRandomQueue(page, [0, 0, 0, 0]);
        await page.getByTestId('betrayal-action-endTurn').click();

        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveCount(0);
        await expect.poll(() => readDustForcedExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '2',
            pendingDamageAllocation: null,
            permanentTraitorPlayerIds: ['0', '1', '2'],
            exchangedSicknessThisTurnPlayerIds: [],
            sicknessValuesByPlayerId: {
                '0': [4, 7, 8],
                '1': [9, 5, 6],
                '2': [1, 10, 11],
                '3': [12, 13, 14],
            },
            latestLog: expect.stringContaining('交换了 2 次疾病标记'),
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('交换了 2 次疾病标记');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText('没有交换疾病标记');
        await saveScreenshot(page, AFTER_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-forced-sickness-exchange', diagnostics }]);
    });

    test('同房强制交换后若所有存活者都永久感染则进入叛徒胜利', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-forced-sickness-all-infected');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createDustForcedSicknessExchangeRuntimeCore();
        core.scenarioRuntime.deadExplorerPlayerIds = ['3'];
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readDustForcedExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            permanentTraitorPlayerIds: ['0'],
            deadPlayerIds: ['3'],
            endgameResult: null,
        });

        await setHarnessRandomQueue(page, [0, 0, 0, 0]);
        await page.getByTestId('betrayal-action-endTurn').click();

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('灰尘');
        await expect(endgameScreen).toContainText('叛徒得逞');
        await expect.poll(() => readDustForcedExchangeState(page)).toMatchObject({
            phase: 'endgame',
            permanentTraitorPlayerIds: ['0', '1', '2'],
            deadPlayerIds: ['3'],
            endgameResult: {
                hauntId: 'the-dust',
                outcome: 'traitor',
                winners: ['0', '1', '2'],
            },
        });
        await saveScreenshot(page, ALL_INFECTED_ENDGAME_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-forced-sickness-all-infected', diagnostics }]);
    });
});
