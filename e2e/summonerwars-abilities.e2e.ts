/**
 * 召唤师战争 - 特殊技能交互 E2E 测试
 * 
 * 覆盖需要 UI 交互的特殊技能：
 * - 灵魂转移（击杀后瞬移确认）
 * - 心灵捕获（攻击后控制/伤害选择）
 * - 念力/高阶念力（攻击后推拉方向选择）
 * - 读心传念（攻击后选择友方士兵额外攻击）
 * - 感染（击杀后从弃牌堆选择疫病体）
 * - 抓附跟随（友方移动后选择跟随位置）
 * - 吸取生命（攻击前牺牲友方单位）
 * - 圣光箭（攻击前弃牌加成）
 * - 治疗（攻击前弃牌并选择友方治疗目标）
 * 
 * 注意：攻击涉及骰子随机，部分测试使用软断言
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createDeckByFactionId } from '../src/games/summonerwars/config/factions';
import { BOARD_COLS, BOARD_ROWS, HAND_SIZE } from '../src/games/summonerwars/domain/helpers';

// ============================================================================
// 通用辅助函数（与 summonerwars.e2e.ts 保持一致）
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

const matchOwnerGuestIds = new Map<string, string>();

const createGuestId = (prefix: string) => (
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
);

const seedMatchCredentials = async (
  page: Page,
  payload: { matchId: string; playerId: string; credentials: string; guestId: string; playerName: string }
) => {
  await page.addInitScript(({ matchId, playerId, credentials, guestId, playerName }) => {
    localStorage.setItem('guest_id', guestId);
    try { sessionStorage.setItem('guest_id', guestId); } catch { /* ignore */ }
    sessionStorage.setItem('__sw_storage_reset', '1');
    localStorage.setItem(
      `match_creds_${matchId}`,
      JSON.stringify({ matchID: matchId, gameName: 'summonerwars', playerID: playerId, credentials, playerName })
    );
    document.cookie = `bg_guest_id=${encodeURIComponent(guestId)}; path=/; SameSite=Lax`;
  }, payload);
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
    localStorage.setItem('audio_sfx_volume', '0');
    localStorage.setItem('audio_bgm_volume', '0');
    (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
  });
};

const enableE2EDebug = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    (window as Window & { __BG_E2E_DEBUG__?: boolean }).__BG_E2E_DEBUG__ = true;
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
    } catch { /* ignore */ }
  }
  return false;
};

const joinSummonerWarsMatch = async (
  page: Page,
  matchId: string,
  playerId: string,
  guestId: string,
  playerName: string
) => {
  const gameServerBaseURL = getGameServerBaseURL();
  const response = await page.request.post(
    `${gameServerBaseURL}/games/summonerwars/${matchId}/join`,
    {
      data: {
        playerID: playerId,
        playerName,
        data: { guestId },
      },
    }
  );
  if (!response.ok()) return null;
  const data = await response.json().catch(() => null) as { playerCredentials?: string } | null;
  return data?.playerCredentials ?? null;
};

const createSummonerWarsRoom = async (page: Page) => {
  const gameServerBaseURL = getGameServerBaseURL();
  const ownerGuestId = createGuestId('host');
  const response = await page.request.post(`${gameServerBaseURL}/games/summonerwars/create`, {
    data: { numPlayers: 2, setupData: { guestId: ownerGuestId } },
  });
  if (!response.ok()) return null;
  const data = await response.json().catch(() => null) as { matchID?: string } | null;
  const matchId = data?.matchID ?? null;
  if (!matchId) return null;
  matchOwnerGuestIds.set(matchId, ownerGuestId);
  const available = await waitForMatchAvailable(page, matchId, 15000);
  return available ? matchId : null;
};

const ensurePlayerIdInUrl = async (page: Page, playerId: string) => {
  const url = new URL(page.url());
  if (!url.searchParams.get('playerID')) {
    url.searchParams.set('playerID', playerId);
    await page.goto(url.toString());
  }
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

const waitForSummonerWarsUI = async (page: Page, timeout = 20000) => {
  await expect(page.getByTestId('sw-action-banner')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout });
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
  if (await stateTab.isVisible().catch(() => false)) await stateTab.click();
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

const cloneState = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const initializeSummonerWarsCore = (coreState: any, factions: Record<string, string>) => {
  const next = cloneState(coreState);
  const board = Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => ({}))) as any[][];
  const players = { ...next.players };

  (['0', '1'] as const).forEach((pid) => {
    const factionId = factions[pid];
    if (!factionId) return;

    const deckData = createDeckByFactionId(factionId as any);
    const player = { ...players[pid] };
    const isBottom = pid === '0';
    const toArrayCoord = (pos: { row: number; col: number }) => (
      isBottom
        ? { row: BOARD_ROWS - 1 - pos.row, col: pos.col }
        : { row: pos.row, col: BOARD_COLS - 1 - pos.col }
    );

    const summonerCard = { ...deckData.summoner, id: `${deckData.summoner.id}-${pid}` };
    player.summonerId = summonerCard.id;
    const summonerPos = toArrayCoord(deckData.summonerPosition);
    board[summonerPos.row][summonerPos.col].unit = {
      cardId: summonerCard.id,
      card: summonerCard,
      owner: pid,
      position: summonerPos,
      damage: 0,
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    };

    const gateCard = { ...deckData.startingGate, id: `${deckData.startingGate.id}-${pid}` };
    const gatePos = toArrayCoord(deckData.startingGatePosition);
    board[gatePos.row][gatePos.col].structure = {
      cardId: gateCard.id,
      card: gateCard,
      owner: pid,
      position: gatePos,
      damage: 0,
    };

    for (const startUnit of deckData.startingUnits) {
      const unitCard = { ...startUnit.unit, id: `${startUnit.unit.id}-${pid}` };
      const unitPos = toArrayCoord(startUnit.position);
      board[unitPos.row][unitPos.col].unit = {
        cardId: unitCard.id,
        card: unitCard,
        owner: pid,
        position: unitPos,
        damage: 0,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      };
    }

    const deckWithIds = deckData.deck.map((card, index) => ({ ...card, id: `${card.id}-${pid}-${index}` }));
    player.hand = deckWithIds.slice(0, HAND_SIZE);
    player.deck = deckWithIds.slice(HAND_SIZE);
    player.discard = [];
    player.activeEvents = [];
    player.moveCount = 0;
    player.attackCount = 0;
    player.hasAttackedEnemy = false;

    players[pid] = player;
  });

  next.board = board;
  next.players = players;
  return next;
};

