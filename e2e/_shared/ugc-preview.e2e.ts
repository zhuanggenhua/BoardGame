import { test, expect, type BrowserContext, type FrameLocator, type Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const PACKAGE_ID = 'doudizhu-preview';
const GAME_NAME = /斗地主预览/i;

const disableTutorial = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('tutorial_skip', '1');
  });
};

const disableAudio = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('audio_muted', 'true');
    localStorage.setItem('audio_master_volume', '0');
    (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
  });
};

const resetMatchIdentity = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('e2e_identity_reset') === '1') {
      return;
    }
    localStorage.removeItem('owner_active_match');
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('match_creds_')) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem('guest_id');
    const guestId = `${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
    localStorage.setItem('guest_id', guestId);
    document.cookie = `bg_guest_id=${encodeURIComponent(guestId)}; path=/; SameSite=Lax`;
    sessionStorage.setItem('e2e_identity_reset', '1');
  });
};

const blockAudioRequests = async (context: BrowserContext) => {
  await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

const dismissViteOverlay = async (page: Page) => {
  await page.evaluate(() => {
    const overlay = document.querySelector('vite-error-overlay');
    if (overlay) overlay.remove();
  });
};

const dismissLobbyConfirmIfNeeded = async (page: Page) => {
  const confirmButton = page
    .locator('button:has-text("确认")')
    .first();
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
  }
};

const waitForHomeGameList = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('[data-game-id]', { timeout: 15000, state: 'attached' });
};

const waitForMatchCredentials = async (page: Page) => {
  const url = new URL(page.url());
  const matchId = url.pathname.split('/match/')[1]?.split('/')[0];
  if (!matchId) return;
  await expect.poll(async () => {
    return page.evaluate((id) => {
      const raw = localStorage.getItem(`match_creds_${id}`);
      if (!raw) return false;
      try {
        const data = JSON.parse(raw) as { playerID?: string; credentials?: string };
        return Boolean(data?.playerID && data?.credentials);
      } catch {
        return false;
      }
    }, matchId);
  }).toBe(true);
};

const getMatchIdFromUrl = (page: Page) => new URL(page.url()).pathname.split('/match/')[1]?.split('/')[0];

const readStoredMatchPlayerId = async (page: Page, matchId?: string) => {
  if (!matchId) return null;
  const raw = await page.evaluate((id) => localStorage.getItem(`match_creds_${id}`), matchId);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { playerID?: string };
    return data.playerID ?? null;
  } catch {
    return null;
  }
};

const ensureJoinedMatch = async (page: Page) => {
  const getPlayerId = () => new URL(page.url()).searchParams.get('playerID');
  if (getPlayerId()) return getPlayerId();

  const matchId = getMatchIdFromUrl(page);
  const storedPlayerId = await readStoredMatchPlayerId(page, matchId);
  if (storedPlayerId) {
    const targetUrl = new URL(page.url());
    targetUrl.searchParams.set('playerID', storedPlayerId);
    await page.goto(targetUrl.toString(), { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).searchParams.get('playerID')).not.toBeNull();
    return getPlayerId();
  }

  const joinUrl = new URL(page.url());
  joinUrl.searchParams.set('join', 'true');
  await page.goto(joinUrl.toString(), { waitUntil: 'domcontentloaded' });
  await expect.poll(() => new URL(page.url()).searchParams.get('playerID')).not.toBeNull();
  return getPlayerId();
};

const getGameServerBaseURL = () => process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL || 'http://localhost:18000';

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

const ensureHostSeat = async (page: Page, matchId?: string) => {
  if (!matchId) return;
  const guestId = await page.evaluate(() => localStorage.getItem('guest_id'));
  const playerName = 'E2E_Player';
  const url = `${getGameServerBaseURL()}/games/${PACKAGE_ID}/${matchId}/claim-seat`;
  const response = await page.request.post(url, {
    data: {
      playerID: '0',
      guestId,
      playerName,
    },
  });
  if (!response.ok()) {
    throw new Error(`claim-seat failed: ${response.status()} ${response.statusText()}`);
  }
  const data = await response.json() as { playerCredentials?: string } | null;
  const credentials = data?.playerCredentials;
  if (!credentials) {
    throw new Error('claim-seat missing credentials');
  }
  await page.evaluate(({ id, playerID, credentials }) => {
    localStorage.setItem(`match_creds_${id}`,
      JSON.stringify({ matchID: id, playerID, credentials, updatedAt: Date.now() }));
    window.dispatchEvent(new Event('match-credentials-changed'));
  }, { id: matchId, playerID: '0', credentials });
  await page.goto(`/play/${PACKAGE_ID}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
};

