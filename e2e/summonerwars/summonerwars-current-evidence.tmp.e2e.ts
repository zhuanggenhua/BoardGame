import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import {
  clearEvidenceScreenshotsForTest,
  getEvidenceScreenshotPath,
} from '../framework/evidenceScreenshots';
import type { GamePhase, SummonerWarsCore } from '../../src/games/summonerwars/domain/types';
import { createInitializedCore, resetInstanceCounter } from '../../src/games/summonerwars/__tests__/test-helpers';
import { isUndeadCard } from '../../src/games/summonerwars/domain/ids';

const deterministicRandom = {
  shuffle: <T>(arr: T[]) => [...arr],
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
};

const findSummonerPosition = (core: SummonerWarsCore, playerId: '0' | '1') => {
  for (let row = 0; row < core.board.length; row += 1) {
    for (let col = 0; col < core.board[row].length; col += 1) {
      const unit = core.board[row][col]?.unit;
      if (unit && unit.owner === playerId && unit.card.unitClass === 'summoner') {
        return { row, col };
      }
    }
  }
  throw new Error(`未找到玩家 ${playerId} 的召唤师`);
};

const buildNecromancerSummonCore = (): SummonerWarsCore => {
  resetInstanceCounter();
  const core = createInitializedCore(['0', '1'], deterministicRandom, {
    faction0: 'necromancer',
    faction1: 'trickster',
  });

  core.currentPlayer = '0';
  core.phase = 'summon' satisfies Extract<GamePhase, 'summon'>;
  core.selectedUnit = undefined;
  core.abilityUsageCount = {};
  const discardUndeadIndex = core.players['0'].deck.findIndex(card => card.cardType === 'unit' && isUndeadCard(card));
  if (discardUndeadIndex < 0) {
    throw new Error('未找到可放入弃牌堆的亡灵单位，无法证明复活死灵处于可用状态');
  }
  const [discardUndead] = core.players['0'].deck.splice(discardUndeadIndex, 1);
  core.players['0'].discard = [{ ...discardUndead, id: `${discardUndead.id}-discard-evidence` }];
  return core;
};

type RectSnapshot = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type BoardUnitEvidence = {
  targetSelector: string;
  unitName: string | null;
  unitClass: string | null;
  owner: string | null;
  cellSelected: string | null;
  unitRect: RectSnapshot | null;
  mapRect: RectSnapshot | null;
  handRect: RectSnapshot | null;
  unitInsideMapDom: boolean;
  unitCenterInsideMap: boolean;
  unitCenterForegroundInsideUnit: boolean;
  unitInsideHandDom: boolean;
  unitOverlapsHand: boolean;
  unitClearOfHand: boolean;
  foregroundHitSampleCount: number;
  foregroundHitSamples: Array<{
    label: string;
    x: number;
    y: number;
    insideUnit: boolean;
    topTestId: string | null;
  }>;
  readyIndicatorCount: number;
  readyIndicatorRect: RectSnapshot | null;
  readyIndicatorForegroundHit: boolean;
  maxReadyRippleOpacity: number;
  readyRippleVisible: boolean;
};

type IndicatorFrameSample = {
  index: number;
  opacity: number;
  transform: string;
  rect: RectSnapshot | null;
  borderColor: string;
  borderStyle: string;
  borderTopWidth: string;
  display: string;
  visibility: string;
  zIndex: string;
  boxShadow: string;
  parentOpacity: string;
  parentZIndex: string;
  parentOverflow: string;
  ancestorChain: Array<{
    tagName: string;
    testId: string | null;
    className: string;
    position: string;
    zIndex: string;
    opacity: string;
    overflow: string;
  }>;
};

type PixelDifference = {
  dimensionsMatch: boolean;
  width: number;
  height: number;
  totalPixels: number;
  changedPixels: number;
  changedPixelRatio: number;
  perimeterPixels: number;
  perimeterChangedPixels: number;
  perimeterChangedPixelRatio: number;
  meanAbsDiff: number;
  meanPerimeterAbsDiff: number;
  mismatch?: {
    previous: { width: number; height: number };
    current: { width: number; height: number };
  };
};

