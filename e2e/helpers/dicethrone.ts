/**
 * DiceThrone E2E 测试辅助函数
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import '../../src/games/dicethrone/domain';
import { getDieFaceByValue } from '../../src/games/dicethrone/domain/diceRegistry';
import { getGameServerBaseURL, ensureGameServerAvailable, initContext } from './common';

const GAME_NAME = 'dicethrone';
const createDtGuestId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const TRANSIENT_GOTO_ERROR_PATTERNS = [
    'ERR_INSUFFICIENT_RESOURCES',
    'ERR_ABORTED',
    'NS_BINDING_ABORTED',
];
const TRANSIENT_API_ERROR_PATTERNS = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'socket hang up',
    'fetch failed',
    'network error',
];

const isTransientGotoError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return TRANSIENT_GOTO_ERROR_PATTERNS.some(pattern => message.includes(pattern));
};

const isTransientApiError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();
    return TRANSIENT_API_ERROR_PATTERNS.some(pattern => lowered.includes(pattern.toLowerCase()));
};

const isRetryableApiStatus = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;

const setupDebugLogPath = resolve(process.cwd(), 'temp', 'dicethrone-setup-debug.log');

const appendSetupDebug = (message: string) => {
    try {
        mkdirSync(dirname(setupDebugLogPath), { recursive: true });
        appendFileSync(setupDebugLogPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
    } catch {
        // 调试日志失败不应影响测试主流程。
    }
};

const gotoWithRetry = async (
    page: Page,
    url: string,
    options: { label: string; timeout?: number; attempts?: number },
) => {
    const attempts = options.attempts ?? 3;
    const timeout = options.timeout ?? 20000;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        } catch (error) {
            lastError = error;
            if (!isTransientGotoError(error) || attempt === attempts) {
                throw error;
            }
            await page.waitForTimeout(500 * attempt);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`[${options.label}] 页面跳转失败`);
};

const postJsonWithRetry = async (
    page: Page,
    url: string,
    data: Record<string, unknown>,
    options: {
        label: string;
        attempts?: number;
        headers?: Record<string, string>;
    },
) => {
    const attempts = options.attempts ?? 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await page.request.post(url, {
                headers: options.headers,
                data,
            });
            if (response.ok()) {
                return response;
            }

            if (!isRetryableApiStatus(response.status()) || attempt === attempts) {
                appendSetupDebug(`API_FAIL label=${options.label} attempt=${attempt} status=${response.status()} url=${url}`);
                return response;
            }

            appendSetupDebug(`API_RETRY label=${options.label} attempt=${attempt} status=${response.status()} url=${url}`);
        } catch (error) {
            lastError = error;
            if (!isTransientApiError(error) || attempt === attempts) {
                throw error;
            }
            appendSetupDebug(`API_RETRY label=${options.label} attempt=${attempt} error=${error instanceof Error ? error.message : String(error)} url=${url}`);
        }

        await page.waitForTimeout(500 * attempt);
    }

    if (lastError) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

    return null;
};

type DebugDie = Record<string, unknown> & {
    definitionId: string;
    value?: number;
    symbol?: string;
    symbols?: string[];
};

// ============================================================================
// API 交互
// ============================================================================

export const createDTRoomViaAPI = async (
    page: Page,
    options?: { guestId?: string; numPlayers?: number; gameServerBaseURL?: string },
): Promise<string | null> => {
    try {
        const actualGuestId = options?.guestId ?? createDtGuestId('dt_e2e');
        const numPlayers = options?.numPlayers ?? 2;
        const gameServerBaseURL = options?.gameServerBaseURL ?? getGameServerBaseURL();
        const url = `${gameServerBaseURL}/games/${GAME_NAME}/create`;

        const response = await postJsonWithRetry(page, url, {
            numPlayers,
            setupData: { guestId: actualGuestId },
        }, {
            label: 'create-room',
        });

        if (!response?.ok()) return null;
        const data = (await response.json().catch(() => null)) as { matchID?: string } | null;
        return data?.matchID ?? null;
    } catch (error) {
        appendSetupDebug(`API_FAIL label=create-room error=${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
};

export const joinDTMatchViaAPI = async (
    page: Page,
    matchId: string,
    playerId: string,
    playerName: string,
    guestId?: string,
    gameServerBaseURLOverride?: string,
): Promise<string | null> => {
    try {
        const gameServerBaseURL = gameServerBaseURLOverride ?? getGameServerBaseURL();
        const url = `${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/join`;

        const response = await postJsonWithRetry(page, url, {
            playerID: playerId,
            playerName,
            ...(guestId ? { data: { guestId } } : {}),
        }, {
            label: `join-match-${playerId}`,
        });

        if (!response?.ok()) return null;
        const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
        return data?.playerCredentials ?? null;
    } catch (error) {
        appendSetupDebug(`API_FAIL label=join-match-${playerId} error=${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
};

export const claimDTSeatViaAPI = async (
    page: Page,
    matchId: string,
    playerId: string,
    options: { guestId?: string; playerName?: string; token?: string; gameServerBaseURL?: string },
): Promise<string | null> => {
    try {
        const gameServerBaseURL = options.gameServerBaseURL ?? getGameServerBaseURL();
        const url = `${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/claim-seat`;
        const headers: Record<string, string> = {};
        if (options.token) {
            headers.Authorization = `Bearer ${options.token}`;
        }

        const response = await postJsonWithRetry(page, url, {
            playerID: playerId,
            ...(options.token ? {} : options.guestId ? { guestId: options.guestId } : {}),
            ...(options.playerName ? { playerName: options.playerName } : {}),
        }, {
            label: `claim-seat-${playerId}`,
            headers,
        });

        if (!response?.ok()) return null;
        const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
        return data?.playerCredentials ?? null;
    } catch (error) {
        appendSetupDebug(`API_FAIL label=claim-seat-${playerId} error=${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
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
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => {
        const hasTitle = Array.from(document.querySelectorAll('h1, h2, h3')).some((node) =>
            /选择你的英雄|Select Your Hero/i.test(node.textContent ?? ''),
        );
        const hasCharacterCards = document.querySelectorAll('[data-character-id]').length > 0;
        const hasReadyButton = Array.from(document.querySelectorAll('button')).some((node) =>
            /Ready|准备/i.test(node.textContent ?? ''),
        );
        return hasTitle || hasCharacterCards || hasReadyButton;
    }, { timeout });
};

export const selectCharacter = async (page: Page, characterId: string) => {
    const characterCard = page.locator(`[data-character-id="${characterId}"]`);
    await expect(characterCard).toBeVisible({ timeout: 8000 });
    await characterCard.click();
    await page.waitForTimeout(500);
};

export const readyPlayersAndStartGame = async (hostPage: Page, guestPages: Page[]) => {
    for (const guestPage of guestPages) {
        const guestReadyButton = guestPage.getByRole('button', { name: /Ready/i });
        await expect(guestReadyButton).toBeVisible({ timeout: 5000 });
        await guestReadyButton.click();
        await guestPage.waitForTimeout(500);
    }

    const hostStartButton = hostPage.getByRole('button', { name: /Start Game|Press.*Start/i });
    await expect(hostStartButton).toBeVisible({ timeout: 10000 });
    await expect(hostStartButton).toBeEnabled({ timeout: 5000 });
    await hostStartButton.click();
    await hostPage.waitForTimeout(500);
};

export const readyAndStartGame = async (hostPage: Page, guestPage: Page) => {
    await readyPlayersAndStartGame(hostPage, [guestPage]);
};

export const readyMultiplePlayersAndStartGame = readyPlayersAndStartGame;

export const waitForGameBoard = async (page: Page, timeout = 30000) => {
    await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout });
};

// ============================================================================
// 联机场景 setup
// ============================================================================

export interface DTMatchSetup {
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    hostPage: Page;
    guestPage: Page;
    matchId: string;
    players: DTPlayerSession[];
    extraPlayers: DTPlayerSession[];
}

export interface DTPlayerSession {
    context: BrowserContext;
    page: Page;
    playerId: string;
    guestId: string;
    playerName: string;
    credentials: string;
}

const createPlayerContext = async (
    browser: Browser,
    baseURL: string | undefined,
    storageKey: string,
    gameServerBaseURL?: string,
) => {
    const context = await browser.newContext({ baseURL });
    await initContext(context, { storageKey, skipTutorial: false, gameServerBaseURL });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    return { context, page };
};

export const setupDTOnlineMatchWithPlayers = async (
    browser: Browser,
    baseURL: string | undefined,
    options?: { numPlayers?: number; gameServerBaseURL?: string },
): Promise<DTMatchSetup | null> => {
    const numPlayers = options?.numPlayers ?? 2;
    const gameServerBaseURL = options?.gameServerBaseURL ?? getGameServerBaseURL();
    const openedContexts: BrowserContext[] = [];
    let setupStep = `start numPlayers=${numPlayers} baseURL=${baseURL ?? 'undefined'} gameServer=${gameServerBaseURL}`;

    try {
        const { context: hostContext, page: hostPage } = await createPlayerContext(
            browser,
            baseURL,
            '__dicethrone_storage_reset_host',
            gameServerBaseURL,
        );
        openedContexts.push(hostContext);
        setupStep = 'host_context_ready';

        if (!(await ensureGameServerAvailable(hostPage, gameServerBaseURL))) {
            appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=game_server_unavailable`);
            return null;
        }
        setupStep = 'game_server_available';

        const hostGuestId = createDtGuestId('e2e_host');
        const matchId = await createDTRoomViaAPI(hostPage, { guestId: hostGuestId, numPlayers, gameServerBaseURL });
        if (!matchId) {
            appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=create_room_failed`);
            return null;
        }
        setupStep = `room_created matchId=${matchId}`;

        const hostPlayerName = `Host-${Date.now()}`;
        const hostCredentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
            guestId: hostGuestId,
            playerName: hostPlayerName,
            gameServerBaseURL,
        });
        if (!hostCredentials) {
            appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=host_claim_failed`);
            return null;
        }
        setupStep = 'host_claimed';

        await seedDTMatchCredentials(hostContext, matchId, '0', hostCredentials);
        await gotoWithRetry(hostPage, `/play/${GAME_NAME}/match/${matchId}?playerID=0`, {
            label: 'host-match-page',
        });
        setupStep = 'host_goto_done';

        const players: DTPlayerSession[] = [{
            context: hostContext,
            page: hostPage,
            playerId: '0',
            guestId: hostGuestId,
            playerName: hostPlayerName,
            credentials: hostCredentials,
        }];

        for (let index = 1; index < numPlayers; index++) {
            const playerId = String(index);
            const { context: guestContext, page: guestPage } = await createPlayerContext(
                browser,
                baseURL,
                `__dicethrone_storage_reset_${playerId}`,
                gameServerBaseURL,
            );
            openedContexts.push(guestContext);
            await guestPage.waitForTimeout(500);

            const guestId = createDtGuestId(`e2e_guest_${playerId}`);
            const playerName = `Guest-${playerId}-${Date.now()}`;
            const guestCredentials = await joinDTMatchViaAPI(
                guestPage,
                matchId,
                playerId,
                playerName,
                guestId,
                gameServerBaseURL,
            );
            if (!guestCredentials) {
                appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=guest_join_failed playerId=${playerId}`);
                return null;
            }
            setupStep = `guest_${playerId}_joined`;

            await seedDTMatchCredentials(guestContext, matchId, playerId, guestCredentials);
            await gotoWithRetry(guestPage, `/play/${GAME_NAME}/match/${matchId}?playerID=${playerId}`, {
                label: `guest-${playerId}-match-page`,
            });
            setupStep = `guest_${playerId}_goto_done`;

            players.push({
                context: guestContext,
                page: guestPage,
                playerId,
                guestId,
                playerName,
                credentials: guestCredentials,
            });
        }

        const guestPlayer = players[1];
        if (!guestPlayer) {
            appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=missing_guest_player`);
            return null;
        }

        for (const player of players) {
            await waitForCharacterSelection(player.page);
        }
        setupStep = 'all_character_selection_ready';

        appendSetupDebug(`OK matchId=${matchId} numPlayers=${numPlayers}`);

        return {
            hostContext,
            guestContext: guestPlayer.context,
            hostPage,
            guestPage: guestPlayer.page,
            matchId,
            players,
            extraPlayers: players.slice(2),
        };
    } catch (error) {
        const message = error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
        appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} error=${message}`);
        await Promise.all(openedContexts.map(async (context) => {
            await context.close().catch(() => {});
        }));
        return null;
    }
};

export const setupDTOnlineMatch = async (
    browser: Browser,
    baseURL: string | undefined,
    options?: { gameServerBaseURL?: string },
): Promise<DTMatchSetup | null> => {
    return setupDTOnlineMatchWithPlayers(browser, baseURL, {
        numPlayers: 2,
        gameServerBaseURL: options?.gameServerBaseURL,
    });
};

export const cleanupDTMatch = async (setup: DTMatchSetup) => {
    const uniqueContexts = new Set<BrowserContext>([
        ...(setup.players?.map((player) => player.context) ?? []),
        setup.guestContext,
        setup.hostContext,
    ]);
    await Promise.all(Array.from(uniqueContexts).map(async (context) => {
        await context.close().catch(() => {});
    }));
};

// ============================================================================
// 璋冭瘯闈㈡澘鎿嶄綔
// ============================================================================

/** 纭繚璋冭瘯闈㈡澘鎵撳紑 */
export const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

