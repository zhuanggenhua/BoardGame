/**
 * SummonerWars - 攻击后选择友方单位 E2E 测试
 *
 * 覆盖范围：
 * - 心灵传念（mind_transmission）：攻击后给友方单位额外攻击
 * - 友方单位选择 UI 交互
 * - 额外攻击状态应用
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

const prepareMindTransmissionState = (coreState: any) => {
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
  clearBoardCell(board, 6, 4);

  board[6][2].unit = {
    instanceId: 'mind-champion',
    cardId: 'test-mind-champion',
    card: {
      id: 'test-mind-champion',
      name: 'Mind Champion',
      cardType: 'unit',
      faction: 'trickster',
      cost: 3,
      life: 8,
      strength: 4,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'champion',
      abilities: ['mind_transmission'],
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
    instanceId: 'mind-target',
    cardId: 'test-mind-target',
    card: {
      id: 'test-mind-target',
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

  board[6][4].unit = {
    instanceId: 'mind-soldier',
    cardId: 'test-mind-soldier',
    card: {
      id: 'test-mind-soldier',
      name: 'Mind Soldier',
      cardType: 'unit',
      faction: 'trickster',
      cost: 1,
      life: 2,
      strength: 2,
      attackType: 'melee',
      attackRange: 1,
      unitClass: 'common',
      deckSymbols: [],
    },
    owner: '0',
    position: { row: 6, col: 4 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
  };

  return next;
};

test.describe('召唤师战争 - 攻击后选择友方单位', () => {
  test('心灵传念：攻击后给友方单位额外攻击', async ({ browser }, testInfo) => {
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
      const preparedCore = prepareMindTransmissionState(coreState);
      await applyCoreState(hostPage, preparedCore);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(500);

      await waitForPhase(hostPage, 'attack');

      const champion = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Mind Champion"]').first();
      const allySoldier = hostPage.locator('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Mind Soldier"]').first();
      await expect(champion).toBeVisible({ timeout: 5000 });
      await expect(allySoldier).toBeVisible({ timeout: 5000 });

      await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Mind Champion"]');
      await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="1"][data-unit-name="Enemy Target"]');

      const diceResult = hostPage.getByTestId('sw-dice-result-overlay');
      await expect(diceResult).toBeVisible({ timeout: 8000 });

      const closeButton = diceResult.locator('button').filter({ hasText: /Close|Confirm/i });
      await expect(closeButton).toBeVisible({ timeout: 3000 });
      await closeButton.click();
      await expect(diceResult).toBeHidden({ timeout: 5000 });

      const allySelectionPrompt = hostPage.locator('[data-testid="sw-ability-prompt"]').or(
        hostPage.locator('[class*="prompt"]').filter({ hasText: /Select ally|Extra attack/i }),
      );
      await expect(allySelectionPrompt).toBeVisible({ timeout: 8000 });

      await clickBoardElement(hostPage, '[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Mind Soldier"]');
      await expect(allySelectionPrompt).toBeHidden({ timeout: 5000 });

      await expect.poll(async () => {
        const soldierState = await hostPage.evaluate(() => {
          const soldier = document.querySelector('[data-testid^="sw-unit-"][data-owner="0"][data-unit-name="Mind Soldier"]');
          return soldier?.getAttribute('data-extra-attacks') || soldier?.getAttribute('data-has-extra-attack');
        });
        return soldierState !== null && soldierState !== '0';
      }, { timeout: 5000 }).toBe(true);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
