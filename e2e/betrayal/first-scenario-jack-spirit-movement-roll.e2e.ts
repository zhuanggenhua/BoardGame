import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createJackSpiritMovementRollReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-jack-spirit-movement-roll';
const ROLL_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-杰克之灵移动骰后.jpg`;
const MOVED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-第一剧本-杰克之灵移动扣点后.jpg`;

test.describe('山屋惊魂第一剧本杰克之灵移动骰边界', () => {
    test('死叛徒回合会显示杰克之灵 Speed 3 移动骰，并按点数扣减移动', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-jack-spirit-movement-roll');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=2&seed=jack-spirit-movement-roll', {
            waitUntil: 'domcontentloaded',
        });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createJackSpiritMovementRollReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                currentPlayer?: string;
                                movesRemaining?: number;
                                recentRoll?: { kind?: string; trait?: string; dice?: number[] };
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return {
                currentPlayer: state?.core?.currentPlayer,
                movesRemaining: state?.core?.movesRemaining,
                recentRollKind: state?.core?.recentRoll?.kind,
                recentRollTrait: state?.core?.recentRoll?.trait,
                recentRollDice: state?.core?.recentRoll?.dice,
            };
        })).toMatchObject({
            currentPlayer: '2',
            movesRemaining: 2,
            recentRollKind: 'monsterMoveRoll',
            recentRollTrait: 'speed',
            recentRollDice: [1, 1, 0],
        });
        await expect(page.getByTestId('betrayal-status-chip')).toContainText(/当前回合|剩余移动 2/);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/杰克之灵速度 3 投出 2|本回合可移动 2 间/);
        await expect(page.getByTestId('betrayal-action-move')).toBeEnabled();
        await saveScreenshot(page, ROLL_READY_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await expect(page.getByTestId('betrayal-room-basement-landing')).toBeVisible();
        await page.getByTestId('betrayal-room-basement-landing').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('杰克之灵游荡到了地下室起始点');
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('剩余移动 1');
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                currentPlayer?: string;
                                movesRemaining?: number;
                                scenarioRuntime?: { jackSpiritRoomId?: string | null };
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return {
                currentPlayer: state?.core?.currentPlayer,
                movesRemaining: state?.core?.movesRemaining,
                jackSpiritRoomId: state?.core?.scenarioRuntime?.jackSpiritRoomId,
            };
        })).toMatchObject({
            currentPlayer: '2',
            movesRemaining: 1,
            jackSpiritRoomId: 'basement-landing',
        });
        await saveScreenshot(page, MOVED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-jack-spirit-movement-roll', diagnostics }]);
    });
});
