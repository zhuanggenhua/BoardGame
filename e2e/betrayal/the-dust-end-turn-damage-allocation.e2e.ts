import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustEndTurnDamageAllocationRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-end-turn-damage-allocation';
const BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-灰尘未交换结束回合前.jpg`;
const DAMAGE_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/02-灰尘冲动伤害分配面板.jpg`;
const HANDOFF_SCREENSHOT = `${EVIDENCE_DIR}/03-灰尘冲动分配确认后交接.jpg`;
const TEST_URL = '/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-end-turn-damage-allocation';

type DustEndTurnState = {
    currentPlayer?: string;
    currentRoomId?: string | null;
    otherRooms?: Record<string, string | null>;
    pendingDamageAllocation?: {
        playerId?: string;
        sourceTitle?: string;
        damageKind?: string;
        amount?: number;
        allowedTraits?: string[];
        allowSkull?: boolean;
        nextPlayerId?: string | null;
    } | null;
    exchangedSicknessThisTurnPlayerIds?: string[];
};

const readDustEndTurnState = async (page: Page): Promise<DustEndTurnState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            currentExplorer?: { roomId?: string | null };
                            otherExplorers?: Array<{ playerId: string; roomId?: string | null }>;
                            pendingDamageAllocation?: DustEndTurnState['pendingDamageAllocation'];
                            scenarioRuntime?: {
                                dust?: { exchangedSicknessThisTurnPlayerIds?: string[] };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;

        return {
            currentPlayer: core?.currentPlayer,
            currentRoomId: core?.currentExplorer?.roomId ?? null,
            otherRooms: Object.fromEntries(
                (core?.otherExplorers ?? []).map((explorer) => [
                    explorer.playerId,
                    explorer.roomId ?? null,
                ]),
            ),
            pendingDamageAllocation: core?.pendingDamageAllocation ?? null,
            exchangedSicknessThisTurnPlayerIds:
                core?.scenarioRuntime?.dust?.exchangedSicknessThisTurnPlayerIds ?? [],
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

test.describe('山屋惊魂作祟3灰尘回合末未交换疾病伤害分配', () => {
    test('未交换疾病结束回合后进入2点一般伤害分配，确认后才交给下一名玩家', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-end-turn-damage-allocation');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustEndTurnDamageAllocationRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readDustEndTurnState(page)).toMatchObject({
            currentPlayer: '1',
            currentRoomId: 'hallway',
            otherRooms: {
                '0': 'ground-north',
                '2': 'entrance-hall',
            },
            pendingDamageAllocation: null,
            exchangedSicknessThisTurnPlayerIds: [],
        });
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
        await saveScreenshot(page, BEFORE_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.5, 0.5]);
        await page.getByTestId('betrayal-action-endTurn').click();

        const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
        await expect(damagePanel).toBeVisible();
        await expect(damagePanel).toHaveAttribute('data-player-id', '1');
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('灰尘冲动');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText('2 点一般伤害');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('力量');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('速度');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('知识');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('神志');
        await expect.poll(() => readDustEndTurnState(page)).toMatchObject({
            currentPlayer: '1',
            pendingDamageAllocation: {
                playerId: '1',
                sourceTitle: '灰尘冲动',
                damageKind: 'general',
                amount: 2,
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                allowSkull: true,
                nextPlayerId: '2',
            },
        });
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        await saveScreenshot(page, DAMAGE_PANEL_SCREENSHOT);

        await page.getByTestId('betrayal-damage-allocation-trait-might').click();
        await page.getByTestId('betrayal-damage-allocation-trait-speed').click();
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await page.getByTestId('betrayal-damage-allocation-confirm').click();

        await expect(damagePanel).toHaveCount(0);
        await expect.poll(() => readDustEndTurnState(page)).toMatchObject({
            currentPlayer: '2',
            pendingDamageAllocation: null,
            exchangedSicknessThisTurnPlayerIds: [],
        });
        await saveScreenshot(page, HANDOFF_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-end-turn-damage-allocation', diagnostics }]);
    });
});
