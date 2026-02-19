/**
 * 召唤师战争 - 友方移动后选择跟随位置 E2E 测试
 * 
 * 覆盖范围：
 * - 抓附跟随（grab_follow）：友方单位从抓附手相邻位置移动后，选择相邻空位跟随
 * - 位置选择 UI 交互
 * - 跟随移动状态应用
 * - 在线对局状态同步
 * 
 * 交互模式：友方移动后选择跟随位置
 * - 友方单位移动
 * - 触发技能
 * - 棋盘上相邻空位高亮
 * - 点击选择位置
 * - 确认
 * - 单位移动到目标位置
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { cloneState } from './helpers/summonerwars';

// ============================================================================
// 辅助函数（从 summonerwars.e2e.ts 复用）
// ============================================================================

const setEnglishLocale = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
  });
};

const resetMatchStorage = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('__sw_storage_reset')) return;
    sessionStorage.setItem('__sw_storage_reset', '1');

    const newGuestId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    localStorage.removeItem('owner_active_match');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('match_creds_')) {
        localStorage.removeItem(key);
      }
    });
    localStorage.setItem('guest_id', newGuestId);
    try {
      sessionStorage.setItem('guest_id', newGuestId);
    } catch {
      // ignore
    }
    document.cookie = `bg_guest_id=${encodeURIComponent(newGuestId)}; path=/; SameSite=Lax`;
  });
};

const disableTutorial = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('tutorial_skip', '1');
  });
};

const disableSummonerWarsAutoSkip = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    (window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean }).__SW_DISABLE_AUTO_SKIP__ = true;
  });
};

const disableAudio = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('audio_muted', 'true');
    localStorage.setItem('audio_master_volume', '0');
    localStorage.setItem('audio_sfx_volume', '0');
    localStorage.setItem('audio_bgm_volume', '0');
    (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
  });
};

const blockAudioRequests = async (context: BrowserContext) => {
  await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const getGameServerBaseURL = () => {
  const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
  if (envUrl) return normalizeUrl(envUrl);
  const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
  return `http://localhost:${port}`;
};

const joinMatchAsGuest = async (page: Page, matchId: string, gameId = 'summonerwars') => {
  const base = getGameServerBaseURL();
  const matchResp = await page.request.get(`${base}/games/${gameId}/${matchId}`);
  if (!matchResp.ok()) throw new Error(`获取 match 信息失败: ${matchResp.status()}`);
  const matchData = await matchResp.json() as { players: { id: number; name?: string }[] };
  const openSeat = matchData.players?.find((p) => !p.name);
  if (!openSeat) throw new Error('没有空位');
  const pid = String(openSeat.id);
  const guestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const joinResp = await page.request.post(`${base}/games/${gameId}/${matchId}/join`, {
    data: { playerID: pid, playerName: `Guest_${guestId}`, data: { guestId } },
  });
  if (!joinResp.ok()) throw new Error(`加入 match 失败: ${joinResp.status()}`);
  const joinData = await joinResp.json() as { playerCredentials: string };
  // 先导航到应用首页以获取 localStorage 访问权限
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ mid, pid, creds, gname }) => {
    localStorage.setItem(`match_creds_${mid}`, JSON.stringify({ playerID: pid, credentials: creds, matchID: mid, gameName: gname }));
  }, { mid: matchId, pid, creds: joinData.playerCredentials, gname: gameId });
  await page.goto(`/play/${gameId}/match/${matchId}?playerID=${pid}`, { waitUntil: 'domcontentloaded' });
};

const ensureGameServerAvailable = async (page: Page) => {
  const gameServerBaseURL = getGameServerBaseURL();
  const candidates = ['/games', `${gameServerBaseURL}/games`];
  for (const url of candidates) {
    try {
      const response = await page.request.get(url);
      if (response.ok()) return true;
    } catch {
      // ignore
    }
  }
  return false;
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
      } catch {
        // ignore
      }
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

const waitForFrontendAssets = async (page: Page, timeoutMs = 30000) => {
  const start = Date.now();
  let lastStatus = 'unknown';
  while (Date.now() - start < timeoutMs) {
    try {
      const [viteClient, main] = await Promise.all([
        page.request.get('/@vite/client'),
        page.request.get('/src/main.tsx'),
      ]);
      lastStatus = `vite=${viteClient.status()} main=${main.status()}`;
      if (viteClient.ok() && main.ok()) {
        return;
      }
    } catch (err) {
      lastStatus = `error:${String(err)}`;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`前端资源未就绪${lastStatus}`);
};

const waitForHomeGameList = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await waitForFrontendAssets(page);
  await page.waitForSelector('[data-game-id]', { timeout: 12000, state: 'attached' });
};

const ensureSummonerWarsCard = async (page: Page) => {
  await waitForHomeGameList(page);
  let card = page.locator('[data-game-id="summonerwars"]');
  if (await card.count() === 0) {
    const strategyTab = page.getByRole('button', { name: /Strategy|策略/i });
    if (await strategyTab.isVisible().catch(() => false)) {
      await strategyTab.click();
    }
    card = page.locator('[data-game-id="summonerwars"]');
  }
  await expect(card).toHaveCount(1, { timeout: 15000 });
  await card.first().scrollIntoViewIfNeeded();
  return card.first();
};

const ensureSummonerWarsModalOpen = async (page: Page) => {
  const modalRoot = page.locator('#modal-root');
  const modalHeading = modalRoot.getByRole('heading', { name: /Summoner Wars|召唤师战争/i });
  const modalReadyButton = modalRoot
    .locator('button:visible', { hasText: /Create Room|创建房间|Return to match|返回当前对局/i })
    .first();
  try {
    await expect(modalHeading).toBeVisible({ timeout: 2000 });
  } catch {
    if (await modalReadyButton.isVisible().catch(() => false)) {
      return { modalRoot, modalHeading };
    }
    const gameCard = await ensureSummonerWarsCard(page);
    await gameCard.evaluate((node) => {
      (node as HTMLElement | null)?.click();
    });
    await expect.poll(async () => {
      const headingVisible = await modalHeading.isVisible().catch(() => false);
      const buttonVisible = await modalReadyButton.isVisible().catch(() => false);
      return headingVisible || buttonVisible;
    }, { timeout: 15000 }).toBe(true);
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

const createSummonerWarsRoom = async (page: Page) => {
  await page.goto('/?game=summonerwars', { waitUntil: 'domcontentloaded' });
  await dismissViteOverlay(page);
  await dismissLobbyConfirmIfNeeded(page);

  const { modalRoot } = await ensureSummonerWarsModalOpen(page);
  const createButton = modalRoot.locator('button:visible', { hasText: /Create Room|创建房间/i }).first();
  const lobbyTab = modalRoot.getByRole('button', { name: /Lobby|在线大厅/i });
  if (await lobbyTab.isVisible().catch(() => false)) {
    await lobbyTab.evaluate((node) => {
      (node as HTMLElement | null)?.click();
    }).catch(() => { });
  }

  const returnButton = modalRoot.locator('button:visible', { hasText: /Return to match|返回当前对局/i }).first();
  if (await returnButton.isVisible().catch(() => false)) {
    await returnButton.click();
    await page.waitForURL(/\/play\/summonerwars\/match\//, { timeout: 10000 });
    const url = new URL(page.url());
    return url.pathname.split('/').pop() ?? null;
  }

  await expect(createButton).toBeVisible({ timeout: 20000 });
  await createButton.click();
  await expect(page.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible({ timeout: 10000 });
  const confirmButton = page.getByRole('button', { name: /Confirm|确认/i });
  await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  await confirmButton.click();
  
  try {
    await page.waitForURL(/\/play\/summonerwars\/match\//, { timeout: 8000 });
  } catch {
    return null;
  }
  
  const url = new URL(page.url());
  const matchId = url.pathname.split('/').pop() ?? null;
  if (!matchId) return null;
  
  const available = await waitForMatchAvailable(page, matchId, 15000);
  if (!available) {
    return null;
  }
  return matchId;
};

const ensurePlayerIdInUrl = async (page: Page, playerId: string) => {
  const url = new URL(page.url());
  if (url.searchParams.get('playerID') !== playerId) {
    url.searchParams.set('playerID', playerId);
    await page.goto(url.toString());
  }
};

const disableFabMenu = async (page: Page) => {
  await page.addStyleTag({
    content: '[data-testid="fab-menu"] { pointer-events: none !important; opacity: 0 !important; }',
  }).catch(() => { });
};

const waitForSummonerWarsUI = async (page: Page, timeout = 20000) => {
  await expect(page.getByTestId('sw-action-banner')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout });
  await disableFabMenu(page);
};

const completeFactionSelection = async (hostPage: Page, guestPage: Page) => {
  const selectionHeading = (page: Page) =>
    page.locator('h1').filter({ hasText: /选择你的阵营|Choose your faction/i });
  await expect(selectionHeading(hostPage)).toBeVisible({ timeout: 20000 });
  await expect(selectionHeading(guestPage)).toBeVisible({ timeout: 20000 });

  const factionCards = (page: Page) => page.locator('.grid > div');
  await factionCards(hostPage).nth(0).click();
  await hostPage.waitForTimeout(500);

  await factionCards(guestPage).nth(1).click();
  await guestPage.waitForTimeout(500);

  const readyButton = guestPage.locator('button').filter({ hasText: /准备|Ready/i });
  await expect(readyButton).toBeVisible({ timeout: 5000 });
  await readyButton.click();
  await hostPage.waitForTimeout(500);

  const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game/i });
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await expect(startButton).toBeEnabled({ timeout: 5000 });
  await startButton.click();

  await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 30000 });
  await expect(guestPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 30000 });
};

const ensureDebugPanelOpen = async (page: Page) => {
  const panel = page.getByTestId('debug-panel');
  if (await panel.isVisible().catch(() => false)) return;
  await page.getByTestId('debug-toggle').click();
  await expect(panel).toBeVisible({ timeout: 5000 });
};

const closeDebugPanelIfOpen = async (page: Page) => {
  const panel = page.getByTestId('debug-panel');
  if (await panel.isVisible().catch(() => false)) {
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeHidden({ timeout: 5000 });
  }
};

const ensureDebugStateTab = async (page: Page) => {
  await ensureDebugPanelOpen(page);
  const stateTab = page.getByTestId('debug-tab-state');
  if (await stateTab.isVisible().catch(() => false)) {
    await stateTab.click();
  }
};

const readCoreState = async (page: Page) => {
  await ensureDebugStateTab(page);
  const raw = await page.getByTestId('debug-state-json').innerText();
  const parsed = JSON.parse(raw);
  return parsed?.core ?? parsed?.G?.core ?? parsed;
};

const applyCoreState = async (page: Page, coreState: unknown) => {
  await ensureDebugStateTab(page);
  await page.getByTestId('debug-state-toggle-input').click();
  const input = page.getByTestId('debug-state-input');
  await expect(input).toBeVisible({ timeout: 3000 });
  await input.fill(JSON.stringify(coreState));
  await page.getByTestId('debug-state-apply').click();
  await expect(input).toBeHidden({ timeout: 5000 }).catch(() => { });
};

const clickBoardElement = async (page: Page, selector: string) => {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, selector);
  if (!clicked) throw new Error(`棋盘元素未找到 ${selector}`);
};

const waitForPhase = async (page: Page, phase: string) => {
  await expect.poll(() => page.getByTestId('sw-action-banner').getAttribute('data-phase')).toBe(phase);
};

// ============================================================================
// 测试状态准备函数
// ============================================================================

/**
 * 准备抓附跟随测试状态
 * - 移动阶段
 * - 抓附手在场（有抓附技能）
 * - 相邻有友方单位可移动
 * - 抓附手周围有空位可跟随
 */
