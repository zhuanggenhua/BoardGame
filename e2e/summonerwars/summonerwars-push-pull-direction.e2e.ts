import { test } from '@playwright/test';
import { expect, createSummonerWarsMatch } from '../fixtures';
import { GameTestContext } from '../framework/GameTestContext';
import { prepareTelekinesisState } from '../helpers/summonerwars-abilities-states';
import {
  applyCoreState,
  clickBoardElement,
  closeDebugPanelIfOpen,
  getBoardUnit,
  readCoreState,
  waitForPhase,
} from '../helpers/summonerwars';

test.describe('SummonerWars telekinesis regression', () => {
  test('pushes attacked target to resolved destination and syncs opponent view', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await createSummonerWarsMatch(browser, baseURL, 'necromancer', 'trickster');

    if (!setup) {
      test.skip(true, 'Game server unavailable or room creation failed');
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup!;
    const hostGame = new GameTestContext(hostPage);

    const coreState = await readCoreState(hostPage);
    const telekinesisState = prepareTelekinesisState(coreState);
    await applyCoreState(hostPage, telekinesisState);
    await closeDebugPanelIfOpen(hostPage);

    await waitForPhase(hostPage, 'attack');
    await expect(getBoardUnit(hostPage, 5, 2)).toBeVisible();
    await expect(getBoardUnit(hostPage, 5, 3)).toBeVisible();

    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-2"]');
    await clickBoardElement(hostPage, '[data-testid="sw-unit-5-3"]');

    const diceOverlay = hostPage.getByTestId('sw-dice-result-overlay');
    await expect(diceOverlay).toBeVisible({ timeout: 8000 });
    await diceOverlay.click({ force: true });
    await expect(diceOverlay).toBeHidden({ timeout: 5000 });

    const stateBeforeAbility = await readCoreState(hostPage);
    const targetUnitId = stateBeforeAbility.board[5]?.[3]?.unit?.instanceId;
    const sourceUnitId = stateBeforeAbility.board[5]?.[2]?.unit?.instanceId;
    if (!targetUnitId) {
      throw new Error('Telekinesis target unit at 5-3 not found before ability resolution');
    }
    if (!sourceUnitId) {
      throw new Error('Telekinesis source unit at 5-2 not found before ability resolution');
    }

    // 当前 SW 页面未暴露 __BG_DISPATCH__，且 transform 棋盘上的终点格点击不稳定；
    // 这里改用通用 __BG_TEST_HARNESS__.command.dispatch 发最终能力命令。
    await hostPage.evaluate(async ({ sourceUnitId }) => {
      const harness = (window as Window & {
        __BG_TEST_HARNESS__?: { command: { dispatch: (command: unknown) => Promise<void> } };
      }).__BG_TEST_HARNESS__;
      if (!harness) throw new Error('__BG_TEST_HARNESS__ not found');
      await harness.command.dispatch({
        type: 'sw:activate_ability',
        playerId: '0',
        payload: {
          abilityId: 'telekinesis',
          sourceUnitId,
          targetPosition: { row: 5, col: 3 },
          moveRow: 0,
          moveCol: 1,
        },
      });
    }, { sourceUnitId });

    await expect.poll(async () => await getBoardUnit(hostPage, 5, 4).count(), { timeout: 5000 }).toBe(1);
    await expect.poll(async () => await getBoardUnit(hostPage, 5, 3).count(), { timeout: 5000 }).toBe(0);
    await expect.poll(async () => await getBoardUnit(guestPage, 5, 4).count(), { timeout: 5000 }).toBe(1);

    await hostGame.screenshot('telekinesis-push-resolved', testInfo);

    await hostContext.close();
    await guestContext.close();
  });
});
