import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

type SceneCard = {
  uid: string;
  defId: string;
  factionA: string;
  factionB: string;
};

async function setupPolarCommandoScene(
  game: any,
  page: any,
  card: SceneCard,
) {
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
              { uid: card.uid, defId: card.defId, type: 'minion', owner: '0' },
            ],
            deck: [],
            discard: [],
            factions: [card.factionA, card.factionB],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
          },
          '1': {
            id: '1',
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            factions: ['robots', 'pirates'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
          },
        },
        bases: [
          {
            defId: 'base_the_vats',
            breakpoint: 18,
            minions: [],
            ongoingActions: [],
          },
        ],
        baseDeck: ['base_faceless_city'],
        baseDiscard: [],
      },
    },
  });

  await game.waitForPhase('playCards', 10000);
  await game.playCard(card.defId, { targetBaseIndex: 0 });
  await game.waitForNoInteraction(10000);

  await expect.poll(async () => {
    const state = await game.getState();
    return state?.sys?.interaction?.current == null
      && state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === card.uid);
  }, {
    message: `${card.defId} 真实打出后应进入基地且不残留交互`,
    timeout: 15000,
  }).toBe(true);
}

test.describe('SmashUp 极地突击队员 POD 真实入口验证', () => {
  test('原版极地突击队员唯一时仍显示 +2 力量', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);

    await setupPolarCommandoScene(game, page, {
      uid: 'polar-base-hand',
      defId: 'bear_cavalry_polar_commando',
      factionA: 'bear_cavalry',
      factionB: 'robots',
    });

    const plusTwoBadge = page.locator('[data-minion-uid="polar-base-hand"] [title*="极地突击队员: +2"]');
    await expect(plusTwoBadge).toBeVisible({ timeout: 15000 });
    await game.screenshot('bear-cavalry-polar-commando-base-plus-two', testInfo);
  });

  test('POD 极地突击队员真实打出后不应错误继承原版唯一 +2，更不应出现 +4', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);

    await setupPolarCommandoScene(game, page, {
      uid: 'polar-pod-hand',
      defId: 'bear_cavalry_polar_commando_pod',
      factionA: 'bear_cavalry_pod',
      factionB: 'robots_pod',
    });

    const anyPolarBonusBadge = page.locator('[data-minion-uid="polar-pod-hand"] [title*="极地突击队员:"]');
    const plusTwoBadge = page.locator('[data-minion-uid="polar-pod-hand"] [title*="极地突击队员: +2"]');
    const plusFourBadge = page.locator('[data-minion-uid="polar-pod-hand"] [title*="极地突击队员: +4"]');

    await expect(anyPolarBonusBadge).toHaveCount(0);
    await expect(plusTwoBadge).toHaveCount(0);
    await expect(plusFourBadge).toHaveCount(0);
    await game.screenshot('bear-cavalry-polar-commando-pod-no-bonus-badge', testInfo);
  });
});
