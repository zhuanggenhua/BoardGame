import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { dragQidahenMap } from './mapPointer';
import { waitForQidahenVisualReady } from './visualReady';

test.use({ channel: 'chromium', launchOptions: { args: [] } });
test('年中地图边缘的部队仍能通过真实平移完整查看', async ({ page }) => {
    test.setTimeout(180_000);
    const encoded = encodeLocalMatchSnapshot(JSON.parse(readFileSync('.tmp/qidahen-r206-checkpoints/midyear.json', 'utf8')));
    await setChineseLocale(page); await disableAudio(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(({ encoded, seed }) => {
        (window as any).__E2E_TEST_MODE__ = true;
        localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
    }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="midyear"]')).toBeVisible({ timeout: 60_000 });
    await waitForQidahenVisualReady(page);
    const panel = page.locator('[data-qidahen-army-group-region="city-region-15"]');
    const before = await panel.boundingBox();
    expect(before).not.toBeNull();
    const dx = Math.min(0, 1850 - (before!.x + before!.width));
    const dy = Math.max(0, 120 - before!.y);
    const output = resolve('.tmp/qidahen-midyear-group-pan'); mkdirSync(output, { recursive: true });
    await page.screenshot({ path: resolve(output, 'before.png') });
    await dragQidahenMap(page, dx, dy);
    await expect.poll(async () => {
        const rect = await panel.boundingBox();
        return !!rect && rect.x >= 0 && rect.y >= 74 && rect.x + rect.width <= 1920 && rect.y + rect.height <= 1080;
    }).toBe(true);
    const after = await panel.boundingBox();
    await page.screenshot({ path: resolve(output, 'after.png') });
    writeFileSync(resolve(output, 'result.json'), JSON.stringify({ status: 'PASS', before, after, dx, dy }, null, 2));
});
