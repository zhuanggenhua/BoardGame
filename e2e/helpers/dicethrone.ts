/**
 * DiceThrone E2E 测试辅助函数
 */

import { expect, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';
import {
    attachPageDiagnostics,
    getGameServerBaseURL,
    ensureGameServerAvailable,
    initContext,
    waitForFrontendAssets,
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

type SetupDTOnlineMatchOptions = {
    blockLobbySocket?: boolean;
    skipImageGate?: boolean;
    characterSelectionTimeout?: number;
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

const DT_PRELOAD_RUNNER_SOURCE = String.raw`
(async function runDiceThronePreload(args) {
    const preloadStepTimeoutMs = args.preloadStepTimeoutMs;
    const traceWindow = window;
    if (!Array.isArray(traceWindow.__DT_E2E_PRELOAD_TRACE__)) {
        traceWindow.__DT_E2E_PRELOAD_TRACE__ = [];
    }

    const pushPreloadTrace = function (stage, payload) {
        traceWindow.__DT_E2E_PRELOAD_TRACE__.push({
            stage,
            timestamp: Date.now(),
            ...(payload ? { payload } : {}),
        });
    };

    const withStepTimeout = async function (label, run) {
        pushPreloadTrace(label + ':start', { timeoutMs: preloadStepTimeoutMs });
        const startedAt = Date.now();
        let stepTimeoutId;
        try {
            const result = await Promise.race([
                run(),
                new Promise((_, reject) => {
                    stepTimeoutId = setTimeout(() => {
                        reject(new Error('DiceThrone 预热步骤超时: ' + label + '（' + preloadStepTimeoutMs + 'ms）'));
                    }, preloadStepTimeoutMs);
                }),
            ]);
            pushPreloadTrace(label + ':success', {
                durationMs: Date.now() - startedAt,
            });
            return result;
        } catch (error) {
            pushPreloadTrace(label + ':failed', {
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        } finally {
            if (stepTimeoutId !== undefined) {
                clearTimeout(stepTimeoutId);
            }
        }
    };

    const warmModuleSource = async function (label, path, attempts) {
        let lastError = null;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                await withStepTimeout(label + ':attempt-' + attempt, async () => {
                    const response = await fetch(path, { credentials: 'same-origin' });
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    await response.text();
                });
                pushPreloadTrace(label + ':warmed', { attempt, path });
                return;
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                pushPreloadTrace(label + ':retry', { attempt, path, error: lastError });
                if (attempt < attempts) {
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
            }
        }
        throw new Error(label + ' 预热失败: ' + (lastError ?? 'unknown error'));
    };

    pushPreloadTrace('preload-start', { stepTimeoutMs: preloadStepTimeoutMs });

    await warmModuleSource(
        'warm-prefetch-play-route-source',
        '/src/lib/prefetchPlayRoute.ts',
        2,
    );
    await warmModuleSource(
        'warm-game-registry-source',
        '/src/games/registry.ts',
        2,
    );
    const playRouteModule = await withStepTimeout(
        'import-prefetch-play-route',
        () => import('/src/lib/prefetchPlayRoute.ts'),
    );
    const registryModule = await withStepTimeout(
        'import-game-registry',
        () => import('/src/games/registry.ts'),
    );
    await withStepTimeout(
        'prefetch-online-match-route',
        () => playRouteModule.prefetchOnlineMatchRoute(),
    );
    await warmModuleSource(
        'warm-match-room-source',
        '/src/pages/MatchRoomWithAudio.tsx',
        2,
    );
    await withStepTimeout(
        'prefetch-dicethrone-runtime',
        () => registryModule.prefetchGameImplementation('dicethrone', { includeTutorial: false }),
    );
    await warmModuleSource(
        'warm-dicethrone-board-source',
        '/src/games/dicethrone/Board.tsx',
        2,
    );
    await withStepTimeout(
        'ensure-dicethrone-critical-image-resolver',
        () => registryModule.ensureGameCriticalImageResolverLoaded('dicethrone'),
    );

    pushPreloadTrace('preload-success');
})
`;

const preloadDTMatchRouteModule = async (page: Page, timeoutMs = 30000) => {
    const stepTimeoutMs = Math.max(8000, Math.min(20000, Math.floor(timeoutMs / 2)));
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            page.evaluate(
                ({ preloadStepTimeoutMs, runnerSource }) =>
                    (0, eval)(runnerSource)({ preloadStepTimeoutMs }),
                { preloadStepTimeoutMs: stepTimeoutMs, runnerSource: DT_PRELOAD_RUNNER_SOURCE },
            ),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(`预热 DiceThrone 在线对局路由模块超时（${timeoutMs}ms）`));
                }, timeoutMs);
            }),
        ]);
    } catch (error) {
        let preloadTrace: unknown = null;
        try {
            preloadTrace = await page.evaluate(() => {
                const traceWindow = window as Window & {
                    __DT_E2E_PRELOAD_TRACE__?: Array<Record<string, unknown>>;
                };
                return traceWindow.__DT_E2E_PRELOAD_TRACE__ ?? null;
            });
        } catch {
            preloadTrace = null;
        }
        console.warn(
            '[DiceThrone E2E] 在线对局路由模块预热失败，继续正式进房',
            error,
            preloadTrace
                ? `\n预热分步轨迹:\n${JSON.stringify(preloadTrace, null, 2)}`
                : '',
        );
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }
};

