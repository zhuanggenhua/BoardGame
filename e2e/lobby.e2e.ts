import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test, expect } from './framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';
import { getGameServerBaseURL, setChineseLocale } from './helpers/common';

function isRetryableNavigationError(error: unknown): boolean {
    return error instanceof Error
        && (
            error.message.includes('ERR_ABORTED')
            || error.message.includes('frame was detached')
            || error.message.includes('ERR_CONNECTION_REFUSED')
        );
}

async function gotoLobbyWithRetry(page: Page): Promise<void> {
    const maxAttempts = 15;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await page.goto('/', { waitUntil: 'commit', timeout: 10000 });
            return;
        } catch (error) {
            if (!isRetryableNavigationError(error) || attempt === maxAttempts) {
                throw error;
            }

            await page.waitForTimeout(2000);
        }
    }
}

async function ensureLobbyReady(page: Page): Promise<void> {
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        await gotoLobbyWithRetry(page);

        try {
            await expect(page.locator('[data-game-id="tictactoe"]').first()).toBeVisible({ timeout: 10000 });
            return;
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }
            await page.waitForTimeout(1500);
        }
    }
}

async function ensureHomeV2BookMaterialsReady(
    page: Page,
    options?: { requireLegacyTabs?: boolean },
): Promise<void> {
    const requiredImageKeywords = [
        ...(options?.requireLegacyTabs === false
            ? ['/book-catalog-wide/1.png']
            : ['/book-idle/compressed/1.webp', '/side-tabs-static/compressed/1.webp']),
    ];

    await expect.poll(async () => page.evaluate((keywords) => {
        const images = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
        return keywords.map((keyword) => {
            const target = images.find((img) => (img.currentSrc || img.src || '').includes(keyword));
            if (!target) return 'missing';
            if (!target.complete) return 'loading';
            return target.naturalWidth > 0 ? 'ok' : 'broken';
        });
    }, requiredImageKeywords), {
        timeout: 15000,
        message: 'HomeV2 书本素材未完成加载',
    }).toEqual(requiredImageKeywords.map(() => 'ok'));
}

async function waitForMatchBoardOrLoading(page: Page): Promise<'board' | 'loading'> {
    const detectPhase = async () => page.evaluate(() => {
        const text = document.body?.innerText ?? '';
        if (text.includes('井字棋') || text.includes('的回合') || text.includes('等待对手加入')) {
            return 'board';
        }
        if (/正在加载对局资源|加载游戏模块|Loading match resources/i.test(text)) {
            return 'loading';
        }
        return 'pending';
    });

    try {
        await expect.poll(detectPhase, {
            timeout: 8000,
            message: '尝试优先等待井字棋对局主界面出现',
        }).toBe('board');
        return 'board';
    } catch {
        // 回退到 “至少出现加载态或棋盘态”
    }

    let phase: 'board' | 'loading' | 'pending' = 'pending';
    await expect.poll(async () => {
        phase = await detectPhase();
        return phase;
    }, {
        timeout: 20000,
        message: '进入对局后未检测到可视化内容',
    }).not.toBe('pending');

    return phase === 'loading' ? 'loading' : 'board';
}

async function applyKeyboardViewportSimulation(page: Page, options: { runtimeViewportHeight: number; keyboardInsetHeight: number }) {
    await page.evaluate(({ runtimeViewportHeight, keyboardInsetHeight }) => {
        const root = document.documentElement;
        root.style.setProperty('--runtime-viewport-height', `${runtimeViewportHeight}px`);
        root.style.setProperty('--keyboard-inset-height', `${keyboardInsetHeight}px`);
        root.dataset.keyboardVisible = 'true';
    }, options);
}

async function openCreateRoomFromDetailsModal(page: Page): Promise<void> {
    const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
    await expect(detailsModal).toBeVisible({ timeout: 15000 });

    const openCreateRoomButton = detailsModal.getByTestId('game-details-open-create-room');
    await expect(openCreateRoomButton).toBeVisible({ timeout: 10000 });
    await openCreateRoomButton.click();
    await expect(page.getByTestId('create-room-modal').last()).toBeVisible({ timeout: 10000 });
}

const getVisibleGameDetailsModal = (page: Page) => page.locator('[data-testid="game-details-modal-root"]:visible').last();

async function confirmCreateRoomFromModal(page: Page): Promise<void> {
    const confirmButton = page.getByTestId('create-room-confirm-button');
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.click();
}

const HOME_V2_QUERY_ENTRY_TEST_NAME = 'homeV2Draft 查询参数会切到 V2 首页并可进入详情页';
const HOME_V2_LOCKED_ROOM_JOIN_TEST_NAME = 'homeV2Draft 详情页输入房间密码后可加入加密房间';
const HOME_V2_PACKAGE_ENTRY_TEST_NAME = 'homeV2Draft package-managed 游戏详情暂不显示移动包管理入口';
const HOME_V2_MODAL_UNIFIED_TEST_NAME = 'homeV2Draft 登录与创建房间弹窗统一使用纸面 modal';
const MOBILE_AUTHOR_ENTRY_TEST_NAME = '移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围框';
const MOBILE_PACKAGE_ENTRY_TEST_NAME = '移动端 package-managed 游戏详情在左下角显示包管理入口';
const GAME_DETAILS_LOADING_FALLBACK_TEST_NAME = '首次打开游戏详情时会先显示加载骨架，避免只剩路由跳转';
const ACTIVE_MATCH_FLOATING_BANNER_TEST_NAME = '首页活跃房间浮层在桌面端居中且移动端不溢出';
const WEB_APP_DOWNLOAD_ENTRY_TEST_NAME = '网页端下载 App 入口会读取 native update latest.json 并打开其中 APK 地址';
const DEFAULT_HOME_V2_MOBILE_LANDSCAPE_VIEWPORT = { width: 852, height: 393 };
const HOME_V2_MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36';
function parseHomeV2ViewportFromEnv() {
    const raw = process.env.BG_HOME_V2_VIEWPORT?.trim();
    if (!raw) return DEFAULT_HOME_V2_MOBILE_LANDSCAPE_VIEWPORT;
    const matched = raw.match(/^(\d+)x(\d+)$/i);
    if (!matched) return DEFAULT_HOME_V2_MOBILE_LANDSCAPE_VIEWPORT;
    const width = Number.parseInt(matched[1], 10);
    const height = Number.parseInt(matched[2], 10);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return DEFAULT_HOME_V2_MOBILE_LANDSCAPE_VIEWPORT;
    }
    return { width, height };
}
const HOME_V2_MOBILE_LANDSCAPE_VIEWPORT = parseHomeV2ViewportFromEnv();
const HOME_V2_FLIP_CAPTURE_POINTS = [
    { suffix: '25', progress: 0.25 },
    { suffix: '50', progress: 0.5 },
    { suffix: '75', progress: 0.75 },
] as const;

type HomeV2WorkerPorts = {
    frontend: number;
    gameServer: number;
    apiServer: number;
};

async function useHomeV2MobileLandscapeViewport(page: Page): Promise<void> {
    await page.setViewportSize(HOME_V2_MOBILE_LANDSCAPE_VIEWPORT);
    const viewport = page.viewportSize();
    if (!viewport) {
        throw new Error('未能读取当前 Playwright 视口');
    }
    console.log(`[home-v2-viewport] width=${viewport.width}, height=${viewport.height}`);
}

