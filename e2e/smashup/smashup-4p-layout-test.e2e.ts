import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { setChineseLocale } from '../helpers/common';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';
import { DESKTOP_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';

async function saveEvidenceLocatorScreenshot(page: any, locator: any, testInfo: any, subdir: string, filename: string) {
    const path = getEvidenceScreenshotPath(testInfo, filename, { subdir, filename });
    mkdirSync(dirname(path), { recursive: true });
    await expect(locator).toBeVisible({ timeout: 15000 });
    const box = await locator.boundingBox();
    expect(box, `未获取到截图目标 ${filename} 的边界`).not.toBeNull();
    const padding = 10;
    await page.screenshot({
        path,
        animations: 'disabled',
        scale: 'device',
        clip: {
            x: Math.max((box?.x ?? 0) - padding, 0),
            y: Math.max((box?.y ?? 0) - padding, 0),
            width: (box?.width ?? 0) + padding * 2,
            height: (box?.height ?? 0) + padding * 2,
        },
    });
}

async function waitForFabPanelStable(
    panel: any,
    mainVisual: any,
    panelButtons: any,
    label = 'fab panel',
) {
    let previousSignature: string | null = null;
    let stableCount = 0;

    await expect
        .poll(async () => {
            const panelBox = await panel.boundingBox();
            const mainBox = await mainVisual.boundingBox();
            const buttonCount = await panelButtons.count();

            if (!panelBox || !mainBox || buttonCount === 0) {
                stableCount = 0;
                previousSignature = null;
                return 0;
            }

            const buttonBoxes = await Promise.all(
                Array.from({ length: buttonCount }, (_, index) => panelButtons.nth(index).boundingBox()),
            );
            if (buttonBoxes.some((box) => !box)) {
                stableCount = 0;
                previousSignature = null;
                return 0;
            }

            const round = (value: number) => Math.round(value * 10) / 10;
            const normalize = (box: { x: number; y: number; width: number; height: number }) => ({
                x: round(box.x),
                y: round(box.y),
                width: round(box.width),
                height: round(box.height),
            });

            const signature = JSON.stringify({
                panel: normalize(panelBox),
                main: normalize(mainBox),
                buttons: buttonBoxes.map((box) => normalize(box!)),
            });

            if (signature === previousSignature) {
                stableCount += 1;
            } else {
                stableCount = 0;
                previousSignature = signature;
            }

            return stableCount;
        }, {
            timeout: 2500,
            intervals: [80, 120, 160],
            message: `${label} 展开态布局未稳定`,
        })
        .toBeGreaterThanOrEqual(1);
}

async function longPressTouch(locator: any, page: any, pointerId: number) {
    const box = await locator.boundingBox();
    expect(box, '长按目标应该先可见').not.toBeNull();

    await locator.evaluate(async (element: HTMLElement, nextPointerId: number) => {
        const rect = element.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const dispatch = (type: 'pointerdown' | 'pointerup') => {
            element.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                pointerId: nextPointerId,
                pointerType: 'touch',
                clientX,
                clientY,
            }));
        };

        dispatch('pointerdown');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 720));
        dispatch('pointerup');
    }, pointerId);
    await page.waitForTimeout(120);
}

async function closeMagnifyOverlay(page: any) {
    const overlay = page.locator('[data-testid="su-card-magnify-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await overlay.getByRole('button').click();
    await expect(overlay).toHaveCount(0);
}

async function waitForMagnifyPreviewReady(page: any) {
    const overlay = page.locator('[data-testid="su-card-magnify-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await expect
        .poll(async () => overlay.locator('.atlas-shimmer').count(), {
            timeout: 8000,
            message: '放大预览不应停留在 atlas shimmer 占位态',
        })
        .toBe(0);
    await page.waitForTimeout(120);
}

async function clickCenter(locator: any, page: any) {
    const box = await locator.boundingBox();
    expect(box, '点击目标应该先可见').not.toBeNull();
    await locator.dispatchEvent('click');
}

async function expectCenterHitSelf(locator: any, label: string) {
    await expect(locator).toBeVisible({ timeout: 10000 });
    const hitSelf = await locator.evaluate((element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const target = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
        return !!target && (target === element || element.contains(target));
    });
    expect(hitSelf, `${label} 中心点命中目标应仍是自身`).toBe(true);
}

async function tapTouchCenter(locator: any, page: any) {
    const box = await locator.boundingBox();
    expect(box, '触摸目标应该先可见').not.toBeNull();

    const client = await page.context().newCDPSession(page);
    const x = Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2);
    const y = Math.round((box?.y ?? 0) + (box?.height ?? 0) / 2);

    try {
        await client.send('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 1,
        });
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1, id: 1 }],
        });
        await page.waitForTimeout(60);
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
        });
        await page.waitForTimeout(180);
    } finally {
        await client.detach().catch(() => {});
    }
}

async function pinchZoomTouch(locator: any, page: any, options?: {
    startDistance?: number;
    endDistance?: number;
    steps?: number;
    durationMs?: number;
}) {
    await expect(locator).toBeVisible({ timeout: 10000 });
    await locator.evaluate(async (element: HTMLElement, rawOptions?: {
        startDistance?: number;
        endDistance?: number;
        steps?: number;
        durationMs?: number;
    }) => {
        const startDistance = rawOptions?.startDistance ?? 120;
        const endDistance = rawOptions?.endDistance ?? 250;
        const steps = rawOptions?.steps ?? 6;
        const durationMs = rawOptions?.durationMs ?? 140;
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dispatch = (
            type: 'pointerdown' | 'pointermove' | 'pointerup',
            pointerId: number,
            clientX: number,
            clientY: number,
            buttons: number,
            isPrimary: boolean,
        ) => {
            element.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                pointerId,
                pointerType: 'touch',
                clientX,
                clientY,
                buttons,
                isPrimary,
            }));
        };
        const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

        const startHalf = startDistance / 2;
        const endHalf = endDistance / 2;

        dispatch('pointerdown', 1, centerX - startHalf, centerY, 1, true);
        dispatch('pointerdown', 2, centerX + startHalf, centerY, 1, false);

        for (let step = 1; step <= steps; step += 1) {
            const progress = step / steps;
            const currentHalf = startHalf + (endHalf - startHalf) * progress;
            dispatch('pointermove', 1, centerX - currentHalf, centerY, 1, true);
            dispatch('pointermove', 2, centerX + currentHalf, centerY, 1, false);
            await wait(durationMs / steps);
        }

        dispatch('pointerup', 1, centerX - endHalf, centerY, 0, true);
        dispatch('pointerup', 2, centerX + endHalf, centerY, 0, false);
    }, options);
    await page.waitForTimeout(180);
}

async function panTouch(locator: any, page: any, options?: {
    deltaX?: number;
    deltaY?: number;
    steps?: number;
    durationMs?: number;
    startXRatio?: number;
    startYRatio?: number;
    pointerId?: number;
}) {
    await expect(locator).toBeVisible({ timeout: 10000 });
    await locator.evaluate(async (element: HTMLElement, rawOptions?: {
        deltaX?: number;
        deltaY?: number;
        steps?: number;
        durationMs?: number;
        startXRatio?: number;
        startYRatio?: number;
        pointerId?: number;
    }) => {
        const deltaX = rawOptions?.deltaX ?? -120;
        const deltaY = rawOptions?.deltaY ?? 0;
        const steps = rawOptions?.steps ?? 6;
        const durationMs = rawOptions?.durationMs ?? 140;
        const startXRatio = rawOptions?.startXRatio ?? 0.5;
        const startYRatio = rawOptions?.startYRatio ?? 0.46;
        const touchId = rawOptions?.pointerId ?? 11;
        const rect = element.getBoundingClientRect();
        const startX = rect.left + rect.width * startXRatio;
        const startY = rect.top + rect.height * startYRatio;
        const dispatch = (
            type: 'pointerdown' | 'pointermove' | 'pointerup',
            clientX: number,
            clientY: number,
            buttons: number,
        ) => {
            element.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                pointerId: touchId,
                pointerType: 'touch',
                clientX,
                clientY,
                buttons,
                isPrimary: true,
            }));
        };
        const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

        dispatch('pointerdown', startX, startY, 1);
        for (let step = 1; step <= steps; step += 1) {
            const progress = step / steps;
            dispatch('pointermove', startX + deltaX * progress, startY + deltaY * progress, 1);
            await wait(durationMs / steps);
        }
        dispatch('pointerup', startX + deltaX, startY + deltaY, 0);
    }, options);
    await page.waitForTimeout(180);
}

async function createChromiumTouchSession(page: any) {
    const browserContext = page.context() as any;
    if (typeof browserContext.newCDPSession !== 'function') {
        throw new Error('当前浏览器上下文不支持 Chromium CDP，多触点注入不可用');
    }

    const session = await browserContext.newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
    });

    return session;
}

async function dispatchChromiumTouchEvent(
    session: any,
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    touchPoints: Array<{ id: number; x: number; y: number }>,
) {
    await session.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: touchPoints.map((point) => ({
            id: point.id,
            x: point.x,
            y: point.y,
            radiusX: 2,
            radiusY: 2,
            force: 0.5,
        })),
        modifiers: 0,
    });
}

async function pinchZoomTouchChromium(locator: any, page: any, options?: {
    startDistance?: number;
    endDistance?: number;
    steps?: number;
    durationMs?: number;
}) {
    await expect(locator).toBeVisible({ timeout: 10000 });
    const box = await locator.boundingBox();
    expect(box, 'Chromium 多触点 pinch 目标应该先可见').not.toBeNull();

    const startDistance = options?.startDistance ?? 120;
    const endDistance = options?.endDistance ?? 250;
    const steps = options?.steps ?? 6;
    const durationMs = options?.durationMs ?? 140;
    const centerX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const centerY = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    const startHalf = startDistance / 2;
    const endHalf = endDistance / 2;
    const session = await createChromiumTouchSession(page);

    await dispatchChromiumTouchEvent(session, 'touchStart', [
        { id: 1, x: centerX - startHalf, y: centerY },
        { id: 2, x: centerX + startHalf, y: centerY },
    ]);

    for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        const currentHalf = startHalf + (endHalf - startHalf) * progress;
        await dispatchChromiumTouchEvent(session, 'touchMove', [
            { id: 1, x: centerX - currentHalf, y: centerY },
            { id: 2, x: centerX + currentHalf, y: centerY },
        ]);
        await page.waitForTimeout(durationMs / steps);
    }

    await dispatchChromiumTouchEvent(session, 'touchEnd', []);
    await page.waitForTimeout(180);
}