const waitForFrontendAssetsBestEffort = async (page: Page, timeoutMs = 30000) => {
    try {
        await waitForFrontendAssets(page, timeoutMs);
    } catch (error) {
        console.warn('[DiceThrone E2E] 前端资源 readiness 探针失败，继续正式进房', error);
    }
};

const isRetryableDTNavigationError = (error: unknown): boolean => {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.message.includes('ERR_ABORTED')
        || error.message.includes('ERR_NETWORK_CHANGED')
        || error.message.includes('frame was detached')
        || error.message.includes('page.goto: Timeout');
};

const gotoDTMatchRoom = async (
    page: Page,
    matchId: string,
    playerId: string,
) => {
    const targetUrl = `/play/${GAME_NAME}/match/${matchId}?playerID=${playerId}`;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            // 这里先拿到目标房间页面的首个 commit，避免把导航卡死在模块冷加载上；
            // 后续由角色选择页等待逻辑继续兜底页面真正就绪。
            await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
            return;
        } catch (error) {
            if (!isRetryableDTNavigationError(error) || attempt === maxAttempts) {
                throw error;
            }
            await page.waitForTimeout(800);
        }
    }
};

// ============================================================================
// 游戏交互
// ============================================================================

export const waitForCharacterSelection = async (page: Page, timeout = 60000) => {
    // NOTE: 角色选择页标题在部分环境下可能出现偶发定位失败（疑似与文本/渲染时序有关）。
    // 这里改用更稳定的结构锚点：新组件使用 data-character-id，旧兼容组件仍使用 data-char-id。
    const deadline = Date.now() + timeout;
    let lastError: unknown;
    let lastBodyText = '';
    let reloadCount = 0;
    const maxReloads = 2;
    let loadingStateStartedAt = 0;
    const loadingReloadThresholdMs = 15000;

    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;

        const reconnectButton = page.getByRole('button', { name: /重连进入|Reconnect/i }).first();
        if (await reconnectButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await reconnectButton.click();
            await page.waitForLoadState('domcontentloaded').catch(() => undefined);
            await page.waitForTimeout(1000);
            continue;
        }

        const rescueRetryButton = page.getByRole('button', { name: /刷新|Reload|重试|Retry/i }).first();
        if (await rescueRetryButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await rescueRetryButton.click();
            await page.waitForLoadState('domcontentloaded').catch(() => undefined);
            await page.waitForTimeout(1000);
            continue;
        }

        const waitSlice = reloadCount < maxReloads ? 8000 : 15000;
        try {
            await expect(page.locator('[data-character-id], [data-char-id]').first())
                .toBeVisible({ timeout: Math.min(remaining, waitSlice) });
            return;
        } catch (error) {
            lastError = error;
        }

        const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
        lastBodyText = bodyText;
        const isExpectedLoadingState = /正在准备对局|加载游戏模块|正在加载对局资源|加载素材|Loading game module|Loading match resources|Loading game resources/i.test(bodyText);
        if (isExpectedLoadingState) {
            lastError = undefined;
            if (loadingStateStartedAt === 0) {
                loadingStateStartedAt = Date.now();
            }
            const loadingElapsed = Date.now() - loadingStateStartedAt;
            if (reloadCount < maxReloads && loadingElapsed >= loadingReloadThresholdMs) {
                reloadCount += 1;
                loadingStateStartedAt = 0;
                await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
                await page.waitForTimeout(1000);
                continue;
            }
            await page.waitForTimeout(1000);
            continue;
        }

        loadingStateStartedAt = 0;

        if (reloadCount < maxReloads) {
            reloadCount += 1;
            await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
            await page.waitForTimeout(1000);
            continue;
        }

        await page.waitForTimeout(1000);
    }

    if (lastBodyText) {
        throw new Error(`等待 DiceThrone 角色选择页超时，最后页面文本: ${lastBodyText.slice(0, 500)}`);
    }
    if (lastError) throw lastError;
    throw new Error('等待 DiceThrone 角色选择页超时，页面无可读文本');
};

