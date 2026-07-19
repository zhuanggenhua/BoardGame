import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import {
    attachPageDiagnostics,
    blockAudioRequests,
    blockCdnRequests,
    blockLobbySocket,
    disableAudio,
    setChineseLocale,
} from '../helpers/common';

const evidenceRoot = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'qidahen',
    'mobile-layout.e2e',
);

const screenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, fileName);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
};

const readMapViewportState = async (page: Page) => page.evaluate(() => {
    const mapLayer = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-map-layer"]');
    const zoom = Number(mapLayer?.dataset.mapZoom ?? '0');
    const panX = Number(mapLayer?.dataset.mapPanX ?? '0');
    const panY = Number(mapLayer?.dataset.mapPanY ?? '0');
    return { zoom, panX, panY };
});

const mountQidahenBoardHarness = async (page: Page) => {
    await page.evaluate(async () => {
        window.__qidahenHarnessStatus = 'starting';
        window.__qidahenHarnessError = null;
        const existing = document.getElementById('qidahen-harness-root');
        existing?.remove();

        try {
            const host = document.createElement('div');
            host.id = 'qidahen-harness-root';
            host.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:2147483647',
                'width:100vw',
                'height:100vh',
                'overflow:hidden',
                'background:#0b0906',
            ].join(';');
            document.body.appendChild(host);

            const backgroundModalRoot = document.getElementById('modal-root');
            if (backgroundModalRoot) {
                backgroundModalRoot.id = 'qidahen-background-modal-root';
            }
            const boardMount = document.createElement('div');
            boardMount.id = 'qidahen-harness-board-root';
            boardMount.style.cssText = 'position:absolute;inset:0;';
            const modalRoot = document.createElement('div');
            modalRoot.id = 'modal-root';
            host.append(boardMount, modalRoot);

            const viteDepsRoot = `/node_modules/.vite/port-${window.location.port}/deps`;
            const ReactModule = await import(`${viteDepsRoot}/react.js`);
            const React = ReactModule.default;
            const ReactDomModule = await import(`${viteDepsRoot}/react-dom_client.js`);
            const ReactDOM = ReactDomModule.default;
            const BoardModule = await import('/src/games/qidahen/Board.tsx');
            const AudioModule = await import('/src/contexts/AudioContext.tsx');
            const ToastModule = await import('/src/contexts/ToastContext.tsx');
            const TutorialModule = await import('/src/contexts/TutorialContext.tsx');
            const GameModeModule = await import('/src/contexts/GameModeContext.tsx');
            const DomainModule = await import('/src/games/qidahen/domain/index.ts');
            const PipelineModule = await import('/src/engine/pipeline.ts');
            const GameModule = await import('/src/games/qidahen/game.ts');
            const playerIds = ['0', '1', '2'];
            const initialCore = DomainModule.QidahenDomain.setup(playerIds, () => 0.42);
            const initialSys = PipelineModule.createInitialSystemState(
                playerIds,
                GameModule.engineConfig.systems,
                'qidahen-mobile-layout-harness',
            );

            const Harness = () => {
                const [core, setCore] = React.useState(initialCore);
                const dispatch = React.useCallback((type: string, payload: { regionId?: string }) => {
                    if (type === 'SELECT_REGION' && payload.regionId) {
                        setCore((current: typeof initialCore) => ({
                            ...current,
                            selectedRegionId: payload.regionId,
                        }));
                    }
                }, [setCore]);

                return React.createElement(BoardModule.default, {
                    G: { core, sys: initialSys },
                    dispatch,
                    playerID: '0',
                });
            };

            ReactDOM.createRoot(boardMount).render(
                React.createElement(
                    ToastModule.ToastProvider,
                    null,
                    React.createElement(
                        GameModeModule.GameModeProvider,
                        { mode: 'test' },
                        React.createElement(
                            AudioModule.AudioProvider,
                            null,
                            React.createElement(
                                TutorialModule.TutorialProvider,
                                null,
                                React.createElement(Harness),
                            ),
                        ),
                    ),
                ),
            );
            window.__qidahenHarnessStatus = 'render-requested';
        } catch (error) {
            window.__qidahenHarnessStatus = 'failed';
            window.__qidahenHarnessError = error instanceof Error
                ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
                : String(error);
            throw error;
        }
    });
};

