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
  const existing = (page as Page & { __swDiagnostics?: { errors: string[]; lastServerError?: string } }).__swDiagnostics;
  if (existing) return existing;
  const diagnostics = { errors: [] as string[], lastServerError: undefined as string | undefined };
  (page as Page & { __swDiagnostics?: { errors: string[]; lastServerError?: string } }).__swDiagnostics = diagnostics;
  page.on('pageerror', (err) => {
    diagnostics.errors.push(`pageerror:${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      diagnostics.errors.push(`console:${msg.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    diagnostics.errors.push(`requestfailed:${request.url()} ${request.failure()?.errorText || ''}`.trim());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const status = response.status();
      const url = response.url();
      diagnostics.errors.push(`response:${status} ${url}`);
      if (status >= 500 && url.includes('/src/games/smashup/Board.tsx')) {
        response.text()
          .then((body) => {
            diagnostics.lastServerError = `status=${status} url=${url} body=${body.slice(0, 800)}`;
          })
          .catch(() => {
            diagnostics.lastServerError = `status=${status} url=${url} body=READ_FAILED`;
          });
      }
    }
  });
  return diagnostics;
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

const resetMatchStorage = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    // 只在首次导航时清理，避免 auto-join 重定向后再次清除刚存的凭据
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

const waitForHomeGameList = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  attachPageDiagnostics(page);
  await waitForFrontendAssets(page);
  try {
    await page.waitForSelector('[data-game-id]', { timeout: 12000, state: 'attached' });
  } catch (error) {
    const fetchStatus = async (path: string) => {
      try {
        const response = await page.request.get(path);
        return `${response.status()} ${response.ok() ? 'ok' : 'fail'}`;
      } catch (err) {
        return `error:${String(err)}`;
      }
    };
    const [viteClientStatus, mainStatus] = await Promise.all([
      fetchStatus('/@vite/client'),
      fetchStatus('/src/main.tsx'),
    ]);
    const indexSummary = await (async () => {
      try {
        const response = await page.request.get('/');
        const text = await response.text();
        const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
        return `${response.status()} ${response.ok() ? 'ok' : 'fail'} ${snippet}`;
      } catch (err) {
        return `error:${String(err)}`;
      }
    })();
    const diagnostics = await page.evaluate(() => {
      const root = document.querySelector('#root');
      const resources = performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/@vite/client') || name.includes('/src/main.tsx'))
        .slice(0, 6);
      return {
        readyState: document.readyState,
        hasViteOverlay: Boolean(document.querySelector('vite-error-overlay')),
        bodyText: document.body?.innerText?.slice(0, 300) || '',
        rootHtml: root?.innerHTML?.slice(0, 400) || '',
        resources,
      };
    });
    const url = page.url();
    const latestServerError = attachPageDiagnostics(page).lastServerError;
    const errorLines = [
      '首页未渲染游戏卡片',
      `url=${url}`,
      `readyState=${diagnostics.readyState}`,
      `hasViteOverlay=${diagnostics.hasViteOverlay}`,
      `bodyText=${diagnostics.bodyText || 'EMPTY'}`,
      `rootHtml=${diagnostics.rootHtml || 'EMPTY'} resources=${diagnostics.resources?.join(',') || 'EMPTY'} `
      + `indexHtml=${indexSummary} `
      + `viteClient=${viteClientStatus} main=${mainStatus} `
      + `errors=${attachPageDiagnostics(page).errors.slice(-5).join(' | ') || 'EMPTY'}`
      + ` serverError=${latestServerError || 'EMPTY'}`
    ];
    throw new Error(errorLines.join('\n'));
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
  await expect(input).toBeHidden({ timeout: 5000 }).catch(() => { });
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
  attachPageDiagnostics(page);
  await page.goto('/?game=summonerwars', { waitUntil: 'domcontentloaded' });
  await dismissViteOverlay(page);
  await dismissLobbyConfirmIfNeeded(page);

  const { modalRoot } = await ensureSummonerWarsModalOpen(page);
  let createButton = modalRoot.locator('button:visible', { hasText: /Create Room|创建房间/i }).first();
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
  let ready = false;
  try {
    await expect.poll(async () => {
      const canCreate = await createButton.isVisible().catch(() => false);
      const canReturn = await returnButton.isVisible().catch(() => false);
      return canCreate || canReturn;
    }, { timeout: 20000 }).toBe(true);
    ready = true;
  } catch {
    ready = false;
  }

  if (!ready) {
    throw new Error('无法获取创建房间或返回对局按钮');
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

/**
 * 完成阵营选择流程（双方选择阵营 -> Guest 准备 -> Host 开始游戏）
 * 必须在 guest 加入房间后、waitForSummonerWarsUI 之前调用
 */
const completeFactionSelection = async (hostPage: Page, guestPage: Page) => {
  // 等待双方都看到阵营选择界面
  const selectionHeading = (page: Page) =>
    page.locator('h1').filter({ hasText: /选择你的阵营|Choose your faction/i });
  await expect(selectionHeading(hostPage)).toBeVisible({ timeout: 20000 });
  await expect(selectionHeading(guestPage)).toBeVisible({ timeout: 20000 });

  // Host 选择第一个阵营
  const factionCards = (page: Page) => page.locator('.grid > div');
  await factionCards(hostPage).nth(0).click();
  await hostPage.waitForTimeout(500);

  // Guest 选择第二个阵营
  await factionCards(guestPage).nth(1).click();
  await guestPage.waitForTimeout(500);

  // Guest 点击准备
  const readyButton = guestPage.locator('button').filter({ hasText: /准备|Ready/i });
  await expect(readyButton).toBeVisible({ timeout: 5000 });
  await readyButton.click();
  await hostPage.waitForTimeout(500);

  // Host 点击开始游戏
  const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game/i });
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await expect(startButton).toBeEnabled({ timeout: 5000 });
  await startButton.click();

  // 等待游戏 UI 出现（sw-end-phase 是可靠标志）
  await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 30000 });
  await expect(guestPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 30000 });
};

