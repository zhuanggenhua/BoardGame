/**
 * SmashUp E2E 测试辅助函数
 */

import type { Page, Browser, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';
import {
    initContext,
    getGameServerBaseURL,
    ensureGameServerAvailable,
    waitForMatchAvailable,
    seedMatchCredentials,
    joinMatchViaAPI,
} from './common';

export const GAME_NAME = 'smashup';

// ============================================================================
// 房间创建与加入
// ============================================================================

/** 通过 API 创建 SmashUp 房间并注入凭据 */
export async function createSmashUpRoomViaAPI(page: Page): Promise<string | null> {
    try {
        const guestId = `su_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await page.addInitScript(
            (id) => {
                localStorage.setItem('guest_id', id);
                sessionStorage.setItem('guest_id', id);
                document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
            },
            guestId,
        );

        const base = getGameServerBaseURL();
        const res = await page.request.post(`${base}/games/${GAME_NAME}/create`, {
            data: { numPlayers: 2, setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' } },
        });
        if (!res.ok()) return null;
        const resData = (await res.json().catch(() => null)) as { matchID?: string } | null;
        const matchID = resData?.matchID;
        if (!matchID) return null;

        const claimRes = await page.request.post(`${base}/games/${GAME_NAME}/${matchID}/claim-seat`, {
            data: { playerID: '0', playerName: 'Host-SU-E2E', guestId },
        });
        if (!claimRes.ok()) return null;
        const claimData = (await claimRes.json().catch(() => null)) as { playerCredentials?: string } | null;
        const credentials = claimData?.playerCredentials;
        if (!credentials) return null;

        await seedMatchCredentials(page, GAME_NAME, matchID, '0', credentials);
        return matchID;
    } catch {
        return null;
    }
}

// ============================================================================
// UI 等待与交互
// ============================================================================

/** 等待派系选择界面出现 */
export async function waitForFactionDraft(page: Page, timeout = 30000) {
    await page.waitForSelector('h1:has-text("Draft Your Factions"), [data-testid="faction-draft"]', { timeout });
}

/** 通过 UI 选择派系（按索引） */
export async function selectFaction(page: Page, factionIndex: number) {
    const factionCards = page.locator('.grid > div');
    await factionCards.nth(factionIndex).click({ force: true });
    await page.waitForTimeout(500);
}

/** 确认派系选择 */
export async function confirmFactionSelection(page: Page) {
    await page.click('button:has-text("Confirm"), button:has-text("确认")', { force: true });
    await page.waitForTimeout(1000);
}

/**
 * 完成派系选择流程（双人对局）
 * @param hostPage Host 页面
 * @param guestPage Guest 页面
 * @param hostFactions Host 选择的派系索引数组（默认 [0, 1]）
 * @param guestFactions Guest 选择的派系索引数组（默认 [2, 3]）
 */
export async function completeFactionSelection(
    hostPage: Page,
    guestPage: Page,
    hostFactions: [number, number] = [0, 1],
    guestFactions: [number, number] = [2, 3],
) {
    // 等待双方都看到派系选择界面
    await waitForFactionDraft(hostPage);
    await waitForFactionDraft(guestPage);

    // Host 选择两个派系
    await selectFaction(hostPage, hostFactions[0]);
    await selectFaction(hostPage, hostFactions[1]);
    await confirmFactionSelection(hostPage);

    // Guest 选择两个派系
    await selectFaction(guestPage, guestFactions[0]);
    await selectFaction(guestPage, guestFactions[1]);
    await confirmFactionSelection(guestPage);
}

/** 等待 SmashUp 棋盘 UI 就绪 */
export async function waitForSmashUpUI(page: Page, timeout = 30000) {
    // 等待游戏棋盘加载（SmashUp 使用 GameDebugPanel，会有 debug-panel 元素）
    // 或者等待基地区域出现（更可靠的指标）
    await page.waitForSelector('[data-base-index="0"], [data-testid="debug-panel"], .smashup-board', { timeout });
    await page.waitForTimeout(500);
}

// ============================================================================
// 调试面板操作
// ============================================================================

/** 打开调试面板并切换到状态 Tab */
export async function ensureDebugStateTab(page: Page) {
    const panel = page.getByTestId('debug-panel');
    if (!await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeVisible({ timeout: 5000 });
    }
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
}

/** 读取当前 core 状态 */
export async function readCoreState(page: Page) {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.core ?? parsed?.G?.core ?? parsed;
}

/** 写入 core 状态 */
export async function applyCoreState(page: Page, coreState: unknown) {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
}

// ============================================================================
// 完整对局设置
// ============================================================================

/**
 * 创建 SmashUp 在线双人对局（包含派系选择）
 * @returns 对局信息或 null（失败时）
 */
export async function setupSmashUpOnlineMatch(
    browser: Browser,
    baseURL: string | undefined,
    options?: {
        hostFactions?: [number, number];
        guestFactions?: [number, number];
    }
): Promise<{
    hostPage: Page;
    guestPage: Page;
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    matchId: string;
} | null> {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, '__su_storage_reset');
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
        return null;
    }

    const matchId = await createSmashUpRoomViaAPI(hostPage);
    if (!matchId) {
        return null;
    }

    if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId, 20000))) {
        return null;
    }

    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    const guestContext = await browser.newContext({ baseURL });
    await initContext(guestContext, '__su_storage_reset_g');
    const guestPage = await guestContext.newPage();

    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    await guestPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-SU-E2E');
    if (!guestCredentials) {
        await hostContext.close();
        await guestContext.close();
        return null;
    }
    await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
    await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

    // 完成派系选择
    await completeFactionSelection(
        hostPage,
        guestPage,
        options?.hostFactions,
        options?.guestFactions
    );

    // 等待游戏棋盘加载
    await waitForSmashUpUI(hostPage);
    await waitForSmashUpUI(guestPage);

    return { hostPage, guestPage, hostContext, guestContext, matchId };
}
