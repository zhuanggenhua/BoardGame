import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
  applyCoreState,
  clickBoardElement,
  cloneState,
  closeDebugPanelIfOpen,
  getBoardStructure,
  readCoreState,
  setupSWOnlineMatch,
  waitForPhase,
} from '../helpers/summonerwars';
import { EVENT_CARDS_FROST } from '../../src/games/summonerwars/config/factions/frost';

const PARAPET_CARD = EVENT_CARDS_FROST.find((card) => card.id === 'frost-parapet');
if (!PARAPET_CARD) {
  throw new Error('护城墙卡牌定义不存在');
}

type MutableCore = Record<string, any>;

const clearBoardCell = (board: any[][], row: number, col: number) => {
  board[row][col].unit = null;
  board[row][col].structure = null;
};

const prepareParapetBuildState = (coreState: unknown) => {
  const next = cloneState(coreState) as MutableCore;
  const targetPosition = { row: 5, col: 2 };
  const parapetInstanceId = 'frost-parapet-e2e-hand';

  next.phase = 'build';
  next.currentPlayer = '0';
  next.selectedUnit = undefined;
  next.pendingInteractions = [];
  next.abilityUsageCount = {};

  const player = next.players?.['0'];
  if (!player) throw new Error('玩家 0 状态不存在');

  player.magic = Math.max(Number(player.magic ?? 0), Number(PARAPET_CARD.cost ?? 0));
  player.buildCount = 0;
  player.hand = [
    { ...PARAPET_CARD, id: parapetInstanceId },
    ...(player.hand ?? []).filter((card: { id?: string }) => card.id !== parapetInstanceId),
  ];

  clearBoardCell(next.board, targetPosition.row, targetPosition.col);

  return { core: next, targetPosition, parapetInstanceId };
};

test.describe('召唤师战争 - 护城墙', () => {
  test('护城墙：手牌点选后点击棋盘成功放置为建筑', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(testInfo);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const match = await setupSWOnlineMatch(browser, baseURL, 'frost', 'necromancer');
    if (!match) {
      test.skip(true, 'Game server unavailable for online tests.');
      return;
    }

    const { hostPage, hostContext, guestContext } = match;

    try {
      const coreState = await readCoreState(hostPage);
      const prepared = prepareParapetBuildState(coreState);
      await applyCoreState(hostPage, prepared.core);
      await closeDebugPanelIfOpen(hostPage);
      await hostPage.waitForTimeout(500);

      await waitForPhase(hostPage, 'build');

      const parapetCard = hostPage.locator(`[data-card-id="${prepared.parapetInstanceId}"][data-card-name="护城墙"]`).first();
      await expect(parapetCard).toBeVisible({ timeout: 8000 });

      await parapetCard.click({ force: true });
      await expect(parapetCard).toHaveAttribute('data-selected', 'true', { timeout: 5000 });

      const targetCell = hostPage.getByTestId(`sw-cell-${prepared.targetPosition.row}-${prepared.targetPosition.col}`);
      await expect(targetCell).toHaveAttribute('data-valid-build', 'true', { timeout: 5000 });
      await expect.poll(async () => targetCell.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          borderTopColor: style.borderTopColor,
          backgroundColor: style.backgroundColor,
        };
      }), { timeout: 5000 }).toEqual({
        borderTopColor: 'rgb(74, 222, 128)',
        backgroundColor: 'rgba(74, 222, 128, 0.3)',
      });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '护城墙-绿色可放置高亮', {
          subdir: 'summonerwars/summonerwars-frost-parapet.e2e/护城墙：手牌点选后点击棋盘成功放置为建筑',
          requireChineseName: true,
        }),
        fullPage: true,
        type: 'jpeg',
        quality: 90,
      });

      await clickBoardElement(hostPage, `[data-testid="sw-cell-${prepared.targetPosition.row}-${prepared.targetPosition.col}"]`);

      await expect(getBoardStructure(hostPage, prepared.targetPosition.row, prepared.targetPosition.col)).toBeVisible({ timeout: 8000 });
      await expect(getBoardStructure(hostPage, prepared.targetPosition.row, prepared.targetPosition.col)).toHaveAttribute('data-owner', '0');

      await expect.poll(async () => {
        const state = await readCoreState(hostPage) as MutableCore;
        const structure = state.board?.[prepared.targetPosition.row]?.[prepared.targetPosition.col]?.structure;
        return {
          name: structure?.card?.name ?? null,
          cardId: structure?.cardId ?? null,
          stillInHand: Boolean(state.players?.['0']?.hand?.some((card: { id?: string }) => card.id === prepared.parapetInstanceId)),
        };
      }, { timeout: 8000 }).toEqual({
        name: '护城墙',
        cardId: prepared.parapetInstanceId,
        stillInHand: false,
      });

      await hostPage.screenshot({
        path: getEvidenceScreenshotPath(testInfo, '护城墙-放置成功', {
          subdir: 'summonerwars/summonerwars-frost-parapet.e2e/护城墙：手牌点选后点击棋盘成功放置为建筑',
          requireChineseName: true,
        }),
        fullPage: true,
        type: 'jpeg',
        quality: 90,
      });
    } finally {
      void hostContext.close().catch(() => {});
      void guestContext.close().catch(() => {});
    }
  });
});
