import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { expect, test, type Locator } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createJackSpiritMovementRollReadyRuntimeCore,
    createJackSpiritNaturalMonsterTurnBeforeRollRuntimeCore,
    expectVisiblePhysicalDiceBox,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForPhysicalDiceSettled,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-jack-spirit-movement-roll';
const ROLL_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-杰克之灵移动骰后.jpg`;
const MOVED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-第一剧本-杰克之灵移动扣点后.jpg`;
const NATURAL_TURN_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-第一剧本-杰克之灵自然回合-上一英雄结束前.jpg`;
const NATURAL_TURN_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-第一剧本-杰克之灵自然回合-移动骰出现.jpg`;
const ROLL_ANIMATING_SCREENSHOT = `${EVIDENCE_DIR}/00-山屋惊魂-第一剧本-杰克之灵移动骰滚动中.jpg`;
const ROLL_SETTLED_DELAYED_SCREENSHOT = `${EVIDENCE_DIR}/01b-山屋惊魂-第一剧本-杰克之灵移动骰停稳2秒后.jpg`;
const BOUNDARY_DIAGNOSTICS = `${EVIDENCE_DIR}/dice-boundary-diagnostics.json`;

type RectSnapshot = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

type DiceBoundarySnapshot = {
    phase: string;
    groupRect: RectSnapshot | null;
    highlightRect: RectSnapshot | null;
    canvasRect: RectSnapshot | null;
    canvasClientWidth: number;
    canvasClientHeight: number;
    worldBounds: { width: number; height: number } | null;
    inferredPhysicsWall: { x: number; y: number } | null;
    resultStageRect: RectSnapshot | null;
    resultTotalRect: RectSnapshot | null;
    continueButtonRect: RectSnapshot | null;
    boundaryMatchesGroup: boolean;
    canvasMatchesBoundary: boolean;
    canvasMatchesGroup: boolean;
    highlightInsideGroup: boolean;
    dicePhysicsSourceFilter: string;
    diceGroupBackgroundImage: string;
    diceGroupBoxShadow: string;
    highlightBackgroundImage: string;
    highlightBoxShadow: string;
    highlightInsetFromGroup: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    } | null;
    resultClearsBoundary: boolean | null;
    continueButtonInsideViewport: boolean | null;
    continueButtonClearsResult: boolean | null;
    minDiceCanvasEdgeMargin: number | null;
    diceCount: number;
    dice: Array<{
        index: number;
        value: number | null;
        bodyPosition: { x: number; y: number; z: number } | null;
        viewportBox: RectSnapshot | null;
        canvasBox: RectSnapshot | null;
        canvasEdgeMargin: number | null;
        projectedInsideCanvas: boolean | null;
        bodyInsideInferredWall: boolean | null;
    }>;
};

const writeBoundaryDiagnostics = (snapshots: DiceBoundarySnapshot[]) => {
    mkdirSync(dirname(BOUNDARY_DIAGNOSTICS), { recursive: true });
    writeFileSync(
        BOUNDARY_DIAGNOSTICS,
        `${JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                purpose: '山屋杰克之灵移动骰开放骰盘光晕、canvas、骰子投影和插件物理边界诊断',
                screenshots: {
                    rolling: ROLL_ANIMATING_SCREENSHOT,
                    settled: ROLL_READY_SCREENSHOT,
                    settledDelayed: ROLL_SETTLED_DELAYED_SCREENSHOT,
                },
                snapshots,
            },
            null,
            2,
        )}\n`,
        'utf8',
    );
};

