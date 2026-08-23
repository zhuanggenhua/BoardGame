import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    getGameServerBaseURL,
    setChineseLocale,
    waitForFrontendAssets,
    waitForHomeGameList,
} from '../helpers/common';

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
    await gotoLobbyWithRetry(page);
    await waitForFrontendAssets(page, 45000);
    await waitForHomeGameList(page, 45000);
    await expect(page.locator('[data-game-id]').first()).toBeVisible({ timeout: 15000 });
}

async function applyKeyboardViewportSimulation(page: Page, options: { runtimeViewportHeight: number; keyboardInsetHeight: number }) {
    await page.evaluate(({ runtimeViewportHeight, keyboardInsetHeight }) => {
        const root = document.documentElement;
        root.style.setProperty('--layout-viewport-height', `${window.innerHeight}px`);
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
    await openCreateRoomButton.evaluate((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            throw new Error('创建房间按钮节点不是 button');
        }
        button.click();
    });
    await expect(page.getByTestId('create-room-modal').last()).toBeVisible({ timeout: 10000 });
}

const getVisibleGameDetailsModal = (page: Page) => page.locator('[data-testid="game-details-modal-root"]:visible').last();

async function confirmCreateRoomFromModal(page: Page): Promise<void> {
    const confirmButton = page.getByTestId('create-room-confirm-button');
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.evaluate((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            throw new Error('确认创建按钮节点不是 button');
        }
        button.click();
    });
}

const MOBILE_AUTHOR_ENTRY_TEST_NAME = '移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围框';
const MOBILE_PACKAGE_ENTRY_TEST_NAME = '网页版 package-managed 游戏详情在移动端不应显示包管理入口，但详情头部仍应完整';
const GAME_DETAILS_LOADING_FALLBACK_TEST_NAME = '首次打开游戏详情时会先显示加载骨架，避免只剩路由跳转';
const ACTIVE_MATCH_FLOATING_BANNER_TEST_NAME = '首页活跃房间浮层在桌面端居中且移动端不溢出';
const WEB_APP_DOWNLOAD_ENTRY_TEST_NAME = '网页端下载 App 入口会读取 native update latest.json 并打开其中 APK 地址';
const CLASSIC_HOME_LEADERBOARD_ELO_TEST_NAME = '经典首页游戏详情排行榜显示 ELO 排行卡片';

async function mockTicTacToeEloLeaderboard(page: Page): Promise<void> {
    await page.route('**/games/tictactoe/leaderboard', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
                leaderboard: [
                    {
                        name: '桌游高手',
                        rating: 306,
                        wins: 12,
                        losses: 0,
                        draws: 0,
                        matches: 12,
                        winRate: 1,
                        provisional: true,
                        tier: 'strong',
                    },
                    {
                        name: '稳定玩家',
                        rating: 106,
                        wins: 4,
                        losses: 0,
                        draws: 0,
                        matches: 4,
                        winRate: 1,
                        provisional: true,
                        tier: 'average',
                    },
                    {
                        name: '刷局玩家',
                        rating: 100,
                        wins: 10,
                        losses: 12,
                        draws: 0,
                        matches: 22,
                        winRate: 0.455,
                        provisional: true,
                        tier: 'average',
                    },
                ],
            }),
        });
    });
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

