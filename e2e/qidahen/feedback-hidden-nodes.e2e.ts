import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { waitForQidahenVisualReady } from './visualReady';

// 仅隔离实验：不更改正式截图；终局是 harness 代表态。
test('反馈截图忽略 display:none 子树对照', async ({ page }) => {
    test.setTimeout(240_000);
    await setChineseLocale(page); await disableAudio(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 90_000 });
    await waitForQidahenVisualReady(page);
    const dir = resolve('test-results/qidahen-feedback-hidden-nodes'); mkdirSync(dir, { recursive: true });
    const compare = async (state: string) => {
        const result = await page.evaluate(async () => {
            const h = await (new Function('url', 'return import(url)'))('/node_modules/html2canvas/dist/html2canvas.esm.js');
            const h2c = h.default;
            const all = [...document.body.querySelectorAll('*')];
            // 只计算顶层隐藏子树，防止重复计数；不排除 visibility、overflow 或透明元素。
            const hidden = all.filter(el => getComputedStyle(el).display === 'none');
            const hiddenSet = new Set(hidden);
            const roots = hidden.filter(el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (hiddenSet.has(p)) return false; return true; });
            const hiddenDescendants = roots.reduce((sum, el) => sum + 1 + el.querySelectorAll('*').length, 0);
            const raf: number[] = []; let running = true;
            const tick = (t: number) => { raf.push(t); if (running) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
            const take = async (ignoreHidden: boolean) => {
                const start = performance.now();
                const canvas = await h2c(document.body, {
                    backgroundColor: null, foreignObjectRendering: true, useCORS: true, logging: false, scale: 1,
                    width: innerWidth, height: innerHeight, windowWidth: innerWidth, windowHeight: innerHeight,
                    x: scrollX, y: scrollY, scrollX, scrollY,
                    ...(ignoreHidden ? { ignoreElements: (el: Element) => getComputedStyle(el).display === 'none' } : {}),
                    onclone: async (clone: Document) => {
                        clone.querySelectorAll('[data-feedback-exclude="true"], [data-testid="feedback-modal"]').forEach(el => el.remove());
                        await Promise.all([...clone.images].map(async image => {
                            const rect = image.getBoundingClientRect();
                            if (!rect.width || !rect.height || rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) return;
                            const src = image.currentSrc || image.src; if (!src || src.startsWith('data:')) return;
                            const response = await fetch(src, { credentials: 'same-origin' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
                            const blob = await response.blob();
                            image.src = await new Promise<string>((done, fail) => { const r = new FileReader(); r.onload = () => done(String(r.result)); r.onerror = fail; r.readAsDataURL(blob); });
                            image.removeAttribute('srcset'); await image.decode();
                        }));
                    },
                });
                const end = performance.now();
                const scaled = document.createElement('canvas'); scaled.width = 1280; scaled.height = 720;
                scaled.getContext('2d')!.drawImage(canvas, 0, 0, 1280, 720);
                return { image: scaled.toDataURL('image/jpeg', 0.7), start, end };
            };
            const baseline = await take(false); await new Promise<void>(r => requestAnimationFrame(() => r()));
            const candidate = await take(true); await new Promise<void>(r => requestAnimationFrame(() => r())); running = false;
            const gaps = raf.slice(1).map((t, i) => ({ start: raf[i], end: t, gap: t - raf[i] }));
            const maxGap = (start: number, end: number) => Math.max(0, ...gaps.filter(g => g.start < end && g.end > start).map(g => g.gap));
            return { baseline: baseline.image, candidate: candidate.image, count: all.length, hidden: hidden.length, hiddenRoots: roots.length, hiddenDescendants,
                baselineMs: baseline.end - baseline.start, candidateMs: candidate.end - candidate.start,
                baselineMaxRafMs: maxGap(baseline.start, baseline.end), candidateMaxRafMs: maxGap(candidate.start, candidate.end) };
        });
        for (const [name, data] of [['baseline', result.baseline], ['candidate', result.candidate]] as const) writeFileSync(resolve(dir, `${state}-${name}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
        const metrics = { ...result, baseline: !!result.baseline, candidate: !!result.candidate };
        writeFileSync(resolve(dir, `${state}-metrics.json`), JSON.stringify(metrics, null, 2)); console.log('HIDDEN_NODES', state, JSON.stringify(metrics));
    };
    await compare('board');
    await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
    await page.evaluate(async () => { const api = (window as any).__BG_TEST_HARNESS__.state; const next = structuredClone(api.get()); next.sys = { ...next.sys, phase: 'end', gameover: { winner: '0' } }; await api.set(next); });
    await expect(page.getByTestId('endgame-overlay')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2500); await compare('endgame-portal');
});
