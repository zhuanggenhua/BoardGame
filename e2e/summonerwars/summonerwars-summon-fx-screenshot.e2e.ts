import { writeFileSync } from 'node:fs';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { clickBoardElement } from '../helpers/summonerwars';
import type { SummonerWarsCore } from '../../src/games/summonerwars/domain/types';
import { createInitializedCore, resetInstanceCounter } from '../../src/games/summonerwars/__tests__/test-helpers';
import { COMMON_UNITS as NECROMANCER_COMMON_UNITS } from '../../src/games/summonerwars/config/factions/necromancer';

const deterministicRandom = {
  shuffle: <T>(arr: T[]) => [...arr],
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
};

function buildSummonFxCore(): SummonerWarsCore {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'necromancer',
    faction1: 'trickster',
  });

  const player = core.players['0'];
  const summonCard = {
    ...NECROMANCER_COMMON_UNITS.find((card) => card.id === 'necro-plague-zombie')!,
    id: 'necro-plague-zombie-fx-e2e',
  };

  player.hand = [summonCard];
  player.deck = player.deck.filter((card) => card.cardType !== 'unit');
  player.magic = Math.max(10, Number(player.magic ?? 0));
  core.currentPlayer = '0';
  core.phase = 'summon';
  core.selectedUnit = undefined;
  return core;
}

type SummonFxMetrics = {
  activeCues: string | null;
  activeCount: string | null;
  fxLayerCanvasCount: number;
  fixedDimmingOverlayCount: number;
  cellRect: { left: number; top: number; width: number; height: number } | null;
  unitRect: { left: number; top: number; width: number; height: number } | null;
  canvasRect: { left: number; top: number; width: number; height: number } | null;
  visiblePixelBox: { x: number; y: number; width: number; height: number } | null;
  visiblePixelBoxToCell: { widthRatio: number; heightRatio: number } | null;
};

async function readSummonFxMetrics(page: import('@playwright/test').Page, row: string, col: string): Promise<SummonFxMetrics> {
  return page.evaluate(({ row, col }) => {
    const toRect = (rect: DOMRect | null) => rect
      ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      : null;
    const cell = document.querySelector(`[data-testid="sw-cell-${row}-${col}"]`) as HTMLElement | null;
    const unit = document.querySelector(`[data-testid="sw-unit-${row}-${col}"]`) as HTMLElement | null;
    const fxLayer = Array
      .from(document.querySelectorAll<HTMLElement>('[data-fx-active-cues]'))
      .find((element) => (element.getAttribute('data-fx-active-cues') ?? '').includes('fx.summon')) ?? null;
    const canvases = fxLayer ? Array.from(fxLayer.querySelectorAll('canvas')) : [];
    const canvas = canvases[0] ?? null;
    const cellRect = cell?.getBoundingClientRect() ?? null;
    const canvasRect = canvas?.getBoundingClientRect() ?? null;
    const fixedDimmingOverlayCount = Array
      .from(document.body.querySelectorAll<HTMLElement>('div'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.position === 'fixed'
          && style.inset === '0px'
          && (element.style.background || '').includes('radial-gradient')
          && Number(style.zIndex) === 15;
      }).length;

    let visiblePixelBox: SummonFxMetrics['visiblePixelBox'] = null;
    let visiblePixelBoxToCell: SummonFxMetrics['visiblePixelBoxToCell'] = null;
    if (canvas && cellRect && canvasRect) {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context && canvas.width > 0 && canvas.height > 0) {
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const index = (y * canvas.width + x) * 4;
            const alpha = data[index + 3];
            const brightness = data[index] + data[index + 1] + data[index + 2];
            if (alpha > 20 && brightness > 80) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX >= minX && maxY >= minY) {
          const cssX = (minX / canvas.width) * canvasRect.width;
          const cssY = (minY / canvas.height) * canvasRect.height;
          const cssWidth = ((maxX - minX + 1) / canvas.width) * canvasRect.width;
          const cssHeight = ((maxY - minY + 1) / canvas.height) * canvasRect.height;
          visiblePixelBox = {
            x: Math.round(canvasRect.left + cssX),
            y: Math.round(canvasRect.top + cssY),
            width: Math.round(cssWidth),
            height: Math.round(cssHeight),
          };
          visiblePixelBoxToCell = {
            widthRatio: Number((cssWidth / cellRect.width).toFixed(2)),
            heightRatio: Number((cssHeight / cellRect.height).toFixed(2)),
          };
        }
      }
    }

    return {
      activeCues: fxLayer?.getAttribute('data-fx-active-cues') ?? null,
      activeCount: fxLayer?.getAttribute('data-fx-active-count') ?? null,
      fxLayerCanvasCount: canvases.length,
      fixedDimmingOverlayCount,
      cellRect: toRect(cellRect),
      unitRect: toRect(unit?.getBoundingClientRect() ?? null),
      canvasRect: toRect(canvasRect),
      visiblePixelBox,
      visiblePixelBoxToCell,
    };
  }, { row, col });
}