/** 纭繚璋冭瘯闈㈡澘鍏抽棴 */
export const ensureDebugPanelClosed = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isHidden().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeHidden({ timeout: 5000 });
};

/** 闅愯棌 FAB 鑿滃崟鍜岃皟璇曞紑鍏筹紝閬垮厤閬尅绉诲姩绔獎瑙嗗彛鐐瑰嚮鍖哄煙 */
export const disableFabMenu = async (page: Page) => {
    await page.addStyleTag({
        content: [
            '[data-testid="fab-menu"] { pointer-events: none !important; opacity: 0 !important; }',
            '[data-testid="debug-toggle-container"] { pointer-events: none !important; opacity: 0 !important; }',
        ].join('\n'),
    }).catch(() => {});
};

/** 鍒囨崲鍒拌皟璇曢潰鏉跨殑鐘舵€?Tab */
export const ensureDebugStateTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
};

/** 鍒囨崲鍒拌皟璇曢潰鏉跨殑鎺у埗 Tab */
export const ensureDebugControlsTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const controlsTab = page.getByTestId('debug-tab-controls');
    if (await controlsTab.isVisible().catch(() => false)) {
        await controlsTab.click();
    }
};

/**
 * 璇诲彇 core 鐘舵€?
 */
export const readCoreState = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.core ?? parsed?.G?.core ?? parsed;
};

