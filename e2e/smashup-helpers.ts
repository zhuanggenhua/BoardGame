/**
 * 大杀四方 (Smash Up) - E2E 测试共用工具函数
 *
 * 消除 smashup-gameplay.e2e.ts 和 smashup-cthulhu.e2e.ts 之间的重复代码。
 */

import { expect, type BrowserContext, type Page } from '@playwright/test';

// ============================================================================
// 浏览器上下文初始化
// ============================================================================

export const setEnglishLocale = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
};

export const disableTutorial = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('tutorial_skip', '1');
    });
};

export const disableAudio = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('audio_muted', 'true');
        localStorage.setItem('audio_master_volume', '0');
        localStorage.setItem('audio_sfx_volume', '0');
        localStorage.setItem('audio_bgm_volume', '0');
        (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
    });
};

export const blockAudioRequests = async (context: BrowserContext) => {
    await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

export const resetMatchStorage = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        if (sessionStorage.getItem('__smashup_storage_reset')) return;
        sessionStorage.setItem('__smashup_storage_reset', '1');
        const newGuestId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        localStorage.removeItem('owner_active_match');
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('match_creds_')) localStorage.removeItem(key);
        });
        localStorage.setItem('guest_id', newGuestId);
        try { sessionStorage.setItem('guest_id', newGuestId); } catch { /* ignore */ }
        document.cookie = `bg_guest_id=${encodeURIComponent(newGuestId)}; path=/; SameSite=Lax`;
    });
};

// ============================================================================
// 服务器与 API
// ============================================================================

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

export const getGameServerBaseURL = () => {
    const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
    return `http://localhost:${port}`;
};

export const ensureGameServerAvailable = async (page: Page) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games`;
    try {
        const response = await page.request.get(url, { timeout: 5000 });
        return response.ok();
    } catch {
        // page.request 可能在空白页失败，尝试 evaluate fetch
        try {
            const ok = await page.evaluate(async (fetchUrl) => {
                try {
                    const r = await fetch(fetchUrl);
                    return r.ok;
                } catch { return false; }
            }, url);
            return ok;
        } catch {
            return false;
        }
    }
};

export const joinMatchViaAPI = async (
    page: Page,
    matchId: string,
    playerId: string,
    playerName: string,
    guestId?: string,
) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games/smashup/${matchId}/join`;
    const response = await page.request.post(url, {
        data: {
            playerID: playerId,
            playerName,
            ...(guestId ? { data: { guestId } } : {}),
        },
    });
    if (!response.ok()) return null;
    const data = await response.json().catch(() => null) as { playerCredentials?: string } | null;
    return data?.playerCredentials ?? null;
};

export const seedMatchCredentials = async (context: BrowserContext, matchId: string, playerId: string, credentials: string) => {
    await context.addInitScript(({ matchId, playerId, credentials }) => {
        const payload = {
            matchID: matchId,
            playerID: playerId,
            credentials,
            gameName: 'smashup',
            updatedAt: Date.now(),
        };
        localStorage.setItem(`match_creds_${matchId}`, JSON.stringify(payload));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { matchId, playerId, credentials });
};

// ============================================================================
// 页面导航与 UI 辅助
// ============================================================================

export const waitForHomeGameList = async (page: Page, timeoutMs = 30000) => {
    await page.waitForLoadState('domcontentloaded');
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            await page.waitForSelector('[data-game-id]', { timeout: 5000, state: 'attached' });
            return;
        } catch { await page.waitForTimeout(1000); }
    }
    throw new Error('等待游戏列表超时');
};

export const dismissViteOverlay = async (page: Page) => {
    await page.evaluate(() => {
        const overlay = document.querySelector('vite-error-overlay');
        if (overlay) overlay.remove();
    });
};

export const dismissLobbyConfirmIfNeeded = async (page: Page) => {
    const confirmButton = page
        .locator('button:has-text("确认")')
        .or(page.locator('button:has-text("Confirm")'));
    if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
    }
};

// ============================================================================
// 游戏交互
// ============================================================================

export const openSmashUpModal = async (page: Page) => {
    await page.goto('/?game=smashup', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(page);
    await dismissLobbyConfirmIfNeeded(page);
    await waitForHomeGameList(page);

    const returnToMatchButton = page.locator('button', { hasText: /Return to match|返回对局/i }).first();
    if (await returnToMatchButton.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    }

    const modalRoot = page.locator('#modal-root');
    const heading = modalRoot.getByRole('heading', { name: /Smash Up|大杀四方/i });
    if (!await heading.isVisible().catch(() => false)) {
        const gameCard = page.locator('[data-game-id="smashup"]').first();
        await gameCard.scrollIntoViewIfNeeded();
        await gameCard.evaluate((node) => (node as HTMLElement | null)?.click());
    }
    await expect(heading).toBeVisible({ timeout: 15000 });
    return heading;
};

export const createRoom = async (page: Page): Promise<string | null> => {
    try {
        await openSmashUpModal(page);
    } catch {
        return null;
    }

    await page.getByRole('button', { name: /Create Room|创建房间/i }).click();
    const createHeading = page.getByRole('heading', { name: /Create Room|创建房间/i });
    await expect(createHeading).toBeVisible({ timeout: 10000 });
    const createModal = createHeading.locator('..').locator('..');

    const twoPlayersButton = createModal.getByRole('button', { name: /2\s*players|2\s*人/i });
    await expect(twoPlayersButton).toBeVisible({ timeout: 5000 });
    await twoPlayersButton.click();

    await createModal.getByRole('button', { name: /Confirm|确认/i }).evaluate(
        (el) => (el as HTMLButtonElement).click(),
    );
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    try {
        await page.waitForURL(/\/play\/smashup\/match\//, { timeout: 15000 });
    } catch {
        return null;
    }

    const hostUrl = new URL(page.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) return null;

    if (!hostUrl.searchParams.get('playerID')) {
        hostUrl.searchParams.set('playerID', '0');
        await page.goto(hostUrl.toString());
    }

    return matchId;
};

export const waitForFactionSelection = async (page: Page, timeout = 20000) => {
    await expect(
        page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i }),
    ).toBeVisible({ timeout });
};

