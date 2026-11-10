import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { setChineseLocale, disableAudio } from '../helpers/common';
import { verifyQidahenMapCandidateRecovery } from './mapCandidateRecovery';

test.use({ viewport: { width: 1920, height: 1080 }, channel: 'chromium', launchOptions: { args: [] } });
test('实际保存的训练局面可自由查看被手牌覆盖的其它候选', async ({ page }) => {
    test.setTimeout(150_000);
    const diagnostic = JSON.parse(readFileSync('C:/Users/zhuagenbao/AppData/Local/Temp/BoardGame-qidahen-annual-20261030/annual-r170-gameui-pc-20261102/desktop/layout-failure.json','utf8'));
    await setChineseLocale(page); await disableAudio(page);
    await page.addInitScript(saved => {
        (window as any).__E2E_TEST_MODE__=true;
        for (const item of saved) localStorage.setItem(item.key,item.snapshot);
    }, diagnostic.saved);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="training-target"]')).toBeVisible();
    await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state.get().sys.tutorial.step?.id==='training-target');
    expect(await verifyQidahenMapCandidateRecovery(page, async () => {})).toBe(true);
});
