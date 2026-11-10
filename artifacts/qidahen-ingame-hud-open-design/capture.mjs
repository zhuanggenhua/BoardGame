import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const root = path.resolve('artifacts/qidahen-ingame-hud-open-design');
const html = pathToFileURL(path.join(root, 'board.html')).href;
const outDir = path.join(root, 'exports');
const compareDir = path.resolve('temp/qidahen-ingame-hud-compare');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(compareDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(20000);

async function shot(name) {
  await page.waitForTimeout(120);
  const dest = path.join(outDir, name);
  await page.screenshot({ path: dest, fullPage: false });
  fs.copyFileSync(dest, path.join(compareDir, name));
  console.log('shot', name);
}

await page.goto(html, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="qidahen-od-wheel"]');
await page.evaluate(() => Promise.all([...document.images].map((img) => (
  img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
))));
await page.waitForTimeout(300);
await shot('01-ingame-hud-idle.png');

const map = page.getByTestId('qidahen-od-map');
const box = await map.boundingBox();
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.6, { steps: 12 });
await page.mouse.up();
await shot('02-ingame-hud-map-panned.png');

await page.goto(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
await page.locator('[data-testid="qidahen-od-sector-2"]').hover({ force: true });
await page.waitForTimeout(200);
await shot('03-ingame-hud-wheel-hover.png');

await page.locator('[data-testid="qidahen-od-grant-pardon"]').hover();
await page.waitForTimeout(200);
await shot('04-ingame-hud-faction-act-hover.png');

await page.getByTestId('qidahen-od-hand-2').click();
await page.waitForTimeout(200);
await shot('05-ingame-hud-hand-selected.png');

const baseline = path.resolve('temp/qidahen-ingame-baseline/01-board-under-setup.png');
if (fs.existsSync(baseline)) {
  fs.copyFileSync(baseline, path.join(compareDir, '00-current-board-under-setup.png'));
  console.log('copied baseline');
}

await browser.close();
console.log('done', outDir);