type AbilityReadySequenceFrame = {
  index: number;
  elapsedMs: number;
  fullBoardPath: string;
  targetUnitCropPath: string;
  prefersReducedMotion: boolean;
  indicatorCount: number;
  indicators: IndicatorFrameSample[];
  maxOpacity: number;
  minOpacity: number;
  opacitySpread: number;
  maxIndicatorWidth: number;
  minIndicatorWidth: number;
  widthSpread: number;
  maxIndicatorHeight: number;
  minIndicatorHeight: number;
  heightSpread: number;
  staticGlowBoxShadow: string | null;
  pixelDifferenceFromPrevious: PixelDifference | null;
};

type AbilityReadySequenceSummary = {
  frameCount: number;
  intervalMs: number;
  durationMs: number;
  opacityRange: number;
  indicatorWidthRange: number;
  indicatorHeightRange: number;
  uniqueTransformCount: number;
  maxChangedPixelRatio: number;
  maxPerimeterChangedPixelRatio: number;
  maxMeanAbsDiff: number;
  maxMeanPerimeterAbsDiff: number;
  framesWithPerimeterChangeOverOnePercent: number;
  framesWithPerimeterChangeOverThreePercent: number;
  prefersReducedMotion: boolean;
  staticGlowUniqueCount: number;
  domAnimationDetected: boolean;
  cropMotionDetected: boolean;
  diagnosticVerdict: 'dynamic-breathing-visible-candidate' | 'static-highlight-like-candidate';
};

