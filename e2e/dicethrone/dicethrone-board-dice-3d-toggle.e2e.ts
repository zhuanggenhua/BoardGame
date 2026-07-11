import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

const BOARD_DICE_3D_STORAGE_KEY = 'dicethrone:boardDice3dEnabled';
const MOBILE_DICE_VIEWPORTS = [
    { width: 844, height: 390 },
    { width: 932, height: 430 },
] as const;

async function dragHandCardToPlay(page: Page, cardId: string): Promise<void> {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    const cardBox = await page.evaluate((nextCardId: string) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function openFabSettingsPanel(page: Page) {
    const mainFabButton = page.locator('[data-fab-id="exit"]');
    await expect(mainFabButton).toBeVisible({ timeout: 10000 });
    await mainFabButton.click();

    const settingsButton = page.locator('[data-fab-id="settings"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    const settingsPanel = page.getByTestId('fab-panel-settings');
    await expect(settingsPanel).toBeVisible({ timeout: 5000 });
    return settingsPanel;
}

async function closeFabSettingsPanel(page: Page) {
    const settingsPanel = page.getByTestId('fab-panel-settings');
    if (!(await settingsPanel.isVisible().catch(() => false))) return;
    const settingsButton = page.locator('[data-fab-id="settings"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();
    await expect(settingsPanel).not.toBeVisible({ timeout: 5000 });
}

async function saveBoardDiceStageScreenshot(
    page: Page,
    name: string,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
): Promise<string> {
    const stage = page.getByTestId('dicethrone-board-dice-stage');
    await expect(stage).toBeVisible({ timeout: 5000 });
    const screenshotPath = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await stage.screenshot({ path: screenshotPath });
    return screenshotPath;
}

async function saveBoardDiceCanvasScreenshot(
    page: Page,
    name: string,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
): Promise<string> {
    const canvas = page.getByTestId('dicethrone-board-dice-box-canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });
    const screenshotPath = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await canvas.screenshot({ path: screenshotPath });
    return screenshotPath;
}

async function expectBoardDiceCanvasScreenshotHasVisibleDice(screenshotPath: string): Promise<void> {
    const { data, info } = await sharp(screenshotPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    let visiblePixelCount = 0;
    let brightDiceFacePixelCount = 0;
    let texturedPixelCount = 0;
    const sampledColumns = new Set<number>();
    const sampledRows = new Set<number>();

    for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
            const offset = ((y * info.width) + x) * info.channels;
            const r = data[offset] ?? 0;
            const g = data[offset + 1] ?? 0;
            const b = data[offset + 2] ?? 0;
            const a = data[offset + 3] ?? 0;
            if (a < 16) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max - min;
            const isVisibleDicePixel = max > 38 && (saturation > 18 || max > 105);
            if (!isVisibleDicePixel) continue;

            visiblePixelCount += 1;
            sampledColumns.add(Math.floor(x / 8));
            sampledRows.add(Math.floor(y / 8));
            if (r > 118 && g > 118 && b > 118 && saturation < 84) {
                brightDiceFacePixelCount += 1;
            }
            if (saturation > 28 && max > 60) {
                texturedPixelCount += 1;
            }
        }
    }

    const diagnostics = {
        screenshotPath,
        width: info.width,
        height: info.height,
        visiblePixelCount,
        brightDiceFacePixelCount,
        texturedPixelCount,
        sampledColumnBuckets: sampledColumns.size,
        sampledRowBuckets: sampledRows.size,
    };

    expect(
        visiblePixelCount,
        `棋盘 3D 骰子 canvas 里没有足够的真实可见骰子像素: ${JSON.stringify(diagnostics)}`,
    ).toBeGreaterThan(900);
    expect(
        brightDiceFacePixelCount,
        `棋盘 3D 骰子 canvas 里缺少可辨认的骰面亮部: ${JSON.stringify(diagnostics)}`,
    ).toBeGreaterThan(160);
    expect(
        texturedPixelCount,
        `棋盘 3D 骰子 canvas 里缺少贴图/边缘纹理像素: ${JSON.stringify(diagnostics)}`,
    ).toBeGreaterThan(260);
    expect(
        sampledColumns.size,
        `棋盘 3D 骰子 canvas 可见像素横向分布过窄，疑似只截到噪点或单个高光: ${JSON.stringify(diagnostics)}`,
    ).toBeGreaterThan(5);
    expect(
        sampledRows.size,
        `棋盘 3D 骰子 canvas 可见像素纵向分布过窄，疑似只截到噪点或单个高光: ${JSON.stringify(diagnostics)}`,
    ).toBeGreaterThan(5);
}

async function saveSettingsPanelScreenshot(
    panel: ReturnType<Page['getByTestId']>,
    name: string,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
) {
    await expect(panel).toBeVisible({ timeout: 5000 });
    const screenshotPath = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await panel.screenshot({ path: screenshotPath });
}

async function waitForBoardDiceSettled(page: Page): Promise<void> {
    await expect(page.getByTestId('dicethrone-board-dice-box-canvas')).toBeVisible({ timeout: 8000 });
    const readDebugState = async () => page.evaluate(() => {
        const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
        const canvasNode = document.querySelector('[data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
        const physicsSource = document.querySelector('[data-testid="dicethrone-board-dice-physics-source"]') as HTMLElement | null;
        const stageRect = stage?.getBoundingClientRect();
        const nodes = Array.from(document.querySelectorAll(
            '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
        )) as HTMLElement[];
        return {
            stageRect: stageRect ? {
                x: Math.round(stageRect.x),
                y: Math.round(stageRect.y),
                width: Math.round(stageRect.width),
                height: Math.round(stageRect.height),
            } : null,
            canvasDataset: canvasNode ? { ...canvasNode.dataset } : null,
            physicsDataset: physicsSource ? { ...physicsSource.dataset } : null,
            physicsStyle: physicsSource ? {
                visibility: window.getComputedStyle(physicsSource).visibility,
                opacity: window.getComputedStyle(physicsSource).opacity,
            } : null,
            diceButtons: nodes.map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                    testid: node.dataset.testid ?? node.getAttribute('data-testid'),
                    selected: node.dataset.selected,
                    renderMode: node.dataset.renderMode,
                    rotateX: node.dataset.rotateX,
                    rotateY: node.dataset.rotateY,
                    rotateZ: node.dataset.rotateZ,
                    rect: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    },
                };
            }),
        };
    });

    try {
        await page.waitForFunction(() => {
        const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
        const canvasNode = document.querySelector('[data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
        const physicsSource = document.querySelector('[data-testid="dicethrone-board-dice-physics-source"]') as HTMLElement | null;
        if (!stage || !canvasNode || !physicsSource) return false;
        if (
            canvasNode.dataset.skinsReady !== 'true'
            || canvasNode.dataset.diceSettled !== 'true'
            || canvasNode.dataset.diceVisualSettled !== 'true'
        ) return false;
        if (canvasNode.dataset.dicePhysicsSource !== 'dice-box-threejs') return false;
        const isMobileBoard = window.innerWidth <= 1023;
        const expectedWorldWidthScale = isMobileBoard ? '0.62' : '0.44';
        const expectedWorldHeightScale = isMobileBoard ? '0.78' : '0.44';
        const expectedCameraZoom = isMobileBoard ? '1.45' : '1';
        if (canvasNode.dataset.worldWidthScale !== expectedWorldWidthScale) return false;
        if (canvasNode.dataset.worldHeightScale !== expectedWorldHeightScale) return false;
        if (canvasNode.dataset.cameraZoom !== expectedCameraZoom) return false;
        if (isMobileBoard && canvasNode.dataset.fitWorldToCameraView !== 'true') return false;
        if (Number(canvasNode.dataset.physicsWorldWidth ?? 0) <= 0) return false;
        if (Number(canvasNode.dataset.physicsWorldHeight ?? 0) <= 0) return false;
        if (Number(canvasNode.dataset.diceMaxLift ?? Number.POSITIVE_INFINITY) > 0.004) return false;
        if (Number(canvasNode.dataset.diceMaxTravel ?? Number.POSITIVE_INFINITY) > 0.012) return false;
        if (physicsSource.dataset.dicePhysicsSource !== 'dice-box-threejs') return false;
        if (physicsSource.dataset.dicePhysicsMode !== 'debug-visible') return false;
        if (physicsSource.dataset.diceSettled !== 'true') return false;
        const physicsStyle = window.getComputedStyle(physicsSource);
        if (physicsStyle.visibility !== 'visible' || Number(physicsStyle.opacity) <= 0.01) return false;

        const stageRect = stage.getBoundingClientRect();
        const nodes = Array.from(document.querySelectorAll(
            '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
        )) as HTMLElement[];
        if (nodes.length === 0) return false;

        const positions = nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            const isEngineLayer = node.dataset.renderMode === 'engine';
            const isReasonableSize = rect.width >= 28 && rect.height >= 28 && rect.width <= 110 && rect.height <= 110;
            const isInsideStage = rect.left >= stageRect.left - 4
                && rect.top >= stageRect.top - 4
                && rect.right <= stageRect.right + 4
                && rect.bottom <= stageRect.bottom + 4;
            if (!isEngineLayer || !isReasonableSize || !isInsideStage) return null;
            return [
                node.dataset.testid ?? '',
                Math.round(rect.left),
                Math.round(rect.top),
                Math.round(rect.width),
                Math.round(rect.height),
                node.dataset.rotateX ?? '',
                node.dataset.rotateY ?? '',
                node.dataset.rotateZ ?? '',
            ].join(':');
        });
        if (positions.some((position) => position === null)) return false;
        const snapshot = positions.join('|');
        const win = window as Window & {
            __DT_BOARD_DICE_STABLE_SNAPSHOT__?: string;
            __DT_BOARD_DICE_STABLE_SINCE__?: number;
        };
        if (win.__DT_BOARD_DICE_STABLE_SNAPSHOT__ !== snapshot) {
            win.__DT_BOARD_DICE_STABLE_SNAPSHOT__ = snapshot;
            win.__DT_BOARD_DICE_STABLE_SINCE__ = performance.now();
            return false;
        }
        return performance.now() - (win.__DT_BOARD_DICE_STABLE_SINCE__ ?? 0) >= 360;
        }, undefined, { timeout: 8000 });
    } catch (error) {
        const debugState = await readDebugState();
        throw new Error(`棋盘 3D 骰子未达到视觉落地门槛: ${JSON.stringify(debugState)}\n${error instanceof Error ? error.message : String(error)}`);
    }
}

