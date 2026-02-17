/**
 * Frost 基础测试 - 验证阵营选择和游戏启动
 */

import { test, expect } from '@playwright/test';
import { setupSWOnlineMatch } from './helpers/summonerwars';

test('Frost 阵营基础测试', async ({ browser }, testInfo) => {
  test.setTimeout(90000);
  const baseURL = testInfo.project.use.baseURL as string | undefined;
  
  console.log('[TEST] Creating frost vs necromancer match');
  const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
  
  if (!match) {
    test.skip(true, 'Game server unavailable');
    return;
  }
  
  console.log('[TEST] Match created successfully');
  const { hostPage, hostContext, guestContext } = match;

  try {
    // 验证游戏界面已加载
    const banner = hostPage.getByTestId('sw-action-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });
    console.log('[TEST] Game UI loaded');
    
    // 验证当前阶段
    const phase = await banner.getAttribute('data-phase');
    console.log('[TEST] Current phase:', phase);
    expect(phase).toBeTruthy();
    
    // 验证结束阶段按钮存在
    const endPhaseBtn = hostPage.getByTestId('sw-end-phase');
    await expect(endPhaseBtn).toBeVisible({ timeout: 5000 });
    console.log('[TEST] End phase button visible');
    
    console.log('[TEST] Test passed');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
