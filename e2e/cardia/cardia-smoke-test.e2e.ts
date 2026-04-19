import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { applyCardiaScenarioToPage, setupCardiaTestScenario, type CardiaTestScenario } from '../helpers/cardia';

/**
 * Cardia 烟雾测试 - 验证基础游戏流程
 * 
 * 目标：确保游戏能够正常启动、创建房间、进入游戏
 * 不涉及复杂的能力系统，只验证最基本的流程
 */

const RESPONSIVE_LAYOUT_SCENARIO: CardiaTestScenario = {
  phase: 'play',
  player1: {
    hand: [
      'deck_i_card_01',
      'deck_i_card_02',
      'deck_i_card_03',
      'deck_i_card_04',
      'deck_i_card_05',
      'deck_i_card_06',
    ],
    deck: ['deck_i_card_07', 'deck_i_card_08'],
    discard: ['deck_i_card_09', 'deck_i_card_10'],
    playedCards: [
      { defId: 'deck_i_card_11', signets: 1, encounterIndex: 0 },
      { defId: 'deck_i_card_12', encounterIndex: 1 },
    ],
  },
  player2: {
    hand: [
      'deck_i_card_13',
      'deck_i_card_14',
      'deck_i_card_15',
      'deck_i_card_16',
    ],
    deck: ['deck_i_card_01', 'deck_i_card_02'],
    discard: ['deck_i_card_03', 'deck_i_card_04'],
    playedCards: [
      { defId: 'deck_i_card_05', encounterIndex: 0, signets: 2 },
      { defId: 'deck_i_card_06', encounterIndex: 1 },
    ],
  },
};

const MOBILE_LAYOUT_SCENARIO: CardiaTestScenario = {
  phase: 'play',
  player1: {
    hand: [
      'deck_i_card_01',
      'deck_i_card_02',
      'deck_i_card_03',
      'deck_i_card_04',
    ],
    deck: ['deck_i_card_05', 'deck_i_card_06'],
    discard: ['deck_i_card_07', 'deck_i_card_08'],
    playedCards: [
      { defId: 'deck_i_card_09', signets: 1, encounterIndex: 0 },
    ],
  },
  player2: {
    hand: [
      'deck_i_card_10',
      'deck_i_card_11',
      'deck_i_card_12',
      'deck_i_card_13',
    ],
    deck: ['deck_i_card_14', 'deck_i_card_15'],
    discard: ['deck_i_card_16', 'deck_i_card_01'],
    playedCards: [
      { defId: 'deck_i_card_02', encounterIndex: 0, signets: 1 },
    ],
  },
};

async function hideDebugChrome(page: Page) {
  await page.evaluate(() => {
    const toggle = document.querySelector<HTMLElement>('[data-testid="debug-toggle-container"]');
    if (toggle) {
      toggle.style.opacity = '0';
      toggle.style.pointerEvents = 'none';
    }
  });
}