async function clickBoardDieCenter(page: Page, dieId: number): Promise<void> {
    const dieButton = page.locator(
        `[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-${dieId}"]`,
    );
    await expect(dieButton).toBeVisible({ timeout: 5000 });
    await dieButton.click();
}

async function readBoardDieHitDebug(page: Page, dieId: number) {
    return await page.evaluate((id) => {
        const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
        const hitLayer = document.querySelector('[data-testid="dicethrone-board-dice-hit-layer"]') as HTMLElement | null;
        const die = document.querySelector(
            `[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-${id}"]`,
        ) as HTMLElement | null;
        const stageRect = stage?.getBoundingClientRect();
        const hitRect = hitLayer?.getBoundingClientRect();
        const dieRect = die?.getBoundingClientRect();
        const centerX = dieRect ? dieRect.left + (dieRect.width / 2) : 0;
        const centerY = dieRect ? dieRect.top + (dieRect.height / 2) : 0;
        const topElement = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
        return {
            dieId: id,
            dieDataset: die ? { ...die.dataset } : null,
            stageRect: stageRect ? {
                left: stageRect.left,
                top: stageRect.top,
                width: stageRect.width,
                height: stageRect.height,
            } : null,
            hitRect: hitRect ? {
                left: hitRect.left,
                top: hitRect.top,
                width: hitRect.width,
                height: hitRect.height,
                cursor: window.getComputedStyle(hitLayer!).cursor,
                zIndex: window.getComputedStyle(hitLayer!).zIndex,
            } : null,
            dieRect: dieRect ? {
                left: dieRect.left,
                top: dieRect.top,
                width: dieRect.width,
                height: dieRect.height,
            } : null,
            center: { x: centerX, y: centerY },
            topTestId: topElement?.dataset.testid ?? topElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? '',
        };
    }, dieId);
}

async function expectBoardDiceSelectionUnderlay(page: Page, dieIds: number[]): Promise<void> {
    for (const dieId of dieIds) {
        const dieButton = page.locator(`[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-${dieId}"]`);
        await expect(dieButton).toHaveAttribute('data-render-mode', 'engine');
        await expect(dieButton).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId(`die-selected-ring-${dieId}`)).toBeVisible({ timeout: 3000 });
    }

    await expect(page.getByTestId('dicethrone-board-dice-ring-layer')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('dice-field-3d-underlay')).toHaveCount(0);
    await expect(page.locator('[data-testid^="die-selection-underlay-"]')).toHaveCount(0);
    await expect(page.getByTestId('dicethrone-board-dice-box-canvas')).toHaveAttribute('data-dice-physics-source', 'dice-box-threejs');
    await expect(page.getByTestId('dicethrone-board-dice-physics-source')).toHaveAttribute('data-dice-physics-mode', 'debug-visible');
    await expect(page.locator(
        '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"][data-selected="true"] .border-\\[\\#f2c14e\\]',
    )).toHaveCount(0);

    await expect(page.locator(
        '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"][data-selected="true"]',
    )).toHaveCount(dieIds.length);
}

