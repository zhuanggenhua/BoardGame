import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustDeadTraitorBurialNoLootRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-dead-traitor-burial-no-loot';
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-灰尘死亡叛徒遗物掩埋不可搜尸.jpg`;
const TEST_URL = '/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&seed=the-dust-dead-traitor-burial-no-loot';

type DustDeadTraitorBurialState = {
    currentPlayer?: string;
    currentExplorerId?: string;
    currentRoomId?: string | null;
    deadPlayerIds?: string[];
    feverishPlayerIds?: string[];
    permanentTraitorPlayerIds?: string[];
    currentInventory?: string[];
    deadTraitorInventory?: string[];
    deadTraitorRoomId?: string | null;
    feverishRoomId?: string | null;
    pendingSicknessExchange?: unknown | null;
    rejected?: { commandType?: string; error?: string } | null;
};

const readDustDeadTraitorBurialState = async (
    page: Page,
): Promise<DustDeadTraitorBurialState> =>
    page.evaluate(() => {
        const holder = window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            currentExplorer?: {
                                playerId?: string;
                                roomId?: string | null;
                                inventory?: Array<{ name: string }>;
                            };
                            otherExplorers?: Array<{
                                playerId: string;
                                roomId?: string | null;
                                inventory?: Array<{ name: string }>;
                            }>;
                            monsters?: Array<{ id: string; roomId?: string | null }>;
                            scenarioRuntime?: {
                                deadExplorerPlayerIds?: string[];
                                dust?: {
                                    feverishPlayerIds?: string[];
                                    permanentTraitorPlayerIds?: string[];
                                    pendingSicknessExchange?: unknown | null;
                                };
                            };
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { commandType?: string; error?: string } | null;
        };
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const deadTraitor = core?.otherExplorers?.find((explorer) => explorer.playerId === '1');
        const feverish = core?.monsters?.find((monster) => monster.id === 'feverish-1');
        return {
            currentPlayer: core?.currentPlayer,
            currentExplorerId: core?.currentExplorer?.playerId,
            currentRoomId: core?.currentExplorer?.roomId ?? null,
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            permanentTraitorPlayerIds: core?.scenarioRuntime?.dust?.permanentTraitorPlayerIds ?? [],
            currentInventory: core?.currentExplorer?.inventory?.map((card) => card.name) ?? [],
            deadTraitorInventory: deadTraitor?.inventory?.map((card) => card.name) ?? [],
            deadTraitorRoomId: deadTraitor?.roomId ?? null,
            feverishRoomId: feverish?.roomId ?? null,
            pendingSicknessExchange: core?.scenarioRuntime?.dust?.pendingSicknessExchange ?? null,
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

test('灰尘死亡叛徒变狂热病患后遗物已掩埋且同房玩家不能搜尸', async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-dead-traitor-burial-no-loot');

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(TEST_URL, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await waitForBetrayalPageReady(page);
    await injectCore(page, createDustDeadTraitorBurialNoLootRuntimeCore());
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await dismissHauntRevealCueIfVisible(page);

    await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('剧本3');
    await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
    await expect(page.getByTestId('betrayal-room-occupant-hallway-1'), '死亡叛徒仍作为同房尸体 token 展示').toBeVisible();
    await expect(page.getByTestId('betrayal-room-monster-hallway-feverish-1'), '死亡叛徒已经生成同房狂热病患 token').toBeVisible();
    await expect(page.getByTestId('betrayal-action-trade'), '遗物已掩埋时，即使同房也不能显示搜尸入口').not.toContainText('搜尸');
    await expect(page.getByTestId('betrayal-corpse-loot-card-selector')).toHaveCount(0);
    await expect.poll(() => readDustDeadTraitorBurialState(page)).toMatchObject({
        currentPlayer: '2',
        currentExplorerId: '2',
        currentRoomId: 'hallway',
        deadPlayerIds: expect.arrayContaining(['1']),
        permanentTraitorPlayerIds: ['1'],
        feverishPlayerIds: ['1'],
        deadTraitorInventory: [],
        deadTraitorRoomId: 'hallway',
        feverishRoomId: 'hallway',
        pendingSicknessExchange: null,
        rejected: null,
    });
    await saveScreenshot(page, READY_SCREENSHOT);

    await assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-dead-traitor-burial-no-loot', diagnostics }]);
});
