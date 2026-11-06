import { beginBattleRecording } from './battleRecording';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../../src/games/qidahen/annualTutorial';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { waitForQidahenVisualReady } from './visualReady';
import { clickVisibleButton } from './tutorialPointer';

// 仅手工诊断：输入是正式管线/真实保存点，不冒充从开场的完整行为链。
test.use({ channel: 'chromium', launchOptions: { args: [] } });
for (const viewport of [{ width: 1362, height: 780 }, { width: 1920, height: 1080 }]) {
test(`layering-wheel 介绍轮盘应贴近轮盘且不躲避无关地图单位 ${viewport.width}`, async ({ page }) => {
    test.setTimeout(180_000);
    await setChineseLocale(page); await disableAudio(page);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-tutorial-step="frontier-goal"]')).toBeVisible({ timeout: 90_000 });
    await waitForQidahenVisualReady(page);
    await clickVisibleButton(page, 'tutorial-next-button');
    await expect(page.locator('[data-tutorial-step="opening-move"]')).toBeVisible();
    await waitForQidahenVisualReady(page);
    const geometry = async () => {
        const wheel = (await page.getByTestId('qidahen-action-wheel').boundingBox())!;
        const hint = (await page.getByTestId('tutorial-overlay-card').boundingBox())!;
        const dx = Math.max(0, hint.x - wheel.x - wheel.width, wheel.x - hint.x - hint.width);
        const dy = Math.max(0, hint.y - wheel.y - wheel.height, wheel.y - hint.y - hint.height);
        return { wheel, hint, gap: Math.hypot(dx, dy) };
    };
    const before = await geometry();
    const directory = resolve('evidence/qidahen/tutorial-layering-20261101-r145/diagnostics', process.env.QIDAHEN_LAYERING_DIAGNOSTIC ?? 'current', String(viewport.width));
    mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, 'opening-move.png') });
    writeFileSync(resolve(directory, 'receipt.json'), JSON.stringify({ source: 'real-tutorial-entry', viewport: page.viewportSize(), before }, null, 2));
    expect(before.gap, '轮盘说明必须与真实轮盘相邻，不能漂到牌桌另一端').toBeLessThanOrEqual(64);
    await expect(page.getByTestId('qidahen-wheel-move-target-move-1-free')).toHaveAttribute('data-wheel-primary', 'true');
    const layer = page.getByTestId('qidahen-map-layer');
    const readPan = async () => ({ x: await layer.getAttribute('data-map-pan-x'), y: await layer.getAttribute('data-map-pan-y') });
    const panBefore = await readPan();
    await page.mouse.move(650, 440); await page.mouse.down();
    await page.mouse.move(740, 500, { steps: 12 }); await page.mouse.up();
    await expect(layer).toBeVisible();
    await expect.poll(readPan).not.toEqual(panBefore);
    await waitForQidahenVisualReady(page);
    const after = await geometry();
    expect(after.wheel).toEqual(before.wheel);
    expect(after.hint.x).toBeCloseTo(before.hint.x, 0);
    expect(after.hint.y).toBeCloseTo(before.hint.y, 0);
    await page.screenshot({ path: resolve(directory, 'opening-move-map-panned.png') });
    writeFileSync(resolve(directory, 'receipt.json'), JSON.stringify({ source: 'real-tutorial-entry', viewport: page.viewportSize(), before, after, panBefore, panAfter: await readPan(), scenePannedWithoutMovingHud: true }, null, 2));
});
}
test('诊断：真实战后保存点展开战报的命中对象', async ({ page }) => {
    test.setTimeout(180_000);
    const failure = JSON.parse(readFileSync('C:/Users/zhuagenbao/AppData/Local/Temp/BoardGame-qidahen-annual-20261030/annual-r143-causal-pc-20261101/desktop/layout-failure.json', 'utf8'));
    await setChineseLocale(page); await disableAudio(page); await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(saved => {
        (window as any).__E2E_TEST_MODE__ = true;
        for (const entry of saved) localStorage.setItem(entry.key, entry.snapshot);
    }, failure.saved);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="occupy"]')).toBeVisible({ timeout: 90_000 });
    await waitForQidahenVisualReady(page);
    const measure = () => page.getByTestId('qidahen-post-battle-mode-occupy').evaluate(element => {
        const r = element.getBoundingClientRect(); const x = r.x + r.width / 2; const y = r.y + r.height / 2;
        return { button: r.toJSON(), stack: document.elementsFromPoint(x, y).slice(0, 5).map(el => ({ tag: el.tagName, id: el.getAttribute('data-testid'), classes: el.className, text: el.textContent?.slice(0, 100) })) };
    });
    const before = await measure();
    await page.getByTestId('qidahen-battle-report').locator('summary').click();
    await expect(page.getByTestId('qidahen-post-battle-dice-summary')).toBeVisible();
    await waitForQidahenVisualReady(page);
    const after = await measure();
    mkdirSync('test-results/qidahen-layout-diagnostic', { recursive: true });
    writeFileSync('test-results/qidahen-layout-diagnostic/occupy-report.json', JSON.stringify({ before, after }, null, 2));
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable'); await session.send('Profiler.enable'); await session.send('Profiler.start');
    const metricsBefore = await session.send('Performance.getMetrics');
    const started = performance.now();
    await page.waitForTimeout(3000);
    const metricsAfter = await session.send('Performance.getMetrics');
    const elapsedMs = performance.now() - started;
    const { profile } = await session.send('Profiler.stop');
    const samples = new Map<number, number>();
    profile.samples?.forEach((id, index) => samples.set(id, (samples.get(id) ?? 0) + (profile.timeDeltas?.[index] ?? 0)));
    const top = profile.nodes.map(node => ({ frame: node.callFrame, sampledMs: (samples.get(node.id) ?? 0) / 1000 })).sort((a, b) => b.sampledMs - a.sampledMs).slice(0, 20);
    const delta = Object.fromEntries(metricsAfter.metrics.filter(item => ['ScriptDuration', 'TaskDuration', 'LayoutDuration', 'RecalcStyleDuration'].includes(item.name))
        .map(item => [item.name, item.value - (metricsBefore.metrics.find(old => old.name === item.name)?.value ?? 0)]));
    const label = process.env.QIDAHEN_PROFILE_LABEL ?? 'before';
    writeFileSync(`test-results/qidahen-layout-diagnostic/occupy-performance-${label}.json`, JSON.stringify({ elapsedMs, delta, top, before, after }, null, 2));
    writeFileSync(`test-results/qidahen-layout-diagnostic/occupy-performance-${label}.cpuprofile`, JSON.stringify(profile));
    await session.detach();
    await page.screenshot({ path: resolve('test-results/qidahen-layout-diagnostic/occupy-report.png') });
    await page.getByTestId('qidahen-battle-report').locator('summary').click();
    await expect(page.getByTestId('qidahen-post-battle-dice-summary')).not.toBeVisible();
    await clickVisibleButton(page, 'qidahen-post-battle-mode-occupy');
});
test('诊断：真实战斗响应保存点的下一步可点击', async ({ page }) => {
    test.setTimeout(180_000);
    const failure = JSON.parse(readFileSync('C:/Users/zhuagenbao/AppData/Local/Temp/BoardGame-qidahen-annual-20261030/annual-r142-causal-pc-20261101/desktop/layout-failure.json', 'utf8'));
    await setChineseLocale(page); await disableAudio(page); await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(saved => {
        (window as any).__E2E_TEST_MODE__ = true;
        for (const entry of saved) localStorage.setItem(entry.key, entry.snapshot);
    }, failure.saved);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="defender-response"]')).toBeVisible({ timeout: 90_000 });
    await waitForQidahenVisualReady(page);
    const metrics = await page.getByTestId('tutorial-next-button').evaluate(element => {
        const r = element.getBoundingClientRect(); const x = r.x + r.width / 2; const y = r.y + r.height / 2;
        return { button: r.toJSON(), stack: document.elementsFromPoint(x, y).map(el => ({ tag: el.tagName, id: el.getAttribute('data-testid'), classes: el.className, text: el.textContent?.slice(0, 100) })) };
    });
    mkdirSync('test-results/qidahen-layout-diagnostic', { recursive: true });
    writeFileSync('test-results/qidahen-layout-diagnostic/defender-response.json', JSON.stringify(metrics, null, 2));
    await page.screenshot({ path: resolve('test-results/qidahen-layout-diagnostic/defender-response.png') });
    await clickVisibleButton(page, 'tutorial-next-button');
    await expect(page.locator('[data-tutorial-step="tactic-card"]')).toBeVisible();
});
test('诊断：正式年度管线的晚期进度必须完整保存回退历史', async ({ page }) => {
    const snapshot = JSON.parse(readFileSync('test-results/qidahen-actual-annual-checkpoints/training-recruit-target.json', 'utf8'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async saved => {
        const path = '/src/engine/transport/localSession.ts';
        const { persistLocalMatchSnapshot, readLocalMatchSnapshot, buildLocalMatchSnapshotKey } = await import(path);
        persistLocalMatchSnapshot(saved);
        const restored = readLocalMatchSnapshot(saved);
        return { storedStep: restored?.state?.sys?.tutorial?.step?.id ?? null, expectedStep: saved.state.sys.tutorial.step.id,
            sourceBytes: new TextEncoder().encode(JSON.stringify(saved)).length, encodedChars: localStorage.getItem(buildLocalMatchSnapshotKey(saved.gameId, saved.seed))?.length,
            allStatePreserved: JSON.stringify(restored?.state) === JSON.stringify(saved.state), cursorPreserved: restored?.randomCursor === saved.randomCursor,
            allCheckpointsPreserved: JSON.stringify(restored?.state?.sys?.tutorial?.checkpoints) === JSON.stringify(saved.state.sys.tutorial.checkpoints) };
    }, snapshot);
    mkdirSync('test-results/qidahen-layout-diagnostic', { recursive: true });
    writeFileSync('test-results/qidahen-layout-diagnostic/late-storage.json', JSON.stringify(result, null, 2));
    expect(result.storedStep).toBe(result.expectedStep);
    expect(result.allCheckpointsPreserved).toBe(true);
    expect(result.allStatePreserved).toBe(true);
    expect(result.cursorPreserved).toBe(true);
});

for (const id of ['abandon-jinzhou', 'training-recruit-target']) {
    test(`诊断：正式管线合法后段状态恢复布局 ${id}`, async ({ page }) => {
        test.setTimeout(180_000);
        const saved = JSON.parse(readFileSync(`test-results/qidahen-actual-annual-checkpoints/${id}.json`, 'utf8'));
        await setChineseLocale(page); await disableAudio(page); await page.setViewportSize({ width: 1920, height: 1080 });
        await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(async snapshot => {
            const path = '/src/engine/transport/localSession.ts';
            const { persistLocalMatchSnapshot } = await import(path);
            persistLocalMatchSnapshot(snapshot);
        }, saved);
        await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
        await expect(page.locator(`[data-tutorial-step="${id}"]`)).toBeVisible({ timeout: 90_000 });
        await waitForQidahenVisualReady(page);
        if (id === 'abandon-jinzhou') {
            const city = (await page.locator('[data-qidahen-map-context-space="jinzhou"]').boundingBox())!;
            const hint = (await page.getByTestId('tutorial-overlay-card').boundingBox())!;
            expect(hint.x < city.x + city.width && hint.x + hint.width > city.x && hint.y < city.y + city.height && hint.y + hint.height > city.y).toBe(false);
        } else {
            const body = (await page.getByTestId('qidahen-wheel-recruit-train-scroll').boundingBox())!;
            const header = (await page.getByTestId('qidahen-wheel-recruit-train-header').boundingBox())!;
            const target = (await page.getByTestId('qidahen-wheel-recruit-train-choice-' + encodeURIComponent('recruit:city-region-15-liaodong')).boundingBox())!;
            expect(body.y).toBeGreaterThanOrEqual(header.y + header.height);
            expect(target.y).toBeGreaterThanOrEqual(body.y);
            expect(target.y + target.height).toBeLessThanOrEqual(body.y + body.height);
        }
        await page.screenshot({ path: resolve('test-results/qidahen-layout-diagnostic', `${id}.png`) });
    });
}

test('诊断：从真实年中保存点恢复提示布局，不承担完整主链验收', async ({ page }, info) => {
    test.setTimeout(180_000);
    const failure = JSON.parse(readFileSync(process.env.QIDAHEN_LAYOUT_FAILURE_PATH ?? 'test-results/qidahen-layout-diagnostic/source-midyear.json', 'utf8'));
    await setChineseLocale(page); await disableAudio(page); await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(saved => {
        (window as any).__E2E_TEST_MODE__ = true;
        for (const entry of saved) localStorage.setItem(entry.key, entry.snapshot);
    }, failure.saved);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="midyear"]')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('tutorial-overlay-card')).toBeVisible();
    await waitForQidahenVisualReady(page);
    const metrics = () => page.evaluate(() => {
        const rect = document.querySelector('[data-testid="tutorial-overlay-card"]')!.getBoundingClientRect();
        const covered = [...document.querySelectorAll('[data-qidahen-map-protected-token="true"], [data-qidahen-map-protected-population="true"]')].filter(token => {
            const r = token.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top;
        }).map(token => token.getAttribute('data-testid'));
        return { covered, card: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, step: (window as any).__BG_TEST_HARNESS__.state.get().sys.tutorial.step.id };
    });
    await expect.poll(async () => (await metrics()).covered, { timeout: 30_000 }).toEqual([]);
    await expect.poll(async () => Math.round((await metrics()).card.width)).toBe(320);
    const dir = resolve('test-results/qidahen-layout-diagnostic'); mkdirSync(dir, { recursive: true });
    const result = await metrics();
    await page.screenshot({ path: resolve(dir, 'midyear-restored.png') });
    writeFileSync(resolve(dir, 'receipt.json'), JSON.stringify({ status: 'PASS-diagnostic-only', source: 'R139 actual local persistence, real tutorial resume entry', result, fullChainClaimed: false }, null, 2));
    await info.attach('scope', { body: '真实保存点恢复，仅诊断提示布局；不进入最终主链查看器。', contentType: 'text/plain' });
});