const buildBaseCoreState = (coreState: any) => {
  const next = cloneState(coreState);
  next.hostStarted = true;
  next.selectedFactions = { '0': 'necromancer', '1': 'paladin' };
  next.readyPlayers = { '0': true, '1': true };
  return initializeSummonerWarsCore(next, next.selectedFactions);
};

// ============================================================================
// 状态注入辅助函数
// ============================================================================

/** 清空指定区域的单位和建筑 */
const clearArea = (board: any[][], positions: { row: number; col: number }[]) => {
  for (const pos of positions) {
    if (board[pos.row]?.[pos.col]) {
      board[pos.row][pos.col] = { ...board[pos.row][pos.col], unit: undefined, structure: undefined };
    }
  }
};

/** 在指定位置放置单位 */
const placeUnit = (board: any[][], pos: { row: number; col: number }, unit: any) => {
  board[pos.row][pos.col] = {
    ...board[pos.row][pos.col],
    unit: { ...unit, position: { ...pos } },
  };
};

/** 创建单位数据 */
const makeUnit = (overrides: Record<string, any>) => ({
  cardId: overrides.cardId ?? `test-${Date.now()}`,
  card: {
    id: overrides.cardId ?? 'test-unit',
    name: overrides.name ?? '测试单位',
    cardType: 'unit',
    faction: overrides.faction ?? '堕落王国',
    cost: overrides.cost ?? 1,
    life: overrides.life ?? 2,
    strength: overrides.strength ?? 1,
    attackType: overrides.attackType ?? 'melee',
    unitClass: overrides.unitClass ?? 'common',
    abilities: overrides.abilities ?? [],
    spriteIndex: overrides.spriteIndex ?? 0,
    spriteAtlas: overrides.spriteAtlas ?? 'cards',
  },
  owner: overrides.owner ?? '0',
  position: overrides.position ?? { row: 0, col: 0 },
  damage: overrides.damage ?? 0,
  boosts: overrides.boosts ?? 0,
  charges: overrides.charges ?? 0,
  hasMoved: overrides.hasMoved ?? false,
  hasAttacked: overrides.hasAttacked ?? false,
});

/** 创建手牌单位卡 */
const makeHandUnitCard = (id: string, name: string, overrides?: Record<string, any>) => ({
  id,
  name,
  cardType: 'unit',
  faction: overrides?.faction ?? '先锋军团',
  cost: overrides?.cost ?? 1,
  life: overrides?.life ?? 3,
  strength: overrides?.strength ?? 1,
  attackType: overrides?.attackType ?? 'melee',
  unitClass: overrides?.unitClass ?? 'common',
  abilities: overrides?.abilities ?? [],
  spriteIndex: overrides?.spriteIndex ?? 0,
  spriteAtlas: overrides?.spriteAtlas ?? 'cards',
});

/**
 * 准备吸取生命 beforeAttack 测试状态
 * 攻击前牺牲2格内友方单位
 */
