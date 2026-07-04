import '../../src/games/dicethrone/domain';
import { mkdir, rename, stat, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { chromium, type Browser, type Locator, type Page } from 'playwright';
import { ensureSingleWorkerRuntime } from './e2e-runtime-manager.mjs';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    initContext,
} from '../../e2e/helpers/common';
import {
    dispatchDiceThroneCommand,
    readDiceThroneHarnessState,
    setDiceThroneDiceValues,
    waitForDiceThroneHarness,
} from '../../e2e/helpers/dicethrone';
import { CHARACTER_DATA_MAP, createCharacterDice, initHeroState } from '../../src/games/dicethrone/domain/characters';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

const OUT_DIR = 'temp/dice3d-reroll-flow';
const BOARD_DICE_3D_STORAGE_KEY = 'dicethrone:boardDice3dEnabled';
const SCREENSHOTS = {
    beforeRoll: `${OUT_DIR}/01-开始投掷.png`,
    rolling: `${OUT_DIR}/02-投掷中.png`,
    rolled: `${OUT_DIR}/03-投掷动画结束.png`,
    selectedTwo: `${OUT_DIR}/04-打出选任意骰子重投卡牌-选择两个骰子.png`,
    selected: `${OUT_DIR}/04-打出选任意骰子重投卡牌-选择所有骰子.png`,
    rerolled: `${OUT_DIR}/05-点击重投后.png`,
} as const;
const RUN_MANIFEST = `${OUT_DIR}/_latest-run.json`;
type ScreenshotKey = keyof typeof SCREENSHOTS;

type RectEvidence = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type BoardDiceButtonEvidence = {
    id: number | null;
    value: number | null;
    selected: boolean;
    clickable: boolean;
    renderMode: string | null;
    rect: RectEvidence;
    rotateX: string | null;
    rotateY: string | null;
    rotateZ: string | null;
};

type BoardDiceEvidence = {
    label: string;
    phase: string | null;
    rollCount: number | null;
    rollConfirmed: boolean | null;
    diceValues: number[];
    stageRect: RectEvidence | null;
    canvasRect: RectEvidence | null;
    canvasDataset: {
        skinsReady: string | null;
        diceTexturesReady: string | null;
        diceSettled: string | null;
        dicePhysicsSource: string | null;
        dicePhysicsMode: string | null;
    } | null;
    physicsSource: {
        present: boolean;
        mode: string | null;
        settled: string | null;
        visible: boolean | null;
        rect: RectEvidence | null;
    };
    fallbackCount: number;
    diceButtons: BoardDiceButtonEvidence[];
};

type RunEvidence = Partial<Record<'rolled' | 'selectedTwo' | 'rerolled', BoardDiceEvidence>>;
type CaptureHarnessState = {
    core: {
        selectedCharacters: Record<string, string>;
        readyPlayers: Record<string, boolean>;
        hostStarted: boolean;
        players: Record<string, ReturnType<typeof initHeroState>>;
        activePlayerId: string;
        startingPlayerId: string;
        turnNumber: number;
        rollCount: number;
        rollLimit: number;
        rollDiceCount: number;
        rollConfirmed: boolean;
        pendingAttack: unknown;
        pendingDamage?: unknown;
        pendingBonusDiceSettlement?: unknown;
        dice: ReturnType<typeof createCharacterDice>;
    };
    sys: {
        phase: string;
        interaction?: {
            current?: unknown;
            queue?: unknown[];
            history?: unknown[];
        };
    };
};

const PREPARE_RANDOM = {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (_faces: number) => 1,
    range: (min: number, _max: number) => min,
};

async function saveScreenshot(page: Page, path: string) {
    await mkdir(dirname(path), { recursive: true });
    const tempPath = path.replace(/\.png$/i, '.tmp.png');
    await rm(tempPath, { force: true }).catch(() => undefined);
    await page.screenshot({ path: tempPath, fullPage: false, timeout: 60000 });
    const fileStat = await stat(tempPath);
    if (fileStat.size <= 0) {
        throw new Error(`截图写入为空：${path}`);
    }
    await rm(path, { force: true }).catch(() => undefined);
    await rename(tempPath, path);
}

async function resetOutputDir() {
    await mkdir(OUT_DIR, { recursive: true });
    await Promise.all([
        ...Object.values(SCREENSHOTS).map((path) => rm(path, { force: true }).catch(() => undefined)),
        rm(RUN_MANIFEST, { force: true }).catch(() => undefined),
    ]);
}

