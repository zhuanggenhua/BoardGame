/**
 * SummonerWars E2E 测试专用工具函数
 *
 * 包含：API 创建对局、阵营选择（dispatch 命令）、调试面板操作、阶段推进。
 * 通用函数（locale/audio/storage/server）从 ./common 导入。
 */

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  initContext,
  getGameServerBaseURL,
  ensureGameServerAvailable,
  waitForMatchAvailable,
  seedMatchCredentials,
  joinMatchViaAPI,
} from './common';

export const GAME_NAME = 'summonerwars';

// ============================================================================
// SW 专用上下文初始化
// ============================================================================

/** 禁用 SW 自动跳过阶段（调试用） */
export const disableSummonerWarsAutoSkip = async (context: BrowserContext) => {
  await context.addInitScript(() => {
    (window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean }).__SW_DISABLE_AUTO_SKIP__ = true;
  });
};

/** 对 BrowserContext 执行 SW 标准初始化（通用 + 禁用自动跳过） */
export const initSWContext = async (context: BrowserContext, storageKey?: string) => {
  await initContext(context, { storageKey });
  await disableSummonerWarsAutoSkip(context);
};

// ============================================================================
// API 创建对局
// ============================================================================

/** 通过 API 创建 SW 房间并注入凭据，返回 matchID */
export const createSWRoomViaAPI = async (page: Page): Promise<string | null> => {
  try {
    const guestId = `sw_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    // 注入 guestId 到 localStorage
    await page.addInitScript(
      (id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
        document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
      },
      guestId,
    );

    const base = getGameServerBaseURL();
    const res = await page.request.post(`${base}/games/${GAME_NAME}/create`, {
      data: { numPlayers: 2, setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' } },
    });
    if (!res.ok()) return null;
    const resData = (await res.json().catch(() => null)) as { matchID?: string } | null;
    const matchID = resData?.matchID;
    if (!matchID) return null;

    // claim-seat 占座
    const claimRes = await page.request.post(`${base}/games/${GAME_NAME}/${matchID}/claim-seat`, {
      data: { playerID: '0', playerName: 'Host-SW-E2E', guestId },
    });
    if (!claimRes.ok()) return null;
    const claimData = (await claimRes.json().catch(() => null)) as { playerCredentials?: string } | null;
    const credentials = claimData?.playerCredentials;
    if (!credentials) return null;

    await seedMatchCredentials(page, GAME_NAME, matchID, '0', credentials);
    return matchID;
  } catch {
    return null;
  }
};

/**
 * 通过 UI 创建 SW 房间（旧版兼容）
 * 导航到首页，点击创建房间，返回 matchID
 */
export const createSummonerWarsRoom = async (page: Page): Promise<string | null> => {
  try {
    await page.goto('/?game=summonerwars', { waitUntil: 'domcontentloaded' });
    // 等待游戏卡片加载
    await page.waitForSelector('[data-game-id="summonerwars"]', { timeout: 15000 }).catch(() => {});
    
    // 点击游戏卡片打开详情弹窗
    await page.locator('[data-game-id="summonerwars"]').click();
    await page.waitForTimeout(500);
    
    // 点击 "Create Room" 按钮
    const createBtn = page.locator('button').filter({ hasText: /Create Room|创建房间/i });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();
    
    // 等待导航到对局页面
    await page.waitForURL(/\/play\/summonerwars\/match\//, { timeout: 15000 });
    
    // 从 URL 提取 matchID
    const url = page.url();
    const match = url.match(/\/match\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/** 确保 URL 中包含正确的 playerID */
export const ensurePlayerIdInUrl = async (page: Page, expectedPlayerId: string) => {
  const url = page.url();
  if (!url.includes(`playerID=${expectedPlayerId}`)) {
    const newUrl = url.includes('playerID=')
      ? url.replace(/playerID=\d+/, `playerID=${expectedPlayerId}`)
      : `${url}${url.includes('?') ? '&' : '?'}playerID=${expectedPlayerId}`;
    await page.goto(newUrl, { waitUntil: 'domcontentloaded' });
  }
};

/** 通过 UI 点击选择阵营（按索引） */
export const selectFaction = async (page: Page, factionIndex: number) => {
  const factionCards = page.locator('.grid > div');
  await factionCards.nth(factionIndex).click();
};

// ============================================================================
// 棋盘就绪检测
// ============================================================================

/** 隐藏 FAB 菜单（避免遮挡） */
export const disableFabMenu = async (page: Page) => {
  await page.addStyleTag({
    content: '[data-testid="fab-menu"] { pointer-events: none !important; opacity: 0 !important; }',
  }).catch(() => {});
};

/** 等待 SW 棋盘 UI 就绪 */
export const waitForSummonerWarsUI = async (page: Page, timeout = 30000) => {
  await expect(page.getByTestId('sw-action-banner')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout });
  await disableFabMenu(page);
};

/** 等待阵营选择界面出现 */
export const waitForFactionSelection = async (page: Page, timeout = 30000) => {
  await page.waitForFunction(
    () => {
      const h1 = document.querySelector('h1');
      if (h1 && /选择你的阵营|Choose your faction/i.test(h1.textContent ?? '')) return true;
      // 也检查是否已经进入游戏（跳过了选择）
      const banner = document.querySelector('[data-testid="sw-action-banner"]');
      return !!banner;
    },
    { timeout },
  );
};

// ============================================================================
// 阵营选择（通过 dispatch 命令）
// ============================================================================

/**
 * 通过 dispatch 命令完成阵营选择（跳过 UI 交互）。
 * 需要双方页面都已连接到对局。
 */
export const selectFactionsViaDispatch = async (
  hostPage: Page,
  guestPage: Page,
  hostFactionId: string,
  guestFactionId: string,
) => {
  // 等待双方都进入阵营选择界面（确保 socket 已连接）
  await waitForFactionSelection(hostPage);
  await waitForFactionSelection(guestPage);

  // host 选阵营
  await hostPage.evaluate((factionId) => {
    const w = window as Window & { __BG_DISPATCH__?: (type: string, payload: unknown) => void };
    if (w.__BG_DISPATCH__) {
      w.__BG_DISPATCH__('sw:select_faction', { factionId });
    }
  }, hostFactionId);
  await hostPage.waitForTimeout(300);

  // guest 选阵营
  await guestPage.evaluate((factionId) => {
    const w = window as Window & { __BG_DISPATCH__?: (type: string, payload: unknown) => void };
    if (w.__BG_DISPATCH__) {
      w.__BG_DISPATCH__('sw:select_faction', { factionId });
    }
  }, guestFactionId);
  await guestPage.waitForTimeout(300);

  // guest 准备
  await guestPage.evaluate(() => {
    const w = window as Window & { __BG_DISPATCH__?: (type: string, payload: unknown) => void };
    if (w.__BG_DISPATCH__) {
      w.__BG_DISPATCH__('sw:player_ready', {});
    }
  });
  await guestPage.waitForTimeout(300);

  // host 开始游戏
  await hostPage.evaluate(() => {
    const w = window as Window & { __BG_DISPATCH__?: (type: string, payload: unknown) => void };
    if (w.__BG_DISPATCH__) {
      w.__BG_DISPATCH__('sw:host_start_game', {});
    }
  });

  // 等待双方进入游戏
  await waitForSummonerWarsUI(hostPage);
  await waitForSummonerWarsUI(guestPage);
};

/**
 * 通过 UI 点击完成阵营选择（dispatch 失败时的 fallback）。
 */
export const selectFactionsViaUI = async (
  hostPage: Page,
  guestPage: Page,
  hostFactionIndex: number,
  guestFactionIndex: number,
) => {
  const selectionHeading = (page: Page) =>
    page.locator('h1').filter({ hasText: /选择你的阵营|Choose your faction/i });
  await expect(selectionHeading(hostPage)).toBeVisible({ timeout: 20000 });
  await expect(selectionHeading(guestPage)).toBeVisible({ timeout: 20000 });

  const factionCards = (page: Page) => page.locator('.grid > div');
  await factionCards(hostPage).nth(hostFactionIndex).click();
  await hostPage.waitForTimeout(500);
  await factionCards(guestPage).nth(guestFactionIndex).click();
  await guestPage.waitForTimeout(500);

  const readyButton = guestPage.locator('button').filter({ hasText: /准备|Ready/i });
  await expect(readyButton).toBeVisible({ timeout: 5000 });
  await readyButton.click();
  await hostPage.waitForTimeout(500);

  const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game/i });
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await expect(startButton).toBeEnabled({ timeout: 5000 });
  await startButton.click();

  await waitForSummonerWarsUI(hostPage);
  await waitForSummonerWarsUI(guestPage);
};

// ============================================================================
// 调试面板操作
// ============================================================================

/** 打开调试面板 */
export const ensureDebugPanelOpen = async (page: Page) => {
  const panel = page.getByTestId('debug-panel');
  if (await panel.isVisible().catch(() => false)) return;
  await page.getByTestId('debug-toggle').click();
  await expect(panel).toBeVisible({ timeout: 5000 });
};

/** 关闭调试面板 */
export const closeDebugPanelIfOpen = async (page: Page) => {
  const panel = page.getByTestId('debug-panel');
  if (await panel.isVisible().catch(() => false)) {
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeHidden({ timeout: 5000 });
  }
};

/** 切换到调试面板的状态 Tab */
export const ensureDebugStateTab = async (page: Page) => {
  await ensureDebugPanelOpen(page);
  const stateTab = page.getByTestId('debug-tab-state');
  if (await stateTab.isVisible().catch(() => false)) await stateTab.click();
};

/** 读取当前 core 状态 */
export const readCoreState = async (page: Page) => {
  await ensureDebugStateTab(page);
  const raw = await page.getByTestId('debug-state-json').innerText();
  const parsed = JSON.parse(raw);
  return parsed?.core ?? parsed?.G?.core ?? parsed;
};

/** 写入 core 状态（直接传入对象） */
export const applyCoreState = async (page: Page, coreState: unknown) => {
  await ensureDebugStateTab(page);
  const toggleBtn = page.getByTestId('debug-state-toggle-input');
  await toggleBtn.click();
  const input = page.getByTestId('debug-state-input');
  await expect(input).toBeVisible({ timeout: 3000 });
  await input.fill(JSON.stringify(coreState));
  await page.getByTestId('debug-state-apply').click();
  await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};

// ============================================================================
// 阶段操作
// ============================================================================

/** 等待指定阶段 */
export const waitForPhase = async (page: Page, phase: string, timeout = 10000) => {
  await expect.poll(
    () => page.getByTestId('sw-action-banner').getAttribute('data-phase'),
    { timeout },
  ).toBe(phase);
};

/**
 * 从当前阶段自然推进到目标阶段（通过多次点击"结束阶段"）。
 * 这样 sys.phase 和 core.phase 保持同步。
 */
export const advanceToPhase = async (page: Page, targetPhase: string, maxSteps = 6) => {
  const endPhaseBtn = page.getByTestId('sw-end-phase');
  for (let i = 0; i < maxSteps; i++) {
    const currentPhase = await page.getByTestId('sw-action-banner').getAttribute('data-phase');
    console.log(`[advanceToPhase] Step ${i}: currentPhase=${currentPhase}, target=${targetPhase}`);
    
    if (currentPhase === targetPhase) {
      console.log(`[advanceToPhase] Reached target phase: ${targetPhase}`);
      return;
    }
    
    // 检查按钮是否可见且可点击
    const isVisible = await endPhaseBtn.isVisible().catch(() => false);
    const isEnabled = await endPhaseBtn.isEnabled().catch(() => false);
    console.log(`[advanceToPhase] End phase button - visible: ${isVisible}, enabled: ${isEnabled}`);
    
    if (!isVisible || !isEnabled) {
      console.log(`[advanceToPhase] Button not clickable, waiting...`);
      await page.waitForTimeout(500);
      continue;
    }
    
    await endPhaseBtn.click();
    console.log(`[advanceToPhase] Clicked end phase button`);
    
    // 检查是否进入了技能确认模式（阶段 halt）
    // 如果出现了确认/跳过按钮，说明阶段推进被 halt，不要再次点击
    // 注意：必须等待足够时间让 UI 渲染完成
    await page.waitForTimeout(800);
    
    const confirmBtn = page.locator('button').filter({ hasText: /^Confirm$|^确认$/i }).first();
    const skipBtn = page.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
    
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    const skipVisible = await skipBtn.isVisible().catch(() => false);
    
    console.log(`[advanceToPhase] Confirm button visible: ${confirmVisible}, Skip button visible: ${skipVisible}`);
    
    if (confirmVisible || skipVisible) {
      console.log(`[advanceToPhase] Confirm/Skip buttons detected, phase is halted`);
      return;
    }
    
    // 再次检查阶段是否变化
    const newPhase = await page.getByTestId('sw-action-banner').getAttribute('data-phase');
    console.log(`[advanceToPhase] After click, phase changed: ${currentPhase} -> ${newPhase}`);
    
    if (newPhase === currentPhase) {
      console.log(`[advanceToPhase] WARNING: Phase did not advance after click!`);
    }
    
    await page.waitForTimeout(300);
  }
  
  const finalPhase = await page.getByTestId('sw-action-banner').getAttribute('data-phase');
  console.log(`[advanceToPhase] Max steps reached. Final phase: ${finalPhase}, target: ${targetPhase}`);
};

/** 深拷贝状态 */
export const cloneState = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ============================================================================
// 在线对局创建（双人）
// ============================================================================

export interface SWMatchSetup {
  hostPage: Page;
  guestPage: Page;
  hostContext: BrowserContext;
  guestContext: BrowserContext;
  matchId: string;
}

/**
 * 创建 SW 在线双人对局并完成阵营选择。
 * 返回 null 表示服务器不可用或创建失败（调用方应 skip）。
 */
export const setupSWOnlineMatch = async (
  browser: Browser,
  baseURL: string | undefined,
  hostFactionId: string,
  guestFactionId: string,
): Promise<SWMatchSetup | null> => {
  console.log('[DEBUG] Creating match...');
  // 房主上下文
  const hostContext = await browser.newContext({ baseURL });
  await initSWContext(hostContext, '__sw_storage_reset');
  const hostPage = await hostContext.newPage();
  
  // 监听页面错误
  hostPage.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[HOST PAGE ERROR]', msg.text());
    }
  });
  hostPage.on('pageerror', err => {
    console.log('[HOST PAGE EXCEPTION]', err.message);
  });

  // 先导航到首页预热 Vite 模块缓存
  await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
  await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

  if (!(await ensureGameServerAvailable(hostPage))) {
    console.log('[DEBUG] Match creation failed');
    return null;
  }
  console.log('[DEBUG] Game server available');

  const matchId = await createSWRoomViaAPI(hostPage);
  if (!matchId) {
    console.log('[DEBUG] createSWRoomViaAPI failed');
    return null;
  }
  console.log('[DEBUG] Match created:', matchId);

  if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId, 20000))) {
    console.log('[DEBUG] waitForMatchAvailable failed');
    return null;
  }
  console.log('[DEBUG] Match available');

  // 导航到对局页面
  await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

  // 等待 host 先建立连接
  await waitForFactionSelection(hostPage);

  // 客人上下文
  const guestContext = await browser.newContext({ baseURL });
  await initSWContext(guestContext, '__sw_storage_reset_g');
  const guestPage = await guestContext.newPage();

  // guest 也先预热 Vite 模块缓存
  await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
  await guestPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

  const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-SW-E2E');
  if (!guestCredentials) {
    await hostContext.close();
    await guestContext.close();
    return null;
  }
  await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
  await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

  // 通过 dispatch 完成阵营选择
  try {
    await selectFactionsViaDispatch(hostPage, guestPage, hostFactionId, guestFactionId);
  } catch {
    // dispatch 失败时 fallback 到 UI 点击
    // 阵营索引映射：necromancer=0, trickster=1, phoenix_elf=2, goblin=3, frost=4, barbaric=5
    const factionIndexMap: Record<string, number> = {
      necromancer: 0, trickster: 1, phoenix_elf: 2, goblin: 3, frost: 4, barbaric: 5,
    };
    const hostIdx = factionIndexMap[hostFactionId] ?? 0;
    const guestIdx = factionIndexMap[guestFactionId] ?? 0;
    await selectFactionsViaUI(hostPage, guestPage, hostIdx, guestIdx);
  }

  return { hostPage, guestPage, hostContext, guestContext, matchId };
};
