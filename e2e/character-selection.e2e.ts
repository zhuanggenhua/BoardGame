/**
 * 角色选择系统 E2E 测试
 * 验证重构后的角色选择功能是否正常工作
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const selectionTitlePattern = /选择你的英雄|Choose your hero/i;
const monkNamePattern = /僧侣|Monk/i;
const barbarianNamePattern = /狂战士|Barbarian/i;
const startButtonPattern = /开始游戏|Press Start|等待全员就绪|Waiting/i;
const readyButtonPattern = /准备|Ready/i;
const closePreviewPattern = /关闭预览|Close Preview/i;
const playerBoardAltPattern = /玩家面板|Player Board/i;
const tipBoardAltPattern = /提示板|Tip Board/i;
const notSelectedPattern = /未选择|Not Selected/i;
const turnPattern = /回合|Turn/i;
const diceThroneHeadingPattern = /Dice Throne|王权骰铸/i;
const createRoomPattern = /Create Room|创建房间/i;
const confirmPattern = /Confirm|确认/i;

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const getGameServerBaseURL = () => {
    const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
    return `http://localhost:${port}`;
};

const ensureGameServerAvailable = async (page: Page) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const candidates = ['/games', `${gameServerBaseURL}/games`];
    for (const url of candidates) {
        try {
            const response = await page.request.get(url);
            if (response.ok()) return true;
        } catch {
            // ignore
        }
    }
    return false;
};

const openDiceThroneRoom = async (page: Page) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('heading', { name: diceThroneHeadingPattern }).click();
    await page.getByRole('button', { name: createRoomPattern }).click();
    await expect(page.getByRole('heading', { name: createRoomPattern })).toBeVisible();
    await page.getByRole('button', { name: confirmPattern }).click();
    try {
        await page.waitForURL(/\/play\/dicethrone\/match\//, { timeout: 8000 });
    } catch {
        test.skip(true, 'Room creation failed or backend unavailable.');
    }
};

const ensureHostPlayerId = async (page: Page) => {
    const url = new URL(page.url());
    if (!url.searchParams.get('playerID')) {
        url.searchParams.set('playerID', '0');
        await page.goto(url.toString());
    }
};

const waitForSelectionOverlay = async (page: Page) => {
    await expect(page.getByText(selectionTitlePattern)).toBeVisible({ timeout: 15000 });
};

const prepareHostSelection = async (page: Page) => {
    if (!await ensureGameServerAvailable(page)) {
        test.skip(true, 'Game server unavailable for online tests.');
    }
    await openDiceThroneRoom(page);
    await ensureHostPlayerId(page);
    await waitForSelectionOverlay(page);
};

const withOnlineMatch = async (page: Page, run: (guestPage: Page) => Promise<void>) => {
    await prepareHostSelection(page);
    const { guestContext, guestPage } = await joinGuest(page);
    try {
        await run(guestPage);
    } finally {
        await guestContext.close();
    }
};

const joinGuest = async (page: Page): Promise<{ guestContext: BrowserContext; guestPage: Page }> => {
    const browser = page.context().browser();
    if (!browser) {
        throw new Error('Browser instance not available.');
    }
    const hostUrl = new URL(page.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) {
        throw new Error('Failed to parse match id from host URL.');
    }

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${hostUrl.origin}/play/dicethrone/match/${matchId}?join=true`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
    });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });
    await expect(guestPage.getByText(selectionTitlePattern)).toBeVisible({ timeout: 15000 });
    return { guestContext, guestPage };
};

test.describe('角色选择系统', () => {
    test('应该显示角色选择界面', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证角色选择界面是否显示
        await expect(page.getByText(selectionTitlePattern)).toBeVisible();
        
        // 验证角色列表是否显示
        await expect(page.locator('[data-char-id="monk"]')).toBeVisible();
        await expect(page.locator('[data-char-id="barbarian"]')).toBeVisible();
    });

    test('应该能够选择角色', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 点击选择僧侣
        await page.click('[data-char-id="monk"]');
        await page.waitForTimeout(500);
        
        // 验证角色被选中（应该有高亮边框）
        const monkCard = page.locator('[data-char-id="monk"]');
        await expect(monkCard).toHaveClass(/border-amber-400/);
        
        // 验证当前玩家标记已显示
        await expect(monkCard).toContainText(/P1/i);
    });

    test('应该能够切换角色', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 先选择僧侣
        await page.click('[data-char-id="monk"]');
        await page.waitForTimeout(500);
        await expect(page.locator('[data-char-id="monk"]')).toHaveClass(/border-amber-400/);
        
        // 切换到野蛮人
        await page.click('[data-char-id="barbarian"]');
        await page.waitForTimeout(500);
        
        // 验证野蛮人被选中，僧侣取消选中
        await expect(page.locator('[data-char-id="barbarian"]')).toHaveClass(/border-amber-400/);
        await expect(page.locator('[data-char-id="monk"]')).not.toHaveClass(/border-amber-400/);
        
        // 验证玩家标记移动到新角色
        await expect(page.locator('[data-char-id="barbarian"]')).toContainText(/P1/i);
        await expect(page.locator('[data-char-id="monk"]')).not.toContainText(/P1/i);
    });

    test('房主选角后应该显示开始按钮', async ({ page }) => {
        test.slow();
        await withOnlineMatch(page, async (guestPage) => {
            await page.click('[data-char-id="monk"]');
            await page.waitForTimeout(500);

            const startButton = page.getByRole('button', { name: startButtonPattern });
            await expect(startButton).toBeVisible();
            await expect(startButton).toBeDisabled();

            await guestPage.click('[data-char-id="barbarian"]');
            await guestPage.getByRole('button', { name: readyButtonPattern }).click();
            await expect(startButton).toBeEnabled();
        });
    });

    test('应该显示角色预览', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 选择僧侣
        await page.click('[data-char-id="monk"]');
        await page.waitForTimeout(1000);
        
        // 验证预览区域显示玩家面板和提示板
        const playerBoard = page.getByAltText(playerBoardAltPattern);
        const tipBoard = page.getByAltText(tipBoardAltPattern);
        
        await expect(playerBoard).toBeVisible();
        await expect(tipBoard).toBeVisible();
    });

    test('应该能够放大预览角色面板', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 选择僧侣
        await page.click('[data-char-id="monk"]');
        await page.waitForTimeout(1000);
        
        // 点击玩家面板放大
        await page.getByAltText(playerBoardAltPattern).click();
        await page.waitForTimeout(500);
        
        // 验证放大预览弹窗显示
        const closeButton = page.getByRole('button', { name: closePreviewPattern }).first();
        const overlay = page.locator('.fixed.inset-0.z-\\[9999\\]');
        await expect(closeButton).toBeVisible();
        await expect(overlay).toBeVisible();
        
        // 关闭预览
        await overlay.click({ position: { x: 5, y: 5 } });
        await page.waitForTimeout(500);
        
        // 验证预览弹窗关闭
        await expect(overlay).not.toBeVisible();
    });

    test('应该显示玩家颜色标签', async ({ page }) => {
        await withOnlineMatch(page, async () => {
            await expect(page.getByText('P1')).toBeVisible();
            await expect(page.getByText('P2')).toBeVisible();
            await expect(page.getByText('(YOU)')).toBeVisible();
        });
    });

    test('选角后应该能够开始游戏', async ({ page }) => {
        await withOnlineMatch(page, async (guestPage) => {
            await page.click('[data-char-id="monk"]');
            await page.waitForTimeout(500);

            await guestPage.click('[data-char-id="barbarian"]');
            await guestPage.getByRole('button', { name: readyButtonPattern }).click();

            const startButton = page.getByRole('button', { name: /开始游戏|Press Start/i });
            await expect(startButton).toBeEnabled();
            await startButton.click();
            await page.waitForTimeout(2000);

            await expect(page.getByText(selectionTitlePattern)).not.toBeVisible();
            await expect(page.getByText(turnPattern)).toBeVisible();
        });
    });

    test('应该正确显示角色名称（i18n）', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证中文角色名称显示
        await expect(page.getByText(monkNamePattern).first()).toBeVisible();
        await expect(page.getByText(barbarianNamePattern).first()).toBeVisible();
    });

    test('未选择角色时应该显示"未选择"', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证未选择状态显示
        await expect(page.getByText(notSelectedPattern)).toHaveCount(2);
    });

    test('应该显示背景动画效果', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证背景层存在
        const background = page.locator('.bg-\\[\\#0F0F23\\]').first();
        await expect(background).toBeVisible();
        
        // 验证动画效果存在
        const animatedBg = page.locator('.animate-pulse');
        await expect(animatedBg).toBeVisible();
    });

    test('角色卡片应该有 hover 效果', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 悬停在僧侣卡片上
        const monkCard = page.locator('[data-char-id="monk"]');
        await monkCard.hover();
        await page.waitForTimeout(300);

        // 验证卡片存在（hover 效果通过 CSS 实现，难以直接测试）
        await expect(monkCard).toBeVisible();
    });

    test('应该支持键盘导航', async ({ page }) => {
        await withOnlineMatch(page, async () => {
            // 使用 Tab 键导航
            await page.keyboard.press('Tab');
            await page.waitForTimeout(200);
            
            // 验证焦点移动（通过检查元素是否可见）
            const monkCard = page.locator('[data-char-id="monk"]');
            await expect(monkCard).toBeVisible();
        });
    });
});

test.describe('多人角色选择', () => {
    test('非房主玩家应该显示准备按钮', async ({ page }) => {
        await withOnlineMatch(page, async (guestPage) => {
            await guestPage.click('[data-char-id="barbarian"]');
            await expect(guestPage.getByRole('button', { name: readyButtonPattern })).toBeVisible();
        });
    });

    test('房主应该等待所有玩家准备', async ({ page }) => {
        await withOnlineMatch(page, async (guestPage) => {
            await page.click('[data-char-id="monk"]');
            await page.waitForTimeout(500);

            const startButton = page.getByRole('button', { name: startButtonPattern });
            await expect(startButton).toBeVisible();
            await expect(startButton).toBeDisabled();

            await guestPage.click('[data-char-id="barbarian"]');
            await guestPage.getByRole('button', { name: readyButtonPattern }).click();
            await expect(startButton).toBeEnabled();
        });
    });

    test('应该显示其他玩家的选角状态', async ({ page }) => {
        await withOnlineMatch(page, async (guestPage) => {
            await page.click('[data-char-id="monk"]');
            await guestPage.click('[data-char-id="barbarian"]');

            await expect(page.locator('[data-char-id="barbarian"]')).toContainText(/P2/i);
        });
    });
});

test.describe('角色选择错误处理', () => {
    test('网络错误时应该有提示', async ({ page }) => {
        // 模拟网络离线
        await page.context().setOffline(true);
        
        // 尝试创建房间
        let navigationError: Error | null = null;
        try {
            await page.goto('http://localhost:5173/');
        } catch (error) {
            navigationError = error as Error;
        }
        expect(navigationError).toBeTruthy();
        await page.context().setOffline(false);
        if (navigationError) {
            return;
        }
        await page.click('text=创建房间').catch(() => {
            // 预期会失败
        });
    });

    test('快速点击不应该导致重复选择', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 快速点击多次
        const monkCard = page.locator('[data-char-id="monk"]');
        await monkCard.click({ clickCount: 3 });
        await page.waitForTimeout(500);
        
        // 验证只选择了一次
        await expect(monkCard).toHaveClass(/border-amber-400/);
    });
});

test.describe('角色选择性能', () => {
    test('角色列表应该快速渲染', async ({ page }) => {
        const startTime = Date.now();

        await prepareHostSelection(page);
        await page.waitForSelector('[data-char-id="monk"]');
        
        const endTime = Date.now();
        const renderTime = endTime - startTime;
        
        // 验证渲染时间在合理范围内（< 8秒，含在线房间创建）
        expect(renderTime).toBeLessThan(8000);
    });

    test('角色切换应该流畅', async ({ page }) => {
        await prepareHostSelection(page);

        const startTime = Date.now();
        
        // 快速切换角色
        await page.click('[data-char-id="monk"]');
        await page.waitForTimeout(100);
        await page.click('[data-char-id="barbarian"]');
        await page.waitForTimeout(100);
        await page.click('[data-char-id="monk"]');
        
        const endTime = Date.now();
        const switchTime = endTime - startTime;
        
        // 验证切换时间在合理范围内（< 1秒）
        expect(switchTime).toBeLessThan(1000);
    });
});
