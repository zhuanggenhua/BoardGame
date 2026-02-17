/**
 * 大杀四方 - 调试面板 E2E 工具函数
 *
 * 提取自 smashup-zombie-lord.e2e.ts 和 smashup-discard-play.e2e.ts，
 * 供所有需要状态注入的 SmashUp E2E 测试复用。
 */

import { expect, type Page, type Browser, type BrowserContext } from '@playwright/test';
import {
    dismissViteOverlay,
    ensureGameServerAvailable,
    waitForMatchAvailable,
    joinMatchViaAPI,
    seedMatchCredentials,
    getGameServerBaseURL,
} from './helpers/common';

// ============================================================================
// 调试面板操作
// ============================================================================

export const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    const toggle = page.getByTestId('debug-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await toggle.click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

export const closeDebugPanel = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeHidden({ timeout: 5000 });
    }
};

/** 读取完整 G 状态 */
export const readFullState = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) await stateTab.click();
    const raw = await page.getByTestId('debug-state-json').innerText();
    return JSON.parse(raw);
};

/** 通过调试面板注入 core 状态 */
export const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) await stateTab.click();

    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    const input = page.getByTestId('debug-state-input');
    if (!await input.isVisible().catch(() => false)) {
        await expect(toggleBtn).toBeVisible({ timeout: 3000 });
        await toggleBtn.click();
    }
    await expect(input).toBeVisible({ timeout: 3000 });

    await input.fill(JSON.stringify(coreState));
    const applyBtn = page.getByTestId('debug-state-apply');
    await expect(applyBtn).toBeEnabled({ timeout: 2000 });
    await applyBtn.click();
    await page.waitForTimeout(500);
};

// ============================================================================
// 页面导航与派系选择
// ============================================================================

export const gotoLocalSmashUp = async (page: Page) => {
    await page.goto('/play/smashup/local', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(page);
    await page.waitForFunction(
        () => {
            if (document.querySelector('[data-testid="su-hand-area"]')) return true;
            if (document.querySelector('[data-testid="debug-toggle"]')) return true;
            if (document.querySelector('h1')?.textContent?.match(/Draft Your Factions|选择你的派系/)) return true;
            return false;
        },
        { timeout: 30000 },
    );
};

export const waitForHandArea = async (page: Page, timeout = 30000) => {
    const handArea = page.getByTestId('su-hand-area');
    await expect(handArea).toBeVisible({ timeout });
};


/**
 * 蛇形选秀完成派系选择
 * pickOrder: 4个派系索引，按蛇形选秀顺序 [P0第一选, P1第一选, P1第二选, P0第二选]
 */
export const completeFactionSelectionLocal = async (page: Page, pickOrder: number[]) => {
    const factionHeading = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    if (!await factionHeading.isVisible().catch(() => false)) return;
    const factionCards = page.locator('.grid > div');
    const confirmBtn = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
    for (const idx of pickOrder) {
        await factionCards.nth(idx).click();
        await expect(confirmBtn).toBeVisible({ timeout: 5000 });
        await confirmBtn.click();
        await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1000);
};

// ============================================================================
// 状态操作工具
// ============================================================================

/** 获取当前玩家 ID 和玩家对象 */
export const getCurrentPlayer = (core: Record<string, unknown>) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    const turnOrder = core.turnOrder as string[];
    const currentPid = turnOrder[(core.currentPlayerIndex as number) ?? 0];
    return { currentPid, player: players[currentPid], players };
};

/** 创建卡牌对象 */
export const makeCard = (uid: string, defId: string, type: string, owner: string) => ({
    uid, defId, type, owner,
});

/** 创建基地上的随从对象（MinionOnBase 完整结构） */
export const makeMinion = (uid: string, defId: string, controller: string, owner: string, basePower: number) => ({
    uid, defId, controller, owner,
    basePower,
    powerModifier: 0,
    tempPowerModifier: 0,
    talentUsed: false,
    attachedActions: [],
});

// ============================================================================
// PromptOverlay 交互工具
// ============================================================================

/**
 * PromptOverlay 定位器 — 使用 inline style z-index:300 匹配
 * PromptOverlay 使用 style={{ zIndex: UI_Z_INDEX.overlay }} (300)，不是 Tailwind class
 */
const promptLocator = (page: Page) =>
    page.locator('.fixed.inset-0[style*="z-index"]').first();