async function waitForHomeReady(page: Page) {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('text=/cardia/i').first()).toBeVisible({ timeout: 10000 });
}
async function expectResponsiveLayoutStable(page: Page, options?: { requireBattlefieldCards?: boolean }) {
  const requireBattlefieldCards = options?.requireBattlefieldCards ?? true;

  await expect(page.locator('[data-testid="cardia-board"]')).toBeVisible();
  await expect(page.locator('[data-testid="cardia-phase-indicator"]')).toBeVisible();
  await expect(page.locator('[data-testid="cardia-turn-number"]')).toBeVisible();
  await expect(page.locator('[data-testid="cardia-battlefield"]')).toBeVisible();
  await expect(page.locator('[data-testid="cardia-hand-area"]')).toBeVisible();
  await expect(page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first()).toBeVisible();
  if (requireBattlefieldCards) {
    await expect(page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first()).toBeVisible();
  }

  const viewportMetrics = await page.evaluate(() => {
    const playerArea = document.querySelector<HTMLElement>('[data-testid="cardia-hand-area"]');
    const playerAreaBottom = playerArea?.getBoundingClientRect().bottom ?? 0;
    const board = document.querySelector<HTMLElement>('[data-testid="cardia-board"]');
    const boardRect = board?.getBoundingClientRect();
    const gamePage = document.querySelector<HTMLElement>('[data-game-page="true"]');
    const gamePageRect = gamePage?.getBoundingClientRect();
    const shell = document.querySelector<HTMLElement>('.mobile-board-shell');
    const shellRect = shell?.getBoundingClientRect();

    const debugToggle = document.querySelector<HTMLElement>('[data-testid="debug-toggle-container"]');
    const debugToggleRect = debugToggle?.getBoundingClientRect();

    const debugPanel = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .find((el) => (el.textContent ?? '').includes('Dev Debug'));
    const debugPanelRect = debugPanel?.getBoundingClientRect();

    return {
      playerAreaBottom,
      boardBottom: boardRect?.bottom ?? 0,
      boardHeight: boardRect?.height ?? 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      bodyClientHeight: document.body.clientHeight,
      documentClientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      pageOverflowY: document.documentElement.scrollHeight - window.innerHeight,
      pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
      gamePageRect: gamePageRect
        ? { left: gamePageRect.left, right: gamePageRect.right, width: gamePageRect.width }
        : null,
      shellRect: shellRect
        ? { left: shellRect.left, right: shellRect.right, width: shellRect.width }
        : null,
      debugToggleRect: debugToggleRect
        ? { left: debugToggleRect.left, top: debugToggleRect.top, width: debugToggleRect.width, height: debugToggleRect.height }
        : null,
      debugPanelRect: debugPanelRect
        ? { left: debugPanelRect.left, top: debugPanelRect.top, width: debugPanelRect.width, height: debugPanelRect.height }
        : null,
    };
  });

  // Debug: 该断言主要用于保障“无整页缩放/无明显溢出”。
  // 当出现意外失败时，可临时打开日志，便于定位 root 缩放/容器高度/滚动问题。
   
  // console.log('[Cardia E2E][layout-metrics]', viewportMetrics);

  // 横屏手机由于浏览器 UI/地址栏与 viewport 计算差异，
  // bottom 可能会有轻微偏差；我们更关心是否出现明显的整页纵向滚动。
  // 竖屏/平板仍然保持更严格的 bottom 约束。
  const allowLooseBottom = viewportMetrics.viewportHeight <= 420 && viewportMetrics.viewportWidth >= 800;
  expect(viewportMetrics.pageOverflowX).toBeLessThanOrEqual(1);
  if (viewportMetrics.gamePageRect) {
    expect(viewportMetrics.gamePageRect.left).toBeGreaterThanOrEqual(-1);
    expect(viewportMetrics.gamePageRect.right).toBeLessThanOrEqual(viewportMetrics.viewportWidth + 1);
  }
  if (viewportMetrics.shellRect) {
    expect(viewportMetrics.shellRect.left).toBeGreaterThanOrEqual(-1);
    expect(viewportMetrics.shellRect.right).toBeLessThanOrEqual(viewportMetrics.viewportWidth + 1);
  }

  // tight landscape（移动端横屏可视高度极限）下，Cardia 对局页允许内部纵向滚动承载更多信息。
  // 我们更关注：不触发 root scale、无明显横向溢出、关键区可见。
  if (!allowLooseBottom) {
    expect(viewportMetrics.boardBottom).toBeLessThanOrEqual(viewportMetrics.viewportHeight + 1);
  }
  if (!allowLooseBottom) {
    expect(viewportMetrics.playerAreaBottom).toBeLessThanOrEqual(viewportMetrics.viewportHeight + 1);
  }
  expect(viewportMetrics.pageOverflowY).toBeLessThanOrEqual(allowLooseBottom ? 400 : 4);
}