test.describe('七大恨移动端布局兼容', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ page, context }) => {
        const diagnostics = attachPageDiagnostics(page);
        await setChineseLocale(context);
        await blockAudioRequests(context);
        await blockLobbySocket(context);
        await blockCdnRequests(context);
        await disableAudio(context);
        await context.route('**/auth/refresh', (route) => route.abort());
        await page.goto('/?qidahenHarness=1', {
            waitUntil: 'commit',
            timeout: 15000,
        }).catch(() => undefined);
        await mountQidahenBoardHarness(page);
        await expect.poll(async () => {
            const state = await page.evaluate(() => ({
                status: window.__qidahenHarnessStatus ?? 'missing',
                error: window.__qidahenHarnessError ?? null,
                hasHost: document.getElementById('qidahen-harness-root') != null,
                hasBoard: document.querySelector('[data-testid="qidahen-board"]') != null,
            }));
            return JSON.stringify({
                ...state,
                diagnostics: diagnostics.errors.slice(-5),
            });
        }, {
            message: 'Qidahen 移动端测试 harness 应成功挂载 Board',
            timeout: 5000,
        }).toContain('"hasBoard":true');
    });

    test('手机横屏下主地图、手牌和底部操作区应保持可见且不出现顶层横向溢出', async ({ page }) => {
        const testName = '手机横屏下主地图、手牌和底部操作区应保持可见且不出现顶层横向溢出';

        await page.setViewportSize({ width: 896, height: 414 });
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-board"]')).toBeVisible();
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-actions-zone"]')).toBeVisible();

        const metrics = await page.evaluate(() => {
            const board = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-board"]');
            const hudStage = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-desktop-stage"]');
            const mapLayer = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-map-layer"]');
            const mapContent = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-map-content"]');
            const actionsZone = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-actions-zone"]');
            const playerFloat = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-player-float"]');
            const actionWheel = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-action-wheel"]');
            const chronologyZone = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-chronology-zone"]');
            const koreaZone = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-korea-zone"]');
            const handZone = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-hand-zone"]');
            const drawPile = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-draw-pile"]');
            const discardPile = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-discard-pile"]');
            const mapControlButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(
                '#qidahen-harness-root [data-testid="qidahen-map-viewport-controls"] button',
            ));
            const actionButtons = Array.from(
                document.querySelectorAll<HTMLButtonElement>(
                    '#qidahen-harness-root [data-testid="qidahen-actions-zone"] button',
                ),
            );
            const handCardButtons = Array.from(
                document.querySelectorAll<HTMLButtonElement>(
                    '#qidahen-harness-root button[data-testid^="qidahen-hand-card-"]',
                ),
            ).filter((button) => (
                !button.dataset.testid?.startsWith('qidahen-hand-card-kind-')
                && !button.dataset.testid?.startsWith('qidahen-hand-card-magnify-')
            ));
            const magnifyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(
                '#qidahen-harness-root button[data-testid^="qidahen-hand-card-magnify-"]',
            ));
            const visibleHandCardRects = handCardButtons
                .map((button) => button.getBoundingClientRect())
                .filter((box) => (
                    box.width > 0
                    && box.height > 0
                    && box.right > 0
                    && box.left < window.innerWidth
                    && box.bottom > 0
                    && box.top < window.innerHeight
                ));
            const completeHandCardRects = handCardButtons
                .map((button) => button.getBoundingClientRect())
                .filter((box) => (
                    box.width > 0
                    && box.height > 0
                    && box.left >= -1
                    && box.right <= window.innerWidth + 1
                    && box.top >= -1
                    && box.bottom <= window.innerHeight + 1
                ));
            const bottomDockedHandCardRects = completeHandCardRects.filter((box) => (
                Math.abs(window.innerHeight - box.bottom) <= 2
            ));
            const getVisibleRatio = (box: DOMRect, clipBox?: DOMRect | null) => {
                const left = Math.max(box.left, 0, clipBox?.left ?? 0);
                const top = Math.max(box.top, 0, clipBox?.top ?? 0);
                const right = Math.min(box.right, window.innerWidth, clipBox?.right ?? window.innerWidth);
                const bottom = Math.min(box.bottom, window.innerHeight, clipBox?.bottom ?? window.innerHeight);
                const visibleArea = Math.max(0, right - left) * Math.max(0, bottom - top);
                const totalArea = Math.max(1, box.width * box.height);
                return visibleArea / totalArea;
            };
            const handZoneBox = handZone?.getBoundingClientRect() ?? null;
            const readableHandCardRects = handCardButtons
                .map((button) => button.getBoundingClientRect())
                .filter((box) => getVisibleRatio(box, handZoneBox) >= 0.96);
            const loadedHandCardAtlasImages = handCardButtons.filter((button) => {
                const image = button.querySelector<HTMLImageElement>('img');
                return image != null && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
            });

            const rect = (element: HTMLElement | null) => {
                if (!element) return null;
                const box = element.getBoundingClientRect();
                return {
                    left: box.left,
                    top: box.top,
                    right: box.right,
                    bottom: box.bottom,
                    width: box.width,
                    height: box.height,
                };
            };

            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                docScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                boardRect: rect(board),
                hudStageRect: rect(hudStage),
                hudTransform: hudStage ? getComputedStyle(hudStage).transform : null,
                mapLayerRect: rect(mapLayer),
                mapContentRect: rect(mapContent),
                actionsZoneRect: rect(actionsZone),
                playerFloatRect: rect(playerFloat),
                actionWheelRect: rect(actionWheel),
                chronologyZoneRect: rect(chronologyZone),
                koreaZoneRect: rect(koreaZone),
                chronologyDisplay: chronologyZone ? getComputedStyle(chronologyZone).display : null,
                koreaDisplay: koreaZone ? getComputedStyle(koreaZone).display : null,
                handZoneRect: rect(handZone),
                drawPileRect: rect(drawPile),
                discardPileRect: rect(discardPile),
                actionRects: actionButtons.map((button) => rect(button)).filter(Boolean),
                mapControlRects: mapControlButtons.map((button) => rect(button)).filter(Boolean),
                magnifyRects: magnifyButtons.map((button) => rect(button)).filter(Boolean),
                handCards: handCardButtons.length,
                visibleHandCards: visibleHandCardRects.length,
                completeHandCards: completeHandCardRects.length,
                bottomDockedHandCards: bottomDockedHandCardRects.length,
                readableHandCards: readableHandCardRects.length,
                loadedHandCardAtlasImages: loadedHandCardAtlasImages.length,
            };
        });

        expect(metrics.docScrollWidth, 'Qidahen 手机横屏时 documentElement 不应横向溢出').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.bodyScrollWidth, 'Qidahen 手机横屏时 body 不应横向溢出').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.boardRect, '应渲染 Qidahen 主板面').not.toBeNull();
        expect(metrics.hudStageRect, '应渲染 Qidahen HUD 根层').not.toBeNull();
        expect(metrics.mapLayerRect, '应渲染 Qidahen 地图交互层').not.toBeNull();
        expect(metrics.mapContentRect, '应渲染 Qidahen 地图内容').not.toBeNull();
        expect(metrics.actionsZoneRect, '应渲染 Qidahen 操作区').not.toBeNull();
        expect(metrics.playerFloatRect, '应渲染 Qidahen 玩家状态条').not.toBeNull();
        expect(metrics.actionWheelRect, '应渲染 Qidahen 轮盘').not.toBeNull();
        expect(metrics.chronologyDisplay, '手机主态纪年卡应让位给核心操作').toBe('none');
        expect(metrics.koreaDisplay, '手机主态朝鲜牌堆应让位给核心操作').toBe('none');
        expect(metrics.handZoneRect, '应渲染 Qidahen 手牌区域').not.toBeNull();
        expect(metrics.drawPileRect, '应渲染 Qidahen 己方抽牌堆').not.toBeNull();
        expect(metrics.discardPileRect, '应渲染 Qidahen 己方弃牌堆').not.toBeNull();
        expect(metrics.handCards, 'Qidahen 手机横屏时应渲染玩家手牌按钮').toBeGreaterThan(0);
        expect(metrics.visibleHandCards, 'Qidahen 手机横屏时手牌区应保留至少一张视口内可见卡牌').toBeGreaterThan(0);
        expect(metrics.completeHandCards, 'Qidahen 手机横屏时至少一张手牌主体应完整进入视口').toBeGreaterThan(0);
        expect(metrics.bottomDockedHandCards, 'Qidahen 开放式手机横屏时至少一张完整手牌应贴住视口底边，而不是额外悬空留黑边').toBeGreaterThan(0);
        expect(metrics.readableHandCards, 'Qidahen 手机横屏时不能只有中间手牌可辨，当前手牌主体应在可视容器内完整可辨').toBe(metrics.handCards);
        expect(metrics.loadedHandCardAtlasImages, 'Qidahen 手机横屏时每张手牌都应加载真实牌面图集图片').toBe(metrics.handCards);

        expect(metrics.boardRect!.left, 'Qidahen 板面左边界不应出视口').toBeGreaterThanOrEqual(-1);
        expect(metrics.boardRect!.right, 'Qidahen 板面右边界不应出视口').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.boardRect!.bottom, 'Qidahen 板面底边界不应出视口').toBeLessThanOrEqual(metrics.innerHeight + 1);
        expect(metrics.hudStageRect!.width, '手机 HUD 应直接使用真实视口宽度').toBeCloseTo(metrics.innerWidth, 0);
        expect(metrics.hudStageRect!.height, '手机 HUD 应直接使用真实视口高度').toBeCloseTo(metrics.innerHeight, 0);
        expect(metrics.hudTransform, '手机 HUD 根层不得再整体缩小').toBe('matrix(1, 0, 0, 1, 0, 0)');
        expect(metrics.mapLayerRect!.width, 'Qidahen 地图交互层在手机横屏下不应塌成窄条').toBeGreaterThan(240);
        expect(metrics.mapLayerRect!.height, 'Qidahen 地图交互层在手机横屏下不应塌成横条').toBeGreaterThan(120);
        expect(metrics.actionsZoneRect!.bottom, 'Qidahen 操作区不应掉出视口').toBeLessThanOrEqual(metrics.innerHeight + 1);
        expect(metrics.playerFloatRect!.top, 'Qidahen 手机横屏时玩家状态条不应被视口上沿裁切').toBeGreaterThanOrEqual(-1);
        expect(metrics.playerFloatRect!.right, 'Qidahen 手机横屏时玩家状态条不应被视口右边裁切').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.actionWheelRect!.top, 'Qidahen 手机横屏时轮盘不应被视口上沿裁切').toBeGreaterThanOrEqual(-1);
        expect(metrics.actionWheelRect!.left, 'Qidahen 手机横屏时轮盘不应被视口左边裁切').toBeGreaterThanOrEqual(-1);
        expect(metrics.drawPileRect!.left, 'Qidahen 手机横屏时左侧抽牌堆不应被视口左边裁切').toBeGreaterThanOrEqual(-1);
        expect(metrics.drawPileRect!.bottom, 'Qidahen 手机横屏时左侧抽牌堆不应被视口下沿裁切').toBeLessThanOrEqual(metrics.innerHeight + 1);
        expect(metrics.discardPileRect!.left, 'Qidahen 手机横屏时弃牌堆不应被视口左边裁切').toBeGreaterThanOrEqual(-1);
        expect(metrics.discardPileRect!.right, 'Qidahen 手机横屏时弃牌堆不应被视口右边裁切').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.discardPileRect!.bottom, 'Qidahen 手机横屏时弃牌堆不应被视口下沿裁切').toBeLessThanOrEqual(metrics.innerHeight + 1);

        expect(metrics.actionRects.length, 'Qidahen 手机横屏时操作区按钮应保留').toBeGreaterThan(0);
        for (const actionRect of metrics.actionRects) {
            expect(actionRect!.bottom, 'Qidahen 操作区按钮不应掉出视口').toBeLessThanOrEqual(metrics.innerHeight + 1);
            expect(actionRect!.height, 'Qidahen 手机横屏行动按钮热区不得低于 44px').toBeGreaterThanOrEqual(44);
            const overlapsDiscardPile = actionRect!.left < metrics.discardPileRect!.right
                && actionRect!.right > metrics.discardPileRect!.left
                && actionRect!.top < metrics.discardPileRect!.bottom
                && actionRect!.bottom > metrics.discardPileRect!.top;
            expect(overlapsDiscardPile, 'Qidahen 手机横屏行动按钮不得压住弃牌堆').toBe(false);
        }
        expect(metrics.mapControlRects.length, 'Qidahen 手机横屏地图缩放控件应可见').toBe(3);
        for (const controlRect of metrics.mapControlRects) {
            expect(controlRect!.height, '地图缩放控件热区不得低于 44px').toBeGreaterThanOrEqual(44);
            expect(controlRect!.width, '地图缩放控件热区不得低于 44px').toBeGreaterThanOrEqual(44);
        }
        expect(metrics.magnifyRects.length, '每张手牌都应保留移动端放大入口').toBe(metrics.handCards);
        for (const magnifyRect of metrics.magnifyRects) {
            expect(magnifyRect!.height, '手牌放大入口热区不得低于 44px').toBeGreaterThanOrEqual(44);
            expect(magnifyRect!.width, '手牌放大入口热区不得低于 44px').toBeGreaterThanOrEqual(44);
        }

        await screenshot(page, testName, '01-手机横屏-四张手牌完整可见.png');

        const beforeViewport = await readMapViewportState(page);
        const mapBox = await page.locator('#qidahen-harness-root [data-testid="qidahen-map-layer"]').boundingBox();
        expect(mapBox, 'Qidahen 地图层应有可交互尺寸').not.toBeNull();
        const mapCenter = {
            x: mapBox!.x + mapBox!.width / 2,
            y: mapBox!.y + mapBox!.height / 2,
        };
        await page.mouse.move(mapCenter.x, mapCenter.y);
        await page.mouse.wheel(0, -420);
        const zoomedViewport = await readMapViewportState(page);
        expect(zoomedViewport.zoom, 'Qidahen 手机横屏滚轮应能放大地图，不应被固定在初始比例').toBeGreaterThan(beforeViewport.zoom + 0.01);

        await page.mouse.move(mapCenter.x, mapCenter.y);
        await page.mouse.down();
        await page.mouse.move(mapCenter.x + 92, mapCenter.y + 38, { steps: 5 });
        await page.mouse.up();
        const draggedViewport = await readMapViewportState(page);
        expect(
            Math.abs(draggedViewport.panX - zoomedViewport.panX) + Math.abs(draggedViewport.panY - zoomedViewport.panY),
            'Qidahen 手机横屏拖拽应改变地图平移，不能清回自动追焦或初始位置',
        ).toBeGreaterThan(8);
        await page.waitForTimeout(250);
        const settledViewport = await readMapViewportState(page);
        expect(settledViewport.zoom, 'Qidahen 手机横屏用户放大后不应被自动追焦重置缩放').toBeCloseTo(draggedViewport.zoom, 2);
        expect(
            Math.abs(settledViewport.panX - draggedViewport.panX) + Math.abs(settledViewport.panY - draggedViewport.panY),
            'Qidahen 手机横屏用户拖拽后不应被自动追焦重置平移',
        ).toBeLessThan(2);
        await screenshot(page, testName, '01b-手机横屏-地图手动放大拖拽保持.png');

        const firstMagnifyButton = page.locator(
            '#qidahen-harness-root button[data-testid^="qidahen-hand-card-magnify-"]',
        ).first();
        await expect(firstMagnifyButton).toBeVisible();
        await firstMagnifyButton.click();

        const magnifyOverlay = page.getByTestId('qidahen-card-magnify-overlay');
        const magnifyContent = page.getByTestId('qidahen-card-magnify-content');
        const magnifyCloseButton = page.getByRole('button', { name: '关闭查看' });
        await expect(magnifyOverlay).toBeVisible();
        await expect(magnifyContent).toBeVisible();
        await expect(magnifyCloseButton).toBeVisible();
        const magnifyBox = await magnifyContent.boundingBox();
        const magnifyCloseBox = await magnifyCloseButton.boundingBox();
        expect(magnifyBox, '移动横屏手牌放大卡面应有可见尺寸').not.toBeNull();
        expect(magnifyCloseBox, '移动横屏手牌放大关闭按钮应有可见尺寸').not.toBeNull();
        expect(magnifyBox!.x, '移动横屏手牌放大卡面左边界不应出视口').toBeGreaterThanOrEqual(0);
        expect(magnifyBox!.x + magnifyBox!.width, '移动横屏手牌放大卡面右边界不应出视口').toBeLessThanOrEqual(metrics.innerWidth);
        expect(magnifyBox!.y, '移动横屏手牌放大卡面顶边界不应出视口').toBeGreaterThanOrEqual(0);
        expect(magnifyBox!.y + magnifyBox!.height, '移动横屏手牌放大卡面底边界不应出视口').toBeLessThanOrEqual(metrics.innerHeight);
        expect(magnifyCloseBox!.y, '移动横屏手牌放大关闭按钮不应被视口顶边裁切').toBeGreaterThanOrEqual(0);
        expect(magnifyCloseBox!.height, '移动横屏手牌放大关闭按钮热区不得低于 44px').toBeGreaterThanOrEqual(44);
        expect(magnifyCloseBox!.x + magnifyCloseBox!.width, '移动横屏手牌放大关闭按钮不应被视口右边裁切').toBeLessThanOrEqual(metrics.innerWidth);

        await screenshot(page, testName, '02-手机横屏-手牌放大查看.png');
        await magnifyCloseButton.click();
        await expect(magnifyOverlay).toBeHidden();
    });

    test('PC 基准截图用于和手机横屏开放式布局对比', async ({ page }) => {
        const testName = 'PC 基准截图用于和手机横屏开放式布局对比';

        await page.setViewportSize({ width: 1920, height: 1080 });
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-board"]')).toBeVisible();
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-player-float"]')).toBeVisible();
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-korea-zone"]')).toBeVisible();

        await screenshot(page, testName, '00-PC-1920x1080-基准全局布局.png');
    });
});