/**
 * 璇诲彇浜嬩欢娴侊紙EventStream锛?
 */
export const readEventStream = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    const sys = parsed?.sys ?? parsed?.G?.sys;
    return sys?.eventStream?.entries ?? [];
};

/**
 * 鐩存帴娉ㄥ叆 core 鐘舵€侊紙浣跨敤璋冭瘯闈㈡澘锛?
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
 * 閫氳繃璋冭瘯闈㈡澘淇敼璧勬簮鍊?
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
 * 閫氳繃璋冭瘯闈㈡澘璁剧疆鐜╁ token
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
 * 璁剧疆楠板瓙鍊硷紙閫氳繃璋冭瘯闈㈡澘锛?
 */
export const applyDiceValues = async (page: Page, values: number[]) => {
    const state = await readCoreState(page);
    if (!state.dice || state.dice.length === 0) {
        throw new Error('No dice found in state');
    }
    // 更新骰子值
    state.dice = (state.dice as DebugDie[]).map((die, i: number) => ({
        ...die,
        value: values[i] ?? die.value,
        symbol: getDieFaceByValue(die.definitionId, values[i] ?? die.value)?.symbols?.[0]
            ?? die.symbol,
        symbols: getDieFaceByValue(die.definitionId, values[i] ?? die.value)?.symbols
            ?? die.symbols,
    }));
    state.rollConfirmed = false; // 鍏佽鐢ㄦ埛閲嶆柊纭
    await applyCoreStateDirect(page, state);
};