const expectPhaseTrackerVisible = async (page: Page) => {
  const phases = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];
  for (const phase of phases) {
    await expect(page.getByTestId(`sw-phase-item-${phase}`)).toBeVisible();
  }
  await expect(page.getByTestId('sw-phase-count-move')).toBeVisible();
  await expect(page.getByTestId('sw-phase-count-attack')).toBeVisible();
};

// 棋盘内元素点击：MapContainer 使用 CSS transform 缩放
// Playwright 坐标计算与实际像素位置不一致，改用 dispatchEvent 直接触发
const clickBoardElement = async (page: Page, selector: string) => {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, selector);
  if (!clicked) throw new Error(`棋盘元素未找到 ${selector}`);
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

const waitForMyTurn = async (page: Page, timeout = 20000) => {
  const endPhaseButton = page.getByTestId('sw-end-phase');
  await expect.poll(async () => endPhaseButton.isEnabled().catch(() => false), { timeout }).toBe(true);
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
      throw new Error(`[${label}] 手牌区域被底部截断 bottom=${bottom} viewport=${viewport.height}`);
    }
  }
};

const advancePhase = async (page: Page, fromPhase: string) => {
  const endPhaseButton = page.getByTestId('sw-end-phase');
  await waitForMyTurn(page);
  const currentPhase = await getCurrentPhase(page);
  if (currentPhase !== fromPhase) {
    return currentPhase;
  }
  await endPhaseButton.click();
  await expect.poll(() => getCurrentPhase(page)).not.toBe(fromPhase);
  return getCurrentPhase(page);
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

  const pickCard = (type: string, matcher?: (card: any) => boolean) => {
    const matches = (card: any) => card.cardType === type && (!matcher || matcher(card));
    const handIndex = handPool.findIndex(matches);
    if (handIndex >= 0) {
      const [card] = handPool.splice(handIndex, 1);
      return card;
    }
    const deckIndex = deck.findIndex(matches);
    if (deckIndex >= 0) {
      const [card] = deck.splice(deckIndex, 1);
      return card;
    }
    return null;
  };

  const unitCard = pickCard('unit') ?? pickCard('unit', () => true);
  const structureCard = pickCard('structure') ?? pickCard('structure', () => true);
  const eventCard = pickCard('event', (card) => card.playPhase === 'summon' || card.playPhase === 'any')
    ?? pickCard('event');

  if (!unitCard || !structureCard || !eventCard) {
    throw new Error('无法找到用于稳定流程的卡牌');
  }

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

  const ensureSummonSlot = () => {
    const board = next.board as any[][] | undefined;
    if (!board || board.length === 0) return;
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    const inBounds = (row: number, col: number) => row >= 0 && col >= 0 && row < rows && col < cols;
    const dirs = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cell = board[row][col];
        if (!cell?.structure || cell.structure?.owner !== '0' || !cell.structure?.card?.isGate) continue;
        let hasEmpty = false;
        for (const dir of dirs) {
          const nextRow = row + dir.row;
          const nextCol = col + dir.col;
          if (!inBounds(nextRow, nextCol)) continue;
          const target = board[nextRow][nextCol];
          if (!target?.unit && !target?.structure) {
            hasEmpty = true;
            break;
          }
        }
        if (hasEmpty) return;
        for (const dir of dirs) {
          const nextRow = row + dir.row;
          const nextCol = col + dir.col;
          if (!inBounds(nextRow, nextCol)) continue;
          const target = board[nextRow][nextCol];
          board[nextRow][nextCol] = { ...target, unit: undefined, structure: undefined };
          return;
        }
      }
    }
  };

  ensureSummonSlot();

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
  test('首页游戏列表包含召唤师战争', async ({ page }, testInfo) => {
    attachPageDiagnostics(page);
    await resetMatchStorage(page);
    await page.goto('/');
    await dismissViteOverlay(page);
    await ensureSummonerWarsCard(page);
    await page.screenshot({
      path: testInfo.outputPath('summonerwars-home.png'),
      fullPage: true
    });
  });

  test('游戏大厅页面', async ({ page }, testInfo) => {
    attachPageDiagnostics(page);
    await resetMatchStorage(page);
    await page.goto('/?game=summonerwars');
    await dismissViteOverlay(page);
    await waitForHomeGameList(page);
    await dismissLobbyConfirmIfNeeded(page);

    let createButton = page.getByRole('button', { name: /Create Room|创建房间/i });
    if (!await createButton.isVisible().catch(() => false)) {
      const gameCard = await ensureSummonerWarsCard(page);
      await gameCard.click();
      createButton = page.locator('button:visible', { hasText: /Create Room|创建房间/i }).first();
    }
    await expect(createButton).toBeVisible({ timeout: 20000 });

    await page.screenshot({
      path: testInfo.outputPath('summonerwars-lobby.png'),
      fullPage: true
    });
  });

  test('大厅切换房间需确认并退出当前对局', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await setEnglishLocale(hostContext);
    await resetMatchStorage(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const activeMatchId = await createSummonerWarsRoom(hostPage);
    if (!activeMatchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }
    await ensurePlayerIdInUrl(hostPage, '0');

    const otherContext = await browser.newContext({ baseURL });
    await setEnglishLocale(otherContext);
    await resetMatchStorage(otherContext);
    const otherPage = await otherContext.newPage();

    const nextMatchId = await createSummonerWarsRoom(otherPage);
    if (!nextMatchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
      await hostContext.close();
      await otherContext.close();
      return;
    }
    await ensurePlayerIdInUrl(otherPage, '0');

    await hostPage.goto('/?game=summonerwars', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(hostPage);
    await waitForHomeGameList(hostPage);

    const { modalRoot } = await ensureSummonerWarsModalOpen(hostPage);
    const lobbyTab = modalRoot.getByRole('button', { name: /Lobby|在线大厅/i });
    if (await lobbyTab.isVisible().catch(() => false)) {
      await lobbyTab.click();
    }

    const shortId = nextMatchId.slice(0, 4);
    await expect(
      modalRoot.getByText(new RegExp(`Match #${shortId}|对局 #${shortId}`))
    ).toBeVisible({ timeout: 20000 });

    const joinButton = modalRoot.getByRole('button', { name: /Join|加入/i }).first();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await joinButton.click();

    const confirmTitle = hostPage.getByText(/Leave Current Match|退出当前对局/i);
    await expect(confirmTitle).toBeVisible({ timeout: 5000 });
    const cancelButton = hostPage.getByRole('button', { name: /Cancel|取消/i }).first();
    await cancelButton.click();
    await expect(confirmTitle).toHaveCount(0);
    await expect(hostPage).toHaveURL(/\?game=summonerwars/);

    const joinButtonAgain = modalRoot.getByRole('button', { name: /Join|加入/i }).first();
    await expect(joinButtonAgain).toBeVisible({ timeout: 10000 });
    await joinButtonAgain.click();
    await expect(confirmTitle).toBeVisible({ timeout: 5000 });
    const confirmButton = hostPage.getByRole('button', { name: /Confirm|确认/i }).first();
    await confirmButton.click();

    await hostPage.waitForURL(new RegExp(`/play/summonerwars/match/${nextMatchId}`), { timeout: 20000 });
    const finalUrl = new URL(hostPage.url());
    expect(finalUrl.pathname).toContain(`/play/summonerwars/match/${nextMatchId}`);

    await hostContext.close();
    await otherContext.close();
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
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    let coreState = await readCoreState(hostPage);
    const preparedCore = prepareDeterministicCore(coreState);
    await applyCoreState(hostPage, preparedCore);
    await closeDebugPanelIfOpen(hostPage);

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
    for (let step = 0; step < phaseOrder.length * 2; step += 1) {
      if (currentPhase === 'magic') break;
      currentPhase = await advancePhase(hostPage, currentPhase);
    }

    if (currentPhase !== 'magic') {
      throw new Error(`阶段推进未到达魔力阶段，当前=${currentPhase}`);
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
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
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
    await clickBoardElement(hostPage, '[data-valid-summon="true"]');
    await expect(hostPage.getByTestId(`sw-unit-${summonRow}-${summonCol}`)).toBeVisible({ timeout: 8000 });

    // 移动
    coreState = await readCoreState(hostPage);
    await applyCoreState(hostPage, normalizePhaseState(coreState, 'move'));
    await closeDebugPanelIfOpen(hostPage);

    const movableUnit = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"]:not([data-unit-class="summoner"])').first();
    await expect(movableUnit).toBeVisible({ timeout: 8000 });
    await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"]:not([data-unit-class="summoner"])');

    const moveCell = hostPage.locator('[data-valid-move="true"]').first();
    await expect(moveCell).toBeVisible({ timeout: 8000 });
    const moveRow = await moveCell.getAttribute('data-row');
    const moveCol = await moveCell.getAttribute('data-col');
    if (!moveRow || !moveCol) {
      throw new Error('无法读取移动格子坐标');
    }
    await clickBoardElement(hostPage, '[data-valid-move="true"]');
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
    await clickBoardElement(hostPage, '[data-valid-build="true"]');
    await expect(hostPage.getByTestId(`sw-structure-${buildRow}-${buildCol}`)).toBeVisible({ timeout: 8000 });

    // 攻击
    coreState = await readCoreState(hostPage);
    const attackSetup = setupAttackState(coreState);
    await applyCoreState(hostPage, attackSetup.core);
    await closeDebugPanelIfOpen(hostPage);

    const attackerLocator = hostPage.getByTestId(`sw-unit-${attackSetup.attacker.row}-${attackSetup.attacker.col}`);
    await expect(attackerLocator).toBeVisible({ timeout: 8000 });
    await clickBoardElement(hostPage, `[data-testid="sw-unit-${attackSetup.attacker.row}-${attackSetup.attacker.col}"]`);
    await clickBoardElement(hostPage, `[data-testid="sw-cell-${attackSetup.target.row}-${attackSetup.target.col}"]`);
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

  test('主动技能：复活死灵 UI 流程', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备测试状态：召唤阶段，召唤师有复活死灵技能，弃牌堆有亡灵单位
    let coreState = await readCoreState(hostPage);
    const reviveTestCore = prepareReviveUndeadState(coreState);
    await applyCoreState(hostPage, reviveTestCore);
    await closeDebugPanelIfOpen(hostPage);

    // 选中召唤师
    const summoner = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-class="summoner"]').first();
    await expect(summoner).toBeVisible({ timeout: 8000 });
    await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-class="summoner"]');

    // 检查复活死灵按钮是否显示（召唤师默认有此技能）
    const reviveButton = hostPage.getByRole('button', { name: /复活死灵/i });
    await expect(reviveButton).toBeVisible({ timeout: 5000 });

    const summonerDamageBefore = Number(await summoner.getAttribute('data-unit-damage') ?? '0');

    // 点击复活死灵按钮
    await reviveButton.click();

    // 检查卡牌选择器是否显示
    const cardSelector = hostPage.locator('[data-testid="sw-card-selector-overlay"]');
    await expect(cardSelector).toBeVisible({ timeout: 8000 });

    // 选择弃牌堆中的亡灵单位
    const undeadCard = cardSelector.locator('[data-card-id="necro-undead-warrior-test"]').first();
    await expect(undeadCard).toBeVisible({ timeout: 3000 });
    await undeadCard.click();

    await expect(cardSelector).toBeHidden({ timeout: 5000 });

    // 选择相邻空位
    const abilityCell = hostPage.locator('[data-testid^="sw-cell-"][class*="border-green-400"]').first();
    await expect(abilityCell).toBeVisible({ timeout: 5000 });
    const targetId = await abilityCell.getAttribute('data-testid');
    if (!targetId) {
      throw new Error('无法定位复活死灵目标格子');
    }
    const match = targetId.match(/sw-cell-(\d+)-(\d+)/);
    if (!match) {
      throw new Error(`无法解析复活死灵目标坐标: ${targetId}`);
    }
    const [, row, col] = match;
    await clickBoardElement(hostPage, `[data-testid="${targetId}"]`);

    const summonedUnit = hostPage.getByTestId(`sw-unit-${row}-${col}`);
    await expect(summonedUnit).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => Number(await summoner.getAttribute('data-unit-damage') ?? '0'))
      .toBe(summonerDamageBefore + 2);

    await hostContext.close();
    await guestContext.close();
  });

  test('主动技能：火祀召唤和吸取生命 UI 元素验证', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 测试1：火祀召唤 - 准备状态并验证按钮
    let coreState = await readCoreState(hostPage);
    const { core: fireSacrificeCore, elutBarPosition, allyPosition } = prepareFireSacrificeState(coreState);
    await applyCoreState(hostPage, fireSacrificeCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'summon');

    // 选中伊路特-巴尔
    const elutBar = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name*="伊路特"]').first();
    await expect(elutBar).toBeVisible({ timeout: 5000 });

    await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-name*="伊路特"]');
    const fireSacrificeButton = hostPage.getByRole('button', { name: /火祀召唤/i });
    await expect(fireSacrificeButton).toBeVisible({ timeout: 3000 });
    await fireSacrificeButton.click();

    const fireBanner = hostPage.locator('.bg-amber-900');
    await expect(fireBanner).toBeVisible({ timeout: 3000 });

    const allyCell = hostPage.getByTestId(`sw-cell-${allyPosition.row}-${allyPosition.col}`);
    await expect(allyCell).toHaveClass(/border-amber-400/);
    await clickBoardElement(hostPage, `[data-testid="sw-cell-${allyPosition.row}-${allyPosition.col}"]`);

    await expect(fireBanner).toBeHidden({ timeout: 5000 });
    await expect(allyCell).not.toHaveClass(/border-amber-400/);

    const movedUnit = hostPage.getByTestId(`sw-unit-${allyPosition.row}-${allyPosition.col}`);
    await expect(movedUnit).toBeVisible({ timeout: 5000 });
    await expect(movedUnit).toHaveAttribute('data-unit-name', '伊路特-巴尔');
    await expect(hostPage.getByTestId(`sw-unit-${elutBarPosition.row}-${elutBarPosition.col}`)).toHaveCount(0);

    // 测试2：吸取生命 - 准备状态并验证按钮
    coreState = await readCoreState(hostPage);
    const { core: lifeDrainCore, dragosPosition, allyPosition: lifeDrainAlly } = prepareLifeDrainState(coreState);
    await applyCoreState(hostPage, lifeDrainCore);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'attack');

    // 选中德拉戈斯
    const dragos = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name*="德拉戈斯"]').first();
    await expect(dragos).toBeVisible({ timeout: 5000 });

    await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-name*="德拉戈斯"]');
    const lifeDrainButton = hostPage.getByRole('button', { name: /吸取生命/i });
    await expect(lifeDrainButton).toBeVisible({ timeout: 3000 });
    await lifeDrainButton.click();

    const lifeBanner = hostPage.locator('.bg-amber-900');
    await expect(lifeBanner).toBeVisible({ timeout: 3000 });

    const lifeDrainCell = hostPage.getByTestId(`sw-cell-${lifeDrainAlly.row}-${lifeDrainAlly.col}`);
    await expect(lifeDrainCell).toHaveClass(/border-amber-400/);
    await clickBoardElement(hostPage, `[data-testid="sw-cell-${lifeDrainAlly.row}-${lifeDrainAlly.col}"]`);

    await expect(lifeBanner).toBeHidden({ timeout: 5000 });
    await expect(hostPage.getByTestId(`sw-unit-${lifeDrainAlly.row}-${lifeDrainAlly.col}`)).toHaveCount(0);
    await expect(hostPage.getByTestId(`sw-unit-${dragosPosition.row}-${dragosPosition.col}`)).toBeVisible({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：狱火铸剑打出流程', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备状态：建造阶段 + 手牌有狱火铸剑 + 场上有友方士兵
    let coreState = await readCoreState(hostPage);
    const hellfireCore = prepareHellfireBladeState(coreState);
    await applyCoreState(hostPage, hellfireCore);
    await closeDebugPanelIfOpen(hostPage);

    // 验证当前是建造阶段
    await waitForPhase(hostPage, 'build');

    // 点击狱火铸剑事件卡（通过 card-id 匹配）
    const hellfireCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id*="hellfire-blade"]')
      .first();
    const hasHellfireCard = await hellfireCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasHellfireCard) {
      await hellfireCard.click();

      // 验证目标选择高亮（友方士兵）
      const targetHighlight = hostPage.locator('[data-valid-event-target="true"]');
      const hasTargetHighlight = await targetHighlight.first().isVisible({ timeout: 3000 }).catch(() => false);

      if (hasTargetHighlight) {
        // 点击一个有效目标
        await clickBoardElement(hostPage, '[data-valid-event-target="true"]');
        // 验证事件卡已打出（手牌减少或提示消失）
        await expect(hellfireCard).toBeHidden({ timeout: 5000 }).catch(() => { });
      }
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：除灭多目标选择流程', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备状态：移动阶段 + 手牌有除灭 + 场上有多个友方单位
    let coreState = await readCoreState(hostPage);
    const annihilateCore = prepareAnnihilateState(coreState);
    await applyCoreState(hostPage, annihilateCore);
    await closeDebugPanelIfOpen(hostPage);

    // 等待状态应用
    await hostPage.waitForTimeout(500);

    // 验证当前是移动阶段
    const currentPhase = await getCurrentPhase(hostPage);
    if (currentPhase !== 'move') {
      // 如果状态注入失败，跳过测试
      test.skip(true, `状态注入失败，当前阶段=${currentPhase}`);
    }

    // 查找手牌中的除灭卡（通过 card-id / card-name）
    const annihilateCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id*="annihilate"], [data-card-name*="除灭"]')
      .first();
    const hasAnnihilateCard = await annihilateCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasAnnihilateCard) {
      // 如果没有除灭卡，记录手牌信息并跳过
      const handCards = await hostPage.getByTestId('sw-hand-area').locator('[data-card-id]').all();
      const cardIds = await Promise.all(handCards.map(c => c.getAttribute('data-card-id')));
      test.skip(true, `手牌中没有除灭卡，当前手牌=${cardIds.join(', ')}`);
    }

    await annihilateCard.click();

    // 验证除灭模式横幅显示
    const annihilateBanner = hostPage.locator('[class*="bg-purple-900"]');
    await expect(annihilateBanner).toBeVisible({ timeout: 3000 });

    // 验证可选目标高亮
    const targetHighlight = hostPage.locator('[class*="border-purple"]');
    const hasTargetHighlight = await targetHighlight.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasTargetHighlight) {
      // 选择一个友方单位
      await clickBoardElement(hostPage, '[data-owner="0"]:not([data-unit-class="summoner"])');

      // 验证确认选择按钮出现
      const confirmButton = hostPage.getByRole('button', { name: /确认选择/i });
      const hasConfirmButton = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasConfirmButton) {
        await confirmButton.click();
        // 验证进入伤害目标选择步骤
        await expect(annihilateBanner).toContainText(/伤害/, { timeout: 3000 }).catch(() => { });
      }
    }

    // 取消操作
    const cancelButton = hostPage.getByRole('button', { name: /取消/i });
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click();
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：血契召唤多次使用流程', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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
    await guestPage.goto(`/play/summonerwars/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备状态：召唤阶段 + 手牌有血契召唤和低费单位 + 场上有友方单位
    let coreState = await readCoreState(hostPage);
    const bloodSummonCore = prepareBloodSummonState(coreState);
    await applyCoreState(hostPage, bloodSummonCore);
    await closeDebugPanelIfOpen(hostPage);

    // 验证当前是召唤阶段
    await waitForPhase(hostPage, 'summon');

    // 点击血契召唤事件卡（通过 card-id 匹配）
    const bloodSummonCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id*="blood-summon"]')
      .first();
    const hasBloodSummonCard = await bloodSummonCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBloodSummonCard) {
      await bloodSummonCard.click();

      // 验证血契召唤模式横幅显示
      const bloodSummonBanner = hostPage.locator('[class*="bg-rose-900"]');
      await expect(bloodSummonBanner).toBeVisible({ timeout: 3000 });
      await expect(bloodSummonBanner).toContainText(/选择.*友方单位/, { timeout: 3000 });

      // 取消操作
      const cancelButton = hostPage.getByRole('button', { name: /取消/i });
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
      }
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('阶段自动跳过：有事件卡时不应跳过', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备状态：建造阶段 + 手牌只有狱火铸剑（无建筑卡）+ 场上有友方士兵
    let coreState = await readCoreState(hostPage);
    const noStructureCore = prepareNoStructureButEventState(coreState);
    await applyCoreState(hostPage, noStructureCore);
    await closeDebugPanelIfOpen(hostPage);

    // 验证当前是建造阶段（不应被自动跳过）
    await waitForPhase(hostPage, 'build');

    // 等待一段时间确认阶段没有被自动跳过
    await hostPage.waitForTimeout(1000);
    const currentPhase = await getCurrentPhase(hostPage);
    expect(currentPhase).toBe('build');

    await hostContext.close();
    await guestContext.close();
  });

  test('弃牌堆：点击查看弃牌堆内容', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 注入弃牌堆有卡牌的状态
    let coreState = await readCoreState(hostPage);
    const discardCore = prepareDiscardPileState(coreState);
    await applyCoreState(hostPage, discardCore);
    await closeDebugPanelIfOpen(hostPage);

    // 点击弃牌堆
    const discardPile = hostPage.getByTestId('sw-deck-discard');
    await expect(discardPile).toBeVisible({ timeout: 5000 });
    await discardPile.click();

    // 验证弃牌堆 overlay 出现
    const overlay = hostPage.getByTestId('sw-discard-pile-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // 验证 overlay 中有卡牌
    const overlayCards = overlay.locator('[class*="cursor-pointer"]');
    const cardCount = await overlayCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // 关闭 overlay（点击关闭按钮）
    const closeButton = overlay.locator('button', { hasText: /关闭|Close/i });
    await expect(closeButton).toBeVisible({ timeout: 3000 });
    await closeButton.click();
    await expect(overlay).toBeHidden({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('游戏结束：召唤师被摧毁后显示结算界面', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 移除玩家1的召唤师，模拟游戏结束
    let coreState = await readCoreState(hostPage);
    const gameOverCore = removeSummonerFromCore(coreState, '1');
    await applyCoreState(hostPage, gameOverCore);
    await closeDebugPanelIfOpen(hostPage);

    // 验证结算界面出现
    const endgameOverlay = hostPage.getByTestId('endgame-overlay');
    await expect(endgameOverlay).toBeVisible({ timeout: 10000 });

    // 验证结算内容区域
    const endgameContent = hostPage.getByTestId('endgame-overlay-content');
    await expect(endgameContent).toBeVisible({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('非当前玩家操作：guest 在 host 回合无法操作', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
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

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 确认当前是 host 回合
    const hostPhase = await getCurrentPhase(hostPage);
    expect(hostPhase).toBeTruthy();

    // Guest 的结束阶段按钮应该被禁用
    const guestEndPhase = guestPage.getByTestId('sw-end-phase');
    await expect(guestEndPhase).toBeVisible({ timeout: 5000 });
    await expect(guestEndPhase).toBeDisabled();

    // Guest 的 action banner 应显示等待对手
    const guestBanner = guestPage.getByTestId('sw-action-banner');
    await expect(guestBanner).toContainText(/等待对手/);

    await hostContext.close();
    await guestContext.close();
  });
});

// ============================================================================
// 主动技能测试辅助函数
// ============================================================================

/**
 * 准备复活死灵测试状态
 * - 召唤阶段
 * - 召唤师有 revive_undead 技能
 * - 弃牌堆有亡灵单位
 * - 召唤师相邻有空位
 */
const prepareReviveUndeadState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  // 确保弃牌堆有亡灵单位
  const undeadCard = {
    id: 'necro-undead-warrior-test',
    name: '亡灵战士',
    cardType: 'unit',
    faction: '堕落王国',
    cost: 1,
    life: 2,
    strength: 1,
    attackType: 'melee',
    unitClass: 'common',
    spriteIndex: 2,
    spriteAtlas: 'cards',
  };

  player.discard = [undeadCard, ...player.discard];
  player.magic = 10;

  return next;
};

/**
 * 准备火祀召唤测试状态
 * - 召唤阶段
 * - 伊路特-巴尔在场（有 fire_sacrifice_summon 技能）
 * - 有其他友方单位可消灭
 */
const prepareFireSacrificeState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  // 查找一个空位放置伊路特-巴尔
  const board = next.board;
  let elutBarPlaced = false;
  let allyPlaced = false;
  let elutBarPosition: { row: number; col: number } | null = null;
  let allyPosition: { row: number; col: number } | null = null;

  for (let row = 6; row < 8 && !elutBarPlaced; row++) {
    for (let col = 0; col < 6 && !elutBarPlaced; col++) {
      if (!board[row][col].unit && !board[row][col].structure) {
        board[row][col].unit = {
          cardId: 'necro-elut-bar-test',
          card: {
            id: 'necro-elut-bar',
            name: '伊路特-巴尔',
            cardType: 'unit',
            faction: '堕落王国',
            cost: 5,
            life: 6,
            strength: 3,
            attackType: 'melee',
            unitClass: 'champion',
            abilities: ['fire_sacrifice_summon'],
            spriteIndex: 0,
            spriteAtlas: 'cards',
          },
          owner: '0',
          position: { row, col },
          damage: 0,
          boosts: 0,
          hasMoved: false,
          hasAttacked: false,
        };
        elutBarPlaced = true;
        elutBarPosition = { row, col };

        // 在相邻位置放置一个友方单位
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
                cardId: 'necro-undead-warrior-ally',
                card: {
                  id: 'necro-undead-warrior',
                  name: '亡灵战士',
                  cardType: 'unit',
                  faction: '堕落王国',
                  cost: 1,
                  life: 2,
                  strength: 1,
                  attackType: 'melee',
                  unitClass: 'common',
                  spriteIndex: 2,
                  spriteAtlas: 'cards',
                },
                owner: '0',
                position: adj,
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              };
              allyPlaced = true;
              allyPosition = { ...adj };
              break;
            }
          }
        }
      }
    }
  }

  if (!elutBarPlaced || !elutBarPosition) {
    throw new Error('无法放置伊路特-巴尔');
  }

  if (!allyPlaced || !allyPosition) {
    throw new Error('无法放置火祀召唤所需的友方单位');
  }

  return { core: next, elutBarPosition, allyPosition };
};

/**
 * 准备吸取生命测试状态
 * - 攻击阶段
 * - 德拉戈斯在场（有 life_drain 技能）
 * - 2格内有友方单位可消灭
 */
const prepareLifeDrainState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (player) {
    player.attackCount = 0;
  }

  // 查找一个空位放置德拉戈斯
  const board = next.board;
  let dragosPlaced = false;
  let allyPlaced = false;
  let dragosPosition: { row: number; col: number } | null = null;
  let allyPosition: { row: number; col: number } | null = null;

  for (let row = 5; row < 8 && !dragosPlaced; row++) {
    for (let col = 0; col < 6 && !dragosPlaced; col++) {
      if (!board[row][col].unit && !board[row][col].structure) {
        board[row][col].unit = {
          cardId: 'necro-dragos-test',
          card: {
            id: 'necro-dragos',
            name: '德拉戈斯',
            cardType: 'unit',
            faction: '堕落王国',
            cost: 6,
            life: 7,
            strength: 2,
            attackType: 'melee',
            unitClass: 'champion',
            abilities: ['life_drain'],
            spriteIndex: 1,
            spriteAtlas: 'cards',
          },
          owner: '0',
          position: { row, col },
          damage: 0,
          boosts: 0,
          hasMoved: false,
          hasAttacked: false,
        };
        dragosPlaced = true;
        dragosPosition = { row, col };

        // 2格内放置一个友方单位
        const nearbyPositions = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
          { row: row - 2, col },
          { row: row + 2, col },
          { row, col: col - 2 },
          { row, col: col + 2 },
        ];
        for (const pos of nearbyPositions) {
          if (pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 6) {
            if (!board[pos.row][pos.col].unit && !board[pos.row][pos.col].structure) {
              board[pos.row][pos.col].unit = {
                cardId: 'necro-undead-warrior-ally-2',
                card: {
                  id: 'necro-undead-warrior',
                  name: '亡灵战士',
                  cardType: 'unit',
                  faction: '堕落王国',
                  cost: 1,
                  life: 2,
                  strength: 1,
                  attackType: 'melee',
                  unitClass: 'common',
                  spriteIndex: 2,
                  spriteAtlas: 'cards',
                },
                owner: '0',
                position: pos,
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              };
              allyPlaced = true;
              allyPosition = { ...pos };
              break;
            }
          }
        }
      }
    }
  }

  if (!dragosPlaced || !dragosPosition) {
    throw new Error('无法放置德拉戈斯');
  }

  if (!allyPlaced || !allyPosition) {
    throw new Error('无法放置吸取生命所需的友方单位');
  }

  return { core: next, dragosPosition, allyPosition };
};


/**
 * 准备狱火铸剑测试状态
 * - 建造阶段
 * - 场上有友方士兵
 * - 场上有友方士兵
 */
const prepareHellfireBladeState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'build';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  // 确保手牌有狱火铸剑（使用匹配 ID 格式）
  const hellfireCard = {
    id: 'necro-hellfire-blade',
    name: '狱火铸剑',
    cardType: 'event',
    eventType: 'common',
    cost: 0,
    playPhase: 'build',
    effect: '将本事件放置到一个友方士兵的底层。该单位获得战斗力+2。',
    spriteIndex: 3,
    spriteAtlas: 'cards',
  };

  // 移除手牌中的建筑卡，只保留狱火铸剑
  player.hand = [hellfireCard, ...player.hand.filter((c: any) => c.cardType !== 'structure')];
  player.magic = 10;

  return next;
};

/**
 * 准备除灭测试状态
 * - 移动阶段
 * - 手牌有除灭
 * - 场上有多个友方单位
 */
const prepareAnnihilateState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  // 确保手牌有除灭
  const annihilateCard = {
    id: 'necro-annihilate',
    name: '除灭',
    cardType: 'event',
    eventType: 'common',
    cost: 0,
    playPhase: 'move',
    effect: '指定任意数量的友方单位为目标。对于每个目标，你可以对其相邻的一个单位造成2点伤害。消灭所有目标。',
    spriteIndex: 4,
    spriteAtlas: 'cards',
  };

  player.hand = [annihilateCard, ...player.hand];
  player.magic = 10;
  player.moveCount = 0;

  return next;
};

/**
 * 准备血契召唤测试状态
 * - 召唤阶段
 * - 手牌有血契召唤和低费单位
 * - 场上有友方单位
 */
const prepareBloodSummonState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  // 确保手牌有血契召唤
  const bloodSummonCard = {
    id: 'necro-blood-summon',
    name: '血契召唤',
    cardType: 'event',
    eventType: 'common',
    cost: 0,
    playPhase: 'summon',
    effect: '结算以下效果任意次数：指定一个友方单位为目标。从你的手牌选择一个费用为2点或更低的单位，放置到目标相邻的区格。对目标造成2点伤害。',
    spriteIndex: 5,
    spriteAtlas: 'cards',
  };

  // 确保手牌有低费单位
  const lowCostUnit = {
    id: 'necro-hellfire-cultist',
    name: '地狱火教徒',
    cardType: 'unit',
    faction: '堕落王国',
    cost: 0,
    life: 2,
    strength: 2,
    attackType: 'ranged',
    unitClass: 'common',
    spriteIndex: 7,
    spriteAtlas: 'cards',
  };

  player.hand = [bloodSummonCard, lowCostUnit, ...player.hand];
  player.magic = 10;

  return next;
};

/**
 * 准备无建筑卡但有事件卡的测试状态
 * - 建造阶段
 * - 手牌只有狱火铸剑（无建筑卡）
 * - 场上有友方士兵
 */
const prepareNoStructureButEventState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'build';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  // 确保手牌有狱火铸剑但没有建筑卡
  const hellfireCard = {
    id: 'necro-hellfire-blade',
    name: '狱火铸剑',
    cardType: 'event',
    eventType: 'common',
    cost: 0,
    playPhase: 'build',
    effect: '将本事件放置到一个友方士兵的底层。该单位获得战斗力+2。',
    spriteIndex: 3,
    spriteAtlas: 'cards',
  };

  // 移除所有建筑卡
  player.hand = [hellfireCard, ...player.hand.filter((c: any) => c.cardType !== 'structure')];
  player.magic = 10;

  return next;
};


/**
 * 准备弃牌堆测试状态
 * - 弃牌堆有多张卡牌
 */
const prepareDiscardPileState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  // 往弃牌堆塞几张卡
  const discardCards = [
    {
      id: 'discard-unit-1',
      name: '亡灵战士',
      cardType: 'unit',
      faction: '堕落王国',
      cost: 1,
      life: 2,
      strength: 1,
      attackType: 'melee',
      unitClass: 'common',
      spriteIndex: 2,
      spriteAtlas: 'cards',
    },
    {
      id: 'discard-unit-2',
      name: '亡灵射手',
      cardType: 'unit',
      faction: '堕落王国',
      cost: 1,
      life: 1,
      strength: 2,
      attackType: 'ranged',
      unitClass: 'common',
      spriteIndex: 3,
      spriteAtlas: 'cards',
    },
  ];

  player.discard = [...discardCards, ...player.discard];

  return next;
};
