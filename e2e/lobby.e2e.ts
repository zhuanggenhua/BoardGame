import type { Page } from '@playwright/test';
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
            ? ['/overview-spread/1.png']
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
const MOBILE_AUTHOR_ENTRY_TEST_NAME = '移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围框';
const MOBILE_PACKAGE_ENTRY_TEST_NAME = '移动端 package-managed 游戏详情在左下角显示包管理入口';
const GAME_DETAILS_LOADING_FALLBACK_TEST_NAME = '首次打开游戏详情时会先显示加载骨架，避免只剩路由跳转';
const ACTIVE_MATCH_FLOATING_BANNER_TEST_NAME = '首页活跃房间浮层在桌面端居中且移动端不溢出';
const WEB_APP_DOWNLOAD_ENTRY_TEST_NAME = '网页端下载 App 入口会读取 native update latest.json 并打开其中 APK 地址';
const DEFAULT_HOME_V2_MOBILE_LANDSCAPE_VIEWPORT = { width: 2388, height: 1080 };
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

async function useHomeV2MobileLandscapeViewport(page: Page): Promise<void> {
    await page.setViewportSize(HOME_V2_MOBILE_LANDSCAPE_VIEWPORT);
    const viewport = page.viewportSize();
    if (!viewport) {
        throw new Error('未能读取当前 Playwright 视口');
    }
    console.log(`[home-v2-viewport] width=${viewport.width}, height=${viewport.height}`);
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
                roomName: resolvedRoomName,
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
            || testInfo.title === MOBILE_AUTHOR_ENTRY_TEST_NAME
            || testInfo.title === MOBILE_PACKAGE_ENTRY_TEST_NAME
            || testInfo.title === GAME_DETAILS_LOADING_FALLBACK_TEST_NAME
        ) {
            return;
        }
        await ensureLobbyReady(page);
    });

    test(HOME_V2_QUERY_ENTRY_TEST_NAME, async ({ page }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        await useHomeV2MobileLandscapeViewport(page);
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
        await expect(page.getByTestId('home-v2-category-all')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('home-v2-category-card')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('home-v2-category-tools')).toBeVisible({ timeout: 10000 });

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
        const [cardiaBox, diceThroneBox, smashupBox, splendorBox, summonerWarsBox, tictactoeBox] = referenceCards.map((entry) => entry.box!);
        const leftColumnDelta = Math.max(cardiaBox.x, diceThroneBox.x, smashupBox.x) - Math.min(cardiaBox.x, diceThroneBox.x, smashupBox.x);
        const rightColumnDelta = Math.max(splendorBox.x, summonerWarsBox.x, tictactoeBox.x) - Math.min(splendorBox.x, summonerWarsBox.x, tictactoeBox.x);
        const leftToRightGap = splendorBox.x - cardiaBox.x;
        const row1Delta = Math.abs(cardiaBox.y - splendorBox.y);
        const row2Delta = Math.abs(diceThroneBox.y - summonerWarsBox.y);
        const row3Delta = Math.abs(smashupBox.y - tictactoeBox.y);
        console.log(
            `[home-v2-homepage-grid] leftColumnDelta=${leftColumnDelta.toFixed(2)}, rightColumnDelta=${rightColumnDelta.toFixed(2)}, leftToRightGap=${leftToRightGap.toFixed(2)}, rowDelta=(${row1Delta.toFixed(2)},${row2Delta.toFixed(2)},${row3Delta.toFixed(2)})`,
        );
        expect(leftColumnDelta).toBeLessThan(18);
        expect(rightColumnDelta).toBeLessThan(18);
        expect(leftToRightGap).toBeGreaterThan(180);
        expect(row1Delta).toBeLessThan(16);
        expect(row2Delta).toBeLessThan(16);
        expect(row3Delta).toBeLessThan(16);

        const homepageScreenshotPath = getEvidenceScreenshotPath(testInfo, 'homepage-catalog');
        await page.screenshot({ path: homepageScreenshotPath, fullPage: true });

        await page.getByTestId('home-v2-account-entry').click();
        const embeddedAuthPanel = page.getByTestId('auth-embedded-panel').first();
        await expect(embeddedAuthPanel).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('home-v2-auth-mode-login-header')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('home-v2-auth-mode-register-header')).toBeVisible({ timeout: 10000 });
        await expect(
            page.locator('[data-scene-node="home-v2-tab-lobby"], [data-scene-node="home-v2-tab-rooms"], [data-scene-node="tab_button_lobby"], [data-scene-node="tab_button_rooms"]'),
        ).toHaveCount(0);
        await expect(page.getByTestId('auth-modal')).toHaveCount(0);
        await expect(embeddedAuthPanel.getByTestId('auth-login-account-input')).toBeVisible({ timeout: 10000 });
        await expect(embeddedAuthPanel.getByTestId('auth-login-password-input')).toBeVisible({ timeout: 10000 });
        const roomsScreenshotPath = getEvidenceScreenshotPath(testInfo, 'rooms-auth-entry');
        await page.screenshot({ path: roomsScreenshotPath, fullPage: true });

        await page.getByTestId('home-v2-rooms-back-to-lobby').click();
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
                const detailScreenshotPath = getEvidenceScreenshotPath(testInfo, 'detail-entry');
                await page.screenshot({ path: detailScreenshotPath, fullPage: true });
            }

            await backButton.click();
            await captureHomeV2FlipFrameAtProgress(page, testInfo, `page-flip-back-to-catalog-${suffix}`, progress);
            await waitForHomeV2FlipMode(page, 'overview');
            await expect(page.locator('[data-scene-slot="overview_spread_body"]').first()).toBeVisible({ timeout: 10000 });
        }

        const returnCatalogScreenshotPath = getEvidenceScreenshotPath(testInfo, 'catalog-return-after-flip');
        await page.screenshot({ path: returnCatalogScreenshotPath, fullPage: true });
    });

    test(HOME_V2_LOCKED_ROOM_JOIN_TEST_NAME, async ({ page }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        await useHomeV2MobileLandscapeViewport(page);
        const injectedLockedRoom = await createLockedTicTacToeRoom(page);

        await page.goto('/?homeV2Draft=1', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('home-v2-root')).toBeVisible({ timeout: 15000 });
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
        await expect(passwordPanel).toBeVisible({ timeout: 10000 });
        const passwordPanelScreenshotPath = getEvidenceScreenshotPath(testInfo, 'locked-room-password-panel');
        await page.screenshot({ path: passwordPanelScreenshotPath, fullPage: true });

        await page.getByTestId('home-v2-room-password-input').fill(injectedLockedRoom.password);
        await page.getByTestId('home-v2-room-password-confirm').click();
        await expect(page).toHaveURL(new RegExp(`/play/tictactoe/match/${injectedLockedRoom.matchId}\\?playerID=\\d+`), { timeout: 15000 });
        await waitForMatchBoardOrLoading(page);

        const joinSuccessScreenshotPath = getEvidenceScreenshotPath(testInfo, 'locked-room-join-success');
        await page.screenshot({ path: joinSuccessScreenshotPath, fullPage: true });
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