async function readBoard3dToggleThumbCenterX(page: Page): Promise<number> {
    return await page.evaluate(() => {
        const thumb = document.querySelector('[data-testid="dicethrone-board-3d-toggle-thumb"]') as HTMLElement | null;
        if (!thumb) {
            throw new Error('未找到 3D 骰子开关圆球');
        }
        const rect = thumb.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            throw new Error('3D 骰子开关圆球不可见');
        }
        return rect.left + rect.width / 2;
    });
}

type DiceRectSnapshot = {
    dieId: number;
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
    rotateX: number | null;
    rotateY: number | null;
    rotateZ: number | null;
};

async function readBoardDieRects(page: Page, dieIds: number[]): Promise<DiceRectSnapshot[]> {
    return await page.evaluate((ids) => ids.map((dieId) => {
        const node = document.querySelector(
            `[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-${dieId}"]`,
        ) as HTMLElement | null;
        if (!node) {
            return {
                dieId,
                x: null,
                y: null,
                width: null,
                height: null,
                rotateX: null,
                rotateY: null,
                rotateZ: null,
            };
        }
        const rect = node.getBoundingClientRect();
        return {
            dieId,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            rotateX: Number(node.dataset.rotateX ?? Number.NaN),
            rotateY: Number(node.dataset.rotateY ?? Number.NaN),
            rotateZ: Number(node.dataset.rotateZ ?? Number.NaN),
        };
    }), dieIds);
}

async function readVisibleBoardDieRects(page: Page): Promise<DiceRectSnapshot[]> {
    return await page.evaluate(() => Array.from(document.querySelectorAll(
        '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
    )).map((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const projectedWidth = Number(element.dataset.projectedWidth ?? Number.NaN);
        const projectedHeight = Number(element.dataset.projectedHeight ?? Number.NaN);
        const projectedVisualWidth = Number(element.dataset.projectedVisualWidth ?? Number.NaN);
        const projectedVisualHeight = Number(element.dataset.projectedVisualHeight ?? Number.NaN);
        const visualWidth = Number.isFinite(projectedVisualWidth) && projectedVisualWidth > 0
            ? projectedVisualWidth
            : Number.isFinite(projectedWidth) && projectedWidth > 0
                ? projectedWidth
                : rect.width;
        const visualHeight = Number.isFinite(projectedVisualHeight) && projectedVisualHeight > 0
            ? projectedVisualHeight
            : Number.isFinite(projectedHeight) && projectedHeight > 0
                ? projectedHeight
                : rect.height;
        const testId = element.dataset.testid ?? element.getAttribute('data-testid') ?? '';
        const match = testId.match(/die-button-(\d+)/);
        return {
            dieId: match ? Number(match[1]) : -1,
            x: rect.left + ((rect.width - visualWidth) / 2),
            y: rect.top + ((rect.height - visualHeight) / 2),
            width: visualWidth,
            height: visualHeight,
            rotateX: Number(element.dataset.rotateX ?? Number.NaN),
            rotateY: Number(element.dataset.rotateY ?? Number.NaN),
            rotateZ: Number(element.dataset.rotateZ ?? Number.NaN),
        };
    }), []);
}

async function sampleVisibleBoardDieCount(page: Page, durationMs: number): Promise<{ min: number; counts: number[] }> {
    return await page.evaluate(async (duration) => {
        const counts: number[] = [];
        const startedAt = performance.now();
        while (performance.now() - startedAt < duration) {
            counts.push(document.querySelectorAll(
                '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
            ).length);
            await new Promise((resolve) => window.setTimeout(resolve, 50));
        }
        return {
            min: counts.length > 0 ? Math.min(...counts) : 0,
            counts,
        };
    }, durationMs);
}

function getVisualMoveDistance(current: DiceRectSnapshot, baseline: DiceRectSnapshot | undefined): number {
    if (
        current.x === null
        || current.y === null
        || baseline?.x === null
        || baseline?.y === null
        || typeof baseline?.x !== 'number'
        || typeof baseline?.y !== 'number'
    ) {
        return 0;
    }
    return Math.hypot(current.x - baseline.x, current.y - baseline.y);
}

function analyzeDiceSeparation(rects: DiceRectSnapshot[]): {
    minCenterDistance: number;
    minNormalizedCenterDistance: number;
    maxOverlapRatio: number;
    closestPair: [number, number] | null;
    mostOverlappedPair: [number, number] | null;
} {
    let minCenterDistance = Number.POSITIVE_INFINITY;
    let minNormalizedCenterDistance = Number.POSITIVE_INFINITY;
    let maxOverlapRatio = 0;
    let closestPair: [number, number] | null = null;
    let mostOverlappedPair: [number, number] | null = null;

    for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
        const left = rects[leftIndex];
        if (
            left.x === null
            || left.y === null
            || left.width === null
            || left.height === null
        ) {
            continue;
        }

        for (let rightIndex = leftIndex + 1; rightIndex < rects.length; rightIndex += 1) {
            const right = rects[rightIndex];
            if (
                right.x === null
                || right.y === null
                || right.width === null
                || right.height === null
            ) {
                continue;
            }

            const leftCenterX = left.x + (left.width / 2);
            const leftCenterY = left.y + (left.height / 2);
            const rightCenterX = right.x + (right.width / 2);
            const rightCenterY = right.y + (right.height / 2);
            const centerDistance = Math.hypot(
                leftCenterX - rightCenterX,
                leftCenterY - rightCenterY,
            );
            if (centerDistance < minCenterDistance) {
                minCenterDistance = centerDistance;
                closestPair = [left.dieId, right.dieId];
            }
            const averageMinDimension = (
                Math.min(left.width, left.height)
                + Math.min(right.width, right.height)
            ) / 2;
            const normalizedCenterDistance = averageMinDimension > 0
                ? centerDistance / averageMinDimension
                : 0;
            if (normalizedCenterDistance < minNormalizedCenterDistance) {
                minNormalizedCenterDistance = normalizedCenterDistance;
            }

            const overlapWidth = Math.max(
                0,
                Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
            );
            const overlapHeight = Math.max(
                0,
                Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
            );
            const overlapArea = overlapWidth * overlapHeight;
            const smallerArea = Math.min(left.width * left.height, right.width * right.height);
            const overlapRatio = smallerArea > 0 ? overlapArea / smallerArea : 0;
            if (overlapRatio > maxOverlapRatio) {
                maxOverlapRatio = overlapRatio;
                mostOverlappedPair = [left.dieId, right.dieId];
            }
        }
    }

    return {
        minCenterDistance,
        minNormalizedCenterDistance,
        maxOverlapRatio,
        closestPair,
        mostOverlappedPair,
    };
}

