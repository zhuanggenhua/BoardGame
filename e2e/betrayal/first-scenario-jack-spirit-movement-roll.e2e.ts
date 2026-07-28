import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createJackSpiritMovementRollReadyRuntimeCore,
    createJackSpiritNaturalMonsterTurnBeforeRollRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-jack-spirit-movement-roll';
const ROLL_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-杰克之灵移动骰后.jpg`;
const MOVED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-第一剧本-杰克之灵移动扣点后.jpg`;
const NATURAL_TURN_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-第一剧本-杰克之灵自然回合-上一英雄结束前.jpg`;
const NATURAL_TURN_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-第一剧本-杰克之灵自然回合-移动骰出现.jpg`;

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

    test('叛徒死亡后轮到叛徒时会自然进入杰克之灵移动骰', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-jack-spirit-natural-turn');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=1&seed=jack-spirit-natural-turn', {
            waitUntil: 'domcontentloaded',
        });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createJackSpiritNaturalMonsterTurnBeforeRollRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                currentPlayer?: string;
                                movesRemaining?: number;
                                recentRoll?: { kind?: string; trait?: string; dice?: number[] } | null;
                                scenarioRuntime?: {
                                    jackSpiritReleased?: boolean;
                                    jackSpiritRoomId?: string | null;
                                };
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return {
                currentPlayer: state?.core?.currentPlayer,
                jackSpiritReleased: state?.core?.scenarioRuntime?.jackSpiritReleased,
                jackSpiritRoomId: state?.core?.scenarioRuntime?.jackSpiritRoomId,
                recentRollKind: state?.core?.recentRoll?.kind ?? null,
                movesRemaining: state?.core?.movesRemaining,
            };
        })).toMatchObject({
            currentPlayer: '1',
            jackSpiritReleased: true,
            recentRollKind: null,
        });
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
        await saveScreenshot(page, NATURAL_TURN_BEFORE_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.5, 0.5, 0.01]);
        await page.getByTestId('betrayal-action-endTurn').click();
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                currentPlayer?: string;
                                activeRoomId?: string;
                                movesRemaining?: number;
                                recentRoll?: { kind?: string; trait?: string; dice?: number[] };
                                scenarioRuntime?: { jackSpiritRoomId?: string | null };
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return {
                currentPlayer: state?.core?.currentPlayer,
                activeRoomId: state?.core?.activeRoomId,
                jackSpiritRoomId: state?.core?.scenarioRuntime?.jackSpiritRoomId,
                activeRoomMatchesJackSpirit: state?.core?.activeRoomId === state?.core?.scenarioRuntime?.jackSpiritRoomId,
                movesRemaining: state?.core?.movesRemaining,
                recentRollKind: state?.core?.recentRoll?.kind,
                recentRollTrait: state?.core?.recentRoll?.trait,
                recentRollDice: state?.core?.recentRoll?.dice,
            };
        })).toMatchObject({
            currentPlayer: '2',
            activeRoomMatchesJackSpirit: true,
            movesRemaining: 2,
            recentRollKind: 'monsterMoveRoll',
            recentRollTrait: 'speed',
            recentRollDice: [1, 1, 0],
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/杰克之灵速度 3 投出 2|本回合可移动 2 间/);
        await saveScreenshot(page, NATURAL_TURN_ROLL_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-jack-spirit-natural-turn', diagnostics }]);
    });
});