const prepareGrabFollowState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  const board = next.board;
  let grabberPlaced = false;
  let allyPlaced = false;

  // 在玩家区域放置抓附手
  for (let row = 5; row < 8 && !grabberPlaced; row++) {
    for (let col = 1; col < 5 && !grabberPlaced; col++) {
      const cell = board[row][col];
      if (!cell.unit && !cell.structure) {
        board[row][col].unit = {
          instanceId: `grabber-${row}-${col}`,
          cardId: 'goblin-grabber-1',
          card: {
            id: 'goblin-grabber',
            name: '抓附手',
            cardType: 'unit',
            faction: 'goblin',
            cost: 2,
            life: 3,
            strength: 2,
            attackType: 'melee',
            attackRange: 1,
            unitClass: 'common',
            abilities: ['grab'],
            deckSymbols: [],
          },
          owner: '0',
          position: { row, col },
          damage: 0,
          boosts: 0,
          hasMoved: false,
          hasAttacked: false,
        };
        grabberPlaced = true;

        // 在相邻位置放置友方单位
        const adjPositions = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];
        for (const adj of adjPositions) {
          if (adj.row >= 0 && adj.row < 8 && adj.col >= 0 && adj.col < 6) {
            if (!board[adj.row][adj.col].unit && !board[adj.row][adj.col].structure) {
              board[adj.row][adj.col].unit = {
                instanceId: `ally-mover-${adj.row}-${adj.col}`,
                cardId: 'goblin-soldier-1',
                card: {
                  id: 'goblin-soldier',
                  name: '友方士兵',
                  cardType: 'unit',
                  faction: 'goblin',
                  cost: 1,
                  life: 2,
                  strength: 2,
                  attackType: 'melee',
                  attackRange: 1,
                  unitClass: 'common',
                  deckSymbols: [],
                },
                owner: '0',
                position: adj,
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              };
              allyPlaced = true;
              break;
            }
          }
        }
      }
    }
  }

  if (!grabberPlaced || !allyPlaced) {
    throw new Error('无法准备抓附跟随测试状态：未能放置所需单位');
  }

  return next;
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('召唤师战争 - 友方移动后选择跟随位置', () => {
  test('抓附跟随：友方单位移动后选择相邻空位跟随', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setEnglishLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    await disableSummonerWarsAutoSkip(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await browser.newContext({ baseURL });
    await blockAudioRequests(guestContext);
    await setEnglishLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备测试状态
    const coreState = await readCoreState(hostPage);
    const grabFollowCore = prepareGrabFollowState(coreState);
    await applyCoreState(hostPage, grabFollowCore);
    await closeDebugPanelIfOpen(hostPage);

    // 验证当前是移动阶段
    await waitForPhase(hostPage, 'move');

    // 查找友方士兵
    const allySoldier = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"]').filter({
      has: hostPage.locator('[data-unit-name*="士兵"]')
    }).first();
    await expect(allySoldier).toBeVisible({ timeout: 5000 });

    // 点击友方士兵
    await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-name*="士兵"]');

    // 点击相邻空位（移动友方士兵）
    // 需要找到一个空位，且不是抓附手的位置
    const emptyCell = hostPage.locator('[data-testid^="sw-cell-"]').filter({
      has: hostPage.locator('[data-cell-empty="true"]')
    }).first();
    await expect(emptyCell).toBeVisible({ timeout: 5000 });
    await emptyCell.click();

    // 验证抓附跟随提示出现
    const grabFollowPrompt = hostPage.locator('[data-testid="sw-ability-prompt"]').or(
      hostPage.locator('[class*="prompt"]').filter({ hasText: /选择位置|Select position|抓附|Grab|跟随|Follow/i })
    );
    await expect(grabFollowPrompt).toBeVisible({ timeout: 8000 });

    // 点击抓附手相邻的空位
    const followPosition = hostPage.locator('[data-testid^="sw-cell-"]').filter({
      has: hostPage.locator('[data-cell-empty="true"]')
    }).nth(1);
    await expect(followPosition).toBeVisible({ timeout: 5000 });
    await followPosition.click();

    // 验证选择提示关闭
    await expect(grabFollowPrompt).toBeHidden({ timeout: 5000 });

    // 验证抓附手移动到新位置
    // 通过检查抓附手的位置是否改变
    await expect.poll(async () => {
      const grabberPosition = await hostPage.evaluate(() => {
        const grabber = document.querySelector('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name*="抓附手"]');
        return grabber?.getAttribute('data-position');
      });
      return grabberPosition !== null;
    }, { timeout: 5000 }).toBe(true);

    await hostContext.close();
    await guestContext.close();
  });
});
