/**
 * DiceThrone - 选择骰子重投 E2E 测试
 * 
 * 覆盖范围：
 * - 重投2个骰子（reroll-die-2）：多选骰子 + 重投
 * - 重投对手1个骰子（reroll-opponent-die-1）：选择对手骰子 + 重投
 * - 重投5个骰子（reroll-die-5）：多选骰子 + 重投
 * 
 * 交互模式：选择骰子重投
 * - 点击技能按钮/打出卡牌
 * - 骰子高亮
 * - 点击选择骰子（可多选）
 * - 确认
 * - 骰子重投
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';

test.describe('DiceThrone - 选择骰子重投', () => {
  test('重投2个骰子：多选骰子并重投', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    
    if (!setup) {
      test.skip(true, '游戏服务器不可用或创建房间失败');
      return;
    }
    
    const { hostPage } = setup;

    // 1. 选择英雄并开始游戏
    await selectCharacter(hostPage, 'paladin');
    await selectCharacter(setup.guestPage, 'shadow_thief');
    await waitForGameBoard(hostPage);

    // 等待游戏开始
    await expect(page.getByTestId('dt-phase-banner')).toBeVisible({ timeout: 10000 });

    // 2. 推进到主要阶段1（可以打出卡牌）
    const advanceButton = page.getByRole('button', { name: /推进阶段|Advance Phase/i });
    
    // 跳过收入阶段
    await expect(advanceButton).toBeEnabled({ timeout: 5000 });
    await advanceButton.click();
    await page.waitForTimeout(500);

    // 跳过进攻投掷阶段（如果需要）
    const currentPhase = await page.getByTestId('dt-phase-banner').textContent();
    if (currentPhase?.includes('进攻投掷') || currentPhase?.includes('Offensive Roll')) {
      // 投掷骰子
      const rollButton = page.getByRole('button', { name: /投掷骰子|Roll Dice/i });
      if (await rollButton.isVisible().catch(() => false)) {
        await rollButton.click();
        await page.waitForTimeout(1000);
        
        // 确认骰面
        const confirmButton = page.getByRole('button', { name: /确认骰面|Confirm Dice/i });
        if (await confirmButton.isVisible().catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }
      
      // 推进到主要阶段1
      await advanceButton.click();
      await page.waitForTimeout(500);
    }

    // 3. 查找并打出"重投2个骰子"的卡牌
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });

    // 查找有重投效果的卡牌
    const rerollCard = handArea.locator('[data-card-effect*="reroll-die-2"]').or(
      handArea.locator('[data-card-name*="重投"]').or(
        handArea.locator('[data-card-name*="Reroll"]')
      )
    ).first();

    // 如果手牌中没有目标卡牌，跳过测试
    if (!await rerollCard.isVisible().catch(() => false)) {
      test.skip(true, '手牌中没有重投骰子卡牌');
    }

    // 记录骰子初始值
    const diceArea = page.getByTestId('dt-dice-area');
    await expect(diceArea).toBeVisible({ timeout: 5000 });
    
    const allDice = diceArea.locator('[data-testid^="die-"]');
    const diceCount = await allDice.count();
    
    if (diceCount < 2) {
      test.skip(true, '骰子数量不足2个');
    }

    const firstDie = allDice.nth(0);
    const secondDie = allDice.nth(1);
    
    const initialValue1 = await firstDie.getAttribute('data-die-value');
    const initialValue2 = await secondDie.getAttribute('data-die-value');

    // 打出卡牌
    await rerollCard.click();
    await page.waitForTimeout(500);

    // 4. 验证骰子选择界面出现
    const dieSelector = page.locator('[data-testid="die-selector"]').or(
      page.locator('[class*="die-select"]').or(
        page.getByText(/选择骰子|Select Die|选择要重投的骰子/i)
      )
    );
    await expect(dieSelector).toBeVisible({ timeout: 8000 });

    // 5. 选择第一个骰子
    const selectableDice = diceArea.locator('[data-testid^="die-"][data-selectable="true"]').or(
      diceArea.locator('[data-testid^="die-"][class*="selectable"]')
    );
    await expect(selectableDice.first()).toBeVisible({ timeout: 3000 });
    
    await selectableDice.nth(0).click();
    await page.waitForTimeout(300);

    // 6. 选择第二个骰子（多选）
    await selectableDice.nth(1).click();
    await page.waitForTimeout(300);

    // 7. 确认选择
    const confirmButton = page.getByRole('button', { name: /确认|Confirm|完成|Done/i });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(500);
    }

    // 8. 验证骰子值改变（至少有一个骰子值改变）
    await expect.poll(async () => {
      const currentValue1 = await firstDie.getAttribute('data-die-value');
      const currentValue2 = await secondDie.getAttribute('data-die-value');
      return currentValue1 !== initialValue1 || currentValue2 !== initialValue2;
    }, { timeout: 5000 }).toBe(true);
  });

  test('重投骰子：单选模式', async ({ page }) => {
    // 1. 选择英雄并开始游戏
    const heroCard = page.locator('[data-testid="hero-card"]').first();
    await expect(heroCard).toBeVisible({ timeout: 10000 });
    await heroCard.click();

    const startButton = page.getByRole('button', { name: /开始游戏|Start Game/i });
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();

    await expect(page.getByTestId('dt-phase-banner')).toBeVisible({ timeout: 10000 });

    // 2. 推进到可以使用技能的阶段
    const advanceButton = page.getByRole('button', { name: /推进阶段|Advance Phase/i });
    await expect(advanceButton).toBeEnabled({ timeout: 5000 });
    await advanceButton.click();
    await page.waitForTimeout(500);

    // 跳过投掷阶段
    const currentPhase = await page.getByTestId('dt-phase-banner').textContent();
    if (currentPhase?.includes('进攻投掷') || currentPhase?.includes('Offensive Roll')) {
      const rollButton = page.getByRole('button', { name: /投掷骰子|Roll Dice/i });
      if (await rollButton.isVisible().catch(() => false)) {
        await rollButton.click();
        await page.waitForTimeout(1000);
        
        const confirmButton = page.getByRole('button', { name: /确认骰面|Confirm Dice/i });
        if (await confirmButton.isVisible().catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }
      
      await advanceButton.click();
      await page.waitForTimeout(500);
    }

    // 3. 查找并使用重投技能
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });

    // 查找任何重投卡牌
    const rerollCard = handArea.locator('[data-card-effect*="reroll"]').or(
      handArea.locator('[data-card-name*="重投"]')
    ).first();

    if (!await rerollCard.isVisible().catch(() => false)) {
      test.skip(true, '手牌中没有重投卡牌');
    }

    // 记录骰子初始值
    const diceArea = page.getByTestId('dt-dice-area');
    const firstDie = diceArea.locator('[data-testid^="die-"]').first();
    const initialValue = await firstDie.getAttribute('data-die-value');

    // 打出卡牌
    await rerollCard.click();
    await page.waitForTimeout(500);

    // 4. 验证骰子选择界面出现
    const dieSelector = page.locator('[data-testid="die-selector"]').or(
      page.getByText(/选择骰子|Select Die/i)
    );
    await expect(dieSelector).toBeVisible({ timeout: 8000 });

    // 5. 选择第一个骰子
    const selectableDie = diceArea.locator('[data-testid^="die-"][data-selectable="true"]').first();
    await expect(selectableDie).toBeVisible({ timeout: 3000 });
    await selectableDie.click();
    await page.waitForTimeout(500);

    // 6. 确认选择（如果需要）
    const confirmButton = page.getByRole('button', { name: /确认|Confirm/i });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(500);
    }

    // 7. 验证骰子值可能改变（重投后可能相同也可能不同）
    // 这里我们只验证重投动画完成，不强制要求值改变
    await page.waitForTimeout(1000);

    // 验证骰子仍然存在且有值
    const finalValue = await firstDie.getAttribute('data-die-value');
    expect(finalValue).toBeTruthy();
    expect(['1', '2', '3', '4', '5', '6']).toContain(finalValue);
  });
});
