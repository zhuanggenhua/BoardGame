import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { setChineseLocale, disableAudio } from '../helpers/common';

test.use({ viewport: { width: 1920, height: 1080 }, channel: 'chromium', launchOptions: { args: [] } });
test('正式纪年保存点的领取按钮贴近卡且可真实点击', async ({ page }) => {
    test.setTimeout(150_000);
    const root = 'C:/Users/zhuagenbao/AppData/Local/Temp/BoardGame-qidahen-annual-20261030/annual-r173-gameui-pc-20261102/desktop';
    const saved = JSON.parse(readFileSync(root + '/layout-failure.json', 'utf8')).saved;
    await setChineseLocale(page); await disableAudio(page);
    await page.addInitScript(saved => {
        (window as any).__E2E_TEST_MODE__ = true;
        for (const item of saved) localStorage.setItem(item.key, item.snapshot);
    }, saved);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90000 });
    await expect(page.locator('[data-tutorial-step="claim-year"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const button = page.getByTestId('qidahen-turn-option-claim');
    await expect(button).toBeInViewport({ ratio: 1 });
    await expect.poll(() => button.evaluate(node => {
        const r = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    })).toBe(true);
    const report = await page.evaluate(() => Object.fromEntries(['qidahen-chronology-zone', 'qidahen-chronology-choice', 'qidahen-map-viewport-controls'].map(id => {
        const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        return [id, { left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
    })));
    const dir = '.tmp/qidahen-chronology-placement-r174'; mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: dir + '/chronology-private.png' });
    await button.click();
    // 重复支付步骤由正式费用托盘表达，课程有意不另弹说明卡。
    await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__.state.get().sys.tutorial.step.id === 'chronology-first-card');
    await expect(page.getByTestId('qidahen-hand-interaction-tray')).toBeVisible();
    writeFileSync(dir + '/result.json', JSON.stringify({ status: 'PASS', entry: '实际R173失败存档经正式继续入口', bounds: report, actualClaimClickAccepted: true }, null, 2));
});
