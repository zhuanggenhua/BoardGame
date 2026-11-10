import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const root = path.resolve('artifacts/home-platform-v2-open-design');
const html = pathToFileURL(path.join(root, 'index.html')).href;
const outDir = path.join(root, 'exports');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(20000);

await page.goto(html, { waitUntil: 'networkidle' });
await page.evaluate(() => Promise.all([...document.images].map((img) => (
  img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
))));
await page.waitForTimeout(400);

const shots = [
  { file: '01-全部游戏.png', click: null },
  { file: '02-卡牌分类.png', click: '卡牌' },
  { file: '03-战棋分类.png', click: '战棋' },
];

for (const shot of shots) {
  if (shot.click) {
    await page.getByRole('button', { name: shot.click, exact: true }).click();
    await page.waitForTimeout(250);
  }
  const dest = path.join(outDir, shot.file);
  await page.screenshot({ path: dest, fullPage: false });
  console.log('shot', dest);
}

await browser.close();