const collectDiceBoundarySnapshot = async (
    rollPanel: Locator,
    phase: string,
): Promise<DiceBoundarySnapshot> => {
    const diceGroup = rollPanel.getByTestId('betrayal-house-dice-3d-group');
    const boundary = rollPanel.getByTestId('betrayal-house-dice-boundary-highlight');
    await expect(diceGroup).toHaveAttribute('data-dice-boundary-highlight', 'subtle-open-stage');
    await expect(boundary).toBeVisible();
    await expect(boundary).toHaveAttribute('data-dice-boundary-highlight', 'runtime-visible');

    const snapshot = await rollPanel.evaluate((panel, currentPhase) => {
        type Layout = {
            x: number;
            y: number;
            width: number;
            height: number;
            visualWidth?: number;
            visualHeight?: number;
        };
        type DebugSnapshot = {
            dice?: Array<{
                index?: number;
                value?: number | null;
                bodyPosition?: { x: number; y: number; z: number } | null;
                layout?: Layout | null;
            }>;
            canvas?: { clientWidth?: number; clientHeight?: number } | null;
            worldBounds?: { width: number; height: number } | null;
        };
        const root = panel as HTMLElement;
        const group = root.querySelector('[data-testid="betrayal-house-dice-3d-group"]') as HTMLElement | null;
        const dicePhysicsSource = root.querySelector('[data-testid="betrayal-house-dice-physics-source"]') as HTMLElement | null;
        const highlight = root.querySelector('[data-testid="betrayal-house-dice-boundary-highlight"]') as HTMLElement | null;
        const canvas = root.querySelector('canvas') as HTMLCanvasElement | null;
        const resultStage = root.querySelector('[data-testid="betrayal-recent-roll-result-stage"]') as HTMLElement | null;
        const resultTotal = root.querySelector('[data-testid="betrayal-recent-roll-total"]') as HTMLElement | null;
        const backdrop = root.closest('[data-testid="betrayal-roll-result-backdrop"]') as HTMLElement | null;
        const continueButton = backdrop?.querySelector('[data-testid="betrayal-roll-continue"]') as HTMLElement | null;
        const debugKey = group?.dataset.diceDebugKey ?? canvas?.dataset.testid;
        const debugRegistry = (window as typeof window & {
            __diceBoxThreeDebug?: Record<string, () => DebugSnapshot | null>;
        }).__diceBoxThreeDebug ?? {};
        const engineSnapshot = debugKey
            ? (debugRegistry[debugKey]?.() ?? null)
            : (debugRegistry['betrayal-house-dice-box-canvas']?.() ?? null);

        const roundInPage = (value: number): number => Math.round(value * 100) / 100;
        const rectOf = (element: Element | null): RectSnapshot | null => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: roundInPage(rect.left),
                top: roundInPage(rect.top),
                right: roundInPage(rect.right),
                bottom: roundInPage(rect.bottom),
                width: roundInPage(rect.width),
                height: roundInPage(rect.height),
            };
        };
        const sameRect = (left: RectSnapshot | null, right: RectSnapshot | null, tolerance = 2) =>
            Boolean(left && right
                && Math.abs(left.left - right.left) <= tolerance
                && Math.abs(left.top - right.top) <= tolerance
                && Math.abs(left.width - right.width) <= tolerance
                && Math.abs(left.height - right.height) <= tolerance);

        const groupRect = rectOf(group);
        const highlightRect = rectOf(highlight);
        const canvasRect = rectOf(canvas);
        const resultStageRect = rectOf(resultStage);
        const resultTotalRect = rectOf(resultTotal);
        const continueButtonRect = rectOf(continueButton);
        const canvasClientWidth = engineSnapshot?.canvas?.clientWidth ?? canvas?.clientWidth ?? 0;
        const canvasClientHeight = engineSnapshot?.canvas?.clientHeight ?? canvas?.clientHeight ?? 0;
        const displayScaleX = canvasRect && canvasClientWidth > 0 ? canvasRect.width / canvasClientWidth : 1;
        const displayScaleY = canvasRect && canvasClientHeight > 0 ? canvasRect.height / canvasClientHeight : 1;
        const worldBounds = engineSnapshot?.worldBounds ?? null;
        const inferredPhysicsWall = worldBounds
            ? {
                x: roundInPage(worldBounds.width * 0.93),
                y: roundInPage(worldBounds.height * 0.93),
            }
            : null;

        const dice = (engineSnapshot?.dice ?? []).map((die, fallbackIndex) => {
            const layout = die.layout ?? null;
            const width = layout ? (layout.visualWidth ?? layout.width) : 0;
            const height = layout ? (layout.visualHeight ?? layout.height) : 0;
            const canvasBox = layout
                ? {
                    left: roundInPage(layout.x - width / 2),
                    top: roundInPage(layout.y - height / 2),
                    right: roundInPage(layout.x + width / 2),
                    bottom: roundInPage(layout.y + height / 2),
                    width: roundInPage(width),
                    height: roundInPage(height),
                }
                : null;
            const viewportBox = layout && canvasRect
                ? {
                    left: roundInPage(canvasRect.left + (layout.x - width / 2) * displayScaleX),
                    top: roundInPage(canvasRect.top + (layout.y - height / 2) * displayScaleY),
                    right: roundInPage(canvasRect.left + (layout.x + width / 2) * displayScaleX),
                    bottom: roundInPage(canvasRect.top + (layout.y + height / 2) * displayScaleY),
                    width: roundInPage(width * displayScaleX),
                    height: roundInPage(height * displayScaleY),
                }
                : null;
            const canvasEdgeMargin = canvasBox
                ? Math.min(
                    canvasBox.left,
                    canvasClientWidth - canvasBox.right,
                    canvasBox.top,
                    canvasClientHeight - canvasBox.bottom,
                )
                : null;
            const projectedInsideCanvas = canvasBox
                ? canvasBox.left >= 0
                    && canvasBox.top >= 0
                    && canvasBox.right <= canvasClientWidth
                    && canvasBox.bottom <= canvasClientHeight
                : null;
            const bodyInsideInferredWall = die.bodyPosition && inferredPhysicsWall
                ? Math.abs(die.bodyPosition.x) <= inferredPhysicsWall.x
                    && Math.abs(die.bodyPosition.y) <= inferredPhysicsWall.y
                : null;

            return {
                index: die.index ?? fallbackIndex,
                value: die.value ?? null,
                bodyPosition: die.bodyPosition
                    ? {
                        x: roundInPage(die.bodyPosition.x),
                        y: roundInPage(die.bodyPosition.y),
                        z: roundInPage(die.bodyPosition.z),
                    }
                    : null,
                viewportBox,
                canvasBox,
                canvasEdgeMargin: canvasEdgeMargin === null ? null : roundInPage(canvasEdgeMargin),
                projectedInsideCanvas,
                bodyInsideInferredWall,
            };
        });
        const diceEdgeMargins = dice
            .map((die) => die.canvasEdgeMargin)
            .filter((margin): margin is number => typeof margin === 'number' && Number.isFinite(margin));
        const minDiceCanvasEdgeMargin = diceEdgeMargins.length
            ? roundInPage(Math.min(...diceEdgeMargins))
            : null;
        const resultClearsBoundary = groupRect && resultStageRect
            ? resultStageRect.top >= groupRect.bottom + 8
                && (!resultTotalRect || resultTotalRect.top >= groupRect.bottom + 4)
            : null;
        const continueButtonInsideViewport = continueButtonRect
            ? continueButtonRect.left >= 0
                && continueButtonRect.top >= 0
                && continueButtonRect.right <= window.innerWidth
                && continueButtonRect.bottom <= window.innerHeight
            : null;
        const continueButtonClearsResult = continueButtonRect && resultStageRect
            ? continueButtonRect.top >= resultStageRect.bottom + 4
            : null;
        const canvasMatchesGroup = sameRect(canvasRect, groupRect);
        const highlightInsetFromGroup = highlightRect && groupRect
            ? {
                left: roundInPage(highlightRect.left - groupRect.left),
                top: roundInPage(highlightRect.top - groupRect.top),
                right: roundInPage(groupRect.right - highlightRect.right),
                bottom: roundInPage(groupRect.bottom - highlightRect.bottom),
            }
            : null;
        const highlightInsideGroup = Boolean(
            highlightRect && groupRect
            && highlightRect.left >= groupRect.left + 4
            && highlightRect.top >= groupRect.top + 4
            && highlightRect.right <= groupRect.right - 4
            && highlightRect.bottom <= groupRect.bottom - 4,
        );

        return {
            phase: currentPhase,
            groupRect,
            highlightRect,
            canvasRect,
            resultStageRect,
            resultTotalRect,
            canvasClientWidth,
            canvasClientHeight,
            worldBounds,
            inferredPhysicsWall,
            continueButtonRect,
            boundaryMatchesGroup: sameRect(highlightRect, groupRect),
            canvasMatchesBoundary: sameRect(canvasRect, highlightRect),
            canvasMatchesGroup,
            highlightInsideGroup,
            dicePhysicsSourceFilter: dicePhysicsSource ? getComputedStyle(dicePhysicsSource).filter : "",
            diceGroupBackgroundImage: group ? getComputedStyle(group).backgroundImage : "",
            diceGroupBoxShadow: group ? getComputedStyle(group).boxShadow : "",
            highlightBackgroundImage: highlight ? getComputedStyle(highlight).backgroundImage : "",
            highlightBoxShadow: highlight ? getComputedStyle(highlight).boxShadow : "",
            highlightInsetFromGroup,
            resultClearsBoundary,
            continueButtonInsideViewport,
            continueButtonClearsResult,
            minDiceCanvasEdgeMargin,
            diceCount: dice.length,
            dice,
        };
    }, phase);

    expect(
        snapshot.canvasMatchesGroup,
        `骰子 Three.js canvas 必须贴合骰盘容器：${JSON.stringify(snapshot)}`,
    ).toBe(true);
    expect(
        snapshot.highlightInsideGroup,
        `开放骰盘诊断边界必须内缩，不能回退为贴边硬框：${JSON.stringify(snapshot)}`,
    ).toBe(true);
    expect(
        snapshot.diceGroupBackgroundImage,
        `开放骰盘容器不得绘制整体背景，否则玩家会看到暗色方框：${JSON.stringify(snapshot)}`,
    ).toBe("none");
    expect(
        snapshot.diceGroupBoxShadow,
        `开放骰盘容器不得绘制整体阴影，否则玩家会看到暗色方框：${JSON.stringify(snapshot)}`,
    ).toBe("none");
    expect(
        snapshot.highlightBackgroundImage,
        `开放骰盘边界层不得再画整块背景，只允许骰子本体和逐骰高亮：${JSON.stringify(snapshot)}`,
    ).toBe("none");
    expect(
        snapshot.highlightBoxShadow,
        `开放骰盘边界层不得再画整块阴影，只允许骰子本体和逐骰高亮：${JSON.stringify(snapshot)}`,
    ).toBe("none");
    expect(
        snapshot.dicePhysicsSourceFilter,
        `开放骰盘不得给整张物理骰 canvas 套阴影滤镜，否则会显示成暗色方框：${JSON.stringify(snapshot)}`,
    ).toBe("none");
    expect(
        snapshot.diceCount,
        `骰盘边界诊断必须读到真实骰子投影：${JSON.stringify(snapshot)}`,
    ).toBeGreaterThan(0);
    expect(
        snapshot.minDiceCanvasEdgeMargin,
        `骰子不能贴边或只显示半截：${JSON.stringify(snapshot)}`,
    ).toBeGreaterThanOrEqual(12);
    expect(
        snapshot.resultClearsBoundary,
        `投骰结果文字不能伸进骰盘区域：${JSON.stringify(snapshot)}`,
    ).toBe(true);
    expect(
        snapshot.continueButtonInsideViewport,
        `返回牌桌按钮必须完整显示在视口内，不能只露半截：${JSON.stringify(snapshot)}`,
    ).toBe(true);
    expect(
        snapshot.continueButtonClearsResult,
        `返回牌桌按钮必须独立显示在结果区下方，不能被结果面板裁切：${JSON.stringify(snapshot)}`,
    ).toBe(true);

    return snapshot;
};

