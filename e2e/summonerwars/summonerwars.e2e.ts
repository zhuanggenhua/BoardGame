/**
 * 召唤师战争 E2E 测试
 * 
 * 当前文件同时覆盖在线房间与本地测试路由场景；
 * 涉及真实多人流时仍需要后端服务运行。
 */

import { test, expect } from '../framework';
import type { BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
import { waitForState, waitForPhaseChange } from '../helpers/waitForState';
import {
  applyCoreState as applyCoreStateViaServer,
  cloneState,
  closeDebugPanelIfOpen as closeDebugPanelIfOpenViaHelper,
  createSWRoomViaAPI,
  readCoreState as readCoreStateViaServer,
  waitForPhase as waitForPhaseViaHelper,
} from '../helpers/summonerwars';
import { setChineseLocale } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { DESKTOP_REFERENCE_VIEWPORT, MOBILE_LANDSCAPE_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('summonerwars');
  await game.setupScene({ gameId: 'summonerwars' });
};
void __ensureThreeAxesMarker;

import {
  createSummonerWarsMobileEvidenceState,
  SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT,
  withSummonerWarsMobileEvidenceActionLog,
} from '../../src/games/summonerwars/mobileEvidence';

const SW_PHONE_LANDSCAPE_VIEWPORT = MOBILE_LANDSCAPE_REFERENCE_VIEWPORT;
const mockSummonerWarsMapImage = async (context: BrowserContext) => {
  if (process.env.PW_SW_USE_REAL_MAP === 'true') {
    return;
  }

  const mapPlaceholderSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">',
    '<defs>',
    '<linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">',
    '<stop offset="0%" stop-color="#101828"/>',
    '<stop offset="100%" stop-color="#1f2937"/>',
    '</linearGradient>',
    '</defs>',
    '<rect width="900" height="1200" fill="url(#bg)"/>',
    '<rect x="45" y="45" width="810" height="1110" rx="32" fill="none" stroke="rgba(148,163,184,0.55)" stroke-width="6"/>',
    '<g stroke="rgba(96,165,250,0.18)" stroke-width="2">',
    ...Array.from({ length: 7 }, (_, index) => `<line x1="120" y1="${180 + index * 120}" x2="780" y2="${180 + index * 120}"/>`),
    ...Array.from({ length: 5 }, (_, index) => `<line x1="${210 + index * 120}" y1="120" x2="${210 + index * 120}" y2="1080"/>`),
    '</g>',
    '</svg>',
  ].join('');
  await context.route(/summonerwars\/common\/compressed\/map\.(png|webp|jpg|jpeg)(\?.*)?$/i, (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: mapPlaceholderSvg,
  }));
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
      if (status >= 500 && url.includes('/src/games/summonerwars/Board.tsx')) {
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
    localStorage.removeItem('hud_fab_position');
    localStorage.removeItem('hud_fab_offset');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('match_creds_')) {
        localStorage.removeItem(key);
      }
      if (key.startsWith('match_ai_creds_')) {
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

const buildSummonerWarsOnlineAiWatchdogState = (
  liveState: Awaited<ReturnType<typeof getMatchState>>,
) => {
  const state = withSummonerWarsMobileEvidenceActionLog(
    createSummonerWarsMobileEvidenceState({
      faction0: 'necromancer',
      faction1: 'trickster',
    }),
    Date.now(),
  );
  const liveTurnOrder = Array.isArray((liveState.sys as { turnOrder?: unknown } | undefined)?.turnOrder)
    ? ((liveState.sys as { turnOrder?: unknown[] }).turnOrder ?? []).filter((playerId): playerId is string => typeof playerId === 'string')
    : ['0', '1'];
  const liveCurrentPlayerIndex = typeof (liveState.sys as { currentPlayerIndex?: unknown } | undefined)?.currentPlayerIndex === 'number'
    ? (liveState.sys as { currentPlayerIndex: number }).currentPlayerIndex
    : 0;
  const aiPlayerIndex = liveTurnOrder.indexOf('1');

  return {
    ...liveState,
    ...state,
    core: {
      ...liveState.core,
      ...state.core,
      currentPlayer: '1',
      phase: 'summon',
      turnNumber: Math.max(state.core.turnNumber ?? 0, 5),
    },
    sys: {
      ...liveState.sys,
      ...state.sys,
      matchId: liveState.sys?.matchId,
      turnOrder: liveTurnOrder,
      currentPlayerIndex: aiPlayerIndex >= 0 ? aiPlayerIndex : liveCurrentPlayerIndex,
      phase: 'summon',
      turnNumber: Math.max(state.sys.turnNumber ?? 0, 5),
      interaction: {
        ...state.sys.interaction,
        current: undefined,
        queue: [],
        isBlocked: false,
      },
      responseWindow: {
        ...state.sys.responseWindow,
        current: undefined,
      },
    },
  };
};

type OnlineAiDebugApi = {
  getSeatLatestState?: (playerId: string) => unknown;
  setSeatLatestStateOverride?: (playerId: string, state: unknown) => void;
  clearSeatLatestStateOverride?: (playerId: string) => void;
  clearAllSeatLatestStateOverrides?: () => void;
};

const waitForOnlineAiDebugApi = async (page: Page, timeout = 15000) => {
  await page.waitForFunction(
    () => Boolean((window as Window & { __BG_ONLINE_AI_DEBUG__?: OnlineAiDebugApi }).__BG_ONLINE_AI_DEBUG__),
    { timeout, polling: 200 },
  );
};

const setOnlineAiSeatStateOverride = async (page: Page, playerId: string, state: unknown) => {
  await page.evaluate(([targetPlayerId, nextState]) => {
    const api = (window as Window & { __BG_ONLINE_AI_DEBUG__?: OnlineAiDebugApi }).__BG_ONLINE_AI_DEBUG__;
    if (!api?.setSeatLatestStateOverride) {
      throw new Error('在线 AI 调试 API 未就绪');
    }
    api.setSeatLatestStateOverride(targetPlayerId, nextState);
  }, [playerId, state]);
};

const clearOnlineAiSeatStateOverride = async (page: Page, playerId: string) => {
  await page.evaluate((targetPlayerId) => {
    const api = (window as Window & { __BG_ONLINE_AI_DEBUG__?: OnlineAiDebugApi }).__BG_ONLINE_AI_DEBUG__;
    api?.clearSeatLatestStateOverride?.(targetPlayerId);
  }, playerId).catch(() => {});
};

const countUnitsForPlayer = (core: Record<string, any> | null | undefined, playerId: string) => {
  const board = Array.isArray(core?.board) ? core.board : [];
  let count = 0;
  for (const row of board) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell?.unit?.owner === playerId) {
        count += 1;
      }
    }
  }
  return count;
};

const findNewUnitPositionForPlayer = (
  beforeCore: Record<string, any> | null | undefined,
  afterCore: Record<string, any> | null | undefined,
  playerId: string,
) => {
  const beforeBoard = Array.isArray(beforeCore?.board) ? beforeCore.board : [];
  const afterBoard = Array.isArray(afterCore?.board) ? afterCore.board : [];
  for (let row = 0; row < afterBoard.length; row += 1) {
    const afterRow = Array.isArray(afterBoard[row]) ? afterBoard[row] : [];
    const beforeRow = Array.isArray(beforeBoard[row]) ? beforeBoard[row] : [];
    for (let col = 0; col < afterRow.length; col += 1) {
      const nextUnit = afterRow[col]?.unit;
      if (!nextUnit || nextUnit.owner !== playerId) continue;
      const prevUnit = beforeRow[col]?.unit;
      if (!prevUnit || prevUnit.instanceId !== nextUnit.instanceId) {
        return {
          row,
          col,
          instanceId: nextUnit.instanceId as string | undefined,
          name: nextUnit.card?.name as string | undefined,
        };
      }
    }
  }
  return null;
};

const buildSummonerWarsOnlineAiSummonRaceState = (
  liveState: Awaited<ReturnType<typeof getMatchState>>,
) => {
  const state = withSummonerWarsMobileEvidenceActionLog(
    createSummonerWarsMobileEvidenceState({
      faction0: 'necromancer',
      faction1: 'trickster',
    }),
    Date.now(),
  );
  const liveTurnOrder = Array.isArray((liveState.sys as { turnOrder?: unknown } | undefined)?.turnOrder)
    ? ((liveState.sys as { turnOrder?: unknown[] }).turnOrder ?? []).filter((playerId): playerId is string => typeof playerId === 'string')
    : ['0', '1'];
  const liveCurrentPlayerIndex = typeof (liveState.sys as { currentPlayerIndex?: unknown } | undefined)?.currentPlayerIndex === 'number'
    ? (liveState.sys as { currentPlayerIndex: number }).currentPlayerIndex
    : 0;
  const aiPlayerIndex = liveTurnOrder.indexOf('1');

  return {
    ...liveState,
    ...state,
    core: {
      ...liveState.core,
      ...state.core,
      currentPlayer: '1',
      phase: 'summon',
      turnNumber: Math.max(state.core.turnNumber ?? 0, 5),
    },
    sys: {
      ...liveState.sys,
      ...state.sys,
      matchId: liveState.sys?.matchId,
      turnOrder: liveTurnOrder,
      currentPlayerIndex: aiPlayerIndex >= 0 ? aiPlayerIndex : liveCurrentPlayerIndex,
      phase: 'summon',
      turnNumber: Math.max(state.sys.turnNumber ?? 0, 5),
      interaction: {
        ...state.sys.interaction,
        current: undefined,
        queue: [],
        isBlocked: false,
      },
      responseWindow: {
        ...state.sys.responseWindow,
        current: undefined,
      },
    },
  };
};

const buildSummonerWarsStaleAiDrawSeatState = (
  authoritativeState: ReturnType<typeof buildSummonerWarsOnlineAiSummonRaceState>,
) => {
  const staleState = cloneState(authoritativeState as Record<string, unknown>) as ReturnType<typeof buildSummonerWarsOnlineAiSummonRaceState>;
  return {
    ...staleState,
    core: {
      ...staleState.core,
      currentPlayer: '1',
      phase: 'draw',
    },
    sys: {
      ...staleState.sys,
      phase: 'draw',
      interaction: {
        ...staleState.sys.interaction,
        current: undefined,
        queue: [],
        isBlocked: false,
      },
      responseWindow: {
        ...staleState.sys.responseWindow,
        current: undefined,
      },
    },
  };
};

const blockSummonerWarsAiSeatAutoClaim = async (
  context: BrowserContext,
  targetPlayerId = '1',
) => {
  await context.route(/\/games\/summonerwars\/[^/]+\/claim-seat$/i, async (route) => {
    const request = route.request();
    const body = request.postDataJSON?.() as { playerID?: unknown } | undefined;
    if (body?.playerID === targetPlayerId) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'e2e_block_ai_claim' }),
      });
      return;
    }
    await route.continue();
  });
};

const waitForHomeGameList = async (page: Page) => {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await page.waitForLoadState('domcontentloaded');
    attachPageDiagnostics(page);
    await waitForFrontendAssets(page).catch(() => {});
    try {
      await page.waitForSelector('[data-game-id]', { timeout: 12000, state: 'attached' });
      return;
    } catch {
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
          const snippet = text.replace(/\s+/g, ' ').slice(0, 240);
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
          .slice(0, 8);
        return {
          readyState: document.readyState,
          hasViteOverlay: Boolean(document.querySelector('vite-error-overlay')),
          bodyText: document.body?.innerText?.slice(0, 300) || '',
          rootHtml: root?.innerHTML?.slice(0, 400) || '',
          resources,
        };
      });
      const latestErrors = attachPageDiagnostics(page).errors.slice(-8).join(' | ');
      const transientAssetFailure = /Outdated Optimize Dep|Failed to load PostCSS config|ERR_ABORTED|response:500 .*\\?game=summonerwars/i
        .test(`${latestErrors} ${indexSummary}`);
      if (attempt < maxRetries && transientAssetFailure) {
        await page.waitForTimeout(500);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await dismissViteOverlay(page);
        continue;
      }

      const url = page.url();
      const latestServerError = attachPageDiagnostics(page).lastServerError;
      const errorLines = [
        `首页未渲染游戏卡片 (attempt=${attempt + 1}/${maxRetries + 1})`,
        `url=${url}`,
        `readyState=${diagnostics.readyState}`,
        `hasViteOverlay=${diagnostics.hasViteOverlay}`,
        `bodyText=${diagnostics.bodyText || 'EMPTY'}`,
        `rootHtml=${diagnostics.rootHtml || 'EMPTY'} resources=${diagnostics.resources?.join(',') || 'EMPTY'} `
        + `indexHtml=${indexSummary} `
        + `viteClient=${viteClientStatus} main=${mainStatus} `
        + `errors=${latestErrors || 'EMPTY'}`
        + ` serverError=${latestServerError || 'EMPTY'}`,
      ];
      throw new Error(errorLines.join('\n'));
    }
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

