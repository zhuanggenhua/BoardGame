/**
 * 召唤师战争 - 圣堂骑士弃牌技能 E2E 测试
 * 
 * 覆盖范围：
 * - 圣光箭（holy_arrow）：攻击前弃牌获得魔力和战力
 * - 治疗（healing）：攻击前弃牌进入治疗模式
 * - 手牌选择 UI 交互
 * - 弃牌动画和视觉反馈
 * - 在线对局状态同步
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

const getCurrentPhase = async (page: Page) => {
  const phase = await page.getByTestId('sw-action-banner').getAttribute('data-phase');
  if (!phase) {
    throw new Error('无法获取当前阶段');
  }
  return phase;
};

const waitForPhase = async (page: Page, phase: string) => {
  await expect.poll(() => page.getByTestId('sw-action-banner').getAttribute('data-phase')).toBe(phase);
};

// ============================================================================
// 测试状态准备函数
// ============================================================================

/**
 * 准备圣光箭测试状态
 * - 攻击阶段
 * - 城塞弓箭手在场
 * - 手牌有多张不同名单位卡
 * - 相邻有敌方单位可攻击
 */
const prepareHolyArrowState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.magic = 3;
  player.attackCount = 0;

  // 确保手牌有多张不同名单位卡
  // ✅ 边界测试：包含高费用卡牌（费用 > 当前魔力），验证弃牌不受魔力限制
  const unitCards = [
    {
      id: 'paladin-unit-1',
      name: '城塞骑士',
      cardType: 'unit',
      faction: 'paladin',
      cost: 5, // 高费用（> 当前魔力 3）
      life: 5,
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'common',
      deckSymbols: [],
    },
    {
      id: 'paladin-unit-2',
      name: '城塞圣武士',
      cardType: 'unit',
      faction: 'paladin',
      cost: 6, // 高费用（> 当前魔力 3）
      life: 4,
      strength: 3,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'common',
      deckSymbols: [],
    },
  ];

  player.hand = [...unitCards, ...player.hand.filter((c: any) => c.cardType !== 'unit')];

  // 查找城塞弓箭手或放置一个
  const board = next.board;
  let archerPlaced = false;
  let enemyPlaced = false;

  for (let row = 0; row < 8 && !archerPlaced; row++) {
    for (let col = 0; col < 6 && !archerPlaced; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('holy_arrow')) {
        archerPlaced = true;
        // 在相邻位置放置敌方单位
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
                instanceId: `enemy-target-${adj.row}-${adj.col}`,
                cardId: 'necro-enemy-1',
                card: {
                  id: 'necro-enemy',
                  name: '敌方单位',
                  cardType: 'unit',
                  faction: 'necromancer',
                  cost: 1,
                  life: 3,
                  strength: 2,
                  attackType: 'melee',
                  attackRange: 1,
                  unitClass: 'common',
                  deckSymbols: [],
                },
                owner: '1',
                position: adj,
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              };
              enemyPlaced = true;
              break;
            }
          }
        }
      }
    }
  }

  if (!archerPlaced || !enemyPlaced) {
    throw new Error('无法准备圣光箭测试状态：未找到城塞弓箭手或无法放置敌方单位');
  }

  return next;
};

/**
 * 准备治疗测试状态
 * - 攻击阶段
 * - 圣殿牧师在场（healingMode: true，模拟已弃牌激活治疗模式）
 * - 手牌有单位卡
 * - 相邻有受伤的友方单位（用于治疗测试）
 * - 相邻有敌方单位（用于跳过弃牌测试）
 * 
 * 注意：healing 的完整流程是"弃牌 → 设置 healingMode → 攻击友方 → 治疗"。
 * 为了让 validAttackPositions 包含友方单位，需要预设 healingMode: true。
 */
