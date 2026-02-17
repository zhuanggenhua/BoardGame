/**
 * 潜行 Token 免伤机制 E2E 测试
 * 
 * 测试场景：
 * 1. 潜行 token 在受伤时自动触发
 * 2. 潜行消耗后正确减少层数
 * 3. 潜行免除全部伤害
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';

test.describe('潜行 Token 免伤机制', () => {
    test('潜行 token 应该在受伤时自动触发并免除伤害', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL);
        
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        
        const { hostPage, guestPage } = setup;

        // 1. 选择影贼 vs 圣骑士
        await selectCharacter(hostPage, 'shadow_thief');
        await selectCharacter(guestPage, 'paladin');
        await waitForGameBoard(hostPage);

        // 2. 使用作弊命令给影贼添加潜行 token
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '1', // 影贼是玩家 1
                        tokenId: 'sneak',
                        amount: 1,
                    },
                });
            }
        });

        // 等待 token 显示
        await page.waitForTimeout(500);

        // 3. 验证潜行 token 存在
        const sneakToken = page.locator('[data-token-id="sneak"]').first();
        await expect(sneakToken).toBeVisible();
        await expect(sneakToken).toContainText('1');

        // 4. 记录影贼当前 HP
        const hpBefore = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });

        // 5. 使用作弊命令让圣骑士对影贼造成 5 点伤害
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '1',
                        amount: 5,
                    },
                });
            }
        });

        // 等待伤害处理
        await page.waitForTimeout(1000);

        // 6. 验证潜行 token 被消耗
        await expect(sneakToken).not.toBeVisible();

        // 7. 验证影贼 HP 未减少（伤害被免除）
        const hpAfter = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });
        expect(hpAfter).toBe(hpBefore);
    });

    test('潜行 token 应该只免除一次伤害', async ({ page }) => {
        // 1. 选择影贼 vs 圣骑士
        await page.getByRole('button', { name: /影贼|Shadow Thief/i }).click();
        await page.getByRole('button', { name: /圣骑士|Paladin/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 给影贼添加 1 层潜行
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '1',
                        tokenId: 'sneak',
                        amount: 1,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        // 3. 第一次伤害 - 应该被免除
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '1',
                        amount: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(1000);

        const hpAfterFirst = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });

        // 4. 第二次伤害 - 应该正常受伤（潜行已消耗）
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '1',
                        amount: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(1000);

        const hpAfterSecond = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });

        // 验证第二次伤害生效
        expect(hpAfterSecond).toBe(hpAfterFirst - 5);
    });

    test('多层潜行应该可以免除多次伤害', async ({ page }) => {
        // 1. 选择影贼 vs 圣骑士
        await page.getByRole('button', { name: /影贼|Shadow Thief/i }).click();
        await page.getByRole('button', { name: /圣骑士|Paladin/i }).click();
        await page.getByRole('button', { name: /开始游戏|Start Game/i }).click();

        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });

        // 2. 给影贼添加 2 层潜行（虽然规则上限是 1，但测试多层逻辑）
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_MODIFY_TOKENS',
                    payload: {
                        playerId: '1',
                        tokenId: 'sneak',
                        amount: 2,
                    },
                });
            }
        });

        await page.waitForTimeout(500);

        const hpInitial = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });

        // 3. 第一次伤害
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '1',
                        amount: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(1000);

        const hpAfterFirst = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });
        expect(hpAfterFirst).toBe(hpInitial); // 第一次免伤

        // 4. 第二次伤害
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '1',
                        amount: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(1000);

        const hpAfterSecond = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });
        expect(hpAfterSecond).toBe(hpInitial); // 第二次也免伤

        // 5. 第三次伤害 - 潜行已耗尽
        await page.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'CHEAT_DEAL_DAMAGE',
                    payload: {
                        targetId: '1',
                        amount: 5,
                    },
                });
            }
        });

        await page.waitForTimeout(1000);

        const hpAfterThird = await page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.players?.['1']?.resources?.hp ?? 0;
        });
        expect(hpAfterThird).toBe(hpInitial - 5); // 第三次正常受伤
    });
});
