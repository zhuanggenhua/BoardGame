import {
    expect,
    test,
    type Browser,
    type BrowserContext,
    type BrowserContextOptions,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import * as fs from 'node:fs';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import {
    attachPageDiagnostics,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForFrontendAssets,
    waitForMatchAvailable,
} from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { ARENA_ZONE_IDS, MAGE_IDS, type ArenaZoneId, type MageId } from '../../src/games/mage-wars/domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore } from '../../src/games/mage-wars/domain';

type MageWarsOnlineMatch = {
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    hostPage: Page;
    guestPage: Page;
    matchId: string;
    hostCredentials: string;
    guestCredentials: string;
};

type PageDiagnostics = ReturnType<typeof attachPageDiagnostics>;
type JsonRecord = Record<string, unknown>;
type MageWarsFxKind = 'attack' | 'push' | 'teleport';

const TEST_API_TOKEN_FILE = 'temp/e2e/shared-test-api-token.txt';
const SELF_PREPARED_CARD_SELECTOR = '[data-mage-wars-prepared-card="self"]';
type EvidenceScreenshotAnimationMode = 'allow' | 'disabled';

async function saveEvidenceScreenshot(
    page: Page,
    testInfo: TestInfo,
    name: string,
    options: { animations?: EvidenceScreenshotAnimationMode } = {},
) {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({
        path,
        fullPage: false,
        animations: options.animations ?? 'disabled',
        timeout: 10_000,
    }));
    testInfo.annotations.push({
        type: 'evidence-screenshot',
        description: path,
    });
}

const ATTACHMENT_TYPE_LABEL_TEXTS = ['装备', '结界', 'Equipment', 'Enchantment', 'Enchantments', 'Ongoing', 'Attached'];

async function expectNoExternalAttachmentTypeLabel(attachment: Locator) {
    const externalLabels = await attachment.evaluate((element, labelTexts) => {
        const candidates = Array.from(element.children)
            .filter((child) => child.getAttribute('data-card-atlas-frame') !== 'true')
            .map((child) => child.textContent?.replace(/\s+/g, ' ').trim() ?? '')
            .filter(Boolean);

        return candidates.filter((text) => labelTexts.includes(text));
    }, ATTACHMENT_TYPE_LABEL_TEXTS);

    expect(externalLabels).toEqual([]);
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickFields(source: unknown, keys: string[]): JsonRecord {
    if (!isRecord(source)) return {};
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function resolveTestApiToken(): string | null {
    const envToken = process.env.TEST_API_TOKEN?.trim();
    if (envToken) return envToken;
    try {
        const fileToken = fs.readFileSync(TEST_API_TOKEN_FILE, 'utf-8').trim();
        return fileToken.length > 0 ? fileToken : null;
    } catch {
        return null;
    }
}

async function readVisibleToastMessages(page: Page): Promise<string[]> {
    return page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('.pointer-events-none .pointer-events-auto'),
    )
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((text) => text.length > 0));
}

async function readServerCoreSnapshot(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
) {
    const token = resolveTestApiToken();
    if (!token) return { error: `missing test api token: ${TEST_API_TOKEN_FILE}` };

    const credentials = playerId === '0' ? match.hostCredentials : match.guestCredentials;
    const response = await page.request.get(`${getGameServerBaseURL()}/test/get-state/${match.matchId}`, {
        headers: {
            'x-test-token': token,
            'x-test-player-id': playerId,
            'x-test-player-credentials': credentials,
        },
    });
    const payload = await response.json().catch(async () => ({
        text: await response.text().catch(() => ''),
    })) as unknown;
    if (!response.ok()) {
        return {
            error: `test state api failed: ${response.status()}`,
            payload,
        };
    }

    const payloadRecord = isRecord(payload) ? payload : {};
    const state = isRecord(payloadRecord.state) ? payloadRecord.state : {};
    const core = isRecord(state.core) ? state.core : {};
    const sys = isRecord(state.sys) ? state.sys : {};
    const players = isRecord(core.players) ? core.players : {};
    const objects = isRecord(core.objects) ? core.objects : {};
    const arena = Array.isArray(core.arena) ? core.arena : [];
    const eventStream = isRecord(sys.eventStream) ? sys.eventStream : {};
    const eventEntries = Array.isArray(eventStream.entries) ? eventStream.entries : [];

    return {
        stateID: payloadRecord._stateID,
        sys: pickFields(sys, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber']),
        core: pickFields(core, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber']),
        players: Object.fromEntries(Object.entries(players).map(([id, player]) => [
            id,
            pickFields(player, [
                'mageId',
                'mageZoneId',
                'mana',
                'life',
                'damage',
                'actionReady',
                'quickcastReady',
                'preparedSpellCardIds',
                'discardPileCardIds',
                'guarding',
            ]),
        ])),
        objects: Object.fromEntries(Object.entries(objects).map(([id, object]) => [
            id,
            pickFields(object, [
                'ownerId',
                'sourceSpellCardId',
                'zoneId',
                'kind',
                'actionReady',
                'damage',
                'revealed',
                'anchoredToObjectId',
                'anchoredToPlayerId',
                'anchoredToZoneId',
                'restrainedByObjectId',
                'statusTokens',
            ]),
        ])),
        arena: arena.map((zone) => pickFields(zone, ['id', 'occupantIds'])),
        eventStream: eventEntries.slice(-30).map((entry) => {
            const record = isRecord(entry) ? entry : {};
            const event = isRecord(record.event) ? record.event : {};
            const payload = isRecord(event.payload) ? event.payload : {};
            return {
                id: record.id,
                type: event.type,
                payload: pickFields(payload, [
                    'playerId',
                    'spellCardId',
                    'targetObjectId',
                    'targetPlayerId',
                    'targetZoneId',
                    'fromZoneId',
                    'toZoneId',
                    'distance',
                    'diceResults',
                    'effectDieResult',
                    'baseDamage',
                    'actualDamage',
                    'amount',
                ]),
            };
        }),
    };
}

async function collectFailureEvidence(
    page: Page,
    options?: {
        match?: MageWarsOnlineMatch;
        playerId?: '0' | '1';
        diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>;
    },
) {
    const [snapshot, toastMessages, serverSnapshot] = await Promise.all([
        readOnlineBoardSnapshot(page),
        readVisibleToastMessages(page),
        options?.match && options.playerId
            ? readServerCoreSnapshot(page, options.match, options.playerId)
            : Promise.resolve(null),
    ]);

    return {
        snapshot,
        toastMessages,
        serverSnapshot,
        diagnostics: options?.diagnostics?.map(({ label, diagnostics }) => ({
            label,
            errors: diagnostics.errors,
        })) ?? [],
    };
}

type VisibleImageLoadFailure = {
    alt: string | null;
    src: string;
    complete: boolean;
    naturalWidth: number;
    naturalHeight: number;
    rect: { x: number; y: number; width: number; height: number };
    nearestTestId: string | null;
};

async function readVisibleImageLoadFailures(page: Page): Promise<VisibleImageLoadFailure[]> {
    return page.evaluate(() => Array.from(document.images)
        .map((image) => {
            const rect = image.getBoundingClientRect();
            const nearestTestId = image.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
            return {
                alt: image.getAttribute('alt'),
                src: image.currentSrc || image.src,
                complete: image.complete,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                nearestTestId,
            };
        })
        .filter((image) => image.rect.width > 10 && image.rect.height > 10)
        .filter((image) => image.naturalWidth <= 0 || image.naturalHeight <= 0)
        .map((image) => ({
            ...image,
            src: image.src.length > 240 ? `${image.src.slice(0, 237)}...` : image.src,
        })));
}

async function waitForVisibleImagesLoaded(page: Page, label: string) {
    await expect.poll(async () => readVisibleImageLoadFailures(page), {
        message: `${label} Mage Wars 棋盘仍有可见图片没有真实尺寸`,
        timeout: 30_000,
        intervals: [250, 500, 1_000],
    }).toEqual([]);
}

async function openOnlineBoard(page: Page, label: string) {
    await waitForFrontendAssets(page, 45_000);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    const board = page.getByTestId('mage-wars-board');
    await expect(board).toBeVisible({ timeout: 90_000 });
    await expect(board).toContainText('正式竞技场');
    await waitForVisibleImagesLoaded(page, label);
}

async function readPhase(page: Page): Promise<string | null> {
    return page.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase', { timeout: 500 }).catch(() => null);
}

const SIMULTANEOUS_PHASES = new Set(['reset', 'channel', 'upkeep', 'planning']);

async function readOnlineBoardSnapshot(page: Page) {
    const board = page.getByTestId('mage-wars-board');
    const turnEnd = page.getByTestId('mage-wars-turn-end');
    const zones = await page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]'),
    ).map((zone) => ({
        zoneId: zone.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? null,
        legalMove: zone.getAttribute('data-legal-move-zone') === 'true',
        legalTarget: zone.getAttribute('data-legal-target-zone') === 'true',
        fieldCards: Array.from(zone.querySelectorAll<HTMLButtonElement>('[data-testid="mage-wars-zone-field-card"]'))
            .map((card) => ({
                sourceCardId: card.getAttribute('data-source-card-id'),
                objectId: card.getAttribute('data-object-id'),
                disabled: card.disabled,
                ariaLabel: card.getAttribute('aria-label'),
            })),
        mages: Array.from(zone.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-mage-entity"]'))
            .map((mage) => ({
                playerId: mage.getAttribute('data-player-id'),
                ariaLabel: mage.getAttribute('aria-label'),
            })),
    })));
    const preparedCards = await page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('[data-mage-wars-prepared-card="self"]'),
    ).map((card) => ({
        ariaLabel: card.getAttribute('aria-label'),
        sourceCardId: card.getAttribute('data-source-card-id'),
        disabled: card instanceof HTMLButtonElement ? card.disabled : null,
        selected: card.getAttribute('data-selected') === 'true',
        rect: (() => {
            const rect = card.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        })(),
    })));
    return {
        phase: await board.getAttribute('data-mage-wars-phase', { timeout: 1_000 }).catch(() => null),
        currentPlayerId: await board.getAttribute('data-mage-wars-current-player-id', { timeout: 1_000 }).catch(() => null),
        phaseActorId: await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 1_000 }).catch(() => null),
        turnNumber: await board.getAttribute('data-mage-wars-turn-number', { timeout: 1_000 }).catch(() => null),
        readyPlayerIds: await board.getAttribute('data-mage-wars-ready-player-ids', { timeout: 1_000 }).catch(() => null),
        turnEndEnabled: await turnEnd.isEnabled({ timeout: 500 }).catch(() => false),
        turnEndText: await turnEnd.innerText({ timeout: 1_000 }).catch(() => ''),
        preparedCards,
        zones,
    };
}