/** 等待 PromptOverlay 出现 */
export const waitForPrompt = async (page: Page, timeout = 10000) => {
    // PromptOverlay 特征：fixed inset-0 + z-index:300
    await page.waitForFunction(
        () => {
            const els = document.querySelectorAll('.fixed.inset-0[style*="z-index"]');
            for (const el of els) {
                const z = parseInt((el as HTMLElement).style.zIndex);
                if (z === 300) return true;
            }
            // 也检查底部面板（displayCards 模式）
            const bottomPanel = document.querySelector('.fixed.bottom-0.inset-x-0[style*="z-index"]');
            if (bottomPanel) {
                const z = parseInt((bottomPanel as HTMLElement).style.zIndex);
                if (z === 300) return true;
            }
            return false;
        },
        { timeout },
    );
};

/** 检查 PromptOverlay 是否可见 */
export const isPromptVisible = async (page: Page) => {
    return page.evaluate(() => {
        const els = document.querySelectorAll('.fixed.inset-0[style*="z-index"]');
        for (const el of els) {
            const z = parseInt((el as HTMLElement).style.zIndex);
            if (z === 300 && (el as HTMLElement).offsetParent !== null) return true;
        }
        const bottomPanel = document.querySelector('.fixed.bottom-0.inset-x-0[style*="z-index"]');
        if (bottomPanel) {
            const z = parseInt((bottomPanel as HTMLElement).style.zIndex);
            if (z === 300 && (bottomPanel as HTMLElement).offsetParent !== null) return true;
        }
        return false;
    }).catch(() => false);
};

/** 点击 PromptOverlay 中的第 N 个选项（支持按钮模式和卡牌模式） */
export const clickPromptOption = async (page: Page, index = 0) => {
    // PromptOverlay 有两种渲染模式：
    // 1. 按钮模式：GameButton 渲染的 button 元素
    // 2. 卡牌模式：motion.div 渲染的 cursor-pointer 卡牌（onClick 在 div 上，class 含 flex-shrink-0）
    const result = await page.evaluate((idx) => {
        const overlays = document.querySelectorAll('.fixed.inset-0[style*="z-index"]');
        const clickables: HTMLElement[] = [];
        for (const overlay of overlays) {
            const z = parseInt((overlay as HTMLElement).style.zIndex);
            if (z !== 300) continue;
            // 卡牌模式：flex-shrink-0 cursor-pointer 的 div（卡牌容器）
            const cardDivs = overlay.querySelectorAll('.flex-shrink-0.cursor-pointer');
            for (const div of cardDivs) {
                if ((div as HTMLElement).tagName !== 'BUTTON') {
                    clickables.push(div as HTMLElement);
                }
            }
            // 按钮模式：GameButton（排除放大镜 cursor-zoom-in 和 disabled）
            if (clickables.length === 0) {
                const btns = overlay.querySelectorAll('button:not([disabled]):not(.cursor-zoom-in)');
                for (const b of btns) {
                    if (!(b as HTMLElement).closest('.cursor-zoom-in')) {
                        clickables.push(b as HTMLElement);
                    }
                }
            }
        }
        if (clickables[idx]) {
            clickables[idx].click();
            return `clicked (${clickables.length} options)`;
        }
        return `not-found (${clickables.length} options)`;
    }, index);
    await page.waitForTimeout(500);
    return result;
};

/** 点击 PromptOverlay 中包含指定文本的按钮 */
export const clickPromptOptionByText = async (page: Page, text: string | RegExp) => {
    const textStr = text instanceof RegExp ? text.source : text;
    const result = await page.evaluate((searchText) => {
        // 优先匹配 z-index=300 的 fixed inset-0 overlay
        const overlays = document.querySelectorAll('.fixed.inset-0[style*="z-index"]');
        for (const overlay of overlays) {
            const style = (overlay as HTMLElement).style;
            const z = parseInt(style.zIndex);
            if (z === 300) {
                const btns = overlay.querySelectorAll('button');
                for (const btn of btns) {
                    const btnText = btn.textContent || '';
                    if (new RegExp(searchText, 'i').test(btnText)) {
                        btn.click();
                        return 'clicked';
                    }
                }
            }
        }
        // fallback：扩大到所有 z >= 300 的 fixed inset-0
        for (const overlay of overlays) {
            const style = (overlay as HTMLElement).style;
            const z = parseInt(style.zIndex);
            if (z >= 300) {
                const btns = overlay.querySelectorAll('button');
                for (const btn of btns) {
                    const btnText = btn.textContent || '';
                    if (new RegExp(searchText, 'i').test(btnText)) {
                        btn.click();
                        return 'clicked';
                    }
                }
            }
        }
        return 'not-found';
    }, textStr);
    await page.waitForTimeout(500);
    return result;
};

