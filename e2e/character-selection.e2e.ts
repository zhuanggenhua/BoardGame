/**
 * 角色选择系统 E2E 测试
 * 验证重构后的角色选择功能是否正常工作
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
    ensureGameServerAvailable,
} from './helpers/common';

const selectionTitlePattern = /选择你的英雄|Choose your hero|Select Your Hero/i;
const readyButtonPattern = /准备|Ready/i;
const closePreviewPattern = /关闭预览|Close Preview/i;
const playerBoardAltPattern = /玩家面板|Player Board/i;
const turnPattern = /回合|Turn/i;
const diceThroneHeadingPattern = /Dice Throne|王权骰铸/i;
const createRoomPattern = /Create Room|创建房间/i;
const confirmPattern = /Confirm|确认/i;

/** 通过 UI 打开 DiceThrone 房间（此文件特有的 UI 流程） */
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
    await expect(page.locator('[data-testid="character-selection-overlay"]')).toBeVisible({ timeout: 15000 });
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
    if (!browser) throw new Error('Browser instance not available.');
    const hostUrl = new URL(page.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) throw new Error('Failed to parse match id from host URL.');

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
        await expect(page.getByText(selectionTitlePattern)).toBeVisible();
        await expect(page.locator('[data-char-id="monk"]')).toBeVisible();
        await expect(page.locator('[data-char-id="barbarian"]')).toBeVisible();
        await expect(page.locator('[data-char-id="pyromancer"]')).toBeVisible();
    });

    test('应该能够切换角色', async ({ page }) => {
        await prepareHostSelection(page);
        await page.click('[data-char-id="monk"]');
        await page.waitForTimeout(500);
        await expect(page.locator('[data-char-id="monk"]')).toHaveClass(/border-amber-400/);

        await page.click('[data-char-id="barbarian"]');
        await page.waitForTimeout(500);
        await expect(page.locator('[data-char-id="barbarian"]')).toHaveClass(/border-amber-400/);
        await expect(page.locator('[data-char-id="monk"]')).not.toHaveClass(/border-amber-400/);
        await expect(page.locator('[data-char-id="barbarian"]')).toContainText(/P1/i);
        await expect(page.locator('[data-char-id="monk"]')).not.toContainText(/P1/i);
    });

    test('应该能够放大预览角色面板', async ({ page }) => {
        await prepareHostSelection(page);
        await page.click('[data-char-id="monk"]');
        await page.waitForTimeout(1000);
        await page.getByAltText(playerBoardAltPattern).click();
        await page.waitForTimeout(500);

        const closeButton = page.getByRole('button', { name: closePreviewPattern }).first();
        const overlay = page.locator('.fixed.inset-0.z-\\[9999\\]');
        await expect(closeButton).toBeVisible();
        await expect(overlay).toBeVisible();

        await overlay.click({ position: { x: 5, y: 5 } });
        await page.waitForTimeout(500);
        await expect(overlay).not.toBeVisible();
    });

    test('手机横屏下选角界面不应出现顶层横向滚动', async ({ page }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'mobile-character-selection');
        mkdirSync(evidenceDir, { recursive: true });
        const evidencePath = join(evidenceDir, 'character-selection-mobile-landscape.png');

        await page.setViewportSize({ width: 800, height: 450 });
        await prepareHostSelection(page);

        const overlay = page.locator('[data-testid="character-selection-overlay"]');
        await expect(overlay).toBeVisible({ timeout: 15000 });

        const metrics = await page.evaluate(() => {
            const gamePage = document.querySelector<HTMLElement>('[data-game-page="true"]');
            const overlayEl = document.querySelector<HTMLElement>('[data-testid="character-selection-overlay"]');
            const gamePageRect = gamePage?.getBoundingClientRect() ?? null;
            const overlayRect = overlayEl?.getBoundingClientRect() ?? null;

            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                docScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                rootScrollWidth: document.getElementById('root')?.scrollWidth ?? null,
                gamePageRect: gamePageRect
                    ? {
                        left: gamePageRect.left,
                        right: gamePageRect.right,
                        top: gamePageRect.top,
                        bottom: gamePageRect.bottom,
                        width: gamePageRect.width,
                        height: gamePageRect.height,
                    }
                    : null,
                overlayRect: overlayRect
                    ? {
                        left: overlayRect.left,
                        right: overlayRect.right,
                        top: overlayRect.top,
                        bottom: overlayRect.bottom,
                        width: overlayRect.width,
                        height: overlayRect.height,
                    }
                    : null,
            };
        });

        const maxAllowedWidth = metrics.innerWidth + 1;
        const maxAllowedHeight = metrics.innerHeight + 1;

        expect(metrics.docScrollWidth, '手机横屏选角时 documentElement 不应横向溢出').toBeLessThanOrEqual(maxAllowedWidth);
        expect(metrics.bodyScrollWidth, '手机横屏选角时 body 不应横向溢出').toBeLessThanOrEqual(maxAllowedWidth);
        if (metrics.rootScrollWidth !== null) {
            expect(metrics.rootScrollWidth, '手机横屏选角时 #root 不应横向溢出').toBeLessThanOrEqual(maxAllowedWidth);
        }

        expect(metrics.gamePageRect, '应找到游戏页容器').not.toBeNull();
        expect(metrics.overlayRect, '应找到选角覆盖层').not.toBeNull();

        expect(metrics.gamePageRect!.left, '游戏页左边界不应出视口').toBeGreaterThanOrEqual(-1);
        expect(metrics.gamePageRect!.right, '游戏页右边界不应出视口').toBeLessThanOrEqual(maxAllowedWidth);
        expect(metrics.gamePageRect!.bottom, '游戏页底边界不应出视口').toBeLessThanOrEqual(maxAllowedHeight);

        expect(metrics.overlayRect!.left, '选角层左边界不应出视口').toBeGreaterThanOrEqual(-1);
        expect(metrics.overlayRect!.right, '选角层右边界不应出视口').toBeLessThanOrEqual(maxAllowedWidth);
        expect(metrics.overlayRect!.bottom, '选角层底边界不应出视口').toBeLessThanOrEqual(maxAllowedHeight);

        await page.screenshot({ path: evidencePath, fullPage: false });
        await page.screenshot({ path: testInfo.outputPath('character-selection-mobile-landscape.png'), fullPage: false });
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
