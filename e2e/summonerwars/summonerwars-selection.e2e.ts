import { test } from '@playwright/test';
import { expect, createSummonerWarsMatch } from '../fixtures';
import { GameTestContext } from '../framework/GameTestContext';
import {
  createSWRoomViaAPI,
  GAME_NAME,
  clickFactionReady,
  clickFactionStart,
  getFactionCard,
  getFactionStartButton,
  getPlayerStatusCard,
  initSWContext,
  selectFactionById,
  waitForFactionSelectionReady,
  waitForSummonerWarsUI,
} from '../helpers/summonerwars';
import {
  ensureGameServerAvailable,
  joinMatchViaAPI,
  seedMatchCredentials,
} from '../helpers/common';
import {
  DESKTOP_REFERENCE_VIEWPORT,
  MOBILE_LANDSCAPE_CAPPED_REFERENCE_VIEWPORT,
  MOBILE_LANDSCAPE_REFERENCE_VIEWPORT,
} from '../../src/shared/referenceViewports';

async function joinGuestToSelectionMatch(page: import('@playwright/test').Page, matchId: string) {
  const credentials = await joinMatchViaAPI(page, GAME_NAME, matchId, '1', 'Guest-SW-Selection');
  if (!credentials) {
    throw new Error(`Failed to join SummonerWars match: ${matchId}`);
  }

  await seedMatchCredentials(page, GAME_NAME, matchId, '1', credentials);
  await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
}