function expectDiceRectsIndividuallyVisible(
    rects: DiceRectSnapshot[],
    expectedCount: number,
    context: string,
): void {
    const visibleRects = rects.filter((rect) => (
        rect.dieId >= 0
        && rect.x !== null
        && rect.y !== null
        && rect.width !== null
        && rect.height !== null
        && rect.width > 0
        && rect.height > 0
    ));
    const uniqueDieIds = new Set(visibleRects.map((rect) => rect.dieId));
    const separation = analyzeDiceSeparation(visibleRects);
    const averageMinDimension = visibleRects.reduce(
        (sum, rect) => sum + Math.min(rect.width ?? 0, rect.height ?? 0),
        0,
    ) / Math.max(visibleRects.length, 1);
    const centerXs = visibleRects.map((rect) => (rect.x ?? 0) + ((rect.width ?? 0) / 2));
    const centerYs = visibleRects.map((rect) => (rect.y ?? 0) + ((rect.height ?? 0) / 2));
    const centerSpan = visibleRects.length > 0
        ? Math.hypot(
            Math.max(...centerXs) - Math.min(...centerXs),
            Math.max(...centerYs) - Math.min(...centerYs),
        )
        : 0;
    const diagnostics = {
        context,
        expectedCount,
        visibleCount: visibleRects.length,
        uniqueDieCount: uniqueDieIds.size,
        averageMinDimension,
        centerSpan,
        normalizedCenterSpan: averageMinDimension > 0
            ? centerSpan / averageMinDimension
            : 0,
        ...separation,
        rects: visibleRects,
    };

    expect(
        visibleRects.length,
        `${context} 必须能读取 ${expectedCount} 颗完整骰子的真实投影: ${JSON.stringify(diagnostics)}`,
    ).toBe(expectedCount);
    expect(
        uniqueDieIds.size,
        `${context} 的骰子投影 ID 不唯一，无法证明逐颗可辨认: ${JSON.stringify(diagnostics)}`,
    ).toBe(expectedCount);
    expect(
        separation.minNormalizedCenterDistance,
        `${context} 的骰子中心距离相对骰子尺寸过小，视觉上会挤叠成一团: ${JSON.stringify(diagnostics)}`,
    ).toBeGreaterThanOrEqual(0.68);
    expect(
        separation.maxOverlapRatio,
        `${context} 的骰子轴对齐投影几乎完全覆盖: ${JSON.stringify(diagnostics)}`,
    ).toBeLessThanOrEqual(0.55);
    expect(
        diagnostics.normalizedCenterSpan,
        `${context} 的五颗骰子整体散布范围过小，疑似全部堆在同一区域: ${JSON.stringify(diagnostics)}`,
    ).toBeGreaterThanOrEqual(2.2);
}