async function panTouchChromium(locator: any, page: any, options?: {
    deltaX?: number;
    deltaY?: number;
    steps?: number;
    durationMs?: number;
    startXRatio?: number;
    startYRatio?: number;
    pointerId?: number;
}) {
    await expect(locator).toBeVisible({ timeout: 10000 });
    const box = await locator.boundingBox();
    expect(box, 'Chromium 多触点 pan 目标应该先可见').not.toBeNull();

    const deltaX = options?.deltaX ?? -120;
    const deltaY = options?.deltaY ?? 0;
    const steps = options?.steps ?? 6;
    const durationMs = options?.durationMs ?? 140;
    const startXRatio = options?.startXRatio ?? 0.5;
    const startYRatio = options?.startYRatio ?? 0.46;
    const pointerId = options?.pointerId ?? 11;
    const startX = (box?.x ?? 0) + (box?.width ?? 0) * startXRatio;
    const startY = (box?.y ?? 0) + (box?.height ?? 0) * startYRatio;
    const session = await createChromiumTouchSession(page);

    await dispatchChromiumTouchEvent(session, 'touchStart', [
        { id: pointerId, x: startX, y: startY },
    ]);

    for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        await dispatchChromiumTouchEvent(session, 'touchMove', [
            {
                id: pointerId,
                x: startX + deltaX * progress,
                y: startY + deltaY * progress,
            },
        ]);
        await page.waitForTimeout(durationMs / steps);
    }

    await dispatchChromiumTouchEvent(session, 'touchEnd', []);
    await page.waitForTimeout(180);
}

async function installBattlefieldGestureProbe(page: any, selector = '[data-testid="su-battlefield-viewport"]') {
    await page.evaluate((viewportSelector: string) => {
        const viewport = document.querySelector<HTMLElement>(viewportSelector);
        if (!viewport) {
            throw new Error(`未找到手势探针目标: ${viewportSelector}`);
        }

        const store = {
            logs: [] as Array<Record<string, unknown>>,
        };
        (window as any).__SU_BATTLEFIELD_GESTURE_PROBE__ = store;

        const pushLog = (scope: string, event: Event) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            const touchEvent = event as TouchEvent;
            const pointerEvent = event as PointerEvent;
            store.logs.push({
                scope,
                type: event.type,
                pointerId: 'pointerId' in pointerEvent ? pointerEvent.pointerId : null,
                pointerType: 'pointerType' in pointerEvent ? pointerEvent.pointerType : null,
                touches: typeof touchEvent.touches?.length === 'number' ? touchEvent.touches.length : null,
                changedTouches: typeof touchEvent.changedTouches?.length === 'number' ? touchEvent.changedTouches.length : null,
                clientX: 'clientX' in pointerEvent ? pointerEvent.clientX : null,
                clientY: 'clientY' in pointerEvent ? pointerEvent.clientY : null,
                targetTag: target?.tagName ?? null,
                targetTestId: target?.getAttribute('data-testid') ?? null,
                zoomScale: viewport.getAttribute('data-battlefield-zoom-scale'),
                touchMode: viewport.getAttribute('data-battlefield-touch-mode'),
                translateX: viewport.getAttribute('data-battlefield-translate-x'),
                translateY: viewport.getAttribute('data-battlefield-translate-y'),
                time: Math.round(performance.now()),
            });
            if (store.logs.length > 400) {
                store.logs.splice(0, store.logs.length - 400);
            }
        };

        const eventTypes = [
            'touchstart',
            'touchmove',
            'touchend',
            'touchcancel',
            'pointerdown',
            'pointermove',
            'pointerup',
            'pointercancel',
            'pointerleave',
            'pointerout',
            'gotpointercapture',
            'lostpointercapture',
        ] as const;

        for (const eventType of eventTypes) {
            viewport.addEventListener(eventType, (event) => pushLog('viewport', event), true);
            document.addEventListener(eventType, (event) => pushLog('document', event), true);
        }
    }, selector);
}

async function readBattlefieldGestureProbe(page: any) {
    return page.evaluate(() => ((window as any).__SU_BATTLEFIELD_GESTURE_PROBE__?.logs ?? []) as Array<Record<string, unknown>>);
}

const INITIAL_BASE_IDS = ['base_the_jungle', 'base_dread_lookout', 'base_tsars_palace'] as const;
const EXPECTED_ACTIVE_BASE_COUNT = 5;
const REPLACEMENT_BASE_DECK = [
    'base_central_brain',
    'base_cave_of_shinies',
    'base_rhodes_plaza',
    'base_the_factory',
] as const;
const EXPECTED_FINAL_BASE_IDS = [
    'base_cave_of_shinies',
    'base_rhodes_plaza',
    'base_central_brain',
    'base_the_homeworld',
    'base_the_mothership',
] as const;
const EXPECTED_FINAL_VP = {
    '0': 7,
    '1': 4,
    '2': 8,
    '3': 10,
} as const;
const EXPECTED_AFTER_FIRST_BASE_VP = {
    '0': 6,
    '1': 2,
    '2': 6,
    '3': 6,
} as const;
const INITIAL_VP = {
    '0': 1,
    '1': 2,
    '2': 3,
    '3': 4,
} as const;
const EXPECTED_SCORING_ORDER = [
    'base_tsars_palace',
    'base_the_jungle',
    'base_dread_lookout',
] as const;
const EXPECTED_REPLACEMENT_PAIRS = [
    { oldBaseDefId: 'base_tsars_palace', newBaseDefId: 'base_central_brain' },
    { oldBaseDefId: 'base_the_jungle', newBaseDefId: 'base_cave_of_shinies' },
    { oldBaseDefId: 'base_dread_lookout', newBaseDefId: 'base_rhodes_plaza' },
] as const;
const MOBILE_LANDSCAPE_VIEWPORT = { width: 800, height: 450 } as const;

function getRuntimeEventsByType(state: any, type: string) {
    return ((state?.sys?.eventStream?.entries ?? []) as Array<{ event?: { type?: string; payload?: any } }>)
        .map((entry) => entry.event)
        .filter((event): event is { type: string; payload: any } => event?.type === type);
}

function sumScoringVpByPlayer(scoreEvents: Array<{ payload: { rankings?: Array<{ playerId: string; vp: number }> } }>) {
    const totals: Record<string, number> = {};
    for (const event of scoreEvents) {
        for (const ranking of event.payload.rankings ?? []) {
            totals[ranking.playerId] = (totals[ranking.playerId] ?? 0) + ranking.vp;
        }
    }
    return totals;
}

function getPlayerVpSnapshot(state: any) {
    return {
        '0': state?.core?.players?.['0']?.vp,
        '1': state?.core?.players?.['1']?.vp,
        '2': state?.core?.players?.['2']?.vp,
        '3': state?.core?.players?.['3']?.vp,
    };
}

function createPlayerState(
    playerId: string,
    vp: number,
    factions: [string, string],
) {
    return {
        id: playerId,
        vp,
        hand: [],
        deck: [],
        discard: [],
        factions,
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
    };
}

function buildFourPlayerMultiBaseScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    { uid: 'p2-b0-spectre', defId: 'ghost_spectre', owner: '2', controller: '2' },
                    { uid: 'p0-b0-grave-digger', defId: 'zombie_grave_digger', owner: '0', controller: '0' },
                    { uid: 'p1-b0-invader', defId: 'alien_invader', owner: '1', controller: '1' },
                    { uid: 'p3-b0-ghost', defId: 'ghost_ghost', owner: '3', controller: '3' },
                ],
            },
            {
                defId: 'base_dread_lookout',
                breakpoint: 20,
                minions: [
                    { uid: 'p3-b1-king-rex', defId: 'dino_king_rex', owner: '3', controller: '3' },
                    { uid: 'p1-b1-tiger-assassin', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                    { uid: 'p1-b1-collector', defId: 'alien_collector', owner: '1', controller: '1' },
                    { uid: 'p0-b1-grave-digger', defId: 'zombie_grave_digger', owner: '0', controller: '0' },
                    { uid: 'p2-b1-chronomage', defId: 'wizard_chronomage', owner: '2', controller: '2' },
                ],
            },
            {
                defId: 'base_tsars_palace',
                breakpoint: 22,
                minions: [
                    { uid: 'p0-b2-king-rex', defId: 'dino_king_rex', owner: '0', controller: '0' },
                    { uid: 'p2-b2-spirit-a', defId: 'ghost_spirit', owner: '2', controller: '2' },
                    { uid: 'p2-b2-spirit-b', defId: 'ghost_spirit', owner: '2', controller: '2' },
                    { uid: 'p3-b2-spectre', defId: 'ghost_spectre', owner: '3', controller: '3' },
                    { uid: 'p1-b2-tiger-assassin', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                ],
            },
            {
                defId: 'base_the_homeworld',
                minions: [],
            },
            {
                defId: 'base_the_mothership',
                minions: [],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1', '2', '3'],
                turnNumber: 5,
                nextUid: 9000,
                baseDeck: [...REPLACEMENT_BASE_DECK],
                players: {
                    '0': createPlayerState('0', 1, ['dinosaurs', 'zombies']),
                    '1': createPlayerState('1', 2, ['aliens', 'ninjas']),
                    '2': createPlayerState('2', 3, ['ghosts', 'wizards']),
                    '3': createPlayerState('3', 4, ['dinosaurs', 'ghosts']),
                },
            },
        },
    };
}

async function openFourPlayerScoreScene(page: any, game: any) {
    await game.openTestGame('smashup', {
        numPlayers: 4,
        skipInitialization: true,
    });
    await game.setupScene(buildFourPlayerMultiBaseScene());
    await expect.poll(async () => {
        const text = await page.evaluate(() => document.body?.innerText ?? '');
        return text.includes('Loading match resources...');
    }, { timeout: 20000 }).toBe(false);
    await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible({ timeout: 15000 });
}

async function getBaseOptions(game: any) {
    const options = await game.getInteractionOptions();
    return options.map((option: any) => ({
        id: option.id as string,
        baseDefId: option.value?.baseDefId as string | undefined,
        baseIndex: option.value?.baseIndex as number | undefined,
        label: option.label as string,
    }));
}

async function getBaseLocatorByDefId(page: any, game: any, baseDefId: string) {
    const state = await game.getState();
    const baseIndex = state?.core?.bases?.findIndex((base: any) => base?.defId === baseDefId) ?? -1;
    expect(baseIndex, `未在棋盘上找到基地 ${baseDefId}`).toBeGreaterThanOrEqual(0);
    return page.locator(`[data-base-index="${baseIndex}"]`);
}

async function selectBoardBaseByDefId(page: any, game: any, baseDefId: string) {
    const locator = await getBaseLocatorByDefId(page, game, baseDefId);
    await expectCenterHitSelf(locator, `基地 ${baseDefId}`);
    await locator.click();
}

async function dispatchAdvancePhaseAtTimestamp(page: any, game: any, timestamp: number) {
    const playerId = await game.getCurrentPlayerId();
    expect(playerId, '推进 scoreBases 延迟结算前应能读取当前玩家').toBeTruthy();

    await page.evaluate(async ({ nextPlayerId, nextTimestamp }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        await harness.command.dispatch({
            type: 'ADVANCE_PHASE',
            playerId: nextPlayerId,
            payload: {},
            timestamp: nextTimestamp,
        });
    }, {
        nextPlayerId: playerId,
        nextTimestamp: timestamp,
    });
    await page.waitForTimeout(120);
}