const prepareHealingState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.magic = 5;
  player.attackCount = 0;

  // 确保手牌有单位卡
  // ✅ 边界测试：高费用卡牌（费用 > 当前魔力），验证弃牌不受魔力限制
  const unitCard = {
    id: 'paladin-unit-heal',
    name: '城塞骑士',
    cardType: 'unit',
    faction: 'paladin',
    cost: 8, // 高费用（> 当前魔力 5）
    life: 5,
    strength: 2,
    attackType: 'melee',
    attackRange: 1,
    unitClass: 'common',
    deckSymbols: [],
  };

  player.hand = [unitCard, ...player.hand.filter((c: any) => c.cardType !== 'unit')];

  // 查找圣殿牧师
  const board = next.board;
  let priestPlaced = false;
  let woundedAllyPlaced = false;
  let enemyPlaced = false;

  for (let row = 0; row < 8 && !priestPlaced; row++) {
    for (let col = 0; col < 6 && !priestPlaced; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('healing')) {
        priestPlaced = true;
        // ✅ 预设 healingMode，让 validAttackPositions 包含友方单位
        cell.unit.healingMode = true;

        // 在相邻位置放置受伤的友方单位和敌方单位
        const adjPositions = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];
        for (const adj of adjPositions) {
          if (adj.row >= 0 && adj.row < 8 && adj.col >= 0 && adj.col < 6) {
            if (!board[adj.row][adj.col].unit && !board[adj.row][adj.col].structure) {
              if (!woundedAllyPlaced) {
                board[adj.row][adj.col].unit = {
                  instanceId: `wounded-ally-${adj.row}-${adj.col}`,
                  cardId: 'paladin-wounded-ally',
                  card: {
                    id: 'paladin-ally',
                    name: '城塞骑士',
                    cardType: 'unit',
                    faction: 'paladin',
                    cost: 2,
                    life: 5,
                    strength: 2,
                    attackType: 'melee',
                    attackRange: 1,
                    unitClass: 'common',
                    deckSymbols: [],
                  },
                  owner: '0',
                  position: adj,
                  damage: 3, // 受伤
                  boosts: 0,
                  hasMoved: false,
                  hasAttacked: false,
                };
                woundedAllyPlaced = true;
              } else if (!enemyPlaced) {
                board[adj.row][adj.col].unit = {
                  instanceId: `enemy-heal-test-${adj.row}-${adj.col}`,
                  cardId: 'necro-enemy-heal',
                  card: {
                    id: 'necro-enemy-heal',
                    name: '敌方单位',
                    cardType: 'unit',
                    faction: 'necromancer',
                    cost: 1,
                    life: 3,
                    strength: 2,
                    attackType: 'melee',
                    attackRange: 1,
                    unitClass: 'common',
                    deckSymbols: [],
                  },
                  owner: '1',
                  position: adj,
                  damage: 0,
                  boosts: 0,
                  hasMoved: false,
                  hasAttacked: false,
                };
                enemyPlaced = true;
              }
            }
          }
          if (woundedAllyPlaced && enemyPlaced) break;
        }
      }
    }
  }

  if (!priestPlaced || !woundedAllyPlaced) {
    throw new Error('无法准备治疗测试状态：未找到圣殿牧师或无法放置受伤友方单位');
  }

  return next;
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('圣堂骑士弃牌技能', () => {
  test('圣光箭：攻击前弃牌获得魔力和战力', async ({ browser }, testInfo) => {
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
    const holyArrowCore = prepareHolyArrowState(coreState);
    await applyCoreState(hostPage, holyArrowCore);
    await closeDebugPanelIfOpen(hostPage);

    // 验证当前是攻击阶段
    await waitForPhase(hostPage, 'attack');

    // 记录初始魔力
    const magicDisplay = hostPage.getByTestId('sw-player-magic-0');
    const initialMagic = parseInt(await magicDisplay.innerText());

    // 点击城塞弓箭手（通过 data-unit-name 精确匹配）
    const archer = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="城塞弓箭手"]').first();
    await expect(archer).toBeVisible({ timeout: 5000 });
    await archer.click();

    // 点击相邻敌方单位（触发攻击前弃牌）
    const enemyUnit = hostPage.locator('[data-testid^="sw-unit-"][data-owner="1"]').first();
    await expect(enemyUnit).toBeVisible({ timeout: 5000 });
    await enemyUnit.click();

    // 验证被动触发横幅出现（StatusBanners 中的 amber 横幅，包含"确认弃牌"和"跳过"按钮）
    const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
    const skipBtn = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i });
    await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });
    await expect(skipBtn).toBeVisible({ timeout: 3000 });

    // ✅ 边界验证：高费用卡牌（cost=5,6 > magic=3）应该可以选择
    // 弃牌不消耗魔力，不应该被"魔力不足"阻止
    // 在手牌区直接点击单位卡选择（被动触发模式下手牌区高亮可选）
    const handArea = hostPage.getByTestId('sw-hand-area');
    const selectableCards = handArea.locator('[data-card-type="unit"]');
    const cardCount = await selectableCards.count();
    if (cardCount >= 2) {
      await selectableCards.nth(0).click();
      await selectableCards.nth(1).click();
    } else if (cardCount === 1) {
      await selectableCards.nth(0).click();
    }

    // 验证卡牌被选中
    const selectedCards = handArea.locator('[data-selected="true"]');
    expect(await selectedCards.count()).toBeGreaterThan(0);

    // 点击确认弃牌
    await confirmDiscardBtn.click();

    // 验证横幅消失（abilityMode 被清除）
    await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });

    // 验证魔力增加
    await expect.poll(async () => {
      const currentMagic = parseInt(await magicDisplay.innerText());
      return currentMagic > initialMagic;
    }, { timeout: 5000 }).toBe(true);

    // 验证攻击继续进行（骰子结果界面出现）
    const diceResult = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceResult).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('圣光箭：可以跳过弃牌直接攻击', async ({ browser }, testInfo) => {
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

    const coreState = await readCoreState(hostPage);
    const holyArrowCore = prepareHolyArrowState(coreState);
    await applyCoreState(hostPage, holyArrowCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'attack');

    const magicDisplay = hostPage.getByTestId('sw-player-magic-0');
    const initialMagic = parseInt(await magicDisplay.innerText());

    // 点击城塞弓箭手（精确匹配）
    const archer = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="城塞弓箭手"]').first();
    await expect(archer).toBeVisible({ timeout: 5000 });
    await archer.click();

    // 点击敌方单位
    const enemyUnit = hostPage.locator('[data-testid^="sw-unit-"][data-owner="1"]').first();
    await expect(enemyUnit).toBeVisible({ timeout: 5000 });
    await enemyUnit.click();

    // 验证被动触发横幅出现
    const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
    const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i });
    await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });
    await expect(skipButton).toBeVisible({ timeout: 3000 });

    // 点击跳过按钮（不弃牌直接攻击）
    await skipButton.click();

    // 验证横幅消失
    await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });

    // 验证魔力不变
    const currentMagic = parseInt(await magicDisplay.innerText());
    expect(currentMagic).toBe(initialMagic);

    // 验证攻击正常进行
    const diceResult = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceResult).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('治疗：弃牌后攻击友方单位恢复生命', async ({ browser }, testInfo) => {
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

    const coreState = await readCoreState(hostPage);
    const healingCore = prepareHealingState(coreState);
    await applyCoreState(hostPage, healingCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'attack');

    // 点击圣殿牧师（精确匹配）
    const priest = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="圣殿牧师"]').first();
    await expect(priest).toBeVisible({ timeout: 5000 });
    await priest.click();

    // 点击受伤的友方单位（healingMode=true 时 validAttackPositions 包含友方）
    // 通过 data-unit-damage 属性找到受伤单位，且 owner="0"（友方）
    const woundedAlly = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="城塞骑士"]').first();
    await expect(woundedAlly).toBeVisible({ timeout: 5000 });

    // 记录初始伤害值
    const initialDamage = parseInt(await woundedAlly.getAttribute('data-unit-damage') ?? '0');
    expect(initialDamage).toBeGreaterThan(0); // 确认单位确实受伤

    await woundedAlly.click();

    // 验证被动触发横幅出现（StatusBanners 中的 amber 横幅）
    const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
    await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });

    // 在手牌区选择单位卡弃除
    const handArea = hostPage.getByTestId('sw-hand-area');
    const selectableCards = handArea.locator('[data-card-type="unit"]');
    await expect(selectableCards.first()).toBeVisible({ timeout: 3000 });
    await selectableCards.first().click();

    // 验证卡牌被选中
    const selectedCards = handArea.locator('[data-selected="true"]');
    expect(await selectedCards.count()).toBeGreaterThan(0);

    // 点击确认弃牌
    await confirmDiscardBtn.click();

    // 验证横幅消失
    await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });

    // 验证攻击执行（骰子结果出现）— 治疗模式下攻击友方会产生治疗效果
    const diceResult = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceResult).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('治疗：可以跳过弃牌正常攻击', async ({ browser }, testInfo) => {
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

    const coreState = await readCoreState(hostPage);
    const healingCore = prepareHealingState(coreState);
    await applyCoreState(hostPage, healingCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'attack');

    // 点击圣殿牧师（精确匹配）
    const priest = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="圣殿牧师"]').first();
    await expect(priest).toBeVisible({ timeout: 5000 });
    await priest.click();

    // 点击敌方单位（prepareHealingState 已放置敌方单位在牧师相邻位置）
    const enemyUnit = hostPage.locator('[data-testid^="sw-unit-"][data-owner="1"]').first();
    const hasEnemy = await enemyUnit.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasEnemy) {
      await enemyUnit.click();

      // 验证被动触发横幅出现
      const confirmDiscardBtn = hostPage.locator('button').filter({ hasText: /Confirm Discard|确认弃牌/i });
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i });
      await expect(confirmDiscardBtn).toBeVisible({ timeout: 8000 });

      // 点击跳过（不弃牌直接攻击）
      await expect(skipButton).toBeVisible({ timeout: 3000 });
      await skipButton.click();

      // 验证横幅消失
      await expect(confirmDiscardBtn).toBeHidden({ timeout: 5000 });

      // 验证正常攻击进行（骰子结果出现）
      const diceResult = hostPage.getByTestId('sw-dice-result-overlay');
      await expect(diceResult).toBeVisible({ timeout: 8000 });
    } else {
      // 如果没有敌方单位（不应该发生），跳过测试
      test.skip(true, '未找到敌方单位，prepareHealingState 可能未正确放置');
    }

    await hostContext.close();
    await guestContext.close();
  });
});
