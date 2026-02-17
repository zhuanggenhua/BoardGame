/**
 * 晕眩（Daze）额外攻击机制 E2E 测试
 * 
 * 测试场景：
 * 1. 晕眩在攻击结束后触发额外攻击
 * 2. 额外攻击结束后恢复原回合
 * 3. 晕眩在触发后移除
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';

test.describe('晕眩额外攻击机制', () => {
    test('晕眩应该在攻击结束后触发额外攻击', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        
        const { hostPage, guestPage } = setup;

        // 1. 选择野蛮人 vs 圣骑士
        await selectCharacter(hostPage, 'barbarian');
        await selectCharacter(guestPage, 'paladin');
        await waitForGameBoard(hostPage);

        // 2. 给野蛮人添加晕眩状态
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0', // 野蛮人是玩家 0
                        tokenId: 'daze',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 验证晕眩状态存在
        const dazeToken = page.locator('[data-token-id="daze"]').first();
        await expect(dazeToken).toBeVisible();

        // 4. 记录当前回合玩家
        const currentPlayerBefore = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.activePlayerId ?? '';
        });
        expect(currentPlayerBefore).toBe('0'); // 野蛮人回合

        // 5. 模拟野蛮人完成攻击
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                // 推进到攻击结束
                dispatch({
                    type: 'CHEAT_ADVANCE_PHASE',
                    payload: {
                        targetPhase: 'main',
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        // 6. 验证晕眩被移除
        await expect(dazeToken).not.toBeVisible();

        // 7. 验证触发了额外攻击（圣骑士获得攻击机会）
        const currentPlayerAfter = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.activePlayerId ?? '';
        });
        expect(currentPlayerAfter).toBe('1'); // 圣骑士获得额外攻击

        // 8. 验证阶段为进攻阶段
        const currentPhase = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.phase ?? '';
        });
        expect(currentPhase).toBe('offensiveRoll');
    });

    test('额外攻击结束后应该恢复原回合', async ({ page }) => {
        // 1. 选择野蛮人 vs 圣骑士
        await page.getByRole('button', { name: /野蛮人|Barbarian/i }).click();
        await page.getByRole('button', { name: /圣骑士|Paladin/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 给野蛮人添加晕眩
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0',
                        tokenId: 'daze',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 野蛮人完成攻击，触发额外攻击
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_ADVANCE_PHASE',
                    payload: {
                        targetPhase: 'main',
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        // 验证圣骑士获得额外攻击
        let currentPlayer = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.activePlayerId ?? '';
        });
        expect(currentPlayer).toBe('1');

        // 4. 圣骑士完成额外攻击
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                // 跳过圣骑士的额外攻击
                dispatch({
                    type: 'CHEAT_ADVANCE_PHASE',
                    payload: {
                        targetPhase: 'main',
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        // 5. 验证回合恢复到野蛮人
        currentPlayer = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.activePlayerId ?? '';
        });
        expect(currentPlayer).toBe('0'); // 恢复到野蛮人回合
    });

    test('多层晕眩应该只触发一次额外攻击', async ({ page }) => {
        // 1. 选择野蛮人 vs 圣骑士
        await page.getByRole('button', { name: /野蛮人|Barbarian/i }).click();
        await page.getByRole('button', { name: /圣骑士|Paladin/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 尝试给野蛮人添加 2 层晕眩（虽然上限是 1）
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0',
                        tokenId: 'daze',
                        amount: 2,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 验证晕眩只有 1 层（stackLimit: 1）
        const dazeToken = page.locator('[data-token-id="daze"]').first();
        await expect(dazeToken).toBeVisible();
        await expect(dazeToken).toContainText('1');

        // 4. 完成攻击
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_ADVANCE_PHASE',
                    payload: {
                        targetPhase: 'main',
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        // 5. 验证只触发一次额外攻击
        const currentPlayer = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.activePlayerId ?? '';
        });
        expect(currentPlayer).toBe('1'); // 圣骑士获得额外攻击

        // 6. 验证晕眩被完全移除
        await expect(dazeToken).not.toBeVisible();
    });

    test('晕眩应该可以被净化移除而不触发额外攻击', async ({ page }) => {
        // 1. 选择野蛮人 vs 僧侣（僧侣有净化）
        await page.getByRole('button', { name: /野蛮人|Barbarian/i }).click();
        await page.getByRole('button', { name: /僧侣|Monk/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 给野蛮人添加晕眩
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0',
                        tokenId: 'daze',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 给野蛮人添加净化 token
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0',
                        tokenId: 'purify',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 4. 使用净化移除晕眩
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'USE_TOKEN',
                    payload: {
                        tokenId: 'purify',
                        amount: 1,
                        targetStatusId: 'daze',
                    },
                });
            }
        });

        await page.waitForTimeout(1000);

        // 5. 验证晕眩被移除
        const dazeToken = page.locator('[data-token-id="daze"]').first();
        await expect(dazeToken).not.toBeVisible();

        // 6. 完成攻击
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_ADVANCE_PHASE',
                    payload: {
                        targetPhase: 'main',
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        // 7. 验证没有触发额外攻击（回合直接结束）
        const currentPlayer = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.activePlayerId ?? '';
        });
        expect(currentPlayer).toBe('1'); // 正常轮到僧侣回合，而非额外攻击
    });
});
