import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(1);
const assets = resolve('public/assets/dev/fgo-characters');
const catalog = JSON.parse(await readFile(resolve(assets, 'catalog.json'), 'utf8'));
const mobile = process.env.FGO_GALLERY_MOBILE === '1';
const dir = resolve('test-results/evidence-screenshots/fgo-gallery', mobile ? 'mobile' : 'desktop');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
const errors = [];
const results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
});
page.on('response', response => {
  if (response.status() >= 400 && response.url().includes('/assets/dev/fgo-')) errors.push(`${response.status()} ${response.url()}`);
});
const waitForCharacter = async id => {
  await page.waitForFunction(id => window.__FGO_CHARACTER__?.id === id || document.querySelector('[role="alert"]'), id, { timeout: 60_000 });
  const alert = await page.getByRole('alert').allTextContents();
  if (alert.length) throw new Error(`${id}: ${alert.join(' ')}`);
};
try {
  await page.goto('http://127.0.0.1:4290/dev/cutscene-three?character=300100&mode=motion');
  await waitForCharacter('300100');
  for (const entry of catalog.characters) {
    await page.getByRole('button', { name: '展开角色抽屉', exact: true }).click();
    await page.getByRole('searchbox', { name: '搜索角色' }).fill(entry.id);
    const choice = page.getByRole('button', { name: /^切换到/ });
    if (await choice.count() !== 1) throw new Error(`${entry.id}: search did not isolate one character`);
    await choice.click();
    if (entry.noblePhantasm) {
      await page.getByRole('combobox', { name: '播放内容' }).selectOption('motion');
    }
    await waitForCharacter(entry.id);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    const canvas = page.locator('[data-testid="cutscene-three-stage"] canvas');
    if (await canvas.count() !== 1) throw new Error(`${entry.id}: overlapping canvases`);
    const image = await canvas.screenshot();
    const stats = (await sharp(image).stats()).channels.slice(0, 3);
    if (stats.every(channel => channel.stdev < 3)) errors.push(`${entry.id}: blank character canvas`);
    await writeFile(resolve(dir, `${entry.id}-idle.png`), image);
    if (!mobile) {
      await sharp(image).trim({ background: '#09090b', threshold: 12 })
        .resize(144, 144, { fit: 'contain', background: '#09090b' }).png()
        .toFile(resolve(assets, entry.id, 'preview.png'));
      entry.thumbnail = `${entry.id}/preview.png`;
    }
    const action = entry.animations.find(clip => clip.name.startsWith('attack'))
      ?? entry.animations.find(clip => clip.name === 'spell') ?? entry.animations.find(clip => clip.name.startsWith('wait')) ?? entry.animations[0];
    const motions = mobile ? [action] : entry.animations;
    for (const clip of motions) {
      await page.getByRole('combobox', { name: '动作', exact: true }).selectOption(clip.name);
      await page.evaluate(time => window.__FGO_CHARACTER__.seek(time), clip.duration * 0.37);
      const snapshot = await page.evaluate(() => window.__FGO_CHARACTER__.snapshot());
      const coordinates = [...snapshot.bounds.min, ...snapshot.bounds.max];
      if (!coordinates.every(Number.isFinite)) errors.push(`${entry.id}/${clip.name}: non-finite posed geometry`);
      if (snapshot.animation !== clip.name) errors.push(`${entry.id}/${clip.name}: action did not switch`);
    }
    const attack = action;
    await page.getByRole('combobox', { name: '动作', exact: true }).selectOption(attack.name);
    await page.evaluate(time => window.__FGO_CHARACTER__.seek(time), attack.duration * 0.37);
    const attackImage = await canvas.screenshot();
    await writeFile(resolve(dir, `${entry.id}-attack.png`), attackImage);
    const attackStats = (await sharp(attackImage).stats()).channels.slice(0, 3);
    if (attackStats.every(channel => channel.stdev < 3)) errors.push(`${entry.id}: blank attack canvas`);
    for (const level of entry.evolutions) {
      await page.getByRole('combobox', { name: '形态' }).selectOption(`${level}`);
      const snapshot = await page.evaluate(() => window.__FGO_CHARACTER__.snapshot());
      if (snapshot.evolution !== level) errors.push(`${entry.id}: form ${level} did not switch`);
      if (![...snapshot.bounds.min, ...snapshot.bounds.max].every(Number.isFinite)) errors.push(`${entry.id}: invalid form ${level} geometry`);
    }
    results.push({ id: entry.id, motions: motions.length, forms: entry.evolutions.length, errors: errors.length });
    console.log(JSON.stringify(results.at(-1)));
  }
  await page.getByRole('button', { name: '展开角色抽屉', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索角色' }).fill('not-a-character');
  if (await page.getByRole('button', { name: /^切换到/ }).count()) errors.push('Search empty state failed');
  await page.getByRole('searchbox', { name: '搜索角色' }).fill('');
  await page.getByRole('combobox', { name: '分类', exact: true }).selectOption('从者');
  if (await page.getByRole('button', { name: /^切换到/ }).count() !== catalog.characters.filter(entry => entry.category === '从者').length) {
    errors.push('Category filter did not change the role collection');
  }
  await page.screenshot({ path: resolve(dir, 'drawer-filter.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '展开角色抽屉', exact: true }).waitFor();
  await page.screenshot({ path: resolve(dir, 'player.png') });
  await page.getByRole('checkbox', { name: '循环', exact: true }).uncheck();
  const duration = await page.evaluate(() => window.__FGO_CHARACTER__.snapshot().duration);
  await page.evaluate(time => window.__FGO_CHARACTER__.seek(time - 0.05), duration);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => !window.__FGO_CHARACTER__.snapshot().playing);
  const ended = await page.evaluate(() => window.__FGO_CHARACTER__.snapshot());
  if (Math.abs(ended.time - duration) > 0.001) errors.push('Non-loop playback did not stop at the end');
  await page.getByRole('button', { name: '重播', exact: true }).click();
  await page.waitForFunction(() => window.__FGO_CHARACTER__.snapshot().time > 0.03);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const paused = await page.evaluate(() => window.__FGO_CHARACTER__.snapshot().time);
  await page.waitForTimeout(150);
  if (await page.evaluate(() => window.__FGO_CHARACTER__.snapshot().time) !== paused) errors.push('Pause did not stop playback');
  const beforeRotate = await canvasSnapshot();
  await page.getByRole('button', { name: '向左旋转', exact: true }).click();
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  if (!(await canvasSnapshot()).equals(beforeRotate)) errors.push('Reset view did not restore the same frame');
  if (!mobile) await writeFile(resolve(assets, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
} finally {
  await writeFile(resolve(dir, 'report.json'), `${JSON.stringify({ results, errors }, null, 2)}\n`);
  await browser.close();
}
console.log(JSON.stringify({ characters: results.length, motions: results.reduce((count, row) => count + row.motions, 0), errors }));
if (errors.length) process.exitCode = 1;

async function canvasSnapshot() {
  return sharp(await page.locator('[data-testid="cutscene-three-stage"] canvas').screenshot()).raw().toBuffer();
}
