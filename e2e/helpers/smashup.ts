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
    
    // 先检查页面 URL
    const url = page.url();
    console.log('[SmashUp] 当前页面 URL:', url);
    
    // 检查页面内容
    const pageContent = await page.evaluate(() => {
        const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent);
        const testIds = Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
        return { h1s, testIds, bodyText: document.body.innerText.substring(0, 500) };
    });
    console.log('[SmashUp] 页面内容:', JSON.stringify(pageContent, null, 2));
    
    // 等待派系选择界面的任一标识元素
    try {
        await Promise.race([
            page.waitForSelector('h1:has-text("Draft Your Factions")', { timeout }),
            page.waitForSelector('h1:has-text("选择派系")', { timeout }),
            page.waitForSelector('[data-testid="faction-draft"]', { timeout }),
        ]);
        console.log('[SmashUp] ✅ 派系选择界面已找到');
    } catch (error) {
        console.error('[SmashUp] ❌ 等待派系选择界面超时');
        console.error('[SmashUp] 错误详情:', error);
        
        // 截图保存当前页面状态
        await page.screenshot({ path: 'test-results/faction-draft-timeout.png', fullPage: true });
        console.log('[SmashUp] 已保存截图: test-results/faction-draft-timeout.png');
        
        throw error;
    }
}

/** 通过 UI 选择派系（按索引） - 增强版，带重试 */
export async function selectFaction(page: Page, factionIndex: number) {
    console.log(`[SmashUp] 选择派系索引: ${factionIndex}`);
    
    // 1. 点击派系卡牌
    const factionCards = page.locator('.grid > div').filter({ hasNot: page.locator('.opacity-40') });
    await factionCards.nth(factionIndex).click();
    console.log(`[SmashUp] ✅ 已点击派系卡牌 ${factionIndex}`);
    
    // 2. 等待并点击确认按钮（带重试）
    const confirmButton = page.getByTestId('faction-confirm-button');
    
    // 等待按钮出现并可点击
    await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500); // 等待动画稳定
    
    // 尝试点击，如果失败则重试
    let clicked = false;
    for (let i = 0; i < 3; i++) {
        try {
            await confirmButton.click({ timeout: 3000 });
            clicked = true;
            console.log(`[SmashUp] ✅ 已确认选择派系 ${factionIndex}`);
            break;
        } catch (e) {
            console.log(`[SmashUp] ⚠️  点击失败，重试 ${i + 1}/3`);
            await page.waitForTimeout(500);
        }
    }
    
    if (!clicked) {
        throw new Error(`无法点击确认按钮（派系 ${factionIndex}）`);
    }
    
    // 3. 等待弹窗关闭
    await page.waitForTimeout(1000);
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
    await selectFaction(hostPage, hostFactions[0]);
    
    console.log('[SmashUp] 第2轮：Guest 选择第1个派系...');
    await selectFaction(guestPage, guestFactions[0]);
    
    console.log('[SmashUp] 第3轮：Guest 选择第2个派系...');
    await selectFaction(guestPage, guestFactions[1]);
    
    console.log('[SmashUp] 第4轮：Host 选择第2个派系...');
    await selectFaction(hostPage, hostFactions[1]);
    
    console.log('[SmashUp] ✅ 派系选择流程完成');
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
    
    // 等待 Host 完成第一次派系选择后再让 Guest 加入
    // 这样可以确保游戏客户端已经正确初始化
    console.log('[SmashUp] 等待 Host 完成第一次派系选择...');
    await waitForFactionDraft(hostPage);
    await selectFaction(hostPage, options?.hostFactions?.[0] ?? 0);
    
    console.log('[SmashUp] Guest 导航到对局页面...');
    await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    
    // 等待页面加载完成
    console.log('[SmashUp] 等待 Guest 页面加载...');
    await guestPage.waitForTimeout(2000); // 给页面一些时间渲染
    
    // 检查页面是否真的加载了
    const guestPageLoaded = await guestPage.evaluate(() => {
        return {
            hasBody: !!document.body,
            bodyText: document.body?.innerText?.substring(0, 200),
            h1Count: document.querySelectorAll('h1').length,
        };
    });
    console.log('[SmashUp] Guest 页面加载状态:', JSON.stringify(guestPageLoaded, null, 2));

    // 完成派系选择（waitForFactionDraft 内部会等待派系选择界面加载）
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