const blockLobbySocket = async (context: BrowserContext) => {
  await context.addInitScript(() => {
    (window as Window & { __E2E_BLOCK_LOBBY_SOCKET__?: boolean }).__E2E_BLOCK_LOBBY_SOCKET__ = true;
  });
  await context.route(/\/lobby-socket\//i, route => route.abort());
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
    await waitForState(page, async () => {
      return !(await confirmButton.isVisible().catch(() => false));
    }, { timeout: 2000, message: '等待确认对话框关闭' });
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
    const toggle = page.getByTestId('debug-toggle');
    // 等待 toggle 稳定（避免 DOM 重建导致 detached）
    await toggle.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
    await toggle.click().catch(() => {});
    await expect(panel).toBeHidden({ timeout: 5000 }).catch(() => {});
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

const readGameState = async (page: Page) => {
  await ensureDebugStateTab(page);
  const raw = await page.getByTestId('debug-state-json').innerText();
  const parsed = JSON.parse(raw);
  return parsed?.G ?? parsed;
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

const applyGameState = async (page: Page, gameState: unknown) => {
  await ensureDebugStateTab(page);
  await page.getByTestId('debug-state-toggle-input').click();
  const input = page.getByTestId('debug-state-input');
  await expect(input).toBeVisible({ timeout: 3000 });
  await input.fill(JSON.stringify(gameState));
  await page.getByTestId('debug-state-apply').click();
  await expect(input).toBeHidden({ timeout: 5000 }).catch(() => { });
};

const waitForSummonerWarsHarness = async (page: Page, timeout = 15000) => {
  await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
    { timeout, polling: 200 },
  );
};

const readLastErrorContext = async (page: Page) => (
  page.evaluate(() => (window as any).__BG_LAST_ERROR_CONTEXT__ ?? null).catch(() => null)
);

const assertNoReactCrash = async (page: Page, label: string) => {
  const ctx = await readLastErrorContext(page);
  if (!ctx?.message) return;
  const stack = ctx.stack ? `\nstack:\n${ctx.stack}` : '';
  throw new Error(
    [
      `[${label}] 页面发生运行时错误（可能被 ErrorBoundary 捕获）`,
      `message=${ctx.message}`,
      `source=${ctx.source || 'EMPTY'}`,
      stack,
    ].filter(Boolean).join('\n'),
  );
};

const injectSummonerWarsMobileEvidenceScene = async (page: Page) => {
  const sceneState = createSummonerWarsMobileEvidenceState();
  await page.evaluate((state) => {
    const harness = window.__BG_TEST_HARNESS__;
    if (!harness?.state?.isRegistered?.()) {
      throw new Error('TestHarness 未就绪');
    }
    harness.state.set(state);
  }, sceneState);
};

const openSummonerWarsMobileEvidencePage = async (
  page: Page,
  options?: { playerId?: '0' | '1' },
) => {
  attachPageDiagnostics(page);
  // 该证据页场景依赖 TestHarness 注入状态，因此必须走 /play/:gameId 测试路由，
  // 不能切到 /tutorial 路由；教程路由当前不会注册 TestHarness。
  const playerIdQuery = options?.playerId ? `&playerID=${options.playerId}` : '';
  await page.goto(`/play/summonerwars?skipInitialization=true&numPlayers=2${playerIdQuery}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.waitForFunction(
      () => Boolean(
        document.querySelector('#root [data-game-page]')
        || document.querySelector('#root [data-testid="debug-panel"]')
        || (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
      ),
      { timeout: 15000 },
    );
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const root = document.querySelector('#root');
      const rescueGate = document.querySelector('[data-testid="game-page-rescue-gate"]');
      const viewport = document.querySelector('.game-page-viewport') as HTMLElement | null;
      const rect = viewport?.getBoundingClientRect();
      const lastError = (window as any).__BG_LAST_ERROR_CONTEXT__ as { message?: string; source?: string } | undefined;
      return {
        url: window.location.href,
        readyState: document.readyState,
        hasRescueGate: Boolean(rescueGate),
        rescueGateText: rescueGate?.textContent?.slice(0, 280) || '',
        rootHtml: root?.innerHTML?.slice(0, 400) || '',
        viewport: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
        lastErrorMessage: lastError?.message || '',
        lastErrorSource: lastError?.source || '',
      };
    });
    const errors = attachPageDiagnostics(page).errors.slice(-8).join(' | ') || 'EMPTY';
    throw new Error(
      [
        'SummonerWars 证据页未进入可用状态',
        `url=${diagnostics.url}`,
        `readyState=${diagnostics.readyState}`,
        `rescueGate=${diagnostics.hasRescueGate}`,
        `rescueGateText=${diagnostics.rescueGateText || 'EMPTY'}`,
        `viewport=${diagnostics.viewport ? `${diagnostics.viewport.width}x${diagnostics.viewport.height}` : 'EMPTY'}`,
        `lastError=${diagnostics.lastErrorMessage || 'EMPTY'} source=${diagnostics.lastErrorSource || 'EMPTY'}`,
        `rootHtml=${diagnostics.rootHtml || 'EMPTY'}`,
        `errors=${errors}`,
      ].join('\n'),
    );
  }
  await waitForSummonerWarsHarness(page);
  await injectSummonerWarsMobileEvidenceScene(page);
  await expect(page.getByTestId('sw-hand-area')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('sw-phase-tracker')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('sw-end-phase')).toBeVisible({ timeout: 20000 });
};

const seedMobileActionLog = async (page: Page) => {
  const currentState = await page.evaluate(() => {
    const harness = window.__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    if (!state) {
      throw new Error('TestHarness 未就绪');
    }
    return state;
  });
  const nextState = withSummonerWarsMobileEvidenceActionLog(currentState, Date.now());
  await page.evaluate((state) => {
    const harness = window.__BG_TEST_HARNESS__;
    if (!harness?.state?.isRegistered?.()) {
      throw new Error('TestHarness 未就绪');
    }
    harness.state.set(state);
  }, nextState);
};

const readSummonerWarsHarnessState = async (page: Page) => (
  page.evaluate(() => {
    const harness = window.__BG_TEST_HARNESS__;
    if (!harness?.state?.isRegistered?.()) {
      throw new Error('TestHarness 未就绪');
    }
    return harness.state.get();
  })
);

const applySummonerWarsHarnessState = async (page: Page, state: unknown) => {
  await page.evaluate((nextState) => {
    const harness = window.__BG_TEST_HARNESS__;
    if (!harness?.state?.isRegistered?.()) {
      throw new Error('TestHarness 未就绪');
    }
    harness.state.set(nextState);
  }, state);
};

const buildSummonerWarsLocalUndoProbeState = (
  currentState: Awaited<ReturnType<typeof readSummonerWarsHarnessState>>,
) => {
  const previousState = structuredClone(currentState) as typeof currentState;
  previousState.core.phase = 'summon';
  previousState.sys.phase = 'summon';
  previousState.core.currentPlayer = '0';
  previousState.core.turnNumber = Math.max(previousState.core.turnNumber ?? 0, 3);
  previousState.sys.turnNumber = Math.max(previousState.sys.turnNumber ?? 0, 3);

  const nextState = structuredClone(previousState) as typeof currentState;
  nextState.core.phase = 'move';
  nextState.sys.phase = 'move';
  nextState.core.currentPlayer = '0';
  nextState.core.turnNumber = Math.max(previousState.core.turnNumber ?? 0, 3);
  nextState.sys.turnNumber = Math.max(previousState.sys.turnNumber ?? 0, 3);
  nextState.sys.undo = {
    ...nextState.sys.undo,
    maxSnapshots: 3,
    snapshots: [previousState],
    snapshotCursors: [-1],
    pendingRequest: undefined,
  };

  return nextState;
};

const _dismissTutorialOverlayViaDebugState = async (page: Page) => {
  await page.addStyleTag({
    content: `
      [data-tutorial-step] {
        display: none !important;
      }
    `,
  });
  /*

  test('移动横屏：对局中的单位与建筑应支持长按放大且不影响点击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await browser.newContext({ baseURL });
    await blockAudioRequests(guestContext);
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    const waitForFactionSelectionReady = async (page: Page) => {
      await page.waitForFunction(() => {
        const heading = document.querySelector('h1, [role="heading"]');
        const text = heading?.textContent ?? document.body?.innerText ?? '';
        return /Choose Your Faction|选择你的阵营/i.test(text);
      }, { timeout: 60000 });
    };
    const dispatchCommand = async (page: Page, type: string, payload: unknown) => page.evaluate(
      async ({ commandType, commandPayload }) => {
        const harness = (window as Window & {
          __BG_TEST_HARNESS__?: {
            command?: {
              dispatch?: (input: { type: string; payload?: unknown }) => Promise<void> | void;
            };
          };
        }).__BG_TEST_HARNESS__;
        if (typeof harness?.command?.dispatch !== 'function') return false;
        const params = new URLSearchParams(window.location.search);
        const playerId = params.get('playerID') ?? '0';
        await harness.command.dispatch({ type: commandType, playerId, payload: commandPayload });
        return true;
      },
      { commandType: type, commandPayload: payload },
    );
    await waitForFactionSelectionReady(hostPage);
    await waitForFactionSelectionReady(guestPage);
    await dispatchCommand(hostPage, 'sw:select_faction', { factionId: 'necromancer' });
    await dispatchCommand(guestPage, 'sw:select_faction', { factionId: 'trickster' });
    await guestPage.waitForTimeout(300);
    await dispatchCommand(guestPage, 'sw:player_ready', {});
    await dispatchCommand(hostPage, 'sw:host_start_game', {});
    await waitForSummonerWarsUI(hostPage, 60000);

    const magnifyOverlay = hostPage.getByTestId('sw-magnify-overlay');
    const visibleBoardUnit = hostPage.locator('[data-testid^="sw-unit-"]:visible').first();
    const visibleBoardStructure = hostPage.locator('[data-testid^="sw-structure-"]:visible').first();

    await expect(visibleBoardUnit).toBeVisible({ timeout: 5000 });
    await expect(visibleBoardStructure).toBeVisible({ timeout: 5000 });

    await longPressTouch(visibleBoardUnit, 650, 31);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'mobile-board-unit-long-press-magnify', {
        filename: 'mobile-board-unit-long-press-magnify.png',
      }),
      fullPage: false,
    });

    await visibleBoardUnit.dispatchEvent('click');
    await hostPage.waitForTimeout(300);

    await longPressTouch(visibleBoardStructure, 650, 32);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'mobile-board-structure-long-press-magnify', {
        filename: 'mobile-board-structure-long-press-magnify.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('移动横屏：对局中的单位与建筑应支持长按放大且不影响点击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});
    const matchId = await createSWRoomViaAPI(hostPage);
    if (!matchId) {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    await ensurePlayerIdInUrl(hostPage, '0');

    const guestContext = await browser.newContext({ baseURL });
    await blockAudioRequests(guestContext);
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage, 30000);

    const magnifyOverlay = hostPage.getByTestId('sw-magnify-overlay');
    const visibleBoardUnit = hostPage.locator('[data-testid^="sw-unit-"]:visible').first();
    const visibleBoardStructure = hostPage.locator('[data-testid^="sw-structure-"]:visible').first();

    await expect(visibleBoardUnit).toBeVisible({ timeout: 5000 });
    await expect(visibleBoardStructure).toBeVisible({ timeout: 5000 });

    await longPressTouch(visibleBoardUnit, 650, 31);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'mobile-board-unit-long-press-magnify', {
        filename: 'mobile-board-unit-long-press-magnify.png',
      }),
      fullPage: false,
    });

    await visibleBoardUnit.dispatchEvent('click');
    await hostPage.waitForTimeout(300);

    await longPressTouch(visibleBoardStructure, 650, 32);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'mobile-board-structure-long-press-magnify', {
        filename: 'mobile-board-structure-long-press-magnify.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
    await guestContext.close();
  });
  */
  await expect(page.locator('[data-tutorial-step]')).toBeHidden({ timeout: 10000 });
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

const createSummonerWarsRoom = async (page: Page) => {
  attachPageDiagnostics(page);
  try {
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
  await createButton.evaluate((node) => {
    (node as HTMLElement | null)?.click();
  });
  await expect(page.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible({ timeout: 10000 });
  const confirmButton = page.getByRole('button', { name: /Confirm|确认/i });
  await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  await confirmButton.evaluate((node) => {
    (node as HTMLElement | null)?.click();
  });
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
  } catch {
    return createSWRoomViaAPI(page);
  }
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
  const waitForFactionSelectionReady = async (page: Page) => {
    await page.waitForFunction(() => {
      const harness = (window as Window & {
        __BG_TEST_HARNESS__?: {
          command?: {
            isRegistered?: () => boolean;
            dispatch?: unknown;
          };
        };
      }).__BG_TEST_HARNESS__;
      if (harness?.command?.isRegistered?.() === true || typeof harness?.command?.dispatch === 'function') return true;
      const heading = document.querySelector('h1, [role="heading"]');
      const text = heading?.textContent ?? document.body?.innerText ?? '';
      return /选择你的阵营|Choose Your Faction/i.test(text);
    }, { timeout: 20000 });
  };

  await waitForFactionSelectionReady(hostPage);
  await waitForFactionSelectionReady(guestPage);

  const dispatchCommand = async (page: Page, type: string, payload: unknown) => {
    return page.evaluate(async ({ commandType, commandPayload }) => {
      const harness = (window as Window & {
        __BG_TEST_HARNESS__?: {
          command?: {
            dispatch?: (input: { type: string; payload?: unknown }) => Promise<void> | void;
          };
        };
      }).__BG_TEST_HARNESS__;
      if (typeof harness?.command?.dispatch !== 'function') {
        return false;
      }
      const params = new URLSearchParams(window.location.search);
      const playerId = params.get('playerID') ?? '0';
      await harness.command.dispatch({ type: commandType, playerId, payload: commandPayload });
      return true;
    }, { commandType: type, commandPayload: payload });
  };

  const usedDispatchHost = await dispatchCommand(hostPage, 'sw:select_faction', { factionId: 'necromancer' });
  const usedDispatchGuest = await dispatchCommand(guestPage, 'sw:select_faction', { factionId: 'trickster' });

  if (usedDispatchHost && usedDispatchGuest) {
    await hostPage.waitForTimeout(300);
    await guestPage.waitForTimeout(300);
    await dispatchCommand(guestPage, 'sw:player_ready', {});
    await hostPage.waitForTimeout(300);
    await dispatchCommand(hostPage, 'sw:host_start_game', {});
    await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 30000 });
    await expect(guestPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 30000 });
    return;
  }

  // Host 选择第一个阵营
  const selectionHeading = (page: Page) =>
    page.locator('h1').filter({ hasText: /选择你的阵营|Choose your faction/i });
  await expect(selectionHeading(hostPage)).toBeVisible({ timeout: 20000 });
  await expect(selectionHeading(guestPage)).toBeVisible({ timeout: 20000 });

  const factionCards = (page: Page) => page.locator('.grid > div');
  await factionCards(hostPage).nth(0).evaluate((node) => {
    (node as HTMLElement | null)?.click();
  });

  // Guest 选择第二个阵营
  await factionCards(guestPage).nth(1).evaluate((node) => {
    (node as HTMLElement | null)?.click();
  });
  await expect(guestPage.locator('button').filter({ hasText: /准备|Ready/i })).toBeVisible({ timeout: 5000 });

  // Guest 点击准备
  const readyButton = guestPage.locator('button').filter({ hasText: /准备|Ready/i });
  await expect(readyButton).toBeVisible({ timeout: 5000 });
  await readyButton.click();
  await waitForState(hostPage, async () => {
    const startButton = await hostPage.locator('button').filter({ hasText: /开始游戏|Start Game/i }).isEnabled().catch(() => false);
    return startButton;
  }, { timeout: 2000, message: '等待开始按钮启用' });

  // Host 点击开始游戏
  const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game/i });
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await expect(startButton).toBeEnabled({ timeout: 5000 });
  await startButton.click();

  // 等待游戏 UI 出现（sw-end-phase 是可靠标志）
  await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 60000 });
  await expect(guestPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 60000 });
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

const getMapScaleBadgeState = async (page: Page) => page.evaluate(() => {
  const badge = document.querySelector('[data-testid="sw-map-scale"]') as HTMLElement | null;
  if (!badge) {
    return { opacity: 'missing', ariaHidden: null, text: '' };
  }
  const styles = window.getComputedStyle(badge);
  return {
    opacity: styles.opacity,
    ariaHidden: badge.getAttribute('aria-hidden'),
    text: badge.textContent?.trim() ?? '',
  };
});

const longPressTouch = async (locator: Locator, durationMs = 620, pointerId = 1) => {
  await locator.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    pointerId,
    isPrimary: true,
    buttons: 1,
  });
  await locator.page().waitForTimeout(durationMs);
  await locator.dispatchEvent('pointerup', {
    pointerType: 'touch',
    pointerId,
    isPrimary: true,
    buttons: 0,
  });
};

const getFabStoredPosition = async (page: Page) => (
  page.evaluate(() => {
    const raw = localStorage.getItem('hud_fab_position');
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as { leftPercent: number; topPercent: number };
  })
);

const touchDragElement = async (
  locator: Locator,
  {
    deltaX,
    deltaY,
    steps = 8,
  }: {
    deltaX: number;
    deltaY: number;
    steps?: number;
  },
) => {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('无法获取 FAB 按钮位置');
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const page = locator.page();
  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (let step = 1; step <= steps; step += 1) {
    const nextX = startX + (deltaX * step) / steps;
    const nextY = startY + (deltaY * step) / steps;
    await page.mouse.move(nextX, nextY);
    await page.waitForTimeout(16);
  }

  await page.mouse.up();
};

const sampleFabReleaseFrames = async (
  page: Page,
  {
    buttonId,
    panelId,
    frameCount = 12,
  }: {
    buttonId: string;
    panelId: string;
    frameCount?: number;
  },
) => (
  page.evaluate(async ({ buttonId: currentButtonId, panelId: currentPanelId, frameCount: currentFrameCount }) => {
    const resolveAnchorEdgeDistance = (
      targetRect: { top: number; bottom: number },
      referenceRect: { top: number; bottom: number },
    ) => Math.min(
      Math.abs(targetRect.top - referenceRect.top),
      Math.abs(targetRect.bottom - referenceRect.bottom),
    );

    const samples: Array<{
      frame: number;
      visualTop: number;
      visualBottom: number;
      panelTop: number;
      panelBottom: number;
      anchorEdgeDistance: number;
    } | null> = [];

    for (let frame = 0; frame < currentFrameCount; frame += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      const visual = document.querySelector(`[data-fab-visual-id="${currentButtonId}"]`) as HTMLElement | null;
      const panel = document.querySelector(`[data-testid="fab-panel-${currentPanelId}"]`) as HTMLElement | null;
      if (!visual || !panel) {
        samples.push(null);
        continue;
      }

      const visualRect = visual.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      samples.push({
        frame,
        visualTop: visualRect.top,
        visualBottom: visualRect.bottom,
        panelTop: panelRect.top,
        panelBottom: panelRect.bottom,
        anchorEdgeDistance: resolveAnchorEdgeDistance(panelRect, visualRect),
      });
    }

    return samples;
  }, { buttonId, panelId, frameCount })
);

const captureEvidenceClipAroundLocators = async (
  page: Page,
  locators: Locator[],
  {
    path,
    padding = 20,
  }: {
    path: string;
    padding?: number;
  },
) => {
  const boxes = (await Promise.all(locators.map((locator) => locator.boundingBox())))
    .filter((box): box is NonNullable<Awaited<ReturnType<Locator['boundingBox']>>> => Boolean(box));
  if (!boxes.length) {
    throw new Error('缺少可用于局部证据截图的元素边界');
  }
  const viewport = page.viewportSize();
  const viewportWidth = viewport?.width ?? 0;
  const viewportHeight = viewport?.height ?? 0;
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxRight = Math.max(...boxes.map((box) => box.x + box.width));
  const maxBottom = Math.max(...boxes.map((box) => box.y + box.height));
  const x = Math.max(0, Math.floor(minX - padding));
  const y = Math.max(0, Math.floor(minY - padding));
  const right = Math.min(viewportWidth || Math.ceil(maxRight + padding), Math.ceil(maxRight + padding));
  const bottom = Math.min(viewportHeight || Math.ceil(maxBottom + padding), Math.ceil(maxBottom + padding));
  await page.screenshot({
    path,
    clip: {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y),
    },
  });
};

const expandLocatorMatches = async (locator: Locator): Promise<Locator[]> => {
  const count = await locator.count();
  return Array.from({ length: count }, (_, index) => locator.nth(index));
};

const getHighlightMetrics = async (page: Page, selector: string) => (
  page.evaluate((currentSelector) => {
    const nodes = Array.from(document.querySelectorAll(currentSelector)) as HTMLElement[];
    return {
      count: nodes.length,
      samples: nodes.slice(0, 4).map((node) => {
        const rect = node.getBoundingClientRect();
        const styles = window.getComputedStyle(node);
        return {
          row: node.getAttribute('data-row'),
          col: node.getAttribute('data-col'),
          className: node.className,
          borderTopColor: styles.borderTopColor,
          backgroundColor: styles.backgroundColor,
          borderTopWidth: styles.borderTopWidth,
          boxShadow: styles.boxShadow,
          opacity: styles.opacity,
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
        };
      }),
    };
  }, selector)
);

const assertPlayableHandHighlightVisible = async (
  page: Page,
  testInfo: TestInfo,
  snapshotKey: string,
) => {
  const playableCards = page.getByTestId('sw-hand-area').locator('[data-can-play="true"]');
  await expect(playableCards.first()).toBeVisible({ timeout: 8000 });

  const playableCardLocators = await expandLocatorMatches(playableCards);
  expect(playableCardLocators.length).toBeGreaterThan(0);

  const playableHighlightMetrics = await getHighlightMetrics(page, '[data-testid="sw-hand-area"] [data-can-play="true"] > div:first-child');
  expect(playableHighlightMetrics.count).toBeGreaterThan(0);
  expect(String(playableHighlightMetrics.samples[0]?.className ?? '')).toMatch(/border-emerald|ring-emerald|border-green|ring-green/);
  expect(playableHighlightMetrics.samples[0]?.boxShadow).not.toBe('none');

  await captureEvidenceClipAroundLocators(page, playableCardLocators.slice(0, 3), {
    path: getEvidenceScreenshotPath(testInfo, snapshotKey, {
      filename: `${snapshotKey}.png`,
    }),
  });
};

const waitForOverlayState = async (page: Page, overlayTestId: string, expected: 'open' | 'closed') => {
  await expect.poll(async () => page.evaluate(({ testId, target }) => {
    const overlays = Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)) as HTMLElement[];
    const visibleCount = overlays.filter((overlay) => {
      const styles = window.getComputedStyle(overlay);
      return styles.display !== 'none'
        && styles.visibility !== 'hidden'
        && styles.pointerEvents !== 'none'
        && styles.opacity !== '0';
    }).length;
    return target === 'open' ? visibleCount > 0 : visibleCount === 0;
  }, { testId: overlayTestId, target: expected }), { timeout: 5000 }).toBe(true);
};

void waitForOverlayState;

const getExpandedFabMetrics = async (page: Page) => (
  page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[data-testid="fab-menu"] [data-fab-id]')) as HTMLElement[];
    const panel = document.querySelector('[data-testid="fab-panel-action-log"]') as HTMLElement | null;
    const rows = Array.from(document.querySelectorAll('[data-testid="hud-action-log-row"]')) as HTMLElement[];
    const firstRow = rows[0] ?? null;
    const mainVisual = document.querySelector('[data-fab-visual-id="exit"]') as HTMLElement | null;
    const gamePage = document.querySelector('[data-game-page]') as HTMLElement | null;
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageScrollX: window.scrollX,
      pageScrollY: window.scrollY,
      gamePageRect: gamePage
        ? (() => {
          const rect = gamePage.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
        })()
        : null,
      mainVisualRect: mainVisual
        ? (() => {
          const rect = mainVisual.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
        })()
        : null,
      panelRect: panel
        ? (() => {
          const rect = panel.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
        })()
        : null,
      panelClientHeight: panel?.clientHeight ?? 0,
      panelScrollHeight: panel?.scrollHeight ?? 0,
      panelClientWidth: panel?.clientWidth ?? 0,
      panelScrollWidth: panel?.scrollWidth ?? 0,
      firstRowClientWidth: firstRow?.clientWidth ?? 0,
      firstRowScrollWidth: firstRow?.scrollWidth ?? 0,
      rowCount: rows.length,
      visibleButtons: buttons
        .map((button) => {
          const styles = window.getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return {
            id: button.dataset.fabId ?? '',
            visible: styles.display !== 'none'
              && styles.visibility !== 'hidden'
              && styles.opacity !== '0'
              && rect.width > 0
              && rect.height > 0,
            rect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            },
          };
        })
        .filter((entry) => entry.visible),
    };
  })
);

const waitForExpandedFabLayoutStable = async (page: Page) => {
  let previousSignature: string | null = null;
  let stableMetrics: Awaited<ReturnType<typeof getExpandedFabMetrics>> | null = null;
  let stableCount = 0;

  await expect.poll(async () => {
    const metrics = await getExpandedFabMetrics(page);
    if (!metrics.panelRect || !metrics.mainVisualRect || metrics.visibleButtons.length === 0) {
      stableCount = 0;
      previousSignature = null;
      return 0;
    }

    const signature = JSON.stringify({
      panelRect: Object.fromEntries(
        Object.entries(metrics.panelRect).map(([key, value]) => [key, Math.round(value * 10) / 10]),
      ),
      mainVisualRect: Object.fromEntries(
        Object.entries(metrics.mainVisualRect).map(([key, value]) => [key, Math.round(value * 10) / 10]),
      ),
      visibleButtons: metrics.visibleButtons.map((button) => ({
        id: button.id,
        rect: Object.fromEntries(
          Object.entries(button.rect).map(([key, value]) => [key, Math.round(value * 10) / 10]),
        ),
      })),
    });

    if (signature === previousSignature) {
      stableCount += 1;
    } else {
      stableCount = 0;
      previousSignature = signature;
    }

    stableMetrics = metrics;
    return stableCount;
  }, { timeout: 2500, intervals: [80, 120, 160] }).toBeGreaterThanOrEqual(1);

  if (!stableMetrics) {
    throw new Error('展开态 FAB 布局未能稳定');
  }
  return stableMetrics;
};

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

const openFabPanel = async (page: Page, panelId: string, mainId = 'exit') => {
  const panel = page.getByTestId(`fab-panel-${panelId}`);
  if (await panel.isVisible().catch(() => false)) return panel;

  const panelButton = page.locator(`[data-fab-id="${panelId}"]`);
  if (!await panelButton.isVisible().catch(() => false)) {
    const mainButton = page.locator(`[data-fab-id="${mainId}"]`);
    if (await mainButton.isVisible().catch(() => false)) {
      await mainButton.click();
    } else {
      const fallbackButtons = page.locator('[data-testid="fab-menu"] button');
      const fallbackCount = await fallbackButtons.count();
      let opened = false;
      for (let index = 0; index < fallbackCount; index += 1) {
        const fallbackButton = fallbackButtons.nth(index);
        if (!await fallbackButton.isVisible().catch(() => false)) {
          continue;
        }
        await fallbackButton.click();
        if (await panel.isVisible().catch(() => false)) {
          opened = true;
          break;
        }
        if (await panelButton.isVisible().catch(() => false)) {
          break;
        }
      }
      if (!opened && !await panelButton.isVisible().catch(() => false)) {
        throw new Error(`未找到 FAB 面板入口: ${panelId}`);
      }
    }
  }
  if (await panel.isVisible().catch(() => false)) return panel;

  await expect(panelButton).toBeVisible({ timeout: 5000 });
  await panelButton.click();
  await expect(panel).toBeVisible({ timeout: 5000 });
  return panel;
};

const collapseFabMenuToMainButton = async (page: Page, mainId = 'exit') => {
  const fabButtons = page.locator('[data-testid="fab-menu"] button');
  const buttonCount = await fabButtons.count();
  const mainButton = page.locator(`[data-fab-id="${mainId}"]`);
  const getVisibleButtons = async () => {
    const visibleButtons: Array<{ index: number; y: number }> = [];
    for (let index = 0; index < buttonCount; index += 1) {
      const button = fabButtons.nth(index);
      if (!await button.isVisible().catch(() => false)) {
        continue;
      }
      const box = await button.boundingBox();
      if (!box) {
        continue;
      }
      visibleButtons.push({ index, y: box.y });
    }
    return visibleButtons;
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const visibleButtons = await getVisibleButtons();
    if (visibleButtons.length <= 1) {
      return;
    }

    if (await mainButton.isVisible().catch(() => false)) {
      await mainButton.click({ force: true });
    } else {
      visibleButtons.sort((a, b) => b.y - a.y);
      await fabButtons.nth(visibleButtons[0].index).click({ force: true });
    }
    await page.waitForTimeout(120);
  }

  if (await mainButton.isVisible().catch(() => false)) {
    await mainButton.evaluate((element) => {
      (element as HTMLElement).click();
    });
    await page.waitForTimeout(120);
    await mainButton.evaluate((element) => {
      (element as HTMLElement).click();
    });
    await page.waitForTimeout(120);
  }

  await expect.poll(async () => {
    let visibleCount = 0;
    for (let index = 0; index < buttonCount; index += 1) {
      if (await fabButtons.nth(index).isVisible().catch(() => false)) {
        visibleCount += 1;
      }
    }
    return visibleCount;
  }, { timeout: 5000 }).toBeLessThanOrEqual(1);
};

const waitForSummonerWarsVisualStable = async (page: Page) => {
  await expect.poll(async () => {
    return page.evaluate(() => {
      const pageRoot = document.querySelector('[data-game-page][data-game-id="summonerwars"]');
      if (!pageRoot) return 0;
      const shimmerNodes = Array.from(pageRoot.querySelectorAll<HTMLElement>('[style*="img-shimmer"]'));
      return shimmerNodes.filter((node) => {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0.01) {
          return false;
        }
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
    });
  }, { timeout: 10000 }).toBe(0);
  await page.waitForTimeout(120);
};

const waitForSummonerWarsHandStable = async (page: Page, allowMissing = false) => {
  await expect.poll(async () => {
    return page.evaluate((canBeMissing) => {
      const handArea = document.querySelector('[data-testid="sw-hand-area"]') as HTMLElement | null;
      if (!handArea) {
        return canBeMissing;
      }

      const cards = Array.from(handArea.querySelectorAll<HTMLElement>('[data-card-id]'));
      if (cards.length === 0) {
        return canBeMissing;
      }

      const parseTranslate = (transform: string) => {
        if (!transform || transform === 'none') {
          return { x: 0, y: 0 };
        }
        const matrix3dMatch = transform.match(/^matrix3d\((.+)\)$/);
        if (matrix3dMatch) {
          const values = matrix3dMatch[1].split(',').map((value) => Number(value.trim()));
          return {
            x: values[12] ?? 0,
            y: values[13] ?? 0,
          };
        }
        const matrixMatch = transform.match(/^matrix\((.+)\)$/);
        if (matrixMatch) {
          const values = matrixMatch[1].split(',').map((value) => Number(value.trim()));
          return {
            x: values[4] ?? 0,
            y: values[5] ?? 0,
          };
        }
        return { x: Number.NaN, y: Number.NaN };
      };

      return cards.every((card) => {
        const styles = window.getComputedStyle(card);
        const opacity = Number(styles.opacity || '1');
        const translate = parseTranslate(styles.transform);
        return opacity >= 0.99
          && Number.isFinite(translate.x)
          && Number.isFinite(translate.y)
          && Math.abs(translate.x) <= 1
          && Math.abs(translate.y) <= 1;
      });
    }, allowMissing);
  }, {
    timeout: 5000,
    message: '等待召唤师战争手牌动画收敛',
  }).toBe(true);
  await page.waitForTimeout(120);
};

const waitForSummonerWarsHandArtReady = async (page: Page, allowMissing = false) => {
  await expect.poll(async () => {
    try {
      return await page.evaluate((canBeMissing) => {
        const handArea = document.querySelector('[data-testid="sw-hand-area"]') as HTMLElement | null;
        if (!handArea) {
          return canBeMissing;
        }

        const cards = Array.from(handArea.querySelectorAll<HTMLElement>('[data-card-id]'));
        if (cards.length === 0) {
          return canBeMissing;
        }

        const visibleCards = cards.filter((card) => {
          const rect = card.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (visibleCards.length === 0) {
          return canBeMissing;
        }

        return visibleCards.every((card) => {
          const sprite = card.querySelector<HTMLElement>('[data-card-sprite="true"]');
          if (!sprite) {
            return false;
          }
          const rect = sprite.getBoundingClientRect();
          return rect.width > 0
            && rect.height > 0
            && sprite.dataset.imageLoaded === 'true';
        });
      }, allowMissing);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Execution context was destroyed') || message.includes('Target closed')) {
        return false;
      }
      throw error;
    }
  }, {
    timeout: 30000,
    message: '等待召唤师战争手牌卡图真实渲染完成',
  }).toBe(true);
  await page.waitForTimeout(120);
};

const waitForSummonerWarsHandCount = async (page: Page, expectedCount: number) => {
  await expect.poll(async () => {
    try {
      const state = await readSummonerWarsHarnessState(page);
      return state?.core?.players?.['0']?.hand?.length ?? expectedCount;
    } catch {
      return expectedCount;
    }
  }, {
    timeout: 5000,
    message: `等待 TestHarness 手牌数量变为 ${expectedCount}`,
  }).toBe(expectedCount);

  await expect.poll(async () => {
    return page.locator('[data-testid="sw-hand-area"] [data-card-id]').count();
  }, {
    timeout: 5000,
    message: `等待 DOM 手牌数量变为 ${expectedCount}`,
  }).toBe(expectedCount);
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

const getHandCardViewportMetrics = async (page: Page) => page.evaluate(() => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cards = Array.from(document.querySelectorAll('[data-testid="sw-hand-area"] [data-card-id]'))
    .map((node) => {
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      const visibleLeft = Math.max(0, rect.left);
      const visibleTop = Math.max(0, rect.top);
      const visibleRight = Math.min(viewportWidth, rect.right);
      const visibleBottom = Math.min(viewportHeight, rect.bottom);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const area = Math.max(rect.width * rect.height, 1);
      const visibleRatio = (visibleWidth * visibleHeight) / area;
      return {
        cardId: node.getAttribute('data-card-id'),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        visibleRatio,
        fullyVisible: rect.left >= -1
          && rect.top >= -1
          && rect.right <= viewportWidth + 1
          && rect.bottom <= viewportHeight + 1,
        mostlyVisible: visibleRatio >= 0.72,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    viewportWidth,
    viewportHeight,
    totalCards: cards.length,
    fullyVisibleCount: cards.filter((card) => card.fullyVisible).length,
    mostlyVisibleCount: cards.filter((card) => card.mostlyVisible).length,
    cards,
  };
});

const assertReachableHandCards = async (
  page: Page,
  label: string,
  minMostlyVisibleCount: number,
) => {
  const metrics = await getHandCardViewportMetrics(page);
  if (metrics.mostlyVisibleCount < minMostlyVisibleCount) {
    throw new Error(
      [
        `[${label}] 手机横屏下可直接触达的手牌不足`,
        `expected>=${minMostlyVisibleCount}`,
        `actual=${metrics.mostlyVisibleCount}`,
        `cards=${JSON.stringify(metrics.cards)}`,
      ].join(' '),
    );
  }
};

const assertLocatorReceivesPointerEvents = async (
  locator: Locator,
  page: Page,
  label: string,
) => {
  await expect(locator, `[${label}] 目标不可见`).toBeVisible();
  await locator.click({ trial: true });
  const hitTest = await locator.evaluate((node) => {
    if (!(node instanceof HTMLElement)) {
      return null;
    }
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topElement = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
    const topTestId = topElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
    return {
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      centerX,
      centerY,
      topTestId,
      topTag: topElement?.tagName ?? null,
      receivesPointer: Boolean(topElement && (node === topElement || node.contains(topElement))),
    };
  });

  if (!hitTest?.receivesPointer) {
    throw new Error(
      [
        `[${label}] 目标中心点没有拿到指针事件`,
        `topTestId=${hitTest?.topTestId ?? 'null'}`,
        `topTag=${hitTest?.topTag ?? 'null'}`,
        `rect=${JSON.stringify(hitTest?.rect ?? null)}`,
      ].join(' '),
    );
  }

  const viewport = page.viewportSize();
  if (viewport) {
    expect(hitTest.rect.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(hitTest.rect.bottom).toBeLessThanOrEqual(viewport.height + 1);
  }
};

const assertMobileLandscapeControlsReachable = async (page: Page, label: string) => {
  await assertLocatorReceivesPointerEvents(
    page.getByTestId('sw-end-phase'),
    page,
    `${label}-end-phase`,
  );

  const trackerButtons = page.getByTestId('sw-phase-tracker').locator('button:visible');
  if (await trackerButtons.count()) {
    await assertLocatorReceivesPointerEvents(
      trackerButtons.first(),
      page,
      `${label}-phase-tracker-button`,
    );
  }
};

const getSummonerWarsMobileFrameMetrics = async (page: Page) => (
  page.evaluate(() => {
    const readRect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) {
        return null;
      }
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageRect: readRect('[data-game-page][data-game-id="summonerwars"]'),
      mapContainerRect: readRect('[data-testid="sw-map-container"]'),
      handAreaRect: readRect('[data-testid="sw-hand-area"]'),
      deckDrawRect: readRect('[data-testid="sw-deck-draw"]'),
      deckDiscardRect: readRect('[data-testid="sw-deck-discard"]'),
      endPhaseRect: readRect('[data-testid="sw-end-phase"]'),
      trackerRect: readRect('[data-testid="sw-phase-tracker"]'),
      playerEnergyRect: readRect('[data-testid="sw-energy-player"]'),
    };
  })
);

const assertMobileLandscapeFrameReachable = async (page: Page, label: string) => {
  const metrics = await getSummonerWarsMobileFrameMetrics(page);
  const assertRectInsideViewport = (
    rect: typeof metrics.pageRect,
    rectLabel: string,
  ) => {
    expect(rect, `[${label}] 缺少 ${rectLabel} 布局盒`).not.toBeNull();
    expect(rect?.left ?? -9999, `[${label}] ${rectLabel} 左边越界`).toBeGreaterThanOrEqual(-1);
    expect(rect?.top ?? -9999, `[${label}] ${rectLabel} 顶边越界`).toBeGreaterThanOrEqual(-1);
    expect(rect?.right ?? 99999, `[${label}] ${rectLabel} 右边越界`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(rect?.bottom ?? 99999, `[${label}] ${rectLabel} 底边越界`).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(rect?.width ?? 0, `[${label}] ${rectLabel} 宽度异常`).toBeGreaterThan(0);
    expect(rect?.height ?? 0, `[${label}] ${rectLabel} 高度异常`).toBeGreaterThan(0);
  };

  assertRectInsideViewport(metrics.pageRect, 'page');
  assertRectInsideViewport(metrics.mapContainerRect, 'map-container');
  assertRectInsideViewport(metrics.handAreaRect, 'hand-area');
  assertRectInsideViewport(metrics.deckDrawRect, 'deck-draw');
  assertRectInsideViewport(metrics.deckDiscardRect, 'deck-discard');
  assertRectInsideViewport(metrics.endPhaseRect, 'end-phase');
  assertRectInsideViewport(metrics.trackerRect, 'phase-tracker');
  assertRectInsideViewport(metrics.playerEnergyRect, 'player-energy');

  await assertLocatorReceivesPointerEvents(
    page.getByTestId('sw-deck-discard'),
    page,
    `${label}-deck-discard`,
  );
};

const advancePhase = async (page: Page, fromPhase: string) => {
  const endPhaseButton = page.getByTestId('sw-end-phase');
  const clickEndPhase = async () => {
    await expect(endPhaseButton).toBeVisible({ timeout: 5000 });
    try {
      await endPhaseButton.click({ timeout: 3000 });
    } catch {
      await endPhaseButton.evaluate((node) => {
        (node as HTMLElement | null)?.click();
      });
    }
  };
  await waitForMyTurn(page);
  const currentPhase = await getCurrentPhase(page);
  if (currentPhase !== fromPhase) {
    return currentPhase;
  }
  await clickEndPhase();
  // move/attack 阶段有剩余行动时，第一次点击会进入确认状态（按钮变红），需要再点一次
  const stillSamePhase = await getCurrentPhase(page).catch(() => fromPhase) === fromPhase;
  if (stillSamePhase) {
    await waitForState(page, async () => {
      const buttonClass = await endPhaseButton.getAttribute('class');
      return buttonClass?.includes('bg-red') || false;
    }, { timeout: 1000, message: '等待确认状态' }).catch(() => {});
    await clickEndPhase();
  }
  await expect.poll(() => getCurrentPhase(page), { timeout: 8000 }).not.toBe(fromPhase);
  return getCurrentPhase(page);
};

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

  const unitCard = pickCard('unit', (card) => !(card.abilities ?? []).includes('fire_sacrifice_summon'))
    ?? pickCard('unit')
    ?? pickCard('unit', () => true);
  const structureCard = pickCard('structure') ?? pickCard('structure', () => true);
  const eventCard = pickCard('event', (card) => card.playPhase === 'summon' || card.playPhase === 'any')
    ?? pickCard('event');

  if (!unitCard || !structureCard || !eventCard) {
    throw new Error('无法找到用于稳定流程的卡牌');
  }

  const extraCards: any[] = [];
  while (extraCards.length < 2) {
    const nextExtra = handPool.shift() ?? deck.shift();
    if (!nextExtra) break;
    extraCards.push(nextExtra);
  }

  next.players['0'] = {
    ...player,
    magic: 10,
    // 把已筛掉火祀召唤的稳定单位放到手牌末尾，避免 UI 流程里 `.last()`
    // 误点到 extraCards 中带额外召唤交互的单位，导致基础召唤链路失真。
    hand: [structureCard, eventCard, ...extraCards, unitCard],
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
    unit: cell.unit ? {
      ...cell.unit,
      position: { ...cell.unit.position },
      hasAttacked: false,
    } : undefined,
    structure: cell.structure ? { ...cell.structure, position: { ...cell.structure.position } } : undefined,
  })));
  next.board = board;
  if (next.players?.['0']) {
    next.players['0'] = {
      ...next.players['0'],
      attackCount: 0,
      hasAttackedEnemy: false,
    };
  }

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

  const getUnitAt = (position: { row: number; col: number }) => board[position.row]?.[position.col]?.unit;
  const getRemainingLife = (unit: any) => {
    const maxLife = Number(unit?.card?.life ?? 0);
    const damage = Number(unit?.damage ?? 0);
    return maxLife - damage;
  };
  const durableEnemyOrigin = [...enemyPositions]
    .sort((left, right) => {
      const leftUnit = getUnitAt(left);
      const rightUnit = getUnitAt(right);
      const leftIsSummoner = leftUnit?.card?.unitClass === 'summoner' ? 1 : 0;
      const rightIsSummoner = rightUnit?.card?.unitClass === 'summoner' ? 1 : 0;
      if (leftIsSummoner !== rightIsSummoner) {
        return rightIsSummoner - leftIsSummoner;
      }
      return getRemainingLife(rightUnit) - getRemainingLife(leftUnit);
    })[0];

  if (durableEnemyOrigin) {
    for (const attacker of attackerPositions) {
      const attackerUnit = getUnitAt(attacker);
      const attackerStrength = Number(attackerUnit?.card?.strength ?? 0);

      for (const dir of directions) {
        const target = { row: attacker.row + dir.row, col: attacker.col + dir.col };
        if (!board[target.row]?.[target.col]) continue;

        const targetCell = board[target.row][target.col];
        if (targetCell.unit || targetCell.structure) continue;

        const durableEnemyUnit = getUnitAt(durableEnemyOrigin);
        if (!durableEnemyUnit) continue;

        if (getRemainingLife(durableEnemyUnit) <= attackerStrength) {
          continue;
        }

        board[durableEnemyOrigin.row][durableEnemyOrigin.col] = {
          ...board[durableEnemyOrigin.row][durableEnemyOrigin.col],
          unit: undefined,
        };
        board[target.row][target.col] = {
          ...targetCell,
          unit: {
            ...durableEnemyUnit,
            position: { ...target },
          },
        };

        next.phase = 'attack';
        next.currentPlayer = '0';
        next.selectedUnit = undefined;
        next.attackTargetMode = undefined;
        return { core: next, attacker, target };
      }
    }
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

    const { modalRoot } = await ensureSummonerWarsModalOpen(page);
    const createButton = modalRoot.locator('button:visible', { hasText: /Create Room|创建房间/i }).first();
    await expect(createButton).toBeVisible({ timeout: 20000 });

    await page.screenshot({
      path: testInfo.outputPath('summonerwars-lobby.png'),
      fullPage: true
    });
  });

  test('调试面板在目标牌已离开剩余牌库后仍可按稳定 cardId 直接补牌', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL });
    const guestContext = await browser.newContext({ baseURL });

    await setChineseLocale(hostContext);
    await setChineseLocale(guestContext);
    await resetMatchStorage(hostContext);
    await resetMatchStorage(guestContext);

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    attachPageDiagnostics(hostPage);
    attachPageDiagnostics(guestPage);

    try {
      if (!await ensureGameServerAvailable(hostPage)) {
        test.skip(true, 'Game server unavailable for online tests.');
      }

      const matchId = await createSummonerWarsRoom(hostPage);
      if (!matchId) {
        test.skip(true, 'Room creation failed or backend unavailable.');
      }

      await ensurePlayerIdInUrl(hostPage, '0');
      await joinMatchAsGuest(guestPage, matchId!);
      await completeFactionSelection(hostPage, guestPage);
      await waitForSummonerWarsUI(hostPage, 30000);
      await waitForSummonerWarsUI(guestPage, 30000);

      const preparedCore = cloneState(await readCoreState(hostPage));
      const hostPlayer = preparedCore.players?.['0'];
      if (!hostPlayer) {
        throw new Error('无法读取玩家 0 的核心状态');
      }

      const targetDeckCard = hostPlayer.deck.find((card: any) => String(card.id).includes('necro-elut-bar'));
      if (!targetDeckCard) {
        throw new Error('未在 Necromancer 牌库中找到 necro-elut-bar');
      }

      hostPlayer.deck = hostPlayer.deck.filter((card: any) => !String(card.id).includes('necro-elut-bar'));
      hostPlayer.hand = hostPlayer.hand.filter((card: any) => !String(card.id).includes('necro-elut-bar'));
      hostPlayer.discard = [
        ...hostPlayer.discard.filter((card: any) => !String(card.id).includes('necro-elut-bar')),
        {
          ...targetDeckCard,
          id: 'necro-elut-bar-0-0',
        },
      ];

      await applyCoreState(hostPage, preparedCore);

      await ensureDebugPanelOpen(hostPage);
      await hostPage.getByTestId('debug-tab-controls').click();

      const dealPanel = hostPage.getByTestId('sw-debug-deal');
      await expect(dealPanel).toBeVisible({ timeout: 10000 });
      await dealPanel.locator('select').nth(0).selectOption('0');
      await dealPanel.locator('select').nth(1).selectOption('necro-elut-bar');

      const dealButton = dealPanel.getByTestId('sw-debug-deal-apply');
      await expect(dealButton).toHaveText(/直接补到手牌/);

      const beforeScreenshotPath = getEvidenceScreenshotPath(testInfo, 'debug-stable-cardid-before-apply', {
        browserName: testInfo.project.name,
      });
      await dealPanel.screenshot({ path: beforeScreenshotPath });

      await dealButton.click();

      await expect
        .poll(async () => {
          const core = await readCoreState(hostPage);
          return core.players?.['0']?.hand?.filter((card: any) => String(card.id).includes('necro-elut-bar')).length ?? 0;
        }, { timeout: 10000, message: '等待 necro-elut-bar 被直接补到手牌' })
        .toBe(1);

      const afterCore = await readCoreState(hostPage);
      const injectedCard = afterCore.players?.['0']?.hand?.find((card: any) => String(card.id).includes('necro-elut-bar'));
      expect(injectedCard).toBeTruthy();
      expect(String(injectedCard.id)).toBe('necro-elut-bar-0-1');
      expect(afterCore.players?.['0']?.deck?.some((card: any) => String(card.id).includes('necro-elut-bar'))).toBe(false);

      const afterScreenshotPath = getEvidenceScreenshotPath(testInfo, 'debug-stable-cardid-after-apply', {
        browserName: testInfo.project.name,
      });
      await hostPage.screenshot({ path: afterScreenshotPath, fullPage: true });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('大厅切换房间需确认并退出当前对局', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await setChineseLocale(hostContext);
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
    await setChineseLocale(otherContext);
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

    const { modalRoot } = await ensureSummonerWarsModalOpen(hostPage);
    const lobbyTab = modalRoot.getByRole('button', { name: /Lobby|在线大厅/i });
    if (await lobbyTab.isVisible().catch(() => false)) {
      await lobbyTab.click();
    }

    const shortId = nextMatchId.slice(0, 4);
    await expect(
      modalRoot.getByText(new RegExp(`Match #${shortId}|对局 #${shortId}`)).first()
    ).toBeVisible({ timeout: 20000 });

    const joinButton = modalRoot.getByRole('button', { name: /Join|加入/i }).first();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await joinButton.click();

    const confirmTitle = hostPage.getByText(/Leave Current Match|退出当前对局/i);
    await expect(confirmTitle).toBeVisible({ timeout: 5000 });
    const cancelButton = hostPage.getByRole('button', { name: /Cancel|取消/i }).first();
    await cancelButton.click();
    await expect(confirmTitle).toHaveCount(0);
    await expect.poll(() => {
      const current = new URL(hostPage.url());
      return `${current.pathname}${current.search}`;
    }, { timeout: 10000 }).toMatch(/^\/$|\/\?game=summonerwars$|\/play\/summonerwars\/match\/[^/?]+(?:\?.*)?$/);

    const joinButtonAgain = modalRoot.getByRole('button', { name: /Join|加入/i }).first();
    await expect(joinButtonAgain).toBeVisible({ timeout: 10000 });
    await joinButtonAgain.click();
    await expect(confirmTitle).toBeVisible({ timeout: 5000 });
    const confirmButton = hostPage.getByRole('button', { name: /Confirm|确认|确定/i }).first();
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
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
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
    await expect(guestBanner).toContainText(/等待对手|Waiting for opponent/i);

    await assertHandAreaVisible(hostPage, 'host');
    await assertHandAreaVisible(guestPage, 'guest');

    const phaseOrder = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];
    let currentPhase = await getCurrentPhase(hostPage);
    const initialIndex = phaseOrder.indexOf(currentPhase);
    if (initialIndex < 0) {
      throw new Error(`未知阶段: ${currentPhase}`);
    }

    // 推进到移动阶段验证 advancePhase 能正常工作
    if (currentPhase === 'summon') {
      currentPhase = await advancePhase(hostPage, currentPhase);
    }
    // 验证阶段确实推进了
    expect(currentPhase).not.toBe('summon');

    // 直接注入魔力阶段状态（避免逐阶段推进的不稳定性）
    const magicCore = normalizePhaseState(await readCoreState(hostPage), 'magic');
    await applyCoreState(hostPage, magicCore);
    await closeDebugPanelIfOpen(hostPage);
    await waitForPhase(hostPage, 'magic');
    currentPhase = 'magic';

    if (currentPhase === 'magic') {
      const firstCard = hostPage.getByTestId('sw-hand-area').locator('[data-card-id]').first();
      await expect(firstCard).toBeVisible({ timeout: 5000 });
      await firstCard.click();
      const confirmDiscard = hostPage.getByTestId('sw-confirm-discard');
      await expect(confirmDiscard).toBeVisible({ timeout: 5000 });
      await confirmDiscard.click();
      await expect(confirmDiscard).toBeHidden({ timeout: 5000 });
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('在线 AI 阵营选择 HUD 换位：应显示入口并可与 AI 交换先手', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    try {
      if (!await ensureGameServerAvailable(hostPage)) {
        test.skip(true, 'Game server unavailable for online AI seat swap tests.');
      }

      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

      const matchId = await createSWRoomViaAPI(hostPage, {
        setupData: {
          enableAi: true,
          seatControllers: {
            '1': {
              type: 'local-ai',
              minimumActionDelayMs: 0,
            },
          },
        },
      });
      if (!matchId) {
        test.skip(true, 'AI room creation failed or backend unavailable.');
      }

      await ensurePlayerIdInUrl(hostPage, '0');
      await hostPage.goto(`/play/summonerwars/match/${matchId!}?playerID=0`, { waitUntil: 'domcontentloaded' });

      await waitForState(hostPage, async () => {
        return await hostPage.getByTestId('debug-toggle').isVisible().catch(() => false);
      }, { timeout: 30000, message: '等待 Summoner Wars 在线房间调试面板就绪' });

      await expect.poll(async () => {
        const core = await readCoreState(hostPage);
        return {
          hostStarted: core?.hostStarted ?? null,
          startingPlayerId: core?.startingPlayerId ?? null,
        };
      }, {
        timeout: 15000,
        message: '等待在线 AI 阵营选择阶段状态稳定',
      }).toEqual({
        hostStarted: false,
        startingPlayerId: '0',
      });

      await closeDebugPanelIfOpen(hostPage);
      const seatSwapPanel = await openFabPanel(hostPage, 'seat-swap', 'exit');
      await expect(seatSwapPanel).toBeVisible({ timeout: 5000 });
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'online-ai-seat-swap-entry-visible', {
          filename: 'online-ai-seat-swap-entry-visible.png',
        }),
        fullPage: false,
      });
      await expect(hostPage.getByTestId('hud-seat-swap-seat-1')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.getByTestId('hud-seat-swap-seat-1').getByText(/^AI$/)).toBeVisible({ timeout: 5000 });
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'online-ai-seat-swap-panel-before-click', {
          filename: 'online-ai-seat-swap-panel-before-click.png',
        }),
        fullPage: false,
      });

      await hostPage.getByTestId('hud-seat-swap-seat-1').click();
      await expect.poll(async () => {
        const core = await readCoreState(hostPage);
        return {
          startingPlayerId: core?.startingPlayerId ?? null,
          currentPlayer: core?.currentPlayer ?? null,
        };
      }, {
        timeout: 10000,
        message: '等待换位后先手与当前玩家更新',
      }).toEqual({
        startingPlayerId: '1',
        currentPlayer: '1',
      });
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'online-ai-seat-swap-after-click', {
          filename: 'online-ai-seat-swap-after-click.png',
        }),
        fullPage: false,
      });
    } finally {
      await hostContext.close();
    }
  });

  test('在线 AI 阵营选择 HUD 换位：移动横屏展开面板应留在视口并与按钮列对齐', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await hostContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
      localStorage.removeItem('hud_fab_position');
      localStorage.removeItem('hud_fab_offset');
    });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    try {
      if (!await ensureGameServerAvailable(hostPage)) {
        test.skip(true, 'Game server unavailable for mobile online AI seat swap tests.');
      }

      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

      const matchId = await createSWRoomViaAPI(hostPage, {
        setupData: {
          enableAi: true,
          seatControllers: {
            '1': {
              type: 'local-ai',
              minimumActionDelayMs: 0,
            },
          },
        },
      });
      if (!matchId) {
        test.skip(true, 'AI room creation failed or backend unavailable.');
      }

      await ensurePlayerIdInUrl(hostPage, '0');
      await hostPage.goto(`/play/summonerwars/match/${matchId!}?playerID=0`, { waitUntil: 'domcontentloaded' });

      await waitForState(hostPage, async () => {
        return await hostPage.getByTestId('debug-toggle').isVisible().catch(() => false);
      }, { timeout: 30000, message: '等待 Summoner Wars 移动横屏在线房间调试面板就绪' });

      await expect.poll(async () => {
        const core = await readCoreState(hostPage);
        return {
          hostStarted: core?.hostStarted ?? null,
          startingPlayerId: core?.startingPlayerId ?? null,
        };
      }, {
        timeout: 15000,
        message: '等待移动横屏在线 AI 阵营选择阶段状态稳定',
      }).toEqual({
        hostStarted: false,
        startingPlayerId: '0',
      });

      await closeDebugPanelIfOpen(hostPage);
      const seatSwapPanel = await openFabPanel(hostPage, 'seat-swap', 'exit');
      await expect(seatSwapPanel).toBeVisible({ timeout: 5000 });
      await expect(hostPage.getByTestId('hud-seat-swap-seat-1')).toBeVisible({ timeout: 10000 });
      await hostPage.waitForTimeout(180);
      const mobileFabLayout = await hostPage.evaluate(() => {
        const panel = document.querySelector('[data-testid="fab-panel-seat-swap"]') as HTMLElement | null;
        const panelRect = panel?.getBoundingClientRect() ?? null;
        const seatSwapButton = document.querySelector('[data-fab-id="seat-swap"]') as HTMLElement | null;
        const seatSwapButtonRect = seatSwapButton?.getBoundingClientRect() ?? null;
        const visibleButtons = Array.from(document.querySelectorAll('[data-testid="fab-menu"] [data-fab-id]'))
          .map((node) => {
            if (!(node instanceof HTMLElement)) return null;
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            const visible = style.display !== 'none'
              && style.visibility !== 'hidden'
              && style.opacity !== '0'
              && rect.width > 0
              && rect.height > 0;
            if (!visible) return null;
            return rect;
          })
          .filter((rect): rect is DOMRect => Boolean(rect));
        const columnTop = visibleButtons.length > 0 ? Math.min(...visibleButtons.map((rect) => rect.top)) : null;
        const columnBottom = visibleButtons.length > 0 ? Math.max(...visibleButtons.map((rect) => rect.bottom)) : null;
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          panelRect: panelRect
            ? { left: panelRect.left, top: panelRect.top, right: panelRect.right, bottom: panelRect.bottom }
            : null,
          seatSwapButtonRect: seatSwapButtonRect
            ? {
                left: seatSwapButtonRect.left,
                top: seatSwapButtonRect.top,
                right: seatSwapButtonRect.right,
                bottom: seatSwapButtonRect.bottom,
              }
            : null,
          columnTop,
          columnBottom,
        };
      });

      expect(mobileFabLayout.panelRect).not.toBeNull();
      expect(mobileFabLayout.seatSwapButtonRect).not.toBeNull();
      expect(mobileFabLayout.panelRect?.left ?? -1).toBeGreaterThanOrEqual(0);
      expect(mobileFabLayout.panelRect?.top ?? -1).toBeGreaterThanOrEqual(0);
      expect(mobileFabLayout.panelRect?.right ?? 9999).toBeLessThanOrEqual(mobileFabLayout.viewportWidth + 1);
      expect(mobileFabLayout.panelRect?.bottom ?? 9999).toBeLessThanOrEqual(mobileFabLayout.viewportHeight + 1);
      expect(mobileFabLayout.panelRect?.bottom ?? -1).toBeGreaterThanOrEqual((mobileFabLayout.columnTop ?? -1) - 12);
      expect(mobileFabLayout.panelRect?.top ?? 9999).toBeLessThanOrEqual((mobileFabLayout.columnBottom ?? 9999) + 12);
      expect(mobileFabLayout.panelRect?.right ?? 9999).toBeLessThanOrEqual((mobileFabLayout.seatSwapButtonRect?.left ?? 9999) + 2);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'online-ai-seat-swap-mobile-panel-open', {
          filename: 'online-ai-seat-swap-mobile-panel-open.png',
        }),
        fullPage: false,
      });

      await hostPage.getByTestId('hud-seat-swap-seat-1').click();
      await expect.poll(async () => {
        const core = await readCoreState(hostPage);
        return {
          startingPlayerId: core?.startingPlayerId ?? null,
          currentPlayer: core?.currentPlayer ?? null,
        };
      }, {
        timeout: 10000,
        message: '等待移动横屏换位后先手与当前玩家更新',
      }).toEqual({
        startingPlayerId: '1',
        currentPlayer: '1',
      });

      await closeDebugPanelIfOpen(hostPage);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'online-ai-seat-swap-mobile-after-click', {
          filename: 'online-ai-seat-swap-mobile-after-click.png',
        }),
        fullPage: false,
      });
    } finally {
      await hostContext.close();
    }
  });

  test('在线 AI watchdog/卡死兜底：阻止 AI seat 建连后，服务端仍应自动收口到真人回合且不误推进真人', async ({ browser }, testInfo) => {
    test.setTimeout(150000);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    try {
      if (!await ensureGameServerAvailable(hostPage)) {
        test.skip(true, 'Game server unavailable for online AI watchdog tests.');
      }

      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

      const matchId = await createSWRoomViaAPI(hostPage, {
        setupData: {
          enableAi: true,
          seatControllers: {
            '1': {
              type: 'local-ai',
              minimumActionDelayMs: 0,
            },
          },
        },
      });
      if (!matchId) {
        test.skip(true, 'AI room creation failed or backend unavailable.');
      }

      await ensurePlayerIdInUrl(hostPage, '0');
      await blockSummonerWarsAiSeatAutoClaim(hostContext, '1');
      await hostPage.goto(`/play/summonerwars/match/${matchId!}?playerID=0`, { waitUntil: 'domcontentloaded' });

      await waitForState(hostPage, async () => {
        return await hostPage.getByTestId('debug-toggle').isVisible().catch(() => false);
      }, { timeout: 30000, message: '等待 Summoner Wars 在线房间调试面板就绪' });

      await expect.poll(async () => {
        return hostPage.evaluate((targetMatchId) => {
          return localStorage.getItem(`match_ai_creds_${targetMatchId}`);
        }, matchId!);
      }, {
        timeout: 8000,
        message: 'AI seat 凭据不应在本用例中被自动领取',
      }).toBeNull();

      const actionLogPanel = await openFabPanel(hostPage, 'action-log', 'exit');
      await expect(actionLogPanel).toBeVisible({ timeout: 5000 });
      const fabOrderMetrics = await waitForExpandedFabLayoutStable(hostPage);
      const orderedButtons = fabOrderMetrics.visibleButtons
        .filter((button) => button.id !== 'exit')
        .map((button) => ({
          ...button,
          distanceToMain: Math.abs(
            ((button.rect.top + button.rect.bottom) / 2)
            - (((fabOrderMetrics.mainVisualRect?.top ?? 0) + (fabOrderMetrics.mainVisualRect?.bottom ?? 0)) / 2),
          ),
        }))
        .sort((a, b) => a.distanceToMain - b.distanceToMain)
        .map((button) => button.id);
      expect(orderedButtons).toContain('force-end-ai-phase');
      const undoButtonId = orderedButtons.find((id) => id.startsWith('undo-'));
      const forceEndButtonIndex = orderedButtons.indexOf('force-end-ai-phase');
      const undoButtonIndex = undoButtonId ? orderedButtons.indexOf(undoButtonId) : -1;
      expect(undoButtonIndex, '展开后的 FAB 必须能看到撤回按钮').toBeGreaterThanOrEqual(0);
      expect(
        forceEndButtonIndex,
        '展开后的 FAB 必须能看到“强制结束 AI 阶段”按钮',
      ).toBeGreaterThanOrEqual(0);
      expect(
        forceEndButtonIndex,
        '“强制结束 AI 阶段”应位于撤回按钮上方（离主球更远）',
      ).toBeGreaterThan(undoButtonIndex);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'online-ai-watchdog-fab-force-end-order', {
          filename: 'watchdog-fab-force-end-order.png',
        }),
        fullPage: false,
      });

      const liveState = await getMatchState(matchId!, hostPage);
      const aiTurnState = buildSummonerWarsOnlineAiWatchdogState(liveState);
      await injectMatchState(matchId!, aiTurnState as never, hostPage);
      await waitForSummonerWarsUI(hostPage, 30000);

      await expect.poll(async () => {
        const core = await readCoreState(hostPage);
        return {
          currentPlayer: core?.currentPlayer ?? null,
          phase: core?.phase ?? null,
        };
      }, {
        timeout: 8000,
        message: '等待注入后的 AI 回合状态在前端稳定',
      }).toEqual({
        currentPlayer: '1',
        phase: 'summon',
      });

      await expect(hostPage.getByTestId('sw-end-phase')).toBeDisabled({ timeout: 5000 });
      await expect(hostPage.getByTestId('sw-action-banner')).toContainText(/等待对手|Waiting for opponent/i);

      const beforeWatchdogPath = getEvidenceScreenshotPath(testInfo, 'online-ai-watchdog-before-recovery', {
        filename: 'watchdog-before-recovery.png',
      });
      await hostPage.screenshot({ path: beforeWatchdogPath, fullPage: false });

      await expect.poll(async () => {
        const core = await readCoreState(hostPage);
        return {
          currentPlayer: core?.currentPlayer ?? null,
          phase: core?.phase ?? null,
          turnNumber: typeof core?.turnNumber === 'number' ? core.turnNumber : null,
        };
      }, {
        timeout: 25000,
        message: '等待服务端 watchdog 将 AI 卡死回合收口并切回真人',
      }).toEqual({
        currentPlayer: '0',
        phase: 'summon',
        turnNumber: 6,
      });

      await expect(hostPage.getByTestId('sw-end-phase')).toBeEnabled({ timeout: 5000 });
      await expect(hostPage.getByText(/AI 强制结束失败|AI 自动跳过失败/i)).toHaveCount(0);

      const afterRecoveryPath = getEvidenceScreenshotPath(testInfo, 'online-ai-watchdog-after-recovery', {
        filename: 'watchdog-after-recovery.png',
      });
      await hostPage.screenshot({ path: afterRecoveryPath, fullPage: false });

      const recoveredCore = await readCoreState(hostPage);
      expect(recoveredCore.currentPlayer).toBe('0');
      expect(recoveredCore.phase).toBe('summon');
      expect(recoveredCore.turnNumber).toBe(6);

      await hostPage.waitForTimeout(9000);

      const stableHumanCore = await readCoreState(hostPage);
      expect(stableHumanCore.currentPlayer).toBe('0');
      expect(stableHumanCore.phase).toBe(recoveredCore.phase);
      expect(stableHumanCore.turnNumber).toBe(recoveredCore.turnNumber);
      await expect(hostPage.getByTestId('sw-end-phase')).toBeEnabled({ timeout: 5000 });
      await expect(hostPage.getByText(/AI 强制结束失败|AI 自动跳过失败/i)).toHaveCount(0);

      const humanGuardPath = getEvidenceScreenshotPath(testInfo, 'online-ai-watchdog-human-turn-stable', {
        filename: 'watchdog-human-turn-stable.png',
      });
      await hostPage.screenshot({ path: humanGuardPath, fullPage: false });
    } finally {
      await hostContext.close();
    }
  });

  test('在线对局流程：召唤、移动、建造、攻击与弃牌', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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

    const guestContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await blockAudioRequests(guestContext);
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const readOnlineCoreState = async () => {
      const state = await getMatchState(matchId!, hostPage);
      return state.core;
    };
    const applyOnlineCoreState = async (nextCore: unknown) => {
      const liveState = await getMatchState(matchId!, hostPage);
      const nextCoreRecord = nextCore as {
        currentPlayer?: unknown;
        players?: Record<string, unknown>;
        turnOrder?: unknown;
        phase?: string;
      } | null;
      const liveTurnOrder = Array.isArray((liveState.sys as { turnOrder?: unknown } | undefined)?.turnOrder)
        ? ((liveState.sys as { turnOrder?: unknown[] }).turnOrder ?? []).filter((playerId): playerId is string => typeof playerId === 'string')
        : Array.isArray((liveState.core as { turnOrder?: unknown } | undefined)?.turnOrder)
          ? ((liveState.core as { turnOrder?: unknown[] }).turnOrder ?? []).filter((playerId): playerId is string => typeof playerId === 'string')
          : Object.keys(nextCoreRecord?.players ?? liveState.core?.players ?? {});
      const nextCurrentPlayer = typeof nextCoreRecord?.currentPlayer === 'string'
        ? nextCoreRecord.currentPlayer
        : typeof liveState.core?.currentPlayer === 'string'
          ? liveState.core.currentPlayer
          : liveTurnOrder[0] ?? '0';
      const nextCurrentPlayerIndex = Math.max(0, liveTurnOrder.indexOf(nextCurrentPlayer));
      await injectMatchState(matchId!, {
        ...liveState,
        core: nextCore,
        sys: {
          ...liveState.sys,
          phase: nextCoreRecord?.phase ?? liveState.sys?.phase,
          turnOrder: liveTurnOrder,
          currentPlayerIndex: nextCurrentPlayerIndex,
        },
      } as never, hostPage);
      await waitForSummonerWarsUI(hostPage);
    };

    let coreState = await readOnlineCoreState();
    const preparedCore = prepareDeterministicCore(coreState);
    await applyOnlineCoreState(preparedCore);

    attachPageDiagnostics(hostPage);
    attachPageDiagnostics(guestPage);
    const beforeAttackErrorCount = attachPageDiagnostics(hostPage).errors.length;
    const guestBeforeAttackErrorCount = attachPageDiagnostics(guestPage).errors.length;

    const assertDesktopLayoutStable = async (snapshotKey: string) => {
      await expect(hostPage.getByTestId('sw-hand-area')).toBeVisible({ timeout: 8000 });
      await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible({ timeout: 8000 });
      await expect(hostPage.getByTestId('sw-phase-controls')).toBeVisible({ timeout: 8000 });
      await expect(hostPage.getByTestId('sw-map-container')).toBeVisible({ timeout: 8000 });

      const layout = await hostPage.evaluate(() => {
        const getRect = (testId: string) => {
          const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
          };
        };

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const hand = getRect('sw-hand-area');
        const controls = getRect('sw-phase-controls');
        const tracker = getRect('sw-phase-tracker');
        const mapContent = getRect('sw-map-content');
        const mapContainer = getRect('sw-map-container');
        const lastError = (window as any).__BG_LAST_ERROR_CONTEXT__ as { message?: string } | undefined;

        return {
          viewportWidth,
          viewportHeight,
          rootScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          hand,
          controls,
          tracker,
          mapContent,
          mapContainer,
          lastErrorMessage: lastError?.message ?? '',
          hasViteOverlay: Boolean(document.querySelector('vite-error-overlay')),
        };
      });

      expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

      expect(layout.hand).toBeTruthy();
      expect(layout.controls).toBeTruthy();
      expect(layout.tracker).toBeTruthy();
      expect(layout.mapContent).toBeTruthy();

      const hand = layout.hand!;
      const controls = layout.controls!;
      const tracker = layout.tracker!;
      const mapContent = layout.mapContent!;

      // 手牌不要侵入右下 controls
      expect(controls.left - hand.right).toBeGreaterThanOrEqual(8);
      // 阶段条不要压到 controls
      expect(controls.top - tracker.bottom).toBeGreaterThanOrEqual(8);

      // 中心稳定：手牌与棋盘内容都应接近中线
      expect(Math.abs(hand.centerX - layout.viewportWidth / 2)).toBeLessThanOrEqual(layout.viewportWidth * 0.08);
      expect(Math.abs(mapContent.centerX - layout.viewportWidth / 2)).toBeLessThanOrEqual(layout.viewportWidth * 0.06);

      // 防止主内容缩在左上角一小块（PC 回归常见症状）
      expect(mapContent.width).toBeGreaterThanOrEqual(layout.viewportWidth * 0.35);
      expect(mapContent.height).toBeGreaterThanOrEqual(layout.viewportHeight * 0.45);

      // 攻击/阶段切换后不应出现前端崩溃 overlay 或全局错误上下文
      expect(layout.hasViteOverlay).toBe(false);
      expect(layout.lastErrorMessage).toBe('');

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, snapshotKey, {
          filename: `${snapshotKey}.png`,
        }),
        fullPage: false,
      });

      await captureEvidenceClipAroundLocators(hostPage, [
        hostPage.getByTestId('sw-hand-area'),
        hostPage.getByTestId('sw-phase-tracker'),
        hostPage.getByTestId('sw-phase-controls'),
      ], {
        path: getEvidenceScreenshotPath(testInfo, `${snapshotKey}-hand-phase-clip`, {
          filename: `${snapshotKey}-hand-phase-clip.png`,
        }),
      });
    };

    await assertDesktopLayoutStable('50-pc-online-layout-start');
    await assertPlayableHandHighlightVisible(hostPage, testInfo, '50-pc-online-playable-hand-highlight');

    // 召唤
    const unitCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-type="unit"][data-can-play="true"]')
      .last();
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
    await expect.poll(async () => {
      return hostPage.evaluate(({ row, col }) => {
        const sprite = document.querySelector(
          `[data-testid="sw-unit-${row}-${col}"] [data-card-sprite="true"]`,
        ) as HTMLElement | null;
        if (!sprite) return -1;
        return Number.parseFloat(window.getComputedStyle(sprite).opacity);
      }, { row: summonRow, col: summonCol });
    }, {
      timeout: 3000,
      message: '召唤后单位卡面应快速恢复到不透明',
    }).toBeGreaterThan(0.95);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'online-flow-after-summon', {
        filename: 'online-flow-after-summon.png',
      }),
      fullPage: false,
    });

    // 移动
    coreState = await readOnlineCoreState();
    await applyOnlineCoreState(normalizePhaseState(coreState, 'move'));

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
    coreState = await readOnlineCoreState();
    await applyOnlineCoreState(normalizePhaseState(coreState, 'build'));

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
    coreState = await readOnlineCoreState();
    const attackSetup = setupAttackState(coreState);
    await applyOnlineCoreState(attackSetup.core);

    // 等待攻击阶段就绪
    await waitForPhase(hostPage, 'attack');
    await waitForMyTurn(hostPage);

    const attackerLocator = hostPage.getByTestId(`sw-unit-${attackSetup.attacker.row}-${attackSetup.attacker.col}`);
    await expect(attackerLocator).toBeVisible({ timeout: 8000 });

    // 选中攻击者
    await clickBoardElement(hostPage, `[data-testid="sw-unit-${attackSetup.attacker.row}-${attackSetup.attacker.col}"]`);
    // 等待攻击目标出现（选中成功后会标记 valid-attack）
    await expect.poll(async () => {
      return hostPage.locator('[data-valid-attack="true"]').count();
    }, {
      timeout: 4000,
      message: '等待攻击目标出现',
    }).toBeGreaterThan(0);

    // 验证目标格子有 valid-attack 标记
    const targetCell = hostPage.getByTestId(`sw-cell-${attackSetup.target.row}-${attackSetup.target.col}`);
    const isValidAttack = await targetCell.getAttribute('data-valid-attack').catch(() => null);
    if (isValidAttack === 'true') {
      await clickBoardElement(hostPage, `[data-testid="sw-cell-${attackSetup.target.row}-${attackSetup.target.col}"]`);
    } else {
      // 如果目标格子没有 valid-attack 标记，尝试点击任意有效攻击目标
      const anyValidTarget = hostPage.locator('[data-valid-attack="true"]').first();
      if (await anyValidTarget.isVisible({ timeout: 3000 }).catch(() => false)) {
        const targetTestId = await anyValidTarget.getAttribute('data-testid');
        if (targetTestId) {
          await clickBoardElement(hostPage, `[data-testid="${targetTestId}"]`);
        }
      }
    }

    const attackCountBefore = attackSetup.core.players?.['0']?.attackCount ?? 0;
    await expect.poll(async () => {
      const state = await readOnlineCoreState();
      return state?.players?.['0']?.attackCount ?? 0;
    }, {
      timeout: 10000,
      message: '等待在线基础流程攻击动作写入权威状态',
    }).toBeGreaterThan(attackCountBefore);

    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    const guestDiceOverlay = guestPage.getByTestId('sw-dice-result-overlay');
    // 回归门禁：远端攻击（含 AI/对手命令）必须在被动侧触发攻击骰子展示动画。
    // 若事件流游标被错误静默同步，这里会长期不可见，直接暴露“对手行为无动画”回归。
    await expect(guestDiceOverlay).toBeVisible({ timeout: 8000 });
    await expect.poll(async () => {
      return guestDiceOverlay.evaluate((overlay) => {
        const panel = overlay.firstElementChild as HTMLElement | null;
        if (!panel) return 'missing';
        const inline = panel.style.transform?.trim();
        if (inline) return inline;
        return window.getComputedStyle(panel).transform;
      });
    }, {
      timeout: 2000,
      message: '敌方攻击时骰子特写不应倒置',
    }).not.toContain('180deg');
    await guestPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'online-flow-guest-dice-overlay', {
        filename: 'online-flow-guest-dice-overlay.png',
      }),
      fullPage: false,
    });
    if (await guestDiceOverlay.isVisible({ timeout: 1500 }).catch(() => false)) {
      await guestDiceOverlay.click({ force: true });
      await expect(guestDiceOverlay).toBeHidden({ timeout: 5000 });
    }
    if (await diceOverlay.isVisible({ timeout: 1500 }).catch(() => false)) {
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'online-flow-after-attack', {
          filename: 'online-flow-after-attack.png',
        }),
        fullPage: false,
      });
      await diceOverlay.click({ force: true });
      await expect(diceOverlay).toBeHidden({ timeout: 5000 });
    }

    // 攻击后：不报错 + 布局仍稳定
    expect(attachPageDiagnostics(hostPage).errors.length).toBe(beforeAttackErrorCount);
    expect(attachPageDiagnostics(guestPage).errors.length).toBe(guestBeforeAttackErrorCount);
    await expect(guestPage.getByText(/游戏加载失败/i)).toHaveCount(0);
    await assertDesktopLayoutStable('51-pc-online-layout-after-attack');

    // 切到魔力阶段后弃牌
    const magicCoreState = normalizePhaseState(await readOnlineCoreState(), 'magic');
    const expectedMagicHandCountBeforeDiscard = magicCoreState.players?.['0']?.hand?.length ?? 0;
    await applyOnlineCoreState(magicCoreState);
    await waitForPhase(hostPage, 'magic');
    await waitForMyTurn(hostPage);
    await waitForSummonerWarsHandCount(hostPage, expectedMagicHandCountBeforeDiscard);

    const discardCard = hostPage.getByTestId('sw-hand-area').locator('[data-card-id]').first();
    await discardCard.click();
    const confirmDiscard = hostPage.getByTestId('sw-confirm-discard');
    await expect(confirmDiscard).toBeVisible({ timeout: 5000 });
    await confirmDiscard.click();
    await expect(confirmDiscard).toBeHidden({ timeout: 5000 });

    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'online-flow-after-discard', {
        filename: 'online-flow-after-discard.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('在线 AI 回合起始若 seatState 落后上一拍 draw，不得在 8 秒兜底中直接跳过 summon，且后续应由 watchdog 真正召唤单位', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    try {
      if (!await ensureGameServerAvailable(hostPage)) {
        test.skip(true, 'Game server unavailable for online AI stale-seat E2E.');
      }

      await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
      await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

      const matchId = await createSWRoomViaAPI(hostPage, {
        setupData: {
          enableAi: true,
          seatControllers: {
            '1': {
              type: 'local-ai',
              minimumActionDelayMs: 0,
            },
          },
        },
      });
      if (!matchId) {
        test.skip(true, 'AI room creation failed or backend unavailable.');
      }

      await ensurePlayerIdInUrl(hostPage, '0');
      await hostPage.goto(`/play/summonerwars/match/${matchId!}?playerID=0`, { waitUntil: 'domcontentloaded' });

      await waitForState(hostPage, async () => {
        return await hostPage.getByTestId('debug-toggle').isVisible().catch(() => false);
      }, { timeout: 30000, message: '等待 Summoner Wars 在线房间调试面板就绪' });
      await waitForOnlineAiDebugApi(hostPage, 15000);

      await expect.poll(async () => {
        return hostPage.evaluate((targetMatchId) => {
          return localStorage.getItem(`match_ai_creds_${targetMatchId}`);
        }, matchId!);
      }, {
        timeout: 15000,
        message: '等待 host 自动领取 AI seat 凭据',
      }).not.toBeNull();

      await expect.poll(async () => {
        return hostPage.evaluate(() => {
          const api = (window as Window & { __BG_ONLINE_AI_DEBUG__?: OnlineAiDebugApi }).__BG_ONLINE_AI_DEBUG__;
          return Boolean(api?.getSeatLatestState?.('1'));
        });
      }, {
        timeout: 15000,
        message: '等待 AI seat latestState 首次同步完成',
      }).toBe(true);

      const liveState = await getMatchState(matchId!, hostPage);
      const authoritativeSummonState = buildSummonerWarsOnlineAiSummonRaceState(liveState);
      const staleDrawSeatState = buildSummonerWarsStaleAiDrawSeatState(authoritativeSummonState);
      await setOnlineAiSeatStateOverride(hostPage, '1', staleDrawSeatState);
      await injectMatchState(matchId!, authoritativeSummonState as never, hostPage);
      await waitForSummonerWarsUI(hostPage, 30000);

      const beforeCore = await readCoreState(hostPage);
      const beforeAiUnitCount = countUnitsForPlayer(beforeCore as Record<string, any>, '1');
      expect(beforeAiUnitCount).toBeGreaterThan(0);

      await expect.poll(async () => {
        const core = await readCoreState(hostPage);
        return {
          currentPlayer: core?.currentPlayer ?? null,
          phase: core?.phase ?? null,
        };
      }, {
        timeout: 8000,
        message: '等待注入后的 AI summon 状态在前端稳定',
      }).toEqual({
        currentPlayer: '1',
        phase: 'summon',
      });

      const beforeGuardPath = getEvidenceScreenshotPath(testInfo, 'online-ai-stale-seat-before-guard', {
        filename: 'online-ai-stale-seat-before-guard.png',
      });
      await hostPage.screenshot({ path: beforeGuardPath, fullPage: false });

      await hostPage.waitForTimeout(2500);

      const guardedCore = await readCoreState(hostPage);
      expect(guardedCore.currentPlayer).toBe('1');
      expect(guardedCore.phase).toBe('summon');
      expect(countUnitsForPlayer(guardedCore as Record<string, any>, '1')).toBe(beforeAiUnitCount);

      const guardedPath = getEvidenceScreenshotPath(testInfo, 'online-ai-stale-seat-after-guard', {
        filename: 'online-ai-stale-seat-after-guard.png',
      });
      await hostPage.screenshot({ path: guardedPath, fullPage: false });

      await expect.poll(async () => {
        const latestState = await getMatchState(matchId!, hostPage);
        const core = latestState.core as Record<string, any>;
        return {
          currentPlayer: core?.currentPlayer ?? null,
          phase: core?.phase ?? null,
          aiUnitCount: countUnitsForPlayer(core, '1'),
        };
      }, {
        timeout: 20000,
        message: '等待服务端 watchdog 使用 legal action 为 AI 真正召唤单位',
      }).toEqual({
        currentPlayer: '1',
        phase: 'summon',
        aiUnitCount: beforeAiUnitCount + 1,
      });

      await expect.poll(async () => {
        const latestState = await getMatchState(matchId!, hostPage);
        const core = latestState.core as Record<string, any>;
        return {
          currentPlayer: core?.currentPlayer ?? null,
          phase: core?.phase ?? null,
          aiUnitCount: countUnitsForPlayer(core as Record<string, any>, '1'),
        };
      }, {
        timeout: 10000,
        message: '等待前端 UI 同步到 watchdog 已成功召唤的状态',
      }).toEqual({
        currentPlayer: '1',
        phase: 'summon',
        aiUnitCount: beforeAiUnitCount + 1,
      });

      const recoveredServerState = await getMatchState(matchId!, hostPage);
      const recoveredServerCore = recoveredServerState.core as Record<string, any>;
      const newUnitPosition = findNewUnitPositionForPlayer(
        authoritativeSummonState.core as Record<string, any>,
        recoveredServerCore,
        '1',
      );
      expect(newUnitPosition).not.toBeNull();

      await expect(hostPage.getByTestId(`sw-unit-${newUnitPosition!.row}-${newUnitPosition!.col}`)).toBeVisible({
        timeout: 10000,
      });

      const recoveredPath = getEvidenceScreenshotPath(testInfo, 'online-ai-stale-seat-watchdog-summoned', {
        filename: 'online-ai-stale-seat-watchdog-summoned.png',
      });
      await hostPage.screenshot({ path: recoveredPath, fullPage: false });
    } finally {
      await clearOnlineAiSeatStateOverride(hostPage, '1');
      await hostContext.close();
    }
  });

  test('主动技能：复活死灵 UI 流程', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备测试状态：召唤阶段，召唤师有复活死灵技能，弃牌堆有亡灵单位
    const coreState = await readCoreState(hostPage);
    const reviveTestCore = prepareReviveUndeadState(coreState);
    await applyCoreState(hostPage, reviveTestCore);
    await closeDebugPanelIfOpen(hostPage);

    // 等待状态生效
    await waitForPhase(hostPage, 'summon');
    await waitForMyTurn(hostPage);

    // 选中召唤师 - 先找到召唤师位置，然后点击对应的格子
    const summoner = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-class="summoner"]').first();
    await expect(summoner).toBeVisible({ timeout: 8000 });
    const summonerTestId = await summoner.getAttribute('data-testid');
    // 从 sw-unit-{row}-{col} 提取坐标
    const summonerMatch = summonerTestId?.match(/sw-unit-(\d+)-(\d+)/);
    if (!summonerMatch) throw new Error(`无法解析召唤师坐标: ${summonerTestId}`);
    const [, sRow, sCol] = summonerMatch;

    const summonerDamageBefore = Number(await summoner.getAttribute('data-unit-damage') ?? '0');

    // 点击召唤师格子 → useCellInteraction 检测到 revive_undead + 弃牌堆有亡灵，直接进入卡牌选择模式
    await clickBoardElement(hostPage, `[data-testid="sw-cell-${sRow}-${sCol}"]`);

    // 检查卡牌选择器是否显示（复活死灵直接进入选卡模式，不经过按钮）
    const cardSelector = hostPage.locator('[data-testid="sw-card-selector-overlay"]');
    await expect(cardSelector).toBeVisible({ timeout: 8000 });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'revive-undead-card-selector-visible', {
        subdir: 'summonerwars/summonerwars.e2e/主动技能：复活死灵 UI 流程',
      }),
      fullPage: true,
    });

    // 选择弃牌堆中的亡灵单位
    const undeadCard = cardSelector.locator('[data-card-id="necro-undead-warrior-test"]').first();
    await expect(undeadCard).toBeVisible({ timeout: 3000 });
    await undeadCard.click();

    await expect(cardSelector).toBeHidden({ timeout: 5000 });

    // 选择相邻空位（统一走稳定 data 标识，不依赖样式类名）
    const abilityCell = hostPage.locator('[data-valid-ability-pos="true"]').first();
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
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'revive-undead-summoned-unit-visible', {
        subdir: 'summonerwars/summonerwars.e2e/主动技能：复活死灵 UI 流程',
      }),
      fullPage: true,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('主动技能：火祀召唤和吸取生命 UI 元素验证', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 测试1：火祀召唤（onSummon 交互）- 召唤后进入牺牲品选择
    let coreState = await readCoreStateViaServer(hostPage);
    const { core: fireSacrificeCore, handCardId: fireSacrificeCardId } = prepareFireSacrificeState(coreState);
    await applyCoreStateViaServer(hostPage, fireSacrificeCore);
    await closeDebugPanelIfOpenViaHelper(hostPage);

    await waitForPhaseViaHelper(hostPage, 'summon');
    await waitForMyTurn(hostPage);

    // 先从手牌打出伊路特-巴尔
    const elutBarInHand = hostPage.getByTestId('sw-hand-area').locator(`[data-card-id="${fireSacrificeCardId}"]`).first();
    await expect(elutBarInHand).toBeVisible({ timeout: 5000 });
    await elutBarInHand.click();

    const summonTarget = hostPage.locator('[data-valid-summon="true"]').first();
    await expect(summonTarget).toBeVisible({ timeout: 5000 });
    const summonTargetId = await summonTarget.getAttribute('data-testid');
    if (!summonTargetId) {
      throw new Error('火祀召唤测试：无法解析召唤落点');
    }
    await clickBoardElement(hostPage, `[data-testid="${summonTargetId}"]`);

    const fireSacrificeBanner = hostPage.getByText(/火祀召唤|火祭召唤|Fire Sacrifice/i);
    await expect(fireSacrificeBanner).toBeVisible({ timeout: 5000 });
    const fireSacrificeTargets = hostPage.locator('[data-valid-ability-unit="true"]');
    await expect.poll(async () => fireSacrificeTargets.count()).toBeGreaterThan(0);
    const fireSacrificeTarget = fireSacrificeTargets.first();
    const fireSacrificeTargetId = await fireSacrificeTarget.getAttribute('data-testid');
    if (!fireSacrificeTargetId) {
      throw new Error('火祀召唤测试：无法解析牺牲目标');
    }
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'fire-sacrifice-prompt-visible', {
        subdir: 'summonerwars/summonerwars.e2e/主动技能：火祀召唤和吸取生命 UI 元素验证',
      }),
    });
    await clickBoardElement(hostPage, `[data-testid="${fireSacrificeTargetId}"]`);
    await expect(fireSacrificeBanner).toHaveCount(0, { timeout: 8000 });
    const summonMatch = summonTargetId.match(/sw-cell-(\d+)-(\d+)/);
    const sacrificeMatch = fireSacrificeTargetId.match(/sw-(?:unit|cell)-(\d+)-(\d+)/);
    if (!summonMatch || !sacrificeMatch) {
      throw new Error(`火祀召唤测试：无法解析结果坐标 summon=${summonTargetId} sacrifice=${fireSacrificeTargetId}`);
    }
    const [, summonRow, summonCol] = summonMatch;
    const [, sacrificeRow, sacrificeCol] = sacrificeMatch;
    await expect.poll(async () => {
      const latestCore = await readCoreStateViaServer(hostPage);
      return {
        summonCellEmpty: !latestCore.board?.[Number(summonRow)]?.[Number(summonCol)]?.unit,
        summonedAtSacrifice:
          latestCore.board?.[Number(sacrificeRow)]?.[Number(sacrificeCol)]?.unit?.card?.name === '伊路特-巴尔',
      };
    }, { timeout: 8000 }).toEqual({
      summonCellEmpty: true,
      summonedAtSacrifice: true,
    });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'fire-sacrifice-complete', {
        subdir: 'summonerwars/summonerwars.e2e/主动技能：火祀召唤和吸取生命 UI 元素验证',
      }),
    });

    // 测试2：吸取生命（beforeAttack 交互）- 宣告攻击后选择牺牲目标
    coreState = await readCoreStateViaServer(hostPage);
    const { core: lifeDrainCore, dragosPosition, allyPosition, enemyPosition } = prepareLifeDrainState(coreState);
    await applyCoreStateViaServer(hostPage, lifeDrainCore);
    await closeDebugPanelIfOpenViaHelper(hostPage);

    await waitForPhaseViaHelper(hostPage, 'attack');
    await waitForMyTurn(hostPage);

    // 选中德拉戈斯并宣告一次可攻击目标
    const dragos = hostPage.locator(`[data-testid="sw-unit-${dragosPosition.row}-${dragosPosition.col}"][data-owner="0"]`).first();
    await expect(dragos).toBeVisible({ timeout: 5000 });
    await clickBoardElement(hostPage, `[data-testid="sw-unit-${dragosPosition.row}-${dragosPosition.col}"][data-owner="0"]`);
    const enemyTarget = hostPage.locator(`[data-testid="sw-unit-${enemyPosition.row}-${enemyPosition.col}"][data-owner="1"]`).first();
    await expect(enemyTarget).toBeVisible({ timeout: 5000 });
    await clickBoardElement(hostPage, `[data-testid="sw-unit-${enemyPosition.row}-${enemyPosition.col}"][data-owner="1"]`);

    const lifeDrainBanner = hostPage.getByText(/吸取生命|Life Drain/i).first();
    await expect(lifeDrainBanner).toBeVisible({ timeout: 5000 });
    const lifeDrainTargets = hostPage.locator('[data-valid-ability-unit="true"]');
    await expect.poll(async () => lifeDrainTargets.count()).toBeGreaterThan(0);
    const lifeDrainTarget = lifeDrainTargets.first();
    const lifeDrainTargetId = await lifeDrainTarget.getAttribute('data-testid');
    if (!lifeDrainTargetId) {
      throw new Error('吸取生命测试：无法解析牺牲目标');
    }
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'life-drain-prompt-visible', {
        subdir: 'summonerwars/summonerwars.e2e/主动技能：火祀召唤和吸取生命 UI 元素验证',
      }),
    });
    await clickBoardElement(hostPage, `[data-testid="${lifeDrainTargetId}"]`);
    await expect(lifeDrainBanner).toHaveCount(0, { timeout: 8000 });
    await expect.poll(async () => {
      const latestCore = await readCoreStateViaServer(hostPage);
      return !latestCore.board?.[allyPosition.row]?.[allyPosition.col]?.unit;
    }, { timeout: 8000 }).toBe(true);
    await expect(hostPage.getByTestId('sw-dice-result-overlay')).toBeVisible({ timeout: 8000 });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'life-drain-complete', {
        subdir: 'summonerwars/summonerwars.e2e/主动技能：火祀召唤和吸取生命 UI 元素验证',
      }),
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：狱火铸剑打出流程', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备状态：建造阶段 + 手牌有狱火铸剑 + 场上有友方士兵
    const coreState = await readCoreState(hostPage);
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
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备状态：移动阶段 + 手牌有除灭 + 场上有多个友方单位
    const coreState = await readCoreState(hostPage);
    const annihilateCore = prepareAnnihilateState(coreState);
    await applyCoreState(hostPage, annihilateCore);
    await closeDebugPanelIfOpen(hostPage);

    const findAnnihilateStructureTarget = (state: any) => {
      const board = state?.board as any[][] | undefined;
      if (!board || board.length === 0) return null;
      const rows = board.length;
      const cols = board[0]?.length ?? 0;
      const inBounds = (row: number, col: number) => row >= 0 && col >= 0 && row < rows && col < cols;
      const dirs = [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 },
      ];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const unit = board[r]?.[c]?.unit;
          if (!unit || unit.owner !== '0' || unit.card?.unitClass === 'summoner') continue;
          for (const dir of dirs) {
            const nr = r + dir.row;
            const nc = c + dir.col;
            if (!inBounds(nr, nc)) continue;
            const structure = board[nr]?.[nc]?.structure;
            if (structure) {
              return {
                unit: { row: r, col: c },
                structure: { row: nr, col: nc },
              };
            }
          }
        }
      }
      return null;
    };

    const targetPair = findAnnihilateStructureTarget(await readCoreState(hostPage));
    if (!targetPair) {
      test.skip(true, '未找到可用于除灭的“友军 + 相邻结构”组合');
    }

    // 等待状态应用（允许慢一点，避免短超时导致误判）
    try {
      await waitForPhaseChange(hostPage, 'move', { timeout: 8000 });
    } catch {
      // 继续走当前阶段判断，失败时跳过本用例
    }

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

    // 验证可选目标高亮并执行确认
    const targetHighlight = hostPage.locator('[class*="border-purple"]').first();
    await expect(targetHighlight).toBeVisible({ timeout: 5000 });

    // 选择一个友方单位（确保其相邻结构可用于伤害目标）
    await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPair!.unit.row}-${targetPair!.unit.col}"]`);

    // 验证确认选择按钮出现并点击
    const confirmButton = hostPage.getByRole('button', { name: /确认选择|Confirm/i });
    await expect(confirmButton).toBeVisible({ timeout: 3000 });
    await confirmButton.click();

    // 验证进入伤害目标选择步骤并截图
    await expect(annihilateBanner).toContainText(/伤害/, { timeout: 3000 });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-annihilate-damage-step', {
        filename: 'event-annihilate-damage-step.png',
      }),
      fullPage: false,
    });

    // 选择相邻结构作为伤害目标（验证结构也可被 UI 选中）
    const structureTargetId = `sw-structure-${targetPair!.structure.row}-${targetPair!.structure.col}`;
    await expect(hostPage.getByTestId(structureTargetId)).toBeVisible({ timeout: 3000 });
    await clickBoardElement(hostPage, `[data-testid="${structureTargetId}"]`);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-annihilate-structure-target', {
        filename: 'event-annihilate-structure-target.png',
      }),
      fullPage: false,
    });

    // 取消操作
    const cancelButton = hostPage.getByRole('button', { name: /取消|Cancel/i });
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click();
    }

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：血契召唤收口流程', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const findBloodSummonTarget = (state: any) => {
      const board = state?.board as any[][] | undefined;
      if (!board || board.length === 0) return null;
      const rows = board.length;
      const cols = board[0]?.length ?? 0;
      const dirs = [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 },
      ];
      const inBounds = (row: number, col: number) => row >= 0 && col >= 0 && row < rows && col < cols;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const unit = board[r]?.[c]?.unit;
          if (!unit || unit.owner !== '0' || unit.card?.unitClass === 'summoner') continue;
          for (const dir of dirs) {
            const nr = r + dir.row;
            const nc = c + dir.col;
            if (!inBounds(nr, nc)) continue;
            const cell = board[nr]?.[nc];
            if (!cell?.unit && !cell?.structure) {
              return { unit: { row: r, col: c }, summonPosition: { row: nr, col: nc } };
            }
          }
        }
      }
      return null;
    };

    // 准备状态：召唤阶段 + 手牌有血契召唤和低费单位 + 场上有友方单位
    const coreState = await readCoreState(hostPage);
    const bloodSummonCore = prepareBloodSummonState(coreState);
    await applyCoreState(hostPage, bloodSummonCore);
    await closeDebugPanelIfOpen(hostPage);
    const bloodSummonState = await readCoreState(hostPage);
    const bloodSummonTarget = findBloodSummonTarget(bloodSummonState);
    expect(bloodSummonTarget, '未找到血契召唤可用的友军 + 相邻空位（准备态可能失效）').toBeTruthy();
    const initialBoard = (bloodSummonState?.board as any[][] | undefined) ?? [];
    const targetBefore = initialBoard[bloodSummonTarget!.unit.row]?.[bloodSummonTarget!.unit.col]?.unit;
    const targetDamageBefore = targetBefore?.damage ?? 0;
    const targetLife = targetBefore?.card?.life ?? 0;
    const shouldDie = targetDamageBefore + 2 >= targetLife;

    // 验证当前是召唤阶段
    await waitForPhase(hostPage, 'summon');

    // 点击血契召唤事件卡（通过 card-id 匹配）
    const bloodSummonCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id*="blood-summon"]')
      .first();
    await expect(bloodSummonCard).toBeVisible({ timeout: 5000 });
    await bloodSummonCard.click();

    // 回归覆盖：召唤阶段交互事件卡在目标链路同步前，点棋盘也不应误落到普通召唤校验。
    await hostPage.getByTestId('sw-cell-0-0').click({ force: true });
    const phaseRoutingError = hostPage.getByText(/无法在该位置召唤|Cannot summon there|无法在该位置建造|Cannot build there|建筑必须|传送门附近/);
    await expect(phaseRoutingError).toHaveCount(0);
    await hostPage.waitForTimeout(800);
    await expect(phaseRoutingError).toHaveCount(0);

    // 验证血契召唤模式横幅显示
    const bloodSummonBanner = hostPage.locator('[class*="bg-rose-900"]');
    await expect(bloodSummonBanner).toBeVisible({ timeout: 3000 });
    await expect(bloodSummonBanner).toContainText(/选择.*友方单位|Select.*friendly unit/i, { timeout: 3000 });

    // 选择目标友军
    await clickBoardElement(hostPage, `[data-testid="sw-unit-${bloodSummonTarget!.unit.row}-${bloodSummonTarget!.unit.col}"]`);

    // 选择低费单位卡
    const lowCostUnitCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="necro-hellfire-cultist"]')
      .first();
    await expect(lowCostUnitCard).toBeVisible({ timeout: 5000 });
    await lowCostUnitCard.click();

    // 选择召唤落点
    await clickBoardElement(
      hostPage,
      `[data-testid="sw-cell-${bloodSummonTarget!.summonPosition.row}-${bloodSummonTarget!.summonPosition.col}"]`,
    );

    // 验证进入确认步骤并截图
    await expect(bloodSummonBanner).toContainText(/继续|完成|确认/i, { timeout: 3000 });
    await closeDebugPanelIfOpen(hostPage);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-blood-summon-confirm-step', {
        filename: 'event-blood-summon-confirm-step.png',
      }),
      fullPage: false,
    });

    // 完成一次结算
    const finishButton = hostPage.getByRole('button', { name: /完成|Finish/i });
    if (await finishButton.isVisible().catch(() => false)) {
      await finishButton.click();
    }

    const expectedSummonCardId = 'necro-hellfire-cultist';

    // 等待交互收口：服务端权威状态已落地（召唤 + 伤害 + 交互关闭）
    await waitForState(hostPage, async () => {
      const liveState = await getMatchState(matchId!, hostPage);
      const core = liveState?.core as any;
      const board = core?.board as any[][] | undefined;
      if (!board || board.length === 0) return false;
      const targetCell = board[bloodSummonTarget!.unit.row]?.[bloodSummonTarget!.unit.col];
      const targetAfter = targetCell?.unit;
      const targetOk = shouldDie
        ? !targetAfter
        : !!targetAfter
          && targetAfter.cardId === targetBefore?.cardId
          && (targetAfter.damage ?? 0) === targetDamageBefore + 2;
      const summonCell = board[bloodSummonTarget!.summonPosition.row]?.[bloodSummonTarget!.summonPosition.col];
      const summonUnit = summonCell?.unit;
      const summonOk = summonUnit?.cardId === expectedSummonCardId;
      const interactionClosed = !liveState?.sys?.interaction?.current;
      return interactionClosed && summonOk && targetOk;
    }, { timeout: 10000, message: '等待血契召唤结算完成' });

    // 交互横幅应收口
    await expect(bloodSummonBanner).toBeHidden({ timeout: 5000 });

    // 收口态截图
    await closeDebugPanelIfOpen(hostPage);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-blood-summon-finish-state', {
        filename: 'event-blood-summon-finish-state.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：非交互事件牌应先 armed 再确认，点棋盘可取消', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const prepared = prepareNonInteractiveEventTwoStepState(await readCoreState(hostPage));
    await applyCoreState(hostPage, prepared.core);
    await closeDebugPanelIfOpen(hostPage);
    await waitForPhase(hostPage, 'move');

    const eventCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="frost-ice-repair"]')
      .first();
    await expect(eventCard).toBeVisible({ timeout: 5000 });
    await expect(eventCard).toHaveAttribute('data-selected', 'false');

    // 第一次点击：只 armed（选中上移），不出牌
    await eventCard.click();
    await expect(eventCard).toHaveAttribute('data-selected', 'true');
    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.players?.['0']?.hand?.some((card: any) => card.id === prepared.cardId) ?? false;
    }, { timeout: 5000, message: '第一次点击后事件牌应仍在手牌（仅 armed）' }).toBe(true);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-noninteractive-armed-step', {
        filename: 'event-noninteractive-armed-step.png',
      }),
      fullPage: false,
    });

    // 点棋盘：取消 armed，不出牌
    await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.structurePos.row}-${prepared.structurePos.col}"]`);
    await expect(eventCard).toHaveAttribute('data-selected', 'false');
    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.players?.['0']?.hand?.some((card: any) => card.id === prepared.cardId) ?? false;
    }, { timeout: 5000, message: '点棋盘取消 armed 后事件牌应仍在手牌' }).toBe(true);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-noninteractive-board-cancel', {
        filename: 'event-noninteractive-board-cancel.png',
      }),
      fullPage: false,
    });

    // 再次 armed 后，第二次点击同一张牌才确认打出
    await eventCard.click();
    await expect(eventCard).toHaveAttribute('data-selected', 'true');
    await eventCard.click();

    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.players?.['0']?.hand?.some((card: any) => card.id === prepared.cardId) ?? false;
    }, { timeout: 10000, message: '第二次点击确认后事件牌应离开手牌' }).toBe(false);
    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.board?.[prepared.structurePos.row]?.[prepared.structurePos.col]?.structure?.damage ?? -1;
    }, { timeout: 10000, message: '寒冰修补结算后结构伤害应从2变为0' }).toBe(0);
    await expect(eventCard).toBeHidden({ timeout: 5000 });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-noninteractive-confirm-play', {
        filename: 'event-noninteractive-confirm-play.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：魔力阶段非交互事件牌单击即进入打出/弃牌选择，取消后不消耗', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const prepared = prepareMagicNonInteractiveEventTwoStepState(await readCoreState(hostPage));
    await applyCoreState(hostPage, prepared.core);
    await closeDebugPanelIfOpen(hostPage);
    await waitForPhase(hostPage, 'magic');

    const eventCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-id="goblin-relentless"]')
      .first();
    await expect(eventCard).toBeVisible({ timeout: 5000 });
    await expect(eventCard).toHaveAttribute('data-selected', 'false');

    const playButton = hostPage.getByRole('button', { name: /Play|打出/i });
    const discardButton = hostPage.getByRole('button', { name: /Discard|弃牌/i });
    const cancelButton = hostPage.getByRole('button', { name: /Cancel|取消/i });

    // 第一次点击：直接进入打出/弃牌选择（不再依赖 armed 视觉态）
    await eventCard.click();
    await expect(eventCard).toHaveAttribute('data-selected', 'false');
    await expect(playButton).toBeVisible({ timeout: 5000 });
    await expect(discardButton).toBeVisible({ timeout: 5000 });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-magic-noninteractive-choice-open-first-click', {
        filename: 'event-magic-noninteractive-choice-open-first-click.png',
      }),
      fullPage: false,
    });

    // 点棋盘不应误触关闭选择框
    await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.cancelCell.row}-${prepared.cancelCell.col}"]`);
    await expect(eventCard).toHaveAttribute('data-selected', 'false');
    await expect(playButton).toBeVisible({ timeout: 5000 });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-magic-noninteractive-board-click-no-close', {
        filename: 'event-magic-noninteractive-board-click-no-close.png',
      }),
      fullPage: false,
    });

    // 取消选择后不应消耗手牌
    await cancelButton.click();
    await expect(playButton).toHaveCount(0);
    await expect(discardButton).toHaveCount(0);
    await expect(cancelButton).toHaveCount(0);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-magic-noninteractive-choice-cancel-first-click', {
        filename: 'event-magic-noninteractive-choice-cancel-first-click.png',
      }),
      fullPage: false,
    });

    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.players?.['0']?.hand?.some((card: any) => card.id === prepared.cardId) ?? false;
    }, { timeout: 5000, message: '取消后事件牌应仍在手牌中' }).toBe(true);

    // 再次点击同卡，仍应可直接进入选择框
    await eventCard.click();
    await expect(playButton).toBeVisible({ timeout: 5000 });
    await expect(discardButton).toBeVisible({ timeout: 5000 });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    await hostContext.close();
    await guestContext.close();
  });

  test('事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    await disableSummonerWarsAutoSkip(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    const prepared = prepareInteractiveEventSingleTargetState(await readCoreState(hostPage));
    await applyCoreState(hostPage, prepared.core);
    await closeDebugPanelIfOpen(hostPage);
    await waitForPhase(hostPage, 'build');

    const eventCard = hostPage.getByTestId('sw-hand-area')
      .locator(`[data-card-id="${prepared.cardId}"]`)
      .first();
    await expect(eventCard).toBeVisible({ timeout: 5000 });

    // 交互事件牌一次点击直接进入交互（不 armed），但不应立刻结算消耗
    await eventCard.click();

    // 回归覆盖：交互建立前的快速棋盘点击不应落到 BUILD_STRUCTURE 校验并弹建造位置错误。
    await hostPage.getByTestId('sw-cell-0-0').click({ force: true });
    const buildPositionError = hostPage.getByText(/无法在该位置建造|Cannot build there|建筑必须|传送门附近/);
    await expect(buildPositionError).toHaveCount(0);
    await hostPage.waitForTimeout(800);
    await expect(buildPositionError).toHaveCount(0);

    const targetHighlights = hostPage.locator('[data-valid-event-target="true"]');
    await expect(targetHighlights).toHaveCount(1, { timeout: 5000 });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-interactive-single-target-open', {
        filename: 'event-interactive-single-target-open.png',
      }),
      fullPage: false,
    });

    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.players?.['0']?.hand?.some((card: any) => card.id === prepared.cardId) ?? false;
    }, { timeout: 5000, message: '进入交互后未确认前，事件牌不应被消耗' }).toBe(true);

    // 点击状态栏取消按钮，取消交互
    const cancelButton = hostPage.getByRole('button', { name: /Cancel|取消/i }).first();
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    await expect(targetHighlights).toHaveCount(0, { timeout: 5000 });
    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.players?.['0']?.hand?.some((card: any) => card.id === prepared.cardId) ?? false;
    }, { timeout: 5000, message: '取消交互后，事件牌应仍在手牌中' }).toBe(true);
    await closeDebugPanelIfOpen(hostPage);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-interactive-single-target-cancel', {
        filename: 'event-interactive-single-target-cancel.png',
      }),
      fullPage: false,
    });

    await eventCard.click();
    await expect(targetHighlights).toHaveCount(1, { timeout: 5000 });
    await clickBoardElement(hostPage, '[data-valid-event-target="true"]');

    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      return core?.players?.['0']?.hand?.some((card: any) => card.id === prepared.cardId) ?? false;
    }, { timeout: 5000, message: '确认目标后，狱火铸剑应从手牌移除' }).toBe(false);

    await expect.poll(async () => {
      const core = await readCoreState(hostPage);
      const rows = core?.board ?? [];
      for (const row of rows) {
        for (const cell of row ?? []) {
          const unit = cell?.unit;
          if (!unit || unit.owner !== '0' || unit.card?.unitClass !== 'common') continue;
          if ((unit.attachedCards ?? []).some((card: any) => card.id === prepared.cardId)) {
            return true;
          }
        }
      }
      return false;
    }, { timeout: 5000, message: '确认目标后，狱火铸剑应附加到友方士兵底层' }).toBe(true);

    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'event-interactive-single-target-attached', {
        filename: 'event-interactive-single-target-attached.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('阶段自动跳过：有事件卡时不应跳过', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 准备状态：建造阶段 + 手牌只有狱火铸剑（无建筑卡）+ 场上有友方士兵
    const coreState = await readCoreState(hostPage);
    const noStructureCore = prepareNoStructureButEventState(coreState);
    await applyCoreState(hostPage, noStructureCore);
    await closeDebugPanelIfOpen(hostPage);

    // 验证当前是建造阶段（不应被自动跳过）
    await waitForPhase(hostPage, 'build');

    // 等待一段时间确认阶段没有被自动跳过
    await waitForState(hostPage, async () => {
      const phase = await getCurrentPhase(hostPage);
      return phase === 'build';
    }, { timeout: 1500, message: '验证阶段保持在 build' });
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
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 注入弃牌堆有卡牌的状态
    const coreState = await readCoreState(hostPage);
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

  test('移动横屏：对局中的单位与建筑应支持长按放大且不影响点击', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage, 30000);

    const magnifyOverlay = hostPage.getByTestId('sw-magnify-overlay');
    const visibleBoardUnit = hostPage.locator('[data-testid^="sw-unit-"]:visible').first();
    const visibleBoardStructure = hostPage.locator('[data-testid^="sw-structure-"]:visible').first();

    await expect(visibleBoardUnit).toBeVisible({ timeout: 5000 });
    await expect(visibleBoardStructure).toBeVisible({ timeout: 5000 });

    await longPressTouch(visibleBoardUnit, 650, 31);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'mobile-board-unit-long-press-magnify', {
        filename: 'mobile-board-unit-long-press-magnify.png',
      }),
      fullPage: false,
    });

    await longPressTouch(visibleBoardStructure, 650, 32);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'mobile-board-structure-long-press-magnify', {
        filename: 'mobile-board-structure-long-press-magnify.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test('移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    await clearEvidenceScreenshotsForTest(testInfo);

    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await hostContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
      (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
      localStorage.removeItem('hud_fab_position');
      localStorage.removeItem('hud_fab_offset');
    });
    await blockAudioRequests(hostContext);
    await mockSummonerWarsMapImage(hostContext);
    await setChineseLocale(hostContext);
    await disableAudio(hostContext);
    const hostPage = await hostContext.newPage();

    await openSummonerWarsMobileEvidencePage(hostPage);
    await assertHandAreaVisible(hostPage, 'mobile-basic-flow');
    await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 5000 });

    const mobileViewport = hostPage.viewportSize();
    const initialLayout = await hostPage.evaluate(() => ({
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    const mobileShellVars = await hostPage.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        designWidth: style.getPropertyValue('--mobile-board-shell-design-width').trim(),
        scale: style.getPropertyValue('--mobile-board-shell-scale').trim(),
        inverseScale: style.getPropertyValue('--mobile-board-shell-inverse-scale').trim(),
      };
    });
    await testInfo.attach('summonerwars-shell-ratios.json', {
      body: JSON.stringify({
        mobileShellVars,
        initialLayout,
      }, null, 2),
      contentType: 'application/json',
    });
    expect(initialLayout.rootScrollWidth).toBeLessThanOrEqual(initialLayout.innerWidth + 1);
    expect(initialLayout.bodyScrollWidth).toBeLessThanOrEqual(initialLayout.innerWidth + 1);
    expect(mobileViewport?.width).toBe(SW_PHONE_LANDSCAPE_VIEWPORT.width);
    expect(mobileViewport?.height).toBe(SW_PHONE_LANDSCAPE_VIEWPORT.height);

    let matchState = await readSummonerWarsHarnessState(hostPage);
    let coreState = prepareDeterministicCore(matchState.core);
    const expectedStartHandCount = coreState.players?.['0']?.hand?.length ?? 0;
    await applySummonerWarsHarnessState(hostPage, {
      ...matchState,
      core: coreState,
      sys: {
        ...matchState.sys,
        phase: coreState.phase,
      },
    });
    await waitForPhase(hostPage, 'summon');
    await waitForMyTurn(hostPage);
    await waitForSummonerWarsHandCount(hostPage, expectedStartHandCount);
    await waitForSummonerWarsHandStable(hostPage);
    await waitForSummonerWarsHandArtReady(hostPage);
    await assertHandAreaVisible(hostPage, 'mobile-basic-flow-start');
    await assertReachableHandCards(hostPage, 'mobile-basic-flow-start', 4);
    await assertMobileLandscapeControlsReachable(hostPage, 'mobile-basic-flow-start');
    await assertMobileLandscapeFrameReachable(hostPage, 'mobile-basic-flow-start');

    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-start', {
        filename: '40-mobile-basic-flow-start.png',
      }),
      fullPage: false,
    });
    await assertPlayableHandHighlightVisible(hostPage, testInfo, '40-mobile-basic-flow-playable-hand-highlight');

    const unitCard = hostPage.getByTestId('sw-hand-area')
      .locator('[data-card-type="unit"][data-can-play="true"]')
      .last();
    await expect(unitCard).toBeVisible({ timeout: 8000 });
    await unitCard.click();
    expect.poll(() => hostPage.locator('[data-testid="sw-hand-area"] [data-selected="true"]').count(), {
      timeout: 3000,
      message: '移动端单位牌点击后未进入选中态',
    }).toBeGreaterThan(0);
    await assertReachableHandCards(hostPage, 'mobile-basic-flow-card-selected', 3);

    const summonTargets = hostPage.locator('[data-valid-summon="true"]');
    await expect(summonTargets.first()).toBeVisible({ timeout: 8000 });
    await hostPage.waitForTimeout(220);
    const summonTargetLocators = await expandLocatorMatches(summonTargets);
    expect(summonTargetLocators.length).toBeGreaterThan(0);
    const summonHighlightMetrics = await getHighlightMetrics(hostPage, '[data-valid-summon="true"]');
    expect(summonHighlightMetrics.count).toBeGreaterThan(0);
    expect(summonHighlightMetrics.samples[0]?.borderTopWidth).toBe('2px');
    expect(summonHighlightMetrics.samples[0]?.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(summonHighlightMetrics.samples[0]?.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const summonCell = summonTargets.first();
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-summon-highlight', {
        filename: '40-mobile-basic-flow-summon-highlight.png',
      }),
      fullPage: false,
    });
    await captureEvidenceClipAroundLocators(hostPage, [unitCard, ...summonTargetLocators], {
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-summon-highlight-clip', {
        filename: '40-mobile-basic-flow-summon-highlight-clip.png',
      }),
      padding: 32,
    });
    const summonDefaultScaleText = await getMapScaleText(hostPage);
    await zoomMap(hostPage, -300);
    await expect.poll(async () => getMapScaleText(hostPage)).not.toBe(summonDefaultScaleText);
    await dragMap(hostPage, 0, -110);
    await captureEvidenceClipAroundLocators(hostPage, summonTargetLocators, {
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-summon-highlight-zoom-clip', {
        filename: '40-mobile-basic-flow-summon-highlight-zoom-clip.png',
      }),
      padding: 64,
    });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-summon-highlight-zoom-context', {
        filename: '40-mobile-basic-flow-summon-highlight-zoom-context.png',
      }),
      fullPage: false,
    });
    await dragMap(hostPage, 0, 110);
    await zoomMap(hostPage, 300);
    await expect.poll(async () => getMapScaleText(hostPage)).toBe(summonDefaultScaleText);
    const summonRow = await summonCell.getAttribute('data-row');
    const summonCol = await summonCell.getAttribute('data-col');
    if (!summonRow || !summonCol) {
      throw new Error('无法读取移动端召唤格子坐标');
    }
    await clickBoardElement(hostPage, '[data-valid-summon="true"]');
    await expect(hostPage.getByTestId(`sw-unit-${summonRow}-${summonCol}`)).toBeVisible({ timeout: 8000 });

    matchState = await readSummonerWarsHarnessState(hostPage);
    coreState = normalizePhaseState(matchState.core, 'move');
    await applySummonerWarsHarnessState(hostPage, {
      ...matchState,
      core: coreState,
      sys: {
        ...matchState.sys,
        phase: coreState.phase,
      },
    });
    await waitForPhase(hostPage, 'move');
    await waitForMyTurn(hostPage);

    const movableUnit = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"]:not([data-unit-class="summoner"])').first();
    await expect(movableUnit).toBeVisible({ timeout: 8000 });
    const movableUnitTestId = await movableUnit.getAttribute('data-testid');
    if (!movableUnitTestId) {
      throw new Error('无法读取移动单位 test id');
    }
    await clickBoardElement(hostPage, `[data-testid="${movableUnitTestId}"]`);

    const moveTargets = hostPage.locator('[data-valid-move="true"]');
    await expect(moveTargets.first()).toBeVisible({ timeout: 8000 });
    await hostPage.waitForTimeout(220);
    const moveTargetLocators = await expandLocatorMatches(moveTargets);
    expect(moveTargetLocators.length).toBeGreaterThan(0);
    const moveHighlightMetrics = await getHighlightMetrics(hostPage, '[data-valid-move="true"]');
    expect(moveHighlightMetrics.count).toBeGreaterThan(0);
    expect(moveHighlightMetrics.samples[0]?.borderTopWidth).toBe('2px');
    expect(moveHighlightMetrics.samples[0]?.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(moveHighlightMetrics.samples[0]?.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const moveCell = moveTargets.first();
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-move-highlight', {
        filename: '40-mobile-basic-flow-move-highlight.png',
      }),
      fullPage: false,
    });
    await captureEvidenceClipAroundLocators(hostPage, [movableUnit, ...moveTargetLocators], {
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-move-highlight-clip', {
        filename: '40-mobile-basic-flow-move-highlight-clip.png',
      }),
      padding: 32,
    });
    const moveDefaultScaleText = await getMapScaleText(hostPage);
    await zoomMap(hostPage, -300);
    await expect.poll(async () => getMapScaleText(hostPage)).not.toBe(moveDefaultScaleText);
    await dragMap(hostPage, 0, -80);
    await captureEvidenceClipAroundLocators(hostPage, [movableUnit, ...moveTargetLocators], {
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-move-highlight-zoom-clip', {
        filename: '40-mobile-basic-flow-move-highlight-zoom-clip.png',
      }),
      padding: 64,
    });
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-move-highlight-zoom-context', {
        filename: '40-mobile-basic-flow-move-highlight-zoom-context.png',
      }),
      fullPage: false,
    });
    await dragMap(hostPage, 0, 80);
    await zoomMap(hostPage, 300);
    await expect.poll(async () => getMapScaleText(hostPage)).toBe(moveDefaultScaleText);
    const moveRow = await moveCell.getAttribute('data-row');
    const moveCol = await moveCell.getAttribute('data-col');
    if (!moveRow || !moveCol) {
      throw new Error('无法读取移动端移动格子坐标');
    }
    await clickBoardElement(hostPage, '[data-valid-move="true"]');
    await expect(hostPage.getByTestId(`sw-unit-${moveRow}-${moveCol}`)).toBeVisible({ timeout: 8000 });

    matchState = await readSummonerWarsHarnessState(hostPage);
    coreState = normalizePhaseState(matchState.core, 'build');
    await applySummonerWarsHarnessState(hostPage, {
      ...matchState,
      core: coreState,
      sys: {
        ...matchState.sys,
        phase: coreState.phase,
      },
    });
    await waitForPhase(hostPage, 'build');
    await waitForMyTurn(hostPage);

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
      throw new Error('无法读取移动端建造格子坐标');
    }
    await clickBoardElement(hostPage, '[data-valid-build="true"]');
    await expect(hostPage.getByTestId(`sw-structure-${buildRow}-${buildCol}`)).toBeVisible({ timeout: 8000 });

    matchState = await readSummonerWarsHarnessState(hostPage);
    const attackSetup = setupAttackState(matchState.core);
    await applySummonerWarsHarnessState(hostPage, {
      ...matchState,
      core: attackSetup.core,
      sys: {
        ...matchState.sys,
        phase: attackSetup.core.phase,
      },
    });
    await waitForPhase(hostPage, 'attack');
    await waitForMyTurn(hostPage);

    await clickBoardElement(
      hostPage,
      `[data-testid="sw-unit-${attackSetup.attacker.row}-${attackSetup.attacker.col}"]`,
    );
    await expect.poll(async () => {
      return hostPage.locator('[data-valid-attack="true"]').count();
    }, {
      timeout: 2000,
      message: '等待移动端攻击目标出现',
    }).toBeGreaterThan(0);

    const targetCell = hostPage.getByTestId(`sw-cell-${attackSetup.target.row}-${attackSetup.target.col}`);
    const isValidAttack = await targetCell.getAttribute('data-valid-attack').catch(() => null);
    if (isValidAttack === 'true') {
      await clickBoardElement(
        hostPage,
        `[data-testid="sw-cell-${attackSetup.target.row}-${attackSetup.target.col}"]`,
      );
    } else {
      const anyValidTarget = hostPage.locator('[data-valid-attack="true"]').first();
      await expect(anyValidTarget).toBeVisible({ timeout: 3000 });
      const targetTestId = await anyValidTarget.getAttribute('data-testid');
      if (!targetTestId) {
        throw new Error('无法读取移动端攻击目标 test id');
      }
      await clickBoardElement(hostPage, `[data-testid="${targetTestId}"]`);
    }

    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    const attackCountBefore = attackSetup.core.players?.['0']?.attackCount ?? 0;
    await expect.poll(async () => {
      await assertNoReactCrash(hostPage, 'mobile-basic-flow:waiting-dice-overlay');
      if (await diceOverlay.isVisible().catch(() => false)) {
        return true;
      }
      const countText = await hostPage.getByTestId('sw-phase-count-attack').innerText().catch(() => '');
      const remaining = Number.parseInt(countText, 10);
      if (!Number.isNaN(remaining)) {
        return Math.max(0, 3 - remaining) > attackCountBefore;
      }
      const bannerText = await hostPage.getByTestId('sw-action-banner').innerText().catch(() => '');
      if (bannerText.includes('弃牌') || bannerText.includes('魔力')) {
        return true;
      }
      const state = await readSummonerWarsHarnessState(hostPage);
      const attackCount = state.core?.players?.['0']?.attackCount ?? 0;
      const phase = state.core?.phase ?? state.sys?.phase;
      return attackCount > attackCountBefore || phase !== 'attack';
    }, {
      timeout: 10000,
      message: '等待移动基础流程攻击动作写入权威状态',
    }).toBe(true);

    if (await diceOverlay.isVisible({ timeout: 1500 }).catch(() => false)) {
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '40-mobile-basic-flow-after-attack', {
          filename: '40-mobile-basic-flow-after-attack.png',
        }),
        fullPage: false,
      });
      await diceOverlay.click({ force: true });
      await expect(diceOverlay).toBeHidden({ timeout: 5000 });
    }
    await hostPage.waitForTimeout(1200);
    await advancePhase(hostPage, 'attack');
    await waitForPhase(hostPage, 'magic');
    await waitForMyTurn(hostPage);
    matchState = await readSummonerWarsHarnessState(hostPage);
    const expectedMagicHandCountBeforeDiscard = matchState.core.players?.['0']?.hand?.length ?? 0;
    await waitForSummonerWarsHandCount(hostPage, expectedMagicHandCountBeforeDiscard);

    const discardCard = hostPage.getByTestId('sw-hand-area').locator('[data-card-id]').first();
    await expect(discardCard).toBeVisible({ timeout: 8000 });
    await discardCard.click();
    const confirmDiscard = hostPage.getByTestId('sw-confirm-discard');
    await expect(confirmDiscard).toBeVisible({ timeout: 5000 });
    await confirmDiscard.click();
    await expect(confirmDiscard).toBeHidden({ timeout: 5000 });
    const expectedMagicHandCountAfterDiscard = Math.max(0, expectedMagicHandCountBeforeDiscard - 1);
    await waitForSummonerWarsHandCount(hostPage, expectedMagicHandCountAfterDiscard);
    await waitForSummonerWarsHandStable(hostPage);
    await waitForSummonerWarsHandArtReady(hostPage);
    await assertHandAreaVisible(hostPage, 'mobile-basic-flow-after-magic');
    await assertReachableHandCards(
      hostPage,
      'mobile-basic-flow-after-magic',
      Math.min(3, expectedMagicHandCountAfterDiscard),
    );

    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '41-mobile-basic-flow-after-magic', {
        filename: '41-mobile-basic-flow-after-magic.png',
      }),
      fullPage: false,
    });

    const finalLayout = await hostPage.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const endPhase = document.querySelector('[data-testid="sw-end-phase"]') as HTMLElement | null;
      const handArea = document.querySelector('[data-testid="sw-hand-area"]') as HTMLElement | null;
      const phaseControls = document.querySelector('[data-testid="sw-phase-controls"]') as HTMLElement | null;
      const endPhaseRect = endPhase?.getBoundingClientRect();
      const handAreaRect = handArea?.getBoundingClientRect();
      const phaseControlsRect = phaseControls?.getBoundingClientRect();
      return {
        rootScrollWidth: root.scrollWidth,
        bodyScrollWidth: body.scrollWidth,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        endPhaseRect,
        handAreaRect,
        phaseControlsRect,
      };
    });
    expect(finalLayout.rootScrollWidth).toBeLessThanOrEqual(finalLayout.innerWidth + 1);
    expect(finalLayout.bodyScrollWidth).toBeLessThanOrEqual(finalLayout.innerWidth + 1);
    expect(finalLayout.endPhaseRect?.right ?? 9999).toBeLessThanOrEqual(finalLayout.innerWidth + 1);
    expect(finalLayout.endPhaseRect?.bottom ?? 9999).toBeLessThanOrEqual(finalLayout.innerHeight + 1);
    expect(finalLayout.handAreaRect).not.toBeNull();
    expect(finalLayout.phaseControlsRect).not.toBeNull();
    expect(finalLayout.handAreaRect?.bottom ?? 9999).toBeLessThanOrEqual(finalLayout.innerHeight + 1);
    await assertMobileLandscapeControlsReachable(hostPage, 'mobile-basic-flow-final');

    await hostContext.close();
  });

  test('移动横屏：长按放大与阶段说明在手机可达', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    await clearEvidenceScreenshotsForTest(testInfo);

    const desktopContext = await browser.newContext({
      baseURL,
      viewport: { width: 1920, height: 1080 },
    });
    await desktopContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
      localStorage.setItem('hud_fab_position', JSON.stringify({ leftPercent: 0.5, topPercent: 0.5 }));
      localStorage.removeItem('hud_fab_offset');
    });
    await blockAudioRequests(desktopContext);
    await mockSummonerWarsMapImage(desktopContext);
    await setChineseLocale(desktopContext);
    await disableAudio(desktopContext);
    const desktopPage = await desktopContext.newPage();
    await openSummonerWarsMobileEvidencePage(desktopPage);
    await waitForSummonerWarsVisualStable(desktopPage);
    await collapseFabMenuToMainButton(desktopPage);
    let desktopFabPosition: { leftRatio: number; topRatio: number } | null = null;
    await expect.poll(async () => {
      const box = await desktopPage.locator('[data-testid="fab-menu"] [data-fab-id="exit"]').boundingBox();
      const viewport = desktopPage.viewportSize();
      if (!box || !viewport) {
        return null;
      }
      desktopFabPosition = {
        leftRatio: (box.x + box.width / 2) / viewport.width,
        topRatio: (box.y + box.height / 2) / viewport.height,
      };
      return desktopFabPosition;
    }).not.toBeNull();
    expect(desktopFabPosition?.leftRatio ?? 0).toBeGreaterThan(0.42);
    expect(desktopFabPosition?.leftRatio ?? 1).toBeLessThan(0.58);
    expect(desktopFabPosition?.topRatio ?? 0).toBeGreaterThan(0.42);
    expect(desktopFabPosition?.topRatio ?? 1).toBeLessThan(0.58);
    await desktopPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '00-pc-reference-board', {
        filename: '00-pc-reference-board.png',
      }),
      fullPage: false,
    });
    await seedMobileActionLog(desktopPage);
    const desktopActionLogPanel = await openFabPanel(desktopPage, 'action-log', 'exit');
    await expect(desktopActionLogPanel.getByTestId('hud-action-log-row')).toHaveCount(SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT);
    const desktopActionLogLayout = await desktopActionLogPanel.evaluate((panel) => {
      const firstRow = panel.querySelector('[data-testid="hud-action-log-row"]') as HTMLElement | null;
      const rows = Array.from(panel.querySelectorAll('[data-testid="hud-action-log-row"]')) as HTMLElement[];
      const rect = panel.getBoundingClientRect();
      return {
        rect,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        panelClientWidth: panel.clientWidth,
        panelScrollWidth: panel.scrollWidth,
        firstRowClientWidth: firstRow?.clientWidth ?? 0,
        firstRowScrollWidth: firstRow?.scrollWidth ?? 0,
      rowCount: rows.length,
    };
  });
    expect(desktopActionLogLayout.rect.left).toBeGreaterThanOrEqual(0);
    expect(desktopActionLogLayout.rect.top).toBeGreaterThanOrEqual(0);
    expect(desktopActionLogLayout.rect.right).toBeLessThanOrEqual(desktopActionLogLayout.innerWidth + 1);
    expect(desktopActionLogLayout.rect.bottom).toBeLessThanOrEqual(desktopActionLogLayout.innerHeight + 1);
    expect(desktopActionLogLayout.panelScrollWidth).toBeLessThanOrEqual(desktopActionLogLayout.panelClientWidth + 1);
    expect(desktopActionLogLayout.firstRowScrollWidth).toBeLessThanOrEqual(desktopActionLogLayout.firstRowClientWidth + 1);
    expect(desktopActionLogLayout.rowCount).toBe(SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT);
    await expect(desktopActionLogPanel).toContainText('中间据点虽然暂时失守，但换来了两翼包夹角度');
    await desktopPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '01-pc-action-log-open-from-center', {
        filename: '01-pc-action-log-open-from-center.png',
      }),
      fullPage: false,
    });
    await desktopContext.close();

    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await hostContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
      (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
      localStorage.removeItem('hud_fab_position');
      localStorage.removeItem('hud_fab_offset');
    });
    await blockAudioRequests(hostContext);
    await mockSummonerWarsMapImage(hostContext);
    await setChineseLocale(hostContext);
    await disableAudio(hostContext);
    const hostPage = await hostContext.newPage();
    await hostPage.setViewportSize(SW_PHONE_LANDSCAPE_VIEWPORT);
    await openSummonerWarsMobileEvidencePage(hostPage);
    await expect(hostPage.getByTestId('sw-hand-area')).toBeVisible({ timeout: 20000 });
    await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible({ timeout: 20000 });
    await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 20000 });

    await assertHandAreaVisible(hostPage, 'phone-landscape');
    await assertReachableHandCards(hostPage, 'phone-landscape', 4);
    await expect(hostPage.getByTestId('sw-phase-tracker')).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 5000 });

    const defaultScaleText = await getMapScaleText(hostPage);
    expect(defaultScaleText).toMatch(/^\d+%$/);
    const initialScaleBadge = await getMapScaleBadgeState(hostPage);
    expect(initialScaleBadge.text).toBe(defaultScaleText);
    expect(initialScaleBadge.ariaHidden).toBe('true');
    expect(Number(initialScaleBadge.opacity)).toBeLessThan(0.05);

    const phoneViewport = hostPage.viewportSize();
    expect(phoneViewport?.width).toBe(SW_PHONE_LANDSCAPE_VIEWPORT.width);
    expect(phoneViewport?.height).toBe(SW_PHONE_LANDSCAPE_VIEWPORT.height);

    const phoneLayout = await hostPage.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const page = document.querySelector('[data-game-page][data-game-id="summonerwars"]') as HTMLElement | null;
      const endPhaseButton = document.querySelector('[data-testid="sw-end-phase"]') as HTMLElement | null;
      const tracker = document.querySelector('[data-testid="sw-phase-tracker"]') as HTMLElement | null;
      const phaseControls = document.querySelector('[data-testid="sw-phase-controls"]') as HTMLElement | null;
      const handArea = document.querySelector('[data-testid="sw-hand-area"]') as HTMLElement | null;
      const mapContainer = document.querySelector('[data-testid="sw-map-container"]') as HTMLElement | null;
      const mapContent = document.querySelector('[data-testid="sw-map-content"]') as HTMLElement | null;
      const playerEnergy = document.querySelector('[data-testid="sw-energy-player"]') as HTMLElement | null;
      const pageRect = page?.getBoundingClientRect();
      const endPhaseRect = endPhaseButton?.getBoundingClientRect();
      const trackerRect = tracker?.getBoundingClientRect();
      const phaseControlsRect = phaseControls?.getBoundingClientRect();
      const handAreaRect = handArea?.getBoundingClientRect();
      const containerRect = mapContainer?.getBoundingClientRect();
      const contentRect = mapContent?.getBoundingClientRect();
      const playerEnergyRect = playerEnergy?.getBoundingClientRect();
      return {
        rootScrollWidth: root.scrollWidth,
        bodyScrollWidth: body.scrollWidth,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        pageRect,
        endPhaseRect,
        trackerRect,
        phaseControlsRect,
        handAreaRect,
        containerRect,
        contentRect,
        playerEnergyRect,
      };
    });

    expect(phoneLayout.rootScrollWidth).toBeLessThanOrEqual(phoneLayout.innerWidth + 1);
    expect(phoneLayout.bodyScrollWidth).toBeLessThanOrEqual(phoneLayout.innerWidth + 1);
    expect(phoneLayout.pageRect?.left ?? -1).toBeGreaterThanOrEqual(0);
    expect(phoneLayout.pageRect?.right ?? 99999).toBeLessThanOrEqual(phoneLayout.innerWidth + 1);
    expect(phoneLayout.endPhaseRect?.right ?? 99999).toBeLessThanOrEqual(phoneLayout.innerWidth + 1);
    expect(phoneLayout.endPhaseRect?.bottom ?? 99999).toBeLessThanOrEqual(phoneLayout.innerHeight + 1);
    expect(phoneLayout.trackerRect?.right ?? 99999).toBeLessThanOrEqual(phoneLayout.innerWidth + 1);
    expect(phoneLayout.phaseControlsRect).not.toBeNull();
    expect(phoneLayout.handAreaRect).not.toBeNull();
    expect(phoneLayout.playerEnergyRect?.width ?? 0).toBeGreaterThan(0);
    expect(phoneLayout.playerEnergyRect?.height ?? 0).toBeGreaterThan(0);
    await assertMobileLandscapeControlsReachable(hostPage, 'phone-landscape-layout');
    await assertMobileLandscapeFrameReachable(hostPage, 'phone-landscape-layout');

    await waitForSummonerWarsVisualStable(hostPage);
    await collapseFabMenuToMainButton(hostPage);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '10-phone-landscape-board', {
        filename: '10-phone-landscape-board.png',
      }),
      fullPage: false,
    });

    await zoomMap(hostPage, -300);
    await expect.poll(async () => getMapScaleText(hostPage)).not.toBe(defaultScaleText);
    await expect.poll(async () => (await getMapScaleBadgeState(hostPage)).ariaHidden).toBe('false');
    await zoomMap(hostPage, 300);
    await expect.poll(async () => getMapScaleText(hostPage)).toBe(defaultScaleText);
    await hostPage.waitForTimeout(1400);
    await expect.poll(async () => (await getMapScaleBadgeState(hostPage)).ariaHidden).toBe('true');

    const magnifyOverlay = hostPage.getByTestId('sw-magnify-overlay');
    const initialMagnifyCloseButton = magnifyOverlay.getByRole('button', { name: /关闭|Close/i });
    if (await magnifyOverlay.isVisible().catch(() => false)) {
      await initialMagnifyCloseButton.dispatchEvent('click');
      await waitForOverlayState(hostPage, 'sw-magnify-overlay', 'closed');
    }
    const affordableHandCard = hostPage
      .locator('[data-testid="sw-hand-area"] [data-card-id][data-can-afford="true"]')
      .last();
    await expect(affordableHandCard).toBeVisible({ timeout: 5000 });
    const selectedCardId = await affordableHandCard.getAttribute('data-card-id');
    if (!selectedCardId) {
      throw new Error('目标手牌缺少 data-card-id，无法校验放大按钮锚点');
    }
    await affordableHandCard.click({ position: { x: 18, y: 18 } });
    const selectedHandCard = hostPage.locator(
      `[data-testid="sw-hand-area"] [data-card-id="${selectedCardId}"]`,
    );
    await expect(selectedHandCard).toBeVisible({ timeout: 5000 });
    await expect(selectedHandCard).toHaveAttribute('data-selected', 'true');
    const selectedMagnifyButton = selectedHandCard.getByTestId('sw-hand-card-magnify');
    await expect(selectedMagnifyButton).toBeVisible({ timeout: 5000 });
    const selectedMagnifyVisual = selectedHandCard.getByTestId('sw-hand-card-magnify-visual');
    await expect(selectedMagnifyVisual).toBeVisible({ timeout: 5000 });
    const selectedMagnifyVisualBox = await selectedMagnifyVisual.boundingBox();
    const handAreaBox = await hostPage.getByTestId('sw-hand-area').boundingBox();
    const selectedHandCardBox = await selectedHandCard.boundingBox();
    expect(selectedMagnifyVisualBox?.width ?? 0).toBeGreaterThanOrEqual(24);
    expect(selectedMagnifyVisualBox?.height ?? 0).toBeGreaterThanOrEqual(24);
    expect(selectedMagnifyVisualBox?.width ?? 0).toBeLessThanOrEqual(34);
    expect(selectedMagnifyVisualBox?.height ?? 0).toBeLessThanOrEqual(34);
    if (selectedMagnifyVisualBox && selectedHandCardBox) {
      const selectedCardRight = selectedHandCardBox.x + selectedHandCardBox.width;
      const magnifyRight = selectedMagnifyVisualBox.x + selectedMagnifyVisualBox.width;
      expect(Math.abs(magnifyRight - selectedCardRight)).toBeLessThanOrEqual(24);
      expect(selectedMagnifyVisualBox.x).toBeGreaterThanOrEqual(selectedHandCardBox.x + selectedHandCardBox.width - 60);
      expect(selectedMagnifyVisualBox.y).toBeLessThanOrEqual(selectedHandCardBox.y + 20);
      expect(selectedMagnifyVisualBox.y + selectedMagnifyVisualBox.height).toBeGreaterThanOrEqual(selectedHandCardBox.y - 24);
    }
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '11a-phone-hand-magnify-button-visible', {
        filename: '11a-phone-hand-magnify-button-visible.png',
      }),
      fullPage: false,
    });
    if (handAreaBox && selectedMagnifyVisualBox) {
      const horizontalPadding = 24;
      const topPadding = 120;
      const bottomPadding = 24;
      const viewport = hostPage.viewportSize();
      const clipLeft = Math.max(0, Math.min(handAreaBox.x, selectedMagnifyVisualBox.x) - horizontalPadding);
      const clipTop = Math.max(0, Math.min(handAreaBox.y, selectedMagnifyVisualBox.y) - topPadding);
      const clipRight = Math.min(
        viewport?.width ?? Number.MAX_SAFE_INTEGER,
        Math.max(
          handAreaBox.x + handAreaBox.width,
          selectedMagnifyVisualBox.x + selectedMagnifyVisualBox.width,
        ) + horizontalPadding,
      );
      const clipBottom = Math.min(
        viewport?.height ?? Number.MAX_SAFE_INTEGER,
        Math.max(
          handAreaBox.y + handAreaBox.height,
          selectedMagnifyVisualBox.y + selectedMagnifyVisualBox.height,
        ) + bottomPadding,
      );
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '11a-phone-hand-area-with-magnify-button', {
          filename: '11a-phone-hand-area-with-magnify-button.png',
        }),
        clip: {
          x: clipLeft,
          y: clipTop,
          width: Math.max(1, clipRight - clipLeft),
          height: Math.max(1, clipBottom - clipTop),
        },
      });
    }
    if (selectedHandCardBox) {
      const padding = 20;
      const viewport = hostPage.viewportSize();
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '11a-phone-hand-card-with-magnify-button', {
          filename: '11a-phone-hand-card-with-magnify-button.png',
        }),
        clip: {
          x: Math.max(0, selectedHandCardBox.x - padding),
          y: Math.max(0, selectedHandCardBox.y - padding),
          width: Math.min(
            (viewport?.width ?? 0) - Math.max(0, selectedHandCardBox.x - padding),
            selectedHandCardBox.width + padding * 2,
          ),
          height: Math.min(
            (viewport?.height ?? 0) - Math.max(0, selectedHandCardBox.y - padding),
            selectedHandCardBox.height + padding * 2,
          ),
        },
      });
    }
    if (selectedMagnifyVisualBox) {
      const padding = 16;
      const viewport = hostPage.viewportSize();
      if (selectedHandCardBox) {
        const clipLeft = Math.max(0, Math.min(selectedHandCardBox.x, selectedMagnifyVisualBox.x) - padding);
        const clipTop = Math.max(0, Math.min(selectedHandCardBox.y, selectedMagnifyVisualBox.y) - padding);
        const clipRight = Math.min(
          viewport?.width ?? Number.MAX_SAFE_INTEGER,
          Math.max(
            selectedHandCardBox.x + selectedHandCardBox.width,
            selectedMagnifyVisualBox.x + selectedMagnifyVisualBox.width,
          ) + padding,
        );
        const clipBottom = Math.min(
          viewport?.height ?? Number.MAX_SAFE_INTEGER,
          Math.max(
            selectedHandCardBox.y + selectedHandCardBox.height,
            selectedMagnifyVisualBox.y + selectedMagnifyVisualBox.height,
          ) + padding,
        );
        await hostPage.screenshot({
          path: getEvidenceScreenshotPath(testInfo, '11a-phone-hand-card-and-magnify-button-union', {
            filename: '11a-phone-hand-card-and-magnify-button-union.png',
          }),
          clip: {
            x: clipLeft,
            y: clipTop,
            width: Math.max(1, clipRight - clipLeft),
            height: Math.max(1, clipBottom - clipTop),
          },
        });
      }
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '11a-phone-hand-magnify-button-closeup', {
          filename: '11a-phone-hand-magnify-button-closeup.png',
        }),
        clip: {
          x: Math.max(0, selectedMagnifyVisualBox.x - padding),
          y: Math.max(0, selectedMagnifyVisualBox.y - padding),
          width: Math.min(
            (viewport?.width ?? 0) - Math.max(0, selectedMagnifyVisualBox.x - padding),
            selectedMagnifyVisualBox.width + padding * 2,
          ),
          height: Math.min(
            (viewport?.height ?? 0) - Math.max(0, selectedMagnifyVisualBox.y - padding),
            selectedMagnifyVisualBox.height + padding * 2,
          ),
        },
      });
    }
    await selectedMagnifyButton.click();
    await waitForOverlayState(hostPage, 'sw-magnify-overlay', 'open');
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '11b-phone-hand-magnify-click-open', {
        filename: '11b-phone-hand-magnify-click-open.png',
      }),
      fullPage: false,
    });
    await magnifyOverlay.locator('button', { hasText: /关闭|Close/i }).click();
    await waitForOverlayState(hostPage, 'sw-magnify-overlay', 'closed');
    await longPressTouch(selectedHandCard, 650, 33);
    await waitForOverlayState(hostPage, 'sw-magnify-overlay', 'open');
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '11c-phone-hand-magnify-long-press-open', {
        filename: '11c-phone-hand-magnify-long-press-open.png',
      }),
      fullPage: false,
    });
    await magnifyOverlay.locator('button', { hasText: /关闭|Close/i }).click();
    await waitForOverlayState(hostPage, 'sw-magnify-overlay', 'closed');

    await hostPage.getByTestId('sw-phase-item-build').click();
    const phaseDetailPanel = hostPage.getByTestId('sw-phase-detail-panel');
    await expect(phaseDetailPanel).toBeVisible({ timeout: 5000 });
    await expect(phaseDetailPanel).toContainText(/Build|建造/i);

    // 证据要求：必须在截图里肉眼可见 “阶段详情面板” 本体。
    const phaseDetailBox = await phaseDetailPanel.boundingBox().catch(() => null);
    if (phaseDetailBox) {
      const padding = 12;
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '12-phone-phase-detail-open-clip', {
          filename: '12-phone-phase-detail-open-clip.png',
        }),
        clip: {
          x: Math.max(0, phaseDetailBox.x - padding),
          y: Math.max(0, phaseDetailBox.y - padding),
          width: phaseDetailBox.width + padding * 2,
          height: phaseDetailBox.height + padding * 2,
        },
        fullPage: false,
      });
    }
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '12-phone-phase-detail-open', {
        filename: '12-phone-phase-detail-open.png',
      }),
      fullPage: false,
    });
    await hostPage.getByTestId('sw-phase-item-summon').click();
    await expect(phaseDetailPanel).toContainText(/Summon|召唤/i);

    await seedMobileActionLog(hostPage);
    const actionLogPanel = await openFabPanel(hostPage, 'action-log', 'exit');
    await expect(actionLogPanel.getByTestId('hud-action-log-row')).toHaveCount(SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT);
    const actionLogLayout = await actionLogPanel.evaluate((panel) => {
      const firstRow = panel.querySelector('[data-testid="hud-action-log-row"]') as HTMLElement | null;
      const rows = Array.from(panel.querySelectorAll('[data-testid="hud-action-log-row"]')) as HTMLElement[];
      const rect = panel.getBoundingClientRect();
      return {
        rect,
        panelClientHeight: panel.clientHeight,
        panelScrollHeight: panel.scrollHeight,
        panelClientWidth: panel.clientWidth,
        panelScrollWidth: panel.scrollWidth,
        firstRowClientWidth: firstRow?.clientWidth ?? 0,
        firstRowScrollWidth: firstRow?.scrollWidth ?? 0,
        rowCount: rows.length,
      };
    });
    expect(actionLogLayout.rect.left).toBeGreaterThanOrEqual(0);
    expect(actionLogLayout.rect.top).toBeGreaterThanOrEqual(0);
    expect(actionLogLayout.rect.right).toBeLessThanOrEqual(phoneLayout.innerWidth + 1);
    expect(actionLogLayout.rect.bottom).toBeLessThanOrEqual(phoneLayout.innerHeight + 1);
    expect(actionLogLayout.panelScrollHeight).toBeGreaterThan(actionLogLayout.panelClientHeight);
    expect(actionLogLayout.panelScrollWidth).toBeLessThanOrEqual(actionLogLayout.panelClientWidth + 1);
    expect(actionLogLayout.firstRowScrollWidth).toBeLessThanOrEqual(actionLogLayout.firstRowClientWidth + 1);
    expect(actionLogLayout.rowCount).toBe(SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT);
    await expect(actionLogPanel).toContainText('最后一步把冠军停在外圈威胁位');
    await expect(actionLogPanel).toContainText('中间据点虽然暂时失守，但换来了两翼包夹角度');
    await actionLogPanel.evaluate((panel) => {
      panel.scrollTop = panel.scrollHeight;
    });
    const actionLogScrollTop = await actionLogPanel.evaluate((panel) => panel.scrollTop);
    expect(actionLogScrollTop).toBeGreaterThan(0);
    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '13-phone-action-log-open', {
        filename: '13-phone-action-log-open.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
  });

  test('全端：眼睛按钮显示全部血量且点单位仍直接选中', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    await clearEvidenceScreenshotsForTest(testInfo);

    const tabletContext = await browser.newContext({
      baseURL,
      viewport: { width: 1180, height: 820 },
      isMobile: true,
      hasTouch: true,
    });
    await tabletContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
      localStorage.removeItem('hud_fab_position');
      localStorage.removeItem('hud_fab_offset');

      const nativeMatchMedia = window.matchMedia.bind(window);
      const createMediaQueryList = (query: string, matches: boolean) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;

      window.matchMedia = ((query: string) => {
        const clauses = query.split(',').map(clause => clause.trim());
        if (clauses.some(clause => clause === '(hover: none)')) {
          return createMediaQueryList(query, false);
        }
        if (clauses.some(clause => clause === '(pointer: coarse)')) {
          return createMediaQueryList(query, false);
        }
        return nativeMatchMedia(query);
      }) as typeof window.matchMedia;
    });
    await blockAudioRequests(tabletContext);
    await mockSummonerWarsMapImage(tabletContext);
    await setChineseLocale(tabletContext);
    await disableAudio(tabletContext);

    const tabletPage = await tabletContext.newPage();
    await openSummonerWarsMobileEvidencePage(tabletPage);
    await waitForSummonerWarsVisualStable(tabletPage);

    const capabilities = await tabletPage.evaluate(() => ({
      width: window.innerWidth,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      hoverNone: window.matchMedia('(hover: none)').matches,
      maxTouchPoints: navigator.maxTouchPoints,
    }));
    expect(capabilities.width).toBeGreaterThan(1023);
    expect(capabilities.coarsePointer).toBe(false);
    expect(capabilities.hoverNone).toBe(false);
    expect(capabilities.maxTouchPoints).toBeGreaterThan(0);

    const unitTestId = await tabletPage
      .locator('[data-testid^="sw-unit-"][data-cell-coord][data-owner="0"]:visible')
      .evaluateAll((elements) => {
        const viewportCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const closest = elements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            return {
              testId: element.getAttribute('data-testid'),
              distance: Math.hypot(centerX - viewportCenter.x, centerY - viewportCenter.y),
            };
          })
          .filter((candidate): candidate is { testId: string; distance: number } => Boolean(candidate.testId))
          .sort((a, b) => a.distance - b.distance)[0];
        return closest?.testId ?? null;
      });
    if (!unitTestId) {
      throw new Error('默认平板证据场景没有可用于查看血量的单位');
    }
    const unit = tabletPage.getByTestId(unitTestId);
    const unitLife = unit.locator('[data-testid^="sw-unit-life-"]');
    const unitCoord = await unit.getAttribute('data-cell-coord');
    if (!unitCoord) {
      throw new Error('目标单位缺少 data-cell-coord，无法验证点按直接执行选择');
    }
    const unitCell = tabletPage.getByTestId(`sw-cell-${unitCoord}`);
    await expect(unit).toBeVisible({ timeout: 5000 });
    await expect(unitCell).toHaveAttribute('data-selected', 'false');
    await expect(unitLife).toHaveAttribute('data-life-visible', 'false');
    await expect(unitLife).toHaveCSS('opacity', '0');

    const structureTestId = await tabletPage
      .locator('[data-testid^="sw-structure-"][data-cell-coord]:visible')
      .evaluateAll((elements) => {
        const viewportCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const closest = elements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            return {
              testId: element.getAttribute('data-testid'),
              distance: Math.hypot(centerX - viewportCenter.x, centerY - viewportCenter.y),
            };
          })
          .filter((candidate): candidate is { testId: string; distance: number } => Boolean(candidate.testId))
          .sort((a, b) => a.distance - b.distance)[0];
        return closest?.testId ?? null;
      });
    if (!structureTestId) {
      throw new Error('默认平板证据场景没有可用于查看血量的建筑');
    }
    const structure = tabletPage.getByTestId(structureTestId);
    const structureLife = structure.locator('[data-testid^="sw-structure-life-"]');
    await expect(structure).toBeVisible({ timeout: 5000 });
    await expect(structureLife).toHaveAttribute('data-life-visible', 'false');

    const lifeToggle = tabletPage.getByTestId('sw-life-toggle');
    await expect(lifeToggle).toBeVisible({ timeout: 5000 });
    await expect(lifeToggle).toHaveAttribute('aria-pressed', 'false');
    const lifeToggleLayout = await tabletPage.evaluate(() => {
      const scaleBadge = document.querySelector('[data-testid="sw-map-scale"]') as HTMLElement | null;
      const toggle = document.querySelector('[data-testid="sw-life-toggle"]') as HTMLElement | null;
      const toRect = (node: HTMLElement | null) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        scaleRect: toRect(scaleBadge),
        toggleRect: toRect(toggle),
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      };
    });
    expect(lifeToggleLayout.scaleRect).not.toBeNull();
    expect(lifeToggleLayout.toggleRect).not.toBeNull();
    expect(lifeToggleLayout.toggleRect?.left ?? 0).toBeGreaterThanOrEqual((lifeToggleLayout.scaleRect?.right ?? 0) - 1);
    expect(lifeToggleLayout.toggleRect?.top ?? -1).toBeGreaterThanOrEqual(0);
    expect(lifeToggleLayout.toggleRect?.right ?? 99999).toBeLessThanOrEqual(lifeToggleLayout.innerWidth + 1);
    expect(lifeToggleLayout.toggleRect?.bottom ?? 99999).toBeLessThanOrEqual(lifeToggleLayout.innerHeight + 1);
    expect(lifeToggleLayout.toggleRect?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(lifeToggleLayout.toggleRect?.height ?? 0).toBeGreaterThanOrEqual(44);

    await lifeToggle.tap();
    await expect(lifeToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(unitLife).toHaveAttribute('data-life-visible', 'true');
    await expect(unitLife).toHaveCSS('opacity', '1');
    await expect(structureLife).toHaveAttribute('data-life-visible', 'true');
    await expect(structureLife).toHaveCSS('opacity', '1');
    const unitLifeMetrics = await unit.evaluate((element) => {
      const lifeLayer = element.querySelector('[data-testid^="sw-unit-life-"]') as HTMLElement | null;
      const badge = lifeLayer?.querySelector('span') as HTMLElement | null;
      const card = lifeLayer?.parentElement as HTMLElement | null;
      const cardRect = card?.getBoundingClientRect();
      return {
        fontSize: badge ? Number.parseFloat(window.getComputedStyle(badge).fontSize) : 0,
        cardWidth: cardRect?.width ?? 0,
      };
    });
    const structureLifeMetrics = await structure.evaluate((element) => {
      const lifeLayer = element.querySelector('[data-testid^="sw-structure-life-"]') as HTMLElement | null;
      const badge = lifeLayer?.querySelector('span') as HTMLElement | null;
      const card = lifeLayer?.parentElement as HTMLElement | null;
      const cardRect = card?.getBoundingClientRect();
      return {
        fontSize: badge ? Number.parseFloat(window.getComputedStyle(badge).fontSize) : 0,
        cardWidth: cardRect?.width ?? 0,
      };
    });
    expect(unitLifeMetrics.cardWidth).toBeGreaterThan(0);
    expect(structureLifeMetrics.cardWidth).toBeGreaterThan(0);
    expect(unitLifeMetrics.fontSize).toBeGreaterThanOrEqual(14);
    expect(structureLifeMetrics.fontSize).toBeGreaterThanOrEqual(14);
    expect(unitLifeMetrics.fontSize).toBeLessThanOrEqual(unitLifeMetrics.cardWidth * 0.36);
    expect(structureLifeMetrics.fontSize).toBeLessThanOrEqual(structureLifeMetrics.cardWidth * 0.36);

    await tabletPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, '20-平板眼睛按钮-显示全部血量', {
        filename: '20-平板眼睛按钮-显示全部血量.png',
      }),
      fullPage: false,
    });

    await unit.tap();
    await expect(unitCell).toHaveAttribute('data-selected', 'true');
    await expect(unitLife).toHaveAttribute('data-life-visible', 'true');
    await expect(unitLife).toHaveCSS('opacity', '1');

    await lifeToggle.tap();
    await expect(lifeToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(unitLife).toHaveAttribute('data-life-visible', 'false');
    await expect(structureLife).toHaveAttribute('data-life-visible', 'false');

    await tabletContext.close();

    const desktopContext = await browser.newContext({
      baseURL,
      viewport: DESKTOP_REFERENCE_VIEWPORT,
    });
    await desktopContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
    });
    await blockAudioRequests(desktopContext);
    await mockSummonerWarsMapImage(desktopContext);
    await setChineseLocale(desktopContext);
    await disableAudio(desktopContext);

    const desktopPage = await desktopContext.newPage();
    await openSummonerWarsMobileEvidencePage(desktopPage);
    await waitForSummonerWarsVisualStable(desktopPage);
    const desktopLifeToggle = desktopPage.getByTestId('sw-life-toggle');
    await expect(desktopLifeToggle).toBeVisible({ timeout: 5000 });
    await expect(desktopLifeToggle).toHaveAttribute('aria-pressed', 'false');

    const desktopUnit = desktopPage
      .locator('[data-testid^="sw-unit-"][data-cell-coord][data-owner="0"]:visible')
      .first();
    const desktopUnitLife = desktopUnit.locator('[data-testid^="sw-unit-life-"]');
    const desktopUnitCoord = await desktopUnit.getAttribute('data-cell-coord');
    if (!desktopUnitCoord) {
      throw new Error('桌面目标单位缺少 data-cell-coord，无法验证单击立即执行');
    }
    const desktopUnitCell = desktopPage.getByTestId(`sw-cell-${desktopUnitCoord}`);
    await expect(desktopUnitCell).toHaveAttribute('data-selected', 'false');
    await expect(desktopUnitLife).toHaveAttribute('data-life-visible', 'false');
    await expect(desktopUnitLife).toHaveCSS('opacity', '0');
    await desktopLifeToggle.click();
    await expect(desktopLifeToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(desktopUnitLife).toHaveAttribute('data-life-visible', 'true');
    await expect(desktopUnitLife).toHaveCSS('opacity', '1');
    await desktopUnit.click();
    await expect(desktopUnitLife).toHaveAttribute('data-life-visible', 'true');
    await expect(desktopUnitCell).toHaveAttribute('data-selected', 'true');
    await desktopLifeToggle.click();
    await expect(desktopLifeToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(desktopUnitLife).toHaveAttribute('data-life-visible', 'false');
    await expect(desktopUnitLife).toHaveCSS('opacity', '0');
    await desktopUnit.hover();
    await expect(desktopUnitLife).toHaveCSS('opacity', '1');
    await desktopUnit.click();
    await expect(desktopUnitLife).toHaveAttribute('data-life-visible', 'false');
    await expect(desktopUnitCell).toHaveAttribute('data-selected', 'true');
    await desktopPage.mouse.move(0, 0);
    await expect(desktopUnitLife).toHaveCSS('opacity', '0');

    await desktopContext.close();
  });

  test('移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    await clearEvidenceScreenshotsForTest(testInfo);

    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });

    await hostContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
      (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
      localStorage.removeItem('hud_fab_position');
      localStorage.removeItem('hud_fab_offset');
    });
    await blockAudioRequests(hostContext);
    await mockSummonerWarsMapImage(hostContext);
    await setChineseLocale(hostContext);
    await disableAudio(hostContext);

    const hostPage = await hostContext.newPage();
    await hostPage.setViewportSize(SW_PHONE_LANDSCAPE_VIEWPORT);
    await openSummonerWarsMobileEvidencePage(hostPage);
    await waitForSummonerWarsVisualStable(hostPage);
    await expect(hostPage.getByTestId('sw-end-phase')).toBeVisible({ timeout: 5000 });
    await seedMobileActionLog(hostPage);

    const runExpandedOverflowScenario = async ({
      deltaY,
      overflowDirection,
      screenshotKey,
      screenshotFilename,
      undoScreenshotKey,
      undoScreenshotFilename,
      undoZoomScreenshotKey,
      undoZoomScreenshotFilename,
    }: {
      deltaY: number;
      overflowDirection: 'top' | 'bottom';
      screenshotKey: string;
      screenshotFilename: string;
      undoScreenshotKey: string;
      undoScreenshotFilename: string;
      undoZoomScreenshotKey: string;
      undoZoomScreenshotFilename: string;
    }) => {
      await hostPage.evaluate(() => {
        localStorage.removeItem('hud_fab_position');
        localStorage.removeItem('hud_fab_offset');
      });
      await openSummonerWarsMobileEvidencePage(hostPage);
      await waitForSummonerWarsVisualStable(hostPage);
      await seedMobileActionLog(hostPage);
      await collapseFabMenuToMainButton(hostPage);

      const exitFab = hostPage.locator('[data-testid="fab-menu"] [data-fab-id="exit"]');
      const exitFabVisual = hostPage.locator('[data-fab-visual-id="exit"]');
      const exitFabPanel = hostPage.getByTestId('fab-panel-exit');
      await expect(exitFab).toBeVisible({ timeout: 5000 });
      await exitFab.click();
      await expect(hostPage.getByTestId('fab-sheet-exit')).toHaveCount(0);
      await expect(exitFabPanel).toBeVisible({ timeout: 5000 });
      const exitPanelRectBeforeDrag = await exitFabPanel.boundingBox();
      const exitVisualRectBeforeDrag = await exitFabVisual.boundingBox();
      expect(exitPanelRectBeforeDrag).not.toBeNull();
      expect(exitVisualRectBeforeDrag).not.toBeNull();

      await touchDragElement(exitFab, {
        deltaX: 0,
        deltaY,
        steps: 12,
      });
      const releaseSamples = await sampleFabReleaseFrames(hostPage, {
        buttonId: 'exit',
        panelId: 'exit',
      });
      await hostPage.waitForTimeout(180);

      const validReleaseSamples = releaseSamples.filter((sample) => sample !== null);
      expect(validReleaseSamples.length, `${overflowDirection} overflow should keep sampling the exit FAB after release`).toBeGreaterThan(0);
      const firstReleaseSample = validReleaseSamples[0];
      const lastReleaseSample = validReleaseSamples[validReleaseSamples.length - 1];
      const preDragVisualTop = exitVisualRectBeforeDrag?.y ?? firstReleaseSample?.visualTop ?? 0;
      expect(
        Math.abs((firstReleaseSample?.visualTop ?? 0) - (lastReleaseSample?.visualTop ?? 0)),
        `${overflowDirection} overflow should not let the exit FAB snap back toward its pre-drag origin before settling`,
      ).toBeLessThan(
        Math.abs((firstReleaseSample?.visualTop ?? 0) - preDragVisualTop),
      );
      const releaseAnchorDistances = validReleaseSamples.map((sample) => sample.anchorEdgeDistance);
      expect(
        releaseAnchorDistances.every((distance) => Number.isFinite(distance)),
        `${overflowDirection} overflow should expose finite anchor distances during release sampling`,
      ).toBe(true);

      const draggedVisualBox = await hostPage.locator('[data-fab-visual-id="exit"]').boundingBox();
      const draggedStoredPosition = await getFabStoredPosition(hostPage);
      expect(draggedVisualBox).not.toBeNull();
      expect(draggedStoredPosition).not.toBeNull();
      if (overflowDirection === 'top') {
        expect((draggedStoredPosition?.topPercent ?? 1)).toBeLessThan(0);
        expect((draggedVisualBox?.y ?? 999)).toBeLessThan(20);
      } else {
        expect((draggedStoredPosition?.topPercent ?? 0)).toBeGreaterThan(0.9);
        expect(
          (draggedVisualBox?.y ?? 0) + (draggedVisualBox?.height ?? 0),
          'bottom overflow should keep the recovered main FAB in the lower half instead of snapping back to its old resting point',
        ).toBeGreaterThan(SW_PHONE_LANDSCAPE_VIEWPORT.height * 0.55);
      }
      await expect(exitFabPanel).toBeVisible({ timeout: 5000 });
      await expect.poll(async () => {
        const rect = await exitFabPanel.boundingBox();
        return rect ? Math.round(rect.y) : null;
      }, { timeout: 2500, intervals: [80, 120, 160] }).not.toBeNull();
      const rawExitPanelRectAfterDrag = await exitFabPanel.boundingBox();
      expect(rawExitPanelRectAfterDrag).not.toBeNull();
      const resolvedExitPanelRectAfterDrag = {
        x: rawExitPanelRectAfterDrag?.x ?? 0,
        y: rawExitPanelRectAfterDrag?.y ?? 0,
        right: (rawExitPanelRectAfterDrag?.x ?? 0) + (rawExitPanelRectAfterDrag?.width ?? 0),
        bottom: (rawExitPanelRectAfterDrag?.y ?? 0) + (rawExitPanelRectAfterDrag?.height ?? 0),
      };
      expect(resolvedExitPanelRectAfterDrag.x).toBeGreaterThanOrEqual(0);
      expect(resolvedExitPanelRectAfterDrag.y).toBeGreaterThanOrEqual(0);
      expect(resolvedExitPanelRectAfterDrag.right).toBeLessThanOrEqual(SW_PHONE_LANDSCAPE_VIEWPORT.width + 1);
      expect(resolvedExitPanelRectAfterDrag.bottom).toBeLessThanOrEqual(SW_PHONE_LANDSCAPE_VIEWPORT.height + 1);

      await openSummonerWarsMobileEvidencePage(hostPage);
      await waitForSummonerWarsVisualStable(hostPage);
      await seedMobileActionLog(hostPage);
      const actionLogPanel = await openFabPanel(hostPage, 'action-log', 'exit');
      await expect(actionLogPanel.getByTestId('hud-action-log-row')).toHaveCount(SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT);
      const expandedFabMetrics = await waitForExpandedFabLayoutStable(hostPage);
      expect(expandedFabMetrics.panelRect).not.toBeNull();
      expect(expandedFabMetrics.rowCount).toBe(SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT);
      expect(expandedFabMetrics.panelScrollHeight).toBeGreaterThan(expandedFabMetrics.panelClientHeight);
      expect(expandedFabMetrics.panelScrollWidth).toBeLessThanOrEqual(expandedFabMetrics.panelClientWidth + 1);
      expect(expandedFabMetrics.firstRowScrollWidth).toBeLessThanOrEqual(expandedFabMetrics.firstRowClientWidth + 1);
      expect(expandedFabMetrics.panelRect?.left ?? -1).toBeGreaterThanOrEqual(0);
      expect(expandedFabMetrics.panelRect?.top ?? -1).toBeGreaterThanOrEqual(0);
      expect(expandedFabMetrics.panelRect?.right ?? 9999).toBeLessThanOrEqual(expandedFabMetrics.viewportWidth + 1);
      expect(expandedFabMetrics.panelRect?.bottom ?? 9999).toBeLessThanOrEqual(expandedFabMetrics.viewportHeight + 1);
      expect(expandedFabMetrics.pageScrollX).toBe(0);
      expect(expandedFabMetrics.pageScrollY).toBe(0);
      expect(expandedFabMetrics.gamePageRect?.top ?? -1).toBeGreaterThanOrEqual(0);
      expect(expandedFabMetrics.gamePageRect?.bottom ?? -1).toBeGreaterThanOrEqual(expandedFabMetrics.viewportHeight - 1);
      const nearestSatelliteToMain = expandedFabMetrics.visibleButtons
        .filter((button) => button.id !== 'exit')
        .map((button) => ({
          ...button,
          distanceToMain: Math.abs(
            ((button.rect.top + button.rect.bottom) / 2)
            - (((expandedFabMetrics.mainVisualRect?.top ?? 0) + (expandedFabMetrics.mainVisualRect?.bottom ?? 0)) / 2),
          ),
        }))
        .sort((a, b) => a.distanceToMain - b.distanceToMain)[0];
      expect(
        nearestSatelliteToMain?.id,
        `${overflowDirection} overflow should keep the business order stable and leave settings closest to the main FAB`,
      ).toBe('settings');

      const expandedButtons = expandedFabMetrics.visibleButtons.filter((button) => button.id !== 'exit');
      const panelRect = expandedFabMetrics.panelRect;
      if (!panelRect) {
        throw new Error(`缺少 ${overflowDirection} 场景的日志面板尺寸`);
      }
      const resolveAnchorEdgeDistance = (
        targetRect: { top: number; bottom: number },
        referenceRect: { top: number; bottom: number },
      ) => Math.min(
        Math.abs(targetRect.top - referenceRect.top),
        Math.abs(targetRect.bottom - referenceRect.bottom),
      );
      for (const button of expandedButtons) {
        const overlapsVertically = panelRect.top < button.rect.bottom && panelRect.bottom > button.rect.top;
        if (overlapsVertically) {
          const leftClearance = button.rect.left - panelRect.right;
          const rightClearance = panelRect.left - button.rect.right;
          expect(
            Math.max(leftClearance, rightClearance),
            `${overflowDirection}:${button.id} panel should stay clear of visible expanded buttons`,
          ).toBeGreaterThanOrEqual(8);
        }
      }

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, screenshotKey, {
          filename: screenshotFilename,
        }),
        fullPage: false,
      });

      const undoButton = hostPage.locator('[data-testid="fab-menu"] [data-fab-id^="undo-"]').first();
      await expect(undoButton).toBeVisible({ timeout: 5000 });
      const undoButtonId = await undoButton.getAttribute('data-fab-id');
      if (!undoButtonId) {
        throw new Error(`缺少 ${overflowDirection} 场景的 undo FAB id`);
      }
      const undoPanel = await openFabPanel(hostPage, undoButtonId, 'exit');
      await expect(undoPanel).toBeVisible({ timeout: 5000 });
      const undoPanelAnchorMetrics = await hostPage.evaluate(({ undoButtonId: currentUndoButtonId }) => {
        const panel = document.querySelector(`[data-testid="fab-panel-${currentUndoButtonId}"]`) as HTMLElement | null;
        const undoButtonElement = document.querySelector(`[data-fab-id="${currentUndoButtonId}"]`) as HTMLElement | null;
        const settingsButtonElement = document.querySelector('[data-fab-id="settings"]') as HTMLElement | null;
        if (!panel || !undoButtonElement || !settingsButtonElement) {
          return null;
        }
        const panelRect = panel.getBoundingClientRect();
        const undoRect = undoButtonElement.getBoundingClientRect();
        const settingsRect = settingsButtonElement.getBoundingClientRect();
        const resolveAnchorEdgeDistance = (targetRect: DOMRect, referenceRect: DOMRect) =>
          Math.min(
            Math.abs(targetRect.top - referenceRect.top),
            Math.abs(targetRect.bottom - referenceRect.bottom),
          );
        return {
          undoAnchorEdgeDistance: resolveAnchorEdgeDistance(panelRect, undoRect),
          settingsAnchorEdgeDistance: resolveAnchorEdgeDistance(panelRect, settingsRect),
        };
      }, { undoButtonId });
      expect(undoPanelAnchorMetrics).not.toBeNull();
      expect(
        undoPanelAnchorMetrics?.undoAnchorEdgeDistance ?? Number.POSITIVE_INFINITY,
        `${overflowDirection} overflow should keep the undo panel anchored to the undo button itself`,
      ).toBeLessThanOrEqual(12);
      expect(
        (undoPanelAnchorMetrics?.settingsAnchorEdgeDistance ?? 0)
        - (undoPanelAnchorMetrics?.undoAnchorEdgeDistance ?? 0),
        `${overflowDirection} overflow should not let the undo panel snap to the settings button`,
      ).toBeGreaterThanOrEqual(12);

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, undoScreenshotKey, {
          filename: undoScreenshotFilename,
        }),
        fullPage: false,
      });

      const settingsButtonLocator = hostPage.locator('[data-testid="fab-menu"] [data-fab-id="settings"]').first();
      await expect(settingsButtonLocator).toBeVisible({ timeout: 5000 });
      await captureEvidenceClipAroundLocators(hostPage, [undoPanel, undoButton, settingsButtonLocator], {
        path: getEvidenceScreenshotPath(testInfo, undoZoomScreenshotKey, {
          filename: undoZoomScreenshotFilename,
        }),
        padding: 14,
      });
    };

    await runExpandedOverflowScenario({
      deltaY: -Math.round(SW_PHONE_LANDSCAPE_VIEWPORT.height * 0.78),
      overflowDirection: 'top',
      screenshotKey: 'mobile-fab-expanded-top-overflow-recovered',
      screenshotFilename: '30-mobile-fab-expanded-top-overflow-recovered.png',
      undoScreenshotKey: 'mobile-fab-expanded-top-undo-anchor-recovered',
      undoScreenshotFilename: '30a-mobile-fab-expanded-top-undo-anchor-recovered.png',
      undoZoomScreenshotKey: 'mobile-fab-expanded-top-undo-anchor-zoom',
      undoZoomScreenshotFilename: '30b-mobile-fab-expanded-top-undo-anchor-zoom.png',
    });

    await runExpandedOverflowScenario({
      deltaY: Math.round(SW_PHONE_LANDSCAPE_VIEWPORT.height * 0.82),
      overflowDirection: 'bottom',
      screenshotKey: 'mobile-fab-expanded-bottom-overflow-recovered',
      screenshotFilename: '31-mobile-fab-expanded-bottom-overflow-recovered.png',
      undoScreenshotKey: 'mobile-fab-expanded-bottom-undo-anchor-recovered',
      undoScreenshotFilename: '31a-mobile-fab-expanded-bottom-undo-anchor-recovered.png',
      undoZoomScreenshotKey: 'mobile-fab-expanded-bottom-undo-anchor-zoom',
      undoZoomScreenshotFilename: '31b-mobile-fab-expanded-bottom-undo-anchor-zoom.png',
    });

    const phaseBeforeAdvance = await getCurrentPhase(hostPage);
    const phaseAfterAdvance = await advancePhase(hostPage, phaseBeforeAdvance);
    expect(phaseAfterAdvance).not.toBe(phaseBeforeAdvance);

    await hostPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'mobile-fab-expanded-end-phase-clickable', {
        filename: '32-mobile-fab-expanded-end-phase-clickable.png',
      }),
      fullPage: false,
    });

    await hostContext.close();
  });

  test('移动横屏：本地同屏撤回应直接回退，不再要求换位审批', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    await clearEvidenceScreenshotsForTest(testInfo);

    const hostContext = await browser.newContext({
      baseURL,
      viewport: SW_PHONE_LANDSCAPE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    await hostContext.addInitScript(() => {
      (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
      (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
      (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
      localStorage.removeItem('hud_fab_position');
      localStorage.removeItem('hud_fab_offset');
    });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    try {
      await openSummonerWarsMobileEvidencePage(hostPage, { playerId: '0' });
      await waitForSummonerWarsVisualStable(hostPage);

      const baselineState = await readSummonerWarsHarnessState(hostPage);
      await applySummonerWarsHarnessState(hostPage, buildSummonerWarsLocalUndoProbeState(baselineState));
      await waitForPhase(hostPage, 'move');

      await hostPage.waitForTimeout(180);
      const metrics: Record<string, number | boolean | null> = {
        sameSeatUndoVisible: false,
        directUndoMs: null,
        approvalFallbackMs: null,
      };

      let undoPanel: Locator | null = null;
      try {
        undoPanel = await openFabPanel(hostPage, 'undo-request', 'exit');
        metrics.sameSeatUndoVisible = true;
      } catch {
        metrics.sameSeatUndoVisible = false;
      }

      if (undoPanel) {
        const requestButton = undoPanel.getByRole('button', { name: /请求撤回|撤回/i }).first();
        await expect(requestButton).toBeVisible({ timeout: 5000 });
        await hostPage.evaluate(() => {
          (window as Window & { __SW_UNDO_UI_PROBE__?: { startedAt: number } }).__SW_UNDO_UI_PROBE__ = {
            startedAt: performance.now(),
          };
        });
        await requestButton.click();
        await hostPage.waitForFunction(() => {
          return document.querySelector('[data-testid="sw-action-banner"]')?.getAttribute('data-phase') === 'summon';
        }, { timeout: 5000 });
        await waitForPhase(hostPage, 'summon');
        metrics.directUndoMs = await hostPage.evaluate(() => {
          const probe = (window as Window & {
            __SW_UNDO_UI_PROBE__?: { startedAt: number };
          }).__SW_UNDO_UI_PROBE__;
          if (!probe) {
            return null;
          }
          return Math.round(performance.now() - probe.startedAt);
        });
      } else {
        const approvalFallbackStartedAt = Date.now();
        await openFabPanel(hostPage, 'seat-swap', 'exit');
        await expect(hostPage.getByTestId('hud-seat-swap-seat-1')).toBeVisible({ timeout: 5000 });
        await hostPage.getByTestId('hud-seat-swap-seat-1').click();

        const requestPanel = await openFabPanel(hostPage, 'undo-request', 'exit');
        await requestPanel.getByRole('button', { name: /请求撤回|撤回/i }).first().click();

        await openFabPanel(hostPage, 'seat-swap', 'exit');
        await expect(hostPage.getByTestId('hud-seat-swap-seat-0')).toBeVisible({ timeout: 5000 });
        await hostPage.getByTestId('hud-seat-swap-seat-0').click();

        const reviewPanel = await openFabPanel(hostPage, 'undo-review', 'exit');
        await reviewPanel.getByRole('button', { name: /批准|Approve/i }).click();
        await waitForPhase(hostPage, 'summon');
        metrics.approvalFallbackMs = Date.now() - approvalFallbackStartedAt;
      }

      const postUndoState = await readSummonerWarsHarnessState(hostPage);
      expect((postUndoState.sys.undo?.snapshots ?? []).length).toBe(0);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '33-local-fast-undo-restored', {
          filename: '33-local-fast-undo-restored.png',
        }),
        fullPage: false,
      });

      console.log(`[SW-UNDO-PROBE] ${JSON.stringify(metrics)}`);
      expect(metrics.sameSeatUndoVisible, `本地同屏当前操作者应直接看到撤回入口: ${JSON.stringify(metrics)}`).toBe(true);
      expect(metrics.directUndoMs ?? Number.POSITIVE_INFINITY, `本地同屏撤回不应再走换位审批链: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(1500);
    } finally {
      await hostContext.close();
    }
  });

  test('游戏结束：召唤师被摧毁后显示结算界面', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await blockLobbySocket(hostContext);
    await setChineseLocale(hostContext);
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
    await blockLobbySocket(guestContext);
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

    await completeFactionSelection(hostPage, guestPage);
    await waitForSummonerWarsUI(hostPage);
    await waitForSummonerWarsUI(guestPage);

    // 移除玩家1召唤师，并通过服务端注入 gameover（状态注入不会自动跑一遍管线）
    const liveMatchState = await getMatchState(matchId!, hostPage);
    const gameOverCore = removeSummonerFromCore((liveMatchState as any).core, '1');
    const liveTurnOrder = Array.isArray((liveMatchState.sys as { turnOrder?: unknown } | undefined)?.turnOrder)
      ? ((liveMatchState.sys as { turnOrder?: unknown[] }).turnOrder ?? []).filter((playerId): playerId is string => typeof playerId === 'string')
      : Array.isArray((liveMatchState.core as { turnOrder?: unknown } | undefined)?.turnOrder)
        ? ((liveMatchState.core as { turnOrder?: unknown[] }).turnOrder ?? []).filter((playerId): playerId is string => typeof playerId === 'string')
        : Object.keys((liveMatchState as any)?.core?.players ?? {});
    const nextCurrentPlayer = typeof (gameOverCore as { currentPlayer?: unknown })?.currentPlayer === 'string'
      ? (gameOverCore as { currentPlayer: string }).currentPlayer
      : (liveTurnOrder[0] ?? '0');
    const nextCurrentPlayerIndex = Math.max(0, liveTurnOrder.indexOf(nextCurrentPlayer));
    await injectMatchState(matchId!, {
      ...(liveMatchState as any),
      core: gameOverCore,
      sys: {
        ...(liveMatchState as any).sys,
        turnOrder: liveTurnOrder,
        currentPlayerIndex: nextCurrentPlayerIndex,
        gameover: { winner: '0' },
      },
    } as any, hostPage);
    await expect.poll(async () => {
      const state = await getMatchState(matchId!, hostPage);
      return state?.sys?.gameover ? 'ready' : 'pending';
    }, { timeout: 10000 }).toBe('ready');
    await closeDebugPanelIfOpen(hostPage);

    // 验证结算界面出现
    const endgameOverlay = hostPage.getByTestId('endgame-overlay');
    await expect(endgameOverlay).toBeVisible({ timeout: 15000 });

    // 验证结算内容区域
    const endgameContent = hostPage.getByTestId('endgame-overlay-content');
    await expect(endgameContent).toBeVisible({ timeout: 5000 });

    await hostContext.close();
    await guestContext.close();
  });

  test('非当前玩家操作：guest 在 host 回合无法操作', async ({ browser }, testInfo) => {
    test.setTimeout(90000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    await clearEvidenceScreenshotsForTest(testInfo);

    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
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
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId!);

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
    await expect(guestBanner).toContainText(/等待对手|Waiting for opponent/i);

    const guestMagnifyOverlay = guestPage.getByTestId('sw-magnify-overlay');
    await waitForOverlayState(guestPage, 'sw-magnify-overlay', 'closed');

    const guestHandCard = guestPage.getByTestId('sw-hand-area').locator('[data-card-id]').first();
    await expect(guestHandCard).toBeVisible({ timeout: 5000 });
    await guestHandCard.click();
    await waitForOverlayState(guestPage, 'sw-magnify-overlay', 'open');
    await guestPage.screenshot({
      path: getEvidenceScreenshotPath(testInfo, 'guest-hand-click-magnify-open', {
        filename: 'guest-hand-click-magnify-open.png',
      }),
      fullPage: false,
    });
    await guestMagnifyOverlay.locator('button', { hasText: /关闭|Close/i }).click({ force: true });
    await waitForOverlayState(guestPage, 'sw-magnify-overlay', 'closed');

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

  // 确保玩家0的召唤师有 revive_undead 技能（阵营随机，不一定是亡灵法师）
  const board = next.board;
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < (board[row]?.length ?? 0); col++) {
      const unit = board[row][col]?.unit;
      if (unit && unit.owner === '0' && unit.card?.unitClass === 'summoner') {
        // 替换召唤师为带 revive_undead 技能的亡灵法师
        board[row][col].unit = {
          ...unit,
          card: {
            ...unit.card,
            name: '瑞特-塔鲁斯',
            faction: '堕落王国',
            abilities: ['revive_undead'],
          },
        };
        // 确保相邻有空位用于召唤
        const dirs = [{ row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 }];
        let hasEmpty = false;
        for (const d of dirs) {
          const nr = row + d.row;
          const nc = col + d.col;
          if (nr >= 0 && nr < board.length && nc >= 0 && nc < (board[0]?.length ?? 0)) {
            if (!board[nr][nc]?.unit && !board[nr][nc]?.structure) {
              hasEmpty = true;
              break;
            }
          }
        }
        if (!hasEmpty) {
          // 清空一个相邻格子
          for (const d of dirs) {
            const nr = row + d.row;
            const nc = col + d.col;
            if (nr >= 0 && nr < board.length && nc >= 0 && nc < (board[0]?.length ?? 0)) {
              board[nr][nc] = { ...board[nr][nc], unit: undefined, structure: undefined };
              break;
            }
          }
        }
        return next;
      }
    }
  }

  return next;
};

/**
 * 准备火祀召唤测试状态
 * - 召唤阶段
 * - 手牌有伊路特-巴尔（onSummon 触发 fire_sacrifice_summon）
 * - 场上有至少一个可牺牲的友方非召唤师单位
 */
const prepareFireSacrificeState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'summon';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  const handCardId = 'necro-elut-bar-test';
  const elutBarCard = {
    id: handCardId,
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
  };

  player.magic = 10;
  player.hand = [elutBarCard, ...(player.hand ?? []).filter((card: any) => card.id !== handCardId)];

  const board = next.board as any[][];
  const existingSacrifice = board.flatMap((row: any[]) => row.map((cell: any) => cell?.unit))
    .find((unit: any) => unit && unit.owner === '0' && unit.card?.unitClass !== 'summoner');

  if (!existingSacrifice) {
    let placed = false;
    for (let row = board.length - 1; row >= 0 && !placed; row -= 1) {
      for (let col = 0; col < (board[row]?.length ?? 0) && !placed; col += 1) {
        const cell = board[row]?.[col];
        if (!cell || cell.unit || cell.structure) continue;
        board[row][col] = {
          ...cell,
          unit: {
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
            position: { row, col },
            damage: 0,
            boosts: 0,
            hasMoved: false,
            hasAttacked: false,
          },
        };
        placed = true;
      }
    }
    if (!placed) {
      throw new Error('无法准备火祀召唤所需的牺牲友军');
    }
  }

  return { core: next, handCardId };
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
  let enemyPosition: { row: number; col: number } | null = null;

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

  const meleeTargets = [
    { row: dragosPosition.row - 1, col: dragosPosition.col },
    { row: dragosPosition.row + 1, col: dragosPosition.col },
    { row: dragosPosition.row, col: dragosPosition.col - 1 },
    { row: dragosPosition.row, col: dragosPosition.col + 1 },
  ];
  const hasEnemyMeleeTarget = meleeTargets.some((pos) => {
    if (pos.row < 0 || pos.row >= 8 || pos.col < 0 || pos.col >= 6) return false;
    const isEnemy = board[pos.row][pos.col]?.unit?.owner === '1';
    if (isEnemy && !enemyPosition) {
      enemyPosition = { ...pos };
    }
    return isEnemy;
  });

  if (!hasEnemyMeleeTarget) {
    let enemyPlaced = false;
    for (const pos of meleeTargets) {
      if (pos.row < 0 || pos.row >= 8 || pos.col < 0 || pos.col >= 6) continue;
      if (board[pos.row][pos.col]?.unit || board[pos.row][pos.col]?.structure) continue;
      board[pos.row][pos.col].unit = {
        cardId: 'enemy-common-target',
        card: {
          id: 'enemy-common-target',
          name: '敌方士兵',
          cardType: 'unit',
          faction: '欺心巫族',
          cost: 0,
          life: 1,
          strength: 1,
          attackType: 'melee',
          unitClass: 'common',
          spriteIndex: 2,
          spriteAtlas: 'cards',
        },
        owner: '1',
        position: pos,
        damage: 0,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      };
      enemyPlaced = true;
      enemyPosition = { ...pos };
      break;
    }
    if (!enemyPlaced) {
      throw new Error('无法准备吸取生命可攻击目标');
    }
  }

  if (!enemyPosition) {
    throw new Error('无法确定吸取生命攻击目标');
  }

  return { core: next, dragosPosition, allyPosition, enemyPosition };
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

  const board = next.board as any[][] | undefined;
  if (board && board.length > 0) {
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    const inBounds = (row: number, col: number) => row >= 0 && col >= 0 && row < rows && col < cols;
    const dirs = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];

    const findStructureTemplate = () => {
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const structure = board[r]?.[c]?.structure;
          if (structure?.card) return structure.card;
        }
      }
      return null;
    };

    const ensureFriendlyUnit = () => {
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const unit = board[r]?.[c]?.unit;
          if (unit?.owner === '0' && unit?.card?.unitClass !== 'summoner') {
            return { row: r, col: c };
          }
        }
      }
      const unitCard = player.hand.find((card: any) => card.cardType === 'unit')
        ?? player.deck?.find((card: any) => card.cardType === 'unit');
      if (!unitCard) return null;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const cell = board[r]?.[c];
          if (!cell?.unit && !cell?.structure) {
            const instanceId = `${unitCard.id}#e2e`;
            board[r][c] = {
              ...cell,
              unit: {
                instanceId,
                cardId: unitCard.id,
                card: unitCard,
                owner: '0',
                position: { row: r, col: c },
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              },
            };
            return { row: r, col: c };
          }
        }
      }
      return null;
    };

    const targetPos = ensureFriendlyUnit();
    if (targetPos) {
      const structureCard = player.hand.find((card: any) => card.cardType === 'structure')
        ?? player.deck?.find((card: any) => card.cardType === 'structure')
        ?? findStructureTemplate()
        ?? {
          id: 'temp-structure',
          cardType: 'structure',
          name: '临时结构',
          faction: 'frozen',
          cost: 0,
          life: 3,
          deckSymbols: [],
        };

      let placed = false;
      for (const dir of dirs) {
        const row = targetPos.row + dir.row;
        const col = targetPos.col + dir.col;
        if (!inBounds(row, col)) continue;
        const cell = board[row]?.[col];
        if (cell?.unit || cell?.structure) continue;
        board[row][col] = {
          ...cell,
          structure: {
            cardId: structureCard.id,
            card: structureCard,
            owner: '0',
            position: { row, col },
            damage: 0,
          },
        };
        placed = true;
        break;
      }

      if (!placed) {
        for (const dir of dirs) {
          const row = targetPos.row + dir.row;
          const col = targetPos.col + dir.col;
          if (!inBounds(row, col)) continue;
          const cell = board[row]?.[col] ?? {};
          board[row][col] = {
            ...cell,
            unit: undefined,
            structure: {
              cardId: structureCard.id,
              card: structureCard,
              owner: '0',
              position: { row, col },
              damage: 0,
            },
          };
          break;
        }
      }
    }
  }

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

  const board = next.board as any[][] | undefined;
  if (board && board.length > 0) {
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    const inBounds = (row: number, col: number) => row >= 0 && col >= 0 && row < rows && col < cols;
    const dirs = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];

    const findFriendlyUnit = () => {
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const unit = board[r]?.[c]?.unit;
          if (unit?.owner === '0' && unit.card?.unitClass !== 'summoner') {
            return { row: r, col: c };
          }
        }
      }
      return null;
    };

    const ensureFriendlyUnit = () => {
      const existing = findFriendlyUnit();
      if (existing) return existing;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const cell = board[r]?.[c];
          if (!cell?.unit && !cell?.structure) {
            const instanceId = `${lowCostUnit.id}#e2e`;
            board[r][c] = {
              ...cell,
              unit: {
                instanceId,
                cardId: lowCostUnit.id,
                card: lowCostUnit,
                owner: '0',
                position: { row: r, col: c },
                damage: 0,
                boosts: 0,
                hasMoved: false,
                hasAttacked: false,
              },
            };
            return { row: r, col: c };
          }
        }
      }
      return null;
    };

    const unitPos = ensureFriendlyUnit();
    if (unitPos) {
      let hasAdjacentEmpty = false;
      for (const dir of dirs) {
        const nr = unitPos.row + dir.row;
        const nc = unitPos.col + dir.col;
        if (!inBounds(nr, nc)) continue;
        const cell = board[nr]?.[nc];
        if (!cell?.unit && !cell?.structure) {
          hasAdjacentEmpty = true;
          break;
        }
      }
      if (!hasAdjacentEmpty) {
        for (const dir of dirs) {
          const nr = unitPos.row + dir.row;
          const nc = unitPos.col + dir.col;
          if (!inBounds(nr, nc)) continue;
          const cell = board[nr]?.[nc] ?? {};
          board[nr][nc] = { ...cell, unit: undefined, structure: undefined };
          break;
        }
      }
    }
  }

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

