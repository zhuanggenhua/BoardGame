import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    disableTutorial,
    setChineseLocale,
} from './helpers/common';

const BOARD_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-board-desktop-current.png';
const MOBILE_LANDSCAPE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-board-mobile-landscape-current.png';
const ACTION_FLOW_SCREENSHOT = 'temp/qidahen-board-action-flow-current.png';
const MAP_REGION_POINTS = {
    jinzhou: { x: 0.615, y: 0.458 },
} as const;

const saveScreenshot = async (page: import('@playwright/test').Page, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
};

const waitForAtlasFrames = async (page: import('@playwright/test').Page, selector: string) => {
    await page.waitForFunction((frameSelector) => {
        const frames = Array.from(document.querySelectorAll<HTMLElement>(frameSelector));
        return frames.length > 0 && frames.every((frame) => {
            const style = window.getComputedStyle(frame);
            const image = frame.querySelector('img');
            if (image) {
                return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
            }
            return style.backgroundImage !== 'none'
                && !frame.className.includes('atlas-shimmer');
        });
    }, selector, { timeout: 15000 });
};

const waitForImage = async (page: import('@playwright/test').Page, selector: string) => {
    await page.waitForFunction((imageSelector) => {
        const image = document.querySelector<HTMLImageElement>(imageSelector);
        return image != null && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }, selector, { timeout: 15000 });
};

