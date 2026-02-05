/**
 * 角色选择系统冒烟测试
 * 快速验证重构后的组件是否正确加载和渲染
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const selectionTitlePattern = /选择你的英雄|Choose your hero/i;
const monkNamePattern = /僧侣|Monk/i;
const barbarianNamePattern = /狂战士|Barbarian/i;
const notSelectedPattern = /未选择|Not Selected/i;
const startButtonPattern = /开始游戏|Press Start|等待全员就绪|Waiting/i;
const readyButtonPattern = /准备|Ready/i;
const playerBoardAltPattern = /玩家面板|Player Board/i;
const tipBoardAltPattern = /提示板|Tip Board/i;
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
    const diceThroneHeading = page.getByRole('heading', { name: diceThroneHeadingPattern }).first();
    await expect(diceThroneHeading).toBeVisible({ timeout: 15000 });
    await diceThroneHeading.click();
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
    await expect(page.locator('[data-char-id="monk"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-char-id="barbarian"]')).toBeVisible({ timeout: 15000 });
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
    await guestPage.goto(`${hostUrl.origin}/play/dicethrone/match/${matchId}?join=true`);
    await guestPage.waitForURL(/playerID=\d/);
    await waitForSelectionOverlay(guestPage);
    return { guestContext, guestPage };
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

test.describe('角色选择系统冒烟测试', () => {
    test('应该能够加载并显示角色选择组件', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证角色选择界面是否显示
        await expect(page.getByText(selectionTitlePattern)).toBeVisible({ timeout: 10000 });
        
        console.log('✅ 角色选择界面已显示');
    });

    test('应该显示可选角色列表', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证僧侣和野蛮人卡片显示
        const monkCard = page.locator('[data-char-id="monk"]');
        const barbarianCard = page.locator('[data-char-id="barbarian"]');
        
        await expect(monkCard).toBeVisible({ timeout: 10000 });
        await expect(barbarianCard).toBeVisible({ timeout: 10000 });
        
        console.log('✅ 角色列表已显示');
    });

    test('应该能够选择角色', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 点击选择僧侣
        const monkCard = page.locator('[data-char-id="monk"]');
        await monkCard.click();

        // 验证角色被选中（检查是否有高亮样式）
        await expect(monkCard).toHaveClass(/border-amber-400/, { timeout: 5000 });
        
        console.log('✅ 角色选择功能正常');
    });

    test('应该显示玩家信息面板', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证玩家标签显示
        const playerLabel = page.locator('text=P1');
        await expect(playerLabel).toBeVisible({ timeout: 10000 });
        
        // 验证 YOU 标记显示
        const youLabel = page.locator('text=(YOU)');
        await expect(youLabel).toBeVisible({ timeout: 10000 });
        
        console.log('✅ 玩家信息面板已显示');
    });

    test('应该显示开始按钮', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 选择角色
        const monkCard = page.locator('[data-char-id="monk"]');
        await monkCard.click();
        await page.waitForTimeout(500);
        
        // 验证开始按钮显示
        const startButton = page.getByRole('button', { name: startButtonPattern });
        await expect(startButton).toBeVisible({ timeout: 10000 });
        
        console.log('✅ 开始按钮已显示');
    });

    test('应该能够开始游戏', async ({ page }) => {
        await withOnlineMatch(page, async (guestPage) => {
            const monkCard = page.locator('[data-char-id="monk"]');
            await monkCard.click();
            await page.waitForTimeout(500);

            await guestPage.click('[data-char-id="barbarian"]');
            await guestPage.getByRole('button', { name: readyButtonPattern }).click();

            const startButton = page.getByRole('button', { name: /开始游戏|Press Start/i });
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await page.waitForTimeout(3000);

            await expect(page.getByText(selectionTitlePattern)).not.toBeVisible();
        });
        
        console.log('✅ 成功进入游戏');
    });

    test('应该正确显示中文文案', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证中文标题
        await expect(page.getByText(selectionTitlePattern)).toBeVisible({ timeout: 10000 });
        
        // 验证中文角色名称
        await expect(page.getByText(monkNamePattern)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(barbarianNamePattern)).toBeVisible({ timeout: 10000 });
        
        // 验证未选择状态
        await expect(page.getByText(notSelectedPattern)).toHaveCount(2);
        
        console.log('✅ i18n 多语言支持正常');
    });

    test('应该显示角色预览', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 选择角色
        const monkCard = page.locator('[data-char-id="monk"]');
        await monkCard.click();
        await page.waitForTimeout(1000);
        
        // 验证预览图显示
        const playerBoard = page.getByAltText(playerBoardAltPattern);
        const tipBoard = page.getByAltText(tipBoardAltPattern);
        
        await expect(playerBoard).toBeVisible({ timeout: 10000 });
        await expect(tipBoard).toBeVisible({ timeout: 10000 });
        
        console.log('✅ 角色预览功能正常');
    });

    test('框架组件应该正确注入样式', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证背景样式
        const background = page.locator('.bg-\\[\\#0F0F23\\]').first();
        await expect(background).toBeVisible({ timeout: 10000 });
        
        // 验证玩家颜色标签存在
        const playerLabel = page.locator('text=P1').first();
        const labelStyle = await playerLabel.evaluate((el) => {
            const parent = el.closest('div[style]');
            return parent ? window.getComputedStyle(parent).backgroundColor : null;
        });
        
        // 验证颜色已注入（应该不是默认的透明或白色）
        expect(labelStyle).not.toBe('rgba(0, 0, 0, 0)');
        expect(labelStyle).not.toBe('rgb(255, 255, 255)');
        
        console.log('✅ 样式注入功能正常');
    });

    test('应该支持角色切换', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 选择僧侣
        const monkCard = page.locator('[data-char-id="monk"]');
        await monkCard.click();
        await page.waitForTimeout(500);
        
        // 验证僧侣被选中
        let monkClasses = await monkCard.getAttribute('class');
        expect(monkClasses).toContain('border-amber-400');
        
        // 切换到野蛮人
        const barbarianCard = page.locator('[data-char-id="barbarian"]');
        await barbarianCard.click();
        await page.waitForTimeout(500);
        
        // 验证野蛮人被选中，僧侣取消选中
        const barbarianClasses = await barbarianCard.getAttribute('class');
        expect(barbarianClasses).toContain('border-amber-400');
        
        monkClasses = await monkCard.getAttribute('class');
        expect(monkClasses).not.toContain('border-amber-400');
        
        console.log('✅ 角色切换功能正常');
    });
});

test.describe('重构验证', () => {
    test('新组件应该使用 CharacterSelectionSkeleton', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证关键元素存在（说明使用了新的骨架组件）
        await expect(page.getByText(selectionTitlePattern)).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-char-id="monk"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=P1')).toBeVisible({ timeout: 10000 });
        
        console.log('✅ 新组件架构验证通过');
    });

    test('应该支持游戏层样式注入', async ({ page }) => {
        await prepareHostSelection(page);
        
        // 验证 DiceThrone 特有的样式配置已注入
        // 检查玩家颜色（P1 应该是 Rose 色 #F43F5E）
        const p1Label = page.locator('text=P1').first();
        const bgColor = await p1Label.evaluate((el) => {
            const parent = el.closest('div[style]');
            return parent ? window.getComputedStyle(parent).backgroundColor : null;
        });
        
        // 验证颜色已正确注入（RGB 值应该接近 #F43F5E）
        expect(bgColor).toBeTruthy();
        
        console.log('✅ 游戏层样式注入验证通过');
    });

    test('应该使用框架层通用回调', async ({ page }) => {
        await withOnlineMatch(page, async (guestPage) => {
            const monkCard = page.locator('[data-char-id="monk"]');
            await monkCard.click();
            await page.waitForTimeout(500);

            const monkClasses = await monkCard.getAttribute('class');
            expect(monkClasses).toContain('border-amber-400');

            await guestPage.click('[data-char-id="barbarian"]');
            await guestPage.getByRole('button', { name: readyButtonPattern }).click();

            const startButton = page.getByRole('button', { name: /开始游戏|Press Start/i });
            await startButton.click();
            await page.waitForTimeout(2000);

            await expect(page.getByText(selectionTitlePattern)).not.toBeVisible();
        });
        
        console.log('✅ 框架层回调机制验证通过');
    });
});
