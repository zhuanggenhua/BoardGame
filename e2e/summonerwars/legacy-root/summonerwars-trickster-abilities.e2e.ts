/**
 * 召唤师战争 - 欺心巫族阵营特色交互 E2E 测试
 * 
 * 覆盖范围：
 * - 心灵捕获（mind_capture）：攻击时控制目标代替伤害
 * - 念力代替攻击（telekinesis_instead）：按钮激活，推拉目标
 */

import { test, expect } from '@playwright/test';
import {
  setupSWOnlineMatch,
  readCoreState,
  applyCoreState,
  closeDebugPanelIfOpen,
  waitForPhase,
  cloneState,
} from '../../helpers/summonerwars';
import { dismissViteOverlay } from '../../helpers/common';

// ============================================================================
// 测试状态准备函数
// ============================================================================

const prepareMindCaptureState = (coreState: any) => {
  const next = cloneState(coreState);
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.abilityUsageCount = {};
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.attackCount = 0;
  const board = next.board;
  let summonerPos: { row: number; col: number } | null = null;
  let enemyPos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('mind_capture')) {
        summonerPos = { row, col };
        // 增加攻击力到 6，确保更高的命中概率
        cell.unit.card.strength = 6;
        break;
      }
    }
    if (summonerPos) break;
  }
  if (!summonerPos) throw new Error('未找到泰珂露（mind_capture 召唤师）');
  const adjPositions = [
    { row: summonerPos.row - 1, col: summonerPos.col }, { row: summonerPos.row + 1, col: summonerPos.col },
    { row: summonerPos.row, col: summonerPos.col - 1 }, { row: summonerPos.row, col: summonerPos.col + 1 },
  ];
  for (const adj of adjPositions) {
    if (adj.row >= 0 && adj.row < 8 && adj.col >= 0 && adj.col < 6) {
      if (!board[adj.row][adj.col].unit && !board[adj.row][adj.col].structure) {
        // 目标单位：life=1, damage=0，只需 1 次命中就能触发心灵捕获
        board[adj.row][adj.col].unit = {
          instanceId: `enemy-target-mc-${adj.row}-${adj.col}`, cardId: 'necro-skeleton-mc',
          card: { id: 'necro-skeleton', cardType: 'unit', name: '骷髅兵', faction: 'necromancer',
            cost: 0, life: 1, strength: 1, attackType: 'melee', attackRange: 1,
            unitClass: 'common', deckSymbols: [], abilities: [] },
          owner: '1', position: adj, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
        };
        enemyPos = adj;
        break;
      }
    }
  }
  if (!enemyPos) throw new Error('无法在泰珂露旁放置敌方单位');
  return { state: next, summonerPos, enemyPos };
};

const hasForceDestination = (
  board: Array<Array<{ unit?: unknown; structure?: unknown }>>,
  row: number,
  col: number,
) => {
  const dirs = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  return dirs.some((dir) => {
    const nextRow = row + dir.row;
    const nextCol = col + dir.col;
    if (nextRow < 0 || nextRow >= 8 || nextCol < 0 || nextCol >= 6) return false;
    const cell = board[nextRow]?.[nextCol];
    return Boolean(cell && !cell.unit && !cell.structure);
  });
};