async function drainScoreBasesDelayUntilPromptOrExit(page: any, game: any, timeout = 15000) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const state = await game.getState();
        const sourceId = state?.sys?.interaction?.current?.data?.sourceId;
        if (sourceId === 'multi_base_scoring') {
            return 'prompt';
        }
        if (state?.sys?.phase !== 'scoreBases') {
            return 'exit';
        }

        const delayUntil = (state?.sys as Record<string, any> | undefined)?._smashupPostScoringBaseRevealDelayUntil;
        if (typeof delayUntil === 'number') {
            await dispatchAdvancePhaseAtTimestamp(page, game, Math.max(delayUntil + 1, Date.now() + 1));
            continue;
        }

        await page.waitForTimeout(200);
    }

    throw new Error('等待多基地计分继续或退出超时');
}

function buildFourPlayerMobileScene() {
    const scene = buildFourPlayerMultiBaseScene();

    return {
        ...scene,
        bases: [
            {
                ...scene.bases[0],
                minions: [
                    {
                        uid: 'p0-b0-armor-stego',
                        defId: 'dino_armor_stego_pod',
                        owner: '0',
                        controller: '0',
                        talentUsed: false,
                        attachedActions: [
                            { uid: 'p0-b0-armor-stego-upgrade', defId: 'dino_tooth_and_claw_pod', ownerId: '0' },
                            { uid: 'p0-b0-armor-stego-attached-talent', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                        ],
                    },
                    ...scene.bases[0].minions.filter((minion) => minion.controller !== '0'),
                ],
                ongoingActions: [
                    { uid: 'p0-b0-base-ongoing', defId: 'zombie_overrun', ownerId: '0', talentUsed: false },
                    { uid: 'p0-b0-base-ongoing-talent-mobile', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false },
                ],
            },
            ...scene.bases.slice(1),
        ],
        extra: {
            ...scene.extra,
            core: {
                ...scene.extra.core,
                players: {
                    ...scene.extra.core.players,
                    '0': {
                        ...scene.extra.core.players['0'],
                        hand: [
                            { uid: 'p0-mobile-hand-terraform', defId: 'alien_terraform', type: 'action', owner: '0' },
                            { uid: 'p0-mobile-hand-invader', defId: 'alien_invader', type: 'minion', owner: '0' },
                        ],
                    },
                },
            },
        },
    };
}

function buildFourPlayerMobileSceneWithTitan() {
    const scene = buildFourPlayerMobileScene();

    return {
        ...scene,
        extra: {
            ...scene.extra,
            core: {
                ...scene.extra.core,
                titans: [
                    ...(scene.extra.core.titans ?? []),
                    {
                        uid: 't-mobile-layout-fort',
                        defId: 'dinosaurs_fort_titanosaurus',
                        faction: 'dinosaurs',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: scene.extra.core.turnNumber },
                    },
                    {
                        uid: 't-mobile-layout-rail',
                        defId: 'dinosaurs_fort_titanosaurus',
                        faction: 'dinosaurs',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                ],
            },
        },
    };
}

function buildDesktopBaseOngoingTalentScene() {
    const scene = buildFourPlayerMobileScene();

    return {
        ...scene,
        bases: [
            {
                ...scene.bases[0],
                minions: [
                    {
                        uid: 'p0-b0-locals',
                        defId: 'innsmouth_the_locals',
                        owner: '0',
                        controller: '0',
                        talentUsed: false,
                        attachedActions: [],
                    },
                    ...scene.bases[0].minions,
                ],
                ongoingActions: [
                    ...scene.bases[0].ongoingActions,
                    {
                        uid: 'p0-b0-base-ongoing-talent',
                        defId: 'innsmouth_sacred_circle',
                        ownerId: '0',
                        talentUsed: false,
                        metadata: { powerCounters: 2 },
                    },
                ],
            },
            ...scene.bases.slice(1),
        ],
        extra: {
            ...scene.extra,
            core: {
                ...scene.extra.core,
                players: {
                    ...scene.extra.core.players,
                    '0': {
                        ...scene.extra.core.players['0'],
                        hand: [
                            ...scene.extra.core.players['0'].hand,
                            { uid: 'p0-mobile-hand-locals', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
                        ],
                    },
                },
            },
        },
    };
}

function buildDiscardOverflowScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'draw',
        bases: [
            { defId: 'base_the_jungle' },
            { defId: 'base_dread_lookout' },
            { defId: 'base_tsars_palace' },
        ],
        player0: {
            factions: ['aliens', 'pirates'],
            hand: [
                'alien_invader',
                'alien_invader',
                'alien_collector',
                'pirate_first_mate',
                'alien_invader',
                'pirate_first_mate',
                'alien_invader',
                'alien_collector',
                'pirate_first_mate',
                'alien_invader',
                'alien_collector',
            ],
            deck: ['alien_invader'],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            vp: 3,
        },
        player1: {
            factions: ['dinosaurs', 'ninjas'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            vp: 2,
        },
    };
}

function buildMonsterWithoutCountersMobileScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    {
                        uid: 'p0-monster-no-counter',
                        defId: 'frankenstein_the_monster_pod',
                        owner: '0',
                        controller: '0',
                        powerCounters: 0,
                        talentUsed: false,
                    },
                ],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 3,
                nextUid: 3000,
                baseDeck: [],
                players: {
                    '0': createPlayerState('0', 0, ['frankenstein', 'aliens']),
                    '1': createPlayerState('1', 0, ['pirates', 'ninjas']),
                },
            },
        },
    };
}

function buildMonsterWithCounterMobileScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    {
                        uid: 'p0-monster-with-counter',
                        defId: 'frankenstein_the_monster_pod',
                        owner: '0',
                        controller: '0',
                        powerCounters: 1,
                        talentUsed: false,
                    },
                ],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 3,
                nextUid: 3001,
                baseDeck: [],
                players: {
                    '0': createPlayerState('0', 0, ['frankenstein', 'aliens']),
                    '1': createPlayerState('1', 0, ['pirates', 'ninjas']),
                },
            },
        },
    };
}

function buildFactionSelectionMobileScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'factionSelect' as const,
        extra: {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 1,
                nextUid: 1000,
                players: {
                    '0': createPlayerState('0', 0, ['aliens', 'pirates']),
                    '1': createPlayerState('1', 0, ['ninjas', 'dinosaurs']),
                },
                factionSelection: {
                    takenFactions: [],
                    playerSelections: {
                        '0': [],
                        '1': [],
                    },
                    completedPlayers: [],
                },
            },
        },
    };
}

function buildFactionSelectionWithOwnedPickScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'factionSelect' as const,
        extra: {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 1,
                nextUid: 1000,
                players: {
                    '0': createPlayerState('0', 0, ['aliens', 'pirates']),
                    '1': createPlayerState('1', 0, ['ninjas', 'dinosaurs']),
                },
                factionSelection: {
                    takenFactions: ['pirates'],
                    playerSelections: {
                        '0': ['pirates'],
                        '1': [],
                    },
                    completedPlayers: [],
                },
            },
        },
    };
}

async function expectLocatorInsideViewport(
    locator: any,
    name: string,
    viewportWidth: number,
    viewportHeight: number,
) {
    const box = await locator.boundingBox();
    expect(box, `${name} 应该有可见的布局盒`).not.toBeNull();
    expect(box!.x, `${name} 不应超出左边界`).toBeGreaterThanOrEqual(-2);
    expect(box!.y, `${name} 不应超出上边界`).toBeGreaterThanOrEqual(-2);
    expect(box!.x + box!.width, `${name} 不应超出右边界`).toBeLessThanOrEqual(viewportWidth + 2);
    expect(box!.y + box!.height, `${name} 不应超出下边界`).toBeLessThanOrEqual(viewportHeight + 2);
}

async function waitForSmashUpMainUiReady(page: any) {
    await expect.poll(async () => {
        return await page.evaluate(() => {
            const bodyText = document.body?.innerText ?? '';
            const unresolvedKeys = [
                'ui.you_short',
                'ui.score_sheet',
                'ui.finish_turn',
                'ui.deck',
                'ui.discard',
                'phases.playCards',
            ];

            return !bodyText.includes('Loading match resources...')
                && unresolvedKeys.every((key) => !bodyText.includes(key));
        });
    }, {
        timeout: 15000,
        intervals: [200, 300, 500],
    }).toBe(true);
}

