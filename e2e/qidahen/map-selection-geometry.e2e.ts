import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
const regions = JSON.parse(readFileSync('src/games/qidahen/data/region-mask-regions.json', 'utf8')) as {
    regions: Array<{ id: string; color: string; seed: { x: number; y: number } }>;
};

test('正式地图编辑器与当前35个地理对象使用同一mask', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('正式工作区', { exact: true })).toBeVisible({ timeout: 60000 });
    const canvas = page.getByTestId('qidahen-mask-canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => (
        node.getContext('2d')!.getImageData(882, 369, 1, 1).data[3]
    )), { timeout: 45000, message: '等待正式工作区的真实mask完成绘制' }).toBe(255);
    const samples = await canvas.evaluate((node: HTMLCanvasElement, definitions) => definitions.map(region => {
        const { x, y } = region.seed;
        return { id: region.id, rgba: [...node.getContext('2d')!.getImageData(x, y, 1, 1).data] };
    }), regions.regions);
    expect(samples).toHaveLength(35);
    for (const sample of samples) {
        const region = regions.regions.find(region => region.id === sample.id)!;
        const rgb = [1, 3, 5].map(offset => Number.parseInt(region.color.slice(offset, offset + 2), 16));
        expect(sample.rgba, sample.id).toEqual([...rgb, 255]);
    }
    const response = await page.request.get('/src/games/qidahen/data/region-mask.png');
    expect(response.ok()).toBe(true);
    const sha = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
    const localSha = sha(readFileSync('src/games/qidahen/data/region-mask.png'));
    expect(sha(await response.body())).toBe(localSha);
    const dir = `evidence/qidahen/editor-${process.env.QIDAHEN_TUTORIAL_SCREENSHOT_RUN_ID}`;
    mkdirSync(dir, { recursive: true });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${dir}/正式地图工作区.png` });
    writeFileSync(`${dir}/editor-verification.json`, JSON.stringify({ status: 'PASS', sourceSha256: localSha, samples }, null, 2));
});
