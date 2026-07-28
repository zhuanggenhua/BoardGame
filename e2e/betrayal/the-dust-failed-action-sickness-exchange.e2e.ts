import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustFailedActionSicknessExchangeRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-failed-action-sickness-exchange';
const BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-寻找解药失败前.jpg`;
const AFTER_SEARCH_SCREENSHOT = `${EVIDENCE_DIR}/02-寻找解药失败后交换疾病.jpg`;
const AFTER_END_TURN_SCREENSHOT = `${EVIDENCE_DIR}/03-失败交换后结束回合不触发冲动伤害.jpg`;
const ALL_INFECTED_ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/04-寻找解药失败全员感染叛徒胜利.jpg`;
const CURE_FAILURE_ALL_INFECTED_ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/05-治愈灰尘失败全员感染叛徒胜利.jpg`;
const TEST_URL = '/play/betrayal?players=4&playerID=1&seat0=human&seat1=human&seat2=human&seat3=human&seed=the-dust-failed-action-sickness-exchange';

type DustFailedActionExchangeState = {
    phase?: string;
    currentPlayer?: string;
    pendingDamageAllocation?: unknown | null;
    deadExplorerPlayerIds?: string[];
    usedCardIdsThisTurn?: string[];
    recentRoll?: {
        sourceTitle?: string;
        latestLabel?: string;
        dice?: number[];
    } | null;
    latestLog?: string;
    progressText?: string;
    ownSicknessText?: string;
    permanentInfectionText?: string;
    exchangedSicknessThisTurnPlayerIds?: string[];
    permanentTraitorPlayerIds?: string[];
    sicknessValuesByPlayerId?: Record<string, Array<number | null>>;
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
};

const readDustFailedActionExchangeState = async (
    page: Page,
): Promise<DustFailedActionExchangeState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            phase?: string;
                            currentPlayer?: string;
                            pendingDamageAllocation?: unknown | null;
                            usedCardIdsThisTurn?: string[];
                            recentRoll?: DustFailedActionExchangeState['recentRoll'];
                            activityLog?: Array<{ text?: string }>;
                            endgameResult?: DustFailedActionExchangeState['endgameResult'];
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
        const text = (selector: string) =>
            document.querySelector<HTMLElement>(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            pendingDamageAllocation: core?.pendingDamageAllocation ?? null,
            deadExplorerPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
            recentRoll: core?.recentRoll ?? null,
            latestLog: core?.activityLog?.[0]?.text ?? '',
            progressText: text('[data-testid="betrayal-dust-progress-strip"]'),
            ownSicknessText: text('[data-testid="betrayal-dust-progress-item-own-sickness"]'),
            permanentInfectionText: text('[data-testid="betrayal-dust-progress-item-permanent-infection"]'),
            exchangedSicknessThisTurnPlayerIds: dust?.exchangedSicknessThisTurnPlayerIds ?? [],
            permanentTraitorPlayerIds: dust?.permanentTraitorPlayerIds ?? [],
            sicknessValuesByPlayerId: Object.fromEntries(
                Object.entries(dust?.sicknessTokensByPlayerId ?? {}).map(([playerId, tokens]) => [
                    playerId,
                    tokens.map((token) => token.value),
                ]),
            ),
            endgameResult: core?.endgameResult ?? null,
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

test.describe('山屋惊魂作祟3灰尘失败行动疾病交换', () => {
    test('寻找解药失败会与左侧存活玩家交换疾病，并让结束回合跳过灰尘冲动伤害', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-failed-action-sickness-exchange');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustFailedActionSicknessExchangeRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect(page.getByTestId('betrayal-action-use')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toContainText('寻找解药');
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('交换疾病需同房');
        await expect.poll(() => readDustFailedActionExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            pendingDamageAllocation: null,
            deadExplorerPlayerIds: ['2'],
            exchangedSicknessThisTurnPlayerIds: [],
            permanentTraitorPlayerIds: ['3'],
            sicknessValuesByPlayerId: {
                '0': [7, 8, 9],
                '1': [4, 5, 6],
                '2': [12, 13, 14],
                '3': [1, 10, 11],
            },
            ownSicknessText: expect.stringContaining('4 / 5 / 6'),
            permanentInfectionText: expect.stringContaining('否'),
        });
        await saveScreenshot(page, BEFORE_SCREENSHOT);

        await setHarnessRandomQueue(page, Array.from({ length: 10 }, () => 0));
        await page.getByTestId('betrayal-action-use').click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('寻找解药失败');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('左侧玩家随机交换');
        await expect.poll(() => readDustFailedActionExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            pendingDamageAllocation: null,
            usedCardIdsThisTurn: expect.arrayContaining(['search-for-cure']),
            recentRoll: {
                sourceTitle: '寻找解药',
                latestLabel: '交换疾病标记',
                dice: [0, 0, 0],
            },
            exchangedSicknessThisTurnPlayerIds: ['1', '3'],
            permanentTraitorPlayerIds: ['3', '1'],
            sicknessValuesByPlayerId: {
                '0': [7, 8, 9],
                '1': [1, 5, 6],
                '2': [12, 13, 14],
                '3': [4, 10, 11],
            },
        });
        await saveScreenshot(page, AFTER_SEARCH_SCREENSHOT);

        await page.getByRole('button', { name: '返回牌桌' }).click();
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('你的疾病1 / 5 / 6');
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('永久感染是');
        await page.getByTestId('betrayal-action-endTurn').click();

        await expect(page.getByTestId('betrayal-damage-allocation-panel')).toHaveCount(0);
        await expect.poll(() => readDustFailedActionExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '3',
            pendingDamageAllocation: null,
            exchangedSicknessThisTurnPlayerIds: [],
            sicknessValuesByPlayerId: {
                '0': [7, 8, 9],
                '1': [1, 5, 6],
                '2': [12, 13, 14],
                '3': [4, 10, 11],
            },
        });
        await saveScreenshot(page, AFTER_END_TURN_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-failed-action-sickness-exchange', diagnostics }]);
    });

    test('寻找解药失败交换后若所有存活者都永久感染则进入叛徒胜利', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-failed-action-all-infected');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createDustFailedActionSicknessExchangeRuntimeCore();
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect(page.getByTestId('betrayal-action-use')).toContainText('寻找解药');
        await expect.poll(() => readDustFailedActionExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            deadExplorerPlayerIds: ['0', '2'],
            permanentTraitorPlayerIds: ['3'],
            endgameResult: null,
        });

        await setHarnessRandomQueue(page, Array.from({ length: 10 }, () => 0));
        await page.getByTestId('betrayal-action-use').click();

        const returnButton = page.getByRole('button', { name: '返回牌桌' });
        if (await returnButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await returnButton.click();
        }

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('灰尘');
        await expect(endgameScreen).toContainText('叛徒得逞');
        await expect.poll(() => readDustFailedActionExchangeState(page)).toMatchObject({
            phase: 'endgame',
            deadExplorerPlayerIds: ['0', '2'],
            permanentTraitorPlayerIds: ['3', '1'],
            endgameResult: {
                hauntId: 'the-dust',
                outcome: 'traitor',
                winners: ['3', '1'],
            },
        });
        await saveScreenshot(page, ALL_INFECTED_ENDGAME_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-failed-action-all-infected', diagnostics }]);
    });

    test('治愈灰尘失败交换后若所有存活者都永久感染则进入叛徒胜利', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-cure-failure-all-infected');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const core = createDustFailedActionSicknessExchangeRuntimeCore();
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        if (!core.scenarioRuntime.dust) {
            throw new Error('灰尘治愈失败全员感染 E2E 缺少 dust 运行态');
        }
        core.scenarioRuntime.dust.researchRoomIds = ['ground-north', 'hallway'];
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect(page.getByTestId('betrayal-action-use')).toContainText('治愈灰尘');
        await expect.poll(() => readDustFailedActionExchangeState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            deadExplorerPlayerIds: ['0', '2'],
            permanentTraitorPlayerIds: ['3'],
            endgameResult: null,
        });

        await setHarnessRandomQueue(page, Array.from({ length: 10 }, () => 0));
        await page.getByTestId('betrayal-action-use').click();

        const returnButton = page.getByRole('button', { name: '返回牌桌' });
        if (await returnButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await returnButton.click();
        }

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('灰尘');
        await expect(endgameScreen).toContainText('叛徒得逞');
        await expect.poll(() => readDustFailedActionExchangeState(page)).toMatchObject({
            phase: 'endgame',
            deadExplorerPlayerIds: ['0', '2'],
            permanentTraitorPlayerIds: ['3', '1'],
            endgameResult: {
                hauntId: 'the-dust',
                outcome: 'traitor',
                winners: ['3', '1'],
            },
        });
        await saveScreenshot(page, CURE_FAILURE_ALL_INFECTED_ENDGAME_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-cure-failure-all-infected', diagnostics }]);
    });
});
