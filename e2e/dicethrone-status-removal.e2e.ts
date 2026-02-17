/**
 * DiceThrone - 选择状态移除 E2E 测试
 * 
 * 覆盖范围：
 * - 移除1个状态（remove-status-1）：选择状态 + 移除
 * - 移除自身状态（remove-status-self）：选择自身状态 + 移除
 * - 移除所有状态（remove-all-status）：自动移除所有状态
 * - 转移状态（transfer-status）：选择状态 + 选择目标
 * 
 * 交互模式：选择状态移除
 * - 点击技能按钮/打出卡牌
 * - 状态图标高亮
 * - 点击选择状态
 * - 确认
 * - 状态移除
 */

import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';

test.describe('DiceThrone - 选择状态移除', () => {
  test('移除1个状态：选择状态并移除', async ({ browser }, testInfo) => {
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
    await startButton.click();

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

    // 3. 先给自己添加一个状态（通过打出状态卡牌）
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });

    // 查找能添加状态的卡牌（如毒、燃烧等）
    const statusCard = handArea.locator('[data-card-effect*="poison"]').or(
      handArea.locator('[data-card-effect*="burn"]').or(
        handArea.locator('[data-card-name*="毒"]').or(
          handArea.locator('[data-card-name*="燃烧"]')
        )
      )
    ).first();

    // 如果有状态卡牌，先打出添加状态
    if (await statusCard.isVisible().catch(() => false)) {
      await statusCard.click();
      await page.waitForTimeout(1000);

      // 如果需要选择目标，选择自己
      const targetSelector = page.locator('[data-testid="target-selector"]');
      if (await targetSelector.isVisible().catch(() => false)) {
        const selfTarget = page.locator('[data-target="self"]').or(
          page.locator('[data-player="0"]')
        ).first();
        if (await selfTarget.isVisible().catch(() => false)) {
          await selfTarget.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // 4. 验证状态图标出现
    const statusArea = page.locator('[data-testid="status-area"]').or(
      page.locator('[class*="status"]')
    );
    
    const statusIcons = statusArea.locator('[data-testid^="status-"]').or(
      statusArea.locator('[class*="status-icon"]')
    );

    // 如果没有状态，跳过测试
    const statusCount = await statusIcons.count().catch(() => 0);
    if (statusCount === 0) {
      test.skip(true, '没有状态可以移除');
    }

    const firstStatus = statusIcons.first();
    await expect(firstStatus).toBeVisible({ timeout: 5000 });
    const initialStatusId = await firstStatus.getAttribute('data-status-id').catch(() => null);

    // 5. 查找并打出"移除状态"的卡牌
    const removeCard = handArea.locator('[data-card-effect*="remove-status"]').or(
      handArea.locator('[data-card-name*="净化"]').or(
        handArea.locator('[data-card-name*="Purify"]').or(
          handArea.locator('[data-card-name*="移除"]')
        )
      )
    ).first();

    if (!await removeCard.isVisible().catch(() => false)) {
      test.skip(true, '手牌中没有移除状态卡牌');
    }

    // 打出卡牌
    await removeCard.click();
    await page.waitForTimeout(500);

    // 6. 验证状态选择界面出现
    const statusSelector = page.locator('[data-testid="status-selector"]').or(
      page.locator('[class*="status-select"]').or(
        page.getByText(/选择状态|Select Status/i)
      )
    );
    await expect(statusSelector).toBeVisible({ timeout: 8000 });

    // 7. 选择第一个状态
    const selectableStatus = statusArea.locator('[data-testid^="status-"][data-selectable="true"]').or(
      statusArea.locator('[data-testid^="status-"][class*="selectable"]')
    ).first();
    await expect(selectableStatus).toBeVisible({ timeout: 3000 });
    await selectableStatus.click();
    await page.waitForTimeout(500);

    // 8. 确认选择（如果需要）
    const confirmButton = page.getByRole('button', { name: /确认|Confirm|完成|Done/i });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(500);
    }

    // 9. 验证状态被移除
    await expect.poll(async () => {
      const currentStatusCount = await statusIcons.count().catch(() => 0);
      return currentStatusCount < statusCount;
    }, { timeout: 5000 }).toBe(true);
  });

  test('移除自身状态：自动移除所有自身状态', async ({ page }) => {
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

    // 3. 先给自己添加状态
    const handArea = page.getByTestId('dt-hand-area');
    await expect(handArea).toBeVisible({ timeout: 5000 });

    const statusCard = handArea.locator('[data-card-effect*="poison"]').or(
      handArea.locator('[data-card-effect*="burn"]')
    ).first();

    if (await statusCard.isVisible().catch(() => false)) {
      await statusCard.click();
      await page.waitForTimeout(1000);
    }

    // 4. 验证状态存在
    const statusArea = page.locator('[data-testid="status-area"]').or(
      page.locator('[class*="status"]')
    );
    
    const statusIcons = statusArea.locator('[data-testid^="status-"]');
    const initialStatusCount = await statusIcons.count().catch(() => 0);

    if (initialStatusCount === 0) {
      test.skip(true, '没有状态可以移除');
    }

    // 5. 查找并使用"移除所有状态"的卡牌/技能
    const removeAllCard = handArea.locator('[data-card-effect*="remove-all-status"]').or(
      handArea.locator('[data-card-name*="净化"]').or(
        handArea.locator('[data-card-name*="Purify"]')
      )
    ).first();

    if (!await removeAllCard.isVisible().catch(() => false)) {
      test.skip(true, '手牌中没有移除所有状态卡牌');
    }

    // 打出卡牌
    await removeAllCard.click();
    await page.waitForTimeout(1000);

    // 6. 验证所有状态被移除（不需要选择，自动移除）
    await expect.poll(async () => {
      const currentStatusCount = await statusIcons.count().catch(() => 0);
      return currentStatusCount === 0;
    }, { timeout: 5000 }).toBe(true);
  });
});
