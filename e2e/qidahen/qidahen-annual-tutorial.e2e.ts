import { verifyQidahenMapCandidateRecovery } from './mapCandidateRecovery';
import { dragQidahenMap } from './mapPointer';
import { trackQidahenBlobUrls } from './blobUrlDiagnostics';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, disableAudio, setChineseLocale } from '../helpers/common';
import type { QidahenCore } from '../../src/games/qidahen/domain/types';
import type { TutorialStepSnapshot } from '../../src/engine/types';
import { beginBattleRecording } from './battleRecording';
import { clickVisibleButton } from './tutorialPointer';
import { waitForQidahenVisualReady } from './visualReady';
import { QIDAHEN_VISUAL_SOURCE_PATHS, requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from './sourceIdentity';
import { readQidahenStoredTutorialStep, readQidahenTutorialProgressStatus } from './tutorialPersistence';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../../src/games/qidahen/annualTutorial';

// 七大恨的图集地图与物理骰子按正常浏览器GPU呈现；不继承Windows软件光栅化测试开关。
test.use({ channel: process.env.QIDAHEN_DIAGNOSTIC_BROWSER_CHANNEL || 'chromium', launchOptions: { args: [] } });

const runId = process.env.QIDAHEN_ANNUAL_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const root = resolve(process.env.QIDAHEN_ANNUAL_EVIDENCE_ROOT ?? `test-results/evidence-screenshots/_shared/qidahen-连续年度教程/${runId}`);
const captureContractPath = resolve('docs/games/qidahen/records/qidahen-annual-required-ui-states.json');
const captureContractBytes = readFileSync(captureContractPath);
const captureContract = JSON.parse(captureContractBytes.toString('utf8')) as {
    requiredStates: Array<{ chainId: string; uiStateId: string; viewport: string }>;
};
const KEY_STATES = new Set(['frontier-goal', 'frontier-target', 'opening-move', 'recruit-action', 'recruit-source', 'recruit-payment', 'recruit-troops', 'farm-action', 'reclaim-action', 'reclaim-target',
    'recruit-confirm', 'midyear', 'hand-limit', 'upgrade-card', 'dispatch-source', 'dispatch-troops', 'dispatch-target', 'tactic-card', 'occupy', 'battle-finish',
    'diplomacy-target', 'diplomacy-finish', 'hire-action', 'hire-target', 'save-hand', 'new-year', 'maintain-shanhai', 'abandon-jinzhou', 'abandon-inner-wall', 'abandon-outer-wall', 'upkeep-datong', 'upkeep-yehe', 'upkeep-pyongyang', 'claim-year',
    'new-order', 'year-character', 'training-kind', 'training-target', 'training-second-target', 'training-recruit-target', 'training-finish', 'finish']);
const MOBILE_STATES = new Set(['frontier-goal', 'recruit-payment', 'reclaim-target', 'midyear', 'hand-limit', 'dispatch-troops', 'occupy', 'maintain-shanhai', 'year-character', 'finish', 'diplomacy-target', 'diplomacy-finish', 'hire-target', 'training-target', 'training-second-target', 'training-finish']);

type Snapshot = {
    core: QidahenCore;
    tutorial: { active: boolean; step: TutorialStepSnapshot; pendingAnimationAdvance: boolean };
    interaction: { id: string; playerId: string; data: { sourceId?: string; multi?: { min: number; max: number }; options: Array<{ id: string; disabled?: boolean }> } } | null;
};
const read = (page: Page): Promise<Snapshot> => page.evaluate(() => {
    const state = (window as unknown as { __BG_TEST_HARNESS__: { state: { get(): { core: QidahenCore; sys: Record<string, unknown> } } } }).__BG_TEST_HARNESS__.state.get();
    const tutorial = state.sys.tutorial as Snapshot['tutorial'];
    return { core: state.core, tutorial: { active: tutorial.active, step: tutorial.step, pendingAnimationAdvance: tutorial.pendingAnimationAdvance }, interaction: (state.sys.interaction as { current: unknown }).current } as Snapshot;
});
const stepId = (page: Page): Promise<string | undefined> => page.evaluate(() =>
    (window as any).__BG_TEST_HARNESS__.state.get().sys.tutorial.step?.id);

/** 同一正式外交选择状态逐候选用鼠标探测；不点击或改写局面。 */
async function probeDiplomacyCandidates(page: Page, ids: string[], selectId?: string) {
    const positions = await page.evaluate(async ids => {
        const ownerPath = '/src/games/qidahen/ui/runtimeRegionOwnership.ts';
        const { buildQidahenRuntimeRegionIdByPixel } = await import(ownerPath);
        const image = new Image(); image.src = '/src/games/qidahen/data/region-mask.png'; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
        const owners = buildQidahenRuntimeRegionIdByPixel(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        const result: Record<string, Array<{ x: number; y: number }>> = Object.fromEntries(ids.map(id => [id, []]));
        for (let y = 2; y < canvas.height; y += 4) for (let x = 2; x < canvas.width; x += 4) {
            const id = owners[y * canvas.width + x];
            if (id && result[id]) result[id].push({ x, y });
        }
        return result;
    }, ids);
    const view = () => page.getByTestId('qidahen-map-layer').evaluate(node => ({ x: Number(node.getAttribute('data-map-pan-x')), y: Number(node.getAttribute('data-map-pan-y')) }));
    const initialView = await view();
    const observations: Array<{ id: string; point: { x: number; y: number }; title: string }> = [];
    for (const id of ids) {
        expect(positions[id]?.length, `外交候选 ${id} 有正式地区命中像素`).toBeGreaterThan(0);
        let hit: { x: number; y: number } | null = null;
        for (let attempt = 0; attempt < 6 && !hit; attempt++) {
            const geometry = await page.evaluate(points => {
                const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="qidahen-map-hitmap-canvas"]')!;
                const rect = canvas.getBoundingClientRect();
                const screen = points.map(point => ({ x: rect.left + (point.x + .5) / 1265 * rect.width, y: rect.top + (point.y + .5) / 893 * rect.height }));
                const visible = screen.find(point => point.x > 12 && point.x < innerWidth - 12 && point.y > 90 && point.y < innerHeight - 120
                    && document.elementFromPoint(point.x, point.y) === canvas);
                const nearest = screen.reduce((best, point) => Math.hypot(point.x - innerWidth / 2, point.y - innerHeight / 2)
                    < Math.hypot(best.x - innerWidth / 2, best.y - innerHeight / 2) ? point : best);
                return { visible: visible ?? null, nearest };
            }, positions[id]);
            hit = geometry.visible;
            if (!hit) await dragQidahenMap(page, Math.max(-200, Math.min(200, 960 - geometry.nearest.x)), Math.max(-150, Math.min(150, 540 - geometry.nearest.y)));
        }
        expect(hit, `外交候选 ${id} 须有可见且未被 UI 覆盖的地图输入点`).not.toBeNull();
        await page.mouse.move(hit!.x, hit!.y);
        const name = (await read(page)).core.regions.find(region => region.id === id)?.name;
        expect(name, `外交候选 ${id} 的真实地区名称`).toBeTruthy();
        await expect(page.getByTestId('qidahen-map-hitmap-canvas'), `外交候选 ${id} 鼠标悬停地区`).toHaveAttribute('title', new RegExp(name!));
        observations.push({ id, point: hit!, title: (await page.getByTestId('qidahen-map-hitmap-canvas').getAttribute('title'))! });
        console.info('DIPLOMACY_HOVER', JSON.stringify(observations[observations.length - 1]));
        if (id === selectId) {
            await page.mouse.click(hit!.x, hit!.y);
            return observations;
        }
    }
    for (let attempt = 0; attempt < 20; attempt++) {
        const currentView = await view();
        const dx = initialView.x - currentView.x, dy = initialView.y - currentView.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        await dragQidahenMap(page, Math.max(-200, Math.min(200, dx)), Math.max(-150, Math.min(150, dy)));
    }
    await expect.poll(async () => Math.abs((await view()).x - initialView.x)).toBeLessThan(2);
    await expect.poll(async () => Math.abs((await view()).y - initialView.y)).toBeLessThan(2);
    return observations;
}



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

async function clickCard(page: Page, id: string, selectionChanges = true) {
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
    if (coarse) {
        const point = await visiblePoint(); await page.touchscreen.tap(point.x, point.y);
    } else {
        let clicked = false;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const point = await visiblePoint();
            await page.mouse.move(point.x, point.y);
            await shell.evaluate(async element => {
                await Promise.allSettled(element.getAnimations({ subtree: true })
                    .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity))
                    .map(animation => animation.finished));
            });
            await visiblePoint();
            const stillOverCard = await card.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), point);
            if (!stillOverCard) continue;
            // 留在玩家实际悬停点点击；再次移动到抬升后的顶部会触发另一轮换牌。
            await page.mouse.down(); await page.mouse.up(); clicked = true; break;
        }
        expect(clicked, 'actual hover point remains on the intended card before clicking').toBe(true);
    }
    if (selectionChanges) await expect.poll(async () => await shell.getAttribute('data-qidahen-hand-card-selected') === 'true', { message: 'this card selection actually changed' }).toBe(!wasSelected);
}

