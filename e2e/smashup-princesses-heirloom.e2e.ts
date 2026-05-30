import { test, expect } from './framework';
import { setChineseLocale } from './helpers/common';

function hasUid(items: Array<{ uid?: string }> | undefined, uid: string): boolean {
  return Array.isArray(items) && items.some(item => item?.uid === uid);
}

test.describe('SmashUp Princesses Heirloom 真实入口审计', () => {
  test('公主-Heirloom-真实入口附着两张后被 Ninja Poison 命中 destroy 链时仍保留在宿主上', async ({ page, game }, testInfo) => {
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
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'heirloom-a', defId: 'princesses_heirloom', type: 'action', owner: '0' },
                { uid: 'heirloom-b', defId: 'princesses_heirloom', type: 'action', owner: '0' },
                { uid: 'poison-a', defId: 'ninja_poison', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['princesses', 'ninjas'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 3,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['robots'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [
                {
                  uid: 'heirloom-host',
                  defId: 'princesses_griselda',
                  controller: '0',
                  owner: '0',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
            {
              defId: 'base_the_vats',
              breakpoint: 15,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);

    await game.playCard('princesses_heirloom', { targetMinionUid: 'heirloom-host' });
    await game.waitForNoInteraction(10000);
    await game.playCard('princesses_heirloom', { targetMinionUid: 'heirloom-host' });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'heirloom-host');
      return state?.sys?.interaction?.current == null
        && hasUid(host?.attachedActions, 'heirloom-a')
        && hasUid(host?.attachedActions, 'heirloom-b')
        && !hasUid(state?.core?.players?.['0']?.discard, 'heirloom-a')
        && !hasUid(state?.core?.players?.['0']?.discard, 'heirloom-b');
    }, {
      message: '两张 Heirloom 应能通过真实入口附着到同一宿主上，且不进弃牌堆',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('princesses-heirloom-two-attached-before-poison', testInfo);

    await game.playCard('ninja_poison', { targetMinionUid: 'heirloom-host' });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'heirloom-host');
      const attachedUids = (host?.attachedActions ?? []).map((action: any) => action.uid);
      return state?.sys?.interaction?.current == null
        && attachedUids.length === 3
        && attachedUids.includes('heirloom-a')
        && attachedUids.includes('heirloom-b')
        && attachedUids.includes('poison-a')
        && !hasUid(state?.core?.players?.['0']?.discard, 'heirloom-a')
        && !hasUid(state?.core?.players?.['0']?.discard, 'heirloom-b')
        && !hasUid(state?.core?.players?.['0']?.discard, 'poison-a');
    }, {
      message: 'Ninja Poison 的 destroy 链命中后，Heirloom 仍应留在宿主上，Poison 自己也正常附着',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('princesses-heirloom-survived-ninja-poison-destroy-attempt', testInfo);
  });
});
