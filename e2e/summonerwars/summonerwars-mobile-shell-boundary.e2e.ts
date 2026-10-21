import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { GameTestContext } from '../framework/GameTestContext';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
  createSWRoomViaAPI,
  GAME_NAME,
  clickFactionReady,
  clickFactionStart,
  getFactionStartButton,
  initSWContext,
  selectFactionById,
  waitForFactionSelectionReady,
} from '../helpers/summonerwars';
import { ensureGameServerAvailable, joinMatchViaAPI, seedMatchCredentials } from '../helpers/common';

const MOBILE_VIEWPORT = { width: 796, height: 360 } as const;
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 } as const;

async function createContext(browser: Browser, baseURL: string | undefined, mobile: boolean) {
  const context = await browser.newContext({
    baseURL,
    viewport: mobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript(() => {
    (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
  });
  await initSWContext(context, `__sw_shell_boundary_${mobile ? 'mobile' : 'desktop'}`);
  return context;
}

async function openSelection(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await ensureGameServerAvailable(page), 'Summoner Wars game server must be available').toBe(true);
  const matchId = await createSWRoomViaAPI(page);
  expect(matchId, 'Summoner Wars room creation must succeed').toBeTruthy();
  await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
  await waitForFactionSelectionReady(page);
  await expect(page.getByTestId('sw-faction-selection')).toBeVisible();
  return matchId!;
}

async function waitForFactionAssets(page: Page) {
  await page.waitForFunction(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-testid^="sw-faction-card-"][data-faction-id]',
    ));
    return cards.length > 0 && cards.every((card) => {
      const sprite = card.querySelector<HTMLElement>('[data-card-sprite="true"]');
      const image = sprite?.querySelector<HTMLImageElement>('img');
      return sprite?.dataset.imageLoaded === 'true'
        && image?.complete === true
        && (image.naturalWidth ?? 0) > 0
        && (image.naturalHeight ?? 0) > 0;
    });
  }, { timeout: 30000 });
}

async function waitForBoardRenderedWithoutChangingHud(page: Page) {
  for (const testId of ['sw-action-banner', 'sw-hand-area', 'sw-map-container', 'sw-end-phase']) {
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 30000 });
  }
}

async function readSelectionGeometry(page: Page) {
  return page.evaluate(() => {
    const selection = document.querySelector<HTMLElement>('[data-testid="sw-faction-selection"]');
    if (!selection) return null;
    const rect = selection.getBoundingClientRect();
    const corner = document.elementFromPoint(window.innerWidth - 1, window.innerHeight - 1);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
      background: getComputedStyle(selection).backgroundColor,
      bottomRightCovered: Boolean(corner && (corner === selection || selection.contains(corner))),
    };
  });
}

async function openSecondPlayer(browser: Browser, baseURL: string | undefined, matchId: string, mobile: boolean) {
  const context = await createContext(browser, baseURL, mobile);
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const credentials = await joinMatchViaAPI(page, GAME_NAME, matchId, '1', 'Guest-SW-Shell-Boundary');
  if (!credentials) {
    await context.close();
    throw new Error(`Could not join SummonerWars match ${matchId}`);
  }
  await seedMatchCredentials(page, GAME_NAME, matchId, '1', credentials);
  await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
  await waitForFactionSelectionReady(page);
  return { context, page };
}

async function pinchThenPan(page: Page) {
  const map = page.getByTestId('sw-map-container');
  const box = await map.boundingBox();
  if (!box) throw new Error('Summoner Wars map container has no browser geometry');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: x - 24, y }, { id: 2, x: x + 24, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: x - 120, y }, { id: 2, x: x + 120, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
    const afterPinch = await readMapTransform(page);

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 3, x, y }] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 3, x: x + 90, y: y + 18 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 3, x: x + 150, y: y + 28 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const afterPan = await readMapTransform(page);
    return { afterPinch, afterPan };
  } finally {
    await cdp.detach();
  }
}

