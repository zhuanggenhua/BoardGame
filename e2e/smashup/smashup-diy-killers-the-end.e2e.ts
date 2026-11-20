import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('预置代表态：结束了回收指定行动后立即打出并附着', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,wizards', p1: 'ninjas,aliens', skipFactionSelect: true,
    skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [{ uid: 'end', defId: 'diy_killers_is_it_over', type: 'action', owner: '0' }],
      deck: [], discard: [
        { uid: 'machete', defId: 'diy_killers_machete', type: 'action', owner: '0' },
        { uid: 'leave', defId: 'diy_killers_origin_story', type: 'action', owner: '0' },
      ],
      factions: ['diy_killers', 'wizards'], minionsPlayed: 0, minionLimit: 1,
      actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    player1: {
      hand: [], deck: [], discard: [], factions: ['ninjas', 'aliens'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    bases: [
      { defId: 'base_the_factory', minions: [{ uid: 'host', defId: 'diy_killers_jason', owner: '0', controller: '0' }] },
      { defId: 'base_the_mothership', minions: [] },
    ],
  });
  await game.playCard('diy_killers_is_it_over');
  await game.waitForInteraction('diy_killers_is_it_over', 10000);
  const discardPanel = page.locator('[data-discard-view-panel]');
  await expect(discardPanel).toBeVisible();
  await discardPanel.locator('[data-card-uid="machete"]').click();
  await game.waitForInteraction('smashup_immediate_extra_action', 10000);
  await expect(page.locator('[data-card-uid="machete"]').last()).toBeVisible();
  await game.screenshot('01-立即决定是否打出回收牌', testInfo);
  await page.locator('[data-card-uid="machete"]').last().click({ force: true });
  await game.waitForInteraction('smashup_immediate_extra_action_minion', 10000);
  await expect(page.locator('[data-minion-uid="host"]')).toHaveAttribute('data-highlighted', 'true');
  await page.locator('[data-minion-uid="host"]').click({ force: true });
  await game.waitForNoInteraction(10000);
  await expect.poll(async () => {
    const state = await game.getState();
    const player = state.core.players['0'];
    return {
      attached: state.core.bases[0].minions[0].attachedActions.map((action: { uid: string }) => action.uid),
      hand: player.hand.map((card: { uid: string }) => card.uid),
      discard: player.discard.map((card: { uid: string }) => card.uid).sort(),
      extra: player.specificExtraActionPlays ?? [],
      queue: state.core.triggerQueue?.length ?? 0,
    };
  }).toEqual({ attached: ['machete'], hand: [], discard: ['end', 'leave'], extra: [], queue: 0 });
  await game.screenshot('02-大砍刀已附着', testInfo);
});
