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
const TEST_URL = '/play/betrayal?players=4&playerID=1&seat0=human&seat1=human&seat2=human&seat3=human&seed=the-dust-forced-sickness-exchange';

type DustForcedExchangeState = {
    phase?: string;
    currentPlayer?: string;
    pendingDamageAllocation?: unknown | null;
    permanentTraitorPlayerIds?: string[];
    exchangedSicknessThisTurnPlayerIds?: string[];
    sicknessValuesByPlayerId?: Record<string, Array<number | null>>;
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
                            scenarioRuntime?: {
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
            exchangedSicknessThisTurnPlayerIds: dust?.exchangedSicknessThisTurnPlayerIds ?? [],
            sicknessValuesByPlayerId: Object.fromEntries(
                Object.entries(dust?.sicknessTokensByPlayerId ?? {}).map(([playerId, tokens]) => [
                    playerId,
                    tokens.map((token) => token.value),
                ]),
            ),
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
});