async function createHomeV2MobileLandscapeContext(
    browser: Browser,
    workerPorts: HomeV2WorkerPorts,
): Promise<BrowserContext> {
    const context = await browser.newContext({
        baseURL: `http://127.0.0.1:${workerPorts.frontend}`,
        viewport: HOME_V2_MOBILE_LANDSCAPE_VIEWPORT,
        screen: HOME_V2_MOBILE_LANDSCAPE_VIEWPORT,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: HOME_V2_MOBILE_USER_AGENT,
        colorScheme: 'light',
    });

    await context.addInitScript(() => {
        (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ = true;
    });
    await context.addInitScript((ports) => {
        (window as Window & { __E2E_WORKER_PORTS__?: HomeV2WorkerPorts }).__E2E_WORKER_PORTS__ = ports;
        (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__ = `http://127.0.0.1:${ports.gameServer}`;
        (window as Window & { __FORCE_API_SERVER_URL__?: string }).__FORCE_API_SERVER_URL__ = `http://127.0.0.1:${ports.apiServer}`;
    }, workerPorts);
    await setChineseLocale(context);

    return context;
}

async function captureHomeV2FlipFrameAtProgress(
    page: Page,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
    name: string,
    targetProgress: number,
): Promise<void> {
    const flipStage = page.locator('[data-testid="home-v2-root"] [data-testid="home-v2-fold-line-flip"]').first();
    await expect(flipStage).toBeVisible({ timeout: 5000 });
    const startedAt = Date.now();
    let lastSnapshot: Record<string, unknown> | null = null;

    await page.evaluate((target) => {
        (window as Window & { __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number }).__BG_HOME_V2_E2E_HOLD_PROGRESS__ = target;
    }, targetProgress);

    try {
        while (Date.now() - startedAt < 4000) {
            lastSnapshot = await flipStage.evaluate((stage) => ({
                mode: stage.getAttribute('data-flip-mode'),
                raw: stage.getAttribute('data-flip-progress-raw'),
                progress: stage.getAttribute('data-flip-progress'),
                animating: stage.getAttribute('data-turn-animating'),
                ready: stage.getAttribute('data-turn-ready'),
                error: stage.getAttribute('data-turn-error'),
                sourceSnapshotReady: stage.getAttribute('data-turn-source-snapshot-ready'),
                mainEffectRuns: stage.getAttribute('data-turn-main-effect-runs'),
                progressLoopStarts: stage.getAttribute('data-turn-progress-loop-starts'),
                progressTicks: stage.getAttribute('data-turn-progress-ticks'),
                progressLastRaw: stage.getAttribute('data-turn-progress-last-raw'),
                pluginPage: stage.getAttribute('data-turn-plugin-page'),
                pluginView: stage.getAttribute('data-turn-plugin-view'),
                pluginAnimating: stage.getAttribute('data-turn-plugin-animating'),
                pageWrappers: Array.from(stage.querySelectorAll<HTMLElement>('.page-wrapper')).map((wrapper) => ({
                    page: wrapper.getAttribute('page'),
                    display: getComputedStyle(wrapper).display,
                    left: wrapper.style.left,
                    top: wrapper.style.top,
                    width: wrapper.style.width,
                    height: wrapper.style.height,
                    zIndex: wrapper.style.zIndex,
                })),
            }));
            const raw = Number.parseFloat(String(lastSnapshot.raw ?? ''));
            const animating = lastSnapshot.animating === 'true';
            if (Number.isFinite(raw) && animating && raw >= targetProgress) {
                console.log(`[home-v2-flip-capture] ${name} => ${JSON.stringify(lastSnapshot)}`);
                const screenshotPath = getEvidenceScreenshotPath(testInfo, name);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                return;
            }
            await page.waitForTimeout(80);
        }
    } finally {
        await page.evaluate(() => {
            delete (window as Window & { __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number }).__BG_HOME_V2_E2E_HOLD_PROGRESS__;
        });
    }

    throw new Error(`HomeV2 翻页进度未达目标，最后快照=${JSON.stringify(lastSnapshot)}`);
}

async function waitForHomeV2FlipMode(page: Page, expectedMode: 'overview' | 'detail'): Promise<void> {
    const flipStage = page.locator('[data-testid="home-v2-root"] [data-testid="home-v2-fold-line-flip"]').first();
    await expect(flipStage).toHaveAttribute('data-flip-mode', expectedMode, { timeout: 10000 });
    await expect(flipStage).toHaveAttribute('data-turn-animating', 'false', { timeout: 10000 });
}

async function createTicTacToeRoom(page: Page): Promise<string> {
    const gameServerBaseURL = getGameServerBaseURL();
    const guestId = `home-banner-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const createResponse = await page.request.post(`${gameServerBaseURL}/games/tictactoe/create`, {
        data: {
            numPlayers: 2,
            setupData: { guestId },
        },
    });
    if (!createResponse.ok()) {
        throw new Error(`井字棋建房失败: ${createResponse.status()}`);
    }
    const createData = await createResponse.json() as { matchID?: string };
    const matchId = createData.matchID;
    if (!matchId) throw new Error('建房响应缺少 matchID');

    const joinResponse = await page.request.post(`${gameServerBaseURL}/games/tictactoe/${matchId}/join`, {
        data: {
            playerID: '0',
            playerName: `Banner_${guestId.slice(-4)}`,
            data: { guestId },
        },
    });
    if (!joinResponse.ok()) {
        throw new Error(`井字棋加入失败: ${joinResponse.status()}`);
    }
    const joinData = await joinResponse.json() as { playerCredentials?: string };
    if (!joinData.playerCredentials) {
        throw new Error('加入房间后未返回 playerCredentials');
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ mid, creds, guestId }) => {
        localStorage.setItem('guest_id', guestId);
        try {
            sessionStorage.setItem('guest_id', guestId);
        } catch {
            // ignore
        }
        document.cookie = `bg_guest_id=${encodeURIComponent(guestId)}; path=/; SameSite=Lax`;
        localStorage.setItem(`match_creds_${mid}`, JSON.stringify({
            matchID: mid,
            playerID: '0',
            credentials: creds,
            gameName: 'tictactoe',
            updatedAt: Date.now(),
        }));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { mid: matchId, creds: joinData.playerCredentials, guestId });

    return matchId;
}

async function createLockedTicTacToeRoom(page: Page): Promise<{ matchId: string; roomName: string; password: string }> {
    const gameServerBaseURL = getGameServerBaseURL();
    const guestId = `private-room-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const roomName = `移动端密码房-${guestId.slice(-4)}`;
    const password = '654321';

    const createResponse = await page.request.post(`${gameServerBaseURL}/games/tictactoe/create`, {
        data: {
            numPlayers: 2,
            setupData: {
                guestId,
                roomName,
                password,
            },
        },
    });
    if (!createResponse.ok()) {
        throw new Error(`私密井字棋建房失败: ${createResponse.status()}`);
    }
    const createData = await createResponse.json() as { matchID?: string };
    const matchId = createData.matchID;
    if (!matchId) throw new Error('私密建房响应缺少 matchID');

    const joinResponse = await page.request.post(`${gameServerBaseURL}/games/tictactoe/${matchId}/join`, {
        data: {
            playerID: '0',
            playerName: `Private_${guestId.slice(-4)}`,
            data: { guestId, password },
        },
    });
    if (!joinResponse.ok()) {
        throw new Error(`私密房主加入失败: ${joinResponse.status()}`);
    }

    return { matchId, roomName, password };
}

async function createNamedPublicDiceThroneRoom(
    page: Page,
    roomName?: string,
    options?: { password?: string; fillSecondSeat?: boolean },
): Promise<{ matchId: string; roomName: string }> {
    const gameServerBaseURL = getGameServerBaseURL();
    const guestId = `homev2-dt-room-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const resolvedRoomName = roomName ?? `王权骰铸演示房-${guestId.slice(-4)}`;

    const createResponse = await page.request.post(`${gameServerBaseURL}/games/dicethrone/create`, {
        data: {
            numPlayers: 2,
            setupData: {
                guestId,
                roomName: resolvedRoomName,
                ...(options?.password ? { password: options.password } : {}),
            },
        },
    });
    if (!createResponse.ok()) {
        throw new Error(`HomeV2 Dice Throne 演示建房失败: ${createResponse.status()}`);
    }
    const createData = await createResponse.json() as { matchID?: string };
    const matchId = createData.matchID;
    if (!matchId) throw new Error('HomeV2 Dice Throne 演示建房缺少 matchID');

    const joinResponse = await page.request.post(`${gameServerBaseURL}/games/dicethrone/${matchId}/join`, {
        data: {
            playerID: '0',
            playerName: `DT_${guestId.slice(-4)}`,
            data: {
                guestId,
                ...(options?.password ? { password: options.password } : {}),
            },
        },
    });
    if (!joinResponse.ok()) {
        throw new Error(`HomeV2 Dice Throne 演示房主加入失败: ${joinResponse.status()}`);
    }

    if (options?.fillSecondSeat) {
        const secondGuestId = `${guestId}-seat1`;
        const secondJoinResponse = await page.request.post(`${gameServerBaseURL}/games/dicethrone/${matchId}/join`, {
            data: {
                playerID: '1',
                playerName: `Guest_${secondGuestId.slice(-4)}`,
                data: {
                    guestId: secondGuestId,
                    ...(options.password ? { password: options.password } : {}),
                },
            },
        });
        if (!secondJoinResponse.ok()) {
            throw new Error(`HomeV2 Dice Throne 第二席加入失败: ${secondJoinResponse.status()}`);
        }
    }

    return { matchId, roomName: resolvedRoomName };
}

async function createHomeV2DetailShowcaseRooms(page: Page): Promise<{ matchId: string; roomName: string }> {
    const roomConfigs = [
        { roomName: '新手教学局' },
        { roomName: '策略对决', password: '112233' },
        { roomName: '卡牌大师', fillSecondSeat: true },
        { roomName: '休闲娱乐局' },
        { roomName: '战术研究室', password: '556677' },
        { roomName: '周末快玩房' },
    ];
    let firstRoom: { matchId: string; roomName: string } | null = null;

    for (const roomConfig of roomConfigs) {
        const created = await createNamedPublicDiceThroneRoom(page, roomConfig.roomName, {
            password: roomConfig.password,
            fillSecondSeat: roomConfig.fillSecondSeat,
        });
        if (!firstRoom) {
            firstRoom = created;
        }
    }

    if (!firstRoom) {
        throw new Error('未能创建 HomeV2 详情页演示房间');
    }

    return firstRoom;
}

test.describe('Lobby E2E', () => {
    test.describe.configure({ timeout: 90000 });

    test.beforeEach(async ({ page }, testInfo) => {
        await setChineseLocale(page);
        if (
            testInfo.title === HOME_V2_QUERY_ENTRY_TEST_NAME
            || testInfo.title === HOME_V2_LOCKED_ROOM_JOIN_TEST_NAME
            || testInfo.title === HOME_V2_PACKAGE_ENTRY_TEST_NAME
            || testInfo.title === HOME_V2_MODAL_UNIFIED_TEST_NAME
            || testInfo.title === MOBILE_AUTHOR_ENTRY_TEST_NAME
            || testInfo.title === MOBILE_PACKAGE_ENTRY_TEST_NAME
            || testInfo.title === GAME_DETAILS_LOADING_FALLBACK_TEST_NAME
        ) {
            return;
        }
        await ensureLobbyReady(page);
    });

    test(HOME_V2_QUERY_ENTRY_TEST_NAME, async ({ browser, workerPorts }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const context = await createHomeV2MobileLandscapeContext(browser, workerPorts);
        const page = await context.newPage();
        try {
            await useHomeV2MobileLandscapeViewport(page);
            const continueMatchId = await createTicTacToeRoom(page);
            const injectedRoom = await createHomeV2DetailShowcaseRooms(page);

            await page.goto('/?homeV2Draft=1', { waitUntil: 'domcontentloaded' });
            await expect(page.getByTestId('home-v2-root')).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('home-v2-book-stage')).toBeVisible({ timeout: 30000 });
            await ensureHomeV2BookMaterialsReady(page, { requireLegacyTabs: false });
            const mobileStageMetrics = await page.evaluate(() => {
            const stage = document.querySelector('[data-testid="home-v2-book-stage"]') as HTMLElement | null;
            if (!stage) return null;
            const rect = stage.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            return {
                widthRatio: rect.width / viewportWidth,
                heightRatio: rect.height / viewportHeight,
                centerXRatio: (rect.left + rect.width / 2) / viewportWidth,
                centerYRatio: (rect.top + rect.height / 2) / viewportHeight,
            };
        });
            if (!mobileStageMetrics) {
                throw new Error('未能读取 home-v2-book-stage 的移动端布局数据');
            }
            console.log(
                `[home-v2-mobile-stage] widthRatio=${mobileStageMetrics.widthRatio.toFixed(3)}, heightRatio=${mobileStageMetrics.heightRatio.toFixed(3)}, center=(${mobileStageMetrics.centerXRatio.toFixed(3)},${mobileStageMetrics.centerYRatio.toFixed(3)})`,
            );
            expect(mobileStageMetrics.widthRatio).toBeGreaterThan(0.55);
            expect(mobileStageMetrics.heightRatio).toBeGreaterThan(0.75);
            expect(mobileStageMetrics.centerXRatio).toBeGreaterThan(0.35);
            expect(mobileStageMetrics.centerXRatio).toBeLessThan(0.65);
            const homeSpread = page.locator('[data-scene-slot="overview_spread_body"]').first();
            await expect(homeSpread).toBeVisible({ timeout: 10000 });
            await expect(
                page.locator('[data-scene-node="home-v2-tab-lobby"], [data-scene-node="home-v2-tab-rooms"], [data-scene-node="tab_button_lobby"], [data-scene-node="tab_button_rooms"]'),
            ).toHaveCount(0);
            await expect(page.getByTestId('home-v2-account-entry')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('home-v2-account-entry')).toContainText('登录');
            await expect(page.getByTestId('home-v2-category-all')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('home-v2-category-card')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('home-v2-category-tools')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('home-v2-continue-entry')).toContainText('井字棋');
            await expect(page.getByTestId('home-v2-continue-entry')).not.toContainText('#A12F');
            await page.getByTestId('home-v2-language-entry').click();
            await expect(page.getByTestId('home-v2-language-menu')).toBeVisible({ timeout: 10000 });
            await page.getByTestId('home-v2-language-option-en').click();
            await expect(page.getByTestId('home-v2-language-entry')).toContainText('English');
            await page.getByTestId('home-v2-language-entry').click();
            await page.getByTestId('home-v2-language-option-zh-CN').click();
            await expect(page.getByTestId('home-v2-language-entry')).toContainText('中文');

        await page.getByTestId('home-v2-category-tools').click();
        await captureHomeV2FlipFrameAtProgress(page, testInfo, 'category-flip-to-tools-50', 0.5);
        await waitForHomeV2FlipMode(page, 'overview');
        await expect(page.locator('[data-scene-slot="overview_spread_body"] [data-game-id="assetslicer"]').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-scene-slot="overview_spread_body"] [data-game-id="dicethrone"]')).toHaveCount(0);
        await expect(page.locator('[data-scene-slot="overview_spread_body"] [data-game-id="tictactoe"]')).toHaveCount(0);
        const toolsCatalogScreenshotPath = getEvidenceScreenshotPath(testInfo, 'homepage-catalog-tools-after-flip');
        await page.screenshot({ path: toolsCatalogScreenshotPath, fullPage: true });

        await page.getByTestId('home-v2-category-all').click();
        await waitForHomeV2FlipMode(page, 'overview');
        await expect(page.locator('[data-scene-slot="overview_spread_body"] [data-game-id="dicethrone"]').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-scene-slot="overview_spread_body"] [data-game-id="tictactoe"]').first()).toBeVisible({ timeout: 10000 });

        const catalogMetrics = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('[data-scene-slot="overview_spread_body"] [data-game-id]')) as HTMLElement[];
            const metrics = cards.map((card) => {
                const rect = card.getBoundingClientRect();
                return {
                    id: card.getAttribute('data-game-id') ?? '',
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    centerX: rect.left + rect.width / 2,
                    centerY: rect.top + rect.height / 2,
                };
            });

            const sortedX = metrics.map((item) => item.centerX).sort((a, b) => a - b);
            const columns: number[] = [];
            sortedX.forEach((centerX) => {
                const hasExistingColumn = columns.some((x) => Math.abs(x - centerX) < 40);
                if (!hasExistingColumn) {
                    columns.push(centerX);
                }
            });

            return {
                count: metrics.length,
                columns,
                metrics,
            };
        });
        console.log(
            `[home-v2-homepage] count=${catalogMetrics.count}, columns=${catalogMetrics.columns.map((value) => value.toFixed(2)).join(',')}`,
        );
        expect(catalogMetrics.count).toBe(6);
        expect(catalogMetrics.columns.length).toBe(2);

        const referenceCardIds = ['cardia', 'dicethrone', 'smashup', 'splendor', 'summonerwars', 'tictactoe'];
        const referenceCards = await Promise.all(referenceCardIds.map(async (gameId) => {
            const box = await page.locator(`[data-scene-slot="overview_spread_body"] [data-game-id="${gameId}"]`).first().boundingBox();
            return { gameId, box };
        }));
        if (referenceCards.some((entry) => !entry.box)) {
            throw new Error('首页目录卡片未完整渲染，无法进行双页布局量测');
        }
        const [firstColumnX, secondColumnX] = catalogMetrics.columns;
        const leftItems = catalogMetrics.metrics
            .filter((item) => Math.abs(item.centerX - firstColumnX) < 40)
            .sort((left, right) => left.top - right.top);
        const rightItems = catalogMetrics.metrics
            .filter((item) => Math.abs(item.centerX - secondColumnX) < 40)
            .sort((left, right) => left.top - right.top);
        const leftColumnDelta = Math.max(...leftItems.map((item) => item.left)) - Math.min(...leftItems.map((item) => item.left));
        const rightColumnDelta = Math.max(...rightItems.map((item) => item.left)) - Math.min(...rightItems.map((item) => item.left));
        const leftToRightGap = Math.min(...rightItems.map((item) => item.left)) - Math.min(...leftItems.map((item) => item.left));
        const minRowGap = Math.min(
            ...[leftItems, rightItems].flatMap((items) => items.slice(1).map((item, index) => item.top - items[index].top)),
        );
        console.log(
            `[home-v2-homepage-grid] leftCount=${leftItems.length}, rightCount=${rightItems.length}, leftColumnDelta=${leftColumnDelta.toFixed(2)}, rightColumnDelta=${rightColumnDelta.toFixed(2)}, leftToRightGap=${leftToRightGap.toFixed(2)}, minRowGap=${minRowGap.toFixed(2)}`,
        );
        expect(leftItems.length).toBe(3);
        expect(rightItems.length).toBe(3);
        expect(leftColumnDelta).toBeLessThan(18);
        expect(rightColumnDelta).toBeLessThan(18);
        expect(leftToRightGap).toBeGreaterThan(180);
        expect(minRowGap).toBeGreaterThan(64);

        const visualAlignmentMetrics = await page.evaluate(() => {
            const pageLabel = document.querySelector('[data-testid="home-v2-catalog-page-label"]') as HTMLElement | null;
            const continueEntry = document.querySelector('[data-testid="home-v2-continue-entry"]') as HTMLElement | null;
            const activeCategory = document.querySelector('[data-testid="home-v2-category-all"]') as HTMLElement | null;
            const activeRule = document.querySelector('[data-testid="home-v2-category-active-rule"]') as HTMLElement | null;
            const activeMarker = document.querySelector('[data-testid="home-v2-category-active-marker"]') as HTMLElement | null;
            const headerRule = document.querySelector('[data-testid="home-v2-left-header-rule"]') as HTMLElement | null;
            if (!pageLabel || !continueEntry || !activeCategory || !activeRule || !activeMarker || !headerRule) {
                return null;
            }
            const pageLabelRect = pageLabel.getBoundingClientRect();
            const continueRect = continueEntry.getBoundingClientRect();
            const activeCategoryRect = activeCategory.getBoundingClientRect();
            const activeRuleRect = activeRule.getBoundingClientRect();
            const activeMarkerRect = activeMarker.getBoundingClientRect();
            const headerRuleRect = headerRule.getBoundingClientRect();
            return {
                bottomControlCenterDelta: Math.abs(
                    (pageLabelRect.top + pageLabelRect.height / 2)
                    - (continueRect.top + continueRect.height / 2),
                ),
                activeRuleWidthRatio: activeRuleRect.width / activeCategoryRect.width,
                activeRuleHeaderTopDelta: Math.abs(activeRuleRect.top - headerRuleRect.top),
                activeTextToRuleGap: activeRuleRect.top - activeCategoryRect.bottom,
                activeMarkerCenterDelta: Math.abs(
                    (activeMarkerRect.left + activeMarkerRect.width / 2)
                    - (activeCategoryRect.left + activeCategoryRect.width / 2),
                ),
                activeRuleMarkerCenterDelta: Math.abs(
                    (activeMarkerRect.left + activeMarkerRect.width / 2)
                    - (activeRuleRect.left + activeRuleRect.width / 2),
                ),
            };
        });
        if (!visualAlignmentMetrics) {
            throw new Error('首页设计稿对齐量测节点缺失');
        }
        console.log(
            `[home-v2-reference-alignment] bottomControlCenterDelta=${visualAlignmentMetrics.bottomControlCenterDelta.toFixed(2)}, activeRuleWidthRatio=${visualAlignmentMetrics.activeRuleWidthRatio.toFixed(2)}, activeRuleHeaderTopDelta=${visualAlignmentMetrics.activeRuleHeaderTopDelta.toFixed(2)}, activeTextToRuleGap=${visualAlignmentMetrics.activeTextToRuleGap.toFixed(2)}, activeMarkerCenterDelta=${visualAlignmentMetrics.activeMarkerCenterDelta.toFixed(2)}, activeRuleMarkerCenterDelta=${visualAlignmentMetrics.activeRuleMarkerCenterDelta.toFixed(2)}`,
        );
        expect(visualAlignmentMetrics.bottomControlCenterDelta).toBeLessThan(10);
        expect(visualAlignmentMetrics.activeRuleWidthRatio).toBeGreaterThan(1.0);
        expect(visualAlignmentMetrics.activeRuleWidthRatio).toBeLessThan(1.25);
        expect(visualAlignmentMetrics.activeRuleHeaderTopDelta).toBeLessThan(3);
        expect(visualAlignmentMetrics.activeTextToRuleGap).toBeGreaterThan(0);
        expect(visualAlignmentMetrics.activeTextToRuleGap).toBeLessThan(24);
        expect(visualAlignmentMetrics.activeMarkerCenterDelta).toBeLessThan(6);
        expect(visualAlignmentMetrics.activeRuleMarkerCenterDelta).toBeLessThan(3);

        const homepageScreenshotPath = getEvidenceScreenshotPath(testInfo, 'homepage-catalog');
        await page.screenshot({ path: homepageScreenshotPath, fullPage: true });

        await page.getByTestId('home-v2-account-entry').click();
        const authModal = page.getByTestId('auth-modal').first();
        await expect(authModal).toBeVisible({ timeout: 10000 });
        await expect(
            page.locator('[data-scene-node="home-v2-tab-lobby"], [data-scene-node="home-v2-tab-rooms"], [data-scene-node="tab_button_lobby"], [data-scene-node="tab_button_rooms"]'),
        ).toHaveCount(0);
        await expect(page.getByTestId('auth-embedded-panel')).toHaveCount(0);
        await expect(authModal.getByTestId('auth-login-account-input')).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-login-password-input')).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-submit-button')).toContainText('登 录');
        await expect(authModal.getByTestId('auth-switch-login')).toBeVisible();
        await expect(authModal.getByTestId('auth-switch-register')).toBeVisible();
        await expect(authModal.getByText(/微信|QQ|Google|协议|记住我|Logo|帮助说明|功能介绍|策略 · 卡牌/)).toHaveCount(0);
        const authModalMetrics = await page.evaluate(() => {
            const modal = document.querySelector('[data-testid="auth-modal"]') as HTMLElement | null;
            const bookStage = document.querySelector('[data-testid="home-v2-book-stage"]') as HTMLElement | null;
            const forgotButton = document.querySelector('[data-testid="auth-login-forgot-button"]') as HTMLElement | null;
            const submitButton = document.querySelector('[data-testid="auth-submit-button"]') as HTMLElement | null;
            if (!modal || !bookStage || !forgotButton || !submitButton) return null;
            const modalRect = modal.getBoundingClientRect();
            const bookRect = bookStage.getBoundingClientRect();
            const forgotRect = forgotButton.getBoundingClientRect();
            const submitRect = submitButton.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            return {
                modalWidthRatio: modalRect.width / window.innerWidth,
                modalHeightRatio: modalRect.height / window.innerHeight,
                modalCenterXRatio: (modalRect.left + modalRect.width / 2) / window.innerWidth,
                forgotToSubmitGapRatio: (submitRect.top - forgotRect.bottom) / modalRect.height,
                submitTopRatio: (submitRect.top - modalRect.top) / modalRect.height,
                modalBookCenterDelta: Math.abs(
                    (modalRect.left + modalRect.width / 2)
                    - (bookRect.left + bookRect.width / 2),
                ),
                bookStageVisibleWidth: bookRect.width,
                bookStageVisibleHeight: bookRect.height,
                viewportWidth,
                viewportHeight,
            };
        });
        if (!authModalMetrics) {
            throw new Error('登录弹窗或书本大厅节点缺失，无法验证 modal 覆盖结构');
        }
        console.log(
            `[home-v2-auth-modal] widthRatio=${authModalMetrics.modalWidthRatio.toFixed(3)}, heightRatio=${authModalMetrics.modalHeightRatio.toFixed(3)}, centerXRatio=${authModalMetrics.modalCenterXRatio.toFixed(3)}, forgotToSubmitGapRatio=${authModalMetrics.forgotToSubmitGapRatio.toFixed(3)}, submitTopRatio=${authModalMetrics.submitTopRatio.toFixed(3)}, modalBookCenterDelta=${authModalMetrics.modalBookCenterDelta.toFixed(2)}, bookStage=${authModalMetrics.bookStageVisibleWidth.toFixed(2)}x${authModalMetrics.bookStageVisibleHeight.toFixed(2)}`,
        );
        expect(authModalMetrics.modalWidthRatio).toBeGreaterThan(0.26);
        expect(authModalMetrics.modalWidthRatio).toBeLessThan(0.30);
        expect(authModalMetrics.modalHeightRatio).toBeGreaterThan(0.58);
        expect(authModalMetrics.modalHeightRatio).toBeLessThan(0.68);
        expect(authModalMetrics.modalCenterXRatio).toBeGreaterThan(0.42);
        expect(authModalMetrics.modalCenterXRatio).toBeLessThan(0.62);
        expect(authModalMetrics.forgotToSubmitGapRatio).toBeGreaterThan(0.02);
        expect(authModalMetrics.forgotToSubmitGapRatio).toBeLessThan(0.10);
        expect(authModalMetrics.submitTopRatio).toBeGreaterThan(0.60);
        expect(authModalMetrics.submitTopRatio).toBeLessThan(0.74);
        expect(authModalMetrics.bookStageVisibleWidth / authModalMetrics.viewportWidth).toBeGreaterThan(0.97);
        expect(authModalMetrics.bookStageVisibleHeight / authModalMetrics.viewportHeight).toBeGreaterThan(0.94);
        const authModalScreenshotPath = getEvidenceScreenshotPath(testInfo, 'auth-modal-overlay');
        await page.screenshot({ path: authModalScreenshotPath, fullPage: true });

        const authModalStableBefore = await authModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
                height: rect.height,
            };
        });
        await authModal.getByTestId('auth-login-account-input').click();
        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 320,
            keyboardInsetHeight: 260,
        });
        await page.waitForTimeout(150);
        const authModalStableAfter = await authModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
                height: rect.height,
            };
        });
        const authModalKeyboardTopDelta = Math.abs(authModalStableAfter.top - authModalStableBefore.top);
        const authModalKeyboardCenterDelta = Math.abs(authModalStableAfter.centerY - authModalStableBefore.centerY);
        console.log(
            `[home-v2-auth-modal-stable] topDelta=${authModalKeyboardTopDelta.toFixed(2)}, centerYDelta=${authModalKeyboardCenterDelta.toFixed(2)}, beforeHeight=${authModalStableBefore.height.toFixed(2)}, afterHeight=${authModalStableAfter.height.toFixed(2)}`,
        );
        expect(authModalKeyboardTopDelta).toBeLessThan(4);
        expect(authModalKeyboardCenterDelta).toBeLessThan(4);
        const authModalStableScreenshotPath = getEvidenceScreenshotPath(testInfo, 'auth-modal-keyboard-stable-20260516');
        await page.screenshot({ path: authModalStableScreenshotPath, fullPage: true });
        await page.evaluate(() => {
            const root = document.documentElement;
            root.style.removeProperty('--runtime-viewport-height');
            root.style.removeProperty('--keyboard-inset-height');
            delete root.dataset.keyboardVisible;
        });

        await authModal.getByTestId('auth-switch-register').click();
        await page.waitForTimeout(250);
        await authModal.evaluate((modal) => {
            modal.querySelectorAll('*').forEach((node) => {
                if (node instanceof HTMLElement) node.scrollTop = 0;
            });
        });
        const authRegisterTopScreenshotPath = getEvidenceScreenshotPath(testInfo, 'auth-modal-register-top-overlay-20260516');
        await page.screenshot({ path: authRegisterTopScreenshotPath, fullPage: true });
        await expect(authModal.getByTestId('auth-register-email-input')).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-register-send-code')).toBeVisible();
        await expect(authModal.getByTestId('auth-register-code-input')).toBeVisible();
        await expect(authModal.getByTestId('auth-register-username-input')).toBeVisible();
        await expect(authModal.getByTestId('auth-register-password-input')).toBeVisible();
        await expect(authModal.getByTestId('auth-register-confirm-password-input')).toBeVisible();
        await authModal.evaluate((modal) => {
            modal.querySelectorAll('*').forEach((node) => {
                if (node instanceof HTMLElement) node.scrollTop = node.scrollHeight;
            });
        });
        const authRegisterBottomScreenshotPath = getEvidenceScreenshotPath(testInfo, 'auth-modal-register-bottom-overlay-20260516');
        await page.screenshot({ path: authRegisterBottomScreenshotPath, fullPage: true });

        await authModal.getByTestId('auth-switch-login').click();
        await authModal.getByTestId('auth-login-forgot-button').click();
        await page.waitForTimeout(250);
        await authModal.evaluate((modal) => {
            modal.querySelectorAll('*').forEach((node) => {
                if (node instanceof HTMLElement) node.scrollTop = 0;
            });
        });
        const authResetTopScreenshotPath = getEvidenceScreenshotPath(testInfo, 'auth-modal-reset-top-overlay-20260516');
        await page.screenshot({ path: authResetTopScreenshotPath, fullPage: true });
        await expect(authModal.getByTestId('auth-reset-email-input')).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-reset-send-code')).toBeVisible();
        await expect(authModal.getByTestId('auth-reset-code-input')).toBeVisible();
        await expect(authModal.getByTestId('auth-reset-new-password-input')).toBeVisible();
        await expect(authModal.getByTestId('auth-reset-confirm-password-input')).toBeVisible();
        await authModal.evaluate((modal) => {
            modal.querySelectorAll('*').forEach((node) => {
                if (node instanceof HTMLElement) node.scrollTop = node.scrollHeight;
            });
        });
        const authResetBottomScreenshotPath = getEvidenceScreenshotPath(testInfo, 'auth-modal-reset-bottom-overlay-20260516');
        await page.screenshot({ path: authResetBottomScreenshotPath, fullPage: true });

        await page.mouse.click(12, 12);
        await expect(page.getByTestId('auth-modal')).toHaveCount(0);
        for (const { suffix, progress } of HOME_V2_FLIP_CAPTURE_POINTS) {
            const diceThroneCard = page.locator('[data-testid="home-v2-root"] [data-game-id="dicethrone"]').first();
            await expect(diceThroneCard).toBeVisible({ timeout: 20000 });
            await diceThroneCard.click();
            await captureHomeV2FlipFrameAtProgress(page, testInfo, `page-flip-to-detail-${suffix}`, progress);
            await waitForHomeV2FlipMode(page, 'detail');

            const backButton = page.getByRole('button', { name: /返回目录/ });
            await expect(backButton).toBeVisible({ timeout: 10000 });
            await expect(
                page.locator('[data-scene-node="home-v2-tab-lobby"], [data-scene-node="home-v2-tab-rooms"], [data-scene-node="tab_button_lobby"], [data-scene-node="tab_button_rooms"]'),
            ).toHaveCount(0);
            await expect(
                page.locator('article').filter({ hasText: injectedRoom.roomName }).first(),
            ).toBeVisible({ timeout: 10000 });

            if (suffix === '50') {
                const detailLayoutMetrics = await page.evaluate(() => {
                    const leftPage = document.querySelector('[data-testid="home-v2-detail-left-page"]') as HTMLElement | null;
                    const rightPage = document.querySelector('[data-testid="home-v2-detail-right-page"]') as HTMLElement | null;
                    const bookStage = document.querySelector('[data-testid="home-v2-book-stage"]') as HTMLElement | null;
                    const backButton = document.querySelector('[data-testid="home-v2-detail-back-button"]') as HTMLElement | null;
                    const createRoomButton = document.querySelector('[data-testid="home-v2-create-room-button"]') as HTMLElement | null;
                    const leftHero = document.querySelector('[data-testid="home-v2-detail-left-hero"]') as HTMLElement | null;
                    const detailThumbnail = document.querySelector('[data-testid="home-v2-detail-thumbnail"]') as HTMLElement | null;
                    const description = document.querySelector('[data-testid="home-v2-detail-description"]') as HTMLElement | null;
                    const recommendedBand = document.querySelector('[data-testid="home-v2-recommended-player-band"]') as HTMLElement | null;
                    const playerCountBoxes = Array.from(document.querySelectorAll('[data-testid="home-v2-player-count-box"]')) as HTMLElement[];
                    const tutorialButton = document.querySelector('[data-testid="home-v2-tutorial-button"]') as HTMLElement | null;
                    const roomSearchField = document.querySelector('[data-testid="home-v2-room-search-field"]') as HTMLElement | null;
                    const roomSearchIcon = document.querySelector('[data-testid="home-v2-room-search-icon"]') as HTMLElement | null;
                    const tabItems = Array.from(document.querySelectorAll('[data-testid="home-v2-detail-tab"]')) as HTMLElement[];
                    const ledger = document.querySelector('[data-testid="home-v2-room-ledger"]') as HTMLElement | null;
                    const ledgerHeader = document.querySelector('[data-testid="home-v2-room-ledger-header"]') as HTMLElement | null;
                    const roomRows = Array.from(document.querySelectorAll('[data-testid="home-v2-room-ledger-row"]')) as HTMLElement[];
                    const firstRoomRow = roomRows[0] ?? null;
                    const firstRoomThumbnail = document.querySelector('[data-testid="home-v2-room-thumbnail"]') as HTMLElement | null;
                    const firstRoomAction = document.querySelector('[data-testid="home-v2-room-action-tag"]') as HTMLElement | null;
                    const isCompactLayout = window.innerWidth > window.innerHeight
                        && window.innerHeight <= 520
                        && (
                            window.matchMedia('(pointer: coarse)').matches
                            || window.matchMedia('(hover: none)').matches
                            || (navigator.maxTouchPoints ?? 0) > 0
                        );
                    if (!leftPage || !rightPage || !bookStage || !backButton || !createRoomButton || !leftHero || !tutorialButton || !roomSearchField || !roomSearchIcon || tabItems.length < 4 || !ledger || !ledgerHeader) {
                        return null;
                    }

                    const bookRect = bookStage.getBoundingClientRect();
                    const backButtonRect = backButton.getBoundingClientRect();
                    const createRoomButtonRect = createRoomButton.getBoundingClientRect();
                    const leftRect = leftPage.getBoundingClientRect();
                    const rightRect = rightPage.getBoundingClientRect();
                    const heroRect = leftHero.getBoundingClientRect();
                    const detailThumbnailRect = detailThumbnail?.getBoundingClientRect();
                    const tutorialRect = tutorialButton.getBoundingClientRect();
                    const ledgerRect = ledger.getBoundingClientRect();
                    const ledgerHeaderRect = ledgerHeader.getBoundingClientRect();
                    const firstRoomRowRect = firstRoomRow?.getBoundingClientRect();
                    const firstRoomThumbnailRect = firstRoomThumbnail?.getBoundingClientRect();
                    const firstRoomActionRect = firstRoomAction?.getBoundingClientRect();
                    const firstPlayerCountBoxRect = playerCountBoxes[0]?.getBoundingClientRect();
                    const roomSearchFieldRect = roomSearchField.getBoundingClientRect();
                    const roomSearchIconRect = roomSearchIcon.getBoundingClientRect();
                    const backButtonStyle = window.getComputedStyle(backButton);
                    const createRoomButtonStyle = window.getComputedStyle(createRoomButton);
                    const roomSearchFieldStyle = window.getComputedStyle(roomSearchField);
                    const backButtonFontSize = Number.parseFloat(backButtonStyle.fontSize);
                    const backButtonBorderWidth = Number.parseFloat(backButtonStyle.borderTopWidth);
                    const backButtonBackgroundAlpha = backButtonStyle.backgroundColor.includes('rgba')
                        ? Number.parseFloat(backButtonStyle.backgroundColor.split(',').at(-1)?.replace(')', '').trim() ?? '1')
                        : backButtonStyle.backgroundColor === 'transparent'
                            ? 0
                            : 1;
                    const tabRects = tabItems.map((tab) => tab.getBoundingClientRect());
                    const tabFontSizes = tabItems.map((tab) => Number.parseFloat(window.getComputedStyle(tab).fontSize));
                    const filterButtonCount = Array.from(rightPage.querySelectorAll('button')).filter((button) => {
                        const label = button.textContent?.replace(/\s+/g, '') ?? '';
                        return ['全部', '可加入', '加密', '满员'].includes(label);
                    }).length;
                    const headerDividerCount = Array.from(ledgerHeader.children).filter((child) => {
                        const style = window.getComputedStyle(child as Element);
                        return Number.parseFloat(style.borderLeftWidth) > 0;
                    }).length;
                    const firstRowDividerCount = firstRoomRow
                        ? Array.from(firstRoomRow.querySelector('button')?.children ?? []).filter((child) => {
                            const style = window.getComputedStyle(child as Element);
                            return Number.parseFloat(style.borderLeftWidth) > 0;
                        }).length
                        : 0;
                    const visibleRoomRowCount = roomRows.filter((row) => {
                        const rowRect = row.getBoundingClientRect();
                        return rowRect.top < ledgerRect.bottom && rowRect.bottom > ledgerHeaderRect.bottom;
                    }).length;

                    return {
                        stageWidthRatio: bookRect.width / window.innerWidth,
                        stageAspectRatio: bookRect.width / bookRect.height,
                        backButtonTopRatio: (backButtonRect.top - leftRect.top) / leftRect.height,
                        backButtonBackgroundAlpha,
                        backButtonBorderWidth,
                        backButtonBackgroundImage: backButtonStyle.backgroundImage,
                        backButtonHeight: backButtonRect.height,
                        backButtonWidthRatio: backButtonRect.width / leftRect.width,
                        backButtonFontSize,
                        createRoomButtonHeight: createRoomButtonRect.height,
                        createRoomButtonWidthRatio: createRoomButtonRect.width / rightRect.width,
                        createRoomButtonFontSize: Number.parseFloat(createRoomButtonStyle.fontSize),
                        leftHeroWidthRatio: heroRect.width / leftRect.width,
                        leftHeroTopRatio: (heroRect.top - leftRect.top) / leftRect.height,
                        detailThumbnailHeight: detailThumbnailRect?.height ?? 0,
                        detailThumbnailWidthRatio: detailThumbnailRect ? detailThumbnailRect.width / leftRect.width : 0,
                        descriptionVisible: Boolean(description && description.offsetParent),
                        descriptionWidthRatio: description ? description.getBoundingClientRect().width / leftRect.width : 0,
                        descriptionTopRatio: description ? (description.getBoundingClientRect().top - leftRect.top) / leftRect.height : 0,
                        recommendedVisible: Boolean(recommendedBand && recommendedBand.offsetParent),
                        recommendedTopRatio: recommendedBand ? (recommendedBand.getBoundingClientRect().top - leftRect.top) / leftRect.height : 0,
                        recommendedWidthRatio: recommendedBand ? recommendedBand.getBoundingClientRect().width / leftRect.width : 0,
                        playerCountBoxCount: playerCountBoxes.length,
                        firstPlayerCountBoxAspectRatio: firstPlayerCountBoxRect ? firstPlayerCountBoxRect.width / firstPlayerCountBoxRect.height : 0,
                        tutorialTopRatio: (tutorialRect.top - leftRect.top) / leftRect.height,
                        tutorialBottomRatio: (tutorialRect.bottom - leftRect.top) / leftRect.height,
                        tutorialWidthRatio: tutorialRect.width / leftRect.width,
                        roomSearchFieldHeight: roomSearchFieldRect.height,
                        roomSearchFieldWidthRatio: roomSearchFieldRect.width / rightRect.width,
                        roomSearchFieldBorderBottomWidth: Number.parseFloat(roomSearchFieldStyle.borderBottomWidth),
                        roomSearchIconCenterYDelta: Math.abs(
                            (roomSearchIconRect.top + roomSearchIconRect.height / 2)
                            - (roomSearchFieldRect.top + roomSearchFieldRect.height / 2),
                        ),
                        rightLedgerTopRatio: (ledgerRect.top - rightRect.top) / rightRect.height,
                        ledgerHeaderHeight: ledgerHeaderRect.height,
                        tabFontDelta: Math.max(...tabFontSizes) - Math.min(...tabFontSizes),
                        tabTopDelta: Math.max(...tabRects.map((rect) => rect.top)) - Math.min(...tabRects.map((rect) => rect.top)),
                        tabHeightDelta: Math.max(...tabRects.map((rect) => rect.height)) - Math.min(...tabRects.map((rect) => rect.height)),
                        firstRoomRowHeight: firstRoomRowRect?.height ?? 0,
                        firstRoomThumbnailHeight: firstRoomThumbnailRect?.height ?? 0,
                        firstRoomActionHeight: firstRoomActionRect?.height ?? 0,
                        visibleRoomRowCount,
                        headerDividerCount,
                        firstRowDividerCount,
                        filterButtonCount,
                        isCompactLayout,
                    };
                });
                if (!detailLayoutMetrics) {
                    throw new Error('详情页布局节点缺失，无法验证书本双页网格');
                }
                console.log(
                    `[home-v2-detail-layout] stageWidthRatio=${detailLayoutMetrics.stageWidthRatio.toFixed(2)}, stageAspectRatio=${detailLayoutMetrics.stageAspectRatio.toFixed(2)}, backButtonTopRatio=${detailLayoutMetrics.backButtonTopRatio.toFixed(2)}, backButtonBackgroundAlpha=${detailLayoutMetrics.backButtonBackgroundAlpha.toFixed(2)}, backButtonBorderWidth=${detailLayoutMetrics.backButtonBorderWidth.toFixed(2)}, backButtonBackgroundImage=${detailLayoutMetrics.backButtonBackgroundImage}, backButtonHeight=${detailLayoutMetrics.backButtonHeight.toFixed(2)}, backButtonWidthRatio=${detailLayoutMetrics.backButtonWidthRatio.toFixed(2)}, backButtonFontSize=${detailLayoutMetrics.backButtonFontSize.toFixed(2)}, createRoomButtonHeight=${detailLayoutMetrics.createRoomButtonHeight.toFixed(2)}, createRoomButtonWidthRatio=${detailLayoutMetrics.createRoomButtonWidthRatio.toFixed(2)}, createRoomButtonFontSize=${detailLayoutMetrics.createRoomButtonFontSize.toFixed(2)}, leftHeroWidthRatio=${detailLayoutMetrics.leftHeroWidthRatio.toFixed(2)}, leftHeroTopRatio=${detailLayoutMetrics.leftHeroTopRatio.toFixed(2)}, detailThumbnailHeight=${detailLayoutMetrics.detailThumbnailHeight.toFixed(2)}, detailThumbnailWidthRatio=${detailLayoutMetrics.detailThumbnailWidthRatio.toFixed(2)}, descriptionWidthRatio=${detailLayoutMetrics.descriptionWidthRatio.toFixed(2)}, descriptionTopRatio=${detailLayoutMetrics.descriptionTopRatio.toFixed(2)}, recommendedTopRatio=${detailLayoutMetrics.recommendedTopRatio.toFixed(2)}, recommendedWidthRatio=${detailLayoutMetrics.recommendedWidthRatio.toFixed(2)}, playerCountBoxCount=${detailLayoutMetrics.playerCountBoxCount}, firstPlayerCountBoxAspectRatio=${detailLayoutMetrics.firstPlayerCountBoxAspectRatio.toFixed(2)}, tutorialTopRatio=${detailLayoutMetrics.tutorialTopRatio.toFixed(2)}, tutorialBottomRatio=${detailLayoutMetrics.tutorialBottomRatio.toFixed(2)}, tutorialWidthRatio=${detailLayoutMetrics.tutorialWidthRatio.toFixed(2)}, roomSearchFieldHeight=${detailLayoutMetrics.roomSearchFieldHeight.toFixed(2)}, roomSearchFieldWidthRatio=${detailLayoutMetrics.roomSearchFieldWidthRatio.toFixed(2)}, roomSearchFieldBorderBottomWidth=${detailLayoutMetrics.roomSearchFieldBorderBottomWidth.toFixed(2)}, roomSearchIconCenterYDelta=${detailLayoutMetrics.roomSearchIconCenterYDelta.toFixed(2)}, rightLedgerTopRatio=${detailLayoutMetrics.rightLedgerTopRatio.toFixed(2)}, ledgerHeaderHeight=${detailLayoutMetrics.ledgerHeaderHeight.toFixed(2)}, tabFontDelta=${detailLayoutMetrics.tabFontDelta.toFixed(2)}, tabTopDelta=${detailLayoutMetrics.tabTopDelta.toFixed(2)}, tabHeightDelta=${detailLayoutMetrics.tabHeightDelta.toFixed(2)}, firstRoomRowHeight=${detailLayoutMetrics.firstRoomRowHeight.toFixed(2)}, firstRoomThumbnailHeight=${detailLayoutMetrics.firstRoomThumbnailHeight.toFixed(2)}, firstRoomActionHeight=${detailLayoutMetrics.firstRoomActionHeight.toFixed(2)}, visibleRoomRowCount=${detailLayoutMetrics.visibleRoomRowCount}, headerDividerCount=${detailLayoutMetrics.headerDividerCount}, firstRowDividerCount=${detailLayoutMetrics.firstRowDividerCount}, filterButtonCount=${detailLayoutMetrics.filterButtonCount}`,
                );
                expect(detailLayoutMetrics.stageWidthRatio).toBeGreaterThan(0.96);
                expect(detailLayoutMetrics.stageAspectRatio).toBeGreaterThan(2.08);
                expect(detailLayoutMetrics.stageAspectRatio).toBeLessThan(2.28);
                expect(detailLayoutMetrics.backButtonTopRatio).toBeLessThan(0.08);
                expect(detailLayoutMetrics.backButtonBackgroundAlpha).toBeLessThan(0.05);
                expect(detailLayoutMetrics.backButtonBorderWidth).toBeLessThan(1);
                expect(detailLayoutMetrics.backButtonBackgroundImage).toBe('none');
                expect(detailLayoutMetrics.isCompactLayout).toBe(true);
                expect(detailLayoutMetrics.backButtonHeight).toBeGreaterThan(24);
                expect(detailLayoutMetrics.backButtonWidthRatio).toBeGreaterThan(0.20);
                expect(detailLayoutMetrics.backButtonWidthRatio).toBeLessThan(0.34);
                expect(detailLayoutMetrics.backButtonFontSize).toBeGreaterThan(9);
                expect(detailLayoutMetrics.createRoomButtonHeight).toBeGreaterThan(30);
                expect(detailLayoutMetrics.createRoomButtonWidthRatio).toBeGreaterThan(0.26);
                expect(detailLayoutMetrics.createRoomButtonWidthRatio).toBeLessThan(0.36);
                expect(detailLayoutMetrics.createRoomButtonFontSize).toBeGreaterThanOrEqual(10);
                expect(detailLayoutMetrics.leftHeroWidthRatio).toBeGreaterThan(0.82);
                expect(detailLayoutMetrics.leftHeroTopRatio).toBeLessThan(0.18);
                expect(detailLayoutMetrics.detailThumbnailHeight).toBeGreaterThan(70);
                expect(detailLayoutMetrics.detailThumbnailHeight).toBeLessThan(86);
                expect(detailLayoutMetrics.detailThumbnailWidthRatio).toBeLessThan(0.25);
                expect(detailLayoutMetrics.descriptionVisible).toBe(true);
                expect(detailLayoutMetrics.descriptionWidthRatio).toBeGreaterThan(0.52);
                expect(detailLayoutMetrics.recommendedVisible).toBe(true);
                expect(detailLayoutMetrics.recommendedTopRatio).toBeGreaterThan(0.60);
                expect(detailLayoutMetrics.recommendedTopRatio).toBeLessThan(0.92);
                expect(detailLayoutMetrics.recommendedWidthRatio).toBeGreaterThan(0.42);
                expect(detailLayoutMetrics.recommendedWidthRatio).toBeLessThan(0.82);
                expect(detailLayoutMetrics.playerCountBoxCount).toBeGreaterThanOrEqual(1);
                expect(detailLayoutMetrics.firstPlayerCountBoxAspectRatio).toBeGreaterThan(0.88);
                expect(detailLayoutMetrics.firstPlayerCountBoxAspectRatio).toBeLessThan(1.12);
                expect(detailLayoutMetrics.tutorialTopRatio).toBeGreaterThan(0.70);
                expect(detailLayoutMetrics.tutorialBottomRatio).toBeGreaterThan(0.92);
                expect(detailLayoutMetrics.tutorialBottomRatio).toBeLessThan(1.02);
                expect(detailLayoutMetrics.tutorialWidthRatio).toBeGreaterThan(0.28);
                expect(detailLayoutMetrics.tutorialWidthRatio).toBeLessThan(0.48);
                expect(detailLayoutMetrics.roomSearchFieldHeight).toBeGreaterThan(24);
                expect(detailLayoutMetrics.roomSearchFieldHeight).toBeLessThan(32);
                expect(detailLayoutMetrics.roomSearchFieldWidthRatio).toBeGreaterThan(0.40);
                expect(detailLayoutMetrics.roomSearchFieldWidthRatio).toBeLessThan(0.58);
                expect(detailLayoutMetrics.roomSearchFieldBorderBottomWidth).toBeGreaterThan(0);
                expect(detailLayoutMetrics.roomSearchIconCenterYDelta).toBeLessThan(1.2);
                expect(detailLayoutMetrics.rightLedgerTopRatio).toBeLessThan(0.34);
                expect(detailLayoutMetrics.ledgerHeaderHeight).toBeGreaterThan(16);
                expect(detailLayoutMetrics.ledgerHeaderHeight).toBeLessThan(28);
                expect(detailLayoutMetrics.tabFontDelta).toBeLessThan(2);
                expect(detailLayoutMetrics.tabTopDelta).toBeLessThan(3);
                expect(detailLayoutMetrics.tabHeightDelta).toBeLessThan(4);
                expect(detailLayoutMetrics.firstRoomRowHeight).toBeGreaterThan(34);
                expect(detailLayoutMetrics.firstRoomRowHeight).toBeLessThan(44);
                expect(detailLayoutMetrics.firstRoomThumbnailHeight).toBe(0);
                expect(detailLayoutMetrics.firstRoomActionHeight).toBeGreaterThan(18);
                expect(detailLayoutMetrics.firstRoomActionHeight).toBeLessThan(28);
                expect(detailLayoutMetrics.visibleRoomRowCount).toBeGreaterThanOrEqual(5);
                expect(detailLayoutMetrics.headerDividerCount).toBeGreaterThanOrEqual(3);
                expect(detailLayoutMetrics.firstRowDividerCount).toBeGreaterThanOrEqual(3);
                expect(detailLayoutMetrics.filterButtonCount).toBe(0);
                const detailScreenshotPath = getEvidenceScreenshotPath(testInfo, 'detail-entry-20260516-action-buttons');
                await page.screenshot({ path: detailScreenshotPath, fullPage: true });

                await page.getByTestId('home-v2-create-room-button').click();
                const createRoomModal = page.getByTestId('create-room-modal').last();
                await expect(createRoomModal).toBeVisible({ timeout: 10000 });
                const createRoomModalMetrics = await createRoomModal.evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        widthRatio: rect.width / window.innerWidth,
                        heightRatio: rect.height / window.innerHeight,
                        centerXRatio: (rect.left + rect.width / 2) / window.innerWidth,
                        centerYRatio: (rect.top + rect.height / 2) / window.innerHeight,
                    };
                });
                console.log(
                    `[home-v2-create-room-modal] widthRatio=${createRoomModalMetrics.widthRatio.toFixed(3)}, heightRatio=${createRoomModalMetrics.heightRatio.toFixed(3)}, centerXRatio=${createRoomModalMetrics.centerXRatio.toFixed(3)}, centerYRatio=${createRoomModalMetrics.centerYRatio.toFixed(3)}`,
                );
                expect(createRoomModalMetrics.widthRatio).toBeGreaterThan(0.24);
                expect(createRoomModalMetrics.widthRatio).toBeLessThan(0.34);
                expect(createRoomModalMetrics.heightRatio).toBeGreaterThan(0.42);
                expect(createRoomModalMetrics.centerXRatio).toBeGreaterThan(0.42);
                expect(createRoomModalMetrics.centerXRatio).toBeLessThan(0.58);
                const createRoomModalStableBefore = await createRoomModal.evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        top: rect.top,
                        centerY: rect.top + rect.height / 2,
                    };
                });
                await page.getByTestId('create-room-name-input').click();
                await applyKeyboardViewportSimulation(page, {
                    runtimeViewportHeight: 320,
                    keyboardInsetHeight: 260,
                });
                await page.waitForTimeout(150);
                const createRoomModalStableAfter = await createRoomModal.evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        top: rect.top,
                        centerY: rect.top + rect.height / 2,
                    };
                });
                const createRoomModalTopDelta = Math.abs(createRoomModalStableAfter.top - createRoomModalStableBefore.top);
                const createRoomModalCenterDelta = Math.abs(createRoomModalStableAfter.centerY - createRoomModalStableBefore.centerY);
                console.log(
                    `[home-v2-create-room-modal-stable] topDelta=${createRoomModalTopDelta.toFixed(2)}, centerYDelta=${createRoomModalCenterDelta.toFixed(2)}`,
                );
                expect(createRoomModalTopDelta).toBeLessThan(4);
                expect(createRoomModalCenterDelta).toBeLessThan(4);
                const createRoomModalScreenshotPath = getEvidenceScreenshotPath(testInfo, 'detail-create-room-modal-20260516');
                await page.screenshot({ path: createRoomModalScreenshotPath, fullPage: true });
                await page.evaluate(() => {
                    const root = document.documentElement;
                    root.style.removeProperty('--runtime-viewport-height');
                    root.style.removeProperty('--keyboard-inset-height');
                    delete root.dataset.keyboardVisible;
                });
                await page.getByTestId('create-room-cancel-button').click();
                await expect(createRoomModal).toBeHidden({ timeout: 10000 });

                for (const tabId of ['changelog', 'reviews', 'leaderboard'] as const) {
                    await page.locator(`[data-testid="home-v2-detail-tab"][data-tab-id="${tabId}"]`).click();
                    await expect(page.getByTestId(`home-v2-detail-panel-${tabId}`)).toBeVisible({ timeout: 10000 });
                    await expect(page.getByTestId('home-v2-fold-line-flip')).toHaveAttribute('data-flip-mode', 'detail');
                    await expect(page.getByTestId('home-v2-fold-line-flip')).toHaveAttribute('data-turn-animating', 'false');
                    await page.waitForTimeout(300);
                    const tabScreenshotPath = getEvidenceScreenshotPath(testInfo, `detail-tab-${tabId}-20260516`);
                    await page.screenshot({ path: tabScreenshotPath, fullPage: true });
                }

                await page.locator('[data-testid="home-v2-detail-tab"][data-tab-id="lobby"]').click();
                await expect(page.getByTestId('home-v2-room-ledger')).toBeVisible({ timeout: 10000 });
            }

            await backButton.click();
            await captureHomeV2FlipFrameAtProgress(page, testInfo, `page-flip-back-to-catalog-${suffix}`, progress);
            await waitForHomeV2FlipMode(page, 'overview');
            await expect(page.locator('[data-scene-slot="overview_spread_body"]').first()).toBeVisible({ timeout: 10000 });
        }

        const returnCatalogScreenshotPath = getEvidenceScreenshotPath(testInfo, 'catalog-return-after-flip');
        await page.screenshot({ path: returnCatalogScreenshotPath, fullPage: true });

        await expect(page.getByTestId('home-v2-continue-entry')).toContainText('井字棋');
        await page.getByTestId('home-v2-continue-entry').click();
        await expect(page).toHaveURL(new RegExp(`/play/tictactoe/match/${continueMatchId}\\?playerID=0`), { timeout: 15000 });
        await waitForMatchBoardOrLoading(page);
            const continueMatchScreenshotPath = getEvidenceScreenshotPath(testInfo, 'continue-match-entry-20260516');
            await page.screenshot({ path: continueMatchScreenshotPath, fullPage: true });
        } finally {
            await context.close();
        }
    });

    test(HOME_V2_MODAL_UNIFIED_TEST_NAME, async ({ browser, workerPorts }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const context = await createHomeV2MobileLandscapeContext(browser, workerPorts);
        const page = await context.newPage();
        try {
            await useHomeV2MobileLandscapeViewport(page);

            await page.goto('/?homeV2Draft=1', { waitUntil: 'domcontentloaded' });
            await expect(page.getByTestId('home-v2-root')).toBeVisible({ timeout: 15000 });
            await ensureHomeV2BookMaterialsReady(page, { requireLegacyTabs: false });

        await page.getByTestId('home-v2-account-entry').click();
        const authModal = page.getByTestId('auth-modal').first();
        await expect(authModal).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-login-account-input')).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-login-password-input')).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-login-forgot-button')).toBeVisible({ timeout: 10000 });
        await expect(authModal.getByTestId('auth-submit-button')).toContainText('登 录');
        await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? ''))
            .not.toBe('auth-login-account-input');

        const authModalMetrics = await authModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                widthRatio: rect.width / window.innerWidth,
                heightRatio: rect.height / window.innerHeight,
                centerXRatio: (rect.left + rect.width / 2) / window.innerWidth,
                centerYRatio: (rect.top + rect.height / 2) / window.innerHeight,
            };
        });
        console.log(
            `[home-v2-modal-audit-auth] widthRatio=${authModalMetrics.widthRatio.toFixed(3)}, heightRatio=${authModalMetrics.heightRatio.toFixed(3)}, centerXRatio=${authModalMetrics.centerXRatio.toFixed(3)}, centerYRatio=${authModalMetrics.centerYRatio.toFixed(3)}`,
        );
        expect(authModalMetrics.widthRatio).toBeGreaterThan(0.22);
        expect(authModalMetrics.widthRatio).toBeLessThan(0.34);
        expect(authModalMetrics.heightRatio).toBeGreaterThan(0.40);
        expect(authModalMetrics.heightRatio).toBeLessThan(0.76);
        expect(authModalMetrics.centerXRatio).toBeGreaterThan(0.42);
        expect(authModalMetrics.centerXRatio).toBeLessThan(0.58);

        const authModalInnerMetrics = await page.evaluate(() => {
            const passwordInput = document.querySelector('[data-testid="auth-login-password-input"]') as HTMLElement | null;
            const forgotButton = document.querySelector('[data-testid="auth-login-forgot-button"]') as HTMLElement | null;
            const submitButton = document.querySelector('[data-testid="auth-submit-button"]') as HTMLElement | null;
            if (!passwordInput || !forgotButton || !submitButton) return null;
            const passwordRect = passwordInput.getBoundingClientRect();
            const forgotRect = forgotButton.getBoundingClientRect();
            const submitRect = submitButton.getBoundingClientRect();
            return {
                passwordInputHeight: passwordRect.height,
                passwordToForgotGap: forgotRect.top - passwordRect.bottom,
                forgotToSubmitGap: submitRect.top - forgotRect.bottom,
            };
        });
        if (!authModalInnerMetrics) {
            throw new Error('Home V2 登录弹窗内部字段量测节点缺失');
        }
        console.log(
            `[home-v2-modal-audit-auth-inner] passwordInputHeight=${authModalInnerMetrics.passwordInputHeight.toFixed(2)}, passwordToForgotGap=${authModalInnerMetrics.passwordToForgotGap.toFixed(2)}, forgotToSubmitGap=${authModalInnerMetrics.forgotToSubmitGap.toFixed(2)}`,
        );
        expect(authModalInnerMetrics.passwordInputHeight).toBeGreaterThan(17);
        expect(authModalInnerMetrics.passwordInputHeight).toBeLessThan(25);
        expect(authModalInnerMetrics.passwordToForgotGap).toBeGreaterThan(4);
        expect(authModalInnerMetrics.forgotToSubmitGap).toBeGreaterThan(4);

        const authModalStableBefore = await authModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });
        await authModal.getByTestId('auth-login-account-input').click();
        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 320,
            keyboardInsetHeight: 260,
        });
        await page.waitForTimeout(150);
        const authModalStableAfter = await authModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });
        const authModalTopDelta = Math.abs(authModalStableAfter.top - authModalStableBefore.top);
        const authModalCenterYDelta = Math.abs(authModalStableAfter.centerY - authModalStableBefore.centerY);
        console.log(
            `[home-v2-modal-audit-auth-stable] topDelta=${authModalTopDelta.toFixed(2)}, centerYDelta=${authModalCenterYDelta.toFixed(2)}`,
        );
        expect(authModalTopDelta).toBeLessThan(4);
        expect(authModalCenterYDelta).toBeLessThan(4);
        const authModalScreenshotPath = getEvidenceScreenshotPath(testInfo, 'auth-modal-unified-20260516');
        await page.screenshot({ path: authModalScreenshotPath, fullPage: true });
        await page.evaluate(() => {
            const root = document.documentElement;
            root.style.removeProperty('--runtime-viewport-height');
            root.style.removeProperty('--keyboard-inset-height');
            delete root.dataset.keyboardVisible;
        });

        await page.mouse.click(12, 12);
        await expect(authModal).toHaveCount(0);

        const tictactoeCard = page.locator('[data-testid="home-v2-root"] [data-game-id="tictactoe"]').first();
        await expect(tictactoeCard).toBeVisible({ timeout: 10000 });
        await tictactoeCard.click();
        await waitForHomeV2FlipMode(page, 'detail');

        await page.getByTestId('home-v2-create-room-button').click();
        const createRoomModal = page.getByTestId('create-room-modal').last();
        await expect(createRoomModal).toBeVisible({ timeout: 10000 });
        await expect(createRoomModal.getByTestId('create-room-name-input')).toBeVisible();
        await expect(createRoomModal.getByTestId('create-room-confirm-button')).toContainText('创建');

        const createRoomMetrics = await createRoomModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                widthRatio: rect.width / window.innerWidth,
                heightRatio: rect.height / window.innerHeight,
                centerXRatio: (rect.left + rect.width / 2) / window.innerWidth,
                centerYRatio: (rect.top + rect.height / 2) / window.innerHeight,
            };
        });
        console.log(
            `[home-v2-modal-audit-create-room] widthRatio=${createRoomMetrics.widthRatio.toFixed(3)}, heightRatio=${createRoomMetrics.heightRatio.toFixed(3)}, centerXRatio=${createRoomMetrics.centerXRatio.toFixed(3)}, centerYRatio=${createRoomMetrics.centerYRatio.toFixed(3)}`,
        );
        expect(createRoomMetrics.widthRatio).toBeGreaterThan(0.22);
        expect(createRoomMetrics.widthRatio).toBeLessThan(0.36);
        expect(createRoomMetrics.heightRatio).toBeGreaterThan(0.34);
        expect(createRoomMetrics.heightRatio).toBeLessThan(0.82);
        expect(Math.abs(createRoomMetrics.widthRatio - authModalMetrics.widthRatio)).toBeLessThan(0.06);
        expect(Math.abs(createRoomMetrics.centerXRatio - authModalMetrics.centerXRatio)).toBeLessThan(0.04);
        const createRoomScreenshotPath = getEvidenceScreenshotPath(testInfo, 'create-room-modal-unified-20260516');
        await page.screenshot({ path: createRoomScreenshotPath, fullPage: true });

        const createRoomStableBefore = await createRoomModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });
        await createRoomModal.getByTestId('create-room-name-input').click();
        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 320,
            keyboardInsetHeight: 260,
        });
        await page.waitForTimeout(150);
        const createRoomStableAfter = await createRoomModal.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });
        const createRoomTopDelta = Math.abs(createRoomStableAfter.top - createRoomStableBefore.top);
        const createRoomCenterYDelta = Math.abs(createRoomStableAfter.centerY - createRoomStableBefore.centerY);
        console.log(
            `[home-v2-modal-audit-create-room-stable] topDelta=${createRoomTopDelta.toFixed(2)}, centerYDelta=${createRoomCenterYDelta.toFixed(2)}`,
        );
        expect(createRoomTopDelta).toBeLessThan(4);
        expect(createRoomCenterYDelta).toBeLessThan(4);
            await page.evaluate(() => {
                const root = document.documentElement;
                root.style.removeProperty('--runtime-viewport-height');
                root.style.removeProperty('--keyboard-inset-height');
                delete root.dataset.keyboardVisible;
            });
        } finally {
            await context.close();
        }
    });

    test(HOME_V2_LOCKED_ROOM_JOIN_TEST_NAME, async ({ browser, workerPorts }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const context = await createHomeV2MobileLandscapeContext(browser, workerPorts);
        const page = await context.newPage();
        try {
            await useHomeV2MobileLandscapeViewport(page);
            const injectedLockedRoom = await createLockedTicTacToeRoom(page);

            await page.goto('/?homeV2Draft=1', { waitUntil: 'domcontentloaded' });
            await expect(page.getByTestId('home-v2-root')).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('home-v2-book-stage')).toBeVisible({ timeout: 30000 });
            await ensureHomeV2BookMaterialsReady(page, { requireLegacyTabs: false });
            const tictactoeCard = page.locator('[data-testid="home-v2-root"] [data-game-id="tictactoe"]').first();
            await expect(tictactoeCard).toBeVisible({ timeout: 20000 });
            await tictactoeCard.click();

        await expect(page.getByText(injectedLockedRoom.roomName)).toBeVisible({ timeout: 10000 });
        const lockedRoomCard = page
            .locator('article')
            .filter({ has: page.getByText(injectedLockedRoom.roomName) })
            .locator('button')
            .first();
        await lockedRoomCard.click();

        const passwordPanel = page.getByTestId('home-v2-room-password-panel');
        const passwordSurface = page.getByTestId('home-v2-room-password-surface');
        await expect(passwordPanel).toBeVisible({ timeout: 10000 });
        await expect(passwordSurface).toBeVisible({ timeout: 10000 });
        const passwordPanelMetrics = await page.evaluate(() => {
            const panelSurface = document.querySelector('[data-testid="home-v2-room-password-surface"]') as HTMLElement | null;
            const bookStage = document.querySelector('[data-testid="home-v2-book-stage"]') as HTMLElement | null;
            const input = document.querySelector('[data-testid="home-v2-room-password-input"]') as HTMLElement | null;
            const confirm = document.querySelector('[data-testid="home-v2-room-password-confirm"]') as HTMLElement | null;
            if (!panelSurface || !bookStage || !input || !confirm) return null;
            const surfaceRect = panelSurface.getBoundingClientRect();
            const bookRect = bookStage.getBoundingClientRect();
            const inputRect = input.getBoundingClientRect();
            const confirmRect = confirm.getBoundingClientRect();
            return {
                centerXRatio: (surfaceRect.left + surfaceRect.width / 2) / window.innerWidth,
                centerYRatio: (surfaceRect.top + surfaceRect.height / 2) / window.innerHeight,
                bookCenterXDelta: Math.abs((surfaceRect.left + surfaceRect.width / 2) - (bookRect.left + bookRect.width / 2)),
                surfaceWidthRatio: surfaceRect.width / window.innerWidth,
                surfaceHeightRatio: surfaceRect.height / window.innerHeight,
                inputHeight: inputRect.height,
                confirmHeight: confirmRect.height,
                confirmWidthRatio: confirmRect.width / window.innerWidth,
            };
        });
        if (!passwordPanelMetrics) {
            throw new Error('加密房密码面板节点缺失，无法验证新版浮层');
        }
        console.log(
            `[home-v2-password-panel] centerXRatio=${passwordPanelMetrics.centerXRatio.toFixed(2)}, centerYRatio=${passwordPanelMetrics.centerYRatio.toFixed(2)}, bookCenterXDelta=${passwordPanelMetrics.bookCenterXDelta.toFixed(2)}, surfaceWidthRatio=${passwordPanelMetrics.surfaceWidthRatio.toFixed(2)}, surfaceHeightRatio=${passwordPanelMetrics.surfaceHeightRatio.toFixed(2)}, inputHeight=${passwordPanelMetrics.inputHeight.toFixed(2)}, confirmHeight=${passwordPanelMetrics.confirmHeight.toFixed(2)}, confirmWidthRatio=${passwordPanelMetrics.confirmWidthRatio.toFixed(2)}`,
        );
        expect(passwordPanelMetrics.centerXRatio).toBeGreaterThan(0.47);
        expect(passwordPanelMetrics.centerXRatio).toBeLessThan(0.53);
        expect(passwordPanelMetrics.centerYRatio).toBeGreaterThan(0.46);
        expect(passwordPanelMetrics.centerYRatio).toBeLessThan(0.54);
        expect(passwordPanelMetrics.bookCenterXDelta).toBeLessThan(24);
        expect(passwordPanelMetrics.surfaceWidthRatio).toBeGreaterThan(0.18);
        expect(passwordPanelMetrics.surfaceWidthRatio).toBeLessThan(0.30);
        expect(passwordPanelMetrics.surfaceHeightRatio).toBeGreaterThan(0.34);
        expect(passwordPanelMetrics.surfaceHeightRatio).toBeLessThan(0.54);
        expect(passwordPanelMetrics.inputHeight).toBeGreaterThan(17);
        expect(passwordPanelMetrics.inputHeight).toBeLessThan(25);
        expect(passwordPanelMetrics.confirmHeight).toBeGreaterThan(18);
        expect(passwordPanelMetrics.confirmHeight).toBeLessThan(26);
        expect(passwordPanelMetrics.confirmWidthRatio).toBeGreaterThan(0.10);

        const passwordStableBefore = await passwordSurface.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });
        await page.getByTestId('home-v2-room-password-input').click();
        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 320,
            keyboardInsetHeight: 260,
        });
        await page.waitForTimeout(150);
        const passwordStableAfter = await passwordSurface.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });
        const passwordTopDelta = Math.abs(passwordStableAfter.top - passwordStableBefore.top);
        const passwordCenterYDelta = Math.abs(passwordStableAfter.centerY - passwordStableBefore.centerY);
        console.log(
            `[home-v2-password-panel-stable] topDelta=${passwordTopDelta.toFixed(2)}, centerYDelta=${passwordCenterYDelta.toFixed(2)}`,
        );
        expect(passwordTopDelta).toBeLessThan(4);
        expect(passwordCenterYDelta).toBeLessThan(4);
        const passwordPanelScreenshotPath = getEvidenceScreenshotPath(testInfo, 'locked-room-password-panel');
        await page.screenshot({ path: passwordPanelScreenshotPath, fullPage: true });
        await page.evaluate(() => {
            const root = document.documentElement;
            root.style.removeProperty('--runtime-viewport-height');
            root.style.removeProperty('--keyboard-inset-height');
            delete root.dataset.keyboardVisible;
        });

        await page.getByTestId('home-v2-room-password-input').fill(injectedLockedRoom.password);
        await page.getByTestId('home-v2-room-password-confirm').click();
        await expect(page).toHaveURL(new RegExp(`/play/tictactoe/match/${injectedLockedRoom.matchId}\\?playerID=\\d+`), { timeout: 15000 });
        await waitForMatchBoardOrLoading(page);

            const joinSuccessScreenshotPath = getEvidenceScreenshotPath(testInfo, 'locked-room-join-success');
            await page.screenshot({ path: joinSuccessScreenshotPath, fullPage: true });
        } finally {
            await context.close();
        }
    });

    test(HOME_V2_PACKAGE_ENTRY_TEST_NAME, async ({ browser, workerPorts }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const context = await createHomeV2MobileLandscapeContext(browser, workerPorts);
        const page = await context.newPage();
        try {
            await useHomeV2MobileLandscapeViewport(page);
            await page.goto('/?homeV2Draft=1', { waitUntil: 'domcontentloaded' });
            await expect(page.getByTestId('home-v2-root')).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('home-v2-book-stage')).toBeVisible({ timeout: 30000 });
            await ensureHomeV2BookMaterialsReady(page, { requireLegacyTabs: false });
            const tictactoeCard = page.locator('[data-testid="home-v2-root"] [data-game-id="tictactoe"]').first();
            await expect(tictactoeCard).toBeVisible({ timeout: 20000 });
            await tictactoeCard.click();
            await waitForHomeV2FlipMode(page, 'detail');

            await expect(page.getByTestId('home-v2-mobile-package-region')).toHaveCount(0);
            await expect(page.getByTestId('home-v2-mobile-package-version-badge')).toHaveCount(0);
            await expect(page.getByTestId('game-details-mobile-package-install-confirm-modal')).toHaveCount(0);

            const detailScreenshotPath = getEvidenceScreenshotPath(testInfo, 'home-v2-mobile-package-hidden');
            await page.screenshot({ path: detailScreenshotPath, fullPage: true });
        } finally {
            await context.close();
        }
    });

    test('分类筛选会显示对应的中文游戏列表', async ({ page }) => {
        await page.getByRole('button', { name: '工具' }).click();
        await expect(page.getByRole('heading', { name: '素材切片机' })).toBeVisible();
        await expect(page.getByRole('heading', { name: '王权骰铸' })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: '井字棋' })).toHaveCount(0);

        await page.getByRole('button', { name: '全部游戏' }).click();
        await expect(page.getByRole('heading', { name: '王权骰铸' })).toBeVisible();
        await expect(page.getByRole('heading', { name: '井字棋' })).toBeVisible();
        await expect(page.getByRole('heading', { name: '素材切片机' })).toHaveCount(0);
    });

    test('游戏详情弹窗会显示当前中文动作入口', async ({ page }) => {
        await page.getByRole('heading', { name: '井字棋' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await expect(getVisibleGameDetailsModal(page)).toBeVisible({ timeout: 15000 });

        await expect(page.getByRole('button', { name: '创建房间' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('button', { name: '单机模式' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: '对战AI' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: '本地对战设置' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: '教程模式' })).toBeVisible();

        await page.getByRole('button', { name: '排行榜' }).click();
        await expect(page.getByRole('heading', { name: '胜场排行', level: 4 })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 10000 });
    });

    test(GAME_DETAILS_LOADING_FALLBACK_TEST_NAME, async ({ page, game }, testInfo) => {
        let releaseModalModuleRequest: (() => void) | null = null;
        const allowModalModuleRequest = new Promise<void>((resolve) => {
            releaseModalModuleRequest = resolve;
        });

        await page.route('**/src/components/lobby/GameDetailsModal.tsx*', async (route) => {
            await allowModalModuleRequest;
            await route.continue();
        });

        await ensureLobbyReady(page);

        await page.getByRole('heading', { name: '井字棋' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await expect(page.getByTestId('home-game-details-loading-fallback')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('home-game-details-loading-fallback-root')).toBeVisible();

        await game.screenshot('lobby-game-details-loading-fallback-visible', testInfo);

        releaseModalModuleRequest?.();
    });

    test('关于弹窗赞助二维码会显示 public logos 静态图', async ({ page, game }, testInfo) => {
        await page.locator('[data-fab-id="settings"]').click();
        await page.locator('[data-fab-id="about"]').click();

        await expect(page.getByRole('heading', { name: '桌游平台', level: 2 })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('如果喜欢这个项目，可以请作者喝杯咖啡。')).toBeVisible();

        const wechatQr = page.getByAltText('微信支付二维码');
        const alipayQr = page.getByAltText('支付宝支付二维码');

        await expect(wechatQr).toBeVisible();
        await expect(alipayQr).toBeVisible();

        const qrStates = await Promise.all([
            wechatQr.evaluate((img) => ({
                naturalWidth: img.naturalWidth,
                src: img.getAttribute('src') ?? '',
                currentSrc: img.currentSrc,
            })),
            alipayQr.evaluate((img) => ({
                naturalWidth: img.naturalWidth,
                src: img.getAttribute('src') ?? '',
                currentSrc: img.currentSrc,
            })),
        ]);

        expect(qrStates[0].naturalWidth).toBeGreaterThan(0);
        expect(qrStates[1].naturalWidth).toBeGreaterThan(0);
        expect(qrStates[0].src).toContain('/logos/weixin.jpg');
        expect(qrStates[1].src).toContain('/logos/zhifubao.jpg');
        expect(qrStates[0].currentSrc).toContain('/logos/weixin.jpg');
        expect(qrStates[1].currentSrc).toContain('/logos/zhifubao.jpg');

        await game.screenshot('lobby-about-modal-support-qr-visible', testInfo);
    });

    test(WEB_APP_DOWNLOAD_ENTRY_TEST_NAME, async ({ page, game }, testInfo) => {
        const manifestUrl = 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json';
        const apkUrl = 'https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk';

        await page.route(manifestUrl, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    version: '0.5.1',
                    url: apkUrl,
                    channel: 'stable',
                }),
            });
        });

        await page.evaluate(() => {
            const anchorClicks: Array<{ href: string; target: string | null; rel: string | null }> = [];
            (window as Window & { __testDownloadAnchorClicks__?: Array<{ href: string; target: string | null; rel: string | null }> }).__testDownloadAnchorClicks__ = anchorClicks;

            const originalClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
                anchorClicks.push({
                    href: this.href,
                    target: this.getAttribute('target'),
                    rel: this.getAttribute('rel'),
                });
            };

            (window as Window & { __restoreAnchorClick__?: () => void }).__restoreAnchorClick__ = () => {
                HTMLAnchorElement.prototype.click = originalClick;
            };
        });

        await page.locator('[data-fab-id="settings"]').click();
        await expect(page.locator('[data-fab-id="download-app"]')).toBeVisible();

        await game.screenshot('lobby-download-app-entry-visible', testInfo);

        await page.locator('[data-fab-id="download-app"]').click();

        await expect.poll(async () => page.evaluate(() => (
            (window as Window & { __testDownloadAnchorClicks__?: Array<{ href: string; target: string | null; rel: string | null }> }).__testDownloadAnchorClicks__ ?? []
        ))).toEqual([{
            href: apkUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
        }]);

        await page.evaluate(() => {
            (window as Window & { __restoreAnchorClick__?: () => void }).__restoreAnchorClick__?.();
        });
    });

    test('移动端反馈弹窗应覆盖悬浮球面板，且输入区使用可编辑字号', async ({ browser }, _testInfo) => {
        const context = await browser.newContext({
            viewport: { width: 393, height: 852 },
            isMobile: true,
            hasTouch: true,
        });

        try {
            await setChineseLocale(context);
            const page = await context.newPage();
            await ensureLobbyReady(page);

            await page.locator('[data-fab-id="settings"]').click();
            await expect(page.locator('[data-fab-id="feedback"]')).toBeVisible({ timeout: 10000 });
            await page.locator('[data-fab-id="feedback"]').click();

            const feedbackModal = page.getByTestId('feedback-modal');
            const feedbackTextarea = feedbackModal.getByPlaceholder(/描述/i);
            await expect(feedbackModal).toBeVisible({ timeout: 10000 });
            await expect(feedbackTextarea).toBeVisible();

            const layerMetrics = await page.evaluate(() => {
                const modal = document.querySelector('[data-testid="feedback-modal"]') as HTMLElement | null;
                const fabPanel = document.querySelector('[data-testid="fab-panel-settings"]') as HTMLElement | null;
                const fabSheet = document.querySelector('[data-testid="fab-sheet-settings"]') as HTMLElement | null;
                const fabMenu = document.querySelector('[data-testid="fab-menu"]') as HTMLElement | null;
                const activeFabLayer = fabSheet ?? fabPanel ?? fabMenu;
                const textarea = modal?.querySelector('textarea') as HTMLTextAreaElement | null;
                const resolveZIndex = (element: HTMLElement | null) => {
                    if (!element) return 0;
                    const parsed = Number.parseInt(window.getComputedStyle(element).zIndex || '0', 10);
                    return Number.isFinite(parsed) ? parsed : 0;
                };
                const modalZIndex = resolveZIndex(modal);
                const fabLayerZIndex = resolveZIndex(activeFabLayer);
                const textareaFontSize = textarea ? Number.parseFloat(window.getComputedStyle(textarea).fontSize || '0') : 0;

                return {
                    modalZIndex,
                    fabLayerZIndex,
                    textareaFontSize,
                };
            });

            expect(layerMetrics.modalZIndex, '反馈弹窗层级应高于 FAB 展开层').toBeGreaterThan(layerMetrics.fabLayerZIndex);
            expect(layerMetrics.textareaFontSize, '移动端反馈输入区至少应为 16px，避免输入时看不清').toBeGreaterThanOrEqual(16);

            await feedbackTextarea.click();
            await feedbackTextarea.fill('移动端反馈输入可见性校验');
            await expect(feedbackTextarea).toHaveValue('移动端反馈输入可见性校验');

            await page.screenshot({
                path: 'test-results/evidence-screenshots/_shared/lobby-feedback-modal-mobile.png',
                fullPage: false,
            });
        } finally {
            await context.close();
        }
    });

    test('移动端创建房间输入聚焦后不应把弹窗顶飞出可视区', async ({ page }) => {
        await page.setViewportSize({ width: 393, height: 852 });
        await setChineseLocale(page);
        await ensureLobbyReady(page);

        await page.getByRole('heading', { name: '井字棋' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await openCreateRoomFromDetailsModal(page);

        const getCreateRoomModal = () => page.getByTestId('create-room-modal').last();
        const getRoomNameInput = () => page.getByTestId('create-room-name-input').last();
        const getPasswordInput = () => page.getByTestId('create-room-password-input').last();
        const getPasswordToggle = () => page.getByTestId('create-room-password-toggle').last();

        await expect(getCreateRoomModal()).toBeVisible();
        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 564,
            keyboardInsetHeight: 280,
        });

        await getRoomNameInput().evaluate((node, value) => {
            if (!(node instanceof HTMLInputElement)) {
                throw new Error('房间名输入框节点不是 input');
            }
            node.focus();
            node.value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
        }, '移动端建房输入校验');
        await expect(getPasswordInput()).toBeVisible();
        await expect(getPasswordInput()).toHaveAttribute('type', 'password');
        await getPasswordToggle().click();
        await expect(getPasswordInput()).toHaveAttribute('type', 'text');
        await getPasswordInput().evaluate((node, value) => {
            if (!(node instanceof HTMLInputElement)) {
                throw new Error('房间密码输入框节点不是 input');
            }
            node.focus();
            node.value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
        }, '123456');
        await expect(getRoomNameInput()).toHaveValue('移动端建房输入校验');
        await expect(getPasswordInput()).toHaveValue('123456');

        const layoutMetrics = await getCreateRoomModal().evaluate((element) => {
            const roomName = element.querySelector('[data-testid="create-room-name-input"]');
            const password = element.querySelector('[data-testid="create-room-password-input"]');
            const runtimeViewportHeight = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0');
            const modalRect = element.getBoundingClientRect();

            document.querySelector('[data-testid="e2e-create-room-modal-capture-host"]')?.remove();
            if (!(element instanceof HTMLElement)) {
                throw new Error('建房弹窗节点不是 HTMLElement');
            }
            const clone = element.cloneNode(true);
            if (!(clone instanceof HTMLElement)) {
                throw new Error('建房弹窗快照节点不是 HTMLElement');
            }
            clone.setAttribute('data-testid', 'e2e-create-room-modal-capture');
            clone.style.position = 'fixed';
            clone.style.top = '16px';
            clone.style.left = '16px';
            clone.style.right = 'auto';
            clone.style.bottom = 'auto';
            clone.style.inset = 'auto';
            clone.style.margin = '0';
            clone.style.transform = 'none';
            clone.style.maxHeight = 'none';
            clone.style.width = `${modalRect.width}px`;
            clone.style.height = `${modalRect.height}px`;
            clone.style.zIndex = '2147483647';
            clone.style.pointerEvents = 'none';
            clone.style.opacity = '1';
            clone.style.visibility = 'visible';

            const sourceInputs = element.querySelectorAll('input, textarea, select');
            const cloneInputs = clone.querySelectorAll('input, textarea, select');
            sourceInputs.forEach((input, index) => {
                const target = cloneInputs[index];
                if (input instanceof HTMLInputElement && target instanceof HTMLInputElement) {
                    target.value = input.value;
                    target.checked = input.checked;
                    return;
                }
                if (input instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
                    target.value = input.value;
                    return;
                }
                if (input instanceof HTMLSelectElement && target instanceof HTMLSelectElement) {
                    target.value = input.value;
                }
            });

            const host = document.createElement('div');
            host.setAttribute('data-testid', 'e2e-create-room-modal-capture-host');
            host.style.position = 'fixed';
            host.style.inset = '0';
            host.style.zIndex = '2147483647';
            host.style.background = getComputedStyle(document.body).backgroundColor || '#efe4cb';
            host.style.display = 'flex';
            host.style.alignItems = 'flex-start';
            host.style.justifyContent = 'flex-start';
            host.style.padding = '16px';
            host.style.pointerEvents = 'none';
            host.appendChild(clone);
            document.body.appendChild(host);

            return {
                modalLeft: modalRect.left,
                modalTop: element.getBoundingClientRect().top,
                modalWidth: modalRect.width,
                modalHeight: modalRect.height,
                roomNameBottom: roomName?.getBoundingClientRect().bottom ?? 0,
                passwordBottom: password?.getBoundingClientRect().bottom ?? 0,
                runtimeViewportHeight,
                inputFontSizes: Array.from(element.querySelectorAll('input, select, textarea')).map((node) => {
                    const rect = node.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0) {
                        return 0;
                    }
                    const fontSize = window.getComputedStyle(node).fontSize || '0';
                    return Number.parseFloat(fontSize);
                }).filter((fontSize) => Number.isFinite(fontSize) && fontSize > 0),
            };
        });

        expect(layoutMetrics.modalTop, '建房弹窗聚焦输入后顶部不应被顶出屏幕').toBeGreaterThanOrEqual(0);
        expect(layoutMetrics.roomNameBottom, '房间名输入框应留在键盘上方可视区').toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(layoutMetrics.passwordBottom, '密码输入框应留在键盘上方可视区').toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(Math.min(...layoutMetrics.inputFontSizes), '移动端建房输入区至少应为 16px').toBeGreaterThanOrEqual(16);

        await expect(page.getByTestId('e2e-create-room-modal-capture-host')).toBeVisible();
        await page.screenshot({
            path: 'test-results/evidence-screenshots/_shared/create-room-modal-mobile-keyboard-safe.png',
            fullPage: false,
        });
    });

    test('移动端私密房间密码输入聚焦后仍应保持可见', async ({ page }) => {
        await page.setViewportSize({ width: 393, height: 852 });
        await setChineseLocale(page);

        const privateRoom = await createLockedTicTacToeRoom(page);
        await ensureLobbyReady(page);
        const ticTacToeCard = page.locator('a[data-game-id="tictactoe"]').first();
        await expect(ticTacToeCard).toBeVisible({ timeout: 15000 });
        await ticTacToeCard.click();
        await expect(page).toHaveURL(/game=tictactoe/);
        const detailsModal = getVisibleGameDetailsModal(page);
        await expect(detailsModal).toBeVisible({ timeout: 15000 });

        const roomCard = detailsModal.getByTestId(`room-list-item-${privateRoom.matchId}`).last();
        await expect(roomCard).toBeVisible({ timeout: 15000 });

        await roomCard.getByTestId(`room-list-join-${privateRoom.matchId}`).click();

        const passwordModal = page.getByTestId('room-password-modal');
        const passwordInput = page.getByTestId('room-password-input');
        const confirmButton = page.getByTestId('room-password-confirm');

        await expect(passwordModal).toBeVisible();
        await expect(confirmButton).toBeVisible();
        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 564,
            keyboardInsetHeight: 280,
        });
        await expect(passwordInput).toHaveAttribute('type', 'password');

        await passwordInput.evaluate((node) => {
            if (!(node instanceof HTMLInputElement)) {
                throw new Error('私密房间密码输入框节点不是 input');
            }
            node.focus();
        });

        const layoutMetrics = await passwordModal.evaluate((element) => {
            if (!(element instanceof HTMLElement)) {
                throw new Error('私密房间密码弹窗节点不是 HTMLElement');
            }

            const input = element.querySelector('[data-testid="room-password-input"]');
            const confirm = element.querySelector('[data-testid="room-password-confirm"]');
            const modalRect = element.getBoundingClientRect();
            const runtimeViewportHeight = Number.parseFloat(
                window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0',
            );

            return {
                modalTop: modalRect.top,
                modalLeft: modalRect.left,
                modalRight: modalRect.right,
                modalBottom: modalRect.bottom,
                inputBottom: input?.getBoundingClientRect().bottom ?? 0,
                confirmBottom: confirm?.getBoundingClientRect().bottom ?? 0,
                runtimeViewportHeight,
                viewportWidth: window.innerWidth,
            };
        });
        const passwordInputFontSize = await passwordInput.evaluate((node) =>
            Number.parseFloat(window.getComputedStyle(node).fontSize || '0')
        );

        expect(layoutMetrics.modalTop, '私密房间密码弹窗聚焦后顶部不应被顶出屏幕').toBeGreaterThanOrEqual(0);
        expect(layoutMetrics.inputBottom, '私密房间密码输入框应留在键盘上方可视区').toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(layoutMetrics.confirmBottom, '私密房间确认按钮应留在键盘上方可视区').toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(passwordInputFontSize, '移动端私密房间密码输入至少应为 16px').toBeGreaterThanOrEqual(16);

        await page.evaluate(() => {
            document.querySelector('[data-testid="room-password-modal-capture"]')?.remove();

            const liveModal = document.querySelector('[data-testid="room-password-modal"]');
            if (!(liveModal instanceof HTMLElement)) {
                throw new Error('未找到用于截图的私密房间密码弹窗');
            }

            const clonedModal = liveModal.cloneNode(true);
            if (!(clonedModal instanceof HTMLElement)) {
                throw new Error('私密房间密码弹窗克隆失败');
            }

            clonedModal.dataset.testid = 'room-password-modal-capture';
            clonedModal.style.position = 'fixed';
            clonedModal.style.left = '50%';
            clonedModal.style.top = '50%';
            clonedModal.style.transform = 'translate(-50%, -50%)';
            clonedModal.style.zIndex = '9999';
            clonedModal.style.pointerEvents = 'none';
            clonedModal.style.margin = '0';
            clonedModal.style.maxHeight = 'none';
            clonedModal.style.visibility = 'visible';
            clonedModal.style.opacity = '1';

            document.body.appendChild(clonedModal);
        });

        const captureModal = page.getByTestId('room-password-modal-capture');
        await expect(captureModal).toBeVisible();
        await captureModal.screenshot({
            path: 'test-results/evidence-screenshots/_shared/private-room-password-modal-mobile.png',
            animations: 'disabled',
        });
    });

    test('创建房间时会显示进入对局 loading', async ({ page, game }, testInfo) => {
        let delayedOnce = false;
        await page.route('**/games/tictactoe/create', async (route) => {
            if (!delayedOnce) {
                delayedOnce = true;
                await page.waitForTimeout(1200);
            }
            await route.continue();
        });

        await page.getByRole('heading', { name: '井字棋' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await openCreateRoomFromDetailsModal(page);
        await expect(page.getByRole('heading', { name: '创建房间' })).toBeVisible();

        await confirmCreateRoomFromModal(page);

        await expect(page.getByText('创建中')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('正在创建房间并进入对局...')).toBeVisible();

        await game.screenshot('lobby-tictactoe-create-room-loading', testInfo);

        await expect(page).toHaveURL(/\/play\/tictactoe\/match\//, { timeout: 15000 });
    });

    test('大杀四方创建房间弹窗可直接配置 AI 人数和模组，并为游客保存偏好', async ({ page, game }, testInfo) => {
        await page.evaluate(() => {
            localStorage.removeItem('local_ai_match_preferences:smashup');
            Object.keys(localStorage)
                .filter((key) => key.startsWith('match_ai_creds_'))
                .forEach((key) => localStorage.removeItem(key));
        });

        await page.getByRole('heading', { name: '大杀四方' }).click();
        await expect(page).toHaveURL(/game=smashup/);
        await openCreateRoomFromDetailsModal(page);

        await expect(page.getByRole('heading', { name: '创建房间' })).toBeVisible();
        await page.getByRole('button', { name: '3人' }).click();
        await page.getByTestId('setup-option-toggle-expansions-titans').click();
        await page.getByRole('button', { name: /加入 AI/ }).click();
        await expect(page.getByText('已开启')).toBeVisible();
        await expect(page.getByRole('button', { name: '普通' })).toHaveAttribute('aria-pressed', 'true');

        await game.screenshot('lobby-smashup-create-room-ai-config-default-normal', testInfo);

        await page.getByRole('button', { name: '困难' }).click();
        await expect(page.getByRole('button', { name: '1 号位（房主）' })).toBeDisabled();
        await page.getByRole('button', { name: '3 号位' }).click();

        await game.screenshot('lobby-smashup-create-room-ai-config-hard-and-seats', testInfo);

        await confirmCreateRoomFromModal(page);

        await expect(page).toHaveURL(/\/play\/smashup\/match\//);
        await expect(page.locator('div[data-game-page="true"][data-game-id="smashup"]').first()).toBeVisible({
            timeout: 60000,
        });
        await game.screenshot('lobby-smashup-create-room-ai-entered', testInfo);

        const matchId = page.url().match(/\/play\/smashup\/match\/([^?]+)/)?.[1];
        expect(matchId).toBeTruthy();
        if (!matchId) {
            throw new Error('未能从 URL 提取 matchId');
        }

        const response = await page.request.get(`${getGameServerBaseURL()}/games/smashup/${matchId}`);
        expect(response.ok()).toBeTruthy();
        const payload = await response.json() as {
            setupData?: {
                enableAi?: boolean;
                setupSelections?: { expansions?: string[] };
                seatControllers?: Record<string, { type?: string; difficulty?: string }>;
            };
        };

        expect(payload.setupData?.enableAi).toBe(true);
        expect(payload.setupData?.setupSelections?.expansions ?? []).toEqual([]);
        expect(payload.setupData?.seatControllers?.['1']?.type).toBe('local-ai');
        expect(payload.setupData?.seatControllers?.['2']?.type).toBe('local-ai');
        expect(payload.setupData?.seatControllers?.['1']?.difficulty).toBe('hard');
        expect(payload.setupData?.seatControllers?.['2']?.difficulty).toBe('hard');

        const storedPreferences = await page.evaluate(() => {
            const raw = localStorage.getItem('local_ai_match_preferences:smashup');
            return raw ? JSON.parse(raw) : null;
        });
        expect(storedPreferences).not.toBeNull();
        expect(storedPreferences?.numPlayers).toBe(3);
        expect(storedPreferences?.setupSelections?.expansions ?? []).toEqual([]);

        const aiSeatCredentials = await page.evaluate(() => {
            const key = Object.keys(localStorage).find((item) => item.startsWith('match_ai_creds_'));
            if (!key) return null;
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        });

        const hasAiSeatInStoredPreferences = storedPreferences?.seatControllers?.['1']?.type === 'local-ai'
            && storedPreferences?.seatControllers?.['2']?.type === 'local-ai';
        const hasAiSeatCredentials = Boolean(aiSeatCredentials?.['1'] && aiSeatCredentials?.['2']);
        expect(hasAiSeatInStoredPreferences || hasAiSeatCredentials).toBe(true);
        expect(aiSeatCredentials?.['1']).toBeTruthy();
        expect(aiSeatCredentials?.['2']).toBeTruthy();
    });

    test(ACTIVE_MATCH_FLOATING_BANNER_TEST_NAME, async ({ page, game }, testInfo) => {
        const matchId = await createTicTacToeRoom(page);
        const roomCode = matchId.slice(0, 4);

        await ensureLobbyReady(page);

        const banner = page.getByTestId('home-active-match-banner');
        const card = page.getByTestId('home-active-match-card');
        const actions = page.getByTestId('home-active-match-actions');

        await expect(banner).toBeVisible({ timeout: 15000 });
        await expect(card.getByText(new RegExp(roomCode, 'i'))).toBeVisible();
        await expect(actions.getByRole('button').last()).toBeVisible();

        const desktopViewport = page.viewportSize();
        const desktopCardBox = await card.boundingBox();
        expect(desktopViewport).not.toBeNull();
        expect(desktopCardBox).not.toBeNull();

        if (!desktopViewport || !desktopCardBox) {
            throw new Error('首页活跃房间浮层未正确渲染，无法校验桌面端居中');
        }

        const desktopCenterX = desktopCardBox.x + desktopCardBox.width / 2;
        expect(Math.abs(desktopCenterX - desktopViewport.width / 2)).toBeLessThan(4);

        await game.screenshot('lobby-home-active-match-desktop-centered', testInfo);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect(card).toBeVisible();

        const mobileCardBox = await card.boundingBox();
        expect(mobileCardBox).not.toBeNull();
        if (!mobileCardBox) {
            throw new Error('首页活跃房间浮层未正确渲染，无法校验移动端布局');
        }

        expect(mobileCardBox.x).toBeGreaterThanOrEqual(8);
        expect(mobileCardBox.x + mobileCardBox.width).toBeLessThanOrEqual(390 - 8);

        const actionButtons = actions.getByRole('button');
        await expect(actionButtons).toHaveCount(2);
        const firstButtonBox = await actionButtons.nth(0).boundingBox();
        const secondButtonBox = await actionButtons.nth(1).boundingBox();
        expect(firstButtonBox).not.toBeNull();
        expect(secondButtonBox).not.toBeNull();

        if (!firstButtonBox || !secondButtonBox) {
            throw new Error('首页活跃房间操作按钮未正确渲染，无法校验移动端堆叠');
        }

        const isSingleRowCompact = Math.abs(secondButtonBox.y - firstButtonBox.y) < 6 && secondButtonBox.x > firstButtonBox.x;
        const isWrappedStack = secondButtonBox.y > firstButtonBox.y + 2;
        expect(isSingleRowCompact || isWrappedStack).toBeTruthy();

        const hasHorizontalOverflow = await page.evaluate(() => {
            const maxScrollWidth = Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
                document.documentElement.clientWidth,
                document.body.clientWidth,
            );
            return maxScrollWidth > window.innerWidth + 1;
        });
        expect(hasHorizontalOverflow).toBeFalsy();

        await game.screenshot('lobby-home-active-match-mobile-safe', testInfo);
    });

    test(MOBILE_AUTHOR_ENTRY_TEST_NAME, async ({ page, game }, testInfo) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/?game=tictactoe', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/game=tictactoe/);

        const sidebar = page.getByTestId('game-details-sidebar');
        const mobileAuthorButton = page.getByTestId('game-details-author-button-mobile');

        await expect(sidebar).toBeVisible({ timeout: 15000 });
        await expect(mobileAuthorButton).toBeVisible();
        await expect(page.getByTestId('game-details-description')).toBeHidden();
        await expect(page.getByTestId('game-details-player-recommendation')).toBeHidden();

        const sidebarBox = await sidebar.boundingBox();
        const buttonBox = await mobileAuthorButton.boundingBox();
        expect(sidebarBox).not.toBeNull();
        expect(buttonBox).not.toBeNull();

        if (!sidebarBox || !buttonBox) {
            throw new Error('移动端作者入口或详情侧栏未正确渲染，无法校验位置');
        }

        const topOffset = buttonBox.y - sidebarBox.y;
        const rightOffset = sidebarBox.x + sidebarBox.width - (buttonBox.x + buttonBox.width);
        const buttonCenterX = buttonBox.x + buttonBox.width / 2;
        const sidebarCenterX = sidebarBox.x + sidebarBox.width / 2;

        expect(topOffset).toBeGreaterThanOrEqual(0);
        expect(topOffset).toBeLessThan(24);
        expect(rightOffset).toBeGreaterThanOrEqual(0);
        expect(rightOffset).toBeLessThan(24);
        expect(buttonCenterX).toBeGreaterThan(sidebarCenterX);

        const mobileAuthorButtonStyles = await mobileAuthorButton.evaluate((element) => {
            const styles = window.getComputedStyle(element);
            return {
                backgroundColor: styles.backgroundColor,
                borderTopWidth: styles.borderTopWidth,
                borderTopStyle: styles.borderTopStyle,
                boxShadow: styles.boxShadow,
            };
        });
        const normalizedBoxShadow = mobileAuthorButtonStyles.boxShadow.replace(/\s+/g, ' ').trim();

        expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(mobileAuthorButtonStyles.backgroundColor);
        expect(mobileAuthorButtonStyles.borderTopWidth).toBe('0px');
        expect(mobileAuthorButtonStyles.borderTopStyle).toBe('none');
        expect(
            normalizedBoxShadow === 'none'
            || /^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, rgba\(0, 0, 0, 0\) 0px 0px 0px 0px)*$/.test(normalizedBoxShadow)
        ).toBeTruthy();

        await game.screenshot('lobby-mobile-author-entry-right-top', testInfo);

        await mobileAuthorButton.click();
        await expect(page.getByTestId('game-details-author-modal')).toBeVisible();

        await game.screenshot('lobby-mobile-author-modal-open', testInfo);
    });

    test(MOBILE_PACKAGE_ENTRY_TEST_NAME, async ({ page, game }, testInfo) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await ensureLobbyReady(page);
        await page.getByRole('heading', { name: /Tic-Tac-Toe/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        const modalRoot = getVisibleGameDetailsModal(page);
        const packageCard = page.getByTestId('game-details-mobile-package-card');
        const installButton = page.getByRole('button', { name: /Install Pack/i });

        await expect(modalRoot).toBeVisible({ timeout: 15000 });
        await expect(packageCard).toBeVisible();
        await expect(page.getByText(/Not installed/i)).toBeVisible();
        await expect(installButton).toBeVisible();

        const modalBox = await modalRoot.boundingBox();
        const cardBox = await packageCard.boundingBox();
        expect(modalBox).not.toBeNull();
        expect(cardBox).not.toBeNull();

        if (!modalBox || !cardBox) {
            throw new Error('移动端详情弹窗或包管理入口未正确渲染，无法校验左下角位置');
        }

        const leftOffset = cardBox.x - modalBox.x;
        const bottomOffset = modalBox.y + modalBox.height - (cardBox.y + cardBox.height);

        expect(leftOffset).toBeGreaterThanOrEqual(0);
        expect(leftOffset).toBeLessThan(36);
        expect(bottomOffset).toBeGreaterThanOrEqual(0);
        expect(bottomOffset).toBeLessThan(36);

        await game.screenshot('lobby-mobile-package-entry-left-bottom', testInfo);

        await installButton.click();
        await expect(page.getByText(/Download Tic-Tac-Toe packages/i)).toBeVisible();
        await expect(page.getByText(/Estimated Download/i)).toBeVisible();
        await expect(page.getByText('Code Pack', { exact: true })).toBeVisible();
        await expect(page.getByText('Asset Pack', { exact: true })).toBeVisible();

        await game.screenshot('lobby-mobile-package-entry-confirm-modal', testInfo);

        await page.getByRole('button', { name: /Confirm Download/i }).click();
        await expect(page.getByTestId('game-details-mobile-package-progress-track')).toBeVisible();
        await expect(page.getByText(/Reading Manifest/i)).toBeVisible();

        await game.screenshot('lobby-mobile-package-entry-progress-card', testInfo);

        await expect(page.getByText(/does not support downloading game packages yet/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
        await expect(page.getByTestId('game-details-mobile-package-card')).toHaveAttribute('data-status', 'failed');

        await game.screenshot('lobby-mobile-package-entry-failed-retry', testInfo);
    });

    test('Dice Throne 更新日志 tab 会请求公开接口并结束 loading', async ({ page }) => {
        await page.getByRole('heading', { name: /Dice Throne/i }).click();
        await expect(page).toHaveURL(/game=dicethrone/);

        const changelogResponsePromise = page.waitForResponse((response) => {
            return response.url().includes('/game-changelogs/dicethrone') && response.request().method() === 'GET';
        });

        await page.getByRole('button', { name: /Updates/i }).click();

        const changelogResponse = await changelogResponsePromise;
        expect(changelogResponse.status()).toBe(200);

        const payload = await changelogResponse.json();
        expect(Array.isArray(payload.changelogs)).toBeTruthy();

        await expect(page.getByText(/Loading changelog/i)).toHaveCount(0, { timeout: 10000 });

        if (payload.changelogs.length > 0) {
            await expect(page.getByText(payload.changelogs[0].title)).toBeVisible({ timeout: 10000 });
            return;
        }

        await expect(page.getByText(/No updates yet|Failed to load changelog/i)).toBeVisible({ timeout: 10000 });
    });

    test('Dice Throne 直达链接会直接打开详情弹窗', async ({ page }) => {
        await page.goto('/?game=dicethrone', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/game=dicethrone/);
        const detailsModal = getVisibleGameDetailsModal(page);
        await expect(detailsModal).toBeVisible({ timeout: 15000 });
        await expect(detailsModal.getByTestId('game-details-open-create-room')).toBeVisible();
        await expect(detailsModal.getByRole('button', { name: '教程模式' })).toBeVisible();
        await expect(detailsModal.getByRole('button', { name: /对战AI|Play AI/i })).toHaveCount(0);
    });

    test('Dice Throne 更新日志 tab 会渲染接口返回的已发布内容', async ({ page, game }, testInfo) => {
        await page.route('**/game-changelogs/dicethrone', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    changelogs: [
                        {
                            id: 'cl-dicethrone-1',
                            gameId: 'dicethrone',
                            title: 'Balance Update',
                            versionLabel: 'v0.1.3',
                            content: 'Pyromancer burn tooltip now matches the published rules.',
                            pinned: true,
                            published: true,
                            publishedAt: '2026-03-12T00:00:00.000Z',
                            createdAt: '2026-03-12T00:00:00.000Z',
                            updatedAt: '2026-03-12T00:00:00.000Z',
                        },
                    ],
                }),
            });
        });

        await page.getByRole('heading', { name: /Dice Throne/i }).click();
        await expect(page).toHaveURL(/game=dicethrone/);

        await page.getByRole('button', { name: /Updates/i }).click();

        await expect(page.getByText('Balance Update')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('v0.1.3')).toBeVisible();
        await expect(page.getByText('Pinned')).toBeVisible();
        await expect(page.getByText('Pyromancer burn tooltip now matches the published rules.')).toBeVisible();

        await game.screenshot('lobby-dicethrone-changelog-renders-published-entry', testInfo);
    });
});
