import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { initBetrayalContext, waitForBetrayalPageReady, warmBetrayalFrontend } from './betrayalTestHelpers';
import { attachPageDiagnostics, assertNoFatalFrontendErrors } from '../helpers/common';

// Independent natural-entry camera contract. Staging is diagnostic until visual review.
const staging = `evidence/山屋惊魂-Pixi地图交互/_temporary/${Date.now()}`;
test.use({
    viewport: { width: 1600, height: 900 },
    launchOptions: process.env.PW_BROWSER_EXECUTABLE ? {
        executablePath: process.env.PW_BROWSER_EXECUTABLE,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    } : undefined,
});

test('小黑屋真实开局后的地图拖拽与锚点缩放', async ({ page, context }) => {
    test.setTimeout(180000);
    mkdirSync(staging, { recursive: true });
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, 'betrayal-pixi-map');
    await warmBetrayalFrontend(context);
    await page.goto('/play/betrayal?players=3&seat0=human&seat1=local-ai&seat2=local-ai&playerID=0');
    await waitForBetrayalPageReady(page);
    const confirm = page.getByTestId('betrayal-character-confirm');
    await confirm.click();
    await page.getByTestId('betrayal-character-scenario-button').click();
    await page.getByTestId('betrayal-scenario-option-mummy-rampage').click();
    await page.getByTestId('betrayal-scenario-select-current').click();
    const opening = page.getByTestId('betrayal-start-scenario-opening-stage');
    for (const label of [/确认此剧本卡/, /开始剧本/]) {
        await expect.poll(async () => await opening.isVisible() || ((await confirm.isVisible()) && await confirm.isEnabled())).toBe(true);
        if (await opening.isVisible()) break;
        if (label.test(await confirm.textContent() ?? '')) await confirm.click();
    }
    await expect(opening).toBeVisible({ timeout: 30000 });
    await page.getByTestId('betrayal-start-scenario-opening-continue').click();
    await expect(opening).toHaveCount(0);
    const intro = page.getByTestId('betrayal-turn-intro-skip');
    if (await intro.isVisible()) await intro.click();
    await expect(intro).toHaveCount(0);
    const canvas = page.getByTestId('betrayal-pixi-map-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas.locator('..')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 30000 });
    const grid = page.getByTestId('betrayal-room-grid');
    const pose = () => grid.evaluate(el => ({ x: Number(el.dataset.panX), y: Number(el.dataset.panY), zoom: Number(el.dataset.zoom) }));
    await expect.poll(async () => (await pose()).zoom).toBeGreaterThan(0);
    await page.screenshot({ path: `${staging}/01-开局房间与棋子.png` });
    const before = await pose();
    await page.mouse.move(900, 390);
    await page.mouse.down();
    await page.mouse.move(1030, 490, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => (await pose()).x - before.x).toBeGreaterThan(80);
    await expect.poll(async () => (await pose()).y - before.y).toBeGreaterThan(60);
    await page.screenshot({ path: `${staging}/02-横纵拖动地图.png` });
    const beforeZoom = await pose();
    await page.mouse.wheel(0, -120);
    await expect.poll(async () => (await pose()).zoom).toBeGreaterThan(beforeZoom.zoom + 0.03);
    await page.screenshot({ path: `${staging}/03-放大后地图与固定界面.png` });
    assertNoFatalFrontendErrors([{ label: 'betrayal-pixi-map', diagnostics }]);
});
