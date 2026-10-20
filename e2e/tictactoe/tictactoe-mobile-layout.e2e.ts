import { expect, test } from '../framework';
import sharp from 'sharp';
import { GameTestContext } from '../framework/GameTestContext';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    DESKTOP_REFERENCE_VIEWPORT,
    MOBILE_LANDSCAPE_E2E_VIEWPORT,
    MOBILE_PORTRAIT_DESIGN_VIEWPORT,
    MOBILE_PORTRAIT_E2E_DEVICE_SCALE_FACTOR,
    MOBILE_PORTRAIT_E2E_OUTPUT_RESOLUTION,
    MOBILE_PORTRAIT_E2E_VIEWPORT,
} from '../../src/shared/referenceViewports';
import { disableTutorial, setChineseLocale } from '../helpers/common';

type Rect = { x: number; y: number; width: number; height: number };

async function readLayoutMetrics(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const toRect = (element: Element | null): Rect | null => {
            if (!element) return null;
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
        };
        const readRect = (selector: string) => toRect(document.querySelector(selector));
        const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-id^="cell-"]'));
        const cellRects = cells.map((cell) => cell.getBoundingClientRect());
        const boardRect = cellRects.length
            ? {
                x: Math.min(...cellRects.map((rect) => rect.left)),
                y: Math.min(...cellRects.map((rect) => rect.top)),
                width: Math.max(...cellRects.map((rect) => rect.right)) - Math.min(...cellRects.map((rect) => rect.left)),
                height: Math.max(...cellRects.map((rect) => rect.bottom)) - Math.min(...cellRects.map((rect) => rect.top)),
            }
            : null;
        const pageRoot = document.querySelector<HTMLElement>('[data-game-page][data-game-id="tictactoe"]');
        const htmlStyle = getComputedStyle(document.documentElement);
        const fabButton = document.querySelector<HTMLElement>('[data-testid="fab-menu"] button[data-fab-id]');
        const fabVisual = fabButton?.querySelector<HTMLElement>('[data-fab-visual-id]') ?? null;
        const fabHitRect = fabButton?.getBoundingClientRect();
        const fabVisualRect = fabVisual?.getBoundingClientRect();
        const hudRects = [
            ['left', document.querySelector<HTMLElement>('[data-testid="tictactoe-score-left"]')?.getBoundingClientRect()],
            ['center', document.querySelector<HTMLElement>('[data-testid="tictactoe-turn-status"]')?.getBoundingClientRect()],
            ['right', document.querySelector<HTMLElement>('[data-testid="tictactoe-score-right"]')?.getBoundingClientRect()],
        ] as const;
        const overlaps = (left: DOMRect, right: DOMRect) => (
            left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top
        );
        const fabHudOverlaps = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid="fab-menu"] button[data-fab-id]'),
        ).flatMap((button) => {
            const rect = button.getBoundingClientRect();
            return hudRects.flatMap(([region, hudRect]) => (
                hudRect && overlaps(rect, hudRect) ? [{ action: button.dataset.fabId, region }] : []
            ));
        });
        const exitPanelRect = document.querySelector<HTMLElement>('[data-testid="fab-panel-exit"]')?.getBoundingClientRect();
        const exitPanelOverlapsHud = hudRects.flatMap(([region, hudRect]) => (
            exitPanelRect && hudRect && overlaps(exitPanelRect, hudRect) ? [region] : []
        ));

        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            devicePixelRatio: window.devicePixelRatio,
            overflow: {
                document: document.documentElement.scrollWidth - window.innerWidth,
                body: document.body.scrollWidth - window.innerWidth,
                root: (document.querySelector<HTMLElement>('#root')?.scrollWidth ?? 0) - window.innerWidth,
            },
            profile: pageRoot?.dataset.mobileProfile ?? null,
            orientation: pageRoot?.dataset.preferredOrientation ?? null,
            preset: pageRoot?.dataset.mobileLayoutPreset ?? null,
            fit: pageRoot?.dataset.mobileBoardShellFit ?? null,
            referenceWidth: pageRoot?.dataset.mobileBoardShellReferenceWidth ?? null,
            referenceHeight: pageRoot?.dataset.mobileBoardShellReferenceHeight ?? null,
            scale: Number.parseFloat(htmlStyle.getPropertyValue('--mobile-board-shell-scale')) || null,
            offsetX: Number.parseFloat(htmlStyle.getPropertyValue('--mobile-board-shell-offset-x')) || 0,
            offsetY: Number.parseFloat(htmlStyle.getPropertyValue('--mobile-board-shell-offset-y')) || 0,
            shell: readRect('.mobile-board-shell'),
            regions: {
                root: readRect('[data-testid="tictactoe-board-root"]'),
                title: readRect('[data-testid="tictactoe-board-root"] h1'),
                board: boardRect,
                topLeftCell: toRect(cells[0] ?? null),
                centerCell: toRect(cells[4] ?? null),
                bottomRightCell: toRect(cells[8] ?? null),
                leftHud: readRect('[data-testid="tictactoe-score-left"]'),
                centerHud: readRect('[data-testid="tictactoe-turn-status"]'),
                rightHud: readRect('[data-testid="tictactoe-score-right"]'),
            },
            text: {
                title: document.querySelector<HTMLElement>('[data-testid="tictactoe-board-root"] h1')
                    ? getComputedStyle(document.querySelector<HTMLElement>('[data-testid="tictactoe-board-root"] h1')!).fontSize
                    : null,
                playerLabel: document.querySelector<HTMLElement>('[data-testid="tictactoe-score-left"] > div')
                    ? getComputedStyle(document.querySelector<HTMLElement>('[data-testid="tictactoe-score-left"] > div')!).fontSize
                    : null,
                currentPlayer: document.querySelector<HTMLElement>('[data-testid="tictactoe-turn-status"] span')
                    ? getComputedStyle(document.querySelector<HTMLElement>('[data-testid="tictactoe-turn-status"] span')!).fontSize
                    : null,
            },
            fab: fabHitRect && fabVisualRect
                ? {
                    x: fabHitRect.x,
                    y: fabHitRect.y,
                    hitWidth: fabHitRect.width,
                    hitHeight: fabHitRect.height,
                    visualWidth: fabVisualRect.width,
                    visualHeight: fabVisualRect.height,
                }
                : null,
            fabBoardOverlaps: Boolean(fabHitRect && boardRect
                && fabHitRect.left < boardRect.x + boardRect.width
                && fabHitRect.right > boardRect.x
                && fabHitRect.top < boardRect.y + boardRect.height
                && fabHitRect.bottom > boardRect.y),
            fabHudOverlaps,
            exitPanelOverlapsHud,
        };
    });
}

