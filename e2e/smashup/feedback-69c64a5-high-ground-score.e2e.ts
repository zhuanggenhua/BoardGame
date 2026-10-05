import { test, expect } from '../framework';

test.describe('线上反馈 69c64a5 制高点消灭计分', () => {
  test.setTimeout(120000);
  test('制高点消灭移动随从后，荣誉之地把 1VP 记给制高点控制者', async ({ game, page }) => {
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene({
      gameId: 'smashup',
      player0: { factions: ['bear_cavalry', 'pirates'] },
      player1: { factions: ['robots', 'aliens'] },
      bases: [
        { defId: 'base_the_workshop', minions: [
          { uid: 'own-source-minion', defId: 'bear_cavalry_cub_scout', controller: '0', owner: '0', basePower: 3 },
          { uid: 'moved-minion', defId: 'robot_microbot_alpha', controller: '1', owner: '1', basePower: 1 },
        ] },
        { defId: 'base_the_field_of_honor', minions: [{ uid: 'own-minion', defId: 'bear_cavalry_general_ivan', controller: '0', owner: '0', basePower: 4 }], ongoingActions: [{ uid: 'high-ground', defId: 'bear_cavalry_high_ground', ownerId: '0' }] },
        { defId: 'base_the_mines', minions: [] },
      ],
      currentPlayer: '0', phase: 'playCards',
    });
    await page.evaluate(async () => {
      const h = (window as any).__BG_TEST_HARNESS__;
      const s = h.state.get();
      await h.state.patch({ core: { ...s.core, currentPlayerIndex: 0, players: { ...s.core.players, '0': { ...s.core.players['0'], hand: [{ uid: 'feedback-high-ground-card', defId: 'bear_cavalry_youre_screwed', type: 'action', owner: '0' }], actionsPlayed: 0, actionLimit: 1, vp: 0 }, '1': { ...s.core.players['1'], vp: 0 } } } });
    });
    await game.playCard('bear_cavalry_youre_screwed');
    await game.waitForInteraction('bear_cavalry_youre_screwed_choose_base');
    await game.selectOption((await game.getInteractionOptions()).find((o: any) => o.value?.baseIndex === 0)?.id);
    await game.waitForInteraction('bear_cavalry_youre_screwed_choose_minion');
    await game.selectOption((await game.getInteractionOptions()).find((o: any) => o.value?.minionUid === 'moved-minion')?.id);
    await game.waitForInteraction('bear_cavalry_youre_screwed_choose_dest');
    await game.selectOption((await game.getInteractionOptions()).find((o: any) => o.value?.baseIndex === 1)?.id);
    await game.waitForNoInteraction();
    const state = await game.getState();
    expect(state.core.players['0'].vp).toBe(1);
    expect(state.core.bases[1].minions.some((m: any) => m.uid === 'moved-minion')).toBe(false);
    expect(state.core.players['1'].discard.some((c: any) => c.uid === 'moved-minion')).toBe(true);
  });
});