const expectPhysicalDiceMotionKeepsStageStable = async (
    page: import('@playwright/test').Page,
    rollPanel: import('@playwright/test').Locator,
) => {
    const physicsSource = rollPanel.getByTestId('betrayal-house-dice-physics-source');
    await expect.poll(async () => physicsSource.getAttribute('data-dice-settled'), {
        timeout: 5000,
    }).toBe('false');

    const readSample = () => rollPanel.evaluate((panel) => {
        type DebugSnapshot = {
            dice?: Array<{ layout?: { visualWidth?: number; visualHeight?: number } | null }>;
            canvas?: { clientWidth?: number; clientHeight?: number } | null;
        };
        const group = panel.querySelector('[data-testid="betrayal-house-dice-3d-group"]') as HTMLElement | null;
        const canvas = panel.querySelector('canvas') as HTMLCanvasElement | null;
        const debugKey = group?.dataset.diceDebugKey;
        const debugRegistry = (window as typeof window & {
            __diceBoxThreeDebug?: Record<string, () => DebugSnapshot | null>;
        }).__diceBoxThreeDebug ?? {};
        const snapshot = debugKey ? debugRegistry[debugKey]?.() ?? null : null;
        const visibleSizes = (snapshot?.dice ?? [])
            .map((die) => Math.min(die.layout?.visualWidth ?? 0, die.layout?.visualHeight ?? 0))
            .filter((size) => size > 0);
        return {
            canvasWidth: snapshot?.canvas?.clientWidth ?? canvas?.clientWidth ?? 0,
            canvasHeight: snapshot?.canvas?.clientHeight ?? canvas?.clientHeight ?? 0,
            diceCount: snapshot?.dice?.length ?? 0,
            minVisibleDieSize: visibleSizes.length ? Math.min(...visibleSizes) : 0,
        };
    });
    const first = await readSample();
    await page.waitForTimeout(120);
    const second = await readSample();

    expect(first.canvasWidth, `杰克之灵移动骰滚动中画布宽度必须可用：${JSON.stringify(first)}`).toBeGreaterThanOrEqual(160);
    expect(first.canvasHeight, `杰克之灵移动骰滚动中画布高度必须可用：${JSON.stringify(first)}`).toBeGreaterThanOrEqual(120);
    expect(second.canvasWidth).toBe(first.canvasWidth);
    expect(second.canvasHeight).toBe(first.canvasHeight);
    expect(second.diceCount).toBe(first.diceCount);
    expect(second.minVisibleDieSize, `杰克之灵移动骰滚动中不能缩成不可见小点：${JSON.stringify({ first, second })}`).toBeGreaterThanOrEqual(18);
};

