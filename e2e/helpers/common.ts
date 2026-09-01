/**
 * E2E 测试通用工具函数
 *
 * 所有游戏共享的浏览器上下文初始化、服务器检测、页面诊断等。
 * 各游戏专用工具放在对应的 helpers/<gameId>.ts 中。
 */

import { type BrowserContext, type Page } from '@playwright/test';

export const DEFAULT_FATAL_FRONTEND_ERROR_PATTERN =
    /Maximum update depth exceeded|Too many re-renders|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Expected a JavaScript module script|is not a valid JavaScript MIME type|ChunkLoadError|Loading chunk/i;

const VITE_ERROR_OVERLAY_SELECTOR = 'vite-error-overlay';

function normalizeFrontendDiagnosticText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// 浏览器上下文初始化（注入 localStorage / 拦截请求）
// ============================================================================

export type E2ETestLocale = 'zh-CN' | 'en';

const DEFAULT_E2E_LOCALE: E2ETestLocale = 'zh-CN';

/** 设置指定 locale */
export const setTestLocale = async (
    context: BrowserContext | Page,
    locale: E2ETestLocale = DEFAULT_E2E_LOCALE,
) => {
    await context.addInitScript((nextLocale) => {
        localStorage.setItem('bg_locale_preference', nextLocale);
        localStorage.setItem('i18nextLng', nextLocale);
    }, locale);
};

/** 设置中文 locale（默认推荐） */
export const setChineseLocale = async (context: BrowserContext | Page) => {
    await setTestLocale(context, 'zh-CN');
};

/** 设置英文 locale（仅英文断言/双语回归时显式使用） */
export const setEnglishLocale = async (context: BrowserContext | Page) => {
    await setTestLocale(context, 'en');
};

/** 跳过教学引导 */
export const disableTutorial = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('tutorial_skip', '1');
    });
};

/** 禁用音频（localStorage + 全局标记） */
export const disableAudio = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('audio_muted', 'true');
        localStorage.setItem('audio_master_volume', '0');
        localStorage.setItem('audio_sfx_volume', '0');
        localStorage.setItem('audio_bgm_volume', '0');
        (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
    });
};

/** 拦截所有音频文件请求（减少网络开销） */
export const blockAudioRequests = async (context: BrowserContext) => {
    await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, (route) => route.abort());
};

/**
 * 拦截 CDN 资源请求（图片/字体等），返回空响应。
 * 仅适用于不关心真实图片渲染的快测场景；视觉/E2E 验收不要默认开启。
 */
export const blockCdnRequests = async (context: BrowserContext) => {
    // 拦截 assets.easyboardgame.top 域名的所有请求
    await context.route(/assets\.easyboardgame\.top/i, (route) => {
        const url = route.request().url();
        // 图片请求返回 1x1 透明 PNG
        if (/\.(png|jpg|jpeg|webp|avif|gif|svg)(\?.*)?$/i.test(url)) {
            return route.fulfill({
                status: 200,
                contentType: 'image/png',
                // 1x1 透明 PNG（最小有效 PNG）
                body: Buffer.from(
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==',
                    'base64',
                ),
            });
        }
        // JSON 配置文件返回空对象
        if (/\.json(\?.*)?$/i.test(url)) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{}',
            });
        }
        // 其他资源直接 abort
        return route.abort();
    });
};

/**
 * 隐藏不承载当前游戏流程的全局悬浮 FAB。
 *
 * 只用于截图 / 流程 E2E 中移除全局工具对牌桌点击的遮挡；不得隐藏游戏 HUD、
 * 阶段按钮、手牌 / 法术书、地图、目标、确认入口、提示卡或放大入口。
 */
export const disableNonFlowFabForE2e = async (
    page: Page,
    gameId?: string,
) => {
    const scope = gameId
        ? `html[data-game-id="${gameId}"] [data-testid="fab-menu"]`
        : '[data-testid="fab-menu"]';
    await page.addStyleTag({
        content: [
            `${scope} {`,
            '  pointer-events: none !important;',
            '  opacity: 0 !important;',
            '  visibility: hidden !important;',
            '}',
        ].join('\n'),
    }).catch(() => {});
};

/**
 * 重置客户端对局凭证，生成新的 guestId。
 * storageKey 用于防止同一页面重复执行（不同游戏用不同 key）。
 */