test.describe('DiceThrone - 棋盘内 3D 骰子开关', () => {
    for (const viewport of MOBILE_DICE_VIEWPORTS) {
    test(`手机横屏 ${viewport.width}x${viewport.height} 投掷结束后 3D 骰子仍留在棋盘投骰区`, async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        await page.setViewportSize(viewport);
        await page.addInitScript((storageKey) => {
            localStorage.setItem(storageKey, 'true');
            localStorage.setItem('hud_fab_position', JSON.stringify({
                leftPercent: 0.82,
                topPercent: 0.66,
            }));
        }, BOARD_DICE_3D_STORAGE_KEY);

        await game.openTestGame('dicethrone', { playerID: '0' });
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 0,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false, definitionId: 'monk-dice' },
                    { id: 1, value: 2, isKept: false, definitionId: 'monk-dice' },
                    { id: 2, value: 3, isKept: false, definitionId: 'monk-dice' },
                    { id: 3, value: 4, isKept: false, definitionId: 'monk-dice' },
                    { id: 4, value: 5, isKept: false, definitionId: 'monk-dice' },
                ],
            },
        });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3, 4, 5]);
        });

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        await expect(rollButton).toBeVisible({ timeout: 10000 });
        await rollButton.click();

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('dicethrone-board-dice-box-canvas')).toBeVisible({ timeout: 8000 });
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.rollCount ?? null;
        }, { timeout: 8000 }).toBe(1);

        await waitForBoardDiceSettled(page);
        await expect(page.locator(
            '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
        )).toHaveCount(5);
        const settledRects = await readVisibleBoardDieRects(page);
        expectDiceRectsIndividuallyVisible(settledRects, 5, '手机横屏投掷结束态');
        await page.waitForTimeout(520);
        const postSettleRects = await readVisibleBoardDieRects(page);
        const maxPostSettleMove = Math.max(
            ...postSettleRects.map((rect) => getVisualMoveDistance(
                rect,
                settledRects.find((candidate) => candidate.dieId === rect.dieId),
            )),
        );
        expect(maxPostSettleMove).toBeLessThanOrEqual(8);

        const layout = await page.evaluate(() => {
            const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
            const canvas = document.querySelector('[data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
            const handArea = document.querySelector('[data-testid="hand-area"]') as HTMLElement | null;
            const tipBoard = document.querySelector('[data-testid="tip-board-surface"]') as HTMLElement | null;
            if (!stage || !canvas) return null;
            const stageRect = stage.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const handRect = handArea?.getBoundingClientRect();
            const tipBoardRect = tipBoard?.getBoundingClientRect();
            const diceRects = Array.from(stage.querySelectorAll('[data-testid^="die-button-"]'))
                .map((node) => {
                    const element = node as HTMLElement;
                    const rect = element.getBoundingClientRect();
                    const projectedWidth = Number(element.dataset.projectedWidth ?? Number.NaN);
                    const projectedHeight = Number(element.dataset.projectedHeight ?? Number.NaN);
                    const projectedVisualWidth = Number(element.dataset.projectedVisualWidth ?? Number.NaN);
                    const projectedVisualHeight = Number(element.dataset.projectedVisualHeight ?? Number.NaN);
                    const width = Number.isFinite(projectedVisualWidth) && projectedVisualWidth > 0
                        ? projectedVisualWidth
                        : Number.isFinite(projectedWidth) && projectedWidth > 0
                            ? projectedWidth
                            : rect.width;
                    const height = Number.isFinite(projectedVisualHeight) && projectedVisualHeight > 0
                        ? projectedVisualHeight
                        : Number.isFinite(projectedHeight) && projectedHeight > 0
                            ? projectedHeight
                            : rect.height;
                    const left = rect.left + ((rect.width - width) / 2);
                    const top = rect.top + ((rect.height - height) / 2);
                    return {
                        left,
                        top,
                        right: left + width,
                        bottom: top + height,
                        width,
                        height,
                        centerX: rect.left + (rect.width / 2),
                        centerY: rect.top + (rect.height / 2),
                    };
                });
            const diceUnion = diceRects.length > 0
                ? {
                    left: Math.min(...diceRects.map((rect) => rect.left)),
                    top: Math.min(...diceRects.map((rect) => rect.top)),
                    right: Math.max(...diceRects.map((rect) => rect.right)),
                    bottom: Math.max(...diceRects.map((rect) => rect.bottom)),
                }
                : null;
            return {
                stage: {
                    left: stageRect.left,
                    top: stageRect.top,
                    right: stageRect.right,
                    bottom: stageRect.bottom,
                    width: stageRect.width,
                    height: stageRect.height,
                },
                canvas: {
                    left: canvasRect.left,
                    top: canvasRect.top,
                    right: canvasRect.right,
                    bottom: canvasRect.bottom,
                    width: canvasRect.width,
                    height: canvasRect.height,
                },
                hand: handRect ? {
                    left: handRect.left,
                    top: handRect.top,
                    right: handRect.right,
                    bottom: handRect.bottom,
                    width: handRect.width,
                    height: handRect.height,
                } : null,
                tipBoard: tipBoardRect ? {
                    left: tipBoardRect.left,
                    top: tipBoardRect.top,
                    right: tipBoardRect.right,
                    bottom: tipBoardRect.bottom,
                    width: tipBoardRect.width,
                    height: tipBoardRect.height,
                } : null,
                diceRects,
                diceUnion: diceUnion ? {
                    ...diceUnion,
                    width: diceUnion.right - diceUnion.left,
                    height: diceUnion.bottom - diceUnion.top,
                } : null,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
            };
        });

        expect(layout).not.toBeNull();
        expect(layout?.stage.width).toBeGreaterThanOrEqual(248);
        expect(layout?.stage.width).toBeLessThanOrEqual(290);
        expect(layout?.stage.height).toBeGreaterThanOrEqual(164);
        expect(layout?.stage.height).toBeLessThanOrEqual(190);
        expect(layout?.stage.right).toBeGreaterThan(0);
        expect(layout?.stage.left).toBeLessThan(layout?.viewport.width ?? 0);
        expect(layout?.stage.bottom).toBeGreaterThan(0);
        expect(layout?.stage.top).toBeLessThan(layout?.viewport.height ?? 0);
        expect(layout?.stage.top).toBeGreaterThanOrEqual(32);
        expect(layout?.stage.top).toBeLessThanOrEqual(42);
        expect(layout?.stage.bottom).toBeLessThanOrEqual(226);
        expect(Math.abs(
            (((layout?.stage.left ?? 0) + (layout?.stage.right ?? 0)) / 2)
            - ((layout?.viewport.width ?? 0) / 2),
        )).toBeLessThanOrEqual(2);
        expect(layout?.canvas.width).toBeGreaterThan(220);
        expect(layout?.canvas.height).toBeGreaterThan(158);
        expect(layout?.diceUnion).not.toBeNull();
        const averageDieMinDimension = (layout?.diceRects ?? []).reduce(
            (sum, rect) => sum + Math.min(rect.width, rect.height),
            0,
        ) / Math.max(layout?.diceRects.length ?? 0, 1);
        const horizontalCenterSpan = layout?.diceRects.length
            ? Math.max(...layout.diceRects.map((rect) => rect.centerX))
                - Math.min(...layout.diceRects.map((rect) => rect.centerX))
            : 0;
        const verticalCenterSpan = layout?.diceRects.length
            ? Math.max(...layout.diceRects.map((rect) => rect.centerY))
                - Math.min(...layout.diceRects.map((rect) => rect.centerY))
            : 0;
        const spreadDiagnostics = {
            averageDieMinDimension,
            horizontalCenterSpan,
            verticalCenterSpan,
            verticalSpanInDice: averageDieMinDimension > 0
                ? verticalCenterSpan / averageDieMinDimension
                : 0,
            verticalToHorizontalRatio: horizontalCenterSpan > 0
                ? verticalCenterSpan / horizontalCenterSpan
                : 0,
            diceRects: layout?.diceRects,
        };
        expect(
            spreadDiagnostics.verticalSpanInDice,
            `移动横屏五颗 3D 骰子不能只挤在顶部一排: ${JSON.stringify(spreadDiagnostics)}`,
        ).toBeGreaterThanOrEqual(1.2);
        expect(
            spreadDiagnostics.verticalToHorizontalRatio,
            `移动横屏五颗 3D 骰子需要形成二维散布，而不是横向单排: ${JSON.stringify(spreadDiagnostics)}`,
        ).toBeGreaterThanOrEqual(0.3);
        expect(layout?.diceUnion?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((layout?.stage.width ?? 0) * 0.94);
        expect(layout?.diceUnion?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((layout?.stage.height ?? 0) * 0.9);
        expect(layout?.diceUnion?.left ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual((layout?.stage.left ?? 0) - 4);
        expect(layout?.diceUnion?.right ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((layout?.stage.right ?? 0) + 4);
        expect(layout?.diceUnion?.top ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual((layout?.stage.top ?? 0) - 4);
        expect(layout?.diceUnion?.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((layout?.stage.bottom ?? 0) + 4);
        for (const rect of layout?.diceRects ?? []) {
            const minProjectedDimension = Math.min(rect.width, rect.height);
            const maxProjectedDimension = Math.max(rect.width, rect.height);
            const areaEquivalentDiameter = Math.sqrt(rect.width * rect.height);
            expect(
                minProjectedDimension,
                `3D 骰子投影短边不能收窄成细条: ${JSON.stringify(rect)}`,
            ).toBeGreaterThanOrEqual(20);
            expect(
                areaEquivalentDiameter,
                `3D 骰子投影面积必须保持可辨认尺寸: ${JSON.stringify(rect)}`,
            ).toBeGreaterThanOrEqual(24);
            expect(
                maxProjectedDimension,
                `3D 骰子投影长边必须保持清晰可辨: ${JSON.stringify(rect)}`,
            ).toBeGreaterThanOrEqual(28);
            expect(rect.right).toBeGreaterThan(0);
            expect(rect.left).toBeLessThan(layout?.viewport.width ?? 0);
            expect(rect.bottom).toBeGreaterThan(0);
            expect(rect.top).toBeLessThan(layout?.viewport.height ?? 0);
            expect(rect.left).toBeGreaterThanOrEqual((layout?.stage.left ?? 0) - 4);
            expect(rect.right).toBeLessThanOrEqual((layout?.stage.right ?? 0) + 4);
            expect(rect.top).toBeGreaterThanOrEqual((layout?.stage.top ?? 0) - 4);
            expect(rect.bottom).toBeLessThanOrEqual((layout?.stage.bottom ?? 0) + 4);
            if (layout?.hand) {
                expect(rect.bottom).toBeLessThanOrEqual(layout.hand.top - 4);
            }
            if (layout?.tipBoard) {
                const overlapWidth = Math.max(
                    0,
                    Math.min(rect.right, layout.tipBoard.right) - Math.max(rect.left, layout.tipBoard.left),
                );
                const overlapHeight = Math.max(
                    0,
                    Math.min(rect.bottom, layout.tipBoard.bottom) - Math.max(rect.top, layout.tipBoard.top),
                );
                expect(
                    overlapWidth * overlapHeight,
                    `3D 骰子不应遮挡敌人提示窗: ${JSON.stringify({ rect, tipBoard: layout.tipBoard })}`,
                ).toBeLessThanOrEqual(1);
            }
        }

        await game.screenshot('00-手机横屏投掷结束后-3D骰子仍可见', testInfo);
        await saveBoardDiceStageScreenshot(page, '01-手机横屏投掷结束后-3D骰子投骰区局部', testInfo);
        const canvasScreenshotPath = await saveBoardDiceCanvasScreenshot(page, '00-手机横屏投掷结束后-3D骰子真实画布', testInfo);
        await expectBoardDiceCanvasScreenshotHasVisibleDice(canvasScreenshotPath);
    });
    }

    test('设置面板 3D 骰子开关点击前后应真实切换', async ({ page, game }, testInfo) => {
        await page.addInitScript((storageKey) => {
            localStorage.removeItem(storageKey);
            localStorage.setItem('hud_fab_position', JSON.stringify({
                leftPercent: 0.82,
                topPercent: 0.66,
            }));
        }, BOARD_DICE_3D_STORAGE_KEY);

        await game.openTestGame('dicethrone', { playerID: '0' });
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: [],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
            },
        });

        const settingsPanel = await openFabSettingsPanel(page);
        const board3dToggle = settingsPanel.getByRole('switch', { name: /棋盘内 3D 骰子|Board 3D Dice/i }).first();
        await expect(board3dToggle).toBeVisible({ timeout: 5000 });
        await expect(board3dToggle).toHaveAttribute('aria-checked', 'false');
        await expect(settingsPanel.getByText(/已关闭|Disabled/i)).toBeVisible({ timeout: 5000 });
        const thumbBeforeX = await readBoard3dToggleThumbCenterX(page);
        await saveSettingsPanelScreenshot(settingsPanel, '00-3D骰子开关-点击前', testInfo);

        await board3dToggle.click();

        await expect(board3dToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5000 });
        await expect(settingsPanel.getByText(/已开启|Enabled/i)).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            return await readBoard3dToggleThumbCenterX(page);
        }, { timeout: 5000 }).toBeGreaterThan(thumbBeforeX + 12);
        await expect.poll(async () => {
            return await page.evaluate((storageKey) => localStorage.getItem(storageKey), BOARD_DICE_3D_STORAGE_KEY);
        }, { timeout: 5000 }).toBe('true');
        await saveSettingsPanelScreenshot(settingsPanel, '01-3D骰子开关-点击后', testInfo);
    });

    test('默认关闭，打开后切到棋盘 3D 骰子，重投时不是原地静止', async ({ page, game }, testInfo) => {
        await page.addInitScript((storageKey) => {
            localStorage.removeItem(storageKey);
            localStorage.setItem('hud_fab_position', JSON.stringify({
                leftPercent: 0.82,
                topPercent: 0.66,
            }));
        }, BOARD_DICE_3D_STORAGE_KEY);

        await game.openTestGame('dicethrone', { playerID: '0' });
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-worthy-of-me'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: { id: string }) => card.id === 'card-worthy-of-me'),
                rollCount: state?.core?.rollCount ?? state?.core?.G?.rollCount ?? state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
        });

        await dragHandCardToPlay(page, 'card-worthy-of-me');

        await expect.poll(async () => {
            const state = await game.getState();
            const interaction = state?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'selectDie',
            selectCount: 2,
        });

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            return await page.evaluate((storageKey) => localStorage.getItem(storageKey), BOARD_DICE_3D_STORAGE_KEY);
        }, { timeout: 3000 }).not.toBe('true');

        await game.screenshot('01-默认关闭-仍使用右侧骰盘', testInfo);

        const settingsPanel = await openFabSettingsPanel(page);
        await expect(settingsPanel.getByText(/骰子显示|Dice Display/i)).toBeVisible({ timeout: 5000 });
        const board3dToggle = settingsPanel.getByRole('switch', { name: /棋盘内 3D 骰子|Board 3D Dice/i }).first();
        await expect(board3dToggle).toBeVisible({ timeout: 5000 });
        await board3dToggle.click();

        await expect.poll(async () => {
            return await page.evaluate((storageKey) => localStorage.getItem(storageKey), BOARD_DICE_3D_STORAGE_KEY);
        }, { timeout: 5000 }).toBe('true');
        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toHaveCount(0);
        await expect(page.locator(
            '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
        )).toHaveCount(5);
        const restoreMotionSamples: Array<{
            maxLift: number;
            maxTravel: number;
        }> = [];
        for (let sampleIndex = 0; sampleIndex < 8; sampleIndex += 1) {
            const motion = await page.getByTestId('dicethrone-board-dice-box-canvas').evaluate((node) => ({
                maxLift: Number((node as HTMLElement).dataset.diceMaxLift ?? Number.POSITIVE_INFINITY),
                maxTravel: Number((node as HTMLElement).dataset.diceMaxTravel ?? Number.POSITIVE_INFINITY),
            }));
            restoreMotionSamples.push(motion);
            await page.waitForTimeout(80);
        }
        expect(
            Math.max(...restoreMotionSamples.map((sample) => sample.maxLift)),
            `切换到棋盘 3D 骰子时不应重新抛起骰子: ${JSON.stringify(restoreMotionSamples)}`,
        ).toBeLessThanOrEqual(0.004);
        expect(
            Math.max(...restoreMotionSamples.map((sample) => sample.maxTravel)),
            `切换到棋盘 3D 骰子时不应重新播放物理滚动: ${JSON.stringify(restoreMotionSamples)}`,
        ).toBeLessThanOrEqual(0.012);
        await waitForBoardDiceSettled(page);
        const restoreStableSamples: DiceRectSnapshot[][] = [];
        for (let sampleIndex = 0; sampleIndex < 5; sampleIndex += 1) {
            restoreStableSamples.push(await readVisibleBoardDieRects(page));
            await page.waitForTimeout(80);
        }
        const restoreBaselineRects = restoreStableSamples[0] ?? [];
        const maxRestoreMove = Math.max(
            ...restoreStableSamples.flatMap((sample) => sample.map((rect) => getVisualMoveDistance(
                rect,
                restoreBaselineRects.find((candidate) => candidate.dieId === rect.dieId),
            ))),
        );
        expect(
            maxRestoreMove,
            `切换到棋盘 3D 骰子完成首次投影对齐后，五颗骰子应保持静止: ${JSON.stringify(restoreStableSamples)}`,
        ).toBeLessThanOrEqual(8);
        expectDiceRectsIndividuallyVisible(
            await readVisibleBoardDieRects(page),
            5,
            'PC 从右侧骰盘切换到棋盘 3D 骰子后的静置态',
        );
        await saveBoardDiceStageScreenshot(page, '02a-切到棋盘3D骰台-局部', testInfo);
        await closeFabSettingsPanel(page);
        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await waitForBoardDiceSettled(page);

        await game.screenshot('02-打开设置后-切到棋盘内3D骰子', testInfo);

        const firstDieButton = page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]');
        const secondDieButton = page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-1"]');
        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await expect(secondDieButton).toBeVisible({ timeout: 5000 });
        await clickBoardDieCenter(page, 0);
        await expect(firstDieButton).toHaveAttribute('data-selected', 'true', { timeout: 3000 });
        await clickBoardDieCenter(page, 1);
        await expect(secondDieButton).toHaveAttribute('data-selected', 'true', { timeout: 3000 });
        await expectBoardDiceSelectionUnderlay(page, [0, 1]);

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });

        const baselineRects = await readBoardDieRects(page, [0, 1]);

        await confirmButton.click();
        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            const currentRects = await readBoardDieRects(page, [0, 1]);
            return Math.max(
                ...currentRects.map((position, posIndex) => getVisualMoveDistance(position, baselineRects[posIndex])),
            );
        }, {
            timeout: 2500,
            intervals: [80, 120, 180, 240],
        }).toBeGreaterThan(12);

        await waitForBoardDiceSettled(page);
        expectDiceRectsIndividuallyVisible(
            await readVisibleBoardDieRects(page),
            5,
            'PC 重投结束后的静置态',
        );
        await saveBoardDiceStageScreenshot(page, '03a-确认重投后-3D骰子稳定完成-局部', testInfo);
        await game.screenshot('03-确认重投后-3D骰子稳定完成', testInfo);
        const settledRects = await readBoardDieRects(page, [0, 1]);
        const settledMoveDistance = Math.max(
            ...settledRects.map((position, posIndex) => getVisualMoveDistance(position, baselineRects[posIndex])),
        );
        expect(settledMoveDistance).toBeGreaterThan(12);

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-6);
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                lastEventTypes: lastEvents.map((entry: { event?: { type?: string } }) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            interactionKind: null,
        });
    });

    test('开启 3D 后锁定骰子仍留在棋盘骰台且右侧旧骰盘不重复出现', async ({ page, game }, testInfo) => {
        await page.addInitScript((storageKey) => {
            localStorage.setItem(storageKey, 'true');
            localStorage.setItem('hud_fab_position', JSON.stringify({
                leftPercent: 0.82,
                topPercent: 0.66,
            }));
        }, BOARD_DICE_3D_STORAGE_KEY);

        await game.openTestGame('dicethrone', { playerID: '0' });
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);
        await waitForBoardDiceSettled(page);

        const firstBoardDie = page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]');
        await expect(firstBoardDie).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('card-spotlight-overlay')).toHaveCount(0, { timeout: 5000 });
        const firstBoardDieBox = await firstBoardDie.boundingBox();
        if (!firstBoardDieBox) {
            throw new Error('未获取到第一颗 3D 骰子的可见命中区域');
        }
        await page.mouse.move(
            firstBoardDieBox.x + (firstBoardDieBox.width / 2),
            firstBoardDieBox.y + (firstBoardDieBox.height / 2),
        );
        await expect.poll(async () => await firstBoardDie.evaluate((node) => window.getComputedStyle(node).cursor)).toContain('pointer');
        await clickBoardDieCenter(page, 0);

        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toHaveCount(0);
        await expect(page.getByTestId('locked-die-return-0')).toHaveCount(0);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]')).toHaveCount(1);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]')).toHaveAttribute('data-clickable', 'true');
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]')).toHaveAttribute('data-selected', 'false');
        await expect(page.getByTestId('die-locked-label-0')).toContainText(/锁定|Locked/i);

        const layerState = await page.evaluate(() => {
            const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
            const die = document.querySelector('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]') as HTMLElement | null;
            const stageRect = stage?.getBoundingClientRect();
            const dieRect = die?.getBoundingClientRect();
            const centerX = dieRect ? dieRect.left + dieRect.width / 2 : 0;
            const centerY = dieRect ? dieRect.top + dieRect.height / 2 : 0;
            const topElement = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
            return {
                stageZIndex: stage ? Number(window.getComputedStyle(stage).zIndex) : 0,
                dieCursor: die ? window.getComputedStyle(die).cursor : '',
                dieTop: dieRect?.top ?? 0,
                dieLeft: dieRect?.left ?? 0,
                dieRight: dieRect?.right ?? 0,
                dieBottom: dieRect?.bottom ?? 0,
                stageTop: stageRect?.top ?? 0,
                stageLeft: stageRect?.left ?? 0,
                stageRight: stageRect?.right ?? 0,
                stageBottom: stageRect?.bottom ?? 0,
                topTestId: topElement?.dataset.testid ?? topElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? '',
            };
        });
        expect(layerState.stageZIndex).toBeGreaterThan(600);
        expect(layerState.dieCursor).toContain('pointer');
        expect(layerState.dieTop).toBeGreaterThanOrEqual(layerState.stageTop - 1);
        expect(layerState.dieLeft).toBeGreaterThanOrEqual(layerState.stageLeft - 1);
        expect(layerState.dieRight).toBeLessThanOrEqual(layerState.stageRight + 1);
        expect(layerState.dieBottom).toBeLessThanOrEqual(layerState.stageBottom + 1);
        expect(layerState.topTestId).toBe('die-button-0');
        await expect(page.getByTestId('die-locked-ring-0')).toBeVisible({ timeout: 2000 });

        await game.screenshot('06-开启3D后锁定骰子仍留在棋盘骰台', testInfo);
    });

    test('开启 3D 后锁定骰子再次投掷时保持原位且不消失', async ({ page, game }, testInfo) => {
        await page.addInitScript((storageKey) => {
            localStorage.setItem(storageKey, 'true');
            localStorage.setItem('hud_fab_position', JSON.stringify({
                leftPercent: 0.82,
                topPercent: 0.66,
            }));
        }, BOARD_DICE_3D_STORAGE_KEY);

        await game.openTestGame('dicethrone', { playerID: '0' });
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#hud-root > [data-testid="dicethrone-board-dice-stage"]')).toBeVisible();
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);
        await waitForBoardDiceSettled(page);

        const lockedDie = page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]');
        await expect(lockedDie).toHaveAttribute('data-display-value', '1');
        const beforeLockDebug = await readBoardDieHitDebug(page, 0);
        await clickBoardDieCenter(page, 0);
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.dice?.find((die: { id: number }) => die.id === 0)?.isKept ?? null;
        }, {
            message: `点击 3D 骰子后未进入锁定状态: ${JSON.stringify(beforeLockDebug)}`,
            timeout: 2000,
        }).toBe(true);
        await expect(page.getByTestId('die-locked-ring-0')).toBeVisible({ timeout: 2000 });
        await expect(page.getByTestId('die-locked-label-0')).toContainText(/锁定|Locked/i);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);
        await waitForBoardDiceSettled(page);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);

        const lockedBeforeRoll = (await readBoardDieRects(page, [0]))[0];
        const unlockedBeforeRoll = await readBoardDieRects(page, [1, 2, 3, 4]);

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6, 5, 4, 3]);
        });

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);
        await expect(page.getByTestId('die-locked-ring-0')).toBeVisible({ timeout: 2000 });
        await expect(lockedDie).toHaveAttribute('data-display-value', '1');

        const visibleCountDuringReroll = await sampleVisibleBoardDieCount(page, 1200);
        expect(visibleCountDuringReroll.min, `锁定后再次投掷期间不允许出现全部骰子消失: ${visibleCountDuringReroll.counts.join(',')}`).toBe(5);

        await expect.poll(async () => {
            const currentRects = await readBoardDieRects(page, [1, 2, 3, 4]);
            return Math.max(
                ...currentRects.map((position, posIndex) => getVisualMoveDistance(position, unlockedBeforeRoll[posIndex])),
            );
        }, {
            timeout: 2500,
            intervals: [80, 120, 180, 240],
        }).toBeGreaterThan(12);

        await waitForBoardDiceSettled(page);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);
        const lockedAfterRoll = (await readBoardDieRects(page, [0]))[0];
        const lockedMoveDistance = getVisualMoveDistance(lockedAfterRoll, lockedBeforeRoll);
        expect(lockedMoveDistance).toBeLessThanOrEqual(8);
        await expect(lockedDie).toHaveAttribute('data-display-value', '1');
        await expect(page.getByTestId('die-locked-ring-0')).toBeVisible();

        const stateAfterRoll = await game.getState();
        expect(stateAfterRoll?.core?.dice?.find((die: { id: number }) => die.id === 0)).toMatchObject({
            id: 0,
            value: 1,
            isKept: true,
        });

        await game.screenshot('07-锁定后再次投掷-锁定骰子保持原位', testInfo);
    });

    test('对方投掷阶段我方响应改骰时，关闭 3D 仍走右侧骰盘，开启后才切到棋盘骰台', async ({ page, game }, testInfo) => {
        await page.addInitScript((storageKey) => {
            localStorage.removeItem(storageKey);
        }, BOARD_DICE_3D_STORAGE_KEY);

        await game.openTestGame('dicethrone', { playerID: '0' });
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '1',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 2, isKept: false },
                    { id: 1, value: 3, isKept: false },
                    { id: 2, value: 4, isKept: false },
                    { id: 3, value: 5, isKept: false },
                    { id: 4, value: 1, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '1',
                    targetId: '0',
                    sourceAbilityId: 'smash',
                    baseDamage: 4,
                    totalDamage: 4,
                    bonusDamage: 0,
                    unblockable: false,
                },
            },
            sys: {
                responseWindow: {
                    current: {
                        id: 'board-dice-response-window',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'smash',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                        actionTakenThisRound: false,
                        consecutivePassRounds: 0,
                    },
                },
                interaction: {
                    current: {
                        id: 'dt-dice-modify-response-window',
                        kind: 'multistep-choice',
                        playerId: '0',
                        title: 'interaction.selectDieToSet',
                        description: null,
                        options: [],
                        data: {
                            title: 'interaction.selectDieToSet',
                            sourceId: 'card-play-six',
                            maxSteps: 1,
                            initialResult: { modifications: {}, modCount: 0, totalAdjustment: 0 },
                            allowedDieIds: [0, 1, 2, 3, 4],
                            completedDieIds: [],
                            meta: {
                                dtType: 'modifyDie',
                                dieModifyConfig: { mode: 'set', targetValue: 6 },
                                selectCount: 1,
                                diceOwnerId: '1',
                                targetOpponentDice: true,
                            },
                        },
                    },
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                responderId: state?.sys?.responseWindow?.current?.responderQueue?.[0] ?? null,
                activePlayerId: state?.core?.activePlayerId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            interactionKind: 'multistep-choice',
            interactionPlayerId: '0',
            responderId: '0',
            activePlayerId: '1',
        });

        await expect.poll(async () => {
            return await page.evaluate((storageKey) => localStorage.getItem(storageKey), BOARD_DICE_3D_STORAGE_KEY);
        }, { timeout: 3000 }).not.toBe('true');

        await expect(page.getByTestId('dicethrone-board-dice-stage')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-clickable', 'true');
        await game.screenshot('04-对方投掷阶段-关闭3D仍走右侧骰盘', testInfo);

        const settingsPanel = await openFabSettingsPanel(page);
        await expect(settingsPanel.getByText(/骰子显示|Dice Display/i)).toBeVisible({ timeout: 5000 });
        const board3dToggle = settingsPanel.getByRole('switch', { name: /棋盘内 3D 骰子|Board 3D Dice/i }).first();
        await expect(board3dToggle).toBeVisible({ timeout: 5000 });
        await board3dToggle.click();

        await expect.poll(async () => {
            return await page.evaluate((storageKey) => localStorage.getItem(storageKey), BOARD_DICE_3D_STORAGE_KEY);
        }, { timeout: 5000 }).toBe('true');
        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toHaveCount(0);
        await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-clickable', 'true');
        await waitForBoardDiceSettled(page);
        await saveBoardDiceStageScreenshot(page, '05a-对方响应改骰-棋盘3D骰台-局部', testInfo);
        await closeFabSettingsPanel(page);
        await expect(page.getByTestId('dicethrone-board-dice-stage')).toBeVisible({ timeout: 5000 });
        await waitForBoardDiceSettled(page);
        await game.screenshot('05-对方投掷阶段-开启3D后切到棋盘骰台', testInfo);
    });
});
