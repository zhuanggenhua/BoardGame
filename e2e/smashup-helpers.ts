/**
 * 大杀四方 (Smash Up) - E2E 测试共用工具函数
 *
 * 通用函数从 ./helpers/common 导入，本文件只保留 SmashUp 专用逻辑。
 */

import { expect, type BrowserContext, type Page } from '@playwright/test';
// 从通用 helpers re-export，保持现有调用方兼容
export {
    setEnglishLocale,
    disableTutorial,
    disableAudio,
    blockAudioRequests,
    resetMatchStorage,
    getGameServerBaseURL,
    ensureGameServerAvailable,
    dismissViteOverlay,
    waitForFrontendAssets,
    waitForHomeGameList,
    dismissLobbyConfirmIfNeeded,
    initContext,
} from './helpers/common';
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
} from './helpers/common';

const GAME_NAME = 'smashup';

// ============================================================================
// API 交互
// ============================================================================

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
    const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
    return data?.playerCredentials ?? null;
};

export const seedMatchCredentials = async (
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
                gameName: 'smashup',
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
    if (!(await heading.isVisible().catch(() => false))) {
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

    await createModal.getByRole('button', { name: /Confirm|确认/i }).evaluate((el) => (el as HTMLButtonElement).click());
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
    await expect(page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i })).toBeVisible({ timeout });
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
    await expect(cards.nth(index)).toBeVisible({ timeout: 5000 });
    await cards.nth(index).click();
};

export const clickBase = async (page: Page, index: number) => {
    const baseCards = page.locator('.group\\/base');
    const base = baseCards.nth(index);
    await expect(base).toBeVisible({ timeout: 5000 });
    await base.locator('> div').first().click();
};

export const clickFinishTurn = async (page: Page) => {
    const finishButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    await expect(finishButton).toBeVisible({ timeout: 10000 });
    await finishButton.click();
};

export const isDiscardOverlayVisible = async (page: Page) => {
    return page.getByText(/Too Many Cards|手牌过多/i).isVisible().catch(() => false);
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
    return page.getByTestId('me-first-overlay').isVisible().catch(() => false);
};

export const meFirstPass = async (page: Page) => {
    const passButton = page.getByTestId('me-first-pass-button');
    await expect(passButton).toBeVisible({ timeout: 10000 });
    await passButton.click();
};

export const isPromptVisible = async (page: Page) => {
    return page.locator('.fixed.inset-0.z-\\[100\\]').isVisible().catch(() => false);
};

export const selectFirstPromptOption = async (page: Page) => {
    const options = page.locator('.fixed.inset-0.z-\\[100\\] button:not([disabled])');
    await expect(options.first()).toBeVisible({ timeout: 10000 });
    await options.first().click();
};

export const waitForMyTurn = async (page: Page, timeout = 30000) => {
    const finishButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    await expect(finishButton).toBeVisible({ timeout });
    return finishButton;
};

export const waitForOpponentTurn = async (page: Page, timeout = 15000) => {
    const finishButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
    await expect(finishButton).toBeHidden({ timeout });
};

export const closeCardDetail = async (page: Page) => {
    const closeButton = page.locator('.fixed.inset-0.z-\\[100\\] button:has-text("X")');
    if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
    } else {
        await page.locator('.fixed.inset-0.z-\\[100\\].bg-black\\/80').click();
    }
};

export const handleAllOverlays = async (pages: Page[]) => {
    for (const page of pages) {
        if (await isDiscardOverlayVisible(page)) await performDiscard(page, 1);
        if (await isMeFirstVisible(page)) await meFirstPass(page);
        if (await isPromptVisible(page)) await selectFirstPromptOption(page);
    }
};

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
    if (await finishBtnAfter.isVisible().catch(() => false)) await clickFinishTurn(page);
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

export const createMatchViaAPI = async (page: Page, guestId: string): Promise<string | null> => {
    const gameServerBaseURL = getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games/smashup/create`;
    try {
        const response = await page.request.post(url, {
            data: { numPlayers: 2, setupData: { guestId } },
        });
        if (!response.ok()) return null;
        const data = (await response.json().catch(() => null)) as { matchID?: string } | null;
        return data?.matchID ?? null;
    } catch {
        return null;
    }
};

export const setupTwoPlayerMatch = async (
    browser: { newContext: (opts?: { baseURL?: string }) => Promise<BrowserContext> },
    baseURL: string | undefined,
    options?: { enableE2EDebug?: boolean },
): Promise<TwoPlayerSetup | null> => {
    const hostContext = await browser.newContext({ baseURL });
    
    // 如果启用 E2E 调试模式，注入标志
    if (options?.enableE2EDebug) {
        await hostContext.addInitScript(() => {
            (window as any).__BG_E2E_DEBUG__ = true;
        });
    }
    
    await initContext(hostContext, { storageKey: '__smashup_storage_reset' });
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) return null;

    const hostGuestId = `e2e_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const matchId = await createMatchViaAPI(hostPage, hostGuestId);
    if (!matchId) return null;

    const hostCredentials = await joinMatchViaAPI(hostPage, matchId, '0', `Host-${Date.now()}`, hostGuestId);
    if (!hostCredentials) return null;

    await seedMatchCredentials(hostContext, matchId, '0', hostCredentials);
    await hostPage.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(hostPage);

    const guestContext = await browser.newContext({ baseURL });
    
    // Guest context 也需要设置
    if (options?.enableE2EDebug) {
        await guestContext.addInitScript(() => {
            (window as any).__BG_E2E_DEBUG__ = true;
        });
    }
    
    await initContext(guestContext, { storageKey: '__smashup_storage_reset' });
    const guestPage = await guestContext.newPage();

    const guestGuestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const guestCredentials = await joinMatchViaAPI(hostPage, matchId, '1', `Guest-${Date.now()}`, guestGuestId);
    if (!guestCredentials) return null;

    await seedMatchCredentials(guestContext, matchId, '1', guestCredentials);
    await guestPage.goto(`/play/smashup/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    await waitForFactionSelection(guestPage);

    return { hostContext, guestContext, hostPage, guestPage, matchId };
};

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
