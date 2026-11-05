import { test, expect } from './framework';
import { setChineseLocale } from './helpers/common';

test.describe('SmashUp 线上反馈 69fd9c33：额度用尽仍可结束回合', () => {
  test('真实入口点击结束回合后推进到下一位玩家', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 100,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'draw-0-1', defId: 'dino_war_raptor_pod', type: 'minion', owner: '0' },
                { uid: 'draw-0-2', defId: 'dino_howl_pod', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['dinosaurs', 'innsmouth'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 1,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'draw-1-1', defId: 'robot_microbot_guard', type: 'minion', owner: '1' },
                { uid: 'draw-1-2', defId: 'wizard_neophyte', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['robots', 'wizards'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_the_factory', minions: [], ongoingActions: [] },
            { defId: 'base_tortuga', minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.waitForCurrentPlayer('0', 10000);
    await expect(page.getByTestId('su-end-turn-action-button')).toBeVisible();
    await expect(page.getByText(/命令执行异常/)).toHaveCount(0);
    await game.screenshot('feedback-69fd9c33-before-end-turn', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        phase: state?.sys?.phase ?? null,
        currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
        interaction: state?.sys?.interaction?.current ?? null,
      };
    }, { timeout: 20000 }).toEqual({
      phase: 'playCards',
      currentPlayerIndex: 1,
      interaction: null,
    });

    await expect(page.getByText(/命令执行异常/)).toHaveCount(0);
    await expect(page.getByTestId('su-end-turn-action-button')).toBeVisible();
    await game.screenshot('feedback-69fd9c33-after-end-turn', testInfo);
  });
});
