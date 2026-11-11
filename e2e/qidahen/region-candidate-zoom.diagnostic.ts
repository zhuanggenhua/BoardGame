/**
 * PC 诊断：正式年度教程的开垦候选和东江窄尾，按地图原生缩放和真实鼠标输入检查。
 * PowerShell：设置 PW_TEST_MATCH 为本诊断文件的 glob，再通过 run-e2e-command.mjs ci 指定本文件。
 * 产物仅为待审诊断证据；逐图视觉判定由独立验收执行，不自动产生 PASS/查看器。
 * 缩放使用教程自动取景、复位和原生 + 控件；PC 控件没有精确 120% 档，保留 114% 与 130%。
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, disableAudio, setChineseLocale } from '../helpers/common';
import { dragQidahenMap } from './mapPointer';
import { trackQidahenSourceIdentity, requireCompleteQidahenSourceIdentity, QIDAHEN_VISUAL_SOURCE_PATHS } from './sourceIdentity';
import { waitForQidahenVisualReady } from './visualReady';

test.use({ channel: 'chromium', launchOptions: { args: [] }, viewport: { width: 1920, height: 1080 } });
const EAST = 'city-region-22';
const dir = resolve(process.env.QIDAHEN_ZOOM_DIAGNOSTIC_DIR ?? 'test-results/qidahen-region-candidate-zoom');
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

async function snapshot(page: Page) {
    return page.evaluate(() => {
        const state = (window as unknown as { __BG_TEST_HARNESS__: { state: { get(): {
            core: { regions: Array<{ id: string; name: string; population: number; isLogicalRegion?: boolean }> };
            sys: { tutorial: { step: { id: string; content: string; aiActions?: unknown[] } }; interaction?: { current?: { data?: { options?: Array<{ id: string; disabled?: boolean }> } } } };
        } } } }).__BG_TEST_HARNESS__.state.get();
        return { core: state.core, step: state.sys.tutorial.step,
            options: state.sys.interaction?.current?.data?.options ?? [] };
    });
}

/** 读取真实蒙版，仅提取诊断点击坐标，不修改蒙版、游戏状态或业务规则。 */
async function mapEvidence(page: Page, candidateIds: string[]) {
    return page.evaluate(async ids => {
        const modulePath = '/src/games/qidahen/ui/runtimeRegionOwnership.ts';
        const { buildQidahenRuntimeRegionIdByPixel } = await import(modulePath);
        const image = new Image(); image.src = '/src/games/qidahen/data/region-mask.png'; await image.decode();
        const buffer = document.createElement('canvas'); buffer.width = image.naturalWidth; buffer.height = image.naturalHeight;
        const context = buffer.getContext('2d')!; context.drawImage(image, 0, 0);
        const owners: Array<string | null> = buildQidahenRuntimeRegionIdByPixel(context.getImageData(0, 0, buffer.width, buffer.height).data, buffer.width, buffer.height);
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="qidahen-map-hitmap-canvas"]');
        if (!canvas) throw new Error('真实地图命中画布不存在');
        const rect = canvas.getBoundingClientRect();
        const screen = (x: number, y: number) => ({ x: rect.left + (x + .5) / buffer.width * rect.width, y: rect.top + (y + .5) / buffer.height * rect.height });
        const wanted = new Set(ids), rows = new Map<number, number[]>();
        const visible: Record<string, { count: number; sample?: { x: number; y: number }; reachable?: boolean }> = {};
        for (let y = 0; y < buffer.height; y++) for (let x = 0; x < buffer.width; x++) {
            const id = owners[y * buffer.width + x];
            if (id === 'city-region-22') { const row = rows.get(y) ?? []; row.push(x); rows.set(y, row); }
            if (!id || !wanted.has(id) || x % 3 || y % 3) continue;
            const point = screen(x, y);
            if (point.x < 0 || point.x >= innerWidth || point.y < 0 || point.y >= innerHeight) continue;
            const item = visible[id] ??= { count: 0 }; item.count++;
            if (!item.reachable) {
                const top = document.elementFromPoint(point.x, point.y);
                if (top === canvas) { item.sample = point; item.reachable = true; }
            }
        }
        // 南端最靠下且有至少 5 个连续命中像素的窄尾；避开单像素噪点。
        const tailRows = [...rows].sort((a, b) => b[0] - a[0]);
        const tail: Array<{ pixel: { x: number; y: number }; screen: { x: number; y: number }; reachable: boolean }> = [];
        for (const [y, xs] of tailRows) {
            if (tail.length >= 30) break;
            const sorted = xs.sort((a, b) => a - b);
            for (let i = 2; i < sorted.length - 2; i++) {
                if (sorted[i + 2] - sorted[i - 2] !== 4) continue;
                const point = screen(sorted[i], y), top = document.elementFromPoint(point.x, point.y);
                tail.push({ pixel: { x: sorted[i], y }, screen: point, reachable: top === canvas });
            }
        }
        const overlay = document.querySelector('[data-testid="qidahen-map-region-mask-overlay"]');
        return { zoom: Number(document.querySelector('[data-testid="qidahen-map-layer"]')?.getAttribute('data-map-zoom')),
            candidateIds: ids, overlayIds: (overlay?.getAttribute('data-qidahen-candidate-region-ids') ?? '').split('|').filter(Boolean),
            visibleCandidates: visible, mapRect: rect.toJSON(), tail };
    }, candidateIds);
}

