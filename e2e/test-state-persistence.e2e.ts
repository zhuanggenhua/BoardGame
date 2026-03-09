import { test, expect } from './framework';

/**
 * 验证本地 TestHarness 场景在刷新后会重建默认状态
 * 
 * 测试场景：
 * 1. 使用 setupScene 注入完整的游戏状态
 * 2. 验证状态已应用
 * 3. 刷新页面
 * 4. 验证页面回到默认本地对局，而不是错误地“持久化”
 */
test('本地 TestHarness 场景刷新后应重建默认状态', async ({ page, game }, testInfo) => {
  test.setTimeout(60000);

  // 1. 导航到游戏页面
  await page.goto('/play/smashup');

  // 2. 等待 TestHarness 就绪
  await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
    { timeout: 15000 }
  );

  console.log('[Test] TestHarness 已就绪');

  // 3. 使用 setupScene 注入完整的游戏状态
  await game.setupScene({
    gameId: 'smashup',
    player0: {
      hand: [
        { uid: 'card-1', defId: 'wizard_portal', type: 'action' }
      ],
      field: [
        { uid: 'minion-1', defId: 'ninja_shinobi', baseIndex: 0, power: 3 }
      ]
    },
    player1: {
      field: [
        { uid: 'minion-2', defId: 'robot_microbot_alpha', baseIndex: 0, power: 2 }
      ]
    },
    bases: [
      { breakpoint: 10, power: 5 }
    ],
    currentPlayer: '0',
    phase: 'playCards',
  });

  console.log('[Test] 状态已注入');

  // 4. 等待 React 重新渲染
  await page.waitForTimeout(2000);

  // 5. 截图验证状态已应用
  await game.screenshot('before-refresh', testInfo);

  // 6. 验证状态已应用
  const stateBeforeRefresh = await page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    return harness.state.get();
  });

  const currentPlayerBeforeRefresh =
    stateBeforeRefresh.core.turnOrder[stateBeforeRefresh.core.currentPlayerIndex];

  expect(currentPlayerBeforeRefresh).toBe('0');
  expect(stateBeforeRefresh.sys.phase).toBe('playCards');
  expect(stateBeforeRefresh.core.players['0'].hand).toHaveLength(1);
  expect(stateBeforeRefresh.core.players['1'].hand).toHaveLength(0);
  expect(stateBeforeRefresh.core.bases[0]?.minions ?? []).toHaveLength(2);

  console.log('[Test] 刷新前状态:', {
    currentPlayer: currentPlayerBeforeRefresh,
    phase: stateBeforeRefresh.sys.phase,
    player0HandSize: stateBeforeRefresh.core.players['0'].hand.length,
    player1HandSize: stateBeforeRefresh.core.players['1'].hand.length,
    base0Minions: stateBeforeRefresh.core.bases[0]?.minions?.length ?? 0,
  });

  // 7. 刷新页面
  console.log('[Test] 刷新页面...');
  await page.reload();

  // 8. 等待 TestHarness 重新就绪
  await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
    { timeout: 15000 }
  );

  console.log('[Test] TestHarness 重新就绪');

  // 9. 等待状态恢复和 React 重新渲染
  await page.waitForTimeout(3000);

  // 10. 截图验证状态已恢复
  await game.screenshot('after-refresh', testInfo);

  // 11. 验证状态已恢复
  const stateAfterRefresh = await page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    return harness.state.get();
  });

  const currentPlayerAfterRefresh =
    stateAfterRefresh.core.turnOrder[stateAfterRefresh.core.currentPlayerIndex];

  console.log('[Test] 刷新后状态:', {
    currentPlayer: currentPlayerAfterRefresh,
    phase: stateAfterRefresh.sys.phase,
    player0HandSize: stateAfterRefresh.core.players['0'].hand.length,
    player1HandSize: stateAfterRefresh.core.players['1'].hand.length,
    base0Minions: stateAfterRefresh.core.bases[0]?.minions?.length ?? 0,
    hasFactionSelection: !!stateAfterRefresh.core.factionSelection,
  });

  expect(stateAfterRefresh.core.factionSelection).toBeTruthy();
  expect(stateAfterRefresh.sys.phase).not.toBe('playCards');
  expect(stateAfterRefresh.core.players['0'].hand).toHaveLength(0);
  expect(stateAfterRefresh.core.players['1'].hand).toHaveLength(0);
  expect(stateAfterRefresh.core.bases[0]?.minions ?? []).toHaveLength(0);
});