test('召唤特效过程帧应贴近目标格且不回到混合大特效', async ({ page, game }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('audio_sfx_volume', '0');
    localStorage.setItem('audio_music_volume', '0');
  });

  await game.openTestGame('summonerwars');
  const core = buildSummonFxCore();
  await game.setupScene({
    gameId: 'summonerwars',
    currentPlayer: core.currentPlayer,
    phase: core.phase,
    extra: { core },
  });

  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByTestId('sw-action-banner')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout: 15_000 });

  const unitCard = page.getByTestId('sw-hand-area')
    .locator('[data-card-type="unit"][data-can-play="true"]')
    .first();
  await expect(unitCard).toBeVisible({ timeout: 10_000 });
  await unitCard.click();
  await expect(page.locator('[data-testid="sw-hand-area"] [data-selected="true"]')).toHaveCount(1, { timeout: 5_000 });

  const summonCell = page.locator('[data-valid-summon="true"]').first();
  await expect(summonCell).toBeVisible({ timeout: 10_000 });
  const row = await summonCell.getAttribute('data-row');
  const col = await summonCell.getAttribute('data-col');
  if (!row || !col) {
    throw new Error('无法读取召唤目标格坐标');
  }

  const beforePath = getEvidenceScreenshotPath(testInfo, '召唤前-选中单位和合法召唤格', {
    filename: '召唤前-选中单位和合法召唤格.jpg',
    requireChineseName: true,
  });
  await page.screenshot({ path: beforePath, fullPage: false });

  await clickBoardElement(page, `[data-testid="sw-cell-${row}-${col}"]`);
  await expect(page.getByTestId(`sw-unit-${row}-${col}`)).toBeVisible({ timeout: 8_000 });
  await expect.poll(async () => {
    const layer = page.locator('[data-fx-active-cues*="fx.summon"]').first();
    return layer.getAttribute('data-fx-active-cues').catch(() => null);
  }, { timeout: 2_000 }).toContain('fx.summon');

  await page.waitForTimeout(120);
  const impactPath = getEvidenceScreenshotPath(testInfo, '召唤特效-爆发过程帧', {
    filename: '召唤特效-爆发过程帧.jpg',
    requireChineseName: true,
  });
  await page.screenshot({ path: impactPath, fullPage: false });
  const impactMetrics = await readSummonFxMetrics(page, row, col);

  await page.waitForTimeout(140);
  const sustainPath = getEvidenceScreenshotPath(testInfo, '召唤特效-持续过程帧', {
    filename: '召唤特效-持续过程帧.jpg',
    requireChineseName: true,
  });
  await page.screenshot({ path: sustainPath, fullPage: false });
  const sustainMetrics = await readSummonFxMetrics(page, row, col);

  expect(impactMetrics.activeCues).toContain('fx.summon');
  expect(impactMetrics.fxLayerCanvasCount).toBe(1);
  expect(impactMetrics.fixedDimmingOverlayCount).toBe(0);
  expect(impactMetrics.visiblePixelBox, '召唤爆发过程帧应有可见 Canvas 像素').not.toBeNull();
  expect(impactMetrics.visiblePixelBoxToCell?.widthRatio ?? 99).toBeLessThanOrEqual(4.2);
  expect(impactMetrics.visiblePixelBoxToCell?.heightRatio ?? 99).toBeLessThanOrEqual(4.2);

  const diagnosticsPath = testInfo.outputPath('summonerwars-summon-fx-screenshot-diagnostics.json');
  const diagnostics = {
    screenshotPaths: {
      before: beforePath,
      impact: impactPath,
      sustain: sustainPath,
    },
    targetCell: { row, col },
    impactMetrics,
    sustainMetrics,
  };
  writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf8');
  console.log('[SW_SUMMON_FX_SCREENSHOT]', JSON.stringify(diagnostics));
});