export const openFactionCard = async (page: Page, index: number) => {
    const card = page.locator('.grid > div').nth(index);
    await expect(card).toBeVisible({ timeout: 8000 });
    await card.click();
};

export const confirmFactionSelection = async (page: Page) => {
    const confirmButton = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
    await expect(confirmButton).toBeVisible({ timeout: 8000 });
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();
    await page.waitForTimeout(1000);
};

export const selectFactionByIndex = async (page: Page, index: number) => {
    await openFactionCard(page, index);
    await confirmFactionSelection(page);
};

export const waitForHandArea = async (page: Page, timeout = 30000) => {
    const handArea = page.getByTestId('su-hand-area');
    await expect(handArea).toBeVisible({ timeout });
    return handArea;
};

export const clickHandCard = async (page: Page, index: number) => {
    const handArea = page.getByTestId('su-hand-area');
    const cards = handArea.locator('> div > div');
    const card = cards.nth(index);
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();
};

export const clickBase = async (page: Page, index: number) => {
    const baseCards = page.locator('.group\\/base');
    const base = baseCards.nth(index);
    await expect(base).toBeVisible({ timeout: 5000 });
    const baseCard = base.locator('> div').first();
    await baseCard.click();
};

export const clickFinishTurn = async (page: Page) => {
    const finishButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    await expect(finishButton).toBeVisible({ timeout: 10000 });
    await finishButton.click();
};

export const isDiscardOverlayVisible = async (page: Page) => {
    const discardHeading = page.getByText(/Too Many Cards|手牌过多/i);
    return discardHeading.isVisible().catch(() => false);
};

export const performDiscard = async (page: Page, count: number) => {
    const discardHeading = page.getByText(/Too Many Cards|手牌过多/i);
    await expect(discardHeading).toBeVisible({ timeout: 10000 });
    const handArea = page.getByTestId('su-hand-area');
    const cards = handArea.locator('> div > div');
    for (let i = 0; i < count; i++) {
        await cards.nth(i).click();
        await page.waitForTimeout(200);
    }
    const throwButton = page.getByRole('button', { name: /Throw Away|丢弃并继续/i });
    await expect(throwButton).toBeEnabled({ timeout: 5000 });
    await throwButton.click();
    await expect(discardHeading).toBeHidden({ timeout: 10000 });
};

export const isMeFirstVisible = async (page: Page) => {
    const overlay = page.getByTestId('me-first-overlay');
    return overlay.isVisible().catch(() => false);
};

export const meFirstPass = async (page: Page) => {
    const passButton = page.getByTestId('me-first-pass-button');
    await expect(passButton).toBeVisible({ timeout: 10000 });
    await passButton.click();
};

export const isPromptVisible = async (page: Page) => {
    const promptOverlay = page.locator('.fixed.inset-0.z-\\[100\\]');
    return promptOverlay.isVisible().catch(() => false);
};

export const selectFirstPromptOption = async (page: Page) => {
    const options = page.locator('.fixed.inset-0.z-\\[100\\] button:not([disabled])');
    const firstOption = options.first();
    await expect(firstOption).toBeVisible({ timeout: 10000 });
    await firstOption.click();
};

/** 等待轮到指定页面的玩家（Finish Turn 按钮出现） */
export const waitForMyTurn = async (page: Page, timeout = 30000) => {
    const finishButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    await expect(finishButton).toBeVisible({ timeout });
    return finishButton;
};

/** 等待对手回合（Finish Turn 按钮消失） */
export const waitForOpponentTurn = async (page: Page, timeout = 15000) => {
    const finishButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    await expect(finishButton).toBeHidden({ timeout });
};

/** 关闭卡牌详情预览 */
export const closeCardDetail = async (page: Page) => {
    const closeButton = page.locator('.fixed.inset-0.z-\\[100\\] button:has-text("X")');
    if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
    } else {
        await page.locator('.fixed.inset-0.z-\\[100\\].bg-black\\/80').click();
    }
};

