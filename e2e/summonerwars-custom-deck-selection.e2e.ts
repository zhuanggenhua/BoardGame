/**
 * 召唤师战争 - 自定义牌组选择 E2E 测试
 *
 * 覆盖场景：
 * 1. 显示已保存的自定义牌组（最多 2 个）
 * 2. 选择自定义牌组进入对局
 * 3. 编辑已保存的自定义牌组
 * 4. 创建新的自定义牌组
 */

import { test, expect } from '@playwright/test';
import {
  initContext,
  ensureGameServerAvailable,
} from './helpers/common';
import {
  createSWRoomViaAPI,
  waitForFactionSelection,
  GAME_NAME,
} from './helpers/summonerwars';

/**
 * 注入自定义牌组测试数据到 BrowserContext
 * @param context Playwright BrowserContext
 * @param decks 测试牌组数据
 */
async function injectCustomDeckTestData(context: any, decks: any[]) {
  await context.addInitScript((testDecks: any[]) => {
    (window as any).__TEST_CUSTOM_DECKS__ = testDecks;
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'test-user-id',
      username: 'test-user',
      email: 'test@example.com',
    }));
    console.log('[E2E Test] Injected test data:', testDecks.length, 'decks');
    console.log('[E2E Test] Set auth token:', localStorage.getItem('auth_token'));
    console.log('[E2E Test] Set auth user:', localStorage.getItem('auth_user'));
  }, decks);
}

