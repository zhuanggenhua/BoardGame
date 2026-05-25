import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import {
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

const mountQidahenBoardHarness = async (page: Page) => {
    await page.evaluate(async () => {
        const existing = document.getElementById('qidahen-harness-root');
        existing?.remove();

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

        const ReactModule = await import('/node_modules/.vite/deps/react.js');
        const React = ReactModule.default;
        const ReactDomModule = await import('/node_modules/.vite/deps/react-dom_client.js');
        const ReactDOM = ReactDomModule.default;
        const BoardModule = await import('/src/games/qidahen/Board.tsx');
        const DomainModule = await import('/src/games/qidahen/domain/index.ts');
        const initialCore = DomainModule.QidahenDomain.setup(['0', '1', '2'], () => 0.42);

        const Harness = () => {
            const [core, setCore] = React.useState(initialCore);
            const dispatch = React.useCallback((type: string, payload: { regionId?: string }) => {
                if (type === 'SELECT_REGION' && payload.regionId) {
                    setCore((current: typeof initialCore) => ({
                        ...current,
                        selectedRegionId: payload.regionId,
                    }));
                }
            }, []);

            return React.createElement(BoardModule.default, {
                G: { core },
                dispatch,
                playerID: '0',
            });
        };

        ReactDOM.createRoot(host).render(React.createElement(Harness));
    });
};

test.describe('七大恨移动端布局兼容', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ page, context }) => {
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
    });

    test('手机横屏下主地图、手牌和底部操作区应保持可见且不出现顶层横向溢出', async ({ page }) => {
        const testName = '手机横屏下主地图、手牌和底部操作区应保持可见且不出现顶层横向溢出';

        await page.setViewportSize({ width: 896, height: 414 });
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-board"]')).toBeVisible();
        await expect(page.locator('#qidahen-harness-root [data-testid="qidahen-map-container"]')).toBeVisible();

        const metrics = await page.evaluate(() => {
            const board = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-board"]');
            const mapContainer = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-map-container"]');
            const mapContent = document.querySelector<HTMLElement>('#qidahen-harness-root [data-testid="qidahen-map-content"]');
            const actionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#qidahen-harness-root button'))
                .filter((button) => button.textContent?.includes('确认') || button.textContent?.includes('取消'));
            const handCards = document.querySelectorAll('#qidahen-harness-root button[class*="h-[142px]"]').length;

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
                mapContainerRect: rect(mapContainer),
                mapContentRect: rect(mapContent),
                actionRects: actionButtons.map((button) => rect(button)).filter(Boolean),
                handCards,
            };
        });

        expect(metrics.docScrollWidth, 'Qidahen 手机横屏时 documentElement 不应横向溢出').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.bodyScrollWidth, 'Qidahen 手机横屏时 body 不应横向溢出').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.boardRect, '应渲染 Qidahen 主板面').not.toBeNull();
        expect(metrics.mapContainerRect, '应渲染 Qidahen 地图视口').not.toBeNull();
        expect(metrics.mapContentRect, '应渲染 Qidahen 地图内容').not.toBeNull();
        expect(metrics.handCards, 'Qidahen 手机横屏时手牌区应保留至少一张可见卡牌').toBeGreaterThan(0);

        expect(metrics.boardRect!.left, 'Qidahen 板面左边界不应出视口').toBeGreaterThanOrEqual(-1);
        expect(metrics.boardRect!.right, 'Qidahen 板面右边界不应出视口').toBeLessThanOrEqual(metrics.innerWidth + 1);
        expect(metrics.boardRect!.bottom, 'Qidahen 板面底边界不应出视口').toBeLessThanOrEqual(metrics.innerHeight + 1);
        expect(metrics.mapContainerRect!.width, 'Qidahen 地图视口在手机横屏下不应塌成窄条').toBeGreaterThan(240);
        expect(metrics.mapContainerRect!.height, 'Qidahen 地图视口在手机横屏下不应塌成横条').toBeGreaterThan(120);

        expect(metrics.actionRects.length, 'Qidahen 手机横屏时底部确认/取消按钮应保留').toBeGreaterThanOrEqual(2);
        for (const actionRect of metrics.actionRects) {
            expect(actionRect!.bottom, 'Qidahen 底部操作按钮不应掉出视口').toBeLessThanOrEqual(metrics.innerHeight + 1);
        }

        await screenshot(page, testName, 'qidahen-mobile-landscape-layout.png');
    });
});