test.describe('大杀四方四人局五基地布局与多基地计分', () => {
    test('四人局五基地中三处同时到达断点时，正确弹出多基地选择交互', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await openFourPlayerScoreScene(page, game);

        const scoreBoard = page.locator('[data-tutorial-id="su-scoreboard"]');
        await expect(scoreBoard).toContainText('P1');
        await expect(scoreBoard).toContainText('P2');
        await expect(scoreBoard).toContainText('P3');
        await expect(page.locator('[data-base-index]')).toHaveCount(EXPECTED_ACTIVE_BASE_COUNT);

        await game.advancePhase();
        await game.waitForInteraction('multi_base_scoring', 15000);

        await expect(page.getByText(/选择先[计记]分的基地/)).toBeVisible();

        const baseOptions = await getBaseOptions(game);
        expect(baseOptions).toHaveLength(3);
        expect(baseOptions.map((option: any) => option.baseDefId).sort()).toEqual([...INITIAL_BASE_IDS].sort());

        const selectableBases = await Promise.all(
            baseOptions.map(async (option: any) => ({
                baseDefId: option.baseDefId,
                locator: await getBaseLocatorByDefId(page, game, option.baseDefId),
            })),
        );
        for (const { baseDefId, locator } of selectableBases) {
            await expectCenterHitSelf(locator, `可选基地 ${baseDefId}`);
            await locator.click({ trial: true });
        }

        await game.screenshot('01-four-player-multi-base-prompt', testInfo);
        await saveEvidenceLocatorScreenshot(
            page,
            selectableBases[0].locator,
            testInfo,
            'smashup',
            'smashup-four-player-multi-base-board-click-target.png',
        );
    });

    test('四人局五基地中三处同时计分会按选择顺序依次结算并更新四名玩家VP', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await openFourPlayerScoreScene(page, game);

        await game.advancePhase();
        await game.waitForInteraction('multi_base_scoring', 15000);

        await selectBoardBaseByDefId(page, game, 'base_tsars_palace');

        await expect.poll(async () => {
            const state = await game.getState();
            const scoreEvents = getRuntimeEventsByType(state, 'su:base_scored');
            return {
                vp: getPlayerVpSnapshot(state),
                scoredBases: scoreEvents.map((event) => event.payload.baseDefId),
            };
        }, {
            timeout: 5000,
            message: '第一座基地计分后，VP 应已正式落地，且事件流只记录这一次基地计分',
        }).toEqual({
            vp: EXPECTED_AFTER_FIRST_BASE_VP,
            scoredBases: ['base_tsars_palace'],
        });
        await game.screenshot('02a-after-first-base-vp-landed', testInfo);

        await expect.poll(async () => {
            return (await getBaseOptions(game)).map((option: any) => option.baseDefId).sort();
        }).toEqual(['base_dread_lookout', 'base_the_jungle']);
        expect(await drainScoreBasesDelayUntilPromptOrExit(page, game)).toBe('prompt');
        await expect(page.getByText(/选择先[计记]分的基地/)).toBeVisible();

        await game.screenshot('02-after-first-base-choice', testInfo);

        await selectBoardBaseByDefId(page, game, 'base_the_jungle');
        expect(await drainScoreBasesDelayUntilPromptOrExit(page, game)).toBe('exit');
        await game.waitForNoInteraction(15000);
        await game.waitForPhase('playCards', 15000);

        const finalState = await game.getState();
        const scoreEvents = getRuntimeEventsByType(finalState, 'su:base_scored');
        const clearEvents = getRuntimeEventsByType(finalState, 'su:base_cleared');
        const replaceEvents = getRuntimeEventsByType(finalState, 'su:base_replaced');
        const scoringVpTotals = sumScoringVpByPlayer(scoreEvents);

        expect(finalState.core.turnOrder).toEqual(['0', '1', '2', '3']);
        expect(finalState.core.players['0'].vp).toBe(EXPECTED_FINAL_VP['0']);
        expect(finalState.core.players['1'].vp).toBe(EXPECTED_FINAL_VP['1']);
        expect(finalState.core.players['2'].vp).toBe(EXPECTED_FINAL_VP['2']);
        expect(finalState.core.players['3'].vp).toBe(EXPECTED_FINAL_VP['3']);
        expect(scoreEvents.map((event) => event.payload.baseDefId)).toEqual([...EXPECTED_SCORING_ORDER]);
        expect(clearEvents.map((event) => event.payload.baseDefId)).toEqual([...EXPECTED_SCORING_ORDER]);
        expect(replaceEvents.map((event) => ({
            oldBaseDefId: event.payload.oldBaseDefId,
            newBaseDefId: event.payload.newBaseDefId,
        }))).toEqual([...EXPECTED_REPLACEMENT_PAIRS]);
        for (const playerId of Object.keys(EXPECTED_FINAL_VP) as Array<keyof typeof EXPECTED_FINAL_VP>) {
            expect(
                scoringVpTotals[playerId],
                `玩家 ${playerId} 的最终 VP 增量必须完全来自三次基地计分，不能只发一次或重复发`,
            ).toBe(EXPECTED_FINAL_VP[playerId] - INITIAL_VP[playerId]);
        }
        expect(scoreEvents.every((event) => (event.payload.rankings ?? []).some((ranking: any) => ranking.vp > 0))).toBe(true);
        expect(finalState.core.bases).toHaveLength(EXPECTED_ACTIVE_BASE_COUNT);
        expect(finalState.core.bases.map((base: any) => base.defId)).toEqual([...EXPECTED_FINAL_BASE_IDS]);
        expect(finalState.core.baseDeck).toEqual(['base_the_factory']);

        for (const base of finalState.core.bases) {
            expect(base.minions).toHaveLength(0);
            expect(base.ongoingActions).toHaveLength(0);
        }

        await game.screenshot('03-final-four-player-state', testInfo);
    });

    test('移动端横屏点击不同对手分数应能切换对应玩家视角并退出', async ({ page, game }, testInfo) => {
        test.setTimeout(150000);

        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 4,
            skipInitialization: true,
        }, 120000);
        const scene = buildFourPlayerMobileScene();
        scene.extra.core.players['1'] = {
            ...scene.extra.core.players['1'],
            deck: [
                { uid: 'p1-deck-1', defId: 'alien_invader', type: 'minion', owner: '1' },
                { uid: 'p1-deck-2', defId: 'alien_collector', type: 'minion', owner: '1' },
                { uid: 'p1-deck-3', defId: 'ninja_tiger_assassin', type: 'minion', owner: '1' },
            ],
            discard: [
                { uid: 'p1-discard-1', defId: 'alien_scout', type: 'minion', owner: '1' },
            ],
        };
        scene.extra.core.players['2'] = {
            ...scene.extra.core.players['2'],
            deck: [
                { uid: 'p2-deck-1', defId: 'ghost_spectre', type: 'minion', owner: '2' },
                { uid: 'p2-deck-2', defId: 'ghost_ghost', type: 'minion', owner: '2' },
                { uid: 'p2-deck-3', defId: 'wizard_chronomage', type: 'minion', owner: '2' },
                { uid: 'p2-deck-4', defId: 'wizard_archmage', type: 'minion', owner: '2' },
                { uid: 'p2-deck-5', defId: 'ghost_spirit', type: 'minion', owner: '2' },
            ],
            discard: [
                { uid: 'p2-discard-1', defId: 'wizard_acolyte', type: 'minion', owner: '2' },
                { uid: 'p2-discard-2', defId: 'ghost_spectre', type: 'minion', owner: '2' },
            ],
        };
        await game.setupScene(scene);

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 800
                && window.innerHeight === 450
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards';
        }, { timeout: 10000, polling: 200 });

        await waitForSmashUpMainUiReady(page);

        const firstOpponentScoreButton = page.locator('[data-testid="su-score-vp-1"]');
        const secondOpponentScoreButton = page.locator('[data-testid="su-score-vp-2"]');
        const opponentViewBanner = page.getByText('对手视角');
        const backToSelfButton = page.getByRole('button', { name: '返回' });
        const deckStack = page.locator('[data-testid="su-deck-stack"]');
        const discardToggle = page.locator('[data-testid="su-discard-toggle"]');

        await expect(firstOpponentScoreButton).toBeVisible({ timeout: 15000 });
        await expect(secondOpponentScoreButton).toBeVisible({ timeout: 15000 });
        const hitTestId = await firstOpponentScoreButton.evaluate((element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) as HTMLElement | null;
            return target?.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
        });
        expect(hitTestId, '分数球中心点命中目标应仍是分数按钮本身').toBe('su-score-vp-1');

        await tapTouchCenter(firstOpponentScoreButton, page);
        await expect(opponentViewBanner).toBeVisible({ timeout: 5000 });
        await expect(backToSelfButton).toBeVisible({ timeout: 5000 });
        await expect(deckStack).toContainText('3');
        await expect(discardToggle).toContainText('(1)');

        await game.screenshot('03a-mobile-opponent-view-entry', testInfo);

        await tapTouchCenter(secondOpponentScoreButton, page);
        await expect(opponentViewBanner).toBeVisible({ timeout: 5000 });
        await expect(deckStack).toContainText('5');
        await expect(discardToggle).toContainText('(2)');

        await game.screenshot('03b-mobile-opponent-view-switch-player-2', testInfo);

        await backToSelfButton.click();
        await expect(opponentViewBanner).toHaveCount(0);
        await expect(discardToggle).toContainText('(0)');
        await expect(deckStack).toContainText('0');

        await game.screenshot('03c-mobile-opponent-view-return-self', testInfo);
    });

    test('移动端横屏四人局五个基地边缘应保持可见', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 4,
            skipInitialization: true,
        });
        await game.setupScene(buildFourPlayerMobileSceneWithTitan());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 800
                && window.innerHeight === 450
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && (state?.core?.bases?.length ?? 0) === 5;
        }, { timeout: 10000, polling: 200 });

        await waitForSmashUpMainUiReady(page);

        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();

        const baseSlots = page.locator('[data-base-index]');
        await expect(baseSlots).toHaveCount(EXPECTED_ACTIVE_BASE_COUNT);
        for (let index = 0; index < EXPECTED_ACTIVE_BASE_COUNT; index += 1) {
            await expectLocatorInsideViewport(
                baseSlots.nth(index),
                `移动端横屏第 ${index + 1} 个基地`,
                viewport!.width,
                viewport!.height,
            );
        }

        await game.screenshot('04-mobile-landscape-four-player-five-bases-visible', testInfo);
    });

    test('移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 4,
            skipInitialization: true,
        });
        await game.setupScene(buildFourPlayerMobileSceneWithTitan());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 800
                && window.innerHeight === 450
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && (state?.core?.players?.['0']?.hand?.length ?? 0) === 2;
        }, { timeout: 10000, polling: 200 });

        const scoreBoard = page.locator('[data-tutorial-id="su-scoreboard"]');
        const turnTracker = page.locator('[data-tutorial-id="su-turn-tracker"]');
        const scoreboardPanel = page.locator('[data-testid="su-scoreboard-panel"]');
        const scoreboardVisibilityToggle = page.locator('[data-testid="su-scoreboard-visibility-toggle"]');
        const handArea = page.locator('[data-testid="su-hand-area"]');
        const battlefieldViewport = page.locator('[data-testid="su-battlefield-viewport"]');
        const battlefieldZoomTarget = page.locator('[data-testid="su-battlefield-zoom-target"]');
        const deckStack = page.locator('[data-testid="su-deck-stack"]');
        const discardToggle = page.locator('[data-testid="su-discard-toggle"]');
        const titanRail = page.locator('[data-testid="su-titan-rail"]');
        const endTurnButton = page.locator('[data-tutorial-id="su-end-turn-btn"]');
        const endTurnActionButton = page.locator('[data-testid="su-end-turn-action-button"]');
        const endTurnHints = page.locator('[data-testid="su-end-turn-hints"]');
        const endTurnMinionQuota = page.locator('[data-testid="su-end-turn-minion-quota"]');
        const endTurnActionQuota = page.locator('[data-testid="su-end-turn-action-quota"]');
        const firstBase = page.locator('[data-base-index="0"]');
        const secondBase = page.locator('[data-base-index="1"]');
        const fifthBase = page.locator('[data-base-index="4"]');
        const baseSlots = page.locator('[data-base-index]');
        const handCard = page.locator('[data-card-uid="p0-mobile-hand-terraform"]').first();
        const inspectButton = page.locator('[data-testid="su-hand-card-inspect-p0-mobile-hand-terraform"]');
        const talentMinion = page.locator('[data-minion-uid="p0-b0-armor-stego"]');
        const titanCard = page.locator('[data-testid="su-base-titan-t-mobile-layout-fort"]');
        const baseOngoingCard = page.locator('[data-ongoing-uid="p0-b0-base-ongoing"]');
        const baseOngoingTalentCard = page.locator('[data-ongoing-uid="p0-b0-base-ongoing-talent-mobile"]');
        const attachedActionCard = page.locator('[data-attached-action-uid="p0-b0-armor-stego-upgrade"]');
        const attachedActionTalentCard = page.locator('[data-attached-action-uid="p0-b0-armor-stego-attached-talent"]');
        const magnifyOverlay = page.locator('[data-testid="su-card-magnify-overlay"]');
        const exitFabButton = page.locator('[data-fab-id="exit"]').first();
        const exitFabVisual = page.locator('[data-fab-visual-id="exit"]').first();
        const exitFabPanel = page.locator('[data-testid="fab-panel-exit"]');
        const exitFabSheet = page.locator('[data-testid="fab-sheet-exit"]');
        const exitFabSheetBackdrop = page.locator('[data-testid="fab-sheet-backdrop-exit"]');
        const exitFabTooltip = page.locator('[data-testid="fab-tooltip-exit"]');

        await expect(scoreBoard).toBeVisible({ timeout: 15000 });
        await expect(turnTracker).toBeVisible({ timeout: 15000 });
        await expect(scoreboardPanel).toBeVisible({ timeout: 15000 });
        await expect(scoreboardVisibilityToggle).toBeVisible({ timeout: 15000 });
        await expect(handArea).toBeVisible({ timeout: 15000 });
        await expect(deckStack).toBeVisible({ timeout: 15000 });
        await expect(discardToggle).toBeVisible({ timeout: 15000 });
        await expect(titanRail).toBeVisible({ timeout: 15000 });
        await expect(endTurnActionButton).toBeVisible({ timeout: 15000 });
        await expect(endTurnHints).toBeVisible({ timeout: 15000 });
        await expect(endTurnMinionQuota).toBeVisible({ timeout: 15000 });
        await expect(endTurnActionQuota).toBeVisible({ timeout: 15000 });
        await expect(firstBase).toBeVisible({ timeout: 15000 });
        await expect(secondBase).toBeVisible({ timeout: 15000 });
        await expect(fifthBase).toBeVisible({ timeout: 15000 });
        await expect(baseSlots).toHaveCount(EXPECTED_ACTIVE_BASE_COUNT);
        await expect(battlefieldViewport).toBeVisible({ timeout: 15000 });
        await expect(handCard).toBeVisible({ timeout: 15000 });
        await expect(exitFabButton).toBeVisible({ timeout: 15000 });
        await expect(exitFabVisual).toBeVisible({ timeout: 15000 });
        await expect(inspectButton).toHaveCSS('opacity', '1');
        await expect(talentMinion).toBeVisible({ timeout: 15000 });
        await expect(titanCard).toBeVisible({ timeout: 15000 });
        await expect(baseOngoingCard).toBeVisible({ timeout: 15000 });
        await expect(baseOngoingTalentCard).toBeVisible({ timeout: 15000 });
        await expect(talentMinion).toHaveAttribute('data-attached-actions-visible', 'false');

        await waitForSmashUpMainUiReady(page);

        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();

        await expectLocatorInsideViewport(scoreBoard, '记分板', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(turnTracker, '回合指示', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(scoreboardVisibilityToggle, '记分板隐藏按钮', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(firstBase, '第 1 个基地', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(titanCard, '第 1 个基地上的泰坦', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(fifthBase, '第 5 个基地', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(deckStack, '牌库', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(discardToggle, '弃牌堆', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(titanRail, '底部泰坦区', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(handCard, '手牌卡牌', viewport!.width, viewport!.height);

        await expectLocatorInsideViewport(endTurnButton, '结束回合按钮', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnHints, '结束回合右侧提示容器', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnMinionQuota, '随从额度提示', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnActionQuota, '战术额度提示', viewport!.width, viewport!.height);

        const mobileLandscapeDocumentMetrics = await page.evaluate(() => ({
            viewportWidth: window.innerWidth,
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyClientWidth: document.body.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
            htmlOverflowX: window.getComputedStyle(document.documentElement).overflowX,
            bodyOverflowX: window.getComputedStyle(document.body).overflowX,
            rootOverflowX: window.getComputedStyle(document.getElementById('root')!).overflowX,
        }));
        expect(
            mobileLandscapeDocumentMetrics.documentScrollWidth,
            '手机横屏时 documentElement 不应出现全局横向溢出',
        ).toBeLessThanOrEqual(mobileLandscapeDocumentMetrics.documentClientWidth + 1);
        expect(
            mobileLandscapeDocumentMetrics.bodyScrollWidth,
            '手机横屏时 body 不应出现全局横向溢出',
        ).toBeLessThanOrEqual(mobileLandscapeDocumentMetrics.bodyClientWidth + 1);
        expect(mobileLandscapeDocumentMetrics.htmlOverflowX, '手机横屏时 html 应禁用横向滚动').toBe('hidden');
        expect(mobileLandscapeDocumentMetrics.bodyOverflowX, '手机横屏时 body 应禁用横向滚动').toBe('hidden');

        const handCardBox = await handCard.boundingBox();
        expect(handCardBox, '手牌卡牌应提供尺寸').not.toBeNull();
        expect(handCardBox!.width, '移动端手牌宽度不应过小').toBeGreaterThan(70);

        const firstBaseBox = await firstBase.boundingBox();
        expect(firstBaseBox, '移动端基地应提供尺寸').not.toBeNull();
        expect(firstBaseBox!.width, '移动端四人局基地不应被 vw + shell scale 二次缩得过小').toBeGreaterThan(76);
        const baseTopValues = await baseSlots.evaluateAll((elements) => (
            elements.map((element) => Math.round(element.getBoundingClientRect().top * 10) / 10)
        ));
        expect(
            Math.max(...baseTopValues) - Math.min(...baseTopValues),
            `所有基地卡顶部应统一对齐，当前 top=${baseTopValues.join(', ')}`,
        ).toBeLessThanOrEqual(2);

        const endTurnActionButtonBox = await endTurnActionButton.boundingBox();
        expect(endTurnActionButtonBox).not.toBeNull();
        expect(endTurnActionButtonBox!.width).toBeGreaterThan(48);
        expect(endTurnActionButtonBox!.height).toBeGreaterThan(48);

        const exitFabBox = await exitFabVisual.boundingBox();
        expect(exitFabBox).not.toBeNull();
        expect(exitFabBox!.width).toBeLessThanOrEqual(42);
        expect(exitFabBox!.height).toBeLessThanOrEqual(42);

        await hideSmashUpDebugPanelForEvidence(page);
        await game.screenshot('04-mobile-landscape-layout', testInfo);

        await scoreboardVisibilityToggle.click();
        await expect(scoreboardPanel).toHaveCount(0);
        await expect(turnTracker).toHaveCount(0);
        await expect(handArea).toHaveCount(0);
        await expect(deckStack).toBeVisible({ timeout: 5000 });
        await expect(discardToggle).toBeVisible({ timeout: 5000 });
        await expect(titanRail).toBeVisible({ timeout: 5000 });
        await expect(titanCard).toBeVisible({ timeout: 5000 });
        await expect(endTurnActionButton).toHaveCount(0);
        await expect(endTurnHints).toHaveCount(0);
        await expect(scoreboardVisibilityToggle).toBeVisible({ timeout: 5000 });
        await expectLocatorInsideViewport(scoreboardVisibilityToggle, '隐藏后的记分板显示按钮', viewport!.width, viewport!.height);
        const hiddenToggleBox = await scoreboardVisibilityToggle.boundingBox();
        expect(hiddenToggleBox, '隐藏后的记分板显示按钮应提供尺寸').not.toBeNull();
        expect(hiddenToggleBox!.x, '隐藏后的记分板显示按钮应保持在右上角').toBeGreaterThan(viewport!.width - 80);
        await game.screenshot('04aa-mobile-scoreboard-hidden', testInfo);

        await scoreboardVisibilityToggle.click();
        await expect(scoreboardPanel).toBeVisible({ timeout: 5000 });
        await expect(turnTracker).toBeVisible({ timeout: 5000 });
        await expect(handArea).toBeVisible({ timeout: 5000 });
        await expect(titanRail).toBeVisible({ timeout: 5000 });
        await expect(endTurnActionButton).toBeVisible({ timeout: 5000 });
        await expect(endTurnHints).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(260);
        await game.screenshot('04ab-mobile-scoreboard-restored', testInfo);

        await expect(battlefieldViewport).toHaveAttribute('data-battlefield-zoom-enabled', 'true');
        await expect(battlefieldViewport).toHaveAttribute('data-battlefield-touch-mode', 'native-pan');
        await expect(battlefieldViewport).toHaveAttribute('data-battlefield-zoom-target-mode', 'content');
        const inlineSecondBaseBox = await secondBase.boundingBox();
        const inlineZoomTargetBox = await battlefieldZoomTarget.boundingBox();
        const endTurnButtonBoxBeforeZoom = await endTurnActionButton.boundingBox();
        expect(inlineSecondBaseBox, '战场缩放前的基地应提供尺寸').not.toBeNull();
        expect(inlineZoomTargetBox, '战场缩放前的战场内容层应提供尺寸').not.toBeNull();
        expect(endTurnButtonBoxBeforeZoom, '缩放前的结束回合按钮应提供尺寸').not.toBeNull();

        await pinchZoomTouch(battlefieldViewport, page, { startDistance: 120, endDistance: 260 });

        await expect
            .poll(async () => Number(await battlefieldViewport.getAttribute('data-battlefield-zoom-scale')), {
                timeout: 5000,
                message: '双指缩放后战场视口应进入大于 1 的缩放态',
            })
            .toBeGreaterThan(1.15);
        await expect(battlefieldViewport).toHaveAttribute('data-battlefield-touch-mode', 'gesture-lock');

        const zoomedSecondBaseBox = await secondBase.boundingBox();
        const zoomedZoomTargetBox = await battlefieldZoomTarget.boundingBox();
        const endTurnButtonBoxAfterZoom = await endTurnActionButton.boundingBox();
        expect(zoomedSecondBaseBox, '战场缩放后的基地应提供尺寸').not.toBeNull();
        expect(zoomedZoomTargetBox, '战场缩放后的战场内容层应提供尺寸').not.toBeNull();
        expect(endTurnButtonBoxAfterZoom, '战场缩放后的结束回合按钮应提供尺寸').not.toBeNull();
        expect(zoomedSecondBaseBox!.width, '双指缩放后基地宽度应明显大于默认态').toBeGreaterThan((inlineSecondBaseBox?.width ?? 0) * 1.15);
        expect(
            (zoomedSecondBaseBox?.y ?? 0) - (inlineSecondBaseBox?.y ?? 0),
            '双指缩放后基地整体不应明显向下漂移',
        ).toBeLessThan(40);
        expect(
            (zoomedZoomTargetBox?.y ?? 0) - (inlineZoomTargetBox?.y ?? 0),
            '双指缩放后战场内容层不应整体下沉，顶部不应扩出大块透明挡层',
        ).toBeLessThan(40);
        expect(Math.abs((endTurnButtonBoxAfterZoom?.x ?? 0) - (endTurnButtonBoxBeforeZoom?.x ?? 0)), '结束回合按钮不应跟随战场一起横向漂移').toBeLessThan(4);
        expect(Math.abs((endTurnButtonBoxAfterZoom?.y ?? 0) - (endTurnButtonBoxBeforeZoom?.y ?? 0)), '结束回合按钮不应跟随战场一起纵向漂移').toBeLessThan(4);
        await game.screenshot('04d-mobile-battlefield-pinch-zoom', testInfo);

        const translateXBeforePan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
        await panTouch(battlefieldViewport, page, { deltaX: -140, deltaY: 0 });
        const translateXAfterPan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
        const pannedSecondBaseBox = await secondBase.boundingBox();
        expect(pannedSecondBaseBox, '战场平移后的基地应提供尺寸').not.toBeNull();
        expect(
            Math.abs(translateXAfterPan - translateXBeforePan),
            `拖拽后 viewport translateX 应明显变化（before=${translateXBeforePan}, after=${translateXAfterPan}）`,
        ).toBeGreaterThan(8);
        expect(
            Math.abs((pannedSecondBaseBox?.x ?? 0) - (zoomedSecondBaseBox?.x ?? 0)),
            '拖拽平移后基地在屏幕中的横向位置应明显变化',
        ).toBeGreaterThan(8);
        await game.screenshot('04e-mobile-battlefield-panned', testInfo);

        await panTouch(battlefieldViewport, page, { deltaX: 360, deltaY: 0 });
        await expectLocatorInsideViewport(firstBase, '回到可操作位置后的第 1 个基地', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(talentMinion, '回到可操作位置后的天赋随从', viewport!.width, viewport!.height);

        const exitFabBoxBeforeOpen = await exitFabVisual.boundingBox();
        expect(exitFabBoxBeforeOpen, 'exit FAB 打开前应提供尺寸').not.toBeNull();

        await exitFabButton.click();
        await expect(exitFabPanel).toBeVisible({ timeout: 5000 });
        await expectLocatorInsideViewport(exitFabPanel, 'exit fab panel', viewport!.width, viewport!.height);
        const exitFabPanelButtons = exitFabPanel.locator('button');
        await waitForFabPanelStable(exitFabPanel, exitFabVisual, exitFabPanelButtons, 'exit fab panel');
        const exitFabBoxAfterOpen = await exitFabVisual.boundingBox();
        expect(exitFabBoxAfterOpen, 'exit FAB 打开后应仍可见').not.toBeNull();
        expect(
            Math.abs((exitFabBoxAfterOpen?.x ?? 0) - (exitFabBoxBeforeOpen?.x ?? 0)),
            'exit FAB 打开后不应横向漂移',
        ).toBeLessThan(3);
        expect(
            Math.abs((exitFabBoxAfterOpen?.y ?? 0) - (exitFabBoxBeforeOpen?.y ?? 0)),
            'exit FAB 打开后不应纵向漂移',
        ).toBeLessThan(3);

        const hasExitFabSheet = await exitFabSheet.isVisible().catch(() => false);
        if (hasExitFabSheet) {
            const exitFabDocumentMetrics = await page.evaluate(() => ({
                htmlOverflowY: window.getComputedStyle(document.documentElement).overflowY,
                bodyOverflowY: window.getComputedStyle(document.body).overflowY,
                htmlOverscrollBehaviorY: window.getComputedStyle(document.documentElement).overscrollBehaviorY,
                bodyOverscrollBehaviorY: window.getComputedStyle(document.body).overscrollBehaviorY,
            }));
            expect(exitFabDocumentMetrics.htmlOverflowY, 'exit fab sheet 打开时 html 不应继续可滚动').toBe('hidden');
            expect(exitFabDocumentMetrics.bodyOverflowY, 'exit fab sheet 打开时 body 不应继续可滚动').toBe('hidden');
            expect(exitFabDocumentMetrics.htmlOverscrollBehaviorY, 'exit fab sheet 打开时 html 不应继续透传滚动').toBe('none');
            expect(exitFabDocumentMetrics.bodyOverscrollBehaviorY, 'exit fab sheet 打开时 body 不应继续透传滚动').toBe('none');
        }
        expect(hasExitFabSheet, 'exit FAB 在移动端横屏应以内嵌 popover 展示，不应出现独立 sheet').toBeFalsy();
        const exitFabPanelMetrics = await exitFabPanel.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
        }));
        expect(exitFabPanelMetrics.scrollWidth, 'exit fab panel 不应出现横向内容溢出').toBeLessThanOrEqual(exitFabPanelMetrics.clientWidth + 1);
        expect(exitFabPanelMetrics.scrollHeight, 'exit fab panel should not rely on internal scrolling').toBeLessThanOrEqual(exitFabPanelMetrics.clientHeight + 1);
        const exitFabPanelButtonCount = await exitFabPanelButtons.count();
        expect(exitFabPanelButtonCount, 'exit fab panel should expose at least one action button').toBeGreaterThan(0);
        for (let index = 0; index < exitFabPanelButtonCount; index += 1) {
            const panelButton = exitFabPanelButtons.nth(index);
            await expect(panelButton).toBeVisible();
            await expect(panelButton).toBeEnabled();
            await expectLocatorInsideViewport(panelButton, `exit fab panel button ${index + 1}`, viewport!.width, viewport!.height);
        }
        await game.screenshot('04a-mobile-exit-fab-panel', testInfo);
        if (hasExitFabSheet && await exitFabSheetBackdrop.isVisible().catch(() => false)) {
            await exitFabSheetBackdrop.click();
        } else {
            await exitFabButton.click();
        }
        await expect(exitFabPanel).toHaveCount(0);
        if (hasExitFabSheet) {
            await expect(exitFabSheet).toHaveCount(0);
        }
        await expect(exitFabTooltip).toHaveCount(0);
        await page.mouse.move(12, 12);
        await expect(exitFabTooltip).toHaveCount(0);

        await firstBase.click();
        await expect(magnifyOverlay).toHaveCount(0);

        await clickCenter(talentMinion, page);
        await expect(talentMinion).toHaveAttribute('data-expanded', 'true');
        await expect(talentMinion).toHaveAttribute('data-attached-actions-visible', 'true');
        await expect(talentMinion).toHaveAttribute('data-activation-armed', 'true');
        await expect(attachedActionCard).toBeVisible({ timeout: 5000 });
        await expect(attachedActionTalentCard).toBeVisible({ timeout: 5000 });
        const mobileTalentMinionBox = await talentMinion.boundingBox();
        const mobileAttachedActionBox = await attachedActionCard.boundingBox();
        expect(mobileTalentMinionBox, '移动端宿主随从应提供尺寸').not.toBeNull();
        expect(mobileAttachedActionBox, '移动端附着行动卡应提供尺寸').not.toBeNull();
        expect(
            mobileAttachedActionBox!.width,
            '移动端附着行动卡宽度应至少达到宿主随从宽度的一半，避免过小',
        ).toBeGreaterThan((mobileTalentMinionBox?.width ?? 0) * 0.45);
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(false);
        await expect(magnifyOverlay).toHaveCount(0);

        await game.screenshot('05-mobile-single-tap-expands-attached-actions', testInfo);

        await clickCenter(talentMinion, page);
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(true);
        await expect(talentMinion).toHaveAttribute('data-attached-actions-visible', 'true');
        await expect(talentMinion).toHaveAttribute('data-activation-armed', 'false');

        await game.screenshot('06-mobile-second-tap-uses-talent', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].ongoingActions.find((action: any) => action.uid === 'p0-b0-base-ongoing-talent-mobile')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(false);
        await clickCenter(baseOngoingTalentCard, page);
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].ongoingActions.find((action: any) => action.uid === 'p0-b0-base-ongoing-talent-mobile')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(true);
        await expect(magnifyOverlay).toHaveCount(0);
        await game.screenshot('06a-mobile-base-ongoing-talent-single-tap-uses-talent', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            const host = state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego');
            return host?.attachedActions?.find((action: any) => action.uid === 'p0-b0-armor-stego-attached-talent')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(false);
        await clickCenter(attachedActionTalentCard, page);
        await expect.poll(async () => {
            const state = await game.getState();
            const host = state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego');
            return host?.attachedActions?.find((action: any) => action.uid === 'p0-b0-armor-stego-attached-talent')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(true);
        await expect(magnifyOverlay).toHaveCount(0);
        await game.screenshot('06aa-mobile-attached-action-talent-single-tap-uses-talent', testInfo);

        await clickCenter(baseOngoingCard, page);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('06ab-mobile-base-ongoing-single-tap-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await clickCenter(attachedActionCard, page);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('06b-mobile-attached-action-single-tap-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(talentMinion, page, 1);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('07-mobile-minion-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(secondBase, page, 2);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('08-mobile-base-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(baseOngoingCard, page, 3);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('09-mobile-base-ongoing-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(attachedActionCard, page, 4);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('10-mobile-attached-action-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await inspectButton.dispatchEvent('click');
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('11-mobile-hand-inspect-button-magnify', testInfo);
        await closeMagnifyOverlay(page);

        const stateAfterLongPress = await game.getState();
        expect(stateAfterLongPress.core.players['0'].hand.some((card: any) => card.uid === 'p0-mobile-hand-terraform')).toBe(true);
        expect(stateAfterLongPress.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego')?.talentUsed).toBe(true);

        await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
        await page.waitForFunction(() => window.innerWidth === 1920 && window.innerHeight === 1080, {
            timeout: 5000,
            polling: 100,
        });
        await waitForSmashUpMainUiReady(page);
        await expect(battlefieldViewport).toHaveAttribute('data-battlefield-zoom-enabled', 'false');
        await expect(battlefieldViewport).toHaveAttribute('data-battlefield-touch-mode', 'native-pan');

        const desktopViewport = page.viewportSize();
        expect(desktopViewport).not.toBeNull();
        await expect(endTurnActionButton).toBeVisible({ timeout: 5000 });
        await expect(endTurnHints).toBeVisible({ timeout: 5000 });
        await expect(scoreboardPanel).toBeVisible({ timeout: 5000 });
        await expect(turnTracker).toBeVisible({ timeout: 5000 });
        await expect(titanRail).toBeVisible({ timeout: 5000 });
        await expect(scoreboardVisibilityToggle).toBeVisible({ timeout: 5000 });
        await expectLocatorInsideViewport(scoreboardVisibilityToggle, 'PC 记分板隐藏按钮', desktopViewport!.width, desktopViewport!.height);

        await scoreboardVisibilityToggle.click();
        await expect(endTurnActionButton).toHaveCount(0);
        await expect(endTurnHints).toHaveCount(0);
        await expect(scoreboardPanel).toHaveCount(0);
        await expect(turnTracker).toHaveCount(0);
        await expect(handArea).toHaveCount(0);
        await expect(titanRail).toBeVisible({ timeout: 5000 });
        await expect(scoreboardVisibilityToggle).toBeVisible({ timeout: 5000 });

        await scoreboardVisibilityToggle.click();
        await expect(endTurnActionButton).toBeVisible({ timeout: 5000 });
        await expect(endTurnHints).toBeVisible({ timeout: 5000 });
        await expect(scoreboardPanel).toBeVisible({ timeout: 5000 });
        await expect(turnTracker).toBeVisible({ timeout: 5000 });
        await expect(handArea).toBeVisible({ timeout: 5000 });
        await expect(titanRail).toBeVisible({ timeout: 5000 });
        await game.screenshot('13-desktop-end-turn-restored', testInfo);

        await scoreboardVisibilityToggle.click();
        await expect(scoreboardPanel).toHaveCount(0);
        await expect(turnTracker).toHaveCount(0);
        await expect(endTurnActionButton).toHaveCount(0);
        await expect(titanRail).toBeVisible({ timeout: 5000 });
        await expect(scoreboardVisibilityToggle).toBeVisible({ timeout: 5000 });

        await scoreboardVisibilityToggle.click();
        await expect(scoreboardPanel).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(260);
        await game.screenshot('13a-desktop-scoreboard-restored', testInfo);
    });

    test('PC 基地 ongoing 天赋高亮时不显示放大镜且力量徽章同层摇晃', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
        await game.openTestGame('smashup', {
            numPlayers: 4,
            skipInitialization: true,
        });
        await game.setupScene(buildDesktopBaseOngoingTalentScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 1920
                && window.innerHeight === 1080
                && state?.sys?.phase === 'playCards'
                && (state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'p0-mobile-hand-locals') ?? false)
                && (state?.core?.bases?.[0]?.ongoingActions?.some((card: any) => card.uid === 'p0-b0-base-ongoing-talent') ?? false);
        }, { timeout: 10000, polling: 200 });

        await waitForSmashUpMainUiReady(page);

        const ongoingCard = page.locator('[data-ongoing-uid="p0-b0-base-ongoing-talent"]');
        const ongoingCardShell = ongoingCard.locator('xpath=..');
        const powerBadge = page.getByTestId('su-base-ongoing-power-badge-p0-b0-base-ongoing-talent');
        const counterBadge = page.getByTestId('su-base-ongoing-power-counter-p0-b0-base-ongoing-talent');

        await expect(ongoingCard).toBeVisible({ timeout: 15000 });
        await expect(powerBadge).toBeVisible({ timeout: 15000 });
        await expect(counterBadge).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-ongoing-magnify-p0-b0-base-ongoing-talent')).toHaveCount(0);
        await saveEvidenceLocatorScreenshot(
            page,
            ongoingCardShell,
            testInfo,
            'smashup',
            'smashup-desktop-base-ongoing-talent-hover.png',
        );

        const getBadgeOffset = async () => {
            const [powerBox, counterBox] = await Promise.all([powerBadge.boundingBox(), counterBadge.boundingBox()]);
            expect(powerBox, '力量增加徽章应提供尺寸').not.toBeNull();
            expect(counterBox, '力量指示物徽章应提供尺寸').not.toBeNull();
            return {
                dx: ((counterBox?.x ?? 0) + (counterBox?.width ?? 0) / 2) - ((powerBox?.x ?? 0) + (powerBox?.width ?? 0) / 2),
                dy: ((counterBox?.y ?? 0) + (counterBox?.height ?? 0) / 2) - ((powerBox?.y ?? 0) + (powerBox?.height ?? 0) / 2),
            };
        };

        const firstOffset = await getBadgeOffset();
        await page.waitForTimeout(260);
        const secondOffset = await getBadgeOffset();

        expect(
            Math.abs(secondOffset.dx - firstOffset.dx),
            `两个徽章横向相对位移不应在摇晃时脱层（before=${firstOffset.dx}, after=${secondOffset.dx}）`,
        ).toBeLessThan(3);
        expect(
            Math.abs(secondOffset.dy - firstOffset.dy),
            `两个徽章纵向相对位移不应在摇晃时脱层（before=${firstOffset.dy}, after=${secondOffset.dy}）`,
        ).toBeLessThan(3);
        await saveEvidenceLocatorScreenshot(
            page,
            ongoingCardShell,
            testInfo,
            'smashup',
            'smashup-desktop-base-ongoing-talent-highlight.png',
        );
    });

    test('移动端横屏 pinch 后仍可拖拽战场，避免 pan 锁死回归', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 4,
            skipInitialization: true,
        });
        await game.setupScene(buildFourPlayerMobileScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 800
                && window.innerHeight === 450
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && (state?.core?.players?.['0']?.hand?.length ?? 0) === 2;
        }, { timeout: 10000, polling: 200 });

        await waitForSmashUpMainUiReady(page);

        const battlefieldViewport = page.locator('[data-testid="su-battlefield-viewport"]');
        const secondBase = page.locator('[data-base-index="1"]');
        const endTurnActionButton = page.locator('[data-testid="su-end-turn-action-button"]');

        await expect(battlefieldViewport).toBeVisible({ timeout: 15000 });
        await expect(secondBase).toBeVisible({ timeout: 15000 });
        await expect(endTurnActionButton).toBeVisible({ timeout: 15000 });

        await pinchZoomTouch(battlefieldViewport, page, { startDistance: 120, endDistance: 260 });

        await expect
            .poll(async () => Number(await battlefieldViewport.getAttribute('data-battlefield-zoom-scale')), {
                timeout: 5000,
                message: '双指缩放后战场应进入大于 1 的缩放态',
            })
            .toBeGreaterThan(1.15);
        await expect(battlefieldViewport).toHaveAttribute('data-battlefield-touch-mode', 'gesture-lock');

        const translateXBeforePan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
        const secondBaseBoxBeforePan = await secondBase.boundingBox();
        const endTurnButtonBoxBeforePan = await endTurnActionButton.boundingBox();
        expect(secondBaseBoxBeforePan, '拖拽前的基地应提供尺寸').not.toBeNull();
        expect(endTurnButtonBoxBeforePan, '拖拽前的结束回合按钮应提供尺寸').not.toBeNull();

        await panTouch(battlefieldViewport, page, { deltaX: -140, deltaY: 0 });

        let translateXAfterPan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
        let secondBaseBoxAfterPan = await secondBase.boundingBox();
        let endTurnButtonBoxAfterPan = await endTurnActionButton.boundingBox();
        expect(secondBaseBoxAfterPan, '拖拽后的基地应提供尺寸').not.toBeNull();
        expect(endTurnButtonBoxAfterPan, '拖拽后的结束回合按钮应提供尺寸').not.toBeNull();

        let battlefieldMoved =
            Math.abs(translateXAfterPan - translateXBeforePan) > 8
            && Math.abs((secondBaseBoxAfterPan?.x ?? 0) - (secondBaseBoxBeforePan?.x ?? 0)) > 8;

        if (!battlefieldMoved) {
            await panTouch(battlefieldViewport, page, { deltaX: 180, deltaY: 0 });
            const translateXAfterReversePan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
            const secondBaseBoxAfterReversePan = await secondBase.boundingBox();
            const endTurnButtonBoxAfterReversePan = await endTurnActionButton.boundingBox();
            expect(secondBaseBoxAfterReversePan, '反向拖拽后的基地应提供尺寸').not.toBeNull();
            expect(endTurnButtonBoxAfterReversePan, '反向拖拽后的结束回合按钮应提供尺寸').not.toBeNull();

            battlefieldMoved =
                Math.abs(translateXAfterReversePan - translateXAfterPan) > 8
                && Math.abs((secondBaseBoxAfterReversePan?.x ?? 0) - (secondBaseBoxAfterPan?.x ?? 0)) > 8;

            translateXAfterPan = translateXAfterReversePan;
            secondBaseBoxAfterPan = secondBaseBoxAfterReversePan;
            endTurnButtonBoxAfterPan = endTurnButtonBoxAfterReversePan;
        }

        expect(
            battlefieldMoved,
            'pinch 后拖拽不应锁死；若首个方向已被边界夹紧，反向拖拽也应继续带动战场',
        ).toBeTruthy();
        expect(
            Math.abs((endTurnButtonBoxAfterPan?.x ?? 0) - (endTurnButtonBoxBeforePan?.x ?? 0)),
            '外围结束回合按钮不应随战场横向漂移',
        ).toBeLessThan(4);
        expect(
            Math.abs((endTurnButtonBoxAfterPan?.y ?? 0) - (endTurnButtonBoxBeforePan?.y ?? 0)),
            '外围结束回合按钮不应随战场纵向漂移',
        ).toBeLessThan(4);

        await game.screenshot('04f-mobile-battlefield-pan-still-works-after-pinch', testInfo);
    });

    test('移动端横屏 Chromium 真实多触点 pinch/pan 事件链路应正常驱动战场缩放', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 4,
            skipInitialization: true,
        });
        await game.setupScene(buildFourPlayerMobileScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 800
                && window.innerHeight === 450
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && (state?.core?.players?.['0']?.hand?.length ?? 0) === 2;
        }, { timeout: 10000, polling: 200 });

        await waitForSmashUpMainUiReady(page);

        const battlefieldViewport = page.locator('[data-testid="su-battlefield-viewport"]');
        const secondBase = page.locator('[data-base-index="1"]');

        await expect(battlefieldViewport).toBeVisible({ timeout: 15000 });
        await expect(secondBase).toBeVisible({ timeout: 15000 });
        await installBattlefieldGestureProbe(page);

        const gestureEnvironment = await page.evaluate(() => {
            const viewport = document.querySelector<HTMLElement>('[data-testid="su-battlefield-viewport"]');
            const contentRoot = viewport?.querySelector<HTMLElement>('.mobile-battlefield-viewport__content-root');
            return {
                viewportTouchAction: viewport ? window.getComputedStyle(viewport).touchAction : null,
                contentRootTouchAction: contentRoot ? window.getComputedStyle(contentRoot).touchAction : null,
                maxTouchPoints: navigator.maxTouchPoints,
                hasPointerEvent: typeof PointerEvent !== 'undefined',
                zoomMode: viewport?.getAttribute('data-battlefield-zoom-target-mode'),
            };
        });

        await pinchZoomTouchChromium(battlefieldViewport, page, { startDistance: 120, endDistance: 260 });

        const scaleAfterPinch = Number(await battlefieldViewport.getAttribute('data-battlefield-zoom-scale'));
        const translateXBeforePan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
        const logsAfterPinch = await readBattlefieldGestureProbe(page);
        console.log('[DEBUG][smashup-real-touch-pinch]', JSON.stringify({
            gestureEnvironment,
            scaleAfterPinch,
            tail: logsAfterPinch.slice(-40),
        }, null, 2));

        expect(gestureEnvironment.viewportTouchAction, 'viewport 应显式禁用浏览器默认触摸手势').toBe('none');
        expect(
            logsAfterPinch.some((entry) => entry.type === 'pointerdown' || entry.type === 'touchstart'),
            '真实多触点注入后至少应命中 pointerdown/touchstart 事件',
        ).toBeTruthy();
        expect(scaleAfterPinch, 'Chromium 真实多触点 pinch 后战场应进入大于 1 的缩放态').toBeGreaterThan(1.15);

        await panTouchChromium(battlefieldViewport, page, { deltaX: -140, deltaY: 0 });

        let translateXAfterPan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
        let logsAfterPan = await readBattlefieldGestureProbe(page);
        console.log('[DEBUG][smashup-real-touch-pan]', JSON.stringify({
            translateXBeforePan,
            translateXAfterPan,
            tail: logsAfterPan.slice(-40),
        }, null, 2));

        let battlefieldMoved = Math.abs(translateXAfterPan - translateXBeforePan) > 8;
        if (!battlefieldMoved) {
            await panTouchChromium(battlefieldViewport, page, { deltaX: 180, deltaY: 0 });
            const translateXAfterReversePan = Number(await battlefieldViewport.getAttribute('data-battlefield-translate-x'));
            const reverseLogs = await readBattlefieldGestureProbe(page);
            console.log('[DEBUG][smashup-real-touch-pan-reverse]', JSON.stringify({
                translateXAfterPan,
                translateXAfterReversePan,
                tail: reverseLogs.slice(-40),
            }, null, 2));
            battlefieldMoved = Math.abs(translateXAfterReversePan - translateXAfterPan) > 8;
            translateXAfterPan = translateXAfterReversePan;
            logsAfterPan = reverseLogs;
        }

        expect(
            battlefieldMoved,
            'Chromium 真实多触点 pinch 后单指 pan 不应锁死；若首个方向已被边界夹紧，反向拖拽也应继续驱动位移',
        ).toBeTruthy();

        await game.screenshot('04g-mobile-battlefield-real-touch-pinch-pan', testInfo);
    });

    test('手牌超限时继续按钮应保持与结束回合同款白色描边', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await setChineseLocale(page.context());
        await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildDiscardOverflowScene());

        await waitForSmashUpMainUiReady(page);

        const continueButton = page.getByRole('button', { name: /^继续$/ });
        await expect(continueButton).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/你需要丢弃 1 张牌以继续游戏/i)).toBeVisible({ timeout: 10000 });
        await expect(continueButton).toHaveAttribute('class', /border-white\/95/);
        await expect(continueButton).toHaveAttribute('class', /ring-white\/55/);

        await game.screenshot('14-discard-continue-border-restored', testInfo);
    });

    test('移动端不会把没有+1力量指示物的怪物当成可发动天赋', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 812, height: 375 });
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 2,
            skipInitialization: true,
        });
        await game.setupScene(buildMonsterWithoutCountersMobileScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 812
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && state?.core?.bases?.[0]?.minions?.[0]?.uid === 'p0-monster-no-counter';
        }, { timeout: 10000, polling: 200 });

        const monster = page.locator('[data-minion-uid="p0-monster-no-counter"]');

        await expect(monster).toBeVisible({ timeout: 15000 });
        await expect(monster).toHaveAttribute('data-expanded', 'false');
        await expect(monster).toHaveAttribute('data-activation-armed', 'false');

        await clickCenter(monster, page);

        await expect(monster).toHaveAttribute('data-expanded', 'false');
        await expect(monster).toHaveAttribute('data-activation-armed', 'false');
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-monster-no-counter')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(false);

        await game.screenshot('12-monster-without-counter-does-not-arm-talent', testInfo);
    });

    test('移动端有+1力量指示物的怪物发动天赋后会移除指示物并提示额外随从机会', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 812, height: 375 });
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 2,
            skipInitialization: true,
        });
        await game.setupScene(buildMonsterWithCounterMobileScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 812
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && state?.core?.bases?.[0]?.minions?.[0]?.uid === 'p0-monster-with-counter';
        }, { timeout: 10000, polling: 200 });

        const monster = page.locator('[data-minion-uid="p0-monster-with-counter"]');
        const monsterFrame = monster.locator('xpath=./div').first();

        await expect(monster).toBeVisible({ timeout: 15000 });
        await expect(monster).toContainText('+1');
        await expect(monster).toHaveAttribute('data-activation-armed', 'false');
        await expect
            .poll(async () => await monsterFrame.getAttribute('class'))
            .toContain('ring-2');
        await expect
            .poll(async () => await monsterFrame.getAttribute('class'))
            .toMatch(/ring-(green|amber)-400/);
        await game.screenshot('12-monster-with-counter-before-activation', testInfo);
        await saveEvidenceLocatorScreenshot(
            page,
            monster,
            testInfo,
            'smashup-4p-layout-test.e2e/移动端有+1力量指示物的怪物发动天赋后会移除指示物并提示额外随从机会',
            '12a-monster-with-counter-card-before-activation.png',
        );

        await clickCenter(monster, page);
        await expect(monster).toHaveAttribute('data-expanded', 'true');
        await expect(monster).toHaveAttribute('data-activation-armed', 'true');
        await expect(page.getByText(/再次点击(?:发动|以激活)/)).toBeVisible({ timeout: 5000 });

        await clickCenter(monster, page);

        await expect.poll(async () => {
            const state = await game.getState();
            const player = state.core.players['0'];
            return {
                powerCounters: state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-monster-with-counter')?.powerCounters ?? -1,
                talentUsed: state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-monster-with-counter')?.talentUsed ?? false,
                minionLimit: player.minionLimit,
            };
        }, { timeout: 5000 }).toEqual({
            powerCounters: 0,
            talentUsed: true,
            minionLimit: 2,
        });

        await expect(page.getByText('获得1次额外随从机会')).toBeVisible({ timeout: 5000 });

        await expect(monster).toHaveAttribute('data-activation-armed', 'false');
        await expect(monster.getByText('已用', { exact: true })).toBeVisible();
        await page.waitForTimeout(250);
        await game.screenshot('13-monster-with-counter-grants-extra-minion-and-shows-used-state', testInfo);
    });
});

