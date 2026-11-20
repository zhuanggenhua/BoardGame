import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('预置代表态：起源故事在空牌库时洗入弃牌并抽取杀人狂', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,pirates', p1: 'ninjas,aliens', skipFactionSelect: true,
    skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [{ uid: 'origin', defId: 'diy_killers_origin_story', type: 'action', owner: '0' }],
      deck: [], discard: [{ uid: 'jason', defId: 'diy_killers_jason', type: 'minion', owner: '0' }],
      factions: ['diy_killers', 'pirates'], minionsPlayed: 0, minionLimit: 1,
      actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    player1: {
      hand: [], deck: [], discard: [], factions: ['ninjas', 'aliens'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    bases: [{ defId: 'base_the_factory', minions: [] }, { defId: 'base_the_mothership', minions: [] }],
  });
  await game.screenshot('01-预置空牌库-打出起源故事前', testInfo);
  await game.playCard('diy_killers_origin_story');
  await game.waitForNoInteraction(10000);
  await expect.poll(async () => {
    const state = await game.getState();
    const player = state.core.players['0'];
    return {
      recovered: player.hand.some((card: { uid: string }) => card.uid === 'jason'),
      remainsInDiscard: player.discard.some((card: { uid: string }) => card.uid === 'jason'),
      actionLimit: player.actionLimit,
      interactionQueue: state.sys.interaction?.queue?.length ?? 0,
      triggerQueue: state.core.triggerQueue?.length ?? 0,
    };
  }).toEqual({ recovered: true, remainsInDiscard: false, actionLimit: 2, interactionQueue: 0, triggerQueue: 0 });
  await expect(page.getByTestId('su-hand-area').locator('[data-card-uid="jason"]')).toBeVisible();
  await game.screenshot('02-预置空牌库-抽到杰森', testInfo);
});