const readBoardUnitEvidence = async (
  page: Page,
  row: number,
  col: number,
): Promise<BoardUnitEvidence> => page.evaluate(({ row, col }) => {
  const rectToSnapshot = (rect: DOMRect | null): RectSnapshot | null => rect
    ? {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }
    : null;
  const intersects = (a: DOMRect | null, b: DOMRect | null): boolean => Boolean(
    a
    && b
    && a.right > b.left
    && a.left < b.right
    && a.bottom > b.top
    && a.top < b.bottom,
  );

  const targetSelector = `[data-testid="sw-unit-${row}-${col}"]`;
  const unit = document.querySelector(targetSelector) as HTMLElement | null;
  const cell = document.querySelector(`[data-testid="sw-cell-${row}-${col}"]`) as HTMLElement | null;
  const map = document.querySelector('[data-testid="sw-map-container"]') as HTMLElement | null;
  const hand = document.querySelector('[data-testid="sw-hand-area"]') as HTMLElement | null;
  const indicators = unit ? Array.from(unit.querySelectorAll<HTMLElement>('.border-cyan-300')) : [];
  const readyIndicator = indicators[0] ?? null;
  const unitRect = unit?.getBoundingClientRect() ?? null;
  const mapRect = map?.getBoundingClientRect() ?? null;
  const handRect = hand?.getBoundingClientRect() ?? null;
  const readyIndicatorRect = readyIndicator?.getBoundingClientRect() ?? null;
  const centerX = unitRect ? unitRect.left + unitRect.width / 2 : 0;
  const centerY = unitRect ? unitRect.top + unitRect.height / 2 : 0;
  const centerElement = unitRect ? document.elementFromPoint(centerX, centerY) : null;
  const sampleSpecs = [
    ['center', 0.5, 0.5],
    ['upper', 0.5, 0.25],
    ['lower', 0.5, 0.75],
    ['left', 0.25, 0.5],
    ['right', 0.75, 0.5],
  ] as const;
  const foregroundHitSamples = unitRect
    ? sampleSpecs.map(([label, xRatio, yRatio]) => {
      const x = unitRect.left + unitRect.width * xRatio;
      const y = unitRect.top + unitRect.height * yRatio;
      const topElement = document.elementFromPoint(x, y) as HTMLElement | null;
      return {
        label,
        x: Math.round(x),
        y: Math.round(y),
        insideUnit: Boolean(unit && topElement && unit.contains(topElement)),
        topTestId: topElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
      };
    })
    : [];
  const foregroundHitSampleCount = foregroundHitSamples.filter((sample) => sample.insideUnit).length;
  const readyCenterElement = readyIndicatorRect
    ? document.elementFromPoint(
      readyIndicatorRect.left + readyIndicatorRect.width / 2,
      readyIndicatorRect.top + readyIndicatorRect.height / 2,
    )
    : null;
  const unitCenterInsideMap = Boolean(
    unitRect
    && mapRect
    && centerX >= mapRect.left
    && centerX <= mapRect.right
    && centerY >= mapRect.top
    && centerY <= mapRect.bottom,
  );
  const maxReadyRippleOpacity = indicators.reduce((max, element) => {
    const opacity = Number.parseFloat(window.getComputedStyle(element).opacity || '0');
    return Math.max(max, Number.isFinite(opacity) ? opacity : 0);
  }, 0);

  return {
    targetSelector,
    unitName: unit?.getAttribute('data-unit-name') ?? null,
    unitClass: unit?.getAttribute('data-unit-class') ?? null,
    owner: unit?.getAttribute('data-owner') ?? null,
    cellSelected: cell?.getAttribute('data-selected') ?? null,
    unitRect: rectToSnapshot(unitRect),
    mapRect: rectToSnapshot(mapRect),
    handRect: rectToSnapshot(handRect),
    unitInsideMapDom: Boolean(unit && map && map.contains(unit)),
    unitCenterInsideMap,
    unitCenterForegroundInsideUnit: Boolean(unit && centerElement && unit.contains(centerElement)),
    unitInsideHandDom: Boolean(unit && hand && hand.contains(unit)),
    unitOverlapsHand: intersects(unitRect, handRect),
    unitClearOfHand: Boolean(unitRect && handRect && unitRect.bottom <= handRect.top - 12),
    foregroundHitSampleCount,
    foregroundHitSamples,
    readyIndicatorCount: indicators.length,
    readyIndicatorRect: rectToSnapshot(readyIndicatorRect),
    readyIndicatorForegroundHit: Boolean(unit && readyCenterElement && unit.contains(readyCenterElement)),
    maxReadyRippleOpacity: Number(maxReadyRippleOpacity.toFixed(3)),
    readyRippleVisible: Boolean(
      readyIndicatorRect
      && readyIndicatorRect.width > 0
      && readyIndicatorRect.height > 0
      && maxReadyRippleOpacity > 0.2,
    ),
  };
}, { row, col });

