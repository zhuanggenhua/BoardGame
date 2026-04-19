/**
 * SmashUp E2E Test: Gnome Skip Option
 * 
 * 测试侏儒（Gnome）的跳过选项是否正常工作
 */

import { test, expect } from '../fixtures';

test.describe('SmashUp - Gnome Skip Option', () => {
    test('should allow skipping Gnome ability', async ({ smashupMatch }) => {
        const { page, player1Id, player2Id } = smashupMatch;

        // 等待游戏加载
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 构造测试场景：
        // - P1 有 Gnome 在手
        // - 基地上有 P2 的低力量随从
        await page.evaluate(({ p1, p2 }) => {
            const state = window.__BG_STATE__!();
            const newState = {
                ...state,
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        [p1]: {
                            ...state.core.players[p1],
                            hand: [
                                { uid: 'gnome-1', defId: 'trickster_gnome', type: 'minion' as const }
                            ]
                        }
                    },
                    bases: [
                        {
                            ...state.core.bases[0],
                            minions: [
                                // P1 已有 1 个随从（Gnome 打出后会是 2 个）
                                { uid: 'p1-minion-1', defId: 'trickster_gnome', controller: p1, owner: p1, attachedActions: [] },
                                // P2 有力量 1 的随从（< 2，可以被消灭）
                                { uid: 'p2-minion-1', defId: 'trickster_gnome', controller: p2, owner: p2, attachedActions: [] }
                            ]
                        },
                        ...state.core.bases.slice(1)
                    ]
                }
            };
            window.__BG_DISPATCH__!('CHEAT_SET_STATE', { state: newState });
        }, { p1: player1Id, p2: player2Id });

        // P1 打出 Gnome
        await page.click('[data-card-uid="gnome-1"]');
        await page.waitForTimeout(300);
        
        // 选择基地
        await page.click('[data-base-index="0"]');
        await page.waitForTimeout(500);

        // 应该出现交互提示：选择要消灭的随从或跳过
        const promptTitle = await page.textContent('[data-testid="prompt-overlay"] h2, [data-testid="prompt-overlay"] h3');
        expect(promptTitle).toContain('选择要消灭的随从');

        // 应该有 skip 按钮
        const skipButton = page.locator('button:has-text("跳过")');
        await expect(skipButton).toBeVisible();

        // 记录消灭前的随从数量
        const minionsBeforeSkip = await page.evaluate(() => {
            const state = window.__BG_STATE__!();
            return state.core.bases[0].minions.length;
        });

        // 点击跳过
        await skipButton.click();
        await page.waitForTimeout(500);

        // 验证：没有随从被消灭
        const minionsAfterSkip = await page.evaluate(() => {
            const state = window.__BG_STATE__!();
            return state.core.bases[0].minions.length;
        });

        expect(minionsAfterSkip).toBe(minionsBeforeSkip);

        // 验证：P2 的随从仍然存在
        const p2MinionExists = await page.evaluate(({ p2 }) => {
            const state = window.__BG_STATE__!();
            return state.core.bases[0].minions.some(m => m.uid === 'p2-minion-1' && m.controller === p2);
        }, { p2: player2Id });

        expect(p2MinionExists).toBe(true);
    });

    test('should allow destroying minion when not skipping', async ({ smashupMatch }) => {
        const { page, player1Id, player2Id } = smashupMatch;

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 构造相同场景
        await page.evaluate(({ p1, p2 }) => {
            const state = window.__BG_STATE__!();
            const newState = {
                ...state,
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        [p1]: {
                            ...state.core.players[p1],
                            hand: [
                                { uid: 'gnome-1', defId: 'trickster_gnome', type: 'minion' as const }
                            ]
                        }
                    },
                    bases: [
                        {
                            ...state.core.bases[0],
                            minions: [
                                { uid: 'p1-minion-1', defId: 'trickster_gnome', controller: p1, owner: p1, attachedActions: [] },
                                { uid: 'p2-minion-1', defId: 'trickster_gnome', controller: p2, owner: p2, attachedActions: [] }
                            ]
                        },
                        ...state.core.bases.slice(1)
                    ]
                }
            };
            window.__BG_DISPATCH__!('CHEAT_SET_STATE', { state: newState });
        }, { p1: player1Id, p2: player2Id });

        // P1 打出 Gnome
        await page.click('[data-card-uid="gnome-1"]');
        await page.waitForTimeout(300);
        await page.click('[data-base-index="0"]');
        await page.waitForTimeout(500);

        // 选择消灭 P2 的随从（点击卡牌或随从）
        const targetMinion = page.locator('[data-option-id*="minion"]').first();
        await targetMinion.click();
        await page.waitForTimeout(500);

        // 验证：P2 的随从被消灭
        const p2MinionExists = await page.evaluate(({ p2 }) => {
            const state = window.__BG_STATE__!();
            return state.core.bases[0].minions.some(m => m.uid === 'p2-minion-1' && m.controller === p2);
        }, { p2: player2Id });

        expect(p2MinionExists).toBe(false);
    });
});
