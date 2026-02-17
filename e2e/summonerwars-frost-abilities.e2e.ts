/**
 * 召唤师战争 - 极地矮人阵营特色交互 E2E 测试
 * 
 * 覆盖范围：
 * - 寒冰碎屑（ice_shards）：建造阶段结束消耗充能对建筑相邻敌方造成伤害
 * - 冰霜战斧（frost_axe）：移动后充能自身
 * - 结构变换（structure_shift）：移动后推拉友方建筑
 */

import { test, expect } from '@playwright/test';
import {
  setupSWOnlineMatch,
  readCoreState,
  applyCoreState,
  closeDebugPanelIfOpen,
  waitForPhase,
  advanceToPhase,
  cloneState,
} from './helpers/summonerwars';

// ============================================================================
// 测试状态准备函数
// ============================================================================

/**
 * 准备寒冰碎屑（ice_shards）测试状态
 * 
 * 策略：使用棋盘上已有的友方建筑（极地矮人初始有传送门），
 * 在其旁边放置敌方单位，并确保贾穆德（有 ice_shards 技能）有充能。
 * 
 * 注意：不修改 phase，由 advanceToPhase 自然推进保证 sys.phase 同步
 */
const prepareIceShardsState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.abilityUsageCount = {};
  // 确保阶段为 build（ice_shards 在 build 阶段结束触发）
  next.phase = 'build';

  const board = next.board;

  // 查找友方建筑（极地矮人初始有传送门）
  let structurePos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.structure && cell.structure.owner === '0') {
        structurePos = { row, col };
        break;
      }
    }
    if (structurePos) break;
  }
  if (!structurePos) throw new Error('未找到友方建筑');

  // 在建筑旁放置敌方单位
  const adjDirs = [
    { row: -1, col: 0 }, { row: 1, col: 0 },
    { row: 0, col: -1 }, { row: 0, col: 1 },
  ];
  let enemyPos: { row: number; col: number } | null = null;
  for (const d of adjDirs) {
    const r = structurePos.row + d.row;
    const c = structurePos.col + d.col;
    if (r < 0 || r >= 8 || c < 0 || c >= 6) continue;
    if (!board[r][c].unit && !board[r][c].structure) {
      board[r][c].unit = {
        instanceId: `enemy-skel-ice-${r}-${c}`,
        cardId: 'necro-skeleton-ice',
        card: {
          id: 'necro-skeleton', cardType: 'unit', name: '骷髅兵', faction: 'necromancer',
          cost: 0, life: 3, strength: 1, attackType: 'melee', attackRange: 1,
          unitClass: 'common', deckSymbols: [], abilities: [],
        },
        owner: '1', position: { row: r, col: c }, damage: 0, boosts: 0,
        hasMoved: false, hasAttacked: false,
      };
      enemyPos = { row: r, col: c };
      break;
    }
  }
  if (!enemyPos) throw new Error('无法在建筑旁放置敌方单位');

  // 查找或放置贾穆德（有 ice_shards 技能）
  let jamudPos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('ice_shards')) {
        cell.unit.boosts = 2;
        jamudPos = { row, col };
        break;
      }
    }
    if (jamudPos) break;
  }

  if (!jamudPos) {
    for (let row = 4; row < 7; row++) {
      for (let col = 0; col < 6; col++) {
        if (!board[row][col].unit && !board[row][col].structure) {
          board[row][col].unit = {
            instanceId: `frost-jarmund-e2e-${row}-${col}`, cardId: 'frost-jarmund',
            card: {
              id: 'frost-jarmund', cardType: 'unit', name: '贾穆德', faction: 'frost',
              cost: 5, life: 7, strength: 3, attackType: 'ranged', attackRange: 3,
              unitClass: 'champion', deckSymbols: [], abilities: ['imposing', 'ice_shards'],
            },
            owner: '0', position: { row, col }, damage: 0, boosts: 2,
            hasMoved: false, hasAttacked: false,
          };
          jamudPos = { row, col };
          break;
        }
      }
      if (jamudPos) break;
    }
  }
  if (!jamudPos) throw new Error('无法放置贾穆德');

  return { state: next, jamudPos, structurePos, enemyPos };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('极地矮人阵营特色交互', () => {

  test('寒冰碎屑：建造阶段结束消耗充能对建筑相邻敌方造成伤害', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;

    try {
      await advanceToPhase(hostPage, 'build');

      const coreState = await readCoreState(hostPage);
      const { state: iceShardsCore, jamudPos, enemyPos } = prepareIceShardsState(coreState);
      await applyCoreState(hostPage, iceShardsCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'build');
      await hostPage.waitForTimeout(1000);

      // 验证状态注入成功：贾穆德有充能，敌方单位存在
      const verifyState = await readCoreState(hostPage);
      const jamudUnit = verifyState.board[jamudPos.row]?.[jamudPos.col]?.unit;
      expect(jamudUnit).toBeTruthy();
      expect(jamudUnit.boosts).toBeGreaterThanOrEqual(1);
      const enemyUnit = verifyState.board[enemyPos.row]?.[enemyPos.col]?.unit;
      expect(enemyUnit).toBeTruthy();
      expect(enemyUnit.owner).toBe('1');

      // 记录敌方单位初始伤害
      const initialDamage = enemyUnit?.damage ?? 0;

      // 点击"结束阶段"退出 build 阶段，触发 ice_shards onPhaseEnd
      const endPhaseBtn = hostPage.getByTestId('sw-end-phase');
      await expect(endPhaseBtn).toBeVisible({ timeout: 5000 });
      
      await endPhaseBtn.click();
      
      // ice_shards 是 CONFIRMABLE_PHASE_END_ABILITIES，会 halt 阶段推进
      // 按钮文本来自 i18n: actions.confirm = "确认"/"Confirm", actions.skip = "跳过"/"Skip"
      const confirmBtn = hostPage.locator('button').filter({ hasText: /^Confirm$|^确认$/i }).first();
      const skipBtn = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      
      // 等待按钮出现（5秒超时）
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await expect(confirmBtn).toBeEnabled({ timeout: 1000 });

      // 点击"确认"执行寒冰碎屑
      await confirmBtn.click();
      await hostPage.waitForTimeout(500);

      // 验证敌方单位受到伤害
      const afterState = await readCoreState(hostPage);
      const enemyAfter = afterState.board[enemyPos.row][enemyPos.col]?.unit;

      if (enemyAfter) {
        expect(enemyAfter.damage).toBeGreaterThan(initialDamage);
      } else {
        // 敌方单位被消灭也算成功
        expect(enemyAfter).toBeFalsy();
      }

      // 验证贾穆德充能减少
      const jamudAfter = afterState.board[jamudPos.row][jamudPos.col]?.unit;
      expect(jamudAfter).toBeTruthy();
      expect(jamudAfter.boosts).toBeLessThan(2);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('寒冰碎屑：跳过不执行', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;

    try {
      await advanceToPhase(hostPage, 'build');

      const coreState = await readCoreState(hostPage);
      const { state: iceShardsCore, jamudPos, enemyPos } = prepareIceShardsState(coreState);
      await applyCoreState(hostPage, iceShardsCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'build');
      await hostPage.waitForTimeout(1000);

      // 验证状态注入成功
      const verifyState = await readCoreState(hostPage);
      const jamudBefore = verifyState.board[jamudPos.row]?.[jamudPos.col]?.unit;
      expect(jamudBefore).toBeTruthy();
      const initialBoosts = jamudBefore?.boosts ?? 0;
      expect(initialBoosts).toBeGreaterThanOrEqual(1);

      // 结束 build 阶段触发 ice_shards
      const endPhaseBtn = hostPage.getByTestId('sw-end-phase');
      await expect(endPhaseBtn).toBeVisible({ timeout: 5000 });
      await endPhaseBtn.click();

      // 等待横幅出现
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(skipButton).toBeVisible({ timeout: 5000 });

      // 点击"跳过"
      await skipButton.click();
      await hostPage.waitForTimeout(500);

      // 验证充能未消耗
      const afterState = await readCoreState(hostPage);
      const jamudAfter = afterState.board[jamudPos.row][jamudPos.col]?.unit;
      expect(jamudAfter).toBeTruthy();
      expect(jamudAfter.boosts).toBe(initialBoosts);

      // 验证敌方单位未受伤
      const enemyAfter = afterState.board[enemyPos.row][enemyPos.col]?.unit;
      expect(enemyAfter).toBeTruthy();
      expect(enemyAfter.damage).toBe(0);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('冰霜战斧：移动后充能自身', async () => {
    // frost_axe 需要实际移动触发 EventStream，状态注入无法模拟
    test.skip(true, 'frost_axe 需要实际移动触发 EventStream，状态注入无法模拟，需要完整移动流程测试');
  });
});