const readAbilityReadyAnimationFrame = async (
  page: Page,
  row: number,
  col: number,
  index: number,
  elapsedMs: number,
): Promise<Omit<AbilityReadySequenceFrame, 'fullBoardPath' | 'targetUnitCropPath' | 'pixelDifferenceFromPrevious'>> => (
  page.evaluate(({ row, col, index, elapsedMs }) => {
    const rectToSnapshot = (rect: DOMRect | null): RectSnapshot | null => rect
      ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      : null;
    const unit = document.querySelector(`[data-testid="sw-unit-${row}-${col}"]`) as HTMLElement | null;
    const indicators = unit ? Array.from(unit.querySelectorAll<HTMLElement>('.border-cyan-300')) : [];
    const staticGlow = unit
      ? Array.from(unit.querySelectorAll<HTMLElement>('div')).find((element) => {
        const boxShadow = window.getComputedStyle(element).boxShadow;
        return boxShadow.includes('34, 211, 238') || boxShadow.includes('rgba(34');
      }) ?? null
      : null;
    const samples = indicators.map((element, sampleIndex) => {
      const computed = window.getComputedStyle(element);
      const parentComputed = element.parentElement ? window.getComputedStyle(element.parentElement) : null;
      const ancestorChain: IndicatorFrameSample['ancestorChain'] = [];
      let ancestor: HTMLElement | null = element;
      for (let depth = 0; depth < 5 && ancestor; depth += 1) {
        const style = window.getComputedStyle(ancestor);
        ancestorChain.push({
          tagName: ancestor.tagName.toLowerCase(),
          testId: ancestor.getAttribute('data-testid'),
          className: typeof ancestor.className === 'string' ? ancestor.className : '',
          position: style.position,
          zIndex: style.zIndex,
          opacity: style.opacity,
          overflow: style.overflow,
        });
        ancestor = ancestor.parentElement;
      }
      const opacity = Number.parseFloat(computed.opacity || '0');
      return {
        index: sampleIndex,
        opacity: Number((Number.isFinite(opacity) ? opacity : 0).toFixed(3)),
        transform: computed.transform,
        rect: rectToSnapshot(element.getBoundingClientRect()),
        borderColor: computed.borderTopColor,
        borderStyle: computed.borderTopStyle,
        borderTopWidth: computed.borderTopWidth,
        display: computed.display,
        visibility: computed.visibility,
        zIndex: computed.zIndex,
        boxShadow: computed.boxShadow,
        parentOpacity: parentComputed?.opacity ?? '',
        parentZIndex: parentComputed?.zIndex ?? '',
        parentOverflow: parentComputed?.overflow ?? '',
        ancestorChain,
      };
    });
    const opacities = samples.map((sample) => sample.opacity);
    const widths = samples.map((sample) => sample.rect?.width ?? 0);
    const heights = samples.map((sample) => sample.rect?.height ?? 0);
    const maxOpacity = opacities.length ? Math.max(...opacities) : 0;
    const minOpacity = opacities.length ? Math.min(...opacities) : 0;
    const maxIndicatorWidth = widths.length ? Math.max(...widths) : 0;
    const minIndicatorWidth = widths.length ? Math.min(...widths) : 0;
    const maxIndicatorHeight = heights.length ? Math.max(...heights) : 0;
    const minIndicatorHeight = heights.length ? Math.min(...heights) : 0;
    return {
      index,
      elapsedMs,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      indicatorCount: indicators.length,
      indicators: samples,
      maxOpacity: Number(maxOpacity.toFixed(3)),
      minOpacity: Number(minOpacity.toFixed(3)),
      opacitySpread: Number((maxOpacity - minOpacity).toFixed(3)),
      maxIndicatorWidth,
      minIndicatorWidth,
      widthSpread: maxIndicatorWidth - minIndicatorWidth,
      maxIndicatorHeight,
      minIndicatorHeight,
      heightSpread: maxIndicatorHeight - minIndicatorHeight,
      staticGlowBoxShadow: staticGlow ? window.getComputedStyle(staticGlow).boxShadow : null,
    };
  }, { row, col, index, elapsedMs })
);

