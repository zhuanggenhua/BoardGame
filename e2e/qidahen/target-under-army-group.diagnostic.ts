import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { waitForQidahenVisualReady } from './visualReady';

test.use({ channel: 'chromium', launchOptions: { args: [] } });

test('部队展开区覆盖目标地图时，真实目标仍可点击', async ({ page }) => {
    test.setTimeout(180_000);
    const checkpoint = '.tmp/qidahen-r206-checkpoints/dispatch-target.json';
    const output = '.tmp/qidahen-target-under-group';
    const encoded = encodeLocalMatchSnapshot(JSON.parse(readFileSync(checkpoint, 'utf8')));
    await setChineseLocale(page); await disableAudio(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(({ encoded, seed }) => {
        (window as any).__E2E_TEST_MODE__ = true;
        localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
    }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="dispatch-target"]')).toBeVisible({ timeout: 60_000 });
    await waitForQidahenVisualReady(page);
    const point = await page.evaluate(async () => {
        const modulePath = '/src/games/qidahen/ui/runtimeRegionOwnership.ts';
        const { buildQidahenRuntimeRegionIdByPixel } = await import(modulePath);
        const image = new Image(); image.src = '/src/games/qidahen/data/region-mask.png'; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
        const owners = buildQidahenRuntimeRegionIdByPixel(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        const map = document.querySelector<HTMLElement>('[data-testid="qidahen-map-content"]')!;
        const bounds = map.getBoundingClientRect();
        const tokens = [...document.querySelectorAll<HTMLElement>('[data-qidahen-map-token-region="city-region-15"][data-qidahen-map-token-type="army"]')];
        for (const token of tokens) {
            const rect = token.getBoundingClientRect();
            for (let y = Math.ceil(rect.top + 3); y < rect.bottom - 3; y += 4) for (let x = Math.ceil(rect.left + 3); x < rect.right - 3; x += 4) {
                if (x <= 0 || x >= innerWidth || y <= 0 || y >= innerHeight) continue;
                const mx = Math.floor((x - bounds.left) * canvas.width / bounds.width);
                const my = Math.floor((y - bounds.top) * canvas.height / bounds.height);
                if (mx < 0 || my < 0 || mx >= canvas.width || my >= canvas.height || owners[my * canvas.width + mx] !== 'city-region-7') continue;
                const hit = document.elementFromPoint(x, y);
                if (hit && map.contains(hit)) return { x, y, token: token.dataset.testid, hit: hit.getAttribute('data-testid') };
            }
        }
        return null;
    });
    expect(point, '需要同一真实画面中被来源兵牌覆盖的叶赫部像素').not.toBeNull();
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, 'click-point.json'), JSON.stringify(point, null, 2));
    await page.screenshot({ path: resolve(output, 'before-click.png') });
    await page.mouse.click(point!.x, point!.y);
    await expect(page.getByTestId('qidahen-turn-choice')).toContainText('叶赫部');
    await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled();
    await page.getByTestId('qidahen-turn-confirm').click();
    await expect(page.locator('[data-tutorial-step="defender-response"]')).toBeVisible({ timeout: 30_000 });
    writeFileSync(resolve(output, 'result.json'), JSON.stringify({ status: 'PASS', point }, null, 2));
});