/**
 * 閫氳繃 dispatch 淇敼鐘舵€侊紙宸插簾寮冿紝浣跨敤 applyCoreStateDirect 鏇夸唬锛?
 */
export const patchCoreViaDispatch = async (page: Page, patch: unknown) => {
    const state = await readCoreState(page);
    const patched = { ...state, ...patch };
    await applyCoreStateDirect(page, patched);
};

// ============================================================================
// 鍏朵粬杈呭姪鍑芥暟
// ============================================================================

/**
 * 绛夊緟涓昏闃舵
 */
export const waitForMainPhase = async (page: Page, timeout = 20000) => {
    await expect(page.getByText(/Main Phase|涓昏闃舵/i)).toBeVisible({ timeout });
};

/**
 * 绛夊緟妫嬬洏鍑嗗灏辩华
 */
export const waitForBoardReady = async (page: Page, timeout = 30000) => {
    await waitForGameBoard(page, timeout);
};

/**
 * 绛夊緟鏁欑▼妫嬬洏灏辩华
 * 鏁欑▼棣栭〉鍏堝嚭鐜扮殑鏄?tutorial overlay锛岃€屼笉鏄瀛愭寜閽€?
 */
export const waitForTutorialBoardReady = async (page: Page, timeout = 30000) => {
    const loadingIndicator = page.getByText(/Loading match resources/i).first();
    if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loadingIndicator.waitFor({ state: 'hidden', timeout });
    }

    await page.waitForFunction(
        () => Boolean(
            document.querySelector('[data-tutorial-step]')
            || document.querySelector('[data-tutorial-id="advance-phase-button"]')
            || document.querySelector('[data-tutorial-id="dice-roll-button"]'),
        ),
        { timeout },
    );
};

