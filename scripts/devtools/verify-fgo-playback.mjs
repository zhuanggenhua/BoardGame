import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = 'test-results/evidence-screenshots/fgo-playback-clock';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4289/dev/cutscene-three?fgoWeaponDebug=1');
  await page.waitForFunction(() => window.__FGO_CUTSCENE_DEBUG__);
  const seek = async time => {
    await page.evaluate(t => window.__FGO_CUTSCENE_DEBUG__.seek(t), time);
    await page.waitForTimeout(100);
  };
  const snapshot = () => page.evaluate(() => {
    const { seek: ignored, ...state } = window.__FGO_CUTSCENE_DEBUG__;
    return state;
  });
  await seek(4);
  const frozen = await snapshot();
  await page.waitForTimeout(1000);
  assert.deepEqual(await snapshot(), frozen, 'Paused particles must not advance');
  await seek(0.953);
  const opening = await snapshot();
  assert.equal(opening.animStartTime, 0.583605170249939);
  const openingBody = opening.heroMeshStats?.find(mesh => mesh.name === 'body_level_1');
  assert.ok(openingBody && openingBody.minY > -500, 'Opening skeleton must not stretch between sampled poses');
  await page.screenshot({ path: `${output}/opening-0.953.png` });
  await seek(16.5);
  await page.screenshot({ path: `${output}/late-16.5.png` });
  await seek(0.953);
  assert.deepEqual(await snapshot(), opening, 'Backward seek must reset all visible state');
  await seek(0);
  await page.getByRole('button', { name: '1x', exact: true }).click();
  await page.getByRole('button', { name: '\u64ad\u653e', exact: true }).click();
  await page.waitForFunction(() => window.__FGO_CUTSCENE_DEBUG__.time >= 4);
  await page.getByRole('button', { name: '\u6682\u505c', exact: true }).click();
  const played = await snapshot();
  await seek(played.time);
  const sought = await snapshot();
  assert.equal(sought.currentAnim, played.currentAnim);
  assert.equal(sought.animStartTime, played.animStartTime);
  assert.deepEqual(sought.activeEffectRoots, played.activeEffectRoots);
  // Compare particle state numerically; timestamp accumulation can differ by ulps.
  const rounded = value => JSON.parse(JSON.stringify(value, (_, item) => (
    typeof item === 'number' ? Math.round(item * 1e5) / 1e5 : item
  )));
  assert.deepEqual(rounded(sought.activeEffectStats), rounded(played.activeEffectStats));
  await seek(18.5);
  assert.equal((await snapshot()).time, 18.5);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/result.json`, JSON.stringify({
    pausedParticlesStable: true, backwardSeekStable: true,
    playbackMatchesSeek: true, duration: 18.5,
    visualEquivalenceToOriginal: 'not verified',
  }, null, 2));
  console.log('Playback clock checks passed; visual equivalence is not asserted.');
} finally {
  await browser.close();
}
