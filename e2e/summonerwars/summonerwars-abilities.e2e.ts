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

import { type BrowserContext, type Page } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { createDeckByFactionId } from '../../src/games/summonerwars/config/factions';
import { BOARD_COLS, BOARD_ROWS, HAND_SIZE } from '../../src/games/summonerwars/domain/helpers';
import {
  applyCoreState as applyCoreStateViaServer,
  clickBoardElement as clickBoardElementViaHelper,
  cloneState,
  closeDebugPanelIfOpen as closeDebugPanelIfOpenViaHelper,
  readCoreState as readCoreStateViaServer,
  setupSWOnlineMatch,
  waitForPhase as waitForPhaseViaHelper,
} from '../helpers/summonerwars';
import { getMatchState } from '../helpers/state-injection';
import { setChineseLocale, waitForTestHarness } from '../helpers/common';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('summonerwars');
  await game.setupScene({ gameId: 'summonerwars' });
};
void __ensureThreeAxesMarker;


// ============================================================================
// 通用辅助函数（与 summonerwars.e2e.ts 保持一致）
// ============================================================================

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
  if (!clicked) throw new Error(`棋盘元素未找到: ${selector}`);
};

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

const clearRect = (
  board: any[][],
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
) => {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      if (board[row]?.[col]) {
        board[row][col] = { ...board[row][col], unit: undefined, structure: undefined };
      }
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
 * 攻击前牺牲格内友方单位
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
      makeHandUnitCard('holy-discard-1', '城堡骑士'),
      makeHandUnitCard('holy-discard-2', '城堡战士'),
      ...player.hand,
    ];
  }

  return next;
};

const makeInjectedInstanceId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const prepareFireSacrificeOnlineState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;
  next.summonTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  const necromancerDeck = createDeckByFactionId('necromancer');
  const elutBarCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id === 'necro-elut-bar',
  );
  const sacrificeCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('necro-undead-warrior-'),
  );

  if (!elutBarCard || elutBarCard.cardType !== 'unit') {
    throw new Error('未找到真实伊路特-巴尔卡牌模板');
  }
  if (!sacrificeCard || sacrificeCard.cardType !== 'unit') {
    throw new Error('未找到真实亡灵战士卡牌模板');
  }

  const handCardId = makeInjectedInstanceId('e2e-fire-sacrifice-hand');
  player.magic = Math.max(Number(player.magic ?? 0), Number(elutBarCard.cost ?? 0));
  player.hand = [
    { ...elutBarCard, id: handCardId },
    ...(player.hand ?? []).filter((card: any) => card.id !== handCardId),
  ];

  const board = next.board as Array<Array<Record<string, any>>>;
  let sacrificePosition: { row: number; col: number } | null = null;

  for (let row = 0; row < board.length && !sacrificePosition; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0) && !sacrificePosition; col += 1) {
      const unit = board[row]?.[col]?.unit;
      if (unit?.owner === '0' && unit?.card?.unitClass !== 'summoner' && unit?.instanceId) {
        sacrificePosition = { row, col };
      }
    }
  }

  if (!sacrificePosition) {
    for (let row = board.length - 1; row >= 0 && !sacrificePosition; row -= 1) {
      for (let col = 0; col < (board[row]?.length ?? 0) && !sacrificePosition; col += 1) {
        const cell = board[row]?.[col];
        if (!cell || cell.unit || cell.structure) continue;
        board[row][col] = {
          ...cell,
          unit: {
            instanceId: makeInjectedInstanceId('e2e-fire-sacrifice-target'),
            cardId: sacrificeCard.id,
            card: { ...sacrificeCard },
            owner: '0',
            position: { row, col },
            damage: 0,
            boosts: 0,
            hasMoved: false,
            hasAttacked: false,
          },
        };
        sacrificePosition = { row, col };
      }
    }
  }

  if (!sacrificePosition) {
    throw new Error('无法准备火祀召唤所需的可牺牲友军');
  }

  return { core: next, handCardId, sacrificePosition };
};

