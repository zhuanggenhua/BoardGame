import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createHomeVisualFixture, installHomeVisualData } from './helpers/homeVisualFixture.mjs';

// 本轮只复核被点名的建房宽度和旧版施工横幅，数据沿用首页视觉夹具。
const before = process.argv.includes('--before');
const expandedOnly = process.argv.includes('--desktop-expanded-only');
const out = path.resolve(process.env.HOME_REVIEW_OUT ?? '.tmp/home-width-ribbon-before');
mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : /\.(tsx?|css)$/.test(item.name) ? [path.join(dir, item.name)] : []);
const sources = [...walk('src/components/home'), ...walk('src/components/lobby'), 'src/components/game/framework/ImplementationStatusRibbon.tsx', 'src/components/game/framework/CharacterSelectionBadge.tsx', 'e2e/platform-home-width-ribbon-review.mjs', 'e2e/helpers/homeVisualFixture.mjs'];
const identity = () => Object.fromEntries(sources.map(file => [file, sha(readFileSync(file))]));
const start = identity();
const previous = expandedOnly ? JSON.parse(readFileSync(path.join(out, 'capture-record.json'), 'utf8')) : null;
if (previous) {
    for (const [file, expected] of Object.entries(previous.sources)) {
        if (file !== 'e2e/platform-home-width-ribbon-review.mjs') expect(start[file]).toBe(expected);
    }
    copyFileSync(path.join(out, 'capture-record.json'), path.join(out, 'capture-prior.json'));
}
const fixture = await createHomeVisualFixture();
const browser = await chromium.launch({ headless: true });
const images = previous ? previous.images.filter(image => !(image.label === '桌面' && image.state === '智能对手展开')) : [];
const checks = [];
try {
    for (const mobile of expandedOnly ? [false] : [false, true]) {
        const label = mobile ? '手机' : '桌面';
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN' });
        await installHomeVisualData(context, { socketUrl: fixture.url, authenticated: true });
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:4273/', { waitUntil: 'domcontentloaded' });
        await page.locator('.platform-game-card').first().waitFor();
        const shot = async (state, description) => {
            if (expandedOnly && state !== '智能对手展开') return;
            await page.evaluate(() => document.fonts.ready);
            await page.waitForFunction(() => [...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0; }).every(img => img.complete && img.naturalWidth > 0));
            await page.waitForTimeout(500);
            const file = path.join(out, `${label}-${state}.png`);
            await page.screenshot({ path: file, fullPage: false, scale: 'css' });
            images.push({ path: file, sha256: sha(readFileSync(file)), label, state, description, viewport: mobile ? 'mobile' : 'desktop', url: page.url() });
        };
        const construction = page.locator('[data-game-id="mage-wars"]');
        await construction.scrollIntoViewIfNeeded();
        await shot('实施中横幅', '发现列表中的实施中游戏显示旧版斜向施工横幅，游戏封面和标题仍可识别');
        checks.push({ label, name: '施工横幅复用既有组件', pass: await construction.locator('[data-testid="platform-status-ribbon-mage-wars"]').count() === 1 });
        if (!before) await expect(construction.locator('[data-testid="platform-status-ribbon-mage-wars"]')).toBeVisible();
        await page.locator('[data-game-id="dicethrone"] .platform-game-open').click();
        await page.getByTestId('game-details-open-create-room').click();
        const input = page.getByTestId('create-room-name-input');
        await input.fill('周末好友轻松对战');
        const ai = page.locator('.platform-room-content button[aria-pressed]').filter({ hasText: '加入 AI' }).first();
        await ai.waitFor();
        await ai.scrollIntoViewIfNeeded();
        await shot('加入智能对手', '加入智能对手的配置入口与房名及其它字段使用相同左右边界，尚未创建房间');
        const rects = await Promise.all([input, ai].map(locator => locator.boundingBox()));
        const aligned = Math.abs(rects[0].x - rects[1].x) <= 1 && Math.abs(rects[0].width - rects[1].width) <= 1;
        checks.push({ label, name: '加入智能对手入口与房名同宽对齐', pass: aligned, rects });
        if (!before) expect(aligned).toBe(true);
        await ai.click();
        await page.getByTestId('create-room-ai-thinking-time-select').waitFor();
        await page.getByTestId('create-room-ai-manual-faction-checkbox').locator('..').scrollIntoViewIfNeeded();
        const manual = await page.getByTestId('create-room-ai-manual-faction-checkbox').locator('..').boundingBox();
        const content = await page.locator('.platform-room-content').boundingBox();
        expect(manual.y).toBeGreaterThanOrEqual(content.y);
        expect(manual.y + manual.height).toBeLessThanOrEqual(content.y + content.height + 1);
        await shot('智能对手展开', '智能对手配置展开后保留难度、思考时间和席位操作，表单可滚动');
        await expect(ai).toHaveAttribute('aria-pressed', 'true');
        await context.close();
    }
    expect(identity()).toEqual(start);
    const allChecks = previous ? [...previous.checks.filter(check => check.label !== '桌面'), ...checks] : checks;
    writeFileSync(path.join(out, 'capture-record.json'), JSON.stringify({ entry: 'http://127.0.0.1:4273/', before, images, checks: allChecks, sources: start, ...(previous ? { unchangedMediaEvidence: 'capture-prior.json', unchangedReason: '只调整桌面展开态的取图滚动位置，界面源码未改，其余五张原图字节未改。' } : {}) }, null, 2));
    console.log(JSON.stringify({ images: images.length, checks, sourceUnchanged: true }));
} finally { await browser.close(); await fixture.close(); }
