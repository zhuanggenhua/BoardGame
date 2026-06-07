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
    'map-cost-editor.e2e',
);

const screenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, fileName);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
};

const mountQidahenMapCostEditorHarness = async (page: Page) => {
    await page.evaluate(async () => {
        window.localStorage.setItem('qidahen_map_cost_editor', '1');

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

test.describe('七大恨地图移动代价编辑器', () => {
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
        await mountQidahenMapCostEditorHarness(page);
    });

    test('可以修改、新增、删除移动边并导出配置 JSON', async ({ page }) => {
        const testName = '可以修改、新增、删除移动边并导出配置 JSON';
        const editor = page.locator('#qidahen-harness-root [data-testid="qidahen-map-cost-editor"]');
        const exportArea = page.locator('#qidahen-harness-root [data-testid="qidahen-map-cost-export"]');

        await expect(editor).toBeVisible();
        await expect(page.locator('#qidahen-harness-root [data-testid^="qidahen-map-cost-label-"]')).toHaveCount(6);
        await screenshot(page, testName, '01-editor-initial.png');

        await editor.getByRole('button', { name: '大同', exact: true }).click();
        await editor.getByLabel('北京 移动代价').fill('4');

        let exported = JSON.parse(await exportArea.inputValue()) as {
            regions: Array<{
                id: string;
                movementCostByRegionId: Record<string, number>;
            }>;
            movementEdges: Array<{ id: string; cost: number }>;
        };
        let datong = exported.regions.find((region) => region.id === 'datong');
        let beijing = exported.regions.find((region) => region.id === 'beijing');
        expect(datong?.movementCostByRegionId.beijing).toBe(4);
        expect(beijing?.movementCostByRegionId.datong).toBe(4);
        expect(exported.movementEdges.find((edge) => edge.id === 'beijing__datong')?.cost).toBe(4);
        await screenshot(page, testName, '02-datong-beijing-cost-updated.png');

        await editor.getByRole('button', { name: '盛京', exact: true }).click();
        await editor.getByRole('button', { name: '连接 北京' }).click();

        exported = JSON.parse(await exportArea.inputValue()) as typeof exported;
        const shengjing = exported.regions.find((region) => region.id === 'shengjing');
        beijing = exported.regions.find((region) => region.id === 'beijing');
        expect(shengjing?.movementCostByRegionId.beijing).toBe(1);
        expect(beijing?.movementCostByRegionId.shengjing).toBe(1);
        expect(exported.movementEdges.find((edge) => edge.id === 'beijing__shengjing')?.cost).toBe(1);
        await expect(page.locator('#qidahen-harness-root [data-testid^="qidahen-map-cost-label-"]')).toHaveCount(7);

        await editor.getByTestId('qidahen-map-cost-edge-delete-beijing__shengjing').click();

        exported = JSON.parse(await exportArea.inputValue()) as typeof exported;
        expect(exported.movementEdges.find((edge) => edge.id === 'beijing__shengjing')).toBeUndefined();
        expect(exported.regions.find((region) => region.id === 'shengjing')?.movementCostByRegionId.beijing).toBeUndefined();
        await expect(page.locator('#qidahen-harness-root [data-testid^="qidahen-map-cost-label-"]')).toHaveCount(6);
        await screenshot(page, testName, '03-new-edge-deleted.png');
    });
});
