import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { QIDAHEN_VISUAL_SOURCE_PATHS, requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from './sourceIdentity';
import { waitForQidahenVisualReady } from './visualReady';

test.use({ channel: 'chromium', launchOptions: { args: [] } });

test('真实教程入口的页面响应与源码直接对应', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await setChineseLocale(page);
    await disableAudio(page);
    await page.addInitScript(() => { (window as any).__E2E_TEST_MODE__ = true; });
    const verify = trackQidahenSourceIdentity(page, 'e2e/qidahen/source-identity-smoke.diagnostic.ts', ['e2e/qidahen/sourceIdentity.ts'], QIDAHEN_VISUAL_SOURCE_PATHS);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-tutorial-step="frontier-goal"]')).toBeVisible({ timeout: 90_000 });
    await waitForQidahenVisualReady(page);
    const identity = await verify();
    const recordPath = resolve(process.env.QIDAHEN_SOURCE_IDENTITY_RECORD ?? testInfo.outputPath('source-identity.json'));
    mkdirSync(dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, JSON.stringify(identity, null, 2));
    requireCompleteQidahenSourceIdentity(identity);
});