/** 点击手牌中的第 N 张卡 */
export const clickHandCard = async (page: Page, index = 0) => {
    const handArea = page.getByTestId('su-hand-area');
    const handCards = handArea.locator('> div > div');
    await expect(handCards.nth(index)).toBeVisible({ timeout: 5000 });
    await handCards.nth(index).click();
    await page.waitForTimeout(300);
};

/** 点击第 N 个基地（通过 evaluate 确保点击到正确元素） */
export const clickBaseByIndex = async (page: Page, index = 0) => {
    await page.evaluate((idx) => {
        const bases = document.querySelectorAll('.group\\/base');
        if (bases[idx]) {
            const baseCard = bases[idx].querySelector('[class*="w-\\[14vw\\]"]') as HTMLElement;
            if (baseCard) baseCard.click();
            else (bases[idx] as HTMLElement).click();
        }
    }, index);
    await page.waitForTimeout(500);
};

/** 点击高亮的基地（ring-amber-400） — 基地选择交互模式下基地直接高亮在棋盘上 */
export const clickHighlightedBase = async (page: Page, index = 0) => {
    const result = await page.evaluate((idx) => {
        // 基地选择模式下，可选基地的卡片 div（w-[14vw]）上有 ring-amber-400 class
        // onClick 绑定在这个 div 上，必须直接点击它
        const allBases = document.querySelectorAll('.group\\/base');
        const selectableCards: HTMLElement[] = [];
        for (const base of allBases) {
            const baseCard = base.querySelector('[class*="ring-amber-400"]') as HTMLElement;
            if (baseCard) selectableCards.push(baseCard);
        }
        if (selectableCards[idx]) {
            selectableCards[idx].click();
            return `clicked-base-card-${idx}`;
        }
        // fallback：点击基地容器内的卡片区域
        if (allBases[idx]) {
            const card = allBases[idx].querySelector('[class*="w-\\[14vw\\]"]') as HTMLElement;
            if (card) { card.click(); return `clicked-base-fallback-card-${idx}`; }
            (allBases[idx] as HTMLElement).click();
            return `clicked-base-fallback-${idx}`;
        }
        return 'not-found';
    }, index);
    await page.waitForTimeout(500);
    return result;
};

/** 点击高亮的随从（ring-purple-400） — 随从选择交互模式下随从直接高亮在棋盘上 */
export const clickHighlightedMinion = async (page: Page, index = 0) => {
    const result = await page.evaluate((idx) => {
        const selectableMinions = document.querySelectorAll('[class*="ring-purple-400"]');
        if (selectableMinions[idx]) {
            (selectableMinions[idx] as HTMLElement).click();
            return `clicked-minion-${idx}`;
        }
        return 'not-found';
    }, index);
    await page.waitForTimeout(500);
    return result;
};

/** 等待基地选择模式出现（基地高亮 ring-amber-400） */
export const waitForBaseSelect = async (page: Page, timeout = 10000) => {
    await page.waitForFunction(
        () => document.querySelectorAll('[class*="ring-amber-400"]').length > 0,
        { timeout },
    );
};

/** 等待随从选择模式出现（随从高亮 ring-purple-400） */
export const waitForMinionSelect = async (page: Page, timeout = 10000) => {
    await page.waitForFunction(
        () => document.querySelectorAll('[class*="ring-purple-400"]').length > 0,
        { timeout },
    );
};

/** 点击高亮的随从（ring-purple-400）- 用于交互驱动的随从选择 */
export const clickHighlightedMinionByIndex = async (page: Page, index = 0) => {
    const result = await page.evaluate((idx) => {
        // 查找所有带 ring-purple-400 的随从卡片（可选随从）
        const selectableMinions = document.querySelectorAll('[class*="ring-purple-400"]');
        if (selectableMinions[idx]) {
            (selectableMinions[idx] as HTMLElement).click();
            return `clicked-minion-${idx}`;
        }
        return 'not-found';
    }, index);
    await page.waitForTimeout(500);
    return result;
};

/** 检查是否处于基地选择模式 */
export const isBaseSelectMode = async (page: Page) => {
    return page.evaluate(() => document.querySelectorAll('[class*="ring-amber-400"]').length > 0).catch(() => false);
};

/** 检查是否处于随从选择模式 */
export const isMinionSelectMode = async (page: Page) => {
    return page.evaluate(() => document.querySelectorAll('[class*="ring-purple-400"]').length > 0).catch(() => false);
};

