import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { QIDAHEN_VISUAL_SOURCE_PATHS, requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from './sourceIdentity';

test.use({ channel: 'chromium', launchOptions: { args: [] } });

test('人物卡放大使用完整分辨率单卡', async ({ page }) => {
    test.setTimeout(180_000);
    const checkpoint = process.env.QIDAHEN_CHARACTER_CHECKPOINT;
    const output = process.env.QIDAHEN_CARD_INSPECT_DIR;
    if (!checkpoint || !output) throw new Error('Current character checkpoint and output directory are required');
    const sourceIdentity = trackQidahenSourceIdentity(page, 'e2e/qidahen/card-inspect-check.diagnostic.ts',
        ['e2e/qidahen/sourceIdentity.ts', checkpoint], [...QIDAHEN_VISUAL_SOURCE_PATHS,
            'public/assets/i18n/zh-CN/qidahen/cards/inspect/compressed/ming-4.webp']);
    await setChineseLocale(page); await disableAudio(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const encoded = encodeLocalMatchSnapshot(JSON.parse(readFileSync(checkpoint, 'utf8')));
    await page.addInitScript(({ encoded, seed }) => {
        (window as any).__E2E_TEST_MODE__ = true;
        localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
    }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="year-character"]')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('qidahen-turn-inspect-ming-yang-gao').click();
    const image = page.getByTestId('qidahen-high-resolution-card').locator('img');
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(487);
    await image.evaluate(element => (element as HTMLImageElement).decode());
    await expect(page.getByTestId('qidahen-card-magnify-overlay')).toBeVisible();
    await expect.poll(() => page.getByTestId('qidahen-card-magnify-overlay').evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const directory = resolve(output); mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, 'year-character-inspect.png') });
    const identity = requireCompleteQidahenSourceIdentity(await sourceIdentity());
    writeFileSync(resolve(directory, 'result.json'), JSON.stringify({ status: 'PASS', naturalWidth: 487, sourceIdentity: identity }, null, 2));
});
