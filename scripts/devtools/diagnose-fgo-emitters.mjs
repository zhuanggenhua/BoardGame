import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const time = Number(process.argv[2] ?? 12.1);
const patterns = process.argv.slice(3);
const dir = resolve('test-results/evidence-screenshots/fgo-source-scene/emitter-isolation');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const pattern of patterns) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4290/dev/cutscene-three');
    await page.waitForFunction(() => Boolean(window.__FGO_SOURCE_SCENE__), { timeout: 90_000 });
    await page.getByRole('button', { name: '暂停' }).click();
    await page.evaluate(value => window.__FGO_SOURCE_SCENE__.seek(value), time);
    await page.evaluate(value => window.__FGO_SOURCE_SCENE__.isolateParticles(value), pattern);
    const filename = `${time.toFixed(3)}-${pattern.replace(/[^a-z0-9_-]/gi, '_')}.png`;
    await page.screenshot({ path: resolve(dir, filename) });
    console.log(JSON.stringify({ pattern, errors, screenshot: filename }));
    if (errors.length) process.exitCode = 1;
    await page.close();
  }
} finally {
  await browser.close();
}