// ============================================================================
// 派系索引常量
// ============================================================================

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


// ============================================================================
// 联机匹配辅助函数
// ============================================================================

const GAME_NAME = 'smashup';

export interface SUMatchSetup {
    hostPage: Page;
    guestPage: Page;
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    matchId: string;
}

/** 通过 API 创建 smashup 房间，返回 matchId */
const createSURoomViaAPI = async (page: Page): Promise<string | null> => {
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
};

/** 联机模式下通过 UI 点击完成蛇形选秀（两个页面交替选择） */
const completeFactionSelectionOnline = async (
    hostPage: Page,
    guestPage: Page,
    factionIds: [string, string, string, string], // [P0第一选, P1第一选, P1第二选, P0第二选]
) => {
    // 蛇形选秀：P0选1 → P1选1 → P1选2 → P0选2
    const picks: { page: Page; factionId: string }[] = [
        { page: hostPage, factionId: factionIds[0] },
        { page: guestPage, factionId: factionIds[1] },
        { page: guestPage, factionId: factionIds[2] },
        { page: hostPage, factionId: factionIds[3] },
    ];

    // 派系 ID → FACTION_METADATA 索引映射（与 FactionSelection 渲染顺序一致）
    const factionIndexMap: Record<string, number> = {
        pirates: 0, ninjas: 1, dinosaurs: 2, aliens: 3, robots: 4, zombies: 5,
        wizards: 6, tricksters: 7, steampunks: 8, ghosts: 9, killer_plants: 10,
        bear_cavalry: 11, minions_of_cthulhu: 12, elder_things: 13, innsmouth: 14,
        miskatonic_university: 15,
    };

    for (const { page, factionId } of picks) {
        const idx = factionIndexMap[factionId] ?? 0;

        // 等待轮到自己（确认按钮可点击）
        // 先关闭可能打开的详情弹窗
        const closeBtn = page.locator('[data-tutorial-id="su-faction-select"] button').filter({ hasText: /×/ });
        if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(200);
        }

        // 点击派系卡片打开详情弹窗
        const factionCards = page.locator('[data-tutorial-id="su-faction-select"] .grid > div');
        await expect(factionCards.nth(idx)).toBeVisible({ timeout: 10000 });
        await factionCards.nth(idx).click();
        await page.waitForTimeout(500);

        // 等待确认按钮出现并点击
        const confirmBtn = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
        await expect(confirmBtn).toBeVisible({ timeout: 5000 });
        // 等待按钮可点击（轮到自己时才 enabled）
        await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
        await confirmBtn.click();
        await page.waitForTimeout(800);
    }
    // 等待选秀完成，进入游戏
    await hostPage.waitForTimeout(2000);
};

/** 等待 smashup 派系选择界面出现 */
const waitForSUFactionSelection = async (page: Page, timeout = 30000) => {
    await page.waitForFunction(
        () => {
            if (document.querySelector('[data-tutorial-id="su-faction-select"]')) return true;
            if (document.querySelector('h1')?.textContent?.match(/Draft Your Factions|选择你的派系/)) return true;
            return false;
        },
        { timeout },
    );
};

/**
 * 创建 smashup 联机对局并完成选秀
 *
 * @param factionIds 蛇形选秀顺序 [P0第一选, P1第一选, P1第二选, P0第二选]
 * @returns SUMatchSetup 或 null（服务器不可用时）
 */
export const setupSUOnlineMatch = async (
    browser: Browser,
    baseURL: string | undefined,
    factionIds: [string, string, string, string] = ['zombies', 'pirates', 'ninjas', 'aliens'],
): Promise<SUMatchSetup | null> => {
    // 房主上下文
    const hostContext = await browser.newContext({ baseURL });
    const hostPage = await hostContext.newPage();

    // 预热 Vite 模块缓存
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) return null;

    const matchId = await createSURoomViaAPI(hostPage);
    if (!matchId) return null;

    if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId, 20000))) return null;

    // 导航到对局页面
    await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(hostPage);
    await waitForSUFactionSelection(hostPage);

    // 客人上下文
    const guestContext = await browser.newContext({ baseURL });
    const guestPage = await guestContext.newPage();

    // guest 预热
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
    await dismissViteOverlay(guestPage);
    await waitForSUFactionSelection(guestPage);

    // 通过 dispatch 完成选秀
    await completeFactionSelectionOnline(hostPage, guestPage, factionIds);

    return { hostPage, guestPage, hostContext, guestContext, matchId };
};
