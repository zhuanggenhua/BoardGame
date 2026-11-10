import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { disableAudio, disableTutorial, setChineseLocale } from '../helpers/common';
import { waitForQidahenVisualReady } from './visualReady';

// 使用项目现有的合法开局预置进入正式棋盘；不注入游戏状态或调用内部命中函数。
const boardUrl = '/play/qidahen?tutorialSetup=basic-opening&players=3&seat0=human&seat1=human&seat2=human&playerID=1';
const samples = [
    { x: 900, y: 85, id: 'city-region-4', name: '乌喇' },
    { x: 900, y: 120, id: 'city-region-7', name: '叶赫' },
    { x: 810, y: 180, id: 'city-region-3', name: '科尔沁' },
    { x: 845, y: 180, id: 'city-region-7', name: '叶赫' },
    { x: 940, y: 180, id: 'city-region-7', name: '叶赫' },
    { x: 975, y: 180, id: 'city-region-9', name: '哈达' },
    { x: 900, y: 245, id: 'city-region-7', name: '叶赫' },
    { x: 900, y: 295, id: 'city-region-15', name: '辽北' },
    { x: 700, y: 140, id: 'city-region-3', name: '科尔沁' },
    { x: 700, y: 155, id: 'city-region-6', name: '扎鲁特' },
    { x: 770, y: 185, id: 'city-region-3', name: '科尔沁' },
    { x: 770, y: 210, id: 'city-region-10', name: '内喀尔喀' },
    { x: 1040, y: 115, id: 'city-region-4', name: '乌喇' },
    { x: 1040, y: 155, id: 'city-region-9', name: '哈达' },
    { x: 1200, y: 180, id: 'city-region-5', name: '辉发' },
    { x: 1200, y: 220, id: 'city-region-11', name: '长白' },
] as const;

test.use({ channel: 'chromium', launchOptions: { args: [] } });

async function openBoard(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await setChineseLocale(page);
    await disableAudio(page);
    await disableTutorial(page);
    await page.addInitScript(() => { (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true; });
    await page.goto(boardUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('qidahen-map-layer')).toHaveAttribute('data-map-hit-testing-ready', 'true', { timeout: 60_000 });
    await expect(page.getByTestId('qidahen-map-hitmap-canvas')).toBeVisible();
    await expect(page.getByTestId('qidahen-scenario-pregame-screen')).toHaveCount(0);
    await waitForQidahenVisualReady(page);
    const response = await page.request.get('/src/games/qidahen/data/region-mask.png');
    expect(response.ok()).toBe(true);
    const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    expect(hash(await response.body()), '浏览器服务和当前工作区必须读取同一份蒙版').toBe(
        hash(readFileSync('src/games/qidahen/data/region-mask.png')),
    );
}

async function pointOnMap(page: Page, x: number, y: number) {
    const point = () => page.getByTestId('qidahen-map-hitmap-canvas').evaluate((canvas, source) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = rect.left + (source.x + 0.5) / 1265 * rect.width;
        const clientY = rect.top + (source.y + 0.5) / 893 * rect.height;
        const inViewport = clientX > 0 && clientY > 0 && clientX < innerWidth && clientY < innerHeight;
        const hit = inViewport ? document.elementFromPoint(clientX, clientY) : null;
        return { x: clientX, y: clientY, inViewport, reachesCanvas: hit === canvas, hit: hit?.closest('[data-testid]')?.getAttribute('data-testid') ?? hit?.tagName ?? null };
    }, { x, y });
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await point();
        if (current.inViewport && current.reachesCanvas) return current;
        // 使用真实地图拖拽把同一个原图坐标移到可操作区域，不改变取样位置。
        const dx = Math.max(-220, Math.min(220, 960 - current.x));
        const dy = Math.max(-160, Math.min(160, 540 - current.y));
        // 轮盘位于地图层之上，拖拽起点及终点都避开它，防止探测时误触轮盘。
        const start = await page.evaluate(({ dx, dy }) => {
            const wheel = document.querySelector('[data-testid="qidahen-action-wheel"]')?.getBoundingClientRect();
            for (const y of [540, 600, 700, 440]) for (const x of [1100, 1250, 950, 1400]) {
                if (x + dx < 0 || x + dx >= innerWidth || y + dy < 0 || y + dy >= innerHeight) continue;
                if (wheel && Math.min(x, x + dx) < wheel.right + 12 && Math.max(x, x + dx) > wheel.left - 12
                    && Math.min(y, y + dy) < wheel.bottom + 12 && Math.max(y, y + dy) > wheel.top - 12) continue;
                const hit = document.elementFromPoint(x, y);
                if (hit?.getAttribute('data-testid') === 'qidahen-map-hitmap-canvas') return { x, y };
            }
            throw new Error('没有避开轮盘和地图对象的拖拽起点');
        }, { dx, dy });
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + dx, start.y + dy, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(400);
    }
    const blocked = await point();
    expect(blocked.reachesCanvas, `原图坐标 (${x},${y}) 无法在正式地图上操作: ${JSON.stringify(blocked)}`).toBe(true);
    return blocked;
}

