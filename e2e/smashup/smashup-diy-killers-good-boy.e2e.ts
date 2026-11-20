import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('预置代表态：他是个好孩子回收唯一随从并实际打出额外行动', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,wizards', p1: 'ninjas,aliens', skipFactionSelect: true,
    skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [
        { uid: 'good-boy', defId: 'diy_killers_good_boy', type: 'action', owner: '0' },
        { uid: 'extra', defId: 'wizard_mystic_studies', type: 'action', owner: '0' },
      ],
      deck: [
        { uid: 'draw-1', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
        { uid: 'draw-2', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
      ],
      discard: [
        { uid: 'recover', defId: 'diy_killers_jason', type: 'minion', owner: '0' },
        { uid: 'leave', defId: 'diy_killers_origin_story', type: 'action', owner: '0' },
      ],
      factions: ['diy_killers', 'wizards'], minionsPlayed: 0, minionLimit: 1,
      actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    player1: {
      hand: [], deck: [], discard: [], factions: ['ninjas', 'aliens'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    bases: [{ defId: 'base_the_factory', minions: [] }, { defId: 'base_the_mothership', minions: [] }],
  });
  await game.playCard('diy_killers_good_boy');
  await game.waitForInteraction('diy_killers_good_boy', 10000);
  const choice = await game.getState();
  expect(choice.sys.interaction.current.data.options.map((option: { value?: { cardUid?: string } }) => option.value?.cardUid)).toEqual(['recover']);
  const discardPanel = page.locator('[data-discard-view-panel]');
  await expect(discardPanel).toBeVisible();
  await game.screenshot('01-预置代表态-选择弃牌堆中的随从', testInfo);
  await discardPanel.locator('[data-card-uid="recover"]').click();
  await game.waitForNoInteraction(10000);
  await expect.poll(async () => {
    const player = (await game.getState()).core.players['0'];
    return { recovered: player.hand.some((card: { uid: string }) => card.uid === 'recover'), actionLimit: player.actionLimit };
  }).toEqual({ recovered: true, actionLimit: 2 });
  await game.playCard('wizard_mystic_studies');
  await game.waitForNoInteraction(10000);
  await expect.poll(async () => {
    const state = await game.getState();
    const player = state.core.players['0'];
    return {
      hand: player.hand.map((card: { uid: string }) => card.uid).sort(),
      discard: player.discard.map((card: { uid: string }) => card.uid).sort(),
      actionsPlayed: player.actionsPlayed,
      interactionQueue: state.sys.interaction?.queue?.length ?? 0,
      triggerQueue: state.core.triggerQueue?.length ?? 0,
    };
  }).toEqual({ hand: ['draw-1', 'draw-2', 'recover'], discard: ['extra', 'good-boy', 'leave'], actionsPlayed: 2, interactionQueue: 0, triggerQueue: 0 });
  await game.screenshot('02-预置代表态-回收并打出额外行动', testInfo);
});
