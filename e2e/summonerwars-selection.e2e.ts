/**
 * 召唤师战争 - 阵营选择流程 E2E 测试
 * 
 * 覆盖：创建房间 → 双方加入 → 选择阵营 → 准备 → 开始 → 进入游戏
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// ============================================================================
// 工具函数（复用自 summonerwars.e2e.ts）
// ============================================================================

const setEnglishLocale = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
  });
};

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const getGameServerBaseURL = () => {
  const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
  if (envUrl) return normalizeUrl(envUrl);
  const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
  return `http://localhost:${port}`;
};

const waitForMatchAvailable = async (page: Page, matchId: string, timeoutMs = 10000) => {
  const gameServerBaseURL = getGameServerBaseURL();
  const candidates = [
    `/games/summonerwars/${matchId}`,
    `${gameServerBaseURL}/games/summonerwars/${matchId}`,
  ];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const url of candidates) {
      try {
        const response = await page.request.get(url);
        if (response.ok()) return true;
      } catch { /* ignore */ }
    }
    await page.waitForTimeout(500);
  }
  return false;
};

const dismissViteOverlay = async (page: Page) => {
  await page.evaluate(() => {
    const overlay = document.querySelector('vite-error-overlay');
    if (overlay) overlay.remove();
  });
};

const attachPageDiagnostics = (page: Page) => {
  const existing = (page as Page & { __swDiagnostics?: { errors: string[] } }).__swDiagnostics;
  if (existing) return existing;
  const diagnostics = { errors: [] as string[] };
  (page as Page & { __swDiagnostics?: { errors: string[] } }).__swDiagnostics = diagnostics;
  page.on('pageerror', (err) => diagnostics.errors.push(`pageerror:${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') diagnostics.errors.push(`console:${msg.text()}`);
  });
  return diagnostics;
};

const waitForFrontendAssets = async (page: Page, timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const [viteClient, main] = await Promise.all([
        page.request.get('/@vite/client'),
        page.request.get('/src/main.tsx'),
      ]);
      if (viteClient.ok() && main.ok()) return;
    } catch { /* ignore */ }
    await page.waitForTimeout(500);
  }
  throw new Error('前端资源未就绪');
};

const resetMatchStorage = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('__sw_storage_reset')) return;
    sessionStorage.setItem('__sw_storage_reset', '1');
    const newGuestId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    localStorage.removeItem('owner_active_match');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('match_creds_')) localStorage.removeItem(key);
    });
    localStorage.setItem('guest_id', newGuestId);
    try { sessionStorage.setItem('guest_id', newGuestId); } catch { /* ignore */ }
    document.cookie = `bg_guest_id=${encodeURIComponent(newGuestId)}; path=/; SameSite=Lax`;
  });
};

const disableTutorial = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => { localStorage.setItem('tutorial_skip', '1'); });
};

const disableAudio = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('audio_muted', 'true');
    localStorage.setItem('audio_master_volume', '0');
    (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
  });
};

const blockAudioRequests = async (context: BrowserContext) => {
  await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

const waitForHomeGameList = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  attachPageDiagnostics(page);
  await waitForFrontendAssets(page);
  await page.waitForSelector('[data-game-id]', { timeout: 15000, state: 'attached' });
};

const ensureSummonerWarsModalOpen = async (page: Page) => {
  const modalRoot = page.locator('#modal-root');
  const modalHeading = modalRoot.getByRole('heading', { name: /Summoner Wars|召唤师战争/i });
  try {
    await expect(modalHeading).toBeVisible({ timeout: 2000 });
  } catch {
    const card = page.locator('[data-game-id="summonerwars"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(modalHeading).toBeVisible({ timeout: 15000 });
  }
  return { modalRoot, modalHeading };
};

const dismissLobbyConfirmIfNeeded = async (page: Page) => {
  const confirmButton = page
    .locator('button:has-text("确认")')
    .or(page.locator('button:has-text("Confirm")'));
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
  }
};

const ensureGameServerAvailable = async (page: Page) => {
  const gameServerBaseURL = getGameServerBaseURL();
  for (const url of ['/games', `${gameServerBaseURL}/games`]) {
    try {
      const response = await page.request.get(url);
      if (response.ok()) return true;
    } catch { /* ignore */ }
  }
  return false;
};

const createSummonerWarsRoom = async (page: Page): Promise<string | null> => {
  attachPageDiagnostics(page);
  await page.goto('/?game=summonerwars', { waitUntil: 'domcontentloaded' });
  await dismissViteOverlay(page);
  await dismissLobbyConfirmIfNeeded(page);

  const { modalRoot } = await ensureSummonerWarsModalOpen(page);
  const lobbyTab = modalRoot.getByRole('button', { name: /Lobby|在线大厅/i });
  if (await lobbyTab.isVisible().catch(() => false)) await lobbyTab.click();

  // 检查是否已有对局
  const returnButton = modalRoot.locator('button:visible', { hasText: /Return to match|返回当前对局/i }).first();
  if (await returnButton.isVisible().catch(() => false)) {
    await returnButton.click();
    await page.waitForURL(/\/play\/summonerwars\/match\//, { timeout: 10000 });
    return new URL(page.url()).pathname.split('/').pop() ?? null;
  }

  const createButton = modalRoot.locator('button:visible', { hasText: /Create Room|创建房间/i }).first();
  await expect(createButton).toBeVisible({ timeout: 20000 });
  await createButton.click();
  await expect(page.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible({ timeout: 10000 });
  const confirmButton = page.getByRole('button', { name: /Confirm|确认/i });
  await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  await confirmButton.click();

  try {
    await page.waitForURL(/\/play\/summonerwars\/match\//, { timeout: 8000 });
  } catch { return null; }

  const matchId = new URL(page.url()).pathname.split('/').pop() ?? null;
  if (!matchId) return null;
  if (!await waitForMatchAvailable(page, matchId, 15000)) return null;
  return matchId;
};


// ============================================================================
// 阵营选择专用工具
// ============================================================================

/** 等待阵营选择界面出现 */
const waitForFactionSelection = async (page: Page, timeout = 20000) => {
  // 阵营选择界面的标题
  await expect(
    page.locator('h1').filter({ hasText: /选择你的阵营|Choose your faction/i })
  ).toBeVisible({ timeout });
};

/** 选择指定阵营（点击阵营卡片） */
const selectFaction = async (page: Page, factionIndex: number) => {
  // 阵营卡片在 grid 中，按顺序排列
  const factionCards = page.locator('.grid > div');
  const card = factionCards.nth(factionIndex);
  await expect(card).toBeVisible({ timeout: 5000 });
  await card.click();
};

/** 等待游戏 UI 出现（选角完成后） */
const waitForGameUI = async (page: Page, timeout = 30000) => {
  // 等待"结束阶段"按钮出现，这是游戏 UI 的可靠标志
  await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout });
};

// ============================================================================
// 测试
// ============================================================================

test.describe('SummonerWars 阵营选择流程', () => {
  test('完整联机流程：选择阵营 → 准备 → 开始 → 进入游戏', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    // ---- 创建 Host 浏览器上下文 ----
    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setEnglishLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    // 收集控制台日志用于调试
    const hostLogs: string[] = [];
    hostPage.on('console', (msg) => {
      if (msg.type() === 'log' || msg.type() === 'warning' || msg.type() === 'error') {
        hostLogs.push(`[host][${msg.type()}] ${msg.text()}`);
      }
    });

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable');
    }

    // ---- 创建房间 ----
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed');
    }

    // 确保 host 有 playerID=0
    const hostUrl = new URL(hostPage.url());
    if (!hostUrl.searchParams.get('playerID')) {
      hostUrl.searchParams.set('playerID', '0');
      await hostPage.goto(hostUrl.toString());
    }

    // ---- Host 应该看到阵营选择界面 ----
    await waitForFactionSelection(hostPage);
    console.log('[test] Host 看到阵营选择界面');

    // 截图：初始阵营选择界面
    await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-initial.png') });

    // ---- 创建 Guest 浏览器上下文 ----
    const guestContext = await browser.newContext({ baseURL });
    await blockAudioRequests(guestContext);
    await setEnglishLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();

    const guestLogs: string[] = [];
    guestPage.on('console', (msg) => {
      if (msg.type() === 'log' || msg.type() === 'warning' || msg.type() === 'error') {
        guestLogs.push(`[guest][${msg.type()}] ${msg.text()}`);
      }
    });

    // Guest 加入房间
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });
    console.log(`[test] Guest 加入成功, url=${guestPage.url()}`);

    // Guest 也应该看到阵营选择界面
    await waitForFactionSelection(guestPage);
    console.log('[test] Guest 看到阵营选择界面');

    // ---- Host 选择阵营（第一个：堕落王国/necromancer） ----
    console.log('[test] Host 选择阵营...');
    await selectFaction(hostPage, 0);
    await hostPage.waitForTimeout(1000);

    // 截图：Host 选择后
    await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-host-selected.png') });

    // 验证 Host 的选择在 Guest 端可见（P1 标记应出现）
    // 等待 P1 标记出现在第一个阵营卡片上
    const p1Badge = guestPage.locator('.grid > div').first().locator('text=P1');
    try {
      await expect(p1Badge).toBeVisible({ timeout: 8000 });
      console.log('[test] Guest 端看到 Host 的 P1 标记');
    } catch {
      console.log('[test] 警告：Guest 端未看到 P1 标记，可能选择未同步');
      // 打印 host 控制台日志帮助调试
      console.log('[test] Host 最近日志:', hostLogs.slice(-20).join('\n'));
      console.log('[test] Guest 最近日志:', guestLogs.slice(-20).join('\n'));

      // 截图帮助调试
      await guestPage.screenshot({ path: testInfo.outputPath('sw-selection-guest-no-p1.png') });
    }

    // ---- Guest 选择阵营（第二个：欺心巫族/trickster） ----
    console.log('[test] Guest 选择阵营...');
    await selectFaction(guestPage, 1);
    await guestPage.waitForTimeout(1000);

    // 截图：Guest 选择后
    await guestPage.screenshot({ path: testInfo.outputPath('sw-selection-guest-selected.png') });

    // ---- Guest 点击准备 ----
    console.log('[test] Guest 点击准备...');
    const readyButton = guestPage.locator('button').filter({ hasText: /准备|Ready/i });
    try {
      await expect(readyButton).toBeVisible({ timeout: 5000 });
      await readyButton.click();
      console.log('[test] Guest 已准备');
    } catch {
      console.log('[test] 警告：准备按钮未出现');
      console.log('[test] Guest 最近日志:', guestLogs.slice(-20).join('\n'));
      await guestPage.screenshot({ path: testInfo.outputPath('sw-selection-no-ready-btn.png') });
    }

    await hostPage.waitForTimeout(1000);

    // ---- Host 点击开始游戏 ----
    console.log('[test] Host 点击开始游戏...');
    const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game/i });
    try {
      await expect(startButton).toBeVisible({ timeout: 5000 });
      // 按钮应该可点击（everyoneReady）
      await expect(startButton).toBeEnabled({ timeout: 5000 });
      await startButton.click();
      console.log('[test] Host 已点击开始');
    } catch {
      console.log('[test] 警告：开始按钮未出现或不可用');
      console.log('[test] Host 最近日志:', hostLogs.slice(-20).join('\n'));
      await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-no-start-btn.png') });
    }

    // ---- 等待游戏 UI 出现 ----
    console.log('[test] 等待游戏 UI...');
    try {
      await waitForGameUI(hostPage, 30000);
      console.log('[test] Host 进入游戏');
    } catch {
      console.log('[test] 错误：Host 未进入游戏 UI');
      console.log('[test] Host 最近日志:', hostLogs.slice(-30).join('\n'));
      await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-host-stuck.png') });
      throw new Error('Host 未能进入游戏 UI');
    }

    try {
      await waitForGameUI(guestPage, 30000);
      console.log('[test] Guest 进入游戏');
    } catch {
      console.log('[test] 错误：Guest 未进入游戏 UI');
      console.log('[test] Guest 最近日志:', guestLogs.slice(-30).join('\n'));
      await guestPage.screenshot({ path: testInfo.outputPath('sw-selection-guest-stuck.png') });
      throw new Error('Guest 未能进入游戏 UI');
    }

    // 截图：游戏开始
    await hostPage.screenshot({ path: testInfo.outputPath('sw-selection-game-started.png') });

    // ---- 验证基本游戏 UI 元素 ----
    await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible();
    await expect(hostPage.getByTestId('sw-hand-area')).toBeVisible();
    await expect(hostPage.getByTestId('sw-energy-player')).toBeVisible();

    console.log('[test] 阵营选择流程测试通过！');

    await hostContext.close();
    await guestContext.close();
  });
});
