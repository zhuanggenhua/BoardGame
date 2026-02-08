/**
 * 角色选择系统 E2E 测试
 * 验证重构后的角色选择功能是否正常工作
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const selectionTitlePattern = /选择你的英雄|Choose your hero/i;
const readyButtonPattern = /准备|Ready/i;
const closePreviewPattern = /关闭预览|Close Preview/i;
const playerBoardAltPattern = /玩家面板|Player Board/i;
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

        // 验证角色列表是否显示（包括 Pyromancer）
        await expect(page.locator('[data-char-id="monk"]')).toBeVisible();
        await expect(page.locator('[data-char-id="barbarian"]')).toBeVisible();
        await expect(page.locator('[data-char-id="pyromancer"]')).toBeVisible();
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

});