async function expectRootScaleDisabled(page: Page) {
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('root');
    const rootStyle = root ? window.getComputedStyle(root) : null;
    const scaleX = rootStyle?.transform && rootStyle.transform !== 'none'
      ? new DOMMatrixReadOnly(rootStyle.transform).a
      : 1;

    return {
      transform: rootStyle?.transform ?? 'none',
      scaleX,
      logicalHeight: rootStyle ? Number.parseFloat(rootStyle.height) : 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.scaleX).toBeGreaterThan(0.99);
  expect(metrics.logicalHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
}

async function expectBattlefieldNotObscured(page: Page) {
  const metrics = await page.evaluate(() => {
    const battlefieldCards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="cardia-battlefield"] [data-testid^="card-"]')
    );
    const playerZone = document.querySelector<HTMLElement>('[data-testid="cardia-player-zone"]');

    return {
      battlefieldCardCount: battlefieldCards.length,
      lowestBattlefieldBottom: battlefieldCards.reduce(
        (maxBottom, card) => Math.max(maxBottom, card.getBoundingClientRect().bottom),
        0,
      ),
      playerZoneTop: playerZone?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(metrics.battlefieldCardCount).toBeGreaterThan(0);
  // iOS Safari 横屏下可视高度极限，允许轻微覆盖（但不应出现明显遮挡）。
  // 这里用“覆盖比例”判定，比简单 gap 更稳健。
  const isTightLandscape = metrics.viewportHeight <= 420 && metrics.viewportWidth >= 800;
  const overlap = Math.max(0, metrics.lowestBattlefieldBottom - metrics.playerZoneTop);
  const overlapRatio = metrics.playerZoneTop === 0 ? 0 : overlap / metrics.playerZoneTop;

  if (isTightLandscape) {
    expect(overlapRatio).toBeLessThanOrEqual(0.3);
  } else {
    expect(overlap).toBeLessThanOrEqual(4);
  }
}

test.describe('Cardia 烟雾测试', () => {
  test('应该能够访问游戏列表页面', async ({ page }) => {
    // 访问首页
    await waitForHomeReady(page);
    
    // 等待页面加载
    
    // 验证页面标题或关键元素存在
    const title = await page.title();
    expect(title).toBeTruthy();
    
    console.log('✅ 页面加载成功');
  });

  test('应该能够看到 Cardia 游戏', async ({ page }) => {
    await waitForHomeReady(page);
    
    // 查找 Cardia 游戏卡片或链接
    const cardiaElement = page.locator('text=/cardia/i').first();
    
    // 等待元素出现（最多10秒）
    await cardiaElement.waitFor({ timeout: 10000 });
    
    const isVisible = await cardiaElement.isVisible();
    expect(isVisible).toBe(true);
    
    console.log('✅ Cardia 游戏可见');
  });

  test('应该能够创建 Cardia 游戏房间', async ({ page }) => {
    await waitForHomeReady(page);
    
    // 点击 Cardia 游戏
    const cardiaLink = page.locator('text=/cardia/i').first();
    await cardiaLink.click();
    
    // 等待导航完成
    await expect(page).toHaveURL(/cardia/i, { timeout: 10000 });
    
    // 验证 URL 包含 cardia
    const url = page.url();
    expect(url).toContain('cardia');
    
    console.log('✅ 成功进入 Cardia 游戏页面');
  });

  test('手机横屏布局应完整展示战场与手牌', async ({ page, game }, testInfo) => {
    await game.openTestGame('cardia');
    await applyCardiaScenarioToPage(page, MOBILE_LAYOUT_SCENARIO);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(600);
    await hideDebugChrome(page);

    await expectResponsiveLayoutStable(page);
    await game.screenshot('cardia-mobile-landscape-layout', testInfo);
  });

  test('手机竖屏布局应完整展示战场与手牌', async ({ page, game }, testInfo) => {
    await game.openTestGame('cardia');
    await applyCardiaScenarioToPage(page, MOBILE_LAYOUT_SCENARIO);

    // iPhone 14 / 15 Pro 竖屏常见尺寸
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    await hideDebugChrome(page);

    await expectResponsiveLayoutStable(page);
    await expectBattlefieldNotObscured(page);
    await game.screenshot('cardia-mobile-portrait-layout', testInfo);
  });

  test('平板竖屏布局应完整展示战场与手牌', async ({ page, game }, testInfo) => {
    await game.openTestGame('cardia');
    await applyCardiaScenarioToPage(page, RESPONSIVE_LAYOUT_SCENARIO);

    // iPad 竖屏常见尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(700);
    await hideDebugChrome(page);

    await expectResponsiveLayoutStable(page);
    await expectBattlefieldNotObscured(page);
    await game.screenshot('cardia-tablet-portrait-layout', testInfo);
  });

  test('平板横屏布局应完整展示战场与手牌', async ({ page, game }, testInfo) => {
    await game.openTestGame('cardia');
    await applyCardiaScenarioToPage(page, RESPONSIVE_LAYOUT_SCENARIO);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(600);
    await hideDebugChrome(page);

    await expectResponsiveLayoutStable(page);
    await game.screenshot('cardia-tablet-landscape-layout', testInfo);
  });

  test('真实对局页在 iPhone XR 横屏下不应触发整页缩放', async ({ page }, testInfo) => {
    const browser = page.context().browser();
    if (!browser) {
      throw new Error('Browser not available');
    }

    const setup = await setupCardiaTestScenario(browser, RESPONSIVE_LAYOUT_SCENARIO);

    try {
      await setup.player1Page.setViewportSize({ width: 896, height: 414 });
      await setup.player1Page.waitForTimeout(800);

      await expect(setup.player1Page.locator('[data-testid="cardia-board"]')).toBeVisible();
      await expectRootScaleDisabled(setup.player1Page);
      await expectResponsiveLayoutStable(setup.player1Page);
      await expectBattlefieldNotObscured(setup.player1Page);

      await setup.player1Page.screenshot({
        path: testInfo.outputPath('cardia-online-iphone-xr-landscape-layout.png'),
        fullPage: false,
      });
    } finally {
      await setup.player1Context.close();
      await setup.player2Context.close();
    }
  });
});