const CHARACTER_SELECTION_HOME_FALLBACK_PATTERN =
    /桌游教程、联机与原型制作平台|全部游戏|王权骰铸|大杀四方/i;

export const waitForCharacterSelectionInRoom = async (
    page: Page,
    options: {
        matchId: string;
        playerId: string;
        timeout?: number;
        maxRoomRescues?: number;
    },
) => {
    const diagnostics = attachPageDiagnostics(page);
    const timeout = options.timeout ?? 60000;
    const deadline = Date.now() + timeout;
    const maxRoomRescues = options.maxRoomRescues ?? 2;
    let rescueCount = 0;
    let lastObservedBodyText = '';
    let lastObservedUrl = '';
    let lastError: unknown;

    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        const slice = Math.min(remaining, 45000);
        if (slice <= 0) break;

        try {
            await waitForCharacterSelection(page, slice);
            return;
        } catch (error) {
            lastError = error;
            const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
            const url = page.url();
            lastObservedBodyText = bodyText;
            lastObservedUrl = url;
            const fellBackToHome = CHARACTER_SELECTION_HOME_FALLBACK_PATTERN.test(bodyText)
                || !url.includes(`/play/${GAME_NAME}/match/`);
            if (!fellBackToHome || rescueCount >= maxRoomRescues) {
                break;
            }

            rescueCount += 1;
            await gotoDTMatchRoom(page, options.matchId, options.playerId).catch(() => undefined);
            await page.waitForTimeout(1000);
        }
    }

    const rootReason = lastError instanceof Error
        ? lastError.message
        : lastError
            ? String(lastError)
            : '无底层错误消息';
    const recentDiagnostics = diagnostics.errors.slice(-8);
    const recentMatchLoadTrace = await page.evaluate(() => {
        const holder = window as Window & {
            __BG_MATCH_LOAD_TRACE__?: {
                entries?: Array<{
                    stage?: string;
                    timestamp?: number;
                    payload?: Record<string, unknown>;
                }>;
            };
        };
        const entries = holder.__BG_MATCH_LOAD_TRACE__?.entries;
        if (!Array.isArray(entries)) {
            return [];
        }
        return entries.slice(-8).map((entry) => ({
            stage: entry?.stage ?? null,
            timestamp: typeof entry?.timestamp === 'number' ? entry.timestamp : null,
            payload: entry?.payload ?? null,
        }));
    }).catch(() => []);
    const localStorageSnapshot = await page.evaluate((matchId) => {
        const entries: Record<string, string | null> = {};
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key) continue;
            entries[key] = localStorage.getItem(key);
        }
        return {
            matchCredentials: localStorage.getItem(`match_creds_${matchId}`),
            entries,
        };
    }, options.matchId).catch(() => null);
    const liveMatchRoomDebug = await page.evaluate(() => {
        const holder = window as Window & {
            __BG_MATCHROOM_DEBUG__?: {
                getLiveSnapshot?: () => unknown;
            };
        };
        return holder.__BG_MATCHROOM_DEBUG__?.getLiveSnapshot?.() ?? null;
    }).catch(() => null);
    const matchLoadTraceText = recentMatchLoadTrace.length > 0
        ? JSON.stringify(recentMatchLoadTrace, null, 2)
        : '无';
    const localStorageText = localStorageSnapshot
        ? JSON.stringify(localStorageSnapshot, null, 2)
        : '无';
    const liveMatchRoomDebugText = liveMatchRoomDebug
        ? JSON.stringify(liveMatchRoomDebug, null, 2)
        : '无';

    throw new Error([
        `等待 DiceThrone 角色选择页超时，玩家 ${options.playerId} 未恢复到房间`,
        `matchId: ${options.matchId}`,
        `已执行房间救援次数: ${rescueCount}`,
        `最后 URL: ${lastObservedUrl || page.url()}`,
        `最后页面文本: ${(lastObservedBodyText || '').slice(0, 500)}`,
        `底层错误: ${rootReason}`,
        recentDiagnostics.length > 0
            ? `最近页面错误:\n${recentDiagnostics.join('\n')}`
            : '最近页面错误: 无',
        `最近 MatchLoadTrace:\n${matchLoadTraceText}`,
        `当前 localStorage:\n${localStorageText}`,
        `当前 MatchRoomLiveDebug:\n${liveMatchRoomDebugText}`,
    ].join('\n'));
};

