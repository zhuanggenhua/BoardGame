import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustNonTraitorCorpseLootRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-non-traitor-corpse-loot';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-灰尘非叛徒尸体可搜刮.jpg`;
const SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-灰尘选择尸体和地图.jpg`;
const LOOTED_SCREENSHOT = `${EVIDENCE_DIR}/03-灰尘搜尸后限制本回合二次搜刮.jpg`;
const TEST_URL = '/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&seed=the-dust-non-traitor-corpse-loot';

type DustCorpseLootState = {
    currentPlayer?: string;
    currentExplorerId?: string;
    deadPlayerIds?: string[];
    currentInventory?: string[];
    corpseInventory?: string[];
    corpseLootedByPlayerIdsThisTurn?: string[];
    feverishPlayerIds?: string[];
    permanentTraitorPlayerIds?: string[];
    pendingSicknessExchange?: unknown | null;
    latestLog?: string | null;
    rejected?: { commandType?: string; error?: string } | null;
};

const readDustCorpseLootState = async (page: Page): Promise<DustCorpseLootState> =>
    page.evaluate(() => {
        const holder = window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            currentExplorer?: { playerId?: string; inventory?: Array<{ name: string }> };
                            otherExplorers?: Array<{ playerId: string; inventory?: Array<{ name: string }> }>;
                            scenarioRuntime?: {
                                deadExplorerPlayerIds?: string[];
                                corpseLootedByPlayerIdsThisTurn?: string[];
                                dust?: {
                                    feverishPlayerIds?: string[];
                                    permanentTraitorPlayerIds?: string[];
                                    pendingSicknessExchange?: unknown | null;
                                };
                            };
                            activityLog?: Array<{ text?: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { commandType?: string; error?: string } | null;
        };
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.()?.core;
        return {
            currentPlayer: core?.currentPlayer,
            currentExplorerId: core?.currentExplorer?.playerId,
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            currentInventory: core?.currentExplorer?.inventory?.map((card) => card.name) ?? [],
            corpseInventory: core?.otherExplorers?.find((explorer) => explorer.playerId === '1')?.inventory?.map((card) => card.name) ?? [],
            corpseLootedByPlayerIdsThisTurn: core?.scenarioRuntime?.corpseLootedByPlayerIdsThisTurn ?? [],
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            permanentTraitorPlayerIds: core?.scenarioRuntime?.dust?.permanentTraitorPlayerIds ?? [],
            pendingSicknessExchange: core?.scenarioRuntime?.dust?.pendingSicknessExchange ?? null,
            latestLog: core?.activityLog?.[0]?.text ?? null,
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

test('灰尘非叛徒死亡后保留遗物并能从真实页面搜尸', async ({ page, context }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-non-traitor-corpse-loot');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await waitForBetrayalPageReady(page);
    await injectCore(page, createDustNonTraitorCorpseLootRuntimeCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await dismissHauntRevealCueIfVisible(page);

    await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('剧本3');
    await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
    await expect(page.getByTestId('betrayal-status-chip')).toContainText('达里尔·海拉');
    await expect(page.getByTestId('betrayal-action-trade'), '灰尘非叛徒尸体同房时，主动作入口应是搜尸').toContainText('搜尸');
    await expect(page.getByTestId('betrayal-trade-status')).toContainText(/可搜刮|尸体/i);
    await expect(page.getByTestId('betrayal-room-occupant-target-outline-hallway-1')).toHaveAttribute('data-highlight-shape', 'pentagon');
    await expect.poll(() => readDustCorpseLootState(page)).toMatchObject({
        currentPlayer: '2',
        currentExplorerId: '2',
        deadPlayerIds: expect.arrayContaining(['1']),
        permanentTraitorPlayerIds: ['0'],
        feverishPlayerIds: expect.not.arrayContaining(['1']),
        corpseInventory: expect.arrayContaining(['地图', '书本']),
        currentInventory: expect.not.arrayContaining(['地图']),
        pendingSicknessExchange: null,
        rejected: null,
    });
    await saveScreenshot(page, READY_SCREENSHOT);

    await page.getByTestId('betrayal-action-trade').click();
    await expect(page.getByTestId('betrayal-room-latest-feedback')).not.toContainText(/拿走了/);
    await page.getByTestId('betrayal-room-occupant-hallway-1').click();
    await expect(page.getByTestId('betrayal-corpse-loot-card-selector')).toBeVisible();
    await page.getByTestId('betrayal-corpse-loot-card-map').click();
    await expect(page.getByTestId('betrayal-corpse-loot-card-map')).toHaveClass(/underline/);
    await saveScreenshot(page, SELECTED_SCREENSHOT);

    await page.getByTestId('betrayal-action-trade').click();
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/尸体|拿走|地图/i);
    await expect.poll(() => readDustCorpseLootState(page)).toMatchObject({
        currentInventory: expect.arrayContaining(['地图']),
        corpseInventory: ['书本'],
        corpseLootedByPlayerIdsThisTurn: expect.arrayContaining(['1']),
        deadPlayerIds: expect.arrayContaining(['1']),
        feverishPlayerIds: expect.not.arrayContaining(['1']),
        pendingSicknessExchange: null,
        latestLog: expect.stringMatching(/尸体|地图/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-action-trade'), '本回合已经搜过该尸体后不能继续搜第二张').toContainText('交易');
    await expect(page.getByTestId('betrayal-action-trade')).toBeDisabled();
    await expect(page.getByTestId('betrayal-trade-status')).toContainText(/没有同房间队友|没有/);
    await saveScreenshot(page, LOOTED_SCREENSHOT);

    await assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-non-traitor-corpse-loot', diagnostics }]);
});