async function readPanAndHudGeometry(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
    };
    const mapContent = document.querySelector<HTMLElement>('[data-testid="sw-map-content"]');
    return {
      mapTransform: mapContent ? getComputedStyle(mapContent).transform : null,
      map: rect('[data-testid="sw-map-container"]'),
      hud: rect('[data-testid="fab-menu"]'),
    };
  });
}

async function readHudSnapshot(page: Page) {
  return page.evaluate(() => {
    const targets: Record<string, { visibility: string; opacity: number; rect: { left: number; top: number; width: number; height: number } | null }> = {};
    for (const [name, selector] of Object.entries({
      fabMenu: '[data-testid="fab-menu"]',
      playerBar: '[data-testid="sw-player-bar"]',
      opponentBar: '[data-testid="sw-opponent-bar"]',
      phaseControls: '[data-testid="sw-phase-controls"]',
      phaseTracker: '[data-testid="sw-phase-tracker"]',
    })) {
      const element = document.querySelector<HTMLElement>(selector);
      const bounds = element?.getBoundingClientRect();
      targets[name] = {
        visibility: element ? getComputedStyle(element).visibility : 'missing',
        opacity: element ? Number.parseFloat(getComputedStyle(element).opacity) : 0,
        rect: bounds ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } : null,
      };
    }
    return targets;
  });
}