async function clickRegion(page: Page, regionId: string, tokenTestId?: string) {
    const point = tokenTestId ? await page.getByTestId(tokenTestId).evaluate(element => ({
        x: parseFloat((element as HTMLElement).style.left), y: parseFloat((element as HTMLElement).style.top),
    })) : await page.evaluate(async id => {
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

/** 完整交战视窗与实际兵牌核查；地图纹理不作为界面的排斥层。 */
async function mapRegionOcclusion(page: Page, regionIds: string[], blockerSelectors: string[]) {
    return page.evaluate(async ({ regionIds, blockerSelectors }) => {
        const wanted = new Set(regionIds);
        const blockers = blockerSelectors.flatMap(selector => [...document.querySelectorAll(selector)]).map(element => element.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
        const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const territories = [...document.querySelectorAll<HTMLElement>('[data-qidahen-battle-region-space], [data-qidahen-map-selection-space]')].filter(element => wanted.has(element.dataset.qidahenBattleRegionSpace ?? element.dataset.qidahenMapSelectionSpace ?? ''));
        const bounds = territories.map(element => element.getBoundingClientRect());
        const whole = bounds.every(r => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight);
        const tokens = [...document.querySelectorAll<HTMLElement>('[data-qidahen-map-token-region]')].filter(element => wanted.has(element.dataset.qidahenMapTokenRegion ?? ''));
        const coveredTokens = tokens.filter(element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && blockers.some(b => overlaps(r, b)); }).map(element => element.getAttribute('data-testid'));
        return { whole, regionCount: territories.length, coveredTokens };
    }, { regionIds, blockerSelectors });
}

async function clickPiece(page: Page, snapshot: Snapshot, pieceId: string) {
    const token = snapshot.core.mapTokens.find(item => item.pieceId === pieceId)!;
    expect(token, pieceId).toBeDefined();
    await page.getByTestId(`qidahen-map-token-${token.id}`).click();
}

async function submitTurnChoice(page: Page, snapshot: Snapshot, targets: string[], onSelected?: () => Promise<void>) {
    if (targets.length === 1 && targets[0].startsWith('hand-action:')) {
        const button = page.getByTestId(`qidahen-action-${targets[0].slice('hand-action:'.length)}`);
        const beforeHover = (await button.boundingBox())!;
        await button.hover();
        await expect.poll(async () => Math.abs((await button.boundingBox())!.x - beforeHover.x)).toBeLessThan(2);
        await button.click();
        await onSelected?.();
        return;
    }
    if (targets.length === 1 && ['opening-farm-cycle', 'diplomacy-cycle'].includes(snapshot.tutorial.step.id)
        && ['military-farm', 'reclaim', 'diplomacy', 'hire', 'finish-slot', 'finish-diplomacy', 'skip-hand'].includes(targets[0])) {
        await page.getByTestId(`qidahen-turn-option-${targets[0]}`).click();
        await onSelected?.();
        return;
    }
    if (snapshot.tutorial.step.advanceOnEvents?.some(event => event.type === 'TURN_RESOLUTION_APPLIED' && (event.match?.fromStep === 'menu' || event.match?.fromStep === 'finish-hand'))) {
        expect(targets).toHaveLength(1);
        await expect(page.getByTestId('qidahen-turn-confirm')).toHaveCount(0);
        if (targets[0].startsWith('hand-card:')) {
            await expect(page.getByTestId('qidahen-turn-choice')).toHaveCount(0);
            await clickCard(page, targets[0].slice('hand-card:'.length), false);
        } else if (targets[0].startsWith('hand-action:')) {
            const button = page.getByTestId(`qidahen-action-${targets[0].slice('hand-action:'.length)}`);
            const beforeHover = (await button.boundingBox())!;
            await button.hover();
            await expect.poll(async () => Math.abs((await button.boundingBox())!.x - beforeHover.x), { message: 'hand action hover must not inherit the parent horizontal centering transform' }).toBeLessThan(2);
            await button.click();
        } else {
            // 该按钮只推进本局状态，不需要等待浏览器导航；后续仍断言正式事件和下一节点。
            await page.getByTestId(`qidahen-turn-option-${targets[0]}`).click({ noWaitAfter: targets[0] === 'skip-hand' });
        }
        await onSelected?.();
        return;
    }
    const directButton = page.getByTestId(`qidahen-turn-option-${targets[0]}`);
    if (targets.length === 1 && await directButton.count() > 0 && await directButton.getAttribute('data-qidahen-direct-choice') === 'true') {
        await page.getByTestId(`qidahen-turn-option-${targets[0]}`).click();
        await onSelected?.();
        return;
    }
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

function annualDynamicTargets(snapshot: Snapshot): string[] {
    const step = snapshot.tutorial.step;
    const valid = snapshot.interaction?.data.options.filter(option => !option.disabled).map(option => option.id) ?? [];
    if (step.id === 'dispatch-source') return ['city-region-15'];
    if (step.id === 'dispatch-troops') {
        const farm = snapshot.core.pieces.find(piece => piece.sourceStackId.startsWith('ming-farm-') && piece.regionId === 'city-region-15');
        if (!farm) throw new Error('真实军屯步兵不存在');
        return [farm.id, 'ming-post-sarhu-1619-liaobei-cavalry-cavalry-lv1__compat__1', 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1'];
    }
    if (step.id === 'dispatch-target') return ['city-region-7'];
    if (step.id === 'battle-roll' || step.id === 'battle-roll-followup') return ['fight'];
    if (step.id === 'occupy') return ['occupy'];
    if (step.id === 'season-chronology-payment') return valid.slice(0, 1);
    if (!step.id.startsWith('season-upkeep-player-')) return step.allowedTargets ?? [];
    const regionId = step.highlightTarget?.replace('qidahen-map-region-focus-', '') ?? '';
    const special: Record<string, string> = {
        'city-region-1': 'ming-post-sarhu-1619-datong-regular-infantry-lv1__compat__1',
        'city-region-18': 'ming-post-sarhu-1619-pyongyang-mercenary-infantry-lv2__compat__1',
        'city-region-29': 'ming-post-sarhu-1619-hanseong-mercenary-infantry-lv2__compat__1',
    };
    if (special[regionId] && valid.includes(special[regionId])) return [special[regionId]];
    const cards = valid.filter(id => snapshot.core.handCards.some(card => card.id === id));
    const pieces = valid.filter(id => !cards.includes(id) && id !== 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1');
    return [cards.length && snapshot.core.factions.ming.handCount > 3 ? cards[0] : pieces[0]];
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
    if (id === 'upkeep-pyongyang' || id === 'upkeep-hanseong' || id === 'upkeep-datong') for (const piece of before.tutorial.step.allowedTargets ?? []) result.push(assertEqual('chosen-upkeep-unit-removed:' + piece, after.core.pieces.find(item => item.id === piece)?.regionId === before.core.pieces.find(item => item.id === piece)?.regionId, false));
    if (id === 'chronology-third-card') result.push(assertEqual('current-chronology-claimed', after.core.chronology.claimedCardIds.ming, [1301]), assertEqual('two-korean-cards-remain', after.core.factions.ming.handCount, 2));
    if (id === 'training-target') result.push(assertEqual('selected-artillery-trained', summarize(after).artillery, 2));
    if (/^training-(second|third)-target$/.test(id)) {
        const pieceId = before.tutorial.step.allowedTargets![0].slice('train:'.length);
        result.push(assertEqual('selected-piece-trained-one-level', after.core.pieces.find(piece => piece.id === pieceId)?.level, (before.core.pieces.find(piece => piece.id === pieceId)?.level ?? 0) + 1),
            assertEqual('base-training-does-not-spend-another-card', after.core.factions.ming.handCount, before.core.factions.ming.handCount));
    }
    if (id === 'hire-target') result.push(assertEqual('reinforce-western-datong', region(after, 'city-region-1').troops - region(before, 'city-region-1').troops, 2));
    if (id === 'training-practice') {
        const choice = before.tutorial.step.allowedTargets?.[0];
        if (choice?.startsWith('train:')) {
            const pieceId = choice.slice('train:'.length);
            const old = before.core.pieces.find(piece => piece.id === pieceId);
            if (old) result.push(assertEqual('chosen-training-level-increased', after.core.pieces.find(piece => piece.id === pieceId)?.level, old.level + 1));
        } else if (choice?.startsWith('recruit:') && !process.env.QIDAHEN_ALT_TRAIN_REGION) {
            const regionId = choice.slice('recruit:'.length);
            result.push(assertEqual('chosen-region-recruited', region(after, regionId).troops - region(before, regionId).troops, 1));
        }
    }
    if (id === 'training-recruit-target') {
        const changed = after.core.regions.filter(next => !next.isLogicalRegion && next.troops - (before.core.regions.find(old => old.id === next.id)?.troops ?? next.troops) === 1).map(next => next.id);
        result.push(assertEqual('exactly-one-real-region-recruited', changed.length, 1), assertEqual('new-year-recruitment-condition-applied', after.core.chronology.yearStats.ming.builtTroops, 1));
        if (!process.env.QIDAHEN_ALT_TRAIN_REGION) result.push(assertEqual('recommended-recruit-region', changed[0], 'city-region-15-liaodong'));
    }
    if (id === 'training-finish') result.push(assertEqual('four-paid-base-actions-used', before.core.wheelRecruitTrainProgress?.actionsCompleted, 4), assertEqual('last-card-retained', after.core.factions.ming.handCount, 1));
    return result;
}

test.describe('七大恨 / tutorial / 真实连续年度流程', () => {
    test.describe.configure({ timeout: 1_200_000 });
    for (const viewport of [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'mobile', width: 915, height: 412 }]) {
        test(`${viewport.name} 从正式教程入口走完核心行动、年中、新年与次年训练`, async ({ page, browser }, testInfo) => {
            const moduleMark = (label: string) => { if (process.env.QIDAHEN_MODULE_DIAGNOSTIC === 'true') console.info('ANNUAL_SETUP', label); };
            moduleMark('test-start');
            const touchContext = viewport.name === 'mobile' ? await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: true, hasTouch: true }) : null;
            if (touchContext) page = await touchContext.newPage();
            page.setDefaultTimeout(15_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            moduleMark('viewport');
            await setChineseLocale(page); await disableAudio(page);
            moduleMark('locale-audio');
            await page.addInitScript(() => { (window as unknown as { __E2E_TEST_MODE__: boolean }).__E2E_TEST_MODE__ = true; });
            const diagnostics = attachPageDiagnostics(page);
            moduleMark('page-diagnostics');
            const browserSession = await browser.newBrowserCDPSession();
            const rendererInfo = await browserSession.send('SystemInfo.getInfo'); await browserSession.detach();
            moduleMark('gpu');
            const performanceSession = await page.context().newCDPSession(page);
            await performanceSession.send('Performance.enable');
            moduleMark('performance');
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
            let dynamicTargets: string[] = [];
            let diplomacyDone = false;
            let hireDone = false;
            let farmDone = false;
            let reclaimDone = false;
            let openingHandStage = 0;
            const capturedUpkeepRegions = new Set<string>();
            const capturedPracticeStates = new Set<string>();
            page.on('request', request => pendingRequests.add(request.url()));
            page.on('requestfinished', request => pendingRequests.delete(request.url()));
            page.on('requestfailed', request => pendingRequests.delete(request.url()));
            const heartbeat = setInterval(() => console.info('ANNUAL_WAIT', JSON.stringify({ progress, pending: [...pendingRequests].slice(-12) })), 15_000);
            const verifySourceIdentity = trackQidahenSourceIdentity(page, 'e2e/qidahen/qidahen-annual-tutorial.e2e.ts', [
                'e2e/qidahen/sourceIdentity.ts', 'e2e/qidahen/battleRecording.ts', 'e2e/qidahen/battleCaptureDiagnostics.ts', 'e2e/qidahen/mapCandidateRecovery.ts',
                'e2e/qidahen/mapPointer.ts', 'e2e/qidahen/blobUrlDiagnostics.ts', 'e2e/qidahen/tutorialPointer.ts',
                'e2e/qidahen/visualReady.ts', 'e2e/qidahen/tutorialPersistence.ts', 'e2e/helpers/common.ts',
            ], [...QIDAHEN_VISUAL_SOURCE_PATHS, 'public/assets/i18n/zh-CN/qidahen/cards/inspect/compressed/ming-4.webp',
                'src/games/qidahen/annualTutorial.ts', 'src/games/qidahen/annualFarmTutorial.ts',
                'src/games/qidahen/annualHandActionTutorial.ts', 'src/games/qidahen/annualDiplomacyTutorial.ts',
                'src/games/qidahen/annualDispatchTutorial.ts', 'src/games/qidahen/annualSeasonTutorial.ts',
                'src/games/qidahen/annualBranchTutorial.ts', 'src/games/qidahen/Board.tsx',
                'src/engine/systems/TutorialSystem.ts', 'src/contexts/TutorialContext.tsx',
                'public/locales/zh-CN/game-qidahen.json']);
            const dir = resolve(root, viewport.name); mkdirSync(dir, { recursive: true });
            const saveBlobDiagnostics = await trackQidahenBlobUrls(page, resolve(dir, 'blob-url-diagnostics.json'));
            moduleMark('blob');
            writeFileSync(resolve(dir, 'browser-renderer.json'), JSON.stringify(rendererInfo.gpu, null, 2));
            const trace: { gameId: string; evidenceCategory: string; sourceRun: string; status: string; steps: object[]; uiStates: object[]; sourceIdentity?: object; captureContract?: object; chainId: string; sourceRevision: string; browserContextId: string; outcome?: object } = {
                gameId: 'qidahen', evidenceCategory: 'tutorial', sourceRun: runId, status: 'RUNNING', steps: [], uiStates: [],
                chainId: `qidahen-annual-${viewport.name}`, sourceRevision: `annual-revision-${QIDAHEN_ANNUAL_TUTORIAL.revision}`, browserContextId: `${runId}:${viewport.name}`,
            };
            const uiAssertions = new Map<string, ReturnType<typeof assertEqual>[]>();
            const capture = async (id: string, suffix = '', behaviorStepId = id) => {
                progress = `capture:${id}${suffix}`;
                await waitForQidahenVisualReady(page);
                await page.evaluate(async () => {
                    const finite = document.getAnimations().filter(animation => animation.playState === 'running'
                        && Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity));
                    await Promise.allSettled(finite.map(animation => animation.finished));
                    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                });
                await expect(page.getByTestId('qidahen-draw-anchor')).toBeVisible();
                await expect(page.getByTestId('qidahen-discard-anchor')).toBeVisible();
                if (viewport.name === 'desktop' && ['recruit-payment', 'hand-limit', 'upgrade-card'].includes(id)) {
                    const attachment = async () => page.getByTestId('tutorial-overlay-card').evaluate(element => {
                        const targetId = element.getAttribute('data-tutorial-anchor');
                        const target = document.querySelector(`[data-testid="${targetId}"]`);
                        if (!target) throw new Error(`Missing hand tutorial anchor: ${targetId}`);
                        const cardElement = target.closest('[data-qidahen-hand-recommended="true"]') ?? target;
                        const tip = element.getBoundingClientRect(), card = cardElement.getBoundingClientRect();
                        const dx = Math.max(0, tip.left - card.right, card.left - tip.right);
                        const dy = Math.max(0, tip.top - card.bottom, card.top - tip.bottom);
                        const marker = target.getBoundingClientRect();
                        const arrow = document.querySelector<SVGPolygonElement>('[data-testid="tutorial-anchor-arrow"] polygon');
                        if (!arrow) throw new Error('Missing arrow pointing to hand guidance marker');
                        const points = arrow.getAttribute('points')!.trim().split(/\s+/).map(point => point.split(',').map(Number));
                        const svg = arrow.ownerSVGElement!.getBoundingClientRect();
                        const [tipX, tipY] = points[2];
                        const toMarker = Math.hypot(marker.left + marker.width / 2 - (svg.left + tipX), marker.top + marker.height / 2 - (svg.top + tipY));
                        const baseX = svg.left + (points[0][0] + points[1][0]) / 2;
                        const baseY = svg.top + (points[0][1] + points[1][1]) / 2;
                        const baseToMarker = Math.hypot(marker.left + marker.width / 2 - baseX, marker.top + marker.height / 2 - baseY);
                        return { targetId, distance: Math.hypot(dx, dy), arrowPointsTowardMarker: toMarker < baseToMarker, tip: tip.toJSON(), card: card.toJSON(), marker: marker.toJSON() };
                    });
                    await expect.poll(async () => (await attachment()).distance,
                        { message: 'hand instruction must stay attached to the explained card' }).toBeLessThanOrEqual(32);
                    expect((await attachment()).arrowPointsTowardMarker, 'hand guidance arrow points toward the actual recommended marker').toBe(true);
                    writeFileSync(resolve(dir, `${id}-attachment.json`), JSON.stringify(await attachment(), null, 2));
                }
                if (['recruit-troops', 'tactic-card', 'occupy'].includes(id)) {
                    await expect(page.getByTestId('qidahen-map-region-tip'), 'active decisions use the real map and formal panel, without duplicate identity strip').toHaveCount(0);
                }
                if (id === 'occupy') {
                    const occlusion = await mapRegionOcclusion(page, ['city-region-15', 'city-region-7'], ['[data-testid="qidahen-actions-zone"]', '[data-testid="tutorial-overlay-card"]']);
                    expect(occlusion.regionCount, 'both engagement territories are protected').toBeGreaterThanOrEqual(2);
                    expect(occlusion.whole, 'both complete territories remain inside the viewport').toBe(true);
                    expect(occlusion.coveredTokens, 'no source or target troop/control token is hidden').toEqual([]);
                }
                const hintCard = page.getByTestId('tutorial-overlay-card');
                if (await hintCard.isVisible()) {
                    const geometry = await page.evaluate(() => {
                        const h = document.querySelector('[data-testid="tutorial-overlay-card"]')!.getBoundingClientRect();
                        const box = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
                        return { hint: box(h),
                            tokens: [...document.querySelectorAll('[data-qidahen-map-protected-token="true"], [data-qidahen-map-protected-population="true"]')].map(element => ({ id: element.getAttribute('data-testid'), rect: box(element.getBoundingClientRect()) })),
                            surfaces: [...document.querySelectorAll('[data-testid="qidahen-action-slot"] > *, [data-testid="qidahen-map-region-focus-name"]')].map(element => ({ id: element.getAttribute('data-testid'), rect: box(element.getBoundingClientRect()) })),
                        };
                    });
                    const anchorId = await hintCard.getAttribute('data-tutorial-anchor');
                    if (anchorId === 'qidahen-map-region-focus-name') {
                        const h = geometry.hint;
                        const regionId = await page.getByTestId(anchorId).getAttribute('data-region-id');
                        const regionDefinitions = JSON.parse(readFileSync('src/games/qidahen/data/runtime-region-mask-regions.json', 'utf8')) as {
                            regions: Array<{ id: string; color?: string }>;
                        };
                        const color = regionDefinitions.regions.find(region => region.id === regionId)?.color;
                        if (color && /^#[0-9a-f]{6}$/i.test(color)) {
                            // 地区名称只是区域内文字；面积型目标以正式蒙版的实际像素为阅读对象。
                            const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
                            const map = (await page.getByTestId('qidahen-map-content').boundingBox())!;
                            const { default: sharp } = await import('sharp');
                            const mask = await sharp('src/games/qidahen/data/region-mask.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                            let distance = Infinity;
                            for (let y = 0; y < mask.info.height; y++) for (let x = 0; x < mask.info.width; x++) {
                                const offset = (y * mask.info.width + x) * 4;
                                if (mask.data[offset] !== rgb[0] || mask.data[offset + 1] !== rgb[1] || mask.data[offset + 2] !== rgb[2] || !mask.data[offset + 3]) continue;
                                const px = map.x + (x + 0.5) * map.width / mask.info.width;
                                const py = map.y + (y + 0.5) * map.height / mask.info.height;
                                const dx = Math.max(0, h.x - px, px - h.x - h.width);
                                const dy = Math.max(0, h.y - py, py - h.y - h.height);
                                distance = Math.min(distance, Math.hypot(dx, dy));
                            }
                            expect(distance, `map explanation stays adjacent to actual ${regionId} region pixels`).toBeLessThanOrEqual(64);
                        } else {
                            const a = (await page.getByTestId(anchorId).boundingBox())!;
                            const dx = Math.max(0, h.x - a.x - a.width, a.x - h.x - h.width);
                            const dy = Math.max(0, h.y - a.y - a.height, a.y - h.y - h.height);
                            expect(Math.hypot(dx, dy), 'map explanation stays adjacent to its real reading object').toBeLessThanOrEqual(64);
                        }
                    }
                    const hint = geometry.hint;
                    for (const surface of geometry.surfaces) {
                        const r = surface.rect;
                        expect(hint.x < r.x + r.width && hint.x + hint.width > r.x && hint.y < r.y + r.height && hint.y + hint.height > r.y, "tutorial preserves actual reading/input surface: " + surface.id).toBe(false);
                    }
                    for (const token of geometry.tokens) {
                        const rect = token.rect;
                        expect(hint.x < rect.x + rect.width && hint.x + hint.width > rect.x && hint.y < rect.y + rect.height && hint.y + hint.height > rect.y, 'tutorial cannot cover focused troop/control marker: ' + JSON.stringify({ id: token.id, hint, rect })).toBe(false);
                    }

                }
                const regionName = page.getByTestId('qidahen-map-region-focus-name');
                if (await regionName.isVisible()) {
                    const region = await regionName.getAttribute('data-region-id');
                    const objects = await page.locator(`[data-qidahen-map-token-region="${region}"][data-qidahen-map-token-type="control"], [data-qidahen-map-token-region="${region}"][data-qidahen-map-token-type="army"]`)
                        .evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
                    if (objects.length) {
                        const name = (await regionName.boundingBox())!;
                        const distance = Math.min(...objects.map(object => {
                            const dx = Math.max(0, name.x - object.x - object.width, object.x - name.x - name.width);
                            const dy = Math.max(0, name.y - object.y - object.height, object.y - name.y - name.height);
                            return Math.hypot(dx, dy);
                        }));
                        expect(distance, 'region annotation stays beside an actual object belonging to that region').toBeLessThanOrEqual(20);
                    }
                }
                if (id === 'opening-move') {
                    const wheel = (await page.getByTestId('qidahen-action-wheel').boundingBox())!;
                    const hint = (await hintCard.boundingBox())!;
                    const dx = Math.max(0, hint.x - wheel.x - wheel.width, wheel.x - hint.x - hint.width);
                    const dy = Math.max(0, hint.y - wheel.y - wheel.height, wheel.y - hint.y - hint.height);
                    expect(Math.hypot(dx, dy), 'wheel introduction stays adjacent to its actual HUD object').toBeLessThanOrEqual(64);
                }
                if (id === 'midyear' || id === 'new-year') {
                    const wheel = (await page.getByTestId('qidahen-action-wheel').boundingBox())!;
                    const hint = (await page.getByTestId('tutorial-overlay-card').boundingBox())!;
                    expect(hint.x < wheel.x + wheel.width && hint.x + hint.width > wheel.x
                        && hint.y < wheel.y + wheel.height && hint.y + hint.height > wheel.y,
                    `${id} explanation cannot cover the wheel it explains`).toBe(false);
                    const dx = Math.max(0, hint.x - wheel.x - wheel.width, wheel.x - hint.x - hint.width);
                    const dy = Math.max(0, hint.y - wheel.y - wheel.height, wheel.y - hint.y - hint.height);
                    expect(Math.hypot(dx, dy), `${id} explanation remains near the wheel`).toBeLessThanOrEqual(64);
                    writeFileSync(resolve(dir, `${id}-wheel-geometry.json`), JSON.stringify({ wheel, hint, distance: Math.hypot(dx, dy) }, null, 2));
                }
                if (id === 'dispatch-troops') {
                    const snapshot = await read(page);
                    const hint = (await page.getByTestId('tutorial-overlay-card').boundingBox())!;
                    const troops = await page.locator('[data-pending-committed-selectable="true"]').all();
                    expect(troops.length).toBeGreaterThan(0);
                    for (const troop of troops) {
                        const rect = (await troop.boundingBox())!;
                        expect(rect.y, 'whole selectable troop above screen edge').toBeGreaterThanOrEqual(0);
                        const covered = hint.x < rect.x + rect.width && hint.x + hint.width > rect.x && hint.y < rect.y + rect.height && hint.y + hint.height > rect.y;
                        expect(covered, 'tutorial text must not cover any selectable troop').toBe(false);
                        const tokenId = (await troop.getAttribute('data-testid'))!.slice('qidahen-map-token-'.length);
                        const pieceId = snapshot.core.mapTokens.find(token => token.id === tokenId)?.pieceId;
                        const piece = snapshot.core.pieces.find(piece => piece.id === pieceId)!;
                        await expect(troop).toHaveAttribute('data-qidahen-unit-level', String(piece.level));
                        await expect(page.getByTestId(`qidahen-unit-level-${tokenId}`)).toHaveText(String(piece.level));
                    }
                    if (suffix === '-selected') await expect(page.getByTestId('qidahen-committed-troop-check')).toHaveCount(dynamicTargets.length);
                    await expect(page.locator('[data-qidahen-tutorial-recommended="true"]')).toHaveCount((snapshot.tutorial.step.recommendedTargets ?? snapshot.tutorial.step.allowedTargets ?? []).length);
                }
                if (id === 'tactic-card' && suffix === '-selected') {
                    const covered = await page.getByTestId('qidahen-tactic-card-selection-panel').evaluate(panel => {
                        const p = panel.getBoundingClientRect();
                        return [...document.querySelectorAll('[data-qidahen-map-protected-token="true"], [data-qidahen-map-protected-population="true"]')].filter(token => {
                            const r = token.getBoundingClientRect();
                            return r.width > 0 && r.height > 0 && p.left < r.right && p.right > r.left && p.top < r.bottom && p.bottom > r.top;
                        }).map(token => token.getAttribute('data-testid'));
                    });
                    expect(covered, 'tactic confirmation must not cover map units or markers').toEqual([]);
                }
                if (id === 'upkeep-pyongyang') {
                    const covered = await page.evaluate(() => {
                        const blockers = ['qidahen-hand-interaction-tray', 'tutorial-overlay-card']
                            .flatMap(id => [...document.querySelectorAll(`[data-testid="${id}"]`)])
                            .map(node => node.getBoundingClientRect());
                        return [...document.querySelectorAll('[data-pending-committed-selectable="true"]')]
                            .filter(node => {
                                const rect = node.getBoundingClientRect();
                                return blockers.some(panel => panel.left < rect.right && panel.right > rect.left
                                    && panel.top < rect.bottom && panel.bottom > rect.top);
                            }).map(node => node.getAttribute('data-testid'));
                    });
                    expect(covered, 'upkeep candidates must remain visible before and after selection').toEqual([]);
                }
                if (['new-year', 'maintain-shanhai', 'abandon-jinzhou', 'abandon-inner-wall'].includes(id)) {
                    const covered = await page.getByTestId('qidahen-turn-choice').evaluate(panel => {
                        const p = panel.getBoundingClientRect();
                        return [...document.querySelectorAll('[data-qidahen-map-protected-token="true"], [data-qidahen-map-protected-population="true"]')].filter(token => {
                            const r = token.getBoundingClientRect();
                            return r.width > 0 && r.height > 0 && p.left < r.right && p.right > r.left && p.top < r.bottom && p.bottom > r.top;
                        }).map(token => token.getAttribute('data-testid'));
                    });
                    expect(covered, 'maintenance panel must not obscure map units, population or control').toEqual([]);
                }
                if (id === 'abandon-jinzhou') {
                    const city = page.locator('[data-qidahen-map-context-space="jinzhou"]');
                    await expect(city).toHaveCount(1);
                    const bounds = (await city.boundingBox())!;
                    const hint = (await page.getByTestId('tutorial-overlay-card').boundingBox())!;
                    expect(hint.x < bounds.x + bounds.width && hint.x + hint.width > bounds.x && hint.y < bounds.y + bounds.height && hint.y + hint.height > bounds.y,
                        'current Jinzhou city name and fortification must remain fully visible').toBe(false);
                }
                if (id === 'abandon-inner-wall' || id === 'abandon-outer-wall') {
                    await expect(page.getByTestId('qidahen-fortification-highlight')).toHaveAttribute('data-fortification-id', id === 'abandon-inner-wall' ? 'inner-wall' : 'outer-wall');
                    await expect(page.getByTestId('qidahen-fortification-highlight').locator('text')).toHaveText(id === 'abandon-inner-wall' ? '内长城' : '外长城');
                    const wallContext = await page.getByTestId('qidahen-fortification-context').boundingBox();
                    const viewSize = page.viewportSize()!;
                    expect(wallContext).not.toBeNull();
                    // Chromium 在恰好贴边时可能返回 0.99999988；允许四分之一像素误差，仍要求整条墙的范围入屏。
                    expect(wallContext!.x).toBeGreaterThanOrEqual(-0.25);
                    expect(wallContext!.y).toBeGreaterThanOrEqual(-0.25);
                    expect(wallContext!.x + wallContext!.width).toBeLessThanOrEqual(viewSize.width + 0.25);
                    expect(wallContext!.y + wallContext!.height).toBeLessThanOrEqual(viewSize.height + 0.25);
                    const obscured = await page.getByTestId('qidahen-fortification-highlight').locator('text').evaluate(label => {
                        const rect = label.getBoundingClientRect();
                        return [...document.querySelectorAll('[data-qidahen-map-token-region], [data-testid^="qidahen-map-population-"]')]
                            .filter(node => { const obstacle = node.getBoundingClientRect(); return rect.left < obstacle.right && rect.right > obstacle.left
                                && rect.top < obstacle.bottom && rect.bottom > obstacle.top; }).map(node => node.getAttribute('data-testid'));
                    });
                    expect(obscured, 'wall name must remain readable beside actual map markers').toEqual([]);
                }
                if (id === 'recruit-troops') {
                    const hint = (await page.getByTestId('tutorial-overlay-card').boundingBox())!;
                    const candidates = page.locator('[data-testid^="qidahen-recruit-choice-"]');
                    expect(await candidates.count(), 'all formal recruitment choices remain readable').toBeGreaterThanOrEqual(2);
                    for (const candidate of await candidates.all()) {
                        await expect(candidate).toBeVisible();
                        const rect = (await candidate.boundingBox())!;
                        expect(hint.x < rect.x + rect.width && hint.x + hint.width > rect.x && hint.y < rect.y + rect.height && hint.y + hint.height > rect.y,
                            'tutorial must avoid every recruitment candidate, including the non-recommended choice').toBe(false);
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
                    const snapshot = await read(page);
                    const pieceId = snapshot.tutorial.step.allowedTargets![0].slice('train:'.length);
                    const token = snapshot.core.mapTokens.find(item => item.pieceId === pieceId)!;
                    const tokenBounds = (await page.getByTestId(`qidahen-map-token-${token.id}`).boundingBox())!;
                    expect(tokenBounds.width, 'tutorial training unit remains readable at the current camera scale').toBeGreaterThanOrEqual(44);
                    const target = page.getByTestId(`qidahen-map-token-${token.id}`);
                    await expect(target).toBeVisible();
                    await expect(target).toHaveAttribute('data-pending-committed-selectable', 'true');
                    await expect(page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-train"]')).toHaveCount(0);
                }
                if (id === 'training-recruit-target') {
                    await expect(page.locator('[data-qidahen-map-selection-space="city-region-15-liaodong"]')).toBeVisible();
                    await expect(page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-recruit"]')).toHaveCount(0);
                }
                if (id === 'hand-scroll-end' || id === 'upkeep-yehe' && suffix === '-selected') {
                    const snapshot = await read(page);
                    const summary = page.getByTestId('qidahen-turn-selected-card-summary');
                    await expect(summary).toBeVisible();
                    for (const cardId of dynamicTargets) {
                        await expect(summary).toContainText(snapshot.core.handCards.find(card => card.id === cardId)!.label);
                    }
                    await expect(page.getByTestId('qidahen-turn-choice')).toHaveCount(0);
                }
                if (id === 'finish') {
                    await expect(page.getByTestId('qidahen-draw-pile')).toContainText('大明抽牌');
                    await expect(page.getByTestId('qidahen-discard-pile')).toContainText('大明弃牌');
                }
                if (id === 'upkeep-yehe' && suffix === '-selected') {
                    const ids = dynamicTargets;
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
                if (id === 'claim-year') {
                    const choice = page.getByTestId('qidahen-chronology-choice');
                    await expect(choice.getByTestId('qidahen-turn-choice')).toBeVisible();
                    const cards = await page.locator('[data-testid^="qidahen-year-card-slot-"]').evaluateAll(nodes => nodes.map(node => {
                        const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
                    }));
                    const decision = (await choice.boundingBox())!;
                    const nearestCardDistance = Math.min(...cards.map(card => Math.hypot(
                        Math.max(card.left - decision.x - decision.width, decision.x - card.right, 0),
                        Math.max(card.top - decision.y - decision.height, decision.y - card.bottom, 0))));
                    expect(nearestCardDistance, 'chronology decision stays next to the actual cards').toBeLessThan(32);
                }
                if (id === 'new-order' || id === 'year-character') {
                    const snapshot = await read(page);
                    const actor = Object.values(snapshot.core.factions).find(faction => faction.playerId === snapshot.interaction?.playerId);
                    expect(actor, 'the current prompt has a real faction owner').toBeTruthy();
                    await expect(page.getByTestId('qidahen-turn-choice').locator('h2')).toContainText(actor!.name);
                }
                const path = resolve(dir, `${String(trace.uiStates.length).padStart(2, '0')}-${id}${suffix}.png`);
                // 已等待正式素材、字体与有限动画；与录屏共用原生合成视口，不二次走截图包装层。
                let screenshotTimer: ReturnType<typeof setTimeout> | undefined;
                try {
                    const pixels = await Promise.race([
                        performanceSession.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }),
                        new Promise<never>((_, reject) => { screenshotTimer = setTimeout(() => reject(new Error('Native viewport capture timed out after 30 seconds')), 30_000); }),
                    ]);
                    writeFileSync(path, Buffer.from(pixels.data, 'base64'));
                } finally { if (screenshotTimer) clearTimeout(screenshotTimer); }
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
                if (process.env.QIDAHEN_MODULE_DIAGNOSTIC === 'true') writeFileSync(resolve('test-results/qidahen-annual-modules.json'), JSON.stringify({ modules: Object.keys(createRequire(import.meta.url).cache), report: process.report?.getReport().sharedObjects }, null, 2));
                if (process.env.QIDAHEN_DIAGNOSTIC_BROWSER_CHANNEL) console.info('DIAGNOSTIC_BROWSER_VERSION', page.context().browser()?.version(), 'SHARP_ENTRY_MODULES', Object.keys(createRequire(import.meta.url).cache).filter(path => /[\\/]sharp[\\/]/.test(path)));
                await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded', timeout: 45_000 });
                console.info('ANNUAL_ENTRY', JSON.stringify({ body: (await page.locator('body').innerText()).slice(0, 600), state: await read(page).then(value => value.tutorial.step?.id).catch(() => null) }));
                await page.waitForFunction(() => document.querySelector('[data-tutorial-step="frontier-goal"]') || document.body.innerText.includes('游戏加载失败'), undefined, { timeout: 120_000 });
                await expect(page.locator('[data-tutorial-step="frontier-goal"]')).toBeVisible();
                for (let guard = 0; guard < 100; guard += 1) {
                    const snapshot = await read(page);
                    if (!snapshot.tutorial.active) break;
                    const step = snapshot.tutorial.step;
                    if (step.hiddenAutomation) {
                        await expect.poll(() => stepId(page), { timeout: 60_000 }).not.toBe(step.id);
                        continue;
                    }
                    progress = step.id;
                    console.info('ANNUAL_STEP', step.id);
                    if (step.id === 'training-recruit-target') {
                        await expect.poll(() => readQidahenStoredTutorialStep(page), { timeout: 30_000 }).toBe(step.id);
                        const progressBefore = await readQidahenTutorialProgressStatus(page);
                        expect(progressBefore.savedCoreHash).toBe(progressBefore.liveCoreHash);
                        expect(progressBefore.savedHistoryHash).toBe(progressBefore.liveHistoryHash);
                        await page.reload({ waitUntil: 'domcontentloaded' });
                        await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
                        await expect(page.locator(`[data-tutorial-step="${step.id}"]`)).toBeVisible({ timeout: 90_000 });
                        await expect.poll(() => readQidahenStoredTutorialStep(page), { timeout: 30_000 }).toBe(step.id);
                        const progressAfter = await readQidahenTutorialProgressStatus(page);
                        expect(progressAfter.liveCoreHash).toBe(progressBefore.liveCoreHash);
                        expect(progressAfter.liveHistoryHash).toBe(progressBefore.liveHistoryHash);
                        expect(progressAfter.randomPolicy).toBe(progressBefore.randomPolicy);
                        expect(progressAfter.randomCursor).toBe(progressBefore.randomCursor);
                        writeFileSync(resolve(dir, 'late-progress.json'), JSON.stringify({ status: 'PASS', source: 'real-continuous-PC-chain', before: progressBefore, after: progressAfter }, null, 2));
                        uiAssertions.set(step.id, [assertEqual('late-progress-resumes-same-match-history-and-random', true, true)]);
                    }
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
                    dynamicTargets = annualDynamicTargets(before);
                    let dynamicCommand = step.allowedCommands?.[0];
                    if (step.id === 'opening-farm-cycle') {
                        const content = step.content;
                        if (content.endsWith('farm-target-dynamic')) { dynamicCommand = 'SYS_INTERACTION_RESPOND'; dynamicTargets = ['city-region-15']; }
                        else if (content.endsWith('reclaim-target-dynamic')) { dynamicCommand = 'SYS_INTERACTION_RESPOND'; dynamicTargets = ['city-region-15-liaodong']; }
                        else if (content.includes('farm-menu-') || content.endsWith('farm-hand-menu-dynamic')) {
                            dynamicCommand = 'SYS_INTERACTION_RESPOND';
                            dynamicTargets = [!farmDone ? 'military-farm' : !reclaimDone ? 'reclaim' : openingHandStage === 0 ? 'hand-action:recruit' : 'finish-slot'];
                        } else {
                            [dynamicCommand, dynamicTargets] = [
                                ['SELECT_PAYMENT_CARD', ['hand-3']], ['EXECUTE_SELECTED_ACTION', []],
                                ['SELECT_REGION', ['city-region-15']], ['SYS_INTERACTION_RESPOND', ['level-2-troops']],
                            ][openingHandStage] as [string, string[]];
                        }
                    }
                    if (step.id === 'diplomacy-cycle') {
                        dynamicCommand = 'SYS_INTERACTION_RESPOND';
                        const valid = before.interaction?.data.options.filter(option => !option.disabled).map(option => option.id) ?? [];
                        if (step.content.endsWith('diplomacy-menu-dynamic')) dynamicTargets = [!diplomacyDone ? 'diplomacy' : !hireDone ? 'hire' : 'finish-slot'];
                        else if (step.content.endsWith('diplomacy-target-dynamic')) dynamicTargets = [diplomacyDone ? 'finish-diplomacy' : 'city-region-2'];
                        else if (step.content.endsWith('hire-payment-dynamic')) dynamicTargets = [valid[0]];
                        else if (step.content.includes('hire-target-')) dynamicTargets = ['city-region-1'];
                        else if (step.content.endsWith('diplomacy-hand-menu-dynamic')) dynamicTargets = ['skip-hand'];
                        else throw new Error(`Unknown diplomacy prompt: ${step.content}`);
                        expect(valid).toContain(dynamicTargets[0]);
                    }
                    const beforeVisible = await page.locator('body').innerText();
                    if (step.id === 'new-order' || step.id === 'year-character') {
                        await expect(page.getByTestId('qidahen-player-float')).toContainText('本年先手');
                        await expect(page.getByTestId('qidahen-player-float')).not.toContainText('当前回合');
                        await expect(page.getByTestId(`qidahen-player-${before.core.currentFactionOrder[0]}`)).toHaveAttribute('data-current', 'true');
                        await expect(page.getByTestId('qidahen-year-card-slot-next-year')).toHaveCount(0);
                        uiAssertions.set(step.id, [assertEqual('next-chronology-not-revealed-before-all-characters', before.core.yearCards.map(card => card.id), ['current-year'])]);
                    }
                    if (step.id === 'training-move') {
                        await expect(page.getByTestId('qidahen-year-card-slot-next-year')).toBeVisible();
                        uiAssertions.set(step.id, [assertEqual('next-chronology-revealed-after-all-characters', before.core.yearCards.map(card => card.id), ['current-year', 'next-year'])]);
                    }
                    const finishBattleRecording = step.id === 'battle-roll' ? await beginBattleRecording(page, dir) : undefined;
                    if (step.id === 'recruit-troops' || (step.id === 'opening-farm-cycle' && step.content.endsWith('hand-recruit-choice'))) await assertWholeRegionVisible(page, 'city-region-15');
                    if ((viewport.name === 'desktop' ? KEY_STATES : MOBILE_STATES).has(step.id)) await capture(step.id);
                    if (step.id === 'opening-farm-cycle') {
                        const captureId = step.content.endsWith('farm-target-dynamic') ? 'farm-target'
                            : step.content.endsWith('reclaim-target-dynamic') ? 'reclaim-target'
                            : step.content.endsWith('farm-menu-initial') ? 'farm-action'
                            : step.content.endsWith('farm-menu-after-farm') ? 'reclaim-action'
                            : step.content.endsWith('farm-menu-hand-action') && openingHandStage === 0 ? 'recruit-action'
                            : step.content.endsWith('hand-recruit-rule') && openingHandStage === 0 ? 'recruit-payment'
                            : step.content.endsWith('hand-recruit-rule') && openingHandStage === 1 ? 'recruit-confirm'
                            : step.content.endsWith('hand-recruit-region') ? 'recruit-source'
                            : step.content.endsWith('hand-recruit-choice') ? 'recruit-troops' : undefined;
                        if (captureId) await capture(captureId, '', step.id);
                    }
                    if (step.id === 'diplomacy-cycle') {
                        const captureId = step.content.endsWith('diplomacy-target-dynamic') ? (diplomacyDone ? 'diplomacy-finish' : 'diplomacy-target')
                            : step.content.endsWith('diplomacy-menu-dynamic') && diplomacyDone && !hireDone ? 'hire-action'
                            : step.content.endsWith('diplomacy-hand-menu-dynamic') ? 'save-hand'
                            : step.content.includes('hire-target-') ? 'hire-target' : undefined;
                        if (captureId) await capture(captureId, '', step.id);
                    }
                    const practice = step.id === 'training-practice' ? before.core.wheelRecruitTrainProgress : null;
                    const practiceCaptureId = practice?.phase === 'choose-action' && practice.actionsCompleted === 0 ? 'training-kind'
                        : practice?.phase === 'choose-training-target' && practice.actionsCompleted === 0 ? 'training-target'
                        : practice?.phase === 'choose-training-target' && practice.actionsCompleted === 1 ? 'training-second-target'
                        : practice?.phase === 'choose-recruit-target' ? 'training-recruit-target'
                        : practice?.phase === 'choose-action' && practice.actionsCompleted === 4 ? 'training-finish' : undefined;
                    if (practiceCaptureId && !capturedPracticeStates.has(practiceCaptureId)) {
                        capturedPracticeStates.add(practiceCaptureId); await capture(practiceCaptureId, '', step.id);
                    }
                    const upkeepRegion = step.id.startsWith('season-upkeep-player-') ? step.highlightTarget?.replace('qidahen-map-region-focus-', '') : undefined;
                    const upkeepCaptureId = upkeepRegion === 'city-region-1' ? 'upkeep-datong' : upkeepRegion === 'city-region-7' ? 'upkeep-yehe'
                        : upkeepRegion === 'city-region-18' ? 'upkeep-pyongyang' : undefined;
                    const firstUpkeepCapture = Boolean(upkeepCaptureId && !capturedUpkeepRegions.has(upkeepCaptureId));
                    if (firstUpkeepCapture && viewport.name === 'desktop') { capturedUpkeepRegions.add(upkeepCaptureId!); await capture(upkeepCaptureId!, '', step.id); }
                    if (step.id === 'diplomacy-cycle' && step.content.endsWith('diplomacy-target-dynamic') && !diplomacyDone && viewport.name === 'desktop') {
                        const ids = before.interaction!.data.options.map(option => option.id)
                            .filter(id => before.core.regions.some(region => region.id === id && !region.isLogicalRegion));
                        const observed = await probeDiplomacyCandidates(page, ids);
                        expect(observed.map(item => item.id), '所有正式外交地区均有真实鼠标悬停点').toEqual(ids);
                        expect((await read(page)).core, '逐候选悬停不能改变对局').toEqual(before.core);
                        writeFileSync(resolve(dir, 'diplomacy-candidate-hover.json'), JSON.stringify(observed, null, 2));
                    }
                    if (practiceCaptureId === 'training-target' && viewport.name === 'desktop') {
                        const recovered = await verifyQidahenMapCandidateRecovery(page, () => capture('training-pan', '', step.id));
                        uiAssertions.set(step.id, [assertEqual(recovered ? 'real-pan-recovers-other-candidate-without-state-change' : 'no-onscreen-candidate-overlaps-visible-hand-cards', true, true)]);
                    }
                    if (step.id === 'occupy' && viewport.name === 'desktop') {
                        const summary = await page.getByTestId('qidahen-post-battle-result-summary').innerText();
                        expect(summary.match(/幸存\s*\d+/g), 'the survivor result has one visible owner').toHaveLength(1);
                        const report = page.getByTestId('qidahen-battle-report');
                        await expect(report).not.toHaveAttribute('open', '');
                        await expect(page.getByTestId('qidahen-post-battle-dice-summary')).not.toBeVisible();
                        await expect(page.getByTestId('qidahen-post-battle-mode-occupy')).not.toContainText('种结果');
                        const coreBeforeReport = (await read(page)).core;
                        await report.locator('summary').click();
                        await expect(page.getByTestId('qidahen-post-battle-dice-summary')).toBeVisible();
                        await expect(page.getByTestId('qidahen-post-battle-dice-summary')).not.toContainText('未掷骰');
                        await capture(step.id, '-report');
                        await report.locator('summary').click();
                        await expect(page.getByTestId('qidahen-post-battle-dice-summary')).not.toBeVisible();
                        expect((await read(page)).core, '只读战报不改变对局').toEqual(coreBeforeReport);
                    }
                    if (step.id === 'recruit-payment' || (step.id === 'opening-farm-cycle' && step.content.endsWith('hand-recruit-rule') && openingHandStage === 0)) {
                        const handBefore = before.core.factions.ming.handCount;
                        if (touchContext) {
                            const card = page.getByTestId('qidahen-hand-card-hand-3');
                            const rect = (await card.boundingBox())!;
                            const session = await page.context().newCDPSession(page);
                            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + 15, y: rect.y + 15 }] });
                            await page.waitForTimeout(650);
                            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                            await session.detach();
                        } else {
                            await page.mouse.move(10, 10);
                            const shell = page.getByTestId('qidahen-hand-card-shell-hand-3');
                            const atRest = (await shell.boundingBox())!;
                            await page.getByTestId('qidahen-hand-card-magnify-hand-3').hover();
                            await expect.poll(async () => (await shell.boundingBox())!.y, { timeout: 5_000 }).toBeLessThan(atRest.y - atRest.height * 0.4);
                            await expect.poll(async () => { const raised = (await shell.boundingBox())!; return raised.y + raised.height; },
                                { timeout: 5_000 }).toBeLessThanOrEqual(viewport.height + 1);
                            expect((await read(page)).core.selectedPaymentCardIds).toEqual([]);
                            await capture('recruit-payment', '-hover', step.id);
                            await page.getByTestId('qidahen-hand-card-magnify-hand-3').click();
                        }
                        await waitMagnifyReady(page);
                        await capture('recruit-payment', '-inspect', step.id);
                        expect((await read(page)).core.factions.ming.handCount).toBe(handBefore);
                        expect((await read(page)).core.selectedPaymentCardIds).toEqual([]);
                        await page.getByTestId('qidahen-card-magnify-overlay').getByRole('button', { name: /关闭/ }).click();
                    }
                    if (step.id === 'year-character') {
                        await page.getByTestId(`qidahen-turn-inspect-${step.allowedTargets![0]}`).click();
                        await waitMagnifyReady(page);
                        await expect.poll(() => page.getByTestId('qidahen-high-resolution-card').locator('img').evaluate(element => (element as HTMLImageElement).naturalWidth),
                            { message: '杨镐完整牌面使用原分辨率单卡' }).toBe(487);
                        await capture(step.id, '-inspect');
                        await page.getByTestId('qidahen-card-magnify-overlay').getByRole('button', { name: /关闭/ }).click();
                    }
                    if (step.infoStep) {
                        await clickVisibleButton(page, 'tutorial-next-button');
                    } else {
                        const command = dynamicCommand;
                        if (!command) throw new Error(`Missing command for ${step.id}`);
                        const targets = dynamicTargets;
                        if (step.id === 'battle-roll' && before.core.handCards.some(card => card.id === 'hand-2')) {
                            await capture('tactic-card', '', step.id);
                            await clickCard(page, 'hand-2');
                            await capture('tactic-card', '-selected', step.id);
                            await page.getByTestId('qidahen-confirm-tactic-card').click();
                        }
                        if (command === 'SYS_INTERACTION_RESPOND') {
                            if (before.interaction?.data.sourceId === 'qidahen:turn-resolution-choice') await submitTurnChoice(page, before, targets,
                                step.id === 'opening-farm-cycle' && step.content.endsWith('reclaim-target-dynamic') ? async () => { await capture('reclaim-target', '-selected', step.id); }
                                    : step.id === 'dispatch-troops' ? async () => { await capture(step.id, '-selected'); }
                                    : firstUpkeepCapture && viewport.name === 'desktop' && (upkeepCaptureId === 'upkeep-yehe' || upkeepCaptureId === 'upkeep-pyongyang')
                                        ? async () => { await capture(upkeepCaptureId!, '-selected', step.id); if (upkeepCaptureId === 'upkeep-yehe') await browseHand(); } : undefined);
                            else if (step.id === 'hand-limit') {
                                for (const id of targets) await clickCard(page, id);
                                await page.getByTestId('qidahen-resolve-hand-limit-discard').click();
                            } else if (step.id === 'recruit-troops' || (step.id === 'opening-farm-cycle' && openingHandStage === 3)) await page.getByTestId(`qidahen-recruit-choice-${targets[0]}`).click();
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
                        else if (command === 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE') {
                            if (targets[0].startsWith('train:')) await clickPiece(page, snapshot, targets[0].slice('train:'.length));
                            else if (targets[0].startsWith('recruit:')) {
                                if (process.env.QIDAHEN_ALT_TRAIN_REGION && practiceCaptureId === 'training-recruit-target') {
                                    const ids = (await page.getByTestId('qidahen-map-region-mask-overlay').getAttribute('data-qidahen-candidate-region-ids'))!.split('|').filter(id => id && id !== targets[0].slice('recruit:'.length));
                                    expect(ids.length, '真实建军局面存在推荐地区以外的合法候选').toBeGreaterThan(0);
                                    const alt = ids[ids.length - 1];
                                    await dragQidahenMap(page, -180, -120);
                                    const observed = await probeDiplomacyCandidates(page, [alt], alt);
                                    writeFileSync(resolve(dir, 'alternative-recruit-click.json'), JSON.stringify({ alt, observed }, null, 2));
                                } else await clickRegion(page, targets[0].slice('recruit:'.length));
                            }
                            else await page.getByTestId(`qidahen-wheel-recruit-train-choice-${encodeURIComponent(targets[0])}`).click();
                        }
                        else throw new Error(`Missing real input ${command}`);
                    }
                    if (step.id === 'opening-farm-cycle') {
                        if (step.content.endsWith('farm-target-dynamic')) farmDone = true;
                        else if (step.content.endsWith('reclaim-target-dynamic')) reclaimDone = true;
                        else if (dynamicCommand !== 'SYS_INTERACTION_RESPOND' || openingHandStage === 3) openingHandStage++;
                    }
                    if (step.id === 'diplomacy-cycle') {
                        if (step.content.endsWith('diplomacy-target-dynamic') && dynamicTargets[0] !== 'finish-diplomacy') diplomacyDone = true;
                        if (step.content.includes('hire-target-')) hireDone = true;
                    }
                    if (step.id === 'battle-roll') {
                        await expect(page.getByTestId('qidahen-battle-roll-sequence')).toBeVisible();
                        await expect(page.getByTestId('qidahen-battle-roll-context')).toBeVisible();
                        await expect(page.getByTestId('qidahen-battle-roll-context')).toHaveText('辽北 → 叶赫部');
                        const battleLayout = await page.evaluate(() => {
                            const map = document.querySelector('[data-testid="qidahen-map-content"]')!.getBoundingClientRect();
                            const dice = document.querySelector('[data-testid="qidahen-battle-roll-overlay"]')!.getBoundingClientRect();
                            const ids = new Set([...document.querySelectorAll('[data-qidahen-battle-region-space]')].map(node => node.getAttribute('data-qidahen-battle-region-space')));
                            const regions = [...document.querySelectorAll('[data-qidahen-map-token-region]')]
                                .filter(node => ids.has(node.getAttribute('data-qidahen-map-token-region'))).map(node => node.getBoundingClientRect());
                            const field = { left: Math.min(...regions.map(rect => rect.left)), top: Math.min(...regions.map(rect => rect.top)),
                                right: Math.max(...regions.map(rect => rect.right)), bottom: Math.max(...regions.map(rect => rect.bottom)) };
                            return { map: { left: map.left, top: map.top, right: map.right, bottom: map.bottom },
                                distance: Math.hypot(Math.max(field.left - dice.right, dice.left - field.right, 0),
                                    Math.max(field.top - dice.bottom, dice.top - field.bottom, 0)), width: innerWidth, height: innerHeight };
                        });
                        expect(battleLayout.map.left, 'battle map covers west edge').toBeLessThanOrEqual(1);
                        expect(battleLayout.map.top, 'battle map covers north edge').toBeLessThanOrEqual(1);
                        expect(battleLayout.map.right).toBeGreaterThanOrEqual(battleLayout.width - 1);
                        expect(battleLayout.map.bottom).toBeGreaterThanOrEqual(battleLayout.height - 1);
                        expect(battleLayout.distance, 'dice stay next to the actual battlefield').toBeLessThanOrEqual(24);
                        await expect(page.getByTestId('qidahen-battle-roll-sequence')).toBeHidden({ timeout: 90_000 });
                        const recording = await finishBattleRecording!();
                        for (const picture of recording.pictures) trace.uiStates.push({ ...picture, stepId: step.id, viewport: viewport.name, sha256: createHash('sha256').update(readFileSync(picture.path)).digest('hex') });
                        trace.uiStates.push({ id: 'battle-real-time', stepId: step.id, path: recording.video, viewport: viewport.name,
                            frameCount: recording.frameCount, durationSeconds: recording.durationSeconds, sha256: createHash('sha256').update(readFileSync(recording.video)).digest('hex') });
                    }
                    const dynamicPayment = step.id.startsWith('season-upkeep-player-') || step.id === 'season-chronology-payment' || step.id === 'diplomacy-cycle';
                    if (step.id === 'opening-farm-cycle') await expect.poll(async () => JSON.stringify({ core: (await read(page)).core, interaction: (await read(page)).interaction?.id }),
                        { timeout: 60_000, message: 'opening action must change real state or prompt' }).not.toBe(JSON.stringify({ core: before.core, interaction: before.interaction?.id }));
                    else if (step.id === 'training-practice') await expect.poll(async () => JSON.stringify((await read(page)).core.wheelRecruitTrainProgress),
                        { timeout: 60_000, message: 'training choice must change the real training progress' }).not.toBe(JSON.stringify(before.core.wheelRecruitTrainProgress));
                    else if (dynamicPayment) await expect.poll(async () => ({ step: await stepId(page), interaction: (await read(page)).interaction?.id }),
                        { timeout: 60_000, message: `${step.id} must advance its formal payment interaction` }).not.toEqual({ step: step.id, interaction: before.interaction?.id });
                    else await expect.poll(() => stepId(page), { timeout: 60_000, message: `${step.id} should advance through its real event` }).not.toBe(step.id);
                    const after = await read(page);
                    trace.steps.push({ id: step.id, action: step.infoStep ? 'manual-next' : dynamicCommand, targetIds: dynamicTargets,
                        before: { visible: { text: beforeVisible }, authoritative: summarize(before) },
                        after: { visible: { text: await page.locator('body').innerText() }, authoritative: summarize(after) },
                        assertions: [assertEqual('formal-event-advanced-input', after.tutorial.step?.id !== step.id || dynamicPayment && after.interaction?.id !== before.interaction?.id || step.id === 'opening-farm-cycle' && (after.interaction?.id !== before.interaction?.id || JSON.stringify(after.core) !== JSON.stringify(before.core)) || step.id === 'training-practice' && JSON.stringify(after.core.wheelRecruitTrainProgress) !== JSON.stringify(before.core.wheelRecruitTrainProgress), true), ...assertOutcome(step.id, before, after), ...(uiAssertions.get(step.id) ?? [])],
                    });
                    writeFileSync(resolve(dir, 'behavior-trace.json'), JSON.stringify(trace, null, 2));
                }
                const final = await read(page);
                expect(final.tutorial.active).toBe(false);
                expect(final.core.currentYearIndex).toBe(1);
                expect(final.core.chronology.claimedCardIds.ming).toEqual([1301]);
                expect(final.core.regions.find(region => region.id === 'city-region-7')?.controller).toBe('ming');
                expect(final.core.pieces.find(piece => piece.id === 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1')?.level).toBe(2);
                const played = trace.steps.filter(step => 'id' in step && step.id !== 'farm-alternative-checkpoint').map(step => 'id' in step ? step.id : undefined);
                const indices = played.map(id => QIDAHEN_ANNUAL_TUTORIAL.steps.findIndex(step => step.id === id));
                expect(indices.every((index, i) => index >= 0 && (i === 0 || index >= indices[i - 1])), '真实节点按课程顺序进行，同一动态步骤可分次支付').toBe(true);
                await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
                const beforeContinueText = viewport.name === 'desktop' ? await page.locator('body').innerText() : '';
                await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();
                await expect(page.getByTestId('qidahen-turn-option-finish-slot')).toBeVisible();
                await expect(page.getByTestId('qidahen-turn-choice')).toHaveCount(0);
                if (viewport.name === 'desktop') {
                    const continued = await read(page);
                    trace.steps.push({ id: 'post-tutorial-continue', action: 'wheel-move-1-free',
                        before: { visible: { text: beforeContinueText }, authoritative: summarize(final) },
                        after: { visible: { text: await page.locator('body').innerText() }, authoritative: summarize(continued) },
                        assertions: [assertEqual('tutorial-inactive-after-next-input', continued.tutorial.active, false)] });
                    await capture('post-tutorial-continue');
                }
                await assertNoFatalFrontendErrors([{ label: viewport.name, diagnostics }]);
                const sourceIdentity = await verifySourceIdentity();
                trace.sourceIdentity = sourceIdentity;
                requireCompleteQidahenSourceIdentity(sourceIdentity);
                const capturedStates = trace.uiStates as Array<{ id: string; viewport: string }>;
                for (const required of captureContract.requiredStates.filter(state => state.chainId === trace.chainId)) {
                    expect(capturedStates.some(state => state.id === required.uiStateId && state.viewport === required.viewport),
                        `required UI state missing: ${required.uiStateId}`).toBe(true);
                }
                expect(readFileSync(captureContractPath).equals(captureContractBytes), 'capture contract changed during run').toBe(true);
                trace.captureContract = { path: captureContractPath, sha256: createHash('sha256').update(captureContractBytes).digest('hex') };
                trace.outcome = { tutorialActive: final.tutorial.active, year: final.core.currentYearIndex, claimed: final.core.chronology.claimedCardIds.ming, nextInputAccepted: true };
                trace.status = 'PASS';
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
                if (!trace.sourceIdentity) trace.sourceIdentity = { status: 'INCOMPLETE', reason: 'source identity verification did not complete' };
                saveBlobDiagnostics();
                await performanceSession.detach().catch(() => {});
                writeFileSync(resolve(dir, 'browser-performance.json'), JSON.stringify(performanceSamples, null, 2));
                writeFileSync(resolve(dir, 'behavior-trace.json'), JSON.stringify(trace, null, 2));
                await touchContext?.close();
            }
        });
    }
});