const compareCropBuffers = async (
  previous: Buffer | null,
  current: Buffer,
): Promise<PixelDifference | null> => {
  if (!previous) {
    return null;
  }

  const [previousRaw, currentRaw] = await Promise.all([
    sharp(previous).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(current).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const previousInfo = previousRaw.info;
  const currentInfo = currentRaw.info;
  if (previousInfo.width !== currentInfo.width || previousInfo.height !== currentInfo.height) {
    return {
      dimensionsMatch: false,
      width: currentInfo.width,
      height: currentInfo.height,
      totalPixels: currentInfo.width * currentInfo.height,
      changedPixels: 0,
      changedPixelRatio: 0,
      perimeterPixels: 0,
      perimeterChangedPixels: 0,
      perimeterChangedPixelRatio: 0,
      meanAbsDiff: 0,
      meanPerimeterAbsDiff: 0,
      mismatch: {
        previous: { width: previousInfo.width, height: previousInfo.height },
        current: { width: currentInfo.width, height: currentInfo.height },
      },
    };
  }

  const channels = currentInfo.channels;
  const totalPixels = currentInfo.width * currentInfo.height;
  const perimeterBand = Math.max(6, Math.ceil(Math.min(currentInfo.width, currentInfo.height) * 0.22));
  let changedPixels = 0;
  let perimeterPixels = 0;
  let perimeterChangedPixels = 0;
  let diffTotal = 0;
  let perimeterDiffTotal = 0;

  for (let offset = 0; offset < currentRaw.data.length; offset += channels) {
    const pixelIndex = offset / channels;
    const x = pixelIndex % currentInfo.width;
    const y = Math.floor(pixelIndex / currentInfo.width);
    let pixelDiff = 0;
    for (let channel = 0; channel < Math.min(channels, previousInfo.channels); channel += 1) {
      pixelDiff += Math.abs((previousRaw.data[offset + channel] ?? 0) - (currentRaw.data[offset + channel] ?? 0));
    }
    diffTotal += pixelDiff;
    const changed = pixelDiff > 34;
    if (changed) {
      changedPixels += 1;
    }
    const isPerimeter = x < perimeterBand
      || x >= currentInfo.width - perimeterBand
      || y < perimeterBand
      || y >= currentInfo.height - perimeterBand;
    if (isPerimeter) {
      perimeterPixels += 1;
      perimeterDiffTotal += pixelDiff;
      if (changed) {
        perimeterChangedPixels += 1;
      }
    }
  }

  return {
    dimensionsMatch: true,
    width: currentInfo.width,
    height: currentInfo.height,
    totalPixels,
    changedPixels,
    changedPixelRatio: Number((changedPixels / totalPixels).toFixed(4)),
    perimeterPixels,
    perimeterChangedPixels,
    perimeterChangedPixelRatio: Number((perimeterChangedPixels / Math.max(1, perimeterPixels)).toFixed(4)),
    meanAbsDiff: Number((diffTotal / Math.max(1, totalPixels * channels)).toFixed(3)),
    meanPerimeterAbsDiff: Number((perimeterDiffTotal / Math.max(1, perimeterPixels * channels)).toFixed(3)),
  };
};

const summarizeAbilityReadySequence = (
  frames: AbilityReadySequenceFrame[],
  intervalMs: number,
): AbilityReadySequenceSummary => {
  const allOpacities = frames.flatMap((frame) => frame.indicators.map((indicator) => indicator.opacity));
  const allWidths = frames.flatMap((frame) => frame.indicators.map((indicator) => indicator.rect?.width ?? 0));
  const allHeights = frames.flatMap((frame) => frame.indicators.map((indicator) => indicator.rect?.height ?? 0));
  const allTransforms = frames.flatMap((frame) => frame.indicators.map((indicator) => indicator.transform));
  const diffs = frames
    .map((frame) => frame.pixelDifferenceFromPrevious)
    .filter((diff): diff is PixelDifference => Boolean(diff && diff.dimensionsMatch));
  const opacityRange = allOpacities.length ? Math.max(...allOpacities) - Math.min(...allOpacities) : 0;
  const indicatorWidthRange = allWidths.length ? Math.max(...allWidths) - Math.min(...allWidths) : 0;
  const indicatorHeightRange = allHeights.length ? Math.max(...allHeights) - Math.min(...allHeights) : 0;
  const maxPerimeterChangedPixelRatio = diffs.length ? Math.max(...diffs.map((diff) => diff.perimeterChangedPixelRatio)) : 0;
  const maxMeanPerimeterAbsDiff = diffs.length ? Math.max(...diffs.map((diff) => diff.meanPerimeterAbsDiff)) : 0;
  const domAnimationDetected = opacityRange > 0.2 || indicatorWidthRange > 8 || indicatorHeightRange > 8 || new Set(allTransforms).size > 3;
  const cropMotionDetected = maxPerimeterChangedPixelRatio > 0.03 || maxMeanPerimeterAbsDiff > 3.5;
  return {
    frameCount: frames.length,
    intervalMs,
    durationMs: frames.length ? frames[frames.length - 1].elapsedMs - frames[0].elapsedMs : 0,
    opacityRange: Number(opacityRange.toFixed(3)),
    indicatorWidthRange,
    indicatorHeightRange,
    uniqueTransformCount: new Set(allTransforms).size,
    maxChangedPixelRatio: diffs.length ? Math.max(...diffs.map((diff) => diff.changedPixelRatio)) : 0,
    maxPerimeterChangedPixelRatio,
    maxMeanAbsDiff: diffs.length ? Math.max(...diffs.map((diff) => diff.meanAbsDiff)) : 0,
    maxMeanPerimeterAbsDiff,
    framesWithPerimeterChangeOverOnePercent: diffs.filter((diff) => diff.perimeterChangedPixelRatio > 0.01).length,
    framesWithPerimeterChangeOverThreePercent: diffs.filter((diff) => diff.perimeterChangedPixelRatio > 0.03).length,
    prefersReducedMotion: frames.some((frame) => frame.prefersReducedMotion),
    staticGlowUniqueCount: new Set(frames.map((frame) => frame.staticGlowBoxShadow ?? 'none')).size,
    domAnimationDetected,
    cropMotionDetected,
    diagnosticVerdict: domAnimationDetected && cropMotionDetected
      ? 'dynamic-breathing-visible-candidate'
      : 'static-highlight-like-candidate',
  };
};

const dragMap = async (page: Page, dx: number, dy: number) => {
  const container = page.getByTestId('sw-map-container');
  const box = await container.boundingBox();
  if (!box) {
    throw new Error('无法获取地图容器尺寸，不能通过真实拖拽让目标单位入镜');
  }
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(450);
};

const focusBoardUnitForScreenshot = async (
  page: Page,
  row: number,
  col: number,
): Promise<BoardUnitEvidence> => {
  const isScreenshotQualified = (evidence: BoardUnitEvidence) => (
    evidence.unitRect !== null
    && evidence.readyIndicatorRect !== null
    && evidence.unitCenterInsideMap
    && evidence.unitCenterForegroundInsideUnit
    && evidence.foregroundHitSampleCount >= 3
    && evidence.readyIndicatorForegroundHit
    && !evidence.unitOverlapsHand
    && evidence.unitClearOfHand
    && evidence.readyRippleVisible
  );

  const dragSteps = [0, -170, -140, -110, -80];
  let lastEvidence = await readBoardUnitEvidence(page, row, col);
  for (const dy of dragSteps) {
    if (dy !== 0) {
      await dragMap(page, 0, dy);
      await expect.poll(async () => getMapTransform(page), {
        timeout: 5000,
        message: '真实拖拽后地图视口必须发生位移并稳定',
      }).not.toBe('none');
    }
    lastEvidence = await readBoardUnitEvidence(page, row, col);
    if (isScreenshotQualified(lastEvidence)) {
      return lastEvidence;
    }
  }

  throw new Error([
    '场上主动技能单位卡没有达到截图资格：目标必须在整屏图里真实入镜、前景可命中、未被手牌/HUD遮挡，且青色波纹可见。',
    JSON.stringify(lastEvidence, null, 2),
  ].join('\n'));
};

const getMapTransform = async (page: Page) => (
  page.getByTestId('sw-map-content').evaluate((node) => getComputedStyle(node).transform)
);

const evidencePath = (testInfo: TestInfo, name: string) => {
  const path = getEvidenceScreenshotPath(testInfo, name, {
    filename: `${name}.jpg`,
    requireChineseName: true,
  });
  mkdirSync(dirname(path), { recursive: true });
  return path;
};

const evidencePathWithExtension = (testInfo: TestInfo, name: string, extension: 'jpg' | 'png') => {
  const path = getEvidenceScreenshotPath(testInfo, name, {
    filename: `${name}.${extension}`,
    requireChineseName: true,
  });
  mkdirSync(dirname(path), { recursive: true });
  return path;
};

const captureUnitCrop = async (page: Page, unitLocator: Locator, path: string): Promise<Buffer> => {
  const box = await unitLocator.boundingBox();
  if (!box) {
    throw new Error('无法读取场上主动技能单位卡位置，不能生成目标对象本体辅证截图');
  }
  const viewport = page.viewportSize() ?? await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const padding = 36;
  const x = Math.max(0, Math.floor(box.x - padding));
  const y = Math.max(0, Math.floor(box.y - padding));
  const width = Math.max(1, Math.min(viewport.width - x, Math.ceil(box.width + padding * 2)));
  const height = Math.max(1, Math.min(viewport.height - y, Math.ceil(box.height + padding * 2)));
  return page.screenshot({ path, clip: { x, y, width, height }, animations: 'allow' });
};

const captureAbilityReadySequence = async (
  page: Page,
  testInfo: TestInfo,
  unitLocator: Locator,
  row: number,
  col: number,
) => {
  const frameCount = 8;
  const intervalMs = 250;
  const frames: AbilityReadySequenceFrame[] = [];
  let previousCrop: Buffer | null = null;
  const startedAt = Date.now();

  for (let index = 0; index < frameCount; index += 1) {
    const elapsedMs = Date.now() - startedAt;
    const frameLabel = `${String(index).padStart(2, '0')}-${String(elapsedMs).padStart(4, '0')}ms`;
    const sampledFrame = await readAbilityReadyAnimationFrame(page, row, col, index, elapsedMs);
    const fullBoardPath = evidencePathWithExtension(testInfo, `03-整屏连续帧-${frameLabel}-场上主动技能单位`, 'jpg');
    await page.screenshot({ path: fullBoardPath, fullPage: false, animations: 'allow' });
    const targetUnitCropPath = evidencePathWithExtension(testInfo, `04-局部连续帧-${frameLabel}-场上主动技能单位`, 'png');
    const cropBuffer = await captureUnitCrop(page, unitLocator, targetUnitCropPath);
    const pixelDifferenceFromPrevious = await compareCropBuffers(previousCrop, cropBuffer);
    frames.push({
      ...sampledFrame,
      fullBoardPath,
      targetUnitCropPath,
      pixelDifferenceFromPrevious,
    });
    previousCrop = cropBuffer;
    if (index < frameCount - 1) {
      await page.waitForTimeout(intervalMs);
    }
  }

  return {
    frames,
    summary: summarizeAbilityReadySequence(frames, intervalMs),
  };
};

test.describe('召唤师战争当前证据截图', () => {
  test('当前工作树：棋盘主动技能单位卡本体显示技能就绪波纹', async ({ page, context, game }, testInfo) => {
    test.setTimeout(90000);
    await clearEvidenceScreenshotsForTest(testInfo);
    await page.setViewportSize({ width: 1440, height: 900 });

    await context.addInitScript(() => {
      localStorage.setItem('i18nextLng', 'zh-CN');
      localStorage.removeItem('hud_fab_position');
      localStorage.removeItem('hud_fab_offset');
    });

    await game.openTestGame('summonerwars');

    const core = buildNecromancerSummonCore();
    const summonerPos = findSummonerPosition(core, '0');
    const expectedTargetUnit = core.board[summonerPos.row][summonerPos.col]?.unit?.card;
    if (!expectedTargetUnit) {
      throw new Error('无法从规则状态读取场上主动技能单位卡');
    }
    const discardUndeadCount = core.players['0'].discard.filter(card => card.cardType === 'unit' && isUndeadCard(card)).length;
    await game.setupScene({
      gameId: 'summonerwars',
      currentPlayer: core.currentPlayer,
      phase: core.phase,
      extra: { core },
    });

    await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout: 10000 });
    const summonerUnit = page.getByTestId(`sw-unit-${summonerPos.row}-${summonerPos.col}`).first();
    await expect(summonerUnit).toBeVisible({ timeout: 10000 });
    await expect(summonerUnit.locator('.border-cyan-300').first()).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => {
      const evidence = await readBoardUnitEvidence(page, summonerPos.row, summonerPos.col);
      return evidence.maxReadyRippleOpacity;
    }, {
      timeout: 5000,
      message: '场上主动技能单位卡的青色波纹必须进入可见动画帧后才能截图',
    }).toBeGreaterThan(0.2);

    const targetEvidence = await focusBoardUnitForScreenshot(page, summonerPos.row, summonerPos.col);
    expect(expectedTargetUnit.abilities).toContain('revive_undead');
    expect(targetEvidence.unitName).toBe(expectedTargetUnit.name);
    expect(targetEvidence.unitClass).toBe('summoner');
    expect(targetEvidence.owner).toBe('0');
    expect(targetEvidence.cellSelected).toBe('false');
    expect(targetEvidence.unitInsideMapDom).toBe(true);
    expect(targetEvidence.unitCenterInsideMap).toBe(true);
    expect(targetEvidence.unitCenterForegroundInsideUnit).toBe(true);
    expect(targetEvidence.foregroundHitSampleCount).toBeGreaterThanOrEqual(3);
    expect(targetEvidence.unitInsideHandDom).toBe(false);
    expect(targetEvidence.unitOverlapsHand).toBe(false);
    expect(targetEvidence.unitClearOfHand).toBe(true);
    expect(targetEvidence.readyIndicatorCount).toBeGreaterThanOrEqual(1);
    expect(targetEvidence.readyIndicatorForegroundHit).toBe(true);
    expect(targetEvidence.readyRippleVisible).toBe(true);

    const fullBoardPath = evidencePath(testInfo, '01-召唤阶段-棋盘主动技能单位卡本体显示青色波纹');
    await page.screenshot({ path: fullBoardPath, fullPage: false });

    const cropPath = evidencePath(testInfo, '02-局部辅证-场上主动技能单位卡和青色波纹');
    await captureUnitCrop(page, summonerUnit, cropPath);
    const abilityReadySequence = await captureAbilityReadySequence(
      page,
      testInfo,
      summonerUnit,
      summonerPos.row,
      summonerPos.col,
    );

    const selectedCore = buildNecromancerSummonCore();
    const selectedSummonerPos = findSummonerPosition(selectedCore, '0');
    selectedCore.selectedUnit = selectedSummonerPos;
    await game.setupScene({
      gameId: 'summonerwars',
      currentPlayer: selectedCore.currentPlayer,
      phase: selectedCore.phase,
      extra: { core: selectedCore },
    });

    const selectedSummonerUnit = page.getByTestId(`sw-unit-${selectedSummonerPos.row}-${selectedSummonerPos.col}`).first();
    await expect(page.getByTestId(`sw-cell-${selectedSummonerPos.row}-${selectedSummonerPos.col}`)).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
    await expect.poll(async () => selectedSummonerUnit.locator('.border-cyan-300').count(), {
      timeout: 5000,
      message: '选中场上单位卡后青色波纹应由选中态替代',
    }).toBe(0);

    const selectedEvidence = await readBoardUnitEvidence(page, selectedSummonerPos.row, selectedSummonerPos.col);
    const diagnosticsPath = fullBoardPath.replace(/\.jpg$/i, '.json');
    writeFileSync(diagnosticsPath, JSON.stringify({
      screenshots: {
        fullBoard: fullBoardPath,
        targetUnitCrop: cropPath,
        abilityReadySequenceFullBoards: abilityReadySequence.frames.map((frame) => frame.fullBoardPath),
        abilityReadySequenceTargetCrops: abilityReadySequence.frames.map((frame) => frame.targetUnitCropPath),
      },
      currentState: {
        phase: core.phase,
        currentPlayer: core.currentPlayer,
        targetUnitPosition: summonerPos,
        targetUnitName: expectedTargetUnit.name,
        targetUnitAbilities: expectedTargetUnit.abilities,
        targetUnitIsBoardUnit: targetEvidence.unitInsideMapDom
          && targetEvidence.unitCenterInsideMap
          && targetEvidence.unitCenterForegroundInsideUnit
          && targetEvidence.foregroundHitSampleCount >= 3
          && !targetEvidence.unitInsideHandDom
          && !targetEvidence.unitOverlapsHand,
        discardUndeadCount,
      },
      unselectedBoardUnitEvidence: targetEvidence,
      abilityReadySequence,
      selectedStateProtectionEvidence: selectedEvidence,
    }, null, 2), 'utf8');
  });
});