async function zoomAndPanWithMouse(page: Page, testInfo: TestInfo) {
  const map = page.getByTestId('sw-map-container');
  const box = await map.boundingBox();
  if (!box) throw new Error('Summoner Wars desktop map has no browser geometry');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  const readDisplayedZoom = async () => {
    const text = await page.getByTestId('sw-map-scale').textContent();
    const percent = Number.parseFloat(text ?? '');
    if (!Number.isFinite(percent)) throw new Error(`Invalid Summoner Wars scale badge: ${text}`);
    return percent;
  };
  const waitForMapContentSettle = async () => {
    await page.evaluate(async () => {
      const element = document.querySelector<HTMLElement>('[data-testid="sw-map-content"]');
      if (!element) throw new Error('Summoner Wars map content is missing');
      await Promise.all(element.getAnimations({ subtree: false }).map((animation) => animation.finished.catch(() => undefined)));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
  };
  let displayedZoom = await readDisplayedZoom();
  for (let index = 0; index < 40 && displayedZoom < 300; index += 1) {
    await page.mouse.wheel(0, -120);
    await expect.poll(readDisplayedZoom, { timeout: 3000 }).toBeGreaterThan(displayedZoom);
    displayedZoom = await readDisplayedZoom();
  }
  expect(displayedZoom).toBe(300);
  await waitForMapContentSettle();
  const afterZoom = await readMapTransform(page);
  const beforePanHud = await readHudSnapshot(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 180, y + 35, { steps: 12 });
  await page.mouse.up();
  await waitForMapContentSettle();
  const afterPan = await readMapTransform(page);
  const afterPanHud = await readHudSnapshot(page);
  const observationPath = getEvidenceScreenshotPath(testInfo, '桌面鼠标缩放与拖动变换样本');
  await mkdir(dirname(observationPath), { recursive: true });
  await writeFile(observationPath.replace(/\.jpg$/i, '.json'), JSON.stringify({
    viewport: DESKTOP_VIEWPORT,
    displayedZoom,
    afterZoom,
    afterPan,
    beforePanHud,
    afterPanHud,
  }, null, 2), 'utf8');
  return { displayedZoom, afterZoom, afterPan, beforePanHud, afterPanHud };
}

test.describe('Summoner Wars mobile shell boundary', () => {
  test('选派系在桌面端覆盖整个窗口并加载正式阵营素材', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const context = await createContext(browser, baseURL, false);
    const page = await context.newPage();
    const game = new GameTestContext(page);
    let guestContext: BrowserContext | null = null;
    try {
      const matchId = await openSelection(page);
      await waitForFactionAssets(page);
      const geometry = await readSelectionGeometry(page);
      expect(geometry).not.toBeNull();
      expect(geometry!.rect.left).toBeCloseTo(0, 0);
      expect(geometry!.rect.top).toBeCloseTo(0, 0);
      expect(geometry!.rect.width).toBeCloseTo(DESKTOP_VIEWPORT.width, 0);
      expect(geometry!.rect.height).toBeCloseTo(DESKTOP_VIEWPORT.height, 0);
      expect(geometry!.bottomRightCovered).toBe(true);
      await game.screenshot('桌面选派系覆盖全窗口与正式阵营素材', testInfo);

      const guest = await openSecondPlayer(browser, baseURL, matchId, false);
      guestContext = guest.context;
      await waitForFactionAssets(guest.page);
      await selectFactionById(page, 'necromancer');
      await selectFactionById(guest.page, 'trickster');
      await clickFactionReady(guest.page);
      await expect(getFactionStartButton(page)).toBeEnabled();
      await clickFactionStart(page);
      await waitForBoardRenderedWithoutChangingHud(page);
      await waitForBoardRenderedWithoutChangingHud(guest.page);
      await page.waitForFunction(() => {
        const map = document.querySelector<HTMLImageElement>('[data-testid="sw-map-container"] img[src*="/map."]');
        return Boolean(map?.complete && map.naturalWidth > 0 && map.naturalHeight > 0);
      }, { timeout: 30000 });
      await game.screenshot('桌面开局地图正式素材加载完成', testInfo);
      const { displayedZoom, afterZoom, afterPan, beforePanHud: hudAtZoom, afterPanHud } = await zoomAndPanWithMouse(page, testInfo);
      expect(displayedZoom).toBe(300);
      expect(afterPan.translateX).not.toBeCloseTo(afterZoom.translateX, 0);
      expect(afterPan.scale).toBeCloseTo(afterZoom.scale, 2);
      for (const [name, before] of Object.entries(hudAtZoom)) {
        const after = afterPanHud[name];
        expect(after.visibility, `${name} desktop visibility`).toBe(before.visibility);
        expect(after.opacity, `${name} desktop opacity`).toBeCloseTo(before.opacity, 1);
        expect(after.rect?.left, `${name} desktop x`).toBeCloseTo(before.rect!.left, 0);
        expect(after.rect?.top, `${name} desktop y`).toBeCloseTo(before.rect!.top, 0);
        expect(after.rect?.width, `${name} desktop width`).toBeCloseTo(before.rect!.width, 0);
        expect(after.rect?.height, `${name} desktop height`).toBeCloseTo(before.rect!.height, 0);
      }
      await game.screenshot('桌面地图鼠标滚轮放大并拖动后HUD位置稳定', testInfo);
    } catch (error) {
      await page.screenshot({ path: testInfo.outputPath('actual-custom-page-failure.png'), fullPage: false });
      console.log('[sw-desktop-failure]', JSON.stringify(await page.evaluate(() => ({
        viewport: { width: innerWidth, height: innerHeight },
        url: location.href,
        selection: document.querySelector('[data-testid="sw-faction-selection"]')?.getBoundingClientRect().toJSON() ?? null,
      }))));
      console.log('[sw-desktop-map-transform]', JSON.stringify(await readMapTransform(page)));
      throw error;
    } finally {
      if (guestContext) await guestContext.close();
      await context.close();
    }
  });

  test('移动端选派系覆盖窗口，开局后双指放大再拖图且HUD不随地图移动', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await createContext(browser, baseURL, true);
    const hostPage = await hostContext.newPage();
    const hostGame = new GameTestContext(hostPage);
    let guestContext: BrowserContext | null = null;
    try {
      const matchId = await openSelection(hostPage);
      await waitForFactionAssets(hostPage);
      const geometry = await readSelectionGeometry(hostPage);
      expect(geometry).not.toBeNull();
      expect(geometry!.rect.left).toBeCloseTo(0, 0);
      expect(geometry!.rect.top).toBeCloseTo(0, 0);
      expect(geometry!.rect.width).toBeCloseTo(MOBILE_VIEWPORT.width, 0);
      expect(geometry!.rect.height).toBeCloseTo(MOBILE_VIEWPORT.height, 0);
      expect(geometry!.bottomRightCovered).toBe(true);
      expect(geometry!.background).not.toBe('rgba(0, 0, 0, 0)');
      await hostGame.screenshot('手机选派系覆盖全视口无右下黑边', testInfo);

      const guest = await openSecondPlayer(browser, baseURL, matchId, true);
      guestContext = guest.context;
      await waitForFactionAssets(guest.page);
      await selectFactionById(hostPage, 'necromancer');
      await selectFactionById(guest.page, 'trickster');
      await clickFactionReady(guest.page);
      await expect(getFactionStartButton(hostPage)).toBeEnabled();
      await clickFactionStart(hostPage);
      await waitForBoardRenderedWithoutChangingHud(hostPage);
      await waitForBoardRenderedWithoutChangingHud(guest.page);
      await hostPage.waitForFunction(() => {
        const map = document.querySelector<HTMLImageElement>('[data-testid="sw-map-container"] img[src*="map."]');
        return Boolean(map?.complete && map.naturalWidth > 0 && map.naturalHeight > 0);
      }, { timeout: 30000 });
      await hostGame.screenshot('手机开局后地图正式素材加载完成', testInfo);

      const hudSamples: Array<{ time: number; targets: Record<string, { visibility: string; opacity: string; rect: { left: number; top: number; width: number; height: number } | null }> }> = [];
      await hostPage.exposeBinding('__captureSwHudSample', (_source, sample) => {
        hudSamples.push(sample as typeof hudSamples[number]);
      });
      await hostPage.evaluate(() => {
        const capture = (window as unknown as { __captureSwHudSample: (sample: unknown) => void }).__captureSwHudSample;
        const startedAt = performance.now();
        const sample = () => {
          const targets: Record<string, { visibility: string; opacity: string; rect: { left: number; top: number; width: number; height: number } | null }> = {};
          for (const [name, selector] of Object.entries({
            fabMenu: '[data-testid="fab-menu"]',
            playerBar: '[data-testid="sw-player-bar"]',
            opponentBar: '[data-testid="sw-opponent-bar"]',
            phaseControls: '[data-testid="sw-phase-controls"]',
            phaseTracker: '[data-testid="sw-phase-tracker"]',
          })) {
            const element = document.querySelector<HTMLElement>(selector);
            const bounds = element?.getBoundingClientRect();
            targets[name] = {
              visibility: element ? getComputedStyle(element).visibility : 'missing',
              opacity: element ? getComputedStyle(element).opacity : 'missing',
              rect: bounds ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } : null,
            };
          }
          capture({
            time: performance.now() - startedAt,
            targets,
          });
          if (performance.now() - startedAt < 1800) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const hudBefore = await readHudSnapshot(hostPage);
      for (const [name, target] of Object.entries(hudBefore)) {
        expect(target.visibility, `${name} baseline visibility`).toBe('visible');
        expect(target.opacity, `${name} baseline opacity`).toBeGreaterThan(0);
        expect(target.rect, `${name} baseline rect`).not.toBeNull();
        expect(target.rect!.width, `${name} baseline width`).toBeGreaterThan(0);
        expect(target.rect!.height, `${name} baseline height`).toBeGreaterThan(0);
      }
      const before = await readPanAndHudGeometry(hostPage);
      const beforeTransform = await readMapTransform(hostPage);
      const gestureStates = await pinchThenPan(hostPage);
      const after = await readPanAndHudGeometry(hostPage);
      await hostPage.waitForTimeout(1800);
      const hudObservationPath = getEvidenceScreenshotPath(testInfo, '手机触摸期间HUD逐帧样本');
      await mkdir(dirname(hudObservationPath), { recursive: true });
      await writeFile(hudObservationPath.replace(/\.jpg$/i, '.json'), JSON.stringify({
        viewport: MOBILE_VIEWPORT,
        map: { before, beforeTransform, afterPinch: gestureStates.afterPinch, afterPan: gestureStates.afterPan, after },
        hudBefore,
        samples: hudSamples,
      }, null, 2), 'utf8');
      expect(gestureStates.afterPinch.scale).toBeGreaterThan(beforeTransform.scale + 0.1);
      expect(gestureStates.afterPan.translateX).not.toBeCloseTo(gestureStates.afterPinch.translateX, 0);
      expect(gestureStates.afterPan.scale).toBeCloseTo(gestureStates.afterPinch.scale, 2);
      expect(after.hud).not.toBeNull();
      expect(before.hud).not.toBeNull();
      expect(after.hud!.left).toBeCloseTo(before.hud!.left, 0);
      expect(after.hud!.top).toBeCloseTo(before.hud!.top, 0);
      expect(after.hud!.width).toBeCloseTo(before.hud!.width, 0);
      expect(after.hud!.height).toBeCloseTo(before.hud!.height, 0);
      expect(hudSamples.length).toBeGreaterThan(10);
      for (const [name, baseline] of Object.entries(hudBefore)) {
        for (const sample of hudSamples) {
          const observed = sample.targets[name];
          expect(observed.visibility, `${name} visibility during touch`).toBe('visible');
          expect(Number.parseFloat(observed.opacity), `${name} opacity during touch`).toBeCloseTo(baseline.opacity, 1);
          expect(observed.rect?.left, `${name} x during touch`).toBeCloseTo(baseline.rect.left, 0);
          expect(observed.rect?.top, `${name} y during touch`).toBeCloseTo(baseline.rect.top, 0);
          expect(observed.rect?.width, `${name} width during touch`).toBeCloseTo(baseline.rect.width, 0);
          expect(observed.rect?.height, `${name} height during touch`).toBeCloseTo(baseline.rect.height, 0);
        }
      }
      await testInfo.attach('SW 手机触摸期间 HUD rAF 样本', {
        body: JSON.stringify(hudSamples, null, 2),
        contentType: 'application/json',
      });
      await hostGame.screenshot('手机地图双指放大并拖动后HUD保持屏幕位置', testInfo);
    } catch (error) {
      await hostPage.screenshot({ path: testInfo.outputPath('actual-custom-page-failure.png'), fullPage: false });
      console.log('[sw-mobile-failure]', JSON.stringify(await hostPage.evaluate(() => ({
        viewport: { width: innerWidth, height: innerHeight },
        url: location.href,
        selection: document.querySelector('[data-testid="sw-faction-selection"]')?.getBoundingClientRect().toJSON() ?? null,
        map: document.querySelector('[data-testid="sw-map-container"]')?.getBoundingClientRect().toJSON() ?? null,
        mapImages: Array.from(document.querySelectorAll<HTMLImageElement>('[data-testid="sw-map-container"] img')).map((image) => ({ src: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight })),
      }))));
      throw error;
    } finally {
      if (guestContext) await guestContext.close();
      await hostContext.close();
    }
  });
});

async function readMapTransform(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('[data-testid="sw-map-content"]');
    const container = document.querySelector<HTMLElement>('[data-testid="sw-map-container"]');
    const computed = element ? getComputedStyle(element) : null;
    const transform = computed?.transform ?? 'none';
    const matrix = new DOMMatrixReadOnly(transform);
    const rect = (node: HTMLElement | null) => {
      const bounds = node?.getBoundingClientRect();
      return bounds ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } : null;
    };
    return {
      inlineTransform: element?.style.transform ?? null,
      computedTransform: transform,
      computedTransition: computed?.transition ?? null,
      offsetWidth: element?.offsetWidth ?? null,
      offsetHeight: element?.offsetHeight ?? null,
      containerOffsetWidth: container?.offsetWidth ?? null,
      containerOffsetHeight: container?.offsetHeight ?? null,
      contentRect: rect(element),
      containerRect: rect(container),
      translateX: matrix.m41,
      scale: Math.hypot(matrix.a, matrix.b),
    };
  });
}