async function waitForSelectionLayoutStable(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('sw-faction-selection')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('sw-faction-stage')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('sw-faction-grid')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('sw-faction-preview-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('sw-faction-player-rail')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(250);
}

test.describe('SummonerWars selection and turn-lock flows', () => {
  test('mobile landscape capped viewport keeps faction selection inline unit synced to 900px stage', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: MOBILE_LANDSCAPE_CAPPED_REFERENCE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await initSWContext(hostContext, '__sw_selection_mobile_capped_host');
    const hostPage = await hostContext.newPage();
    const hostGame = new GameTestContext(hostPage);

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed');
    }

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelectionReady(hostPage);
    await waitForSelectionLayoutStable(hostPage);

    const cappedLayout = await hostPage.evaluate(() => {
      const stage = document.querySelector('[data-testid="sw-faction-stage"]') as HTMLElement | null;
      if (!stage) {
        return null;
      }
      const rect = stage.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        stageWidth: rect.width,
        stageHeight: rect.height,
        stageStyleWidth: stage.style.width,
        stageStyleHeight: stage.style.height,
        inlineUnit: stage.style.getPropertyValue('--sw-selection-inline-unit'),
      };
    });

    expect(cappedLayout).not.toBeNull();
    expect(cappedLayout?.viewportWidth).toBe(MOBILE_LANDSCAPE_CAPPED_REFERENCE_VIEWPORT.width);
    expect(cappedLayout?.viewportHeight).toBe(MOBILE_LANDSCAPE_CAPPED_REFERENCE_VIEWPORT.height);
    expect(cappedLayout?.stageWidth ?? 0).toBeCloseTo(1000, 0);
    expect(cappedLayout?.stageHeight ?? 0).toBeCloseTo(520, 0);
    expect(cappedLayout?.stageStyleWidth).toBe('900px');
    expect(cappedLayout?.stageStyleHeight).toBe('468px');
    expect(cappedLayout?.inlineUnit).toBe('9px');

    await hostGame.screenshot('selection-phone-landscape-capped-entry', testInfo);
    await hostContext.close();
  });

  test('mobile landscape keeps faction selection aligned with pc composition', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: MOBILE_LANDSCAPE_REFERENCE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await initSWContext(hostContext, '__sw_selection_mobile_host');
    const hostPage = await hostContext.newPage();
    const hostGame = new GameTestContext(hostPage);

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed');
    }

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelectionReady(hostPage);
    await waitForSelectionLayoutStable(hostPage);

    await expect(hostPage.getByTestId('sw-faction-stage')).toBeVisible();
    await expect(hostPage.getByTestId('sw-faction-grid')).toBeVisible();
    await expect(hostPage.getByTestId('sw-faction-player-rail')).toBeVisible();
    await expect(hostPage.getByTestId('sw-faction-title')).toBeVisible();

    const entryLayout = await hostPage.evaluate(() => {
      const rectOf = (selector: string) => {
        const node = document.querySelector(selector) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        };
      };
      const banner = document.querySelector('[data-testid="opponent-offline-banner"]') as HTMLElement | null;

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        rootScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        stageRect: rectOf('[data-testid="sw-faction-stage"]'),
        gridRect: rectOf('[data-testid="sw-faction-grid"]'),
        previewRect: rectOf('[data-testid="sw-faction-preview-panel"]'),
        railRect: rectOf('[data-testid="sw-faction-player-rail"]'),
        titleRect: rectOf('[data-testid="sw-faction-title"]'),
        waitingBannerRect: rectOf('[data-testid="opponent-offline-banner"]'),
        waitingBannerStyleLeft: banner?.style.left ?? null,
        waitingBannerComputedLeft: banner ? window.getComputedStyle(banner).left : null,
        waitingBannerComputedTransform: banner ? window.getComputedStyle(banner).transform : null,
        computedStageWidthPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element).width || '0',
        ),
        computedStageHeightPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element).height || '0',
        ),
        inlineUnitPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element)
            .getPropertyValue('--sw-selection-inline-unit') || '0',
        ),
        blockUnitPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element)
            .getPropertyValue('--sw-selection-block-unit') || '0',
        ),
      };
    });

    expect(entryLayout.rootScrollWidth).toBeLessThanOrEqual(entryLayout.viewportWidth + 1);
    expect(entryLayout.bodyScrollWidth).toBeLessThanOrEqual(entryLayout.viewportWidth + 1);
    expect(entryLayout.stageRect?.left ?? -1).toBeGreaterThanOrEqual(0);
    expect(entryLayout.stageRect?.right ?? 99999).toBeLessThanOrEqual(entryLayout.viewportWidth + 1);
    expect(entryLayout.stageRect?.bottom ?? 99999).toBeLessThanOrEqual(entryLayout.viewportHeight + 1);
    expect(Math.abs((entryLayout.stageRect?.centerX ?? 0) - entryLayout.viewportWidth / 2)).toBeLessThanOrEqual(24);
    expect(Math.abs((entryLayout.inlineUnitPx * 100) - entryLayout.computedStageWidthPx)).toBeLessThanOrEqual(1);
    expect(Math.abs((entryLayout.blockUnitPx * 100) - entryLayout.computedStageHeightPx)).toBeLessThanOrEqual(1);
    expect(entryLayout.gridRect?.bottom ?? 0).toBeLessThan(entryLayout.previewRect?.top ?? 99999);
    expect(entryLayout.gridRect?.bottom ?? 0).toBeLessThan(entryLayout.railRect?.top ?? 99999);
    expect(entryLayout.waitingBannerRect).not.toBeNull();
    expect(
      Math.abs((entryLayout.waitingBannerRect?.centerX ?? 0) - (entryLayout.titleRect?.centerX ?? 0)),
      '等待横幅应与选择界面标题保持近似居中'
    ).toBeLessThanOrEqual(16);

    await hostGame.screenshot('selection-phone-landscape-entry', testInfo);

    const guestContext = await browser.newContext({ baseURL });
    await initSWContext(guestContext, '__sw_selection_mobile_guest');
    const guestPage = await guestContext.newPage();

    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    await joinGuestToSelectionMatch(guestPage, matchId);
    await waitForFactionSelectionReady(guestPage);
    await waitForSelectionLayoutStable(guestPage);

    await selectFactionById(hostPage, 'necromancer');
    await expect(getFactionCard(hostPage, 'necromancer')).toHaveAttribute('data-selected', 'true');

    await selectFactionById(guestPage, 'trickster');
    await expect(getFactionCard(guestPage, 'trickster')).toHaveAttribute('data-selected', 'true');

    const selectedLayout = await hostPage.evaluate(() => {
      const rectOf = (selector: string) => {
        const node = document.querySelector(selector) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const preview = document.querySelector('[data-testid="sw-faction-preview-panel"]') as HTMLElement | null;
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        stageRect: rectOf('[data-testid="sw-faction-stage"]'),
        previewRect: rectOf('[data-testid="sw-faction-preview-panel"]'),
        railRect: rectOf('[data-testid="sw-faction-player-rail"]'),
        actionRailRect: rectOf('[data-testid="sw-faction-action-rail"]'),
        actionButtonRect: rectOf(
          '[data-testid="sw-faction-start"], [data-testid="sw-faction-ready"], [data-testid="sw-faction-unready"]',
        ),
        previewHasImage: !!preview?.querySelector('img'),
        waitingBannerRect: rectOf('[data-testid="opponent-offline-banner"]'),
        titleRect: rectOf('[data-testid="sw-faction-title"]'),
        computedStageWidthPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element).width || '0',
        ),
        computedStageHeightPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element).height || '0',
        ),
        inlineUnitPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element)
            .getPropertyValue('--sw-selection-inline-unit') || '0',
        ),
        blockUnitPx: Number.parseFloat(
          window.getComputedStyle(document.querySelector('[data-testid="sw-faction-stage"]') as Element)
            .getPropertyValue('--sw-selection-block-unit') || '0',
        ),
      };
    });

    expect(selectedLayout.stageRect?.right ?? 99999).toBeLessThanOrEqual(selectedLayout.viewportWidth + 1);
    expect(selectedLayout.stageRect?.bottom ?? 99999).toBeLessThanOrEqual(selectedLayout.viewportHeight + 1);
    expect(Math.abs((selectedLayout.inlineUnitPx * 100) - selectedLayout.computedStageWidthPx)).toBeLessThanOrEqual(1);
    expect(Math.abs((selectedLayout.blockUnitPx * 100) - selectedLayout.computedStageHeightPx)).toBeLessThanOrEqual(1);
    expect(selectedLayout.previewHasImage).toBe(true);
    expect(selectedLayout.previewRect?.right ?? 0).toBeLessThanOrEqual(selectedLayout.railRect?.left ?? 99999);
    expect(selectedLayout.railRect?.right ?? 99999).toBeLessThanOrEqual(selectedLayout.viewportWidth + 1);
    expect(selectedLayout.railRect?.bottom ?? 99999).toBeLessThanOrEqual(selectedLayout.viewportHeight + 1);
    expect(selectedLayout.actionRailRect).not.toBeNull();
    expect(selectedLayout.actionButtonRect).not.toBeNull();
    expect(selectedLayout.actionRailRect?.left ?? 0).toBeGreaterThanOrEqual(selectedLayout.railRect?.right ?? 99999);
    expect(selectedLayout.actionRailRect?.right ?? 99999).toBeLessThanOrEqual(selectedLayout.viewportWidth + 1);
    expect(selectedLayout.actionButtonRect?.left ?? 0).toBeGreaterThanOrEqual(selectedLayout.actionRailRect?.left ?? 99999);
    expect(selectedLayout.actionButtonRect?.right ?? 99999).toBeLessThanOrEqual(selectedLayout.viewportWidth + 1);
    expect(
      selectedLayout.actionButtonRect?.width ?? 0,
      '移动横屏操作按钮不应再被玩家状态列挤压成窄条',
    ).toBeGreaterThanOrEqual(selectedLayout.inlineUnitPx * 12);
    expect(
      (selectedLayout.actionButtonRect?.width ?? 0) / Math.max(selectedLayout.actionButtonRect?.height ?? 1, 1),
      '移动横屏操作按钮应保持横向按钮形态，而不是接近竖条',
    ).toBeGreaterThanOrEqual(2);
    expect(selectedLayout.waitingBannerRect).toBeNull();

    await hostGame.screenshot('selection-phone-landscape-both-picked', testInfo);

    await hostContext.close();
    await guestContext.close();
  });

  test('main flow enters match from faction selection', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await initSWContext(hostContext, '__sw_selection_host');
    const hostPage = await hostContext.newPage();
    const hostGame = new GameTestContext(hostPage);

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed');
    }

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelectionReady(hostPage);
    await hostGame.screenshot('selection-host-entry', testInfo);

    const guestContext = await browser.newContext({ baseURL });
    await initSWContext(guestContext, '__sw_selection_guest');
    const guestPage = await guestContext.newPage();

    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    await joinGuestToSelectionMatch(guestPage, matchId);
    await waitForFactionSelectionReady(guestPage);

    await selectFactionById(hostPage, 'necromancer');
    await expect(getFactionCard(hostPage, 'necromancer')).toHaveAttribute('data-selected', 'true');

    await selectFactionById(guestPage, 'trickster');
    await expect(getFactionCard(guestPage, 'trickster')).toHaveAttribute('data-selected', 'true');
    await hostGame.screenshot('selection-both-picked', testInfo);

    await clickFactionReady(guestPage);
    await expect(getPlayerStatusCard(hostPage, '1')).toHaveAttribute('data-ready', 'true');
    await expect(getFactionStartButton(hostPage)).toBeEnabled();

    await clickFactionStart(hostPage);
    await waitForSummonerWarsUI(hostPage, 30000);
    await waitForSummonerWarsUI(guestPage, 30000);
    await hostGame.screenshot('selection-game-started', testInfo);

    await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible();
    await expect(hostPage.getByTestId('sw-hand-area')).toBeVisible();
    await expect(hostPage.getByTestId('sw-map-container')).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test('ui stability keeps end-phase locked for waiting player', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await createSummonerWarsMatch(browser, baseURL, 'necromancer', 'trickster');

    if (!setup) {
      test.skip(true, 'Game server unavailable or room creation failed');
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup!;
    const guestGame = new GameTestContext(guestPage);

    await expect(hostPage.getByTestId('sw-end-phase')).toBeEnabled();
    await expect(guestPage.getByTestId('sw-end-phase')).toBeDisabled();
    await expect(guestPage.getByTestId('sw-action-banner')).toContainText(/等待对手|Waiting for opponent/i);
    await guestGame.screenshot('ui-guest-turn-locked', testInfo);

    await hostContext.close();
    await guestContext.close();
  });
});
