import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { waitForQidahenVisualReady } from './visualReady';

test.use({ channel: 'chromium', launchOptions: { args: [] } });
test('选择出兵来源时，该地区部队及标题完整可见', async ({ page }) => {
    test.setTimeout(180_000);
    const checkpoint = '.tmp/qidahen-r235-checkpoints/dispatch-source.json';
    const output = '.tmp/qidahen-dispatch-source-group';
    const encoded = encodeLocalMatchSnapshot(JSON.parse(readFileSync(checkpoint, 'utf8')));
    await setChineseLocale(page); await disableAudio(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(({ encoded, seed }) => {
        (window as any).__E2E_TEST_MODE__ = true;
        localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
    }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state.get()?.sys.tutorial.step?.id), { timeout: 60_000 }).toBe('dispatch-source');
    await expect(page.getByTestId('qidahen-turn-choice')).toContainText('选择出兵来源');
    await waitForQidahenVisualReady(page);
    const panel = page.locator('[data-qidahen-army-group-region="city-region-15"]');
    const outputDir = resolve(output); mkdirSync(outputDir, { recursive: true });
    const measure = async () => page.evaluate(() => {
        const rect = document.querySelector('[data-qidahen-army-group-region="city-region-15"]')!.getBoundingClientRect();
        const hud = document.querySelector('[data-testid="qidahen-player-float"]')!.getBoundingClientRect();
        return { panel: rect.toJSON(), hud: hud.toJSON(), screen: { width: innerWidth, height: innerHeight } };
    });
    try {
        await expect(panel).toBeVisible();
        await expect.poll(async () => {
            const { panel: p, hud: h, screen } = await measure();
            return p.left >= 0 && p.top >= 0 && p.right <= screen.width && p.bottom <= screen.height
                && (p.right <= h.left || p.left >= h.right || p.bottom <= h.top || p.top >= h.bottom);
        }).toBe(true);
        writeFileSync(resolve(outputDir, 'result.json'), JSON.stringify({ status: 'PASS', geometry: await measure() }, null, 2));
    } finally {
        writeFileSync(resolve(outputDir, 'geometry.json'), JSON.stringify(await measure(), null, 2));
        await page.screenshot({ path: resolve(outputDir, 'source.png') });
    }
});