test.describe('七大恨叶赫河岸真实地图交互', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(180_000);
        await openBoard(page);
    });

    test('真实鼠标悬浮显示两岸对应地区，远端河道不显示叶赫', async ({ page }, testInfo) => {
        test.setTimeout(180_000);
        const tip = page.getByTestId('qidahen-map-region-tip');
        for (const sample of samples) {
            const point = await pointOnMap(page, sample.x, sample.y);
            await page.mouse.move(point.x, point.y);
            await expect(tip, `悬浮 (${sample.x},${sample.y}) 应显示 ${sample.name}`).toBeVisible();
            await expect(tip).toContainText(sample.name);
            if (sample.id === 'city-region-7' && sample.x === 900 && sample.y === 120) {
                await page.screenshot({ path: testInfo.outputPath('yehe-hover.png') });
            }
        }
        for (const point of [{ x: 705, y: 150 }, { x: 770, y: 200 }]) {
            const cursor = await pointOnMap(page, point.x, point.y);
            await page.mouse.move(cursor.x, cursor.y);
            await expect(tip, `远端河道 (${point.x},${point.y}) 没有土地归属`).toHaveCount(0);
        }
    });

    test('行动窗口真实鼠标点击两岸，玩家看到对应地区', async ({ page }, testInfo) => {
        test.setTimeout(180_000);
        const state = await page.evaluate(() => {
            const harness = (window as Window & { __BG_TEST_HARNESS__?: { state?: { get?: () => { core: { turnPhase: string; currentPlayer: string } } } } }).__BG_TEST_HARNESS__;
            const core = harness?.state?.get?.()?.core;
            return core ? { turnPhase: core.turnPhase, currentPlayer: core.currentPlayer } : null;
        });
        expect(state, '必须读取正式对局状态以确认点击合法').not.toBeNull();
        expect(state?.turnPhase, '只在正式行动窗口测试地区选择').toBe('action-window');
        expect(state?.currentPlayer, '只由当前行动玩家选择地区').toBe('1');
        await expect(page.getByTestId('qidahen-turn-choice')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-action-payment-panel')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-hand-limit-discard-selection')).toHaveCount(0);
        const tip = page.getByTestId('qidahen-map-region-tip');
        for (const sample of samples) {
            const point = await pointOnMap(page, sample.x, sample.y);
            await page.mouse.move(point.x, point.y);
            await expect(tip, `点击前应看到 ${sample.name}`).toContainText(sample.name);
            console.info('YEHE_CLICK_SAMPLE', JSON.stringify({ ...sample, point, before: await page.getByTestId('qidahen-map-layer').getAttribute('data-map-selected') }));
            await page.mouse.click(point.x, point.y);
            await expect(page.getByTestId('qidahen-map-layer'), `点击 (${sample.x},${sample.y})`).toHaveAttribute('data-map-selected', sample.id);
            await expect(tip, `点击 (${sample.x},${sample.y}) 后玩家应看到 ${sample.name}`).toBeVisible();
            await expect(tip).toContainText(sample.name);
            if (sample.id === 'city-region-7' && sample.x === 900 && sample.y === 120) {
                await page.screenshot({ path: testInfo.outputPath('yehe-selected.png') });
            }
        }
    });
});
