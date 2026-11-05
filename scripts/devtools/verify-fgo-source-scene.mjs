import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(1);

const times = process.argv.slice(2).map(Number);
const samples = times.length ? times : [0, 0.5, 0.953, 1.5, 2, 4, 9.1, 13.5, 16.5];
const dir = resolve('test-results/evidence-screenshots/fgo-source-scene', process.env.FGO_SCENE_SCREENSHOT_SET ?? '');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const mobile = process.env.FGO_SCENE_VIEWPORT === 'mobile';
const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
const warnings = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() !== 'error') return;
  if (message.text().startsWith('Failed to load resource:')) warnings.push(message.text());
  else errors.push(message.text());
});
page.on('response', response => {
  if (response.status() < 500) return;
  const record = `${response.status()} ${response.url()}`;
  if (response.url().includes('/auth/refresh')) warnings.push(record);
  else errors.push(record);
});
try {
  await page.goto(`http://127.0.0.1:4290/dev/cutscene-three${process.env.FGO_SCENE_QUERY ?? ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FGO_SOURCE_SCENE__), { timeout: 90_000 });
  await page.getByRole('button', { name: '暂停' }).click();
  for (const time of samples) {
    await page.evaluate(value => window.__FGO_SOURCE_SCENE__.seek(value), time);
    await page.screenshot({ path: resolve(dir, `frame-${time.toFixed(3)}.png`) });
    if (time >= 0.9 && time < 17) {
      const canvas = await page.locator('[data-testid="cutscene-three-stage"] canvas').first().screenshot();
      const channels = (await sharp(canvas).stats()).channels.slice(0, 3);
      if (channels.every(channel => channel.stdev < 5)) errors.push(`Blank canvas at ${time.toFixed(3)}s`);
    }
    const snapshot = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot());
    console.log(JSON.stringify({ time: snapshot.time, background: snapshot.background, camera: snapshot.camera,
      heroVisible: snapshot.heroVisible, actors: snapshot.actors.map(actor => ({ name: actor.name, visible: actor.visible })),
      effects: snapshot.effects.map(effect => ({ name: effect.name, particles: effect.particles })) }));
  }
  await page.evaluate(() => window.__FGO_SOURCE_SCENE__.seek(16.5));
  await page.evaluate(() => window.__FGO_SOURCE_SCENE__.seek(0.953));
  const reset = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot());
  if (!reset.heroVisible || reset.effects.length) errors.push('Seek backward retained stale actor/effects');
  await page.getByRole('button', { name: '重播' }).click();
  await page.waitForFunction(() => window.__FGO_SOURCE_SCENE__.snapshot().time > 0.04);
  await page.getByRole('button', { name: '暂停' }).click();
  const paused = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot().time);
  await page.waitForTimeout(120);
  const afterPause = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot().time);
  if (Math.abs(paused - afterPause) > 0.02) errors.push('Pause did not stop the timeline');
  await page.getByRole('button', { name: '播放' }).click();
  await page.waitForFunction(value => window.__FGO_SOURCE_SCENE__.snapshot().time > value + 0.04, paused);
  if (process.env.FGO_SCENE_COMPARE_PLAYBACK === '1') {
    await page.getByRole('button', { name: '1x', exact: true }).click();
    await page.getByRole('button', { name: '重播' }).click();
    for (const target of [1.9, 9.1, 13.5]) {
      await page.waitForFunction(value => window.__FGO_SOURCE_SCENE__.snapshot().time >= value, target, { timeout: 90_000 });
      await page.getByRole('button', { name: '暂停' }).click();
      const natural = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot());
      const canvas = page.locator('[data-testid="cutscene-three-stage"] canvas').first();
      const playedPixels = await sharp(await canvas.screenshot()).raw().toBuffer();
      await page.evaluate(value => window.__FGO_SOURCE_SCENE__.seek(value), natural.time);
      const sought = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot());
      const soughtPixels = await sharp(await canvas.screenshot()).raw().toBuffer();
      const sameState = JSON.stringify(natural) === JSON.stringify(sought);
      const samePixels = playedPixels.equals(soughtPixels);
      console.log(JSON.stringify({ playbackComparison: natural.time, sameState, samePixels }));
      if (!sameState || !samePixels) errors.push(`Playback/seek mismatch at ${natural.time}`);
      await page.getByRole('button', { name: '播放' }).click();
    }
  }
  if (process.env.FGO_SCENE_COMPLETE_PLAYBACK === '1') {
    await page.waitForFunction(() => window.__FGO_SOURCE_SCENE__.snapshot().time >= 18.5, undefined, { timeout: 120_000 });
    await page.getByRole('button', { name: '播放', exact: true }).waitFor();
    const end = await page.evaluate(() => window.__FGO_SOURCE_SCENE__.snapshot());
    if (end.effects.length || end.heroVisible || end.actors.some(actor => actor.visible)) {
      errors.push('Completed playback retained actors/effects');
    }
    console.log(JSON.stringify({ completedPlayback: end.time, effects: end.effects.length }));
  }
  console.log(JSON.stringify({ errors, warnings }));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
