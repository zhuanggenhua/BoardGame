/**
 * SummonerWars - 选择建筑 + 推拉方向 E2E 测试
 *
 * 覆盖范围：
 * - 建筑转移（structure_shift）：移动后推拉友方建筑
 * - 建筑选择 UI
 * - 方向选择 UI
 * - 建筑位置变化
 */

import { test, expect } from './framework';
import {
  applyCoreState,
  clickBoardElement,
  cloneState,
  closeDebugPanelIfOpen,
  readCoreState,
  setupSWOnlineMatch,
  waitForPhase,
} from './helpers/summonerwars';

const clearBoardCell = (board: any[][], row: number, col: number) => {
  board[row][col].unit = null;
  board[row][col].structure = null;
};

const prepareStructureShiftState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'move';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.abilityUsageCount = {};

  const player = next.players?.['0'];
  if (!player) throw new Error('玩家 0 状态不存在');
  player.moveCount = 0;

  const board = next.board;
  clearBoardCell(board, 6, 2);
  clearBoardCell(board, 5, 2);
  clearBoardCell(board, 6, 4);
  clearBoardCell(board, 5, 4);

  board[6][2].unit = {
    instanceId: 'structure-summoner',
    cardId: 'test-structure-summoner',
    card: {
      id: 'test-structure-summoner',
      name: 'Structure Summoner',
      cardType: 'unit',
      faction: 'frost',
      cost: 0,
      life: 12,
      strength: 3,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'summoner',
      abilities: ['structure_shift'],
      deckSymbols: [],
    },
    owner: '0',
    position: { row: 6, col: 2 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[6][4].structure = {
    id: 'shift-structure',
    type: 'wall',
    owner: '0',
    life: 5,
    damage: 0,
  };

  return next;
};

test.describe('召唤师战争 - 选择建筑 + 推拉方向', () => {
  test('建筑转移：移动后推拉友方建筑', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable for online tests.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const coreState = await readCoreState(hostPage);
      const preparedCore = prepareStructureShiftState(coreState);
      await applyCoreState(hostPage, preparedCore);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(500);

      await waitForPhase(hostPage, 'move');

      const summoner = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Structure Summoner"]').first();
      await expect(summoner).toBeVisible({ timeout: 5000 });

      const structure = hostPage.locator('[data-testid^="sw-structure-"][data-owner="0"]').first();
      await expect(structure).toBeVisible({ timeout: 5000 });
      const initialStructureTestId = await structure.getAttribute('data-testid');
      if (!initialStructureTestId) {
        throw new Error('无法读取建筑初始位置');
      }

      await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Structure Summoner"]');
      await clickBoardElement(hostPage, '[data-testid="sw-cell-5-2"]');
      await hostPage.waitForTimeout(800);

      const structureSelectionPrompt = hostPage.locator('[data-testid="sw-ability-prompt"]').or(
        hostPage.locator('[class*="prompt"]').filter({ hasText: /Select structure|Structure shift/i }),
      );
      await expect(structureSelectionPrompt).toBeVisible({ timeout: 8000 });

      await clickBoardElement(hostPage, '[data-testid^="sw-structure-"][data-owner="0"]');

      const directionSelector = hostPage.locator('[data-testid="sw-direction-selector"]').or(
        hostPage.locator('[class*="direction"]').filter({ hasText: /Choose direction/i }),
      );
      await expect(directionSelector).toBeVisible({ timeout: 8000 });

      const upButton = directionSelector.locator('button').filter({ hasText: /^Up$/i }).first();
      await expect(upButton).toBeVisible({ timeout: 3000 });
      await upButton.click();
      await expect(directionSelector).toBeHidden({ timeout: 5000 });

      await expect.poll(async () => {
        const currentTestId = await hostPage
          .locator('[data-testid^="sw-structure-"][data-owner="0"]')
          .first()
          .getAttribute('data-testid');
        return currentTestId !== initialStructureTestId;
      }, { timeout: 5000 }).toBe(true);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
