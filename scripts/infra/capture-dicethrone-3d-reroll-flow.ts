import '../../src/games/dicethrone/domain';
import { mkdir, rename, stat, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { chromium, type Locator, type Page } from 'playwright';
import { ensureSingleWorkerRuntime } from './e2e-runtime-manager.mjs';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    initContext,
} from '../../e2e/helpers/common';
import {
    patchDiceThroneHarnessState,
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

async function writeRunManifest(input: {
    status: 'running' | 'failed' | 'completed';
    startedAt: string;
    finishedAt?: string;
    currentStep?: string;
    error?: string;
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
    await page.evaluate((nextDieId: number) => {
        const target = document.querySelector(`[data-testid="die-button-${nextDieId}"]`) as HTMLElement | null;
        if (!target) throw new Error(`未找到骰子点击层 ${nextDieId}`);
        target.click();
    }, dieId);
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

async function waitForRollUiSettled(page: Page) {
    await page.waitForFunction(() => {
        const rollButton = document.querySelector('[data-tutorial-id="dice-roll-button"]') as HTMLButtonElement | null;
        if (!rollButton) return false;
        const text = (rollButton.textContent ?? '').trim();
        return text.length > 0 && !/掷骰中|rolling/i.test(text);
    }, undefined, { timeout: 12000 });
    await page.waitForTimeout(420);
}

async function waitForBoardDiceProjectionStable(page: Page) {
    await page.waitForFunction(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
        const stage = document.querySelector('[data-testid="dicethrone-board-dice-stage"]');
        const canvas = document.querySelector('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]');
        const buttons = Array.from(document.querySelectorAll('[data-testid^="die-button-"]')) as HTMLElement[];
        if (!state || !stage || !canvas || buttons.length < 5) return false;

        const rects = buttons.map((node) => node.getBoundingClientRect());
        const validRects = rects.every((rect) => rect.width >= 40 && rect.height >= 40);
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
    await page.waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="dice-field-3d-canvas"], [data-testid="dicethrone-board-dice-box-canvas"]') as HTMLElement | null;
        return canvas?.dataset.diceSettled === 'true';
    }, undefined, { timeout: 12000 });
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

async function applyRerollFlowScene(page: Page) {
    const initial = await readDiceThroneHarnessState<any>(page);
    const nextState = JSON.parse(JSON.stringify(initial));

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
    const startedAt = new Date().toISOString();

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
    const browser = await chromium.launch({ headless: true });

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
        await clickDiceRollButton(page, rollButton);
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

        // 真实页面继续渲染，但抓图不再依赖投骰异步时序；直接把投后稳定态补齐，确保 03/04 可重复验证 3D 落位。
        console.log('[capture-dt3d] 开始补齐投后稳定态');
        await patchDiceThroneHarnessState(page, {
            core: {
                rollCount: 1,
                rollConfirmed: false,
            },
        });
        console.log('[capture-dt3d] 已写入 rollCount=1');
        await setDiceThroneDiceValues(page, [1, 2, 3, 4, 5]);
        console.log('[capture-dt3d] 已重设 03 骰面值');
        await confirmButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
        console.log('[capture-dt3d] 03 的确认按钮等待已结束');
        await waitForRollUiSettled(page);
        await logBoardDiceStageGate(page, 'before-wait-03-stable');
        await logBoardVisualState(page, 'before-wait-03-stable');
        await waitForBoardDiceProjectionStable(page);
        await waitForBoardDiceFullySettled(page);
        await closeMagnifyOverlayIfPresent(page);
        await logBoardVisualState(page, 'before-save-03');
        await saveScreenshot(page, SCREENSHOTS.rolled);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-rolled', diagnostics }]);
        await writeRunManifest({
            status: 'running',
            startedAt,
            currentStep: 'saved-rolled',
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
                    return rect.width >= 40 && rect.height >= 40;
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
            await clickCenterDie(page, dieId);
            console.log(`[capture-dt3d] 已点击骰子 ${dieId}`);
            if (dieId === 1) {
                await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-testid^="die-button-"]'))
                    .filter((node) => (node as HTMLElement).dataset.selected === 'true').length === 2, undefined, { timeout: 5000 });
                await waitForBoardDiceFullySettled(page);
                await page.waitForTimeout(180);
                await closeMagnifyOverlayIfPresent(page);
                await logBoardVisualState(page, 'before-save-04-two');
                await saveScreenshot(page, SCREENSHOTS.selectedTwo);
                await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-selected-two', diagnostics }]);
                await writeRunManifest({
                    status: 'running',
                    startedAt,
                    currentStep: 'saved-selected-two',
                });
                console.log('[capture-dt3d] 已保存 04-two');
            }
        }

        await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-testid^="die-button-"]'))
            .filter((node) => (node as HTMLElement).dataset.selected === 'true').length === 5, undefined, { timeout: 5000 });
        console.log('[capture-dt3d] 五颗骰子均已选中，准备保存 04');
        await waitForBoardDiceFullySettled(page);
        await page.waitForTimeout(180);
        await closeMagnifyOverlayIfPresent(page);
        await logBoardVisualState(page, 'before-save-04');
        await saveScreenshot(page, SCREENSHOTS.selected);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-selected-all', diagnostics }]);
        await writeRunManifest({
            status: 'running',
            startedAt,
            currentStep: 'saved-selected-all',
        });

        await setDiceThroneDiceValues(page, [6, 6, 6, 6, 6]);
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
            const target = buttons.find((button) => /^(确认|Confirm)(?:\s*\(\d+\))?$/i.test(button.textContent?.trim() ?? ''));
            if (!target) throw new Error('未找到确认按钮');
            target.click();
        });

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
        await logBoardVisualState(page, 'before-save-05');
        await saveScreenshot(page, SCREENSHOTS.rerolled);
        await assertNoFatalFrontendErrors([{ label: 'capture-dt3d-saved-rerolled', diagnostics }]);
        await writeRunManifest({
            status: 'completed',
            startedAt,
            finishedAt: new Date().toISOString(),
            currentStep: 'saved-rerolled',
        });

        const selectedState = await readDiceThroneHarnessState<any>(page);
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