test.describe('Lobby E2E', () => {
    test.describe.configure({ timeout: 90000 });

    test.beforeEach(async ({ page }, testInfo) => {
        await setChineseLocale(page);
        if (
            testInfo.title === MOBILE_AUTHOR_ENTRY_TEST_NAME
            || testInfo.title === MOBILE_PACKAGE_ENTRY_TEST_NAME
            || testInfo.title === GAME_DETAILS_LOADING_FALLBACK_TEST_NAME
        ) {
            return;
        }
        await ensureLobbyReady(page);
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

    test('经典首页分类栏在手机竖屏下不应把后半段分类挤到屏外', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        const categoryLabels = ['全部游戏', '卡牌', '骰子', '抽象', '战棋', '休闲', '工具'] as const;
        for (const label of categoryLabels) {
            const button = page.getByRole('button', { name: label });
            await expect(button).toBeVisible();
            const box = await button.boundingBox();
            expect(box, `${label} 分类按钮未正确渲染`).not.toBeNull();
            if (!box) {
                throw new Error(`${label} 分类按钮未正确渲染`);
            }
            expect(box.x, `${label} 分类按钮左边缘不应掉出屏幕`).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width, `${label} 分类按钮右边缘不应掉出 390 宽视口`).toBeLessThanOrEqual(390);
        }

        await page.getByRole('button', { name: '工具' }).click();
        await expect(page.getByRole('heading', { name: '素材切片机' })).toBeVisible();
        await expect(page.getByRole('heading', { name: '王权骰铸' })).toHaveCount(0);

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
        await expect(page.getByRole('heading', { name: 'ELO 排行', level: 4 })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 10000 });
    });

    test(CLASSIC_HOME_LEADERBOARD_ELO_TEST_NAME, async ({ page }, testInfo) => {
        await mockTicTacToeEloLeaderboard(page);
        await expect(page.locator('body')).toHaveAttribute('data-home-entry-style', 'classic');
        await expect(page.getByTestId('home-v2-root')).toHaveCount(0);

        await page.getByRole('heading', { name: '井字棋' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);
        const modalRoot = getVisibleGameDetailsModal(page);
        await expect(modalRoot).toBeVisible({ timeout: 15000 });

        await modalRoot.getByRole('button', { name: '排行榜' }).click();
        await expect(modalRoot.getByRole('heading', { name: 'ELO 排行', level: 4 })).toBeVisible({ timeout: 10000 });
        await expect(modalRoot.getByText('桌游高手')).toBeVisible({ timeout: 10000 });
        await expect(modalRoot.getByText('306 ELO')).toBeVisible();
        await expect(modalRoot.getByText('12胜 0负 0平 · 100% / 12局')).toBeVisible();
        await expect(modalRoot.getByText(/强手.*定级中/)).toBeVisible();

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '经典首页-ELO排行榜-桌面截图', {
                subdir: '_shared/经典首页-ELO排行榜',
                requireChineseName: true,
            }),
            fullPage: true,
        });
    });

    test('AI 仓库工作台已从首页工具入口下线，避免继续走旧主壳', async ({ page, game }, testInfo) => {
        await page.getByRole('button', { name: '工具' }).click();
        await expect(page.getByRole('heading', { name: '素材切片机' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'AI 仓库工作台' })).toHaveCount(0);
        await game.screenshot('ai-repo-workbench-home-entry-retired', testInfo);
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

        await expect(page.getByRole('heading', { name: '易桌游', level: 2 })).toBeVisible({ timeout: 10000 });
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

            await feedbackModal.locator('button').first().click();
            await expect(feedbackModal).toBeHidden({ timeout: 10000 });

            await expect(page.locator('[data-fab-id="feedback"]')).toBeVisible({ timeout: 10000 });
            await page.locator('[data-fab-id="feedback"]').click();
            await expect(feedbackModal).toBeVisible({ timeout: 10000 });
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
        const mobileProxy = page.getByTestId('mobile-text-entry-proxy').last();
        const mobileProxyInput = page.getByTestId('mobile-text-entry-proxy-input').last();

        await expect(getCreateRoomModal()).toBeVisible();
        await page.waitForTimeout(250);

        const beforeFocusMetrics = await getCreateRoomModal().evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });

        await getRoomNameInput().click();
        await applyKeyboardViewportSimulation(page, {
            runtimeViewportHeight: 564,
            keyboardInsetHeight: 280,
        });
        await expect(mobileProxy).toBeVisible();
        await expect(mobileProxyInput).toBeEditable();

        const proxyMetrics = await mobileProxyInput.evaluate((node) => {
            if (!(node instanceof HTMLInputElement)) {
                throw new Error('建房代理输入框节点不是 input');
            }
            const rect = node.getBoundingClientRect();
            const hitTarget = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return {
                bottom: rect.bottom,
                runtimeViewportHeight: Number.parseFloat(
                    window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0',
                ),
                isTopmost: hitTarget === node || node.contains(hitTarget),
            };
        });

        expect(proxyMetrics.isTopmost, '建房代理输入框输入时不应被弹窗盖住').toBe(true);
        expect(proxyMetrics.bottom, '建房代理输入框应留在键盘上方可视区').toBeLessThanOrEqual(proxyMetrics.runtimeViewportHeight);

        await mobileProxyInput.fill('移动端建房输入校验');
        await expect(getPasswordInput()).toBeVisible();
        await expect(getPasswordInput()).toHaveAttribute('type', 'password');
        await expect(getRoomNameInput()).toHaveValue('移动端建房输入校验');

        const layoutMetrics = await getCreateRoomModal().evaluate((element) => {
            const roomName = element.querySelector('[data-testid="create-room-name-input"]');
            const password = element.querySelector('[data-testid="create-room-password-input"]');
            const runtimeViewportHeight = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0');
            const modalRect = element.getBoundingClientRect();

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
        const afterFocusMetrics = await getCreateRoomModal().evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                centerY: rect.top + rect.height / 2,
            };
        });
        const modalTopDelta = Math.abs(afterFocusMetrics.top - beforeFocusMetrics.top);
        const modalCenterYDelta = Math.abs(afterFocusMetrics.centerY - beforeFocusMetrics.centerY);

        expect(layoutMetrics.modalTop, '建房弹窗聚焦输入后顶部不应被顶出屏幕').toBeGreaterThanOrEqual(0);
        expect(layoutMetrics.roomNameBottom, '房间名输入框应留在键盘上方可视区').toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(layoutMetrics.passwordBottom, '密码输入框应留在键盘上方可视区').toBeLessThanOrEqual(layoutMetrics.runtimeViewportHeight);
        expect(Math.min(...layoutMetrics.inputFontSizes), '移动端建房输入区至少应为 16px').toBeGreaterThanOrEqual(16);
        expect(modalTopDelta, '建房代理输入激活后弹窗顶部不应继续被键盘顶走').toBeLessThan(6);
        expect(modalCenterYDelta, '建房代理输入激活后弹窗整体位置应基本保持稳定').toBeLessThan(6);

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

        await roomCard.getByTestId(`room-list-join-${privateRoom.matchId}`).evaluate((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                throw new Error('私密房间加入按钮节点不是 button');
            }
            button.click();
        });

        const passwordModal = page.getByTestId('room-password-modal');
        const passwordInput = page.getByTestId('room-password-input');
        const passwordToggle = page.getByTestId('room-password-toggle');
        const confirmButton = page.getByTestId('room-password-confirm');

        await expect(passwordModal).toBeVisible();
        await expect(confirmButton).toBeVisible();
        await expect(confirmButton, '未输入密码时确认按钮应禁用').toBeDisabled();
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
        await page.waitForTimeout(120);
        await expect(page.getByTestId('mobile-text-entry-proxy')).toHaveCount(0);
        await expect(passwordInput).toBeEditable();

        // 输入密码（先保持默认 password 类型），确保“能输入”和“值确实写进去了”
        await passwordInput.fill(privateRoom.password);
        await expect(passwordInput).toHaveValue(privateRoom.password);
        // 切换显示密码，确保用户可以看到自己输入的内容（避免“看不到输入内容”的反馈）
        await expect(passwordToggle).toBeVisible();
        await passwordToggle.click();
        await expect(passwordInput).toHaveAttribute('type', 'text');
        await expect(confirmButton, '输入密码后确认按钮应可点击').toBeEnabled();

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

        await page.screenshot({
            path: 'test-results/evidence-screenshots/_shared/private-room-password-modal-mobile.png',
            fullPage: false,
            animations: 'disabled',
        });

        // 点击确认并真正加入对局，避免只验证“弹窗出现”而没有验证“加入链路可用”。
        await confirmButton.click();
        await expect(page).toHaveURL(new RegExp(`/play/tictactoe/match/${privateRoom.matchId}\\?playerID=`), { timeout: 15000 });
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
        await expect(page.getByRole('button', { name: /加入 AI/ })).toContainText('已开启');
        await expect(page.getByRole('button', { name: '普通' })).toHaveAttribute('aria-pressed', 'true');
        const manualFactionCheckbox = page.getByTestId('create-room-ai-manual-faction-checkbox');
        await expect(manualFactionCheckbox).not.toBeChecked();
        await manualFactionCheckbox.check();
        await expect(manualFactionCheckbox).toBeChecked();
        await expect(page.getByText('玩家选择 AI 派系')).toBeVisible();

        await game.screenshot('lobby-smashup-create-room-ai-config-manual-faction', testInfo);

        await page.getByRole('button', { name: '困难' }).click();
        await expect(page.getByRole('button', { name: '1 号位（房主）' })).toBeDisabled();
        await page.getByRole('button', { name: '3 号位' }).click();

        await game.screenshot('lobby-smashup-create-room-ai-config-hard-and-seats', testInfo);

        await confirmCreateRoomFromModal(page);

        await expect(page).toHaveURL(/\/play\/smashup\/match\//);

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
                seatControllers?: Record<string, { type?: string; difficulty?: string; manualFactionSelection?: boolean }>;
            };
        };

        expect(payload.setupData?.enableAi).toBe(true);
        expect(payload.setupData?.setupSelections?.expansions ?? []).toEqual([]);
        expect(payload.setupData?.seatControllers?.['1']?.type).toBe('local-ai');
        expect(payload.setupData?.seatControllers?.['2']?.type).toBe('local-ai');
        expect(payload.setupData?.seatControllers?.['1']?.difficulty).toBe('hard');
        expect(payload.setupData?.seatControllers?.['2']?.difficulty).toBe('hard');
        expect(payload.setupData?.seatControllers?.['1']?.manualFactionSelection).toBe(true);
        expect(payload.setupData?.seatControllers?.['2']?.manualFactionSelection).toBe(true);

        const storedPreferences = await page.evaluate(() => {
            const raw = localStorage.getItem('local_ai_match_preferences:smashup');
            return raw ? JSON.parse(raw) : null;
        });
        expect(storedPreferences).not.toBeNull();
        expect(storedPreferences?.numPlayers).toBe(3);
        expect(storedPreferences?.setupSelections?.expansions ?? []).toEqual([]);
        expect(storedPreferences?.seatControllers?.['1']?.type).toBe('human');
        expect(storedPreferences?.seatControllers?.['2']?.type).toBe('human');
        expect(storedPreferences?.seatControllers?.['1']?.manualFactionSelection).toBeUndefined();
        expect(storedPreferences?.seatControllers?.['2']?.manualFactionSelection).toBeUndefined();

        const aiSeatCredentials = await page.evaluate(() => {
            const key = Object.keys(localStorage).find((item) => item.startsWith('match_ai_creds_'));
            if (!key) return null;
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        });
        expect(aiSeatCredentials?.['1']).toBeTruthy();
        expect(aiSeatCredentials?.['2']).toBeTruthy();
    });

    test(ACTIVE_MATCH_FLOATING_BANNER_TEST_NAME, async ({ page, game }, testInfo) => {
        const matchId = await createTicTacToeRoom(page);
        const roomCode = matchId.slice(0, 4);

        await ensureLobbyReady(page);

        const banner = page.locator('[data-testid="home-active-match-banner"]:visible');
        const card = page.locator('[data-testid="home-active-match-card"]:visible');
        const actions = page.locator('[data-testid="home-active-match-actions"]:visible');

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

        const mobileViewport = page.viewportSize();
        const mobileCardBox = await card.boundingBox();
        expect(mobileCardBox).not.toBeNull();
        expect(mobileViewport).not.toBeNull();
        if (!mobileCardBox || !mobileViewport) {
            throw new Error('首页活跃房间浮层未正确渲染，无法校验移动端布局');
        }

        expect(mobileCardBox.x).toBeGreaterThanOrEqual(8);
        expect(mobileCardBox.x + mobileCardBox.width).toBeLessThanOrEqual(390 - 8);
        expect(Math.abs(mobileCardBox.x + mobileCardBox.width / 2 - mobileViewport.width / 2)).toBeLessThan(4);

        const mobileBannerPosition = await banner.evaluate(node => window.getComputedStyle(node).position);
        expect(mobileBannerPosition).toBe('fixed');

        const mobileBottomGap = mobileViewport.height - (mobileCardBox.y + mobileCardBox.height);
        expect(mobileBottomGap).toBeGreaterThanOrEqual(8);
        expect(mobileBottomGap).toBeLessThanOrEqual(24);

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
        await ensureLobbyReady(page);
        await page.getByRole('heading', { name: /井字棋|Tic-Tac-Toe/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        const sidebar = page.getByTestId('game-details-sidebar');
        const mobileAuthorButton = page.getByTestId('game-details-author-button-mobile');
        const leaderboardTabButton = page.getByTestId('game-details-tab-leaderboard');
        const closeButton = page.getByTestId('game-details-close-button');

        await expect(sidebar).toBeVisible({ timeout: 15000 });
        await expect(mobileAuthorButton).toBeVisible();
        await expect(leaderboardTabButton).toBeVisible();
        await expect(closeButton).toBeVisible();
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

        const leaderboardTabBox = await leaderboardTabButton.boundingBox();
        const closeButtonBox = await closeButton.boundingBox();
        expect(leaderboardTabBox).not.toBeNull();
        expect(closeButtonBox).not.toBeNull();

        if (!leaderboardTabBox || !closeButtonBox) {
            throw new Error('移动端详情弹窗 tab 或关闭按钮未正确渲染，无法校验窄屏头部布局');
        }

        expect(leaderboardTabBox.x + leaderboardTabBox.width).toBeLessThanOrEqual(closeButtonBox.x - 4);

        await game.screenshot('lobby-mobile-author-entry-right-top', testInfo);

        await mobileAuthorButton.click();
        await expect(page.getByTestId('game-details-author-modal')).toBeVisible();

        await game.screenshot('lobby-mobile-author-modal-open', testInfo);
    });

    test(MOBILE_PACKAGE_ENTRY_TEST_NAME, async ({ page, game }, testInfo) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await ensureLobbyReady(page);
        await page.getByRole('heading', { name: /井字棋|Tic-Tac-Toe/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        const modalRoot = getVisibleGameDetailsModal(page);
        const packageCard = page.getByTestId('game-details-mobile-package-card');
        const installButton = page.getByRole('button', { name: /Install Pack/i });
        const leaderboardTabButton = page.getByTestId('game-details-tab-leaderboard');
        const closeButton = page.getByTestId('game-details-close-button');

        await expect(modalRoot).toBeVisible({ timeout: 15000 });
        await expect(leaderboardTabButton).toBeVisible();
        await expect(closeButton).toBeVisible();
        await expect(packageCard).toHaveCount(0);
        await expect(installButton).toHaveCount(0);

        const modalBox = await modalRoot.boundingBox();
        expect(modalBox).not.toBeNull();

        if (!modalBox) {
            throw new Error('移动端详情弹窗未正确渲染，无法校验窄屏头部布局');
        }

        const leaderboardTabBox = await leaderboardTabButton.boundingBox();
        const closeButtonBox = await closeButton.boundingBox();
        expect(leaderboardTabBox).not.toBeNull();
        expect(closeButtonBox).not.toBeNull();

        if (!leaderboardTabBox || !closeButtonBox) {
            throw new Error('移动端包管理详情 tab 或关闭按钮未正确渲染，无法校验窄屏头部布局');
        }

        expect(leaderboardTabBox.x + leaderboardTabBox.width).toBeLessThanOrEqual(closeButtonBox.x - 4);

        await game.screenshot('lobby-mobile-web-package-entry-absent', testInfo);
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

    test('桌面端悬浮球面板与悬浮文本使用同一层级族', async ({ page }, testInfo) => {
        await setChineseLocale(page.context());
        await ensureLobbyReady(page);

        await page.locator('[data-fab-id="settings"]').click();
        const settingsPanel = page.getByTestId('fab-panel-settings');
        await expect(settingsPanel).toBeVisible({ timeout: 10000 });

        await page.locator('[data-fab-id="feedback"]').hover();
        const feedbackTooltip = page.getByTestId('fab-tooltip-feedback');
        await expect(feedbackTooltip).toBeVisible({ timeout: 10000 });

        const layerMetrics = await page.evaluate(() => {
            const panel = document.querySelector('[data-testid="fab-panel-settings"]') as HTMLElement | null;
            const tooltip = document.querySelector('[data-testid="fab-tooltip-feedback"]') as HTMLElement | null;
            const menu = document.querySelector('[data-testid="fab-menu"]') as HTMLElement | null;
            const resolveZIndex = (element: HTMLElement | null) => {
                let current: HTMLElement | null = element;
                while (current) {
                    const parsed = Number.parseInt(window.getComputedStyle(current).zIndex || '0', 10);
                    if (Number.isFinite(parsed)) return parsed;
                    current = current.parentElement;
                }
                return 0;
            };
            return {
                panelZIndex: resolveZIndex(panel),
                menuZIndex: resolveZIndex(menu),
                tooltipZIndex: resolveZIndex(tooltip),
            };
        });

        expect(layerMetrics.panelZIndex).toBeGreaterThan(0);
        expect(layerMetrics.menuZIndex).toBeGreaterThan(layerMetrics.panelZIndex);
        expect(layerMetrics.tooltipZIndex).toBeGreaterThan(layerMetrics.menuZIndex);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'fab-layer-tooltip-over-panel', {
                filename: 'fab-layer-tooltip-over-panel.png',
            }),
            fullPage: false,
        });
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
