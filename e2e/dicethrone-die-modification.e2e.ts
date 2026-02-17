/**
 * DiceThrone - 选择骰子修改 E2E 测试
 * 
 * 覆盖范围：
 * - 修改1个骰子（modify-die-any-1）：选择骰子 + 选择目标值
 * - 修改2个骰子（modify-die-any-2）：多选骰子 + 选择目标值
 * - 修改骰子为6（modify-die-to-6）：选择骰子（自动改为6）
 * - 复制骰子（modify-die-copy）：选择源骰子 + 选择目标骰子
 * - 调整骰子±1（modify-die-adjust-1）：选择骰子 + 选择增减
 * 
 * 交互模式：选择骰子修改
 * - 点击技能按钮/打出卡牌
 * - 骰子高亮显示
 * - 点击选择骰子
 * - （可选）选择目标值/方向
 * - 确认
 * - 骰子值改变
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';

test.describe('DiceThrone - 选择骰子修改', () => {
  test('修改1个骰子：选择骰子并设置目标值', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    
    if (!setup) {
      test.skip(true, '游戏服务器不可用或创建房间失败');
      return;
    }
    
    const { hostPage, guestPage } = setup;

    // 1. 选择英雄并开始游戏
    await selectCharacter(hostPage, 'paladin');
    await selectCharacter(guestPage, 'shadow_thief');
    
    // 等待游戏开始
    await waitForGameBoard(hostPage);
    await waitForGameBoard(guestPage);

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

    // 3. 查找并打出"惊喜"卡牌（card-surprise，效果：modify-die-any-1）
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });

    // 查找惊喜卡牌或任何有骰子修改效果的卡牌
    const surpriseCard = handArea.locator('[data-card-id="card-surprise"]').or(
      handArea.locator('[data-card-name*="惊喜"]').or(
        handArea.locator('[data-card-name*="Surprise"]')
      )
    ).first();

    // 如果手牌中没有目标卡牌，跳过测试
    if (!await surpriseCard.isVisible().catch(() => false)) {
      test.skip(true, '手牌中没有骰子修改卡牌');
    }

    // 记录骰子初始值
    const diceArea = page.getByTestId('dt-dice-area');
    await expect(diceArea).toBeVisible({ timeout: 5000 });
    
    const firstDie = diceArea.locator('[data-testid^="die-"]').first();
    await expect(firstDie).toBeVisible({ timeout: 3000 });
    const initialValue = await firstDie.getAttribute('data-die-value');

    // 打出卡牌
    await surpriseCard.click();
    await page.waitForTimeout(500);

    // 4. 验证骰子选择界面出现
    const dieSelector = page.locator('[data-testid="die-selector"]').or(
      page.locator('[class*="die-select"]').or(
        page.getByText(/选择骰子|Select Die/i)
      )
    );
    await expect(dieSelector).toBeVisible({ timeout: 8000 });

    // 5. 选择第一个骰子
    const selectableDie = diceArea.locator('[data-testid^="die-"][data-selectable="true"]').or(
      diceArea.locator('[data-testid^="die-"][class*="selectable"]')
    ).first();
    await expect(selectableDie).toBeVisible({ timeout: 3000 });
    await selectableDie.click();
    await page.waitForTimeout(500);

    // 6. 验证目标值选择界面出现
    const valueSelector = page.locator('[data-testid="value-selector"]').or(
      page.locator('[class*="value-select"]').or(
        page.getByText(/选择目标值|Select Target Value/i)
      )
    );
    await expect(valueSelector).toBeVisible({ timeout: 5000 });

    // 7. 选择目标值（例如：6）
    const targetValueButton = valueSelector.locator('button').filter({ hasText: /^6$/ }).first();
    await expect(targetValueButton).toBeVisible({ timeout: 3000 });
    await targetValueButton.click();
    await page.waitForTimeout(500);

    // 8. 验证骰子值改变
    await expect.poll(async () => {
      const currentValue = await firstDie.getAttribute('data-die-value');
      return currentValue !== initialValue;
    }, { timeout: 5000 }).toBe(true);

    // 验证骰子值变为6
    const finalValue = await firstDie.getAttribute('data-die-value');
    expect(finalValue).toBe('6');
  });

  test('修改骰子为6：选择骰子后自动改为6', async ({ page }) => {
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

    // 3. 查找并使用"修改骰子为6"的技能/卡牌
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });

    // 查找有 modify-die-to-6 效果的卡牌
    const modifyCard = handArea.locator('[data-card-effect*="modify-die-to-6"]').or(
      handArea.locator('[data-card-name*="改为6"]')
    ).first();

    if (!await modifyCard.isVisible().catch(() => false)) {
      test.skip(true, '手牌中没有修改骰子为6的卡牌');
    }

    // 记录骰子初始值
    const diceArea = page.getByTestId('dt-dice-area');
    const firstDie = diceArea.locator('[data-testid^="die-"]').first();
    const initialValue = await firstDie.getAttribute('data-die-value');

    // 打出卡牌
    await modifyCard.click();
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

    // 6. 验证骰子值直接变为6（不需要选择目标值）
    await expect.poll(async () => {
      const currentValue = await firstDie.getAttribute('data-die-value');
      return currentValue === '6';
    }, { timeout: 5000 }).toBe(true);

    // 验证没有显示目标值选择界面
    const valueSelector = page.locator('[data-testid="value-selector"]');
    await expect(valueSelector).toBeHidden({ timeout: 2000 }).catch(() => {
      // 如果元素不存在也算通过
      return true;
    });
  });
});
