import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { QIDAHEN_MAP_REGION_SHAPES } from '../src/games/qidahen/ui/mapRegions';

type MaskColorCounts = {
    red: number;
    yellow: number;
    redCenter: { x: number; y: number } | null;
    yellowCenter: { x: number; y: number } | null;
    redBounds: { left: number; top: number; right: number; bottom: number } | null;
};

type RgbaPixel = readonly [number, number, number, number];
type ElementRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const MASK_WIDTH = 1265;
const MASK_HEIGHT = 893;
const BEIJING_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-beijing-current.png';
const ONE_REGION_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-one-region-current.png';
const PATH_GRAPH_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-path-graph-current.png';
const PATH_GRAPH_PERSISTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-path-graph-persisted-current.png';
const BOUNDARY_DRAFT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-boundary-draft-current.png';
const SPECIFIED_BOUNDARY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-specified-boundary-current.png';
const EDITED_PASSAGE_ID = 'jinzhou::song-jin';
const REGION_MASK_COLORS = {
    jinzhou: [214, 76, 58] as const,
    'song-jin': [228, 169, 58] as const,
};

const saveScreenshot = async (page: Page, targetPath: string) => {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    await page.screenshot({ path: targetPath, fullPage: true });
};

const waitForBoundaryMask = async (page: Page) => {
    await page.waitForFunction(() => {
        const match = /当前(?:最终)?障碍像素：([\d,]+)/u.exec(document.body.innerText);
        return match != null && Number(match[1].replace(/,/gu, '')) > 0;
    }, null, { timeout: 30000 });
};

const getRect = async (locator: ReturnType<Page['locator']>): Promise<ElementRect> => (
    locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        };
    })
);

const mapCanvasPointToClient = (canvasBox: ElementRect, x: number, y: number) => ({
    x: canvasBox.x + ((x / MASK_WIDTH) * canvasBox.width),
    y: canvasBox.y + ((y / MASK_HEIGHT) * canvasBox.height),
});

const clickCanvasMapPoint = async (page: Page, canvasBox: ElementRect, x: number, y: number) => {
    const point = mapCanvasPointToClient(canvasBox, x, y);
    await page.mouse.click(point.x, point.y);
};

const dragGraphNodeToNode = async (page: Page, fromTestId: string, toTestId: string) => {
    const fromRect = await getRect(page.getByTestId(fromTestId));
    const toRect = await getRect(page.getByTestId(toTestId));
    const from = {
        x: fromRect.x + (fromRect.width / 2),
        y: fromRect.y + (fromRect.height / 2),
    };
    const to = {
        x: toRect.x + (toRect.width / 2),
        y: toRect.y + (toRect.height / 2),
    };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
};

const dragCanvasMapLine = async (
    page: Page,
    canvasBox: ElementRect,
    from: { x: number; y: number },
    to: { x: number; y: number },
) => {
    const start = mapCanvasPointToClient(canvasBox, from.x, from.y);
    const end = mapCanvasPointToClient(canvasBox, to.x, to.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 18 });
    await page.mouse.up();
};

const selectRegionCard = async (page: Page, regionId: string) => {
    const card = page.getByTestId(`qidahen-region-card-${regionId}`);
    await expect(card).toBeVisible();
    const rect = await getRect(card);
    await page.mouse.click(rect.x + rect.width - 20, rect.y + rect.height - 18);
};

const readSavedRegionGraph = () => {
    const graphPath = path.resolve(process.cwd(), 'src/games/qidahen/data/region-graph.json');
    return JSON.parse(readFileSync(graphPath, 'utf8')) as {
        nodes?: Array<{ id?: string; center?: { x: number; y: number } | null; pixelCount?: number }>;
        edges?: Array<{ id?: string; from?: string; to?: string; boundaryType?: string; boundaryLabel?: string; battleWidth?: number }>;
    };
};

