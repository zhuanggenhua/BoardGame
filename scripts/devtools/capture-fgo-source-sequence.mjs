import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const start = Number(process.argv[2] ?? 9);
const end = Number(process.argv[3] ?? 17.7);
const fps = Number(process.argv[4] ?? 30);
if (![start, end, fps].every(Number.isFinite) || start < 0 || end < start || end > 18.5 || fps <= 0) {
  throw new Error('Expected 0 <= start <= end <= 18.5 and fps > 0');
}
const mobile = process.env.FGO_SCENE_VIEWPORT === 'mobile';
const dir = resolve('test-results/evidence-screenshots/fgo-source-scene',
  process.env.FGO_SCENE_SCREENSHOT_SET ?? 'late-sequence');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
const frames = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
});
page.on('response', response => {
  if (response.status() >= 400 && response.url().includes('/assets/dev/fgo-cutscene/')) {
    errors.push(`${response.status()} ${response.url()}`);
  }
});
try {
  await page.goto('http://127.0.0.1:4290/dev/cutscene-three', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FGO_SOURCE_SCENE__), { timeout: 90_000 });
  await page.getByRole('button', { name: '暂停' }).click();
  await page.addStyleTag({ content: 'main header, main footer, main > .pointer-events-none, button[aria-label="设置"] { visibility:hidden!important; }' });
  await page.evaluate(time => window.__FGO_SOURCE_SCENE__.seek(time), start);
  const stage = page.locator('[data-testid="cutscene-three-stage"] > div');
  const count = Math.floor((end - start) * fps + 1e-6) + 1;
  for (let index = 0; index < count; index += 1) {
    const time = start + index / fps;
    await page.evaluate(time => window.__FGO_SOURCE_SCENE__.advanceTo(time), time);
    if (process.env.FGO_SCENE_ISOLATE) {
      await page.evaluate(pattern => window.__FGO_SOURCE_SCENE__.isolateParticles(pattern), process.env.FGO_SCENE_ISOLATE);
    }
    const file = `frame-${String(index).padStart(4, '0')}.png`;
    await stage.screenshot({ path: resolve(dir, file), animations: 'disabled' });
    const snapshot = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot());
    frames.push({ index, time, file, camera: snapshot.camera,
      actors: snapshot.actors.filter(actor => actor.visible).map(actor => actor.name), effects: snapshot.effects });
    if (index % 30 === 0 || index === count - 1) console.log(JSON.stringify({ frame: index, time, count, errors: errors.length }));
  }
  await writeFile(resolve(dir, 'frames.json'), `${JSON.stringify({ fps, start, end, errors, frames }, null, 2)}\n`);
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