test.describe('SummonerWars 自定义牌组选择', () => {

  test('应该显示已保存的自定义牌组（最多 2 个）', async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__sw_custom_deck_test' });
    
    // 在创建页面前注入测试数据
    await hostContext.addInitScript(() => {
      (window as any).__TEST_CUSTOM_DECKS__ = [
        {
          id: 'test-deck-1',
          name: '测试牌组1',
          summonerFaction: 'phoenix_elves',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'test-deck-2',
          name: '测试牌组2',
          summonerFaction: 'tundra_orcs',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];
    });
    
    const hostPage = await hostContext.newPage();

    // 预热 Vite 模块缓存
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) test.skip(true, 'Room creation failed');

    // 导航到对局页面
    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);

    // 添加调试日志
    await hostPage.evaluate(() => {
      console.log('[E2E Test] Page loaded, checking data...');
      console.log('[E2E Test] __TEST_CUSTOM_DECKS__:', (window as any).__TEST_CUSTOM_DECKS__);
      console.log('[E2E Test] auth_token:', localStorage.getItem('auth_token'));
    });

    // 等待自定义牌组卡片加载（增加等待时间）
    await hostPage.waitForTimeout(2000);

    // 验证显示了 2 个自定义牌组卡片
    const customDeckCards = hostPage.locator('[data-testid^="custom-deck-card-"]');
    await expect(customDeckCards).toHaveCount(2, { timeout: 10000 });

    // 验证牌组名称正确显示
    await expect(hostPage.getByText('测试牌组1')).toBeVisible();
    await expect(hostPage.getByText('测试牌组2')).toBeVisible();

    // 验证 DIY 徽章显示
    const diyBadges = hostPage.locator('text=DIY');
    await expect(diyBadges).toHaveCount(2);

    // 验证"+"按钮不显示（因为已有 2 个牌组）
    await expect(hostPage.getByText(/新建牌组|New Deck/i)).not.toBeVisible();

    await hostPage.screenshot({ path: testInfo.outputPath('sw-custom-deck-list.png') });

    await hostContext.close();
  });

  test('应该在自定义牌组数量 < 2 时显示"+"按钮', async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__sw_custom_deck_test_2' });
    const hostPage = await hostContext.newPage();

    // 注入测试数据（只有 1 个牌组）
    await hostContext.addInitScript(() => {
      (window as any).__TEST_CUSTOM_DECKS__ = [
        {
          id: 'test-deck-1',
          name: '测试牌组1',
          summonerFaction: 'phoenix_elves',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];
    });

    // Mock 只返回 1 个牌组
    await hostContext.route('**/api/custom-decks', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'test-deck-1',
              name: '测试牌组1',
              summonerFaction: 'phoenix_elves',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ]),
        });
      }
    });

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) test.skip(true, 'Room creation failed');

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);
    await hostPage.waitForTimeout(1000);

    // 验证显示了 1 个自定义牌组卡片
    const customDeckCards = hostPage.locator('[data-testid^="custom-deck-card-"]');
    await expect(customDeckCards).toHaveCount(1, { timeout: 5000 });

    // 验证"+"按钮显示
    await expect(hostPage.getByText(/新建牌组|New Deck/i)).toBeVisible();

    await hostPage.screenshot({ path: testInfo.outputPath('sw-custom-deck-with-new-button.png') });

    await hostContext.close();
  });

  test('应该能选择自定义牌组并高亮显示', async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__sw_custom_deck_test_3' });
    
    // 注入测试数据
    await injectCustomDeckTestData(hostContext, [
      {
        id: 'test-deck-1',
        name: '测试牌组1',
        summonerFaction: 'phoenix_elves',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'test-deck-2',
        name: '测试牌组2',
        summonerFaction: 'tundra_orcs',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]);
    
    // Mock 获取单个牌组详情（用于选择牌组时）
    await hostContext.route('**/api/custom-decks/*', async (route) => {
      const url = new URL(route.request().url());
      const deckId = url.pathname.split('/').pop();

      if (deckId === 'test-deck-1') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-deck-1',
            name: '测试牌组1',
            summonerFaction: 'phoenix_elves',
            summonerId: 'phoenix_elves_summoner',
            champions: [],
            commons: [],
            events: [],
          }),
        });
      } else if (deckId === 'test-deck-2') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-deck-2',
            name: '测试牌组2',
            summonerFaction: 'tundra_orcs',
            summonerId: 'tundra_orcs_summoner',
            champions: [],
            commons: [],
            events: [],
          }),
        });
      }
    });
    
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) test.skip(true, 'Room creation failed');

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);
    await hostPage.waitForTimeout(1000);

    // 点击第一个自定义牌组卡片
    const firstDeckCard = hostPage.locator('[data-testid="custom-deck-card-test-deck-1"]');
    await expect(firstDeckCard).toBeVisible({ timeout: 5000 });
    await firstDeckCard.click();
    
    // 等待状态更新
    await hostPage.waitForTimeout(1000);

    // 验证卡片高亮显示（检查边框颜色变化）
    await expect(firstDeckCard).toHaveClass(/border-amber-400/, { timeout: 3000 });

    await hostPage.screenshot({ path: testInfo.outputPath('sw-custom-deck-selected.png') });

    await hostContext.close();
  });

  test('应该能点击编辑按钮打开牌组构建器', async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__sw_custom_deck_test_4' });
    
    // 注入测试数据
    await injectCustomDeckTestData(hostContext, [
      {
        id: 'test-deck-1',
        name: '测试牌组1',
        summonerFaction: 'phoenix_elves',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'test-deck-2',
        name: '测试牌组2',
        summonerFaction: 'tundra_orcs',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]);
    
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) test.skip(true, 'Room creation failed');

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);
    await hostPage.waitForTimeout(1000);

    // Hover 第一个自定义牌组卡片以显示编辑按钮
    const firstDeckCard = hostPage.locator('[data-testid="custom-deck-card-test-deck-1"]');
    await expect(firstDeckCard).toBeVisible({ timeout: 5000 });
    await firstDeckCard.hover();
    await hostPage.waitForTimeout(800); // 等待 opacity 动画完成

    // 点击编辑按钮（使用 title 属性定位）
    const editButton = firstDeckCard.locator('button[title*="编辑"], button[title*="Edit"]');
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();
    await hostPage.waitForTimeout(500);

    // 验证牌组构建器打开
    await expect(hostPage.getByTestId('deck-builder-drawer')).toBeVisible({ timeout: 5000 });

    // 验证正在编辑的牌组 ID 正确传递
    await expect(hostPage.getByTestId('editing-deck-id')).toHaveText('test-deck-1');

    await hostPage.screenshot({ path: testInfo.outputPath('sw-custom-deck-edit.png') });

    await hostContext.close();
  });

  test('应该能点击"+"按钮打开牌组构建器（新建模式）', async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__sw_custom_deck_test_5' });
    const hostPage = await hostContext.newPage();

    // Mock 只返回 1 个牌组
    await hostContext.route('**/api/custom-decks', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'test-deck-1',
              name: '测试牌组1',
              summonerFaction: 'phoenix_elves',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ]),
        });
      }
    });

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) test.skip(true, 'Room creation failed');

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);
    await hostPage.waitForTimeout(1000);

    // 点击"+"按钮
    const newDeckButton = hostPage.getByText(/新建牌组|New Deck/i).locator('..');
    await expect(newDeckButton).toBeVisible({ timeout: 5000 });
    await newDeckButton.click();
    await hostPage.waitForTimeout(500);

    // 验证牌组构建器打开
    await expect(hostPage.getByTestId('deck-builder-drawer')).toBeVisible({ timeout: 5000 });

    // 验证没有传递 editing-deck-id（新建模式）
    await expect(hostPage.getByTestId('editing-deck-id')).not.toBeVisible();

    await hostPage.screenshot({ path: testInfo.outputPath('sw-custom-deck-new.png') });

    await hostContext.close();
  });

  test('应该保持 4 列网格布局', async ({ browser }, testInfo) => {
    test.setTimeout(60000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__sw_custom_deck_test_6' });
    
    // 在创建页面前注入测试数据
    await hostContext.addInitScript(() => {
      (window as any).__TEST_CUSTOM_DECKS__ = [
        {
          id: 'test-deck-1',
          name: '测试牌组1',
          summonerFaction: 'phoenix_elves',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'test-deck-2',
          name: '测试牌组2',
          summonerFaction: 'tundra_orcs',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];
    });
    // Mock 获取单个牌组详情（用于选择牌组时）
    await hostContext.route('**/api/custom-decks/*', async (route) => {
      const url = new URL(route.request().url());
      const deckId = url.pathname.split('/').pop();

      if (deckId === 'test-deck-1') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-deck-1',
            name: '测试牌组1',
            summonerFaction: 'phoenix_elves',
            summonerId: 'phoenix_elves_summoner',
            champions: [],
            commons: [],
            events: [],
          }),
        });
      } else if (deckId === 'test-deck-2') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-deck-2',
            name: '测试牌组2',
            summonerFaction: 'tundra_orcs',
            summonerId: 'tundra_orcs_summoner',
            champions: [],
            commons: [],
            events: [],
          }),
        });
      }
    });

    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
      test.skip(true, 'Game server unavailable');
    }

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) test.skip(true, 'Room creation failed');

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);
    await hostPage.waitForTimeout(1000);

    // 验证网格布局
    const grid = hostPage.locator('.grid-cols-4');
    await expect(grid).toBeVisible();

    // 验证最大宽度
    const gridWithMaxWidth = hostPage.locator('.max-w-\\[72vw\\]');
    await expect(gridWithMaxWidth).toBeVisible();

    // 验证卡片总数（6 个默认阵营 + 2 个自定义牌组 = 8 个）
    const allCards = grid.locator('> div');
    await expect(allCards).toHaveCount(8, { timeout: 5000 });

    await hostPage.screenshot({ path: testInfo.outputPath('sw-custom-deck-grid-layout.png') });

    await hostContext.close();
  });
});
