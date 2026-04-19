/**
 * SummonerWars - 结构变换 E2E 测试
 *
 * 覆盖范围：
 * - 建筑转移（structure_shift）：移动后推拉友方建筑
 * - 目标建筑选择 UI（StatusBanners）
 * - 新位置选择（棋盘点击）
 * - 建筑位置变化
 */

import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
  applyCoreState,
  clickBoardElement,
  cloneState,
  closeDebugPanelIfOpen,
  readCoreState,
  setupSWOnlineMatch,
  waitForPhase,
} from '../helpers/summonerwars';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- E2E 测试中 coreState 为动态 JSON 结构
const clearBoardCell = (board: any[][], row: number, col: number) => {
  board[row][col].unit = null;
  board[row][col].structure = null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- E2E 测试中 coreState 为动态 JSON 结构
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
    cardId: 'shift-structure-gate',
    card: {
      id: 'shift-structure-gate',
      cardType: 'structure',
      name: '测试城门',
      faction: 'frost',
      cost: 0,
      life: 5,
      deckSymbols: [],
      spriteAtlas: 'portal',
      spriteIndex: 0,
    },
    owner: '0',
    position: { row: 6, col: 4 },
    damage: 0,
  };

  return next;
};

test.describe('召唤师战争 - 结构变换', () => {
  test('建筑转移：移动后推拉友方建筑', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable for online tests.');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = match;

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

      const structureShiftBannerText = hostPage.locator('span').filter({
        hasText: /结构变换：选择3格内友方建筑|Structure Shift: Select friendly building within 3/i,
      }).first();
      const skipButton = hostPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i }).first();
      await expect(structureShiftBannerText).toBeVisible({ timeout: 8000 });
      await expect(skipButton).toBeVisible({ timeout: 3000 });
      await expect(guestPage.locator('button').filter({ hasText: /^Skip$|^跳过$/i })).toHaveCount(0);
      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'structure-shift-owner-visible', {
          subdir: 'summonerwars/summonerwars-structure-shift.e2e/建筑转移：移动后推拉友方建筑',
        }),
        fullPage: true,
      });
      await guestPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'structure-shift-guest-hidden', {
          subdir: 'summonerwars/summonerwars-structure-shift.e2e/建筑转移：移动后推拉友方建筑',
        }),
        fullPage: true,
      });

      await clickBoardElement(hostPage, '[data-testid^="sw-structure-"][data-owner="0"]');

      await clickBoardElement(hostPage, '[data-testid="sw-cell-5-4"]');

      await expect.poll(async () => {
        const currentTestId = await hostPage
          .locator('[data-testid^="sw-structure-"][data-owner="0"]')
          .first()
          .getAttribute('data-testid');
        return currentTestId !== initialStructureTestId;
      }, { timeout: 5000 }).toBe(true);
      await expect(hostPage.locator('[data-testid="sw-structure-5-4"][data-owner="0"]')).toBeVisible({ timeout: 5000 });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, 'structure-shift-after-move', {
          subdir: 'summonerwars/summonerwars-structure-shift.e2e/建筑转移：移动后推拉友方建筑',
        }),
        fullPage: true,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });
});