export const selectCharacter = async (page: Page, characterId: string) => {
    let characterCard = page.locator(`[data-character-id="${characterId}"], [data-char-id="${characterId}"]`).first();
    if ((await characterCard.count()) === 0) {
        // 兼容：部分角色卡在某些构建/渲染路径下可能没有挂 `data-character-id`（例如列表虚拟化/禁用态包装）。
        // 这里提供最小 fallback：按可见名称文字点击，以避免 E2E 因 DOM 标识缺失而假失败。
        const fallbackName =
            characterId === 'samurai'
                ? /武士|Samurai/i
                : characterId === 'gunslinger'
                    ? /枪手|Gunslinger/i
                    : characterId === 'zhanshujia'
                        ? /战术家|Tactician/i
                        : characterId === 'cursed_pirate'
                            ? /咒缚海盗|Cursed Pirate/i
                            : null;
        if (fallbackName) {
            characterCard = page.getByText(fallbackName).first();
        }
    }

    await characterCard.scrollIntoViewIfNeeded({ timeout: 12000 }).catch(() => undefined);
    await expect(characterCard).toBeVisible({ timeout: 12000 });
    await characterCard.click();
    
    // DiceThrone 的角色选择不需要确认按钮，点击后直接选中
    // 等待一小段时间让状态更新
    await page.waitForTimeout(500);
};

