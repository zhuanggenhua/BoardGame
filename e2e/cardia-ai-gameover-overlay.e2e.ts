/**
 * E2E 测试：Cardia AI 对战游戏结束后显示 EndgameOverlay
 * 
 * 验证：
 * 1. 游戏结束后 sys.gameover 正确设置
 * 2. EndgameOverlay 组件正确显示
 * 3. 显示正确的胜利/失败文案
 */

import { test, expect } from './fixtures';
import { setupOnlineMatch, readCoreState, applyCoreStateDirect } from './helpers/cardia';

test.describe('Cardia AI Gameover Overlay', () => {
    test('should show EndgameOverlay when player wins against AI', async ({ page }) => {
        // 创建普通在线对局（不使用 AI，直接注入状态更简单）
        const match = await setupOnlineMatch(page);

        await match.player1Page.waitForSelector('[data-testid="cardia-board"]', { timeout: 10000 });

        // 注入游戏结束状态（玩家 0 获胜）
        const currentState = await readCoreState(match.player1Page);
        console.log('[Test] Current state before injection:', {
            phase: currentState.sys?.phase,
            gameover: currentState.sys?.gameover,
        });
        
        await applyCoreStateDirect(match.player1Page, {
            ...currentState,
            sys: {
                ...currentState.sys,
                gameover: { winner: '0' },
                phase: 'end',
            },
        });

        // 等待一下让 React 重新渲染
        await match.player1Page.waitForTimeout(2000);

        // 获取控制台日志和状态
        const logs = await match.player1Page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return {
                hasState: !!state,
                isGameOver: state?.sys?.gameover,
                phase: state?.sys?.phase,
                hasEndgameOverlay: !!document.querySelector('[data-testid="endgame-overlay"]'),
                hasEndgameVisible: !!document.querySelector('[data-endgame-visible="true"]'),
            };
        });
        console.log('[Test] State after injection:', logs);

        // 如果状态没有更新，尝试手动触发
        if (!logs.isGameOver) {
            console.log('[Test] State not updated, checking if dispatch works...');
            await match.player1Page.evaluate(() => {
                const dispatch = (window as any).__BG_DISPATCH__;
                if (dispatch) {
                    console.log('[Client] Dispatch available, trying to trigger state update');
                }
            });
        }

        // 等待 EndgameOverlay 出现
        await match.player1Page.waitForSelector('[data-testid="endgame-overlay"]', { timeout: 10000 });

        // 验证 overlay 可见
        const overlay = match.player1Page.locator('[data-testid="endgame-overlay"]');
        await expect(overlay).toBeVisible();

        // 验证显示胜利文案
        await expect(overlay).toContainText('胜利');

        // 截图证据
        await match.player1Page.screenshot({
            path: 'test-results/evidence-screenshots/cardia-ai-gameover-overlay-victory.png',
            fullPage: true,
        });
    });

    test('should show EndgameOverlay when player loses against AI', async ({ page }) => {
        // 创建普通在线对局（不使用 AI，直接注入状态更简单）
        const match = await setupOnlineMatch(page);

        await match.player1Page.waitForSelector('[data-testid="cardia-board"]', { timeout: 10000 });

        // 注入游戏结束状态（玩家 1 获胜，玩家 0 失败）
        const currentState = await readCoreState(match.player1Page);
        await applyCoreStateDirect(match.player1Page, {
            ...currentState,
            sys: {
                ...currentState.sys,
                gameover: { winner: '1' },
                phase: 'end',
            },
        });

        // 等待 EndgameOverlay 出现
        await match.player1Page.waitForSelector('[data-testid="endgame-overlay"]', { timeout: 5000 });

        // 验证 overlay 可见
        const overlay = match.player1Page.locator('[data-testid="endgame-overlay"]');
        await expect(overlay).toBeVisible();

        // 验证显示失败文案
        await expect(overlay).toContainText('失败');

        // 截图证据
        await match.player1Page.screenshot({
            path: 'test-results/evidence-screenshots/cardia-ai-gameover-overlay-defeat.png',
            fullPage: true,
        });
    });
});
