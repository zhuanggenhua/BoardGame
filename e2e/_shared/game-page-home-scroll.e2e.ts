import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';

const viewports = {
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { width: 796, height: 360, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
} as const;

type TutorialGame = 'summonerwars' | 'smashup';

async function createGameContext(browser: Browser, baseURL: string | undefined, viewportName: keyof typeof viewports) {
  const { width, height, ...device } = viewports[viewportName];
  const context = await browser.newContext({ baseURL, viewport: { width, height }, ...device });
  await context.addInitScript(() => {
    (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
  });
  await initContext(context, { storageKey: `__shared_home_scroll_${viewportName}` });
  return context;
}

async function leaveTutorialToHome(page: Page, gameId: TutorialGame) {
  const tutorialPath = gameId === 'summonerwars'
    ? '/play/summonerwars/tutorial'
    : '/play/smashup/tutorial/smashup-basic';
  await page.goto(`${tutorialPath}?homeStyle=classic`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(`[data-game-page][data-game-id="${gameId}"]`).first()).toBeVisible({ timeout: 60000 });
  const chatAction = page.locator('[data-testid="fab-menu"] [data-fab-id="chat"]');
  await expect(chatAction).toBeVisible({ timeout: 30000 });
  await chatAction.click();

  const exitAction = page.locator('[data-testid="fab-menu"] [data-fab-id="exit"]');
  await expect(exitAction).toBeVisible({ timeout: 10000 });
  await exitAction.click();
  const backToLobby = page.getByRole('button', { name: /返回大厅|Back to Lobby/i });
  await expect(backToLobby).toBeVisible({ timeout: 10000 });
  await backToLobby.click();
  await expect(page.locator('a[data-game-id]').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('html')).toHaveAttribute('data-home-entry-style', 'classic');
  if (page.viewportSize()?.width === 796) {
    await page.setViewportSize({ width: 360, height: 796 });
    await expect(page.locator('a[data-game-id]').first()).toBeVisible({ timeout: 30000 });
  }
}

async function readHomeScrollTarget(page: Page) {
  return page.evaluate(() => {
    const documentScroller = document.scrollingElement as HTMLElement | null;
    const documentHasRoom = Boolean(documentScroller
      && documentScroller.scrollHeight > documentScroller.clientHeight + 20);
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('#root, #root *'))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (style.overflowY === 'auto' || style.overflowY === 'scroll')
          && element.scrollHeight > element.clientHeight + 20
          && rect.width > 0
          && rect.height > 0;
      })
      .sort((left, right) => (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight));
    const target = documentHasRoom ? documentScroller : candidates[0];
    if (!target) return null;
    const bounds = documentHasRoom
      ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
      : target.getBoundingClientRect();
    return {
      kind: documentHasRoom ? 'document' : 'element',
      scrollTop: target.scrollTop,
      maxScrollTop: target.scrollHeight - target.clientHeight,
      rect: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      html: {
        gamePage: document.documentElement.getAttribute('data-game-page'),
        gameId: document.documentElement.getAttribute('data-game-id'),
        mobileProfile: document.documentElement.getAttribute('data-mobile-profile'),
      },
      body: {
        gamePage: document.body.getAttribute('data-game-page'),
        gameId: document.body.getAttribute('data-game-id'),
        mobileProfile: document.body.getAttribute('data-mobile-profile'),
      },
      overflow: {
        html: getComputedStyle(document.documentElement).overflowY,
        body: getComputedStyle(document.body).overflowY,
      },
    };
  });
}

async function swipeHomeScroll(page: Page, viewportName: keyof typeof viewports) {
  const initial = await readHomeScrollTarget(page);
  if (!initial) throw new Error('Homepage has no visible vertical scroll container with remaining content');
  const x = initial.rect.left + Math.min(initial.rect.width - 24, initial.rect.width * 0.72);
  const yStart = initial.rect.top + initial.rect.height * 0.82;
  const yEnd = initial.rect.top + initial.rect.height * 0.24;

  if (viewportName === 'mobile') {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y: yStart }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x, y: yStart - 70 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x, y: yEnd }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
      await cdp.detach();
    }
  } else {
    await page.mouse.move(x, yStart);
    await page.mouse.wheel(0, 520);
  }
  await expect.poll(async () => {
    const current = await readHomeScrollTarget(page);
    return (current?.scrollTop ?? initial.scrollTop) - initial.scrollTop;
  }, { timeout: 5000 }).toBeGreaterThan(20);
  return { initial, after: await readHomeScrollTarget(page) };
}

