import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { disableTutorial, getGameServerBaseURL, setChineseLocale } from '../helpers/common';

async function readBoardMetrics(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const overlap = (a: DOMRect | null, b: DOMRect | null) => {
            if (!a || !b) return false;
            return !(
                a.right <= b.left
                || a.left >= b.right
                || a.bottom <= b.top
                || a.top >= b.bottom
            );
        };
        const getRect = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            return element ? element.getBoundingClientRect() : null;
        };
        const cellNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-id^="cell-"]'));
        const rects = cellNodes.map((node) => node.getBoundingClientRect());
        const left = Math.min(...rects.map((rect) => rect.left));
        const right = Math.max(...rects.map((rect) => rect.right));
        const top = Math.min(...rects.map((rect) => rect.top));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        const debugToggleRect = getRect('[data-testid="debug-toggle-container"]');
        const scoreRightRect = getRect('[data-testid="tictactoe-score-right"]');
        const turnStatusRect = getRect('[data-testid="tictactoe-turn-status"]');

        return {
            cellCount: cellNodes.length,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
            boardLeft: left,
            boardRight: right,
            boardTop: top,
            boardBottom: bottom,
            boardWidth: right - left,
            boardHeight: bottom - top,
            debugOverlapsRightScore: overlap(debugToggleRect, scoreRightRect),
            debugOverlapsTurnStatus: overlap(debugToggleRect, turnStatusRect),
        };
    });
}

async function readPortraitHudMetrics(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const getRect = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        };
        const readTextLineRects = (element: Element | null) => {
            if (!element) return [];
            const range = document.createRange();
            range.selectNodeContents(element);
            return Array.from(range.getClientRects()).map((rect) => ({
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            }));
        };
        const leftScore = document.querySelector<HTMLElement>('[data-testid="tictactoe-score-left"]');
        const rightScore = document.querySelector<HTMLElement>('[data-testid="tictactoe-score-right"]');
        const turnStatus = document.querySelector<HTMLElement>('[data-testid="tictactoe-turn-status"]');
        const turnRow = turnStatus?.firstElementChild?.firstElementChild ?? null;
        const turnName = turnRow?.children[0] ?? null;
        const turnSuffix = turnRow?.children[1] ?? null;
        const hudRects = [
            ['left', getRect('[data-testid="tictactoe-score-left"]')],
            ['center', getRect('[data-testid="tictactoe-turn-status"]')],
            ['right', getRect('[data-testid="tictactoe-score-right"]')],
        ] as const;
        const fabButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="fab-menu"] button[data-fab-id]'));
        const fabHudOverlaps = fabButtons.flatMap((button) => {
            const rect = button.getBoundingClientRect();
            return hudRects.flatMap(([panel, panelRect]) => panelRect && rect.left < panelRect.right && rect.right > panelRect.left
                && rect.top < panelRect.bottom && rect.bottom > panelRect.top
                ? [{ action: button.dataset.fabId, panel }]
                : []);
        });
        const fabButtonSizes = fabButtons.map((button) => {
            const hitRect = button.getBoundingClientRect();
            const visualRect = button.querySelector<HTMLElement>('[data-fab-visual-id]')?.getBoundingClientRect();
            return {
                action: button.dataset.fabId,
                hitWidth: hitRect.width,
                hitHeight: hitRect.height,
                visualWidth: visualRect?.width ?? 0,
                visualHeight: visualRect?.height ?? 0,
            };
        });
        const exitPanel = getRect('[data-testid="fab-panel-exit"]');

        return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
            hudLeft: getRect('[data-testid="tictactoe-score-left"]'),
            hudCenter: getRect('[data-testid="tictactoe-turn-status"]'),
            hudRight: getRect('[data-testid="tictactoe-score-right"]'),
            leftNameLines: readTextLineRects(leftScore?.firstElementChild ?? null),
            rightNameLines: readTextLineRects(rightScore?.firstElementChild ?? null),
            turnNameLines: readTextLineRects(turnName),
            turnSuffixLines: readTextLineRects(turnSuffix),
            fabHudOverlaps,
            fabButtonSizes,
            exitPanelOverlapsHud: hudRects.filter(([, panelRect]) => {
                return Boolean(exitPanel && panelRect && exitPanel.left < panelRect.right && exitPanel.right > panelRect.left
                    && exitPanel.top < panelRect.bottom && exitPanel.bottom > panelRect.top);
            }).map(([panel]) => panel),
            debugOverlapsHud: hudRects.filter(([, panelRect]) => {
                const debugRect = getRect('[data-testid="debug-toggle-container"]');
                return Boolean(debugRect && panelRect && debugRect.left < panelRect.right && debugRect.right > panelRect.left
                    && debugRect.top < panelRect.bottom && debugRect.bottom > panelRect.top);
            }).map(([panel]) => panel),
            turnRow: turnRow ? (() => {
                const rect = turnRow.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
            })() : null,
        };
    });
}

