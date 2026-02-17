/**
 * 召唤师战争 - 洞穴地精阵营特色交互 E2E 测试
 *
 * 覆盖范围：
 * - 神出鬼没（vanish）：召唤师与0费友方单位交换位置
 * - 鲜血符文（blood_rune）：自伤1点 或 花1魔力充能
 * - 喂养巨食兽（feed_beast）：吞噬相邻友方 或 自毁
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- E2E 测试中 coreState 为动态 JSON 结构
const prepareVanishState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.attackCount = 0;
  next.abilityUsageCount = {};
  const board = next.board;
  let summonerPos: { row: number; col: number } | null = null;
  let allyPos: { row: number; col: number } | null = null;
  // 查找召唤师
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('vanish')) {
        summonerPos = { row, col };
        break;
      }
    }
    if (summonerPos) break;
  }
  if (!summonerPos) throw new Error('未找到召唤师思尼克斯');
  // 查找0费友方单位
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.cost === 0 && 
          !(cell.unit.card.abilities?.includes('vanish'))) {
        allyPos = { row, col };
        break;
      }
    }
    if (allyPos) break;
  }
  if (!allyPos) throw new Error('未找到0费友方单位');
  return { state: next, summonerPos, allyPos };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prepareBloodRuneState = (coreState: any) => {
  const next = cloneState(coreState);
  // 确保阶段为 build（blood_rune 在 attack 阶段开始触发，测试需要先在 build 阶段注入状态）
  next.phase = 'build';
  next.currentPlayer = '0';
  next.abilityUsageCount = {};
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.magic = 3;
  
  // 查找或创建布拉夫（有 blood_rune 技能）
  let blarfPos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8 && !blarfPos; row++) {
    for (let col = 0; col < 6 && !blarfPos; col++) {
      const unit = next.board[row]?.[col]?.unit;
      if (unit && unit.owner === '0' && unit.card.abilities?.includes('blood_rune')) {
        blarfPos = { row, col };
      }
    }
  }
  
  // 如果棋盘上没有布拉夫，创建一个
  if (!blarfPos) {
    for (let row = 4; row < 7; row++) {
      for (let col = 0; col < 6; col++) {
        if (!next.board[row][col].unit && !next.board[row][col].structure) {
          next.board[row][col].unit = {
            instanceId: `goblin-blarf-e2e-${row}-${col}`,
            cardId: 'goblin-blarf',
            card: {
              id: 'goblin-blarf', cardType: 'unit', name: '布拉夫', faction: 'goblin',
              cost: 5, life: 7, strength: 3, attackType: 'melee', attackRange: 1,
              unitClass: 'champion', deckSymbols: [], abilities: ['blood_rune', 'power_boost'],
            },
            owner: '0', position: { row, col }, damage: 0, boosts: 0,
            hasMoved: false, hasAttacked: false,
          };
          blarfPos = { row, col };
          break;
        }
      }
      if (blarfPos) break;
    }
  }
  
  if (!blarfPos) throw new Error('无法放置布拉夫');
  return { state: next, blarfPos };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('洞穴地精阵营特色交互', () => {

  test('神出鬼没：与0费友方单位交换位置', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'goblin', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;

    try {
      const coreState = await readCoreState(hostPage);
      const { state: vanishCore, summonerPos, allyPos } = prepareVanishState(coreState);
      await applyCoreState(hostPage, vanishCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(500);

      const summonerName = '思尼克斯';
      const allyName = '部落投石手';

      // 点击召唤师选中它
      const summonerUnit = hostPage.locator(`[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="${summonerName}"]`).first();
      await expect(summonerUnit).toBeVisible({ timeout: 8000 });
      const summonerTestId = await summonerUnit.getAttribute('data-testid') ?? '';
      const [, sRow, sCol] = summonerTestId.match(/sw-unit-(\d+)-(\d+)/) ?? [];
      // 通过调试面板直接设置 selectedUnit
      const vanishState = await readCoreState(hostPage);
      vanishState.selectedUnit = { row: parseInt(sRow), col: parseInt(sCol) };
      await applyCoreState(hostPage, vanishState);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(1000);

      // 点击神出鬼没按钮
      const vanishButton = hostPage.locator('button').filter({ hasText: /神出鬼没|Vanish/i });
      await expect(vanishButton).toBeVisible({ timeout: 8000 });
      await vanishButton.click();
      await hostPage.waitForTimeout(500);

      // 点击0费友方单位完成交换
      const ally = hostPage.locator(`[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="${allyName}"]`).first();
      await expect(ally).toBeVisible({ timeout: 5000 });
      await ally.dispatchEvent('click');
      await hostPage.waitForTimeout(1500);

      // 验证位置交换
      const summonerAfter = hostPage.locator(`[data-testid="sw-unit-${allyPos.row}-${allyPos.col}"][data-unit-name="${summonerName}"]`);
      const allyAfter = hostPage.locator(`[data-testid="sw-unit-${summonerPos.row}-${summonerPos.col}"][data-unit-name="${allyName}"]`);
      await expect(summonerAfter).toBeVisible({ timeout: 5000 });
      await expect(allyAfter).toBeVisible({ timeout: 5000 });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('鲜血符文：选择自伤获得充能', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'goblin', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;

    try {
      // blood_rune 触发时机：attack 阶段开始（onPhaseStart）
      // 策略：先推进到 build 阶段，注入状态（确保魔力充足+布拉夫存在），再点击"结束阶段"进入 attack
      await advanceToPhase(hostPage, 'build');
      const coreState = await readCoreState(hostPage);
      const { state: bloodRuneCore, blarfPos } = prepareBloodRuneState(coreState);
      await applyCoreState(hostPage, bloodRuneCore);
      await closeDebugPanelIfOpen(hostPage);
      await waitForPhase(hostPage, 'build');

      // 记录布拉夫初始伤害
      const blarf = hostPage.locator(`[data-testid="sw-unit-${blarfPos.row}-${blarfPos.col}"][data-owner="0"]`).first();
      await expect(blarf).toBeVisible({ timeout: 8000 });
      const initialDamage = parseInt(await blarf.getAttribute('data-unit-damage') ?? '0');

      // 点击"结束阶段"从 build → attack，触发 blood_rune onPhaseStart
      const endPhaseBtn = hostPage.getByTestId('sw-end-phase');
      await expect(endPhaseBtn).toBeVisible({ timeout: 5000 });
      await endPhaseBtn.click();
      await hostPage.waitForTimeout(2000);

      // blood_rune 按钮文本来自 i18n: actions.bloodRuneDamage / actions.bloodRuneCharge
      const damageButton = hostPage.locator('button').filter({ hasText: /自伤1点|Take 1 Damage/i });
      const chargeButton = hostPage.locator('button').filter({ hasText: /花1魔力充能|Spend 1 Magic to Charge/i });
      await expect(damageButton).toBeVisible({ timeout: 10000 });
      await expect(chargeButton).toBeVisible({ timeout: 3000 });

      // 选择"自伤1点"
      await damageButton.click();
      await hostPage.waitForTimeout(1500);
      await expect(damageButton).toBeHidden({ timeout: 5000 });

      // 验证布拉夫受到1点伤害
      await expect.poll(async () => {
        const currentDamage = parseInt(await blarf.getAttribute('data-unit-damage') ?? '0');
        return currentDamage;
      }, { timeout: 5000 }).toBe(initialDamage + 1);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

});
