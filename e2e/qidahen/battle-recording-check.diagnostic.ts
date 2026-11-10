import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { disableAudio, setChineseLocale } from '../helpers/common';
import { encodeLocalMatchSnapshot } from '../../src/engine/transport/localSessionCodec';
import { beginBattleRecording } from './battleRecording';
import { qidahenTutorialProgressIdentity } from './tutorialPersistence';
import { QIDAHEN_VISUAL_SOURCE_PATHS, requireCompleteQidahenSourceIdentity, trackQidahenSourceIdentity } from './sourceIdentity';

test.use({ channel: 'chromium', launchOptions: { args: [] } });

test('合法战斗检查点记录真实骰子阶段', async ({ page }) => {
    test.setTimeout(180_000);
    const checkpoint = process.env.QIDAHEN_LAYOUT_CHECKPOINT_PATH;
    const directory = process.env.QIDAHEN_RECORDING_CHECK_DIR;
    if (!checkpoint || !directory) throw new Error('Recording check requires a current checkpoint and output directory');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const identity = trackQidahenSourceIdentity(page, 'e2e/qidahen/battle-recording-check.diagnostic.ts',
        ['e2e/qidahen/sourceIdentity.ts', 'e2e/qidahen/battleRecording.ts', checkpoint], QIDAHEN_VISUAL_SOURCE_PATHS);
    await setChineseLocale(page); await disableAudio(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const encoded = encodeLocalMatchSnapshot(JSON.parse(readFileSync(checkpoint, 'utf8')));
    await page.addInitScript(({ encoded, seed }) => {
        (window as any).__E2E_TEST_MODE__ = true;
        localStorage.setItem(`local_match_snapshot_v1:qidahen:${seed}`, encoded);
    }, { encoded, seed: qidahenTutorialProgressIdentity.seed });
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '从上次继续', exact: true }).click({ timeout: 90_000 });
    await expect(page.locator('[data-tutorial-step="battle-roll"]')).toBeVisible({ timeout: 60_000 });
    const target = resolve(directory); mkdirSync(target, { recursive: true });
    const finish = await beginBattleRecording(page, target, 'representative-state');
    await page.getByTestId('qidahen-resolve-pending-action').click();
    await expect(page.getByTestId('qidahen-battle-roll-overlay')).toBeVisible({ timeout: 60_000 });
    const geometry = await page.evaluate(() => ({
        groups: [...document.querySelectorAll('[data-testid^="qidahen-army-group-"]')].map(node => ({ id: node.getAttribute('data-testid'), rect: node.getBoundingClientRect().toJSON(), panel: node.querySelector('rect')?.getBoundingClientRect().toJSON() })),
        hud: [...document.querySelectorAll('[data-testid="qidahen-player-float"]')].map(node => node.getBoundingClientRect().toJSON()),
        dice: document.querySelector('[data-testid="qidahen-battle-roll-overlay"]')?.getBoundingClientRect().toJSON(),
        map: document.querySelector('[data-testid="qidahen-map-content"]')?.getBoundingClientRect().toJSON(),
        mapLayer: document.querySelector('[data-testid="qidahen-map-layer"]')?.getBoundingClientRect().toJSON(),
        battleRegions: [...document.querySelectorAll('[data-qidahen-battle-region-space]')].map(node => ({ id: node.getAttribute('data-qidahen-battle-region-space'), rect: node.getBoundingClientRect().toJSON() })),
        battleTokens: [...document.querySelectorAll('[data-qidahen-map-token-region]')].filter(node => ['city-region-15', 'city-region-7'].includes(node.getAttribute('data-qidahen-map-token-region') ?? '')).map(node => ({ id: node.getAttribute('data-testid'), region: node.getAttribute('data-qidahen-map-token-region'), rect: node.getBoundingClientRect().toJSON() })),
        visibleMapObjects: [...document.querySelectorAll('[data-qidahen-map-token-region], [data-qidahen-map-population-region]')].map(node => ({ id: node.getAttribute('data-testid'), region: node.getAttribute('data-qidahen-map-token-region') ?? node.getAttribute('data-qidahen-map-population-region'), text: node.textContent?.trim(), rect: node.getBoundingClientRect().toJSON() })).filter(item => item.rect.right > 0 && item.rect.left < innerWidth && item.rect.bottom > 0 && item.rect.top < innerHeight),
        screen: { width: innerWidth, height: innerHeight },
    }));
    writeFileSync(resolve(target, 'battle-geometry.json'), JSON.stringify(geometry, null, 2));
    expect(geometry.map, '战斗地图应存在').toBeTruthy();
    expect(geometry.map!.left, '战斗取景不得露出左侧地图外空白').toBeLessThanOrEqual(0.5);
    expect(geometry.map!.top, '战斗取景不得露出顶部地图外空白').toBeLessThanOrEqual(0.5);
    expect(geometry.map!.right, '战斗取景不得露出右侧地图外空白').toBeGreaterThanOrEqual(geometry.screen.width - 0.5);
    expect(geometry.map!.bottom, '战斗取景不得露出底部地图外空白').toBeGreaterThanOrEqual(geometry.screen.height - 0.5);
    const nearbyPopulation = geometry.visibleMapObjects.find(item => item.id === 'qidahen-map-population-city-region-4');
    expect(nearbyPopulation, '战场附近的人口标记必须存在').toBeTruthy();
    const populationRect = nearbyPopulation!.rect, diceRect = geometry.dice!;
    expect(diceRect.right <= populationRect.left || diceRect.left >= populationRect.right
        || diceRect.bottom <= populationRect.top || diceRect.top >= populationRect.bottom,
    '骰子活动区不得遮住附近人口标记').toBe(true);
    for (const region of ['city-region-15', 'city-region-7']) {
        const troops = geometry.battleTokens.filter(item => item.region === region);
        expect(troops.length, '双方实际参战区域的部队必须可见').toBeGreaterThan(0);
        for (const troop of troops) {
            const rect = troop.rect;
            expect(rect.left).toBeGreaterThanOrEqual(0);
            expect(rect.top).toBeGreaterThanOrEqual(0);
            expect(rect.right).toBeLessThanOrEqual(geometry.screen.width);
            expect(rect.bottom).toBeLessThanOrEqual(geometry.screen.height);
            for (const hud of geometry.hud) expect(rect.right <= hud.left || rect.left >= hud.right
                || rect.bottom <= hud.top || rect.top >= hud.bottom, '当前战斗部队不得被顶部阵营栏遮挡').toBe(true);
        }
    }
    await expect(page.getByTestId('qidahen-battle-roll-sequence')).toHaveCount(0, { timeout: 90_000 });
    await expect(page.getByTestId('qidahen-post-battle-selection')).toBeVisible({ timeout: 30_000 });
    expect(errors, '战斗结束进入战后决策不得出现渲染错误').toEqual([]);
    const recording = await finish();
    const sourceIdentity = requireCompleteQidahenSourceIdentity(await identity());
    writeFileSync(resolve(target, 'result.json'), JSON.stringify({ status: 'PASS', flow: 'representative-state', sourceIdentity,
        frameCount: recording.frameCount, durationSeconds: recording.durationSeconds }, null, 2));
});
