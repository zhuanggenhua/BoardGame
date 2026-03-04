/**
 * SmashUp E2E 测试 - 跳过派系选择直接进入游戏
 * 
 * 核心思想：
 * 1. 创建房间并加入
 * 2. 等待游戏加载（但不完成派系选择）
 * 3. 使用调试面板直接注入完整的游戏状态
 * 4. 开始测试
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
 * 创建 SmashUp 房间并跳过派系选择
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
    await initContext(hostContext, '__su_storage_reset');
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
    await initContext(guestContext, '__su_storage_reset_g');
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
    await hostPage.waitForSelector('h1:has-text("Draft Your Factions"), h1:has-text("选择派系")', { timeout: 30000 });
    await guestPage.waitForSelector('h1:has-text("Draft Your Factions"), h1:has-text("选择派系")', { timeout: 30000 });

    console.log('[SmashUp] ✅ 派系选择界面已加载，准备跳过派系选择');

    // 9. 使用调试面板注入完整的游戏状态（跳过派系选择）
    await injectGameState(hostPage);
    await injectGameState(guestPage);

    console.log('[SmashUp] ✅ 游戏状态已注入，跳过派系选择完成');

    // 10. 等待游戏棋盘加载
    await hostPage.waitForSelector('[data-base-index="0"], [data-testid="debug-panel"], .smashup-board', { timeout: 30000 });
    await guestPage.waitForSelector('[data-base-index="0"], [data-testid="debug-panel"], .smashup-board', { timeout: 30000 });

    return { hostPage, guestPage, hostContext, guestContext, matchId };
}

/**
 * 注入完整的游戏状态（跳过派系选择）
 * 
 * @param page Playwright Page 对象
 */
async function injectGameState(page: Page): Promise<void> {
    // 等待测试工具就绪
    await page.waitForFunction(
        () => !!(window as any).__BG_TEST_HARNESS__,
        { timeout: 10000 }
    );

    // 注入一个最小的游戏状态
    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness) throw new Error('TestHarness not available');

        // 构造一个最小的游戏状态
        const minimalState = {
            core: {
                currentPlayer: '0',
                phase: 'play',
                turn: 1,
                players: {
                    '0': {
                        hand: [],
                        deck: [],
                        discard: [],
                        factions: ['wizards', 'pirates'], // 假设选择了这两个派系
                    },
                    '1': {
                        hand: [],
                        deck: [],
                        discard: [],
                        factions: ['aliens', 'robots'], // 假设选择了这两个派系
                    },
                },
                bases: [
                    { index: 0, defId: 'base_001', breakpoint: 20, minions: [], ongoings: [] },
                    { index: 1, defId: 'base_002', breakpoint: 18, minions: [], ongoings: [] },
                    { index: 2, defId: 'base_003', breakpoint: 22, minions: [], ongoings: [] },
                ],
            },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
        };

        // 注入状态
        harness.state.patch(minimalState);
    });

    // 等待状态更新
    await page.waitForTimeout(1000);
}
