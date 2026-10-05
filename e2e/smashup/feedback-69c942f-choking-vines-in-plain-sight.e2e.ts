import { test, expect } from '../framework';

test.describe('线上反馈 69c942f 食人藤蔓与一目了然', () => {
  test.setTimeout(120000);

  test('力量2的本地人受一目了然保护，不被对手食人藤蔓消灭', async ({ game, page }) => {
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene({
      gameId: 'smashup',
      player0: { factions: ['killer_plants_pod', 'werewolves'] },
      player1: { factions: ['innsmouth_pod', 'minions_of_cthulhu_pod'] },
      bases: [
        {
          defId: 'base_mountains_of_madness_pod',
          minions: [{
            uid: 'protected-local',
            defId: 'innsmouth_the_locals_pod',
            controller: '1',
            owner: '1',
            basePower: 2,
            attachedActions: [{ uid: 'cv-pod-1', defId: 'killer_plant_choking_vines_pod', ownerId: '0' }],
          }],
          ongoingActions: [{ uid: 'ips-pod-1', defId: 'innsmouth_in_plain_sight_pod', ownerId: '1' }],
        },
        { defId: 'base_the_workshop_pod', minions: [] },
        { defId: 'base_secret_garden_pod', minions: [] },
      ],
      currentPlayer: '1',
      phase: 'playCards',
    });

    await game.advancePhase();
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        currentPlayer: state.core.turnOrder[state.core.currentPlayerIndex],
        destroyed: state.core.turnDestroyedMinions?.some((item: any) => item.uid === 'protected-local') ?? false,
        stillOnBase: state.core.bases[0].minions.some((minion: any) => minion.uid === 'protected-local'),
      };
    }, { timeout: 10000 }).toEqual({
      currentPlayer: '0',
      destroyed: false,
      stillOnBase: true,
    });

    await page.screenshot({ path: 'test-results/evidence-screenshots/feedback-69c942f-in-plain-sight-pass.png', fullPage: true });
  });
});
