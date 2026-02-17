/**
 * DiceThrone E2E 测试辅助函数
 */

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
    getGameServerBaseURL,
    blockAudioRequests,
    setEnglishLocale,
    resetMatchStorage,
    disableTutorial,
    disableAudio,
    dismissViteOverlay,
    waitForHomeGameList,
    dismissLobbyConfirmIfNeeded,
    ensureGameServerAvailable,
    initContext,
} from './common';

const GAME_NAME = 'dicethrone';

// ============================================================================
// API 交互
// ============================================================================

export const createDTRoomViaAPI = async (page: Page, guestId?: string): Promise<string | null> => {
    try {
        const actualGuestId = guestId ?? `dt_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const gameServerBaseURL = getGameServerBaseURL();
        const url = `${gameServerBaseURL}/games/${GAME_NAME}/create`;
        
        const response = await page.request.post(url, {
            data: { numPlayers: 2, setupData: { guestId: actualGuestId } },
        });
        
        if (!response.ok()) return null;
        const data = (await response.json().catch(() => null)) as { matchID?: string } | null;
        return data?.matchID ?? null;
    } catch {
        return null;
    }
};

export const joinDTMatchViaAPI = async (
    page: Page,
    matchId: string,
    playerId: string,
    playerName: string,
    guestId?: string,
): Promise<string | null> => {
    const gameServerBaseURL = getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/join`;
    
    const response = await page.request.post(url, {
        data: {
            playerID: playerId,
            playerName,
            ...(guestId ? { data: { guestId } } : {}),
        },
    });
    
    if (!response.ok()) return null;
    const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
    return data?.playerCredentials ?? null;
};

export const seedDTMatchCredentials = async (
    context: BrowserContext,
    matchId: string,
    playerId: string,
    credentials: string,
) => {
    await context.addInitScript(
        ({ matchId, playerId, credentials }) => {
            const payload = {
                matchID: matchId,
                playerID: playerId,
                credentials,
                gameName: 'dicethrone',
                updatedAt: Date.now(),
            };
            localStorage.setItem(`match_creds_${matchId}`, JSON.stringify(payload));
            window.dispatchEvent(new Event('match-credentials-changed'));
        },
        { matchId, playerId, credentials },
    );
};

// ============================================================================
// 游戏交互
// ============================================================================

export const waitForCharacterSelection = async (page: Page, timeout = 20000) => {
    await expect(page.locator('h2').filter({ hasText: /选择你的英雄|Select Your Hero/i })).toBeVisible({ timeout });
};

export const selectCharacter = async (page: Page, characterId: string) => {
    const characterCard = page.locator(`[data-character-id="${characterId}"]`);
    await expect(characterCard).toBeVisible({ timeout: 8000 });
    await characterCard.click();
    
    // DiceThrone 的角色选择不需要确认按钮，点击后直接选中
    // 等待一小段时间让状态更新
    await page.waitForTimeout(500);
};

export const readyAndStartGame = async (hostPage: Page, guestPage: Page) => {
    // Guest 点击准备按钮
    const guestReadyButton = guestPage.getByRole('button', { name: /Ready|准备/i });
    await expect(guestReadyButton).toBeVisible({ timeout: 5000 });
    await guestReadyButton.click();
    
    // 等待 Guest 页面状态更新（显示 "Ready, Waiting..." 或类似文本）
    await guestPage.waitForTimeout(500);
    
    // 等待 Host 页面接收到 Guest 的 Ready 状态并显示开始按钮
    // Host 点击开始游戏按钮 - 使用更宽松的选择器
    const hostStartButton = hostPage.getByRole('button', { name: /Start Game|开始游戏|Press.*Start|按.*开始/i });
    
    // 等待按钮出现并启用（给足够时间让 WebSocket 同步状态）
    await expect(hostStartButton).toBeVisible({ timeout: 10000 });
    await expect(hostStartButton).toBeEnabled({ timeout: 5000 });
    
    await hostStartButton.click();
    await hostPage.waitForTimeout(500);
};

export const waitForGameBoard = async (page: Page, timeout = 30000) => {
    // 等待游戏棋盘的关键元素出现（使用 tutorial-id 定位骰子投掷按钮）
    await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout });
};

// ============================================================================
// 双人对局设置
// ============================================================================

export interface DTMatchSetup {
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    hostPage: Page;
    guestPage: Page;
    matchId: string;
}

