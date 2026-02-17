/**
 * 圣骑士 (Paladin) E2E 交互测试
 *
 * 覆盖交互面：
 * - 神圣祝福 (Blessing of Divinity) 触发：免疫伤害并回复生命
 */

import { test, expect } from '@playwright/test';
import { 
    setupDTOnlineMatch, 
    selectCharacter, 
    waitForGameBoard, 
    readyAndStartGame,
    setPlayerResource,
    setPlayerToken,
    applyDiceValues,
    readCoreState,
} from './helpers/dicethrone';

/** 推进到攻击掷骰阶段 */
const advanceToOffensiveRoll = async (page: import('@playwright/test').Page) => {
    // 使用调试面板读取当前阶段
    const { readCoreState } = await import('./helpers/dicethrone');
    
    for (let attempt = 0; attempt < 15; attempt += 1) {
        // 关闭可能出现的技能选择弹窗
        const cancelBtn = page.getByRole('button', { name: /Cancel.*Select Ability|取消/i });
        if (await cancelBtn.isVisible({ timeout: 300 }).catch(() => false)) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
        }
        
        // 读取当前阶段
        const state = await readCoreState(page);
        const currentPhase = state.sys?.phase || state.phase;
        
        // 如果已经在攻击掷骰阶段，返回
        if (currentPhase === 'offensiveRoll') {
            return;
        }
        
        // 点击推进阶段按钮
        const nextPhaseButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        if (await nextPhaseButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
            await nextPhaseButton.click();
            await page.waitForTimeout(1000);
        } else {
            // 如果按钮不可用，等待一下再重试
            await page.waitForTimeout(500);
        }
    }
    
    throw new Error('无法推进到攻击掷骰阶段（超过 15 次尝试）');
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

        // 使用调试面板设置圣骑士状态（玩家1）
        await setPlayerResource(hostPage, '1', 'hp', 1);
        await setPlayerToken(hostPage, '1', 'blessing-of-divinity', 1);
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
        
        // 等待投掷完成
        await hostPage.waitForTimeout(1000);

        // 使用调试面板设置骰子值
        await applyDiceValues(hostPage, [6, 6, 6, 6, 1]);
        await hostPage.waitForTimeout(500);

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
        const finalState = await readCoreState(hostPage);
        const paladin = finalState.players?.['1'];
        
        expect(paladin?.resources?.hp ?? 0).toBe(6); // 1 + 5 回复
        expect(paladin?.tokens?.['blessing-of-divinity'] ?? 0).toBe(0); // token 被消耗

        await hostPage.screenshot({ path: testInfo.outputPath('paladin-blessing-prevent.png'), fullPage: false });
        await guestContext.close();
        await hostContext.close();
    });
});