const clickMapRegion = async (page: import('@playwright/test').Page, regionId: keyof typeof MAP_REGION_POINTS) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvasBox = await page.locator('[data-testid="qidahen-map-hitmap-canvas"]').boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.click(
        (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * point.x,
        (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * point.y,
    );
};

test.describe('七大恨 Board 地图交互与 HUD 布局', () => {
    test('桌面端显示真实地图并保持轮盘/手牌/牌堆布局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-hitmap-canvas"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-clean-patch"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-region-jinzhou"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-sector"]')).toHaveCount(8);
        await expect(page.locator('[data-testid="qidahen-chronology-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-year-card-slot-"]')).toHaveCount(2);
        await expect(page.locator('[data-testid="qidahen-chronology-deck"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-actions-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-hand-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]')).toHaveCount(6);
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toBeVisible();
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await waitForImage(page, '[data-testid="qidahen-map-clean-patch"]');

        await expect(page.locator('[data-testid="fab-menu"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        for (const wheelLabel of ['开垦', '军屯', '征兵', '训练', '外交', '雇佣', '进攻', '调度', '新年', '年中']) {
            await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toContainText(wheelLabel);
        }

        const drawBox = await page.locator('[data-testid="qidahen-draw-pile"]').boundingBox();
        const handBox = await page.locator('[data-testid="qidahen-hand-zone"]').boundingBox();
        const discardBox = await page.locator('[data-testid="qidahen-discard-pile"]').boundingBox();
        const stageBox = await page.locator('[data-testid="qidahen-desktop-stage"]').boundingBox();
        const mapLayerBox = await page.locator('[data-testid="qidahen-map-layer"]').boundingBox();
        const wheelTip = page.locator('[data-testid="qidahen-wheel-tip"]');
        const actionBox = await page.locator('[data-testid="qidahen-action-raid"]').boundingBox();
        expect(drawBox).not.toBeNull();
        expect(handBox).not.toBeNull();
        expect(discardBox).not.toBeNull();
        expect(stageBox).not.toBeNull();
        expect(mapLayerBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-layout', 'full-bleed-cover');
        expect(Math.abs((mapLayerBox?.width ?? 0) - (stageBox?.width ?? 0))).toBeLessThan(4);
        expect(Math.abs((mapLayerBox?.height ?? 0) - (stageBox?.height ?? 0))).toBeLessThan(4);
        expect(actionBox?.width ?? 9999).toBeLessThan(180);
        expect(drawBox?.x ?? 9999).toBeLessThan(220);
        expect(drawBox?.y ?? 0).toBeGreaterThan(840);
        expect(discardBox?.x ?? 0).toBeGreaterThan(1680);
        expect(discardBox?.y ?? 0).toBeGreaterThan(840);
        expect(handBox?.width ?? 0).toBeGreaterThan(900);
        expect(Math.abs(((handBox?.x ?? 0) + (handBox?.width ?? 0) / 2) - 960)).toBeLessThan(90);
        await expect(page.locator('[data-testid="qidahen-wheel-step-controls"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-payment-panel"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-execute-action"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-payment-state"]')).toHaveCount(0);
        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');
        await expect(wheelTip).toBeHidden();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').hover();
        await expect(wheelTip).toBeVisible();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').hover();
        await expect(wheelTip).toContainText('所有对手抽 2，走 3');

        await saveScreenshot(page, BOARD_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-hud-desktop', diagnostics }]);
    });

    test('可执行操作与支付仍走真实 Board 交互', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await waitForImage(page, '[data-testid="qidahen-map-clean-patch"]');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').hover();
        await expect(page.locator('[data-testid="qidahen-wheel-tip"]')).toContainText('一名对手抽 2，走 2');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').hover();
        await expect(page.locator('[data-testid="qidahen-wheel-tip"]')).toContainText('所有对手抽 2，走 3');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('6/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('8/10');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('8/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');

        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');
        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-testid="qidahen-payment-state"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-execute-action"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('10');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('2/15');
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]')).toHaveCount(3);
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 大明');

        await saveScreenshot(page, ACTION_FLOW_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-action-flow', diagnostics }]);
    });

    test('手机横屏下地图与 HUD 布局不缩在左上角', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 936, height: 432 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-clean-patch"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-actions-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-bottom-dock"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await waitForImage(page, '[data-testid="qidahen-map-clean-patch"]');

        const stageBox = await page.locator('[data-testid="qidahen-desktop-stage"]').boundingBox();
        const drawBox = await page.locator('[data-testid="qidahen-draw-pile"]').boundingBox();
        const handBox = await page.locator('[data-testid="qidahen-hand-zone"]').boundingBox();
        const discardBox = await page.locator('[data-testid="qidahen-discard-pile"]').boundingBox();
        expect(stageBox).not.toBeNull();
        expect(stageBox?.x ?? 0).toBeGreaterThanOrEqual(0);
        expect(stageBox?.y ?? 0).toBeGreaterThanOrEqual(0);
        expect(stageBox?.width ?? 0).toBeGreaterThan(760);
        expect(stageBox?.height ?? 0).toBeGreaterThan(390);
        expect(drawBox?.x ?? 9999).toBeLessThan(160);
        expect(drawBox?.y ?? 0).toBeGreaterThan(330);
        expect(handBox).not.toBeNull();
        expect(Math.abs(((handBox?.x ?? 0) + (handBox?.width ?? 0) / 2) - 468)).toBeLessThan(80);
        expect(discardBox).not.toBeNull();
        expect(((discardBox?.x ?? 9999) + (discardBox?.width ?? 0))).toBeLessThanOrEqual(936);
        expect(discardBox?.x ?? 0).toBeGreaterThan(680);
        expect(discardBox?.y ?? 0).toBeGreaterThan(330);

        await saveScreenshot(page, MOBILE_LANDSCAPE_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-hud-mobile-landscape', diagnostics }]);
    });

    test('区域涂色工具可加载并显示导出入口', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨区域涂色')).toBeVisible({ timeout: 30000 });
        await expect(page.getByRole('button', { name: '导出 Mask PNG' })).toBeVisible();
        await expect(page.getByRole('button', { name: '导出区域 JSON' })).toBeVisible();
        await expect(page.locator('canvas')).toHaveCount(2);
        await expect(page.locator('input[value="锦州"]').first()).toBeVisible();
    });
});