function expectSameShellTransform(
    desktop: Rect | null,
    mobile: Rect | null,
    scale: number,
    offsetX: number,
    offsetY: number,
    label: string,
) {
    expect(desktop, `${label} 应在 PC 参考画布中存在`).not.toBeNull();
    expect(mobile, `${label} 应在手机竖屏中存在`).not.toBeNull();
    if (!desktop || !mobile) throw new Error(`${label} geometry missing`);

    expect(Math.abs(mobile.x - (desktop.x * scale + offsetX)), `${label} x 应按 shell 同一变换映射`).toBeLessThanOrEqual(2);
    expect(Math.abs(mobile.y - (desktop.y * scale + offsetY)), `${label} y 应按 shell 同一变换映射`).toBeLessThanOrEqual(2);
    expect(Math.abs(mobile.width - desktop.width * scale), `${label} width 应按 shell 同一变换映射`).toBeLessThanOrEqual(2);
    expect(Math.abs(mobile.height - desktop.height * scale), `${label} height 应按 shell 同一变换映射`).toBeLessThanOrEqual(2);
}

test.describe('井字棋竖屏 board-shell 适配', () => {
    test('竖屏参考构图等比适配手机，保留触控落子与悬浮菜单操作', async ({ page, game, browser, workerPorts }, testInfo) => {
        test.setTimeout(90000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await setChineseLocale(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
        });
        await page.setViewportSize(MOBILE_PORTRAIT_E2E_VIEWPORT);
        await game.openTestGame('tictactoe');
        await expect(page.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });
        await expect(page.getByTestId('fab-menu')).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => page.locator('[data-testid="tictactoe-board-root"] .grid-line').evaluateAll(
            (lines) => lines.every((line) => Math.abs(Number.parseFloat(getComputedStyle(line).strokeDashoffset)) < 0.01),
        ), { timeout: 3000 }).toBe(true);

        const portraitReference = await readLayoutMetrics(page);
        expect(portraitReference.viewport).toEqual(MOBILE_PORTRAIT_DESIGN_VIEWPORT);
        expect(portraitReference.regions.root).toEqual({ x: 0, y: 0, ...MOBILE_PORTRAIT_DESIGN_VIEWPORT });
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '井字棋-竖屏CSS参考画布-360x796-初始棋局'),
            fullPage: false,
        });

        await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
        await page.waitForTimeout(200);
        const desktop = await readLayoutMetrics(page);
        expect(desktop.viewport).toEqual(DESKTOP_REFERENCE_VIEWPORT);
        expect(desktop.regions.root).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '井字棋-PC-1920x1080-初始棋局'),
            fullPage: false,
        });

        await page.setViewportSize(MOBILE_PORTRAIT_E2E_VIEWPORT);
        await page.waitForTimeout(300);
        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        const mobile = await readLayoutMetrics(page);
        console.log(`TicTacToe portrait board-shell geometry: ${JSON.stringify({ desktop, portraitReference, mobile })}`);

        expect(mobile.profile).toBe('portrait-adapted');
        expect(mobile.orientation).toBe('portrait');
        expect(mobile.preset).toBe('board-shell');
        expect(mobile.fit).toBe('contain');
        expect(mobile.referenceWidth).toBe(String(MOBILE_PORTRAIT_DESIGN_VIEWPORT.width));
        expect(mobile.referenceHeight).toBe(String(MOBILE_PORTRAIT_DESIGN_VIEWPORT.height));
        expect(mobile.scale).toBeCloseTo(1, 5);
        expect(mobile.viewport).toEqual(MOBILE_PORTRAIT_E2E_VIEWPORT);
        expect(mobile.overflow.document).toBeLessThanOrEqual(1);
        expect(mobile.overflow.body).toBeLessThanOrEqual(1);
        expect(mobile.overflow.root).toBeLessThanOrEqual(1);
        expect(mobile.shell?.x).toBeGreaterThanOrEqual(-1);
        expect(mobile.shell?.y).toBeGreaterThanOrEqual(-1);
        const shell = mobile.shell;
        expect(shell).not.toBeNull();
        if (!shell) throw new Error('手机 board-shell 几何数据缺失。');
        expect(shell.x + shell.width).toBeLessThanOrEqual(MOBILE_PORTRAIT_E2E_VIEWPORT.width + 1);
        expect(shell.y + shell.height).toBeLessThanOrEqual(MOBILE_PORTRAIT_E2E_VIEWPORT.height);
        // CSS scale 四舍五入会产生约 0.002px 的 getBoundingClientRect 浮点误差。
        expect(mobile.fab?.hitWidth).toBeGreaterThanOrEqual(43.9);
        expect(mobile.fab?.hitHeight).toBeGreaterThanOrEqual(43.9);
        expect(mobile.fab?.visualWidth).toBeGreaterThanOrEqual(40);
        expect(mobile.fab?.visualHeight).toBeGreaterThanOrEqual(40);
        expect(mobile.fabHudOverlaps, '手机初始悬浮球不能遮住任一比分或回合栏').toEqual([]);
        expect(mobile.fabBoardOverlaps, '手机初始悬浮球不能遮住棋盘格').toBe(false);

        expect(mobile.text.title).toBe('60px');
        expect(mobile.text.playerLabel).toBe('14px');
        expect(mobile.text.currentPlayer).toBe('30px');
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '井字棋-手机竖屏360x796-初始棋局'),
            fullPage: false,
        });
        await page.locator('[data-tutorial-id="cell-4"]').click();
        await expect(page.locator('[data-tutorial-id="cell-4"] svg')).toBeVisible({ timeout: 10000 });
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '井字棋-手机竖屏360x796-真实落子后'),
            fullPage: false,
        });

        const fabMenu = page.getByTestId('fab-menu');
        await fabMenu.locator('button[data-fab-id]').first().click();
        await expect.poll(() => fabMenu.locator('button[data-fab-id]').count()).toBeGreaterThan(1);
        await expect(page.getByTestId('fab-panel-exit')).toBeVisible();
        const expandedMetrics = await readLayoutMetrics(page);
        expect(expandedMetrics.fabHudOverlaps, '展开的悬浮按钮不能遮住任一比分或回合栏').toEqual([]);
        expect(expandedMetrics.exitPanelOverlapsHud, '离开菜单不能遮住任一比分或回合栏').toEqual([]);
        const expandedFabBounds = await fabMenu.evaluate((container) => {
            const shell = document.querySelector<HTMLElement>('.mobile-board-shell');
            if (!shell) throw new Error('mobile board shell missing');
            const shellRect = shell.getBoundingClientRect();
            const buttons = Array.from(container.querySelectorAll<HTMLElement>('button[data-fab-id]'));
            return {
                shell: { left: shellRect.left, top: shellRect.top, right: shellRect.right, bottom: shellRect.bottom },
                buttons: buttons.map((button) => {
                    const rect = button.getBoundingClientRect();
                    return {
                        id: button.dataset.fabId,
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        visible: rect.width > 0 && rect.height > 0 && getComputedStyle(button).opacity !== '0',
                    };
                }),
            };
        });
        expect(expandedFabBounds.buttons.length).toBeGreaterThan(1);
        for (const button of expandedFabBounds.buttons) {
            expect(button.visible, `${button.id} 应在展开菜单中可见`).toBe(true);
            expect(button.left, `${button.id} 应处于竖屏画布左界内`).toBeGreaterThanOrEqual(expandedFabBounds.shell.left - 1);
            expect(button.right, `${button.id} 应处于竖屏画布右界内`).toBeLessThanOrEqual(expandedFabBounds.shell.right + 1);
            expect(button.top, `${button.id} 应处于竖屏画布上界内`).toBeGreaterThanOrEqual(expandedFabBounds.shell.top - 1);
            expect(button.bottom, `${button.id} 应处于竖屏画布下界内`).toBeLessThanOrEqual(expandedFabBounds.shell.bottom + 1);
        }
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '井字棋-手机竖屏360x796-FAB展开菜单'),
            fullPage: false,
        });

        const physicalContext = await browser.newContext({
            baseURL: `http://127.0.0.1:${workerPorts.frontend}`,
            viewport: MOBILE_PORTRAIT_E2E_VIEWPORT,
            screen: MOBILE_PORTRAIT_E2E_VIEWPORT,
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: MOBILE_PORTRAIT_E2E_DEVICE_SCALE_FACTOR,
        });
        try {
            await physicalContext.addInitScript((ports) => {
                (window as Window & {
                    __E2E_TEST_MODE__?: boolean;
                    __E2E_WORKER_PORTS__?: typeof ports;
                    __FORCE_GAME_SERVER_URL__?: string;
                    __FORCE_API_SERVER_URL__?: string;
                    __E2E_SKIP_IMAGE_GATE__?: boolean;
                    __BG_HIDE_DEBUG_PANEL__?: boolean;
                }).__E2E_TEST_MODE__ = true;
                (window as Window & { __E2E_WORKER_PORTS__?: typeof ports }).__E2E_WORKER_PORTS__ = ports;
                (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__ = `http://127.0.0.1:${ports.gameServer}`;
                (window as Window & { __FORCE_API_SERVER_URL__?: string }).__FORCE_API_SERVER_URL__ = `http://127.0.0.1:${ports.apiServer}`;
                (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
                (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
            }, workerPorts);
            await setChineseLocale(physicalContext);
            await disableTutorial(physicalContext);
            const physicalPage = await physicalContext.newPage();
            const physicalGame = new GameTestContext(physicalPage);
            await physicalGame.openTestGame('tictactoe');
            await expect(physicalPage.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });
            await expect(physicalPage.getByTestId('fab-menu')).toBeVisible({ timeout: 10000 });
            const physicalMetrics = await physicalPage.evaluate(() => ({
                devicePixelRatio: window.devicePixelRatio,
                shellScale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-board-shell-scale')),
            }));
            expect(physicalMetrics.devicePixelRatio).toBeCloseTo(MOBILE_PORTRAIT_E2E_DEVICE_SCALE_FACTOR, 4);
            expect(physicalMetrics.shellScale).toBeCloseTo(1, 3);
            const physicalLayout = await readLayoutMetrics(physicalPage);
            expect(physicalLayout.viewport).toEqual(MOBILE_PORTRAIT_E2E_VIEWPORT);
            expect(physicalLayout.text).toEqual(mobile.text);
            expect(physicalLayout.fab?.x).toBeCloseTo(mobile.fab?.x ?? Number.NaN, 2);
            expect(physicalLayout.fab?.y).toBeCloseTo(mobile.fab?.y ?? Number.NaN, 2);
            expect(physicalLayout.fabBoardOverlaps, '1080×2388 闭合悬浮球不能压住棋盘格').toBe(false);
            expect(physicalMetrics.devicePixelRatio * MOBILE_PORTRAIT_E2E_VIEWPORT.width)
                .toBe(MOBILE_PORTRAIT_E2E_OUTPUT_RESOLUTION.width);
            expect(physicalMetrics.devicePixelRatio * MOBILE_PORTRAIT_E2E_VIEWPORT.height)
                .toBe(MOBILE_PORTRAIT_E2E_OUTPUT_RESOLUTION.height);
            for (const [key, label] of [
                ['root', '井字棋主画布'], ['title', '标题'], ['board', '完整棋盘'],
                ['topLeftCell', '左上格'], ['centerCell', '中心格'], ['bottomRightCell', '右下格'],
                ['leftHud', '左侧比分'], ['centerHud', '中间回合状态'], ['rightHud', '右侧比分'],
            ] as const) {
                expectSameShellTransform(
                    mobile.regions[key], physicalLayout.regions[key], 1, 0, 0, `${label}在DPR 3下保持CSS尺寸`,
                );
            }
            await physicalPage.waitForTimeout(500);
            const physicalScreenshot = await physicalPage.screenshot({
                path: getEvidenceScreenshotPath(testInfo, '井字棋-手机分辨率触控模拟1080x2388-初始棋局'),
                fullPage: false,
                scale: 'device',
            });
            const physicalScreenshotMetadata = await sharp(physicalScreenshot).metadata();
            expect({
                width: physicalScreenshotMetadata.width,
                height: physicalScreenshotMetadata.height,
            }).toEqual(MOBILE_PORTRAIT_E2E_OUTPUT_RESOLUTION);

            const centerCell = physicalPage.locator('[data-tutorial-id="cell-4"]');
            const centerCellBox = await centerCell.boundingBox();
            if (!centerCellBox) throw new Error('触控模拟的棋盘中心格不可见');
            await physicalPage.touchscreen.tap(
                centerCellBox.x + centerCellBox.width / 2,
                centerCellBox.y + centerCellBox.height / 2,
            );
            await expect(centerCell.locator('svg')).toBeVisible({ timeout: 10000 });
            await physicalPage.screenshot({
                path: getEvidenceScreenshotPath(testInfo, '井字棋-手机分辨率触控模拟1080x2388-真实落子后'),
                fullPage: false,
                scale: 'device',
            });

            const physicalFab = physicalPage.getByTestId('fab-menu');
            const dockedFabButton = physicalFab.locator('button[data-fab-id]').first();
            const fabBox = await dockedFabButton.boundingBox();
            if (!fabBox) throw new Error('高分辨率触控模拟中的悬浮球不可见');
            await physicalPage.touchscreen.tap(fabBox.x + fabBox.width / 2, fabBox.y + fabBox.height / 2);
            await expect.poll(() => physicalFab.locator('button[data-fab-id]').count()).toBeGreaterThan(1);
            const expandedPhysicalLayout = await readLayoutMetrics(physicalPage);
            expect(expandedPhysicalLayout.fabHudOverlaps, '1080×2388 菜单按钮不能遮住 HUD').toEqual([]);
            expect(expandedPhysicalLayout.exitPanelOverlapsHud, '1080×2388 离开面板不能遮住 HUD').toEqual([]);
            await physicalPage.screenshot({
                path: getEvidenceScreenshotPath(testInfo, '井字棋-手机分辨率触控模拟1080x2388-FAB展开菜单'),
                fullPage: false,
                scale: 'device',
            });
        } finally {
            await physicalContext.close();
        }
    });

    test('横屏只显示方向提示，切回竖屏保留当前棋局', async ({ page, game }) => {
        await setChineseLocale(page);
        await disableTutorial(page);
        await page.setViewportSize(MOBILE_PORTRAIT_E2E_VIEWPORT);
        await game.openTestGame('tictactoe');
        await expect(page.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });

        await page.locator('[data-tutorial-id="cell-4"]').click();
        await expect(page.locator('[data-tutorial-id="cell-4"] svg')).toBeVisible({ timeout: 10000 });
        await page.setViewportSize(MOBILE_LANDSCAPE_E2E_VIEWPORT);
        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(page.getByTestId('mobile-orientation-game-banner')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('建议切换为竖屏以获得更佳体验')).toBeVisible();
        const closeOrientationHint = page.getByRole('button', { name: '关闭提示' });
        await expect(closeOrientationHint).toBeVisible();
        await closeOrientationHint.click();
        await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0);
        await page.locator('[data-tutorial-id="cell-0"]').click();
        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 10000 });

        await page.setViewportSize(MOBILE_PORTRAIT_E2E_VIEWPORT);
        await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0, { timeout: 5000 });
        await expect(page.locator('[data-tutorial-id="cell-4"] svg')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible();
        await page.locator('[data-tutorial-id="cell-8"]').click();
        await expect(page.locator('[data-tutorial-id="cell-8"] svg')).toBeVisible({ timeout: 10000 });
    });
});