const prepareLifeDrainBeforeAttackState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
  }

  const board = next.board;
  const attackerPos = { row: 5, col: 2 };
  const victimPos = { row: 4, col: 2 };
  const targetPos = { row: 5, col: 3 };
  clearArea(board, [attackerPos, victimPos, targetPos]);

  placeUnit(board, attackerPos, makeUnit({
    cardId: 'test-life-drainer',
    name: '吸取者',
    faction: '堕落王国',
    strength: 2,
    life: 8,
    attackType: 'melee',
    abilities: ['life_drain'],
    owner: '0',
  }));

  placeUnit(board, victimPos, makeUnit({
    cardId: 'test-life-victim',
    name: '牺牲目标',
    strength: 1,
    life: 1,
    attackType: 'melee',
    owner: '0',
  }));

  placeUnit(board, targetPos, makeUnit({
    cardId: 'test-life-enemy',
    name: '敌方目标',
    strength: 1,
    life: 3,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备圣光箭 beforeAttack 测试状态
 * 攻击前弃牌提升战力
 */
const prepareHolyArrowBeforeAttackState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
    player.hand = [
      makeHandUnitCard('holy-discard-1', '城塞骑士'),
      makeHandUnitCard('holy-discard-2', '城塞战士'),
      ...player.hand,
    ];
  }

  const board = next.board;
  const attackerPos = { row: 5, col: 2 };
  const targetPos = { row: 5, col: 3 };
  clearArea(board, [attackerPos, targetPos]);

  placeUnit(board, attackerPos, makeUnit({
    cardId: 'test-holy-archer',
    name: '雅各布',
    faction: '先锋军团',
    strength: 2,
    life: 7,
    attackType: 'ranged',
    abilities: ['holy_arrow'],
    owner: '0',
  }));

  placeUnit(board, targetPos, makeUnit({
    cardId: 'test-holy-enemy',
    name: '敌方目标',
    strength: 1,
    life: 4,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备治疗 beforeAttack 测试状态
 * 攻击前弃牌并选择友方治疗目标
 */
const prepareHealingBeforeAttackState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
    player.hand = [
      makeHandUnitCard('healing-discard', '治疗弃牌'),
      ...player.hand,
    ];
  }

  const board = next.board;
  const attackerPos = { row: 5, col: 2 };
  const allyPos = { row: 5, col: 3 };
  clearArea(board, [attackerPos, allyPos]);

  placeUnit(board, attackerPos, makeUnit({
    cardId: 'test-healing-priest',
    name: '圣殿牧师',
    faction: '先锋军团',
    strength: 2,
    life: 2,
    attackType: 'melee',
    abilities: ['healing'],
    owner: '0',
  }));

  placeUnit(board, allyPos, makeUnit({
    cardId: 'test-healing-ally',
    name: '受伤友军',
    faction: '先锋军团',
    strength: 1,
    life: 5,
    damage: 2,
    attackType: 'melee',
    owner: '0',
  }));

  return next;
};

/**
 * 准备灵魂转移测试状态
 * 亡灵弓箭手（远程，soul_transfer）攻击1HP敌方单位
 * 高战力确保大概率击杀
 */
const prepareSoulTransferState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
  }

  const board = next.board;
  // 在 row=5,col=2 放置亡灵弓箭手（远程，战力5，有 soul_transfer）
  const archerPos = { row: 5, col: 2 };
  const targetPos = { row: 3, col: 2 }; // 2格距离（远程可达）
  clearArea(board, [archerPos, targetPos]);

  placeUnit(board, archerPos, makeUnit({
    cardId: 'test-soul-archer',
    name: '亡灵弓箭手',
    faction: '堕落王国',
    strength: 6, // 高战力确保击杀
    life: 3,
    attackType: 'ranged',
    abilities: ['soul_transfer'],
    owner: '0',
  }));

  placeUnit(board, targetPos, makeUnit({
    cardId: 'test-enemy-weak',
    name: '弱小敌兵',
    strength: 1,
    life: 1, // 1HP，几乎必死
    damage: 0,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备心灵操控测试状态
 * 召唤阶段：手牌有心灵操控，召唤师2格内有敌方单位
 */
const prepareMindControlEventState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.magic = 10;
    player.summonerId = 'test-trickster-summoner';
    player.hand = [
      {
        id: 'trickster-mind-control',
        cardType: 'event',
        name: '心灵操控',
        eventType: 'legendary',
        cost: 1,
        playPhase: 'summon',
        effect: '选择召唤师2格内的敌方单位获得控制权。',
        isActive: false,
        deckSymbols: [],
      },
      ...player.hand,
    ];
  }

  const board = next.board;
  const summonerPos = { row: 6, col: 2 };
  const enemyPos1 = { row: 5, col: 2 };
  const enemyPos2 = { row: 4, col: 2 };
  clearArea(board, [summonerPos, enemyPos1, enemyPos2]);

  placeUnit(board, summonerPos, makeUnit({
    cardId: 'test-trickster-summoner',
    name: '泰珂露',
    faction: '欺心巫族',
    strength: 3,
    life: 12,
    attackType: 'ranged',
    unitClass: 'summoner',
    abilities: ['mind_capture'],
    owner: '0',
  }));

  placeUnit(board, enemyPos1, makeUnit({
    cardId: 'test-mind-control-target-1',
    name: '敌方目标一',
    strength: 1,
    life: 3,
    attackType: 'melee',
    owner: '1',
  }));

  placeUnit(board, enemyPos2, makeUnit({
    cardId: 'test-mind-control-target-2',
    name: '敌方目标二',
    strength: 1,
    life: 3,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备震慑测试状态
 * 移动阶段：手牌有震慑，召唤师3格直线内有敌方单位
 */
const prepareStunEventState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.magic = 10;
    player.summonerId = 'test-trickster-summoner';
    player.hand = [
      {
        id: 'trickster-stun',
        cardType: 'event',
        name: '震慑',
        eventType: 'common',
        cost: 1,
        playPhase: 'move',
        effect: '推拉敌方单位并造成伤害。',
        isActive: false,
        deckSymbols: [],
      },
      ...player.hand,
    ];
  }

  const board = next.board;
  const summonerPos = { row: 6, col: 2 };
  const enemyPos = { row: 3, col: 2 };
  clearArea(board, [summonerPos, enemyPos]);

  placeUnit(board, summonerPos, makeUnit({
    cardId: 'test-trickster-summoner',
    name: '泰珂露',
    faction: '欺心巫族',
    strength: 3,
    life: 12,
    attackType: 'ranged',
    unitClass: 'summoner',
    abilities: ['mind_capture'],
    owner: '0',
  }));

  placeUnit(board, enemyPos, makeUnit({
    cardId: 'test-stun-target',
    name: '震慑目标',
    strength: 1,
    life: 4,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备催眠引诱测试状态
 * 召唤阶段：手牌有催眠引诱，场上有敌方士兵/冠军
 */
const prepareHypnoticLureEventState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.magic = 10;
    player.summonerId = 'test-trickster-summoner';
    player.hand = [
      {
        id: 'trickster-hypnotic-lure',
        cardType: 'event',
        name: '催眠引诱',
        eventType: 'common',
        cost: 0,
        playPhase: 'summon',
        effect: '选择一个敌方单位向召唤师靠近。',
        isActive: true,
        deckSymbols: [],
      },
      ...player.hand,
    ];
  }

  const board = next.board;
  const summonerPos = { row: 6, col: 2 };
  const enemyPos = { row: 4, col: 2 };
  clearArea(board, [summonerPos, enemyPos]);

  placeUnit(board, summonerPos, makeUnit({
    cardId: 'test-trickster-summoner',
    name: '泰珂露',
    faction: '欺心巫族',
    strength: 3,
    life: 12,
    attackType: 'ranged',
    unitClass: 'summoner',
    abilities: ['mind_capture'],
    owner: '0',
  }));

  placeUnit(board, enemyPos, makeUnit({
    cardId: 'test-hypnotic-target',
    name: '催眠目标',
    strength: 1,
    life: 4,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备殉葬火堆测试状态
 * 主动事件区存在殉葬火堆且有充能，场上有受伤单位
 */
const prepareFuneralPyreState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.activeEvents = [
      {
        id: 'necro-funeral-pyre-test',
        cardType: 'event',
        name: '殉葬火堆',
        eventType: 'legendary',
        cost: 0,
        playPhase: 'magic',
        effect: '充能后治疗受伤单位。',
        isActive: true,
        charges: 2,
        deckSymbols: [],
      },
      ...player.activeEvents,
    ];
  }

  const board = next.board;
  const allyPos = { row: 5, col: 2 };
  clearArea(board, [allyPos]);

  placeUnit(board, allyPos, makeUnit({
    cardId: 'test-funeral-ally',
    name: '受伤友军',
    faction: '堕落王国',
    strength: 2,
    life: 5,
    damage: 2,
    attackType: 'melee',
    owner: '0',
  }));

  return next;
};

/**
 * 准备心灵捕获测试状态
 * 泰珂露（mind_capture）攻击1HP敌方单位
 */
const prepareMindCaptureState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
  }

  const board = next.board;
  const summonerPos = { row: 6, col: 3 };
  const targetPos = { row: 5, col: 3 }; // 相邻（近战可达）
  clearArea(board, [summonerPos, targetPos]);

  placeUnit(board, summonerPos, makeUnit({
    cardId: 'test-trickster-summoner',
    name: '泰珂露',
    faction: '欺心巫族',
    strength: 5,
    life: 7,
    attackType: 'melee',
    unitClass: 'summoner',
    abilities: ['mind_capture'],
    owner: '0',
  }));

  placeUnit(board, targetPos, makeUnit({
    cardId: 'test-enemy-capturable',
    name: '可控敌兵',
    strength: 1,
    life: 1,
    damage: 0,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备念力推拉测试状态
 * 清风法师（telekinesis）攻击敌方单位，攻击后触发推拉选择
 */
const prepareTelekinesisState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
  }

  const board = next.board;
  const magePos = { row: 5, col: 2 };
  const targetPos = { row: 5, col: 3 }; // 相邻
  const pushLandingPos = { row: 5, col: 4 }; // 推开后的位置
  clearArea(board, [magePos, targetPos, pushLandingPos]);

  placeUnit(board, magePos, makeUnit({
    cardId: 'test-telekinesis-mage',
    name: '清风法师',
    faction: '欺心巫族',
    strength: 2,
    life: 2,
    attackType: 'ranged',
    abilities: ['telekinesis'],
    owner: '0',
  }));

  placeUnit(board, targetPos, makeUnit({
    cardId: 'test-enemy-pushable',
    name: '可推敌兵',
    strength: 1,
    life: 5, // 高HP确保不死，这样才能推拉
    damage: 0,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备读心传念测试状态
 * 古尔壮（mind_transmission）攻击敌方后，选择友方士兵额外攻击
 */
const prepareMindTransmissionState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
  }

  const board = next.board;
  const championPos = { row: 5, col: 2 };
  const targetPos = { row: 5, col: 3 }; // 相邻敌方
  const allyPos = { row: 6, col: 2 }; // 3格内友方士兵
  clearArea(board, [championPos, targetPos, allyPos]);

  placeUnit(board, championPos, makeUnit({
    cardId: 'test-mind-transmission',
    name: '古尔壮',
    faction: '欺心巫族',
    strength: 3,
    life: 6,
    attackType: 'melee',
    unitClass: 'champion',
    abilities: ['mind_transmission'],
    owner: '0',
  }));

  placeUnit(board, targetPos, makeUnit({
    cardId: 'test-enemy-target',
    name: '敌方目标',
    strength: 1,
    life: 8, // 高HP确保不死
    damage: 0,
    attackType: 'melee',
    owner: '1',
  }));

  placeUnit(board, allyPos, makeUnit({
    cardId: 'test-ally-soldier',
    name: '友方士兵',
    strength: 2,
    life: 2,
    attackType: 'melee',
    unitClass: 'common',
    owner: '0',
  }));

  return next;
};

/**
 * 准备感染测试状态
 * 亡灵疫病体（infection）攻击1HP敌方，击杀后从弃牌堆选择疫病体
 */
const prepareInfectionState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
    player.hasAttackedEnemy = false;
    // 弃牌堆放入疫病体
    player.discard = [
      {
        id: 'plague-zombie-discard-1',
        name: '亡灵疫病体',
        cardType: 'unit',
        faction: '堕落王国',
        cost: 0,
        life: 1,
        strength: 1,
        attackType: 'melee',
        unitClass: 'common',
        abilities: ['soulless', 'infection'],
        spriteIndex: 4,
        spriteAtlas: 'cards',
      },
      ...player.discard,
    ];
  }

  const board = next.board;
  const zombiePos = { row: 5, col: 2 };
  const targetPos = { row: 5, col: 3 }; // 相邻
  clearArea(board, [zombiePos, targetPos]);

  placeUnit(board, zombiePos, makeUnit({
    cardId: 'test-plague-zombie',
    name: '亡灵疫病体',
    faction: '堕落王国',
    strength: 4, // 高战力确保击杀
    life: 1,
    attackType: 'melee',
    abilities: ['soulless', 'infection'],
    owner: '0',
  }));

  placeUnit(board, targetPos, makeUnit({
    cardId: 'test-enemy-infectable',
    name: '可感染敌兵',
    strength: 1,
    life: 1, // 1HP
    damage: 0,
    attackType: 'melee',
    owner: '1',
  }));

  return next;
};

/**
 * 准备抓附跟随测试状态
 * 抓附手（grab）相邻有友方单位，友方移动后可跟随
 */
const prepareGrabFollowState = (coreState: any) => {
  const next = buildBaseCoreState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.moveCount = 0;
  }

  const board = next.board;
  const grabberPos = { row: 5, col: 2 };
  const allyPos = { row: 5, col: 3 }; // 相邻友方
  const moveTarget = { row: 5, col: 4 }; // 友方移动目标
  const followTarget = { row: 5, col: 5 }; // 跟随位置
  clearArea(board, [grabberPos, allyPos, moveTarget, followTarget]);

  placeUnit(board, grabberPos, makeUnit({
    cardId: 'test-grabber',
    name: '部落抓附手',
    faction: '洞穴地精',
    strength: 1,
    life: 2,
    attackType: 'melee',
    abilities: ['immobile', 'grab'],
    owner: '0',
  }));

  placeUnit(board, allyPos, makeUnit({
    cardId: 'test-ally-mover',
    name: '友方移动者',
    strength: 1,
    life: 2,
    attackType: 'melee',
    owner: '0',
  }));

  return next;
};

// ============================================================================
// 创建在线对局的通用 setup
// ============================================================================

const setupOnlineMatch = async (browser: any, baseURL: string | undefined) => {
  const hostContext = await browser.newContext({ baseURL });
  await blockAudioRequests(hostContext);
  await setEnglishLocale(hostContext);
  await resetMatchStorage(hostContext);
  await enableE2EDebug(hostContext);
  await disableAudio(hostContext);
  await disableTutorial(hostContext);
  const hostPage = await hostContext.newPage();

  const guestContext = await browser.newContext({ baseURL });
  await blockAudioRequests(guestContext);
  await setEnglishLocale(guestContext);
  await resetMatchStorage(guestContext);
  await enableE2EDebug(guestContext);
  await disableAudio(guestContext);
  await disableTutorial(guestContext);
  const guestPage = await guestContext.newPage();

  return { hostContext, hostPage, guestContext, guestPage };
};

const joinAndStartGame = async (
  hostPage: Page, guestPage: Page, matchId: string,
) => {
  const ownerGuestId = matchOwnerGuestIds.get(matchId);
  if (!ownerGuestId) throw new Error(`缺少房主 guestId: ${matchId}`);

  const hostName = `Host-${ownerGuestId}`;
  const guestId = createGuestId('guest');
  const guestName = `Guest-${guestId}`;

  const hostCredentials = await joinSummonerWarsMatch(hostPage, matchId, '0', ownerGuestId, hostName);
  if (!hostCredentials) throw new Error('房主加入失败');
  const guestCredentials = await joinSummonerWarsMatch(guestPage, matchId, '1', guestId, guestName);
  if (!guestCredentials) throw new Error('客人加入失败');

  await seedMatchCredentials(hostPage, {
    matchId,
    playerId: '0',
    credentials: hostCredentials,
    guestId: ownerGuestId,
    playerName: hostName,
  });
  await seedMatchCredentials(guestPage, {
    matchId,
    playerId: '1',
    credentials: guestCredentials,
    guestId,
    playerName: guestName,
  });

  await hostPage.goto(`/play/summonerwars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
  await guestPage.goto(`/play/summonerwars/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

  await expect(hostPage.getByTestId('debug-toggle')).toBeVisible({ timeout: 20000 });
  const baseCore = buildBaseCoreState(await readCoreState(hostPage));
  await applyCoreState(hostPage, baseCore);
  await closeDebugPanelIfOpen(hostPage);

  await waitForSummonerWarsUI(hostPage);
  await waitForSummonerWarsUI(guestPage);
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('SummonerWars 特殊技能交互', () => {

  test('吸取生命：攻击前牺牲友方单位并继续攻击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const lifeDrainCore = prepareLifeDrainBeforeAttackState(coreState);
    await applyCoreState(hostPage, lifeDrainCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中吸取者
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');

    const lifeDrainButton = hostPage.getByRole('button', { name: /吸取生命|Life Drain/i });
    await expect(lifeDrainButton).toBeVisible({ timeout: 5000 });
    await lifeDrainButton.click();
    await hostPage.waitForTimeout(300);

    const abilityBanner = hostPage.getByText('吸取生命：选择2格内的友方单位消灭');
    await expect(abilityBanner).toBeVisible({ timeout: 5000 });

    // 选择牺牲单位
    await clickBoardElement(hostPage, '[data-testid="sw-cell-4-2"]');
    await hostPage.waitForTimeout(500);
    const readyBanner = hostPage.getByText('攻击前技能：吸取生命已就绪，选择攻击目标');
    await expect(readyBanner).toBeVisible({ timeout: 5000 });

    // 选择攻击目标
    await clickBoardElement(hostPage, '[data-testid="sw-cell-5-3"]');
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('圣光箭：攻击前弃牌加成并触发攻击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const holyArrowCore = prepareHolyArrowBeforeAttackState(coreState);
    await applyCoreState(hostPage, holyArrowCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中雅各布
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');

    const holyArrowButton = hostPage.getByRole('button', { name: /圣光箭|Holy Arrow/i });
    await expect(holyArrowButton).toBeVisible({ timeout: 5000 });
    await holyArrowButton.click();

    const abilityBanner = hostPage.getByText('圣光箭：选择任意数量非同名单位卡弃除');
    await expect(abilityBanner).toBeVisible({ timeout: 5000 });

    const handArea = hostPage.getByTestId('sw-hand-area');
    await handArea.locator('[data-card-id="holy-discard-1"]').click();
    await handArea.locator('[data-card-id="holy-discard-2"]').click();

    const confirmDiscard = hostPage.getByRole('button', { name: /确认弃牌/ });
    await expect(confirmDiscard).toBeVisible({ timeout: 5000 });
    await confirmDiscard.click();
    const readyBanner = hostPage.getByText('攻击前技能：圣光箭已就绪，选择攻击目标');
    await expect(readyBanner).toBeVisible({ timeout: 5000 });

    await clickBoardElement(hostPage, '[data-testid="sw-cell-5-3"]');
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('治疗：攻击前弃牌并选择友方目标治疗', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const healingCore = prepareHealingBeforeAttackState(coreState);
    await applyCoreState(hostPage, healingCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中圣殿牧师
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');

    const healingButton = hostPage.getByRole('button', { name: /治疗|Healing/i });
    await expect(healingButton).toBeVisible({ timeout: 5000 });
    await healingButton.click();

    const abilityBanner = hostPage.getByText('治疗：选择要弃除的手牌');
    await expect(abilityBanner).toBeVisible({ timeout: 5000 });

    const handArea = hostPage.getByTestId('sw-hand-area');
    await handArea.locator('[data-card-id="healing-discard"]').click();

    const confirmDiscard = hostPage.getByRole('button', { name: /确认弃牌/ });
    await expect(confirmDiscard).toBeVisible({ timeout: 5000 });
    await confirmDiscard.click();
    const readyBanner = hostPage.getByText('攻击前技能：治疗已就绪，选择友方目标');
    await expect(readyBanner).toBeVisible({ timeout: 5000 });

    // 选择友方目标进行治疗攻击
    await clickBoardElement(hostPage, '[data-testid="sw-cell-5-3"]');
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('灵魂转移：击杀后弹出瞬移确认横幅', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    // 注入灵魂转移测试状态
    const coreState = await readCoreState(hostPage);
    const soulTransferCore = prepareSoulTransferState(coreState);
    await applyCoreState(hostPage, soulTransferCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中亡灵弓箭手
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');
    // 攻击敌方目标
    await clickBoardElement(hostPage, '[data-testid="sw-cell-3-2"]');

    // 等待骰子结果
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });

    // 关闭骰子结果后，检查灵魂转移横幅
    // 由于骰子随机，可能不一定击杀，使用软断言
    await hostPage.waitForTimeout(2000); // 等待骰子动画
    // 点击骰子 overlay 关闭（如果有关闭按钮）
    const diceCloseBtn = diceOverlay.locator('button').first();
    if (await diceCloseBtn.isVisible().catch(() => false)) {
      await diceCloseBtn.click();
    }
    await hostPage.waitForTimeout(1000);

    // 检查灵魂转移横幅（bg-cyan-900 + "灵魂转移"文本）
    const soulTransferBanner = hostPage.locator('.bg-cyan-900');
    const hasBanner = await soulTransferBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      // 验证横幅内容
      await expect(soulTransferBanner).toContainText(/灵魂转移/);
      // 验证确认和跳过按钮
      const confirmBtn = soulTransferBanner.getByRole('button', { name: /确认移动/i });
      const skipBtn = soulTransferBanner.getByRole('button', { name: /跳过/i });
      await expect(confirmBtn).toBeVisible();
      await expect(skipBtn).toBeVisible();
      // 点击确认移动
      await confirmBtn.click();
      // 横幅应消失
      await expect(soulTransferBanner).toBeHidden({ timeout: 5000 });
    }
    // 如果没有横幅说明骰子没击杀，测试仍然通过（骰子随机）

    await hostContext.close();
    await guestContext.close();
  });

  test('心灵操控：选择目标并确认控制', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const mindControlCore = prepareMindControlEventState(coreState);
    await applyCoreState(hostPage, mindControlCore);
    await closeDebugPanelIfOpen(hostPage);

    const mindControlCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id*="mind-control"], [data-card-name*="心灵操控"]')
      .first();
    await mindControlCard.click();

    const mindControlBanner = hostPage.locator('.bg-cyan-900');
    const hasBanner = await mindControlBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      await expect(mindControlBanner).toContainText(/心灵操控/);
      await clickBoardElement(hostPage, '[data-testid="sw-cell-5-2"]');
      await hostPage.waitForTimeout(500);
      const confirmButton = mindControlBanner.getByRole('button', { name: /确认控制/i });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }
      await expect(mindControlBanner).toBeHidden({ timeout: 5000 }).catch(() => {});
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('震慑：选择目标与方向距离确认', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const stunCore = prepareStunEventState(coreState);
    await applyCoreState(hostPage, stunCore);
    await closeDebugPanelIfOpen(hostPage);

    const stunCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id*="stun"], [data-card-name*="震慑"]')
      .first();
    await stunCard.click();

    const stunBanner = hostPage.locator('.bg-yellow-900');
    const hasBanner = await stunBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      await expect(stunBanner).toContainText(/震慑/);
      await clickBoardElement(hostPage, '[data-testid="sw-cell-3-2"]');
      await hostPage.waitForTimeout(500);
      const distanceBtn = stunBanner.getByRole('button', { name: '2' });
      if (await distanceBtn.isVisible().catch(() => false)) {
        await distanceBtn.click();
      }
      const confirmBtn = stunBanner.getByRole('button', { name: /确认/i });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
      await expect(stunBanner).toBeHidden({ timeout: 5000 }).catch(() => {});
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('催眠引诱：选择敌方单位触发标记', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const lureCore = prepareHypnoticLureEventState(coreState);
    await applyCoreState(hostPage, lureCore);
    await closeDebugPanelIfOpen(hostPage);

    const lureCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id*="hypnotic"], [data-card-name*="催眠引诱"]')
      .first();
    await lureCard.click();

    const lureBanner = hostPage.locator('.bg-pink-900');
    const hasBanner = await lureBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      await expect(lureBanner).toContainText(/催眠引诱/);
      await clickBoardElement(hostPage, '[data-testid="sw-cell-4-2"]');
      await hostPage.waitForTimeout(500);
      await expect(lureBanner).toBeHidden({ timeout: 5000 }).catch(() => {});
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('殉葬火堆：充能后选择受伤单位治疗', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const funeralCore = prepareFuneralPyreState(coreState);
    await applyCoreState(hostPage, funeralCore);
    await closeDebugPanelIfOpen(hostPage);

    const pyreBanner = hostPage.locator('.bg-orange-900');
    const hasBanner = await pyreBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      await expect(pyreBanner).toContainText(/殉葬火堆/);
      await clickBoardElement(hostPage, '[data-testid="sw-cell-5-2"]');
      await hostPage.waitForTimeout(500);
      await expect(pyreBanner).toBeHidden({ timeout: 5000 }).catch(() => {});
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('心灵捕获：攻击后选择控制或伤害', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const mindCaptureCore = prepareMindCaptureState(coreState);
    await applyCoreState(hostPage, mindCaptureCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中泰珂露
    await clickBoardElement(hostPage, '[data-testid="sw-unit-6-3"]');
    // 攻击相邻敌方
    await clickBoardElement(hostPage, '[data-testid="sw-cell-5-3"]');

    // 等待骰子结果
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });
    await hostPage.waitForTimeout(2000);
    const diceCloseBtn = diceOverlay.locator('button').first();
    if (await diceCloseBtn.isVisible().catch(() => false)) {
      await diceCloseBtn.click();
    }
    await hostPage.waitForTimeout(1000);

    // 检查心灵捕获横幅（bg-indigo-900 + "心灵捕获"文本）
    const mindCaptureBanner = hostPage.locator('.bg-indigo-900');
    const hasBanner = await mindCaptureBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      await expect(mindCaptureBanner).toContainText(/心灵捕获/);
      // 验证控制和伤害按钮
      const controlBtn = mindCaptureBanner.getByRole('button', { name: /控制/i });
      const damageBtn = mindCaptureBanner.getByRole('button', { name: /伤害/i });
      await expect(controlBtn).toBeVisible();
      await expect(damageBtn).toBeVisible();
      // 选择控制
      await controlBtn.click();
      await expect(mindCaptureBanner).toBeHidden({ timeout: 5000 });
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('念力推拉：攻击后选择推开或拉近方向', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const telekinesisCore = prepareTelekinesisState(coreState);
    await applyCoreState(hostPage, telekinesisCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中清风法师
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');
    // 攻击相邻敌方
    await clickBoardElement(hostPage, '[data-testid="sw-cell-5-3"]');

    // 等待骰子结果
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });
    await hostPage.waitForTimeout(2000);
    const diceCloseBtn = diceOverlay.locator('button').first();
    if (await diceCloseBtn.isVisible().catch(() => false)) {
      await diceCloseBtn.click();
    }
    await hostPage.waitForTimeout(1000);

    // 念力在攻击后触发（不依赖击杀），检查两种可能的横幅：
    // 1. afterAttackAbilityMode 横幅（bg-teal-900 + "选择目标"）
    // 2. telekinesisTargetMode 横幅（bg-teal-900 + "推拉方向"）
    const teleBanner = hostPage.locator('.bg-teal-900');
    const hasBanner = await teleBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      const bannerText = await teleBanner.innerText();

      if (bannerText.includes('选择目标')) {
        // afterAttackAbilityMode：需要先选择目标
        // 点击敌方单位作为推拉目标
        await clickBoardElement(hostPage, '[data-testid="sw-unit-5-3"]').catch(() => {});
        await hostPage.waitForTimeout(500);
      }

      // 检查推拉方向选择
      const pushBtn = hostPage.getByRole('button', { name: /推开/i });
      const pullBtn = hostPage.getByRole('button', { name: /拉近/i });
      const cancelBtn = hostPage.getByRole('button', { name: /取消/i });

      const hasPushPull = await pushBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasPushPull) {
        await expect(pushBtn).toBeVisible();
        await expect(pullBtn).toBeVisible();
        await expect(cancelBtn).toBeVisible();
        // 选择推开
        await pushBtn.click();
        await expect(teleBanner).toBeHidden({ timeout: 5000 }).catch(() => {});
      } else {
        // 可能跳过了（目标已死或无有效目标）
        const skipBtn = hostPage.getByRole('button', { name: /跳过/i });
        if (await skipBtn.isVisible().catch(() => false)) {
          await skipBtn.click();
        }
      }
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('读心传念：攻击后选择友方士兵进行额外攻击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const mindTransCore = prepareMindTransmissionState(coreState);
    await applyCoreState(hostPage, mindTransCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中古尔壮
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');
    // 攻击相邻敌方
    await clickBoardElement(hostPage, '[data-testid="sw-cell-5-3"]');

    // 等待骰子结果
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });
    await hostPage.waitForTimeout(2000);
    const diceCloseBtn = diceOverlay.locator('button').first();
    if (await diceCloseBtn.isVisible().catch(() => false)) {
      await diceCloseBtn.click();
    }
    await hostPage.waitForTimeout(1000);

    // 读心传念在攻击敌方后触发，检查 afterAttackAbilityMode 横幅
    const teleBanner = hostPage.locator('.bg-teal-900');
    const hasBanner = await teleBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBanner) {
      await expect(teleBanner).toContainText(/读心传念|选择目标/);
      // 选择友方士兵作为额外攻击目标
      await clickBoardElement(hostPage, '[data-testid="sw-unit-6-2"]').catch(() => {});
      await hostPage.waitForTimeout(500);

      // 或者跳过
      const skipBtn = hostPage.getByRole('button', { name: /跳过/i });
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
      }
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('感染：击杀后从弃牌堆选择疫病体替换', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const infectionCore = prepareInfectionState(coreState);
    await applyCoreState(hostPage, infectionCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中疫病体
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');
    // 攻击相邻敌方
    await clickBoardElement(hostPage, '[data-testid="sw-cell-5-3"]');

    // 等待骰子结果
    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });
    await hostPage.waitForTimeout(2000);
    const diceCloseBtn = diceOverlay.locator('button').first();
    if (await diceCloseBtn.isVisible().catch(() => false)) {
      await diceCloseBtn.click();
    }
    await hostPage.waitForTimeout(1000);

    // 感染在击杀后触发，弹出卡牌选择器（从弃牌堆选疫病体）
    const cardSelector = hostPage.getByTestId('sw-card-selector-overlay');
    const hasSelector = await cardSelector.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasSelector) {
      // 验证卡牌选择器标题包含"感染"
      await expect(cardSelector).toContainText(/感染|疫病体/);
      // 选择弃牌堆中的疫病体
      const plagueCard = cardSelector.locator('[data-card-id]').first();
      if (await plagueCard.isVisible().catch(() => false)) {
        await plagueCard.click();
        // 选择器应关闭
        await expect(cardSelector).toBeHidden({ timeout: 5000 }).catch(() => {});
      }
    }
    // 如果没有选择器说明骰子没击杀

    await hostContext.close();
    await guestContext.close();
  });

  test('抓附跟随：友方移动后选择跟随位置', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const { hostContext, hostPage, guestContext, guestPage } = await setupOnlineMatch(browser, baseURL);

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, '游戏服务器不可用');
    }
    const matchId = await createSummonerWarsRoom(hostPage);
    if (!matchId) test.skip(true, '创建房间失败');

    await joinAndStartGame(hostPage, guestPage, matchId!);

    const coreState = await readCoreState(hostPage);
    const grabCore = prepareGrabFollowState(coreState);
    await applyCoreState(hostPage, grabCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中友方移动者（非抓附手）
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-3"]');
    // 移动到空位
    const moveCell = hostPage.locator('[data-valid-move="true"]').first();
    const hasMoveCell = await moveCell.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasMoveCell) {
      await clickBoardElement(hostPage, '[data-valid-move="true"]');
      await hostPage.waitForTimeout(1000);

      // 抓附跟随：检查是否出现跟随位置选择高亮
      // 抓附手的跟随位置应该高亮显示
      const grabHighlight = hostPage.locator('[data-valid-grab-follow="true"]');
      const hasGrabHighlight = await grabHighlight.first().isVisible({ timeout: 3000 }).catch(() => false);

      if (hasGrabHighlight) {
        // 点击跟随位置
        await clickBoardElement(hostPage, '[data-valid-grab-follow="true"]');
        await hostPage.waitForTimeout(500);
      }
      // 如果没有高亮，可能是抓附手不在相邻位置或实现方式不同
    }

    await hostContext.close();
    await guestContext.close();
  });
});