async function launchBrowserWithRetry(): Promise<Browser> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        let browser: Browser | null = null;
        try {
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext({ viewport: { width: 64, height: 64 } });
            await context.close();
            return browser;
        } catch (error) {
            lastError = error;
            await browser?.close().catch(() => undefined);
            if (attempt < 2) {
                console.warn('[capture-dt3d] 浏览器启动探针失败，重试一次', error instanceof Error ? error.message : String(error));
                await new Promise((resolve) => setTimeout(resolve, 600));
            }
        }
    }

    throw lastError;
}

async function writeRunManifest(input: {
    status: 'running' | 'failed' | 'completed';
    startedAt: string;
    finishedAt?: string;
    currentStep?: string;
    error?: string;
    evidence?: RunEvidence;
}) {
    const screenshots = Object.fromEntries(
        (Object.entries(SCREENSHOTS) as Array<[ScreenshotKey, string]>).map(([key, path]) => [
            key,
            { path, exists: false },
        ]),
    ) as Record<ScreenshotKey, { path: string; exists: boolean; size?: number; lastModified?: string }>;

    for (const [key, path] of Object.entries(SCREENSHOTS) as Array<[ScreenshotKey, string]>) {
        try {
            const info = await stat(path);
            screenshots[key] = {
                path,
                exists: true,
                size: info.size,
                lastModified: info.mtime.toISOString(),
            };
        } catch {
            screenshots[key] = { path, exists: false };
        }
    }

    await writeFile(
        RUN_MANIFEST,
        `${JSON.stringify(
            {
                ...input,
                screenshots,
            },
            null,
            2,
        )}\n`,
        'utf8',
    );
}

async function collectBoardDiceEvidence(page: Page, label: string): Promise<BoardDiceEvidence> {
    return page.evaluate((inputLabel) => {
        const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
        const canvas = document.querySelector('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
        const physicsSource = document.querySelector('[data-testid="dicethrone-board-dice-physics-source"]') as HTMLElement | null;
        const stageRectRaw = stage?.getBoundingClientRect();
        const canvasRectRaw = canvas?.getBoundingClientRect();
        const physicsSourceRectRaw = physicsSource?.getBoundingClientRect();
        const physicsSourceStyle = physicsSource ? window.getComputedStyle(physicsSource) : null;
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        const dice = state?.core?.dice ?? [];
        const buttons = Array.from(document.querySelectorAll(
            '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
        )) as HTMLElement[];
        return {
            label: inputLabel,
            phase: state?.sys?.phase ?? null,
            rollCount: state?.core?.rollCount ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            diceValues: dice.map((die: { value?: number }) => Number(die.value)).filter((value: number) => Number.isFinite(value)),
            stageRect: stageRectRaw ? {
                x: Math.round(stageRectRaw.x),
                y: Math.round(stageRectRaw.y),
                width: Math.round(stageRectRaw.width),
                height: Math.round(stageRectRaw.height),
            } : null,
            canvasRect: canvasRectRaw ? {
                x: Math.round(canvasRectRaw.x),
                y: Math.round(canvasRectRaw.y),
                width: Math.round(canvasRectRaw.width),
                height: Math.round(canvasRectRaw.height),
            } : null,
            canvasDataset: canvas ? {
                skinsReady: canvas.dataset.skinsReady ?? null,
                diceTexturesReady: canvas.dataset.diceTexturesReady ?? null,
                diceSettled: canvas.dataset.diceSettled ?? null,
                diceVisualSettled: canvas.dataset.diceVisualSettled ?? null,
                diceMaxLift: canvas.dataset.diceMaxLift ?? null,
                diceMaxTravel: canvas.dataset.diceMaxTravel ?? null,
                dicePhysicsSource: canvas.dataset.dicePhysicsSource ?? null,
                dicePhysicsMode: canvas.dataset.dicePhysicsMode ?? null,
            } : null,
            physicsSource: {
                present: Boolean(physicsSource),
                mode: physicsSource?.dataset.dicePhysicsMode ?? null,
                settled: physicsSource?.dataset.diceSettled ?? null,
                visible: physicsSourceStyle
                    ? physicsSourceStyle.visibility !== 'hidden' && Number(physicsSourceStyle.opacity || '1') > 0
                    : null,
                rect: physicsSourceRectRaw ? {
                    x: Math.round(physicsSourceRectRaw.x),
                    y: Math.round(physicsSourceRectRaw.y),
                    width: Math.round(physicsSourceRectRaw.width),
                    height: Math.round(physicsSourceRectRaw.height),
                } : null,
            },
            fallbackCount: document.querySelectorAll('[data-testid="dicethrone-board-dice-box-fallback"]').length,
            diceButtons: buttons.map((node) => {
                const rawTestId = node.dataset.testid ?? node.getAttribute('data-testid') ?? '';
                const id = Number(rawTestId.replace('die-button-', ''));
                const rect = node.getBoundingClientRect();
                const value = Number(node.dataset.displayValue);
                return {
                    id: Number.isFinite(id) ? id : null,
                    value: Number.isFinite(value) ? value : null,
                    selected: node.dataset.selected === 'true',
                    clickable: node.dataset.clickable === 'true',
                    renderMode: node.dataset.renderMode ?? null,
                    rect: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    },
                    rotateX: node.dataset.rotateX ?? null,
                    rotateY: node.dataset.rotateY ?? null,
                    rotateZ: node.dataset.rotateZ ?? null,
                };
            }),
        };
    }, label);
}

