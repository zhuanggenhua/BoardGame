/**
 * 圣骑士 (Paladin) E2E 交互测试
 *
 * 覆盖交互面：
 * - 神圣祝福 (Blessing of Divinity) 触发：免疫伤害并回复生命
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard, readyAndStartGame } from './helpers/dicethrone';

/** 推进到攻击掷骰阶段 */
const advanceToOffensiveRoll = async (page: import('@playwright/test').Page) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const cancelBtn = page.getByRole('button', { name: /Cancel.*Select Ability|取消/i });
        if (await cancelBtn.isVisible({ timeout: 300 }).catch(() => false)) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
        }
        // 检查当前阶段 - 使用阶段列表中的高亮项
        const offensiveRollPhase = page.locator('text=/4\\. Offensive Roll Phase|4\\. 掷骰攻击阶段/i');
        const isOffensiveRoll = await offensiveRollPhase.isVisible({ timeout: 300 }).catch(() => false);
        
        if (isOffensiveRoll) {
            // 检查是否是当前激活的阶段（通常会有特殊样式）
            const phaseText = await offensiveRollPhase.textContent().catch(() => '');
            if (phaseText) {
                return;
            }
        }
        
        const nextPhaseButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        if (await nextPhaseButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
            await nextPhaseButton.click();
            await page.waitForTimeout(800);
        } else {
            await page.waitForTimeout(300);
        }
    }
};

test.describe('DiceThrone Paladin E2E', () => {
    test('Online match: Paladin Blessing of Divinity prevents lethal damage', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        // 选择英雄：野蛮人 vs 圣骑士
        await selectCharacter(hostPage, 'barbarian');
        await selectCharacter(guestPage, 'paladin');
        // 准备并开始游戏
        await readyAndStartGame(hostPage, guestPage);
        // 等待游戏开始
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);

        // 使用作弊命令设置圣骑士状态（玩家1）
        await hostPage.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                // 设置 HP 为 1
                dispatch({
                    type: 'SYS_CHEAT_SET_RESOURCE',
                    payload: {
                        playerId: '1',
                        resourceId: 'hp',
                        value: 1,
                    },
                });
                
                // 添加神圣祝福 token
                dispatch({
                    type: 'SYS_CHEAT_SET_TOKEN',
                    payload: {
                        playerId: '1',
                        tokenId: 'blessing-of-divinity',
                        amount: 1,
                    },
                });
            }
        });

        await hostPage.waitForTimeout(500);

        // 推进到攻击掷骰阶段
        await advanceToOffensiveRoll(hostPage);

        // 关闭可能出现的确认弹窗
        const skipModal = hostPage.getByRole('button', { name: /Cancel/i });
        if (await skipModal.isVisible({ timeout: 500 }).catch(() => false)) {
            await skipModal.click();
            await hostPage.waitForTimeout(300);
        }

        // 投掷骰子
        const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();
        // 等待投掷完成 - 检查 rollCount 是否增加
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_STATE__;
            return state?.core?.rollCount > 0;
        }, { timeout: 5000 });
        await hostPage.waitForTimeout(500); // 额外等待动画完成

        // 使用作弊命令设置骰子值
        await hostPage.evaluate(() => {
            const dispatch = (window as any).__BG_DISPATCH__;
            if (dispatch) {
                dispatch({
                    type: 'SYS_CHEAT_SET_DICE',
                    payload: {
                        diceValues: [6, 6, 6, 6, 1],
                    },
                });
            }
        });
        await hostPage.waitForTimeout(500); // 等待骰子值更新

        // 确认骰子
        const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();
        await hostPage.waitForTimeout(1000);

        // 选择技能槽
        const highlightedSlots = hostPage
            .locator('[data-ability-slot]')
            .filter({ has: hostPage.locator('div.animate-pulse[class*="border-"]') });
        await expect(highlightedSlots.first()).toBeVisible({ timeout: 8000 });
        await highlightedSlots.first().click();

        // 结算攻击
        const resolveAttackButton = hostPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
        await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
        await resolveAttackButton.click();

        // 等待进入主要阶段2
        await expect(hostPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 15000 });

        // 验证圣骑士 HP 和 token
        const finalState = await hostPage.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            const paladin = state?.players?.['1'];
            return {
                hp: paladin?.resources?.hp ?? 0,
                blessingToken: paladin?.tokens?.['blessing-of-divinity'] ?? 0,
            };
        });

        expect(finalState.hp).toBe(6); // 1 + 5 回复
        expect(finalState.blessingToken).toBe(0); // token 被消耗

        await hostPage.screenshot({ path: testInfo.outputPath('paladin-blessing-prevent.png'), fullPage: false });
        await guestContext.close();
        await hostContext.close();
    });
});