export const resetMatchStorage = async (
    context: BrowserContext | Page,
    storageKey = '__storage_reset',
) => {
    await context.addInitScript((key) => {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        const newGuestId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        localStorage.removeItem('owner_active_match');
        Object.keys(localStorage).forEach((k) => {
            if (k.startsWith('match_creds_')) localStorage.removeItem(k);
            if (k.startsWith('match_ai_creds_')) localStorage.removeItem(k);
        });
        localStorage.setItem('guest_id', newGuestId);
        try {
            sessionStorage.setItem('guest_id', newGuestId);
        } catch {
            /* ignore */
        }
        document.cookie = `bg_guest_id=${encodeURIComponent(newGuestId)}; path=/; SameSite=Lax`;
    }, storageKey);
};

/** 生成带前缀的唯一 guestId */
export const createGuestId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

// ============================================================================
// 服务器检测
// ============================================================================

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

/** 获取游戏服务器 baseURL（优先环境变量） */
export const getGameServerBaseURL = () => {
    const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    // E2E 测试专用端口优先（PW_GAME_SERVER_PORT），避免与开发环境冲突
    const port =
        process.env.PW_GAME_SERVER_PORT || process.env.GAME_SERVER_PORT || '18000';
    // 使用 127.0.0.1 而不是 localhost，避免 Windows 上 Playwright 优先尝试 IPv6 (::1) 导致 ECONNREFUSED
    return `http://127.0.0.1:${port}`;
};

/** 获取 API 服务器 baseURL（优先环境变量） */
export const getApiServerBaseURL = () => {
    const envUrl = process.env.PW_API_SERVER_URL || process.env.VITE_API_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    const port =
        process.env.PW_API_SERVER_PORT || process.env.API_SERVER_PORT || '18001';
    return `http://127.0.0.1:${port}`;
};

/** 检查游戏服务器是否可用 */
export const ensureGameServerAvailable = async (
    page: Page,
    gameServerBaseURLOverride?: string,
) => {
    const gameServerBaseURL = gameServerBaseURLOverride ?? getGameServerBaseURL();
    const listUrl = `${gameServerBaseURL}/games`;
    const startedAt = Date.now();
    const timeoutMs = 15000;

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await page.request.get(listUrl);
            if (response.ok()) {
                return true;
            }
        } catch {
            // ignore transient startup/network errors
        }
        await page.waitForTimeout(1000);
    }

    return false;
};

/**
 * 轮询等待指定对局在服务端可查询到。
 * gameName 为服务端注册的游戏名（如 'dicethrone'、'summonerwars'）。
 */
export const waitForMatchAvailable = async (
    page: Page,
    gameName: string,
    matchId: string,
    timeoutMs = 15000,
) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const candidates = [
        `/games/${gameName}/${matchId}`,
        `${gameServerBaseURL}/games/${gameName}/${matchId}`,
    ];
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        for (const url of candidates) {
            try {
                const response = await page.request.get(url);
                if (response.ok()) return true;
            } catch {
                /* ignore */
            }
        }
        await page.waitForTimeout(500);
    }
    return false;
};

// ============================================================================
// 页面诊断
// ============================================================================

/** 移除 Vite 错误覆盖层 */
export const dismissViteOverlay = async (page: Page) => {
    await page.evaluate((selector) => {
        const overlay = document.querySelector(selector);
        if (overlay) overlay.remove();
    }, VITE_ERROR_OVERLAY_SELECTOR);
};

/** 挂载页面错误收集器（pageerror + console.error） */
export const attachPageDiagnostics = (page: Page) => {
    const existing = (page as Page & { __e2eDiagnostics?: { errors: string[] } })
        .__e2eDiagnostics;
    if (existing) return existing;
    const diagnostics = {
        errors: [] as string[],
        page,
    };
    (page as Page & { __e2eDiagnostics?: typeof diagnostics }).__e2eDiagnostics =
        diagnostics;
    page.on('pageerror', (err) =>
        diagnostics.errors.push(`pageerror:${err.stack ?? err.message}`),
    );
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            void Promise.all(msg.args().map(async (arg) => {
                try {
                    return await arg.jsonValue();
                } catch {
                    return '[unserializable]';
                }
            })).then((args) => {
                const location = msg.location();
                const locationText = location?.url
                    ? `${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`
                    : 'unknown';
                const argText = args.length > 0
                    ? ` | args=${args.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' || ')}`
                    : '';
                diagnostics.errors.push(`console:${locationText}:${msg.text()}${argText}`);
            });
        }
    });
    return diagnostics;
};

