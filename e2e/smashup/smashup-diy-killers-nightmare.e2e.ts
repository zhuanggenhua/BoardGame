import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

test('预置代表态：梦魇世界计分前摧毁并列最低力量随从并继续计分', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await setChineseLocale(page.context());
  await game.openTestGame('smashup', {
    p0: 'diy_killers,wizards', p1: 'ninjas,aliens', skipFactionSelect: true,
    skipInitialization: false, seed: 20261120,
  }, 45000);
  await game.setupScene({
    gameId: 'smashup', currentPlayer: '0', phase: 'playCards',
    player0: {
      hand: [], deck: [
        { uid: 'draw-1', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
        { uid: 'draw-2', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
        { uid: 'draw-3', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
        { uid: 'draw-4', defId: 'wizard_neophyte', type: 'minion', owner: '0' },
      ], discard: [], factions: ['diy_killers', 'wizards'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    player1: {
      hand: [], deck: [
        { uid: 'enemy-draw-1', defId: 'ninja_acolyte', type: 'minion', owner: '1' },
        { uid: 'enemy-draw-2', defId: 'ninja_acolyte', type: 'minion', owner: '1' },
        { uid: 'enemy-draw-3', defId: 'ninja_acolyte', type: 'minion', owner: '1' },
        { uid: 'enemy-draw-4', defId: 'ninja_acolyte', type: 'minion', owner: '1' },
      ], discard: [], factions: ['ninjas', 'aliens'],
      minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, vp: 0,
    },
    bases: [
      { defId: 'base_diy_killers_nightmare_world', minions: [
        { uid: 'strong', defId: 'diy_killers_jason', owner: '0', controller: '0', powerModifier: 15 },
        { uid: 'weak-own', defId: 'wizard_neophyte', owner: '0', controller: '0' },
        { uid: 'weak-enemy', defId: 'ninja_acolyte', owner: '1', controller: '1' },
      ] },
      { defId: 'base_the_factory', minions: [] },
    ],
  });
  await game.screenshot('01-预置代表态-并列最低力量等待计分', testInfo);
  await game.advancePhase();
  await expect.poll(async () => {
    const state = await game.getState();
    return {
      player0Vp: state.core.players['0'].vp,
      player1Vp: state.core.players['1'].vp,
      ownDiscard: state.core.players['0'].discard.map((card: { uid: string }) => card.uid),
      enemyDiscard: state.core.players['1'].discard.map((card: { uid: string }) => card.uid),
      destroyed: (state.sys.eventStream?.entries ?? [])
        .map((entry: { event?: { type?: string; payload?: { reason?: string; minionUid?: string } } }) => entry.event)
        .filter((event: { type?: string; payload?: { reason?: string } } | undefined) => event?.type === 'su:minion_destroyed' && event.payload?.reason === 'base_diy_killers_nightmare_world')
        .map((event: { payload?: { minionUid?: string } }) => event.payload?.minionUid).sort(),
      oldBasePresent: state.core.bases.some((base: { defId: string }) => base.defId === 'base_diy_killers_nightmare_world'),
      interactionOpen: Boolean(state.sys.interaction?.current),
      queue: state.core.triggerQueue?.length ?? 0,
    };
  }, { timeout: 20000 }).toMatchObject({
    player0Vp: 5, player1Vp: 0,
    ownDiscard: expect.arrayContaining(['weak-own', 'strong']),
    enemyDiscard: expect.arrayContaining(['weak-enemy']),
    destroyed: ['weak-enemy', 'weak-own'],
    oldBasePresent: false, interactionOpen: false, queue: 0,
  });
  await game.screenshot('02-并列最低随从离场并完成计分', testInfo);
});
