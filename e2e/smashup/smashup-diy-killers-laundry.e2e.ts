import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('预置代表态：宿主不能移动时洗衣间直接进入可选摧毁', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,pirates', p1: 'killer_plants,ninjas', seat1: 'human',
    skipFactionSelect: true, skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [
        { uid: 'laundry', defId: 'diy_killers_laundry_room', type: 'action', owner: '0' },
        { uid: 'jason', defId: 'diy_killers_jason', type: 'minion', owner: '0' },
      ],
      deck: [], discard: [], factions: ['diy_killers', 'pirates'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    player1: {
      hand: [{ uid: 'keep', defId: 'ninja_acolyte', type: 'minion', owner: '1' }],
      deck: [], discard: [], factions: ['killer_plants', 'ninjas'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    bases: [
      { defId: 'base_the_factory', minions: [
        { uid: 'host', defId: 'ninja_acolyte', owner: '1', controller: '1' },
      ], ongoingActions: [{ uid: 'entangled', defId: 'killer_plant_entangled', ownerId: '1' }] },
      { defId: 'base_the_mothership', minions: [] },
    ],
  });
  await game.playCard('diy_killers_laundry_room', { targetBaseIndex: 0, targetMinionUid: 'host' });
  await game.waitForNoInteraction(10000);
  await expect.poll(async () => {
    const state = await game.getState();
    return { attached: state.core.bases[0].minions[0]?.attachedActions?.some((card: { uid: string }) => card.uid === 'laundry'), actionLimit: state.core.players['0'].actionLimit };
  }).toEqual({ attached: true, actionLimit: 2 });
  await game.playCard('diy_killers_jason', { targetBaseIndex: 0 });
  await game.waitForInteraction('diy_killers_laundry_room_destroy', 15000);
  await game.screenshot('01-预置移动保护-选择是否摧毁', testInfo);
  await page.locator('[data-minion-uid="host"]').click();
  await game.waitForNoInteraction(15000);
  await expect.poll(async () => {
    const state = await game.getState();
    return {
      hostDiscarded: state.core.players['1'].discard.some((card: { uid: string }) => card.uid === 'host'),
      keepInHand: state.core.players['1'].hand.some((card: { uid: string }) => card.uid === 'keep'),
      laundryDiscarded: state.core.players['0'].discard.some((card: { uid: string }) => card.uid === 'laundry'),
      interactionQueue: state.sys.interaction?.queue?.length ?? 0,
      triggerQueue: state.core.triggerQueue?.length ?? 0,
    };
  }).toEqual({ hostDiscarded: true, keepInHand: true, laundryDiscarded: true, interactionQueue: 0, triggerQueue: 0 });
});