async function readZoneFieldCardSnapshot(
    page: Page,
    zoneId: string,
    sourceCardId: number,
    contextLabel: string,
) {
    const snapshot = await readOnlineBoardSnapshot(page);
    const zone = snapshot.zones.find((candidate) => candidate.zoneId === zoneId);
    const card = zone?.fieldCards.find((candidate) => candidate.sourceCardId === String(sourceCardId));
    if (!card) {
        throw new Error([
            `${contextLabel} 未在 ${zoneId} 找到 CardID ${sourceCardId}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    }
    return card;
}

async function readHitTest(locator: Locator) {
    return locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(centerX, centerY);
        const hitChain: Array<{
            tagName: string;
            testId: string | null;
            ariaLabel: string | null;
            className: string | null;
            disabled: boolean | null;
        }> = [];
        let current: Element | null = hit;
        while (current && hitChain.length < 6) {
            hitChain.push({
                tagName: current.tagName.toLowerCase(),
                testId: current.getAttribute('data-testid'),
                ariaLabel: current.getAttribute('aria-label'),
                className: typeof (current as HTMLElement).className === 'string'
                    ? (current as HTMLElement).className
                    : null,
                disabled: current instanceof HTMLButtonElement ? current.disabled : null,
            });
            current = current.parentElement;
        }

        return {
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
            center: {
                x: Math.round(centerX),
                y: Math.round(centerY),
            },
            hitChain,
        };
    });
}

type ElementRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
};

type MobileLandscapeHudAudit = {
    viewport: { width: number; height: number };
    mirrorLayer: ElementRect | null;
    selfHud: ElementRect | null;
    opponentHud: ElementRect | null;
    desktopSpellbook: ElementRect | null;
    desktopPrepared: ElementRect | null;
    discardPile: ElementRect | null;
    opponentMirror: ElementRect | null;
    turnEnd: ElementRect | null;
    fabMenu: ElementRect | null;
    compactOpponentMirror: boolean;
    mobileSelfRailCount: number;
    opponentMobileRailCount: number;
};

async function readMobileLandscapeHudAudit(page: Page): Promise<MobileLandscapeHudAudit> {
    return page.evaluate(() => {
        type Rect = {
            x: number;
            y: number;
            width: number;
            height: number;
            right: number;
            bottom: number;
        };
        const toRect = (element: HTMLElement | null): Rect | null => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
            };
        };
        const mirrorLayer = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mobile-desktop-mirror-layer"]'));
        const selfHud = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-self"]'));
        const opponentHud = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-opponent"]'));
        const desktopSpellbook = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-shelf"]'));
        const desktopPrepared = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-spells"]'));
        const discardPile = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-discard-pile"]'));
        const opponentMirrorElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-opponent-prepared-mirror"]');
        const opponentMirror = toRect(opponentMirrorElement);
        const turnEnd = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-turn-end"]'));
        const fabMenu = toRect(document.querySelector<HTMLElement>('[data-testid="fab-menu"]'));

        return {
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            mirrorLayer,
            selfHud,
            opponentHud,
            desktopSpellbook,
            desktopPrepared,
            discardPile,
            opponentMirror,
            turnEnd,
            fabMenu,
            compactOpponentMirror: opponentMirrorElement?.dataset.mageWarsCompact === 'true',
            mobileSelfRailCount: document.querySelectorAll('[data-testid="mage-wars-mobile-self-spell-rail"]').length,
            opponentMobileRailCount: document.querySelectorAll('[data-testid="mage-wars-mobile-opponent-spell-rail"]').length,
        };
    });
}

async function expectMobileLandscapeHudSlots(page: Page, label: string) {
    await expect(page.getByTestId('mage-wars-mobile-desktop-mirror-layer')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mage-hud-self')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mage-hud-opponent')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-desktop-spellbook-shelf')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-desktop-prepared-spells')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-discard-pile')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-turn-end')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('fab-menu')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mobile-self-spell-rail')).toHaveCount(0);
    await expect(page.getByTestId('mage-wars-mobile-opponent-spell-rail')).toHaveCount(0);
    await page.waitForTimeout(150);

    const audit = await readMobileLandscapeHudAudit(page);
    expect(audit.viewport).toEqual({ width: 960, height: 540 });
    expect(audit.mirrorLayer, `${label} 移动横屏必须使用桌面镜像层`).not.toBeNull();
    expect(audit.mirrorLayer!.width, `${label} 桌面镜像层宽度必须铺满视口`).toBe(960);
    expect(audit.mirrorLayer!.height, `${label} 桌面镜像层高度必须铺满视口`).toBe(540);
    expect(audit.selfHud, `${label} 己方法师 HUD 必须沿用桌面承载`).not.toBeNull();
    expect(audit.opponentHud, `${label} 对手法师 HUD 必须沿用桌面承载`).not.toBeNull();
    expect(audit.desktopSpellbook, `${label} 法术书必须沿用桌面承载`).not.toBeNull();
    expect(audit.desktopPrepared, `${label} 已计划法术必须沿用桌面承载`).not.toBeNull();
    expect(audit.discardPile, `${label} 弃牌堆必须沿用桌面承载`).not.toBeNull();
    expect(audit.opponentMirror, `${label} 对手隐藏计划必须沿用桌面承载`).not.toBeNull();
    expect(audit.turnEnd, `${label} 回合结束按钮必须可见`).not.toBeNull();
    expect(audit.fabMenu, `${label} 全局悬浮入口必须参与压力态`).not.toBeNull();
    expect(audit.compactOpponentMirror, `${label} 对手计划不得使用移动端紧凑镜像`).toBe(false);
    expect(audit.mobileSelfRailCount, `${label} 不得渲染移动专用己方法术轨`).toBe(0);
    expect(audit.opponentMobileRailCount, `${label} 不得渲染移动专用对手法术轨`).toBe(0);
}

type MageWarsFxAudit = {
    sourceRow: string | null;
    sourceCol: string | null;
    targetRow: string | null;
    targetCol: string | null;
    hasSourceWake: boolean;
    hasImpact: boolean;
    hasTravel: boolean;
};

type MageWarsSummonFxAudit = {
    objectKind: string | null;
    objectId: string | null;
    visible: boolean;
    canvasWidth: number;
    canvasHeight: number;
    alphaPixels: number;
    brightPixels: number;
};

async function waitForSummonFxVisualAudit(page: Page): Promise<MageWarsSummonFxAudit> {
    const handle = await page.waitForFunction(() => {
        const summon = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-summon"]');
        if (!summon) return null;
        const rect = summon.getBoundingClientRect();
        const canvas = summon.querySelector('canvas');
        if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const sampleWidth = Math.min(canvas.width, 640);
        const sampleHeight = Math.min(canvas.height, 360);
        const offsetX = Math.max(0, Math.floor((canvas.width - sampleWidth) / 2));
        const offsetY = Math.max(0, Math.floor((canvas.height - sampleHeight) / 2));
        const data = ctx.getImageData(offsetX, offsetY, sampleWidth, sampleHeight).data;
        let alphaPixels = 0;
        let brightPixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha <= 10) continue;
            alphaPixels += 1;
            if (alpha > 28 && data[i] + data[i + 1] + data[i + 2] > 360) {
                brightPixels += 1;
            }
        }

        const audit = {
            objectKind: summon.dataset.objectKind ?? null,
            objectId: summon.dataset.objectId ?? null,
            visible: rect.width > 0 && rect.height > 0,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            alphaPixels,
            brightPixels,
        };
        if (!audit.visible || audit.alphaPixels <= 1_500 || audit.brightPixels <= 120) return null;
        return audit;
    }, undefined, { timeout: 5_000 });
    const audit = await handle.jsonValue() as MageWarsSummonFxAudit;
    expect(audit.visible).toBe(true);
    expect(audit.alphaPixels).toBeGreaterThan(1_500);
    expect(audit.brightPixels).toBeGreaterThan(120);
    return audit;
}

async function captureMageWarsSummonFxProcessScreenshot(
    page: Page,
    testInfo: TestInfo,
    label: string,
): Promise<MageWarsSummonFxAudit> {
    const audit = await waitForSummonFxVisualAudit(page);
    await expect(page.getByTestId('mage-wars-fx-summon').first()).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(120);
    await saveEvidenceScreenshot(page, testInfo, `${label}-召唤光柱过程帧`, { animations: 'allow' });
    return audit;
}

async function waitForFxSourceImpactAudit(page: Page, kind: MageWarsFxKind): Promise<MageWarsFxAudit> {
    const impactTestId = resolveFxImpactTestId(kind);
    const handle = await page.waitForFunction(({ fxKind, impactId }) => {
        const travel = document.querySelector<HTMLElement>(`[data-testid="mage-wars-fx-${fxKind}-travel"]`);
        const sourceWake = document.querySelector<HTMLElement>(`[data-testid="mage-wars-fx-${fxKind}-source-wake"]`);
        const impact = document.querySelector<HTMLElement>(`[data-testid="${impactId}"]`);
        if (!sourceWake || !impact) return null;
        return {
            sourceRow: travel?.dataset.sourceRow ?? null,
            sourceCol: travel?.dataset.sourceCol ?? null,
            targetRow: travel?.dataset.targetRow ?? null,
            targetCol: travel?.dataset.targetCol ?? null,
            hasSourceWake: true,
            hasImpact: true,
            hasTravel: Boolean(travel),
        };
    }, { fxKind: kind, impactId: impactTestId }, { timeout: 5_000 });
    const audit = await handle.jsonValue() as MageWarsFxAudit;
    expect(audit.hasSourceWake).toBe(true);
    expect(audit.hasImpact).toBe(true);
    return audit;
}

async function waitForFxTravelAudit(page: Page, kind: MageWarsFxKind) {
    const audit = await waitForFxSourceImpactAudit(page, kind);
    expect(audit.hasTravel).toBe(true);
    expect(audit.sourceRow).toMatch(/^\d+$/);
    expect(audit.sourceCol).toMatch(/^\d+$/);
    expect(audit.targetRow).toMatch(/^\d+$/);
    expect(audit.targetCol).toMatch(/^\d+$/);
    expect(`${audit.sourceRow}:${audit.sourceCol}`).not.toBe(`${audit.targetRow}:${audit.targetCol}`);
    return audit;
}

function resolveFxImpactTestId(kind: MageWarsFxKind): string {
    if (kind === 'push') return 'mage-wars-fx-spell-push';
    if (kind === 'teleport') return 'mage-wars-fx-spell-teleport';
    return 'mage-wars-fx-attack-impact';
}

function resolveFxImpactBurstTestId(kind: MageWarsFxKind): string | null {
    if (kind === 'push') return 'mage-wars-fx-spell-push-burst';
    if (kind === 'teleport') return 'mage-wars-fx-spell-teleport-burst';
    return null;
}

function resolveFxTravelScreenshotSuffix(kind: MageWarsFxKind): string {
    if (kind === 'push') return '气流推离路径中';
    if (kind === 'teleport') return '传送轨迹过程帧';
    return '投射物飞行中';
}

function resolveFxImpactScreenshotSuffix(kind: MageWarsFxKind): string {
    if (kind === 'push') return '命中推离过程帧';
    if (kind === 'teleport') return '目标区域落点过程帧';
    return '命中动画过程帧';
}

async function captureMageWarsFxProcessScreenshots(
    page: Page,
    testInfo: TestInfo,
    kind: MageWarsFxKind,
    label: string,
    options: {
        expectTravel?: boolean;
        expectDamageFloat?: boolean;
    } = {},
): Promise<MageWarsFxAudit> {
    const audit = options.expectTravel
        ? await waitForFxTravelAudit(page, kind)
        : await waitForFxSourceImpactAudit(page, kind);

    await expect(page.getByTestId(`mage-wars-fx-${kind}-source-wake`).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(resolveFxImpactTestId(kind)).first()).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(80);
    await saveEvidenceScreenshot(
        page,
        testInfo,
        options.expectTravel ? `${label}-来源唤醒过程帧` : `${label}-来源唤醒和命中过程帧`,
        { animations: 'allow' },
    );

    if (options.expectTravel) {
        const travel = page.getByTestId(`mage-wars-fx-${kind}-travel`).first();
        await expect(travel).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId(`mage-wars-fx-${kind}-travel-mid-burst`).first()).toBeVisible({ timeout: 5_000 });
        await page.waitForTimeout(420);
        await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxTravelScreenshotSuffix(kind)}`, { animations: 'allow' });
    } else {
        expect(audit.hasTravel).toBe(false);
        return audit;
    }

    await expect(page.getByTestId(resolveFxImpactTestId(kind)).first()).toBeVisible({ timeout: 5_000 });
    if (options.expectDamageFloat) {
        await page.waitForFunction(() => {
            const float = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-damage-float"]');
            if (!float) return false;
            const rect = float.getBoundingClientRect();
            let effectiveOpacity = 1;
            let current: HTMLElement | null = float;
            while (current) {
                const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                current = current.parentElement;
            }
            return rect.width > 0
                && rect.height > 0
                && effectiveOpacity > 0.35
                && (float.textContent?.includes('-') ?? false);
        }, undefined, { timeout: 5_000 });
        await saveEvidenceScreenshot(page, testInfo, `${label}-命中动画和伤害飘字过程帧`, { animations: 'allow' });
    } else {
        const impactBurstTestId = resolveFxImpactBurstTestId(kind);
        if (impactBurstTestId) {
            await expect(page.getByTestId(impactBurstTestId).first()).toBeVisible({ timeout: 5_000 });
            await page.waitForTimeout(2_250);
        }
        await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxImpactScreenshotSuffix(kind)}`, { animations: 'allow' });
    }

    return audit;
}

async function selectPreparedSpell(page: Page, preparedCard: Locator, contextLabel: string) {
    await preparedCard.scrollIntoViewIfNeeded();
    const beforeHit = await readHitTest(preparedCard);
    await preparedCard.click({ timeout: 3_000, noWaitAfter: true });
    await expect(preparedCard).toHaveAttribute('data-selected', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(preparedCard).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${contextLabel} 点击后没有进入选中态`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickFieldObject(page: Page, fieldObject: Locator, contextLabel: string) {
    await expect(fieldObject).toBeVisible({ timeout: 3_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 场上对象不可见`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    await expect(fieldObject).toBeEnabled({ timeout: 3_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 场上对象不可点击`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });

    const beforeHit = await readHitTest(fieldObject);
    await fieldObject.click({ timeout: 3_000, noWaitAfter: true }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(fieldObject).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${contextLabel} 点击场上对象失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickLegalTargetZone(page: Page, zoneId: string, contextLabel: string) {
    const zone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(zone).toHaveAttribute('data-legal-target-zone', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 的目标格 ${zoneId} 未被标记为合法目标`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    const beforeHit = await readHitTest(zone);
    await zone.click({ timeout: 3_000, noWaitAfter: true }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const afterHit = await readHitTest(zone).catch((hitError: unknown) => ({
            error: hitError instanceof Error ? hitError.message : String(hitError),
        }));
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 点击目标格 ${zoneId} 失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickLegalMoveZone(page: Page, zoneId: string, contextLabel: string) {
    const zone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(zone).toHaveAttribute('data-legal-move-zone', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 的移动格 ${zoneId} 未被标记为合法移动`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    const beforeHit = await readHitTest(zone);
    await zone.click({ timeout: 3_000, noWaitAfter: true }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const afterHit = await readHitTest(zone).catch((hitError: unknown) => ({
            error: hitError instanceof Error ? hitError.message : String(hitError),
        }));
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 点击移动格 ${zoneId} 失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickTurnEndIfEnabled(page: Page): Promise<boolean> {
    const turnEnd = page.getByTestId('mage-wars-turn-end');
    if (!await turnEnd.isEnabled({ timeout: 200 }).catch(() => false)) return false;
    try {
        await turnEnd.click({ timeout: 1_000, noWaitAfter: true });
        await page.waitForTimeout(120);
        return true;
    } catch {
        if (await turnEnd.isEnabled({ timeout: 200 }).catch(() => false)) {
            return turnEnd.click({ timeout: 1_500, force: true, noWaitAfter: true })
                .then(async () => {
                    await page.waitForTimeout(120);
                    return true;
                })
                .catch(() => false);
        }
        return false;
    }
}

async function clickPlanSpellsIfEnabled(page: Page): Promise<boolean> {
    const planSpells = page.getByTestId('mage-wars-plan-spells');
    if (!await planSpells.isVisible({ timeout: 200 }).catch(() => false)) return false;
    if (!await planSpells.isEnabled({ timeout: 200 }).catch(() => false)) return false;
    try {
        await planSpells.click({ timeout: 1_000, noWaitAfter: true });
        await page.waitForTimeout(120);
        return true;
    } catch {
        if (await planSpells.isEnabled({ timeout: 200 }).catch(() => false)) {
            await planSpells.click({ timeout: 800, force: true, noWaitAfter: true });
            await page.waitForTimeout(120);
            return true;
        }
        return false;
    }
}

async function clickPlanningOrTurnEndIfEnabled(page: Page): Promise<boolean> {
    if (await clickPlanSpellsIfEnabled(page)) return true;
    return clickTurnEndIfEnabled(page);
}

async function advanceUntilPhase(
    match: MageWarsOnlineMatch,
    targetPhase: string,
    contextLabel: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const board = match.hostPage.getByTestId('mage-wars-board');
    for (let index = 0; index < 120; index += 1) {
        const [hostPhase, guestPhase] = await Promise.all([
            readPhase(match.hostPage),
            readPhase(match.guestPage),
        ]);
        if (hostPhase === targetPhase && guestPhase === targetPhase) return;

        const phaseActorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(hostPhase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];

        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await match.hostPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        contextLabel,
        `expectedPhase=${targetPhase}`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function waitForZoneFieldCard(
    page: Page,
    zoneId: string,
    sourceCardId: number,
    contextLabel: string,
    options?: {
        match?: MageWarsOnlineMatch;
        playerId?: '0' | '1';
        diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>;
    },
) {
    let lastSnapshot: Awaited<ReturnType<typeof readOnlineBoardSnapshot>> | null = null;

    await expect.poll(async () => {
        lastSnapshot = await readOnlineBoardSnapshot(page);
        const zone = lastSnapshot.zones.find((candidate) => candidate.zoneId === zoneId);
        return zone?.fieldCards.some((card) => card.sourceCardId === String(sourceCardId)) ?? false;
    }, {
        timeout: 10_000,
        message: `${contextLabel} 应出现在 ${zoneId}`,
    }).toBe(true).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failureEvidence = await collectFailureEvidence(page, options);
        throw new Error([
            message,
            `${contextLabel} 部署后未在 ${zoneId} 看到 CardID ${sourceCardId}`,
            `snapshot=${JSON.stringify(lastSnapshot, null, 2)}`,
            `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
        ].join('\n'));
    });
}

async function advanceBothPlayersToPlanning(match: MageWarsOnlineMatch) {
    const preparationPhases = new Set(['reset', 'channel', 'upkeep']);
    const diagnostics = [
        { label: 'host', diagnostics: attachPageDiagnostics(match.hostPage) },
        { label: 'guest', diagnostics: attachPageDiagnostics(match.guestPage) },
    ];
    for (let index = 0; index < 24; index += 1) {
        const phases = await Promise.all([
            readPhase(match.hostPage),
            readPhase(match.guestPage),
        ]);
        if (phases.every((phase) => phase === 'planning')) return;

        for (const page of [match.hostPage, match.guestPage]) {
            const phase = await readPhase(page);
            if (!preparationPhases.has(phase ?? '')) continue;
            await clickTurnEndIfEnabled(page);
        }
        await Promise.all([
            match.hostPage.waitForTimeout(120),
            match.guestPage.waitForTimeout(120),
        ]);
    }

    const [hostPhase, guestPhase] = await Promise.all([
        readPhase(match.hostPage),
        readPhase(match.guestPage),
    ]);
    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        '正式联机未能从准备阶段推进到计划阶段',
        `expectedPhase=["planning","planning"]`,
        `actualPhase=${JSON.stringify([hostPhase, guestPhase])}`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function setupOnlineMageWars(
    browser: Browser,
    baseURL?: string,
    contextOptions: BrowserContextOptions = {},
): Promise<MageWarsOnlineMatch> {
    const hostContext = await browser.newContext({ baseURL, ...contextOptions });
    await initContext(hostContext, {
        storageKey: `mage-wars-online-host-${Date.now()}`,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage))) {
        throw new Error('Mage Wars 游戏服务器不可用，无法创建正式联机房间');
    }

    const guestId = `mage_wars_online_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const base = getGameServerBaseURL();
    const createResponse = await hostPage.request.post(`${base}/games/mage-wars/create`, {
        data: {
            numPlayers: 2,
            setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' },
        },
    });
    if (!createResponse.ok()) {
        throw new Error(`Mage Wars 正式房间创建失败：${createResponse.status()}`);
    }
    const createData = await createResponse.json() as { matchID?: string };
    const matchId = createData.matchID;
    if (!matchId) throw new Error('Mage Wars 正式房间未返回 matchID');

    const claimResponse = await hostPage.request.post(`${base}/games/mage-wars/${matchId}/claim-seat`, {
        data: { playerID: '0', playerName: 'MageWars-Host-E2E', guestId },
    });
    if (!claimResponse.ok()) {
        throw new Error(`Mage Wars 房主占座失败：${claimResponse.status()}`);
    }
    const claimData = await claimResponse.json() as { playerCredentials?: string };
    if (!claimData.playerCredentials) throw new Error('Mage Wars 房主占座未返回凭证');
    await seedMatchCredentials(hostContext, 'mage-wars', matchId, '0', claimData.playerCredentials);
    if (!(await waitForMatchAvailable(hostPage, 'mage-wars', matchId, 20_000))) {
        throw new Error(`Mage Wars 正式房间不可查询：${matchId}`);
    }
    await hostPage.goto(`/play/mage-wars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    const guestContext = await browser.newContext({ baseURL, ...contextOptions });
    await initContext(guestContext, {
        storageKey: `mage-wars-online-guest-${Date.now()}`,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const guestPage = await guestContext.newPage();
    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    const guestCredentials = await joinMatchViaAPI(
        guestPage,
        'mage-wars',
        matchId,
        '1',
        'MageWars-Guest-E2E',
    );
    if (!guestCredentials) throw new Error(`Mage Wars 客户端加入房间失败：${matchId}`);
    await seedMatchCredentials(guestContext, 'mage-wars', matchId, '1', guestCredentials);
    await guestPage.goto(`/play/mage-wars/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

    await Promise.all([openOnlineBoard(hostPage, '房主'), openOnlineBoard(guestPage, '访客')]);
    return {
        hostContext,
        guestContext,
        hostPage,
        guestPage,
        matchId,
        hostCredentials: claimData.playerCredentials,
        guestCredentials,
    };
}

async function advanceUntilEnabled(page: Page, locator: ReturnType<Page['getByRole']>) {
    for (let index = 0; index < 16; index += 1) {
        if (await locator.isEnabled().catch(() => false)) return;
        const turnEnd = page.getByTestId('mage-wars-turn-end');
        await expect(turnEnd).toBeVisible();
        if (!await clickPlanningOrTurnEndIfEnabled(page)) await page.waitForTimeout(180);
    }
    await expect(locator).toBeEnabled();
}

async function selectFirstVisibleSpellbookCard(page: Page): Promise<string> {
    for (let index = 0; index < 8; index += 1) {
        const cards = page.getByTestId('mage-wars-desktop-spellbook-card');
        const count = await cards.count();
        for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
            const card = cards.nth(cardIndex);
            if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
                const name = await card.getAttribute('aria-label');
                if (!name) continue;
                await card.click({ timeout: 3_000, noWaitAfter: true });
                return name;
            }
        }
        const nextPage = page.getByRole('button', { name: '下一页', exact: true });
        if (await nextPage.isDisabled().catch(() => true)) break;
        await nextPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    throw new Error('正式联机法术书中没有可选的生物卡牌');
}

async function selectNamedSpellbookCard(page: Page, name: string) {
    const allFilter = page.getByRole('button', { name: '全部', exact: true });
    if (await allFilter.isEnabled({ timeout: 500 }).catch(() => false)) {
        await allFilter.click({ timeout: 3_000, noWaitAfter: true });
    } else {
        await expect(allFilter).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 });
    }
    const previousPage = page.getByRole('button', { name: '上一页', exact: true });
    for (let index = 0; index < 8; index += 1) {
        if (await previousPage.isDisabled().catch(() => true)) break;
        await previousPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    await expect(previousPage).toBeDisabled({ timeout: 3_000 });

    const seenPages: string[][] = [];
    for (let index = 0; index < 8; index += 1) {
        const visibleNames = await page.getByTestId('mage-wars-desktop-spellbook-card').evaluateAll((cards) => (
            cards
                .filter((card) => {
                    const rect = card.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                })
                .map((card) => card.getAttribute('aria-label') ?? '')
                .filter(Boolean)
        ));
        seenPages.push(visibleNames);
        const card = page.locator(`[data-testid="mage-wars-desktop-spellbook-card"][aria-label="${name}"]`).first();
        if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
            await card.click({ timeout: 3_000, noWaitAfter: true });
            return;
        }

        const nextPage = page.getByRole('button', { name: '下一页', exact: true });
        if (await nextPage.isDisabled().catch(() => true)) break;
        await nextPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    throw new Error(`正式联机法术书中没有找到卡牌：${name}；已查看页面：${seenPages.map((names, pageIndex) => `第${pageIndex + 1}页=${names.join('、') || '空'}`).join('；')}`);
}

async function selectNamedSpellbookCards(page: Page, names: string[]) {
    for (const name of names) {
        await selectNamedSpellbookCard(page, name);
    }
}

async function planNamedSpells(page: Page, names: string[]) {
    await selectNamedSpellbookCards(page, names);
    await expect(page.getByTestId('mage-wars-plan-spells')).toHaveText(`计划 ${names.length} 张`);
    await page.getByTestId('mage-wars-plan-spells').click({ timeout: 3_000, noWaitAfter: true });
}

function selfPreparedCardByName(page: Page, name: string): Locator {
    return page.locator(`${SELF_PREPARED_CARD_SELECTOR}[aria-label="${name}"]`).first();
}

function hasSpellAttackRolledEvent(
    snapshot: JsonRecord,
    spellCardId: number,
    targetObjectId: string,
): boolean {
    const eventStream = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
    return eventStream.some((entry) => {
        if (!isRecord(entry) || entry.type !== 'MW_SPELL_ATTACK_ROLLED') return false;
        const payload = isRecord(entry.payload) ? entry.payload : {};
        return payload.spellCardId === spellCardId
            && payload.targetObjectId === targetObjectId
            && Array.isArray(payload.diceResults);
    });
}

function hasArenaObjectSnapshot(
    snapshot: JsonRecord,
    options: {
        sourceSpellCardId: number;
        kind: string;
        ownerId?: '0' | '1';
        anchoredToObjectId?: string;
        anchoredToPlayerId?: '0' | '1';
        anchoredToZoneId?: string;
        revealed?: boolean;
        restrainedByObjectId?: string;
    },
): boolean {
    const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
    return Object.values(objects).some((candidate) => {
        if (!isRecord(candidate)) return false;
        return candidate.sourceSpellCardId === options.sourceSpellCardId
            && candidate.kind === options.kind
            && (options.ownerId === undefined || candidate.ownerId === options.ownerId)
            && (options.anchoredToObjectId === undefined || candidate.anchoredToObjectId === options.anchoredToObjectId)
            && (options.anchoredToPlayerId === undefined || candidate.anchoredToPlayerId === options.anchoredToPlayerId)
            && (options.anchoredToZoneId === undefined || candidate.anchoredToZoneId === options.anchoredToZoneId)
            && (options.revealed === undefined || candidate.revealed === options.revealed)
            && (options.restrainedByObjectId === undefined || candidate.restrainedByObjectId === options.restrainedByObjectId);
    });
}

async function expectServerObject(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    options: Parameters<typeof hasArenaObjectSnapshot>[1],
    message: string,
) {
    await expect.poll(async () => (
        hasArenaObjectSnapshot(await readServerCoreSnapshot(page, match, playerId), options)
    ), {
        message,
        timeout: 5_000,
    }).toBe(true);
}

function createMageWarsE2eCreatureObject(
    id: string,
    ownerId: '0' | '1',
    sourceSpellCardId: number,
    name: string,
    zoneId: ArenaZoneId,
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId,
        sourceSpellCardId,
        sourceObjectId: `spell-${sourceSpellCardId}`,
        name,
        zoneId,
        life: 5,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        summonedTurnNumber: 1,
        statusTokens: {},
        typeLine: '生物',
        schoolLine: '自然',
        attackOrTraitLine: '',
        rulesText: '',
    };
}

function addMageWarsE2eArenaObject(core: MageWarsCore, object: MageWarsArenaObjectState): MageWarsCore {
    return {
        ...core,
        objects: {
            ...core.objects,
            [object.id]: object,
        },
        arena: core.arena.map((zone) => ({
            ...zone,
            objectIds: zone.id === object.zoneId
                ? [...new Set([...zone.objectIds.filter((candidate) => candidate !== object.id), object.id])]
                : zone.objectIds.filter((candidate) => candidate !== object.id),
            conjurationIds: zone.conjurationIds.filter((candidate) => candidate !== object.id),
        })),
    };
}

async function injectMageWarsSpellFxReadyState(
    match: MageWarsOnlineMatch,
    actorId: '0' | '1',
    options: {
        mageId: MageId;
        preparedSpellCardId: number;
        targetObject: MageWarsArenaObjectState;
        mana?: number;
    },
) {
    const page = actorId === '0' ? match.hostPage : match.guestPage;
    const liveState = await getMatchState(match.matchId, page) as { core: MageWarsCore; sys: JsonRecord };
    const actor = liveState.core.players[actorId];
    const turnOrder = liveState.core.playerOrder.length > 0 ? liveState.core.playerOrder : ['0', '1'];
    const currentPlayerIndex = Math.max(0, turnOrder.indexOf(actorId));
    const nextCore = addMageWarsE2eArenaObject({
        ...liveState.core,
        currentPlayerId: actorId,
        phaseActorId: actorId,
        phaseReadyPlayerIds: [],
        players: {
            ...liveState.core.players,
            [actorId]: {
                ...actor,
                mageId: options.mageId,
                mana: options.mana ?? 12,
                actionReady: true,
                quickcastReady: true,
                preparedSpellSlots: 1,
                preparedSpellCardIds: [options.preparedSpellCardId],
            },
        },
    }, options.targetObject);

    await injectMatchState(match.matchId, {
        ...liveState,
        core: nextCore,
        sys: {
            ...liveState.sys,
            matchId: match.matchId,
            turnOrder,
            currentPlayerIndex,
            phase: 'initiativeQuickcast',
        },
    } as Parameters<typeof injectMatchState>[1], page);

    const board = page.getByTestId('mage-wars-board');
    await expect(board).toHaveAttribute('data-mage-wars-phase', 'initiativeQuickcast', { timeout: 5_000 });
    await expect(board).toHaveAttribute('data-mage-wars-phase-actor-id', actorId, { timeout: 5_000 });
    await expect(page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${options.targetObject.id}"]`).first())
        .toBeVisible({ timeout: 5_000 });
}

async function expectServerObjectZone(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    zoneId: string,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        const object = isRecord(objects[objectId]) ? objects[objectId] : {};
        return object.zoneId;
    }, {
        message,
        timeout: 5_000,
    }).toBe(zoneId);
}

function hasSpellMovementResolvedEvent(
    snapshot: JsonRecord,
    eventType: 'MW_SPELL_PUSH_RESOLVED' | 'MW_SPELL_TELEPORT_RESOLVED',
    spellCardId: number,
    targetObjectId: string,
    toZoneId: string,
): boolean {
    const eventStream = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
    return eventStream.some((entry) => {
        if (!isRecord(entry) || entry.type !== eventType) return false;
        const payload = isRecord(entry.payload) ? entry.payload : {};
        return payload.spellCardId === spellCardId
            && payload.targetObjectId === targetObjectId
            && payload.toZoneId === toZoneId;
    });
}

async function deployBothPlayers(
    match: MageWarsOnlineMatch,
    hostCreatureName: string,
    guestCreatureName: string,
    hostZone: string,
    guestZone: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const hostPreparedCard = selfPreparedCardByName(match.hostPage, hostCreatureName);
    await advanceUntilEnabled(match.hostPage, hostPreparedCard);
    const hostSourceCardId = await hostPreparedCard.getAttribute('data-source-card-id');
    await selectPreparedSpell(match.hostPage, hostPreparedCard, hostCreatureName);
    await clickLegalTargetZone(match.hostPage, hostZone, hostCreatureName);
    if (!hostSourceCardId) throw new Error(`部署 ${hostCreatureName} 前未能读取 CardID`);
    await waitForZoneFieldCard(match.hostPage, hostZone, Number(hostSourceCardId), hostCreatureName, {
        match,
        playerId: '0',
        diagnostics,
    });
    await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });

    const guestPreparedCard = selfPreparedCardByName(match.guestPage, guestCreatureName);
    await advanceUntilEnabled(match.guestPage, guestPreparedCard);
    const guestSourceCardId = await guestPreparedCard.getAttribute('data-source-card-id');
    await selectPreparedSpell(match.guestPage, guestPreparedCard, guestCreatureName);
    await clickLegalTargetZone(match.guestPage, guestZone, guestCreatureName);
    if (!guestSourceCardId) throw new Error(`部署 ${guestCreatureName} 前未能读取 CardID`);
    await waitForZoneFieldCard(match.guestPage, guestZone, Number(guestSourceCardId), guestCreatureName, {
        match,
        playerId: '1',
        diagnostics,
    });
    await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
}

async function castPreparedSpellOnMage(
    page: Page,
    spellName: string,
    targetPlayerId: '0' | '1',
) {
    const prepared = selfPreparedCardByName(page, spellName);
    await advanceUntilEnabled(page, prepared);
    await selectPreparedSpell(page, prepared, spellName);
    const mageEntity = page.locator(`[data-testid="mage-wars-zone-mage-entity"][data-player-id="${targetPlayerId}"]`).first();
    await expect(mageEntity).toBeVisible({ timeout: 3_000 });
    await mageEntity.click({ timeout: 3_000, noWaitAfter: true, force: true }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(mageEntity).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${spellName} 点击法师目标失败`,
            message,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function castPreparedSpellOnFieldObject(
    page: Page,
    spellName: string,
    target: Locator,
    beforeTargetClick?: () => void,
) {
    const prepared = selfPreparedCardByName(page, spellName);
    await advanceUntilEnabled(page, prepared);
    await selectPreparedSpell(page, prepared, spellName);
    await expect(target.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
    beforeTargetClick?.();
    await clickFieldObject(page, target, `${spellName} 选择目标`);
}

async function resolveCurrentActorOrder(
    match: MageWarsOnlineMatch,
    contextLabel: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
): Promise<Array<'0' | '1'>> {
    const board = match.hostPage.getByTestId('mage-wars-board');
    for (let index = 0; index < 80; index += 1) {
        const actorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (actorId === '0') return ['0', '1'];
        if (actorId === '1') return ['1', '0'];
        await match.hostPage.waitForTimeout(120);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        `${contextLabel} 未能读取当前行动方`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceToPlayerCreatureAction(
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const targetPage = playerId === '0' ? match.hostPage : match.guestPage;
    for (let index = 0; index < 72; index += 1) {
        const phase = await readPhase(targetPage);
        const phaseActorId = await match.hostPage.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (phase === 'creatureAction' && phaseActorId === playerId) {
            return;
        }

        if (phase === 'planning') {
            for (const page of [match.hostPage, match.guestPage]) {
                await clickPlanningOrTurnEndIfEnabled(page);
            }
            continue;
        }

        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await targetPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(targetPage, {
        match,
        playerId,
        diagnostics,
    });
    throw new Error([
        `正式联机未能让玩家 ${playerId} 进入行动阶段`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceToReadyFieldObjectAction(
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    zoneId: string,
    sourceCardId: number,
    objectName: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const targetPage = playerId === '0' ? match.hostPage : match.guestPage;
    const fieldObject = targetPage
        .locator(`[data-testid="mage-wars-arena-zone-${zoneId}"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="${sourceCardId}"]`)
        .first();

    for (let index = 0; index < 180; index += 1) {
        const phase = await readPhase(targetPage);
        const phaseActorId = await match.hostPage.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (
            phase === 'creatureAction'
            && phaseActorId === playerId
            && await fieldObject.isEnabled({ timeout: 200 }).catch(() => false)
        ) {
            return;
        }

        if (phase === 'planning') {
            for (const page of [match.hostPage, match.guestPage]) {
                await clickPlanningOrTurnEndIfEnabled(page);
            }
            continue;
        }

        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await targetPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(targetPage, {
        match,
        playerId,
        diagnostics,
    });
    throw new Error([
        `正式联机未能让玩家 ${playerId} 的${objectName}在 ${zoneId} 进入可行动窗口`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceToNextPlanningPhase(
    match: MageWarsOnlineMatch,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const board = match.hostPage.getByTestId('mage-wars-board');
    const initialTurnNumber = Number(await board.getAttribute('data-mage-wars-turn-number', { timeout: 500 }).catch(() => null));

    for (let index = 0; index < 180; index += 1) {
        const phase = await readPhase(match.hostPage);
        const turnNumber = Number(await board.getAttribute('data-mage-wars-turn-number', { timeout: 500 }).catch(() => null));
        const guestPhase = await readPhase(match.guestPage);
        if (
            phase === 'planning'
            && guestPhase === 'planning'
            && Number.isFinite(turnNumber)
            && turnNumber > initialTurnNumber
        ) {
            return;
        }

        const phaseActorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await match.hostPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        '正式联机未能推进到下一轮计划阶段',
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

test.describe('Mage Wars formal online runtime', () => {
    test('正式联机入口从双方计划到部署并保持对手计划隐藏', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toBeVisible();
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toBeVisible();
            await match.hostPage.getByRole('button', { name: '生物', exact: true }).click();
            const hostCreatureName = await selectFirstVisibleSpellbookCard(match.hostPage);
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '生物', exact: true }).click();
            const guestCreatureName = await selectFirstVisibleSpellbookCard(match.guestPage);
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();

            await expect(match.hostPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.guestPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.hostPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.guestPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-双方计划后-对手计划仍隐藏');

            const hostPreparedCard = selfPreparedCardByName(match.hostPage, hostCreatureName);
            await advanceUntilEnabled(match.hostPage, hostPreparedCard);
            await hostPreparedCard.click();
            const hostSummonFxAuditPromise = captureMageWarsSummonFxProcessScreenshot(
                match.hostPage,
                testInfo,
                '02A-己方生物部署',
            );
            await clickLegalTargetZone(match.hostPage, 'a3', hostCreatureName);
            const hostSummonFxAudit = await hostSummonFxAuditPromise;
            expect(hostSummonFxAudit.objectKind).toBe('creature');
            expect(hostSummonFxAudit.objectId).toMatch(/^mwobj-/);
            await match.hostPage.getByTestId('mage-wars-turn-end').click();

            const guestPreparedCard = selfPreparedCardByName(match.guestPage, guestCreatureName);
            await advanceUntilEnabled(match.guestPage, guestPreparedCard);
            await guestPreparedCard.click();
            await clickLegalTargetZone(match.guestPage, 'd1', guestCreatureName);
            await match.guestPage.getByTestId('mage-wars-turn-end').click();

            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"]').first()).toBeVisible();
            await expect(match.guestPage.locator('[data-testid="mage-wars-zone-field-card"]').first()).toBeVisible();
            await expect(match.hostPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.guestPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.hostPage.getByTestId('mage-wars-opponent-prepared-mirror')).toContainText('对手已计划 0');
            await expect(match.guestPage.getByTestId('mage-wars-opponent-prepared-mirror')).toContainText('对手已计划 0');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-部署完成后-场地生物和隐藏计划');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式联机入口真实施放强化法术并只产生法力、弃牌和卡牌结果', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await selectNamedSpellbookCard(match.hostPage, '冲锋陷阵');
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toHaveText('计划 2 张');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '生物', exact: true }).click();
            const guestCreatureName = await selectFirstVisibleSpellbookCard(match.guestPage);
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();

            await deployBothPlayers(match, '丛林灰狼', guestCreatureName, 'a3', 'd1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await advanceToPlayerCreatureAction(match, '0', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            const preparedCharge = selfPreparedCardByName(match.hostPage, '冲锋陷阵');
            await expect(preparedCharge).toBeEnabled();
            await preparedCharge.click();
            const wolfCard = match.hostPage.locator('[data-testid="mage-wars-arena-zone-a3"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]').first();
            await expect(wolfCard.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
            await wolfCard.click();
            await expect(match.hostPage.getByTestId('mage-wars-fx-spell-cast')).toHaveCount(0);

            await expect.poll(async () => match.hostPage.getByTestId('mage-wars-mage-hud-self').innerText()).toMatch(/法力\s+[\s\S]*7/);
            await expect(match.hostPage.getByTestId('mage-wars-discard-pile')).toContainText('弃牌 2');
            await expect(match.hostPage.locator(`${SELF_PREPARED_CARD_SELECTOR}[aria-label="冲锋陷阵"]`)).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-冲锋陷阵结算后-法力弃牌已变化');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式联机入口真实移动、攻击并切换回合', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(300_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL, {
            hasTouch: true,
        });
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '生物', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.guestPage, '阿希拉牧师');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();
            await deployBothPlayers(match, '丛林灰狼', '阿希拉牧师', 'a3', 'd1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            await advanceToNextPlanningPhase(match, [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await match.guestPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.guestPage, '圣光之柱');
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toHaveText('计划 1 张');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();
            await advanceToReadyFieldObjectAction(match, '0', 'a3', 2819, '丛林灰狼', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-生物行动前-场地对象可直选');

            const hostWolfCard = match.hostPage.locator('[data-testid="mage-wars-arena-zone-a3"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]').first();
            await hostWolfCard.click({ timeout: 3_000 });
            await clickLegalMoveZone(match.hostPage, 'a2', '丛林灰狼移动');
            await waitForZoneFieldCard(match.hostPage, 'a2', 2819, '丛林灰狼移动后', {
                match,
                playerId: '0',
                diagnostics: [
                    { label: 'host', diagnostics: hostDiagnostics },
                    { label: 'guest', diagnostics: guestDiagnostics },
                ],
            });
            await match.hostPage.setViewportSize({ width: 1920, height: 1080 });
            await match.guestPage.setViewportSize({ width: 1920, height: 1080 });
            await expect(match.hostPage.getByTestId('mage-wars-desktop-spellbook-shelf')).toBeVisible({ timeout: 5_000 });
            await expect(match.hostPage.getByTestId('mage-wars-desktop-prepared-spells')).toBeVisible({ timeout: 5_000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06A-PC基线-丛林灰狼移动后桌面同源布局');
            await match.hostPage.setViewportSize({ width: 960, height: 540 });
            await match.guestPage.setViewportSize({ width: 960, height: 540 });
            await expectMobileLandscapeHudSlots(match.hostPage, '移动后房主视角');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06B-移动横屏镜像-丛林灰狼进入目标区域');

            await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000 });
            await advanceToPlayerCreatureAction(match, '1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            const preparedLightPillar = selfPreparedCardByName(match.guestPage, '圣光之柱');
            await advanceUntilEnabled(match.guestPage, preparedLightPillar);
            await selectPreparedSpell(match.guestPage, preparedLightPillar, '圣光之柱');
            const targetCleric = match.guestPage.locator('[data-testid="mage-wars-arena-zone-d1"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2811"]').first();
            const targetClericObjectId = await targetCleric.getAttribute('data-object-id');
            if (!targetClericObjectId) throw new Error('圣光之柱目标牧师没有对象 ID，无法核对服务端攻击事件');
            await expect(targetCleric.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
            const attackImpactFx = match.guestPage.getByTestId('mage-wars-fx-attack-impact');
            const attackDiceFx = match.guestPage.getByTestId('mage-wars-fx-attack-dice');
            await Promise.all([
                expect(attackImpactFx).toBeVisible({ timeout: 5_000 }),
                expect(attackDiceFx).toBeVisible({ timeout: 5_000 }),
                expect(attackDiceFx.getByTestId('mage-wars-fx-attack-die-face')).toHaveCount(2, { timeout: 5_000 }),
                expect(attackDiceFx.getByTestId('mage-wars-fx-effect-die-face')).toBeVisible({ timeout: 5_000 }),
                targetCleric.click({ timeout: 3_000 }),
            ]);

            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.guestPage, match, '1');
                if (!hasSpellAttackRolledEvent(snapshot, 1706, targetClericObjectId)) return false;
                const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
                const targetObject = isRecord(objects[targetClericObjectId]) ? objects[targetClericObjectId] : {};
                return typeof targetObject.damage === 'number' && targetObject.damage > 0;
            }, {
                message: '服务端没有记录圣光之柱对阿希拉牧师的攻击掷骰和伤害状态',
                timeout: 5_000,
            }).toBe(true);
            await expect(targetCleric.locator('img[alt*="伤害"]')).toBeVisible({ timeout: 5_000 });
            await expectMobileLandscapeHudSlots(match.guestPage, '攻击后访客视角');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '07-横屏圣光之柱攻击阿希拉牧师后-攻击骰反馈和伤害状态');

            await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000 });
            await advanceUntilPhase(match, 'finalQuickcast', '攻击行动结束后应通过剩余行动结束进入终末快速施法窗口', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await expectMobileLandscapeHudSlots(match.guestPage, '终末快速施法窗口访客视角');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '08-攻击行动结束后-进入终末快速施法窗口');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式联机入口覆盖两派系法术类型代表链', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(420_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);
        const diagnostics = [
            { label: 'host', diagnostics: hostDiagnostics },
            { label: 'guest', diagnostics: guestDiagnostics },
        ];

        try {
            await advanceBothPlayersToPlanning(match);
            await planNamedSpells(match.hostPage, ['野性山猫']);
            await planNamedSpells(match.guestPage, ['阿希拉牧师']);
            await deployBothPlayers(match, '野性山猫', '阿希拉牧师', 'a3', 'd1', diagnostics);

            const hostBobcatSnapshot = await readZoneFieldCardSnapshot(match.hostPage, 'a3', 2906, '野性山猫部署后');
            const guestClericSnapshot = await readZoneFieldCardSnapshot(match.guestPage, 'd1', 2811, '阿希拉牧师部署后');
            const hostBobcatObjectId = hostBobcatSnapshot.objectId;
            const guestClericObjectId = guestClericSnapshot.objectId;
            if (!hostBobcatObjectId) throw new Error('野性山猫没有对象 ID，无法核对后续结界锚点');
            if (!guestClericObjectId) throw new Error('阿希拉牧师没有对象 ID，无法核对后续魔物锚点');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '09-两派系生物部署后-兽王女祭司各有场上生物');

            await advanceToReadyFieldObjectAction(match, '0', 'a3', 2906, '野性山猫', diagnostics);
            await clickFieldObject(
                match.hostPage,
                match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first(),
                '野性山猫移动前选择来源',
            );
            await clickLegalMoveZone(match.hostPage, 'a2', '野性山猫移动到相邻格以验证攻击法术路径');
            await waitForZoneFieldCard(match.hostPage, 'a2', 2906, '野性山猫移动后', {
                match,
                playerId: '0',
                diagnostics,
            });
            const hostBobcatById = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first();

            await advanceToNextPlanningPhase(match, diagnostics);
            await planNamedSpells(match.hostPage, ['巨熊皮甲', '巨熊力量']);
            await planNamedSpells(match.guestPage, ['风龙皮甲', '公牛耐力']);
            const secondRoundOrder = await resolveCurrentActorOrder(match, '装备和结界代表链', diagnostics);
            for (const actorId of secondRoundOrder) {
                if (actorId === '0') {
                    await castPreparedSpellOnMage(match.hostPage, '巨熊皮甲', '0');
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 3711,
                        kind: 'equipment',
                        ownerId: '0',
                        anchoredToPlayerId: '0',
                    }, '兽王装备巨熊皮甲应通过正式页面施放并附着到兽王法师');

                    await castPreparedSpellOnFieldObject(match.hostPage, '巨熊力量', hostBobcatById);
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 1914,
                        kind: 'enchantment',
                        ownerId: '0',
                        anchoredToObjectId: hostBobcatObjectId,
                    revealed: true,
                }, '兽王结界巨熊力量应通过正式页面施放并附着到野性山猫');
                await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
                continue;
            }

                await castPreparedSpellOnMage(match.guestPage, '风龙皮甲', '1');
                await expectServerObject(match.guestPage, match, '1', {
                    sourceSpellCardId: 3708,
                    kind: 'equipment',
                    ownerId: '1',
                    anchoredToPlayerId: '1',
                }, '女祭司装备风龙皮甲应通过正式页面施放并附着到女祭司法师');

                const guestClericById = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${guestClericObjectId}"]`).first();
                await castPreparedSpellOnFieldObject(match.guestPage, '公牛耐力', guestClericById);
                await expectServerObject(match.guestPage, match, '1', {
                    sourceSpellCardId: 1808,
                    kind: 'enchantment',
                    ownerId: '1',
                    anchoredToObjectId: guestClericObjectId,
                    revealed: true,
                }, '女祭司结界公牛耐力应通过正式页面施放并附着到阿希拉牧师');
                await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            }
            const hostMageEquipment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="3711"][data-attachment-kind="equipment"]').first();
            const guestMageEquipment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="3708"][data-attachment-kind="equipment"]').first();
            const hostCreatureEnchantment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="1914"][data-attachment-kind="enchantment"]').first();
            const guestCreatureEnchantment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="1808"][data-attachment-kind="enchantment"]').first();
            const attachedCards = [hostMageEquipment, guestMageEquipment, hostCreatureEnchantment, guestCreatureEnchantment];
            for (const attachedCard of attachedCards) {
                await expect(attachedCard).toBeVisible();
                await expectNoExternalAttachmentTypeLabel(attachedCard);
            }
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="3711"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="3708"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="1914"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="1808"]')).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '10-装备和结界作为附件结算后-两派系附着关系可见');

            await advanceToNextPlanningPhase(match, diagnostics);
            await planNamedSpells(match.hostPage, ['缠绕藤蔓', '间歇喷泉']);
            await planNamedSpells(match.guestPage, ['圣光之柱']);
            const thirdRoundOrder = await resolveCurrentActorOrder(match, '魔物和攻击代表链', diagnostics);
            for (const actorId of thirdRoundOrder) {
                if (actorId === '0') {
                    const hostTargetBobcat = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first();
                    await castPreparedSpellOnFieldObject(match.hostPage, '缠绕藤蔓', hostTargetBobcat);
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 2224,
                        kind: 'conjuration',
                        ownerId: '0',
                        anchoredToObjectId: hostBobcatObjectId,
                    }, '兽王魔物缠绕藤蔓应通过正式页面施放并锚定同区野性山猫');
                    await expect.poll(async () => {
                        const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
                        const bobcat = isRecord(objects[hostBobcatObjectId]) ? objects[hostBobcatObjectId] : {};
                        return typeof bobcat.restrainedByObjectId === 'string' && bobcat.restrainedByObjectId.length > 0;
                    }, {
                        message: '缠绕藤蔓结算后野性山猫应进入被束缚状态',
                        timeout: 5_000,
                    }).toBe(true);

                    let geyserAttackFxAuditPromise: ReturnType<typeof captureMageWarsFxProcessScreenshots> | undefined;
                    await castPreparedSpellOnFieldObject(match.hostPage, '间歇喷泉', hostTargetBobcat, () => {
                        geyserAttackFxAuditPromise = captureMageWarsFxProcessScreenshots(
                            match.hostPage,
                            testInfo,
                            'attack',
                            '11A-间歇喷泉攻击法术',
                            {
                                expectTravel: true,
                                expectDamageFloat: true,
                            },
                        );
                    });
                    if (!geyserAttackFxAuditPromise) {
                        throw new Error('间歇喷泉点击前未启动攻击 FX 捕捉');
                    }
                    const geyserAttackFxAudit = await geyserAttackFxAuditPromise;
                    expect(geyserAttackFxAudit.targetRow).toBe('1');
                    expect(geyserAttackFxAudit.targetCol).toBe('0');
                    await expect.poll(async () => (
                        hasSpellAttackRolledEvent(await readServerCoreSnapshot(match.hostPage, match, '0'), 1710, hostBobcatObjectId)
                    ), {
                        message: '兽王攻击法术间歇喷泉应通过正式页面产生攻击掷骰事件',
                        timeout: 5_000,
                    }).toBe(true);
                    await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
                    continue;
                }

                await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            }
            await saveEvidenceScreenshot(match.hostPage, testInfo, '11-缠绕藤蔓和攻击法术结算后-魔物与攻击效果可见');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面推斥法术过程帧覆盖来源飞行命中', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const targetObjectId = 'mw-e2e-force-push-target';
        const spellCardId = 3523;

        try {
            await injectMageWarsSpellFxReadyState(match, '1', {
                mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                preparedSpellCardId: spellCardId,
                targetObject: createMageWarsE2eCreatureObject(
                    targetObjectId,
                    '0',
                    2906,
                    '野性山猫',
                    ARENA_ZONE_IDS.C2,
                ),
                mana: 12,
            });

            const target = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`).first();
            await selectPreparedSpell(match.guestPage, selfPreparedCardByName(match.guestPage, '原力推斥'), '原力推斥');
            await clickFieldObject(match.guestPage, target, '原力推斥选择目标生物');
            await expect(target).toHaveAttribute('data-field-card-role', 'source', { timeout: 3_000 });
            await expect(match.guestPage.getByTestId('mage-wars-arena-zone-c3')).toHaveAttribute('data-legal-target-zone', 'true', {
                timeout: 3_000,
            });

            const pushFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.guestPage,
                testInfo,
                'push',
                '12A-原力推斥',
                { expectTravel: true },
            );
            await clickLegalTargetZone(match.guestPage, 'c3', '原力推斥选择推离落点');
            const pushFxAudit = await pushFxAuditPromise;
            expect(pushFxAudit.sourceRow).toBe('1');
            expect(pushFxAudit.sourceCol).toBe('2');
            expect(pushFxAudit.targetRow).toBe('2');
            expect(pushFxAudit.targetCol).toBe('2');

            await expectServerObjectZone(
                match.guestPage,
                match,
                '1',
                targetObjectId,
                ARENA_ZONE_IDS.C3,
                '原力推斥结算后野性山猫应被推到 C3',
            );
            await expect.poll(async () => (
                hasSpellMovementResolvedEvent(
                    await readServerCoreSnapshot(match.guestPage, match, '1'),
                    'MW_SPELL_PUSH_RESOLVED',
                    spellCardId,
                    targetObjectId,
                    ARENA_ZONE_IDS.C3,
                )
            ), {
                message: '原力推斥必须通过真实页面产生推斥结算事件',
                timeout: 5_000,
            }).toBe(true);
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面传送法术过程帧覆盖来源轨迹落点', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const targetObjectId = 'mw-e2e-teleport-target';
        const spellCardId = 3410;

        try {
            await injectMageWarsSpellFxReadyState(match, '0', {
                mageId: MAGE_IDS.WIZARD_APPRENTICE,
                preparedSpellCardId: spellCardId,
                targetObject: createMageWarsE2eCreatureObject(
                    targetObjectId,
                    '0',
                    2822,
                    '蓝色精怪',
                    ARENA_ZONE_IDS.A2,
                ),
                mana: 12,
            });

            const target = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`).first();
            await selectPreparedSpell(match.hostPage, selfPreparedCardByName(match.hostPage, '传送'), '传送');
            await clickFieldObject(match.hostPage, target, '传送选择目标生物');
            await expect(target).toHaveAttribute('data-field-card-role', 'source', { timeout: 3_000 });
            await expect(match.hostPage.getByTestId('mage-wars-arena-zone-b3')).toHaveAttribute('data-legal-target-zone', 'true', {
                timeout: 3_000,
            });

            const teleportFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.hostPage,
                testInfo,
                'teleport',
                '12B-传送',
                { expectTravel: true },
            );
            await clickLegalTargetZone(match.hostPage, 'b3', '传送选择目标区域');
            const teleportFxAudit = await teleportFxAuditPromise;
            expect(teleportFxAudit.sourceRow).toBe('1');
            expect(teleportFxAudit.sourceCol).toBe('0');
            expect(teleportFxAudit.targetRow).toBe('2');
            expect(teleportFxAudit.targetCol).toBe('1');

            await expectServerObjectZone(
                match.hostPage,
                match,
                '0',
                targetObjectId,
                ARENA_ZONE_IDS.B3,
                '传送结算后蓝色精怪应到达 B3',
            );
            await expect.poll(async () => (
                hasSpellMovementResolvedEvent(
                    await readServerCoreSnapshot(match.hostPage, match, '0'),
                    'MW_SPELL_TELEPORT_RESOLVED',
                    spellCardId,
                    targetObjectId,
                    ARENA_ZONE_IDS.B3,
                )
            ), {
                message: '传送必须通过真实页面产生传送结算事件',
                timeout: 5_000,
            }).toBe(true);
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });
});
