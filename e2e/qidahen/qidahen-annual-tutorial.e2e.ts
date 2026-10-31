import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, disableAudio, setChineseLocale } from '../helpers/common';
import type { QidahenCore } from '../../src/games/qidahen/domain/types';
import type { TutorialStepSnapshot } from '../../src/engine/types';
import { beginBattleRecording } from './battleRecording';
import { clickVisibleButton } from './tutorialPointer';

// 七大恨的图集地图与物理骰子按正常浏览器GPU呈现；不继承Windows软件光栅化测试开关。
test.use({ channel: 'chromium', launchOptions: { args: [] } });

const runId = process.env.QIDAHEN_ANNUAL_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const root = resolve(process.env.QIDAHEN_ANNUAL_EVIDENCE_ROOT ?? `test-results/evidence-screenshots/_shared/qidahen-连续年度教程/${runId}`);
const KEY_STATES = new Set(['frontier-goal', 'opening-move', 'recruit-source', 'recruit-payment', 'recruit-troops', 'farm-target', 'reclaim-target',
    'midyear', 'hand-limit', 'upgrade-card', 'dispatch-source', 'dispatch-troops', 'dispatch-target', 'tactic-card', 'occupy',
    'diplomacy-target', 'diplomacy-finish', 'hire-target', 'new-year', 'maintain-shanhai', 'upkeep-yehe', 'upkeep-pyongyang', 'claim-year',
    'new-order', 'year-character', 'training-target', 'finish']);
const MOBILE_STATES = new Set(['frontier-goal', 'recruit-payment', 'hand-limit', 'dispatch-troops', 'occupy', 'maintain-shanhai', 'year-character', 'finish', 'diplomacy-target', 'diplomacy-finish', 'hire-target', 'training-target']);

type Snapshot = {
    core: QidahenCore;
    tutorial: { active: boolean; step: TutorialStepSnapshot; pendingAnimationAdvance: boolean };
    interaction: { id: string; playerId: string; data: { sourceId?: string; multi?: { min: number; max: number }; options: Array<{ id: string }> } } | null;
};
const read = (page: Page): Promise<Snapshot> => page.evaluate(() => {
    const state = (window as unknown as { __BG_TEST_HARNESS__: { state: { get(): { core: QidahenCore; sys: Record<string, unknown> } } } }).__BG_TEST_HARNESS__.state.get();
    const tutorial = state.sys.tutorial as Snapshot['tutorial'];
    return { core: state.core, tutorial: { active: tutorial.active, step: tutorial.step, pendingAnimationAdvance: tutorial.pendingAnimationAdvance }, interaction: (state.sys.interaction as { current: unknown }).current } as Snapshot;
});
const stepId = async (page: Page) => (await read(page)).tutorial.step?.id;