/** 处理所有可能出现的覆盖层（弃牌/Me First/Prompt） */
export const handleAllOverlays = async (pages: Page[]) => {
    for (const page of pages) {
        if (await isDiscardOverlayVisible(page)) await performDiscard(page, 1);
        if (await isMeFirstVisible(page)) await meFirstPass(page);
        if (await isPromptVisible(page)) await selectFirstPromptOption(page);
    }
};

/** 执行一个玩家的回合：出牌 → 处理 Prompt → 结束回合 */
export const playTurnIfActive = async (page: Page) => {
    const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    const isTurn = await finishBtn.isVisible().catch(() => false);
    if (!isTurn) return false;

    await clickHandCard(page, 0);
    await page.waitForTimeout(300);
    await clickBase(page, 0);
    await page.waitForTimeout(500);

    if (await isPromptVisible(page)) {
        await selectFirstPromptOption(page);
        await page.waitForTimeout(300);
    }

    const finishBtnAfter = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    if (await finishBtnAfter.isVisible().catch(() => false)) {
        await clickFinishTurn(page);
    }
    await page.waitForTimeout(1500);
    return true;
};

// ============================================================================
// 双人上下文管理
// ============================================================================

export interface TwoPlayerSetup {
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    hostPage: Page;
    guestPage: Page;
    matchId: string;
}

/** 通过 API 创建 smashup 对局（跳过 UI 创建房间流程） */
export const createMatchViaAPI = async (page: Page, guestId: string): Promise<string | null> => {
    const gameServerBaseURL = getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games/smashup/create`;
    try {
        const response = await page.request.post(url, {
            data: { numPlayers: 2, setupData: { guestId } },
        });
        if (!response.ok()) return null;
        const data = await response.json().catch(() => null) as { matchID?: string } | null;
        return data?.matchID ?? null;
    } catch {
        return null;
    }
};

export const setupTwoPlayerMatch = async (
    browser: any,
    baseURL: string | undefined,
): Promise<TwoPlayerSetup | null> => {
    // 房主上下文
    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await setEnglishLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableTutorial(hostContext);
    await disableAudio(hostContext);
    const hostPage = await hostContext.newPage();

    // 纯 API 创建房间（跳过 UI 流程）
    // 先导航到前端首页，确保 page context 可用
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    
    if (!await ensureGameServerAvailable(hostPage)) {
        console.error('[setupTwoPlayerMatch] 游戏服务器不可用');
        return null;
    }

    // 房主 join（需要传 create 时的 guestId）
    const hostGuestId = `e2e_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const matchId = await createMatchViaAPI(hostPage, hostGuestId);
    if (!matchId) return null;

    const hostCredentials = await joinMatchViaAPI(hostPage, matchId, '0', `Host-${Date.now()}`, hostGuestId);
    if (!hostCredentials) return null;

    await seedMatchCredentials(hostContext, matchId, '0', hostCredentials);
    await hostPage.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);

    // 客人上下文
    const guestContext = await browser.newContext({ baseURL });
    await blockAudioRequests(guestContext);
    await setEnglishLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableTutorial(guestContext);
    await disableAudio(guestContext);
    const guestPage = await guestContext.newPage();

    const guestGuestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const guestCredentials = await joinMatchViaAPI(hostPage, matchId, '1', `Guest-${Date.now()}`, guestGuestId);
    if (!guestCredentials) return null;

    await seedMatchCredentials(guestContext, matchId, '1', guestCredentials);
    await guestPage.goto(`/play/smashup/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(guestPage);

    return { hostContext, guestContext, hostPage, guestPage, matchId };
};

/**
 * 完成派系选择（蛇形选秀：P0→P1→P1→P0）
 * 支持自定义派系索引
 */
export const completeFactionSelectionCustom = async (
    hostPage: Page,
    guestPage: Page,
    p0Factions: [number, number],
    p1Factions: [number, number],
) => {
    await selectFactionByIndex(hostPage, p0Factions[0]);
    await selectFactionByIndex(guestPage, p1Factions[0]);
    await selectFactionByIndex(guestPage, p1Factions[1]);
    await selectFactionByIndex(hostPage, p0Factions[1]);
};

/** 默认派系选择（P0: 0+3, P1: 1+2） */
export const completeFactionSelection = async (hostPage: Page, guestPage: Page) => {
    await completeFactionSelectionCustom(hostPage, guestPage, [0, 3], [1, 2]);
};

export const cleanupTwoPlayerMatch = async (setup: TwoPlayerSetup) => {
    await setup.guestContext.close();
    await setup.hostContext.close();
};

/** 派系索引常量 */
export const FACTION = {
    PIRATES: 0,
    NINJAS: 1,
    DINOSAURS: 2,
    ALIENS: 3,
    ROBOTS: 4,
    ZOMBIES: 5,
    WIZARDS: 6,
    TRICKSTERS: 7,
    STEAMPUNKS: 8,
    GHOSTS: 9,
    PLANTS: 10,
    BEAR_CAVALRY: 11,
    CTHULHU: 12,
    ELDER_THINGS: 13,
    INNSMOUTH: 14,
    MISKATONIC: 15,
} as const;