/**
 * 浠?URL 鑾峰彇鐜╁ ID
 */
export const getPlayerIdFromUrl = (page: Page): string | null => {
    const url = page.url();
    const match = url.match(/playerID=(\d+)/);
    return match ? match[1] : null;
};

/**
 * 鑾峰彇妯℃€佹瀹瑰櫒锛堥€氳繃鏍囬锛?
 */
export const getModalContainerByHeading = (page: Page, heading: string | RegExp) => {
    return page.locator('[role="dialog"]').filter({ has: page.getByRole('heading', { name: heading }) });
};

/**
 * 鏂█鎵嬬墝鍙
 */
export const assertHandCardsVisible = async (page: Page) => {
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });
    const cards = handArea.locator('[data-card-id]');
    await expect(cards.first()).toBeVisible({ timeout: 3000 });
};

/**
 * 绛夊緟鏁欏姝ラ
 */
export const waitForTutorialStep = async (page: Page, stepId: string, timeout = 10000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

/**
 * 鍒嗗彂鏈湴鍛戒护锛堟暀绋嬫ā寮忥級
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
 * 灏濊瘯鐐瑰嚮 Pass 鎸夐挳锛堝鏋滃瓨鍦ㄥ搷搴旂獥鍙ｏ級
 * @returns 鏄惁鐐瑰嚮浜?Pass 鎸夐挳
 */
export const maybePassResponse = async (page: Page, timeoutMs = 4000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const candidateGroups = [
            page.getByRole('button', { name: /(PASS|Pass|跳过)/i }),
            page.locator('button').filter({ hasText: /(PASS|Pass|跳过)/i }),
        ];

        for (const candidates of candidateGroups) {
            const count = await candidates.count();
            for (let i = 0; i < count; i += 1) {
                const passButton = candidates.nth(i);
                if (await passButton.isVisible().catch(() => false)) {
                    await passButton.click({ force: true });
                    await page.waitForTimeout(300);
                    return true;
                }
            }
        }
        await page.waitForTimeout(200);
    }

    return false;
};

/**
 * 绛夊緟鐗瑰畾闃舵
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
 * 鎺ㄨ繘鍒拌繘鏀绘姇楠伴樁娈?
 */
export const advanceToOffensiveRoll = async (page: Page) => {
    const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
    // 鎸佺画鐐瑰嚮 Next Phase 鐩村埌杩涘叆 offensiveRoll 闃舵
    for (let i = 0; i < 10; i++) {
        if (await advanceButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
            await advanceButton.click();
            await page.waitForTimeout(400);
            // 妫€鏌ユ槸鍚﹀埌杈鹃瀛愭姇鎺烽樁娈?
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
 * 鍏抽棴璋冭瘯闈㈡澘锛堝鏋滄墦寮€锛?
 */
export const closeDebugPanelIfOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeHidden({ timeout: 5000 });
    }
};

/**
 * 璁剧疆鍦ㄧ嚎瀵瑰眬锛堟棫鐗堝吋瀹瑰嚱鏁帮級
 */
export const setupOnlineMatch = setupDTOnlineMatch;