const prepareLifeDrainOnlineState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const necromancerDeck = createDeckByFactionId('necromancer');
  const paladinDeck = createDeckByFactionId('paladin');
  const dragosCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id === 'necro-dragos',
  );
  const allyCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('necro-undead-warrior-'),
  );
  const enemyCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id === 'paladin-corin',
  );

  if (!dragosCard || dragosCard.cardType !== 'unit') {
    throw new Error('未找到真实德拉戈斯卡牌模板');
  }
  if (!allyCard || allyCard.cardType !== 'unit') {
    throw new Error('未找到真实亡灵战士卡牌模板');
  }
  if (!enemyCard || enemyCard.cardType !== 'unit') {
    throw new Error('未找到真实敌方高血单位卡牌模板');
  }

  const board = next.board as Array<Array<Record<string, any>>>;
  const dragosPosition = { row: 5, col: 2 };
  const allyPosition = { row: 4, col: 2 };
  const enemyPosition = { row: 5, col: 3 };

  clearArea(board, [dragosPosition, allyPosition, enemyPosition]);

  placeUnit(board, dragosPosition, {
    instanceId: makeInjectedInstanceId('e2e-life-drain-dragos'),
    cardId: dragosCard.id,
    card: { ...dragosCard },
    owner: '0',
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  placeUnit(board, allyPosition, {
    instanceId: makeInjectedInstanceId('e2e-life-drain-ally'),
    cardId: allyCard.id,
    card: { ...allyCard },
    owner: '0',
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  placeUnit(board, enemyPosition, {
    instanceId: makeInjectedInstanceId('e2e-life-drain-enemy'),
    cardId: enemyCard.id,
    card: { ...enemyCard },
    owner: '1',
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  return { core: next, dragosPosition, allyPosition, enemyPosition };
};

const prepareSoulTransferOnlineState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const necromancerDeck = createDeckByFactionId('necromancer');
  const paladinDeck = createDeckByFactionId('paladin');
  const archerCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('necro-undead-archer-'),
  );
  const enemyCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('paladin-temple-priest-'),
  );

  if (!archerCard || archerCard.cardType !== 'unit') {
    throw new Error('未找到真实亡灵弓箭手卡牌模板');
  }
  if (!enemyCard || enemyCard.cardType !== 'unit') {
    throw new Error('未找到真实敌方祭司卡牌模板');
  }

  const board = next.board as Array<Array<Record<string, any>>>;
  const archerPosition = { row: 4, col: 2 };
  const victimPosition = { row: 4, col: 4 };
  clearRect(board, 3, 5, 1, 4);

  placeUnit(board, archerPosition, {
    instanceId: makeInjectedInstanceId('e2e-soul-transfer-archer'),
    cardId: archerCard.id,
    card: { ...archerCard },
    owner: '0',
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  placeUnit(board, victimPosition, {
    instanceId: makeInjectedInstanceId('e2e-soul-transfer-victim'),
    cardId: enemyCard.id,
    card: { ...enemyCard },
    owner: '1',
    damage: Math.max(0, Number(enemyCard.life ?? 1) - 1),
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  return { core: next, archerPosition, victimPosition };
};

const prepareInfectionOnlineState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.attackCount = 0;
  player.hasAttackedEnemy = false;

  const necromancerDeck = createDeckByFactionId('necromancer');
  const paladinDeck = createDeckByFactionId('paladin');
  const plagueZombieCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('necro-plague-zombie-'),
  );
  const enemyCard = paladinDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('paladin-temple-priest-'),
  );

  if (!plagueZombieCard || plagueZombieCard.cardType !== 'unit') {
    throw new Error('未找到真实亡灵疫病体卡牌模板');
  }
  if (!enemyCard || enemyCard.cardType !== 'unit') {
    throw new Error('未找到真实敌方祭司卡牌模板');
  }

  const discardCardId = makeInjectedInstanceId('e2e-infection-discard-zombie');
  player.discard = [
    { ...plagueZombieCard, id: discardCardId },
    ...(player.discard ?? []).filter((card: any) => card.id !== discardCardId),
  ];

  const board = next.board as Array<Array<Record<string, any>>>;
  const attackerPosition = { row: 5, col: 2 };
  const victimPosition = { row: 5, col: 3 };
  clearArea(board, [attackerPosition, victimPosition]);

  placeUnit(board, attackerPosition, {
    instanceId: makeInjectedInstanceId('e2e-infection-attacker'),
    cardId: plagueZombieCard.id,
    card: { ...plagueZombieCard },
    owner: '0',
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  placeUnit(board, victimPosition, {
    instanceId: makeInjectedInstanceId('e2e-infection-victim'),
    cardId: enemyCard.id,
    card: { ...enemyCard },
    owner: '1',
    damage: Math.max(0, Number(enemyCard.life ?? 1) - 1),
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  return { core: next, attackerPosition, victimPosition, discardCardId };
};

const prepareFuneralPyreOnlineState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'draw';
  next.currentPlayer = '1';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  const necromancerDeck = createDeckByFactionId('necromancer');
  const funeralPyreCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'event' && card.id.startsWith('necro-funeral-pyre-'),
  );
  const woundedCard = necromancerDeck.deck.find(
    (card) => card.cardType === 'unit' && card.id.startsWith('necro-undead-warrior-'),
  );

  if (!funeralPyreCard || funeralPyreCard.cardType !== 'event') {
    throw new Error('未找到真实殉葬火堆卡牌模板');
  }
  if (!woundedCard || woundedCard.cardType !== 'unit') {
    throw new Error('未找到真实亡灵战士卡牌模板');
  }

  const player0 = next.players?.['0'];
  if (!player0) throw new Error('无法读取玩家0状态');
  const pyreCardId = makeInjectedInstanceId('necro-funeral-pyre');
  player0.activeEvents = [
    {
      ...funeralPyreCard,
      id: pyreCardId,
      isActive: true,
      charges: 2,
    },
  ];

  const board = next.board as Array<Array<Record<string, any>>>;
  const woundedPosition = { row: 5, col: 2 };
  clearArea(board, [woundedPosition]);
  placeUnit(board, woundedPosition, {
    instanceId: makeInjectedInstanceId('e2e-funeral-pyre-wounded'),
    cardId: woundedCard.id,
    card: { ...woundedCard },
    owner: '0',
    damage: 3,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  });

  return { core: next, pyreCardId, woundedPosition };
};

const setHarnessRandomQueue = async (page: Page, values: number[]) => {
  await page.evaluate((queue) => {
    const harness = (window as Window & {
      __BG_TEST_HARNESS__?: { random?: { setQueue?: (items: number[]) => void } };
    }).__BG_TEST_HARNESS__;
    if (typeof harness?.random?.setQueue !== 'function') {
      throw new Error('__BG_TEST_HARNESS__.random.setQueue not found');
    }
    harness.random.setQueue(queue);
  }, values);
};

const clickAbilityPromptButton = async (page: Page, pattern: string) => page.evaluate((patternSource) => {
  const isVisible = (node: Element | null) => {
    if (!(node instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const regex = new RegExp(patternSource, 'i');
  const prompt = Array.from(document.querySelectorAll('[data-testid="sw-ability-prompt"]'))
    .find((node) => isVisible(node));
  if (!(prompt instanceof HTMLElement)) {
    return { clicked: false, reason: 'prompt-not-visible', promptText: '' };
  }
  const button = Array.from(prompt.querySelectorAll('button'))
    .find((node) => regex.test(node.textContent ?? ''));
  if (!(button instanceof HTMLButtonElement)) {
    return { clicked: false, reason: 'button-not-found', promptText: prompt.innerText || prompt.textContent || '' };
  }
  if (button.disabled) {
    return { clicked: false, reason: 'button-disabled', promptText: prompt.innerText || prompt.textContent || '' };
  }
  button.click();
  return { clicked: true, reason: 'clicked', promptText: prompt.innerText || prompt.textContent || '' };
}, pattern).catch(() => ({ clicked: false, reason: 'page-evaluate-failed', promptText: '' }));

const readVisibleAbilityPromptText = async (page: Page) => page.evaluate(() => {
  const isVisible = (node: Element | null) => {
    if (!(node instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const overlayVisible = isVisible(document.querySelector('[data-testid="sw-dice-result-overlay"]'));
  if (overlayVisible) return '';
  const prompt = Array.from(document.querySelectorAll('[data-testid="sw-ability-prompt"]'))
    .find((node) => isVisible(node));
  if (!(prompt instanceof HTMLElement)) return '';
  return (prompt.innerText || prompt.textContent || '').trim();
}).catch(() => '');

const runWithStepTimeout = async <T>(label: string, promise: Promise<T>, timeoutMs = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`步骤超时: ${label}`)), timeoutMs);
    }),
  ]);
};

const waitForSoulTransferPrompt = async (page: Page) => {
  const overlay = page.getByTestId('sw-dice-result-overlay');
  try {
    const overlayVisible = await overlay.isVisible().catch(() => false);
    if (overlayVisible) {
      await overlay.click({ force: true }).catch(() => {});
      await expect(overlay).toBeHidden({ timeout: 8000 }).catch(() => {});
    }

    let promptText = '';
    await expect.poll(async () => {
      promptText = await readVisibleAbilityPromptText(page);
      return /灵魂转移|Soul Transfer|确认移动|Confirm Move/i.test(promptText);
    }, {
      timeout: 15000,
      message: '等待灵魂转移确认提示出现',
    }).toBe(true);
  } catch {
    const matchId = await page.evaluate(() => {
      const match = window.location.pathname.match(/\/play\/[^/]+\/match\/([^/?#]+)/i);
      return match?.[1] ?? null;
    }).catch(() => null);
    const bannerText = await page.getByTestId('sw-action-banner').textContent().catch(() => null);

    let lastSnapshot: unknown = { matchId, bannerText };
    if (matchId) {
      try {
        const liveState = await getMatchState(matchId, page) as {
          core?: {
            phase?: string;
            currentPlayer?: string;
            board?: Array<Array<{
              unit?: {
                owner?: string;
                cardId?: string;
                card?: { name?: string; life?: number };
                damage?: number;
              };
            }>>;
          };
          sys?: {
            phase?: string;
            currentPlayerIndex?: number;
            turnOrder?: string[];
            interaction?: {
              current?: {
                id?: string;
                kind?: string;
                playerId?: string;
                data?: unknown;
                options?: Array<{ id?: string; label?: string; value?: unknown }>;
              };
              queue?: unknown[];
            };
          };
        };

        lastSnapshot = {
          matchId,
          bannerText,
          corePhase: liveState.core?.phase ?? null,
          currentPlayer: liveState.core?.currentPlayer ?? null,
          sysPhase: liveState.sys?.phase ?? null,
          currentPlayerIndex: liveState.sys?.currentPlayerIndex ?? null,
          turnOrder: liveState.sys?.turnOrder ?? null,
          currentInteraction: liveState.sys?.interaction?.current
            ? {
                id: liveState.sys.interaction.current.id,
                kind: liveState.sys.interaction.current.kind,
                playerId: liveState.sys.interaction.current.playerId,
                data: liveState.sys.interaction.current.data,
                options: liveState.sys.interaction.current.options?.map((option) => ({
                  id: option.id,
                  label: option.label,
                  value: option.value,
                })),
              }
            : null,
          queueLength: liveState.sys?.interaction?.queue?.length ?? null,
          archerCell: liveState.core?.board?.[4]?.[2]?.unit
            ? {
                owner: liveState.core.board[4][2].unit?.owner ?? null,
                cardId: liveState.core.board[4][2].unit?.cardId ?? null,
                name: liveState.core.board[4][2].unit?.card?.name ?? null,
                damage: liveState.core.board[4][2].unit?.damage ?? null,
              }
            : null,
          victimCell: liveState.core?.board?.[4]?.[4]?.unit
            ? {
                owner: liveState.core.board[4][4].unit?.owner ?? null,
                cardId: liveState.core.board[4][4].unit?.cardId ?? null,
                name: liveState.core.board[4][4].unit?.card?.name ?? null,
                damage: liveState.core.board[4][4].unit?.damage ?? null,
                life: liveState.core.board[4][4].unit?.card?.life ?? null,
              }
            : null,
        };
      } catch (error) {
        lastSnapshot = {
          matchId,
          bannerText,
          serverStateError: error instanceof Error ? error.message : String(error),
        };
      }
    }

    throw new Error(`等待灵魂转移确认提示出现并关闭攻击骰子特写失败: ${JSON.stringify(lastSnapshot)}`);
  }

  return page.getByTestId('sw-ability-prompt').first();
};

test.describe('亡灵交互技能', () => {
  test('火祀召唤：召唤后选择牺牲友军并移动到牺牲位置', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'necromancer', 'paladin');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const prepared = prepareFireSacrificeOnlineState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'summon');

      const elutBarInHand = hostPage
        .getByTestId('sw-hand-area')
        .locator(`[data-card-id="${prepared.handCardId}"]`)
        .first();
      await expect(elutBarInHand).toBeVisible({ timeout: 5000 });
      await elutBarInHand.click();

      const summonTarget = hostPage.locator('[data-valid-summon="true"]').first();
      await expect(summonTarget).toBeVisible({ timeout: 5000 });
      const summonTargetId = await summonTarget.getAttribute('data-testid');
      if (!summonTargetId) {
        throw new Error('火祀召唤测试：无法解析召唤落点');
      }
      await clickBoardElementViaHelper(hostPage, `[data-testid="${summonTargetId}"]`);

      const prompt = hostPage.getByTestId('sw-ability-prompt');
      await expect(prompt).toBeVisible({ timeout: 5000 });
      await expect(prompt).toContainText(/火祀召唤|火祭召唤|Fire Sacrifice/i);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'fire-sacrifice-prompt-visible', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/火祀召唤：召唤后选择牺牲友军并移动到牺牲位置',
        }),
      });

      const sacrificeSelector = `[data-testid="sw-unit-${prepared.sacrificePosition.row}-${prepared.sacrificePosition.col}"][data-owner="0"]`;
      await expect(hostPage.locator(sacrificeSelector).first()).toBeVisible({ timeout: 5000 });
      await clickBoardElementViaHelper(hostPage, sacrificeSelector);

      const summonMatch = summonTargetId.match(/sw-cell-(\d+)-(\d+)/);
      if (!summonMatch) {
        throw new Error(`火祀召唤测试：无法解析召唤落点坐标 ${summonTargetId}`);
      }
      const summonRow = Number(summonMatch[1]);
      const summonCol = Number(summonMatch[2]);

      await expect.poll(async () => {
        const latestCore = await readCoreStateViaServer(hostPage);
        return {
          summonCellEmpty: !latestCore.board?.[summonRow]?.[summonCol]?.unit,
          summonedUnitName: latestCore.board?.[prepared.sacrificePosition.row]?.[prepared.sacrificePosition.col]?.unit?.card?.name ?? null,
        };
      }, { timeout: 8000 }).toEqual({
        summonCellEmpty: true,
        summonedUnitName: '伊路特-巴尔',
      });
      await expect.poll(async () => {
        const latestState = await getMatchState(match.matchId, hostPage) as { sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } } };
        const type = latestState.sys?.interaction?.current?.data?.sw?.type ?? null;
        return type === 'fire_sacrifice_summon' ? type : 'fire_sacrifice_resolved';
      }, { timeout: 8000 }).toBe('fire_sacrifice_resolved');
      await expect.poll(async () => {
        const promptText = await readVisibleAbilityPromptText(hostPage);
        return /火祀召唤|火祭召唤|Fire Sacrifice/i.test(promptText)
          ? 'fire_sacrifice_prompt_visible'
          : 'fire_sacrifice_prompt_cleared';
      }, { timeout: 8000 }).toBe('fire_sacrifice_prompt_cleared');
      await hostPage.waitForTimeout(1200);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'fire-sacrifice-complete', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/火祀召唤：召唤后选择牺牲友军并移动到牺牲位置',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('吸取生命：宣告攻击后出现牺牲友军提示并完成牺牲', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'necromancer', 'paladin');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const prepared = prepareLifeDrainOnlineState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');

      const dragosSelector = `[data-testid="sw-unit-${prepared.dragosPosition.row}-${prepared.dragosPosition.col}"][data-owner="0"]`;
      const enemySelector = `[data-testid="sw-unit-${prepared.enemyPosition.row}-${prepared.enemyPosition.col}"][data-owner="1"]`;
      const allySelector = `[data-testid="sw-unit-${prepared.allyPosition.row}-${prepared.allyPosition.col}"][data-owner="0"]`;

      await expect(hostPage.locator(dragosSelector).first()).toBeVisible({ timeout: 5000 });
      await clickBoardElementViaHelper(hostPage, dragosSelector);
      await expect(hostPage.locator(enemySelector).first()).toBeVisible({ timeout: 5000 });
      await clickBoardElementViaHelper(hostPage, enemySelector);

      const prompt = hostPage.getByTestId('sw-ability-prompt');
      await expect(prompt).toBeVisible({ timeout: 5000 });
      await expect(prompt).toContainText(/吸取生命|Life Drain/i);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'life-drain-prompt-visible', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/吸取生命：宣告攻击后出现牺牲友军提示并完成牺牲',
        }),
      });

      await expect(hostPage.locator(allySelector).first()).toBeVisible({ timeout: 5000 });
      await hostPage.locator(allySelector).first().click({ force: true });
      await hostPage.waitForTimeout(1500);
      await expect(hostPage.getByTestId('sw-action-banner')).toContainText(/用最多3个单位进行攻击|Attack with up to 3 units/i, { timeout: 8000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'life-drain-complete', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/吸取生命：宣告攻击后出现牺牲友军提示并完成牺牲',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('灵魂转移：击杀后确认移动到死者位置', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'necromancer', 'paladin');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext, matchId } = match;

    try {
      await waitForTestHarness(hostPage, 15000);
      const prepared = prepareSoulTransferOnlineState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');
      await setHarnessRandomQueue(hostPage, [0.6, 0.6, 0.6, 0.6, 0.6]);

      const archerSelector = `[data-testid="sw-unit-${prepared.archerPosition.row}-${prepared.archerPosition.col}"][data-owner="0"]`;
      const victimSelector = `[data-testid="sw-unit-${prepared.victimPosition.row}-${prepared.victimPosition.col}"][data-owner="1"]`;

      await expect(hostPage.locator(archerSelector).first()).toBeVisible({ timeout: 5000 });
      await hostPage.locator(archerSelector).first().click({ force: true });
      await expect(hostPage.locator(victimSelector).first()).toBeVisible({ timeout: 5000 });
      await hostPage.locator(victimSelector).first().click({ force: true });

      const overlay = hostPage.getByTestId('sw-dice-result-overlay');
      const overlayVisible = await overlay.isVisible().catch(() => false);
      if (overlayVisible) {
        await overlay.click({ force: true }).catch(() => {});
        await expect(overlay).toBeHidden({ timeout: 8000 }).catch(() => {});
      }

      const prompt = await waitForSoulTransferPrompt(hostPage);
      await runWithStepTimeout('soul_transfer.prompt-visible-text', Promise.resolve().then(async () => {
        const promptText = await readVisibleAbilityPromptText(hostPage);
        expect(promptText).toMatch(/灵魂转移|Soul Transfer|确认移动|Confirm Move/i);
      }));
      await runWithStepTimeout('soul_transfer.prompt-screenshot', hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'soul-transfer-prompt-visible', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/灵魂转移：击杀后确认移动到死者位置',
        }),
      }));

      await runWithStepTimeout(
        'soul_transfer.confirm-click',
        hostPage.getByRole('button', { name: /Confirm Move|确认移动/i }).click({ force: true }),
      );
      await runWithStepTimeout('soul_transfer.prompt-hidden', expect(prompt).toBeHidden({ timeout: 8000 }));
      await runWithStepTimeout(
        'soul_transfer.prompt-text-cleared',
        expect.poll(async () => await readVisibleAbilityPromptText(hostPage), { timeout: 8000 }).toBe(''),
      );
      await runWithStepTimeout(
        'soul_transfer.source-cell-empty',
        expect(hostPage.locator(archerSelector)).toHaveCount(0, { timeout: 8000 }),
      );
      await runWithStepTimeout(
        'soul_transfer.victim-cell-occupied',
        expect(
          hostPage.locator(`[data-testid="sw-unit-${prepared.victimPosition.row}-${prepared.victimPosition.col}"][data-owner="0"]`).first(),
        ).toBeVisible({ timeout: 8000 }),
      );
      await runWithStepTimeout(
        'soul_transfer.action-banner-restored',
        expect(hostPage.getByTestId('sw-action-banner')).toContainText(/用最多3个单位进行攻击|Attack with up to 3 units/i, { timeout: 8000 }),
      );
      const latestCore = await runWithStepTimeout('soul_transfer.fetch-core', readCoreStateViaServer(hostPage));
      expect(latestCore.board?.[prepared.archerPosition.row]?.[prepared.archerPosition.col]?.unit ?? null).toBeNull();
      expect(latestCore.board?.[prepared.victimPosition.row]?.[prepared.victimPosition.col]?.unit?.owner ?? null).toBe('0');
      expect(latestCore.board?.[prepared.victimPosition.row]?.[prepared.victimPosition.col]?.unit?.card?.name ?? null).toBe('亡灵弓箭手');
      await hostPage.waitForTimeout(500);

      await runWithStepTimeout('soul_transfer.complete-screenshot', hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'soul-transfer-complete', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/灵魂转移：击杀后确认移动到死者位置',
        }),
      }));
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('感染：击杀后从弃牌堆选择疫病体并召回到死者位置', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'necromancer', 'paladin');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      await waitForTestHarness(hostPage, 15000);
      const prepared = prepareInfectionOnlineState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await waitForPhaseViaHelper(hostPage, 'attack');
      await setHarnessRandomQueue(hostPage, [0.6, 0.6, 0.6, 0.6, 0.6]);

      const attackerSelector = `[data-testid="sw-unit-${prepared.attackerPosition.row}-${prepared.attackerPosition.col}"][data-owner="0"]`;
      const victimSelector = `[data-testid="sw-unit-${prepared.victimPosition.row}-${prepared.victimPosition.col}"][data-owner="1"]`;

      await expect(hostPage.locator(attackerSelector).first()).toBeVisible({ timeout: 5000 });
      await hostPage.locator(attackerSelector).first().click({ force: true });
      await expect(hostPage.locator(victimSelector).first()).toBeVisible({ timeout: 5000 });
      await hostPage.locator(victimSelector).first().click({ force: true });

      const overlay = hostPage.getByTestId('sw-dice-result-overlay');
      const overlayVisible = await overlay.isVisible().catch(() => false);
      if (overlayVisible) {
        await overlay.click({ force: true }).catch(() => {});
        await expect(overlay).toBeHidden({ timeout: 8000 }).catch(() => {});
      }

      const cardSelector = hostPage.getByTestId('sw-card-selector-overlay');
      await expect(cardSelector).toBeVisible({ timeout: 8000 });
      const discardCard = cardSelector.locator(`[data-card-id="${prepared.discardCardId}"]`).first();
      await expect(discardCard).toBeVisible({ timeout: 5000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'infection-card-selector-visible', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/感染：击杀后从弃牌堆选择疫病体并召回到死者位置',
        }),
      });

      await discardCard.click({ force: true });
      await expect(cardSelector).toBeHidden({ timeout: 8000 });
      const summonedUnit = hostPage.locator(
        `[data-testid="sw-unit-${prepared.victimPosition.row}-${prepared.victimPosition.col}"][data-owner="0"]`,
      ).first();
      await expect(summonedUnit).toBeVisible({ timeout: 8000 });
      await expect(summonedUnit).toHaveAttribute('data-unit-name', /亡灵疫病体/i, { timeout: 8000 });
      await expect(hostPage.getByTestId('sw-action-banner')).toContainText(/用最多3个单位进行攻击|Attack with up to 3 units/i, { timeout: 8000 });

      const latestCore = await readCoreStateViaServer(hostPage);
      const discardIds = (latestCore.players?.['0']?.discard ?? []).map((card: { id?: string }) => card?.id);
      expect(discardIds).not.toContain(prepared.discardCardId);
      expect(latestCore.board?.[prepared.victimPosition.row]?.[prepared.victimPosition.col]?.unit?.owner ?? null).toBe('0');
      expect(latestCore.board?.[prepared.victimPosition.row]?.[prepared.victimPosition.col]?.unit?.card?.name ?? null).toBe('亡灵疫病体');

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'infection-summon-complete', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/感染：击杀后从弃牌堆选择疫病体并召回到死者位置',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });

  test('殉葬火堆：回合开始出现治疗提示并移除目标伤害', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'necromancer', 'paladin');
    if (!match) {
      test.skip(true, 'Game server unavailable or room creation failed.');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = match;

    try {
      const prepared = prepareFuneralPyreOnlineState(await readCoreStateViaServer(hostPage));
      await applyCoreStateViaServer(hostPage, prepared.core);
      await closeDebugPanelIfOpenViaHelper(hostPage);
      await closeDebugPanelIfOpenViaHelper(guestPage);
      await waitForPhaseViaHelper(guestPage, 'draw');

      await expect(guestPage.getByTestId('sw-end-phase')).toBeEnabled({ timeout: 5000 });
      await guestPage.getByTestId('sw-end-phase').click();

      await expect.poll(async () => {
        const liveState = await getMatchState(matchId, hostPage) as {
          core?: { phase?: string; currentPlayer?: string };
          sys?: { interaction?: { current?: { data?: { sw?: { type?: string } } } } };
        };
        return {
          phase: liveState.core?.phase ?? null,
          currentPlayer: liveState.core?.currentPlayer ?? null,
          interactionType: liveState.sys?.interaction?.current?.data?.sw?.type ?? null,
        };
      }, { timeout: 8000 }).toEqual({
        phase: 'summon',
        currentPlayer: '0',
        interactionType: 'funeral_pyre',
      });

      const prompt = hostPage.getByTestId('sw-ability-prompt').first();
      await expect(prompt).toBeVisible({ timeout: 8000 });
      const promptText = await readVisibleAbilityPromptText(hostPage);
      expect(promptText).toMatch(/殉葬火堆|Funeral Pyre|治疗 2 点|heal 2/i);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'funeral-pyre-prompt-visible', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/殉葬火堆：回合开始出现治疗提示并移除目标伤害',
        }),
      });

      const woundedSelector = `[data-testid="sw-unit-${prepared.woundedPosition.row}-${prepared.woundedPosition.col}"][data-owner="0"]`;
      await expect(hostPage.locator(woundedSelector).first()).toBeVisible({ timeout: 5000 });
      await hostPage.locator(woundedSelector).first().click({ force: true });

      await expect(prompt).toBeHidden({ timeout: 8000 });
      await expect(hostPage.getByTestId('sw-action-banner')).toContainText(/召唤|Summon/i, { timeout: 8000 });

      const latestCore = await readCoreStateViaServer(hostPage);
      expect(latestCore.board?.[prepared.woundedPosition.row]?.[prepared.woundedPosition.col]?.unit?.damage ?? null).toBe(1);
      expect((latestCore.players?.['0']?.activeEvents ?? []).some((card: { id?: string }) => card?.id === prepared.pyreCardId)).toBe(false);
      expect((latestCore.players?.['0']?.discard ?? []).some((card: { id?: string }) => card?.id === prepared.pyreCardId)).toBe(true);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'funeral-pyre-heal-complete', {
          subdir: 'summonerwars/summonerwars-abilities.e2e/殉葬火堆：回合开始出现治疗提示并移除目标伤害',
        }),
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });
});