const getMaskColorCounts = async (page: Page): Promise<MaskColorCounts> => (
    page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1];
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('mask canvas context missing');
        }

        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        let redX = 0;
        let redY = 0;
        let redLeft = Number.POSITIVE_INFINITY;
        let redTop = Number.POSITIVE_INFINITY;
        let redRight = 0;
        let redBottom = 0;
        let yellow = 0;
        let yellowX = 0;
        let yellowY = 0;

        for (let index = 0; index < data.length; index += 4) {
            const pixelIndex = index / 4;
            const x = pixelIndex % canvas.width;
            const y = Math.floor(pixelIndex / canvas.width);
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            if (r === 214 && g === 76 && b === 58 && a === 255) {
                red += 1;
                redX += x;
                redY += y;
                redLeft = Math.min(redLeft, x);
                redTop = Math.min(redTop, y);
                redRight = Math.max(redRight, x);
                redBottom = Math.max(redBottom, y);
            }
            if (r === 228 && g === 169 && b === 58 && a === 255) {
                yellow += 1;
                yellowX += x;
                yellowY += y;
            }
        }

        return {
            red,
            yellow,
            redCenter: red > 0 ? { x: Math.round(redX / red), y: Math.round(redY / red) } : null,
            yellowCenter: yellow > 0 ? { x: Math.round(yellowX / yellow), y: Math.round(yellowY / yellow) } : null,
            redBounds: red > 0 ? { left: redLeft, top: redTop, right: redRight, bottom: redBottom } : null,
        };
    })
);

const measureMaskColorOutsideRegionShape = async (
    page: Page,
    regionId: keyof typeof REGION_MASK_COLORS,
): Promise<{ total: number; outside: number; outsideRatio: number }> => {
    const shape = QIDAHEN_MAP_REGION_SHAPES.find((item) => item.id === regionId);
    if (!shape) {
        throw new Error(`missing qidahen region shape: ${regionId}`);
    }
    const color = REGION_MASK_COLORS[regionId];
    return page.evaluate(
        ({ polygon, color: targetColor }) => {
            const pointInPolygon = (x: number, y: number, points: ReadonlyArray<readonly [number, number]>) => {
                let inside = false;
                for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
                    const [xi, yi] = points[i];
                    const [xj, yj] = points[j];
                    const intersects = ((yi > y) !== (yj > y))
                        && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 1)) + xi);
                    if (intersects) {
                        inside = !inside;
                    }
                }
                return inside;
            };

            const canvas = document.querySelectorAll('canvas')[1];
            const context = canvas?.getContext('2d');
            if (!canvas || !context) {
                throw new Error('mask canvas context missing');
            }
            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let total = 0;
            let outside = 0;
            for (let index = 0; index < data.length; index += 4) {
                if (
                    data[index] !== targetColor[0]
                    || data[index + 1] !== targetColor[1]
                    || data[index + 2] !== targetColor[2]
                    || data[index + 3] !== 255
                ) {
                    continue;
                }
                total += 1;
                const pixelIndex = index / 4;
                const x = pixelIndex % canvas.width;
                const y = Math.floor(pixelIndex / canvas.width);
                if (!pointInPolygon(x, y, polygon)) {
                    outside += 1;
                }
            }
            return {
                total,
                outside,
                outsideRatio: total > 0 ? outside / total : 0,
            };
        },
        { polygon: shape.polygon, color },
    );
};

const getCanvasPixel = async (
    page: Page,
    canvasIndex: number,
    x: number,
    y: number,
): Promise<RgbaPixel> => (
    page.evaluate(
        ({ canvasIndex: targetCanvasIndex, x: targetX, y: targetY }) => {
            const canvas = document.querySelectorAll('canvas')[targetCanvasIndex];
            const context = canvas?.getContext('2d');
            if (!canvas || !context) {
                throw new Error(`canvas ${targetCanvasIndex} context missing`);
            }
            const data = context.getImageData(targetX, targetY, 1, 1).data;
            return [data[0], data[1], data[2], data[3]] as const;
        },
        { canvasIndex, x, y },
    )
);