export const readyAndStartGame = async (hostPage: Page, guestPage: Page) => {
    const clickRoleButtonWithRetry = async (
        page: Page,
        name: RegExp,
        options: { visibleTimeoutMs: number; enabledTimeoutMs?: number; attempts?: number },
    ) => {
        const attempts = options.attempts ?? 3;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            const button = page.getByRole('button', { name }).first();
            await expect(button).toBeVisible({ timeout: options.visibleTimeoutMs });
            if (options.enabledTimeoutMs) {
                await expect(button).toBeEnabled({ timeout: options.enabledTimeoutMs });
            }

            try {
                await button.click();
                return;
            } catch (error) {
                if (attempt === attempts) throw error;
                await page.waitForTimeout(300);
            }
        }
    };

    // Guest 点击准备按钮
    await clickRoleButtonWithRetry(guestPage, /Ready|准备/i, {
        visibleTimeoutMs: 8000,
        enabledTimeoutMs: 5000,
        attempts: 4,
    });
    
    // 等待 Guest 页面状态更新（显示 "Ready, Waiting..." 或类似文本）
    await guestPage.waitForTimeout(500);
    
    // 等待 Host 页面接收到 Guest 的 Ready 状态并显示开始按钮
    // Host 点击开始游戏按钮 - 使用更宽松的选择器
    await clickRoleButtonWithRetry(hostPage, /Start Game|开始游戏|Press.*Start|按.*开始/i, {
        visibleTimeoutMs: 15000,
        enabledTimeoutMs: 8000,
        attempts: 4,
    });
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
    await expect(hostStartButton).toBeVisible({ timeout: 15000 });
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
    options?: SetupDTOnlineMatchOptions,
): Promise<DTMatchSetup | null> => {
    const contextInitOptions = typeof options === 'object' && options !== null
        ? { blockLobbySocket: options.blockLobbySocket, skipImageGate: options.skipImageGate }
        : {};
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false, ...contextInitOptions });
    const hostPage = await hostContext.newPage();

    // 这里只需要尽快拿到同源页面上下文做预热/请求，不必卡到首屏模块全部执行完。
    await hostPage.goto('/', { waitUntil: 'commit', timeout: 15000 }).catch(() => {});
    await hostPage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    await waitForFrontendAssetsBestEffort(hostPage, 30000);
    await preloadDTMatchRouteModule(hostPage);

    if (!(await ensureGameServerAvailable(hostPage))) return null;

    const hostGuestId = `e2e_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const matchId = await createDTRoomViaAPI(hostPage, hostGuestId);
    if (!matchId) return null;

    const hostCredentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
        guestId: hostGuestId,
        playerName: `Host-${Date.now()}`,
    });
    if (!hostCredentials) return null;

    await seedDTMatchCredentials(hostContext, matchId, '0', hostCredentials);
    await gotoDTMatchRoom(hostPage, matchId, '0');
    await waitForCharacterSelectionInRoom(hostPage, {
        matchId,
        playerId: '0',
        timeout: options?.characterSelectionTimeout,
    });

    const guestContext = await browser.newContext({ baseURL });
    await initContext(guestContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false, ...contextInitOptions });
    const guestPage = await guestContext.newPage();

    const guestGuestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const guestCredentials = await joinDTMatchViaAPI(guestPage, matchId, '1', `Guest-${Date.now()}`, guestGuestId);
    if (!guestCredentials) return null;

    await seedDTMatchCredentials(guestContext, matchId, '1', guestCredentials);
    await gotoDTMatchRoom(guestPage, matchId, '1');
    await waitForCharacterSelectionInRoom(guestPage, {
        matchId,
        playerId: '1',
        timeout: options?.characterSelectionTimeout,
    });

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
        contextOptions?: BrowserContextOptions;
        characterSelectionTimeout?: number;
        skipCharacterSelectionWait?: boolean;
        blockLobbySocket?: boolean;
        skipImageGate?: boolean;
    },
): Promise<DTMultiMatchSetup | null> => {
    const numPlayers = options.numPlayers;
    const gameServerBaseURL = options.gameServerBaseURL ?? getGameServerBaseURL();
    const joinPlayerIds = options.joinPlayerIds?.length
        ? options.joinPlayerIds
        : Array.from({ length: numPlayers - 1 }, (_, index) => String(index + 1));
    const shouldBatchWaitForCharacterSelection = !options.skipCharacterSelectionWait && joinPlayerIds.length > 1;
    const contextInitOptions = {
        blockLobbySocket: options.blockLobbySocket,
        skipImageGate: options.skipImageGate,
    };

    const hostContext = await browser.newContext({
        ...options.contextOptions,
        baseURL,
    });
    await initContext(hostContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false, ...contextInitOptions });
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'commit', timeout: 15000 }).catch(() => {});
    await hostPage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    await waitForFrontendAssetsBestEffort(hostPage, 30000);
    await preloadDTMatchRouteModule(hostPage);
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
    await gotoDTMatchRoom(hostPage, matchId, '0');
    if (!options.skipCharacterSelectionWait && !shouldBatchWaitForCharacterSelection) {
        await waitForCharacterSelectionInRoom(hostPage, {
            matchId,
            playerId: '0',
            timeout: options.characterSelectionTimeout,
        });
    }

    const playersById = new Map<string, DTPlayerSetup>([
        ['0', { id: '0', page: hostPage, context: hostContext }],
    ]);
    const extraPlayers: DTPlayerSetup[] = [];

    for (const playerId of joinPlayerIds) {
        const guestContext = await browser.newContext({
            ...options.contextOptions,
            baseURL,
        });
        await initContext(guestContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false, ...contextInitOptions });
        const guestPage = await guestContext.newPage();

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
        await gotoDTMatchRoom(guestPage, matchId, playerId);
        if (!options.skipCharacterSelectionWait && !shouldBatchWaitForCharacterSelection) {
            await waitForCharacterSelectionInRoom(guestPage, {
                matchId,
                playerId,
                timeout: options.characterSelectionTimeout,
            });
        }

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

    if (shouldBatchWaitForCharacterSelection) {
        await Promise.all(players.map((player) => waitForCharacterSelectionInRoom(player.page, {
            matchId,
            playerId: player.id,
            timeout: options.characterSelectionTimeout,
        })));
    }

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
        try {
            await context.close();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                /Target page, context or browser has been closed/i.test(message)
                || /Browser has been closed/i.test(message)
            ) {
                continue;
            }
            throw error;
        }
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

const readDebugStateRoot = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.G ?? parsed;
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
        const state = await readDebugStateRoot(page);
        const currentPhase = typeof state?.sys?.phase === 'string'
            ? state.sys.phase
            : (typeof state?.core?.phase === 'string' ? state.core.phase : undefined);
        if (currentPhase === phase) return;
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

export const dispatchDiceThroneCommandWithTimeout = async (
    page: Page,
    command: {
        type: string;
        playerId: string;
        payload?: Record<string, unknown>;
    },
    timeoutMs = 5000,
): Promise<'ok' | 'timeout' | `error:${string}`> => {
    await waitForDiceThroneHarness(page);
    return page.evaluate(async ({ nextCommand, nextTimeoutMs }) => {
        try {
            const result = await Promise.race([
                (window as Window).__BG_TEST_HARNESS__!.command.dispatch(nextCommand).then(() => 'ok' as const),
                new Promise<'timeout'>((resolve) => {
                    setTimeout(() => resolve('timeout'), nextTimeoutMs);
                }),
            ]);
            return result;
        } catch (error) {
            return `error:${error instanceof Error ? error.message : String(error)}` as const;
        }
    }, {
        nextCommand: command,
        nextTimeoutMs: timeoutMs,
    });
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