const ensurePlayerSeat = async (page: Page) => {
  const currentUrl = new URL(page.url());
  if (currentUrl.searchParams.get('playerID')) return;

  const matchIdMatch = currentUrl.pathname.match(/\/play\/[^/]+\/match\/([^/]+)/);
  const matchId = matchIdMatch?.[1];
  if (!matchId) return;

  const storedPlayerId = await page.evaluate((id) => {
    const raw = localStorage.getItem(`match_creds_${id}`);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as { playerID?: string };
      return data.playerID ?? null;
    } catch {
      return null;
    }
  }, matchId);

  if (!storedPlayerId) return;

  currentUrl.searchParams.set('playerID', storedPlayerId);
  await page.goto(currentUrl.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/playerID=/, { timeout: 10000 });
};


type RuntimeState = {
  phase?: string;
  activePlayerId?: string;
  publicZones?: Record<string, unknown>;
  gameOver?: { winner?: string };
};

const getPlayerOrder = (state: RuntimeState | null) => {
  const zones = state?.publicZones as Record<string, unknown> | undefined;
  const order = Array.isArray(zones?.playerOrder)
    ? (zones?.playerOrder as Array<string | number>).map(id => String(id))
    : [];
  if (order.length > 0) return order;
  const players = state && typeof state === 'object' ? (state as { players?: Record<string, unknown> }).players : null;
  return players ? Object.keys(players) : [];
};

const getNextPlayerId = (order: string[], currentPlayerId: string) => {
  if (order.length === 0) return currentPlayerId;
  const index = order.indexOf(currentPlayerId);
  if (index < 0) return order[0];
  return order[(index + 1) % order.length];
};

const getHandCardId = (state: RuntimeState | null, playerId: string) => {
  const zones = state?.publicZones as Record<string, unknown> | undefined;
  const hands = zones?.hands as Record<string, Array<{ id?: string } | string>> | undefined;
  const hand = hands?.[playerId];
  const firstCard = hand?.[0];
  if (!firstCard) return null;
  if (typeof firstCard === 'string') return firstCard;
  if (typeof firstCard.id === 'string') return firstCard.id;
  return null;
};

