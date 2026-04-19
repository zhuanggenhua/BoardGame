/**
 * DiceThrone E2E 测试辅助函数
 */

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
    getGameServerBaseURL,
    ensureGameServerAvailable,
    initContext,
} from './common';

const GAME_NAME = 'dicethrone';

// ============================================================================
// API 交互
// ============================================================================

type CreateDTRoomOptions = {
    guestId?: string;
    numPlayers?: number;
    setupData?: Record<string, unknown>;
    gameServerBaseURL?: string;
};

export const createDTRoomViaAPI = async (
    page: Page,
    guestIdOrOptions?: string | CreateDTRoomOptions,
): Promise<string | null> => {
    try {
        const options = typeof guestIdOrOptions === 'string' || !guestIdOrOptions
            ? { guestId: guestIdOrOptions }
            : guestIdOrOptions;
        const actualGuestId = options.guestId ?? `dt_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const gameServerBaseURL = options.gameServerBaseURL ?? getGameServerBaseURL();
        const numPlayers = options.numPlayers ?? 2;
        const url = `${gameServerBaseURL}/games/${GAME_NAME}/create`;
        
        const response = await page.request.post(url, {
            data: {
                numPlayers,
                setupData: {
                    ...(options.setupData ?? {}),
                    guestId: actualGuestId,
                },
            },
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

export const claimDTSeatViaAPI = async (
    page: Page,
    matchId: string,
    playerId: string,
    options: {
        guestId?: string;
        playerName?: string;
        gameServerBaseURL?: string;
    } = {},
): Promise<string | null> => {
    const gameServerBaseURL = options.gameServerBaseURL ?? getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/claim-seat`;

    const response = await page.request.post(url, {
        data: {
            playerID: playerId,
            playerName: options.playerName ?? `Player-${playerId}`,
            ...(options.guestId ? { guestId: options.guestId } : {}),
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

export const waitForCharacterSelection = async (page: Page, timeout = 60000) => {
    // NOTE: 角色选择页标题在部分环境下可能出现偶发定位失败（疑似与文本/渲染时序有关）。
    // 这里改用更稳定的结构锚点：角色卡片的 data-character-id。
    await expect(page.locator('[data-character-id]').first()).toBeVisible({ timeout });
};

export const selectCharacter = async (page: Page, characterId: string) => {
    let characterCard = page.locator(`[data-character-id="${characterId}"]`);
    if ((await characterCard.count()) === 0) {
        // 兼容：部分角色卡在某些构建/渲染路径下可能没有挂 `data-character-id`（例如列表虚拟化/禁用态包装）。
        // 这里提供最小 fallback：按可见名称文字点击，以避免 E2E 因 DOM 标识缺失而假失败。
        const fallbackName =
            characterId === 'samurai'
                ? /武士|Samurai/i
                : characterId === 'gunslinger'
                    ? /枪手|Gunslinger/i
                    : null;
        if (fallbackName) {
            characterCard = page.getByText(fallbackName).first();
        }
    }

    await expect(characterCard).toBeVisible({ timeout: 12000 });
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

export const readyMultiplePlayersAndStartGame = async (
    hostPage: Page,
    guestPages: Page[],
) => {
    for (const page of guestPages) {
        const readyButton = page.getByRole('button', { name: /Ready|准备/i });
        await expect(readyButton).toBeVisible({ timeout: 5000 });
        await readyButton.click();
        await page.waitForTimeout(300);
    }

    const hostStartButton = hostPage.getByRole('button', { name: /Start Game|开始游戏|Press.*Start|按.*开始/i });
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

export type DTPlayerSetup = {
    id: string;
    page: Page;
    context: BrowserContext;
};

export interface DTMultiMatchSetup {
    hostContext: BrowserContext;
    hostPage: Page;
    matchId: string;
    players: DTPlayerSetup[];
    guestPage?: Page;
    guestContext?: BrowserContext;
    extraPlayers?: DTPlayerSetup[];
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

export const setupDTOnlineMatchWithPlayers = async (
    browser: Browser,
    baseURL: string | undefined,
    options: {
        numPlayers: number;
        gameServerBaseURL?: string;
        joinPlayerIds?: string[];
        setupData?: Record<string, unknown>;
    },
): Promise<DTMultiMatchSetup | null> => {
    const numPlayers = options.numPlayers;
    const gameServerBaseURL = options.gameServerBaseURL ?? getGameServerBaseURL();
    const joinPlayerIds = options.joinPlayerIds?.length
        ? options.joinPlayerIds
        : Array.from({ length: numPlayers - 1 }, (_, index) => String(index + 1));

    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false });
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    if (!(await ensureGameServerAvailable(hostPage, gameServerBaseURL))) {
        await hostContext.close();
        return null;
    }

    const hostGuestId = `dt_e2e_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const matchId = await createDTRoomViaAPI(hostPage, {
        guestId: hostGuestId,
        numPlayers,
        gameServerBaseURL,
        setupData: options.setupData,
    });
    if (!matchId) {
        await hostContext.close();
        return null;
    }

    const hostCredentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
        guestId: hostGuestId,
        playerName: `Host-${Date.now()}`,
        gameServerBaseURL,
    });
    if (!hostCredentials) {
        await hostContext.close();
        return null;
    }

    await seedDTMatchCredentials(hostContext, matchId, '0', hostCredentials);
    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForCharacterSelection(hostPage);

    const playersById = new Map<string, DTPlayerSetup>([
        ['0', { id: '0', page: hostPage, context: hostContext }],
    ]);
    const extraPlayers: DTPlayerSetup[] = [];

    for (const playerId of joinPlayerIds) {
        const guestContext = await browser.newContext({ baseURL });
        await initContext(guestContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false });
        const guestPage = await guestContext.newPage();

        await guestPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await guestPage.waitForTimeout(300);

        const guestGuestId = `dt_e2e_guest_${playerId}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const guestCredentials = await joinDTMatchViaAPI(
            guestPage,
            matchId,
            playerId,
            `Guest-${playerId}-${Date.now()}`,
            guestGuestId,
        );
        if (!guestCredentials) {
            await guestContext.close();
            continue;
        }

        await seedDTMatchCredentials(guestContext, matchId, playerId, guestCredentials);
        await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=${playerId}`, { waitUntil: 'domcontentloaded' });
        await waitForCharacterSelection(guestPage);

        const playerSetup: DTPlayerSetup = { id: playerId, page: guestPage, context: guestContext };
        playersById.set(playerId, playerSetup);
        extraPlayers.push(playerSetup);
    }

    const players = options.joinPlayerIds?.length
        ? [playersById.get('0'), ...joinPlayerIds.map((id) => playersById.get(id))]
            .filter((player): player is DTPlayerSetup => Boolean(player))
        : Array.from({ length: numPlayers }, (_, index) => String(index))
            .map((id) => playersById.get(id))
            .filter((player): player is DTPlayerSetup => Boolean(player));

    const guestPlayer = extraPlayers[0];

    return {
        hostContext,
        hostPage,
        matchId,
        players,
        guestPage: guestPlayer?.page,
        guestContext: guestPlayer?.context,
        extraPlayers: extraPlayers.slice(1),
    };
};

export const cleanupDTMatch = async (setup: DTMatchSetup | DTMultiMatchSetup) => {
    const contexts = new Set<BrowserContext>();
    if ('hostContext' in setup && setup.hostContext) {
        contexts.add(setup.hostContext);
    }
    if ('guestContext' in setup && setup.guestContext) {
        contexts.add(setup.guestContext);
    }
    if ('players' in setup && Array.isArray(setup.players)) {
        for (const player of setup.players) {
            if (player?.context) {
                contexts.add(player.context);
            }
        }
    }
    if ('extraPlayers' in setup && Array.isArray(setup.extraPlayers)) {
        for (const player of setup.extraPlayers) {
            if (player?.context) {
                contexts.add(player.context);
            }
        }
    }

    for (const context of contexts) {
        await context.close();
    }
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

/** 隐藏 FAB 菜单和调试开关，避免遮挡移动端窄视口点击区域 */
export const disableFabMenu = async (page: Page) => {
    await page.addStyleTag({
        content: [
            '[data-testid="fab-menu"] { pointer-events: none !important; opacity: 0 !important; }',
            '[data-testid="debug-toggle-container"] { pointer-events: none !important; opacity: 0 !important; }',
        ].join('\n'),
    }).catch(() => {});
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
    state.dice = state.dice.map((die: { value?: number } & Record<string, unknown>, i: number) => ({
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
 * 等待教程棋盘准备就绪（兼容旧测试名称）
 */
export const waitForTutorialBoardReady = async (page: Page, timeout = 30000) => {
    await waitForBoardReady(page, timeout);
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
 * 分发本地命令（教程模式）
 */
export const dispatchLocalCommand = async (page: Page, type: string, payload?: unknown) => {
    await page.evaluate(({ cmdType, cmdPayload }) => {
        const w = window as Window & { __BG_LOCAL_DISPATCH__?: (type: string, payload?: unknown) => void };
        const dispatch = w.__BG_LOCAL_DISPATCH__;
        if (dispatch) {
            dispatch(cmdType, cmdPayload);
        }
    }, { cmdType: type, cmdPayload: payload });
    await page.waitForTimeout(300);
};

/**
 * 尝试点击 Pass 按钮（如果存在响应窗口）
 * @returns 是否点击了 Pass 按钮
 */
export const maybePassResponse = async (page: Page): Promise<boolean> => {
    const passButton = page.getByRole('button', { name: /^(Pass|跳过)$/i });
    if (await passButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await passButton.click();
        await page.waitForTimeout(300);
        return true;
    }
    return false;
};

/**
 * 等待特定阶段
 */
export const waitForPhase = async (page: Page, phase: string, timeout = 10000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const state = await readCoreState(page);
        if (state.phase === phase) return;
        await page.waitForTimeout(300);
    }
    throw new Error(`Timeout waiting for phase: ${phase}`);
};

/**
 * 推进到进攻投骰阶段
 */
export const advanceToOffensiveRoll = async (page: Page) => {
    const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
    // 持续点击 Next Phase 直到进入 offensiveRoll 阶段
    for (let i = 0; i < 10; i++) {
        if (await advanceButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
            await advanceButton.click();
            await page.waitForTimeout(400);
            // 检查是否到达骰子投掷阶段
            const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
            if (await rollButton.isVisible({ timeout: 500 }).catch(() => false)) {
                break;
            }
        } else {
            break;
        }
    }
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

// ============================================================================
// TestHarness 新版稳定 helper
// ============================================================================

export const waitForDiceThroneHarness = async (page: Page, timeout = 10000) => {
    await page.waitForFunction(
        () => {
            const harness = (window as Window).__BG_TEST_HARNESS__;
            return harness?.state?.isRegistered?.() === true
                && harness?.command?.isRegistered?.() === true;
        },
        { timeout, polling: 200 },
    );
};

export const readDiceThroneHarnessState = async <T = unknown>(page: Page): Promise<T> => {
    await waitForDiceThroneHarness(page);
    return page.evaluate(() => (window as Window).__BG_TEST_HARNESS__!.state.get()) as Promise<T>;
};

export const patchDiceThroneHarnessState = async (page: Page, patch: unknown) => {
    await waitForDiceThroneHarness(page);
    await page.evaluate((nextPatch) => {
        (window as Window).__BG_TEST_HARNESS__!.state.patch(nextPatch);
    }, patch);
};

export const dispatchDiceThroneCommand = async (
    page: Page,
    command: {
        type: string;
        playerId: string;
        payload?: Record<string, unknown>;
    },
) => {
    await waitForDiceThroneHarness(page);
    await page.evaluate(async (nextCommand) => {
        await (window as Window).__BG_TEST_HARNESS__!.command.dispatch(nextCommand);
    }, command);
};

export const setDiceThroneDiceValues = async (page: Page, values: number[]) => {
    await waitForDiceThroneHarness(page);
    await page.evaluate((nextValues) => {
        (window as Window).__BG_TEST_HARNESS__!.dice.setValues(nextValues);
    }, values);
};

export const waitForDiceThronePhase = async (page: Page, phase: string, timeout = 10000) => {
    await page.waitForFunction(
        (expectedPhase) => (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.phase === expectedPhase,
        phase,
        { timeout, polling: 200 },
    );
};

export const getDiceThroneUi = (page: Page) => {
    const abilitySlots = page.locator('[data-ability-slot]');
    return {
        handArea: page.getByTestId('hand-area'),
        rollButton: page.locator('[data-tutorial-id="dice-roll-button"]'),
        confirmButton: page.locator('[data-tutorial-id="dice-confirm-button"]'),
        advancePhaseButton: page.locator('[data-tutorial-id="advance-phase-button"]'),
        abilitySlots,
        highlightedAbilitySlots: abilitySlots.filter({
            has: page.locator('div.animate-pulse[class*="border-"]'),
        }),
        dieButton: (id: number) => page.getByTestId(`die-button-${id}`),
    };
};

export const selectFirstHighlightedAbility = async (page: Page) => {
    const { highlightedAbilitySlots } = getDiceThroneUi(page);
    await expect(highlightedAbilitySlots.first()).toBeVisible({ timeout: 10000 });
    await highlightedAbilitySlots.first().click();
};

export const resolveSelectedAttack = async (page: Page) => {
    const resolveAttackButton = page.getByRole('button', { name: /Resolve Attack|结算攻击/i });
    await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
    await expect(resolveAttackButton).toBeEnabled({ timeout: 10000 });
    await resolveAttackButton.click();
};