const prepareTelekinesisInsteadState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.abilityUsageCount = {};
  const player = next.players?.['0'];
  if (!player) throw new Error('无法读取玩家0状态');
  player.attackCount = 0;
  const board = next.board;
  let magePos: { row: number; col: number } | null = null;
  let targetPos: { row: number; col: number } | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = board[row][col];
      if (cell.unit && cell.unit.owner === '0' && cell.unit.card.abilities?.includes('telekinesis')) {
        cell.unit.hasAttacked = false;
        cell.unit.hasMoved = false;
        magePos = { row, col };
        break;
      }
    }
    if (magePos) break;
  }
  if (!magePos) {
    for (let row = 2; row < 5; row++) {
      for (let col = 1; col < 5; col++) {
        if (!board[row][col].unit && !board[row][col].structure) {
          board[row][col].unit = {
            instanceId: `trickster-mage-test-${row}-${col}`, cardId: 'trickster-mage-test',
            card: { id: 'trickster-mage', cardType: 'unit', name: '清风法师', faction: 'trickster',
              cost: 2, life: 2, strength: 2, attackType: 'ranged', attackRange: 3,
              unitClass: 'common', deckSymbols: [], abilities: ['telekinesis', 'telekinesis_instead'] },
            owner: '0', position: { row, col }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
          };
          magePos = { row, col };
          break;
        }
      }
      if (magePos) break;
    }
  }
  if (!magePos) throw new Error('无法放置清风法师');
  // 在2格内放置非召唤师敌方单位
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (Math.abs(dr) + Math.abs(dc) === 0 || Math.abs(dr) + Math.abs(dc) > 2) continue;
      const r = magePos.row + dr;
      const c = magePos.col + dc;
      if (r < 0 || r >= 8 || c < 0 || c >= 6) continue;
      if (
        board[r][c].unit
        && board[r][c].unit.owner === '1'
        && board[r][c].unit.card.unitClass !== 'summoner'
        && hasForceDestination(board, r, c)
      ) {
        targetPos = { row: r, col: c };
        break;
      }
    }
    if (targetPos) break;
  }
  if (!targetPos) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (Math.abs(dr) + Math.abs(dc) === 0 || Math.abs(dr) + Math.abs(dc) > 2) continue;
        const r = magePos.row + dr;
        const c = magePos.col + dc;
        if (r < 0 || r >= 8 || c < 0 || c >= 6) continue;
        if (!board[r][c].unit && !board[r][c].structure && hasForceDestination(board, r, c)) {
          board[r][c].unit = {
            instanceId: `enemy-tk-target-${r}-${c}`, cardId: 'necro-skeleton-tk',
            card: { id: 'necro-skeleton', cardType: 'unit', name: '骷髅兵', faction: 'necromancer',
              cost: 0, life: 1, strength: 1, attackType: 'melee', attackRange: 1,
              unitClass: 'common', deckSymbols: [], abilities: [] },
            owner: '1', position: { row: r, col: c }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
          };
          targetPos = { row: r, col: c };
          break;
        }
      }
      if (targetPos) break;
    }
  }
  if (!targetPos) throw new Error('无法在清风法师2格内放置敌方单位');
  return { state: next, magePos, targetPos };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('欺心巫族阵营特色交互', () => {

  // 跳过：mind_capture 需要攻击命中触发，涉及骰子随机性
  // 逻辑已在单元测试 abilities-trickster-execute.test.ts 中覆盖
  test.skip('心灵捕获：选择控制目标', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'trickster', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: mcCore, summonerPos, enemyPos } = prepareMindCaptureState(coreState);
      await applyCoreState(hostPage, mcCore);
      await closeDebugPanelIfOpen(hostPage);
      await dismissViteOverlay(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(500);

      // 直接通过 dispatch 发送 mind_capture_resolve 命令（跳过骰子随机性）
      const summonerUnit = mcCore.board[summonerPos.row][summonerPos.col]?.unit;
      const dispatchResult = await hostPage.evaluate(({ sourceUnitId, targetPosition, hits }) => {
        const w = window as Window & { __BG_DISPATCH__?: (type: string, payload: unknown) => void };
        if (w.__BG_DISPATCH__) {
          w.__BG_DISPATCH__('sw:activate_ability', {
            abilityId: 'mind_capture_resolve',
            sourceUnitId,
            choice: 'control',
            targetPosition,
            hits,
          });
          return 'dispatched';
        }
        return 'no_dispatch';
      }, {
        sourceUnitId: summonerUnit.instanceId,
        targetPosition: enemyPos,
        hits: 1,
      });
      console.log('Dispatch result:', dispatchResult);
      await hostPage.waitForTimeout(2000);

      // 验证目标被控制（owner 变为 '0'）
      const afterState = await readCoreState(hostPage);
      let controlledUnit = false;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 6; col++) {
          const unit = afterState.board[row][col]?.unit;
          if (unit && unit.instanceId?.includes('enemy-target-mc') && unit.owner === '0') {
            controlledUnit = true; break;
          }
        }
        if (controlledUnit) break;
      }
      expect(controlledUnit).toBe(true);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  // 跳过：mind_capture 需要攻击命中触发，涉及骰子随机性
  // 逻辑已在单元测试 abilities-trickster-execute.test.ts 中覆盖
  test.skip('心灵捕获：选择造成伤害', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'trickster', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: mcCore, summonerPos, enemyPos } = prepareMindCaptureState(coreState);
      await applyCoreState(hostPage, mcCore);
      await closeDebugPanelIfOpen(hostPage);
      await dismissViteOverlay(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(500);

      // 直接通过 dispatch 发送命令，选择"伤害"
      const summonerUnit = mcCore.board[summonerPos.row][summonerPos.col]?.unit;
      const dispatchResult = await hostPage.evaluate(({ sourceUnitId, targetPosition, hits }) => {
        const w = window as Window & { __BG_DISPATCH__?: (type: string, payload: unknown) => void };
        if (w.__BG_DISPATCH__) {
          w.__BG_DISPATCH__('sw:activate_ability', {
            abilityId: 'mind_capture_resolve',
            sourceUnitId,
            choice: 'damage',
            targetPosition,
            hits,
          });
          return 'dispatched';
        }
        return 'no_dispatch';
      }, {
        sourceUnitId: summonerUnit.instanceId,
        targetPosition: enemyPos,
        hits: 1,
      });
      console.log('Dispatch result:', dispatchResult);
      await hostPage.waitForTimeout(2000);

      // 验证目标被消灭（life=1, hits=1）
      const afterState = await readCoreState(hostPage);
      const enemyAfter = afterState.board[enemyPos.row][enemyPos.col]?.unit;
      expect(enemyAfter).toBeFalsy();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('念力代替攻击：选中单位后使用按钮推拉目标', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'trickster', 'necromancer');
    if (!match) { test.skip(true, 'Game server unavailable or room creation failed.'); return; }
    const { hostPage, hostContext, guestContext } = match;
    try {
      const coreState = await readCoreState(hostPage);
      const { state: tkCore, magePos, targetPos } = prepareTelekinesisInsteadState(coreState);
      await applyCoreState(hostPage, tkCore);
      await closeDebugPanelIfOpen(hostPage);
      await dismissViteOverlay(hostPage);
      await waitForPhase(hostPage, 'attack');
      await hostPage.waitForTimeout(500);
      const selectState = await readCoreState(hostPage);
      selectState.selectedUnit = magePos;
      await applyCoreState(hostPage, selectState);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(1000);
      await dismissViteOverlay(hostPage);
      const tkInsteadButton = hostPage.locator('button').filter({ hasText: /Telekinesis.*Instead|念力.*代替/i });
      await expect(tkInsteadButton).toBeVisible({ timeout: 8000 });
      await tkInsteadButton.click();
      await hostPage.waitForTimeout(1000);
      const target = hostPage.locator(`[data-testid="sw-unit-${targetPos.row}-${targetPos.col}"][data-owner="1"]`).first();
      await expect(target).toBeVisible({ timeout: 5000 });
      const targetCell = hostPage.getByTestId(`sw-cell-${targetPos.row}-${targetPos.col}`);
      await expect(targetCell).toHaveAttribute('data-valid-ability-unit', 'true');
      await targetCell.click({ force: true });
      await hostPage.waitForTimeout(1500);
      const readDirectionChoice = () => hostPage.evaluate(({ excludedRow, excludedCol }) => {
        const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="sw-cell-"]'));
        const matches = cells
          .map((cell) => {
            const testId = cell.dataset.testid ?? cell.getAttribute('data-testid') ?? '';
            const match = testId.match(/^sw-cell-(\d+)-(\d+)$/);
            if (!match) return null;
            const row = Number(match[1]);
            const col = Number(match[2]);
            if (row === excludedRow && col === excludedCol) return null;
            const className = cell.className ?? '';
            const inlineBorder = cell.style.borderColor ?? '';
            const inlineBg = cell.style.backgroundColor ?? '';
            const isTelekinesisHighlight =
              className.includes('animate-pulse')
              && (
                inlineBorder.includes('94, 234, 212')
                || inlineBorder.includes('94,234,212')
                || inlineBg.includes('94, 234, 212')
                || inlineBg.includes('94,234,212')
              );
            if (!isTelekinesisHighlight) return null;
            return { row, col };
          })
          .filter((item): item is { row: number; col: number } => item !== null);
        return matches[0] ?? null;
      }, { excludedRow: targetPos.row, excludedCol: targetPos.col });

      await expect.poll(readDirectionChoice, { timeout: 5000 }).not.toBeNull();
      const directionChoice = await readDirectionChoice();
      expect(directionChoice).toBeTruthy();

      const targetInstanceId = tkCore.board[targetPos.row][targetPos.col]?.unit?.instanceId;
      expect(targetInstanceId).toBeTruthy();
      const destinationCell = hostPage.getByTestId(`sw-cell-${directionChoice!.row}-${directionChoice!.col}`);
      await destinationCell.click({ force: true });
      await hostPage.waitForTimeout(1500);

      await expect.poll(async () => {
        const afterState = await readCoreState(hostPage);
        return {
          sourceOccupant: afterState.board[targetPos.row][targetPos.col]?.unit?.instanceId ?? null,
          destinationOccupant: afterState.board[directionChoice!.row][directionChoice!.col]?.unit?.instanceId ?? null,
        };
      }, { timeout: 5000 }).toEqual({
        sourceOccupant: null,
        destinationOccupant: targetInstanceId,
      });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
