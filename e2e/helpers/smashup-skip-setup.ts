/**
 * SmashUp E2E 测试 - 在线房间预设到派系选择阶段
 *
 * 核心思想：
 * 1. 创建在线房间并让双方加入
 * 2. 停在派系选择界面，不走真实选秀流程
 * 3. 由调用方通过服务端 `/test/inject-state` 注入权威状态
 * 4. 页面通过在线同步进入目标场景
 */

import type { Page, Browser, BrowserContext } from '@playwright/test';
import {
    initContext,
    getGameServerBaseURL,
    ensureGameServerAvailable,
    waitForMatchAvailable,
    seedMatchCredentials,
    joinMatchViaAPI,
} from './common';

export const GAME_NAME = 'smashup';

/**
 * 创建 SmashUp 在线房间，并停在派系选择界面等待后续服务端注入
 * 
 * @param browser Browser 实例
 * @param baseURL 基础 URL
 * @returns 对局信息或 null（失败时）
 */
export async function setupSmashUpMatchSkipSetup(
    browser: Browser,
    baseURL: string | undefined,
): Promise<{
    hostPage: Page;
    guestPage: Page;
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    matchId: string;
} | null> {
    // 1. 创建 Host 上下文
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__su_storage_reset', skipImageGate: true });
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
        return null;
    }

    // 2. 创建房间
    const guestId = `su_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await hostPage.addInitScript(
        (id) => {
            localStorage.setItem('guest_id', id);
            sessionStorage.setItem('guest_id', id);
            document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
        },
        guestId,
    );

    const base = getGameServerBaseURL();
    const res = await hostPage.request.post(`${base}/games/${GAME_NAME}/create`, {
        data: { numPlayers: 2, setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' } },
    });
    if (!res.ok()) return null;
    const resData = (await res.json().catch(() => null)) as { matchID?: string } | null;
    const matchId = resData?.matchID;
    if (!matchId) return null;

    // 3. Host 占座
    const claimRes = await hostPage.request.post(`${base}/games/${GAME_NAME}/${matchId}/claim-seat`, {
        data: { playerID: '0', playerName: 'Host-SU-E2E', guestId },
    });
    if (!claimRes.ok()) return null;
    const claimData = (await claimRes.json().catch(() => null)) as { playerCredentials?: string } | null;
    const credentials = claimData?.playerCredentials;
    if (!credentials) return null;

    await seedMatchCredentials(hostPage, GAME_NAME, matchId, '0', credentials);

    // 4. 等待房间可用
    if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId, 20000))) {
        return null;
    }

    // 5. Host 进入房间
    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    // 6. 创建 Guest 上下文
    const guestContext = await browser.newContext({ baseURL });
    await initContext(guestContext, { storageKey: '__su_storage_reset_g', skipImageGate: true });
    const guestPage = await guestContext.newPage();

    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    await guestPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    // 7. Guest 加入房间
    const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-SU-E2E');
    if (!guestCredentials) {
        await hostContext.close();
        await guestContext.close();
        return null;
    }
    await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
    await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

    // 8. 等待派系选择界面加载（但不选择派系）
    const factionDraftHeading = 'h1:has-text("Draft Your Factions"), h1:has-text("选择你的派系"), h1:has-text("选择派系")';
    await hostPage.waitForSelector(factionDraftHeading, { timeout: 30000 });
    await guestPage.waitForSelector(factionDraftHeading, { timeout: 30000 });

    console.log('[SmashUp] ✅ 双方已进入派系选择界面，等待服务端状态注入');
    return { hostPage, guestPage, hostContext, guestContext, matchId };
}