for (const gameId of ['summonerwars', 'smashup'] as const) {
  for (const viewportName of ['desktop', 'mobile'] as const) {
    test(viewportName === 'mobile'
      ? `${gameId} 教程离开后首页触摸可继续滚动`
      : `${gameId} 教程退出后桌面首页游戏状态属性清理`, async ({ browser }, testInfo) => {
      test.setTimeout(120000);
      const baseURL = testInfo.project.use.baseURL as string | undefined;
      const context = await createGameContext(browser, baseURL, viewportName);
      const page = await context.newPage();
      await clearEvidenceScreenshotsForTest(testInfo);
      try {
        await leaveTutorialToHome(page, gameId);
        const homeStyle = await page.locator('html').getAttribute('data-home-entry-style');
        expect(homeStyle).toBe('classic');
        const gameAttrs = await page.evaluate(() => ({
          html: ['data-game-page', 'data-game-id', 'data-mobile-profile'].map((name) => document.documentElement.getAttribute(name)),
          body: ['data-game-page', 'data-game-id', 'data-mobile-profile'].map((name) => document.body.getAttribute(name)),
          overflow: [getComputedStyle(document.documentElement).overflowY, getComputedStyle(document.body).overflowY],
        }));
        expect(gameAttrs.html[0]).toBeNull();
        expect(gameAttrs.html[1]).toBeNull();
        expect(gameAttrs.html[2]).toBeNull();
        expect(gameAttrs.body[0]).toBeNull();
        expect(gameAttrs.body[1]).toBeNull();
        expect(gameAttrs.body[2]).toBeNull();
        expect(gameAttrs.overflow[0]).not.toBe('hidden');
        expect(gameAttrs.overflow[1]).not.toBe('hidden');
        if (viewportName === 'desktop') {
          await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, `${gameId}教程退出后桌面首页属性清理`),
            fullPage: false,
          });
          return;
        }
        const initial = await readHomeScrollTarget(page);
        console.log('[home-scroll-metrics]', JSON.stringify(await page.evaluate(() => {
          const root = document.getElementById('root');
          const rootRect = root?.getBoundingClientRect();
          const metrics = (element: HTMLElement | null) => element ? {
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            scrollTop: element.scrollTop,
            overflowY: getComputedStyle(element).overflowY,
          } : null;
          return {
            viewport: { width: innerWidth, height: innerHeight, scrollY },
            document: metrics(document.scrollingElement as HTMLElement | null),
            html: metrics(document.documentElement),
            body: metrics(document.body),
            root: { metrics: metrics(root), rect: rootRect && { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height } },
            homeStyle: document.documentElement.getAttribute('data-home-entry-style'),
          };
        })));
        expect(initial).not.toBeNull();
        expect(initial!.maxScrollTop).toBeGreaterThan(20);
        expect(initial!.html.gamePage).toBeNull();
        expect(initial!.html.gameId).toBeNull();
        expect(initial!.html.mobileProfile).toBeNull();
        expect(initial!.body.gamePage).toBeNull();
        expect(initial!.body.gameId).toBeNull();
        expect(initial!.body.mobileProfile).toBeNull();
        await page.screenshot({
          path: getEvidenceScreenshotPath(testInfo, `${gameId}教程离开后首页滚动前`),
          fullPage: false,
        });

        const result = await swipeHomeScroll(page, viewportName);
        expect(result.after!.scrollTop).toBeGreaterThan(result.initial.scrollTop + 20);
        expect(result.after!.overflow.html).not.toBe('hidden');
        expect(result.after!.overflow.body).not.toBe('hidden');
        await page.screenshot({
          path: getEvidenceScreenshotPath(testInfo, `${gameId}教程离开后首页真实滚动结果`),
          fullPage: false,
        });
      } catch (error) {
        console.log('[custom-home-failure-metrics]', JSON.stringify(await page.evaluate(() => {
          const metrics = (element: HTMLElement | null) => element ? {
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            scrollTop: element.scrollTop,
            overflowY: getComputedStyle(element).overflowY,
          } : null;
          const root = document.getElementById('root');
          const rect = root?.getBoundingClientRect();
          return {
            viewport: { width: innerWidth, height: innerHeight, scrollY },
            url: location.href,
            homeStyle: document.documentElement.getAttribute('data-home-entry-style'),
            document: metrics(document.scrollingElement as HTMLElement | null),
            html: metrics(document.documentElement),
            body: metrics(document.body),
            root: { metrics: metrics(root), rect: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height } },
          };
        })));
        await page.screenshot({ path: testInfo.outputPath('actual-custom-page-failure.png'), fullPage: false });
        throw error;
      } finally {
        await context.close();
      }
    });
  }
}
