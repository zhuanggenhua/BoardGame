import { chromium } from '@playwright/test';
import { mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const evidence = 'test-results/evidence-screenshots/fate-domination/open-design-v7';
const exportsDir = 'artifacts/fate-domination-open-design/exports';
mkdirSync(evidence, { recursive: true });
mkdirSync(exportsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://127.0.0.1:8765/index-v7.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));

const metrics = async (label) => page.evaluate((currentLabel) => {
  const end = document.querySelector('#end');
  const endRect = end.getBoundingClientRect();
  const meta = document.querySelector('.id-meta')?.getBoundingClientRect();
  const skill = document.querySelector('.skill-col')?.getBoundingClientRect();
  const hand = document.querySelector('#hand')?.getBoundingClientRect();
  const slot2 = document.querySelector('#slot-2')?.getBoundingClientRect();
  const broken = [...document.images].filter((img) => !img.naturalWidth).map((img) => img.alt || img.src);
  return {
    label: currentLabel,
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
    imgs: document.images.length,
    broken,
    endText: end?.textContent?.trim(),
    endWrap: endRect.height > 36,
    overlapMetaSkill: meta && skill ? !(meta.right <= skill.left + 1 || skill.right <= meta.left + 1) : null,
    handToSlot: hand && slot2 ? Math.round(slot2.left - hand.right) : null,
    status: document.querySelector('.seats-head')?.textContent?.trim(),
    raised: [...document.querySelectorAll('#hand .is-up')].map((el) => el.dataset.card),
    slot2Filled: Boolean(document.querySelector('#slot-2 .face')),
  };
}, label);

await page.evaluate(() => {
  document.querySelectorAll('#hand .face').forEach((card) => card.classList.remove('is-up'));
});
await page.waitForTimeout(200);
const beforePath = path.join(evidence, '01-行动未抬手.png');
await page.screenshot({ path: beforePath, fullPage: false });
copyFileSync(beforePath, path.join(exportsDir, 'fate-domination-v7-01-idle.png'));
const m1 = await metrics('before');

await page.click('#hand .face[data-card="magic"]');
await page.waitForTimeout(200);
const midPath = path.join(evidence, '02-抬起低位魔术.png');
await page.screenshot({ path: midPath, fullPage: false });
copyFileSync(midPath, path.join(exportsDir, 'fate-domination-v7-desktop.png'));
copyFileSync(midPath, path.join(evidence, 'fate-domination-v7-desktop.png'));
const m2 = await metrics('mid');

await page.click('#slot-2');
await page.waitForTimeout(200);
const afterPath = path.join(evidence, '03-打入第二攻击槽.png');
await page.screenshot({ path: afterPath, fullPage: false });
copyFileSync(afterPath, path.join(exportsDir, 'fate-domination-v7-03-played.png'));
const m3 = await metrics('after');

await browser.close();
console.log(JSON.stringify({ m1, m2, m3 }, null, 2));
