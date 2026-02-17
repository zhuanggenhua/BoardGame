/**
 * 最小化 ice_shards 测试 - 用于调试
 */

import { test, expect } from '@playwright/test';
import {
  setupSWOnlineMatch,
  readCoreState,
  applyCoreState,
  closeDebugPanelIfOpen,
  cloneState,
  advanceToPhase,
} from './helpers/summonerwars';

test('ice_shards 最小化测试', async ({ browser }, testInfo) => {
  test.setTimeout(120000);
  const baseURL = testInfo.project.use.baseURL as string | undefined;
  
  console.log('[DEBUG] Starting test, baseURL:', baseURL);
  console.log('[DEBUG] Creating match...');
  
  const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
  if (!match) {
    console.log('[DEBUG] Match creation failed');
    test.skip(true, 'Game server unavailable');
    return;
  }
  
  console.log('[DEBUG] Match created successfully');
  const { hostPage, hostContext, guestContext } = match;

  try {
    // 使用 advanceToPhase 推进到 build 阶段
    console.log('[DEBUG] Advancing to build phase using advanceToPhase');
    await advanceToPhase(hostPage, 'build');
    
    // 验证当前在 build 阶段
    const phase = await hostPage.getByTestId('sw-action-banner').getAttribute('data-phase');
    console.log('[DEBUG] Current phase after advanceToPhase:', phase);
    expect(phase).toBe('build');

    // 读取初始状态
    const coreState = await readCoreState(hostPage);
    console.log('[DEBUG] Current player:', coreState.currentPlayer);
    
    // 修改状态：确保有 Jarmund 和敌方单位
    const testState = cloneState(coreState);
    // 保持当前阶段（build）和玩家
    testState.selectedUnit = undefined;
    testState.abilityUsageCount = {};

    // 查找 Jarmund（有 ice_shards 技能）
    let jamudPos: { row: number; col: number } | null = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 6; col++) {
        const unit = testState.board[row]?.[col]?.unit;
        if (unit && unit.owner === '0' && unit.card.abilities?.includes('ice_shards')) {
          unit.boosts = 2; // 确保有充能
          jamudPos = { row, col };
          break;
        }
      }
      if (jamudPos) break;
    }

    if (!jamudPos) {
      console.log('[DEBUG] No Jarmund found, creating one');
      // 创建 Jarmund
      for (let row = 4; row < 7; row++) {
        for (let col = 0; col < 6; col++) {
          if (!testState.board[row][col].unit && !testState.board[row][col].structure) {
            testState.board[row][col].unit = {
              instanceId: `frost-jarmund-test-${row}-${col}`,
              cardId: 'frost-jarmund',
              card: {
                id: 'frost-jarmund',
                cardType: 'unit',
                name: '贾穆德',
                faction: 'frost',
                cost: 5,
                life: 7,
                strength: 3,
                attackType: 'ranged',
                attackRange: 3,
                unitClass: 'champion',
                deckSymbols: [],
                abilities: ['imposing', 'ice_shards'],
              },
              owner: '0',
              position: { row, col },
              damage: 0,
              boosts: 2,
              hasMoved: false,
              hasAttacked: false,
            };
            jamudPos = { row, col };
            break;
          }
        }
        if (jamudPos) break;
      }
    }

    if (!jamudPos) {
      throw new Error('无法创建 Jarmund');
    }

    // 查找友方建筑
    let structurePos: { row: number; col: number } | null = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 6; col++) {
        const structure = testState.board[row][col].structure;
        if (structure && structure.owner === '0') {
          structurePos = { row, col };
          break;
        }
      }
      if (structurePos) break;
    }

    if (!structurePos) {
      throw new Error('未找到友方建筑');
    }

    // 在建筑旁放置敌方单位
    const adjDirs = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];
    let enemyPos: { row: number; col: number } | null = null;
    for (const d of adjDirs) {
      const r = structurePos.row + d.row;
      const c = structurePos.col + d.col;
      if (r < 0 || r >= 8 || c < 0 || c >= 6) continue;
      if (!testState.board[r][c].unit && !testState.board[r][c].structure) {
        testState.board[r][c].unit = {
          instanceId: `enemy-skel-${r}-${c}`,
          cardId: 'necro-skeleton',
          card: {
            id: 'necro-skeleton',
            cardType: 'unit',
            name: '骷髅兵',
            faction: 'necromancer',
            cost: 0,
            life: 3,
            strength: 1,
            attackType: 'melee',
            attackRange: 1,
            unitClass: 'common',
            deckSymbols: [],
            abilities: [],
          },
          owner: '1',
          position: { row: r, col: c },
          damage: 0,
          boosts: 0,
          hasMoved: false,
          hasAttacked: false,
        };
        enemyPos = { row: r, col: c };
        break;
      }
    }

    if (!enemyPos) {
      throw new Error('无法在建筑旁放置敌方单位');
    }

    console.log('[DEBUG] Jarmund position:', jamudPos);
    console.log('[DEBUG] Structure position:', structurePos);
    console.log('[DEBUG] Enemy position:', enemyPos);

    // 应用状态并立即关闭调试面板
    await applyCoreState(hostPage, testState);
    console.log('[DEBUG] State applied, closing debug panel');
    await closeDebugPanelIfOpen(hostPage);
    await hostPage.waitForTimeout(500);
    
    // 确保调试面板已关闭
    const debugPanel = hostPage.getByTestId('debug-panel');
    const isPanelVisible = await debugPanel.isVisible().catch(() => false);
    console.log('[DEBUG] Debug panel visible after close:', isPanelVisible);
    
    // 不再读取状态验证（避免重新打开调试面板），直接检查 UI
    console.log('[DEBUG] Checking UI elements');
    const endPhaseBtn = hostPage.getByTestId('sw-end-phase');
    await expect(endPhaseBtn).toBeVisible({ timeout: 5000 });
    console.log('[DEBUG] End phase button visible');
    
    // 点击"结束阶段"
    console.log('[DEBUG] Clicking end phase button');
    await endPhaseBtn.click();
    console.log('[DEBUG] Click completed, waiting for response');
    
    await hostPage.waitForTimeout(2000);
    
    console.log('[DEBUG] Checking for confirm/skip buttons...');

    console.log('[DEBUG] Checking for buttons...');

    // 检查按钮是否出现
    const confirmBtn = hostPage.locator('button').filter({ hasText: /^Confirm$|^确认$/i }).first();
    const skipBtn = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();

    const hasConfirm = await confirmBtn.isVisible().catch(() => false);
    const hasSkip = await skipBtn.isVisible().catch(() => false);

    console.log('[DEBUG] Confirm button visible:', hasConfirm);
    console.log('[DEBUG] Skip button visible:', hasSkip);

    if (!hasConfirm && !hasSkip) {
      // 截图
      await hostPage.screenshot({ path: testInfo.outputPath('no-buttons.png'), fullPage: true });
      console.log('[DEBUG] Screenshot saved');
      throw new Error('Confirm/Skip buttons did not appear');
    }

    console.log('[DEBUG] Test passed - buttons appeared');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