async function readViteOverlayMessage(page: Page): Promise<string | null> {
    if (page.isClosed()) {
        return null;
    }

    try {
        const overlayText = await page.evaluate((selector) => {
            const overlay = document.querySelector(selector) as HTMLElement | null;
            if (!overlay) return null;
            const raw = overlay.shadowRoot?.textContent ?? overlay.textContent ?? '';
            return raw || null;
        }, VITE_ERROR_OVERLAY_SELECTOR);

        if (!overlayText) {
            return null;
        }

        const normalized = normalizeFrontendDiagnosticText(overlayText);
        return normalized.length > 0 ? normalized : null;
    } catch {
        return null;
    }
}

/** 断言页面未出现致命前端渲染错误 */
export const assertNoFatalFrontendErrors = async (
    diagnosticsEntries: Array<{ label: string; diagnostics: { errors: string[]; page: Page } }>,
    pattern: RegExp = DEFAULT_FATAL_FRONTEND_ERROR_PATTERN,
) => {
    const matched = diagnosticsEntries.flatMap(({ label, diagnostics }) =>
        diagnostics.errors
            .filter((entry) => pattern.test(entry))
            .map((entry) => `[${label}] ${entry}`),
    );

    const overlayMatched: string[] = [];
    for (const { label, diagnostics } of diagnosticsEntries) {
        const overlayMessage = await readViteOverlayMessage(diagnostics.page);
        if (!overlayMessage) {
            continue;
        }
        overlayMatched.push(`[${label}] vite-error-overlay:${overlayMessage}`);
    }

    if (matched.length > 0 || overlayMatched.length > 0) {
        throw new Error(
            [
                '检测到致命前端渲染错误：',
                ...matched,
                ...overlayMatched,
            ].join('\n'),
        );
    }
};

/** 等待 Vite 前端资源就绪 */
export const waitForFrontendAssets = async (page: Page, timeoutMs = 30000) => {
    const start = Date.now();
    let lastStatus = 'unknown';
    while (Date.now() - start < timeoutMs) {
        try {
            const [viteClient, main] = await Promise.all([
                page.request.get('/@vite/client'),
                page.request.get('/src/main.tsx'),
            ]);
            lastStatus = `vite=${viteClient.status()} main=${main.status()}`;
            if (viteClient.ok() && main.ok()) return;
        } catch (err) {
            lastStatus = `error:${String(err)}`;
        }
        await page.waitForTimeout(500);
    }
    throw new Error(`前端资源未就绪: ${lastStatus}`);
};

/** 等待首页游戏列表渲染 */
export const waitForHomeGameList = async (page: Page, timeoutMs = 30000) => {
    await page.waitForLoadState('domcontentloaded');
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            await page.waitForSelector('[data-game-id]', {
                timeout: 5000,
                state: 'attached',
            });
            return;
        } catch {
            await page.waitForTimeout(1000);
        }
    }
    throw new Error('等待游戏列表超时');
};

/** 关闭大厅确认弹窗（如果存在） */
export const dismissLobbyConfirmIfNeeded = async (page: Page) => {
    const confirmButton = page
        .locator('button:has-text("确认")')
        .or(page.locator('button:has-text("Confirm")'));
    if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
    }
};

/**
 * 向服务端 join 对局并返回 credentials。
 * gameName 为服务端注册的游戏名。
 */