export const setupDTOnlineMatch = async (
    browser: Browser,
    baseURL: string | undefined,
): Promise<DTMatchSetup | null> => {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false });
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) return null;

    const hostGuestId = `e2e_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const matchId = await createDTRoomViaAPI(hostPage, hostGuestId);
    if (!matchId) return null;

    const hostCredentials = await joinDTMatchViaAPI(hostPage, matchId, '0', `Host-${Date.now()}`, hostGuestId);
    if (!hostCredentials) return null;

    await seedDTMatchCredentials(hostContext, matchId, '0', hostCredentials);
    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForCharacterSelection(hostPage);

    const guestContext = await browser.newContext({ baseURL });
    await initContext(guestContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false });
    const guestPage = await guestContext.newPage();

    // 先导航到首页，确保 guestPage 有正确的 cookie
    await guestPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await guestPage.waitForTimeout(500);

    const guestGuestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    // 使用 guestPage 的 request 而不是 hostPage，确保 cookie 正确
    const guestCredentials = await joinDTMatchViaAPI(guestPage, matchId, '1', `Guest-${Date.now()}`, guestGuestId);
    if (!guestCredentials) return null;

    await seedDTMatchCredentials(guestContext, matchId, '1', guestCredentials);
    await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    await waitForCharacterSelection(guestPage);

    return { hostContext, guestContext, hostPage, guestPage, matchId };
};

export const cleanupDTMatch = async (setup: DTMatchSetup) => {
    await setup.guestContext.close();
    await setup.hostContext.close();
};


// ============================================================================
// 调试面板操作
// ============================================================================

/** 确保调试面板打开 */
export const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

/** 确保调试面板关闭 */
export const ensureDebugPanelClosed = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isHidden().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeHidden({ timeout: 5000 });
};

/** 切换到调试面板的状态 Tab */
export const ensureDebugStateTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
};

/** 切换到调试面板的控制 Tab */
export const ensureDebugControlsTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const controlsTab = page.getByTestId('debug-tab-controls');
    if (await controlsTab.isVisible().catch(() => false)) {
        await controlsTab.click();
    }
};

/**
 * 读取 core 状态
 */
export const readCoreState = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.core ?? parsed?.G?.core ?? parsed;
};

/**
 * 读取事件流（EventStream）
 */
export const readEventStream = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    const sys = parsed?.sys ?? parsed?.G?.sys;
    return sys?.eventStream?.entries ?? [];
};

/**
 * 直接注入 core 状态（使用调试面板）
 */
export const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};

/**
 * 通过调试面板修改资源值
 */
export const setPlayerResource = async (page: Page, playerId: string, resourceId: string, value: number) => {
    const state = await readCoreState(page);
    if (!state.players || !state.players[playerId]) {
        throw new Error(`Player ${playerId} not found in state`);
    }
    state.players[playerId].resources[resourceId] = value;
    await applyCoreStateDirect(page, state);
};

/**
 * 通过调试面板设置玩家 token
 */
export const setPlayerToken = async (page: Page, playerId: string, tokenId: string, amount: number) => {
    const state = await readCoreState(page);
    if (!state.players || !state.players[playerId]) {
        throw new Error(`Player ${playerId} not found in state`);
    }
    if (!state.players[playerId].tokens) {
        state.players[playerId].tokens = {};
    }
    state.players[playerId].tokens[tokenId] = amount;
    await applyCoreStateDirect(page, state);
};

/**
 * 设置骰子值（通过调试面板）
 */
export const applyDiceValues = async (page: Page, values: number[]) => {
    const state = await readCoreState(page);
    if (!state.dice || state.dice.length === 0) {
        throw new Error('No dice found in state');
    }
    // 更新骰子值
    state.dice = state.dice.map((die: any, i: number) => ({
        ...die,
        value: values[i] ?? die.value,
        symbol: values[i] ?? die.value, // 简化处理，实际应该根据 definitionId 查找 face
        symbols: [values[i] ?? die.value],
    }));
    state.rollConfirmed = false; // 允许用户重新确认
    await applyCoreStateDirect(page, state);
};

/**
 * 通过 dispatch 修改状态（已废弃，使用 applyCoreStateDirect 替代）
 */
export const patchCoreViaDispatch = async (page: Page, patch: unknown) => {
    const state = await readCoreState(page);
    const patched = { ...state, ...patch };
    await applyCoreStateDirect(page, patched);
};

// ============================================================================
// 其他辅助函数
// ============================================================================

/**
 * 等待主要阶段
 */
export const waitForMainPhase = async (page: Page, timeout = 20000) => {
    await expect(page.getByText(/Main Phase|主要阶段/i)).toBeVisible({ timeout });
};

/**
 * 等待棋盘准备就绪
 */
export const waitForBoardReady = async (page: Page, timeout = 30000) => {
    await waitForGameBoard(page, timeout);
};

/**
 * 从 URL 获取玩家 ID
 */
export const getPlayerIdFromUrl = (page: Page): string | null => {
    const url = page.url();
    const match = url.match(/playerID=(\d+)/);
    return match ? match[1] : null;
};

/**
 * 获取模态框容器（通过标题）
 */
export const getModalContainerByHeading = (page: Page, heading: string | RegExp) => {
    return page.locator('[role="dialog"]').filter({ has: page.getByRole('heading', { name: heading }) });
};

/**
 * 断言手牌可见
 */
export const assertHandCardsVisible = async (page: Page) => {
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });
    const cards = handArea.locator('[data-card-id]');
    await expect(cards.first()).toBeVisible({ timeout: 3000 });
};

/**
 * 等待教学步骤
 */
export const waitForTutorialStep = async (page: Page, stepId: string, timeout = 10000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

/**
 * 分发本地命令
 */
export const dispatchLocalCommand = async (page: Page, command: { type: string; payload?: unknown }) => {
    await page.evaluate((cmd) => {
        const dispatch = (window as any).__BG_DISPATCH__;
        if (dispatch) {
            dispatch(cmd);
        }
    }, command);
    await page.waitForTimeout(300);
};

/**
 * 关闭调试面板（如果打开）
 */
export const closeDebugPanelIfOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeHidden({ timeout: 5000 });
    }
};

/**
 * 设置在线对局（旧版兼容函数）
 */
export const setupOnlineMatch = setupDTOnlineMatch;