test.describe('七大恨区域制图工具', () => {
    test('指定边界颜色可以生成区域初始值', async ({ page }) => {
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨区域制图工具')).toBeVisible({ timeout: 30000 });
        await waitForBoundaryMask(page);
        const canvasBox = await getRect(page.getByTestId('qidahen-region-canvas'));

        await page.getByTestId('qidahen-generate-boundary-draft').click();
        await expect(page.getByText(/已从当前边界颜色生成可编辑边界图/u)).toBeVisible();
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBeGreaterThan(0);
        await saveScreenshot(page, BOUNDARY_DRAFT_SCREENSHOT);
        await page.getByRole('button', { name: '清空边界图' }).click();
        await expect(page.getByText(/已清空边界图和手工修正/u)).toBeVisible();

        await page.getByRole('button', { name: '清空', exact: true }).click();
        await page.getByRole('button', { name: '清空微调层' }).click();
        await page.getByLabel('指定边界颜色').fill('rgb(255, 0, 255)');
        await page.getByTestId('qidahen-add-boundary-color').click();
        await expect(page.getByText(/已加入指定边界颜色/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-painted-boundary-only-toggle')).toContainText('只用边界颜色/手工补边');

        await page.getByRole('button', { name: '边界修正', exact: true }).click();
        await page.getByRole('button', { name: '桥接', exact: true }).click();
        const boundaryPoints = [
            { x: 724, y: 371 },
            { x: 789, y: 338 },
            { x: 846, y: 370 },
            { x: 844, y: 452 },
            { x: 792, y: 498 },
            { x: 724, y: 472 },
            { x: 694, y: 422 },
            { x: 724, y: 371 },
        ];
        for (let index = 0; index < boundaryPoints.length - 1; index += 1) {
            await dragCanvasMapLine(page, canvasBox, boundaryPoints[index], boundaryPoints[index + 1]);
        }

        await expect.poll(async () => {
            const match = /手工补边：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBeGreaterThan(0);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible();
        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(1000);
        expect(counts.redCenter).not.toBeNull();
        expect(counts.redCenter!.x).toBeGreaterThan(700);
        expect(counts.redCenter!.x).toBeLessThan(850);
        expect(counts.redCenter!.y).toBeGreaterThan(350);
        expect(counts.redCenter!.y).toBeLessThan(500);
        await saveScreenshot(page, SPECIFIED_BOUNDARY_SCREENSHOT);
    });

    test('魔棒分区、区域中心路径编辑和单主保存动作可用', async ({ page }) => {
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨区域制图工具')).toBeVisible({ timeout: 30000 });
        await waitForBoundaryMask(page);

        await expect(page.getByText('rgb(61, 69, 66)')).toBeVisible();
        await expect(page.getByText('rgb(126, 97, 56)')).toBeVisible();
        await expect(page.getByText('rgb(128, 104, 62)')).toBeVisible();
        await expect(page.getByText('rgb(43, 36, 34)')).toBeVisible();
        await expect(page.getByRole('button', { name: '保存区域数据' })).toHaveCount(1);
        await expect(page.getByRole('button', { name: /导出/u })).toHaveCount(0);
        await expect(page.locator('canvas')).toHaveCount(5);
        await expect(page.getByTestId('qidahen-region-graph')).toBeVisible();
        const canvasBox = await getRect(page.getByTestId('qidahen-region-canvas'));

        const barrierOpacity = await page.locator('canvas').nth(3).evaluate((canvas) => window.getComputedStyle(canvas).opacity);
        expect(barrierOpacity).toBe('0');

        const beijingBackgroundPixel = await getCanvasPixel(page, 0, 520, 610);
        expect(beijingBackgroundPixel[3]).toBe(255);
        expect(beijingBackgroundPixel.slice(0, 3).some((channel) => channel > 0)).toBe(true);

        await page.getByText('北京样本', { exact: true }).click();
        await expect(page.getByText(/北京样本 · 北京 @ 520, 610/u)).toBeVisible();
        await expect.poll(async () => (await getCanvasPixel(page, 1, 520, 610))[3]).toBe(255);
        await clickCanvasMapPoint(page, canvasBox, 520, 610);
        await expect(page.getByText(/已替换 北京 样本/u)).toBeVisible();
        const beijingMaskPixel = await getCanvasPixel(page, 1, 520, 610);
        expect(beijingMaskPixel[3]).toBe(255);
        await saveScreenshot(page, BEIJING_SCREENSHOT);

        await page.getByRole('button', { name: '清空', exact: true }).click();
        await selectRegionCard(page, 'jinzhou');
        await expect(page.getByText(/当前区域：\s*锦州/u)).toBeVisible();
        await clickCanvasMapPoint(page, canvasBox, 773, 420);
        await expect(page.getByText(/已替换 锦州/u)).toBeVisible();

        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(1000);
        expect(counts.yellow).toBe(0);
        expect(counts.redBounds).not.toBeNull();
        const jinzhouOutsideShape = await measureMaskColorOutsideRegionShape(page, 'jinzhou');
        expect(jinzhouOutsideShape.total).toBeGreaterThan(1000);
        expect(jinzhouOutsideShape.outsideRatio).toBeLessThanOrEqual(0.08);
        await saveScreenshot(page, ONE_REGION_SCREENSHOT);

        await selectRegionCard(page, 'song-jin');
        await expect(page.getByText(/当前区域：\s*宋进/u)).toBeVisible();
        await clickCanvasMapPoint(page, canvasBox, 697, 631);
        await expect(page.getByText(/已替换 宋进/u)).toBeVisible();
        const twoRegionCounts = await getMaskColorCounts(page);
        expect(twoRegionCounts.red).toBeGreaterThan(1000);
        expect(twoRegionCounts.yellow).toBeGreaterThan(1000);
        const songJinOutsideShape = await measureMaskColorOutsideRegionShape(page, 'song-jin');
        expect(songJinOutsideShape.total).toBeGreaterThan(1000);
        expect(songJinOutsideShape.outsideRatio).toBeLessThanOrEqual(0.08);

        await page.getByRole('button', { name: '路径', exact: true }).click();
        await expect(page.getByText('路径模式下，从已分区区域中心拖到另一个中心建立边。')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-graph-node-jinzhou')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-graph-node-song-jin')).toBeVisible();
        await dragGraphNodeToNode(page, 'qidahen-region-graph-node-jinzhou', 'qidahen-region-graph-node-song-jin');
        const passageRow = page.getByTestId(`qidahen-passage-row-${EDITED_PASSAGE_ID}`);
        await expect(passageRow).toBeVisible();
        await page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`).selectOption('mountain');
        await expect(page.getByTestId(`qidahen-passage-edge-${EDITED_PASSAGE_ID}`).getByText('山脉')).toBeVisible();
        await passageRow.scrollIntoViewIfNeeded();
        await saveScreenshot(page, PATH_GRAPH_SCREENSHOT);

        await page.getByRole('button', { name: '保存区域数据' }).click();
        await expect(page.getByText(/已保存到 src\/games\/qidahen\/data/u)).toBeVisible({ timeout: 10000 });
        const savedGraph = readSavedRegionGraph();
        const savedPassage = savedGraph.edges?.find((edge) => edge.id === EDITED_PASSAGE_ID);
        expect(savedPassage).toMatchObject({
            from: 'jinzhou',
            to: 'song-jin',
            boundaryType: 'mountain',
            boundaryLabel: '山脉',
            battleWidth: 2,
        });
        expect(savedGraph.nodes?.find((node) => node.id === 'jinzhou')?.center).not.toBeNull();
        expect(savedGraph.nodes?.find((node) => node.id === 'song-jin')?.center).not.toBeNull();

        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨区域制图工具')).toBeVisible({ timeout: 30000 });
        await waitForBoundaryMask(page);
        await page.getByRole('button', { name: '路径', exact: true }).click();
        const persistedPassageRow = page.getByTestId(`qidahen-passage-row-${EDITED_PASSAGE_ID}`);
        await expect(persistedPassageRow).toBeVisible();
        await expect(page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`)).toHaveValue('mountain');
        await expect(page.getByTestId(`qidahen-passage-edge-${EDITED_PASSAGE_ID}`).getByText('山脉')).toBeVisible();
        await persistedPassageRow.scrollIntoViewIfNeeded();
        await saveScreenshot(page, PATH_GRAPH_PERSISTED_SCREENSHOT);
    });
});
