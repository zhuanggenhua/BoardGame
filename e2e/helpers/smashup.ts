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
export async function waitForFactionDraft(page: Page, timeout = 60000) {
    console.log('[SmashUp] 开始等待派系选择界面...');
    
    // 等待派系选择界面的标题出现
    await page.waitForSelector('h1', { timeout });
    
    // 等待派系卡牌网格出现
    await page.waitForSelector('.grid > div', { timeout: 5000 });
    
    // 额外等待确保页面稳定
    await page.waitForTimeout(500);
    
    console.log('[SmashUp] ✅ 派系选择界面已就绪');
}

/** 通过 UI 选择派系（按索引） - 增强版，带重试 */
export async function selectFaction(page: Page, factionIndex: number, testInfo?: any) {
    console.log(`[SmashUp] 选择派系索引: ${factionIndex}`);
    
    // 1. 等待轮到该玩家（检查按钮文本）
    const confirmButton = page.getByTestId('faction-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
    
    // 等待按钮文本变为"确认选择"（而不是"Wait for your turn"）
    await page.waitForFunction(
        () => {
            const button = document.querySelector('[data-testid="faction-confirm-button"]');
            const text = button?.textContent || '';
            return !text.includes('Wait') && !text.includes('等待');
        },
        { timeout: 20000 }
    ).catch(async (e) => {
        console.log('[SmashUp] ⚠️  等待轮次超时，当前按钮状态：');
        const buttonText = await confirmButton.textContent();
        console.log(`[SmashUp]    按钮文本: ${buttonText}`);
        throw e;
    });
    
    console.log(`[SmashUp] ✅ 轮到该玩家，开始选择派系`);
    
    // 2. 点击派系卡牌
    const factionCards = page.locator('.grid > div').filter({ hasNot: page.locator('.opacity-40') });
    await factionCards.nth(factionIndex).click();
    console.log(`[SmashUp] ✅ 已点击派系卡牌 ${factionIndex}`);
    
    // 3. 等待按钮可点击（enabled）
    await expect(confirmButton).toBeEnabled({ timeout: 15000 });
    await page.waitForTimeout(300); // 等待动画稳定
    
    // 尝试点击，如果失败则重试
    let clicked = false;
    for (let i = 0; i < 3; i++) {
        try {
            // 截图调试
            if (testInfo && i === 0) {
                await page.screenshot({ path: testInfo.outputPath(`faction-${factionIndex}-before-confirm.png`) });
            }
            
            await confirmButton.click({ timeout: 3000 });
            clicked = true;
            console.log(`[SmashUp] ✅ 已确认选择派系 ${factionIndex}`);
            break;
        } catch (e) {
            console.log(`[SmashUp] ⚠️  点击失败，重试 ${i + 1}/3`);
            
            // 最后一次重试失败时截图
            if (testInfo && i === 2) {
                await page.screenshot({ path: testInfo.outputPath(`faction-${factionIndex}-confirm-failed.png`) });
            }
            
            await page.waitForTimeout(300);
        }
    }
    
    if (!clicked) {
        throw new Error(`无法点击确认按钮（派系 ${factionIndex}）`);
    }
    
    // 3. 等待弹窗关闭（减少等待时间）
    await page.waitForTimeout(500);
}

/** 确认派系选择（已废弃 - 现在在 selectFaction 中完成） */
export async function confirmFactionSelection(page: Page) {
    // 这个函数现在是空的，因为确认逻辑已经移到 selectFaction 中
    console.log('[SmashUp] confirmFactionSelection 已废弃，确认逻辑在 selectFaction 中完成');
}

/**
 * 完成派系选择流程（双人对局）- 蛇形选秀
 * 顺序：Host 选第1个 → Guest 选第1个 → Guest 选第2个 → Host 选第2个
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
    testInfo?: any,
) {
    console.log('[SmashUp] 开始派系选择流程（蛇形选秀）...');
    console.log('[SmashUp] Host 派系:', hostFactions);
    console.log('[SmashUp] Guest 派系:', guestFactions);
    
    // 等待双方都看到派系选择界面
    console.log('[SmashUp] 等待 Host 派系选择界面...');
    await waitForFactionDraft(hostPage);
    
    console.log('[SmashUp] 等待 Guest 派系选择界面...');
    await waitForFactionDraft(guestPage);

    // 蛇形选秀：P0 → P1 → P1 → P0
    console.log('[SmashUp] 第1轮：Host 选择第1个派系...');
    await selectFaction(hostPage, hostFactions[0], testInfo);
    await hostPage.waitForTimeout(1000); // 等待状态同步
    
    console.log('[SmashUp] 第2轮：Guest 选择第1个派系...');
    await selectFaction(guestPage, guestFactions[0], testInfo);
    await guestPage.waitForTimeout(1000); // 等待状态同步
    
    console.log('[SmashUp] 第3轮：Guest 选择第2个派系...');
    await selectFaction(guestPage, guestFactions[1], testInfo);
    await guestPage.waitForTimeout(1000); // 等待状态同步
    
    console.log('[SmashUp] 第4轮：Host 选择第2个派系...');
    await selectFaction(hostPage, hostFactions[1], testInfo);
    await hostPage.waitForTimeout(1000); // 等待状态同步
    
    console.log('[SmashUp] ✅ 派系选择流程完成');
}

/** 等待 SmashUp 棋盘 UI 就绪 */
export async function waitForSmashUpUI(page: Page, timeout = 30000) {
    console.log('[SmashUp] 等待游戏棋盘加载...');
    
    // 先等待派系选择界面消失
    try {
        await page.waitForSelector('h1:has-text("选择派系")', { state: 'hidden', timeout: 5000 });
        console.log('[SmashUp] ✅ 派系选择界面已关闭');
    } catch (e) {
        console.log('[SmashUp] ⚠️  派系选择界面可能已经关闭或未找到');
    }
    
    // 等待游戏棋盘元素出现（多个选择器，任意一个出现即可）
    try {
        await page.waitForSelector('[data-base-index], [data-testid="debug-panel"], .base-zone, [data-testid="player-hand"]', { timeout });
        console.log('[SmashUp] ✅ 游戏棋盘已加载');
    } catch (e) {
        console.error('[SmashUp] ❌ 游戏棋盘加载超时');
        // 输出当前页面状态用于调试
        const pageState = await page.evaluate(() => {
            return {
                url: window.location.href,
                title: document.title,
                bodyText: document.body?.innerText?.substring(0, 500),
                hasDebugPanel: !!document.querySelector('[data-testid="debug-panel"]'),
                hasBaseZone: !!document.querySelector('.base-zone'),
                hasPlayerHand: !!document.querySelector('[data-testid="player-hand"]'),
            };
        });
        console.error('[SmashUp] 页面状态:', JSON.stringify(pageState, null, 2));
        throw e;
    }
    
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
        testInfo?: any;
    }
): Promise<{
    hostPage: Page;
    guestPage: Page;
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    matchId: string;
} | null> {
    console.log('[SmashUp] 开始创建在线对局...');
    
    // 1. 创建 Host context 和页面
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, '__su_storage_reset');
    const hostPage = await hostContext.newPage();

    console.log('[SmashUp] Host 导航到首页...');
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
        console.error('[SmashUp] ❌ 游戏服务器不可用');
        return null;
    }

    // 2. 创建房间
    console.log('[SmashUp] 创建房间...');
    const matchId = await createSmashUpRoomViaAPI(hostPage);
    if (!matchId) {
        console.error('[SmashUp] ❌ 创建房间失败');
        return null;
    }
    console.log(`[SmashUp] ✅ 房间创建成功: ${matchId}`);

    if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId, 20000))) {
        console.error('[SmashUp] ❌ 房间不可用');
        return null;
    }

    // 3. Host 加入房间
    console.log('[SmashUp] Host 加入房间...');
    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    // 4. 创建 Guest context 和页面（并行）
    console.log('[SmashUp] 创建 Guest context...');
    const guestContext = await browser.newContext({ baseURL });
    await initContext(guestContext, '__su_storage_reset_g');
    const guestPage = await guestContext.newPage();

    console.log('[SmashUp] Guest 导航到首页...');
    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    await guestPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    // 5. Guest 加入房间
    console.log('[SmashUp] Guest 加入房间...');
    const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-SU-E2E');
    if (!guestCredentials) {
        console.error('[SmashUp] ❌ Guest 加入失败');
        await hostContext.close();
        await guestContext.close();
        return null;
    }
    await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
    
    console.log('[SmashUp] Guest 导航到对局页面...');
    await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    
    // 6. 等待双方都看到派系选择界面
    console.log('[SmashUp] 等待双方派系选择界面加载...');
    await Promise.all([
        waitForFactionDraft(hostPage),
        waitForFactionDraft(guestPage),
    ]);

    // 7. 完成派系选择（蛇形选秀）
    await completeFactionSelection(
        hostPage,
        guestPage,
        options?.hostFactions,
        options?.guestFactions,
        options?.testInfo
    );

    // 8. 等待游戏棋盘加载
    console.log('[SmashUp] 等待游戏棋盘加载...');
    await waitForSmashUpUI(hostPage);
    await waitForSmashUpUI(guestPage);

    console.log('[SmashUp] ✅ 对局设置完成');
    return { hostPage, guestPage, hostContext, guestContext, matchId };
}
