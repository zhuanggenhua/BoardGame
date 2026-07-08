import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

const BOARD_DICE_3D_STORAGE_KEY = 'dicethrone:boardDice3dEnabled';

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
) {
    const stage = page.getByTestId('dicethrone-board-dice-stage');
    await expect(stage).toBeVisible({ timeout: 5000 });
    const screenshotPath = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await stage.screenshot({ path: screenshotPath });
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
        if (canvasNode.dataset.worldWidthScale !== '0.64') return false;
        if (canvasNode.dataset.worldHeightScale !== '0.64') return false;
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
    const point = await page.evaluate((id) => {
        const node = document.querySelector(
            `[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-${id}"]`,
        ) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        return {
            x: rect.left + (rect.width / 2),
            y: rect.top + (rect.height / 2),
        };
    }, dieId);
    if (!point) {
        throw new Error(`未能获取棋盘骰子 ${dieId} 的中心点击坐标`);
    }
    await page.mouse.click(point.x, point.y);
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
    }

    await expect(page.getByTestId('dice-field-3d-underlay')).toBeVisible({ timeout: 3000 });
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
        const testId = element.dataset.testid ?? element.getAttribute('data-testid') ?? '';
        const match = testId.match(/die-button-(\d+)/);
        return {
            dieId: match ? Number(match[1]) : -1,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
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

test.describe('DiceThrone - 棋盘内 3D 骰子开关', () => {
    test('手机横屏投掷结束后 3D 骰子仍留在棋盘投骰区', async ({ page, game }, testInfo) => {
        await page.setViewportSize({ width: 844, height: 390 });
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
            if (!stage || !canvas) return null;
            const stageRect = stage.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const diceRects = Array.from(stage.querySelectorAll('[data-testid^="die-button-"]'))
                .map((node) => {
                    const rect = (node as HTMLElement).getBoundingClientRect();
                    return {
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    };
                });
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
                diceRects,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
            };
        });

        expect(layout).not.toBeNull();
        expect(layout?.stage.width).toBeGreaterThan(180);
        expect(layout?.stage.height).toBeGreaterThan(180);
        expect(layout?.stage.right).toBeGreaterThan(0);
        expect(layout?.stage.left).toBeLessThan(layout?.viewport.width ?? 0);
        expect(layout?.stage.bottom).toBeGreaterThan(0);
        expect(layout?.stage.top).toBeLessThan(layout?.viewport.height ?? 0);
        expect(layout?.canvas.width).toBeGreaterThan(120);
        expect(layout?.canvas.height).toBeGreaterThan(120);
        for (const rect of layout?.diceRects ?? []) {
            expect(rect.width).toBeGreaterThan(28);
            expect(rect.height).toBeGreaterThan(28);
            expect(rect.right).toBeGreaterThan(0);
            expect(rect.left).toBeLessThan(layout?.viewport.width ?? 0);
            expect(rect.bottom).toBeGreaterThan(0);
            expect(rect.top).toBeLessThan(layout?.viewport.height ?? 0);
        }

        await saveBoardDiceStageScreenshot(page, '00-手机横屏投掷结束后-3D骰子仍可见-局部', testInfo);
        await game.screenshot('00-手机横屏投掷结束后-3D骰子仍可见', testInfo);
    });

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
        await waitForBoardDiceSettled(page);
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
        await clickBoardDieCenter(page, 1);
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
        const hitLayer = page.getByTestId('dicethrone-board-dice-hit-layer');
        await hitLayer.hover({ position: { x: 12, y: 12 } });
        await expect.poll(async () => await hitLayer.evaluate((node) => window.getComputedStyle(node).cursor)).toContain('pointer');
        await clickBoardDieCenter(page, 0);

        await expect(page.locator('[data-tutorial-id="dice-tray"]')).toHaveCount(0);
        await expect(page.getByTestId('locked-die-return-0')).toHaveCount(0);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]')).toHaveCount(1);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]')).toHaveCount(5);
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]')).toHaveAttribute('data-clickable', 'true');
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]')).toHaveAttribute('data-selected', 'false');
        await expect(page.locator('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]')).toContainText(/锁定|Locked/i);

        const layerState = await page.evaluate(() => {
            const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
            const hitLayer = document.querySelector('[data-testid="dicethrone-board-dice-hit-layer"]') as HTMLElement | null;
            const die = document.querySelector('[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-0"]') as HTMLElement | null;
            const stageRect = stage?.getBoundingClientRect();
            const dieRect = die?.getBoundingClientRect();
            const centerX = dieRect ? dieRect.left + dieRect.width / 2 : 0;
            const centerY = dieRect ? dieRect.top + dieRect.height / 2 : 0;
            const topElement = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
            return {
                stageZIndex: stage ? Number(window.getComputedStyle(stage).zIndex) : 0,
                hitCursor: hitLayer ? window.getComputedStyle(hitLayer).cursor : '',
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
        expect(layerState.hitCursor).toContain('pointer');
        expect(layerState.dieTop).toBeGreaterThanOrEqual(layerState.stageTop - 1);
        expect(layerState.dieLeft).toBeGreaterThanOrEqual(layerState.stageLeft - 1);
        expect(layerState.dieRight).toBeLessThanOrEqual(layerState.stageRight + 1);
        expect(layerState.dieBottom).toBeLessThanOrEqual(layerState.stageBottom + 1);
        expect(layerState.topTestId).toMatch(/dicethrone-board-dice-hit-layer|die-button-0/);
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
        await expect(lockedDie).toContainText(/锁定|Locked/i);
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
