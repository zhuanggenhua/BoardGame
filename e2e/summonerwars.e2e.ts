/**
 * 召唤师战争 E2E 测试
 * 
 * 注意：召唤师战争没有本地模式（allowLocalMode: false）
 * 完整游戏UI测试需要后端服务运行
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';

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

const dismissViteOverlay = async (page: Page) => {
  await page.evaluate(() => {
    const overlay = document.querySelector('vite-error-overlay');
    if (overlay) overlay.remove();
  });
};

const resetMatchStorage = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.removeItem('owner_active_match');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('match_creds_')) {
        localStorage.removeItem(key);
      }
    });
  });
};

const waitForHomeGameList = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.waitForSelector('[data-game-id]', { timeout: 12000, state: 'attached' });
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const root = document.querySelector('#root');
      return {
        readyState: document.readyState,
        hasViteOverlay: Boolean(document.querySelector('vite-error-overlay')),
        bodyText: document.body?.innerText?.slice(0, 300) || '',
        rootHtml: root?.innerHTML?.slice(0, 400) || '',
      };
    });
    const url = page.url();
    throw new Error(
      `首页未渲染游戏卡片 url=${url} readyState=${diagnostics.readyState} `
      + `hasViteOverlay=${diagnostics.hasViteOverlay} bodyText=${diagnostics.bodyText || 'EMPTY'} `
      + `rootHtml=${diagnostics.rootHtml || 'EMPTY'}`
    );
  }
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
  try {
    await expect(card).toHaveCount(1, { timeout: 15000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForHomeGameList(page);
    card = page.locator('[data-game-id="summonerwars"]');
    await expect(card).toHaveCount(1, { timeout: 15000 });
  }
  await card.first().scrollIntoViewIfNeeded();
  return card.first();
};

const disableTutorial = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('tutorial_skip', '1');
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
  const confirmButton = page
    .locator('button:has-text("确认")')
    .or(page.locator('button:has-text("Confirm")'));
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
  }
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

const createSummonerWarsRoom = async (page: Page) => {
  await page.goto('/?game=summonerwars', { waitUntil: 'domcontentloaded' });
  await dismissViteOverlay(page);
  await dismissLobbyConfirmIfNeeded(page);

  let createButton = page.getByRole('button', { name: /Create Room|创建房间/i });
  if (!await createButton.isVisible().catch(() => false)) {
    const gameCard = await ensureSummonerWarsCard(page);
    await gameCard.click();
    createButton = page.getByRole('button', { name: /Create Room|创建房间/i });
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
  return url.pathname.split('/').pop() ?? null;
};

const ensurePlayerIdInUrl = async (page: Page, playerId: string) => {
  const url = new URL(page.url());
  if (!url.searchParams.get('playerID')) {
    url.searchParams.set('playerID', playerId);
    await page.goto(url.toString());
  }
};

const waitForSummonerWarsUI = async (page: Page, timeout = 20000) => {
  await expect(page.getByTestId('sw-action-banner')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-phase-tracker')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-map-container')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-energy-player')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-energy-opponent')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-deck-draw')).toBeVisible({ timeout });
  await expect(page.getByTestId('sw-deck-discard')).toBeVisible({ timeout });
};

const expectPhaseTrackerVisible = async (page: Page) => {
  const phases = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];
  for (const phase of phases) {
    await expect(page.getByTestId(`sw-phase-item-${phase}`)).toBeVisible();
  }
  await expect(page.getByTestId('sw-phase-count-move')).toBeVisible();
  await expect(page.getByTestId('sw-phase-count-attack')).toBeVisible();
};

const getMapScaleText = async (page: Page) => page.getByTestId('sw-map-scale').innerText();

const getMapTransform = async (page: Page) => (
  page.getByTestId('sw-map-content').evaluate((node) => getComputedStyle(node).transform)
);

const zoomMap = async (page: Page, deltaY: number) => {
  const container = page.getByTestId('sw-map-container');
  const box = await container.boundingBox();
  if (!box) throw new Error('无法获取地图容器尺寸');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, deltaY);
};

const dragMap = async (page: Page, dx: number, dy: number) => {
  const container = page.getByTestId('sw-map-container');
  const box = await container.boundingBox();
  if (!box) throw new Error('无法获取地图容器尺寸');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
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

const assertHandAreaVisible = async (page: Page, label: string) => {
  const handArea = page.getByTestId('sw-hand-area');
  await expect(handArea, `[${label}] 手牌区域未显示`).toBeVisible();
  const cards = handArea.locator('[data-card-id]');
  const count = await cards.count();
  if (count === 0) {
    throw new Error(`[${label}] 手牌为空`);
  }
  const box = await handArea.boundingBox();
  if (!box) {
    throw new Error(`[${label}] 手牌区域无尺寸`);
  }
  const viewport = page.viewportSize();
  if (viewport) {
    const bottom = box.y + box.height;
    if (bottom > viewport.height + 4) {
      throw new Error(`[${label}] 手牌区域被底部截断: bottom=${bottom} viewport=${viewport.height}`);
    }
  }
};

const advancePhase = async (page: Page, nextPhase: string) => {
  const endPhaseButton = page.getByTestId('sw-end-phase');
  await expect(endPhaseButton).toBeEnabled();
  await endPhaseButton.click();
  await waitForPhase(page, nextPhase);
};

const cloneState = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizePhaseState = (coreState: any, phase: string) => {
  const next = cloneState(coreState);
  next.phase = phase;
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;
  if (next.players?.['0']) {
    next.players['0'] = {
      ...next.players['0'],
      moveCount: 0,
      attackCount: 0,
      hasAttackedEnemy: false,
    };
  }
  return next;
};

const prepareDeterministicCore = (coreState: any) => {
  const next = cloneState(coreState);
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  const deck = [...player.deck];
  const handPool = [...player.hand];

  const pickCard = (type: string) => {
    const handIndex = handPool.findIndex(card => card.cardType === type);
    if (handIndex >= 0) {
      const [card] = handPool.splice(handIndex, 1);
      return card;
    }
    const deckIndex = deck.findIndex(card => card.cardType === type);
    if (deckIndex >= 0) {
      const [card] = deck.splice(deckIndex, 1);
      return card;
    }
    throw new Error(`无法找到${type}卡牌`);
  };

  const unitCard = pickCard('unit');
  const structureCard = pickCard('structure');
  const eventCard = pickCard('event');

  next.players['0'] = {
    ...player,
    magic: 10,
    hand: [unitCard, structureCard, eventCard],
    deck,
    moveCount: 0,
    attackCount: 0,
    hasAttackedEnemy: false,
  };

  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  return next;
};

const setupAttackState = (coreState: any) => {
  const next = cloneState(coreState);
  const board = next.board.map((row: any[]) => row.map((cell: any) => ({
    ...cell,
    unit: cell.unit ? { ...cell.unit, position: { ...cell.unit.position } } : undefined,
    structure: cell.structure ? { ...cell.structure, position: { ...cell.structure.position } } : undefined,
  })));
  next.board = board;

  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  const findUnitPositions = (owner: string) => {
    const positions: { row: number; col: number }[] = [];
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const unit = board[row][col]?.unit;
        if (unit && unit.owner === owner) {
          positions.push({ row, col });
        }
      }
    }
    return positions;
  };

  const attackerPositions = findUnitPositions('0');
  const enemyPositions = findUnitPositions('1');
  if (attackerPositions.length === 0 || enemyPositions.length === 0) {
    throw new Error('无法找到用于攻击测试的单位');
  }

  for (const attacker of attackerPositions) {
    for (const dir of directions) {
      const target = { row: attacker.row + dir.row, col: attacker.col + dir.col };
      if (!board[target.row]?.[target.col]) continue;
      const targetUnit = board[target.row][target.col].unit;
      if (targetUnit && targetUnit.owner === '1') {
        next.phase = 'attack';
        next.currentPlayer = '0';
        next.selectedUnit = undefined;
        next.attackTargetMode = undefined;
        return { core: next, attacker, target };
      }
    }
  }

  const enemyOrigin = enemyPositions[0];
  const enemyUnit = board[enemyOrigin.row][enemyOrigin.col].unit;
  if (!enemyUnit) {
    throw new Error('无法获取敌方单位');
  }

  let attackerPick: { row: number; col: number } | null = null;
  let targetPick: { row: number; col: number } | null = null;

  for (const attacker of attackerPositions) {
    for (const dir of directions) {
      const target = { row: attacker.row + dir.row, col: attacker.col + dir.col };
      if (!board[target.row]?.[target.col]) continue;
      const targetCell = board[target.row][target.col];
      if (!targetCell.unit && !targetCell.structure) {
        attackerPick = attacker;
        targetPick = target;
        break;
      }
    }
    if (attackerPick && targetPick) break;
  }

  if (!attackerPick || !targetPick) {
    throw new Error('没有可用的相邻空位用于布置攻击目标');
  }

  board[enemyOrigin.row][enemyOrigin.col] = {
    ...board[enemyOrigin.row][enemyOrigin.col],
    unit: undefined,
  };
  board[targetPick.row][targetPick.col] = {
    ...board[targetPick.row][targetPick.col],
    unit: {
      ...enemyUnit,
      position: { ...targetPick },
    },
  };

  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.attackTargetMode = undefined;

  return { core: next, attacker: attackerPick, target: targetPick };
};

const removeSummonerFromCore = (coreState: any, playerId: string) => {
  const next = cloneState(coreState);
  let removed = false;
  next.board = next.board.map((row: any[]) => row.map((cell: any) => {
    if (cell.unit && cell.unit.owner === playerId && cell.unit.card?.unitClass === 'summoner') {
      removed = true;
      return { ...cell, unit: undefined };
    }
    return cell;
  }));
  if (!removed) {
    throw new Error('未找到需要移除的召唤师');
  }
  return next;
};

test.describe('SummonerWars', () => {
  test('首页游戏列表包含召唤师战争', async ({ page }) => {
    await resetMatchStorage(page);
    await page.goto('/');
    await dismissViteOverlay(page);
    await ensureSummonerWarsCard(page);
    await page.screenshot({ 
      path: 'e2e/screenshots/summonerwars-home.png',
      fullPage: true 
    });
  });

  test('游戏大厅页面', async ({ page }) => {
    await resetMatchStorage(page);
    await page.goto('/?game=summonerwars');
    await dismissViteOverlay(page);
    await waitForHomeGameList(page);
    await dismissLobbyConfirmIfNeeded(page);

    let createButton = page.getByRole('button', { name: /Create Room|创建房间/i });
    if (!await createButton.isVisible().catch(() => false)) {
      const gameCard = await ensureSummonerWarsCard(page);
      await gameCard.click();
      createButton = page.getByRole('button', { name: /Create Room|创建房间/i });
    }
    await expect(createButton).toBeVisible({ timeout: 20000 });

    await page.screenshot({ 
      path: 'e2e/screenshots/summonerwars-lobby.png',
      fullPage: true 
    });
  });

  test('在线对局流程：核心 UI、阶段推进与魔力弃牌', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setEnglishLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
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
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    await expectPhaseTrackerVisible(hostPage);

    const initialScaleText = await getMapScaleText(hostPage);
    await zoomMap(hostPage, -300);
    await expect.poll(async () => getMapScaleText(hostPage)).not.toBe(initialScaleText);

    const initialTransform = await getMapTransform(hostPage);
    await dragMap(hostPage, 80, 40);
    await expect.poll(async () => getMapTransform(hostPage)).not.toBe(initialTransform);

    const guestBanner = guestPage.getByTestId('sw-action-banner');
    await expect(guestBanner).toContainText(/等待对手/);

    await assertHandAreaVisible(hostPage, 'host');
    await assertHandAreaVisible(guestPage, 'guest');

    const phaseOrder = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];
    let currentPhase = await getCurrentPhase(hostPage);
    const initialIndex = phaseOrder.indexOf(currentPhase);
    if (initialIndex < 0) {
      throw new Error(`未知阶段: ${currentPhase}`);
    }

    // 推进到魔力阶段
    for (let step = 0; step < phaseOrder.length; step += 1) {
      if (currentPhase === 'magic') break;
      const nextPhase = phaseOrder[(phaseOrder.indexOf(currentPhase) + 1) % phaseOrder.length];
      await advancePhase(hostPage, nextPhase);
      currentPhase = nextPhase;
    }

    if (currentPhase === 'magic') {
      const firstCard = hostPage.getByTestId('sw-hand-area').locator('[data-card-id]').first();
      await firstCard.click();
      const confirmDiscard = hostPage.getByTestId('sw-confirm-discard');
      await expect(confirmDiscard).toBeVisible({ timeout: 5000 });
      await confirmDiscard.click();
      await expect(confirmDiscard).toBeHidden({ timeout: 5000 });
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('在线对局流程：召唤、移动、建造、攻击与弃牌', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setEnglishLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
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
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    let coreState = await readCoreState(hostPage);
    const preparedCore = prepareDeterministicCore(coreState);
    await applyCoreState(hostPage, preparedCore);
    await closeDebugPanelIfOpen(hostPage);

    // 召唤
    const unitCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-type="unit"][data-can-play="true"]')
      .first();
    await expect(unitCard).toBeVisible({ timeout: 8000 });
    await unitCard.click();

    const summonCell = hostPage.locator('[data-valid-summon="true"]').first();
    await expect(summonCell).toBeVisible({ timeout: 8000 });
    const summonRow = await summonCell.getAttribute('data-row');
    const summonCol = await summonCell.getAttribute('data-col');
    if (!summonRow || !summonCol) {
      throw new Error('无法读取召唤格子坐标');
    }
    await summonCell.click();
    await expect(hostPage.getByTestId(`sw-unit-${summonRow}-${summonCol}`)).toBeVisible({ timeout: 8000 });

    // 移动
    coreState = await readCoreState(hostPage);
    await applyCoreState(hostPage, normalizePhaseState(coreState, 'move'));
    await closeDebugPanelIfOpen(hostPage);

    const movableUnit = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-class!="summoner"]').first();
    await expect(movableUnit).toBeVisible({ timeout: 8000 });
    await movableUnit.click();

    const moveCell = hostPage.locator('[data-valid-move="true"]').first();
    await expect(moveCell).toBeVisible({ timeout: 8000 });
    const moveRow = await moveCell.getAttribute('data-row');
    const moveCol = await moveCell.getAttribute('data-col');
    if (!moveRow || !moveCol) {
      throw new Error('无法读取移动格子坐标');
    }
    await moveCell.click();
    await expect(hostPage.getByTestId(`sw-unit-${moveRow}-${moveCol}`)).toBeVisible({ timeout: 8000 });

    // 建造
    coreState = await readCoreState(hostPage);
    await applyCoreState(hostPage, normalizePhaseState(coreState, 'build'));
    await closeDebugPanelIfOpen(hostPage);

    const structureCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-type="structure"][data-can-play="true"]')
      .first();
    await expect(structureCard).toBeVisible({ timeout: 8000 });
    await structureCard.click();

    const buildCell = hostPage.locator('[data-valid-build="true"]').first();
    await expect(buildCell).toBeVisible({ timeout: 8000 });
    const buildRow = await buildCell.getAttribute('data-row');
    const buildCol = await buildCell.getAttribute('data-col');
    if (!buildRow || !buildCol) {
      throw new Error('无法读取建造格子坐标');
    }
    await buildCell.click();
    await expect(hostPage.getByTestId(`sw-structure-${buildRow}-${buildCol}`)).toBeVisible({ timeout: 8000 });

    // 攻击
    coreState = await readCoreState(hostPage);
    const attackSetup = setupAttackState(coreState);
    await applyCoreState(hostPage, attackSetup.core);
    await closeDebugPanelIfOpen(hostPage);

    const attackerLocator = hostPage.getByTestId(`sw-unit-${attackSetup.attacker.row}-${attackSetup.attacker.col}`);
    await expect(attackerLocator).toBeVisible({ timeout: 8000 });
    await attackerLocator.click();
    await hostPage.getByTestId(`sw-cell-${attackSetup.target.row}-${attackSetup.target.col}`).click();
    await expect(hostPage.getByTestId('sw-dice-result-overlay')).toBeVisible({ timeout: 8000 });

    // 弃牌
    coreState = await readCoreState(hostPage);
    await applyCoreState(hostPage, normalizePhaseState(coreState, 'magic'));
    await closeDebugPanelIfOpen(hostPage);

    const discardCard = hostPage.getByTestId('sw-hand-area').locator('[data-card-id]').first();
    await discardCard.click();
    const confirmDiscard = hostPage.getByTestId('sw-confirm-discard');
    await expect(confirmDiscard).toBeVisible({ timeout: 5000 });
    await confirmDiscard.click();
    await expect(confirmDiscard).toBeHidden({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });
});
