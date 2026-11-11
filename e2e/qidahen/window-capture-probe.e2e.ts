import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { disableAudio, setChineseLocale } from '../helpers/common';

test.use({ channel: 'chrome', launchOptions: { args: [] } });
test('isolated tutorial window capture comparison', async ({ page }) => {
    test.setTimeout(120_000);
    const dir = resolve(process.env.QIDAHEN_WINDOW_PROBE_DIR ?? 'test-results/qidahen-window-probe-02');
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await setChineseLocale(page);
    await disableAudio(page);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-tutorial-step="frontier-goal"]')).toBeVisible({ timeout: 90_000 });
    const title = `QidahenWindowProbe-${process.pid}`;
    await page.evaluate(value => { document.title = value; }, title);
    const child = spawn('python', [resolve('e2e/qidahen/desktopBattleCapture.py'), title, dir, String(process.pid)], { windowsHide: true, env: { ...process.env, QIDAHEN_WINDOW_CAPTURE_PROBE: 'true' }, stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', data => { errors += String(data); });
    let code: number | null | undefined;
    const done = new Promise<void>((doneResolve, reject) => { child.once('error', reject); child.once('exit', value => { code = value; doneResolve(); }); });
    console.info('WINDOW_PROBE_WAIT_FOR_FOCUS', title);
    await expect.poll(() => existsSync(resolve(dir, 'battle-desktop-ready.json')) || code !== undefined, { timeout: 55_000 }).toBe(true);
    if (!existsSync(resolve(dir, 'battle-desktop-ready.json'))) { await done; throw new Error(errors); }
    await page.waitForTimeout(3000);
    writeFileSync(resolve(dir, 'battle-desktop-stop'), 'stop');
    await done;
    expect(code, errors).toBe(0);
});
