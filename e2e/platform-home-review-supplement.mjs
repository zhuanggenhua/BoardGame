import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createHomeVisualFixture, installHomeVisualData } from './helpers/homeVisualFixture.mjs';

// 补齐两个独立控件状态，不重复已经完成的整组采集。
const out = path.resolve('test-results/evidence-screenshots/platform/home-full-20261030-final');
const base = JSON.parse(readFileSync(path.join(out, 'capture-record.json'), 'utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');
for (const [file, expected] of Object.entries(base.sources)) expect(sha(readFileSync(file))).toBe(expected);
const fixture = await createHomeVisualFixture();
const browser = await chromium.launch({ headless: true });
const images = [], checks = [];
try {
    for (const mobile of [false, true]) {
        const label = mobile ? '手机' : '桌面';
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN' });
        await installHomeVisualData(context, { socketUrl: fixture.url, authenticated: true });
        const page = await context.newPage();
        await page.goto(base.entry, { waitUntil: 'domcontentloaded' });
        await page.locator('.platform-catalog-filters').getByRole('button', { name: '骰子', exact: true }).click();
        await expect(page.locator('.platform-catalog--discover [data-game-id="dicethrone"]')).toBeVisible();
        await expect(page.locator('.platform-catalog--discover [data-game-id="summonerwars"]')).toHaveCount(0);
        checks.push({ name: '分类筛选保留匹配游戏并移除不匹配游戏', label, pass: true });
        const shot = async (number, state, description) => {
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(350);
            const file = path.join(out, `${label}-${number}-${state}.png`);
            await page.screenshot({ path: file, fullPage: false, scale: 'css' });
            images.push({ path: file, sha256: sha(readFileSync(file)), label, state, description, viewport: mobile ? 'mobile' : 'desktop', url: page.url() });
        };
        await shot('90', '分类筛选', '骰子分类选中后显示匹配的游戏，分类与搜索入口保持可见');
        await page.locator('.platform-catalog-filters').getByRole('button', { name: '全部游戏', exact: true }).click();
        if (mobile) await page.getByRole('button', { name: '菜单', exact: true }).click();
        const language = page.locator('[data-language-style="platform"]').filter({ visible: true });
        await language.locator(':scope > button').click();
        await expect(language.locator('.platform-language-menu')).toBeVisible();
        await shot('91', '语言菜单', '语言菜单展开显示可选语言与当前选中项，未切换账户或界面语言');
        await context.close();
    }
    for (const [file, expected] of Object.entries(base.sources)) expect(sha(readFileSync(file))).toBe(expected);
    writeFileSync(path.join(out, 'supplement-record.json'), JSON.stringify({ entry: base.entry, images, checks, sources: base.sources, generator: { path: 'e2e/platform-home-review-supplement.mjs', sha256: sha(readFileSync('e2e/platform-home-review-supplement.mjs')) } }, null, 2));
    console.log(JSON.stringify({ captured: images.length, checks: checks.length, sourceUnchanged: true }));
} finally { await browser.close(); await fixture.close(); }