export const joinMatchViaAPI = async (
    page: Page,
    gameName: string,
    matchId: string,
    playerId: string,
    playerName: string,
    guestId?: string,
) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games/${gameName}/${matchId}/join`;
    const response = await page.request.post(url, {
        data: {
            playerID: playerId,
            playerName,
            ...(guestId ? { data: { guestId } } : {}),
        },
    });
    if (!response.ok()) return null;
    const data = (await response.json().catch(() => null)) as {
        playerCredentials?: string;
    } | null;
    return data?.playerCredentials ?? null;
};

/**
 * 将对局凭证写入 localStorage（通过 addInitScript 在页面加载前注入）。
 */
export const seedMatchCredentials = async (
    context: BrowserContext | Page,
    gameName: string,
    matchId: string,
    playerId: string,
    credentials: string,
) => {
    await context.addInitScript(
        ({ gameName, matchId, playerId, credentials }) => {
            const payload = {
                matchID: matchId,
                playerID: playerId,
                credentials,
                gameName,
                updatedAt: Date.now(),
            };
            localStorage.setItem(
                `match_creds_${matchId}`,
                JSON.stringify(payload),
            );
            window.dispatchEvent(new Event('match-credentials-changed'));
        },
        { gameName, matchId, playerId, credentials },
    );
};

// ============================================================================
// 通用上下文初始化（一次性设置所有常用选项）
// ============================================================================

/** 拦截大厅 WebSocket 请求（防止 lobby presence 检测导致页面跳转回首页） */
export const blockLobbySocket = async (context: BrowserContext) => {
    // context.route 无法拦截 WebSocket 升级请求，改用 addInitScript 禁用大厅 socket
    await context.addInitScript(() => {
        // 标记 E2E 测试环境，阻止大厅 socket 连接
        (window as Window & { __E2E_BLOCK_LOBBY_SOCKET__?: boolean }).__E2E_BLOCK_LOBBY_SOCKET__ = true;
    });
    // 同时尝试 route 拦截（对 polling 传输有效）
    await context.route(/\/lobby-socket\//i, (route) => route.abort());
};

/**
 * 注入 __FORCE_GAME_SERVER_URL__，让客户端直接连接游戏服务器，
 * 绕过 Vite 代理（多 WebSocket 并发时代理不稳定）。
 */
export const injectDirectGameServerUrl = async (
    context: BrowserContext,
    gameServerBaseURLOverride?: string,
) => {
    const gameServerUrl = gameServerBaseURLOverride ?? getGameServerBaseURL();
    await context.addInitScript((url) => {
        (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__ = url;
    }, gameServerUrl);
};

/**
 * 注入 __FORCE_API_SERVER_URL__，让客户端请求指向指定 API 服务器。
 * 避免在独立 E2E runtime 中误连开发环境 API。
 */
export const injectDirectApiServerUrl = async (
    context: BrowserContext,
    apiServerBaseURLOverride?: string,
) => {
    const apiServerUrl = apiServerBaseURLOverride ?? getApiServerBaseURL();
    await context.addInitScript((url) => {
        (window as Window & { __FORCE_API_SERVER_URL__?: string }).__FORCE_API_SERVER_URL__ = url;
    }, apiServerUrl);
};

/**
 * 注入 __E2E_SKIP_IMAGE_GATE__，跳过 CriticalImageGate 图片预加载门禁。
 * E2E 测试不需要等待图片预加载完成。
 */
export const injectSkipImageGate = async (
    context: BrowserContext,
    enabled = true,
) => {
    await context.addInitScript((shouldSkip) => {
        (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = shouldSkip;
    }, enabled);
};

/**
 * 启用测试模式（注入到浏览器上下文）
 */
export const enableTestMode = async (context: BrowserContext) => {
    await context.addInitScript(() => {
        (window as any).__E2E_TEST_MODE__ = true;
    });
};

/**
 * 等待测试工具就绪
 */
export const waitForTestHarness = async (page: Page, timeout = 5000) => {
    await page.waitForFunction(
        () => !!(window as any).__BG_TEST_HARNESS__,
        undefined,
        { timeout }
    );
};

type InitContextOptions = {
    storageKey?: string;
    skipTutorial?: boolean;
    skipImageGate?: boolean;
    blockLobbySocket?: boolean;
    gameServerBaseURL?: string;
    apiServerBaseURL?: string;
    locale?: E2ETestLocale;
    blockCdnAssets?: boolean;
};

const normalizeInitContextOptions = (
    opts?: string | InitContextOptions,
): InitContextOptions => {
    if (typeof opts === 'string') {
        return { storageKey: opts };
    }
    return opts ?? {};
};

/** 对 BrowserContext 执行标准初始化（中文 locale + 禁音 + 拦截音频 + 可选跳过教学/图片门禁/远端图片） */
export const initContext = async (
    context: BrowserContext,
    opts?: string | InitContextOptions,
) => {
    const resolved = normalizeInitContextOptions(opts);
    await enableTestMode(context); // 启用测试模式
    await blockAudioRequests(context);
    if (resolved.blockLobbySocket !== false) {
        await blockLobbySocket(context);
    }
    await injectDirectGameServerUrl(context, resolved.gameServerBaseURL);
    await injectDirectApiServerUrl(context, resolved.apiServerBaseURL);
    if (resolved.blockCdnAssets === true) {
        await blockCdnRequests(context);
    }
    await injectSkipImageGate(context, resolved.skipImageGate ?? false);
    await setTestLocale(context, resolved.locale ?? DEFAULT_E2E_LOCALE);
    await resetMatchStorage(context, resolved.storageKey);
    if (resolved.skipTutorial !== false) await disableTutorial(context);
    await disableAudio(context);
    return context; // ✅ 返回 context
};