test('PC 正式教程：开垦候选在真实缩放下可读并从东江窄尾鼠标选择', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(dir, { recursive: true });
    const diagnostics = attachPageDiagnostics(page);
    const verifySource = trackQidahenSourceIdentity(page, 'e2e/qidahen/region-candidate-zoom.diagnostic.ts',
        ['e2e/qidahen/mapPointer.ts', 'e2e/qidahen/visualReady.ts', 'e2e/qidahen/sourceIdentity.ts', 'e2e/helpers/common.ts'],
        [...QIDAHEN_VISUAL_SOURCE_PATHS, 'src/games/qidahen/Board.tsx', 'src/games/qidahen/annualTutorial.ts',
            'src/games/qidahen/annualFarmTutorial.ts', 'src/games/qidahen/ui/runtimeRegionOwnership.ts']);
    const report: Record<string, unknown> = { gameId: 'qidahen', evidenceCategory: 'tutorial',
        status: 'INCOMPLETE', visualReview: 'PENDING', entry: '/play/qidahen/tutorial/basic-opening', viewport: { width: 1920, height: 1080 }, samples: [] };
    try {
        await setChineseLocale(page); await disableAudio(page);
        await page.addInitScript(() => { (window as unknown as { __E2E_TEST_MODE__: boolean }).__E2E_TEST_MODE__ = true; });
        await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-tutorial-step="frontier-goal"]')).toBeVisible({ timeout: 120_000 });
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.locator('[data-tutorial-step="frontier-target"]')).toBeVisible();
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.locator('[data-tutorial-step="opening-move"]')).toBeVisible();
        // 先放大再用真实 PC 鼠标拖离轮盘，避免在铺满视口的最小缩放下拖出地图边界。
        await page.getByTestId('qidahen-map-zoom-in').click();
        await page.getByTestId('qidahen-map-zoom-in').click();
        await page.getByTestId('qidahen-map-zoom-in').click();
        for (let attempt = 0; attempt < 5 && !await page.getByTestId('qidahen-map-locate-wheel').isVisible(); attempt++) {
            await dragQidahenMap(page, -400, 0);
        }
        await expect(page.getByTestId('qidahen-map-locate-wheel')).toBeVisible();
        const offscreenImage = resolve(dir, 'wheel-offscreen.png');
        await page.screenshot({ path: offscreenImage });
        await page.getByTestId('qidahen-map-locate-wheel').click();
        await expect(page.getByTestId('qidahen-map-locate-wheel')).toHaveCount(0);
        const wheelBox = await page.getByTestId('qidahen-action-wheel').boundingBox();
        expect(wheelBox).not.toBeNull();
        expect(wheelBox!.x).toBeGreaterThanOrEqual(0);
        expect(wheelBox!.y).toBeGreaterThanOrEqual(0);
        expect(wheelBox!.x + wheelBox!.width).toBeLessThanOrEqual(1920);
        expect(wheelBox!.y + wheelBox!.height).toBeLessThanOrEqual(1080);
        const locatedImage = resolve(dir, 'wheel-located.png');
        await page.screenshot({ path: locatedImage });
        report.wheel = { offscreenImage, offscreenSha256: sha256(offscreenImage), locatedImage,
            locatedSha256: sha256(locatedImage), wheelBox, input: 'PC 鼠标拖拽后点击回到轮盘' };
        await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();
        await expect(page.getByTestId('qidahen-turn-option-reclaim')).toBeVisible();
        Object.assign(report.wheel as object, { sectorClick: 'move-1-free', sectorResult: '进入开垦军屯菜单' });
        await page.getByTestId('qidahen-turn-option-reclaim').click();
        await expect.poll(async () => (await snapshot(page)).step.content).toContain('reclaim-target-dynamic');
        const initial = await snapshot(page);
        const candidates = initial.options.filter(option => !option.disabled && initial.core.regions.some(region => region.id === option.id && !region.isLogicalRegion)).map(option => option.id);
        expect(candidates).toContain(EAST);
        const samples = report.samples as object[];
        // 先记录此步骤自动取景的真实档位，再通过 PC 自带控制恢复/递增。
        for (const [label, action] of [ ['automatic', 'none'], ['100', 'reset'], ['114', 'reset-plus'], ['130', 'reset-plus-plus'] ] as const) {
            if (action !== 'none') await page.getByTestId('qidahen-map-zoom-reset').click();
            if (action === 'reset-plus' || action === 'reset-plus-plus') await page.getByTestId('qidahen-map-zoom-in').click();
            if (action === 'reset-plus-plus') await page.getByTestId('qidahen-map-zoom-in').click();
            const expected = label === 'automatic' ? 1.82 : Number(label) / 100;
            await expect.poll(async () => Math.abs(Number(await page.getByTestId('qidahen-map-layer').getAttribute('data-map-zoom')) - expected),
                { timeout: 10_000, message: `${label} 实际地图缩放` }).toBeLessThan(0.025);
            await waitForQidahenVisualReady(page);
            let observed = await mapEvidence(page, candidates);
            expect(observed.overlayIds.slice().sort()).toEqual(candidates.slice().sort());
            const beforeImage = resolve(dir, `${label}-candidates.png`);
            await page.screenshot({ path: beforeImage });
            // 有些尾端被 HUD 挡住或出屏：通过真实鼠标拖动画面找可见命中点。
            for (let attempt = 0; attempt < 12 && !observed.tail.some(point => point.reachable); attempt++) {
                const target = observed.tail[0]?.screen;
                if (!target) throw new Error('东江窄尾缺少连续真实命中像素');
                await dragQidahenMap(page, Math.max(-180, Math.min(180, 1100 - target.x)), Math.max(-140, Math.min(140, 520 - target.y)));
                observed = await mapEvidence(page, candidates);
            }
            const tail = observed.tail.find(point => point.reachable);
            expect(tail, `${label} 东江窄尾可由鼠标命中`).toBeDefined();
            const before = await snapshot(page);
            const clickProbe = async (point: { x: number; y: number }) => page.evaluate(point => {
                const hit = document.elementFromPoint(point.x, point.y);
                const layer = document.querySelector('[data-testid="qidahen-map-layer"]');
                const map = document.querySelector('[data-testid="qidahen-map-hitmap-canvas"]');
                const choice = document.querySelector('[data-testid="qidahen-turn-choice"]');
                const selected = document.querySelector('[data-testid="qidahen-map-selected-region-name"]');
                return { point, hit: hit?.outerHTML.slice(0, 450), map: map?.getBoundingClientRect().toJSON(),
                    zoom: layer?.getAttribute('data-map-zoom'), panX: layer?.getAttribute('data-map-pan-x'), panY: layer?.getAttribute('data-map-pan-y'),
                    selectedRegionLabel: selected?.textContent ?? null, selectedChoiceText: choice?.textContent ?? null };
            }, point);
            const pointLog: object[] = [];
            const sample: Record<string, unknown> = { label, actualZoom: observed.zoom, zoomInput: action, candidates,
                overlayIds: observed.overlayIds, visibleCandidates: observed.visibleCandidates, tailPixel: tail!.pixel,
                screenshot: beforeImage, screenshotSha256: sha256(beforeImage), pointLog, result: 'in-progress' };
            samples.push(sample);
            const beforeClick = await clickProbe(tail!.screen);
            pointLog.push({ when: 'before-first-click', ...beforeClick });
            writeFileSync(resolve(dir, 'diagnostic.json'), JSON.stringify(report, null, 2));
            await page.mouse.move(tail!.screen.x, tail!.screen.y);
            await page.mouse.click(tail!.screen.x, tail!.screen.y);
            const selected = page.getByTestId('qidahen-map-selected-region-name');
            await expect(selected).toContainText('东江');
            await expect.poll(async () => Number(await page.getByTestId('qidahen-map-layer').getAttribute('data-map-zoom')),
                { message: `${label} 点选后保持玩家缩放` }).toBeCloseTo(observed.zoom, 2);
            const afterClick = await clickProbe(tail!.screen);
            pointLog.push({ when: 'after-first-click', ...afterClick });
            expect({ panX: afterClick.panX, panY: afterClick.panY }, `${label} 点选后保持玩家平移`)
                .toEqual({ panX: beforeClick.panX, panY: beforeClick.panY });
            const selectedImage = resolve(dir, `${label}-dongjiang-selected.png`);
            await page.screenshot({ path: selectedImage });
            if (label !== '130') {
                const updated = await mapEvidence(page, candidates);
                const currentTail = updated.tail.find(point => point.pixel.x === tail!.pixel.x && point.pixel.y === tail!.pixel.y) ?? updated.tail.find(point => point.reachable);
                expect(currentTail?.reachable, `${label} 已选择后窄尾可再次点击`).toBe(true);
                pointLog.push({ when: 'before-second-click', pixel: currentTail!.pixel, ...await clickProbe(currentTail!.screen) });
                writeFileSync(resolve(dir, 'diagnostic.json'), JSON.stringify(report, null, 2));
                await page.mouse.click(currentTail!.screen.x, currentTail!.screen.y);
                pointLog.push({ when: 'after-second-click', ...await clickProbe(currentTail!.screen) });
                writeFileSync(resolve(dir, 'diagnostic.json'), JSON.stringify(report, null, 2));
                await expect(selected).toHaveCount(0);
                expect((await snapshot(page)).core).toEqual(before.core);
            } else {
                await page.getByTestId('qidahen-turn-confirm').click();
                await expect.poll(async () => (await snapshot(page)).core.regions.find(region => region.id === EAST)?.population)
                    .toBe(before.core.regions.find(region => region.id === EAST)!.population + 1);
            }
            Object.assign(sample, { click: tail!.screen, selectedScreenshot: selectedImage,
                selectedScreenshotSha256: sha256(selectedImage), result: label === '130' ? 'confirmed-population-plus-one' : 'draft-selected-then-cleared' });
            writeFileSync(resolve(dir, 'diagnostic.json'), JSON.stringify(report, null, 2));
        }
        report.sourceIdentity = requireCompleteQidahenSourceIdentity(await verifySource());
        report.status = 'BEHAVIOR_CAPTURED_VISUAL_REVIEW_PENDING';
        report.notes = '自动取景约 182%；PC 控件按 1.14 倍缩放，100% 复位后的相邻档为 114%、130%，不声称已测精确 120%。';
        await assertNoFatalFrontendErrors([{ label: 'desktop', diagnostics }]);
    } catch (error) {
        report.failure = String(error);
        throw error;
    } finally {
        writeFileSync(resolve(dir, 'diagnostic.json'), JSON.stringify(report, null, 2));
    }
});