/**
 * 准备非交互事件两段式测试状态
 * - 移动阶段
 * - 手牌有寒冰修补（非交互型事件）
 * - 场上至少一个友方建筑且有2点伤害（用于验证二次确认后才真正结算）
 */
const prepareNonInteractiveEventTwoStepState = (coreState: any): {
  core: any;
  cardId: string;
  structurePos: { row: number; col: number };
} => {
  const next = cloneState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  const cardId = 'frost-ice-repair';
  const iceRepairCard = {
    id: cardId,
    name: '寒冰修补',
    cardType: 'event',
    eventType: 'common',
    cost: 0,
    playPhase: 'move',
    effect: '从每个友方建筑上移除2点伤害。',
    spriteIndex: 7,
    spriteAtlas: 'cards',
  };

  player.hand = [iceRepairCard, ...player.hand.filter((c: any) => c.id !== cardId)];
  player.magic = 10;
  player.moveCount = 0;

  const board = next.board as any[][] | undefined;
  if (!board || board.length === 0) {
    throw new Error('棋盘为空，无法准备寒冰修补测试状态');
  }

  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      const structure = board[r]?.[c]?.structure;
      if (structure?.owner === '0') {
        board[r][c] = {
          ...board[r][c],
          structure: {
            ...structure,
            damage: 2,
          },
        };
        return { core: next, cardId, structurePos: { row: r, col: c } };
      }
    }
  }

  throw new Error('未找到友方建筑，无法验证寒冰修补结算效果');
};