test.describe('TicTacToe 移动端布局兼容', () => {
    test('手机竖屏下棋盘应保持正方形，横屏时只显示可关闭方向提示条', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('tictactoe');
        await expect(page.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });

        // 对齐用户安卓截图的 CSS 视口比例（约 360 × 800，物理截图会按 DPR 放大）。
        await page.setViewportSize({ width: 360, height: 800 });
        await page.waitForTimeout(400);

        const portraitMetrics = await readBoardMetrics(page);
        expect(portraitMetrics.cellCount).toBe(9);
        expect(portraitMetrics.pageOverflowX).toBeLessThanOrEqual(1);
        expect(portraitMetrics.boardLeft).toBeGreaterThanOrEqual(-1);
        expect(portraitMetrics.boardRight).toBeLessThanOrEqual(portraitMetrics.viewportWidth + 1);
        expect(portraitMetrics.boardTop).toBeGreaterThanOrEqual(-1);
        expect(portraitMetrics.boardBottom).toBeLessThanOrEqual(portraitMetrics.viewportHeight + 1);
        expect(Math.abs(portraitMetrics.boardWidth - portraitMetrics.boardHeight)).toBeLessThanOrEqual(6);
        expect(portraitMetrics.debugOverlapsRightScore).toBe(false);
        expect(portraitMetrics.debugOverlapsTurnStatus).toBe(false);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-board-portrait'),
            fullPage: false,
        });

        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(400);

        const banner = page.getByTestId('mobile-orientation-game-banner');
        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(banner).toBeVisible({ timeout: 10000 });
        await expect(banner.getByText('建议切换为竖屏以获得更佳体验')).toBeVisible();
        await expect(page.getByRole('button', { name: '关闭提示' })).toBeVisible();

        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflowX).toBeLessThanOrEqual(1);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-landscape-orientation-banner'),
            fullPage: false,
        });
    });

    test('手机端切到错方向后显示提示条，切回竖屏后仍可继续当前对局', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('tictactoe');
        await expect(page.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(400);

        await page.locator('[data-tutorial-id="cell-0"]').click();
        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 10000 });

        const portraitMetrics = await readBoardMetrics(page);
        expect(portraitMetrics.pageOverflowX).toBeLessThanOrEqual(1);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-portrait-after-first-move'),
            fullPage: false,
        });

        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(400);
        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(page.getByTestId('mobile-orientation-game-banner')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('建议切换为竖屏以获得更佳体验')).toBeVisible();
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-landscape-banner-after-first-move'),
            fullPage: false,
        });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(400);

        await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 10000 });

        await page.locator('[data-tutorial-id="cell-4"]').click();
        await expect(page.locator('[data-tutorial-id="cell-4"] svg')).toBeVisible({ timeout: 10000 });

        const portraitReturnMetrics = await readBoardMetrics(page);
        expect(portraitReturnMetrics.pageOverflowX).toBeLessThanOrEqual(1);
        expect(Math.abs(portraitReturnMetrics.boardWidth - portraitReturnMetrics.boardHeight)).toBeLessThanOrEqual(6);
        expect(portraitReturnMetrics.debugOverlapsRightScore).toBe(false);
        expect(portraitReturnMetrics.debugOverlapsTurnStatus).toBe(false);

        const filledCells = await page.evaluate(() =>
            Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-id^="cell-"] svg')).length,
        );
        expect(filledCells, '切回竖屏后应保留已下的子并可继续对局').toBeGreaterThanOrEqual(2);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'tictactoe-mobile-portrait-after-second-move'),
            fullPage: false,
        });
    });

    test('安卓窄屏人机房 HUD 与房间离开菜单完整可读且不重叠', async ({ page }, testInfo) => {
        test.setTimeout(90000);
        await clearEvidenceScreenshotsForTest(testInfo);
        await setChineseLocale(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
        });
        await page.setViewportSize({ width: 360, height: 800 });

        const gameServerBaseURL = getGameServerBaseURL();
        const guestId = `tictactoe-mobile-hud-${Date.now()}`;
        const hostName = '玩家2512';
        const aiName = 'AI 2号';
        const createResponse = await page.request.post(`${gameServerBaseURL}/games/tictactoe/create`, {
            data: {
                numPlayers: 2,
                setupData: {
                    guestId,
                    enableAi: true,
                    seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } },
                },
                playerName: hostName,
                forceReplaceOwnerRoom: true,
            },
        });
        expect(createResponse.ok(), '本地测试游戏服应创建出真实人机房').toBe(true);
        const { matchID } = await createResponse.json() as { matchID: string };
        const claimSeat = async (playerID: string, playerName: string) => {
            const response = await page.request.post(`${gameServerBaseURL}/games/tictactoe/${matchID}/claim-seat`, {
                data: { playerID, guestId, playerName },
            });
            expect(response.ok(), `玩家 ${playerID} 应能领取测试座位`).toBe(true);
            return (await response.json() as { playerCredentials: string }).playerCredentials;
        };
        const hostCredentials = await claimSeat('0', hostName);
        const aiCredentials = await claimSeat('1', aiName);
        await page.addInitScript(({ matchID: targetMatchId, guestId: targetGuestId, hostCredentials: hostToken, aiCredentials: aiToken, hostName: targetHostName }) => {
            localStorage.setItem('guest_id', targetGuestId);
            sessionStorage.setItem('guest_id', targetGuestId);
            localStorage.setItem(`match_creds_${targetMatchId}`, JSON.stringify({
                matchID: targetMatchId,
                playerID: '0',
                credentials: hostToken,
                gameName: 'tictactoe',
                playerName: targetHostName,
            }));
            localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify({ '1': aiToken }));
        }, { matchID, guestId, hostCredentials, aiCredentials, hostName });

        await page.goto(`/play/tictactoe/match/${matchID}?playerID=0`);
        await expect(page.locator('[data-tutorial-id^="cell-"]')).toHaveCount(9, { timeout: 10000 });
        await page.waitForTimeout(500);

        await expect(page.getByTestId('tictactoe-score-left')).toContainText(hostName);
        await expect(page.getByTestId('tictactoe-score-right')).toContainText(aiName);

        const fabMenu = page.getByTestId('fab-menu');
        await expect(fabMenu.getByRole('button', { name: '聊天' })).toBeVisible({ timeout: 10000 });
        await fabMenu.getByRole('button', { name: '聊天' }).click();
        const exitButton = fabMenu.locator('[data-fab-id="exit"]');
        await expect(exitButton).toBeVisible({ timeout: 10000 });
        await exitButton.click();
        await expect(page.getByTestId('fab-panel-exit')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(250);

        const metrics = await readPortraitHudMetrics(page);
        console.log(`TicTacToe portrait HUD metrics: ${JSON.stringify(metrics)}`);
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, '井字棋竖屏回合HUD和离开菜单'),
            fullPage: false,
        });

        expect(metrics.leftNameLines, '左侧玩家名应保持单行').toHaveLength(1);
        expect(metrics.rightNameLines, '右侧玩家名应保持单行').toHaveLength(1);
        expect(metrics.turnNameLines, '当前玩家名应保持单行').toHaveLength(1);
        expect(metrics.turnSuffixLines, '回合后缀应保持单行').toHaveLength(1);
        expect(metrics.turnSuffixLines[0].top).toBeGreaterThanOrEqual(metrics.turnNameLines[0].bottom - 1);
        expect(metrics.hudRight!.right).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.hudRight!.left).toBeGreaterThanOrEqual(metrics.hudCenter!.right - 1);
        expect(metrics.pageOverflowX).toBeLessThanOrEqual(1);
        expect(metrics.fabHudOverlaps, '右侧悬浮菜单热区不能压住任一分数/回合栏').toEqual([]);
        expect(metrics.exitPanelOverlapsHud, '离开菜单不能盖住比分或当前回合文字').toEqual([]);
        expect(metrics.fabButtonSizes.length).toBeGreaterThan(0);
        expect(metrics.fabButtonSizes.every(({ hitWidth, hitHeight, visualWidth, visualHeight }) =>
            hitWidth >= 44 && hitHeight >= 44 && visualWidth >= 40 && visualHeight >= 40)).toBe(true);
        expect(metrics.debugOverlapsHud, '调试入口不能压住任一分数/回合栏').toEqual([]);
        await expect(page.getByRole('button', { name: /结束游戏/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /暂时离开/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /结束游戏/ })).toBeEnabled();
        await expect(page.getByRole('button', { name: /暂时离开/ })).toBeEnabled();

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(250);
        const desktopMetrics = await readPortraitHudMetrics(page);
        expect(desktopMetrics.turnNameLines, 'PC 当前玩家名仍应单行').toHaveLength(1);
        expect(desktopMetrics.turnSuffixLines, 'PC 回合后缀仍应单行').toHaveLength(1);
        expect(desktopMetrics.turnNameLines[0].top).toBeLessThan(desktopMetrics.turnSuffixLines[0].bottom);
        expect(desktopMetrics.turnSuffixLines[0].top).toBeLessThan(desktopMetrics.turnNameLines[0].bottom);
    });
});
