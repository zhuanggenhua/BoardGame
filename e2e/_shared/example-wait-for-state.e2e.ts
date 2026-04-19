/**
 * waitForState 工具使用示例
 * 
 * 展示如何使用智能状态轮询替代固定时间等待
 */

import { test, expect } from '@playwright/test';
import {
  waitForState,
  waitForCoreState,
  waitForSystemState,
  waitForPhaseChange,
  waitForInteractionComplete,
  waitForGameOver,
  waitForStateApplied,
} from '../helpers/waitForState';

test.describe('waitForState 工具示例', () => {
  test.skip('示例 1: 等待阶段变化', async ({ page }) => {
    // ❌ 旧方式：固定等待
    // await page.waitForTimeout(500);
    
    // ✅ 新方式：等待阶段变为 'attack'
    await waitForPhaseChange(page, 'attack');
  });

  test.skip('示例 2: 等待核心状态变化', async ({ page }) => {
    // ❌ 旧方式：固定等待
    // await page.waitForTimeout(1000);
    
    // ✅ 新方式：等待当前玩家变为 '1'
    await waitForCoreState(page, (core: any) => core.currentPlayer === '1');
  });

  test.skip('示例 3: 等待交互完成', async ({ page }) => {
    // ❌ 旧方式：固定等待
    // await page.waitForTimeout(500);
    
    // ✅ 新方式：等待交互队列为空
    await waitForInteractionComplete(page);
  });

  test.skip('示例 4: 等待状态应用', async ({ page }) => {
    // 应用状态
    await page.evaluate((newState) => {
      (window as any).__BG_DISPATCH__?.({ type: 'APPLY_STATE', payload: newState });
    }, { currentPlayer: '1' });
    
    // ❌ 旧方式：固定等待
    // await page.waitForTimeout(2000);
    
    // ✅ 新方式：等待状态应用完成
    await waitForStateApplied(page, (core: any) => core.currentPlayer === '1');
  });

  test.skip('示例 5: 等待游戏结束', async ({ page }) => {
    // ❌ 旧方式：固定等待
    // await page.waitForTimeout(2000);
    
    // ✅ 新方式：等待游戏结束
    await waitForGameOver(page);
  });

  test.skip('示例 6: 自定义条件', async ({ page }) => {
    // ❌ 旧方式：固定等待
    // await page.waitForTimeout(500);
    
    // ✅ 新方式：等待派系选择完成
    await waitForCoreState(page, (core: any) => 
      core.players?.['0']?.selectedFactions?.length > 0
    );
  });

  test.skip('示例 7: 自定义超时和消息', async ({ page }) => {
    // 等待特定条件，自定义超时时间和错误消息
    await waitForState(
      page,
      async () => {
        const phase = await page.evaluate(() => (window as any).__BG_STATE__?.sys?.phase);
        return phase === 'attack';
      },
      {
        timeout: 10000,  // 10 秒超时
        interval: 200,   // 每 200ms 检查一次
        message: '等待进入攻击阶段（自定义超时）'
      }
    );
  });
});

/**
 * 迁移指南
 * 
 * 1. 阶段切换等待
 *    Before: await page.waitForTimeout(500);
 *    After:  await waitForPhaseChange(page, 'attack');
 * 
 * 2. 交互完成等待
 *    Before: await page.waitForTimeout(1000);
 *    After:  await waitForInteractionComplete(page);
 * 
 * 3. 状态应用等待
 *    Before: await applyCoreState(page, state); await page.waitForTimeout(2000);
 *    After:  await applyCoreState(page, state); await waitForStateApplied(page, (core) => core.xxx === yyy);
 * 
 * 4. 派系选择等待
 *    Before: await factionCard.click(); await page.waitForTimeout(500);
 *    After:  await factionCard.click(); await waitForCoreState(page, (core) => core.players['0'].selectedFactions.length > 0);
 * 
 * 5. 游戏结束等待
 *    Before: await page.waitForTimeout(2000);
 *    After:  await waitForGameOver(page);
 */