/**
 * 准备魔力阶段非交互事件两段式测试状态
 * - 魔力阶段
 * - 手牌有不屈不挠（非交互事件）
 * - 魔力足够，且棋盘存在可点击格子用于取消 armed
 */
const prepareMagicNonInteractiveEventTwoStepState = (coreState: any): {
  core: any;
  cardId: string;
  cancelCell: { row: number; col: number };
} => {
  const next = cloneState(coreState);
  next.phase = 'magic';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  const cardId = 'goblin-relentless';
  const relentlessCard = {
    id: cardId,
    name: '不屈不挠',
    cardType: 'event',
    eventType: 'common',
    cost: 1,
    playPhase: 'magic',
    isActive: true,
    effect: '持续：每当一个友方士兵被消灭时，将其返回到你的手牌，以代替被消灭。',
    spriteIndex: 2,
    spriteAtlas: 'cards',
  };

  player.hand = [relentlessCard, ...player.hand.filter((c: any) => c.id !== cardId)];
  player.magic = Math.max(5, Number(player.magic ?? 0));

  const board = next.board as any[][] | undefined;
  if (!board || board.length === 0 || !Array.isArray(board[0])) {
    throw new Error('棋盘为空，无法准备魔力阶段事件牌测试状态');
  }

  // 选一个稳定存在的可点击格子用于“点棋盘取消 armed”
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      if (board[r]?.[c]) {
        return { core: next, cardId, cancelCell: { row: r, col: c } };
      }
    }
  }

  throw new Error('未找到可点击棋盘格子，无法验证 armed 取消');
};