for (const id of [...QIDAHEN_ANNUAL_TUTORIAL.steps.filter(step => step.content && step.tooltipAnchorTarget).map(step => step.id), 'occupy']) {
    test(`semantic-anchor 正式管线保存点 ${id}`, async ({ page }) => {
        test.setTimeout(180_000);
        const root = 'evidence/qidahen/tutorial-layering-20261101-r145';
        const saved = JSON.parse(readFileSync(`${root}/fixtures/${id}.json`, 'utf8'));
        await setChineseLocale(page); await disableAudio(page); await page.setViewportSize({ width: 1920, height: 1080 });
        await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(async snapshot => {
            const path = '/src/engine/transport/localSession.ts';
            const { persistLocalMatchSnapshot } = await import(path);
            persistLocalMatchSnapshot(snapshot);
        }, saved);
        await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
        await expect(page.locator(`[data-tutorial-step="${id}"]`)).toBeVisible({ timeout: 90_000 });
        await waitForQidahenVisualReady(page);
        let previous = ''; let stable = 0;
        await expect.poll(async () => {
            const h = await page.getByTestId('tutorial-overlay-card').boundingBox();
            const current = JSON.stringify(h);
            stable = current === previous ? stable + 1 : 0; previous = current;
            return stable;
        }, { timeout: 10_000, intervals: [150, 150, 150] }).toBeGreaterThanOrEqual(2);
        const result = await page.getByTestId('tutorial-overlay-card').evaluate(hint => {
            const rect = hint.getBoundingClientRect();
            const anchorId = hint.getAttribute('data-tutorial-anchor');
            const anchor = document.querySelector(`[data-testid="${anchorId}"]`) || document.querySelector(`[data-tutorial-id="${anchorId}"]`);
            const a = anchor!.getBoundingClientRect();
            const surfaces = [...document.querySelectorAll('[data-testid="qidahen-action-slot"] > *, [data-testid="qidahen-map-region-focus-name"]')].map(el => ({ id: el.getAttribute('data-testid'), bounds: el.getBoundingClientRect().toJSON() }));
            const state = (window as any).__BG_TEST_HARNESS__.state.get();
            const guards = (state.sys.tutorial.step.avoidOverlapSelectors ?? []).flatMap((selector: string) => [...document.querySelectorAll(selector)].map(el => ({ selector, id: el.getAttribute('data-testid'), bounds: el.getBoundingClientRect().toJSON() })));
            return { hint: rect.toJSON(), anchor: { id: anchorId, bounds: a.toJSON() }, surfaces, guards,
                gap: Math.hypot(Math.max(0, rect.left - a.right, a.left - rect.right), Math.max(0, rect.top - a.bottom, a.top - rect.bottom)),
                fullChainClaimed: false };
        });
        const name = page.getByTestId('qidahen-map-region-focus-name');
        if (await name.isVisible()) {
            const region = await name.getAttribute('data-region-id');
            const marker = page.locator(`[data-qidahen-map-token-region="${region}"][data-qidahen-map-token-type="control"]`);
            if (await marker.count()) {
                const n = (await name.boundingBox())!; const m = (await marker.boundingBox())!;
                expect(Math.hypot(Math.max(0, n.x - m.x - m.width, m.x - n.x - n.width), Math.max(0, n.y - m.y - m.height, m.y - n.y - n.height))).toBeLessThanOrEqual(20);
            }
        }
        const dir = resolve(root, 'diagnostics', process.env.QIDAHEN_SEMANTIC_DIAGNOSTIC ?? 'semantic-layer-r148-camera'); mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: resolve(dir, `${id}.png`) });
        writeFileSync(resolve(dir, `${id}.json`), JSON.stringify(result, null, 2));
        expect(result.gap).toBeLessThanOrEqual(64);
        for (const { bounds: r, id: surface } of result.surfaces) {
            const h = result.hint;
            expect(h.left < r.right && h.right > r.left && h.top < r.bottom && h.bottom > r.top, surface).toBe(false);
        }
        if (id === 'reclaim-target' && process.env.QIDAHEN_VERIFY_MAP_PAN === 'true') {
            const layer = page.getByTestId('qidahen-map-layer');
            const mask = page.getByTestId('qidahen-map-region-mask-overlay');
            const candidates = await mask.getAttribute('data-qidahen-candidate-region-ids');
            const before = { x: await layer.getAttribute('data-map-pan-x'), y: await layer.getAttribute('data-map-pan-y') };
            const beforeName = (await name.boundingBox())!;
            const regionIds = (candidates ?? '').split('|');
            const recovery = await page.evaluate(ids => [...document.querySelectorAll<HTMLElement>('[data-qidahen-map-token-type="control"]')]
                .filter(el => ids.includes(el.dataset.qidahenMapTokenRegion ?? '') && el.dataset.qidahenMapTokenRegion !== 'city-region-15-liaodong')
                .map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.qidahenMapTokenRegion!, rect: r.toJSON(), distance: Math.abs(r.x - 960) + Math.abs(r.y - 450), offscreen: r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight }; })
                .sort((a, b) => Number(b.offscreen) - Number(a.offscreen) || b.distance - a.distance)[0], regionIds);
            expect(recovery).toBeDefined();
            const other = page.locator(`[data-qidahen-map-token-region="${recovery.id}"][data-qidahen-map-token-type="control"]`).first();
            const drag = async (dx: number, dy: number) => {
                await page.mouse.move(650, 440); await page.mouse.down();
                await page.mouse.move(650 + Math.max(-350, Math.min(350, dx)), 440 + Math.max(-250, Math.min(250, dy)), { steps: 12 }); await page.mouse.up();
            };
            for (let move = 0; move < 10; move++) {
                const r = (await other.boundingBox())!;
                const dx = 960 - r.x - r.width / 2; const dy = 450 - r.y - r.height / 2;
                if (Math.abs(dx) + Math.abs(dy) < 4) break;
                await drag(dx, dy); await waitForQidahenVisualReady(page);
            }
            const recovered = (await other.boundingBox())!;
            expect(Math.abs(recovered.x + recovered.width / 2 - 960) + Math.abs(recovered.y + recovered.height / 2 - 450)).toBeLessThan(6);
            await expect(mask).toHaveAttribute('data-qidahen-candidate-region-ids', candidates!);
            await expect(page.locator('[data-tutorial-step="reclaim-target"]')).toBeVisible();
            await page.screenshot({ path: resolve(dir, `${id}-map-panned.png`) });
            const panned = { x: await layer.getAttribute('data-map-pan-x'), y: await layer.getAttribute('data-map-pan-y'), name: await name.boundingBox(), recoveredCandidate: recovery.id, originalCandidate: recovery, recovered };
            for (let move = 0; move < 10; move++) {
                const r = (await name.boundingBox())!;
                const dx = beforeName.x - r.x; const dy = beforeName.y - r.y;
                if (Math.abs(dx) + Math.abs(dy) < 1) break;
                // 正式拖图有点击/拖拽阈值；微调仍走两个真实越阈手势，不伪造事件或放宽归位断言。
                if (Math.abs(dx) + Math.abs(dy) < 10) {
                    await drag(dx + 20, dy + 20); await drag(-20, -20);
                } else await drag(dx, dy);
                await waitForQidahenVisualReady(page);
            }
            await expect.poll(async () => Math.abs((await name.boundingBox())!.x - beforeName.x)).toBeLessThan(1);
            await expect.poll(async () => Math.abs((await name.boundingBox())!.y - beforeName.y)).toBeLessThan(1);
            await expect(mask).toHaveAttribute('data-qidahen-candidate-region-ids', candidates!);
            await page.screenshot({ path: resolve(dir, `${id}-map-restored.png`) });
            writeFileSync(resolve(dir, `${id}-pan-receipt.json`), JSON.stringify({ status: 'PASS-diagnostic-only', candidates, before, beforeName, panned, restored: await name.boundingBox(), stateStep: 'reclaim-target', fullChainClaimed: false }, null, 2));
        }
    });
}

