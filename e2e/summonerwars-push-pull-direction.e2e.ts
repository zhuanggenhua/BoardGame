/**
 * SummonerWars - 攻击后推拉方向选择 E2E 测试
 *
 * 覆盖范围：
 * - 念力（telekinesis）：攻击后推拉目标
 * - 方向选择 UI 交互
 * - 目标单位位置变化
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

const prepareTelekinesisState = (coreState: any) => {
  const next = cloneState(coreState);
  next.phase = 'attack';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.abilityUsageCount = {};

  const player = next.players?.['0'];
  if (!player) throw new Error('玩家 0 状态不存在');
  player.attackCount = 0;

  const board = next.board;
  clearBoardCell(board, 6, 2);
  clearBoardCell(board, 5, 2);
  clearBoardCell(board, 4, 2);

  board[6][2].unit = {
    instanceId: 'telekinesis-mage',
    cardId: 'test-telekinesis-mage',
    card: {
      id: 'test-telekinesis-mage',
      name: 'Telekinesis Mage',
      cardType: 'unit',
      faction: 'trickster',
      cost: 2,
      life: 4,
      strength: 4,
      attackType: 'ranged',
      attackRange: 3,
      unitClass: 'common',
      abilities: ['telekinesis'],
      deckSymbols: [],
    },
    owner: '0',
    position: { row: 6, col: 2 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  board[5][2].unit = {
    instanceId: 'telekinesis-target',
    cardId: 'test-telekinesis-target',
    card: {
      id: 'test-telekinesis-target',
      name: 'Enemy Target',
      cardType: 'unit',
      faction: 'necromancer',
      cost: 1,
      life: 1,
      strength: 1,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'common',
      deckSymbols: [],
    },
    owner: '1',
    position: { row: 5, col: 2 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return next;
};

test.describe('召唤师战争 - 攻击后推拉方向选择', () => {
  test('念力：攻击后推拉目标单位', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'trickster', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable for online tests.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const coreState = await readCoreState(hostPage);
      const telekinesisCore = prepareTelekinesisState(coreState);
      await applyCoreState(hostPage, telekinesisCore);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(500);

      await waitForPhase(hostPage, 'attack');

      const mage = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Telekinesis Mage"]').first();
      await expect(mage).toBeVisible({ timeout: 5000 });

      const enemyUnit = hostPage.locator('[data-testid^="sw-unit-"][data-owner="1"][data-unit-name="Enemy Target"]').first();
      await expect(enemyUnit).toBeVisible({ timeout: 5000 });
      const initialEnemyTestId = await enemyUnit.getAttribute('data-testid');
      if (!initialEnemyTestId) {
        throw new Error('无法读取目标单位初始位置');
      }

      await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Telekinesis Mage"]');
      await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="1"][data-unit-name="Enemy Target"]');

      const diceResult = hostPage.getByTestId('sw-dice-result-overlay');
      await expect(diceResult).toBeVisible({ timeout: 8000 });

      const closeButton = diceResult.locator('button').filter({ hasText: /Close|Confirm/i });
      await expect(closeButton).toBeVisible({ timeout: 3000 });
      await closeButton.click();
      await expect(diceResult).toBeHidden({ timeout: 5000 });

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
          .locator('[data-testid^="sw-unit-"][data-owner="1"][data-unit-name="Enemy Target"]')
          .first()
          .getAttribute('data-testid');
        return currentTestId !== initialEnemyTestId;
      }, { timeout: 5000 }).toBe(true);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