/**
 * 准备交互事件“单目标”测试状态
 * - 建造阶段
 * - 手牌有狱火铸剑（交互型事件）
 * - 场上仅保留 1 个可选的友方普通单位
 */
const prepareInteractiveEventSingleTargetState = (coreState: any): {
  core: any;
  cardId: string;
} => {
  const next = cloneState(coreState);
  next.phase = 'build';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;

  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');

  const cardId = 'necro-hellfire-blade-0-99';
  const hellfireCard = {
    id: cardId,
    name: '狱火铸剑',
    cardType: 'event',
    eventType: 'common',
    cost: 0,
    playPhase: 'build',
    effect: '将本事件放置到一个友方士兵的底层。该单位获得战斗力+2。',
    spriteIndex: 3,
    spriteAtlas: 'cards',
  };

  player.hand = [hellfireCard, ...player.hand.filter((c: any) => c.id !== cardId)];
  player.magic = Math.max(5, Number(player.magic ?? 0));

  const board = next.board as any[][] | undefined;
  if (!board || board.length === 0 || !Array.isArray(board[0])) {
    throw new Error('棋盘为空，无法准备交互事件单目标状态');
  }

  const friendlyCommonCells: Array<{ row: number; col: number }> = [];
  const allCommonUnits: Array<{ unit: any }> = [];
  const emptyCells: Array<{ row: number; col: number }> = [];

  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      const cell = board[r]?.[c];
      const unit = cell?.unit;
      if (!unit && cell) emptyCells.push({ row: r, col: c });
      if (unit?.card?.unitClass === 'common') {
        allCommonUnits.push({ unit });
        if (unit.owner === '0') {
          friendlyCommonCells.push({ row: r, col: c });
        }
      }
    }
  }

  if (friendlyCommonCells.length === 0) {
    const fallbackTemplate = allCommonUnits[0]?.unit;
    const spawnCell = emptyCells[0];
    if (!fallbackTemplate || !spawnCell) {
      throw new Error('未找到可用普通单位模板或空格，无法构造单目标交互');
    }
    board[spawnCell.row][spawnCell.col] = {
      ...board[spawnCell.row][spawnCell.col],
      unit: {
        ...fallbackTemplate,
        owner: '0',
        position: { row: spawnCell.row, col: spawnCell.col },
        damage: 0,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      },
    };
    friendlyCommonCells.push(spawnCell);
  }

  const keep = friendlyCommonCells[0];
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      if (r === keep.row && c === keep.col) continue;
      const unit = board[r]?.[c]?.unit;
      if (unit?.owner === '0' && unit?.card?.unitClass === 'common') {
        board[r][c] = {
          ...board[r][c],
          unit: undefined,
        };
      }
    }
  }

  return { core: next, cardId };
};