async function waitMagnifyReady(page: Page) {
    const overlay = page.getByTestId('qidahen-card-magnify-overlay');
    await expect(overlay).toBeVisible();
    await expect.poll(() => overlay.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    await expect(page.getByTestId('qidahen-card-magnify-content')).toBeVisible();
    await expect.poll(() => page.getByTestId('qidahen-card-magnify-content').evaluate(element => {
        const images = [...element.querySelectorAll('img')];
        return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
    })).toBe(true);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function clickCard(page: Page, id: string) {
    const card = page.getByTestId(`qidahen-hand-card-${id}`);
    const shell = page.getByTestId(`qidahen-hand-card-shell-${id}`);
    const wasSelected = await shell.getAttribute('data-qidahen-hand-card-selected') === 'true';
    await card.evaluate(element => {
        const dock = element.closest<HTMLElement>('[data-testid="qidahen-hand-zone"]')!;
        const bounds = element.getBoundingClientRect(); const dockBounds = dock.getBoundingClientRect();
        dock.scrollLeft += (bounds.left - dockBounds.left - dockBounds.width / 2) * dock.clientWidth / dockBounds.width;
    });
    const visiblePoint = () => card.evaluate(async element => {
        const deadline = performance.now() + 5000;
        let previous = ''; let stable = 0;
        const samples: unknown[] = [];
        while (performance.now() < deadline) {
            const r = element.getBoundingClientRect();
            const xs = [0.5, 0.25, 0.75, 0.1, 0.9].map(f => r.left + r.width * f);
            const ys = [r.top + 15, r.top + r.height * 0.25, r.top + r.height * 0.5, r.top + r.height * 0.75];
            const points = ys.flatMap(y => xs.map(x => ({ x, y })));
            const point = points.find(p => p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight && element.contains(document.elementFromPoint(p.x, p.y)));
            const key = JSON.stringify({ x: r.x, y: r.y, width: r.width, height: r.height, point });
            stable = point && key === previous ? stable + 1 : 0; previous = key;
            if (point && stable >= 2) return point;
            samples.push({ x: r.x, y: r.y, width: r.width, height: r.height, point, topHit: document.elementFromPoint(r.left + 10, r.top + 15)?.closest('[data-testid]')?.getAttribute('data-testid') });
            if (samples.length > 20) samples.shift();
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
        throw new Error('ANNUAL_CARD_HIT_FAILURE ' + JSON.stringify(samples));
    });
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    if (!coarse) { const p = await visiblePoint(); await page.mouse.move(p.x, p.y); }
    const point = await visiblePoint();
    if (coarse) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await expect.poll(async () => await shell.getAttribute('data-qidahen-hand-card-selected') === 'true', { message: 'this card selection actually changed' }).toBe(!wasSelected);
}

async function clickRegion(page: Page, regionId: string) {
    const point = await page.evaluate(async id => {
        const path = '/src/games/qidahen/ui/mapGraph.ts';
        const graph = await import(path);
        return graph.getQidahenRuntimeRegionAnchorTargetPoint(id) as { x: number; y: number };
    }, regionId);
    // 在同一浏览器任务内逐帧观察，避免驱动往返一次耗尽轮询期限却只采到一份几何。
    const { bounds, size } = await page.evaluate(async () => {
        const element = document.querySelector<HTMLElement>('[data-testid="qidahen-map-content"]');
        if (!element) throw new Error('map content not mounted');
        const samples: Array<{ at: number; bounds: { x: number; y: number; width: number; height: number } }> = [];
        let previous = ''; let stableFrames = 0;
        for (let index = 0; index < 120; index++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const r = element.getBoundingClientRect();
            const bounds = { x: r.x, y: r.y, width: r.width, height: r.height };
            samples.push({ at: performance.now(), bounds }); if (samples.length > 20) samples.shift();
            const serialized = JSON.stringify(bounds); stableFrames = serialized === previous ? stableFrames + 1 : 0; previous = serialized;
            if (stableFrames >= 2 && bounds.width > 0 && bounds.height > 0) return { bounds, size: { width: element.offsetWidth, height: element.offsetHeight } };
        }
        throw new Error('ANNUAL_MAP_UNSTABLE ' + JSON.stringify(samples));
    });
    const x = bounds.x + point.x * bounds.width / size.width;
    const y = bounds.y + point.y * bounds.height / size.height;
    expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(page.viewportSize()!.width);
    expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(page.viewportSize()!.height);
    if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
}

async function assertWholeRegionVisible(page: Page, regionId: string) {
    const result = await page.evaluate(async id => {
        const ownerPath = '/src/games/qidahen/ui/runtimeRegionOwnership.ts';
        const { buildQidahenRuntimeRegionIdByPixel, getQidahenRuntimeRegionBounds } = await import(ownerPath);
        const image = new Image(); image.src = '/src/games/qidahen/data/region-mask.png'; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
        const owners = buildQidahenRuntimeRegionIdByPixel(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        const region = getQidahenRuntimeRegionBounds(owners, canvas.width, canvas.height, [id])!;
        const content = document.querySelector<HTMLElement>('[data-testid="qidahen-map-content"]')!;
        const rect = content.getBoundingClientRect();
        return { left: rect.left + region.left * rect.width / content.offsetWidth,
            top: rect.top + region.top * rect.height / content.offsetHeight,
            right: rect.left + (region.left + region.width) * rect.width / content.offsetWidth,
            bottom: rect.top + (region.top + region.height) * rect.height / content.offsetHeight,
            viewport: { width: innerWidth, height: innerHeight } };
    }, regionId);
    expect(result.left, 'whole territory left').toBeGreaterThanOrEqual(0);
    expect(result.top, 'whole territory north').toBeGreaterThanOrEqual(0);
    expect(result.right, 'whole territory right').toBeLessThanOrEqual(result.viewport.width);
    expect(result.bottom, 'whole territory south').toBeLessThanOrEqual(result.viewport.height);
}

/** 以正式分区蒙版和兵牌本体核遮挡，空白包围盒角落不冒充地区像素。 */
async function mapRegionOcclusion(page: Page, regionIds: string[], blockerSelectors: string[]) {
    return page.evaluate(async ({ regionIds, blockerSelectors }) => {
        const wanted = new Set(regionIds);
        const content = document.querySelector<HTMLElement>('[data-testid="qidahen-map-content"]')!;
        const map = content.getBoundingClientRect();
        const blockers = blockerSelectors.flatMap(selector => [...document.querySelectorAll(selector)]).map(element => element.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
        const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const territories = [...document.querySelectorAll<HTMLElement>('[data-qidahen-battle-region-space], [data-qidahen-map-selection-space]')].filter(element => wanted.has(element.dataset.qidahenBattleRegionSpace ?? element.dataset.qidahenMapSelectionSpace ?? ''));
        const bounds = territories.map(element => element.getBoundingClientRect());
        const whole = bounds.every(r => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight);
        const tokens = [...document.querySelectorAll<HTMLElement>('[data-qidahen-map-token-region]')].filter(element => wanted.has(element.dataset.qidahenMapTokenRegion ?? ''));
        const coveredTokens = tokens.filter(element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && blockers.some(b => overlaps(r, b)); }).map(element => element.getAttribute('data-testid'));
        const relevant = blockers.filter(blocker => bounds.some(bound => overlaps(bound, blocker)));
        const coveredPixels: Record<string, number> = {};
        if (relevant.length) {
            const ownerPath = '/src/games/qidahen/ui/runtimeRegionOwnership.ts';
            const { buildQidahenRuntimeRegionIdByPixel } = await import(ownerPath);
            const image = new Image(); image.src = '/src/games/qidahen/data/region-mask.png'; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
            const owners = buildQidahenRuntimeRegionIdByPixel(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            for (const blocker of relevant) {
                const left = Math.max(0, Math.floor((blocker.left - map.left) * canvas.width / map.width));
                const right = Math.min(canvas.width, Math.ceil((blocker.right - map.left) * canvas.width / map.width));
                const top = Math.max(0, Math.floor((blocker.top - map.top) * canvas.height / map.height));
                const bottom = Math.min(canvas.height, Math.ceil((blocker.bottom - map.top) * canvas.height / map.height));
                for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
                    const id = owners[y * canvas.width + x];
                    if (id && wanted.has(id)) coveredPixels[id] = (coveredPixels[id] ?? 0) + 1;
                }
            }
        }
        return { whole, regionCount: territories.length, coveredPixels, coveredTokens };
    }, { regionIds, blockerSelectors });
}

async function clickPiece(page: Page, snapshot: Snapshot, pieceId: string) {
    const token = snapshot.core.mapTokens.find(item => item.pieceId === pieceId)!;
    expect(token, pieceId).toBeDefined();
    await page.getByTestId(`qidahen-map-token-${token.id}`).click();
}

async function submitTurnChoice(page: Page, snapshot: Snapshot, targets: string[], onSelected?: () => Promise<void>) {
    for (const id of targets) {
        if (snapshot.core.regions.some(region => !region.isLogicalRegion && region.id === id)) await clickRegion(page, id);
        else if (snapshot.core.handCards.some(card => card.id === id)) await clickCard(page, id);
        else if (snapshot.core.pieces.some(piece => piece.id === id)) await clickPiece(page, snapshot, id);
        else await page.getByTestId(`qidahen-turn-option-${id}`).click();
    }
    await onSelected?.();
    await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
    await page.getByTestId('qidahen-turn-confirm').click();
}


const summarize = (state: Snapshot) => ({ phase: state.core.turnPhase, playerId: state.core.currentPlayer, wheel: state.core.actionWheelPosition,
    year: state.core.currentYearIndex, hand: state.core.factions.ming.handCount, regions: state.core.regions.filter(region => !region.isLogicalRegion).map(region => ({ id: region.id, controller: region.controller, troops: region.troops, population: region.population })),
    cards: state.core.handCards.filter(card => card.faction === 'ming').map(card => card.id), claimed: state.core.chronology.claimedCardIds.ming,
    artillery: state.core.pieces.find(piece => piece.id === 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1')?.level });
function assertEqual(name: string, actual: unknown, expected: unknown) { expect(actual, name).toEqual(expected); return { name, actual, expected }; }
function assertOutcome(id: string, before: Snapshot, after: Snapshot) {
    const region = (state: Snapshot, regionId: string) => state.core.regions.find(item => item.id === regionId)!;
    const result: ReturnType<typeof assertEqual>[] = [];
    if (id === 'recruit-troops') result.push(assertEqual('recruit-six-level-two', region(after, 'city-region-15').troops - region(before, 'city-region-15').troops, 6));
    if (id === 'farm-target') result.push(assertEqual('farm-one-troop', region(after, 'city-region-15').troops - region(before, 'city-region-15').troops, 1), assertEqual('farm-two-actual-cards', after.core.factions.ming.handCount - before.core.factions.ming.handCount, 2));
    if (id === 'reclaim-target') result.push(assertEqual('reclaim-one-population', region(after, 'city-region-15-liaodong').population - region(before, 'city-region-15-liaodong').population, 1));
    if (id === 'hand-limit') result.push(assertEqual('six-cards-discarded-to-limit', after.core.factions.ming.handCount, 15));
    if (id === 'occupy') result.push(assertEqual('ming-controls-yehe', region(after, 'city-region-7').controller, 'ming'));
    if (id === 'upkeep-pyongyang' || id === 'upkeep-hanseong' || id === 'upkeep-liaodong') for (const piece of before.tutorial.step.allowedTargets ?? []) result.push(assertEqual('chosen-upkeep-unit-removed:' + piece, after.core.pieces.find(item => item.id === piece)?.regionId === before.core.pieces.find(item => item.id === piece)?.regionId, false));
    if (id === 'chronology-third-card') result.push(assertEqual('current-chronology-claimed', after.core.chronology.claimedCardIds.ming, [1301]), assertEqual('two-korean-cards-remain', after.core.factions.ming.handCount, 2));
    if (id === 'training-target') result.push(assertEqual('selected-artillery-trained', summarize(after).artillery, 2));
    return result;
}

test.describe('七大恨 / tutorial / 真实连续年度流程', () => {
    test.describe.configure({ timeout: 1_200_000 });
    for (const viewport of [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'mobile', width: 915, height: 412 }]) {
        test(`${viewport.name} 从正式教程入口走完核心行动、年中、新年与次年训练`, async ({ page, browser }, testInfo) => {
            const touchContext = viewport.name === 'mobile' ? await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: true, hasTouch: true }) : null;
            if (touchContext) page = await touchContext.newPage();
            page.setDefaultTimeout(15_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await setChineseLocale(page); await disableAudio(page);
            await page.addInitScript(() => { (window as unknown as { __E2E_TEST_MODE__: boolean }).__E2E_TEST_MODE__ = true; });
            const diagnostics = attachPageDiagnostics(page);
            const browserSession = await browser.newBrowserCDPSession();
            const rendererInfo = await browserSession.send('SystemInfo.getInfo'); await browserSession.detach();
            const performanceSession = await page.context().newCDPSession(page);
            await performanceSession.send('Performance.enable');
            const performanceSamples: object[] = [];
            const inputDiagnostics: object[] = [];
            const recordWheelSurface = async (reason: string) => {
                const diagnostic = await page.evaluate(reason => {
                    const state = (window as unknown as { __BG_TEST_HARNESS__: { state: { get(): { core: QidahenCore; sys: Record<string, unknown> } } } }).__BG_TEST_HARNESS__.state.get();
                    const layer = document.querySelector('[data-testid="qidahen-wheel-move-layer"]');
                    return { reason, at: Date.now(), visibility: document.visibilityState, focus: document.hasFocus(),
                        phase: state.core.turnPhase, wheel: state.core.actionWheelPosition, player: state.core.currentPlayer,
                        choices: state.core.wheelMoveChoices, wheelUsed: state.core.wheelActionUsed,
                        handLimitPending: state.core.handLimitDiscardSelection, factionUsed: state.core.factionActionUsed,
                        wheelLayer: layer?.outerHTML ?? null, boardWheelCount: document.querySelectorAll('[data-testid="qidahen-action-wheel"]').length,
                        targets: [...document.querySelectorAll('[data-testid^="qidahen-wheel-move-target-"]')].map(element => ({ id: element.getAttribute('data-testid'), display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility, disabled: element.getAttribute('aria-disabled') })),
                    };
                }, reason);
                inputDiagnostics.push(diagnostic);
                writeFileSync(resolve(root, viewport.name, 'input-diagnostics.json'), JSON.stringify(inputDiagnostics, null, 2));
            };
            const pendingRequests = new Set<string>();
            let progress = 'entry';
            page.on('request', request => pendingRequests.add(request.url()));
            page.on('requestfinished', request => pendingRequests.delete(request.url()));
            page.on('requestfailed', request => pendingRequests.delete(request.url()));
            const heartbeat = setInterval(() => console.info('ANNUAL_WAIT', JSON.stringify({ progress, pending: [...pendingRequests].slice(-12) })), 15_000);
            const files = new Map<string, string>();
            const responseUrls = new Set<string>();
            const servedSources: Array<{ path: string; responseHash: string; sourceHash?: string }> = [];
            const sourceErrors: string[] = [];
            const sourceReads: Promise<void>[] = [];
            page.on('response', response => {
                const url = new URL(response.url());
                const path = decodeURIComponent(url.pathname).replace(/^\//, '');
                const file = path.startsWith('src/') ? path : path.startsWith('locales/') ? `public/${path}` : null;
                if (file && existsSync(file) && !responseUrls.has(response.url())) {
                    responseUrls.add(response.url());
                    if (!files.has(file)) files.set(file, createHash('sha256').update(readFileSync(file)).digest('hex'));
                    sourceReads.push((async () => {
                        if (!/\.(?:[cm]?[jt]sx?|css|json)$/.test(file)) {
                            const body = await response.body();
                            const responseHash = createHash('sha256').update(body).digest('hex');
                            const isRawAsset = /^(?:image|audio|video)\//.test(response.headers()['content-type'] ?? '');
                            if (isRawAsset && responseHash !== files.get(file)) sourceErrors.push(`Served asset differs from working file: ${file}`);
                            servedSources.push({ path: file, responseHash, ...(isRawAsset ? { sourceHash: responseHash } : {}) });
                            return;
                        }
                        const body = await response.text();
                        const inline = body.match(/sourceMappingURL=data:application\/json[^,]*;base64,([^\s]+)/);
                        const original = inline ? (JSON.parse(Buffer.from(inline[1], 'base64').toString('utf8')).sourcesContent as string[] | undefined)?.[0]
                            : file.startsWith('public/locales/') ? body : undefined;
                        const hash = (value: string) => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
                        if (original != null && hash(original) !== hash(readFileSync(file, 'utf8'))) sourceErrors.push(`Served source differs from working file: ${file}`);
                        servedSources.push({ path: file, responseHash: hash(body), sourceHash: original != null ? hash(original) : undefined });
                    })().catch(error => { sourceErrors.push(`${file}: ${String(error)}`); }));
                }
            });
            const dir = resolve(root, viewport.name); mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, 'browser-renderer.json'), JSON.stringify(rendererInfo.gpu, null, 2));
            const trace: { gameId: string; evidenceCategory: string; sourceRun: string; status: string; steps: object[]; uiStates: object[]; sourceIdentity?: object; chainId: string; sourceRevision: string; browserContextId: string; outcome?: object } = {
                gameId: 'qidahen', evidenceCategory: 'tutorial', sourceRun: runId, status: 'RUNNING', steps: [], uiStates: [],
                chainId: `qidahen-annual-${viewport.name}`, sourceRevision: 'annual-revision-20', browserContextId: `${runId}:${viewport.name}`,
            };
            const uiAssertions = new Map<string, ReturnType<typeof assertEqual>[]>();
            const capture = async (id: string, suffix = '', behaviorStepId = id) => {
                progress = `capture:${id}${suffix}`;
                await page.evaluate(async () => {
                    const finite = document.getAnimations().filter(animation => animation.playState === 'running'
                        && Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity));
                    await Promise.allSettled(finite.map(animation => animation.finished));
                    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                });
                await expect(page.getByTestId('qidahen-draw-anchor')).toBeVisible();
                await expect(page.getByTestId('qidahen-discard-anchor')).toBeVisible();
                if (['recruit-troops', 'tactic-card', 'occupy'].includes(id)) {
                    await expect(page.getByTestId('qidahen-map-region-tip'), 'active decisions use the real map and formal panel, without duplicate identity strip').toHaveCount(0);
                }
                if (id === 'occupy') {
                    const occlusion = await mapRegionOcclusion(page, ['city-region-15', 'city-region-7'], ['[data-testid="qidahen-actions-zone"]', '[data-testid="tutorial-overlay-card"]']);
                    expect(occlusion.regionCount, 'both engagement territories are protected').toBeGreaterThanOrEqual(2);
                    expect(occlusion.whole, 'both complete territories remain inside the viewport').toBe(true);
                    expect(occlusion.coveredPixels, 'no actual source or target region pixel is hidden by panel or tutorial').toEqual({});
                    expect(occlusion.coveredTokens, 'no source or target troop/control token is hidden').toEqual([]);
                }
                const hintCard = page.getByTestId('tutorial-overlay-card');
                if (await hintCard.isVisible()) {
                    const geometry = await page.evaluate(() => {
                        const h = document.querySelector('[data-testid="tutorial-overlay-card"]')!.getBoundingClientRect();
                        const box = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
                        return { hint: box(h),
                            tokens: [...document.querySelectorAll('[data-qidahen-map-protected-token="true"]')].map(element => ({ id: element.getAttribute('data-testid'), rect: box(element.getBoundingClientRect()) })),
                            regions: [...document.querySelectorAll('[data-qidahen-map-selection-space], [data-qidahen-battle-region-space]')].map(element => ({ id: element.getAttribute('data-qidahen-battle-region-space') ?? element.getAttribute('data-qidahen-map-selection-space'), rect: box(element.getBoundingClientRect()) })),
                        };
                    });
                    const hint = geometry.hint;
                    for (const token of geometry.tokens) {
                        const rect = token.rect;
                        expect(hint.x < rect.x + rect.width && hint.x + hint.width > rect.x && hint.y < rect.y + rect.height && hint.y + hint.height > rect.y, 'tutorial cannot cover focused troop/control marker: ' + JSON.stringify({ id: token.id, hint, rect })).toBe(false);
                    }
                    const intersecting = geometry.regions.filter(({ rect }) => hint.x < rect.x + rect.width && hint.x + hint.width > rect.x && hint.y < rect.y + rect.height && hint.y + hint.height > rect.y).map(region => region.id).filter((id): id is string => id != null);
                    if (intersecting.length) {
                        const occlusion = await mapRegionOcclusion(page, intersecting, ['[data-testid="tutorial-overlay-card"]']);
                        expect(occlusion.coveredPixels, 'tutorial cannot cover actual selectable/engaged territory pixels').toEqual({});
                        expect(occlusion.coveredTokens, 'tutorial cannot cover any relevant troop or control marker').toEqual([]);
                    }
                }
                if (id === 'dispatch-troops') {
                    const hint = (await page.getByTestId('tutorial-overlay-card').boundingBox())!;
                    const troops = await page.locator('[data-pending-committed-selectable="true"]').all();
                    expect(troops.length).toBeGreaterThan(0);
                    for (const troop of troops) {
                        const rect = (await troop.boundingBox())!;
                        expect(rect.y, 'whole selectable troop above screen edge').toBeGreaterThanOrEqual(0);
                        const covered = hint.x < rect.x + rect.width && hint.x + hint.width > rect.x && hint.y < rect.y + rect.height && hint.y + hint.height > rect.y;
                        expect(covered, 'tutorial text must not cover any selectable troop').toBe(false);
                    }
                }
                if (id === 'occupy') {
                    const hint = await page.getByTestId('tutorial-overlay-card').boundingBox();
                    expect(hint, 'post-battle rules remain visible').toBeTruthy();
                    for (const mode of ['occupy', 'withdraw']) {
                        const choice = page.getByTestId('qidahen-post-battle-mode-' + mode);
                        await expect(choice).toBeVisible();
                        const r = (await choice.boundingBox())!;
                        expect(r.y >= 0 && r.y + r.height <= viewport.height, mode + ' remains fully visible on the first screen').toBe(true);
                        expect(Boolean(hint && hint.x < r.x + r.width && hint.x + hint.width > r.x && hint.y < r.y + r.height && hint.y + hint.height > r.y), mode + ' cannot be visually covered by the tutorial').toBe(false);
                    }
                    const button = page.getByTestId('qidahen-post-battle-mode-occupy');
                    const decision = (await button.boundingBox())!;
                    const slot = (await page.getByTestId('qidahen-action-slot').boundingBox())!;
                    expect(decision.y, 'post-battle decision appears at initial scroll position').toBeGreaterThanOrEqual(slot.y);
                    expect(decision.y + decision.height, 'decision is not below the report fold').toBeLessThanOrEqual(slot.y + slot.height);
                    await expect.poll(() => button.evaluate(element => {
                        const rect = element.getBoundingClientRect();
                        return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
                    })).toBe(true);
                }
                if (id === 'training-target') {
                    const panel = (await page.getByTestId('qidahen-actions-zone').boundingBox())!;
                    const discard = (await page.getByTestId('qidahen-discard-anchor').boundingBox())!;
                    const ring = (await page.getByTestId('tutorial-highlight-ring').boundingBox())!;
                    expect(ring.y + ring.height, 'training highlight stays above discard pile').toBeLessThanOrEqual(discard.y - 2);
                    expect(panel.y + panel.height, 'training candidate panel stays above the real discard pile').toBeLessThanOrEqual(discard.y - 4);
                }
                if (id === 'upkeep-yehe' && suffix === '-selected') {
                    const ids = (await read(page)).tutorial.step.allowedTargets!;
                    mkdirSync(testInfo.outputDir, { recursive: true });
                    writeFileSync(resolve(testInfo.outputDir, 'selected-render.json'), JSON.stringify(await page.evaluate(() => {
                        const dock = document.querySelector<HTMLElement>('[data-testid="qidahen-hand-zone"]')!;
                        return { at: Date.now(), scrollLeft: dock.scrollLeft, scrollTop: dock.scrollTop, selected: [...document.querySelectorAll('[data-qidahen-hand-card-selected="true"]')].map(element => {
                            const r = element.getBoundingClientRect(); return { id: element.getAttribute('data-testid'), bounds: { x: r.x, y: r.y, width: r.width, height: r.height }, transform: getComputedStyle(element).transform, lift: getComputedStyle(element).getPropertyValue('--qidahen-card-rest-lift') };
                        }) };
                    }), null, 2));

                    for (const cardId of ids) {
                        await expect(page.getByTestId(`qidahen-hand-card-shell-${cardId}`)).toHaveAttribute('data-qidahen-hand-card-selected', 'true');
                        await expect(page.getByTestId(`qidahen-hand-card-selected-badge-${cardId}`)).toBeInViewport({ ratio: 0.95 });
                    }
                    let previous = '';
                    await expect.poll(async () => {
                        const current = JSON.stringify(await page.locator('[data-qidahen-hand-card-selected="true"]').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })));
                        const stable = previous === current; previous = current; return stable;
                    }).toBe(true);
                }
                const path = resolve(dir, `${String(trace.uiStates.length).padStart(2, '0')}-${id}${suffix}.png`);
                await page.screenshot({ path, fullPage: false, timeout: 10_000 });
                if (id === 'upkeep-yehe' && suffix === '-selected') {
                    const session = await page.context().newCDPSession(page);
                    const direct = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
                    writeFileSync(resolve(testInfo.outputDir, 'selected-direct.png'), Buffer.from(direct.data, 'base64'));
                    await session.detach();
                }
                trace.uiStates.push({ id: `${id}${suffix}`, stepId: behaviorStepId, path, viewport: viewport.name, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
            };
            const browseHand = async () => {
                const selected = () => page.locator('[data-qidahen-hand-card-selected="true"]').evaluateAll(elements => elements.map(element => element.getAttribute('data-testid')).sort());
                const selectedBefore = await selected();
                const handBefore = (await read(page)).core.handCards.map(card => card.id);
                const scroll = async (direction: 'left' | 'right') => {
                    const button = page.getByTestId('qidahen-hand-scroll-' + direction);
                    for (let count = 0; count < 16 && await button.isEnabled(); count += 1) {
                        const before = await page.getByTestId('qidahen-hand-zone').evaluate(element => element.scrollLeft);
                        await clickVisibleButton(page, 'qidahen-hand-scroll-' + direction);
                        await page.getByTestId('qidahen-hand-zone').evaluate(async (element, previous) => {
                            const deadline = performance.now() + 5000; let last = previous; let stable = 0; let changed = false;
                            while (performance.now() < deadline) {
                                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                                const value = element.scrollLeft; changed ||= Math.abs(value - previous) > 1;
                                stable = value === last ? stable + 1 : 0; last = value;
                                if (changed && stable >= 3) return;
                            }
                            throw new Error('hand scroll control did not move and settle');
                        }, before);
                    }
                    await expect(button).toBeDisabled();
                };
                await expect(page.getByTestId('qidahen-hand-scroll-right')).toBeVisible();
                await scroll('right');
                await expect(page.getByTestId('qidahen-hand-scroll-left')).toBeEnabled();
                await capture('hand-scroll-end', '', 'upkeep-yehe');
                const endSelection = await selected();
                await scroll('left');
                const afterSelection = await selected();
                uiAssertions.set('upkeep-yehe', [
                    assertEqual('hand-browse-keeps-selected-payment-at-end', endSelection, selectedBefore),
                    assertEqual('hand-browse-restores-selected-payment', afterSelection, selectedBefore),
                    assertEqual('hand-browse-keeps-real-hand-identities', (await read(page)).core.handCards.map(card => card.id), handBefore),
                ]);
                for (const id of (await read(page)).tutorial.step.allowedTargets ?? []) await expect(page.getByTestId('qidahen-hand-card-selected-badge-' + id)).toBeInViewport({ ratio: 0.95 });
            };
            try {
                progress = 'navigate';
                await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded', timeout: 45_000 });
                console.info('ANNUAL_ENTRY', JSON.stringify({ body: (await page.locator('body').innerText()).slice(0, 600), state: await read(page).then(value => value.tutorial.step?.id).catch(() => null) }));
                await page.waitForFunction(() => document.querySelector('[data-tutorial-step="frontier-goal"]') || document.body.innerText.includes('游戏加载失败'), undefined, { timeout: 120_000 });
                await expect(page.locator('[data-tutorial-step="frontier-goal"]')).toBeVisible();
                await Promise.all(sourceReads); expect(sourceErrors).toEqual([]);
                for (let guard = 0; guard < 100; guard += 1) {
                    const snapshot = await read(page);
                    if (!snapshot.tutorial.active) break;
                    const step = snapshot.tutorial.step;
                    progress = step.id;
                    console.info('ANNUAL_STEP', step.id);
                    await expect.poll(async () => Boolean((await read(page)).tutorial.step?.aiActions?.length), { timeout: 60_000 }).toBe(false);
                    const metrics = await performanceSession.send('Performance.getMetrics');
                    performanceSamples.push({ step: step.id, at: Date.now(), metrics: Object.fromEntries(metrics.metrics.filter(item => ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'JSHeapUsedSize', 'Nodes'].includes(item.name)).map(item => [item.name, item.value])) });
                    const thinkingMs = Number(process.env.QIDAHEN_ANNUAL_HAND_LIMIT_THINK_MS ?? 0);
                    if (step.id === 'hand-limit' && thinkingMs > 0) {
                        const thinkingCore = (await read(page)).core;
                        await recordWheelSurface('hand-limit-before-thinking');
                        for (let elapsed = 0; elapsed < thinkingMs; elapsed += 50_000) {
                            await page.waitForTimeout(Math.min(50_000, thinkingMs - elapsed));
                        }
                        await recordWheelSurface('hand-limit-after-thinking');
                        expect((await read(page)).core, 'thinking before discard cannot advance or mutate the game').toEqual(thinkingCore);
                    }
                    const before = await read(page);
                    const beforeVisible = await page.locator('body').innerText();
                    if (step.id === 'farm-target') {
                        const other = before.interaction!.data.options.find(option => option.id !== 'city-region-15' && before.core.regions.some(region => !region.isLogicalRegion && region.id === option.id));
                        expect(other, 'another formally legal farm region remains selectable').toBeDefined();
                        await clickRegion(page, other!.id);
                        await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
                        await page.getByTestId('qidahen-turn-confirm').click();
                        await expect.poll(async () => ({ id: await stepId(page), core: (await read(page)).core })).toEqual({ id: step.id, core: before.core });
                        await expect(page.getByTestId('qidahen-turn-confirm')).toBeDisabled();
                        trace.steps.push({ id: 'farm-alternative-checkpoint', action: 'select-other-legal-region-and-confirm', targetIds: [other!.id],
                            before: { visible: { text: beforeVisible }, authoritative: summarize(before) },
                            after: { visible: { text: await page.locator('body').innerText() }, authoritative: summarize(await read(page)) },
                            assertions: [assertEqual('same-step-restored', await stepId(page), step.id), assertEqual('no-resource-or-board-change', (await read(page)).core, before.core)] });
                    }
                    const finishBattleRecording = step.id === 'battle-roll' ? await beginBattleRecording(page, dir) : undefined;
                    if (step.id === 'recruit-troops') await assertWholeRegionVisible(page, 'city-region-15');
                    if ((viewport.name === 'desktop' ? KEY_STATES : MOBILE_STATES).has(step.id)) await capture(step.id);
                    if (step.id === 'recruit-payment') {
                        const handBefore = before.core.factions.ming.handCount;
                        if (touchContext) {
                            const card = page.getByTestId('qidahen-hand-card-hand-3');
                            const rect = (await card.boundingBox())!;
                            const session = await page.context().newCDPSession(page);
                            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + 15, y: rect.y + 15 }] });
                            await page.waitForTimeout(650);
                            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                            await session.detach();
                        } else await page.getByTestId('qidahen-hand-card-magnify-hand-3').click();
                        await waitMagnifyReady(page);
                        await capture(step.id, '-inspect');
                        expect((await read(page)).core.factions.ming.handCount).toBe(handBefore);
                        expect((await read(page)).core.selectedPaymentCardIds).toEqual([]);
                        await page.getByTestId('qidahen-card-magnify-overlay').getByRole('button', { name: /关闭/ }).click();
                    }
                    if (step.id === 'year-character') {
                        await page.getByTestId(`qidahen-turn-inspect-${step.allowedTargets![0]}`).click();
                        await waitMagnifyReady(page);
                        await capture(step.id, '-inspect');
                        await page.getByTestId('qidahen-card-magnify-overlay').getByRole('button', { name: /关闭/ }).click();
                    }
                    if (step.infoStep) {
                        await clickVisibleButton(page, 'tutorial-next-button');
                    } else {
                        const command = step.allowedCommands![0];
                        const targets = step.allowedTargets ?? [];
                        if (command === 'SYS_INTERACTION_RESPOND') {
                            if (before.interaction?.data.sourceId === 'qidahen:turn-resolution-choice') await submitTurnChoice(page, before, targets,
                                ['dispatch-troops', 'upkeep-yehe', 'upkeep-pyongyang'].includes(step.id) ? async () => { await capture(step.id, '-selected'); if (step.id === 'upkeep-yehe') await browseHand(); } : undefined);
                            else if (step.id === 'hand-limit') {
                                for (const id of targets) await clickCard(page, id);
                                await page.getByTestId('qidahen-resolve-hand-limit-discard').click();
                            } else if (step.id === 'recruit-troops') await page.getByTestId(`qidahen-recruit-choice-${targets[0]}`).click();
                            else if (step.id === 'battle-roll') {
                                for (const id of before.core.pendingTargetAction!.forceCommitments!.flatMap(force => force.selectedSpecialPieceIds ?? [])) {
                                    const token = before.core.mapTokens.find(token => token.pieceId === id)!;
                                    await expect(page.getByTestId(`qidahen-map-token-${token.id}`)).toHaveAttribute('data-pending-committed-selected', 'true');
                                }
                                await expect(page.getByTestId('qidahen-pending-committed-troops')).toHaveCount(0);
                                await page.getByTestId('qidahen-resolve-pending-action').click();
                            }
                            else if (step.id === 'occupy') {
                                await page.getByTestId('qidahen-post-battle-mode-occupy').click();
                                await page.getByTestId('qidahen-post-battle-choice-occupy').click();
                                await page.getByTestId('qidahen-post-battle-confirm').click();
                            } else throw new Error(`Missing formal SYS input ${step.id}`);
                        } else if (command === 'EXECUTE_WHEEL_MOVE') {
                            await recordWheelSurface('before-' + step.id);
                            await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();
                        }
                        else if (command === 'SELECT_REGION') await clickRegion(page, targets[0]);
                        else if (command === 'CONFIRM_PREVIEW_ACTION') {
                            if (step.id === 'recruit-action') await page.getByTestId('qidahen-action-recruit').click();
                            else await clickCard(page, targets[0]);
                        } else if (command === 'SELECT_PAYMENT_CARD') await clickCard(page, targets[0]);
                        else if (command === 'EXECUTE_SELECTED_ACTION') await page.getByTestId('qidahen-action-payment-confirm').click();
                        else if (command === 'PLAY_TACTIC_CARD') {
                            await clickCard(page, targets[0]); await capture(step.id, '-selected');
                            await page.getByTestId('qidahen-confirm-tactic-card').click();
                        } else if (command === 'CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT') await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();
                        else if (command === 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE') await page.getByTestId(`qidahen-wheel-recruit-train-choice-${encodeURIComponent(targets[0])}`).click();
                        else throw new Error(`Missing real input ${command}`);
                    }
                    if (step.id === 'battle-roll') {
                        await expect(page.getByTestId('qidahen-battle-roll-sequence')).toBeVisible();
                        await expect(page.getByTestId('qidahen-battle-roll-sequence')).toBeHidden({ timeout: 90_000 });
                        const recording = await finishBattleRecording!();
                        for (const picture of recording.pictures) trace.uiStates.push({ ...picture, stepId: step.id, viewport: viewport.name, sha256: createHash('sha256').update(readFileSync(picture.path)).digest('hex') });
                        trace.uiStates.push({ id: 'battle-real-time', stepId: step.id, path: recording.video, viewport: viewport.name,
                            frameCount: recording.frameCount, durationSeconds: recording.durationSeconds, sha256: createHash('sha256').update(readFileSync(recording.video)).digest('hex') });
                    }
                    await expect.poll(() => stepId(page), { timeout: 60_000, message: `${step.id} should advance through its real event` }).not.toBe(step.id);
                    const after = await read(page);
                    trace.steps.push({ id: step.id, action: step.infoStep ? 'manual-next' : step.allowedCommands![0], targetIds: step.allowedTargets,
                        before: { visible: { text: beforeVisible }, authoritative: summarize(before) },
                        after: { visible: { text: await page.locator('body').innerText() }, authoritative: summarize(after) },
                        assertions: [assertEqual('formal-event-advanced-step', after.tutorial.step?.id !== step.id, true), ...assertOutcome(step.id, before, after), ...(uiAssertions.get(step.id) ?? [])],
                    });
                    writeFileSync(resolve(dir, 'behavior-trace.json'), JSON.stringify(trace, null, 2));
                }
                const final = await read(page);
                expect(final.tutorial.active).toBe(false);
                expect(final.core.currentYearIndex).toBe(1);
                expect(final.core.chronology.claimedCardIds.ming).toEqual([1301]);
                expect(final.core.regions.find(region => region.id === 'city-region-7')?.controller).toBe('ming');
                expect(final.core.pieces.find(piece => piece.id === 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1')?.level).toBe(2);
                expect(trace.steps).toHaveLength(73);
                await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
                await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();
                await expect(page.getByTestId('qidahen-turn-choice')).toBeVisible();
                await assertNoFatalFrontendErrors([{ label: viewport.name, diagnostics }]);
                for (const [file, hash] of files) expect(createHash('sha256').update(readFileSync(file)).digest('hex'), `source changed: ${file}`).toBe(hash);
                await Promise.all(sourceReads); expect(sourceErrors).toEqual([]);
                trace.outcome = { tutorialActive: final.tutorial.active, year: final.core.currentYearIndex, claimed: final.core.chronology.claimedCardIds.ming, nextInputAccepted: true };
                trace.status = 'PASS'; trace.sourceIdentity = { method: 'actual-browser-responses-and-inline-source-maps', files: [...files].map(([path, hash]) => ({ path, hash })), servedSources };
            } catch (error) {
                trace.status = 'FAIL';
                console.info('ANNUAL_ERROR', String(error));
                await recordWheelSurface('failure-' + progress).catch(error => console.info('WHEEL_DIAGNOSTIC_ERROR', String(error)));
                console.info('ANNUAL_FAILURE', JSON.stringify({ progress, pending: [...pendingRequests], errors: diagnostics.errors }));
                const layoutDiagnostic = await page.evaluate(() => {
                    const card = document.querySelector<HTMLElement>('[data-testid="tutorial-overlay-card"]');
                    const rect = (element: Element | null) => { const r = element?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; };
                    const state = (window as unknown as { __BG_TEST_HARNESS__: { state: { get(): Snapshot } } }).__BG_TEST_HARNESS__.state.get();
                    const step = (state as unknown as { sys: { tutorial: Snapshot['tutorial'] } }).sys.tutorial.step;
                    const content = card?.querySelector<HTMLElement>('[data-testid="tutorial-overlay-content"]');
                    return { at: Date.now(), viewport: { width: innerWidth, height: innerHeight }, step,
                        card: rect(card), wrapper: rect(card?.parentElement ?? null), wrapperStyle: card?.parentElement?.getAttribute('style'),
                        content: rect(content ?? null), contentSize: content ? { scrollHeight: content.scrollHeight, clientHeight: content.clientHeight } : null,
                        protected: (step.avoidOverlapSelectors ?? []).flatMap(selector => [...document.querySelectorAll(selector)].map(element => ({ selector, id: element.getAttribute('data-testid'), rect: rect(element) }))),
                        saved: Object.keys(localStorage).filter(key => key.startsWith('local_match_snapshot_v1:qidahen:')).map(key => ({ key, snapshot: localStorage.getItem(key) })),
                    };
                }).catch(error => ({ error: String(error) }));
                writeFileSync(resolve(dir, 'layout-failure.json'), JSON.stringify(layoutDiagnostic, null, 2));
                const diagnostic = resolve(testInfo.outputDir, 'annual-failure.png');
                await page.screenshot({ path: diagnostic, timeout: 5000 }).catch(() => {});
                console.info('ANNUAL_FAILED_STATE', JSON.stringify(await Promise.race([
                    read(page).then(state => ({ step: state.tutorial.step?.id, phase: state.core.turnPhase, choice: state.interaction?.data })).catch(() => null),
                    new Promise(resolve => setTimeout(() => resolve('state-read-timeout'), 2000)),
                ])));
                throw error;
            } finally {
                clearInterval(heartbeat);
                await performanceSession.detach().catch(() => {});
                writeFileSync(resolve(dir, 'browser-performance.json'), JSON.stringify(performanceSamples, null, 2));
                writeFileSync(resolve(dir, 'behavior-trace.json'), JSON.stringify(trace, null, 2));
                await touchContext?.close();
            }
        });
    }
});
