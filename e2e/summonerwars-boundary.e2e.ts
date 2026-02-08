/**
 * 召唤师战争 - 边界场景 E2E 测试
 *
 * 覆盖：
 * - 事件卡无有效目标时不进入选择模式
 * - 事件卡选择流程取消后正确回滚
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

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

const attachPageDiagnostics = (page: Page) => {
  const existing = (page as Page & { __swDiagnostics?: { errors: string[] } }).__swDiagnostics;
  if (existing) return existing;
  const diagnostics = { errors: [] as string[] };
  (page as Page & { __swDiagnostics?: { errors: string[] } }).__swDiagnostics = diagnostics;
  page.on('pageerror', (err) => diagnostics.errors.push(`pageerror:${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') diagnostics.errors.push(`console:${msg.text()}`); });
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
    } catch {
      // ignore
    }
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

const dismissLobbyConfirmIfNeeded = async (page: Page) => {
  const confirmButton = page.locator('button:has-text("确认")').or(page.locator('button:has-text("Confirm")'));
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
  }
};

const waitForHomeGameList = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  attachPageDiagnostics(page);
  await waitForFrontendAssets(page);
  await page.waitForSelector('[data-game-id]', { timeout: 12000, state: 'attached' });
};

const ensureSummonerWarsCard = async (page: Page) => {
  await waitForHomeGameList(page);
  let card = page.locator('[data-game-id="summonerwars"]');
  if (await card.count() === 0) {
    const strategyTab = page.getByRole('button', { name: /Strategy|策略/i });
    if (await strategyTab.isVisible().catch(() => false)) await strategyTab.click();
    card = page.locator('[data-game-id="summonerwars"]');
  }
  await expect(card).toHaveCount(1, { timeout: 15000 });
  await card.first().scrollIntoViewIfNeeded();
  return card.first();
};

const ensureSummonerWarsModalOpen = async (page: Page) => {
  const modalRoot = page.locator('#modal-root');
  const modalHeading = modalRoot.getByRole('heading', { name: /Summoner Wars|召唤师战争/i });
  try {
    await expect(modalHeading).toBeVisible({ timeout: 2000 });
  } catch {
    const gameCard = await ensureSummonerWarsCard(page);
    await gameCard.click();
    await expect(modalHeading).toBeVisible({ timeout: 15000 });
  }
  return { modalRoot, modalHeading };
};

const ensureGameServerAvailable = async (page: Page) => {
  const gameServerBaseURL = getGameServerBaseURL();
  for (const url of ['/games', `${gameServerBaseURL}/games`]) {
    try {
      const response = await page.request.get(url);
      if (response.ok()) return true;
    } catch {
      // ignore
    }
  }
  return false;
};

const createSummonerWarsRoom = async (page: Page) => {
  attachPageDiagnostics(page);
  await page.goto('/?game=summonerwars', { waitUntil: 'domcontentloaded' });
  await dismissViteOverlay(page);
  await dismissLobbyConfirmIfNeeded(page);

  const { modalRoot } = await ensureSummonerWarsModalOpen(page);
  const createButton = modalRoot.locator('button:visible', { hasText: /Create Room|创建房间/i }).first();
  const lobbyTab = modalRoot.getByRole('button', { name: /Lobby|在线大厅/i });
  if (await lobbyTab.isVisible().catch(() => false)) await lobbyTab.click();

  const returnButton = modalRoot.locator('button:visible', { hasText: /Return to match|返回当前对局/i }).first();
  if (await returnButton.isVisible().catch(() => false)) {
    await returnButton.click();
    await page.waitForURL(/\/play\/summonerwars\/match\//, { timeout: 10000 });
    return new URL(page.url()).pathname.split('/').pop() ?? null;
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
  const matchId = new URL(page.url()).pathname.split('/').pop() ?? null;
  if (!matchId) return null;
  const available = await waitForMatchAvailable(page, matchId, 15000);
  if (!available) return null;
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
  }).catch(() => {});
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
  await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
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

const cloneState = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createMindControlCard = () => ({
  id: 'trickster-mind-control',
  name: '心灵操控',
  cardType: 'event' as const,
  eventType: 'legendary' as const,
  cost: 0,
  playPhase: 'summon' as const,
  effect: '指定你的召唤师2个区格以内任意数量的敌方士兵和英雄为目标。获得所有目标的控制权，直到回合结束。',
  deckSymbols: [],
  spriteIndex: 0,
  spriteAtlas: 'cards' as const,
});

const createStunCard = () => ({
  id: 'trickster-stun',
  name: '震慑',
  cardType: 'event' as const,
  eventType: 'common' as const,
  cost: 1,
  playPhase: 'move' as const,
  effect: '指定你的召唤师3个直线视野区格以内的一个士兵或英雄为目标。将目标推拉1至3个区格，并且可以穿过士兵和英雄。对目标和每个被穿过的单位造成1点伤害。',
  deckSymbols: [],
  spriteIndex: 9,
  spriteAtlas: 'cards' as const,
});

const createHypnoticLureCard = () => ({
  id: 'trickster-hypnotic-lure',
  name: '催眠引诱',
  cardType: 'event' as const,
  eventType: 'common' as const,
  cost: 0,
  playPhase: 'summon' as const,
  effect: '指定一个士兵或英雄为目标。你可以将目标向你的召唤师靠近而推拉1个区格。\n持续：当你的召唤师攻击这个目标时，获得战力+1。',
  deckSymbols: [],
  spriteIndex: 10,
  spriteAtlas: 'cards' as const,
});

const createEnemyUnit = () => ({
  cardId: 'necro-undead-warrior-test',
  card: {
    id: 'necro-undead-warrior',
    name: '亡灵战士',
    cardType: 'unit' as const,
    unitClass: 'common' as const,
    faction: '堕落王国',
    strength: 2,
    life: 2,
    cost: 1,
    attackType: 'melee' as const,
    attackRange: 1 as const,
    abilities: [],
    deckSymbols: [],
    spriteIndex: 6,
    spriteAtlas: 'cards' as const,
  },
  owner: '1' as const,
  position: { row: 0, col: 0 },
  damage: 0,
  boosts: 0,
  hasMoved: false,
  hasAttacked: false,
});

const findSummonerPosition = (coreState: any, playerId: '0' | '1') => {
  for (let row = 0; row < coreState.board.length; row += 1) {
    for (let col = 0; col < coreState.board[row].length; col += 1) {
      const unit = coreState.board[row][col]?.unit;
      if (unit && unit.owner === playerId && unit.card?.unitClass === 'summoner') {
        return { row, col };
      }
    }
  }
  throw new Error('未找到召唤师位置');
};

const removeEnemyNonSummonerUnits = (coreState: any, enemyId: '0' | '1') => {
  coreState.board = coreState.board.map((row: any[]) => row.map((cell: any) => {
    if (cell.unit && cell.unit.owner === enemyId && cell.unit.card?.unitClass !== 'summoner') {
      return { ...cell, unit: undefined };
    }
    return cell;
  }));
};

const findEmptyCellWithinDistance = (coreState: any, center: { row: number; col: number }, maxDist: number) => {
  const fallback: { row: number; col: number }[] = [];
  for (let row = 0; row < coreState.board.length; row += 1) {
    for (let col = 0; col < coreState.board[row].length; col += 1) {
      const dist = Math.abs(center.row - row) + Math.abs(center.col - col);
      if (dist === 0 || dist > maxDist) continue;
      const cell = coreState.board[row][col];
      if (!cell.unit && !cell.structure) return { row, col };
      if (cell.unit && cell.unit.card?.unitClass !== 'summoner') {
        fallback.push({ row, col });
      } else if (cell.structure && !cell.structure.card?.isStartingGate) {
        fallback.push({ row, col });
      }
    }
  }
  if (fallback.length > 0) {
    const pick = fallback[0];
    coreState.board[pick.row][pick.col] = { ...coreState.board[pick.row][pick.col], unit: undefined, structure: undefined };
    return pick;
  }
  return null;
};

const placeEnemyUnitNearSummoner = (coreState: any, summonerPos: { row: number; col: number }) => {
  const empty = findEmptyCellWithinDistance(coreState, summonerPos, 2);
  if (!empty) throw new Error('无法找到放置心灵操控目标的空位');
  const enemyUnit = createEnemyUnit();
  enemyUnit.position = { ...empty };
  coreState.board[empty.row][empty.col] = {
    ...coreState.board[empty.row][empty.col],
    unit: enemyUnit,
  };
  return empty;
};

const findAnyEmptyCell = (coreState: any) => {
  const fallback: { row: number; col: number }[] = [];
  for (let row = 0; row < coreState.board.length; row += 1) {
    for (let col = 0; col < coreState.board[row].length; col += 1) {
      const cell = coreState.board[row][col];
      if (!cell.unit && !cell.structure) return { row, col };
      if (cell.unit && cell.unit.card?.unitClass !== 'summoner') {
        fallback.push({ row, col });
      } else if (cell.structure && !cell.structure.card?.isStartingGate) {
        fallback.push({ row, col });
      }
    }
  }
  if (fallback.length > 0) {
    const pick = fallback[0];
    coreState.board[pick.row][pick.col] = { ...coreState.board[pick.row][pick.col], unit: undefined, structure: undefined };
    return pick;
  }
  return null;
};

const placeEnemyUnitAnywhere = (coreState: any) => {
  const empty = findAnyEmptyCell(coreState);
  if (!empty) throw new Error('无法找到放置催眠引诱目标的空位');
  const enemyUnit = createEnemyUnit();
  enemyUnit.position = { ...empty };
  coreState.board[empty.row][empty.col] = {
    ...coreState.board[empty.row][empty.col],
    unit: enemyUnit,
  };
  return empty;
};

const prepareMindControlNoTargetState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.hand = [createMindControlCard(), ...player.hand];
  player.magic = 10;

  removeEnemyNonSummonerUnits(next, '1');

  return next;
};

const prepareStunNoTargetState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.hand = [createStunCard(), ...player.hand];
  player.magic = 10;
  player.moveCount = 0;

  removeEnemyNonSummonerUnits(next, '1');

  return next;
};

const prepareMindControlCancelState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.hand = [createMindControlCard(), ...player.hand];
  player.magic = 10;

  removeEnemyNonSummonerUnits(next, '1');

  const summonerPos = findSummonerPosition(next, '0');
  const targetPosition = placeEnemyUnitNearSummoner(next, summonerPos);

  return { core: next, targetPosition };
};

const prepareHypnoticLureNoTargetState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.hand = [createHypnoticLureCard(), ...player.hand];
  player.magic = 10;

  removeEnemyNonSummonerUnits(next, '1');

  return next;
};

const prepareHypnoticLureCancelState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  player.hand = [createHypnoticLureCard(), ...player.hand];
  player.magic = 10;

  removeEnemyNonSummonerUnits(next, '1');

  const targetPosition = placeEnemyUnitAnywhere(next);

  return { core: next, targetPosition };
};

const createBaseContext = async (browser: Browser, baseURL?: string) => {
  const context = await browser.newContext({ baseURL });
  await blockAudioRequests(context);
  await setEnglishLocale(context);
  await resetMatchStorage(context);
  await disableAudio(context);
  await disableTutorial(context);
  await disableSummonerWarsAutoSkip(context);
  return context;
};

test.describe('SummonerWars 边界交互', () => {
  test('事件卡：心灵操控无有效目标', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await createBaseContext(browser, baseURL);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await createBaseContext(browser, baseURL);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const coreState = await readCoreState(hostPage);
    const noTargetCore = prepareMindControlNoTargetState(coreState);
    await applyCoreState(hostPage, noTargetCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'summon');

    const mindControlCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="trickster-mind-control"]')
      .first();
    await expect(mindControlCard).toBeVisible({ timeout: 5000 });

    await mindControlCard.click();

    const mindControlBanner = hostPage.locator('[class*="bg-cyan-900"]').filter({ hasText: /心灵操控/ });
    await expect(mindControlBanner).toHaveCount(0);

    const mindControlHighlight = hostPage.locator('[class*="border-cyan-500"]');
    await expect(mindControlHighlight).toHaveCount(0);

    await expect(mindControlCard).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：催眠引诱无有效目标', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await createBaseContext(browser, baseURL);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await createBaseContext(browser, baseURL);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const coreState = await readCoreState(hostPage);
    const noTargetCore = prepareHypnoticLureNoTargetState(coreState);
    await applyCoreState(hostPage, noTargetCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'summon');

    const hypnoticLureCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="trickster-hypnotic-lure"]')
      .first();
    await expect(hypnoticLureCard).toBeVisible({ timeout: 5000 });

    await hypnoticLureCard.click();

    const hypnoticLureBanner = hostPage.locator('[class*="bg-pink-900"]').filter({ hasText: /催眠引诱/ });
    await expect(hypnoticLureBanner).toHaveCount(0);

    const hypnoticLureHighlight = hostPage.locator('[class*="border-pink-400"]');
    await expect(hypnoticLureHighlight).toHaveCount(0);

    await expect(hypnoticLureCard).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：震慑无有效目标', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await createBaseContext(browser, baseURL);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await createBaseContext(browser, baseURL);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const coreState = await readCoreState(hostPage);
    const noTargetCore = prepareStunNoTargetState(coreState);
    await applyCoreState(hostPage, noTargetCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'move');

    const stunCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="trickster-stun"]')
      .first();
    await expect(stunCard).toBeVisible({ timeout: 5000 });

    await stunCard.click();

    const stunBanner = hostPage.locator('[class*="bg-yellow-900"]').filter({ hasText: /震慑/ });
    await expect(stunBanner).toHaveCount(0);

    const stunHighlight = hostPage.locator('[class*="border-yellow-400"]');
    await expect(stunHighlight).toHaveCount(0);

    await expect(stunCard).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：心灵操控取消回滚', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await createBaseContext(browser, baseURL);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await createBaseContext(browser, baseURL);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const coreState = await readCoreState(hostPage);
    const { core: cancelCore, targetPosition } = prepareMindControlCancelState(coreState);
    await applyCoreState(hostPage, cancelCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'summon');

    const mindControlCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="trickster-mind-control"]')
      .first();
    await expect(mindControlCard).toBeVisible({ timeout: 5000 });

    await mindControlCard.click();

    const mindControlBanner = hostPage.locator('[class*="bg-cyan-900"]').filter({ hasText: /心灵操控/ });
    await expect(mindControlBanner).toBeVisible({ timeout: 3000 });

    await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPosition.row}-${targetPosition.col}"]`);

    const confirmButton = mindControlBanner.getByRole('button', { name: /确认控制/ });
    await expect(confirmButton).toBeVisible({ timeout: 3000 });

    const cancelButton = mindControlBanner.getByRole('button', { name: /取消/ });
    await cancelButton.click();

    await expect(mindControlBanner).toHaveCount(0);

    const mindControlHighlight = hostPage.locator('[class*="border-cyan-500"]');
    await expect(mindControlHighlight).toHaveCount(0);

    await expect(mindControlCard).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：催眠引诱取消回滚', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await createBaseContext(browser, baseURL);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await createBaseContext(browser, baseURL);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const coreState = await readCoreState(hostPage);
    const { core: cancelCore, targetPosition } = prepareHypnoticLureCancelState(coreState);
    await applyCoreState(hostPage, cancelCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'summon');

    const hypnoticLureCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="trickster-hypnotic-lure"]')
      .first();
    await expect(hypnoticLureCard).toBeVisible({ timeout: 5000 });

    await hypnoticLureCard.click();

    const hypnoticLureBanner = hostPage.locator('[class*="bg-pink-900"]').filter({ hasText: /催眠引诱/ });
    await expect(hypnoticLureBanner).toBeVisible({ timeout: 3000 });

    const targetCell = hostPage.getByTestId(`sw-cell-${targetPosition.row}-${targetPosition.col}`);
    await expect(targetCell).toHaveClass(/border-pink-400/);

    const cancelButton = hypnoticLureBanner.getByRole('button', { name: /取消/ });
    await cancelButton.click();

    await expect(hypnoticLureBanner).toHaveCount(0);
    await expect(targetCell).not.toHaveClass(/border-pink-400/);

    await expect(hypnoticLureCard).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });
});