async function waitForBoardVisualAssets(page: Page) {
    await page.waitForFunction(() => {
        const boardImg = document.querySelector('[data-testid="player-board-image"]') as HTMLImageElement | null;
        const boardFrame = document.querySelector('[data-testid="player-board-frame"]') as HTMLElement | null;
        const handArea = document.querySelector('[data-testid="hand-area"]');
        const rollButton = document.querySelector('[data-tutorial-id="dice-roll-button"]');
        return Boolean(
            ((boardImg && boardImg.complete && boardImg.naturalWidth > 0) || boardFrame)
            && handArea
            && rollButton,
        );
    }, undefined, { timeout: 45000 });

    await page.waitForTimeout(900);
}

async function closeMagnifyOverlayIfPresent(page: Page) {
    const overlay = page.getByTestId('board-magnify-overlay').first();
    const hasOverlay = await overlay.count().catch(() => 0);
    if (!hasOverlay) return;

    const visible = await overlay.isVisible().catch(() => false);
    if (!visible) return;

    const closeButton = overlay.getByRole('button', { name: /关闭预览|close preview/i }).first();
    const closeButtonVisible = await closeButton.isVisible().catch(() => false);
    if (closeButtonVisible) {
        await closeButton.click({ force: true });
    } else {
        await overlay.click({ position: { x: 12, y: 12 }, force: true });
    }

    await page.keyboard.press('Escape').catch(() => undefined);
    await overlay.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(120);
}

async function logBoardVisualState(page: Page, label: string) {
    const state = await page.evaluate((storageKey) => {
        const overlay = document.querySelector('[data-testid="board-magnify-overlay"]') as HTMLElement | null;
        const boardImg = document.querySelector('[data-testid="player-board-image"]') as HTMLImageElement | null;
        const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]') as HTMLElement | null;
        const canvas = document.querySelector('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
        const diceTray = document.querySelector('[data-tutorial-id="dice-tray"]') as HTMLElement | null;
        const harnessState = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        const multistepResult = harnessState?.sys?.multistepInteraction?.result
            ?? harnessState?.ui?.multistepInteraction?.result
            ?? null;
        const selectedDiceIdsFromResult = Array.isArray(multistepResult?.selectedDiceIds)
            ? multistepResult.selectedDiceIds
            : [];
        const dieButtons = Array.from(document.querySelectorAll('[data-testid^="die-button-"]')) as HTMLElement[];
        const selectedButtonIds = dieButtons
            .filter((node) => node.dataset.selected === 'true')
            .map((node) => Number((node.dataset.testid ?? node.getAttribute('data-testid') ?? '').replace('die-button-', '')))
            .filter((id) => Number.isFinite(id));
        const overlayStyle = overlay ? window.getComputedStyle(overlay) : null;
        const stageRect = stage?.getBoundingClientRect();
        const canvasRect = canvas?.getBoundingClientRect();
        const trayRect = diceTray?.getBoundingClientRect();
        const boardDice3dEnabled = window.localStorage.getItem(storageKey);
        const activePlayerId = harnessState?.core?.activePlayerId ?? null;
        const currentPhase = harnessState?.sys?.phase ?? null;
        const rollCount = harnessState?.core?.rollCount ?? null;
        const rollConfirmed = harnessState?.core?.rollConfirmed ?? null;
        return {
            boardDice3dEnabled,
            activePlayerId,
            currentPhase,
            rollCount,
            rollConfirmed,
            overlayPresent: Boolean(overlay),
            overlayVisible: Boolean(overlay && overlayStyle && overlayStyle.pointerEvents !== 'none' && Number(overlayStyle.opacity || '0') > 0.05),
            overlayOpacity: overlayStyle?.opacity ?? null,
            overlayPointerEvents: overlayStyle?.pointerEvents ?? null,
            boardImageSrc: boardImg?.currentSrc ?? null,
            boardImageNaturalWidth: boardImg?.naturalWidth ?? null,
            boardImageComplete: boardImg?.complete ?? null,
            highlightCount: document.querySelectorAll('[data-testid^="dt-ability-highlight-"]').length,
            selectedCount: document.querySelectorAll('[data-testid^="dt-ability-selected-"]').length,
            selectedDiceIdsFromResult,
            selectedButtonIds,
            boardStageCount: document.querySelectorAll('[data-testid="dicethrone-board-dice-stage"]').length,
            boardCanvasCount: document.querySelectorAll('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]').length,
            diceTrayCount: document.querySelectorAll('[data-tutorial-id="dice-tray"]').length,
            stageRect: stageRect ? {
                x: Math.round(stageRect.x),
                y: Math.round(stageRect.y),
                width: Math.round(stageRect.width),
                height: Math.round(stageRect.height),
            } : null,
            canvasRect: canvasRect ? {
                x: Math.round(canvasRect.x),
                y: Math.round(canvasRect.y),
                width: Math.round(canvasRect.width),
                height: Math.round(canvasRect.height),
            } : null,
            trayRect: trayRect ? {
                x: Math.round(trayRect.x),
                y: Math.round(trayRect.y),
                width: Math.round(trayRect.width),
                height: Math.round(trayRect.height),
            } : null,
            ringDebug: (window as Window & { __DT_RING_DEBUG__?: unknown }).__DT_RING_DEBUG__ ?? null,
        };
    }, BOARD_DICE_3D_STORAGE_KEY);

    console.log(`[capture-dt3d][${label}] ${JSON.stringify(state)}`);
}