test('battle-context 真实战斗保存点的参战身份可见', async ({ page }) => {
    test.setTimeout(180_000);
    const root = 'evidence/qidahen/tutorial-layering-20261101-r145';
    const saved = JSON.parse(readFileSync(`${root}/fixtures/battle-roll.json`, 'utf8'));
    await setChineseLocale(page); await disableAudio(page); await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async snapshot => {
        const path = '/src/engine/transport/localSession.ts'; const { persistLocalMatchSnapshot } = await import(path);
        persistLocalMatchSnapshot(snapshot);
    }, saved);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="battle-roll"]')).toBeVisible({ timeout: 90_000 });
    await waitForQidahenVisualReady(page);
    const dir = resolve(root, 'diagnostics/battle-context-r149'); mkdirSync(dir, { recursive: true });
    const finishRecording = await beginBattleRecording(page, dir, 'representative-state');
    await page.getByTestId('qidahen-resolve-pending-action').click();
    await expect(page.getByTestId('qidahen-battle-roll-sequence')).toBeVisible();
    await expect(page.getByTestId('qidahen-battle-roll-context')).toHaveText('辽北 → 叶赫部');
    await expect(page.getByTestId('qidahen-battle-roll-context')).toBeVisible();
    await expect(page.getByTestId('qidahen-battle-roll-sequence')).toBeHidden({ timeout: 90_000 });
    const recording = await finishRecording();
    await expect(page.locator('[data-tutorial-step="occupy"]')).toBeVisible();
    writeFileSync(resolve(dir, 'receipt.json'), JSON.stringify({ status: 'PASS-diagnostic-only', source: 'saved-state-diagnostic', flow: 'representative-state', fullChainClaimed: false, pictures: recording.pictures, video: recording.video, frameCount: recording.frameCount, durationSeconds: recording.durationSeconds, actualNextStep: 'occupy' }, null, 2));
});
