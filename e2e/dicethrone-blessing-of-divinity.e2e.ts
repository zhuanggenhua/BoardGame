/**
 * 神圣祝福（Blessing of Divinity）致死伤害触发 E2E 测试
 * 
 * 测试场景：
 * 1. 致死伤害时触发，HP 设为 1 并回复 5（总计 6）
 * 2. 非致死伤害不触发
 * 3. 触发后 token 被消耗
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';

test.describe('神圣祝福致死伤害触发', () => {
    test('神圣祝福应该在致死伤害时触发', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        
        const { hostPage, guestPage } = setup;

        // 1. 选择圣骑士 vs 影贼
        await selectCharacter(hostPage, 'paladin');
        await selectCharacter(guestPage, 'shadow_thief');
        await waitForGameBoard(hostPage);

        // 2. 给圣骑士添加神圣祝福 token
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0', // 圣骑士是玩家 0
                        tokenId: 'blessing-of-divinity',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 验证神圣祝福 token 存在
        const blessingToken = page.locator('[data-token-id="blessing-of-divinity"]').first();
        await expect(blessingToken).toBeVisible();

        // 4. 将圣骑士 HP 降低到 5
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_SET_HP',
                    payload: {
                        playerId: '0',
                        hp: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 验证 HP 为 5
        const hpBefore = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['0']?.resources?.hp ?? 0;
        });
        expect(hpBefore).toBe(5);

        // 5. 造成 10 点致死伤害（5 HP 无法承受）
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '0',
                        amount: 10,
                    },
                });
            }
        });

        // 等待神圣祝福触发
        await page.waitForTimeout(1500);

        // 6. 验证神圣祝福 token 被消耗
        await expect(blessingToken).not.toBeVisible();

        // 7. 验证 HP 被设为 6（1 + 5 回复）
        const hpAfter = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['0']?.resources?.hp ?? 0;
        });
        expect(hpAfter).toBe(6);
    });

    test('神圣祝福不应该在非致死伤害时触发', async ({ page }) => {
        // 1. 选择圣骑士 vs 影贼
        await page.getByRole('button', { name: /圣骑士|Paladin/i }).click();
        await page.getByRole('button', { name: /影贼|Shadow Thief/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 给圣骑士添加神圣祝福 token
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0',
                        tokenId: 'blessing-of-divinity',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 验证神圣祝福 token 存在
        const blessingToken = page.locator('[data-token-id="blessing-of-divinity"]').first();
        await expect(blessingToken).toBeVisible();

        // 4. 记录当前 HP
        const hpBefore = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['0']?.resources?.hp ?? 0;
        });

        // 5. 造成 5 点非致死伤害
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '0',
                        amount: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(1000);

        // 6. 验证神圣祝福 token 仍然存在（未触发）
        await expect(blessingToken).toBeVisible();

        // 7. 验证 HP 正常减少
        const hpAfter = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['0']?.resources?.hp ?? 0;
        });
        expect(hpAfter).toBe(hpBefore - 5);
    });

    test('神圣祝福应该在恰好致死时触发', async ({ page }) => {
        // 1. 选择圣骑士 vs 影贼
        await page.getByRole('button', { name: /圣骑士|Paladin/i }).click();
        await page.getByRole('button', { name: /影贼|Shadow Thief/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 给圣骑士添加神圣祝福 token
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0',
                        tokenId: 'blessing-of-divinity',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 将圣骑士 HP 降低到 10
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_SET_HP',
                    payload: {
                        playerId: '0',
                        hp: 10,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 4. 造成恰好 10 点伤害（HP 降至 0）
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '0',
                        amount: 10,
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        // 5. 验证神圣祝福触发，HP 为 6
        const hpAfter = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['0']?.resources?.hp ?? 0;
        });
        expect(hpAfter).toBe(6);

        // 6. 验证 token 被消耗
        const blessingToken = page.locator('[data-token-id="blessing-of-divinity"]').first();
        await expect(blessingToken).not.toBeVisible();
    });

    test('神圣祝福消耗后不应该再次触发', async ({ page }) => {
        // 1. 选择圣骑士 vs 影贼
        await page.getByRole('button', { name: /圣骑士|Paladin/i }).click();
        await page.getByRole('button', { name: /影贼|Shadow Thief/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 给圣骑士添加神圣祝福 token
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '0',
                        tokenId: 'blessing-of-divinity',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 将 HP 降低到 5
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_SET_HP',
                    payload: {
                        playerId: '0',
                        hp: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 4. 第一次致死伤害 - 应该触发
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '0',
                        amount: 10,
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        const hpAfterFirst = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['0']?.resources?.hp ?? 0;
        });
        expect(hpAfterFirst).toBe(6); // 触发，HP 为 6

        // 5. 第二次致死伤害 - 不应该触发（token 已消耗）
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '0',
                        amount: 10,
                    },
                });
            }
        });

        await page.waitForTimeout(1500);

        const hpAfterSecond = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['0']?.resources?.hp ?? 0;
        });
        expect(hpAfterSecond).toBe(0); // 未触发，HP 降至 0（游戏结束）
    });
});