const requestRuntimeState = async (frame: FrameLocator) => {
  try {
    return await frame.locator('body').evaluate(async () => {
      return new Promise<RuntimeState | null>((resolve) => {
        const handler = (event: MessageEvent) => {
          const data = event.data as { source?: string; type?: string; payload?: { state?: RuntimeState } } | undefined;
          if (data?.source !== 'ugc-host' || data.type !== 'STATE_UPDATE') return;
          window.removeEventListener('message', handler);
          resolve(data.payload?.state ?? null);
        };
        window.addEventListener('message', handler);
        window.parent.postMessage({
          id: `state-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: 'ugc-view',
          type: 'STATE_REQUEST',
          timestamp: Date.now(),
        }, '*');
        window.setTimeout(() => {
          window.removeEventListener('message', handler);
          resolve(null);
        }, 1500);
      });
    });
  } catch (error) {
    if (error instanceof Error && /frame was detached/i.test(error.message)) {
      return null;
    }
    throw error;
  }
};

const waitForRuntimeState = async (frame: FrameLocator): Promise<RuntimeState> => {
  let latest: RuntimeState | null = null;
  await expect.poll(async () => {
    latest = await requestRuntimeState(frame);
    return Boolean(latest?.activePlayerId);
  }).toBe(true);
  if (!latest) {
    throw new Error('运行时状态获取失败');
  }
  return latest;
};

const sendRuntimeCommand = async (
  frame: FrameLocator,
  commandType: string,
  playerId: string,
  params: Record<string, unknown> = {},
) => {
  return frame.locator('body').evaluate(async (_, { commandType, playerId, params }) => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const requestId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const handler = (event: MessageEvent) => {
        const data = event.data as {
          source?: string;
          type?: string;
          payload?: { requestId?: string; success?: boolean; error?: string };
        } | undefined;
        if (data?.source !== 'ugc-host' || data.type !== 'COMMAND_RESULT') return;
        if (data.payload?.requestId !== requestId) return;
        window.removeEventListener('message', handler);
        resolve({ success: Boolean(data.payload?.success), error: data.payload?.error });
      };
      window.addEventListener('message', handler);
      window.parent.postMessage({
        id: requestId,
        source: 'ugc-view',
        type: 'COMMAND',
        timestamp: Date.now(),
        payload: {
          commandType,
          playerId,
          params,
        },
      }, '*');
      window.setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ success: false, error: 'command_result_timeout' });
      }, 3000);
    });
  }, { commandType, playerId, params });
};

const waitForActivePlayer = async (frame: FrameLocator, playerId: string) => {
  await expect.poll(async () => (await requestRuntimeState(frame))?.activePlayerId).toBe(playerId);
};

const waitForHighestBid = async (frame: FrameLocator, score: number) => {
  await expect.poll(async () => {
    const state = await requestRuntimeState(frame);
    const zones = state?.publicZones as Record<string, unknown> | undefined;
    return Number(zones?.highestBid ?? 0);
  }).toBe(score);
};

const expectCommandSuccess = (result: { success: boolean; error?: string } | null, label: string) => {
  expect(result, `${label} 未收到结果`).not.toBeNull();
  expect(result?.success, `${label} 失败: ${result?.error || '未知错误'}`).toBe(true);
};

test.describe('UGC 斗地主预览流程', () => {
  test('大厅可见并能进入 UGC 对局（截图）', async ({ browser }, testInfo) => {
    test.setTimeout(180000); // 增加超时时间以支持多客户端
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    // 创建房主客户端
    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setChineseLocale(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext);
    await resetMatchIdentity(hostContext);

    const hostPage = await hostContext.newPage();
    hostPage.on('pageerror', (error) => {
      console.log('[Host pageerror]', error.message);
    });
    hostPage.on('console', (message) => {
      if (message.type() === 'error') {
        console.log('[Host console-error]', message.text());
      }
    });

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable');
    }

    // 房主创建房间
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(hostPage);
    await dismissLobbyConfirmIfNeeded(hostPage);
    await waitForHomeGameList(hostPage);

    const ugcCard = hostPage.locator(`[data-game-id="${PACKAGE_ID}"]`).first();
    await expect(ugcCard).toBeVisible({ timeout: 20000 });

    await hostPage.screenshot({ path: testInfo.outputPath('ugc-preview-lobby.png'), fullPage: true });

    await ugcCard.click();
    await expect(hostPage).toHaveURL(/game=doudizhu-preview/);

    const modalRoot = hostPage.locator('#modal-root');
    await expect(modalRoot.getByRole('heading', { name: GAME_NAME })).toBeVisible({ timeout: 15000 });

    const lobbyTab = modalRoot.getByRole('button', { name: /Lobby|在线大厅/i });
    if (await lobbyTab.isVisible().catch(() => false)) {
      await lobbyTab.click();
    }

    const createButton = modalRoot.locator('button:visible', { hasText: /创建房间/i }).first();
    await expect(createButton).toBeVisible({ timeout: 20000 });
    await createButton.click();

    await expect(hostPage.getByRole('heading', { name: /创建房间/i })).toBeVisible({ timeout: 10000 });
    const confirmButton = hostPage.getByRole('button', { name: /确认/i });
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();

    await hostPage.waitForURL(/\/play\/doudizhu-preview\/match\//, { timeout: 15000 });
    const matchId = getMatchIdFromUrl(hostPage);
    await ensureHostSeat(hostPage, matchId);
    await waitForMatchCredentials(hostPage);
    await expect.poll(() => new URL(hostPage.url()).searchParams.get('playerID')).toBe('0');

    // 创建其他玩家客户端
    const player2Context = await browser.newContext({ baseURL });
    await blockAudioRequests(player2Context);
    await setChineseLocale(player2Context);
    await disableAudio(player2Context);
    await disableTutorial(player2Context);
    
    const player2Page = await player2Context.newPage();
    player2Page.on('pageerror', (error) => {
      console.log('[Player2 pageerror]', error.message);
    });
    player2Page.on('console', (message) => {
      if (message.type() === 'error') {
        console.log('[Player2 console-error]', message.text());
      }
    });

    const player3Context = await browser.newContext({ baseURL });
    await blockAudioRequests(player3Context);
    await setChineseLocale(player3Context);
    await disableAudio(player3Context);
    await disableTutorial(player3Context);
    
    const player3Page = await player3Context.newPage();
    player3Page.on('pageerror', (error) => {
      console.log('[Player3 pageerror]', error.message);
    });
    player3Page.on('console', (message) => {
      if (message.type() === 'error') {
        console.log('[Player3 console-error]', message.text());
      }
    });

    // 玩家 2 和 3 加入房间
    await player2Page.goto(`/play/${PACKAGE_ID}/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await ensurePlayerSeat(player2Page);
    
    await player3Page.goto(`/play/${PACKAGE_ID}/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    await ensurePlayerSeat(player3Page);

    // 等待所有玩家的 iframe 加载完成
    await hostPage.waitForTimeout(2000);
    await player2Page.waitForTimeout(2000);
    await player3Page.waitForTimeout(2000);

    // 获取各玩家的 iframe
    const hostFrame = hostPage.frameLocator(`iframe[title="UGC Remote Host ${PACKAGE_ID}"]`);
    const player2Frame = player2Page.frameLocator(`iframe[title="UGC Remote Host ${PACKAGE_ID}"]`);
    const player3Frame = player3Page.frameLocator(`iframe[title="UGC Remote Host ${PACKAGE_ID}"]`);

    // 验证房主的 iframe 已加载
    await expect(hostFrame.locator('[data-testid="ugc-preview-canvas"]')).toBeVisible({ timeout: 20000 });

    // 验证所有玩家的 UI 已加载
    const hostHandArea = hostFrame.locator('[data-component-id="hand-bottom"] [data-hand-area="root"]');
    await expect(hostHandArea).toBeVisible({ timeout: 20000 });

    // 获取初始状态
    const bidState = await waitForRuntimeState(hostFrame);
    expect(bidState?.phase).toBe('bid');
    const bidPlayerId = String(bidState?.activePlayerId || 'player-1');
    const bidOrder = getPlayerOrder(bidState);

    console.log('游戏开始，叫分阶段，当前玩家:', bidPlayerId, '玩家顺序:', bidOrder);

    // 玩家 1 叫分（假设 player-1 是第一个叫分的）
    if (bidPlayerId === 'player-1') {
      const bidResult = await sendRuntimeCommand(hostFrame, 'BID', bidPlayerId, { score: 1 });
      expectCommandSuccess(bidResult, '玩家1叫分');
      await waitForHighestBid(hostFrame, 1);
    }

    // 等待状态更新
    await hostPage.waitForTimeout(1000);
    const afterBidState = await requestRuntimeState(hostFrame);
    const callLandlordPlayerId = String(afterBidState?.activePlayerId || 'player-2');
    
    console.log('叫分后，当前玩家:', callLandlordPlayerId);

    // 根据当前玩家选择对应的客户端发送命令
    let callLandlordFrame: typeof hostFrame;
    if (callLandlordPlayerId === 'player-1') {
      callLandlordFrame = hostFrame;
      console.log('玩家1抢地主');
    } else if (callLandlordPlayerId === 'player-2') {
      callLandlordFrame = player2Frame;
      console.log('玩家2抢地主');
    } else {
      callLandlordFrame = player3Frame;
      console.log('玩家3抢地主');
    }

    const callLandlordResult = await sendRuntimeCommand(callLandlordFrame, 'CALL_LANDLORD', callLandlordPlayerId);
    expectCommandSuccess(callLandlordResult, '抢地主');
    
    // 等待进入出牌阶段
    await expect.poll(async () => (await requestRuntimeState(hostFrame))?.phase).toBe('action');
    const actionState = await requestRuntimeState(hostFrame);
    const actionZones = actionState?.publicZones as Record<string, unknown> | undefined;
    const landlordId = String(actionZones?.landlordId || callLandlordPlayerId);
    
    console.log('地主:', landlordId);

    const actionOrder = getPlayerOrder(actionState);
    const nextPlayerId = getNextPlayerId(actionOrder, landlordId);
    const thirdPlayerId = getNextPlayerId(actionOrder, nextPlayerId);

    console.log('出牌顺序:', landlordId, '→', nextPlayerId, '→', thirdPlayerId);

    // 选择对应的 frame
    const getFrameForPlayer = (playerId: string) => {
      if (playerId === 'player-1') return hostFrame;
      if (playerId === 'player-2') return player2Frame;
      return player3Frame;
    };

    // 进行几轮出牌测试
    for (let i = 0; i < 5; i += 1) {
      await waitForActivePlayer(hostFrame, landlordId);
      let loopState = await requestRuntimeState(hostFrame);
      if (loopState?.gameOver?.winner) break;

      const cardId = getHandCardId(loopState, landlordId);
      if (!cardId) break;

      const landlordFrame = getFrameForPlayer(landlordId);
      const playResult = await sendRuntimeCommand(landlordFrame, 'PLAY_CARD', landlordId, { cardIds: [cardId] });
      expectCommandSuccess(playResult, `地主出牌 ${i + 1}`);
      
      loopState = await requestRuntimeState(hostFrame);
      if (loopState?.gameOver?.winner) break;

      await waitForActivePlayer(hostFrame, nextPlayerId);
      const nextFrame = getFrameForPlayer(nextPlayerId);
      const nextPassResult = await sendRuntimeCommand(nextFrame, 'PASS', nextPlayerId);
      expectCommandSuccess(nextPassResult, `玩家${nextPlayerId}不出`);
      
      loopState = await requestRuntimeState(hostFrame);
      if (loopState?.gameOver?.winner) break;

      await waitForActivePlayer(hostFrame, thirdPlayerId);
      const thirdFrame = getFrameForPlayer(thirdPlayerId);
      const thirdPassResult = await sendRuntimeCommand(thirdFrame, 'PASS', thirdPlayerId);
      expectCommandSuccess(thirdPassResult, `玩家${thirdPlayerId}不出`);
    }

    const finalState = await requestRuntimeState(hostFrame);
    console.log('游戏结束，胜者:', finalState?.gameOver?.winner);

    await hostPage.screenshot({ path: testInfo.outputPath('ugc-preview-match.png'), fullPage: true });

    // 清理所有客户端
    await hostContext.close();
    await player2Context.close();
    await player3Context.close();
  });
});
