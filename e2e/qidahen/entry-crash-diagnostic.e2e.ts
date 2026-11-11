import { expect, test } from '@playwright/test';
import { attachPageDiagnostics, disableAudio, setChineseLocale } from '../helpers/common';
import { trackQidahenSourceIdentity } from './sourceIdentity';
import { trackQidahenBlobUrls } from './blobUrlDiagnostics';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

// 与年度入口使用相同浏览器、视口和玩家入口；不安装年度证据追踪器。
test.use({ channel: 'chrome', launchOptions: { args: [] } });
test('isolated real tutorial entry diagnostic', async ({ page, browser }) => {
    test.setTimeout(180_000);
    console.info('ENTRY_PROBE_BROWSER', browser.version());
    await page.setViewportSize({ width: 1920, height: 1080 });
    console.info('ENTRY_PROBE_VIEWPORT');
    await setChineseLocale(page);
    console.info('ENTRY_PROBE_LOCALE');
    await disableAudio(page);
    console.info('ENTRY_PROBE_AUDIO');
    await page.addInitScript(() => { (window as unknown as { __E2E_TEST_MODE__: boolean }).__E2E_TEST_MODE__ = true; });
    console.info('ENTRY_PROBE_INIT');
    if (process.env.QIDAHEN_ENTRY_PROBE_ANNUAL_SETUP === 'true') {
        attachPageDiagnostics(page);
        const browserSession = await browser.newBrowserCDPSession();
        await browserSession.send('SystemInfo.getInfo');
        await browserSession.detach();
        console.info('ENTRY_PROBE_GPU');
        const session = await page.context().newCDPSession(page);
        await session.send('Performance.enable');
        console.info('ENTRY_PROBE_PERFORMANCE');
        await trackQidahenBlobUrls(page, 'test-results/qidahen-entry-probe-blob.json');
        console.info('ENTRY_PROBE_BLOB');
    }
    const identity = process.env.QIDAHEN_ENTRY_PROBE_IDENTITY === 'true'
        ? trackQidahenSourceIdentity(page, 'e2e/qidahen/entry-crash-diagnostic.e2e.ts', [], ['src/games/qidahen/Board.tsx', 'src/games/qidahen/annualTutorial.ts'])
        : null;
    if (process.env.QIDAHEN_MODULE_DIAGNOSTIC === 'true') {
        console.info('ENTRY_PROBE_BEFORE_REPORT');
        writeFileSync('test-results/qidahen-probe-modules.json', JSON.stringify({ modules: Object.keys(createRequire(import.meta.url).cache), report: process.report?.getReport().sharedObjects }, null, 2));
        console.info('ENTRY_PROBE_AFTER_REPORT');
    }
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    console.info('ENTRY_PROBE_DOM_READY', (await page.locator('body').innerText()).slice(0, 200));
    await expect(page.locator('[data-tutorial-step="frontier-goal"]')).toBeVisible({ timeout: 120_000 });
    console.info('ENTRY_PROBE_FRONTIER_VISIBLE');
    if (identity) console.info('ENTRY_PROBE_IDENTITY', JSON.stringify(await identity()));
});