test.describe('大杀四方移动端派系选择布局', () => {
    test('横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 852, height: 393 });
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => { },
                    removeListener: () => { },
                    addEventListener: () => { },
                    removeEventListener: () => { },
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildFactionSelectionMobileScene());

        const factionSelect = page.locator('[data-tutorial-id="su-faction-select"]');
        const factionHeading = page.getByText(/Draft Your Factions|选择你的派系/i);
        const aliensCard = factionSelect.getByText(/Aliens|外星人/i).first();
        const piratesCard = factionSelect.getByText(/Pirates|海盗/i).first();
        const rotateBanner = page.getByText(/建议旋转至横屏|建议切换为竖屏/i);
        const detailBackdrop = page.getByTestId('faction-detail-backdrop');
        const closeButton = page.getByTestId('faction-detail-close');

        await expect(factionHeading).toBeVisible({ timeout: 15000 });
        await expect(rotateBanner).toHaveCount(0);
        await expect(aliensCard).toBeVisible({ timeout: 10000 });
        await expect(piratesCard).toBeVisible({ timeout: 10000 });
        await piratesCard.click();

        const confirmButton = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
        const detailPanel = page.getByTestId('faction-detail-panel');
        const previewGrid = page.getByTestId('faction-preview-grid');
        const previewCards = page.getByTestId('faction-preview-card');
        const previewSection = previewGrid.locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
        const titanSection = page.getByTestId('faction-titan-section');
        const titanCards = page.getByTestId('faction-titan-card');

        await expect(confirmButton).toBeVisible({ timeout: 10000 });
        await expect(detailPanel).toBeVisible({ timeout: 10000 });
        await expect(titanSection).toBeVisible({ timeout: 10000 });
        await expect(titanCards).toHaveCount(1);
        await expect(aliensCard).toBeVisible({ timeout: 10000 });
        const previewCardCount = await previewCards.count();
        expect(previewCardCount).toBeGreaterThan(8);
        await expect(previewSection).toBeVisible({ timeout: 10000 });

        const detailPanelRect = await detailPanel.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
            };
        });
        const viewportSize = page.viewportSize();
        expect(viewportSize).not.toBeNull();
        const viewportWidth = viewportSize?.width ?? 852;
        const viewportHeight = viewportSize?.height ?? 393;
        expect(
            detailPanelRect.width,
            '移动端派系详情宽度不能明显小于 PC 同构效果，至少应占横屏视口宽度的 55%',
        ).toBeGreaterThanOrEqual(viewportWidth * 0.55);
        expect(
            detailPanelRect.width,
            '移动端派系详情宽度不能比 PC 同构效果更大，超过横屏视口宽度的 70% 视为放大过度',
        ).toBeLessThanOrEqual(viewportWidth * 0.7);
        expect(
            detailPanelRect.height,
            '移动端派系详情高度不能再缩成小海报，至少应占横屏视口高度的 60%',
        ).toBeGreaterThanOrEqual(viewportHeight * 0.6);
        expect(
            detailPanelRect.height,
            '移动端派系详情高度不能过高到接近铺满整屏，超过横屏视口高度的 90% 视为偏离 PC 主态',
        ).toBeLessThanOrEqual(viewportHeight * 0.9);
        expect(detailPanelRect.left).toBeGreaterThanOrEqual(0);
        expect(detailPanelRect.right).toBeLessThanOrEqual(viewportWidth);
        expect(detailPanelRect.top).toBeGreaterThanOrEqual(0);
        expect(detailPanelRect.bottom).toBeLessThanOrEqual(viewportHeight);

        const scrollMetrics = await previewSection.evaluate((node) => ({
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
        }));
        expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

        await page.waitForTimeout(250);
        await game.screenshot('11-mobile-landscape-faction-detail-top', testInfo);

        await previewCards.last().scrollIntoViewIfNeeded();
        await expect(previewCards.last()).toBeVisible({ timeout: 5000 });

        await game.screenshot('12-mobile-landscape-faction-detail-bottom', testInfo);

        await expect(detailBackdrop).toBeVisible({ timeout: 5000 });
        await detailBackdrop.click({ position: { x: 24, y: 24 } });
        await expect(page.getByTestId('faction-detail-panel')).toHaveCount(0);
        await game.screenshot('12a-mobile-landscape-faction-detail-blank-close', testInfo);

        await piratesCard.click();
        await expect(closeButton).toBeVisible({ timeout: 5000 });
        await closeButton.click();
        await expect(page.getByTestId('faction-detail-panel')).toHaveCount(0);

        await aliensCard.click();
        await expect(page.getByTestId('faction-titan-empty')).toContainText(/该种族泰坦暂未接入|Titan/i);
        await game.screenshot('13-mobile-landscape-faction-detail-no-titan', testInfo);
    });

    test('PC 已选派系可取消并重新选择', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await setChineseLocale(page.context());
        await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildFactionSelectionWithOwnedPickScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'factionSelect'
                && state?.core?.turnOrder?.[state.core.currentPlayerIndex] === '0'
                && Array.isArray(state?.core?.factionSelection?.playerSelections?.['0'])
                && state.core.factionSelection.playerSelections['0'][0] === 'pirates';
        }, { timeout: 10000, polling: 200 });

        const piratesCard = page.getByTestId('faction-option-pirates');
        const aliensCard = page.getByTestId('faction-option-aliens');
        const cancelButton = page.getByTestId('faction-cancel-button');
        const confirmButton = page.getByTestId('faction-confirm-button');

        await expect(piratesCard).toBeVisible({ timeout: 10000 });
        await piratesCard.click();

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const picks = state?.core?.factionSelection?.playerSelections?.['0'] ?? [];
            const currentPlayerId = state?.core?.turnOrder?.[state.core.currentPlayerIndex];
            return Array.isArray(picks) && picks.length === 0 && currentPlayerId === '0';
        }, { timeout: 10000, polling: 200 });
        await game.screenshot('16-desktop-faction-direct-cancel', testInfo);

        await aliensCard.click();
        await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });
        await expect(confirmButton).toBeVisible({ timeout: 10000 });
        await confirmButton.click();

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const picks = state?.core?.factionSelection?.playerSelections?.['0'] ?? [];
            const currentPlayerId = state?.core?.turnOrder?.[state.core.currentPlayerIndex];
            return Array.isArray(picks) && picks.length === 1 && picks[0] === 'aliens' && currentPlayerId === '1';
        }, { timeout: 10000, polling: 200 });

        await game.screenshot('19-desktop-faction-cancel-after', testInfo);
    });
});