async function logBoardDiceStageGate(page: Page, label: string) {
    const gate = await page.evaluate((storageKey) => {
        const harnessState = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        const boardDice3dEnabled = window.localStorage.getItem(storageKey) === 'true';
        const currentPhase = harnessState?.sys?.phase ?? null;
        const activePlayerId = harnessState?.core?.activePlayerId ?? null;
        const rollCount = harnessState?.core?.rollCount ?? 0;
        const hasDiceInteraction = Boolean(
            harnessState?.sys?.interaction?.current?.kind === 'multistep-choice'
            && harnessState?.sys?.interaction?.current?.data?.meta?.dtType,
        );
        const diceTrayVisible = Array.from(document.querySelectorAll('[data-tutorial-id="dice-tray"]'))
            .some((node) => {
                const rect = (node as HTMLElement).getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
        const boardStageVisible = Array.from(document.querySelectorAll('[data-testid="dicethrone-board-dice-stage"]'))
            .some((node) => {
                const rect = (node as HTMLElement).getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
        const boardCanvasVisible = Array.from(document.querySelectorAll('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]'))
            .some((node) => {
                const rect = (node as HTMLElement).getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
        const rollButton = document.querySelector('[data-tutorial-id="dice-roll-button"]') as HTMLButtonElement | null;
        const confirmButton = document.querySelector('[data-tutorial-id="dice-confirm-button"]') as HTMLButtonElement | null;
        return {
            boardDice3dEnabled,
            currentPhase,
            activePlayerId,
            rollCount,
            hasDiceInteraction,
            rollButtonText: (rollButton?.textContent ?? '').trim(),
            confirmButtonText: (confirmButton?.textContent ?? '').trim(),
            boardStageVisible,
            boardCanvasVisible,
            diceTrayVisible,
        };
    }, BOARD_DICE_3D_STORAGE_KEY);

    console.log(`[capture-dt3d][${label}][stage-gate] ${JSON.stringify(gate)}`);
}

async function clickCenterDie(page: Page, dieId: number) {
    const point = await page.evaluate((nextDieId: number) => {
        const target = document.querySelector(
            `[data-testid="dicethrone-board-dice-stage"] [data-testid="die-button-${nextDieId}"]`,
        ) as HTMLElement | null;
        if (!target) return null;

        const rect = target.getBoundingClientRect();
        const style = window.getComputedStyle(target);
        if (rect.width <= 0
            || rect.height <= 0
            || style.visibility === 'hidden'
            || style.display === 'none') {
            return null;
        }

        return {
            x: rect.left + (rect.width / 2),
            y: rect.top + (rect.height / 2),
        };
    }, dieId);
    if (!point) throw new Error(`未找到棋盘骰子中心点击点 ${dieId}`);
    await page.mouse.click(point.x, point.y);
}

async function dragHandCardToPlay(page: Page, cardId: string) {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await handCard.waitFor({ state: 'visible', timeout: 10000 });

    const box = await handCard.boundingBox();
    if (!box) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = box.x + (box.width / 2);
    const startY = box.y + (box.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
}

async function waitForCenterDieAttached(page: Page, dieId: number) {
    await page.waitForFunction((nextDieId: number) => {
        return Boolean(document.querySelector(`[data-testid="die-button-${nextDieId}"]`));
    }, dieId, { timeout: 12000 });
}

async function waitForSelectedBoardDiceCount(page: Page, count: number) {
    await page.waitForFunction((expectedCount: number) => {
        return Array.from(document.querySelectorAll(
            '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
        )).filter((node) => (node as HTMLElement).dataset.selected === 'true').length === expectedCount;
    }, count, { timeout: 5000 });
}

async function waitForRollUiSettled(page: Page) {
    await page.waitForFunction(() => {
        const rollButton = document.querySelector('[data-tutorial-id="dice-roll-button"]') as HTMLButtonElement | null;
        if (!rollButton) return false;
        const text = (rollButton.textContent ?? '').trim();
        return text.length > 0 && !/掷骰中|rolling/i.test(text);
    }, undefined, { timeout: 12000 });
    await page.waitForTimeout(420);
}

async function setDiceFocusedScreenshotMode(page: Page, enabled: boolean) {
    await page.evaluate((shouldEnable) => {
        const styleId = 'dt-dice-focused-screenshot-style';
        document.getElementById(styleId)?.remove();
        if (!shouldEnable) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            [data-testid^="dt-ability-highlight-"],
            [data-testid^="dt-ability-selected-"] {
                opacity: 0 !important;
                box-shadow: none !important;
                border-color: transparent !important;
            }
        `;
        document.head.appendChild(style);
    }, enabled);
}

async function waitForBoardDiceProjectionStable(page: Page) {
    await page.waitForFunction(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]');
        const canvas = document.querySelector('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
        const buttons = Array.from(document.querySelectorAll(
            '[data-testid="dicethrone-board-dice-stage"] [data-testid^="die-button-"]',
        )) as HTMLElement[];
        if (!state || !stage || !canvas || buttons.length < 5) return false;

        const stageRect = stage.getBoundingClientRect();
        const rects = buttons.map((node) => node.getBoundingClientRect());
        const validRects = rects.every((rect, index) => {
            const node = buttons[index];
            return node.dataset.renderMode === 'engine'
                && rect.width >= 36
                && rect.height >= 36
                && rect.width <= 110
                && rect.height <= 110
                && rect.left >= stageRect.left - 4
                && rect.top >= stageRect.top - 4
                && rect.right <= stageRect.right + 4
                && rect.bottom <= stageRect.bottom + 4;
        });
        if (!validRects) return false;

        const positions = rects.map((rect) => ({
            x: Math.round(rect.x * 10) / 10,
            y: Math.round(rect.y * 10) / 10,
            w: Math.round(rect.width * 10) / 10,
            h: Math.round(rect.height * 10) / 10,
        }));

        const snapshot = JSON.stringify(positions);
        const win = window as Window & {
            __DT_CAPTURE_LAYOUT_SNAPSHOT__?: string;
            __DT_CAPTURE_LAYOUT_STABLE_SINCE__?: number;
        };
        if (win.__DT_CAPTURE_LAYOUT_SNAPSHOT__ !== snapshot) {
            win.__DT_CAPTURE_LAYOUT_SNAPSHOT__ = snapshot;
            win.__DT_CAPTURE_LAYOUT_STABLE_SINCE__ = performance.now();
            return false;
        }

        const stableSince = win.__DT_CAPTURE_LAYOUT_STABLE_SINCE__ ?? 0;
        return performance.now() - stableSince >= 320;
    }, undefined, { timeout: 12000 });
}

async function waitForBoardDiceFullySettled(page: Page) {
    const isBoardDiceSettled = () => {
        const canvas = document.querySelector('[data-testid="dice-field-3d-canvas"]')
            ?? document.querySelector('[data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        const texturesOrSkinsReady = canvas.dataset.skinsReady === 'true'
            || canvas.dataset.diceTexturesReady === 'true';
        return rect.width > 0
            && rect.height > 0
            && texturesOrSkinsReady
            && canvas.dataset.diceSettled === 'true'
            && canvas.dataset.diceVisualSettled === 'true'
            && Number(canvas.dataset.diceMaxLift ?? Number.POSITIVE_INFINITY) <= 0.004
            && Number(canvas.dataset.diceMaxTravel ?? Number.POSITIVE_INFINITY) <= 0.012;
    };
    const settled = await page.waitForFunction(isBoardDiceSettled, undefined, { timeout: 24000 })
        .then(() => true)
        .catch(() => page.evaluate(isBoardDiceSettled));
    if (!settled) {
        const debugState = await page.evaluate(() => {
            const canvas = document.querySelector('[data-testid="dice-field-3d-canvas"]')
                ?? document.querySelector('[data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
            const rect = canvas?.getBoundingClientRect();
            return {
                canvasTestId: canvas?.getAttribute('data-testid') ?? null,
                rect: rect ? {
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                } : null,
                dataset: canvas ? { ...canvas.dataset } : null,
            };
        });
        throw new Error(`[capture-dt3d] board dice did not settle: ${JSON.stringify(debugState)}`);
    }
    await page.waitForTimeout(120);
}

async function clickDiceRollButton(page: Page, rollButton: Locator) {
    await rollButton.waitFor({ state: 'visible', timeout: 12000 });
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-tutorial-id="dice-roll-button"]') as HTMLButtonElement | null;
        if (!button) return false;
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return !button.disabled
            && style.pointerEvents !== 'none'
            && style.visibility !== 'hidden'
            && rect.width > 0
            && rect.height > 0;
    }, undefined, { timeout: 12000 });

    try {
        await rollButton.click({ force: true, noWaitAfter: true, timeout: 12000 });
    } catch {
        await page.waitForTimeout(250);
        await rollButton.click({ force: true, noWaitAfter: true, timeout: 12000 });
    }
}

async function triggerRealRoll(page: Page, rollButton: Locator) {
    await clickDiceRollButton(page, rollButton);
    const clickedThrough = await page.waitForFunction(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        const hasStage = Boolean(document.querySelector('[data-testid="dicethrone-board-dice-stage"]'));
        const hasCanvas = Boolean(document.querySelector('[data-testid="dicethrone-board-dice-box-canvas"]'));
        return hasStage || hasCanvas || ((state?.core?.rollCount ?? 0) >= 1);
    }, undefined, { timeout: 1800 }).then(() => true).catch(() => false);
    if (clickedThrough) return;

    console.log('[capture-dt3d] 页面投掷按钮未推进状态，改用真实命令派发 ROLL_DICE');
    await dispatchDiceThroneCommand(page, {
        type: 'ROLL_DICE',
        playerId: '0',
        payload: {},
    });
    await page.waitForFunction(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        return (state?.core?.rollCount ?? 0) >= 1;
    }, undefined, { timeout: 8000 });
}

async function applyRerollFlowScene(page: Page) {
    const initial = await readDiceThroneHarnessState<CaptureHarnessState>(page);
    const nextState = JSON.parse(JSON.stringify(initial)) as CaptureHarnessState;

    const cardCatalog = CHARACTER_DATA_MAP.monk.getStartingDeck(PREPARE_RANDOM);
    const justThis = cardCatalog.find((card) => card.id === 'card-just-this');
    if (!justThis) {
        throw new Error('未找到 card-just-this');
    }

    const player0 = initHeroState('0', 'monk', PREPARE_RANDOM);
    const player1 = initHeroState('1', 'barbarian', PREPARE_RANDOM);
    player0.hand = [{ ...justThis }];
    player0.deck = player0.deck.filter((card) => card.id !== 'card-just-this');
    player0.discard = [];
    player0.resources[RESOURCE_IDS.CP] = 2;
    player0.resources[RESOURCE_IDS.HP] = 50;
    player1.resources[RESOURCE_IDS.HP] = 50;

    nextState.core.selectedCharacters = { '0': 'monk', '1': 'barbarian' };
    nextState.core.readyPlayers = { '0': true, '1': true };
    nextState.core.hostStarted = true;
    nextState.core.players['0'] = player0;
    nextState.core.players['1'] = player1;
    nextState.core.activePlayerId = '0';
    nextState.core.startingPlayerId = '0';
    nextState.core.turnNumber = 1;
    nextState.core.rollCount = 0;
    nextState.core.rollLimit = 3;
    nextState.core.rollDiceCount = 5;
    nextState.core.rollConfirmed = false;
    nextState.core.pendingAttack = null;
    delete nextState.core.pendingDamage;
    delete nextState.core.pendingBonusDiceSettlement;
    nextState.core.dice = createCharacterDice('monk').map((die, index) => ({
        ...die,
        id: index,
        value: index + 1,
        isKept: false,
    }));
    nextState.sys.phase = 'offensiveRoll';
    nextState.sys.interaction = {
        ...(nextState.sys.interaction ?? {}),
        current: null,
        queue: Array.isArray(nextState.sys.interaction?.queue) ? nextState.sys.interaction.queue : [],
        history: Array.isArray(nextState.sys.interaction?.history) ? nextState.sys.interaction.history : [],
    };

    await page.evaluate((state) => {
        window.__BG_TEST_HARNESS__!.state.set(state);
    }, nextState);

    await waitForBoardVisualAssets(page);
}

async function main() {
    process.env.PW_SERVER_RUNTIME = process.env.PW_SERVER_RUNTIME ?? 'tsx';
    process.env.PW_SERVER_WATCH = process.env.PW_SERVER_WATCH ?? 'false';
    process.env.BG_NODE_MAX_OLD_SPACE_SIZE = process.env.BG_NODE_MAX_OLD_SPACE_SIZE ?? '8192';
    process.env.BG_NODE_MAX_SEMI_SPACE_SIZE = process.env.BG_NODE_MAX_SEMI_SPACE_SIZE ?? '256';
    const startedAt = new Date().toISOString();
    const evidence: RunEvidence = {};

    const runtimeResult = await ensureSingleWorkerRuntime({
        requestedScope: 'dt-3d-dice-capture',
        target: 'dt-3d-dice-capture',
        logger: console,
    });

    process.env.PW_PORT = String(runtimeResult.runtime.ports.frontend);
    process.env.PW_GAME_SERVER_PORT = String(runtimeResult.runtime.ports.gameServer);
    process.env.GAME_SERVER_PORT = String(runtimeResult.runtime.ports.gameServer);
    process.env.PW_API_SERVER_PORT = String(runtimeResult.runtime.ports.apiServer);
    process.env.API_SERVER_PORT = String(runtimeResult.runtime.ports.apiServer);

    const baseURL = `http://127.0.0.1:${runtimeResult.runtime.ports.frontend}`;
    const browser = await launchBrowserWithRetry();

    try {
        await resetOutputDir();
        await writeRunManifest({
            status: 'running',
            startedAt,
            currentStep: 'starting',
        });
        const context = await browser.newContext({
            baseURL,
            viewport: { width: 1920, height: 1080 },
        });
        await initContext(context, {
            storageKey: '__dicethrone_storage_reset',
            skipTutorial: false,
        });
        const page = await context.newPage();
        const diagnostics = attachPageDiagnostics(page);
        page.on('pageerror', (error) => {
            console.error('[capture-dt3d][pageerror]', error.stack ?? error.message);
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                console.error('[capture-dt3d][console-error]', msg.text());
            }
        });

        await page.goto('/play/dicethrone', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
        await waitForDiceThroneHarness(page, 20000);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-after-goto', diagnostics }]);
        await page.evaluate((storageKey) => {
            window.localStorage.setItem(storageKey, 'true');
        }, BOARD_DICE_3D_STORAGE_KEY);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForDiceThroneHarness(page, 20000);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-after-reload', diagnostics }]);
        await applyRerollFlowScene(page);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();

        await saveScreenshot(page, SCREENSHOTS.beforeRoll);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-before-roll', diagnostics }]);
        await writeRunManifest({
            status: 'running',
            startedAt,
            currentStep: 'saved-before-roll',
        });

        await setDiceThroneDiceValues(page, [1, 2, 3, 4, 5]);
        await triggerRealRoll(page, rollButton);
        console.log('[capture-dt3d] 已点击投掷，等待骰子舞台进入');
        await logBoardDiceStageGate(page, 'after-click-roll');
        await logBoardVisualState(page, 'after-click-roll');
        await page.waitForFunction(() => {
            const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
            const hasStage = Boolean(document.querySelector('[data-testid="dicethrone-board-dice-stage"]'));
            const hasCanvas = Boolean(document.querySelector('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]'));
            return hasStage || hasCanvas || ((state?.core?.rollCount ?? 0) >= 1);
        }, undefined, { timeout: 12000 }).catch(() => undefined);
        await page.waitForTimeout(120);
        await logBoardDiceStageGate(page, 'before-save-02');
        await logBoardVisualState(page, 'before-save-02');
        await saveScreenshot(page, SCREENSHOTS.rolling);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-rolling', diagnostics }]);
        await writeRunManifest({
            status: 'running',
            startedAt,
            currentStep: 'saved-rolling',
        });
        console.log('[capture-dt3d] 已保存 02');

        console.log('[capture-dt3d] 等待真实投掷完成稳定态');
        await confirmButton.waitFor({ state: 'visible', timeout: 12000 });
        console.log('[capture-dt3d] 真实投掷完成，确认按钮已出现');
        await waitForRollUiSettled(page);
        await logBoardDiceStageGate(page, 'before-wait-03-stable');
        await logBoardVisualState(page, 'before-wait-03-stable');
        await waitForBoardDiceProjectionStable(page);
        await waitForBoardDiceFullySettled(page);
        await closeMagnifyOverlayIfPresent(page);
        await setDiceFocusedScreenshotMode(page, true);
        await logBoardVisualState(page, 'before-save-03');
        evidence.rolled = await collectBoardDiceEvidence(page, 'before-save-03');
        await saveScreenshot(page, SCREENSHOTS.rolled);
        await setDiceFocusedScreenshotMode(page, false);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-rolled', diagnostics }]);
        await writeRunManifest({
            status: 'running',
            startedAt,
            currentStep: 'saved-rolled',
            evidence,
        });
        console.log('[capture-dt3d] 已保存 03');

        console.log('[capture-dt3d] 真实打出“就这？”进入选骰交互');
        await dragHandCardToPlay(page, 'card-just-this');
        await page.waitForFunction(() => {
            const interaction = (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            const selectableDice = Array.from(document.querySelectorAll('[data-testid^="die-button-"]'))
                .filter((node) => {
                    const element = node as HTMLElement;
                    const rect = element.getBoundingClientRect();
                    return rect.width >= 36 && rect.height >= 36;
                }).length;
            return interaction?.kind === 'multistep-choice'
                && meta?.dtType === 'selectDie'
                && (meta?.selectCount === 5 || selectableDice >= 5);
        }, undefined, { timeout: 8000 });
        console.log('[capture-dt3d] 已通过真实打牌进入选骰交互');
        await waitForBoardDiceProjectionStable(page);
        await waitForBoardDiceFullySettled(page);
        await closeMagnifyOverlayIfPresent(page);
        await logBoardVisualState(page, 'after-enter-select-die');

        for (const dieId of [0, 1, 2, 3, 4]) {
            await waitForCenterDieAttached(page, dieId);
            if (dieId === 4) {
                await setDiceThroneDiceValues(page, [6, 6, 6, 6, 6]);
            }
            await clickCenterDie(page, dieId);
            console.log(`[capture-dt3d] 已点击骰子 ${dieId}`);
            if (dieId < 4) {
                await waitForSelectedBoardDiceCount(page, dieId + 1);
            }
            if (dieId === 1) {
                await waitForBoardDiceFullySettled(page);
                await page.waitForTimeout(180);
                await closeMagnifyOverlayIfPresent(page);
                await setDiceFocusedScreenshotMode(page, true);
                await logBoardVisualState(page, 'before-save-04-two');
                evidence.selectedTwo = await collectBoardDiceEvidence(page, 'before-save-04-two');
                await saveScreenshot(page, SCREENSHOTS.selectedTwo);
                await setDiceFocusedScreenshotMode(page, false);
                await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-selected-two', diagnostics }]);
                await writeRunManifest({
                    status: 'running',
                    startedAt,
                    currentStep: 'saved-selected-two',
                    evidence,
                });
                console.log('[capture-dt3d] 已保存 04-two');
            }
        }

        await waitForSelectedBoardDiceCount(page, 5);
        console.log('[capture-dt3d] 五颗骰子已选择，点击确认触发重投');
        await confirmButton.waitFor({ state: 'visible', timeout: 12000 });
        await confirmButton.click({ force: true, noWaitAfter: true, timeout: 12000 });

        await page.waitForFunction(
            () => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                const interaction = state?.sys?.interaction?.current;
                const handIds = (state?.core?.players?.['0']?.hand ?? []).map((card: { id: string }) => card.id);
                const lastEventTypes = (state?.sys?.eventStream?.entries ?? [])
                    .slice(-12)
                    .map((entry: { event?: { type?: string } }) => entry.event?.type);
                return !interaction
                    && !handIds.includes('card-just-this')
                    && lastEventTypes.filter((type: string) => type === 'DIE_REROLLED').length >= 5;
            },
            undefined,
            { timeout: 8000 },
        );
        await page.waitForFunction(() => {
            const dice = (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.core?.dice ?? [];
            const values = dice.map((die: { value: number }) => die.value);
            return values.join(',') !== '1,2,3,4,5';
        }, undefined, { timeout: 8000 });
        await waitForBoardDiceProjectionStable(page);
        await waitForBoardDiceFullySettled(page);
        await page.waitForTimeout(180);
        await closeMagnifyOverlayIfPresent(page);
        await setDiceFocusedScreenshotMode(page, true);
        await logBoardVisualState(page, 'before-save-05');
        evidence.rerolled = await collectBoardDiceEvidence(page, 'before-save-05');
        await saveScreenshot(page, SCREENSHOTS.rerolled);
        await setDiceFocusedScreenshotMode(page, false);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-rerolled', diagnostics }]);
        await writeRunManifest({
            status: 'completed',
            startedAt,
            finishedAt: new Date().toISOString(),
            currentStep: 'saved-rerolled',
            evidence,
        });

        const selectedState = await readDiceThroneHarnessState<CaptureHarnessState>(page);
        console.log(JSON.stringify({
            ok: true,
            phase: selectedState?.sys?.phase ?? null,
            diceValues: selectedState?.core?.dice?.map((die: { value: number }) => die.value) ?? [],
            screenshots: SCREENSHOTS,
        }, null, 2));

        await context.close();
    } catch (error) {
        await writeRunManifest({
            status: 'failed',
            startedAt,
            finishedAt: new Date().toISOString(),
            error: error instanceof Error ? (error.stack ?? error.message) : String(error),
            evidence,
        }).catch(() => undefined);
        throw error;
    } finally {
        await browser.close().catch(() => undefined);
        runtimeResult.controller?.stop?.('capture-dicethrone-3d-reroll-flow complete');
    }
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