const switchRoomMapToFloor = async (
    page: import('@playwright/test').Page,
    floor: 'upper' | 'ground' | 'basement',
) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (await page.getByTestId(`betrayal-room-floor-${floor}`).isVisible({ timeout: 500 }).catch(() => false)) {
            return;
        }
        const upperVisible = await page.getByTestId('betrayal-room-floor-upper').isVisible({ timeout: 250 }).catch(() => false);
        const basementVisible = await page.getByTestId('betrayal-room-floor-basement').isVisible({ timeout: 250 }).catch(() => false);
        if (floor === 'upper' || (floor === 'ground' && basementVisible)) {
            await page.getByTestId('betrayal-room-floor-up').click();
        } else if (floor === 'basement' || (floor === 'ground' && upperVisible)) {
            await page.getByTestId('betrayal-room-floor-down').click();
        }
    }
    await expect(page.getByTestId(`betrayal-room-floor-${floor}`)).toBeVisible();
};

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
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/作祟中|恶兆后|Haunt/i);
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
        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expectVisiblePhysicalDiceBox(rollPanel);
        const rollPhysicsSource = rollPanel.getByTestId('betrayal-house-dice-physics-source');
        await expect.poll(async () => rollPhysicsSource.getAttribute('data-dice-settled'), {
            timeout: 5000,
        }).toBe('false');
        const boundarySnapshots: DiceBoundarySnapshot[] = [];
        boundarySnapshots.push(await collectDiceBoundarySnapshot(rollPanel, 'rolling'));
        await saveScreenshot(page, ROLL_ANIMATING_SCREENSHOT);
        await expectPhysicalDiceMotionKeepsStageStable(page, rollPanel);
        await waitForPhysicalDiceSettled(rollPanel);
        boundarySnapshots.push(await collectDiceBoundarySnapshot(rollPanel, 'settled'));
        await saveScreenshot(page, ROLL_READY_SCREENSHOT);
        await page.waitForTimeout(2000);
        boundarySnapshots.push(await collectDiceBoundarySnapshot(rollPanel, 'settled-plus-2s'));
        writeBoundaryDiagnostics(boundarySnapshots);
        await saveScreenshot(page, ROLL_SETTLED_DELAYED_SCREENSHOT);

        await page.getByTestId('betrayal-roll-continue').click();
        await expect(page.getByTestId('betrayal-action-monsterTurnStart')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-monsterMovementRoll')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-monsterMove')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-move')).toBeEnabled();
        await page.getByTestId('betrayal-action-move').click();
        await switchRoomMapToFloor(page, 'upper');
        const moveTarget = page.getByTestId('betrayal-room-upper-landing');
        await expect(moveTarget).toBeVisible();
        await expect(moveTarget).toBeEnabled();
        await moveTarget.click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('杰克之灵游荡到了上层起始点');
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
            jackSpiritRoomId: 'upper-landing',
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
